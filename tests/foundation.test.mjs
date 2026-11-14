import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync('src/App.tsx', 'utf8')
const supabase = readFileSync('src/supabase.ts', 'utf8')
const html = readFileSync('index.html', 'utf8')
test('No public signup form or signUp client call', () => {
  assert.doesNotMatch(app, /auth\.signUp\s*\(/)
  assert.match(app, /signInWithPassword/)
})
test('Authentication is verified with server before workspace is displayed', () => {
  assert.match(app, /auth\.getUser\(\)/)
})
test('No secret or service-role key embedded in frontend', () => {
  assert.doesNotMatch(supabase, /service_role|sb_secret_/)
  assert.match(supabase, /VITE_SUPABASE_PUBLISHABLE_KEY/)
})
test('Mobile viewport is present', () => {
  assert.match(html, /viewport/)
})

test('Only configured owner user can access the workspace', () => {
  assert.match(app, /data\.user\.id !== ownerUserId/)
  assert.match(app, /data\.user\?\.id === ownerUserId/)
  assert.match(app, /!ownerUserId/)
})
test('Every displayed module is behind the authenticated workspace', () => {
  assert.match(app, /return user \? <Workspace user=\{user\}/)
})
