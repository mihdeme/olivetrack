import { supabase } from './supabase'

export type GroupHarvest = {
  id: string
  work_day_id: string
  group_id: string
  sacks: number
  rate_cents: number
  total_cents: number
}
export type WorkerEarning = {
  harvest_id: string
  worker_id: string
  amount_cents: number
}

function db() {
  if (!supabase) throw Error('Connexion Supabase non configurée.')
  return supabase
}

export function money(cents: number): string {
  return (cents / 100).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH'
}

export function parseRateCents(raw: string): number | null {
  const text = raw.trim().replace(',', '.')
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(text)) return null
  const [major, minor = ''] = text.split('.')
  const value = Number(major) * 100 + Number(minor.padEnd(2, '0'))
  return Number.isSafeInteger(value) && value >= 1 && value <= 1000000 ? value : null
}
export function parseSacks(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 0 && value <= 100000 ? value : null
}

export async function getHarvestForDay(dayId: string): Promise<{harvests: GroupHarvest[]; earnings: WorkerEarning[]}> {
  const { data: harvests, error } = await db().from('group_harvests')
    .select('id,work_day_id,group_id,sacks,rate_cents,total_cents').eq('work_day_id', dayId)
  if (error) throw Error(error.message)
  const ids = (harvests ?? []).map(h => h.id)
  if (ids.length === 0) return { harvests: [], earnings: [] }
  const { data: earnings, error: earningsError } = await db().from('worker_earnings')
    .select('harvest_id,worker_id,amount_cents').in('harvest_id', ids)
  if (earningsError) throw Error(earningsError.message)
  return { harvests: (harvests ?? []) as GroupHarvest[], earnings: (earnings ?? []) as WorkerEarning[] }
}

export async function getAllEarnings(): Promise<WorkerEarning[]> {
  // Supabase limits normal REST selects to the configured maximum row count
  // (often 1000). At 90 workers that limit is crossed after a few harvest days.
  const result: WorkerEarning[] = []
  for (let offset=0;;offset+=500) {
    const {data,error}=await db().from('worker_earnings')
      .select('harvest_id,worker_id,amount_cents')
      .order('harvest_id').order('worker_id').range(offset,offset+499)
    if (error) throw Error(error.message)
    const page=(data??[]) as WorkerEarning[]
    result.push(...page)
    if (page.length<500) return result
    if (result.length>=50000) throw Error('Historique des rémunérations trop volumineux.')
  }
}

export async function saveHarvest(groupId: string, sacks: number, rateCents: number): Promise<void> {
  const { error } = await db().rpc('save_group_harvest', {
    p_group_id: groupId, p_sacks: sacks, p_rate_cents: rateCents,
  })
  if (error) throw Error(error.message)
}
