# Saved projects: setup checklist

This switches on Phase 1 from design-framework/docs/08. When a customer saves a project in Shop, they get a "Your FenceTopper project is saved" email with an **Open my project** button. That button confirms their email and opens their project page at `/my-project`. You get a "New project saved" email.

Until every key below is in Cloudflare, the site keeps working the way it does now: saving sends you the project through Formspree and keeps it on the customer's device. You can set this up at your own pace.

Texts (Twilio), reminder emails and photo uploads come later.

## What's in the code

| File | What it does |
|---|---|
| `supabase/migrations/0001_phase1.sql` | Database tables (customers, projects, photos, messages, reminders_sent, staff) and access rules, so each customer sees only their own projects. Also creates a private bucket for photos. |
| `functions/api/projects.js` | Saves a project from Shop, creates the customer, emails the Open my project link and tells you. |
| `functions/api/me.js`, `messages.js`, `submit.js`, `login.js`, `refresh.js` | The project page: load projects, send a message, submit for review, email a new link, stay signed in. |
| `server/emails.js` | The confirmation email, the new-link email and the team notice. |
| `src/pages/my-project.astro`, `public/js/my-project.js` | The project page customers land on. |

Cloudflare Pages runs everything in `functions/` automatically. No extra build settings are needed.

## 1. Supabase (database and sign-in)

1. Sign up at supabase.com and create a project named `fencetopper`. Pick a US region. Save the database password somewhere safe.
2. Go to **SQL Editor**, choose **New query**, paste all of `supabase/migrations/0001_phase1.sql`, and choose **Run**. It should finish with "Success. No rows returned".
   Then do the same with `supabase/migrations/0002_builder.sql`, which adds the column the guided Builder saves to.
   Then `supabase/migrations/0003_project_keys.sql`, which lets a new customer go straight on to the Builder after saving.
3. Go to **Authentication**, then **URL Configuration**:
   - **Site URL:** `https://fencetopper.com`
   - **Redirect URLs:** add `https://fencetopper.com/my-project`, `https://www.fencetopper.com/my-project`, and `https://*.pages.dev/my-project` (for testing on the preview address).
4. Go to **Authentication**, then **Sign In / Providers**, then **Email**. Keep **Email** turned on, and set **Email OTP Expiration** to `86400` seconds. That's 24 hours, which is what the email promises.
5. Go to **Project Settings**, then **API Keys**, and copy three values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - the **anon** or **publishable** key
   - the **service_role** or **secret** key. This key can read everything, so only ever paste it into Cloudflare.

## 2. Resend (sending email)

1. Sign up at resend.com.
2. Go to **Domains**, then **Add Domain**, and enter `fencetopper.com`.
3. Resend lists a few DNS records, usually an MX and a TXT record on `send.fencetopper.com` and a DKIM TXT record at `resend._domainkey`. In Cloudflare, go to **DNS**, then **Records**, and add each one exactly as shown, with the proxy set to **DNS only** (grey cloud).
   - Don't change the existing MX records on `fencetopper.com` itself. Those deliver your support@ email.
4. Also add this TXT record, which tells inboxes how to treat email that fails checks:
   - Name: `_dmarc`
   - Content: `v=DMARC1; p=none; rua=mailto:support@fencetopper.com`
5. Back in Resend, choose **Verify**. It can take a few minutes.
6. Go to **API Keys**, then **Create API Key**, with **Sending access** for fencetopper.com. Copy it. It starts with `re_`.

Emails come from `FenceTopper <hello@fencetopper.com>`, and replies go to support@fencetopper.com. The hello@ address doesn't need its own inbox.

Optional: in Supabase, go to **Authentication**, then **Emails**, then **SMTP Settings**, and enter Resend's SMTP details (host `smtp.resend.com`, port `465`, user `resend`, and your API key as the password). Supabase's own emails then come from FenceTopper too. The site doesn't need this, because it sends the sign-in links itself.

## 3. Cloudflare Pages (the keys)

In your Pages project, go to **Settings**, then **Variables and Secrets**. Add each of these as type **Secret**, for **Production** and again for **Preview**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL from step 1.5 |
| `SUPABASE_ANON_KEY` | the anon or publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role or secret key |
| `RESEND_API_KEY` | the `re_` key from step 2.6 |
| `TEAM_NOTIFY_EMAIL` | where "New project saved" emails go, for example `support@fencetopper.com` |

Optional: `EMAIL_FROM` (default `FenceTopper <hello@fencetopper.com>`) and `EMAIL_REPLY_TO` (default `support@fencetopper.com`).

Keys only take effect on a new deploy. Go to **Deployments** and choose **Retry deployment** on the latest one, or push any change.

Never put these keys in the code or in GitHub.

## 4. Test it

On your `*.pages.dev` address:

1. In Shop, enter a run, choose **Build my Topper**, and save with an email that has never saved a project. The saved screen should say "You’re all set" with a **Continue my project** button that opens the Builder straight away. That browser holds a key to that one project only. Saving again with the same email says "Check your email" instead, and cancels the earlier key, because only the emailed link can open an existing account.
2. You should get two emails: "Your FenceTopper project is saved" and "New project saved: …".
3. Open the first one and choose **Open my project**. You should land on "Hi, {your name}." with your project.
4. Send a message, then submit for review. You should get a team email for each.
5. In Supabase, go to **Table Editor**, then **projects**. Your project should be there with state `submitted`.

If the saved screen instead says "Your project is saved on this device", a key is missing or wrong, and the site fell back to Formspree. In Cloudflare, go to **Deployments**, open the latest one, then **Functions**, then **Real-time logs**, save again, and look for "save project failed".

## What changes for customers

- **Shop:** the save sheet promises photos, the Visualizer and fine-tuning, and the saved screen says a link is on its way.
- **Coming back on the same device:** Shop shows "Welcome back" with an **Open my project** link.
- **Project page:** customers see their runs, height, color, extender and estimate. They can edit runs in Shop (which updates the same project), see it in the Visualizer, message you, and submit for review. Photo uploads say "coming soon" for now, so customers are asked to reply to the email with photos.
- **Lost the link:** **Email me a link** on `/my-project` sends a new one. It only sends to emails that have a project, and it gives the same answer either way.
- **Formspree:** still used by the Contact page, and as the fallback if Supabase or Resend is down.

## Replying to customers

For now, reply from your inbox. Every team email has the customer's address as its reply-to.

Staff replies inside the project page (the messages table, with `author = 'staff'`) come with staff sign-in in Phase 2. Until then, you can add a reply by hand in Supabase's Table Editor if you want it to show on their page.
