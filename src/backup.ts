import { supabase } from './supabase'

export const backupTables=[
 'workers','work_days','harvest_groups','attendances',
 'group_harvests','worker_earnings','worker_day_compensations',
 'worker_payments','olives_buyers','campaign_ledger'
] as const
export type BackupTable=typeof backupTables[number]
export type CampaignBackup={
 schema:'olivetrack-export-v1'
 exported_at:string
 source:'supabase-owner-readonly'
 tables:Record<BackupTable,unknown[]>
 row_counts:Record<BackupTable,number>
}
type Row=Record<string,unknown>
function db(){if(!supabase)throw Error('Supabase non configuré.');return supabase}
async function readTable(table:BackupTable):Promise<Row[]>{
 const rows:Row[]=[]
 for(let offset=0;;offset+=500){
  // worker_earnings has a composite key; order by both fields for stable pagination.
  const query=db().from(table).select('*')
  const ordered=table==='worker_earnings'?
    query.order('harvest_id').order('worker_id'):query.order('id')
  const {data,error}=await ordered.range(offset,offset+499)
  if(error)throw Error('Impossible de lire '+table+' : '+error.message)
  rows.push(...(data??[]) as Row[])
  if(!data||data.length<500)return rows
  if(rows.length>=50000)throw Error('Export trop volumineux : '+table)
 }
}
export async function prepareBackup():Promise<CampaignBackup>{
 const results=await Promise.all(backupTables.map(readTable))
 const tables={} as Record<BackupTable,Row[]>
 const row_counts={} as Record<BackupTable,number>
 backupTables.forEach((name,i)=>{tables[name]=results[i];row_counts[name]=results[i].length})
 return {schema:'olivetrack-export-v1',exported_at:new Date().toISOString(),
  source:'supabase-owner-readonly',tables,row_counts}
}
export function downloadBackup(data:CampaignBackup){
 const contents=JSON.stringify(data,null,2)
 const blob=new Blob([contents],{type:'application/json;charset=utf-8'})
 const url=URL.createObjectURL(blob)
 const link=document.createElement('a')
 link.href=url
 link.download='olivetrack-sauvegarde-'+data.exported_at.slice(0,10)+'.json'
 document.body.appendChild(link)
 link.click()
 link.remove()
 // Safari must have enough time to adopt the download before revocation.
 window.setTimeout(()=>URL.revokeObjectURL(url),10000)
}
