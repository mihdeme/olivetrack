import { supabase } from './supabase'
import { listWorkers, type Worker } from './phase2-data'
import { listBuyers, listLedger, type Buyer, type Entry } from './phase5-data'
import { readPayroll, type WorkerPayment } from './phase4-data'

export type ReportKind='payroll'|'harvest'|'buyers'|'finance'
export type Day={id:string;work_date:string}
export type Group={id:string;work_day_id:string;name:string}
export type AttendanceRow={work_day_id:string;worker_id:string;group_id:string|null}
export type Harvest={id:string;work_day_id:string;group_id:string;sacks:number;rate_cents:number;total_cents:number}
export type GroupEarning={harvest_id:string;worker_id:string;amount_cents:number}
export type Individual={work_day_id:string;worker_id:string;mode:string;quantity:number;rate_cents:number;amount_cents:number}
export type ReportData={
 workers:Worker[];buyers:Buyer[];ledger:Entry[];payments:WorkerPayment[];
 days:Day[];groups:Group[];attendances:AttendanceRow[];
 harvests:Harvest[];groupEarnings:GroupEarning[];individual:Individual[]
}
function db(){if(!supabase)throw Error('Supabase non configuré.');return supabase}
type Table='work_days'|'harvest_groups'|'attendances'|'group_harvests'|'worker_earnings'|'worker_day_compensations'
async function pages<T>(table:Table,columns:string,sort:string):Promise<T[]>{
 const result:T[]=[]
 for(let offset=0;;offset+=500){
  const {data,error}=await db().from(table).select(columns).order(sort).range(offset,offset+499)
  if(error)throw Error(error.message)
  const rows=(data??[]) as T[]
  result.push(...rows)
  if(rows.length<500)return result
  if(result.length>50000)throw Error('Trop de lignes : choisis une période plus courte.')
 }
}
export async function readReportData():Promise<ReportData>{
 const [workers,buyers,ledger,payroll,days,groups,attendances,harvests,groupEarnings,individual]=await Promise.all([
  listWorkers(),listBuyers(),listLedger(),readPayroll(),
  pages<Day>('work_days','id,work_date','id'),
  pages<Group>('harvest_groups','id,work_day_id,name','id'),
  pages<AttendanceRow>('attendances','work_day_id,worker_id,group_id','id'),
  pages<Harvest>('group_harvests','id,work_day_id,group_id,sacks,rate_cents,total_cents','id'),
  pages<GroupEarning>('worker_earnings','harvest_id,worker_id,amount_cents','harvest_id'),
  pages<Individual>('worker_day_compensations','work_day_id,worker_id,mode,quantity,rate_cents,amount_cents','id'),
 ])
 return {workers,buyers,ledger,payments:payroll.payments,days,groups,attendances,harvests,groupEarnings,individual}
}
export function period(date:string,start:string,end:string){return date>=start&&date<=end}
export function isoToday(){
 const d=new Date()
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
}
export function formatDate(date:string){
 return new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})
}

