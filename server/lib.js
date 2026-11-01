// Shared server code for the Cloudflare Pages Functions in functions/api/.
// Runs on the Workers runtime: only fetch, Request and Response, no Node APIs and no npm packages.
// Supabase is called through its REST endpoints (PostgREST and the Auth admin API) and Resend through its
// email API. Keys come from the Pages project's Variables and Secrets; see docs/backend-setup.md.
import { brand, colors, heights, pricing } from '../src/data/site.ts';

export const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'TEAM_NOTIFY_EMAIL'];

export function configured(env) {
  return REQUIRED_ENV.every((k) => env && typeof env[k] === 'string' && env[k].trim());
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

// ---------- Supabase ----------
// Legacy keys are JWTs and go in both headers. The newer sb_publishable_/sb_secret_ keys go in apikey only.
function keyHeaders(key, userToken) {
  const h = { apikey: key };
  if (userToken) h.Authorization = `Bearer ${userToken}`;
  else if (!key.startsWith('sb_')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function call(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// PostgREST with the service role key (bypasses RLS: every caller checks ownership first).
export function db(env, path, { method = 'GET', body, prefer } = {}) {
  const headers = { ...keyHeaders(env.SUPABASE_SERVICE_ROLE_KEY), 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  return call(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

function authAdmin(env, path, body) {
  return call(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/${path}`, {
    method: 'POST',
    headers: { ...keyHeaders(env.SUPABASE_SERVICE_ROLE_KEY), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Creates the Auth user if needed (unconfirmed), then makes a one-time sign-in link that lands on
// /my-project. Opening the link confirms the email and signs the customer in.
// isNew is true when this email had no account before, which is when Shop may hand out a project key.
export async function magicLink(env, email, redirectTo, meta) {
  const created = await authAdmin(env, 'users', { email, email_confirm: false, user_metadata: meta || {} });
  if (!created.ok && created.status !== 422 && created.status !== 400) throw new Error(`auth create ${created.status}`);
  const gen = await authAdmin(env, 'generate_link', { type: 'magiclink', email, redirect_to: redirectTo, options: { redirect_to: redirectTo } });
  if (!gen.ok) throw new Error(`auth link ${gen.status}`);
  const d = gen.data || {};
  const link = d.action_link || (d.properties && d.properties.action_link);
  const user = d.user || d;
  if (!link || !user.id) throw new Error('auth link missing');
  return { link, userId: user.id, emailConfirmedAt: user.email_confirmed_at || null, isNew: created.ok };
}

// Project keys let a brand-new customer keep working in the Builder before they open the emailed link.
// A key opens one project only, never the account, and only the SHA-256 of it is stored.
export function newProjectKey() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function hashKey(key) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(key)));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Checks a customer's access token and returns their Auth user, or null.
export async function userFromRequest(env, request) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '');
  if (!m) return null;
  const r = await call(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, { headers: keyHeaders(env.SUPABASE_ANON_KEY, m[1]) });
  return r.ok && r.data && r.data.id ? r.data : null;
}

export function refreshSession(env, refreshToken) {
  return call(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { ...keyHeaders(env.SUPABASE_ANON_KEY), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function dashboardLink(env, table) {
  const ref = (/^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(env.SUPABASE_URL || '') || [])[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/editor?table=${table}` : '';
}

// ---------- Resend ----------
export async function sendEmail(env, { to, subject, html, text, replyTo }) {
  const r = await call('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM || `${brand.name} <hello@${brand.domain}>`,
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo || env.EMAIL_REPLY_TO || brand.email,
      subject, html, text,
    }),
  });
  return r.ok;
}

// ---------- Project input ----------
const COLOR_IDS = colors.map((c) => c.id);
export const COLOR_NAMES = Object.fromEntries(colors.map((c) => [c.id, c.name]));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

// Validates what Shop sends. Returns { value } or { error } with a message the customer can act on.
export function cleanProject(b) {
  if (!b || typeof b !== 'object') return { error: 'Something went wrong. Try again.' };
  const first = clip(b.first, 80), last = clip(b.last, 80), email = clip(b.email, 200).toLowerCase();
  if (!first || !last) return { error: 'Enter your first and last name.' };
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
  const runs = (Array.isArray(b.runs) ? b.runs : []).map((q) => Math.round(Number(q))).filter((q) => q > 0 && q <= 48 * 1000).slice(0, 50);
  if (!runs.length) return { error: 'Enter at least one fence run.' };
  const height = Math.round(Number(b.height));
  if (!(height >= heights.min && height <= heights.max)) return { error: `Choose a height from ${heights.min} to ${heights.max} in.` };
  const color = String(b.color || '');
  if (!COLOR_IDS.includes(color)) return { error: 'Choose a color.' };
  let extender = null;
  if (b.extender && typeof b.extender === 'object') extender = { id: clip(b.extender.id, 40), name: clip(b.extender.name, 120) };
  return {
    value: {
      first, last, email,
      mobile: clip(b.mobile, 40) || null,
      notes: clip(b.notes, 2000) || null,
      marketing: b.marketing === true,
      runs, height, color, extender,
      projectId: typeof b.project_id === 'string' && /^[0-9a-f-]{36}$/i.test(b.project_id) ? b.project_id : null,
    },
  };
}

// Same math as FT.quote in public/js/site.js, in cents, using the rates in src/data/site.ts.
export function estimate(runs, height) {
  let totalQin = 0, posts = 0, panels = 0;
  runs.forEach((q) => { totalQin += q; panels++; posts += Math.max(0, Math.ceil(q / (48 * pricing.maxPostSpacingFt)) - 1); });
  const areaC = Math.round((totalQin * height * pricing.perSqFt * 100) / 576);
  return { cents: areaC + posts * pricing.perMiddlePost * 100 + panels * pricing.perPanel * 100, totalQin, posts, panels };
}

export function ratesUsed() {
  const { perSqFt, perMiddlePost, perPanel, maxPostSpacingFt } = pricing;
  return { perSqFt, perMiddlePost, perPanel, maxPostSpacingFt, savedAt: new Date().toISOString() };
}

export function money(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

// Quarter-inches to "48 ft 6 1/2 in", like Shop's fmtQin.
export function fmtLen(q) {
  const ft = Math.floor(q / 48), inch = Math.floor((q % 48) / 4), frac = ['', '1/4', '1/2', '3/4'][q % 4];
  const inPart = inch || frac ? `${inch || ''}${frac ? (inch ? ' ' : '') + frac : ''} in` : '';
  if (!ft) return inPart || '0 in';
  return `${ft} ft${inPart ? ' ' + inPart : ''}`;
}

// "48 ft across 1 run · 18 in · Carbon", matching Shop's summary line.
export function summary(p) {
  const total = p.runs.reduce((a, q) => a + q, 0);
  return `${fmtLen(total)} across ${p.runs.length} run${p.runs.length === 1 ? '' : 's'} · ${p.height} in · ${COLOR_NAMES[p.color] || p.color}`;
}

export { brand };
