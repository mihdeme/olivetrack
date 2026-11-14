import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRightLeft, Check, LockKeyhole, X } from 'lucide-react'
import { money, parseRateCents, parseSacks } from './phase3-data'
import type { Worker, Attendance, HarvestGroup, WorkDay } from './phase2-data'
import type { IndividualCompensation } from './phase45-data'
import { changeWorkerDayStatus, type DayStatus } from './phase45-data'

type Props = {
 worker:Worker; day:WorkDay; attendance?:Attendance; individual?:IndividualCompensation
 groups:HarvestGroup[]; lockedGroupIds:string[]
 onClose:()=>void; onSaved:()=>Promise<void>
}
function currentStatus(attendance?:Attendance, individual?:IndividualCompensation):DayStatus {
 if(!attendance)return 'absent'
 if(individual)return individual.mode
 if(attendance.group_id)return 'group'
 return 'unassigned'
}
const names:Record<DayStatus,string>={
 absent:'Absent',
 unassigned:'Présent · sans rémunération',
 group:'Collectif au sac · groupe',
 daily:'Payé à la journée',
 individual_sacks:'Individuel au sac',
}
export function WorkerStatusSheet({worker,day,attendance,individual,groups,lockedGroupIds,onClose,onSaved}:Props){
 const initial = currentStatus(attendance,individual)
 const [status,setStatus]=useState<DayStatus>(initial)
 const [groupId,setGroupId]=useState(attendance?.group_id??'')
 const [quantity,setQuantity]=useState(String(individual?.quantity??1))
 const [rate,setRate]=useState(String((individual?.rate_cents??(initial==='individual_sacks'?10000:12000))/100))
 const [pending,setPending]=useState(false)
 const [error,setError]=useState('')
 const originalGroupLocked=Boolean(attendance?.group_id && lockedGroupIds.includes(attendance.group_id))
 const targetGroupLocked=Boolean(status==='group' && groupId && lockedGroupIds.includes(groupId))
 const changed = status!==initial ||
   (status==='group'&&groupId!==(attendance?.group_id??'')) ||
   ((status==='daily'||status==='individual_sacks') &&
     (parseRateCents(rate)!==individual?.rate_cents || (status==='individual_sacks' && parseSacks(quantity)!==individual?.quantity)))
 const qty=status==='daily'?1:status==='individual_sacks'?parseSacks(quantity):null
 const rateCents=status==='daily'||status==='individual_sacks'?parseRateCents(rate):null
 const projected=status==='daily'||status==='individual_sacks'?(qty!==null && rateCents!==null ? qty*rateCents:null):null
 const previous=individual?.amount_cents??0
 const invalid=Boolean((status==='group'&&!groupId) || (status==='individual_sacks' && (qty===null||qty<1)) || ((status==='daily'||status==='individual_sacks')&&rateCents===null))
 const otherGroup=attendance?.group_id!==groupId || status!=='group'
 const locked=Boolean((originalGroupLocked && otherGroup) || (targetGroupLocked && (!attendance?.group_id || attendance.group_id!==groupId)))
 useEffect(()=>{
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!pending)onClose()}
  window.addEventListener('keydown',close)
  return()=>window.removeEventListener('keydown',close)
 },[onClose,pending])
 function chooseMode(next:DayStatus){
  setStatus(next);setError('')
  if(next==='daily' && initial!=='daily')setRate('120')
  if(next==='individual_sacks' && initial!=='individual_sacks')setRate('100')
 }
 async function submit(e:FormEvent){
  e.preventDefault()
  if(!changed||invalid||pending)return
  if(locked){setError('Cette récolte collective est déjà comptabilisée. Il faut d’abord corriger les sacs de ce groupe dans Gains.');return}
  const delta=projected===null?-previous:projected-previous
  const message = [
   `Changer le statut de ${worker.full_name} pour le ${day.work_date} ?`,
   `${names[initial]} → ${names[status]}`,
   ...(individual?[ `Ancien gain individuel : ${money(previous)}`]:[]),
   ...(projected!==null?[`Nouveau gain individuel : ${money(projected)}`]:[]),
   ...(delta!==0?[`Variation du gain individuel : ${delta>0?'+':'−'}${money(Math.abs(delta))}`]:[]),
   'Les paiements déjà effectués ne seront pas modifiés. Le solde restant sera recalculé.',
  ].join('\n')
  if(!window.confirm(message))return
  setPending(true);setError('')
  try{
   await changeWorkerDayStatus({
    dayId:day.id,workerId:worker.id,status,
    groupId:status==='group'?groupId:null,
    quantity:qty,rateCents:rateCents
   })
   await onSaved()
   onClose()
  }catch(e){setError(e instanceof Error?e.message:'Changement impossible.')}
  finally{setPending(false)}
 }
 return <div className="field-sheet-layer" onClick={()=>!pending&&onClose()} role="presentation">
  <section className="field-sheet field-status-sheet" role="dialog" aria-modal="true" aria-labelledby="status-sheet-name" onClick={e=>e.stopPropagation()}>
   <div className="field-sheet-handle"/>
   <div className="field-sheet-heading">
    <div><span className="field-kicker">MODIFIER LA JOURNÉE · {day.work_date}</span><h3 id="status-sheet-name">{worker.full_name}</h3></div>
    <button className="field-icon" onClick={onClose} disabled={pending} aria-label="Fermer"><X size={19}/></button>
   </div>
   <form onSubmit={e=>void submit(e)} className="field-sheet-form">
    <label>Statut de cet ouvrier
     <select value={status} onChange={e=>chooseMode(e.target.value as DayStatus)}>
      <option value="absent">Absent</option>
      <option value="unassigned">Présent · sans rémunération</option>
      <option value="group">Collectif au sac · groupe</option>
      <option value="daily">À la journée</option>
      <option value="individual_sacks">Individuel au sac</option>
     </select>
    </label>
    {status==='group'&&<label>Groupe
     <select value={groupId} required onChange={e=>setGroupId(e.target.value)}>
      <option value="">Choisir un groupe</option>
      {groups.map(g=><option key={g.id} value={g.id}>{g.name}{lockedGroupIds.includes(g.id)?' · récolte enregistrée':''}</option>)}
     </select>
    </label>}
    {status==='individual_sacks'&&<label>Sacs individuels
     <input type="number" inputMode="numeric" min="1" max="100000" value={quantity} required onChange={e=>setQuantity(e.target.value)}/>
    </label>}
    {(status==='individual_sacks'||status==='daily')&&<label>{status==='daily'?'Tarif journalier (DH)':'Tarif par sac (DH)'}
      <input inputMode="decimal" required value={rate} onChange={e=>setRate(e.target.value)}/>
    </label>}
    {projected!==null&&<div className="field-sheet-preview"><span>Nouveau gain individuel</span><strong>{money(projected)}</strong></div>}
    {initial==='group'&&<div className="field-status-note"><ArrowRightLeft size={17}/> La rémunération collective dépend des sacs du groupe et de tous ses membres. Le montant sera recalculé lors de sa saisie.</div>}
    {locked&&<div className="field-status-locked"><LockKeyhole size={18}/><span>Récolte collective déjà enregistrée : corrige d’abord les sacs de ce groupe dans l’onglet Gains pour libérer la modification.</span></div>}
    {individual&&<p className="field-status-note">Gain actuel : {money(individual.amount_cents)}. Le changement remplace ce gain, sans toucher aux versements déjà enregistrés.</p>}
    {error&&<p className="data-error" role="alert">{error}</p>}
    <button type="submit" className="field-primary" disabled={!changed||invalid||locked||pending}><Check size={18}/> {pending?'Enregistrement…':'Confirmer le changement'}</button>
   </form>
  </section>
 </div>
}
