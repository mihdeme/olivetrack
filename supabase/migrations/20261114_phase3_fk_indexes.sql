create index if not exists group_harvests_group_day_owner_fk
  on public.group_harvests(group_id,work_day_id,owner_id);
create index if not exists worker_earnings_harvest_owner_fk
  on public.worker_earnings(harvest_id,owner_id);
