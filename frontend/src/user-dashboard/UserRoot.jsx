// ─────────────────────────────────────────────────────────────────────────────
// USER DASHBOARD entry — loaded by src/App.jsx for every path except /admin.
// (This was User-Dashboard/frontend/src/main.jsx before the merge.)
// ─────────────────────────────────────────────────────────────────────────────
import MobileApp from './MobileApp.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { PrefsProvider, applySavedTheme } from './context/PrefsContext.jsx'
import Presence from './components/Presence.jsx'

// ── App-like feel ────────────────────────────────────────────────────────────
// Lock the page so the whole UI can't be pinch-/double-tap-zoomed like a web
// page. (The Map screen implements its own controlled zoom.) This makes the
// installed PWA behave like a real app.
function lockViewport() {
  let meta = document.querySelector('meta[name="viewport"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'viewport'
    document.head.appendChild(meta)
  }
  meta.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover',
  )
  // Keep the existing app-level zoom lock, but leave the interactive map's
  // touch surface alone so the map can handle pinch/drag itself.
  document.addEventListener('gesturestart', (e) => {
    if (!e.target?.closest?.('.mv-vp, .leaflet-container')) e.preventDefault()
  })
  let lastTouch = 0
  document.addEventListener('touchend', (e) => {
    const now = Date.now()
    if (!e.target?.closest?.('.mv-vp, .leaflet-container') && now - lastTouch <= 300) e.preventDefault()
    lastTouch = now
  }, { passive: false })
}
lockViewport()
applySavedTheme() // set light/dark before first paint (no flash)

// Mounted by src/App.jsx for every path except /admin.
export default function UserRoot() {
  return (
    <PrefsProvider>
      <AppProvider>
        <Presence />
        <MobileApp />
      </AppProvider>
    </PrefsProvider>
  )
}