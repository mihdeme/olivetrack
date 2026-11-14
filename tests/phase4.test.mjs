import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const schema=readFileSync('supabase/migrations/20261114_phase4_worker_payments.sql','utf8')
const api=readFileSync('src/phase4-data.ts','utf8')
const ui=readFileSync('src/Phase4.tsx','utf8')
const register=readFileSync('src/Phase2.tsx','utf8')

test('Payments are distinct from accrued wages and preserve cash history',()=>{
  assert.match(schema,/create table public\.worker_payments/)
  assert.match(schema,/amount_cents bigint/)
  assert.match(schema,/kind in \('advance','weekly','partial','final','reversal'\)/)
  assert.match(schema,/reversal_of uuid null unique/)
  assert.match(schema,/create trigger worker_payments_append_only/)
})
test('Only owner may record payments via RPC; no direct writes',()=>{
  assert.match(schema,/if \(select auth\.uid\(\)\) is distinct from v_owner/)
  assert.match(schema,/security definer set search_path = ''/)
  assert.match(schema,/revoke all on public\.worker_payments from public,anon,authenticated/)
  assert.match(schema,/grant select on public\.worker_payments to authenticated/)
  assert.match(schema,/revoke all on function public\.record_worker_payment.*public,anon/)
  assert.match(api,/\.rpc\('record_worker_payment'/)
  assert.doesNotMatch(api,/\.from\('worker_payments'\)\.(insert|update|delete)/)
})
test('Retries do not create duplicates and normal payouts cannot overdraw earned balance',()=>{
  assert.match(schema,/request_id uuid not null unique/)
  assert.match(schema,/where request_id=p_request_id/)
  assert.match(schema,/if p_kind <> 'advance'/)
  assert.match(schema,/p_amount_cents > v_earned - v_paid/)
})
test('Corrections use signed reversals rather than modifying records',()=>{
  assert.match(schema,/public\.reverse_worker_payment/)
  assert.match(schema,/amount_cents=-v_original\.amount_cents/)
  assert.match(schema,/kind='reversal'/)
  assert.match(schema,/raise exception 'Ce paiement a déjà été annulé'/)
})
test('Worker UI exposes payments separately from worker records and harvest',()=>{
  assert.match(register,/<WorkerPayroll workers=\{workers\}/)
  assert.match(ui,/Paie du mercredi/)
  assert.match(ui,/Solde de départ/)
  assert.match(ui,/Annuler/)
  assert.match(ui,/money\(stats\.due\)/)
})
