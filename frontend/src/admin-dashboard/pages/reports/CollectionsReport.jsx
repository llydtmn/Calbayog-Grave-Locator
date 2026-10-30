// ─────────────────────────────────────────────────────────────────────────────
// COLLECTIONS — monthly income and the list of paid payments. This is the
// original Reports page (moved here unchanged apart from a payment-method filter
// and the shared toolbar); the plot-occupancy parts now live in "Lot Status".
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { usePaidPayments } from '../../hooks'
import { formatDate } from '../../utils/date'
import { peso } from '../../utils/format'
import { Select, ReportToolbar, PrintHeader, MONTHS } from './reportUi'

const METHOD_LABEL = { cash: 'Cash', gcash: 'GCash' }
const TITLE = 'Collections (Paid Payments)'

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

export default function CollectionsReport() {
  const { payments, warnings, loading, error, reload } = usePaidPayments()

  const now = new Date()
  const thisYear = now.getFullYear()
  const [year, setYear] = useState(thisYear)
  const [month, setMonth] = useState('all') // 'all' | 0..11
  const [method, setMethod] = useState('all')
  const [query, setQuery] = useState('')

  // Years that have payments (always include the current year).
  const years = [...new Set([thisYear, ...payments.map((p) => Number(p.date.slice(0, 4)))])]
    .filter(Boolean).sort((a, b) => b - a)

  const yearPayments = payments
    .filter((p) => Number(p.date.slice(0, 4)) === year)
    .filter((p) => method === 'all' || p.method === method)

  // Monthly income for the selected year.
  const monthly = MONTHS.map((label, i) => {
    const items = yearPayments.filter((p) => Number(p.date.slice(5, 7)) === i + 1)
    return { label, i, total: items.reduce((s, p) => s + p.amount, 0), count: items.length }
  })
  const maxMonth = Math.max(1, ...monthly.map((m) => m.total))
  const yearTotal = monthly.reduce((s, m) => s + m.total, 0)
  const thisMonthTotal = year === thisYear ? monthly[now.getMonth()].total : 0
  const activeMonths = monthly.filter((m) => m.total > 0).length
  const avgMonth = activeMonths ? yearTotal / activeMonths : 0

  // Paid payments table (year + month + method + search).
  const q = query.trim().toLowerCase()
  const rows = yearPayments
    .filter((p) => month === 'all' || Number(p.date.slice(5, 7)) === month + 1)
    .filter((p) => !q || `${p.payer} ${p.plot} ${p.type} ${p.method}`.toLowerCase().includes(q))
  const rowsTotal = rows.reduce((s, p) => s + p.amount, 0)

  const exportCsv = () => {
    const period = month === 'all' ? `${year}` : `${MONTHS[month]}-${year}`
    downloadCsv(`gravelocator-paid-payments-${period}.csv`, [
      ['Date', 'Payer', 'Plot', 'Type', 'Method', 'Amount (PHP)'],
      ...rows.map((p) => [p.date, p.payer, p.plot, p.type, METHOD_LABEL[p.method] || p.method, p.amount]),
      [],
      ['', '', '', '', 'Total', rowsTotal],
      [],
      ['Monthly income', year],
      ...monthly.map((m) => [m.label, m.total]),
      ['Year total', yearTotal],
    ])
  }

  const filtersActive = month !== 'all' || method !== 'all' || !!query
  const printFilters = [
    `Year: ${year}`,
    month !== 'all' && `Month: ${MONTHS[month]}`,
    method !== 'all' && `Method: ${METHOD_LABEL[method] || method}`,
    query && `Search: "${query}"`,
  ]

  return (
    <div>
      <PrintHeader title={TITLE} filters={printFilters} />
      <ReportToolbar title={TITLE} description="Monthly income and every payment actually received (cash, GCash, installments).">
        <button className="btn btn-ghost" onClick={() => window.print()}>Print / PDF</button>
        <button className="btn btn-primary" onClick={exportCsv} disabled={!rows.length}>Export CSV (Excel)</button>
      </ReportToolbar>

      {/* Filters */}
      <div className="card no-print rp-filters">
        <Select label="Year" value={year} onChange={(v) => setYear(Number(v))} options={years.map((y) => ({ value: y, label: String(y) }))} />
        <Select label="Month" value={month} onChange={(v) => setMonth(v === 'all' ? 'all' : Number(v))} options={[{ value: 'all', label: 'All months' }, ...MONTHS.map((m, i) => ({ value: i, label: m }))]} />
        <Select label="Method" value={method} onChange={setMethod} options={[{ value: 'all', label: 'All methods' }, ...Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))]} />
        <input className="filter-input" placeholder="Search payer, plot, type…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {filtersActive && <button className="btn btn-ghost btn-sm" onClick={() => { setMonth('all'); setMethod('all'); setQuery('') }}>Clear filters</button>}
        <button className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>
      </div>

      {error && <div className="card rp-alert rp-alert-err">Could not load payments: {error.message}</div>}
      {warnings.map((w) => <div key={w} className="card rp-alert">{w}</div>)}

      {/* Summary */}
      <div className="rp-stats">
        <div className="card rp-stat"><span>Total income · {year}</span><b>{peso(yearTotal)}</b></div>
        <div className="card rp-stat"><span>This month</span><b>{year === thisYear ? peso(thisMonthTotal) : '—'}</b></div>
        <div className="card rp-stat"><span>Paid payments · {year}</span><b>{yearPayments.length}</b></div>
        <div className="card rp-stat"><span>Average / active month</span><b>{peso(Math.round(avgMonth))}</b></div>
      </div>

      {/* Monthly income chart */}
      <div className="card" style={{ marginTop: 18 }}>
        <p className="chart-title">Monthly Income · {year}</p>
        {loading ? <p className="rp-muted">Loading payments…</p> : (
          <div className="rp-chart" role="img" aria-label={`Monthly income for ${year}`}>
            {monthly.map((m) => (
              <button
                key={m.label}
                type="button"
                className={`rp-bar-col${month === m.i ? ' active' : ''}`}
                onClick={() => setMonth(month === m.i ? 'all' : m.i)}
                title={`${m.label} ${year}: ${peso(m.total)} (${m.count} payment${m.count === 1 ? '' : 's'})`}
              >
                <span className="rp-bar-val">{m.total ? peso(m.total) : ''}</span>
                <span className="rp-bar-track"><span className="rp-bar" style={{ height: `${(m.total / maxMonth) * 100}%` }} /></span>
                <span className="rp-bar-label">{m.label}</span>
              </button>
            ))}
          </div>
        )}
        <p className="rp-muted" style={{ marginTop: 8 }}>Tap a month to filter the paid payments list.</p>
      </div>

      {/* Paid payments */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="flex justify-between items-center mb-16">
          <p className="chart-title" style={{ marginBottom: 0 }}>
            Paid Payments · {month === 'all' ? year : `${MONTHS[month]} ${year}`}
          </p>
          <span className="rp-total">{rows.length} payment{rows.length === 1 ? '' : 's'} · <b>{peso(rowsTotal)}</b></span>
        </div>
        <div className="table-wrap">
          <table className="rp-table">
            <thead><tr><th>Date</th><th>Payer</th><th>Plot</th><th>Type</th><th>Method</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="rp-muted" style={{ textAlign: 'center', padding: 24 }}>No paid payments for this period.</td></tr>
              )}
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date)}</td>
                  <td>{p.payer}</td>
                  <td>{p.plot}</td>
                  <td>{p.type}</td>
                  <td><span className={`badge rp-method rp-method-${p.method === 'gcash' ? 'gcash' : 'cash'}`}>{METHOD_LABEL[p.method] || p.method}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{peso(p.amount)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot><tr><td colSpan={5} style={{ textAlign: 'right' }}>Total</td><td style={{ textAlign: 'right' }}>{peso(rowsTotal)}</td></tr></tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
