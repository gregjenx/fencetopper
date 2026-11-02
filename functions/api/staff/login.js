// POST /api/staff/login { email }: email a sign-in link to /staff, only if the email is on staff_emails.
// Always answers the same way, so it can't be used to find out who is staff.
import { configured, json, readJson, magicLink, sendEmail } from '../../../server/lib.js';
import { staffSignInEmail } from '../../../server/emails.js';
import { isStaffEmail } from '../../../server/staff.js';

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return json({ configured: false }, 503);
  const body = (await readJson(request)) || {};
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ configured: true, error: 'Enter a valid email address.' }, 400);
  try {
    if (await isStaffEmail(env, email)) {
      const auth = await magicLink(env, email, `${new URL(request.url).origin}/staff`);
      await sendEmail(env, { to: email, ...staffSignInEmail({ link: auth.link }) });
    }
  } catch (e) {
    console.error('staff login link failed', e && e.message);
  }
  return json({ configured: true, sent: true });
}
