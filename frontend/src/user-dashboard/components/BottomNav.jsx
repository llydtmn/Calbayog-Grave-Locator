import { usePrefs } from '../context/PrefsContext'

export const NAV_ITEMS = [
  { id: 'home', label: 'Home', labelKey: 'nav.home', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'map', label: 'Map', labelKey: 'nav.map', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
  { id: 'memorials', label: 'Memorials', labelKey: 'nav.memorials', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> },
  { id: 'profile', label: 'Profile', labelKey: 'nav.profile', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
]

export default function BottomNav({ active, onNavigate }) {
  const { t } = usePrefs()
  return (
    <div className="bottom-nav">
      {NAV_ITEMS.map(item => (
        <div
          key={item.id}
          className={`nav-item${active === item.id ? ' active' : ''}`}
          onClick={() => onNavigate(item.id)}
          style={{ color: active === item.id ? 'var(--sage)' : 'var(--stone)' }}
        >
          <div className="nav-pill">{item.icon}</div>
          <span className="nav-label">{t(item.labelKey)}</span>
        </div>
      ))}
    </div>
  )
}