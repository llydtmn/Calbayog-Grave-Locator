// ─────────────────────────────────────────────────────────────────────────────
// Picks which dashboard to load from the URL:
//   localhost:5173/admin   → Admin dashboard
//   localhost:5173/…       → User dashboard (everything else)
//
// Each dashboard is lazy-loaded, so a visitor only downloads the one they use,
// and each one's CSS (App.css / MobileApp.css) is only on the page for that
// dashboard — their .btn, .modal, :root colours etc. never clash.
// Switching between them is a normal page load (e.g. <a href="/admin">).
// ─────────────────────────────────────────────────────────────────────────────
import { lazy, Suspense } from 'react'

const ADMIN_BASE = '/admin' // keep in sync with CLEAN_URL in admin-dashboard/context/AdminContext.jsx

const AdminApp = lazy(() => import('./admin-dashboard/AdminRoot.jsx'))
const UserApp = lazy(() => import('./user-dashboard/UserRoot.jsx'))

function isAdminPath(pathname) {
  const path = pathname.replace(/\/+$/, '').toLowerCase()
  return path === ADMIN_BASE || path.startsWith(`${ADMIN_BASE}/`)
}

export default function App() {
  const Dashboard = isAdminPath(window.location.pathname) ? AdminApp : UserApp
  return (
    <Suspense fallback={<div className="gl-boot"><span className="gl-boot-dot" />Loading GraveLocator…</div>}>
      <Dashboard />
    </Suspense>
  )
}
