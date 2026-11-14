import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, CheckCircle2, ClipboardList, Download, FileBadge, FileChartColumnIncreasing, FileText, Landmark, Printer, RefreshCcw, ShieldCheck, UsersRound } from 'lucide-react'
import { fetchReportData, type ReportData } from './report-data'
import { buildReport, reportNames, type ReportKind } from './report-definitions'
import { downloadPdf, makeReportPdf } from './report-pdf'
import './phase6.css'

const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
const firstMonth=()=>today().slice(0,7)+'-01'
const configs:{kind:ReportKind;description:string;format:string;icon:typeof Printer}[]=[
 {kind:'payroll',description:'Gains, avances, versements et soldes par personne. Colonne de signature.',format:'A4 paysage',icon:UsersRound},
 {kind:'harvest',description:'Pointage, groupes, quantités et gains du jour.',format:'A4 portrait',icon:ClipboardList},
 {kind:'sales',description:'Bons de pesée, poids, ventes, encaissements et soldes acheteurs.',format:'A4 portrait',icon:FileBadge},
 {kind:'finance',description:'Flux financiers, salaires payés, dépenses et journal de campagne.',format:'A4 portrait',icon:Landmark},
]
const short=(d:string)=>d?new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}):'—'
export function Phase6(){
 const [kind,setKind]=useState<ReportKind>('payroll')
 const [from,setFrom]=useState(firstMonth)
 const [to,setTo]=useState(today)
 const [day,setDay]=useState(today)
 const [data,setData]=useState<ReportData|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');setSuccess('')
  try{setData(await fetchReportData())}
  catch(e){setError(e instanceof Error?e.message:'Lecture des données impossible.')}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void refresh()},[refresh])
 const years=useMemo(()=>{
  if(!data)return []
  const all=[
   ...data.days.map(x=>x.work_date),
   ...data.payments.map(x=>x.payment_date),
   ...data.ledger.map(x=>x.entry_date)
  ].filter(Boolean).sort()
  return all
 },[data])
 const periodOk=kind==='harvest'||from<=to
 function allSeason(){
  setFrom(years[0]??firstMonth())
  setTo(today())
 }
 function exportFile(){
  if(!data||loading||!periodOk)return
  setError('');setSuccess('')
  try{
   const start=kind==='harvest'?day:from
   const end=kind==='harvest'?day:to
   const report=buildReport(kind,data,start,end)
   const bytes=makeReportPdf(report)
   if(bytes.length<1500)throw Error('Le fichier généré est incomplet.')
   downloadPdf(bytes,'OliveTrack_'+kind+'_'+start+'_'+end+'.pdf')
   setSuccess('PDF A4 généré. Sur iPhone, ouvre le fichier téléchargé et choisis Partager ou Enregistrer dans Fichiers.')
  }catch(e){setError(e instanceof Error?e.message:'Création du PDF impossible.')}
 }
 const selected=configs.find(c=>c.kind===kind)!
 const titlePeriod=kind==='harvest'?short(day):short(from)+' — '+short(to)
 return <div className="p6">
  <section className="p6-hero">
   <div className="p6-kicker"><FileChartColumnIncreasing size={17}/> CENTRE DOCUMENTAIRE</div>
   <h2>Des bilans prêts à signer.</h2>
   <p>Des documents PDF A4 propres, paginés et générés directement depuis les données de la campagne.</p>
   <div className="p6-hero-decoration">A4</div>
  </section>
  <div className="p6-section-label"><span className="field-kicker">01 / DOCUMENT</span><strong>Choisir un rapport</strong></div>
  <div className="p6-report-grid">
   {configs.map(config=>{
    const Icon=config.icon
    return <button type="button" key={config.kind} className={'p6-report-card '+(kind===config.kind?'active':'')} onClick={()=>{setKind(config.kind);setSuccess('');setError('')}} aria-pressed={kind===config.kind}>
     <span className="p6-report-symbol"><Icon size={21}/></span>
     <strong>{reportNames[config.kind]}</strong>
     <span className="p6-report-description">{config.description}</span>
     <span className="p6-format">{config.format}{kind===config.kind&&<CheckCircle2 size={15}/>}</span>
    </button>
   })}
  </div>
  <div className="p6-filters">
   <div className="p6-section-label"><span className="field-kicker">02 / SÉLECTION</span><strong>{kind==='harvest'?'Choisir la journée':'Choisir la période'}</strong></div>
   {kind==='harvest'?
    <label className="p6-date-field">Date du rapport<input type="date" required value={day} onChange={e=>setDay(e.target.value)}/></label>:
    <>
     <div className="p6-presets"><button onClick={()=>{setFrom(firstMonth());setTo(today())}}>Ce mois</button><button onClick={allSeason}>Toute la campagne</button></div>
     <div className="p6-date-grid"><label className="p6-date-field">Du<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="p6-date-field">Au<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
    </>}
   {!periodOk&&<p className="data-error">La date de fin doit être postérieure ou égale à la date de début.</p>}
  </div>
  <section className="p6-export">
   <div className="p6-export-top"><span className="p6-export-icon"><FileText size={24}/></span><div><strong>{reportNames[kind]}</strong><small>{titlePeriod}</small></div><span className="p6-export-a4">{selected.format}</span></div>
   <div className="p6-export-details">
    <div><CheckCircle2 size={16}/> En-têtes répétés sur chaque page de tableau</div>
    <div><CheckCircle2 size={16}/> Marges A4 et pagination automatiques</div>
    <div><CheckCircle2 size={16}/> Montants en DH, accents français et dates lisibles</div>
   </div>
   <button className="p6-download" disabled={!data||loading||!periodOk} onClick={exportFile}><Download size={19}/>{loading?'Chargement des données…':'Générer le PDF A4'}</button>
   <button type="button" className="p6-refresh" disabled={loading} onClick={()=>void refresh()}><RefreshCcw size={15}/> Actualiser les données</button>
   {error&&<p className="data-error" role="alert">{error}</p>}
   {success&&<p className="payroll-success" role="status"><CheckCircle2 size={16}/>{success}</p>}
  </section>
  <div className="p6-fineprint"><ShieldCheck size={17}/><p>Les PDF sont fabriqués sur ton appareil après lecture sécurisée des données. Aucun fichier n’est envoyé à un service tiers. Le document reflète les écritures disponibles à l’instant de l’export ; les contrepassations restent prises en compte.</p></div>
  <div className="p6-footer"><CalendarRange size={15}/> Imprimable en A4 sur iPhone et ordinateur · <Printer size={15}/> Export des feuilles de signature inclus.</div>
 </div>
}
