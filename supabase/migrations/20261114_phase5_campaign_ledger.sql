-- Phase 5: immutable olive sale, buyer receipt and farm expense ledger.
-- Positive sales are invoiced amounts; positive receipts are actual money received.
-- Expenses exclude wages (already in worker_payments); zero opening cash balance is assumed.
create table public.olives_buyers(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid(),
 name text not null check(length(btrim(name)) between 2 and 120),
 phone text check(phone is null or length(phone)<=40),
 notes text check(notes is null or length(notes)<=400),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(id,owner_id)
);
create table public.campaign_ledger(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 kind text not null check(kind in ('sale','receipt','expense','sale_reversal','receipt_reversal','expense_reversal')),
 entry_date date not null,
 buyer_id uuid null,
 harvest_date date null,
 sacks integer null,
 weight_grams bigint null,
 unit_price_cents integer null,
 amount_cents bigint not null check(amount_cents<>0 and abs(amount_cents)<=1000000000000),
 category text null,
 method text null check(method is null or method in ('cash','bank','other')),
 reference text not null default '' check(char_length(reference)<=80),
 note text not null default '' check(char_length(note)<=400),
 reversal_of uuid null unique references public.campaign_ledger(id) on delete restrict,
 request_id uuid not null unique,
 created_at timestamptz not null default now(),
 foreign key(buyer_id,owner_id) references public.olives_buyers(id,owner_id) on delete restrict,
 constraint campaign_entry_fields check(
  (
   kind in ('sale','sale_reversal') and buyer_id is not null
   and weight_grams is not null and unit_price_cents is not null
   and abs(weight_grams) between 1 and 1000000000
   and unit_price_cents between 1 and 10000000
   and amount_cents = round(weight_grams::numeric * unit_price_cents::numeric / 1000)::bigint
   and category is null and method is null
   and (sacks is null or abs(sacks) between 1 and 100000)
  ) or (
   kind in ('receipt','receipt_reversal') and buyer_id is not null
   and weight_grams is null and unit_price_cents is null and sacks is null
   and category is null and method is not null and harvest_date is null
  ) or (
   kind in ('expense','expense_reversal') and buyer_id is null
   and weight_grams is null and unit_price_cents is null and sacks is null
   and category in ('transport','fuel','equipment','maintenance','food','other')
   and method is not null and harvest_date is null
  )
 ),
 constraint campaign_entry_sign check(
  (kind in ('sale','receipt','expense') and amount_cents>0 and reversal_of is null
    and (weight_grams is null or weight_grams>0)
    and (sacks is null or sacks>0))
  or
  (kind in ('sale_reversal','receipt_reversal','expense_reversal') and amount_cents<0 and reversal_of is not null
    and (weight_grams is null or weight_grams<0)
    and (sacks is null or sacks<0))
 )
);
create index campaign_ledger_buyer_date_idx on public.campaign_ledger(buyer_id,entry_date);
create index campaign_ledger_owner_date_idx on public.campaign_ledger(owner_id,entry_date);
create index campaign_ledger_harvest_date_idx on public.campaign_ledger(harvest_date);
create index campaign_ledger_reversal_idx on public.campaign_ledger(reversal_of);

alter table public.olives_buyers enable row level security;
alter table public.campaign_ledger enable row level security;
create policy olives_buyers_owner_all on public.olives_buyers for all to authenticated
 using(owner_id=(select auth.uid()) and owner_id='06070673-2b2b-4d95-bb32-c626404f0601'::uuid)
 with check(owner_id=(select auth.uid()) and owner_id='06070673-2b2b-4d95-bb32-c626404f0601'::uuid);
create policy campaign_ledger_owner_read on public.campaign_ledger for select to authenticated
 using(owner_id=(select auth.uid()) and owner_id='06070673-2b2b-4d95-bb32-c626404f0601'::uuid);
revoke all on public.olives_buyers,public.campaign_ledger from public,anon,authenticated;
grant select,insert,update on public.olives_buyers to authenticated;
grant select on public.campaign_ledger to authenticated;

create function public.prevent_campaign_ledger_edit()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 raise exception 'Écriture comptable non modifiable. Effectuez une contrepassation.'
 using errcode='23514';
end $$;
revoke all on function public.prevent_campaign_ledger_edit() from public,anon,authenticated;
create trigger campaign_ledger_append_only before update or delete on public.campaign_ledger
 for each row execute function public.prevent_campaign_ledger_edit();

