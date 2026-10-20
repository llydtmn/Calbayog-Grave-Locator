// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CONTEXT — auth + navigation + modal state.
// When VITE_USE_REMOTE=true, auth is backed by real Supabase Auth (RLS on the
// blocks/lots tables requires profiles.role = 'admin' for that signed-in user
// or writes will be rejected). Otherwise falls back to the original local
// stub (login() just flips a flag) so the UI still runs with zero setup.
//
// Modal state lives here (not DOM classList) so a modal can be opened with a
// specific record attached (e.g. "edit this plot") and any submit handler can
// call the api/ layer and close itself — no document.getElementById reaching
// across the component tree.
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react'
import { ENV } from '../config/constants'
import { supabase } from '../api/supabaseClient'

const AdminContext = createContext(null)

// ── Browser history (clean URL) ──────────────────────────────────────────────
// The address bar always stays at /admin (e.g. localhost:5173/admin) — no
// /admin/page path and no #/page hash. Each page / open block / open modal is still
// its own history entry (stored in history.state), so the browser / Android
// Back button steps back through the admin panel. The current page is also
// saved per tab in sessionStorage so a refresh keeps you on the same page.
const HISTORY_KEY = '__graveLocatorAdmin'
const ROUTE_KEY = 'gl-admin:route'
// Must match ADMIN_BASE in src/App.jsx — the user app owns every other path.
const CLEAN_URL = '/admin'
const PAGES = ['dashboard', 'plots', 'reservations', 'users', 'memorials', 'reports', 'notifications', 'settings']

// Old links like #/reports or #/plots/block/block-3 still work (read once).
function parseLegacyHash() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (!parts.length) return null
  const page = PAGES.includes(parts[0]) ? parts[0] : 'dashboard'
  const plotBlockId = page === 'plots' && parts[1] === 'block' && parts[2] ? decodeURIComponent(parts[2]) : null
  return { page, plotBlockId }
}

function loadSavedRoute() {
  try {
    const r = JSON.parse(sessionStorage.getItem(ROUTE_KEY))
    if (r && PAGES.includes(r.page)) return { page: r.page, plotBlockId: r.page === 'plots' ? r.plotBlockId || null : null }
  } catch { /* ignore */ }
  return null
}

function saveRoute(page, plotBlockId) {
  try { sessionStorage.setItem(ROUTE_KEY, JSON.stringify({ page, plotBlockId: plotBlockId || null })) } catch { /* ignore */ }
}

// Where to start: history entry (after a refresh) → old hash link → saved route → dashboard.
function initialRoute() {
  const entry = window.history.state?.[HISTORY_KEY]
  if (entry && PAGES.includes(entry.page)) return { page: entry.page, plotBlockId: entry.plotBlockId || null }
  return parseLegacyHash() || loadSavedRoute() || { page: 'dashboard', plotBlockId: null }
}

const START = initialRoute()
const currentEntry = () => window.history.state?.[HISTORY_KEY] || null

// Demo-mode login is kept in localStorage so a refresh doesn't log you out.
// (With Supabase on, the Supabase client keeps the session itself.)
const LOCAL_ADMIN_KEY = 'gl-admin:session'
function loadLocalAdmin() {
  if (ENV.USE_REMOTE) return null
  try { return JSON.parse(localStorage.getItem(LOCAL_ADMIN_KEY)) } catch { return null }
}

