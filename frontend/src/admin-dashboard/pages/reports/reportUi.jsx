// ─────────────────────────────────────────────────────────────────────────────
// Small shared pieces for the Reports tabs: filter fields, date-range presets,
// stat cards, paging, toolbar and the print-only heading.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { PARK } from '../../config/constants'
import { presetRange } from '../../utils/reportData'

export function Select({ label, value, onChange, options }) {
  return (
    <label>{label}
      <select className="filter-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function SearchBox({ value, onChange, placeholder }) {
  return <input className="filter-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
}

// ── Date range with quick presets ────────────────────────────────────────────
export const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'lastmonth', label: 'Last month' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range…' },
]

export function useDateRange(initial = 'all') {
  const [preset, setPresetState] = useState(initial)
  const [custom, setCustom] = useState({ from: '', to: '' })
  const range = preset === 'custom' ? custom : presetRange(preset)
  return {
    preset, range,
    // Switching to "Custom" starts from the range that was showing.
    setPreset: (p) => { if (p === 'custom' && preset !== 'custom') setCustom(presetRange(preset)); setPresetState(p) },
    setFrom: (from) => setCustom((c) => ({ ...c, from })),
    setTo: (to) => setCustom((c) => ({ ...c, to })),
    setRange: (from, to) => { setCustom({ from, to }); setPresetState('custom') },
    reset: () => { setPresetState('all'); setCustom({ from: '', to: '' }) },
  }
}

const dateStyle = { flex: 'none', minWidth: 0, width: 150 }
export function DateRangeFields({ dr, label = 'Period' }) {
  return (
    <>
      <Select label={label} value={dr.preset} onChange={dr.setPreset} options={PERIODS} />
      {dr.preset === 'custom' && (
        <>
          <label>From
            <input type="date" className="filter-input" style={dateStyle} value={dr.range.from} max={dr.range.to || undefined} onChange={(e) => dr.setFrom(e.target.value)} />
          </label>
          <label>To
            <input type="date" className="filter-input" style={dateStyle} value={dr.range.to} min={dr.range.from || undefined} onChange={(e) => dr.setTo(e.target.value)} />
          </label>
        </>
      )}
    </>
  )
}

// "Mar 1, 2026 – Mar 31, 2026" style text for the printed heading.
export function rangeText(range) {
  if (!range.from && !range.to) return ''
  return `${range.from || '…'} to ${range.to || '…'}`
}

// ── Stat cards ───────────────────────────────────────────────────────────────
export function Stats({ items }) {
  return (
    <div className="rp-stats">
      {items.map((i) => (
        <div key={i.label} className="card rp-stat">
          <span>{i.label}</span>
          <b style={i.color ? { color: i.color } : undefined}>{i.value}</b>
          {i.sub && <small className="rp-muted">{i.sub}</small>}
        </div>
      ))}
    </div>
  )
}

// ── Paging (0 = show all, handy before printing) ─────────────────────────────
export function usePaging(total, resetKey, initialSize = 50) {
  const [page, setPage] = useState(1)
  const [size, setSizeState] = useState(initialSize)
  useEffect(() => { setPage(1) }, [resetKey])
  const pages = size ? Math.max(1, Math.ceil(total / size)) : 1
  const cur = Math.min(page, pages)
  const start = size ? (cur - 1) * size : 0
  const end = size ? Math.min(total, start + size) : total
  return {
    page: cur, pages, size, start, end,
    setPage, setSize: (s) => { setSizeState(Number(s)); setPage(1) },
    slice: (rows) => rows.slice(start, end),
  }
}

export function Pager({ pg, total }) {
  if (!total) return null
  return (
    <div className="rp-pager no-print">
      <span>Showing {pg.start + 1}–{pg.end} of {total.toLocaleString()}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select className="filter-select" value={pg.size} onChange={(e) => pg.setSize(e.target.value)} aria-label="Rows per page">
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
          <option value={0}>All rows</option>
        </select>
        {pg.size > 0 && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => pg.setPage(pg.page - 1)} disabled={pg.page <= 1}>Prev</button>
            <span>Page {pg.page} / {pg.pages}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => pg.setPage(pg.page + 1)} disabled={pg.page >= pg.pages}>Next</button>
          </>
        )}
      </span>
    </div>
  )
}

// ── Toolbar / headings / notes ───────────────────────────────────────────────
export function ReportToolbar({ title, description, children }) {
  return (
    <div className="rp-toolbar">
      <div>
        <h3>{title}</h3>
        <p className="rp-muted">{description}</p>
      </div>
      <div className="no-print rp-actions">{children}</div>
    </div>
  )
}

export function PrintHeader({ title, filters = [] }) {
  const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })
  const applied = filters.filter(Boolean)
  return (
    <div className="print-only rp-print-head">
      <h2>{PARK.name}</h2>
      <h3>{title}</h3>
      <p>Generated {now} · {applied.length ? applied.join(' · ') : 'No filters (all records)'}</p>
    </div>
  )
}

export function ErrorNote({ error, what }) {
  if (!error) return null
  return <div className="card rp-alert rp-alert-err">Could not load {what}: {error.message}</div>
}

export function ClearFilters({ onClick, active }) {
  if (!active) return null
  return <button className="btn btn-ghost btn-sm" onClick={onClick}>Clear filters</button>
}

export function EmptyRow({ cols, loading, children }) {
  return (
    <tr><td colSpan={cols} className="rp-muted" style={{ textAlign: 'center', padding: 24 }}>
      {loading ? 'Loading…' : children}
    </td></tr>
  )
}

export function MonthlyBars({ data, activeIndex, onSelect, ariaLabel }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="rp-chart" role="img" aria-label={ariaLabel}>
      {data.map((m, i) => (
        <button key={m.label} type="button" className={`rp-bar-col${activeIndex === i ? ' active' : ''}`}
          onClick={() => onSelect?.(i)} title={`${m.label}: ${m.value}`}>
          <span className="rp-bar-val">{m.value || ''}</span>
          <span className="rp-bar-track"><span className="rp-bar" style={{ height: `${(m.value / max) * 100}%` }} /></span>
          <span className="rp-bar-label">{m.label}</span>
        </button>
      ))}
    </div>
  )
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
