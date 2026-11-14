import { useState } from 'react'
import { Archive, CheckCircle2, Download, ShieldAlert } from 'lucide-react'
import { prepareBackup, downloadBackup } from './backup'

export function BackupPanel(){
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 async function exportData(){
  if(busy)return
  if(!window.confirm('Exporter toutes les données de campagne (noms, téléphones, rémunérations et mouvements financiers) vers un fichier NON CHIFFRÉ sur cet appareil ?\n\nConserve-le dans un emplacement privé et protégé. Ne le partage pas.'))return
  setBusy(true);setError('');setSuccess('')
  try{
   const payload=await prepareBackup()
   const number=Object.values(payload.row_counts).reduce((sum,n)=>sum+n,0)
   downloadBackup(payload)
   setSuccess('Sauvegarde préparée : '+number+' enregistrements dans '+Object.keys(payload.row_counts).length+' tables. Vérifie sa présence dans Fichiers/Téléchargements.')
  }catch(e){
   setError(e instanceof Error?e.message:'Export impossible. Réessaie.')
  }finally{setBusy(false)}
 }
 return <details className="backup-panel">
  <summary className="backup-panel-title"><Archive size={21}/><span><strong>Copie de sauvegarde</strong><small>Exporter les dix tables de la campagne (privé)</small></span></summary>
  <div className="backup-content">
  <p>À conserver dans un espace privé sécurisé, idéalement avant la saison et chaque semaine. Le fichier JSON contient des données personnelles et financières <strong>non chiffrées</strong>.</p>
  <button type="button" className="backup-export" onClick={()=>void exportData()} disabled={busy}>
   <Download size={17}/>{busy?'Préparation de la copie…':'Exporter mes données (.json)'}
  </button>
  <div className="backup-caution"><ShieldAlert size={16}/><span>Cet export est une copie de secours et de contrôle. La restauration complète n’est pas automatisée ; les sauvegardes de la base Supabase doivent aussi être vérifiées.</span></div>
  {error&&<p className="data-error" role="alert">{error}</p>}
  {success&&<p className="backup-success" role="status"><CheckCircle2 size={16}/>{success}</p>}
  </div>
 </details>
}