const DEFAULT_ADMIN = {
  name: 'Admin User',
  email: 'admin@calbayog.gov.ph',
  role: 'Super Admin',
}

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(loadLocalAdmin) // null = logged out
  const [authLoading, setAuthLoading] = useState(ENV.USE_REMOTE)
  const [authError, setAuthError] = useState('')
  const [activePage, setActivePageState] = useState(START.page)
  const [plotBlockId, setPlotBlockIdState] = useState(START.plotBlockId) // Plot Management: open block
  const [modal, setModal] = useState(null)           // { id, record? } | null
  const [activeBlockId, setActiveBlockId] = useState(null) // Plot Management: which block is open
  const [activeLot, setActiveLot] = useState(null)          // Plot Management: selected lot
  const [sidebarOpen, setSidebarOpen] = useState(false)      // mobile: off-canvas sidebar drawer
  const [toast, setToast] = useState(null)                   // { id, message, type }

  const notify = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToast({ id, message, type })
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3200)
  }, [])

  // Runs an action button's work and reports the result, so a failed call is
  // never silent. Returns true on success.
  const runAction = useCallback(async (fn, successMessage) => {
    try {
      await fn()
      if (successMessage) notify(successMessage)
      return true
    } catch (err) {
      notify(err?.message || 'Something went wrong. Please try again.', 'error')
      return false
    }
  }, [notify])

  function toAdmin(session, profileRole) {
    const u = session.user
    return {
      id: u.id,
      name: u.user_metadata?.full_name || DEFAULT_ADMIN.name,
      email: u.email,
      role: profileRole === 'admin' ? 'Super Admin' : 'Staff',
    }
  }

  // Only accounts with profiles.role = 'admin' may use the admin dashboard.
  // Anyone else (e.g. a normal user account) is signed out of the ADMIN
  // session only and sent back to the admin login with a message — their
  // user-app login is untouched (separate session, see api/supabaseClient.js).
  async function loadSessionAdmin(session) {
    if (!session) { setAdmin(null); return }
    let role = null
    try {
      const { data: profile, error } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      if (error) throw error
      role = profile?.role
    } catch {
      role = null // can't confirm the role → treat as not an admin
    }
    if (role !== 'admin') {
      setAdmin(null)
      setAuthError('This account is not an admin. Sign in with an admin account.')
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      return
    }
    setAuthError('')
    setAdmin(toAdmin(session, role))
  }

  // Restore + subscribe to the Supabase session when running against real auth.
  useEffect(() => {
    if (!ENV.USE_REMOTE) return
    if (!supabase) { setAuthLoading(false); return }

    supabase.auth.getSession()
      .then(({ data: { session } }) => loadSessionAdmin(session))
      .finally(() => setAuthLoading(false))

    // Deferred: calling Supabase directly inside this callback can stall the auth client.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => loadSessionAdmin(session), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Stamp the first entry (so Back knows where the panel starts) and clean the
  // address bar: drops any /admin path or #/page hash → just the site root.
  useEffect(() => {
    const cur = currentEntry()
    const entry = cur && PAGES.includes(cur.page)
      ? { ...cur, modal: false }
      : { index: 0, page: START.page, plotBlockId: START.plotBlockId, modal: false }
    window.history.replaceState({ [HISTORY_KEY]: entry }, '', CLEAN_URL)
    saveRoute(entry.page, entry.plotBlockId)
  }, [])

  const navigate = useCallback((page, opts = {}) => {
    const b = opts.plotBlockId || null
    const cur = currentEntry()
    if (!opts.replace && cur && !cur.modal && cur.page === page && (cur.plotBlockId || null) === b) return
    const index = (cur?.index ?? 0) + (opts.replace ? 0 : 1)
    const state = { [HISTORY_KEY]: { index, page, plotBlockId: b, modal: false } }
    if (opts.replace) window.history.replaceState(state, '', CLEAN_URL)
    else window.history.pushState(state, '', CLEAN_URL)
    saveRoute(page, b)
    setModal(null)
    setActivePageState(page)
    setPlotBlockIdState(b)
  }, [])

  // Step back one entry if there is one inside the panel, otherwise go to fallback.
  const goBack = useCallback((fallback = 'dashboard') => {
    if ((currentEntry()?.index ?? 0) > 0) window.history.back()
    else navigate(fallback, { replace: true })
  }, [navigate])

  const openModal = useCallback((id, record = null) => {
    setModal({ id, record })
    const cur = currentEntry() || { index: 0, page: activePage, plotBlockId }
    const state = { [HISTORY_KEY]: { ...cur, modal: true, index: cur.modal ? cur.index : cur.index + 1 } }
    // Switching from one modal to another reuses the same entry.
    if (cur.modal) window.history.replaceState(state, '', CLEAN_URL)
    else window.history.pushState(state, '', CLEAN_URL)
  }, [activePage, plotBlockId])

  const closeModal = useCallback(() => {
    setModal(null)
    if (currentEntry()?.modal) window.history.back() // pop the modal's entry
  }, [])

  useEffect(() => {
    const onPop = (e) => {
      const entry = e.state?.[HISTORY_KEY]
      if (!entry) return // left the admin panel's history; nothing to restore
      if (!entry.modal) setModal(null)
      setActivePageState(entry.page)
      setPlotBlockIdState(entry.plotBlockId || null)
      saveRoute(entry.page, entry.plotBlockId)
      setSidebarOpen(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const value = useMemo(() => ({
    admin,
    isAuthenticated: !!admin,
    authLoading,
    authError,

    // Local-stub login (used when VITE_USE_REMOTE=false).
    login: (profile) => {
      const a = { ...DEFAULT_ADMIN, ...(profile || {}) }
      try { localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(a)) } catch { /* ignore */ }
      setAdmin(a)
    },
    logout: () => {
      try { localStorage.removeItem(LOCAL_ADMIN_KEY) } catch { /* ignore */ }
      setAdmin(null)
    },

    // Real Supabase auth — LoginScreen calls this when remote.
    signIn: async ({ email, password }) => {
      setAuthError('')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(error.message); throw error }
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },

    activePage,
    setActivePage: (page) => navigate(page),   // existing callers keep working
    navigate,
    goBack,

    plotBlockId,
    openPlotBlock: (id) => navigate('plots', { plotBlockId: id }),
    closePlotBlock: () => goBack('plots'),

    modal,
    openModal,
    closeModal,
    // Ask before destructive actions: { title, message, confirmLabel, onConfirm, successMessage }
    confirmAction: (opts) => openModal('modal-confirm', opts),

    toast,
    notify,
    runAction,

    activeBlockId,
    setActiveBlockId,
    activeLot,
    setActiveLot,

    sidebarOpen,
    toggleSidebar: () => setSidebarOpen((o) => !o),
    closeSidebar: () => setSidebarOpen(false),
  }), [admin, authLoading, authError, activePage, plotBlockId, modal, activeBlockId, activeLot, sidebarOpen, navigate, goBack, openModal, closeModal, toast, notify, runAction])

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within <AdminProvider>')
  return ctx
}

export default AdminContext