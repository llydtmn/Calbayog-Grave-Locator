// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE CLIENT — one shared connection for the whole app (data + auth).
// Reads its config from Vite env vars set in .env (see .env.example).
//
// Admin note: the admin must sign in with an account whose `profiles.role`
// is 'admin' (set this manually in the Supabase table editor after they sign
// up once) — the RLS policies in schema.sql only let admins write blocks/lots.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import { ENV } from '../config/constants'

export const supabase =
  ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY
    ? createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
        // Both dashboards now run on the same site, so give the admin its own
        // saved session — signing in/out here doesn't sign the user app in/out.
        auth: { storageKey: 'gl-admin-auth' },
      })
    : null

if (ENV.USE_REMOTE && !supabase) {
  console.warn(
    'VITE_USE_REMOTE=true but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env and fill them in.'
  )
}