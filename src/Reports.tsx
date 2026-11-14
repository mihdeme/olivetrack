import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, FileDown, FileText, Printer, RefreshCcw, ShieldCheck } from 'lucide-react'
import { money } from './phase3-data'
import { formatDate, isoToday, payrollRows, harvestRows, buyerRows, financeRows, readReportData, period, type ReportData, type ReportKind } from './report-data'
import './report-print.css'

type Column={label:string;ratio:number;numeric?:boolean}
type ReportRow={cells:string[];key:string}
type Content={title:string;subtitle:string;columns:Column[];rows:ReportRow[];metrics:{label:string;value:string}[];footnote:string;signature?:boolean}
const specs:{kind:ReportKind;label:string;description:string}[]=[
 {kind:'payroll',label:'Paie des ouvriers',description:'Soldes d’ouverture, gains, versements, signatures.'},
 {kind:'harvest',label:'Récolte quotidienne',description:'Présences, affectations, sacs et rémunérations.'},
 {kind:'buyers',label:'Ventes & acheteurs',description:'Créances, ventes, encaissements et soldes.'},
 {kind:'finance',label:'Bilan financier',description:'Recettes, dépenses, paies et flux financiers.'},
]
const sum=(values:number[])=>values.reduce((a,b)=>a+b,0)
function createContent(data:ReportData,kind:ReportKind,start:string,end:string):Content{
 if(kind==='payroll'){
  const records=payrollRows(data,start,end)
  const t=(key:'opening'|'earned'|'paid'|'closing')=>sum(records.map(r=>r[key]))
  return {
   title:'État de paie des ouvriers',subtitle:'Récapitulatif des rémunérations et des versements, avec émargement.',
   columns:[{label:'Ouvrier',ratio:29},{label:'Solde initial',ratio:16,numeric:true},{label:'Gagné',ratio:15,numeric:true},{label:'Versé net',ratio:16,numeric:true},{label:'Solde final',ratio:15,numeric:true},{label:'Signature',ratio:19}],
   rows:records.map(r=>({key:r.id,cells:[r.name,money(r.opening),money(r.earned),money(r.paid),money(r.closing),'']})),
   metrics:[{label:'Ouvriers concernés',value:String(records.length)},{label:'Gains de la période',value:money(t('earned'))},{label:'Paiements nets',value:money(t('paid'))},{label:'Solde final à payer',value:money(t('closing'))}],
   footnote:'Les signatures attestent la remise des fonds lorsqu’elles sont effectivement recueillies. Une écriture de paie n’est pas une preuve de signature.',
   signature:true
  }
 }
 if(kind==='harvest'){
  const rows=harvestRows(data,start,end)
  const dates=new Map(data.days.map(d=>[d.id,d.work_date]))
  const groups=new Map(data.groups.map(g=>[g.id,g.name]))
  const harvestMap=new Map(data.harvests.map(h=>[h.id,h]))
  const earningByWorkerDay=new Map<string,number>()
  for(const e of data.groupEarnings){
   const h=harvestMap.get(e.harvest_id)
   if(h){const key=h.work_day_id+'|'+e.worker_id;earningByWorkerDay.set(key,(earningByWorkerDay.get(key)??0)+e.amount_cents)}
  }
  for(const i of data.individual){
   const key=i.work_day_id+'|'+i.worker_id
   earningByWorkerDay.set(key,(earningByWorkerDay.get(key)??0)+i.amount_cents)
  }
  const indiv=new Map(data.individual.map(i=>[i.work_day_id+'|'+i.worker_id,i]))
  const attendance=data.attendances.filter(a=>{const date=dates.get(a.work_day_id);return Boolean(date&&period(date,start,end))})
   .sort((a,b)=>(dates.get(a.work_day_id)??'').localeCompare(dates.get(b.work_day_id)??'')||
    (data.workers.find(w=>w.id===a.worker_id)?.full_name??'').localeCompare(data.workers.find(w=>w.id===b.worker_id)?.full_name??'','fr'))
  const sacks=sum(rows.map(r=>r.sacks)),comp=sum(rows.map(r=>r.amount))
  return {
   title:'Journal quotidien de récolte',subtitle:'Une ligne par ouvrier présent et par jour ; les sacs collectifs sont récapitulés en tête.',
   columns:[{label:'Date',ratio:13},{label:'Ouvrier',ratio:26},{label:'Groupe / statut',ratio:27},{label:'Mode',ratio:20},{label:'Gains',ratio:18,numeric:true}],
   rows:attendance.map((a,i)=>{
    const key=a.work_day_id+'|'+a.worker_id
    const solo=indiv.get(key)
    const mode=solo?.mode==='daily'?'Journée':solo?'Au sac':'Collectif / en attente'
    return {key:key+i,cells:[dates.get(a.work_day_id)??'',data.workers.find(w=>w.id===a.worker_id)?.full_name??'Ouvrier archivé',
     a.group_id?groups.get(a.group_id)??'Groupe archivé':'Sans groupe',mode,money(earningByWorkerDay.get(key)??0)]}
   }),
   metrics:[{label:'Présences pointées',value:String(attendance.length)},{label:'Sacs valorisés',value:String(sacks)},{label:'Gains acquis',value:money(comp)},{label:'Journées actives',value:String(new Set(attendance.map(a=>a.work_day_id)).size)}],
   footnote:'Les sacs collectifs sont comptés une seule fois par groupe. Le nombre de sacs livrés chez les acheteurs est suivi séparément et ne doit pas être additionné aux sacs récoltés.'
  }
 }
 if(kind==='buyers'){
  const rows=buyerRows(data,start,end)
  const t=(key:'opening'|'sold'|'received'|'closing')=>sum(rows.map(r=>r[key]))
  return {
   title:'État des ventes et encaissements',subtitle:'Suivi par acheteur, avec report des soldes antérieurs à la période.',
   columns:[{label:'Acheteur',ratio:32},{label:'Solde initial',ratio:18,numeric:true},{label:'Ventes',ratio:18,numeric:true},{label:'Encaissé',ratio:18,numeric:true},{label:'Solde final',ratio:18,numeric:true}],
   rows:rows.map((r,i)=>({key:String(i),cells:[r.name,money(r.opening),money(r.sold),money(r.received),money(r.closing)]})),
   metrics:[{label:'Acheteurs concernés',value:String(rows.length)},{label:'Ventes période',value:money(t('sold'))},{label:'Encaissements période',value:money(t('received'))},{label:'Reste à encaisser',value:money(t('closing'))}],
   footnote:'Un solde négatif est un crédit ou une avance reçue de l’acheteur. Une vente valorisée n’est pas un paiement reçu.'
  }
 }
 const rows=financeRows(data,start,end)
 const t=(key:'sales'|'received'|'expense'|'wages')=>sum(rows.map(r=>r[key]))
 return {
  title:'Bilan financier de campagne',subtitle:'Mouvements enregistrés sur la période, hors fonds de caisse d’ouverture.',
  columns:[{label:'Date',ratio:13},{label:'Référence / contrepartie',ratio:29},{label:'Ventes',ratio:17,numeric:true},{label:'Encaissé',ratio:17,numeric:true},{label:'Dépenses',ratio:17,numeric:true},{label:'Paies',ratio:17,numeric:true}],
  rows:rows.map((r,i)=>({key:String(i),cells:[r.date,r.detail+(r.kind.endsWith('_reversal')?' (annulation)':''),...(['sales','received','expense','wages'] as const).map(k=>r[k]===0?'—':money(r[k]))]})),
  metrics:[{label:'Ventes valorisées',value:money(t('sales'))},{label:'Encaissements réels',value:money(t('received'))},{label:'Frais payés',value:money(t('expense'))},{label:'Flux net (après paies)',value:money(t('received')-t('expense')-t('wages'))}],
  footnote:'Le flux net = encaissements moins frais et paiements ouvriers. Ce n’est ni le résultat comptable ni le solde des espèces/banque : les apports initiaux et transferts ne sont pas enregistrés.'
 }
}
function paginate(rows:ReportRow[]):ReportRow[][]{
 const size=14
 if(rows.length===0)return [[]]
 const result:ReportRow[][]=[]
 for(let i=0;i<rows.length;i+=size)result.push(rows.slice(i,i+size))
 return result
}
function Pages({content,start,end,generated}:{content:Content;start:string;end:string;generated:string}){
 const pages=paginate(content.rows)
 const colwidth=content.columns.reduce((n,c)=>n+c.ratio,0)
 return <div className="report-document">
  {pages.map((page,index)=><article className="report-page" key={index}>
   <header className="report-paper-head">
    <div className="report-brand"><div className="report-emblem">O</div><div><strong>OLIVETRACK</strong><small>CARNET DE CAMPAGNE · ÉDITION DES ÉTATS</small></div></div>
    <div className="report-meta">DOCUMENT DE GESTION<br/><strong>ÉDITION DU {generated}</strong></div>
   </header>
   <div className="report-headline">
    <div className="report-overline">{index===0?'ÉTAT DE GESTION · CAMPAGNE OLÉICOLE':'SUITE DU RAPPORT · PAGE '+(index+1)}</div>
    <h2>{content.title}</h2>
    <p>{content.subtitle}</p>
    <div className="report-period"><CalendarDays size={14}/> Période du <strong>{formatDate(start)}</strong> au <strong>{formatDate(end)}</strong></div>
   </div>
   {index===0&&<div className="report-stat-grid">{content.metrics.map(m=><div key={m.label}><span>{m.label}</span><strong>{m.value}</strong></div>)}</div>}
   <table className={'report-table'+(content.signature?' report-signatures':'')}>
    <colgroup>{content.columns.map((c,i)=><col key={i} style={{width:(100*c.ratio/colwidth)+'%'}}/>)}</colgroup>
    <thead><tr>{content.columns.map((c,i)=><th key={i} className={c.numeric?'report-number':''}>{c.label}</th>)}</tr></thead>
    <tbody>{page.length? page.map(r=><tr key={r.key}>{r.cells.map((cell,i)=><td key={i} className={content.columns[i].numeric?'report-number':''}>{cell||'\u00a0'}</td>)}</tr>):
     <tr className="report-empty-row"><td colSpan={content.columns.length}>Aucune donnée pour cette période.</td></tr>}</tbody>
   </table>
   {index===pages.length-1&&<div className="report-notes"><strong>Note de lecture</strong><p>{content.footnote}</p></div>}
   <footer className="report-footer">
    <div><strong>OLIVETRACK</strong><span>Document généré à partir du registre de campagne</span></div>
    <span>Page {index+1} / {pages.length}</span>
   </footer>
  </article>)}
 </div>
}
const firstDay=()=>isoToday().slice(0,8)+'01'
function errorMessage(e:unknown){return e instanceof Error?e.message:'Impossible de préparer le rapport.'}
export function Reports(){
 const [kind,setKind]=useState<ReportKind>('payroll')
 const [start,setStart]=useState(firstDay)
 const [end,setEnd]=useState(isoToday)
 const [snapshot,setSnapshot]=useState<ReportData|null>(null)
 const [generated,setGenerated]=useState('')
 const [pending,setPending]=useState(false)
 const [error,setError]=useState('')
 const [previewScale,setPreviewScale]=useState(1)
 useEffect(()=>{
  function resize(){setPreviewScale(Math.min(1,Math.max(.25,(window.innerWidth-48)/794)))}
  resize();window.addEventListener('resize',resize)
  return()=>window.removeEventListener('resize',resize)
 },[])
 const content=useMemo(()=>snapshot?createContent(snapshot,kind,start,end):null,[snapshot,kind,start,end])
 const [prepared,setPrepared]=useState<{start:string;end:string;kind:ReportKind}|null>(null)
 const ready=Boolean(content&&prepared?.start===start&&prepared?.end===end&&prepared?.kind===kind)
 async function prepare(){
  if(start>end){setError('La date de début doit précéder la date de fin.');return}
  setPending(true);setError('')
  try{
   const data=await readReportData()
   setSnapshot(data);setPrepared({start,end,kind})
   setGenerated(new Date().toLocaleDateString('fr-FR'))
  }catch(e){setError(errorMessage(e));setSnapshot(null);setPrepared(null)}
  finally{setPending(false)}
 }
 function updateKind(k:ReportKind){setKind(k);setPrepared(null)}
 function print(){
  if(!ready)return
  window.print()
 }
 return <section className="reports-module">
  <div className="reports-intro"><span className="field-kicker">DOCUMENTS · FORMAT A4</span><h2>Des rapports prêts à signer.</h2><p>Quatre états générés à partir des données réelles de ta campagne, mis en page pour le papier A4 et le PDF.</p></div>
  <div className="reports-options">{specs.map(s=><button key={s.kind} type="button" className={kind===s.kind?'chosen':''} onClick={()=>updateKind(s.kind)}><FileText size={19}/><span><strong>{s.label}</strong><small>{s.description}</small></span></button>)}</div>
  <div className="reports-controls">
   <label>Du<input type="date" value={start} onChange={e=>{setStart(e.target.value);setPrepared(null)}}/></label>
   <label>Au<input type="date" value={end} onChange={e=>{setEnd(e.target.value);setPrepared(null)}}/></label>
   <button type="button" className="field-primary" disabled={pending||!start||!end} onClick={()=>void prepare()}><RefreshCcw size={17}/>{pending?'Préparation…':'Générer l’aperçu A4'}</button>
   {error&&<p className="data-error" role="alert">{error}</p>}
  </div>
  {ready&&content&&<div className="reports-ready">
   <div className="reports-ready-actions"><div><CheckCircle2 size={19}/><span><strong>Rapport prêt</strong><small>{content.rows.length} lignes · {paginate(content.rows).length} page(s) A4</small></span></div>
    <button type="button" className="reports-print-btn" onClick={print}><FileDown size={17}/> Imprimer / Enregistrer PDF</button>
   </div>
   <p className="reports-ios-hint"><ShieldCheck size={15}/> Sur iPhone, touche « Imprimer / Enregistrer PDF », ouvre l’aperçu d’impression puis utilise Partager → Enregistrer dans Fichiers pour conserver le PDF.</p>
   <div className="reports-viewport"><div className="reports-zoom" style={{zoom:previewScale}}><Pages content={content} start={start} end={end} generated={generated}/></div></div>
  </div>}
  {!ready&&<div className="reports-empty"><Printer size={24}/><strong>Ton document apparaîtra ici</strong><span>Choisis le rapport et les dates, puis génère l’aperçu avant impression.</span></div>}
 </section>
}
