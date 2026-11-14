import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, Coins, LockKeyhole, Save, Sprout, TriangleAlert } from 'lucide-react'
import type { Attendance, HarvestGroup, WorkDay, Worker } from './phase2-data'
import { getAllEarnings, getHarvestForDay, money, parseRateCents, parseSacks, saveHarvest, type GroupHarvest, type WorkerEarning } from './phase3-data'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Opération impossible.'
}

function GroupRecord({ group, members, harvest, earnings, onSaved } : {
  group: HarvestGroup
  members: Worker[]
  harvest?: GroupHarvest
  earnings: WorkerEarning[]
  onSaved: () => Promise<void>
}) {
  const [sacks, setSacks] = useState(String(harvest?.sacks ?? 0))
  const [rate, setRate] = useState(harvest ? String(harvest.rate_cents / 100) : '100')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setSacks(String(harvest?.sacks ?? 0))
    setRate(harvest ? String(harvest.rate_cents / 100) : '100')
  }, [harvest?.sacks, harvest?.rate_cents])
  const parsedSacks = parseSacks(sacks)
  const parsedRate = parseRateCents(rate)
  const changed = parsedSacks !== (harvest?.sacks ?? 0) || (harvest && parsedRate !== harvest.rate_cents)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (parsedSacks === null || parsedRate === null) { setError('Indique un nombre entier de sacs et un tarif positif avec deux décimales maximum.'); return }
    if (parsedSacks > 0 && members.length === 0) { setError('Affecte au moins un ouvrier à ce groupe avant de saisir les sacs.'); return }
    if (harvest && parsedSacks === 0 && !window.confirm('Remettre les sacs à zéro ? Cela supprimera les rémunérations calculées pour ce groupe et déverrouillera sa composition.')) return
    if (harvest && parsedSacks > 0 && (parsedSacks !== harvest.sacks || parsedRate !== harvest.rate_cents) && !window.confirm('Modifier les sacs ou le tarif recalculera toutes les rémunérations de ce groupe. Confirmer ?')) return
    setPending(true); setError('')
    try { await saveHarvest(group.id, parsedSacks, parsedRate); await onSaved() }
    catch(e) { setError(errorText(e)) }
    finally { setPending(false) }
  }
  return <div className="harvest-card">
    <div className="harvest-card-top">
      <div><strong>{group.name}</strong><small>{members.length} ouvrier(s) affecté(s)</small></div>
      {harvest ? <span className="saved-chip"><LockKeyhole size={13}/> Enregistré · groupe verrouillé</span> : <span className="draft-chip">Non enregistré</span>}
    </div>
    <form className="harvest-form" onSubmit={submit}>
      <label>Sacs récoltés<input type="number" inputMode="numeric" min={0} max={100000} step={1} required value={sacks} onChange={e => setSacks(e.target.value)}/></label>
      <label>Tarif / sac (DH)<input inputMode="decimal" type="text" required value={rate} onChange={e => setRate(e.target.value)} placeholder="100"/></label>
      <button className="small-action" disabled={pending || !changed || parsedSacks===null || parsedRate===null || (parsedSacks>0 && members.length===0)} type="submit"><Save size={16}/>{harvest ? 'Mettre à jour' : 'Enregistrer'}</button>
    </form>
    {error && <p role="alert" className="data-error">{error}</p>}
    {harvest && <div className="harvest-result">
      <div className="harvest-total"><span>Rémunération totale du groupe</span><strong>{money(harvest.total_cents)}</strong></div>
      <div className="harvest-worker-list">
        {earnings.map(row => {
          const worker = members.find(w => w.id===row.worker_id)
          return <div className="harvest-worker-row" key={row.worker_id}><span>{worker?.full_name ?? 'Ouvrier enregistré'}</span><strong>{money(row.amount_cents)}</strong></div>
        })}
      </div>
      <div className="locked-note"><LockKeyhole size={15}/> Pour changer les membres, mets d'abord les sacs de ce groupe à zéro, puis enregistre à nouveau.</div>
    </div>}
  </div>
}