export function payrollRows(data:ReportData,start:string,end:string){
 const daysById=new Map(data.days.map(d=>[d.id,d.work_date]))
 const harvestById=new Map(data.harvests.map(h=>[h.id,h]))
 const earned=new Map<string,{before:number;during:number}>()
 const paid=new Map<string,{before:number;during:number}>()
 const add=(map:Map<string,{before:number;during:number}>,workerId:string,date:string,amount:number)=>{
  if(date>end)return
  const previous=map.get(workerId)??{before:0,during:0}
  if(date<start)previous.before+=amount
  else previous.during+=amount
  map.set(workerId,previous)
 }
 for(const e of data.groupEarnings){
  const harvest=harvestById.get(e.harvest_id)
  const date=harvest?daysById.get(harvest.work_day_id):undefined
  if(date)add(earned,e.worker_id,date,e.amount_cents)
 }
 for(const e of data.individual){
  const date=daysById.get(e.work_day_id)
  if(date)add(earned,e.worker_id,date,e.amount_cents)
 }
 for(const p of data.payments)add(paid,p.worker_id,p.payment_date,p.amount_cents)
 return data.workers.map(w=>{
  const e=earned.get(w.id)??{before:0,during:0}
  const p=paid.get(w.id)??{before:0,during:0}
  return {id:w.id,name:w.full_name,opening:e.before-p.before,earned:e.during,paid:p.during,closing:e.before-p.before+e.during-p.during}
 }).filter(r=>r.opening!==0||r.earned!==0||r.paid!==0||r.closing!==0)
  .sort((a,b)=>a.name.localeCompare(b.name,'fr'))
}
export function harvestRows(data:ReportData,start:string,end:string){
 const dayIds=new Set(data.days.filter(d=>period(d.work_date,start,end)).map(d=>d.id))
 const dates=new Map(data.days.map(d=>[d.id,d.work_date]))
 const groupById=new Map(data.groups.map(g=>[g.id,g]))
 const harvested=data.harvests.filter(h=>dayIds.has(h.work_day_id)).map(h=>({
  date:dates.get(h.work_day_id)??'',label:groupById.get(h.group_id)?.name??'Groupe archivé',
  mode:'Collectif au sac',sacks:h.sacks,amount:h.total_cents,
 }))
 const solo=data.individual.filter(i=>dayIds.has(i.work_day_id)).map(i=>({
  date:dates.get(i.work_day_id)??'',label:data.workers.find(w=>w.id===i.worker_id)?.full_name??'Ouvrier archivé',
  mode:i.mode==='daily'?'À la journée':'Individuel au sac',
  sacks:i.mode==='individual_sacks'?i.quantity:0,amount:i.amount_cents,
 }))
 return [...harvested,...solo].sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label,'fr'))
}
export function buyerRows(data:ReportData,start:string,end:string){
 return data.buyers.map(b=>{
  const entries=data.ledger.filter(l=>l.buyer_id===b.id&&l.entry_date<=end)
  const sums=(names:string[],filter:(date:string)=>boolean)=>entries.filter(l=>names.includes(l.kind)&&filter(l.entry_date)).reduce((v,l)=>v+l.amount_cents,0)
  const sales=['sale','sale_reversal'],receipts=['receipt','receipt_reversal']
  return {name:b.name,opening:sums(sales,d=>d<start)-sums(receipts,d=>d<start),
   sold:sums(sales,d=>d>=start),received:sums(receipts,d=>d>=start),
   closing:sums(sales,()=>true)-sums(receipts,()=>true)}
 }).filter(b=>b.opening!==0||b.sold!==0||b.received!==0||b.closing!==0)
  .sort((a,b)=>a.name.localeCompare(b.name,'fr'))
}
export function financeRows(data:ReportData,start:string,end:string){
 const rows:{date:string;kind:string;detail:string;sales:number;received:number;expense:number;wages:number}[]=data.ledger.filter(x=>period(x.entry_date,start,end))
  .map(e=>({
   date:e.entry_date,kind:e.kind,detail:e.buyer_id?data.buyers.find(b=>b.id===e.buyer_id)?.name??'Acheteur supprimé':
    e.category??'Dépense',
   sales:e.kind.startsWith('sale')?e.amount_cents:0,
   received:e.kind.startsWith('receipt')?e.amount_cents:0,
   expense:e.kind.startsWith('expense')?e.amount_cents:0,
   wages:0,
  }))
 const names=new Map(data.workers.map(w=>[w.id,w.full_name]))
 for(const p of data.payments.filter(p=>period(p.payment_date,start,end))){
  rows.push({date:p.payment_date,kind:p.kind,detail:names.get(p.worker_id)??'Ouvrier archivé',
   sales:0,received:0,expense:0,wages:p.amount_cents})
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.detail.localeCompare(b.detail,'fr'))
}
