/* OliveTrack: standalone A4 PDF engine. No CDN, no screenshot, no external fonts.
 * Vector layout with WinAnsi Helvetica supports French accents and printable PDFs
 * even on iOS Safari. Dynamic pagination and repeated column headings. */
export type PdfColumn={title:string;key:string;width:number;align?:'left'|'right'|'center'}
export type PdfRow=Record<string,string>
export type PdfBlock=
 | {type:'table';title:string;columns:PdfColumn[];rows:PdfRow[];empty?:string}
 | {type:'note';title?:string;text:string}
 | {type:'totals';items:{label:string;value:string}[]}
export type PdfReport={
 title:string;subtitle:string;period:string;generated:string;landscape?:boolean;
 blocks:PdfBlock[];footerNote?:string
}
type PdfPage={streams:string[]}
const paper={ivory:[.976,.979,.967],olive:[.105,.224,.165],moss:[.322,.439,.325],
 mist:[.922,.949,.917],line:[.858,.884,.852],white:[1,1,1],muted:[.413,.489,.419],ochre:[.73,.55,.31]} as const
type Color=readonly [number,number,number]
const number=(v:number)=>Number(v.toFixed(3)).toString()
const color=(c:Color,stroke=false)=>c.map(number).join(' ')+(stroke?' RG':' rg')
const cps:Record<number,number>={
 8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,
 710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,
 8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,
 8482:153,353:154,8250:155,339:156,382:158,376:159
}
function hexText(raw:string){
 let value=''
 for(const char of raw.normalize('NFC')){
  const cp=char.codePointAt(0)??63
  const b=cp<=255?cp:cps[cp]??63
  value+=b.toString(16).padStart(2,'0')
 }
 return '<'+value+'>'
}
function approximateWidth(s:string,size:number,bold=false){
 let units=0
 for(const c of s){
  if(/[ilI1.,:;!|\\s]/.test(c))units+=.28
  else if('W@Mmw'.includes(c))units+=.79
  else if(/[A-Z0-9]/.test(c))units+=.61
  else units+=.51
 }
 return units*size*(bold?1.035:1)
}
function splitText(raw:string,width:number,size:number,bold=false,max=50):string[]{
 const text=raw.replace(/\s+/g,' ').trim()
 if(!text)return ['']
 const words=text.split(' ')
 const output:string[]=[]
 let line=''
 for(let word of words){
  while(approximateWidth(word,size,bold)>width && word.length>1){
   let cut=1
   while(cut<word.length&&approximateWidth(word.slice(0,cut+1),size,bold)<=width)cut++
   if(line){output.push(line);line=''}
   output.push(word.slice(0,cut))
   word=word.slice(cut)
  }
  const next=line?line+' '+word:word
  if(approximateWidth(next,size,bold)<=width||!line)line=next
  else{output.push(line);line=word}
  if(output.length>=max)return output
 }
 if(line)output.push(line)
 return output
}
function cutLines(lines:string[],max:number,width:number,size:number):string[]{
 if(lines.length<=max)return lines
 const subset=lines.slice(0,max)
 let last=subset[max-1]
 while(last.length>0&&approximateWidth(last+'…',size)>width)last=last.slice(0,-1)
 subset[max-1]=last+'…'
 return subset
}
class Painter{
 readonly w:number;readonly h:number;readonly margin:number
 private pages:PdfPage[]=[]
 private page!:PdfPage
 private y=0
 constructor(readonly landscape=false){
  this.w=landscape?842:595;this.h=landscape?595:842;this.margin=landscape?38:42
  this.newPage()
 }
 private push(s:string){this.page.streams.push(s)}
 private newPage(){
  this.page={streams:[]};this.pages.push(this.page)
  this.y=108
  this.rectangle(0,0,this.w,this.h,paper.white)
  this.rectangle(0,0,this.w,8,paper.olive)
 }
 rectangle(x:number,top:number,w:number,h:number,fill:Color){
  this.push(color(fill)+'\n'+number(x)+' '+number(this.h-top-h)+' '+number(w)+' '+number(h)+' re f\n')
 }
 line(x1:number,top1:number,x2:number,top2:number,c:Color=paper.line,width=.65){
  this.push(color(c,true)+'\n'+number(width)+' w\n'+number(x1)+' '+number(this.h-top1)+' m '+number(x2)+' '+number(this.h-top2)+' l S\n')
 }
 text(text:string,x:number,top:number,size=9,bold=false,fill:Color=paper.olive,align:'left'|'right'|'center'='left'){
  const left=align==='left'?x:align==='right'?x-approximateWidth(text,size,bold):x-approximateWidth(text,size,bold)/2
  this.push(color(fill)+'\nBT /'+(bold?'F2':'F1')+' '+number(size)+' Tf 1 0 0 1 '+number(left)+' '+number(this.h-top-size)+' Tm '+hexText(text)+' Tj ET\n')
 }
 private pageBreak(height:number){
  if(this.y+height>this.h-62){this.newPage();return true}
  return false
 }
 header(report:PdfReport){
  this.pages=[]
  this.newPage()
  // header is repeated by finish() on extra pages, but first page gets the full title.
  this.rectangle(this.margin,33,37,37,paper.olive)
  this.text('OT',this.margin+18.5,41,13,true,paper.white,'center')
  this.text('OLIVETRACK',this.margin+48,35,10,true,paper.olive)
  this.text('CARNET DE CAMPAGNE',this.margin+48,50,7,false,paper.muted)
  this.text(report.generated,this.w-this.margin,44,8,false,paper.muted,'right')
  this.line(this.margin,82,this.w-this.margin,82)
  this.text(report.title,this.margin,94,21,true)
  this.text(report.subtitle,this.margin,123,9,false,paper.muted)
  this.rectangle(this.margin,145,this.w-2*this.margin,26,paper.mist)
  this.text(report.period,this.margin+12,153,9,true)
  this.y=193
 }
 section(title:string){
  this.pageBreak(37)
  this.text(title,this.margin,this.y,13,true)
  this.line(this.margin,this.y+22,this.w-this.margin,this.y+22)
  this.y+=34
 }
 note(text:string,title?:string){
  const maxWidth=this.w-2*this.margin-28
  const lines=splitText(text,maxWidth,9)
  const height=lines.length*13+25+(title?15:0)
  if(this.pageBreak(height))this.y=108
  this.rectangle(this.margin,this.y,this.w-2*this.margin,height,paper.mist)
  let y=this.y+12
  if(title){this.text(title,this.margin+14,y,9,true);y+=17}
  lines.forEach(line=>{this.text(line,this.margin+14,y,9,false,paper.moss);y+=13})
  this.y+=height+15
 }
 totals(items:{label:string;value:string}[]){
  const gap=8;const cols=items.length<=2?items.length:Math.min(3,items.length)
  const w=(this.w-2*this.margin-(cols-1)*gap)/cols
  for(let i=0;i<items.length;i+=cols){
   this.pageBreak(66)
   items.slice(i,i+cols).forEach((item,j)=>{
    const x=this.margin+j*(w+gap)
    this.rectangle(x,this.y,w,60,paper.mist)
    const label=cutLines(splitText(item.label,w-20,8),2,w-20,8)
    label.forEach((line,n)=>this.text(line,x+10,this.y+9+n*10,8,false,paper.muted))
    const size=approximateWidth(item.value,15,true)>w-20?11:15
    this.text(item.value,x+10,this.y+32,size,true)
   })
   this.y+=68
  }
  this.y+=11
 }
 table(title:string,columns:PdfColumn[],rows:PdfRow[],empty='Aucune donnée enregistrée'){
  this.section(title)
  const width=this.w-2*this.margin
  const sum=columns.reduce((s,x)=>s+x.width,0)
  const sizes=columns.map(c=>width*c.width/sum)
  const header=()=>{
   const labels=columns.map((c,i)=>cutLines(splitText(c.title,sizes[i]-16,7.2,true),3,sizes[i]-16,7.2))
   const h=Math.max(27,...labels.map(lines=>lines.length*9+12))
   this.rectangle(this.margin,this.y,width,h,paper.olive)
   let x=this.margin
   columns.forEach((c,i)=>{
    const align=c.align??'left'
    const tx=align==='right'?x+sizes[i]-8:align==='center'?x+sizes[i]/2:x+9
    labels[i].forEach((line,n)=>this.text(line,tx,this.y+8+n*9,7.2,true,paper.white,align))
    x+=sizes[i]
   })
   this.y+=h
  }
  header()
  if(rows.length===0){
   this.text(empty,this.margin+9,this.y+11,9,false,paper.muted)
   this.y+=32;return
  }
  rows.forEach((row,index)=>{
   const cells=columns.map((c,i)=>cutLines(splitText(String(row[c.key]??''),sizes[i]-16,8,c.key==='total',12),4,sizes[i]-16,8))
   const height=Math.max(25,...cells.map(lines=>lines.length*11+13))
   if(this.pageBreak(height+7)){
    this.text(title+' (suite)',this.margin,83,10,true)
    this.y=108
    header()
   }
   if(index%2===0)this.rectangle(this.margin,this.y,width,height,paper.ivory)
   let x=this.margin
   columns.forEach((c,i)=>{
    const align=c.align??'left'
    const tx=align==='right'?x+sizes[i]-9:align==='center'?x+sizes[i]/2:x+9
    cells[i].forEach((line,n)=>this.text(line,tx,this.y+7+n*11,8,c.key==='total',paper.olive,align))
    x+=sizes[i]
   })
   this.line(this.margin,this.y+height,this.w-this.margin,this.y+height,paper.line,.36)
   this.y+=height
  })
  this.y+=20
 }
 finish(report:PdfReport):Uint8Array{
  const count=this.pages.length
  this.pages.forEach((page,i)=>{
   const stream=page.streams
   const add=(s:string)=>stream.push(s)
   add(color(paper.muted)+'\nBT /F1 8 Tf 1 0 0 1 '+number(this.margin)+' 33 Tm '+hexText('OliveTrack  ·  '+report.period)+' Tj ET\n')
   const pagination='Page '+(i+1)+' / '+count
   add(color(paper.muted)+'\nBT /F1 8 Tf 1 0 0 1 '+number(this.w-this.margin-approximateWidth(pagination,8))+' 33 Tm '+hexText(pagination)+' Tj ET\n')
   add(color(paper.line,true)+'\n.6 w '+number(this.margin)+' 47 m '+number(this.w-this.margin)+' 47 l S\n')
   if(i>0){
    const headerPart=color(paper.muted)+'\nBT /F2 9 Tf 1 0 0 1 '+number(this.margin)+' '+number(this.h-58)+' Tm '+hexText('OLIVETRACK  /  '+report.title)+' Tj ET\n'
    // prepend to keep the small repeated page title under the section content
    stream.unshift(headerPart)
   }
  })
  return pdfBytes(this.pages,this.w,this.h)
 }
}
function pdfBytes(pages:PdfPage[],width:number,height:number):Uint8Array{
 const objects:string[]=[]
 const add=(value:string)=>{objects.push(value);return objects.length}
 const catalog=add('')
 const pagesNode=add('')
 const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
 const f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
 const pageNums:number[]=[]
 const encoder=new TextEncoder()
 for(const page of pages){
  const stream=page.streams.join('')
  const length=encoder.encode(stream).length
  const streamNum=add('<< /Length '+length+' >>\nstream\n'+stream+'endstream')
  pageNums.push(add('<< /Type /Page /Parent '+pagesNode+' 0 R /MediaBox [0 0 '+width+' '+height+'] /Resources << /Font << /F1 '+f1+' 0 R /F2 '+f2+' 0 R >> >> /Contents '+streamNum+' 0 R >>'))
 }
 objects[catalog-1]='<< /Type /Catalog /Pages '+pagesNode+' 0 R >>'
 objects[pagesNode-1]='<< /Type /Pages /Count '+pageNums.length+' /Kids [ '+pageNums.map(n=>n+' 0 R').join(' ')+' ] >>'
 let output='%PDF-1.4\n%OLIVETRACK\n'
 const offsets=[0]
 for(let i=0;i<objects.length;i++){
  offsets.push(encoder.encode(output).length)
  output+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n'
 }
 const offset=encoder.encode(output).length
 output+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'
 for(let i=1;i<offsets.length;i++)output+=String(offsets[i]).padStart(10,'0')+' 00000 n \n'
 output+='trailer\n<< /Size '+(objects.length+1)+' /Root '+catalog+' 0 R >>\nstartxref\n'+offset+'\n%%EOF\n'
 return encoder.encode(output)
}
export function makeReportPdf(report:PdfReport):Uint8Array{
 const painter=new Painter(report.landscape)
 painter.header(report)
 for(const block of report.blocks){
  if(block.type==='note')painter.note(block.text,block.title)
  else if(block.type==='totals')painter.totals(block.items)
  else painter.table(block.title,block.columns,block.rows,block.empty)
 }
 if(report.footerNote)painter.note(report.footerNote,'LECTURE DU RAPPORT')
 return painter.finish(report)
}
export function downloadPdf(pdf:Uint8Array,name:string){
 const blob=new Blob([pdf as BlobPart],{type:'application/pdf'})
 const url=URL.createObjectURL(blob)
 const anchor=document.createElement('a')
 anchor.href=url;anchor.download=name.replace(/[^a-z0-9._-]/gi,'_')
 document.body.appendChild(anchor);anchor.click();anchor.remove()
 // Safari needs the object URL to remain available while the Files preview opens.
 window.setTimeout(()=>URL.revokeObjectURL(url),60000)
}
