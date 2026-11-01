// Email templates from design-framework/docs/08 (Messaging). Each returns { subject, html, text }.
// Plain, single-column HTML with inline styles so it renders the same in Gmail, Outlook and Apple Mail.
import { brand } from './lib.js';

const GREEN = '#12482b', RUST = '#b23c1e', INK = '#16202f', MUTED = '#5b6472';

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function layout({ preview, body, footer }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f2ec;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;">
<tr><td style="background:${GREEN};border-radius:12px 12px 0 0;padding:16px 24px;font:700 20px/1.2 Helvetica,Arial,sans-serif;color:#ffffff;">${esc(brand.name)}</td></tr>
<tr><td style="padding:24px;font:16px/1.55 Helvetica,Arial,sans-serif;color:${INK};">${body}</td></tr>
</table>
${footer ? `<p style="max-width:560px;margin:14px auto 0;font:13px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};">${footer}</p>` : ''}
</td></tr></table></body></html>`;
}

function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td style="background:${RUST};border-radius:8px;">
<a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font:700 16px Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

// To the customer, right after they save. {link} signs them in and confirms their email.
export function confirmationEmail({ first, summary, estimate, link }) {
  const subject = `Your ${brand.name} project is saved`;
  const preview = `${summary}. Estimate ${estimate}. Pick up where you left off.`;
  const steps = ['Add your posts and measurements for each run', 'Add photos of each run', 'See it on your fence in the Visualizer', 'Submit for review when you’re ready'];
  const html = layout({
    preview,
    body: `<p style="margin:0 0 14px;">Hi ${esc(first)},</p>
<p style="margin:0 0 6px;">Your project is saved. Here’s what you have so far:</p>
<p style="margin:0;font-weight:700;">${esc(summary)} · Estimate ${esc(estimate)}</p>
${button(link, 'Open my project')}
<p style="margin:0 0 6px;">Use it to pick up where you left off, on any device. At your own pace, you can:</p>
<ul style="margin:0 0 14px;padding-left:20px;">${steps.map((s) => `<li style="margin:0 0 4px;">${s}</li>`).join('')}</ul>
<p style="margin:0 0 14px;">Nothing is built or charged until you approve your final design.</p>
<p style="margin:0 0 14px;">Questions? Just reply. A real person reads every email.</p>
<p style="margin:0;">The ${esc(brand.name)} team</p>`,
    footer: `You’re getting this because you saved a project at ${esc(brand.domain)}. The button works for 24 hours. After that, use “Email me a link” at <a href="${esc(brand.url)}/my-project" style="color:${MUTED};">${esc(brand.domain)}/my-project</a>.`,
  });
  const text = `Hi ${first},

Your project is saved. Here's what you have so far:
${summary} · Estimate ${estimate}

Open my project: ${link}

Use it to pick up where you left off, on any device. At your own pace, you can:
${steps.map((s) => `- ${s.replace('’', "'")}`).join('\n')}

Nothing is built or charged until you approve your final design.

Questions? Just reply. A real person reads every email.

The ${brand.name} team

You're getting this because you saved a project at ${brand.domain}. The link works for 24 hours. After that, use "Email me a link" at ${brand.url}/my-project.`;
  return { subject, html, text };
}

// To the customer when they ask for a new sign-in link from /my-project.
export function signInEmail({ first, link }) {
  const subject = `Open your ${brand.name} project`;
  const html = layout({
    preview: 'Here’s your link to pick up where you left off.',
    body: `<p style="margin:0 0 14px;">Hi ${esc(first || 'there')},</p>
<p style="margin:0;">Here’s your link to pick up where you left off.</p>
${button(link, 'Open my project')}
<p style="margin:0;">If you didn’t ask for this, you can ignore this email.</p>`,
    footer: 'The button works for 24 hours and can be used once.',
  });
  const text = `Hi ${first || 'there'},\n\nHere's your link to pick up where you left off:\n${link}\n\nIf you didn't ask for this, you can ignore this email. The link works for 24 hours and can be used once.`;
  return { subject, html, text };
}

// To the team. A saved project isn't a hand-off: staff offer help, the customer drives.
export function teamNotice({ kind = 'saved', first, last, email, mobile, summary, estimate, runs, notes, extender, marketing, staffLink, message, details }) {
  const heading = { saved: 'New project saved', updated: 'Project updated', submitted: 'Project submitted for review', message: 'New message' }[kind] || 'Project activity';
  const subject = `${heading}: ${first} ${last}, ${summary}`;
  const rows = [
    ['Customer', `${first} ${last}`],
    ['Email', email],
    ['Mobile', mobile || '—'],
    ['Project', `${summary} · estimate ${estimate}`],
    ['Runs', (runs || []).join(', ')],
    ['Extender', extender || '—'],
    ['Notes', notes || '—'],
    ['Tips and offers', marketing ? 'Yes' : 'No'],
    ...(details || []), // Builder submissions add the shipping address and open items
  ];
  const note = kind === 'submitted'
    ? 'The customer has asked for review. Check the measurements and reply in the project.'
    : 'The customer is still working on this. Offer help if it’s useful (“Happy to look at your photos when you’ve added them”), but the next step is theirs.';
  const html = layout({
    preview: `${first} ${last}: ${summary}`,
    body: `<p style="margin:0 0 12px;font-weight:700;">${esc(heading)}</p>
${message ? `<p style="margin:0 0 14px;padding:12px 14px;background:#f4f2ec;border-radius:8px;">${esc(message).replace(/\n/g, '<br>')}</p>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font:15px/1.45 Helvetica,Arial,sans-serif;">
${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:${MUTED};vertical-align:top;white-space:nowrap;">${esc(k)}</td><td style="padding:4px 0;">${esc(v)}</td></tr>`).join('')}
</table>
<p style="margin:16px 0 0;color:${MUTED};font-size:14px;">${esc(note)}</p>
${staffLink ? `<p style="margin:12px 0 0;"><a href="${esc(staffLink)}" style="color:${GREEN};font-weight:700;">Open in Supabase</a></p>` : ''}`,
  });
  const text = `${heading}\n\n${message ? message + '\n\n' : ''}${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${note}${staffLink ? `\n\nOpen in Supabase: ${staffLink}` : ''}`;
  return { subject, html, text };
}
