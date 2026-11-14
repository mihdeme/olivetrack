import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { LayoutDashboard, Sprout, Users, Wallet, Printer, LogOut, ShieldCheck, LockKeyhole, ArrowRight, LoaderCircle, Leaf, AlertCircle } from 'lucide-react'
import { configured, supabase, ownerUserId } from './supabase'
import { DailyAttendance, WorkerRegister } from './Phase2'

type Screen = 'accueil' | 'recolte' | 'ouvriers' | 'caisse' | 'bilans'
const tabs: { id: Screen; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'accueil', label: 'Accueil', icon: LayoutDashboard },
  { id: 'recolte', label: 'Récolte', icon: Sprout },
  { id: 'ouvriers', label: 'Ouvriers', icon: Users },
  { id: 'caisse', label: 'Caisse', icon: Wallet },
  { id: 'bilans', label: 'Bilans', icon: Printer },
]
const descriptions: Record<Screen, { heading: string; description: string }> = {
  accueil: { heading: 'Vue d’ensemble', description: 'Retrouve ici les indicateurs essentiels de la campagne.' },
  recolte: { heading: 'Récolte du jour', description: 'Note les présences et répartis les ouvriers en groupes chaque jour.' },
  ouvriers: { heading: 'Registre des ouvriers', description: 'Ajoute, modifie ou archive les ouvriers sans perdre leur historique.' },
  caisse: { heading: 'Caisse et ventes', description: 'Versements, livraisons et dépenses seront intégrés en phase 5.' },
  bilans: { heading: 'Rapports et impressions', description: 'Les rapports A4 seront disponibles en phase 6.' },
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><Leaf size={24} strokeWidth={2.3} /></span><span><strong>OliveTrack</strong><small>Gestion de campagne oléicole</small></span></div>
}

function SignIn({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setPending(true); setError('')
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) {
        const errorCode = authError.code ?? 'unknown'
        const httpStatus = authError.status ?? 'unknown'
        const providerMessage = authError.message || 'Aucun détail fourni'
        // Show the provider's machine-readable diagnostic without exposing passwords or session tokens.
        setError(`Échec de connexion (HTTP ${httpStatus}, code ${errorCode}) : ${providerMessage}. ${httpStatus === 0 ? 'La requête réseau vers Supabase a échoué : vérifie la connexion au service, et non ton mot de passe.' : ''}`)
        return
      }
      if (!data.user) { setError('Connexion sans utilisateur retourné. Réessaie.'); return }
      if (!ownerUserId || data.user.id !== ownerUserId) {
        await supabase.auth.signOut()
        setError('Ce compte n’est pas autorisé à accéder à OliveTrack.')
        return
      }
      onLogin(data.user)
    } catch {
      setError('Impossible de joindre Supabase. Vérifie ta connexion et réessaie.')
    } finally {
      setPending(false)
    }
  }
  return <main className="auth-screen">
    <div className="auth-top"><Brand /><span className="tag"><ShieldCheck size={14} /> Accès privé</span></div>
    <section className="auth-card">
      <div className="auth-icon"><LockKeyhole size={25} /></div>
      <h1>Bienvenue sur OliveTrack</h1>
      <p>Connecte-toi pour accéder à ton espace de gestion.</p>
      <form onSubmit={submit}>
        <label htmlFor="email">Adresse e-mail</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="adresse@exemple.com" />
        <label htmlFor="password">Mot de passe</label>
        <input id="password" type="password" autoComplete="current-password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Ton mot de passe" />
        {error && <p className="form-error" role="alert"><AlertCircle size={16} />{error}</p>}
        <button className="primary-button" disabled={pending} type="submit">{pending ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />} Se connecter</button>
      </form>
      <div className="footnote">Pas d’inscription publique depuis l’application.</div>
    </section>
  </main>
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>('accueil')
  const current = descriptions[screen]
  return <div className="app-shell">
    <header className="topbar"><Brand /><button className="logout" onClick={onLogout} aria-label="Se déconnecter"><LogOut size={18}/></button></header>
    <main className="content">
      <div className="eyebrow">CAMPAGNE OLÉICOLE · ESPACE PRIVÉ</div>
      <h1>{current.heading}</h1>
      <p className="lead">{current.description}</p>
      {screen === 'accueil' && <div className="metrics">
        <div className="metric"><span>Récolte cumulée</span><strong>— kg</strong><small>En attente de données</small></div>
        <div className="metric"><span>Sacs récoltés</span><strong>—</strong><small>En attente de données</small></div>
        <div className="metric"><span>À payer aux ouvriers</span><strong>— DH</strong><small>En attente de données</small></div>
        <div className="metric"><span>Reste à encaisser</span><strong>— DH</strong><small>En attente de données</small></div>
      </div>}
      {screen === 'ouvriers' && <WorkerRegister/>}
      {screen === 'recolte' && <DailyAttendance/>}
      {screen !== 'ouvriers' && screen !== 'recolte' && <section className="empty-state"><span className="empty-icon">{screen==='caisse'?<Wallet/>:screen==='bilans'?<Printer/>:<ShieldCheck/>}</span><h2>{screen === 'accueil' ? 'Espace prêt pour les données' : 'Module à venir'}</h2><p>Aucune donnée fictive n'est présentée comme réelle. Ce module sera activé après les tests de sa phase.</p><span className="phase-pill">Phase 2 · Registre et présences</span></section>}
      <p className="signed-in">Session ouverte : {user.email}</p>
    </main>
    <nav className="bottom-nav" aria-label="Navigation principale">{tabs.map(tab => { const Icon=tab.icon; return <button key={tab.id} onClick={() => setScreen(tab.id)} aria-current={screen === tab.id ? 'page' : undefined} className={screen === tab.id ? 'active' : ''}><Icon size={21}/><span>{tab.label}</span></button> })}</nav>
  </div>
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let alive = true
    // getUser performs server-side verification rather than trusting cached session data.
    supabase.auth.getUser().then(({ data, error }) => {
      if (!alive) return
      if (error && !/session missing/i.test(error.message)) setSessionError('Vérification de session indisponible. Réessaie plus tard.')
      setUser(data.user?.id === ownerUserId ? data.user : null)
      setLoading(false)
    }).catch(() => { if (alive) {setSessionError('Impossible de contacter le service de connexion.');setLoading(false)} })
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null)
      // Do not treat a locally cached auth event as proof of authorization.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void supabase?.auth.getUser().then(({ data }) => { if (alive) setUser(data.user?.id === ownerUserId ? data.user : null) })
      }
    })
    return () => {alive=false; subscription.subscription.unsubscribe()}
  }, [])
  async function logout() { await supabase?.auth.signOut(); setUser(null) }
  if (!configured || !ownerUserId) return <main className="setup-screen"><Brand/><div className="setup-card"><h1>Configuration requise</h1><p>Les paramètres publics de connexion Supabase doivent être fournis au moment du déploiement.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code><code>VITE_OWNER_USER_ID</code></div></main>
  if (loading) return <main className="loading-screen"><Leaf size={36}/><p>Vérification de la session…</p></main>
  if (sessionError) return <main className="setup-screen"><Brand/><div className="setup-card"><h1>Connexion indisponible</h1><p>{sessionError}</p><button className="primary-button" onClick={() => window.location.reload()}>Réessayer</button></div></main>
  return user ? <Workspace user={user} onLogout={logout}/> : <SignIn onLogin={setUser}/>
}
