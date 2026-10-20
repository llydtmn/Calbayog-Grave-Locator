import { useAdmin } from '../context/AdminContext'

const pageTitles = {
  dashboard: 'Dashboard Overview',
  plots: 'Plot Management',
  reservations: 'Reservation Management',
  users: 'User Management',
  memorials: 'Digital Memorial Management',
  reports: 'Reports & Analytics',
  notifications: 'Notifications & Alerts',
  settings: 'Settings',
}

export default function Topbar() {
  const { activePage, toggleSidebar, setActivePage } = useAdmin()
  return (
    <header className="admin-topbar" style={{
      position: 'fixed', left: 'var(--sidebar)', right: 0, top: 0, height: 'var(--topbar)',
      background: '#fff', borderBottom: '1px solid var(--lgray)', display: 'flex',
      alignItems: 'center', padding: '0 28px', zIndex: 99,
      boxShadow: '0 2px 8px rgba(0,0,0,.04)'
    }}>
      <button
        className="admin-menu-btn"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
        style={{ display: 'none', width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--lgray)', background: '#fff', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: 12, flexShrink: 0 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--charcoal)" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <p style={{ fontFamily: 'var(--ff-d)', fontSize: 18, color: 'var(--charcoal)', fontWeight: 600, flex: 1 }}>
        {pageTitles[activePage] || activePage}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cream)', border: '1.5px solid var(--lgray)', borderRadius: 10, padding: '7px 14px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mgray)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--ff-b)', fontSize: 13, color: 'var(--charcoal)', width: 200 }} placeholder="Quick search…"/>
        </div>

        {/* Notification bell */}
        <button onClick={() => setActivePage('notifications')} aria-label="Notifications" style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--lgray)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--dgray)" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: 'var(--rose)', borderRadius: '50%', border: '2px solid #fff' }}/>
        </button>

        {/* Settings */}
        <button onClick={() => setActivePage('settings')} aria-label="Settings" style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid var(--lgray)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--dgray)" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
    </header>
  )
}