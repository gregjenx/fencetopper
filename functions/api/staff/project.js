// GET /api/staff/project?id=: one project with everything staff need to review it. Staff only.
// POST /api/staff/project { project_id, action, ... }:
//   verify { key }          mark a part of the project as checked (staff-only note)
//   ask { text }            message the customer, move to "waiting", and email them a link
//   publish { price, note } set the final design and price, move to "awaiting-approval", and email them
//   advance { state }       move the project to another status
import { configured, json, readJson, db, magicLink, sendEmail, money } from '../../../server/lib.js';
import { staffUpdateEmail } from '../../../server/emails.js';
import { staffUser, STAFF_STATES } from '../../../server/staff.js';

const FIELDS = 'id,name,state,runs,height,color,extender,notes,estimate_cents,builder,staff,final_design,created_at,updated_at,submitted_at,customers(first,last,email,mobile),messages(author,body,created_at)';

async function load(env, id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await db(env, `projects?id=eq.${id}&select=${FIELDS}&messages.order=created_at.asc`);
  return r.ok && r.data && r.data[0] ? r.data[0] : null;
}

export async function onRequestGet({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  if (!(await staffUser(env, request))) return json({ configured: true, error: 'not-staff' }, 403);
  const p = await load(env, new URL(request.url).searchParams.get('id') || '');
  if (!p) return json({ configured: true, error: 'Project not found.' }, 404);
  return json({ configured: true, project: p });
}

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const staff = await staffUser(env, request);
  if (!staff) return json({ configured: true, error: 'not-staff' }, 403);
  const b = (await readJson(request)) || {};
  const p = await load(env, b.project_id);
  if (!p) return json({ configured: true, error: 'Project not found.' }, 404);

  const now = new Date().toISOString();
  const notes = { verified: {}, activity: [], ...(p.staff || {}) };
  const log = (text) => { notes.activity = [...(notes.activity || []), { at: now, who: staff.name, text }].slice(-200); };
  const fields = {};
  let email = null;

  if (b.action === 'verify') {
    const key = String(b.key || '').slice(0, 40);
    if (!key) return json({ configured: true, error: 'Nothing to verify.' }, 400);
    notes.verified = { ...notes.verified, [key]: { at: now, by: staff.name } };
    log(`Verified ${key}`);
  } else if (b.action === 'ask') {
    const text = String(b.text || '').trim().slice(0, 4000);
    if (!text) return json({ configured: true, error: 'Write your question first.' }, 400);
    const ins = await db(env, 'messages', { method: 'POST', prefer: 'return=minimal', body: { project_id: p.id, author: 'staff', author_id: staff.id, body: text } });
    if (!ins.ok) return json({ configured: true, error: 'We couldn’t send that. Try again.' }, 502);
    fields.state = 'waiting';
    log('Asked the customer a question');
    email = { kind: 'question', text };
  } else if (b.action === 'publish') {
    const cents = Math.round(Number(b.price) * 100);
    if (!(cents > 0)) return json({ configured: true, error: 'Enter the final price.' }, 400);
    const version = ((p.final_design && p.final_design.version) || 0) + 1;
    const note = String(b.note || '').trim().slice(0, 4000);
    fields.final_design = { version, date: now.slice(0, 10), price: cents / 100, note, by: staff.name };
    fields.state = 'awaiting-approval';
    log(`Published design version ${version} at ${money(cents)}`);
    email = { kind: 'design', text: note, price: money(cents) };
  } else if (b.action === 'advance') {
    if (!STAFF_STATES.includes(b.state)) return json({ configured: true, error: 'Choose a status.' }, 400);
    fields.state = b.state;
    log(`Moved to ${b.state}`);
  } else {
    return json({ configured: true, error: 'Unknown action.' }, 400);
  }

  const upd = await db(env, `projects?id=eq.${p.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { ...fields, staff: notes } });
  if (!upd.ok) return json({ configured: true, error: 'We couldn’t save that. Try again.' }, 502);

  let emailSent = null;
  const c = p.customers || {};
  if (email && c.email) {
    try {
      const auth = await magicLink(env, c.email, `${new URL(request.url).origin}/my-project`);
      emailSent = await sendEmail(env, { to: c.email, replyTo: env.EMAIL_REPLY_TO, ...staffUpdateEmail({ ...email, first: c.first, link: auth.link }) });
    } catch (e) {
      console.error('staff update email failed', e && e.message);
      emailSent = false;
    }
  }
  return json({ configured: true, saved: true, emailSent, project: await load(env, p.id) });
}
