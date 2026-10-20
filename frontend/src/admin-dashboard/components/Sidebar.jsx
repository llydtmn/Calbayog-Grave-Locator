import { useAdmin } from '../context/AdminContext'
import { useMemorialQueue, useReservations } from '../hooks'
import { MEMORIAL_STATUS, RESERVATION_STATUS } from '../config/adminStatus'
import { PARK, ENV } from '../config/constants'

const navItems = [
  { section: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  ]},
  { section: 'Management', items: [
    { id: 'plots', label: 'Plot Management', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg> },
    { id: 'reservations', label: 'Reservations', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>, badgeKey: 'reservations' },
    { id: 'users', label: 'User Management', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    { id: 'memorials', label: 'Digital Memorials', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>, badgeKey: 'memorials' },
  ]},
  { section: 'System', items: [
    { id: 'reports', label: 'Reports & Analytics', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { id: 'notifications', label: 'Notifications', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> },
    { id: 'settings', label: 'Settings', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
  ]},
]

export default function Sidebar() {
  const { activePage, setActivePage, admin, logout, signOut, sidebarOpen, closeSidebar } = useAdmin()
  // Real pending-item counts, computed from the same shared data the
  // Memorials/Reservations pages read — badges can never drift from the actual table.
  const { queue } = useMemorialQueue()
  const { reservations } = useReservations()
  const badges = {
    memorials: queue.filter((m) => m.status === MEMORIAL_STATUS.PENDING).length,
    reservations: reservations.filter((r) => r.status === RESERVATION_STATUS.PENDING).length,
  }

  return (
    <>
    {sidebarOpen && <div className="admin-sidebar-backdrop" onClick={closeSidebar} />}
    <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: 'var(--sidebar)',
      background: 'var(--forest)', display: 'flex', flexDirection: 'column',
      zIndex: 200, boxShadow: '4px 0 24px rgba(0,0,0,.15)'
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ width: 38, height: 38, background: 'rgba(255,255,255,.12)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div>
          <span style={{ fontFamily: 'var(--ff-d)', fontSize: 16, color: '#fff', fontWeight: 700, display: 'block' }}>GraveLocator</span>
          <small style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>{PARK.address} · Admin</small>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
        {navItems.map(section => (
          <div key={section.section}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'rgba(255,255,255,.35)', padding: '12px 20px 6px' }}>
              {section.section}
            </p>
            {section.items.map(item => {
              const badge = item.badgeKey ? badges[item.badgeKey] : null
              return (
                <div
                  key={item.id}
                  onClick={() => { setActivePage(item.id); closeSidebar() }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                    cursor: 'pointer', transition: 'all .18s', position: 'relative',
                    color: activePage === item.id ? '#fff' : 'rgba(255,255,255,.65)',
                    background: activePage === item.id ? 'rgba(255,255,255,.13)' : 'transparent',
                    fontSize: 13.5, fontWeight: 500
                  }}
                >
                  {activePage === item.id && (
                    <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: 'var(--mint)', borderRadius: '0 3px 3px 0' }}/>
                  )}
                  <span style={{ opacity: activePage === item.id ? 1 : 0.8, display: 'flex' }}>{item.icon}</span>
                  {item.label}
                  {!!badge && (
                    <span style={{ marginLeft: 'auto', background: 'var(--rose)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '2px 7px' }}>
                      {badge}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {(admin?.name || 'A')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{admin?.name || 'Admin User'}</p>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>{admin?.role || 'Super Admin'}</span>
          </div>
          <button onClick={() => ENV.USE_REMOTE ? signOut() : logout()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', display: 'flex' }} title="Logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
    </>
  )
}
