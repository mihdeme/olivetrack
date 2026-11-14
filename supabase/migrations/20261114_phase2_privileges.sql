-- Explicitly remove broad default API privileges. TRUNCATE bypasses RLS!
revoke all on table public.workers, public.work_days, public.harvest_groups, public.attendances from PUBLIC, anon, authenticated;
grant select, insert, update on table public.workers, public.work_days, public.harvest_groups, public.attendances to authenticated;
grant delete on table public.attendances, public.harvest_groups to authenticated;
