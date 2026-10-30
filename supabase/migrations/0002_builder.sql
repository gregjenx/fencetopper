-- FenceTopper: the guided Builder on real accounts.
-- Run once in the Supabase SQL editor after 0001_phase1.sql. It only adds a column, so it's safe to run again.
--
-- builder holds the whole Builder project as the customer last saved it: project answers, each run's posts,
-- spans and photos (small thumbnails), notes and the shipping address. The runs, height, color and estimate
-- columns stay in step with it, so team emails and /my-project read the same numbers.

alter table public.projects add column if not exists builder jsonb;
