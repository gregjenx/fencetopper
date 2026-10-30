// POST /api/login { email }: email a fresh "Open my project" link to a customer who already has a project.
// Always answers the same way, so it can't be used to find out who has an account.
import { configured, json, readJson, db, magicLink, sendEmail } from '../../server/lib.js';
import { signInEmail } from '../../server/emails.js';

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const body = (await readJson(request)) || {};
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ configured: true, error: 'Enter a valid email address.' }, 400);
  try {
    const c = await db(env, `customers?email=eq.${encodeURIComponent(email)}&select=first&limit=1`);
    if (c.ok && c.data && c.data.length) {
      const auth = await magicLink(env, email, `${new URL(request.url).origin}/my-project`);
      await sendEmail(env, { to: email, ...signInEmail({ first: c.data[0].first, link: auth.link }) });
    }
  } catch (e) {
    console.error('login link failed', e && e.message);
  }
  return json({ configured: true, sent: true });
}
