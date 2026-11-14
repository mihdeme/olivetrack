-- OliveTrack Phase 4: worker cash disbursements and immutable adjustment ledger.
-- Credits are earnings in worker_earnings (phase 3). Payments here are cash movements.
create table public.worker_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  worker_id uuid not null,
  payment_date date not null,
  kind text not null check (kind in ('advance','weekly','partial','final','reversal')),
  amount_cents bigint not null check (amount_cents between -100000000000 and 100000000000 and amount_cents <> 0),
  note text not null default '' check (char_length(note) <= 400),
  reversal_of uuid null unique references public.worker_payments(id) on delete restrict,
  request_id uuid not null unique,
  recorded_at timestamptz not null default now(),
  constraint payment_kind_sign check (
    (kind = 'reversal' and amount_cents < 0 and reversal_of is not null)
    or (kind <> 'reversal' and amount_cents > 0 and reversal_of is null)
  ),
  foreign key (worker_id, owner_id) references public.workers(id,owner_id) on delete restrict
);
create index worker_payments_worker_date_idx on public.worker_payments(worker_id,payment_date,recorded_at);
create index worker_payments_date_owner_idx on public.worker_payments(payment_date,owner_id);
create index worker_payments_owner_worker_idx on public.worker_payments(owner_id,worker_id);

alter table public.worker_payments enable row level security;
create policy worker_payments_owner_read on public.worker_payments for select to authenticated
using (owner_id = (select auth.uid()) and owner_id = '06070673-2b2b-4d95-bb32-c626404f0601'::uuid);
revoke all on public.worker_payments from public,anon,authenticated;
grant select on public.worker_payments to authenticated;

-- Protect historical cash movements even from accidental SQL writes under ordinary roles.
create function public.prevent_worker_payment_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception 'Un paiement ne peut pas être modifié ou supprimé : enregistrez une contrepassation.'
    using errcode='23514';
end $$;
revoke all on function public.prevent_worker_payment_mutation() from public,anon,authenticated;
create trigger worker_payments_append_only
before update or delete on public.worker_payments
for each row execute function public.prevent_worker_payment_mutation();

-- A single RPC records all payments atomically. The idempotency key prevents double payment
-- after a retry on a poor mobile connection.
create function public.record_worker_payment(
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
    select coalesce(sum(amount_cents),0) into v_earned from public.worker_earnings where worker_id=p_worker_id and owner_id=v_owner;
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
revoke all on function public.record_worker_payment(uuid,bigint,text,date,text,uuid) from public,anon;
grant execute on function public.record_worker_payment(uuid,bigint,text,date,text,uuid) to authenticated;

-- Counterpassation leaves original record intact and adds its exact negative amount.
create function public.reverse_worker_payment(
  p_payment_id uuid,
  p_note text,
  p_request_id uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_owner constant uuid := '06070673-2b2b-4d95-bb32-c626404f0601'::uuid;
  v_original public.worker_payments%rowtype;
  v_id uuid;
begin
  if (select auth.uid()) is distinct from v_owner then
    raise exception 'Non autorisé' using errcode='42501';
  end if;
  if p_payment_id is null or p_request_id is null or p_note is null or char_length(p_note) > 400 then
    raise exception 'Contrepassation invalide' using errcode='22023';
  end if;
  select * into v_original from public.worker_payments
    where id=p_payment_id and owner_id=v_owner and kind<>'reversal';
  if not found then raise exception 'Paiement initial introuvable' using errcode='22023'; end if;

  perform 1 from public.workers where id=v_original.worker_id and owner_id=v_owner for update;
  select id into v_id from public.worker_payments where request_id=p_request_id;
  if found then
    if not exists (
      select 1 from public.worker_payments where id=v_id and reversal_of=p_payment_id
        and amount_cents=-v_original.amount_cents and note=p_note
    ) then raise exception 'Clé de requête réutilisée' using errcode='23505'; end if;
    return v_id;
  end if;
  if exists (select 1 from public.worker_payments where reversal_of=p_payment_id) then
    raise exception 'Ce paiement a déjà été annulé' using errcode='23505';
  end if;
  insert into public.worker_payments(owner_id,worker_id,payment_date,kind,amount_cents,note,request_id,reversal_of)
  values(v_owner,v_original.worker_id,current_date,'reversal',-v_original.amount_cents,p_note,p_request_id,p_payment_id)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.reverse_worker_payment(uuid,text,uuid) from public,anon;
grant execute on function public.reverse_worker_payment(uuid,text,uuid) to authenticated;
