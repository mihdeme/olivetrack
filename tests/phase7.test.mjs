import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const backup=readFileSync('src/backup.ts','utf8')
const panel=readFileSync('src/BackupPanel.tsx','utf8')
const reports=readFileSync('src/Reports.tsx','utf8')
const earnings=readFileSync('src/phase3-data.ts','utf8')
const print=readFileSync('src/report-print.css','utf8')
const expected=['workers','work_days','harvest_groups','attendances','group_harvests',
 'worker_earnings','worker_day_compensations','worker_payments','olives_buyers','campaign_ledger']

test('Backup covers all 10 live tables, including immutable financial journals',()=>{
 for(const name of expected) assert.match(backup,new RegExp("'"+name+"'"))
 assert.match(backup,/schema:'olivetrack-export-v1'/)
 assert.match(backup,/row_counts/)
 assert.match(backup,/source:'supabase-owner-readonly'/)
 assert.match(backup,/\.select\('\*'\)/)
 assert.doesNotMatch(backup,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/)
})
test('Export paginates reliably with composite earnings key, and fails closed',()=>{
 assert.match(backup,/\.order\('harvest_id'\)\.order\('worker_id'\)/)
 assert.match(backup,/\.range\(offset,offset\+499\)/)
 assert.match(backup,/if\(error\)throw Error/)
 assert.match(backup,/Promise\.all\(backupTables\.map\(readTable\)\)/)
 assert.match(backup,/if\(rows\.length>=50000\)/)
})
test('Download is client-only, explicit, warns that backup is unencrypted',()=>{
 assert.match(panel,/window\.confirm/)
 assert.match(panel,/NON CHIFFRÉ/)
 assert.match(panel,/données personnelles et financières/)
 assert.match(panel,/restauration complète n’est pas automatisée/)
 assert.match(backup,/new Blob/)
 assert.match(backup,/URL\.createObjectURL/)
 assert.match(backup,/\.json/)
 assert.match(reports,/<BackupPanel\/>/)
 assert.match(print,/@media print\{\.backup-panel\{display:none!important\}\}/)
})
test('Cumulative worker earnings paginate beyond Supabase 1000 row max',()=>{
 const func=earnings.slice(earnings.indexOf('export async function getAllEarnings'))
 assert.match(func,/for \(let offset=0;;offset\+=500\)/)
 assert.match(func,/\.order\('harvest_id'\)\.order\('worker_id'\)/)
 assert.match(func,/\.range\(offset,offset\+499\)/)
 assert.match(func,/if \(page\.length<500\) return result/)
})
