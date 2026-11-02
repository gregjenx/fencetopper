// Staff sign-in: a signed-in user whose email is on public.staff_emails (supabase/migrations/0004_staff.sql).
import { db, userFromRequest } from './lib.js';

export async function staffUser(env, request) {
  const user = await userFromRequest(env, request);
  if (!user || !user.email) return null;
  const r = await db(env, `staff_emails?email=eq.${encodeURIComponent(user.email.toLowerCase())}&select=email,name`);
  return r.ok && r.data && r.data[0] ? { id: user.id, email: user.email, name: r.data[0].name || user.email } : null;
}

export async function isStaffEmail(env, email) {
  const r = await db(env, `staff_emails?email=eq.${encodeURIComponent(email)}&select=email`);
  return !!(r.ok && r.data && r.data.length);
}

// Statuses staff can move a project to, in the order the work goes (the customer-facing names live in projects.js).
export const STAFF_STATES = ['in-progress', 'needs-fix', 'submitted', 'waiting', 'reply-received', 'designing', 'awaiting-approval',
  'deposit-due', 'scheduled', 'in-production', 'quality', 'balance-due', 'ready-to-ship', 'shipped', 'delivered', 'closed'];
