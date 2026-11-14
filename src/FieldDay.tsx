import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCheck, ChevronDown, CircleDollarSign, Clock3, Layers3, Plus, Search, Sprout, UsersRound, X } from 'lucide-react'
import { listWorkers, getDay, ensureDay, listGroups, listAttendance, createGroup, assignGroup, type Worker, type WorkDay, type HarvestGroup, type Attendance } from './phase2-data'
import { bulkAttendance, listIndividualCompensations, saveIndividualCompensation, type IndividualCompensation, type IndividualMode } from './phase45-data'
import { HarvestAccounting } from './Phase3'
import { money, parseRateCents, parseSacks } from './phase3-data'
import { getHarvestForDay, type GroupHarvest } from './phase3-data'

type Tab='pointage'|'groupes'|'gains'
type Filter='all'|'present'|'absent'|'unassigned'
const localDate=()=>{
 const d=new Date()
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
}
function adjacentDate(iso:string,days:number){
 const [y,m,d]=iso.split('-').map(Number)
 return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10)
}
function message(e:unknown){return e instanceof Error?e.message:'Une erreur est survenue.'}
function formatDate(s:string){return new Date(s+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}

function PersonPaymentSheet({worker,day,existing,onClose,onSaved}:{
 worker:Worker;day:WorkDay;existing?:IndividualCompensation;onClose:()=>void;onSaved:()=>Promise<void>
}){
 const [mode,setMode]=useState<IndividualMode>(existing?.mode??'daily')
 const [quantity,setQuantity]=useState(String(existing?.quantity??1))
 const [rate,setRate]=useState(String((existing?.rate_cents??12000)/100))
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const q=mode==='daily'?1:parseSacks(quantity)
 const cents=parseRateCents(rate)
 async function submit(e:FormEvent){
  e.preventDefault()
  if(cents===null||q===null||q<1){setError('Saisis une quantité et un tarif valides.');return}
  if(existing&&!window.confirm('Cette correction recalculera les gains de cet ouvrier pour cette date. Confirmer ?'))return
  setBusy(true);setError('')
  try{await saveIndividualCompensation({dayId:day.id,workerId:worker.id,mode,quantity:q,rateCents:cents});await onSaved();onClose()}
  catch(e){setError(message(e))}finally{setBusy(false)}
 }
 async function clear(){
  if(!existing||!window.confirm('Supprimer la rémunération individuelle de cette date ? Le solde de l’ouvrier sera recalculé.'))return
  setBusy(true);setError('')
  try{await saveIndividualCompensation({dayId:day.id,workerId:worker.id,mode:existing.mode,quantity:0,rateCents:existing.rate_cents});await onSaved();onClose()}
  catch(e){setError(message(e))}finally{setBusy(false)}
 }
 return <div className="field-sheet-layer" role="presentation" onClick={onClose}>
   <section className="field-sheet" role="dialog" aria-modal="true" aria-labelledby="pay-sheet-title" onClick={e=>e.stopPropagation()}>
     <div className="field-sheet-handle"/>
     <div className="field-sheet-heading"><div><span className="field-kicker">RÉMUNÉRATION INDIVIDUELLE</span><h3 id="pay-sheet-title">{worker.full_name}</h3></div><button className="field-icon" aria-label="Fermer" onClick={onClose}><X size={19}/></button></div>
     <form onSubmit={submit} className="field-sheet-form">
       <label>Mode de rémunération<select value={mode} onChange={e=>setMode(e.target.value as IndividualMode)}>
         <option value="daily">À la journée</option><option value="individual_sacks">Individuel au sac</option></select></label>
       {mode==='individual_sacks'&&<label>Nombre de sacs<input type="number" min="1" max="100000" inputMode="numeric" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>}
       <label>{mode==='daily'?'Tarif journalier (DH)':'Tarif par sac (DH)'}<input inputMode="decimal" value={rate} required onChange={e=>setRate(e.target.value)}/></label>
       <div className="field-sheet-preview"><span>Total calculé</span><strong>{q!==null&&cents!==null?money(q*cents):'—'}</strong></div>
       {error&&<p className="data-error" role="alert">{error}</p>}
       <button type="submit" disabled={busy||q===null||cents===null} className="field-primary"><Check size={18}/> Enregistrer la rémunération</button>
       {existing&&<button type="button" className="field-destructive" disabled={busy} onClick={()=>void clear()}>Remettre cette rémunération à zéro</button>}
     </form>
   </section>
 </div>
}
export function FieldDay(){
 const [date,setDate]=useState(localDate)
 const [day,setDay]=useState<WorkDay|null>(null)
 const [workers,setWorkers]=useState<Worker[]>([])
 const [groups,setGroups]=useState<HarvestGroup[]>([])
 const [attendance,setAttendance]=useState<Attendance[]>([])
 const [individual,setIndividual]=useState<IndividualCompensation[]>([])
 const [harvests,setHarvests]=useState<GroupHarvest[]>([])
 const [tab,setTab]=useState<Tab>('pointage')
 const [filter,setFilter]=useState<Filter>('all')
 const [search,setSearch]=useState('')
 const [selected,setSelected]=useState<string[]>([])
 const [selectMode,setSelectMode]=useState(false)
 const [groupName,setGroupName]=useState('')
 const [editing,setEditing]=useState<Worker|null>(null)
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const refresh=useCallback(async()=>{
  setLoading(true)
  try{
   const [ws,wd]=await Promise.all([listWorkers(),getDay(date)])
   const [gs,at,ic,ha]=wd?await Promise.all([listGroups(wd.id),listAttendance(wd.id),listIndividualCompensations(wd.id),getHarvestForDay(wd.id).then(x=>x.harvests)]):[[],[],[],[]]
   setWorkers(ws);setDay(wd);setGroups(gs);setAttendance(at);setIndividual(ic);setHarvests(ha);setError('')
  }catch(e){setError(message(e))}finally{setLoading(false)}
 },[date])
 useEffect(()=>{void refresh()},[refresh])
 useEffect(()=>{setSelected([]);setSelectMode(false);setSearch('');setFilter('all')},[date])
 async function perform(task:()=>Promise<void>){
  setBusy(true);setError('')
  try{await task();await refresh();setSelected([])}
  catch(e){setError(message(e))}
  finally{setBusy(false)}
 }
 const activeWorkers=workers.filter(w=>w.is_active||attendance.some(a=>a.worker_id===w.id))
 const presentIds=useMemo(()=>new Set(attendance.map(a=>a.worker_id)),[attendance])
 const groupedIds=useMemo(()=>new Set(attendance.filter(a=>a.group_id).map(a=>a.worker_id)),[attendance])
 const visible=activeWorkers.filter(w=>{
  if(search&&!w.full_name.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')))return false
  if(filter==='present'&&!presentIds.has(w.id))return false
  if(filter==='absent'&&presentIds.has(w.id))return false
  if(filter==='unassigned'&&(!presentIds.has(w.id)||groupedIds.has(w.id)))return false
  return true
 })
 async function changePresence(workerId:string){
  const isPresent=presentIds.has(workerId)
  if(isPresent&&!window.confirm('Retirer la présence de cet ouvrier ? Les rémunérations déjà enregistrées devront d’abord être supprimées.'))return
  await perform(async()=>{
   const target=day??await ensureDay(date)
   await bulkAttendance({dayId:target.id,workerIds:[workerId],action:isPresent?'absent':'present'})
  })
 }
 async function bulk(action:'present'|'absent'|'assign',groupId:string|null=null){
  if(!selected.length)return
  if(action==='absent'&&!window.confirm('Marquer ces ouvriers absents ? Cette action échouera si une rémunération existe déjà.'))return
  await perform(async()=>{
   const target=day??await ensureDay(date)
   await bulkAttendance({dayId:target.id,workerIds:selected,action,groupId})
  })
 }
 async function createNewGroup(e:FormEvent){
  e.preventDefault()
  if(!groupName.trim())return
  await perform(async()=>{const target=day??await ensureDay(date);await createGroup(target.id,groupName.trim());setGroupName('')})
 }
 async function moveWorker(row:Attendance,target:string){
  await perform(()=>assignGroup(row.id,target||null))
 }
 const groupSacks=harvests.reduce((s,h)=>s+h.sacks,0)
 const soloSacks=individual.filter(x=>x.mode==='individual_sacks').reduce((s,x)=>s+x.quantity,0)
 const earningsTotal=harvests.reduce((s,h)=>s+h.total_cents,0)+individual.reduce((s,x)=>s+x.amount_cents,0)
 const individualRows=attendance.filter(a=>!a.group_id).map(a=>({worker:workers.find(w=>w.id===a.worker_id),pay:individual.find(x=>x.worker_id===a.worker_id)})).filter((x):x is {worker:Worker,pay:IndividualCompensation|undefined}=>Boolean(x.worker))
 return <div className="field-day">
  <section className="field-hero">
   <div className="field-hero-top"><span className="field-kicker">CARNET DE CAMPAGNE / JOURNÉE</span><span className="field-status"><span/> En direct</span></div>
   <div className="field-date-row"><button className="field-icon on-dark" onClick={()=>setDate(d=>adjacentDate(d,-1))} aria-label="Jour précédent"><ArrowLeft size={20}/></button>
     <label className="field-date-label"><CalendarDays size={17}/><input aria-label="Date de récolte" type="date" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></label>
     <button className="field-icon on-dark" onClick={()=>setDate(d=>adjacentDate(d,1))} aria-label="Jour suivant"><ArrowRight size={20}/></button></div>
   <h2>{formatDate(date)}</h2>
   <div className="field-hero-stats"><div><span>Présents</span><strong>{attendance.length}<small> / {activeWorkers.length}</small></strong></div><div><span>Sacs enregistrés</span><strong>{groupSacks+soloSacks}</strong></div><div><span>Gains de la journée</span><strong>{money(earningsTotal)}</strong></div></div>
  </section>
  <nav className="field-segments" aria-label="Opérations de la journée">
   {([{id:'pointage',label:'Pointage',icon:CheckCheck},{id:'groupes',label:'Groupes',icon:Layers3},{id:'gains',label:'Gains',icon:CircleDollarSign}] as const).map(t=>{
    const Icon=t.icon;return <button type="button" key={t.id} onClick={()=>{setTab(t.id);setSelected([]);setSelectMode(false)}} className={tab===t.id?'active':''}><Icon size={17}/>{t.label}</button>
   })}
  </nav>
  {error&&<p className="data-error" role="alert">{error}</p>}
  {loading?<div className="field-empty">Synchronisation des données…</div>:tab==='pointage'?<section className="field-panel">
   <div className="field-heading"><div><span className="field-kicker">ÉQUIPE DU JOUR</span><h3>Pointage rapide</h3></div><button className="field-quiet-button" onClick={()=>{setSelectMode(v=>!v);setSelected([])}}>{selectMode?'Terminer':'Sélection multiple'}</button></div>
   <div className="field-search"><Search size={19}/><input type="search" placeholder="Rechercher parmi les ouvriers…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Rechercher un ouvrier"/><span>{visible.length}</span></div>
   <div className="field-filters">{([{id:'all',label:'Tous'},{id:'present',label:'Présents'},{id:'absent',label:'Absents'},{id:'unassigned',label:'Sans groupe'}] as const).map(f=><button key={f.id} onClick={()=>setFilter(f.id)} className={filter===f.id?'active':''}>{f.label}</button>)}</div>
   {selectMode&&<div className="field-bulk-line"><button onClick={()=>setSelected(visible.map(w=>w.id))}>Tout sélectionner ({visible.length})</button><button onClick={()=>setSelected([])}>Effacer</button></div>}
   <div className="field-roster">{visible.map(w=>{
    const row=attendance.find(a=>a.worker_id===w.id)
    const group=groups.find(g=>g.id===row?.group_id)
    const hasPay=individual.some(x=>x.worker_id===w.id)
    return <div className="field-person" key={w.id}>
      <span className="field-avatar">{w.full_name.slice(0,1).toUpperCase()}</span>
      <div className="field-person-name"><strong>{w.full_name}</strong><small>{!row?'Absent':group?.name??(hasPay?'Rémunération individuelle':'Présent · sans groupe')}</small></div>
      {selectMode?<input type="checkbox" aria-label={'Sélectionner '+w.full_name} checked={selected.includes(w.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,w.id]:ids.filter(id=>id!==w.id))}/>:
      <button disabled={busy} className={row?'field-present active':'field-present'} aria-label={(row?'Marquer absent : ':'Marquer présent : ')+w.full_name} onClick={()=>void changePresence(w.id)}>{row?<Check size={18}/>:<Plus size={18}/>}</button>}
    </div>
   })}</div>
   {visible.length===0&&<div className="field-empty">Aucun ouvrier ne correspond à ce filtre.</div>}
   {selectMode&&selected.length>0&&<div className="field-bulk-bar"><strong>{selected.length} sélectionné(s)</strong><div><button disabled={busy} onClick={()=>void bulk('present')}>Présents</button><button disabled={busy} onClick={()=>void bulk('absent')}>Absents</button>{groups.length>0&&<select aria-label="Affecter au groupe" disabled={busy} value="" onChange={e=>e.target.value&&void bulk('assign',e.target.value)}><option value="">Affecter au groupe…</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select>}</div></div>}
  </section>:tab==='groupes'?<section className="field-panel">
   <div className="field-heading"><div><span className="field-kicker">ORGANISATION</span><h3>Groupes de récolte</h3></div><span className="field-count">{groups.length} groupes</span></div>
   <form className="field-inline" onSubmit={e=>void createNewGroup(e)}><input value={groupName} maxLength={80} placeholder="Nom du nouveau groupe" onChange={e=>setGroupName(e.target.value)}/><button disabled={busy||!groupName.trim()} type="submit"><Plus size={17}/> Créer</button></form>
   <div className="field-group-cards">{groups.map(g=>{
    const members=attendance.filter(a=>a.group_id===g.id)
    return <div className="field-group-card" key={g.id}><div><span className="field-group-icon"><UsersRound size={20}/></span><div><strong>{g.name}</strong><small>{members.length} ouvriers · {harvests.some(h=>h.group_id===g.id)?'Récolte enregistrée':'En cours'}</small></div></div>
    <div className="field-group-members">{members.map(m=><span key={m.id}>{workers.find(w=>w.id===m.worker_id)?.full_name}</span>)}</div></div>
   })}</div>
   {groups.length===0&&<div className="field-empty">Crée ton premier groupe pour cette date.</div>}
   <div className="field-heading"><div><span className="field-kicker">AFFECTATIONS</span><h3>Personnes présentes</h3></div></div>
   <div className="field-assign-list">{attendance.map(a=>{
    const w=workers.find(x=>x.id===a.worker_id)
    return <label key={a.id} className="field-assign"><span>{w?.full_name??'Ouvrier'}</span><span className="field-select-wrap"><select disabled={busy} aria-label={'Groupe de '+(w?.full_name??'ouvrier')} value={a.group_id??''} onChange={e=>void moveWorker(a,e.target.value)}><option value="">Sans groupe</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><ChevronDown size={15}/></span></label>
   })}</div>
   {attendance.length===0&&<div className="field-empty">Pointe d’abord la présence des ouvriers.</div>}
  </section>:<section className="field-panel">
   <div className="field-heading"><div><span className="field-kicker">PRODUCTION & RÉMUNÉRATIONS</span><h3>Comptabiliser les gains</h3></div></div>
   <div className="field-mode-summary"><div><Layers3 size={18}/><span>Collectif au sac</span><strong>{money(harvests.reduce((s,x)=>s+x.total_cents,0))}</strong></div><div><Sprout size={18}/><span>Individuel / journée</span><strong>{money(individual.reduce((s,x)=>s+x.amount_cents,0))}</strong></div></div>
   <h4 className="field-subheading">Travail seul ou à la journée</h4>
   <p className="field-help">Seuls les ouvriers présents sans groupe peuvent être rémunérés individuellement. Un mode par personne et par jour.</p>
   <div className="field-individual-list">{individualRows.map(({worker,pay})=><button type="button" key={worker.id} onClick={()=>day&&setEditing(worker)}><div><strong>{worker.full_name}</strong><small>{pay?(pay.mode==='daily'?'À la journée':pay.quantity+' sac(s) individuels'):'Mode non défini'}</small></div><span>{pay?money(pay.amount_cents):'Définir'} <ArrowRight size={16}/></span></button>)}</div>
   {individualRows.length===0&&<div className="field-empty">Aucun ouvrier présent sans groupe.</div>}
   <h4 className="field-subheading">Récolte collective au sac</h4>
   <HarvestAccounting day={day} groups={groups} attendance={attendance} workers={workers} onChanged={refresh}/>
   <p className="field-footnote"><Clock3 size={16}/> Les montants sont des gains acquis, pas des paiements réellement effectués.</p>
  </section>}
  {editing&&day&&<PersonPaymentSheet key={editing.id} worker={editing} day={day} existing={individual.find(x=>x.worker_id===editing.id)} onClose={()=>setEditing(null)} onSaved={refresh}/>}
  <footer className="field-bottom-note">OliveTrack <span>·</span> Field Edition</footer>
 </div>
}
