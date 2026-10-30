import { useState, useEffect } from 'react'
import { useUsers, useMemorialQueue, useNotifications, useAdminStaff, useSettings } from '../hooks'
import { useAdmin } from '../context/AdminContext'
import { USER_STATUS_META, MEMORIAL_STATUS, MEMORIAL_STATUS_META } from '../config/adminStatus'
import { formatDate } from '../utils/date'
import { plotShort, plotLabel } from '../utils/plot'
import * as api from '../api'
import { downloadCSV } from '../utils/csv'
import {
  useValidation, hasErrors, FieldError, invalidStyle, textError, contactError, onlyPhoneChars,
  passwordError, confirmPasswordError, PASSWORD_RULES,
} from '../utils/validation'
import { USE_REMOTE } from '../api/client'

// "5 min ago" / "3 days ago" for the Last Active column.
function timeAgo(iso) {
  if (!iso) return 'Never'
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'Just now'
  const min = sec / 60, hr = min / 60, day = hr / 24
  if (min < 60) return `${Math.floor(min)} min ago`
  if (hr < 24) return `${Math.floor(hr)} hr${Math.floor(hr) === 1 ? '' : 's'} ago`
  if (day < 30) return `${Math.floor(day)} day${Math.floor(day) === 1 ? '' : 's'} ago`
  return formatDate(String(iso).slice(0, 10))
}

