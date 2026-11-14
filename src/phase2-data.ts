import { supabase } from './supabase'

export type Worker = {
  id: string
  full_name: string
  phone: string | null
  notes: string | null
  is_active: boolean
}
export type WorkDay = { id: string; work_date: string; notes: string | null }
export type HarvestGroup = { id: string; work_day_id: string; name: string }
export type Attendance = { id: string; work_day_id: string; worker_id: string; group_id: string | null }

function db() {
  if (!supabase) throw Error('Connexion Supabase non configurée.')
  return supabase
}
function assertResult<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw Error(result.error.message)
  return result.data
}
export async function listWorkers(): Promise<Worker[]> {
  return assertResult(await db().from('workers').select('id,full_name,phone,notes,is_active').order('full_name')) as Worker[]
}
export async function addWorker(input: { full_name: string; phone: string | null; notes: string | null }): Promise<void> {
  assertResult(await db().from('workers').insert(input).select('id').single())
}
export async function editWorker(id: string, input: { full_name: string; phone: string | null; notes: string | null; is_active: boolean }): Promise<void> {
  assertResult(await db().from('workers').update(input).eq('id', id).select('id').single())
}
export async function getDay(date: string): Promise<WorkDay | null> {
  const { data, error } = await db().from('work_days').select('id,work_date,notes').eq('work_date', date).maybeSingle()
  if (error) throw Error(error.message)
  return data as WorkDay | null
}
export async function ensureDay(date: string): Promise<WorkDay> {
  const existing = await getDay(date)
  if (existing) return existing
  const { data, error } = await db().from('work_days').insert({ work_date: date }).select('id,work_date,notes').single()
  if (error) {
    // A parallel request may have created today's row first.
    if (error.code === '23505') {
      const winner = await getDay(date)
      if (winner) return winner
    }
    throw Error(error.message)
  }
  return data as WorkDay
}
export async function listGroups(dayId: string): Promise<HarvestGroup[]> {
  return assertResult(await db().from('harvest_groups').select('id,work_day_id,name').eq('work_day_id', dayId).order('created_at')) as HarvestGroup[]
}
export async function createGroup(dayId: string, name: string): Promise<void> {
  assertResult(await db().from('harvest_groups').insert({ work_day_id: dayId, name }).select('id').single())
}
export async function renameGroup(id: string, name: string): Promise<void> {
  assertResult(await db().from('harvest_groups').update({ name }).eq('id', id).select('id').single())
}
export async function deleteEmptyGroup(id: string): Promise<void> {
  const { count, error } = await db().from('attendances').select('id', { count: 'exact', head: true }).eq('group_id', id)
  if (error) throw Error(error.message)
  if (count) throw Error('Déplace d’abord les ouvriers affectés à ce groupe.')
  assertResult(await db().from('harvest_groups').delete().eq('id', id).select('id').single())
}
export async function listAttendance(dayId: string): Promise<Attendance[]> {
  return assertResult(await db().from('attendances').select('id,work_day_id,worker_id,group_id').eq('work_day_id', dayId)) as Attendance[]
}
export async function markPresent(dayId: string, workerId: string): Promise<void> {
  assertResult(await db().from('attendances').insert({ work_day_id: dayId, worker_id: workerId }).select('id').single())
}
export async function markAbsent(attendanceId: string): Promise<void> {
  assertResult(await db().from('attendances').delete().eq('id', attendanceId).select('id').single())
}
export async function assignGroup(attendanceId: string, groupId: string | null): Promise<void> {
  assertResult(await db().from('attendances').update({ group_id: groupId }).eq('id', attendanceId).select('id').single())
}
