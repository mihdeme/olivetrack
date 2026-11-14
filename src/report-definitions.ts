import { money } from './phase3-data'
import { formatKg, categoryLabels, kindLabels, methodLabels, type Entry } from './phase5-data'
import { paymentLabels, type WorkerPayment } from './phase4-data'
import type { PdfReport, PdfRow } from './report-pdf'
import type { ReportData } from './report-data'

export type ReportKind='payroll'|'harvest'|'sales'|'finance'
export const reportNames:Record<ReportKind,string>={
 payroll:'Feuille de paie & émargement',
 harvest:'Rapport journalier de récolte',
 sales:'État des ventes et encaissements',
 finance:'Bilan financier de campagne'
}
export function within(date:string,from:string,to:string){return date>=from && date<=to}
const sum=(values:number[])=>values.reduce((a,b)=>a+b,0)
const dateFR=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'}):'—'
const moneyShort=(cents:number)=>money(cents)
function signingDate(){return new Date().toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function start(kind:ReportKind,from:string,to:string):PdfReport{
 return {
  title:reportNames[kind],subtitle:'État extrait du registre OliveTrack',
  generated:'Édité le '+signingDate(),
  period:kind==='harvest'?'Journée du '+dateFR(from):'Du '+dateFR(from)+' au '+dateFR(to),
  landscape:kind==='payroll',
  blocks:[],
 }
}
function payKind(payment:WorkerPayment,all:WorkerPayment[]){
 if(payment.kind!=='reversal')return payment.kind
 return all.find(x=>x.id===payment.reversal_of)?.kind??'reversal'
}
function payrollReport(data:ReportData,from:string,to:string):PdfReport{
 const report=start('payroll',from,to)
 const dayMap=new Map(data.days.map(d=>[d.id,d.work_date]))
 const harvestMap=new Map(data.harvests.map(h=>[h.id,dayMap.get(h.work_day_id)??'']))
 const rows:PdfRow[]=[]
 let earnedPeriod=0,paidPeriod=0,balanceEnd=0,advancesPeriod=0
 for(const w of data.workers){
  const group=data.groupEarnings.filter(g=>g.worker_id===w.id)
   .map(g=>({date:harvestMap.get(g.harvest_id)??'',amount:g.amount_cents}))
  const indiv=data.individual.filter(i=>i.worker_id===w.id)
   .map(i=>({date:dayMap.get(i.work_day_id)??'',amount:i.amount_cents}))
  const incomes=[...group,...indiv]
  const payments=data.payments.filter(p=>p.worker_id===w.id)
  const gained=sum(incomes.filter(i=>within(i.date,from,to)).map(x=>x.amount))
  const paid=sum(payments.filter(p=>within(p.payment_date,from,to)).map(x=>x.amount_cents))
  const advances=sum(payments.filter(p=>within(p.payment_date,from,to)&&payKind(p,data.payments)==='advance').map(p=>p.amount_cents))
  const priorIncome=sum(incomes.filter(i=>i.date<=to).map(i=>i.amount))
  const priorPayments=sum(payments.filter(p=>p.payment_date<=to).map(p=>p.amount_cents))
  const balance=priorIncome-priorPayments
  if(gained===0&&paid===0&&balance===0)continue
  earnedPeriod+=gained;paidPeriod+=paid;advancesPeriod+=advances;balanceEnd+=balance
  rows.push({name:w.full_name,earned:moneyShort(gained),advance:moneyShort(advances),paid:moneyShort(paid),
   balance:moneyShort(balance),signature:''})
 }
 rows.sort((a,b)=>a.name.localeCompare(b.name,'fr'))
 report.blocks.push(
  {type:'totals',items:[
   {label:'Gains acquis / période',value:moneyShort(earnedPeriod)},
   {label:'Avances versées / période',value:moneyShort(advancesPeriod)},
   {label:'Versements nets / période',value:moneyShort(paidPeriod)},
   {label:'Solde de tous les ouvriers au '+dateFR(to),value:moneyShort(balanceEnd)}
  ]},
  {type:'table',title:'Liste nominative et signatures',columns:[
   {title:'OUVRIER',key:'name',width:3.5},
   {title:'GAINS',key:'earned',width:1.25,align:'right'},
   {title:'AVANCES',key:'advance',width:1.25,align:'right'},
   {title:'VERSÉ NET',key:'paid',width:1.25,align:'right'},
   {title:'SOLDE',key:'balance',width:1.25,align:'right'},
   {title:'SIGNATURE / VISA',key:'signature',width:2.2}
  ],rows,empty:'Aucun gain ni paiement sur cette période.'}
 )
 report.footerNote='Gains et versements de la période sont distincts. Le solde par ouvrier est calculé depuis le début des données jusqu’à la date de fin sélectionnée. Une signature n’atteste un versement que si celui-ci a réellement eu lieu. Les contrepassations sont intégrées aux montants nets.'
 return report
}
function harvestReport(data:ReportData,date:string):PdfReport{
 const report=start('harvest',date,date)
 const day=data.days.find(d=>d.work_date===date)
 const at=data.attendances.filter(a=>a.work_day_id===day?.id)
 const groups=data.groups.filter(g=>g.work_day_id===day?.id)
 const harvests=data.harvests.filter(h=>h.work_day_id===day?.id)
 const indiv=data.individual.filter(i=>i.work_day_id===day?.id)
 const groupEarning=new Map<string,number>()
 const earningsByHarvest=new Map(harvests.map(h=>[h.id,h]))
 for(const e of data.groupEarnings){
  if(!earningsByHarvest.has(e.harvest_id))continue
  groupEarning.set(e.worker_id,(groupEarning.get(e.worker_id)??0)+e.amount_cents)
 }
 const perWorker:PdfRow[]=at.map(a=>{
  const worker=data.workers.find(w=>w.id===a.worker_id)
  const individual=indiv.find(i=>i.worker_id===a.worker_id)
  const group=groups.find(g=>g.id===a.group_id)
  const harvest=harvests.find(h=>h.group_id===group?.id)
  return {
   worker:worker?.full_name??'Ouvrier inconnu',
   assignment:group?.name??'Sans groupe',
   mode:individual?(individual.mode==='daily'?'Journée':'Sac individuel'):group?(harvest?'Sac collectif':'Groupe non valorisé'):'Non valorisé',
   quantity:individual?(individual.mode==='daily'?'1 jour':individual.quantity+' sac(s)'):group?(harvest?harvest.sacks+' sacs / gr.':'—'):'—',
   amount:moneyShort((individual?.amount_cents??0)+(groupEarning.get(a.worker_id)??0))
  }
 }).sort((a,b)=>a.assignment.localeCompare(b.assignment,'fr')||a.worker.localeCompare(b.worker,'fr'))
 const soloSacks=sum(indiv.filter(i=>i.mode==='individual_sacks').map(i=>i.quantity))
 const groupSacks=sum(harvests.map(h=>h.sacks))
 const earned=sum(harvests.map(h=>h.total_cents))+sum(indiv.map(i=>i.amount_cents))
 report.blocks.push(
  {type:'totals',items:[
   {label:'Ouvriers présents',value:String(at.length)},
   {label:'Sacs saisis (groupes + individuels)',value:String(groupSacks+soloSacks)},
   {label:'Rémunérations acquises',value:moneyShort(earned)}
  ]},
  {type:'table',title:'Production par groupe',columns:[
   {title:'GROUPE',key:'group',width:3},
   {title:'OUVRIERS',key:'workers',width:1.2,align:'right'},
   {title:'SACS',key:'sacks',width:1.2,align:'right'},
   {title:'TARIF / SAC',key:'rate',width:1.8,align:'right'},
   {title:'COÛT TOTAL',key:'total',width:1.8,align:'right'}
  ],rows:groups.map(g=>{
   const h=harvests.find(x=>x.group_id===g.id)
   return {group:g.name,workers:String(at.filter(a=>a.group_id===g.id).length),
    sacks:String(h?.sacks??0),rate:h?moneyShort(h.rate_cents):'—',total:h?moneyShort(h.total_cents):'—'}
  }),empty:'Aucun groupe pour cette date.'},
  {type:'table',title:'Registre détaillé des présences',columns:[
   {title:'OUVRIER',key:'worker',width:2.5},
   {title:'AFFECTATION',key:'assignment',width:1.7},
   {title:'MODE',key:'mode',width:2},
   {title:'QUANTITÉ',key:'quantity',width:1.5},
   {title:'GAIN',key:'amount',width:1.6,align:'right'}
  ],rows:perWorker,empty:'Aucun pointage enregistré ce jour.'}
 )
 report.footerNote='Les sacs sont les quantités déclarées par les équipes (pas nécessairement les sacs livrés à l’acheteur). Les montants sont des rémunérations gagnées, non des paiements. Les personnes présentes sans rémunération restent visibles.'
 return report
}
function effective(items:Entry[],kinds:string[]){return items.filter(e=>kinds.includes(e.kind))}
function salesReport(data:ReportData,from:string,to:string):PdfReport{
 const report=start('sales',from,to)
 const entries=data.ledger.filter(e=>within(e.entry_date,from,to))
 const sales=effective(entries,['sale','sale_reversal'])
 const receipts=effective(entries,['receipt','receipt_reversal'])
 const sold=sum(sales.map(e=>e.amount_cents)),paid=sum(receipts.map(e=>e.amount_cents))
 const soldWeight=sum(sales.map(e=>e.weight_grams??0))
 report.blocks.push(
  {type:'totals',items:[
   {label:'Ventes de la période',value:moneyShort(sold)},
   {label:'Encaissements de la période',value:moneyShort(paid)},
   {label:'Écart des flux de la période',value:moneyShort(sold-paid)},
   {label:'Poids net livré dans la période',value:formatKg(soldWeight)}
  ]},
  {type:'table',title:'Relevé par acheteur',columns:[
   {title:'ACHETEUR',key:'buyer',width:2.8},
   {title:'VENDU / PÉRIODE',key:'sold',width:1.8,align:'right'},
   {title:'REÇU / PÉRIODE',key:'paid',width:1.8,align:'right'},
   {title:'SOLDE CUMULÉ AU '+to,key:'due',width:2.2,align:'right'}
  ],rows:data.buyers.map(b=>{
   const all=data.ledger.filter(e=>e.buyer_id===b.id&&e.entry_date<=to)
   const current=entries.filter(e=>e.buyer_id===b.id)
   return {buyer:b.name,sold:moneyShort(sum(effective(current,['sale','sale_reversal']).map(e=>e.amount_cents))),
    paid:moneyShort(sum(effective(current,['receipt','receipt_reversal']).map(e=>e.amount_cents))),
    due:moneyShort(sum(effective(all,['sale','sale_reversal']).map(e=>e.amount_cents))-sum(effective(all,['receipt','receipt_reversal']).map(e=>e.amount_cents)))}
  }).filter(r=>r.sold!==moneyShort(0)||r.paid!==moneyShort(0)||r.due!==moneyShort(0)),empty:'Aucune vente, aucun encaissement ni solde acheteur.'},
  {type:'table',title:'Détail des bons de pesée',columns:[
   {title:'DATE',key:'date',width:1.2},
   {title:'ACHETEUR',key:'buyer',width:2},
   {title:'N° BON',key:'ref',width:1.5},
   {title:'POIDS',key:'weight',width:1.5,align:'right'},
   {title:'PRIX / KG',key:'price',width:1.2,align:'right'},
   {title:'VALEUR',key:'total',width:1.5,align:'right'}
  ],rows:sales.map(e=>({
   date:e.entry_date,buyer:data.buyers.find(b=>b.id===e.buyer_id)?.name??'—',
   ref:e.reference||(e.kind==='sale_reversal'?'ANNULATION':'—'),weight:formatKg(e.weight_grams??0),
   price:moneyShort(e.unit_price_cents??0),total:moneyShort(e.amount_cents)
  })),empty:'Aucun bon de pesée dans cette période.'},
  {type:'table',title:'Détail des encaissements',columns:[
   {title:'DATE',key:'date',width:1.5},
   {title:'ACHETEUR',key:'buyer',width:2.4},
   {title:'RÉFÉRENCE',key:'ref',width:1.8},
   {title:'MODE',key:'method',width:1.4},
   {title:'REÇU',key:'total',width:1.6,align:'right'}
  ],rows:receipts.map(e=>({date:e.entry_date,buyer:data.buyers.find(b=>b.id===e.buyer_id)?.name??'—',
   ref:e.reference||'—',method:e.method?(methodLabels[e.method as keyof typeof methodLabels]??e.method):'—',total:moneyShort(e.amount_cents)})),empty:'Aucun encaissement dans cette période.'}
 )
 report.footerNote='Le solde cumulé par acheteur intègre toutes les opérations jusqu’à la date de fin. Les montants vendus et réellement encaissés ne sont pas équivalents. Les contrepassations apparaissent en négatif ; un solde négatif correspond à une avance reçue de l’acheteur.'
 return report
}
function financialReport(data:ReportData,from:string,to:string):PdfReport{
 const report=start('finance',from,to)
 const entries=data.ledger.filter(e=>within(e.entry_date,from,to))
 const sales=effective(entries,['sale','sale_reversal']),receipts=effective(entries,['receipt','receipt_reversal'])
 const expenses=effective(entries,['expense','expense_reversal'])
 const payments=data.payments.filter(p=>within(p.payment_date,from,to))
 const sold=sum(sales.map(x=>x.amount_cents)),received=sum(receipts.map(x=>x.amount_cents))
 const expense=sum(expenses.map(x=>x.amount_cents)),wages=sum(payments.map(x=>x.amount_cents))
 const balances=data.ledger.filter(e=>e.entry_date<=to)
 const buyerBalance=sum(effective(balances,['sale','sale_reversal']).map(e=>e.amount_cents))-sum(effective(balances,['receipt','receipt_reversal']).map(e=>e.amount_cents))
 const dayDates=new Map(data.days.map(d=>[d.id,d.work_date]))
 const hDates=new Map(data.harvests.map(h=>[h.id,dayDates.get(h.work_day_id)??'']))
 const earnedToEnd=sum(data.groupEarnings.filter(e=>(hDates.get(e.harvest_id)??'')<=to).map(e=>e.amount_cents))+
  sum(data.individual.filter(i=>(dayDates.get(i.work_day_id)??'')<=to).map(i=>i.amount_cents))
 const paidToEnd=sum(data.payments.filter(p=>p.payment_date<=to).map(p=>p.amount_cents))
 report.blocks.push(
  {type:'totals',items:[
   {label:'Ventes valorisées / période',value:moneyShort(sold)},
   {label:'Encaissements reçus / période',value:moneyShort(received)},
   {label:'Dépenses d’exploitation / période',value:moneyShort(expense)},
   {label:'Versements ouvriers nets / période',value:moneyShort(wages)},
   {label:'Flux financier net enregistré',value:moneyShort(received-expense-wages)},
   {label:'Créance acheteurs cumulée au '+dateFR(to),value:moneyShort(buyerBalance)},
   {label:'Solde dû aux ouvriers au '+dateFR(to),value:moneyShort(earnedToEnd-paidToEnd)}
  ]},
  {type:'note',title:'IMPORTANT - PÉRIMÈTRE DU FLUX',
   text:'Le flux financier net couvre les entrées et sorties enregistrées, tous moyens de paiement confondus. Ce n’est ni le solde des espèces disponibles ni le solde bancaire : les apports initiaux de fonds et les transferts non opérationnels ne sont pas intégrés.'},
  {type:'table',title:'Charges d’exploitation par catégorie',columns:[
   {title:'CATÉGORIE',key:'category',width:3.4},
   {title:'NOMBRE D’ÉCRITURES',key:'count',width:2.2,align:'right'},
   {title:'TOTAL',key:'total',width:2.4,align:'right'}
  ],rows:Object.entries(categoryLabels).map(([key,value])=>{
   const rows=expenses.filter(e=>e.category===key)
   return {category:value,count:String(rows.length),total:moneyShort(sum(rows.map(e=>e.amount_cents)))}
  }).filter(x=>x.count!=='0'),empty:'Aucune dépense de cette période.'},
  {type:'table',title:'Livre financier des opérations',columns:[
   {title:'DATE',key:'date',width:1.3},
   {title:'OPÉRATION',key:'kind',width:2},
   {title:'PARTENAIRE / CATÉGORIE',key:'counterparty',width:2.5},
   {title:'RÉFÉRENCE',key:'reference',width:1.7},
   {title:'MONTANT',key:'total',width:1.6,align:'right'}
  ],rows:entries.map(e=>({
   date:e.entry_date,kind:kindLabels[e.kind],
   counterparty:e.buyer_id?(data.buyers.find(b=>b.id===e.buyer_id)?.name??'—'):(categoryLabels[e.category as keyof typeof categoryLabels]??'—'),
   reference:e.reference||'—',total:moneyShort(e.amount_cents)
  })).concat(payments.map(p=>({
   date:p.payment_date,kind:'Paiement ouvrier',
   counterparty:data.workers.find(w=>w.id===p.worker_id)?.full_name??'Ouvrier',
   reference:paymentLabels[p.kind],total:moneyShort(-p.amount_cents)
  }))).sort((a,b)=>a.date.localeCompare(b.date)),empty:'Aucune opération financière dans cette période.'}
 )
 report.footerNote='Les charges des ouvriers apparaissent uniquement au paiement effectif dans le flux net, sans doublon dans les dépenses d’exploitation. Le rapport est une photographie des écritures actuellement enregistrées et de leurs corrections.'
 return report
}
export function buildReport(kind:ReportKind,data:ReportData,from:string,to:string):PdfReport{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('Sélectionne une période valide.')
 if(kind==='payroll')return payrollReport(data,from,to)
 if(kind==='harvest')return harvestReport(data,from)
 if(kind==='sales')return salesReport(data,from,to)
 return financialReport(data,from,to)
}
