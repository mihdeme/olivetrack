import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Banknote, BookOpenText, CalendarDays, CheckCircle2, RotateCcw, ShieldAlert } from 'lucide-react'
import type { Worker } from './phase2-data'
import { money } from './phase3-data'
import { parsePaymentCents, paymentLabels, readPayroll, recordPayment, reversePayment, summarizeWorker, type PaymentKind, type WorkerPayment, type WorkerEarning } from './phase4-data'

function todayLocal() {
  const now = new Date()
  return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')
}
function errorText(e: unknown) { return e instanceof Error ? e.message : 'Une erreur est survenue.' }
const kinds: {value:Exclude<PaymentKind,'reversal'>;label:string}[] = [
  {value:'weekly',label:'Paie du mercredi'},
  {value:'advance',label:'Avance'},
  {value:'partial',label:'Versement partiel'},
  {value:'final',label:'Solde de départ'},
]

export function WorkerPayroll({ workers }: { workers:Worker[] }) {
  const [payments,setPayments] = useState<WorkerPayment[]>([])
  const [earnings,setEarnings] = useState<WorkerEarning[]>([])
  const [selected,setSelected] = useState('')
  const [date,setDate] = useState(todayLocal)
  const [amount,setAmount] = useState('')
  const [kind,setKind] = useState<Exclude<PaymentKind,'reversal'>>('weekly')
  const [note,setNote] = useState('')
  const [busy,setBusy] = useState(false)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [success,setSuccess] = useState('')
  // A stable idempotency key is reused on retries until the form changes or succeeds.
  const requestId = useRef(crypto.randomUUID())
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await readPayroll()
      setPayments(rows.payments)
      setEarnings(rows.earnings)
      setError('')
    } catch(e) { setError(errorText(e)) }
    finally { setLoading(false) }
  },[])
  useEffect(()=>{void refresh()},[refresh])
  useEffect(()=>{
    if(!workers.some(w=>w.id===selected) && workers.length>0)
      setSelected(workers.find(w=>w.is_active)?.id ?? workers[0].id)
  },[workers,selected])
  const selectedWorker = workers.find(w=>w.id===selected)
  const stats = useMemo(() => summarizeWorker(selected,earnings,payments),[selected,earnings,payments])
  const totals = useMemo(() => workers.reduce((acc,w)=>{
    const s = summarizeWorker(w.id,earnings,payments)
    return {earned:acc.earned+s.earned,paid:acc.paid+s.paid,due:acc.due+s.due}
  },{earned:0,paid:0,due:0}),[workers,earnings,payments])
  const inputCents = parsePaymentCents(amount)
  const alreadyReversed = new Set(payments.filter(p=>p.reversal_of).map(p=>p.reversal_of))
  const workerPayments = payments.filter(p=>p.worker_id===selected)
  const dailyWeekly = payments.filter(p=>p.payment_date===date && p.kind==='weekly' && !alreadyReversed.has(p.id))
  const paidWeekly = dailyWeekly.reduce((sum,p)=>sum+p.amount_cents,0)
  function clearRequest() { requestId.current = crypto.randomUUID(); setError('');setSuccess('') }
  async function submit(e:FormEvent) {
    e.preventDefault()
    if(!selectedWorker || !inputCents || busy) return
    if(kind!=='advance' && inputCents>stats.due) { setError('Ce paiement dépasse le solde disponible. Choisis Avance si tu verses plus que le montant gagné restant.');return }
    const label = paymentLabels[kind]
    if(!window.confirm(`Confirmer le versement RÉEL de ${money(inputCents)} à ${selectedWorker.full_name} le ${date} (${label}) ? Ne valide que si l'argent a réellement été donné.`))return
    setBusy(true);setError('');setSuccess('')
    try {
      await recordPayment({workerId:selected,amountCents:inputCents,kind,date,note:note.trim(),requestId:requestId.current})
      requestId.current=crypto.randomUUID()
      setAmount('');setNote('')
      await refresh()
      setSuccess('Paiement enregistré dans le journal. Le solde a été recalculé.')
    } catch(e){setError(errorText(e))}
    finally{setBusy(false)}
  }
  async function cancelPayment(p:WorkerPayment){
    if(busy || p.kind==='reversal' || alreadyReversed.has(p.id))return
    const why=window.prompt('Motif de l’annulation (obligatoire)', 'Erreur de saisie')?.trim()
    if(!why)return
    if(!window.confirm(`Annuler comptablement le versement de ${money(p.amount_cents)} du ${p.payment_date} ? L'écriture d'origine restera dans l'historique.`))return
    setBusy(true);setError('');setSuccess('')
    try {
      await reversePayment({paymentId:p.id,note:why,requestId:crypto.randomUUID()})
      await refresh()
      setSuccess('Contrepassation ajoutée : le paiement original reste visible.')
    }catch(e){setError(errorText(e))}
    finally{setBusy(false)}
  }
  function payFullBalance() {
    if(stats.due<=0)return
    setAmount((stats.due/100).toFixed(2))
    clearRequest()
  }
  return <section className="payroll">
    <div className="section-bar"><div><h2><Banknote size={20}/> Avances et paiements</h2><p>Journal des décaissements réels. Les gains acquis restent conservés séparément.</p></div></div>
    <div className="payroll-metrics">
      <div><span>Gagné</span><strong>{money(totals.earned)}</strong></div>
      <div><span>Versé net</span><strong>{money(totals.paid)}</strong></div>
      <div><span>Solde global</span><strong>{money(totals.due)}</strong></div>
    </div>
    <p className="quiet">Un solde négatif signifie qu'une avance reste à récupérer sur les gains futurs, ou qu'une correction des gains est nécessaire.</p>
    {error && <p className="data-error" role="alert">{error}</p>}
    {success && <p className="payroll-success" role="status"><CheckCircle2 size={17}/>{success}</p>}
    {loading ? <p className="quiet">Chargement du journal…</p> : workers.length===0 ? <div className="muted-panel">Ajoute d'abord des ouvriers dans le registre.</div> : <>
      <section className="editor payroll-editor">
        <h3>Enregistrer un versement</h3>
        <label htmlFor="pay-worker">Ouvrier</label>
        <select id="pay-worker" value={selected} onChange={e=>{setSelected(e.target.value);clearRequest()}}>
          {workers.map(w=><option key={w.id} value={w.id}>{w.full_name}{w.is_active?'':' (archivé)'}</option>)}
        </select>
        <div className="payroll-balance">
          <div><small>Gagné</small><strong>{money(stats.earned)}</strong></div>
          <div><small>Déjà versé</small><strong>{money(stats.paid)}</strong></div>
          <div><small>Reste à payer</small><strong className={stats.due<0?'payroll-negative':''}>{money(stats.due)}</strong></div>
        </div>
        <form onSubmit={submit} className="payroll-form">
          <label htmlFor="pay-kind">Type de versement</label>
          <select id="pay-kind" value={kind} onChange={e=>{setKind(e.target.value as Exclude<PaymentKind,'reversal'>);clearRequest()}}>{kinds.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>
          <label htmlFor="pay-date">Date réelle du versement</label>
          <input id="pay-date" type="date" required value={date} onChange={e=>{setDate(e.target.value);clearRequest()}} />
          <label htmlFor="pay-amount">Montant versé (DH)</label>
          <div className="payroll-amount"><input id="pay-amount" inputMode="decimal" required value={amount} onChange={e=>{setAmount(e.target.value);clearRequest()}} placeholder="Ex. 150,00"/><button type="button" className="text-action" disabled={stats.due<=0} onClick={payFullBalance}>Solde entier</button></div>
          <label htmlFor="pay-note">Note facultative</label>
          <textarea id="pay-note" rows={2} maxLength={400} value={note} onChange={e=>{setNote(e.target.value);clearRequest()}} placeholder="Ex. versement en espèces"/>
          <button disabled={busy || !inputCents || !selected} type="submit" className="small-action payroll-save"><Banknote size={17}/> Confirmer le paiement réel</button>
        </form>
        {kind==='final' && <p className="quiet"><ShieldAlert size={15}/> Le solde de départ est un type de paiement. Archive séparément l'ouvrier dans le registre après son départ.</p>}
      </section>

      <section className="payroll-weekly">
        <h3><CalendarDays size={18}/> Paie du mercredi — {date}</h3>
        <p>Montants enregistrés comme « Paie du mercredi » à cette date. Pour imprimer une feuille de signatures A4, voir la phase 6.</p>
        <div className="payroll-weekly-total"><span>{dailyWeekly.length} versement(s) valide(s)</span><strong>{money(paidWeekly)}</strong></div>
      </section>
      <section className="payroll-history">
        <h3><BookOpenText size={18}/> Historique de {selectedWorker?.full_name}</h3>
        {workerPayments.length===0?<p className="quiet">Aucun versement enregistré pour cet ouvrier.</p>:
        <div className="payroll-list">{workerPayments.map(p=><div key={p.id} className="payroll-row">
          <div className="payroll-row-main"><strong>{paymentLabels[p.kind]}</strong><small>{p.payment_date}{p.note?' · '+p.note:''}</small>
            {alreadyReversed.has(p.id) && <small className="payroll-cancelled">Annulé par contrepassation</small>}
          </div>
          <div className="payroll-row-right"><strong className={p.amount_cents<0?'payroll-negative':''}>{p.amount_cents<0?'− ':''}{money(Math.abs(p.amount_cents))}</strong>
            {p.kind!=='reversal'&&!alreadyReversed.has(p.id)&&<button type="button" className="payroll-reverse" disabled={busy} onClick={()=>void cancelPayment(p)}><RotateCcw size={13}/> Annuler</button>}
          </div>
        </div>)}</div>}
      </section>
    </>}
  </section>
}
