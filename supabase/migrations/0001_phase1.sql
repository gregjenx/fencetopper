-- FenceTopper Phase 1: customers, saved projects, photos, messages and reminder log.
-- Run once in the Supabase SQL editor (or with `supabase db push`). Safe to read top to bottom:
-- tables, then the email-confirmed sync from auth.users, then row-level security, then photo storage.
--
-- The site's server code (functions/api/*) uses the service role key, which bypasses RLS and checks
-- ownership itself. The policies below protect the data if anything ever talks to Supabase with a
-- customer's own token (the anon key plus their sign-in), such as the Phase 2 Builder.

create extension if not exists pgcrypto;

-- ---------- Staff (Phase 2 staff sign-in; add rows by hand until then) ----------
create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- ---------- Customers: one row per Supabase Auth user ----------
create table if not exists public.customers (
  id uuid primary key references auth.users (id) on delete cascade,
  first text not null default '',
  last text not null default '',
  email text not null,
  mobile text,                         -- optional; saved so staff can call. No texts in Phase 1.
  email_confirmed_at timestamptz,      -- copied from auth.users when the customer opens their link
  sms_opt_in boolean not null default false,
  sms_opt_in_at timestamptz,
  sms_opt_in_wording text,             -- the exact checkbox wording they agreed to (Phase 2 texting)
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_email_idx on public.customers (lower(email));

-- ---------- Projects ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null default 'My project',
  -- Customer-facing states from docs/05. A saved project starts in progress; the customer submits it.
  state text not null default 'in-progress' check (state in (
    'estimate', 'in-progress', 'needs-fix', 'submitted', 'waiting', 'reply-received', 'designing',
    'awaiting-approval', 'deposit-due', 'scheduled', 'in-production', 'quality', 'balance-due',
    'ready-to-ship', 'shipped', 'delivered', 'closed')),
  runs jsonb not null default '[]'::jsonb,           -- run lengths in quarter-inches, e.g. [2304, 1152]
  height int not null check (height between 12 and 24),
  color text not null check (color in ('carbon', 'black', 'evergreen', 'brown')),
  extender jsonb,                                    -- the extender option chosen in Shop, if any
  notes text,
  estimate_cents int not null default 0,
  rates_used jsonb not null,                         -- perSqFt, perMiddlePost, perPanel, maxPostSpacingFt at save time
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_customer_activity_at timestamptz not null default now()
);
create index if not exists projects_customer_idx on public.projects (customer_id, created_at desc);

-- ---------- Photos (Phase 2 uploads; the table is ready now) ----------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  run int,                                           -- run index, or null for the whole project
  type text not null default 'run',                  -- run, post, extender, other
  storage_path text not null,                        -- path in the private project-photos bucket
  created_at timestamptz not null default now()
);
create index if not exists photos_project_idx on public.photos (project_id);

-- ---------- Messages between the customer and staff ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author text not null check (author in ('customer', 'staff')),
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists messages_project_idx on public.messages (project_id, created_at);

-- ---------- Reminder log, so no reminder goes out twice (Phase 2 Worker) ----------
create table if not exists public.reminders_sent (
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null,                                -- day1-photos, day3-open, day7-submit, day30-keep
  sent_at timestamptz not null default now(),
  primary key (project_id, kind)
);

-- ---------- updated_at ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

-- ---------- Copy email confirmation from auth.users ----------
create or replace function public.sync_email_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is distinct from old.email_confirmed_at then
    update public.customers set email_confirmed_at = new.email_confirmed_at where id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_email_confirmed on auth.users;
create trigger on_auth_email_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.sync_email_confirmed();

-- ---------- Row-level security ----------
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.photos enable row level security;
alter table public.messages enable row level security;
alter table public.reminders_sent enable row level security;   -- no policies: server only

create or replace function public.owns_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = pid and customer_id = auth.uid());
$$;

-- staff
drop policy if exists "staff see staff" on public.staff;
create policy "staff see staff" on public.staff for select using (public.is_staff());

-- customers: their own row; staff read all
drop policy if exists "customer reads self" on public.customers;
create policy "customer reads self" on public.customers for select using (id = auth.uid() or public.is_staff());
drop policy if exists "customer updates self" on public.customers;
create policy "customer updates self" on public.customers for update using (id = auth.uid()) with check (id = auth.uid());

-- projects: customers read, create and edit their own; staff read and update all. Nobody deletes from the client.
drop policy if exists "customer reads projects" on public.projects;
create policy "customer reads projects" on public.projects for select using (customer_id = auth.uid() or public.is_staff());
drop policy if exists "customer creates projects" on public.projects;
create policy "customer creates projects" on public.projects for insert with check (customer_id = auth.uid());
drop policy if exists "customer edits projects" on public.projects;
create policy "customer edits projects" on public.projects for update using (customer_id = auth.uid() or public.is_staff())
  with check (customer_id = auth.uid() or public.is_staff());

-- photos
drop policy if exists "photos read" on public.photos;
create policy "photos read" on public.photos for select using (public.owns_project(project_id) or public.is_staff());
drop policy if exists "photos add" on public.photos;
create policy "photos add" on public.photos for insert with check (public.owns_project(project_id) or public.is_staff());
drop policy if exists "photos remove" on public.photos;
create policy "photos remove" on public.photos for delete using (public.owns_project(project_id) or public.is_staff());

-- messages: a customer can only post as the customer
drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages for select using (public.owns_project(project_id) or public.is_staff());
drop policy if exists "messages customer post" on public.messages;
create policy "messages customer post" on public.messages for insert
  with check ((author = 'customer' and author_id = auth.uid() and public.owns_project(project_id))
           or (author = 'staff' and public.is_staff()));

-- ---------- Photo storage: private bucket, files under <project_id>/... ----------
insert into storage.buckets (id, name, public) values ('project-photos', 'project-photos', false)
  on conflict (id) do nothing;

drop policy if exists "project photos read" on storage.objects;
create policy "project photos read" on storage.objects for select
  using (bucket_id = 'project-photos' and (public.owns_project(((storage.foldername(name))[1])::uuid) or public.is_staff()));
drop policy if exists "project photos upload" on storage.objects;
create policy "project photos upload" on storage.objects for insert
  with check (bucket_id = 'project-photos' and (public.owns_project(((storage.foldername(name))[1])::uuid) or public.is_staff()));
drop policy if exists "project photos delete" on storage.objects;
create policy "project photos delete" on storage.objects for delete
  using (bucket_id = 'project-photos' and (public.owns_project(((storage.foldername(name))[1])::uuid) or public.is_staff()));
