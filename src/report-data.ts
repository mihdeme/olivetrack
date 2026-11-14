import { supabase } from './supabase'
import { listWorkers, type Worker, type WorkDay, type Attendance, type HarvestGroup } from './phase2-data'
import { listBuyers, listLedger, type Buyer, type Entry } from './phase5-data'
import type { WorkerPayment } from './phase4-data'
import type { IndividualCompensation } from './phase45-data'
import type { GroupHarvest, WorkerEarning } from './phase3-data'

export type ReportData={
 workers:Worker[];days:WorkDay[];attendances:Attendance[];
 groups:HarvestGroup[];harvests:GroupHarvest[];groupEarnings:WorkerEarning[];
 individual:IndividualCompensation[];payments:WorkerPayment[];
 buyers:Buyer[];ledger:Entry[]
}
function db(){if(!supabase)throw Error('Connexion Supabase indisponible.');return supabase}
async function pages<T>(table:string,fields:string,order='id'):Promise<T[]>{
 const result:T[]=[]
 for(let start=0;;start+=500){
  let query=db().from(table).select(fields).order(order)
  if(table==='worker_earnings')query=query.order('worker_id')
  const {data,error}=await query.range(start,start+499)
  if(error)throw Error(error.message)
  const rows=(data??[]) as T[]
  result.push(...rows)
  if(rows.length<500)return result
  if(result.length>=50000)throw Error('Rapport volumineux : trop de lignes à exporter.')
 }
}
export async function fetchReportData():Promise<ReportData>{
 const [workers,days,attendances,groups,harvests,groupEarnings,individual,payments,buyers,ledger]=await Promise.all([
  listWorkers(),
  pages<WorkDay>('work_days','id,work_date,notes'),
  pages<Attendance>('attendances','id,work_day_id,worker_id,group_id'),
  pages<HarvestGroup>('harvest_groups','id,work_day_id,name'),
  pages<GroupHarvest>('group_harvests','id,work_day_id,group_id,sacks,rate_cents,total_cents'),
  pages<WorkerEarning>('worker_earnings','harvest_id,worker_id,amount_cents','harvest_id'),
  pages<IndividualCompensation>('worker_day_compensations','id,work_day_id,worker_id,mode,quantity,rate_cents,amount_cents'),
  pages<WorkerPayment>('worker_payments','id,worker_id,payment_date,kind,amount_cents,note,reversal_of,recorded_at'),
  listBuyers(),
  listLedger()
 ])
 return {workers,days,attendances,groups,harvests,groupEarnings,individual,payments,buyers,ledger}
}
