-- FenceTopper: staff sign-in and the live staff queue.
-- Run once in the Supabase SQL editor after 0003_project_keys.sql. Safe to run again.
--
-- staff_emails: who may open /staff. Staff sign in with an emailed link, like customers, and the server
-- checks their email against this list on every request. Add a row for each person on your team.
-- projects.staff: staff-only notes (what's been verified, and a log of staff actions). Customers never see it.
-- projects.final_design: the design and price staff publish for the customer to approve.

create table if not exists public.staff_emails (
  email text primary key check (email = lower(email)),
  name text,
  created_at timestamptz not null default now()
);
alter table public.staff_emails enable row level security; -- no policies: only the server reads it

alter table public.projects add column if not exists staff jsonb not null default '{}'::jsonb;
alter table public.projects add column if not exists final_design jsonb;

-- Staff on the list count as staff for the row-level rules too.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
      or exists (select 1 from public.staff_emails where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Add yourself (change the email if you sign in with a different one):
-- insert into public.staff_emails (email, name) values ('greg@giverise.ai', 'Greg') on conflict do nothing;
