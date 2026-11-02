// GET /api/staff/projects: every project for the staff queue, newest activity last. Staff only.
import { configured, json, db } from '../../../server/lib.js';
import { staffUser } from '../../../server/staff.js';

const FIELDS = 'id,name,state,runs,height,color,estimate_cents,created_at,updated_at,submitted_at,last_customer_activity_at,customers(first,last,email)';

export async function onRequestGet({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const staff = await staffUser(env, request);
  if (!staff) return json({ configured: true, error: 'not-staff' }, 403);
  const r = await db(env, `projects?select=${FIELDS}&order=updated_at.desc&limit=500`);
  if (!r.ok) return json({ configured: true, error: 'unavailable' }, 502);
  return json({ configured: true, staff: { name: staff.name, email: staff.email }, projects: r.data || [] });
}
