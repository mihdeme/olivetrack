import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql=readFileSync('supabase/migrations/20261114_one_step_worker_status.sql','utf8')
const sheet=readFileSync('src/WorkerStatusSheet.tsx','utf8')
const field=readFileSync('src/FieldDay.tsx','utf8')
const api=readFileSync('src/phase45-data.ts','utf8')
test('Atomic owner-only daily status update supports all three pay modes plus absence',()=>{
 assert.match(sql,/create function public\.change_worker_day_status/)
 assert.match(sql,/security definer set search_path = ''/)
 assert.match(sql,/auth\.uid\(\)/)
 assert.match(sql,/p_status not in \('absent','unassigned','group','daily','individual_sacks'\)/)
 assert.match(sql,/delete from public\.worker_day_compensations/)
 assert.match(sql,/insert into public\.attendances/)
 assert.match(sql,/update public\.attendances/)
 assert.match(sql,/insert into public\.worker_day_compensations/)
 assert.match(sql,/revoke all on function public\.change_worker_day_status.*public,anon/)
 assert.match(api,/\.rpc\('change_worker_day_status'/)
})
test('Already-valued collective groups are never implicitly recalculated or erased',()=>{
 assert.match(sql,/public\.group_harvests/)
 assert.match(sql,/Corrigez ses sacs avant de déplacer/)
 assert.doesNotMatch(sql,/delete from public\.group_harvests/)
 assert.doesNotMatch(sql,/update public\.worker_earnings/)
})
test('One-step sheet offers a deliberate mode choice and monetary change preview',()=>{
 assert.match(sheet,/Collectif au sac/)
 assert.match(sheet,/Individuel au sac/)
 assert.match(sheet,/À la journée/)
 assert.match(sheet,/Ancien gain individuel/)
 assert.match(sheet,/window\.confirm/)
 assert.match(sheet,/Les paiements déjà effectués ne seront pas modifiés/)
})
test('One edit path available from daily pointage, grouping and gains',()=>{
 assert.match(field,/field-person-edit/)
 assert.match(field,/field-assignment-action/)
 assert.match(field,/WorkerStatusSheet/)
 assert.match(field,/setEditing\(worker\)/)
})
