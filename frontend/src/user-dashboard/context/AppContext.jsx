// ─────────────────────────────────────────────────────────────────────────────
// APP CONTEXT — auth + lightweight app state.
// When VITE_USE_REMOTE=true, auth is backed by Supabase Auth (real sessions,
// persisted across reloads). Otherwise it falls back to a local stub login.
// No demo user: the displayed name always comes from the account that logged in.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react'
import { ENV } from '../config/constants'
import { supabase } from '../api/supabaseClient'
import * as api from '../api'

const AppContext = createContext(null)

// Local-stub session survives a refresh (Supabase keeps its own session when remote).
// Key bumped to v2 so any old "Maria Santos" session saved in the browser is ignored.
const LOCAL_USER_KEY = 'gl:session:v2'
const LEGACY_USER_KEY = 'gl:session'
try { localStorage.removeItem(LEGACY_USER_KEY) } catch { /* ignore */ }

function loadLocalUser() {
  if (ENV.USE_REMOTE) return null
  try { return JSON.parse(localStorage.getItem(LOCAL_USER_KEY)) } catch { return null }
}
function saveLocalUser(u) {
  try { u ? localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u)) : localStorage.removeItem(LOCAL_USER_KEY) } catch { /* ignore */ }
}

// Recently viewed is stored per user on this device, newest first.
const RECENT_LIMIT = 5
const recentKey = (userKey) => `gl:recent:${userKey || 'guest'}`
function loadRecent(userKey) {
  try { return JSON.parse(localStorage.getItem(recentKey(userKey))) || [] } catch { return [] }
}
function saveRecent(userKey, list) {
  try { localStorage.setItem(recentKey(userKey), JSON.stringify(list)) } catch { /* storage full / blocked */ }
}

// Name fallback when an account has no full_name: use the part of the email before "@".
const nameFromEmail = (email) => (email ? email.split('@')[0] : '')

// Supabase user → app user. Never falls back to a demo name.
function toUser(u) {
  return {
    id: u.id,
    name: u.user_metadata?.full_name || nameFromEmail(u.email),
    email: u.email || '',
    phone: u.user_metadata?.phone || '',
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(loadLocalUser) // null = logged out
  const [authLoading, setAuthLoading] = useState(ENV.USE_REMOTE)
  const [activeBlockId, setActiveBlockId] = useState(null) // map: which block is open
  const [activeLot, setActiveLot] = useState(null)         // map → plot-detail handoff
  const [reservationDraft, setReservationDraft] = useState(null) // reserve-form → summary handoff
  const [activeReservationId, setActiveReservationId] = useState(null) // reservation list → detail handoff
  const [recentViews, setRecentViews] = useState([])

  // Stable id for per-user data: Supabase id when remote, email in local-stub mode.
  const userKey = user?.id || user?.email || null

  useEffect(() => { setRecentViews(loadRecent(userKey)) }, [userKey])

  // entry: { type: 'lot' | 'block', blockId, blockName, lawnName, lotNo?, lot? }
  const addRecentView = useCallback((entry) => {
    if (!entry?.blockId) return
    setRecentViews((prev) => {
      const id = entry.type === 'lot' ? `lot:${entry.blockId}:${entry.lotNo}` : `block:${entry.blockId}`
      // Opening a block you already viewed a lot in (e.g. going back to the grid) doesn't bump it.
      if (entry.type === 'block' && prev.some((r) => r.type === 'lot' && r.blockId === entry.blockId)) return prev
      let rest = prev.filter((r) => r.id !== id)
      // A lot view makes the plain "opened this block" entry redundant.
      if (entry.type === 'lot') rest = rest.filter((r) => r.id !== `block:${entry.blockId}`)
      const next = [{ ...entry, id, viewedAt: Date.now() }, ...rest].slice(0, RECENT_LIMIT)
      saveRecent(userKey, next)
      return next
    })
  }, [userKey])

  const clearRecentViews = useCallback(() => { saveRecent(userKey, []); setRecentViews([]) }, [userKey])

  // Every path into Lot Details (map, search, deep link) sets activeLot — record it here.
  useEffect(() => {
    if (!activeLot?.blockId || activeLot.lotNo == null) return
    addRecentView({
      type: 'lot', blockId: activeLot.blockId, blockName: activeLot.blockName,
      lawnName: activeLot.lawnName, lotNo: activeLot.lotNo, lot: activeLot,
    })
  }, [activeLot, addRecentView])

  // Restore + subscribe to the Supabase session when running against real auth.
  useEffect(() => {
    if (!ENV.USE_REMOTE || !supabase) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session ? toUser(session.user) : null)
      setAuthLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? toUser(session.user) : null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo(() => ({
    user,
    userKey,
    isAuthenticated: !!user,
    authLoading,

    // Local-stub login (used when VITE_USE_REMOTE=false) — uses only what was entered.
    login: (profile = {}) => {
      const email = profile.email || ''
      const u = {
        id: profile.id || email || undefined,
        name: profile.name || profile.fullName || nameFromEmail(email),
        email,
        phone: profile.phone || '',
      }
      saveLocalUser(u)
      setUser(u)
    },
    logout: () => { saveLocalUser(null); setUser(null) },

    // Real Supabase auth. Sets the user right away so the new name shows
    // immediately — no refresh needed.
    signIn: async ({ email, password }) => {
      const data = await api.signIn({ email, password })
      const authUser = data?.user || data?.session?.user
      if (authUser) setUser(toUser(authUser))
      else if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) setUser(toUser(session.user))
      }
    },
    signUp: async ({ email, password, fullName, phone, privacyVersion }) => {
      // Return whether a real session came back — if email confirmation is
      // required, Supabase creates the account but does NOT log them in yet.
      const data = await api.signUp({ email, password, fullName, phone, privacyVersion })
      if (data?.session?.user) setUser(toUser(data.session.user))
      return { confirmedImmediately: !!data?.session }
    },
    signOut: async () => {
      setUser(null)
      await api.signOut()
    },
    resendConfirmation: async (email) => {
      await api.resendConfirmation(email)
    },
    verifySignupCode: async (email, token) => {
      const data = await api.verifySignupCode(email, token)
      const authUser = data?.user || data?.session?.user
      if (authUser) setUser(toUser(authUser))
    },
    updateProfile: async ({ fullName, phone }) => {
      if (!ENV.USE_REMOTE) { setUser((u) => { const n = { ...u, name: fullName, phone }; saveLocalUser(n); return n }); return }
      const data = await api.updateProfile({ fullName, phone })
      setUser(toUser(data.user))
    },
    changePassword: async (newPassword) => {
      if (!ENV.USE_REMOTE) return // no real auth in local-stub mode
      await api.changePassword(newPassword)
    },

    activeBlockId,
    setActiveBlockId,
    activeLot,
    setActiveLot,
    reservationDraft,
    setReservationDraft,
    activeReservationId,
    setActiveReservationId,
    recentViews,
    addRecentView,
    clearRecentViews,
  }), [user, userKey, authLoading, activeBlockId, activeLot, reservationDraft, activeReservationId, recentViews, addRecentView, clearRecentViews])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within <AppProvider>')
  return ctx
}

export default AppContext