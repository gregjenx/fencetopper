// POST /api/projects: save a project from Shop.
// New customer or signed-out save: create the customer and project, email an "Open my project" link,
// and tell the team. Signed-in save with project_id (editing from /my-project): update that project.
// Without the keys it answers { configured: false } and Shop sends the request through Formspree instead.
import {
  configured, json, readJson, db, magicLink, userFromRequest, sendEmail, dashboardLink,
  cleanProject, estimate, ratesUsed, money, fmtLen, summary,
} from '../../server/lib.js';
import { confirmationEmail, teamNotice } from '../../server/emails.js';

// GET /api/projects: lets Shop know whether saving with an emailed link is switched on.
export function onRequestGet({ env }) {
  return json({ configured: !!configured(env) });
}

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const body = await readJson(request);
  if (body && body.company) return json({ configured: true, saved: true }); // honeypot: bots fill every field
  const { value: p, error } = cleanProject(body);
  if (error) return json({ configured: true, error }, 400);

  const est = estimate(p.runs, p.height);
  const fields = {
    runs: p.runs, height: p.height, color: p.color, extender: p.extender, notes: p.notes,
    estimate_cents: est.cents, rates_used: ratesUsed(), last_customer_activity_at: new Date().toISOString(),
  };
  const label = summary(p);
  const team = {
    first: p.first, last: p.last, email: p.email, mobile: p.mobile, summary: label, estimate: money(est.cents),
    runs: p.runs.map(fmtLen), notes: p.notes, extender: p.extender && p.extender.name, marketing: p.marketing,
    staffLink: dashboardLink(env, 'projects'),
  };

  try {
    // Signed in and editing a project they own: update it in place.
    const user = p.projectId ? await userFromRequest(env, request) : null;
    if (user) {
      const own = await db(env, `projects?id=eq.${p.projectId}&customer_id=eq.${user.id}&select=id,state`);
      if (own.ok && own.data && own.data.length) {
        const upd = await db(env, `projects?id=eq.${p.projectId}`, { method: 'PATCH', body: fields, prefer: 'return=minimal' });
        if (!upd.ok) throw new Error(`project update ${upd.status}`);
        await db(env, `customers?id=eq.${user.id}`, { method: 'PATCH', body: customerFields(p), prefer: 'return=minimal' });
        await sendEmail(env, { to: env.TEAM_NOTIFY_EMAIL, replyTo: p.email, ...teamNotice({ kind: 'updated', ...team }) });
        return json({ configured: true, saved: true, updated: true, projectId: p.projectId, emailSent: false });
      }
    }

    const redirect = `${new URL(request.url).origin}/my-project`;
    const auth = await magicLink(env, p.email, redirect, { first: p.first, last: p.last });

    const cust = await db(env, 'customers?on_conflict=id', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { id: auth.userId, email: p.email, email_confirmed_at: auth.emailConfirmedAt, ...customerFields(p) },
    });
    if (!cust.ok) throw new Error(`customer ${cust.status}`);

    const proj = await db(env, 'projects?select=id', {
      method: 'POST', prefer: 'return=representation',
      body: { customer_id: auth.userId, name: `${p.last} fence`, state: 'in-progress', ...fields },
    });
    if (!proj.ok || !proj.data || !proj.data[0]) throw new Error(`project ${proj.status}`);
    const projectId = proj.data[0].id;

    const [emailSent] = await Promise.all([
      sendEmail(env, { to: p.email, ...confirmationEmail({ first: p.first, summary: label, estimate: money(est.cents), link: auth.link }) }),
      sendEmail(env, { to: env.TEAM_NOTIFY_EMAIL, replyTo: p.email, ...teamNotice({ kind: 'saved', ...team }) }),
    ]);
    return json({ configured: true, saved: true, projectId, emailSent });
  } catch (e) {
    console.error('save project failed', e && e.message);
    // configured but failing: Shop falls back to Formspree so the request still reaches the team.
    return json({ configured: true, saved: false }, 502);
  }
}

function customerFields(p) {
  const f = { first: p.first, last: p.last, mobile: p.mobile, marketing_opt_in: p.marketing };
  if (p.marketing) f.marketing_opt_in_at = new Date().toISOString();
  return f;
}

