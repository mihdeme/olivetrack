-- Phase 4.5: daily individual pay models. No "forfait" mode: operating expenses belong to phase 5.
-- No schema change to historic group earnings / cash payments.
create table public.worker_day_compensations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  work_day_id uuid not null,
  worker_id uuid not null,
  mode text not null check (mode in ('individual_sacks','daily')),
  quantity integer not null check (quantity between 1 and 100000),
  rate_cents integer not null check (rate_cents between 1 and 1000000),
  amount_cents bigint generated always as (quantity::bigint * rate_cents::bigint) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(work_day_id,worker_id),
  foreign key (work_day_id,owner_id) references public.work_days(id,owner_id) on delete restrict,
  foreign key (worker_id,owner_id) references public.workers(id,owner_id) on delete restrict,
  constraint daily_is_one_day check (mode<>'daily' or quantity=1)
);
create index worker_day_compensation_worker_owner on public.worker_day_compensations(worker_id,owner_id);
create index worker_day_compensation_day_owner on public.worker_day_compensations(work_day_id,owner_id);

alter table public.worker_day_compensations enable row level security;
create policy owner_read_individual_pay on public.worker_day_compensations for select to authenticated
 using (owner_id=(select auth.uid()) and owner_id='06070673-2b2b-4d95-bb32-c626404f0601'::uuid);
revoke all on public.worker_day_compensations from public,anon,authenticated;
grant select on public.worker_day_compensations to authenticated;

-- In the UI, remove an individual accrual before changing/deleting that person's attendance.
-- Lock the attendance row when writing compensation to serialize with simultaneous group assignment.
create function public.save_individual_compensation(
 p_day_id uuid,p_worker_id uuid,p_mode text,p_quantity integer,p_rate_cents integer
) returns void language plpgsql security definer set search_path=''
as $$
declare
  v_owner constant uuid:='06070673-2b2b-4d95-bb32-c626404f0601'::uuid;
  v_attendance public.attendances%rowtype;
begin
  if (select auth.uid()) is distinct from v_owner then raise exception 'Non autorisé' using errcode='42501'; end if;
  if p_day_id is null or p_worker_id is null or p_quantity is null or p_rate_cents is null
    or p_quantity < 0 or p_quantity > 100000 or p_rate_cents < 1 or p_rate_cents > 1000000
    or p_mode not in ('individual_sacks','daily') or p_mode is null
    or (p_mode='daily' and p_quantity not in (0,1))
  then raise exception 'Mode, quantité ou tarif invalide' using errcode='22023'; end if;
  -- Serialize by worker, then attendance (same worker lock order as payouts).
  perform 1 from public.workers where id=p_worker_id and owner_id=v_owner for update;
  if not found then raise exception 'Ouvrier introuvable' using errcode='22023'; end if;
  select * into v_attendance from public.attendances
   where worker_id=p_worker_id and work_day_id=p_day_id and owner_id=v_owner for update;
  if not found then raise exception 'Pointer cet ouvrier présent avant de saisir sa rémunération' using errcode='22023'; end if;
  if p_quantity=0 then
    delete from public.worker_day_compensations where work_day_id=p_day_id and worker_id=p_worker_id and owner_id=v_owner;
    return;
  end if;
  if v_attendance.group_id is not null then
    raise exception 'Retirer cet ouvrier du groupe avant sa rémunération individuelle' using errcode='22023';
  end if;
  insert into public.worker_day_compensations(owner_id,work_day_id,worker_id,mode,quantity,rate_cents)
   values(v_owner,p_day_id,p_worker_id,p_mode,p_quantity,p_rate_cents)
  on conflict(work_day_id,worker_id) do update set mode=excluded.mode,
   quantity=excluded.quantity,rate_cents=excluded.rate_cents,updated_at=now();
end $$;
revoke all on function public.save_individual_compensation(uuid,uuid,text,integer,integer) from public,anon;
grant execute on function public.save_individual_compensation(uuid,uuid,text,integer,integer) to authenticated;

-- Membership guard for individually paid workers. Existing phase 3 group guard remains enabled.
create function public.guard_individual_compensation_attendance()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_worker uuid;v_day uuid;v_group uuid;
begin
  if tg_op='DELETE' then
    v_worker:=old.worker_id;v_day:=old.work_day_id;v_group:=old.group_id;
  else
    v_worker:=new.worker_id;v_day:=new.work_day_id;v_group:=new.group_id;
  end if;
  if tg_op='DELETE' or v_group is not null or (tg_op='UPDATE' and
    (new.work_day_id is distinct from old.work_day_id or new.worker_id is distinct from old.worker_id)) then
    if exists(select 1 from public.worker_day_compensations c
      where c.work_day_id=old.work_day_id and c.worker_id=old.worker_id) then
      raise exception 'Rémunération individuelle enregistrée : remettez-la à zéro avant de modifier la présence'
        using errcode='23514';
    end if;
    if tg_op <> 'DELETE' and exists(select 1 from public.worker_day_compensations c
      where c.work_day_id=new.work_day_id and c.worker_id=new.worker_id) then
      raise exception 'Une rémunération individuelle existe déjà pour cette journée' using errcode='23514';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.guard_individual_compensation_attendance() from public,anon,authenticated;
create trigger protect_individual_compensation
 before update or delete on public.attendances
 for each row execute function public.guard_individual_compensation_attendance();
