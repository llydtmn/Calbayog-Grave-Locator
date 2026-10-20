import { useAdmin } from '../context/AdminContext'
import { useDashboardMetrics, useBlockOccupancy, useMemorialQueue, useUsers } from '../hooks'
import { STATUS, STATUS_META } from '../config/status'
import { MEMORIAL_STATUS, MEMORIAL_STATUS_META } from '../config/adminStatus'
import { formatDate } from '../utils/date'
import { plotShort } from '../utils/plot'
import { PARK } from '../config/constants'

export default function DashboardPage({ onNavigate }) {
  const { openModal } = useAdmin()
  const { metrics, loading: metricsLoading } = useDashboardMetrics()
  const { occupancy } = useBlockOccupancy()
  const { queue } = useMemorialQueue()
  const { users } = useUsers()

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const pendingMemorials = queue
    .filter((m) => m.status === MEMORIAL_STATUS.PENDING)
    .sort((a, b) => (a.submitted < b.submitted ? 1 : -1))
    .slice(0, 4)

  const recentUsers = [...users]
    .sort((a, b) => (a.joined < b.joined ? 1 : -1))
    .slice(0, 4)

  const m = metrics || { totalPlots: 0, available: 0, occupied: 0, reserved: 0, totalUsers: 0, pendingItems: 0 }
  const pct = (n) => (m.totalPlots ? Math.round((n / m.totalPlots) * 1000) / 10 : 0)

  const metricCards = [
    { label: 'Total Plots', val: metricsLoading ? '…' : m.totalPlots.toLocaleString(), delta: 'Across all digitized blocks', color: '#E0F2FE', stroke: '#0369A1' },
    { label: 'Available', val: metricsLoading ? '…' : m.available.toLocaleString(), delta: `${pct(m.available)}%`, color: '#DCFCE7', stroke: '#16A34A' },
    { label: 'Occupied', val: metricsLoading ? '…' : m.occupied.toLocaleString(), delta: `${pct(m.occupied)}%`, color: '#FEE2E2', stroke: '#DC2626' },
    { label: 'Reserve Lots', val: metricsLoading ? '…' : m.reserved.toLocaleString(), delta: `${pct(m.reserved)}%`, color: '#FEF9C3', stroke: '#B45309' },
    { label: 'Total Users', val: metricsLoading ? '…' : m.totalUsers.toLocaleString(), delta: 'Registered site accounts', color: '#FEF9C3', stroke: '#C9A84C' },
    { label: 'Pending Memorials', val: metricsLoading ? '…' : m.pendingItems.toLocaleString(), delta: 'Awaiting moderation', color: '#FEE2E2', stroke: '#C96B60' },
  ]

  // Pie slices for the three headline states, in the same order/colors as the
  // shared STATUS taxonomy (config/status.js) — never a separately chosen palette.
  const pieSlices = [
    { status: STATUS.AVAILABLE, count: m.available },
    { status: STATUS.SOLD, count: m.occupied },
    { status: STATUS.RESERVE_LOT, count: m.reserved },
  ].filter((s) => s.count > 0)
  const circumference = 2 * Math.PI * 60
  let offset = 0
  const arcs = pieSlices.map((s) => {
    const frac = m.totalPlots ? s.count / m.totalPlots : 0
    const arc = { ...s, dash: frac * circumference, offset: -offset }
    offset += frac * circumference
    return arc
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard Overview</h2>
          <p>Welcome back. Here's what's happening at {PARK.name}.</p>
        </div>
        <span style={{ fontSize: 12, color: 'var(--dgray)' }}>{today}</span>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        {metricCards.map(m => (
          <div key={m.label} className="metric-card">
            <div className="metric-icon" style={{ background: m.color }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m.stroke} strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div className="metric-val">{m.val}</div>
            <div className="metric-label">{m.label}</div>
            <div className="metric-delta">{m.delta}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-row">
        <button className="btn btn-primary" onClick={() => openModal('modal-updatelot')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Update a Lot
        </button>
        <button className="btn btn-ghost" onClick={() => onNavigate('memorials')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
          Review Memorials
        </button>
        <button className="btn btn-amber" onClick={() => onNavigate('users')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          Manage Users
        </button>
        <button className="btn btn-outline" onClick={() => onNavigate('reports')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Generate Report
        </button>
        <button className="btn btn-outline" onClick={() => onNavigate('notifications')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
          Broadcast Notification
        </button>
      </div>

      {/* Charts */}
      <div className="charts-row">
        {/* Pie Chart */}
        <div className="card">
          <p className="chart-title">Plot Status Distribution</p>
          <div className="pie-wrap">
            <svg width="160" height="160" viewBox="0 0 160 160">
              {arcs.map((a) => (
                <circle
                  key={a.status} cx="80" cy="80" r="60" fill="none"
                  stroke={STATUS_META[a.status].fill === '#FFFFFF' ? '#C9CFC4' : STATUS_META[a.status].fill}
                  strokeWidth="36"
                  strokeDasharray={`${a.dash} ${circumference - a.dash}`}
                  strokeDashoffset={a.offset}
                />
              ))}
              <circle cx="80" cy="80" r="40" fill="white"/>
              <text x="80" y="76" textAnchor="middle" fontSize="18" fontWeight="700" fill="#172A3A" fontFamily="Playfair Display,Georgia,serif">{m.totalPlots.toLocaleString()}</text>
              <text x="80" y="91" textAnchor="middle" fontSize="9" fill="#5F7485" fontFamily="DM Sans,sans-serif">Total Plots</text>
            </svg>
            <div className="pie-legend">
              {arcs.map((a) => (
                <div key={a.status} className="legend-item">
                  <div className="legend-dot" style={{ background: STATUS_META[a.status].fill === '#FFFFFF' ? '#C9CFC4' : STATUS_META[a.status].fill }}/>
                  <div>
                    <div style={{ fontWeight: 600, color: '#172A3A' }}>{a.count.toLocaleString()} {STATUS_META[a.status].label}</div>
                    <div style={{ fontSize: 11, color: '#5F7485' }}>{pct(a.count)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Occupancy by block */}
        <div className="card">
          <p className="chart-title">Occupancy by Block</p>
          <div className="progress-bar-list">
            {occupancy.map(b => (
              <div key={b.blockId} className="progress-item">
                <div className="progress-label"><span>{b.name}</span><span style={{ fontWeight: 700, color: 'var(--sage)' }}>{Math.round(b.occupancyRate * 100)}%</span></div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round(b.occupancyRate * 100)}%` }}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Tables */}
      <div className="recent-table-wrap">
        <div className="card">
          <div className="flex justify-between items-center mb-16">
            <p className="chart-title" style={{ marginBottom: 0 }}>Pending Memorial Submissions</p>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('memorials')}>View All</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name of Deceased</th><th>Submitted By</th><th>Plot</th><th>Status</th></tr></thead>
              <tbody>
                {pendingMemorials.map(mem => (
                  <tr key={mem.id}>
                    <td>{mem.name}</td>
                    <td>{mem.submittedBy}</td>
                    <td>{plotShort(mem)}</td>
                    <td><span className={`badge ${MEMORIAL_STATUS_META[mem.status].badge}`}>{MEMORIAL_STATUS_META[mem.status].label}</span></td>
                  </tr>
                ))}
                {!pendingMemorials.length && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16, color: 'var(--dgray)' }}>Nothing pending review.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-16">
            <p className="chart-title" style={{ marginBottom: 0 }}>Recently Registered Users</p>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('users')}>View All</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Plots</th><th>Joined</th></tr></thead>
              <tbody>
                {recentUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.plots.length}</td>
                    <td>{formatDate(u.joined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
