// ─────────────────────────────────────────────────────────────────────────────
// Presence — tells the database "this user is using the app right now".
// While a signed-in user has the app open (and visible), it calls the SQL
// function touch_last_seen() every 2 minutes. The Admin dashboard uses that
// to show Online / Active / Inactive in User Management.
// Renders nothing.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import { supabase } from '../api/supabaseClient'
import { ENV } from '../config/constants'

const EVERY_MS = 2 * 60 * 1000

export default function Presence() {
  useEffect(() => {
    if (!ENV.USE_REMOTE || !supabase) return
    let timer = null
    let signedIn = false

    const touch = () => {
      if (!signedIn || document.visibilityState !== 'visible') return
      supabase.rpc('touch_last_seen').then(() => {}, () => {}) // ignore errors
    }
    const start = () => { clearInterval(timer); touch(); timer = setInterval(touch, EVERY_MS) }
    const stop = () => { clearInterval(timer); timer = null }

    supabase.auth.getSession().then(({ data: { session } }) => {
      signedIn = !!session
      if (signedIn) start()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const was = signedIn
      signedIn = !!session
      if (signedIn && !was) start()
      if (!signedIn) stop()
    })
    const onVisible = () => { if (document.visibilityState === 'visible') touch() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stop()
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}