// POST /api/refresh { refresh_token }: swap an expired sign-in for a fresh one, so /my-project stays signed in.
import { configured, json, readJson, refreshSession } from '../../server/lib.js';

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const b = (await readJson(request)) || {};
  if (!b.refresh_token) return json({ configured: true, error: 'signed-out' }, 401);
  const r = await refreshSession(env, String(b.refresh_token));
  if (!r.ok || !r.data || !r.data.access_token) return json({ configured: true, error: 'signed-out' }, 401);
  return json({ configured: true, access_token: r.data.access_token, refresh_token: r.data.refresh_token, expires_in: r.data.expires_in });
}
