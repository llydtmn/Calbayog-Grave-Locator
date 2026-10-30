// ─────────────────────────────────────────────────────────────────────────────
// RESERVATIONS REPORT — reservation requests by status and block, filterable by
// date, classification and payment option.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { useReservations, useBlocks } from '../../hooks'
import { RESERVATION_STATUS, RESERVATION_STATUS_META } from '../../config/adminStatus'
import { PAYMENT_OPTION_LABEL } from '../../config/paymentStatus'
import { CLASSIFICATION_ORDER } from '../../config/constants'
import { formatDate } from '../../utils/date'
import { peso } from '../../utils/format'
import { downloadCSV } from '../../utils/csv'
import { filterReservations, summarizeReservations, reservationDate, sortBlocks } from '../../utils/reportData'
import {
  Select, SearchBox, DateRangeFields, useDateRange, rangeText, Stats, usePaging, Pager, ReportToolbar, PrintHeader,
  ErrorNote, ClearFilters, EmptyRow,
} from './reportUi'

const TITLE = 'Reservations Report'
const STATUSES = Object.values(RESERVATION_STATUS)
const BASIS = [{ value: 'submitted', label: 'Date submitted' }, { value: 'reservation', label: 'Reservation date' }]

export default function ReservationsReport() {
  const { reservations, loading, error, reload } = useReservations()
  const { blocks } = useBlocks()
  const dr = useDateRange('all')

  const [status, setStatus] = useState('all')
  const [blockId, setBlockId] = useState('all')
  const [classification, setClassification] = useState('all')
  const [option, setOption] = useState('all')
  const [basis, setBasis] = useState('submitted')
  const [query, setQuery] = useState('')

  const { from, to } = dr.range
  const filters = { status, blockId, classification, option, basis, from, to, query }
  const rows = useMemo(
    () => filterReservations(reservations, filters).sort((a, b) => reservationDate(b, basis).localeCompare(reservationDate(a, basis))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reservations, status, blockId, classification, option, basis, from, to, query],
  )
  const { rows: byBlock, totals } = useMemo(() => summarizeReservations(rows, blocks), [rows, blocks])

  const resetKey = `${status}|${blockId}|${classification}|${option}|${basis}|${from}|${to}|${query}`
  const pg = usePaging(rows.length, resetKey)
  const filtersActive = status !== 'all' || blockId !== 'all' || classification !== 'all' || option !== 'all' || !!query || dr.preset !== 'all'
  const clear = () => { setStatus('all'); setBlockId('all'); setClassification('all'); setOption('all'); setQuery(''); dr.reset() }

  const classes = [...new Set([...CLASSIFICATION_ORDER, ...reservations.map((r) => r.classification).filter(Boolean)])]
  const n = (s) => totals.byStatus[s] || 0
  const label = (s) => RESERVATION_STATUS_META[s]?.label || s
  const blockOptions = [{ value: 'all', label: 'All blocks' }, ...sortBlocks(blocks).map((b) => ({ value: b.id, label: b.name }))]
  const plot = (r) => [r.blockName, r.lotNo != null ? `Lot ${r.lotNo}` : null].filter(Boolean).join(' · ') || '—'

  const exportCsv = () => downloadCSV(`gravelocator-reservations-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
    ['Reservation ID', (r) => r.id],
    ['Applicant', (r) => r.applicantName],
    ['Contact', (r) => r.contactNumber || ''],
    ['Block', (r) => r.blockName || ''],
    ['Lot No', (r) => r.lotNo ?? ''],
    ['Classification', (r) => r.classification || ''],
    ['Price (PHP)', (r) => r.price ?? ''],
    ['Payment option', (r) => PAYMENT_OPTION_LABEL[r.paymentOption] || r.paymentOption || ''],
    ['Reservation date', (r) => r.reservationDate || ''],
    ['Submitted', (r) => reservationDate(r, 'submitted')],
    ['Status', (r) => label(r.status)],
  ])

  return (
    <div>
      <PrintHeader title={TITLE} filters={[
        status !== 'all' && `Status: ${label(status)}`,
        blockId !== 'all' && `Block: ${blocks.find((b) => b.id === blockId)?.name || blockId}`,
        classification !== 'all' && `Classification: ${classification}`,
        option !== 'all' && `Payment: ${PAYMENT_OPTION_LABEL[option] || option}`,
        dr.preset !== 'all' && `${basis === 'reservation' ? 'Reservation date' : 'Submitted'}: ${rangeText(dr.range)}`,
        query && `Search: "${query}"`,
      ]} />
      <ReportToolbar title={TITLE} description="Reservation requests by status, block and date.">
        <button className="btn btn-ghost" onClick={() => window.print()}>Print / PDF</button>
        <button className="btn btn-primary" onClick={exportCsv} disabled={!rows.length}>Export CSV (Excel)</button>
      </ReportToolbar>

      <div className="card no-print rp-filters">
        <Select label="Status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: label(s) }))]} />
        <Select label="Block" value={blockId} onChange={setBlockId} options={blockOptions} />
        <Select label="Classification" value={classification} onChange={setClassification} options={[{ value: 'all', label: 'All classifications' }, ...classes.map((c) => ({ value: c, label: c }))]} />
        <Select label="Payment" value={option} onChange={setOption} options={[{ value: 'all', label: 'All options' }, ...Object.entries(PAYMENT_OPTION_LABEL).map(([value, l]) => ({ value, label: l }))]} />
        <Select label="Filter dates by" value={basis} onChange={setBasis} options={BASIS} />
        <DateRangeFields dr={dr} />
        <SearchBox value={query} onChange={setQuery} placeholder="Search applicant, email, ID or lot…" />
        <ClearFilters active={filtersActive} onClick={clear} />
        <button className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>
      </div>

      <ErrorNote error={error} what="reservations" />

      <Stats items={[
        { label: 'Reservations', value: loading ? '…' : totals.total.toLocaleString(), sub: `${n('completed')} completed` },
        { label: 'Pending', value: loading ? '…' : n('pending').toLocaleString(), sub: 'awaiting review', color: '#B45309' },
        { label: 'Confirmed', value: loading ? '…' : n('confirmed').toLocaleString(), sub: `${n('rejected')} rejected · ${n('cancelled')} cancelled`, color: '#16A34A' },
        { label: 'Total value', value: loading ? '…' : peso(totals.value), sub: 'pending + confirmed + completed' },
      ]} />

      <div className="card" style={{ marginTop: 18 }}>
        <p className="chart-title">By Block and Status</p>
        <div className="table-wrap">
          <table className="rp-table">
            <thead><tr><th>Block</th><th className="rp-num">Total</th>{STATUSES.map((s) => <th key={s} className="rp-num">{label(s)}</th>)}<th className="rp-num">Value</th></tr></thead>
            <tbody>
              {byBlock.length === 0 && <EmptyRow cols={STATUSES.length + 3} loading={loading}>No reservations for these filters.</EmptyRow>}
              {byBlock.map((r) => (
                <tr key={r.blockId}>
                  <td><b>{r.name}</b></td><td className="rp-num">{r.total}</td>
                  {STATUSES.map((s) => <td key={s} className="rp-num">{r.byStatus[s] || 0}</td>)}
                  <td className="rp-num">{peso(r.value)}</td>
                </tr>
              ))}
            </tbody>
            {byBlock.length > 1 && (
              <tfoot><tr><td>All blocks</td><td className="rp-num">{totals.total}</td>{STATUSES.map((s) => <td key={s} className="rp-num">{n(s)}</td>)}<td className="rp-num">{peso(totals.value)}</td></tr></tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="flex justify-between items-center mb-16">
          <p className="chart-title" style={{ marginBottom: 0 }}>Reservation List</p>
          <span className="rp-total"><b>{rows.length.toLocaleString()}</b> reservation{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="table-wrap">
          <table className="rp-table">
            <thead><tr><th>ID</th><th>Applicant</th><th>Plot</th><th>Classification</th><th className="rp-num">Price</th><th>Payment</th><th>Reservation date</th><th>Submitted</th><th>Status</th></tr></thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={9} loading={loading}>No reservations for these filters.</EmptyRow>}
              {pg.slice(rows).map((r) => (
                <tr key={r.id}>
                  <td className="user-id-cell">{r.id}</td>
                  <td>{r.applicantName}</td>
                  <td>{plot(r)}</td>
                  <td>{r.classification || '—'}</td>
                  <td className="rp-num">{r.price != null ? peso(r.price) : '—'}</td>
                  <td>{PAYMENT_OPTION_LABEL[r.paymentOption] || r.paymentOption || '—'}</td>
                  <td>{r.reservationDate ? formatDate(r.reservationDate) : '—'}</td>
                  <td>{formatDate(reservationDate(r, 'submitted'))}</td>
                  <td><span className={`badge ${RESERVATION_STATUS_META[r.status]?.badge || ''}`}>{label(r.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pg={pg} total={rows.length} />
      </div>
    </div>
  )
}
