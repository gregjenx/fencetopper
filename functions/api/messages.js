// POST /api/messages { project_id, body }: the signed-in customer sends a message on their project.
import { configured, json, readJson, db, userFromRequest } from '../../server/lib.js';
import { ownProject, notify } from '../../server/project.js';

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const user = await userFromRequest(env, request);
  if (!user) return json({ configured: true, error: 'signed-out' }, 401);
  const b = (await readJson(request)) || {};
  const text = String(b.body || '').trim().slice(0, 4000);
  if (!text) return json({ configured: true, error: 'Write a message first.' }, 400);
  const p = await ownProject(env, b.project_id, user.id);
  if (!p) return json({ configured: true, error: 'Project not found.' }, 404);
  const ins = await db(env, 'messages', { method: 'POST', prefer: 'return=minimal', body: { project_id: p.id, author: 'customer', author_id: user.id, body: text } });
  if (!ins.ok) return json({ configured: true, error: 'We couldn’t send that. Try again.' }, 502);
  await db(env, `projects?id=eq.${p.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { last_customer_activity_at: new Date().toISOString() } });
  await notify(env, 'message', p, text);
  return json({ configured: true, sent: true });
}
