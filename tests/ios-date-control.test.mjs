import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const ui=readFileSync('src/Phase5.tsx','utf8')
const css=readFileSync('src/mobile-overflow.css','utf8')
test('Delivery, receipt, expense and harvest dates use the same bounded native picker',()=>{
 assert.match(ui,/function DateControl/)
 assert.match(ui,/value=\{date\} onChange=\{setDate\}/)
 assert.match(ui,/value=\{harvestDate\} onChange=\{setHarvestDate\}/)
 assert.match(ui,/type="date"/)
 assert.match(ui,/toLocaleDateString\('fr-FR'/)
 assert.doesNotMatch(ui,/className="p5-field">Date de récolte \(facultative\)<input/)
})
test('Native iOS input is clipped and can still receive touch, keyboard and accessibility',()=>{
 assert.match(css,/\.p5-field \.p5-date-control\{/)
 assert.match(css,/overflow:hidden/)
 assert.match(css,/position:absolute!important;inset:0!important/)
 assert.match(css,/width:100%!important;max-width:100%!important;min-width:0!important/)
 assert.match(css,/opacity:0!important/)
 assert.match(css,/focus-within/)
 assert.match(ui,/aria-label=\{label\}/)
 assert.match(ui,/onChange=\{e=>onChange\(e.target.value\)\}/)
})
