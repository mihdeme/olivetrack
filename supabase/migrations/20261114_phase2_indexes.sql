-- Cover composite foreign keys for stable joins and efficient deletes.
create index if not exists attendances_group_owner_fk on public.attendances(group_id, work_day_id, owner_id);
create index if not exists attendances_day_owner_fk on public.attendances(work_day_id, owner_id);
create index if not exists attendances_worker_owner_fk on public.attendances(worker_id, owner_id);
create index if not exists harvest_groups_day_owner_fk on public.harvest_groups(work_day_id, owner_id);
