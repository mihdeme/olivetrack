import { supabase } from './supabase'

export type PaymentKind = 'advance' | 'weekly' | 'partial' | 'final' | 'reversal'
export type WorkerPayment = {
  id: string
  worker_id: string
  payment_date: string
  kind: PaymentKind
  amount_cents: number
  note: string
  reversal_of: string | null
  recorded_at: string
}
export type WorkerEarning = { worker_id: string; amount_cents: number }

export const paymentLabels: Record<PaymentKind,string> = {
  advance:'Avance',
  weekly:'Paie du mercredi',
  partial:'Versement partiel',
  final:'Solde de départ',
  reversal:'Annulation',
}

function db() { if (!supabase) throw Error('Connexion Supabase non configurée.'); return supabase }

export function parsePaymentCents(raw: string): number | null {
  const text = raw.trim().replace(',', '.')
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text)) return null
  const [major, decimals = ''] = text.split('.')
  const result = Number(major)*100 + Number(decimals.padEnd(2,'0'))
  return Number.isSafeInteger(result) && result >= 1 && result <= 1000000000 ? result : null
}

async function allPages<T>(table: 'worker_payments' | 'worker_earnings', columns: string): Promise<T[]> {
  const result: T[] = []
  for (let start=0; ;start += 500) {
    const query = db().from(table).select(columns)
    const ordered = table === 'worker_payments' ? query.order('id') : query.order('harvest_id').order('worker_id')
    const { data, error } = await ordered.range(start,start+499)
    if (error) throw Error(error.message)
    const page = (data ?? []) as T[]
    result.push(...page)
    if (page.length < 500) return result
    if (result.length >= 50000) throw Error('Historique trop volumineux : contactez le support.')
  }
}

export async function readPayroll(): Promise<{payments:WorkerPayment[];earnings:WorkerEarning[]}> {
  const [payments, groupEarnings, individualEarnings] = await Promise.all([
    allPages<WorkerPayment>('worker_payments','id,worker_id,payment_date,kind,amount_cents,note,reversal_of,recorded_at'),
    allPages<WorkerEarning>('worker_earnings','worker_id,amount_cents'),
    allPages<WorkerEarning>('worker_day_compensations','worker_id,amount_cents')
  ])
  payments.sort((a,b) => b.payment_date.localeCompare(a.payment_date) || b.recorded_at.localeCompare(a.recorded_at))
  return { payments, earnings: [...groupEarnings,...individualEarnings] }
}

export function summarizeWorker(workerId:string, earnings:WorkerEarning[], payments:WorkerPayment[]) {
  const earned = earnings.filter(x=>x.worker_id===workerId).reduce((sum,row)=>sum+row.amount_cents,0)
  const paid = payments.filter(x=>x.worker_id===workerId).reduce((sum,row)=>sum+row.amount_cents,0)
  return { earned,paid,due:earned-paid }
}

export async function recordPayment(input:{
  workerId:string
  amountCents:number
  kind:Exclude<PaymentKind,'reversal'>
  date:string
  note:string
  requestId:string
}) {
  const { error } = await db().rpc('record_worker_payment',{
    p_worker_id:input.workerId,
    p_amount_cents:input.amountCents,
    p_kind:input.kind,
    p_payment_date:input.date,
    p_note:input.note,
    p_request_id:input.requestId,
  })
  if (error) throw Error(error.message)
}
export async function reversePayment(input:{paymentId:string;note:string;requestId:string}) {
  const { error } = await db().rpc('reverse_worker_payment',{
    p_payment_id:input.paymentId,
    p_note:input.note,
    p_request_id:input.requestId,
  })
  if (error) throw Error(error.message)
}
