// Helpers shared by the signed-in project endpoints (messages, submit).
import { db, sendEmail, dashboardLink, summary, money, fmtLen } from './lib.js';
import { teamNotice } from './emails.js';

// The project with its customer, only if this user owns it.
export async function ownProject(env, id, userId) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await db(env, `projects?id=eq.${id}&customer_id=eq.${userId}&select=*,customers(first,last,email,mobile,marketing_opt_in)`);
  return r.ok && r.data && r.data[0] ? r.data[0] : null;
}

export function notify(env, kind, p, message) {
  const c = p.customers || {};
  return sendEmail(env, {
    to: env.TEAM_NOTIFY_EMAIL, replyTo: c.email,
    ...teamNotice({
      kind, message, first: c.first, last: c.last, email: c.email, mobile: c.mobile, marketing: c.marketing_opt_in,
      summary: summary(p), estimate: money(p.estimate_cents), runs: (p.runs || []).map(fmtLen), notes: p.notes,
      extender: p.extender && p.extender.name, staffLink: dashboardLink(env, 'projects'),
    }),
  });
}
