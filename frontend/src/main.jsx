// ─────────────────────────────────────────────────────────────────────────────
// GraveLocator — single entry for BOTH dashboards.
//   /admin  → src/admin-dashboard   (admin panel)
//   others  → src/user-dashboard    (mobile PWA)
// See App.jsx for how the right one is picked.
// ─────────────────────────────────────────────────────────────────────────────
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Each dashboard's CSS pulls Google Fonts with @import. When the phone is
// offline (or fonts are blocked) that @import fails and Vite would refuse to
// load the dashboard at all. The styles themselves are already applied, so
// ignore CSS-only preload errors — the app just falls back to system fonts.
window.addEventListener('vite:preloadError', (event) => {
  if (/css/i.test(String(event.payload?.message || event.payload || ''))) event.preventDefault()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
