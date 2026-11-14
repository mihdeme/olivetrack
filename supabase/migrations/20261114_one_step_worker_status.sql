-- One-step daily status transition (phase 4.5 UX repair).
-- A whole change either succeeds together or is rolled back.
-- Historic valued group membership stays protected; changing a group's paid
-- membership requires explicit group harvest correction by the owner first.
create function public.change_worker_day_status(
  p_day_id uuid,
  p_worker_id uuid,
  p_status text,
  p_group_id uuid default null,
  p_quantity integer default null,
  p_rate_cents integer default null
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_owner constant uuid := '06070673-2b2b-4d95-bb32-c626404f0601'::uuid;
  v_row public.attendances%rowtype;
  v_target_group uuid;
  v_mode text;
begin
  if (select auth.uid()) is distinct from v_owner then
    raise exception 'Non autorisé' using errcode='42501';
  end if;
  if p_worker_id is null or p_day_id is null or p_status is null
    or p_status not in ('absent','unassigned','group','daily','individual_sacks')
  then raise exception 'Statut invalide' using errcode='22023'; end if;
  if p_status = 'group' then
    if p_group_id is null then raise exception 'Choisissez un groupe' using errcode='22023'; end if;
  elsif p_group_id is not null then
    raise exception 'Groupe incompatible avec ce mode' using errcode='22023';
  end if;
  if p_status in ('daily','individual_sacks') then
    if p_rate_cents is null or p_rate_cents < 1 or p_rate_cents > 1000000
      or p_quantity is null or p_quantity < 1 or p_quantity > 100000
      or (p_status='daily' and p_quantity<>1)
    then raise exception 'Quantité ou tarif invalide' using errcode='22023'; end if;
  elsif p_quantity is not null or p_rate_cents is not null then
    raise exception 'Tarif ou quantité non applicable' using errcode='22023';
  end if;

  -- Serialise by worker, following existing individual and payment RPCs.
  perform 1 from public.workers where id=p_worker_id and owner_id=v_owner for update;
  if not found then raise exception 'Ouvrier introuvable' using errcode='22023'; end if;
  perform 1 from public.work_days where id=p_day_id and owner_id=v_owner;
  if not found then raise exception 'Journée introuvable' using errcode='22023'; end if;

  select * into v_row from public.attendances
  where work_day_id=p_day_id and worker_id=p_worker_id and owner_id=v_owner for update;

  if p_status='group' then
    select id into v_target_group from public.harvest_groups
      where id=p_group_id and work_day_id=p_day_id and owner_id=v_owner;
    if not found then raise exception 'Groupe absent de cette journée' using errcode='22023'; end if;
  end if;

  -- Only changes that affect a valued group's membership are forbidden.
  -- A user may edit the individual mode without altering unrelated groups.
  if found and v_row.group_id is not null and
      (p_status<>'group' or v_row.group_id is distinct from v_target_group) then
    if exists(select 1 from public.group_harvests
              where group_id=v_row.group_id and owner_id=v_owner) then
      raise exception 'La récolte de ce groupe est déjà comptabilisée. Corrigez ses sacs avant de déplacer cet ouvrier.'
        using errcode='23514';
    end if;
  end if;
  if p_status='group' and
    (v_row.id is null or v_row.group_id is distinct from v_target_group)
    and exists(select 1 from public.group_harvests
               where group_id=v_target_group and owner_id=v_owner) then
      raise exception 'Le groupe choisi possède déjà une récolte comptabilisée. Corrigez les sacs avant de modifier sa composition.'
        using errcode='23514';
  end if;

  -- Clear the old individual accrual BEFORE modifying attendance. This avoids
  -- the old guard's warning and remains atomic if a later trigger rejects change.
  delete from public.worker_day_compensations
   where work_day_id=p_day_id and worker_id=p_worker_id and owner_id=v_owner;

  if p_status='absent' then
    delete from public.attendances
     where work_day_id=p_day_id and worker_id=p_worker_id and owner_id=v_owner;
    return;
  end if;

  if v_row.id is null then
    insert into public.attendances(owner_id,work_day_id,worker_id,group_id)
    values(v_owner,p_day_id,p_worker_id,case when p_status='group' then v_target_group else null end);
  else
    update public.attendances
       set group_id = case when p_status='group' then v_target_group else null end
     where id=v_row.id and owner_id=v_owner;
  end if;

  if p_status in ('daily','individual_sacks') then
    insert into public.worker_day_compensations
      (owner_id,work_day_id,worker_id,mode,quantity,rate_cents)
    values(v_owner,p_day_id,p_worker_id,p_status,p_quantity,p_rate_cents);
  end if;
end $$;
revoke all on function public.change_worker_day_status(uuid,uuid,text,uuid,integer,integer) from public,anon;
grant execute on function public.change_worker_day_status(uuid,uuid,text,uuid,integer,integer) to authenticated;
