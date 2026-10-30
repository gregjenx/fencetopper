// GET /api/me: the signed-in customer, their projects (newest first) and each project's messages.
import { configured, json, db, userFromRequest, summary, money, fmtLen } from '../../server/lib.js';

export async function onRequestGet({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const user = await userFromRequest(env, request);
  if (!user) return json({ configured: true, error: 'signed-out' }, 401);
  const [c, pr] = await Promise.all([
    db(env, `customers?id=eq.${user.id}&select=first,last,email,mobile,email_confirmed_at`),
    db(env, `projects?customer_id=eq.${user.id}&select=id,name,state,runs,height,color,extender,notes,estimate_cents,created_at,updated_at,submitted_at,messages(author,body,created_at)&order=created_at.desc&messages.order=created_at.asc`),
  ]);
  if (!c.ok || !pr.ok) return json({ configured: true, error: 'unavailable' }, 502);
  const projects = (pr.data || []).map((p) => ({
    ...p, summary: summary(p), estimate: money(p.estimate_cents), runLabels: (p.runs || []).map(fmtLen),
  }));
  return json({ configured: true, customer: (c.data && c.data[0]) || { email: user.email }, projects });
}
