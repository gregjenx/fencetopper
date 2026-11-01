-- FenceTopper: let a brand-new customer keep working right after they save in Shop.
-- Run once in the Supabase SQL editor after 0002_builder.sql. It only adds columns, so it's safe to run again.
--
-- When an email saves for the first time, Shop gets a random key that opens that one project in the Builder,
-- so the customer doesn't have to stop and open our email first. Only the SHA-256 of the key is stored.
-- The key never opens the account or any other project. It stops working when the customer confirms their
-- email (they then use their own sign-in), when anyone saves again under that email, or after 30 days.

alter table public.projects add column if not exists guest_key_hash text;
alter table public.projects add column if not exists guest_key_expires_at timestamptz;
create index if not exists projects_guest_key_idx on public.projects (guest_key_hash) where guest_key_hash is not null;
