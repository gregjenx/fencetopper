// POST /api/submit { project_id, builder?, runs?, height?, color? }: the customer submits their project for review.
// Only now does the team step in. The Builder sends its final project with the submit, so nothing is lost
// between the last autosave and the tap.
import { configured, json, readJson, db, userFromRequest } from '../../server/lib.js';
import { ownProject, notify, cleanBuilder, builderRows, EDITABLE } from '../../server/project.js';

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const user = await userFromRequest(env, request);
  if (!user) return json({ configured: true, error: 'signed-out' }, 401);
  const b = (await readJson(request)) || {};
  const p = await ownProject(env, b.project_id, user.id);
  if (!p) return json({ configured: true, error: 'Project not found.' }, 404);
  if (!EDITABLE.includes(p.state)) return json({ configured: true, submitted: true, state: p.state });
  let fields = {};
  if (b.builder) {
    const c = cleanBuilder(b);
    if (c.error) return json({ configured: true, error: c.error }, 400);
    fields = c.fields;
  }
  const now = new Date().toISOString();
  const upd = await db(env, `projects?id=eq.${p.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { ...fields, state: 'submitted', submitted_at: now, last_customer_activity_at: now } });
  if (!upd.ok) return json({ configured: true, error: 'We couldn’t submit that. Try again.' }, 502);
  const sent = { ...p, ...fields };
  await notify(env, 'submitted', sent, b.note ? String(b.note).slice(0, 2000) : '', builderRows(sent.builder));
  return json({ configured: true, submitted: true, state: 'submitted' });
}
