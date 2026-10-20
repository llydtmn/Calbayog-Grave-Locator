// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE CLIENT — one shared connection for the whole app (data + auth).
// Reads its config from Vite env vars set in .env (see .env.example).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { ENV } from '../config/constants'

export const supabase =
  ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY
    ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY)
    : null

if (ENV.USE_REMOTE && !supabase) {
  // Loud in dev so a missing .env doesn't fail silently.
  console.warn(
    'VITE_USE_REMOTE=true but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env and fill them in.'
  )
}
