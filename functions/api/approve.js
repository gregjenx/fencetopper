// POST /api/approve { project_id, version }: the customer approves the design and price staff published.
// Records who approved which version, moves the project to "deposit-due" and tells the team. Online payment
// isn't connected yet, so the team collects the deposit and then moves the project to Scheduled.
import { configured, json, readJson, db } from '../../server/lib.js';
import { projectAccess, notify } from '../../server/project.js';

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const b = (await readJson(request)) || {};
  const { p, status } = await projectAccess(env, request, b.project_id);
  if (status === 401) return json({ configured: true, error: 'signed-out' }, 401);
  if (!p) return json({ configured: true, error: 'Project not found.' }, 404);
  const d = p.final_design;
  if (p.state !== 'awaiting-approval' || !d) return json({ configured: true, error: 'There’s no design waiting for your approval.', state: p.state }, 409);
  if (Number(b.version) !== d.version) return json({ configured: true, error: 'Your design was updated. Reload the page to see the latest version.' }, 409);
  const c = p.customers || {};
  const now = new Date().toISOString();
  const approval = { at: now, version: d.version, name: `${c.first || ''} ${c.last || ''}`.trim() || 'Customer' };
  const upd = await db(env, `projects?id=eq.${p.id}`, {
    method: 'PATCH', prefer: 'return=minimal',
    body: { final_design: { ...d, approval }, state: 'deposit-due', last_customer_activity_at: now },
  });
  if (!upd.ok) return json({ configured: true, error: 'We couldn’t record that. Try again.' }, 502);
  await notify(env, 'approved', p, `Approved design version ${d.version} at $${Number(d.price).toFixed(2)}.`);
  return json({ configured: true, approved: true, approval, state: 'deposit-due' });
}
