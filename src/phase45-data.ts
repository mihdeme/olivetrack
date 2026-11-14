import { supabase } from './supabase'

export type IndividualMode = 'daily' | 'individual_sacks'
export type IndividualCompensation = {
  id:string; work_day_id:string; worker_id:string; mode:IndividualMode
  quantity:number; rate_cents:number; amount_cents:number
}
function db(){if(!supabase)throw Error('Supabase non configuré');return supabase}

export async function listIndividualCompensations(dayId:string): Promise<IndividualCompensation[]> {
  const {data,error}=await db().from('worker_day_compensations')
    .select('id,work_day_id,worker_id,mode,quantity,rate_cents,amount_cents')
    .eq('work_day_id',dayId)
  if(error)throw Error(error.message)
  return (data??[]) as IndividualCompensation[]
}
export async function listAllIndividualCompensations():Promise<IndividualCompensation[]>{
  const output:IndividualCompensation[]=[]
  for(let i=0;;i+=500){
    const {data,error}=await db().from('worker_day_compensations')
      .select('id,work_day_id,worker_id,mode,quantity,rate_cents,amount_cents')
      .order('id').range(i,i+499)
    if(error)throw Error(error.message)
    output.push(...((data??[]) as IndividualCompensation[]))
    if(!data || data.length<500)return output
    if(output.length>=50000)throw Error('Historique trop volumineux.')
  }
}
export async function saveIndividualCompensation(input:{
  dayId:string;workerId:string;mode:IndividualMode;quantity:number;rateCents:number
}):Promise<void>{
 const {error}=await db().rpc('save_individual_compensation',{
  p_day_id:input.dayId,p_worker_id:input.workerId,p_mode:input.mode,
  p_quantity:input.quantity,p_rate_cents:input.rateCents
 })
 if(error)throw Error(error.message)
}
export async function bulkAttendance(input:{
  dayId:string;workerIds:string[];action:'present'|'absent'|'assign';groupId?:string|null
}):Promise<void>{
 const {error}=await db().rpc('bulk_attendance',{
  p_day_id:input.dayId,p_worker_ids:input.workerIds,p_action:input.action,
  p_group_id:input.groupId??null
 })
 if(error)throw Error(error.message)
}

export type DayStatus = 'absent' | 'unassigned' | 'group' | IndividualMode

export async function changeWorkerDayStatus(input:{
  dayId:string;workerId:string;status:DayStatus
  groupId:string|null; quantity:number|null; rateCents:number|null
}):Promise<void>{
 const {error}=await db().rpc('change_worker_day_status',{
  p_day_id:input.dayId,
  p_worker_id:input.workerId,
  p_status:input.status,
  p_group_id:input.groupId,
  p_quantity:input.quantity,
  p_rate_cents:input.rateCents,
 })
 if(error)throw Error(error.message)
}
