// POST /api/submit { project_id }: the customer submits their project for review. Only now does the team step in.
import { configured, json, readJson, db, userFromRequest } from '../../server/lib.js';
import { ownProject, notify } from '../../server/project.js';

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const user = await userFromRequest(env, request);
  if (!user) return json({ configured: true, error: 'signed-out' }, 401);
  const b = (await readJson(request)) || {};
  const p = await ownProject(env, b.project_id, user.id);
  if (!p) return json({ configured: true, error: 'Project not found.' }, 404);
  if (!['estimate', 'in-progress', 'needs-fix'].includes(p.state)) return json({ configured: true, submitted: true, state: p.state });
  const now = new Date().toISOString();
  const upd = await db(env, `projects?id=eq.${p.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { state: 'submitted', submitted_at: now, last_customer_activity_at: now } });
  if (!upd.ok) return json({ configured: true, error: 'We couldn’t submit that. Try again.' }, 502);
  await notify(env, 'submitted', p, b.note ? String(b.note).slice(0, 2000) : '');
  return json({ configured: true, submitted: true, state: 'submitted' });
}
