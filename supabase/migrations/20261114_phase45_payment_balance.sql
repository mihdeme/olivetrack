-- Phase 4.5: payroll ceiling must include both group and individual accrued compensation.
create or replace function public.record_worker_payment(
  p_worker_id uuid,
  p_amount_cents bigint,
  p_kind text,
  p_payment_date date,
  p_note text,
  p_request_id uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_owner constant uuid := '06070673-2b2b-4d95-bb32-c626404f0601'::uuid;
  v_id uuid;
  v_earned bigint;
  v_paid bigint;
begin
  if (select auth.uid()) is distinct from v_owner then
    raise exception 'Non autorisé' using errcode='42501';
  end if;
  if p_request_id is null or p_worker_id is null or p_payment_date is null
     or p_kind not in ('advance','weekly','partial','final')
     or p_kind is null or p_amount_cents is null
     or p_amount_cents < 1 or p_amount_cents > 1000000000
     or p_note is null or char_length(p_note) > 400 then
    raise exception 'Paiement invalide' using errcode='22023';
  end if;

  -- Serialize operations for the same worker and keep idempotency stable.
  perform 1 from public.workers where id=p_worker_id and owner_id=v_owner for update;
  if not found then raise exception 'Ouvrier introuvable' using errcode='22023'; end if;

  select id into v_id from public.worker_payments where request_id=p_request_id;
  if found then
    if not exists (
      select 1 from public.worker_payments where id=v_id and owner_id=v_owner
        and worker_id=p_worker_id and amount_cents=p_amount_cents and kind=p_kind
        and payment_date=p_payment_date and note=p_note and reversal_of is null
    ) then
      raise exception 'Clé de requête réutilisée avec un autre paiement' using errcode='23505';
    end if;
    return v_id;
  end if;

  if p_kind <> 'advance' then
    select
      (select coalesce(sum(amount_cents),0) from public.worker_earnings where worker_id=p_worker_id and owner_id=v_owner)
    + (select coalesce(sum(amount_cents),0) from public.worker_day_compensations where worker_id=p_worker_id and owner_id=v_owner)
    into v_earned;
    select coalesce(sum(amount_cents),0) into v_paid from public.worker_payments where worker_id=p_worker_id and owner_id=v_owner;
    if p_amount_cents > v_earned - v_paid then
      raise exception 'Paiement supérieur au solde disponible. Utilisez Avance pour un versement anticipé.'
        using errcode='22023';
    end if;
  end if;
  insert into public.worker_payments(owner_id,worker_id,payment_date,kind,amount_cents,note,request_id)
  values(v_owner,p_worker_id,p_payment_date,p_kind,p_amount_cents,p_note,p_request_id)
  returning id into v_id;
  return v_id;
end $$;
