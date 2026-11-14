import { createClient } from '@supabase/supabase-js'

// Supabase Auth must always be accessed through HTTPS (GitHub Pages runs on HTTPS).
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/^http:\/\//i, 'https://').replace(/\/+$/, '')
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const configured = Boolean(url && key && !key.startsWith('replace_'))
export const supabase = configured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null

export const ownerUserId = import.meta.env.VITE_OWNER_USER_ID