create function public.record_campaign_entry(
 p_kind text,p_entry_date date,p_buyer_id uuid,p_weight_grams bigint,
 p_unit_price_cents integer,p_sacks integer,p_harvest_date date,
 p_amount_cents bigint,p_category text,p_method text,
 p_reference text,p_note text,p_request_id uuid
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
 v_owner constant uuid:='06070673-2b2b-4d95-bb32-c626404f0601'::uuid;
 v_amount bigint;
 v_existing public.campaign_ledger%rowtype;
 v_id uuid;
begin
 if (select auth.uid()) is distinct from v_owner then raise exception 'Non autorisé' using errcode='42501';end if;
 if p_kind not in ('sale','receipt','expense') or p_kind is null or p_entry_date is null
  or p_request_id is null or p_reference is null or char_length(p_reference)>80
  or p_note is null or char_length(p_note)>400 then
  raise exception 'Paramètres invalides' using errcode='22023';
 end if;
 if p_kind='sale' then
  if p_buyer_id is null or p_weight_grams is null or p_weight_grams not between 1 and 1000000000
   or p_unit_price_cents is null or p_unit_price_cents not between 1 and 10000000
   or (p_sacks is not null and p_sacks not between 1 and 100000)
   or p_amount_cents is not null or p_method is not null or p_category is not null
  then raise exception 'Bon de pesée invalide' using errcode='22023';end if;
  v_amount:=round(p_weight_grams::numeric*p_unit_price_cents::numeric/1000)::bigint;
 elsif p_kind='receipt' then
  if p_buyer_id is null or p_amount_cents is null or p_amount_cents not between 1 and 1000000000000
   or p_weight_grams is not null or p_unit_price_cents is not null
   or p_sacks is not null or p_harvest_date is not null or p_category is not null
   or p_method not in ('cash','bank','other') or p_method is null
  then raise exception 'Encaissement invalide' using errcode='22023';end if;
  v_amount:=p_amount_cents;
 else
  if p_buyer_id is not null or p_amount_cents is null or p_amount_cents not between 1 and 1000000000000
   or p_weight_grams is not null or p_unit_price_cents is not null
   or p_sacks is not null or p_harvest_date is not null
   or p_category not in ('transport','fuel','equipment','maintenance','food','other') or p_category is null
   or p_method not in ('cash','bank','other') or p_method is null
  then raise exception 'Dépense invalide' using errcode='22023';end if;
  v_amount:=p_amount_cents;
 end if;
 if v_amount<1 then raise exception 'Montant de vente inférieur à un centime' using errcode='22023';end if;
 if p_buyer_id is not null then
  perform 1 from public.olives_buyers where id=p_buyer_id and owner_id=v_owner;
  if not found then raise exception 'Acheteur introuvable' using errcode='22023';end if;
 end if;
 select * into v_existing from public.campaign_ledger where request_id=p_request_id;
 if found then
  if v_existing.owner_id<>v_owner or v_existing.kind<>p_kind or v_existing.entry_date<>p_entry_date
   or v_existing.buyer_id is distinct from p_buyer_id
   or v_existing.weight_grams is distinct from p_weight_grams
   or v_existing.unit_price_cents is distinct from p_unit_price_cents
   or v_existing.sacks is distinct from p_sacks
   or v_existing.harvest_date is distinct from p_harvest_date
   or v_existing.amount_cents<>v_amount
   or v_existing.category is distinct from p_category
   or v_existing.method is distinct from p_method
   or v_existing.reference<>p_reference or v_existing.note<>p_note then
    raise exception 'La clé de requête a été réutilisée avec une autre écriture' using errcode='23505';
  end if;
  return v_existing.id;
 end if;
 insert into public.campaign_ledger(owner_id,kind,entry_date,buyer_id,harvest_date,sacks,
  weight_grams,unit_price_cents,amount_cents,category,method,reference,note,request_id)
 values(v_owner,p_kind,p_entry_date,p_buyer_id,p_harvest_date,p_sacks,p_weight_grams,
  p_unit_price_cents,v_amount,p_category,p_method,p_reference,p_note,p_request_id)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.record_campaign_entry(text,date,uuid,bigint,integer,integer,date,bigint,text,text,text,text,uuid) from public,anon;
grant execute on function public.record_campaign_entry(text,date,uuid,bigint,integer,integer,date,bigint,text,text,text,text,uuid) to authenticated;

create function public.reverse_campaign_entry(
 p_entry_id uuid,p_note text,p_request_id uuid
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
 v_owner constant uuid:='06070673-2b2b-4d95-bb32-c626404f0601'::uuid;
 v_old public.campaign_ledger%rowtype;
 v_existing public.campaign_ledger%rowtype;
 v_id uuid;
begin
 if (select auth.uid()) is distinct from v_owner then raise exception 'Non autorisé' using errcode='42501';end if;
 if p_entry_id is null or p_note is null or btrim(p_note)='' or char_length(p_note)>400 or p_request_id is null
 then raise exception 'Motif de correction requis' using errcode='22023';end if;
 select * into v_old from public.campaign_ledger
  where id=p_entry_id and owner_id=v_owner and kind in ('sale','receipt','expense');
 if not found then raise exception 'Écriture d’origine introuvable' using errcode='22023';end if;
 -- Serialize reversals for the same entry.
 perform 1 from public.campaign_ledger where id=p_entry_id for key share;
 select * into v_existing from public.campaign_ledger where request_id=p_request_id;
 if found then
  if v_existing.reversal_of<>p_entry_id or v_existing.note<>p_note then
    raise exception 'Clé de requête réutilisée' using errcode='23505';
  end if;
  return v_existing.id;
 end if;
 if exists(select 1 from public.campaign_ledger where reversal_of=p_entry_id) then
  raise exception 'Écriture déjà annulée' using errcode='23505';
 end if;
 insert into public.campaign_ledger(owner_id,kind,entry_date,buyer_id,harvest_date,sacks,
  weight_grams,unit_price_cents,amount_cents,category,method,reference,note,reversal_of,request_id)
 values(v_owner,v_old.kind||'_reversal',current_date,v_old.buyer_id,v_old.harvest_date,
  -v_old.sacks,-v_old.weight_grams,v_old.unit_price_cents,-v_old.amount_cents,
  v_old.category,v_old.method,v_old.reference,p_note,p_entry_id,p_request_id)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.reverse_campaign_entry(uuid,text,uuid) from public,anon;
grant execute on function public.reverse_campaign_entry(uuid,text,uuid) to authenticated;