export function HarvestAccounting({ day, groups, attendance, workers, onChanged }: {
  day: WorkDay | null
  groups: HarvestGroup[]
  attendance: Attendance[]
  workers: Worker[]
  onChanged: () => Promise<void>
}) {
  const [harvests, setHarvests] = useState<GroupHarvest[]>([])
  const [earnings, setEarnings] = useState<WorkerEarning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = day ? await getHarvestForDay(day.id) : { harvests: [], earnings: [] }
      setHarvests(data.harvests); setEarnings(data.earnings); setError('')
    } catch(e) { setError(errorText(e)) }
    finally { setLoading(false) }
  }, [day?.id])
  useEffect(() => { void reload() }, [reload])
  async function afterSaved() { await reload(); await onChanged() }
  const totalSacks = harvests.reduce((sum,h)=>sum+h.sacks,0)
  const totalCents = harvests.reduce((sum,h)=>sum+h.total_cents,0)
  return <section className="harvest-module">
    <div className="section-bar"><div><h2><Sprout size={19}/> Sacs & rémunération</h2><p>Tarif initial 100 DH par sac. Chaque groupe peut avoir son propre tarif pour cette journée.</p></div></div>
    <div className="mini-summary"><span><strong>{totalSacks}</strong> sacs</span><span><strong>{money(totalCents)}</strong> gagnés aujourd'hui</span></div>
    <p className="quiet">Ces montants sont des rémunérations gagnées, pas des paiements effectués. Les avances et versements se trouvent dans Ouvriers → Paies et avances.</p>
    {error && <p role="alert" className="data-error">{error}</p>}
    {loading ? <p className="quiet">Chargement des récoltes…</p> : groups.length===0 ? <div className="muted-panel">Crée d'abord un groupe et affecte-lui des ouvriers.</div> :
      <div className="harvest-cards">{groups.map(group => {
        const harvest = harvests.find(h=>h.group_id===group.id)
        const members = attendance.filter(a=>a.group_id===group.id).map(a=>workers.find(w=>w.id===a.worker_id)).filter((w):w is Worker=>Boolean(w))
        return <GroupRecord key={group.id} group={group} members={members} harvest={harvest} earnings={earnings.filter(e=>e.harvest_id===harvest?.id)} onSaved={afterSaved}/>
      })}</div>}
  </section>
}

export function WorkerEarningsSummary({ workers }: { workers: Worker[] }) {
  const [earnings,setEarnings] = useState<WorkerEarning[]>([])
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  useEffect(()=>{
    let alive=true
    void getAllEarnings().then(rows=>{if(alive)setEarnings(rows)}).catch(e=>{if(alive)setError(errorText(e))}).finally(()=>{if(alive)setLoading(false)})
    return()=>{alive=false}
  },[workers])
  const total = earnings.reduce((sum,e)=>sum+e.amount_cents,0)
  return <section className="earnings-summary">
    <h2><Coins size={19}/> Gains cumulés des ouvriers</h2>
    <p>Montants gagnés depuis le début des enregistrements. Pour connaître les soldes nets après paiements, ouvre Paies et avances.</p>
    {loading ? <p className="quiet">Chargement des rémunérations…</p> : error ? <p className="data-error">{error}</p> : <>
      <div className="harvest-total"><span>Total des rémunérations acquises</span><strong>{money(total)}</strong></div>
      <div className="harvest-worker-list">{workers.filter(w=>earnings.some(e=>e.worker_id===w.id)).map(w=><div className="harvest-worker-row" key={w.id}><span>{w.full_name}{!w.is_active?' (archivé)':''}</span><strong>{money(earnings.filter(e=>e.worker_id===w.id).reduce((sum,e)=>sum+e.amount_cents,0))}</strong></div>)}</div>
      {earnings.length===0 && <p className="quiet"><BadgeCheck size={15}/> Aucun gain enregistré pour le moment.</p>}
      {earnings.length>0 && <p className="quiet"><TriangleAlert size={15}/> Ce total n'est pas le solde à payer. Consulte Paies et avances pour les versements et soldes nets.</p>}
    </>}
  </section>
}
