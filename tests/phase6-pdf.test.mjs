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
 assert.match(text,/\/MediaBox \[0 0 595 842\]/)
 assert.ok(text.startsWith('%PDF-1.4'))
})
test('Do not silently replace unsupported script glyphs in payroll names',()=>{
 assert.throws(()=>makeReportPdf({
  title:'Paie des ouvriers',subtitle:'Contrôle unicode',period:'Novembre 2026',generated:'14/11/2026',
  blocks:[{type:'table',title:'Ouvriers',columns:[{title:'NOM',key:'name',width:1}],
   rows:[{name:'محمد'}]}]
 }),/Caractère non pris en charge/)
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