export function UsersPage() {
  const { users, loading, reload } = useUsers()
  const { openModal, confirmAction } = useAdmin()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Refresh every 60s so Online / Last Active stay current.
  useEffect(() => {
    const id = setInterval(reload, 60 * 1000)
    return () => clearInterval(id)
  }, [reload])

  const counts = users.reduce((acc, u) => { acc[u.status] = (acc[u.status] || 0) + 1; return acc }, {})
  const filtered = users.filter((u) =>
    (statusFilter === 'all' || u.status === statusFilter) &&
    (!search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()))
  )

  // Users → CSV (only the users matching the current search/filter).
  const exportUsers = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`gravelocator-users-${stamp}.csv`, [
      ['User ID', 'Full Name', 'Email', 'Phone', 'Role', 'Joined', 'Last Active', 'Status'],
      ...filtered.map((u) => [
        u.id, u.name, u.email, u.phone, u.role || 'user', u.joined || '',
        u.lastActive ? new Date(u.lastActive).toLocaleString() : 'Never',
        (USER_STATUS_META[u.status] || {}).label || u.status,
      ]),
    ])
  }

  // Deleting a user also deletes everything they own (see api.deleteUser).
  const removeUser = (u) => confirmAction({
    title: 'Delete user account?',
    message: `This permanently deletes ${u.name}'s account and everything linked to it: reservations, installment payments, memorials, and receipt photos. Lots from their pending or confirmed reservations go back to Available, and their payments will no longer count in Reports. This can't be undone.`,
    confirmLabel: 'Delete account',
    successMessage: `${u.name}'s account and data were deleted.`,
    onConfirm: async () => { await api.deleteUser(u.id); reload() },
  })

  return (
    <div>
      <div className="page-header">
        <div><h2>User Management</h2><p>Manage registered users and their plot associations.</p></div>
        <button className="btn btn-primary" onClick={() => openModal('modal-adduser')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add User
        </button>
      </div>
      <div className="filter-bar">
        <input className="filter-input" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses ({users.length})</option>
          {Object.entries(USER_STATUS_META).map(([key, meta]) => (
            <option key={key} value={key}>{meta.label} ({counts[key] || 0})</option>
          ))}
        </select>
        <button
          className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}
          onClick={exportUsers} disabled={!filtered.length}
          title="Download the users shown below as a CSV file (opens in Excel)"
        >Export CSV</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>User ID</th><th>Full Name</th><th>Email</th><th>Phone</th><th>Plots</th><th>Joined</th><th>Last Active</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading && users.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--dgray)' }}>Loading users…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--dgray)' }}>No users match.</td></tr>
              )}
              {filtered.map(u => {
                const meta = USER_STATUS_META[u.status] || USER_STATUS_META.inactive
                return (
                  <tr key={u.id}>
                    <td className="user-id-cell" title={u.id}>{String(u.id).slice(0, 8)}…</td>
                    <td style={{ fontWeight: 600 }}>{u.name}{u.role === 'admin' && <span className="role-chip">Admin</span>}</td>
                    <td>{u.email}</td>
                    <td>{u.phone}</td>
                    <td title={u.plots.map(plotLabel).join(', ')}>{u.plots.length}</td>
                    <td>{formatDate(u.joined)}</td>
                    <td title={u.lastActive ? new Date(u.lastActive).toLocaleString() : ''}>{timeAgo(u.lastActive)}</td>
                    <td><span className={`badge ${meta.badge}`}>{u.status === 'online' && <span className="online-dot" />}{meta.label}</span></td>
                    <td><div className="action-cell">
                      <button className="btn btn-ghost btn-xs" onClick={() => openModal('modal-edituser', u)}>Edit</button>
                      <button className="btn btn-outline btn-xs" onClick={() => openModal('modal-viewuser', u)}>View</button>
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => removeUser(u)}
                        disabled={u.role === 'admin'}
                        title={u.role === 'admin' ? "Admin accounts can't be deleted here. Change the role to user first." : 'Delete account and all of its data'}
                      >Delete</button>
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Digital Memorials (moderation queue) ──────────────────────────────────────
export function MemorialsPage() {
  const { queue, loading } = useMemorialQueue()
  const { openModal, runAction, confirmAction } = useAdmin()
  const [search, setSearch] = useState('')

  const filtered = queue.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase()))
  const setStatus = (m, status) =>
    runAction(() => api.updateMemorialQueueStatus(m.id, status), `${m.name}: ${MEMORIAL_STATUS_META[status].label.toLowerCase()}.`)

  const removeMemorial = (m) => confirmAction({
    title: 'Delete memorial?',
    message: `The memorial for ${m.name} will be removed permanently.`,
    confirmLabel: 'Delete',
    successMessage: 'Memorial deleted.',
    onConfirm: () => api.deleteMemorial(m.id),
  })

  return (
    <div>
      <div className="page-header">
        <div><h2>Digital Memorial Management</h2><p>Review and manage digital memorial entries submitted by users.</p></div>
        <button className="btn btn-primary" onClick={() => openModal('modal-addmemorial')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Memorial
        </button>
      </div>
      <div className="filter-bar">
        <input className="filter-input" placeholder="Search by name of deceased…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name of Deceased</th><th>Submitted By</th><th>Plot</th><th>Birth Date</th><th>Death Date</th><th>Date Submitted</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {!loading && filtered.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700 }}>{m.name}</td>
                  <td>{m.submittedBy}</td>
                  <td>{plotShort(m)}</td>
                  <td>{formatDate(m.birth)}</td>
                  <td>{formatDate(m.death)}</td>
                  <td>{formatDate(m.submitted)}</td>
                  <td><span className={`badge ${MEMORIAL_STATUS_META[m.status]?.badge || ''}`}>{MEMORIAL_STATUS_META[m.status]?.label || m.status}</span></td>
                  <td><div className="action-cell">
                    {m.status === MEMORIAL_STATUS.PENDING && <button className="btn btn-ghost btn-xs" onClick={() => setStatus(m, MEMORIAL_STATUS.APPROVED)}>Approve</button>}
                    {m.status === MEMORIAL_STATUS.APPROVED && <button className="btn btn-amber btn-xs" onClick={() => setStatus(m, MEMORIAL_STATUS.FEATURED)}>Feature</button>}
                    {m.status === MEMORIAL_STATUS.FEATURED && <button className="btn btn-outline btn-xs" onClick={() => setStatus(m, MEMORIAL_STATUS.APPROVED)}>Unfeature</button>}
                    <button className="btn btn-ghost btn-xs" onClick={() => openModal('modal-editmemorial', m)}>Edit</button>
                    <button className="btn btn-danger btn-xs" onClick={() => removeMemorial(m)}>Delete</button>
                  </div></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--dgray)', padding: 24 }}>No memorials match this search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Reports & Analytics ────────────────────────────────────────────────────────
// CSV download used by the Users page export. (The Reports & Analytics page now
// lives in pages/reports/ReportsPage.jsx.)
function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

// ── Notifications ──────────────────────────────────────────────────────────────
export function NotificationsPage() {
  const { sent, stats, alerts, loading } = useNotifications()
  const { openModal, runAction, notify } = useAdmin()
  const [recipients, setRecipients] = useState('All Users')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')

  const draft = () => ({ title: subject || 'Announcement', body: message, recipients })

  const send = async (scheduledFor) => {
    if (!message.trim()) return
    setSending(true)
    const ok = await runAction(
      () => api.sendNotification({ ...draft(), ...(scheduledFor ? { scheduledFor } : {}) }),
      scheduledFor ? `Scheduled for ${new Date(scheduledFor).toLocaleString()}.` : 'Notification sent.',
    )
    setSending(false)
    if (ok) { setSubject(''); setMessage(''); setScheduling(false); setScheduleAt('') }
  }

  const confirmSchedule = () => {
    if (!scheduleAt) { notify('Pick a date and time first.', 'error'); return }
    if (new Date(scheduleAt) <= new Date()) { notify('Choose a time in the future.', 'error'); return }
    send(new Date(scheduleAt).toISOString())
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Notifications & Alerts</h2><p>Send bulk notifications and review system alerts.</p></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18 }}>
        <div>
          <div className="notif-compose">
            <h3>Compose Notification</h3>
            <div className="modal-row" style={{ marginBottom: 14 }}>
              <div className="modal-field">
                <label>Recipients</label>
                <select className="filter-select" style={{ width: '100%' }} value={recipients} onChange={e => setRecipients(e.target.value)}><option>All Users</option><option>Users with Plots</option><option>Specific User</option></select>
              </div>
              <div className="modal-field">
                <label>Subject</label>
                <input className="filter-input" style={{ width: '100%' }} placeholder="Notification subject…" maxLength={100} value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
            </div>
            <div className="modal-field">
              <label>Message</label>
              <textarea className="filter-input" style={{ width: '100%', minHeight: 100, resize: 'vertical' }} placeholder="Write your notification message here…" maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => send()} disabled={sending || !message.trim()}>{sending ? 'Sending…' : 'Send Now'}</button>
              <button className="btn btn-ghost" onClick={() => setScheduling((v) => !v)} disabled={sending || !message.trim()}>Schedule</button>
              <button className="btn btn-outline" onClick={() => openModal('modal-notif-preview', draft())}>Preview</button>
            </div>
            {scheduling && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                <input type="datetime-local" className="filter-input" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={confirmSchedule} disabled={sending}>Confirm Schedule</button>
                <button className="btn btn-outline btn-sm" onClick={() => setScheduling(false)}>Cancel</button>
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-16">
              <p className="chart-title" style={{ marginBottom: 0 }}>Sent Notifications</p>
            </div>
            <div>
              {!loading && sent.map((n) => (
                <div key={n.id} className="notif-list-item">
                  <div className={`notif-dot ${n.unread ? 'unread' : 'read'}`}/>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{n.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--dgray)', marginTop: 2 }}>{n.body}</p>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--dgray)', flexShrink: 0, textAlign: 'right' }}>
                    {n.scheduledFor ? `Scheduled ${new Date(n.scheduledFor).toLocaleString()}` : new Date(n.sentAt).toLocaleDateString()}
                    {n.recipients && <><br />{n.recipients}</>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <p className="chart-title">Notification Stats</p>
            {stats && [
              ['Sent Today', stats.sentToday],
              ['This Week', stats.sentThisWeek],
              ['Total Users Reached', stats.usersReached],
              ['Open Rate', `${Math.round(stats.openRate * 100)}%`],
            ].map(([l, v]) => (
              <div key={l} className="detail-row">
                <span className="detail-label">{l}</span>
                <span style={{ fontWeight: 700, color: 'var(--charcoal)' }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <p className="chart-title">System Alerts</p>
            {alerts.map((a) => {
              const color = a.level === 'urgent' ? '#DC2626' : a.level === 'warning' ? '#B45309' : '#16A34A'
              return (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--lgray)', alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 }}/>
                  <p style={{ fontSize: 13, color: 'var(--charcoal)' }}>{a.message}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Change Password (signed-in admin) ────────────────────────────────────────
function ChangePasswordCard() {
  const { runAction } = useAdmin()
  const empty = { current: '', next: '', confirm: '' }
  const [pw, setPw] = useState(empty)
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const { touch, reset, setTried, shown } = useValidation()

  const set = (k) => (e) => {
    const value = e.target.value
    setPw((p) => ({ ...p, [k]: value }))
  }
  const errors = {
    current: pw.current ? '' : 'Enter your current password.',
    next: passwordError(pw.next) || (pw.next && pw.next === pw.current ? 'New password must be different from the current one.' : ''),
    confirm: confirmPasswordError(pw.next, pw.confirm),
  }
  const err = shown(errors)

  const submit = async () => {
    setTried(true)
    if (hasErrors(errors)) return
    setSaving(true)
    const ok = await runAction(() => api.changeOwnPassword(pw.current, pw.next), 'Password changed.')
    setSaving(false)
    if (ok) { setPw(empty); reset() }
  }

  const type = showPw ? 'text' : 'password'
  return (
    <div className="card settings-section" style={{ marginTop: 18 }}>
      <h3>Change Password</h3>
      {!USE_REMOTE && (
        <p style={{ fontSize: 12, color: 'var(--dgray)', marginBottom: 12 }}>
          Available once the dashboard is connected to Supabase.
        </p>
      )}
      {[
        ['Current Password', 'current', 'current-password'],
        ['New Password', 'next', 'new-password'],
        ['Confirm New Password', 'confirm', 'new-password'],
      ].map(([label, k, auto]) => (
        <div key={k} className="modal-field" style={{ marginBottom: 12 }}>
          <label>{label}</label>
          <input
            type={type} autoComplete={auto} maxLength={72}
            value={pw[k]} onChange={set(k)} onBlur={touch(k)}
            disabled={!USE_REMOTE || saving} style={invalidStyle(err(k))}
          />
          <FieldError msg={err(k)} />
        </div>
      ))}

      {/* Live checklist for the new password */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', fontSize: 12 }}>
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(pw.next)
          return (
            <li key={r.label} style={{ color: ok ? '#16A34A' : 'var(--dgray)', marginBottom: 2 }}>
              {ok ? '✓' : '•'} {r.label.charAt(0).toUpperCase() + r.label.slice(1)}
            </li>
          )
        })}
      </ul>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dgray)', marginBottom: 12 }}>
        <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} /> Show passwords
      </label>
      <button className="btn btn-primary btn-sm" onClick={submit} disabled={!USE_REMOTE || saving}>
        {saving ? 'Saving…' : 'Update Password'}
      </button>
    </div>
  )
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { staff, loading } = useAdminStaff()
  const { settings } = useSettings()
  const { openModal, confirmAction, runAction } = useAdmin()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const { touch, setTried, shown } = useValidation()

  useEffect(() => { if (settings && !form) setForm(settings) }, [settings, form])

  const setField = (k, filter) => (e) => {
    const value = filter ? filter(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [k]: value }))
  }
  const toggle = (k) => setForm((f) => ({ ...f, [k]: !f[k] }))
  const dirty = form && settings && JSON.stringify(form) !== JSON.stringify(settings)

  const errors = form ? {
    cemeteryName: textError(form.cemeteryName, { label: 'Cemetery name', required: true, min: 2, max: 100 }),
    address: textError(form.address, { label: 'Address', max: 200 }),
    contactNumber: contactError(form.contactNumber),
    tagline: textError(form.tagline, { label: 'Tagline', max: 120 }),
  } : {}
  const err = shown(errors)

  const save = async () => {
    setTried(true)
    if (hasErrors(errors)) return
    setSaving(true)
    await runAction(() => api.saveSettings(form), 'Settings saved.')
    setSaving(false)
  }

  const removeStaff = (a) => confirmAction({
    title: 'Remove staff member?',
    message: `${a.name} will lose access to the admin dashboard.`,
    confirmLabel: 'Remove',
    successMessage: `${a.name} removed.`,
    onConfirm: () => api.removeAdminStaff(a.id),
  })

  return (
    <div>
      <div className="page-header">
        <div><h2>Settings</h2><p>Configure system preferences and admin access.</p></div>
        <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div>
          <div className="card settings-section">
            <h3>Cemetery Information</h3>
            {form && [
              ['Cemetery Name', 'cemeteryName', 100],
              ['Address', 'address', 200],
              ['Contact Number', 'contactNumber', 20, onlyPhoneChars, 'tel'],
              ['Tagline', 'tagline', 120],
            ].map(([l, k, max, filter, mode]) => (
              <div key={k} className="modal-field" style={{ marginBottom: 12 }}>
                <label>{l}</label>
                <input
                  value={form[k] || ''} onChange={setField(k, filter)} onBlur={touch(k)}
                  maxLength={max} inputMode={mode} style={invalidStyle(err(k))}
                />
                <FieldError msg={err(k)} />
              </div>
            ))}
            <p style={{ fontSize: 11, color: 'var(--dgray)', marginTop: 4 }}>
              Saved on this device for now. Once a settings table exists, both
              dashboards can read these from one place.
            </p>
          </div>
          <ChangePasswordCard />
        </div>

        <div>
          <div className="card settings-section">
            <h3>Admin Staff</h3>
            {!loading && staff.map(a => (
              <div key={a.id} className="settings-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>{a.avatar}</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--dgray)' }}>{a.role}</p>
                  </div>
                </div>
                <button className="btn btn-danger btn-xs" onClick={() => removeStaff(a)}>Remove</button>
              </div>
            ))}
            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => openModal('modal-addadmin')}>+ Add Staff</button>
          </div>
        </div>
      </div>
    </div>
  )
}
