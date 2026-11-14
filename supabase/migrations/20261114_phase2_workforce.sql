-- OliveTrack Phase 2: roster, workdays, groups, attendance (no wages).
-- Owner-only access is enforced IN POSTGRES, not just in the React UI.
create extension if not exists pgcrypto;

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  phone text check (phone is null or length(phone) <= 40),
  notes text check (notes is null or length(notes) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.work_days (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  work_date date not null,
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique (owner_id, work_date),
  unique (id, owner_id)
);

create table public.harvest_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  work_day_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (owner_id, work_day_id, name),
  unique (id, work_day_id, owner_id),
  foreign key (work_day_id, owner_id) references public.work_days(id, owner_id) on delete cascade
);

-- Each worker has at most one attendance row per day.
-- group_id null = present, not yet assigned to a group.
create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  work_day_id uuid not null,
  worker_id uuid not null,
  group_id uuid null,
  created_at timestamptz not null default now(),
  unique (work_day_id, worker_id),
  foreign key (work_day_id, owner_id) references public.work_days(id, owner_id) on delete cascade,
  foreign key (worker_id, owner_id) references public.workers(id, owner_id) on delete restrict,
  foreign key (group_id, work_day_id, owner_id) references public.harvest_groups(id, work_day_id, owner_id) on delete no action
);

create index attendances_by_worker on public.attendances(worker_id, work_day_id);
create index attendances_by_day_group on public.attendances(work_day_id, group_id);
create index groups_by_day on public.harvest_groups(work_day_id);

-- RLS with immutable single-owner boundary; no policies for anon.
alter table public.workers enable row level security;
alter table public.work_days enable row level security;
alter table public.harvest_groups enable row level security;
alter table public.attendances enable row level security;

create policy workers_owner_all on public.workers for all to authenticated
  using (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid)
  with check (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid);
create policy work_days_owner_all on public.work_days for all to authenticated
  using (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid)
  with check (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid);
create policy harvest_groups_owner_all on public.harvest_groups for all to authenticated
  using (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid)
  with check (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid);
create policy attendances_owner_all on public.attendances for all to authenticated
  using (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid)
  with check (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid);

revoke all on public.workers, public.work_days, public.harvest_groups, public.attendances from anon;
grant select, insert, update on public.workers, public.work_days, public.harvest_groups, public.attendances to authenticated;
grant delete on public.attendances, public.harvest_groups to authenticated;

-- Presences can be removed, workers are archived rather than deleted.
-- Day records remain durable once created, and groups can't be deleted if referenced.
