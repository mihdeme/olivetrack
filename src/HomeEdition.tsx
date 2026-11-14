import { useEffect, useState } from 'react'
import { ArrowRight, ClipboardCheck, Layers3, UsersRound, Wallet } from 'lucide-react'
import { listWorkers } from './phase2-data'
import { readPayroll } from './phase4-data'
import { money } from './phase3-data'
import { supabase } from './supabase'

type Summary={workers:number;active:number;groupSacks:number;individualSacks:number;earned:number;paid:number;due:number}
export function HomeEdition({onNavigate}:{onNavigate:(screen:'recolte'|'ouvriers')=>void}){
 const [stats,setStats]=useState<Summary|null>(null)
 const [error,setError]=useState('')
 useEffect(()=>{
  let live=true
  async function allRows(table:'group_harvests'|'worker_day_compensations',columns:string){
   if(!supabase)throw Error('Supabase non configuré')
   const rows:{sacks?:number;mode?:string;quantity?:number}[]=[]
   for(let start=0;;start+=500){
    const {data,error}=await supabase.from(table).select(columns).order('id').range(start,start+499)
    if(error)throw Error(error.message)
    rows.push(...((data??[]) as unknown as {sacks?:number;mode?:string;quantity?:number}[]))
    if(!data || data.length<500)return rows
    if(rows.length>=50000)throw Error('Historique trop volumineux.')
   }
  }
  async function load(){
   if(!supabase)throw Error('Supabase non configuré')
   const [workers,payroll,group,individual]=await Promise.all([
    listWorkers(),readPayroll(),
    allRows('group_harvests','id,sacks'),
    allRows('worker_day_compensations','id,mode,quantity')
   ])
   const earned=payroll.earnings.reduce((sum,row)=>sum+row.amount_cents,0)
   const paid=payroll.payments.reduce((sum,row)=>sum+row.amount_cents,0)
   if(live)setStats({
    workers:workers.length,active:workers.filter(w=>w.is_active).length,
    groupSacks:group.reduce((sum,row)=>sum+(row.sacks??0),0),
    individualSacks:individual.filter(row=>row.mode==='individual_sacks').reduce((sum,row)=>sum+(row.quantity??0),0),
    earned,paid,due:earned-paid
   })
  }
  void load().catch(e=>{if(live)setError(e instanceof Error?e.message:'Chargement impossible')})
  return()=>{live=false}
 },[])
 return <div className="field-home">
  <div className="field-home-intro"><span className="field-kicker">VUE D'ENSEMBLE</span><h2>La récolte, en un regard.</h2><p>Chiffres réels de ta campagne. Chaque action importante est accessible directement.</p></div>
  {error&&<p className="data-error">{error}</p>}
  {!stats?<div className="field-empty">Chargement des indicateurs…</div>:<>
   <section className="field-home-cards">
    <div><span>Ouvriers actifs</span><strong>{stats.active}<small> / {stats.workers}</small></strong><UsersRound size={18}/></div>
    <div><span>Sacs comptabilisés</span><strong>{stats.groupSacks+stats.individualSacks}</strong><Layers3 size={18}/></div>
    <div><span>Rémunération acquise</span><strong>{money(stats.earned)}</strong><ClipboardCheck size={18}/></div>
    <div><span>Reste à payer</span><strong>{money(stats.due)}</strong><Wallet size={18}/></div>
   </section>
   <div className="field-home-note">Reste à payer = gains acquis − sommes versées nettes. Un solde négatif correspond à des avances.</div>
  </>}
  <div className="field-home-cta"><span className="field-kicker">ACTIONS RAPIDES</span>
   <button onClick={()=>onNavigate('recolte')}><span><ClipboardCheck size={19}/> Ouvrir la journée</span><ArrowRight size={18}/></button>
   <button onClick={()=>onNavigate('ouvriers')}><span><UsersRound size={19}/> Ouvriers et paiements</span><ArrowRight size={18}/></button>
  </div>
  <p className="field-home-end">Les ventes, pesées et dépenses seront intégrées à l'étape 5.</p>
 </div>
}
