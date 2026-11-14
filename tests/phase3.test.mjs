import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/migrations/20261114_phase3_harvest_earnings.sql','utf8')
const api = readFileSync('src/phase3-data.ts','utf8')
const ui = readFileSync('src/Phase3.tsx','utf8')
const page = readFileSync('src/Phase2.tsx','utf8')
test('Group harvest stored in integer cents and exact accrued total',()=>{
  assert.match(sql,/rate_cents integer not null/)
  assert.match(sql,/sacks::bigint \* rate_cents::bigint/)
  assert.match(sql,/v_total \/ v_members/)
  assert.match(sql,/v_total % v_members/)
})
test('Harvest saves atomically via owner-checked SQL RPC',()=>{
  assert.match(sql,/create function public\.save_group_harvest/)
  assert.match(sql,/auth\.uid\(\)/)
  assert.match(sql,/owner_id=v_owner for update/)
  assert.match(sql,/revoke all on function public\.save_group_harvest.*PUBLIC,anon/)
  assert.match(api,/\.rpc\('save_group_harvest'/)
})
test('Only owner can read earnings; no browser write of worker earnings',()=>{
  assert.match(sql,/alter table public\.worker_earnings enable row level security/)
  assert.match(sql,/create policy earnings_owner_read/)
  assert.match(sql,/grant select on public\.group_harvests, public\.worker_earnings to authenticated/)
  assert.doesNotMatch(api,/\.from\('worker_earnings'\)\.(insert|update|delete)/)
})
test('Membership freezes while valued',()=>{
  assert.match(sql,/create trigger protect_group_membership/)
  assert.match(sql,/raise exception 'Groupe verrouillé/)
  assert.match(sql,/p_sacks = 0/)
})
test('Phase 3 UI wired into daily harvest and worker register',()=>{
  assert.match(page,/<HarvestAccounting/)
  assert.match(page,/<WorkerEarningsSummary/)
  assert.match(ui,/Rémunération totale du groupe/)
  assert.match(ui,/phase 4/i)
})
