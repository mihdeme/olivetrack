import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BookOpenText, Check, CircleHelp, Coins, FileText, Landmark, Pencil, Plus, RotateCcw, Search, Scale, Truck, X } from 'lucide-react'
import { listBuyers, saveBuyer, listLedger, createEntry, reverseEntry, totals, parseKg, parseDh, formatKg, expectedSale, methodLabels, categoryLabels, kindLabels, type Buyer, type Entry, type ExpenseCategory, type PaymentMethod, type NewEntry } from './phase5-data'
import { readPayroll } from './phase4-data'
import { money } from './phase3-data'
import { parseFixed } from './phase5-data'
import './phase5.css'
type Section='sale'|'receipt'|'expense'|'ledger'
const sections:{id:Section;label:string}[]=[{id:'sale',label:'Pesées & ventes'},{id:'receipt',label:'Encaissements'},{id:'expense',label:'Dépenses'},{id:'ledger',label:'Journal'}]
const categories=Object.entries(categoryLabels) as [ExpenseCategory,string][]
const methods=Object.entries(methodLabels) as [PaymentMethod,string][]
const dateNow=()=>{const x=new Date();return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-')}
const errorText=(e:unknown)=>e instanceof Error?e.message:'Une erreur est survenue.'
const isReversal=(kind:string)=>kind.endsWith('_reversal')

type BuyerSheetProps={buyer?:Buyer;onClose:()=>void;onSaved:(id:string)=>Promise<void>}
function BuyerSheet({buyer,onClose,onSaved}:BuyerSheetProps){
 const [name,setName]=useState(buyer?.name??'')
 const [phone,setPhone]=useState(buyer?.phone??'')
 const [note,setNote]=useState(buyer?.notes??'')
 const [active,setActive]=useState(buyer?.is_active??true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('')
  try{const id=await saveBuyer({id:buyer?.id,name:name.trim(),phone:phone.trim()||null,notes:note.trim()||null,is_active:active});await onSaved(id);onClose()}
  catch(err){setError(errorText(err))}finally{setBusy(false)}
 }
 return <div className="field-sheet-layer" onClick={()=>!busy&&onClose()}>
  <section className="field-sheet" role="dialog" aria-modal="true" aria-labelledby="buyer-title" onClick={e=>e.stopPropagation()}>
   <div className="field-sheet-handle"/>
   <div className="field-sheet-heading"><div><span className="field-kicker">FICHIER ACHETEURS</span><h3 id="buyer-title">{buyer?'Modifier l’acheteur':'Nouvel acheteur'}</h3></div><button className="field-icon" onClick={onClose} aria-label="Fermer"><X size={19}/></button></div>
   <form className="field-sheet-form" onSubmit={e=>void submit(e)}>
    <label>Nom de l’acheteur *<input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Coopérative Atlas"/></label>
    <label>Téléphone<input type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    <label>Notes<input maxLength={400} value={note} onChange={e=>setNote(e.target.value)}/></label>
    {buyer&&<label className="p5-checkbox"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Acheteur actif</label>}
    {error&&<p className="data-error" role="alert">{error}</p>}
    <button type="submit" className="field-primary" disabled={busy||name.trim().length<2}><Check size={17}/> Enregistrer l’acheteur</button>
   </form>
  </section>
 </div>
}

export function Phase5(){
 const [section,setSection]=useState<Section>('sale')
 const [buyers,setBuyers]=useState<Buyer[]>([])
 const [entries,setEntries]=useState<Entry[]>([])
 const [wagesPaid,setWagesPaid]=useState(0)
 const [loaded,setLoaded]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [buyerSheet,setBuyerSheet]=useState<Buyer|'new'|null>(null)
 const [buyerId,setBuyerId]=useState('')
 const [date,setDate]=useState(dateNow)
 const [harvestDate,setHarvestDate]=useState('')
 const [weight,setWeight]=useState('')
 const [price,setPrice]=useState('')
 const [sacks,setSacks]=useState('')
 const [amount,setAmount]=useState('')
 const [category,setCategory]=useState<ExpenseCategory>('transport')
 const [method,setMethod]=useState<PaymentMethod>('cash')
 const [reference,setReference]=useState('')
 const [note,setNote]=useState('')
 const [search,setSearch]=useState('')
 const [journalFilter,setJournalFilter]=useState<'all'|'sale'|'receipt'|'expense'>('all')
 const requestKey=useRef(crypto.randomUUID())
 const refresh=useCallback(async()=>{
  try{
   const [b,e,p]=await Promise.all([listBuyers(),listLedger(),readPayroll()])
   setBuyers(b);setEntries(e);setWagesPaid(p.payments.reduce((v,x)=>v+x.amount_cents,0));setError('')
   setBuyerId(id=>id&&b.some(y=>y.id===id)?id:(b.find(y=>y.is_active)?.id??b[0]?.id??''))
  }catch(err){setError(errorText(err))}finally{setLoaded(true)}
 },[])
 useEffect(()=>{void refresh()},[refresh])
 const summary=useMemo(()=>totals(entries),[entries])
 const buyerBalances=useMemo(()=>buyers.map(b=>{
  const data=totals(entries.filter(e=>e.buyer_id===b.id))
  return {buyer:b,...data}
 }).sort((a,b)=>b.outstanding-a.outstanding),[buyers,entries])
 const currentBuyer=buyerBalances.find(b=>b.buyer.id===buyerId)
 const reversedIds=useMemo(()=>new Set(entries.filter(e=>e.reversal_of).map(e=>e.reversal_of)),[entries])
 const parsedWeight=parseKg(weight)
 const parsedPrice=parseFixed(price,100,10000000)
 const parsedAmount=parseDh(amount)
 const sackNumber=sacks.trim()===''?null:Number(sacks)
 const validSacks=sackNumber===null||(Number.isSafeInteger(sackNumber)&&sackNumber>=1&&sackNumber<=100000)
 const saleValue=parsedWeight!==null&&parsedPrice!==null?expectedSale(parsedWeight,parsedPrice):null
 const saveReady=section==='sale'?Boolean(buyerId && parsedWeight && parsedPrice && saleValue && saleValue<=1000000000000 && validSacks):
  section==='receipt'?Boolean(buyerId&&parsedAmount):section==='expense'?Boolean(parsedAmount):false
 const clean=()=>{setWeight('');setPrice('');setSacks('');setAmount('');setReference('');setNote('');setHarvestDate('');requestKey.current=crypto.randomUUID()}
 function switchTab(next:Section){setSection(next);setError('');setNotice('');clean()}
 async function submit(e:FormEvent){
  e.preventDefault()
  if(!saveReady||busy)return
  const label=section==='sale'?'bon de pesée':section==='receipt'?'encaissement réellement reçu':'dépense réellement payée'
  const value=section==='sale'?saleValue!:parsedAmount!
  if(!window.confirm(`Confirmer ${label} pour ${money(value)} le ${date} ?\nCette écriture restera dans le journal et devra être contrepassée en cas d'erreur.`))return
  const payload:NewEntry={
   kind:section as NewEntry['kind'],date,
   buyerId:section==='expense'?null:buyerId,
   weightGrams:section==='sale'?parsedWeight:null,priceCents:section==='sale'?parsedPrice:null,
   sacks:section==='sale'?sackNumber:null,harvestDate:section==='sale'?harvestDate||null:null,
   amountCents:section==='sale'?null:parsedAmount,
   category:section==='expense'?category:null,method:section==='sale'?null:method,
   reference:reference.trim(),note:note.trim(),requestId:requestKey.current,
  }
  setBusy(true);setError('');setNotice('')
  try{
   await createEntry(payload);clean();await refresh()
   setNotice('Écriture enregistrée et soldes actualisés.')
  }catch(err){setError(errorText(err))}finally{setBusy(false)}
 }
 async function undo(entry:Entry){
  const why=window.prompt('Motif de correction (obligatoire)', 'Erreur de saisie')?.trim()
  if(!why)return
  if(!window.confirm(`Contrepasser ${kindLabels[entry.kind]} de ${money(entry.amount_cents)} ?\nL’écriture initiale restera dans le journal.`))return
  setBusy(true);setError('');setNotice('')
  try{
   await reverseEntry(entry.id,why,crypto.randomUUID());await refresh()
   setNotice('Contrepassation enregistrée. L’historique initial reste visible.')
  }catch(err){setError(errorText(err))}finally{setBusy(false)}
 }
 const journal=entries.filter(e=>{
  if(journalFilter!=='all'&&!e.kind.startsWith(journalFilter))return false
  if(!search)return true
  const buyer=buyers.find(b=>b.id===e.buyer_id)?.name??''
  return (buyer+' '+e.note+' '+e.reference+' '+kindLabels[e.kind]+' '+(e.category??'')).toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))
 })
 return <div className="p5">
  <div className="p5-hero">
   <div className="p5-hero-overline"><Coins size={17}/> LIVRE DE CAMPAGNE</div>
   <div className="p5-hero-title">Ventes & trésorerie</div>
   <p>Les sacs, les ventes, les encaissements et les dépenses restent des opérations distinctes.</p>
   <div className="p5-hero-row"><div><span>Ventes valorisées</span><strong>{money(summary.sold)}</strong></div><div><span>Encaissements reçus</span><strong>{money(summary.received)}</strong></div></div>
   <div className="p5-hero-foot"><span>Solde acheteurs total</span><strong>{money(summary.outstanding)}</strong></div>
  </div>
  <div className="p5-metrics">
   <div><Scale size={18}/><span>Poids livré</span><strong>{formatKg(summary.weight)}</strong></div>
   <div><Truck size={18}/><span>Sacs livrés renseignés</span><strong>{summary.sacks}</strong></div>
   <div><ArrowUpRight size={18}/><span>Dépenses d’exploitation</span><strong>{money(summary.expenses)}</strong></div>
   <div><Landmark size={18}/><span>Flux financier net</span><strong>{money(summary.received-summary.expenses-wagesPaid)}</strong></div>
  </div>
  <p className="p5-disclaimer"><CircleHelp size={15}/> Flux net = encaissements − dépenses − paiements ouvriers, tous moyens confondus. Ce n’est pas le solde physique des espèces ni un relevé bancaire : apports initiaux et autres flux ne sont pas encore saisis.</p>
  <div className="p5-tabs" role="tablist" aria-label="Gestion de la caisse">{sections.map(t=><button key={t.id} role="tab" aria-selected={section===t.id} className={section===t.id?'selected':''} onClick={()=>switchTab(t.id)}>{t.label}</button>)}</div>
  {error&&<p className="data-error" role="alert">{error}</p>}
  {notice&&<p className="payroll-success" role="status"><Check size={16}/>{notice}</p>}
  {!loaded?<div className="field-empty">Chargement du livre de campagne…</div>:<>
   {(section==='sale'||section==='receipt')&&<div className="p5-buyers">
    <div className="p5-section-heading"><div><span className="field-kicker">PARTENAIRES</span><h3>Acheteurs</h3></div><button className="p5-subaction" onClick={()=>setBuyerSheet('new')}><Plus size={17}/> Ajouter</button></div>
    {buyers.length===0?<p className="p5-help">Ajoute d’abord un acheteur pour enregistrer un bon ou un encaissement.</p>:<>
     <label className="p5-field">Acheteur<select value={buyerId} onChange={e=>setBuyerId(e.target.value)}>{buyers.map(b=><option key={b.id} value={b.id}>{b.name}{!b.is_active?' (archivé)':''}</option>)}</select></label>
     {currentBuyer&&<div className="p5-buyer-card">
      <div><strong>{currentBuyer.buyer.name}</strong><button title="Modifier l’acheteur" aria-label="Modifier l’acheteur" onClick={()=>setBuyerSheet(currentBuyer.buyer)}><Pencil size={16}/></button></div>
      <section><span>Vendu : {money(currentBuyer.sold)}</span><span>Reçu : {money(currentBuyer.received)}</span><strong>{currentBuyer.outstanding>=0?'Reste à encaisser':'Crédit acheteur'} : {money(Math.abs(currentBuyer.outstanding))}</strong></section>
     </div>}
    </>}
   </div>}
   {section!=='ledger'&&<form className="p5-form" onSubmit={e=>void submit(e)}>
    <div className="p5-section-heading"><div><span className="field-kicker">{section==='sale'?'LIVRAISON D’OLIVES':section==='receipt'?'ARGENT REÇU':'CHARGES D’EXPLOITATION'}</span><h3>{section==='sale'?'Nouveau bon de pesée':section==='receipt'?'Nouvel encaissement':'Nouvelle dépense'}</h3></div></div>
    <label className="p5-field">Date de {section==='sale'?'livraison':section==='receipt'?'réception':'paiement'}<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    {section==='sale'&&<>
     <div className="p5-two">
      <label className="p5-field">Poids net (kg) *<input required inputMode="decimal" placeholder="Ex. 123,450" value={weight} onChange={e=>setWeight(e.target.value)}/></label>
      <label className="p5-field">Prix par kg (DH) *<input required inputMode="decimal" placeholder="Ex. 8,50" value={price} onChange={e=>setPrice(e.target.value)}/></label>
     </div>
     <div className="p5-two p5-optional-grid">
      <label className="p5-field">Sacs livrés (facultatif)<input type="number" min="1" max="100000" inputMode="numeric" value={sacks} onChange={e=>setSacks(e.target.value)} placeholder="Ex. 6"/></label>
      <label className="p5-field">Date de récolte (facultative)<input type="date" value={harvestDate} onChange={e=>setHarvestDate(e.target.value)}/></label>
     </div>
     <div className="p5-calculation"><span>Valeur du bon</span><strong>{saleValue?money(saleValue):'—'}</strong><small>Arrondi au centime, à partir du poids net et du prix.</small></div>
    </>}
    {section==='expense'&&<label className="p5-field">Catégorie de dépense<select value={category} onChange={e=>setCategory(e.target.value as ExpenseCategory)}>{categories.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}
    {section!=='sale'&&<>
     <label className="p5-field">Montant réellement {section==='receipt'?'reçu':'payé'} (DH) *<input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ex. 250,00"/></label>
     <label className="p5-field">Moyen de paiement<select value={method} onChange={e=>setMethod(e.target.value as PaymentMethod)}>{methods.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    </>}
    <label className="p5-field">Référence du justificatif (facultative)<input maxLength={80} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Numéro de bon / reçu"/></label>
    <label className="p5-field">Remarque (facultative)<textarea rows={2} maxLength={400} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <button type="submit" className="field-primary" disabled={!saveReady||busy||!loaded}><Check size={18}/> {busy?'Enregistrement…':section==='sale'?'Enregistrer le bon':section==='receipt'?'Confirmer l’argent reçu':'Enregistrer la dépense'}</button>
   </form>}
   {(section==='sale'||section==='receipt')&&buyerBalances.length>0&&<section className="p5-balances">
    <div className="p5-section-heading"><div><span className="field-kicker">SUIVI CLIENTS</span><h3>Soldes par acheteur</h3></div></div>
    {buyerBalances.map(b=><button type="button" key={b.buyer.id} className="p5-balance-row" onClick={()=>setBuyerId(b.buyer.id)}><span>{b.buyer.name}<small>{money(b.sold)} vendus · {money(b.received)} encaissés</small></span><strong className={b.outstanding<0?'p5-credit':''}>{money(b.outstanding)}</strong><ArrowRight size={16}/></button>)}
   </section>}
   {section==='ledger'&&<section className="p5-journal">
    <div className="p5-section-heading"><div><span className="field-kicker">TRAÇABILITÉ</span><h3>Historique immuable</h3></div></div>
    <label className="field-search"><Search size={17}/><input aria-label="Rechercher une écriture" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Acheteur, référence, note…"/><span>{journal.length}</span></label>
    <div className="p5-filter">{(['all','sale','receipt','expense'] as const).map(x=><button key={x} className={journalFilter===x?'active':''} onClick={()=>setJournalFilter(x)}>{({all:'Tout',sale:'Ventes',receipt:'Encaissements',expense:'Dépenses'})[x]}</button>)}</div>
    <div className="p5-entry-list">{journal.map(e=><div className="p5-entry" key={e.id}>
     <div className={'p5-entry-mark '+e.kind}>{e.kind.startsWith('sale')?<Scale size={18}/>:e.kind.startsWith('receipt')?<ArrowDownLeft size={18}/>:<ArrowUpRight size={18}/>}</div>
     <div className="p5-entry-body"><strong>{kindLabels[e.kind]}</strong><small>{e.entry_date} · {buyers.find(b=>b.id===e.buyer_id)?.name??(e.category?categoryLabels[e.category as ExpenseCategory]:'—')}</small>
      {e.weight_grams!==null&&<small>{formatKg(e.weight_grams)}{e.sacks!==null?' · '+e.sacks+' sacs':''}</small>}
      {(e.reference||e.note)&&<small>{[e.reference,e.note].filter(Boolean).join(' · ')}</small>}
      {reversedIds.has(e.id)&&<small className="p5-reversed">Annulée par contrepassation</small>}
     </div>
     <div className="p5-entry-right"><strong>{e.amount_cents<0?'− ':''}{money(Math.abs(e.amount_cents))}</strong>
      {!isReversal(e.kind)&&!reversedIds.has(e.id)&&<button disabled={busy} onClick={()=>void undo(e)}><RotateCcw size={14}/> Corriger</button>}
     </div>
    </div>)}</div>
    {journal.length===0&&<div className="field-empty">Aucune écriture correspondante.</div>}
   </section>}
   {section!=='ledger'&&<div className="p5-journal-link"><BookOpenText size={17}/><span>Les écritures ne sont pas effacées : pour corriger, ouvre le Journal et enregistre une contrepassation.</span><button onClick={()=>switchTab('ledger')}>Journal <ArrowRight size={15}/></button></div>}
  </>}
  {buyerSheet&&<BuyerSheet buyer={buyerSheet==='new'?undefined:buyerSheet} onClose={()=>setBuyerSheet(null)} onSaved={async id=>{await refresh();setBuyerId(id)}}/>}
  <div className="p5-footer"><FileText size={15}/> Les justificatifs PDF et rapports imprimables seront ajoutés en phase 6.</div>
 </div>
}
