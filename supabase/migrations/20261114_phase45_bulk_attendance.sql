-- Phase 4.5: efficient, atomic worker roster actions for 70–90 worker field days.
create function public.bulk_attendance(
  p_day_id uuid, p_worker_ids uuid[], p_action text, p_group_id uuid default null
) returns integer language plpgsql security definer set search_path=''
as $$
declare
 v_owner constant uuid:='06070673-2b2b-4d95-bb32-c626404f0601'::uuid;
 v_worker uuid; v_count integer:=0; v_distinct uuid[];
begin
 if (select auth.uid()) is distinct from v_owner then raise exception 'Non autorisé' using errcode='42501'; end if;
 if p_day_id is null or p_worker_ids is null or p_action not in ('present','absent','assign') or p_action is null
 then raise exception 'Paramètres invalides' using errcode='22023'; end if;
 select array_agg(distinct wid order by wid) into v_distinct
 from unnest(p_worker_ids) wid where wid is not null;
 if v_distinct is null or cardinality(v_distinct)>100 then
   raise exception 'Choisir entre 1 et 100 ouvriers' using errcode='22023';
 end if;
 perform 1 from public.work_days where id=p_day_id and owner_id=v_owner;
 if not found then raise exception 'Journée introuvable' using errcode='22023'; end if;
 if p_action='assign' and p_group_id is not null then
   perform 1 from public.harvest_groups where id=p_group_id and work_day_id=p_day_id and owner_id=v_owner;
   if not found then raise exception 'Groupe introuvable pour cette journée' using errcode='22023'; end if;
 end if;
 for v_worker in select unnest(v_distinct) loop
   perform 1 from public.workers where id=v_worker and owner_id=v_owner;
   if not found then raise exception 'Ouvrier introuvable' using errcode='22023'; end if;
   if p_action='present' then
     insert into public.attendances(owner_id,work_day_id,worker_id)
      values(v_owner,p_day_id,v_worker) on conflict(work_day_id,worker_id) do nothing;
   elsif p_action='absent' then
     delete from public.attendances where work_day_id=p_day_id and worker_id=v_worker and owner_id=v_owner;
   else
     update public.attendances set group_id=p_group_id
      where work_day_id=p_day_id and worker_id=v_worker and owner_id=v_owner;
     if not found then raise exception 'Ouvrier absent : pointer sa présence avant affectation' using errcode='22023'; end if;
   end if;
   v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function public.bulk_attendance(uuid,uuid[],text,uuid) from public,anon;
grant execute on function public.bulk_attendance(uuid,uuid[],text,uuid) to authenticated;
