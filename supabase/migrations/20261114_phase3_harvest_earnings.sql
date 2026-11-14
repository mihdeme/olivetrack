-- Phase 3: accruals in cents, by group per work day; never record actual cash payments here.
create table public.group_harvests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  work_day_id uuid not null,
  group_id uuid not null unique,
  sacks integer not null check (sacks between 1 and 100000),
  rate_cents integer not null check (rate_cents between 1 and 1000000),
  total_cents bigint generated always as (sacks::bigint * rate_cents::bigint) stored,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (group_id, work_day_id, owner_id)
    references public.harvest_groups(id,work_day_id,owner_id) on delete restrict
);

create table public.worker_earnings (
  harvest_id uuid not null,
  owner_id uuid not null,
  worker_id uuid not null,
  amount_cents bigint not null check (amount_cents >= 0),
  primary key (harvest_id,worker_id),
  foreign key (harvest_id,owner_id) references public.group_harvests(id,owner_id) on delete cascade,
  foreign key (worker_id,owner_id) references public.workers(id,owner_id) on delete restrict
);
create index worker_earnings_worker_owner_idx on public.worker_earnings(worker_id,owner_id);
create index group_harvests_day_owner_idx on public.group_harvests(work_day_id,owner_id);

alter table public.group_harvests enable row level security;
alter table public.worker_earnings enable row level security;
create policy harvest_owner_read on public.group_harvests for select to authenticated
  using (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid);
create policy earnings_owner_read on public.worker_earnings for select to authenticated
  using (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid);

revoke all on public.group_harvests, public.worker_earnings from PUBLIC,anon,authenticated;
grant select on public.group_harvests, public.worker_earnings to authenticated;

-- Membership must remain frozen while a group's harvest is valued.
-- Prevent both new assignment into valued group and removal/reassignment from it.
create function public.guard_recorded_harvest_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_old_group uuid; v_new_group uuid; v_group uuid;
begin
  if TG_OP <> 'INSERT' then v_old_group := OLD.group_id; end if;
  if TG_OP <> 'DELETE' then v_new_group := NEW.group_id; end if;
  if TG_OP = 'UPDATE' and v_old_group is not distinct from v_new_group and OLD.work_day_id = NEW.work_day_id and OLD.worker_id = NEW.worker_id then
    return NEW;
  end if;
  -- Lock groups BEFORE inspecting harvests, matching the writer RPC's lock order.
  for v_group in select distinct q.g from (values(v_old_group),(v_new_group)) q(g) where q.g is not null order by q.g loop
    perform 1 from public.harvest_groups where id = v_group for update;
    if exists (select 1 from public.group_harvests where group_id = v_group) then
      raise exception 'Groupe verrouillé par une récolte enregistrée. Effacez d’abord cette récolte.'
        using errcode = '23514';
    end if;
  end loop;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end
$$;
revoke all on function public.guard_recorded_harvest_membership() from PUBLIC,anon,authenticated;
create trigger protect_group_membership
  before insert or update or delete on public.attendances
  for each row execute function public.guard_recorded_harvest_membership();

-- All calculation and rewriting of earnings is atomic and owner-authorized.
create function public.save_group_harvest(p_group_id uuid,p_sacks integer,p_rate_cents integer)
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_owner constant uuid := '06070673-2b2b-4d95-bb32-c626404f0601'::uuid;
  v_day uuid;
  v_owner_row uuid;
  v_harvest uuid;
  v_members integer;
  v_total bigint;
begin
  if (select auth.uid()) is distinct from v_owner then
    raise exception 'Non autorisé' using errcode='42501';
  end if;
  if p_sacks is null or p_sacks < 0 or p_sacks > 100000
    or p_rate_cents is null or p_rate_cents < 1 or p_rate_cents > 1000000 then
    raise exception 'Valeurs de sacs ou tarif invalides' using errcode='22023';
  end if;
  -- Lock the group row to serialize against all membership changes.
  select work_day_id,owner_id into v_day,v_owner_row
  from public.harvest_groups
  where id = p_group_id and owner_id=v_owner for update;
  if not found then raise exception 'Groupe introuvable' using errcode='22023'; end if;

  if p_sacks = 0 then
    delete from public.group_harvests where group_id=p_group_id and owner_id=v_owner;
    return;
  end if;

  select count(*)::integer into v_members
  from public.attendances where group_id=p_group_id and work_day_id=v_day and owner_id=v_owner;
  if v_members = 0 then raise exception 'Aucun ouvrier affecté à ce groupe' using errcode='22023'; end if;

  insert into public.group_harvests(owner_id,work_day_id,group_id,sacks,rate_cents)
  values(v_owner,v_day,p_group_id,p_sacks,p_rate_cents)
  on conflict(group_id) do update
    set sacks=excluded.sacks,rate_cents=excluded.rate_cents,updated_at=now()
  returning id,total_cents into v_harvest,v_total;

  delete from public.worker_earnings where harvest_id=v_harvest;
  insert into public.worker_earnings(harvest_id,owner_id,worker_id,amount_cents)
  select v_harvest,v_owner,a.worker_id,
    (v_total / v_members) + case when row_number() over (order by a.worker_id) <= (v_total % v_members) then 1 else 0 end
  from public.attendances a where a.group_id=p_group_id and a.work_day_id=v_day and a.owner_id=v_owner;
end
$$;
revoke all on function public.save_group_harvest(uuid,integer,integer) from PUBLIC,anon;
grant execute on function public.save_group_harvest(uuid,integer,integer) to authenticated;
