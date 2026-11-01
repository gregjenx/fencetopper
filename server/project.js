// Helpers shared by the signed-in project endpoints (project, messages, submit).
import { db, sendEmail, dashboardLink, summary, money, fmtLen, estimate, COLOR_NAMES, userFromRequest, hashKey } from './lib.js';
import { teamNotice } from './emails.js';
import { heights } from '../src/data/site.ts';

// States where the customer can still change their project. After they submit, it's locked until we reply.
export const EDITABLE = ['estimate', 'in-progress', 'needs-fix'];

// The project with its customer, only if this user owns it.
export async function ownProject(env, id, userId) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await db(env, `projects?id=eq.${id}&customer_id=eq.${userId}&select=*,customers(first,last,email,mobile,marketing_opt_in)`);
  return r.ok && r.data && r.data[0] ? r.data[0] : null;
}

// Who may use this project: the signed-in owner, or a browser holding the project key Shop handed out to a
// brand-new customer. Returns { p, userId } or { status } (401 signed out, 404 not theirs).
// A key opens only its own project, and stops working once the email is confirmed (the owner then has their
// own sign-in) or after it expires, so someone who typed another person's email never sees that person's data.
export async function projectAccess(env, request, id) {
  const user = await userFromRequest(env, request);
  if (user) {
    const p = await ownProject(env, id, user.id);
    return p ? { p, userId: user.id } : { status: 404 };
  }
  const key = request.headers.get('X-Project-Key');
  if (!key || typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return { status: 401 };
  const r = await db(env, `projects?id=eq.${id}&guest_key_hash=eq.${await hashKey(key)}&select=*,customers(first,last,email,mobile,marketing_opt_in,email_confirmed_at)`);
  const p = r.ok && r.data && r.data[0];
  if (!p || !p.guest_key_expires_at || Date.parse(p.guest_key_expires_at) < Date.now() || (p.customers && p.customers.email_confirmed_at)) return { status: 401 };
  return { p, userId: p.customer_id };
}

// The Builder sends its whole project plus the runs, height and color it adds up to.
// Returns { fields } to write to the projects row, or { error } with a message the customer can act on.
// Photos are small thumbnails inside the project, so 1 MB leaves room for several per run.
const MAX_BUILDER_BYTES = 1000000;
export function cleanBuilder(b) {
  if (!b || typeof b.builder !== 'object' || !b.builder || Array.isArray(b.builder)) return { error: 'Something went wrong. Reload the page and try again.' };
  const doc = { ...b.builder };
  delete doc.state; delete doc.messages; // the server owns the state and the message thread
  const size = new TextEncoder().encode(JSON.stringify(doc)).length;
  if (size > MAX_BUILDER_BYTES) return { error: 'Your project is too large to save. Remove a few photos and try again.' };
  const runs = (Array.isArray(b.runs) ? b.runs : []).map((q) => Math.round(Number(q))).filter((q) => q > 0 && q <= 48 * 1000).slice(0, 50);
  if (!runs.length) return { error: 'Your project needs at least one run.' };
  const height = Math.round(Number(b.height));
  if (!(height >= heights.min && height <= heights.max)) return { error: `Choose a height from ${heights.min} to ${heights.max} in.` };
  const color = String(b.color || '');
  if (!COLOR_NAMES[color]) return { error: 'Choose a color.' };
  const name = String(doc.name || '').trim().slice(0, 120) || 'My project';
  return { fields: { builder: doc, runs, height, color, name, estimate_cents: estimate(runs, height).cents } };
}

// Shipping address and open items from a submitted Builder project, as rows for the team email.
export function builderRows(doc) {
  if (!doc) return [];
  const s = doc.shipping || {};
  const ship = [s.name, s.street, [s.city, s.state].filter(Boolean).join(', ') + (s.zip ? ' ' + s.zip : '')].filter((x) => x && x.trim()).join(', ');
  const open = (doc.openAtSubmit || []).map((x) => (x.level === 'needed' ? 'Needed: ' : 'Review: ') + x.label);
  return [['Ship to', ship || '—'], ['Open items', open.length ? open.join('; ') : 'None']];
}

export function notify(env, kind, p, message, details) {
  const c = p.customers || {};
  return sendEmail(env, {
    to: env.TEAM_NOTIFY_EMAIL, replyTo: c.email,
    ...teamNotice({
      kind, message, first: c.first, last: c.last, email: c.email, mobile: c.mobile, marketing: c.marketing_opt_in,
      summary: summary(p), estimate: money(p.estimate_cents), runs: (p.runs || []).map(fmtLen), notes: p.notes,
      extender: p.extender && p.extender.name, staffLink: dashboardLink(env, 'projects'), details,
    }),
  });
}
