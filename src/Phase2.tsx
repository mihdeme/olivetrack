import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Pencil, RefreshCcw, Save, UsersRound, UserRoundPlus, Archive, RotateCcw, Trash2 } from 'lucide-react'
import {
  addWorker, assignGroup, createGroup, deleteEmptyGroup, editWorker, ensureDay,
  getDay, listAttendance, listGroups, listWorkers, markAbsent, markPresent,
  renameGroup,
  type Worker, type WorkDay, type HarvestGroup, type Attendance,
} from './phase2-data'

function todayLocal(): string {
  const date = new Date()
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
function shiftDate(iso: string, days: number): string {
  const [year, month, date] = iso.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, date + days))
  return utc.toISOString().slice(0, 10)
}
function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur est survenue.'
}
type WorkerForm = { full_name: string; phone: string; notes: string }
const emptyForm: WorkerForm = { full_name: '', phone: '', notes: '' }

export function WorkerRegister() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Worker | 'new' | null>(null)
  const [form, setForm] = useState<WorkerForm>(emptyForm)
  const [showArchived, setShowArchived] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setWorkers(await listWorkers()); setError('') }
    catch (e) { setError(message(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  function beginEdit(worker: Worker | 'new') {
    setEditing(worker)
    setForm(worker === 'new' ? emptyForm : { full_name: worker.full_name, phone: worker.phone ?? '', notes: worker.notes ?? '' })
    setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!editing || !form.full_name.trim()) return
    setBusy(true); setError('')
    try {
      const data = { full_name: form.full_name.trim(), phone: form.phone.trim() || null, notes: form.notes.trim() || null }
      if (editing === 'new') await addWorker(data)
      else await editWorker(editing.id, { ...data, is_active: editing.is_active })
      setEditing(null)
      await refresh()
    } catch (e) { setError(message(e)) }
    finally { setBusy(false) }
  }
  async function setActive(worker: Worker, is_active: boolean) {
    const verb = is_active ? 'réactiver' : 'archiver'
    if (!window.confirm(`Confirmer : ${verb} ${worker.full_name} ? Son historique de présence sera conservé.`)) return
    setBusy(true); setError('')
    try {
      await editWorker(worker.id, { full_name: worker.full_name, phone: worker.phone, notes: worker.notes, is_active })
      await refresh()
    } catch (e) { setError(message(e)) }
    finally { setBusy(false) }
  }
  const visible = workers.filter(w => showArchived || w.is_active)
  return <section className="phase2">
    <div className="section-bar"><div><h2>Registre des ouvriers</h2><p>Identité conservée d'une journée à l'autre, même en cas de départ.</p></div><button className="small-action" onClick={() => beginEdit('new')}><Plus size={17}/> Ajouter</button></div>
    <div className="mini-summary"><span><strong>{workers.filter(w => w.is_active).length}</strong> actifs</span><span><strong>{workers.filter(w => !w.is_active).length}</strong> archivés</span></div>
    {error && <p className="data-error" role="alert">{error}</p>}
    {editing && <form className="editor" onSubmit={submit}>
      <h3>{editing === 'new' ? 'Nouvel ouvrier' : 'Modifier la fiche'}</h3>
      <label htmlFor="worker-name">Nom et prénom *</label><input id="worker-name" required minLength={2} maxLength={120} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ex. Ahmed Benali"/>
      <label htmlFor="worker-phone">Téléphone (facultatif)</label><input id="worker-phone" type="tel" maxLength={40} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="06..."/>
      <label htmlFor="worker-notes">Remarques (facultatives)</label><textarea id="worker-notes" maxLength={500} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Détails utiles"/>
      <div className="editor-buttons"><button type="button" className="text-action" onClick={() => setEditing(null)}>Annuler</button><button className="small-action" disabled={busy} type="submit"><Save size={16}/> Enregistrer</button></div>
    </form>}
    <label className="simple-toggle"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/> Afficher les ouvriers archivés</label>
    {loading ? <p className="quiet">Chargement…</p> : visible.length === 0 ? <div className="muted-panel">Aucun ouvrier enregistré. Ajoute ton premier ouvrier pour commencer.</div> : <div className="work-list">
      {visible.map(worker => <div className="work-row" key={worker.id}>
        <span className="circle-initial">{worker.full_name.slice(0,1).toUpperCase()}</span>
        <div className="work-person"><strong>{worker.full_name}</strong><small>{worker.is_active ? (worker.phone || 'Ouvrier actif') : 'Archivé · historique conservé'}</small></div>
        <button className="icon-action" aria-label={`Modifier ${worker.full_name}`} title="Modifier" onClick={() => beginEdit(worker)}><Pencil size={17}/></button>
        <button disabled={busy} className="icon-action" aria-label={worker.is_active ? 'Archiver' : 'Réactiver'} title={worker.is_active ? 'Archiver' : 'Réactiver'} onClick={() => void setActive(worker, !worker.is_active)}>{worker.is_active ? <Archive size={17}/> : <RotateCcw size={17}/>}</button>
      </div>)}
    </div>}
  </section>
}

export function DailyAttendance() {
  const [date, setDate] = useState(todayLocal)
  const [workers, setWorkers] = useState<Worker[]>([])
  const [day, setDay] = useState<WorkDay | null>(null)
  const [groups, setGroups] = useState<HarvestGroup[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [groupName, setGroupName] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [list, currentDay] = await Promise.all([listWorkers(), getDay(date)])
      setWorkers(list); setDay(currentDay)
      const [groupList, presenceList] = currentDay
        ? await Promise.all([listGroups(currentDay.id), listAttendance(currentDay.id)])
        : [[], []]
      setGroups(groupList); setAttendance(presenceList); setError('')
    } catch(e) { setError(message(e)) }
    finally { setLoading(false) }
  }, [date])
  useEffect(() => { void refresh() }, [refresh])

  async function execute(operation: () => Promise<void>) {
    setBusy(true); setError('')
    try { await operation(); await refresh() }
    catch(e) { setError(message(e)) }
    finally { setBusy(false) }
  }
  async function toggle(worker: Worker) {
    const existing = attendance.find(a => a.worker_id === worker.id)
    await execute(async () => {
      if (existing) {
        if (!window.confirm(`Retirer la présence de ${worker.full_name} pour cette date ?`)) return
        await markAbsent(existing.id)
      } else {
        const targetDay = day ?? await ensureDay(date)
        await markPresent(targetDay.id, worker.id)
      }
    })
  }
  async function submitGroup(event: FormEvent) {
    event.preventDefault()
    const name = groupName.trim()
    if (!name) return
    await execute(async () => { const targetDay = day ?? await ensureDay(date); await createGroup(targetDay.id, name); setGroupName('') })
  }
  async function changeName(group: HarvestGroup) {
    const next = window.prompt('Nom du groupe', group.name)?.trim()
    if (!next || next === group.name) return
    await execute(() => renameGroup(group.id, next))
  }
  async function deleteGroup(group: HarvestGroup) {
    if (!window.confirm(`Supprimer le groupe « ${group.name} » ? Possible seulement s'il est vide.`)) return
    await execute(() => deleteEmptyGroup(group.id))
  }
  const listed = workers.filter(w => w.is_active || showArchived || attendance.some(a => a.worker_id === w.id))
  const unassigned = attendance.filter(a => !a.group_id).length
  return <section className="phase2">
    <div className="date-header"><h2>Présences du jour</h2><div className="date-nav">
      <button className="icon-action" aria-label="Jour précédent" onClick={() => setDate(d => shiftDate(d,-1))}><ChevronLeft size={21}/></button>
      <label className="date-input"><CalendarDays size={18}/><input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} aria-label="Date de travail"/></label>
      <button className="icon-action" aria-label="Jour suivant" onClick={() => setDate(d => shiftDate(d,1))}><ChevronRight size={21}/></button>
    </div></div>
    <p className="date-caption">{formatDate(date)}</p>
    <div className="mini-summary"><span><strong>{attendance.length}</strong> présents</span><span><strong>{groups.length}</strong> groupes</span><span><strong>{unassigned}</strong> sans groupe</span></div>
    {error && <p className="data-error" role="alert">{error}</p>}
    <div className="section-bar"><div><h3>Groupes</h3><p>Un même ouvrier ne peut être affecté qu'à un seul groupe par journée.</p></div></div>
    <form onSubmit={submitGroup} className="inline-form"><input maxLength={80} required placeholder="Nom du groupe (ex. Groupe 1)" aria-label="Nom du nouveau groupe" value={groupName} onChange={e => setGroupName(e.target.value)}/><button className="small-action" type="submit" disabled={busy}><Plus size={17}/> Créer</button></form>
    {groups.length===0 ? <p className="quiet">Aucun groupe créé pour cette date.</p> : <div className="group-list">{groups.map(g => <div className="group-row" key={g.id}><div><strong>{g.name}</strong><small>{attendance.filter(a => a.group_id===g.id).length} ouvrier(s)</small></div><button className="icon-action" onClick={() => void changeName(g)} aria-label={`Renommer ${g.name}`}><Pencil size={16}/></button><button className="icon-action" onClick={() => void deleteGroup(g)} aria-label={`Supprimer ${g.name}`}><Trash2 size={16}/></button></div>)}</div>}
    <div className="section-bar attendance-heading"><div><h3>Ouvriers présents</h3><p>Coche les personnes présentes, puis attribue leur groupe.</p></div><button className="icon-action" aria-label="Actualiser" onClick={() => void refresh()}><RefreshCcw size={18}/></button></div>
    <label className="simple-toggle"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/> Afficher aussi les ouvriers archivés</label>
    {loading ? <p className="quiet">Chargement…</p> : listed.length===0 ? <div className="muted-panel"><UserRoundPlus size={20}/> Commence par ajouter des ouvriers dans l'onglet Ouvriers.</div> : <div className="work-list">
      {listed.map(worker => {
        const row = attendance.find(a => a.worker_id === worker.id)
        return <div className="attendance-row" key={worker.id}>
          <label className="attendance-person"><input disabled={busy} type="checkbox" checked={!!row} onChange={() => void toggle(worker)}/><span><strong>{worker.full_name}</strong><small>{row ? <><Check size={12}/> Présent</> : worker.is_active ? 'Absent / non pointé' : 'Archivé'}</small></span></label>
          {row && <select aria-label={`Groupe de ${worker.full_name}`} value={row.group_id ?? ''} disabled={busy} onChange={e => void execute(() => assignGroup(row.id, e.target.value || null))}><option value="">Sans groupe</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
        </div>
      })}
    </div>}
    <div className="info-hint"><UsersRound size={17}/> Les effectifs peuvent changer chaque jour. Une présence passée est conservée même si l'ouvrier est archivé plus tard.</div>
  </section>
}
