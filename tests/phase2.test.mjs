import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const schema = readFileSync('supabase/migrations/20261114_phase2_workforce.sql','utf8')
const perms = readFileSync('supabase/migrations/20261114_phase2_privileges.sql','utf8')
const ui = readFileSync('src/Phase2.tsx','utf8')
const data = readFileSync('src/phase2-data.ts','utf8')
const app = readFileSync('src/App.tsx','utf8')

test('Phase 2 four durable tables with owner-only RLS', () => {
  for (const table of ['workers','work_days','harvest_groups','attendances']) {
    assert.match(schema, new RegExp('create table public\\.'+table+'\\s*\\(', 'i'))
    assert.match(schema, new RegExp('alter table public\\.'+table+' enable row level security', 'i'))
    assert.match(schema, new RegExp('create policy '+table+'_owner_all', 'i'))
  }
  assert.match(schema,/owner_id = \(select auth\.uid\(\)\)/i)
  assert.match(schema,/06070673-2b2b-4d95-bb32-c626404f0601/)
})
test('No broad or anonymous table permissions', () => {
  assert.match(perms,/revoke all on table/)
  assert.match(perms,/from PUBLIC, anon, authenticated/i)
  assert.doesNotMatch(perms,/grant truncate/i)
  assert.match(perms,/grant delete on table public\.attendances, public\.harvest_groups/i)
})
test('Attendance is unique per worker and day, with relational group guard', () => {
  assert.match(schema,/unique \(work_day_id, worker_id\)/)
  assert.match(schema,/foreign key \(group_id, work_day_id, owner_id\)/)
})
test('Worker history survives archived status, no delete-worker API', () => {
  assert.match(schema,/is_active boolean not null default true/)
  assert.match(ui,/is_active/)
  assert.doesNotMatch(data,/\.from\('workers'\)\.delete\(/)
})
test('UI shows real Supabase data and explicitly wires phase 2 screens', () => {
  assert.match(app,/<DailyAttendance\/>/)
  assert.match(app,/<WorkerRegister\/>/)
  assert.match(data,/from\('workers'\)/)
  assert.match(data,/from\('attendances'\)/)
  assert.match(ui,/type="date"/)
})
