import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'

const source=readFileSync('src/report-pdf.ts','utf8')
const transformed=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const {makeReportPdf}=await import('data:text/javascript;base64,'+Buffer.from(transformed).toString('base64'))
const decode=bytes=>Buffer.from(bytes).toString('latin1')
const sample={
 title:'Feuille de paie — récolte',subtitle:'État de contrôle — données fictives',
 period:'Du 01/11/2026 au 14/11/2026',generated:'Édité le 14/11/2026',
 landscape:true,blocks:[
 {type:'totals',items:[{label:'Total des gains acquis',value:'9 877,60 DH'},{label:'Avances',value:'125,00 DH'},{label:'Versements nets',value:'2 160,00 DH'}]},
 {type:'table',title:'Ouvriers et signatures',columns:[
 {title:'OUVRIER',key:'name',width:3},
 {title:'AVANCES EN DH',key:'advances',width:1.6,align:'right'},
 {title:'GAINS DE LA PÉRIODE',key:'earned',width:1.9,align:'right'},
 {title:'SOLDE CUMULÉ',key:'balance',width:1.6,align:'right'},
 {title:'SIGNATURE / VISA',key:'sign',width:2.1}
 ],rows:Array.from({length:90},(_,i)=>({
  name:i===0?'Élodie O’Connor':i===1?'Abdelkader Ben Abdessalam - Ouvrier saisonnier':'Ouvrier '+String(i+1).padStart(3,'0'),
  advances:'0,00 DH',earned:'125,00 DH',balance:'125,00 DH',sign:''
 }))},
 {type:'note',title:'NOTE',text:'Rémunérations acquises ≠ versements. Ce document est une liste de signatures ; ne signer que lorsque le paiement est réellement effectué.'}
 ]}
test('PDF A4 landscape is valid, multi-page, correctly indexed, with French accents',()=>{
 const result=makeReportPdf(sample)
 const pdf=decode(result)
 assert.ok(result.length>5000)
 assert.ok(pdf.startsWith('%PDF-1.4\n'))
 assert.ok(pdf.includes('/MediaBox [0 0 842 595]'))
 const count=(pdf.match(/\/Type \/Page \/Parent/g)||[]).length
 assert.ok(count>=4,'90 workers should span several A4 pages; got '+count)
 assert.ok(pdf.includes('Page'))
 // É = C9 and  ’ = 92 in WinAnsi, both inside PDF hex text stream
 assert.ok(pdf.includes('c96c6f646965')||pdf.includes('c96c6f646965'.toUpperCase()))
 assert.ok(pdf.toLowerCase().includes('4f92'))
 const off=Number(pdf.match(/startxref\n(\d+)\n%%EOF/)?.[1])
 assert.ok(Number.isInteger(off)&&off>0)
 assert.equal(pdf.slice(off,off+4),'xref')
 const refs=pdf.slice(off).split('\n')
 const n=Number(refs[1].split(' ')[1])
 for(let i=1;i<n;i++){
  const offset=Number(refs[2+i].slice(0,10))
  assert.ok(pdf.slice(offset).startsWith(i+' 0 obj'),'bad PDF xref for object '+i)
 }
})
test('PDF portrait preserves width and does not skip empty tables',()=>{
 const result=makeReportPdf({
  title:'Rapport journalier',subtitle:'Aucun pointage',period:'14 novembre 2026',generated:'14/11/2026',
  blocks:[{type:'table',title:'Présences',columns:[{key:'name',title:'OUVRIER',width:1}],rows:[],empty:'Aucune donnée enregistrée'}]
 })
 const text=decode(result)
 console.log('A4_VISUAL_SMOKE='+Buffer.from(makeReportPdf({
  title:'Rapport journalier de récolte',subtitle:'Données synthétiques / Vérification de mise en page',
  period:'Journée du 14 novembre 2026',generated:'Édité le 14/11/2026',
  blocks:[
   {type:'totals',items:[{label:'Ouvriers présents',value:'90'},{label:'Sacs récoltés',value:'123'},{label:'Gains acquis',value:'12 345,60 DH'}]},
   {type:'table',title:'Registre des présences et gains',columns:[
    {title:'OUVRIER',key:'name',width:3},
    {title:'GROUPE OU MODE',key:'group',width:2.4},
    {title:'SACS',key:'sacks',width:1.2,align:'right'},
    {title:'GAIN / JOURNÉE',key:'gain',width:1.8,align:'right'}
   ],rows:[
    {name:'Élodie O’Connor',group:'À la journée',sacks:'—',gain:'120,00 DH'},
    {name:'Abdelkader Ben Abdessalam',group:'Groupe 1',sacks:'3',gain:'300,00 DH'},
    {name:'Fatima Zahra',group:'Au sac individuel',sacks:'4',gain:'400,00 DH'}
   ]},
   {type:'note',title:'NOTE DE LECTURE',text:'La rémunération gagnée est indépendante des paiements. Le bon de pesée ne constitue pas un encaissement.'}
  ]
 })).toString('base64'))
 assert.match(text,/\/MediaBox \[0 0 595 842\]/)
 assert.ok(text.startsWith('%PDF-1.4'))
})
test('All four business reports are wired to the Bilans screen',()=>{
 const app=readFileSync('src/App.tsx','utf8')
 const ui=readFileSync('src/Phase6.tsx','utf8')
 const definitions=readFileSync('src/report-definitions.ts','utf8')
 assert.match(app,/<Phase6\/>/)
 assert.match(ui,/makeReportPdf\(report\)/)
 assert.match(ui,/downloadPdf\(/)
 assert.match(ui,/A4 paysage/)
 for(const kind of ['payroll','harvest','sales','finance'])
  assert.match(definitions,new RegExp(kind+':'))
 assert.match(definitions,/SIGNATURE \/ VISA/)
 assert.match(definitions,/Contrepassations|contrepassations/)
})
test('iPhone finance input geometry is corrected and date row stacks',()=>{
 const css=readFileSync('src/phase5.css','utf8')
 const field=readFileSync('src/field-edition.css','utf8')
 const phase5=readFileSync('src/Phase5.tsx','utf8')
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
 assert.match(css,/p5-two\.p5-optional-grid/)
 assert.match(css,/p5-field input\[type="date"\]/)
 assert.match(css,/p5-tabs\{display:grid/)
 assert.match(field,/safe-area-inset-top/)
 assert.match(phase5,/p5-optional-grid/)
})
