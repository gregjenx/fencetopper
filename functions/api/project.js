// GET /api/project?id=: one of the signed-in customer's projects for the Builder (their newest without an id),
// or the one project a new customer's project key opens (see projectAccess in server/project.js).
// POST /api/project { project_id, builder, runs, height, color }: the Builder's autosave. Only while the project
// is still editable; after they submit, it's locked until we reply.
import { configured, json, readJson, db, userFromRequest } from '../../server/lib.js';
import { projectAccess, cleanBuilder, EDITABLE } from '../../server/project.js';

const FIELDS = 'id,name,state,runs,height,color,extender,notes,estimate_cents,builder,created_at,updated_at,submitted_at,customers(first,last,email),messages(author,body,created_at)';

export async function onRequestGet({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return json({ configured: true, error: 'Project not found.' }, 404);
  // Signed in: their newest project, or the one asked for. With a project key: only that project.
  const user = await userFromRequest(env, request);
  let owner = user && user.id;
  if (!user) {
    const a = await projectAccess(env, request, id);
    if (!a.p) return json({ configured: true, error: 'signed-out' }, 401);
    owner = a.userId;
  }
  const r = await db(env, `projects?customer_id=eq.${owner}${id ? `&id=eq.${id}` : ''}&select=${FIELDS}&order=created_at.desc&limit=1&messages.order=created_at.asc`);
  if (!r.ok) return json({ configured: true, error: 'unavailable' }, 502);
  const row = r.data && r.data[0];
  if (!row) return json({ configured: true, error: 'Project not found.' }, 404);
  const { customers, ...project } = row;
  // A project key only sees what was typed into this project, never the account's details.
  return json({ configured: true, project: { ...project, customer: user ? customers || { email: user.email } : null } });
}

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const b = (await readJson(request)) || {};
  const { p, status } = await projectAccess(env, request, b.project_id);
  if (status === 401) return json({ configured: true, error: 'signed-out' }, 401);
  if (!p) return json({ configured: true, error: 'Project not found.' }, 404);
  if (!EDITABLE.includes(p.state)) return json({ configured: true, error: 'Your project was submitted, so editing is locked. Message us to change something.', state: p.state }, 409);
  const { fields, error } = cleanBuilder(b);
  if (error) return json({ configured: true, error }, 400);
  const upd = await db(env, `projects?id=eq.${p.id}`, {
    method: 'PATCH', prefer: 'return=minimal', body: { ...fields, last_customer_activity_at: new Date().toISOString() },
  });
  if (!upd.ok) {
    console.error('builder save failed', upd.status);
    return json({ configured: true, error: 'We couldn’t save that. Check your connection and try again.' }, 502);
  }
  return json({ configured: true, saved: true });
}
