import { supabase } from './supabase'

export type Buyer = {id:string;name:string;phone:string|null;notes:string|null;is_active:boolean}
export type EntryKind='sale'|'receipt'|'expense'|'sale_reversal'|'receipt_reversal'|'expense_reversal'
export type Entry = {
 id:string;kind:EntryKind;entry_date:string;buyer_id:string|null;harvest_date:string|null
 sacks:number|null;weight_grams:number|null;unit_price_cents:number|null;amount_cents:number
 category:string|null;method:string|null;reference:string;note:string;reversal_of:string|null;created_at:string
}
export type ExpenseCategory='transport'|'fuel'|'equipment'|'maintenance'|'food'|'other'
export type PaymentMethod='cash'|'bank'|'other'
export type NewEntry = {
 kind:'sale'|'receipt'|'expense';date:string;buyerId:string|null;weightGrams:number|null;priceCents:number|null
 sacks:number|null;harvestDate:string|null;amountCents:number|null;category:ExpenseCategory|null
 method:PaymentMethod|null;reference:string;note:string;requestId:string
}

const getDB=()=>{if(!supabase)throw Error('Service non configuré.');return supabase}
export const categoryLabels:Record<ExpenseCategory,string>={
 transport:'Transport',fuel:'Carburant',equipment:'Matériel',maintenance:'Entretien',food:'Repas / ravitaillement',other:'Autres charges'
}
export const methodLabels:Record<PaymentMethod,string>={cash:'Espèces',bank:'Banque',other:'Autre moyen'}
export const kindLabels:Record<EntryKind,string>={
 sale:'Bon de pesée',receipt:'Encaissement',expense:'Dépense',
 sale_reversal:'Annulation de vente',receipt_reversal:'Annulation d’encaissement',expense_reversal:'Annulation de dépense'
}
export function parseFixed(raw:string,scale:number,maxScaled:number):number|null{
 const value=raw.trim().replace(',','.')
 const decimals=String(scale).length-1
 const regex=new RegExp('^\\d{1,9}(?:\\.\\d{1,'+decimals+'})?$')
 if(!regex.test(value))return null
 const [whole,frac='']=value.split('.')
 const result=Number(whole)*scale+Number(frac.padEnd(decimals,'0'))
 return Number.isSafeInteger(result)&&result>0&&result<=maxScaled?result:null
}
export const parseKg=(raw:string)=>parseFixed(raw,1000,1000000000)
export const parseDh=(raw:string)=>parseFixed(raw,100,1000000000000)
export const formatKg=(grams:number)=> (grams/1000).toLocaleString('fr-MA',{minimumFractionDigits:0,maximumFractionDigits:3})+' kg'
export const expectedSale=(grams:number,priceCents:number)=>Math.round(grams*priceCents/1000)

export async function listBuyers():Promise<Buyer[]>{
 const result:Buyer[]=[]
 for(let offset=0;;offset+=500){
  const {data,error}=await getDB().from('olives_buyers').select('id,name,phone,notes,is_active').order('name').range(offset,offset+499)
  if(error)throw Error(error.message)
  result.push(...(data??[]) as Buyer[])
  if((data??[]).length<500)return result
  if(result.length>=50000)throw Error('Liste d’acheteurs trop importante.')
 }
}
export async function saveBuyer(input:{id?:string;name:string;phone:string|null;notes:string|null;is_active:boolean}):Promise<string>{
 const payload={name:input.name,phone:input.phone,notes:input.notes,is_active:input.is_active}
 if(input.id){
  const {data,error}=await getDB().from('olives_buyers').update(payload).eq('id',input.id).select('id').single()
  if(error)throw Error(error.message)
  return data.id
 }else{
  const {data,error}=await getDB().from('olives_buyers').insert(payload).select('id').single()
  if(error)throw Error(error.message)
  return data.id
 }
}
export async function listLedger():Promise<Entry[]>{
 const result:Entry[]=[]
 for(let offset=0;;offset+=500){
  const {data,error}=await getDB().from('campaign_ledger')
   .select('id,kind,entry_date,buyer_id,harvest_date,sacks,weight_grams,unit_price_cents,amount_cents,category,method,reference,note,reversal_of,created_at')
   .order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+499)
  if(error)throw Error(error.message)
  result.push(...(data??[]) as Entry[])
  if((data??[]).length<500)return result
  if(result.length>=50000)throw Error('Journal trop volumineux.')
 }
}
export async function createEntry(entry:NewEntry):Promise<void>{
 const {error}=await getDB().rpc('record_campaign_entry',{
  p_kind:entry.kind,p_entry_date:entry.date,p_buyer_id:entry.buyerId,
  p_weight_grams:entry.weightGrams,p_unit_price_cents:entry.priceCents,
  p_sacks:entry.sacks,p_harvest_date:entry.harvestDate,p_amount_cents:entry.amountCents,
  p_category:entry.category,p_method:entry.method,p_reference:entry.reference,
  p_note:entry.note,p_request_id:entry.requestId
 })
 if(error)throw Error(error.message)
}
export async function reverseEntry(entryId:string,note:string,requestId:string):Promise<void>{
 const {error}=await getDB().rpc('reverse_campaign_entry',{
  p_entry_id:entryId,p_note:note,p_request_id:requestId
 })
 if(error)throw Error(error.message)
}
export function totals(entries:Entry[]){
 const by=(k:string[])=>entries.filter(e=>k.includes(e.kind)).reduce((sum,e)=>sum+e.amount_cents,0)
 const sold=by(['sale','sale_reversal']),received=by(['receipt','receipt_reversal']),
  expenses=by(['expense','expense_reversal'])
 const weight=entries.filter(e=>e.kind==='sale'||e.kind==='sale_reversal').reduce((sum,e)=>sum+(e.weight_grams??0),0)
 const sacks=entries.filter(e=>e.kind==='sale'||e.kind==='sale_reversal').reduce((sum,e)=>sum+(e.sacks??0),0)
 return {sold,received,expenses,weight,sacks,outstanding:sold-received}
}
