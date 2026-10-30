// ─────────────────────────────────────────────────────────────────────────────
// INSTALLMENT ACCOUNTS — confirmed installment reservations: what is owed, what
// has been paid (verified monthly payments) and who is behind.
// "Months behind" is an ESTIMATE: whole months since the down payment (or the
// reservation) date, capped at the term, minus months already paid.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { usePaymentOverview } from '../../hooks'
import { installmentProgress } from '../../api/paymentsApi'
import { INSTALLMENT_TERM_LABEL } from '../../config/paymentStatus'
import { formatDate } from '../../utils/date'
import { peso } from '../../utils/format'
import { downloadCSV } from '../../utils/csv'
import { buildInstallmentAccounts } from '../../utils/reportData'
import { Select, SearchBox, Stats, usePaging, Pager, ReportToolbar, PrintHeader, ErrorNote, ClearFilters, EmptyRow } from './reportUi'

const TITLE = 'Installment Accounts'
const STATE = {
  behind:  { label: 'Behind',   badge: 'badge-rejected' },
  current: { label: 'On track', badge: 'badge-confirmed' },
  paid:    { label: 'Fully paid', badge: 'badge-completed' },
}

export default function InstallmentReport() {
  const { paymentReservations, installments, loading, error, reload } = usePaymentOverview()

  const [state, setState] = useState('all')
  const [term, setTerm] = useState('all')
  const [block, setBlock] = useState('all')
  const [query, setQuery] = useState('')

  const accounts = useMemo(
    () => buildInstallmentAccounts(paymentReservations, installments, installmentProgress),
    [paymentReservations, installments],
  )
  const blockNames = useMemo(() => [...new Set(accounts.map((a) => a.blockName).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [accounts])

  const q = query.trim().toLowerCase()
  const rows = useMemo(() => accounts
    .filter((a) => (state === 'all' || a.state === state)
      && (term === 'all' || a.term === term)
      && (block === 'all' || a.blockName === block)
      && (!q || `${a.id} ${a.applicant} ${a.plot}`.toLowerCase().includes(q)))
    .sort((a, b) => b.behind - a.behind || b.left - a.left),
  [accounts, state, term, block, q])

  const resetKey = `${state}|${term}|${block}|${query}`
  const pg = usePaging(rows.length, resetKey)
  const filtersActive = state !== 'all' || term !== 'all' || block !== 'all' || !!query
  const clear = () => { setState('all'); setTerm('all'); setBlock('all'); setQuery('') }

  const sum = (key) => rows.reduce((s, a) => s + (a[key] || 0), 0)
  const behindCount = rows.filter((a) => a.state === 'behind').length

  const exportCsv = () => downloadCSV(`gravelocator-installment-accounts-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
    ['Reservation ID', (a) => a.id],
    ['Applicant', (a) => a.applicant],
    ['Block', (a) => a.blockName],
    ['Lot No', (a) => a.lotNo ?? ''],
    ['Classification', (a) => a.classification || ''],
    ['Term', (a) => INSTALLMENT_TERM_LABEL[a.term] || a.term],
    ['Monthly (PHP)', (a) => a.monthly],
    ['Total owed (PHP)', (a) => a.owed],
    ['Paid (PHP)', (a) => a.paid],
    ['Balance (PHP)', (a) => a.left],
    ['Months paid', (a) => a.monthsCovered],
    ['Term (months)', (a) => a.months],
    ['Est. months behind', (a) => a.behind],
    ['Last payment', (a) => a.lastPaid],
    ['Status', (a) => STATE[a.state].label],
  ])

  return (
    <div>
      <PrintHeader title={TITLE} filters={[
        state !== 'all' && `Status: ${STATE[state].label}`,
        term !== 'all' && `Term: ${INSTALLMENT_TERM_LABEL[term] || term}`,
        block !== 'all' && `Block: ${block}`,
        query && `Search: "${query}"`,
      ]} />
      <ReportToolbar title={TITLE} description="Confirmed installment reservations: balance, progress and accounts that are behind.">
        <button className="btn btn-ghost" onClick={() => window.print()}>Print / PDF</button>
        <button className="btn btn-primary" onClick={exportCsv} disabled={!rows.length}>Export CSV (Excel)</button>
      </ReportToolbar>

      <div className="card no-print rp-filters">
        <Select label="Account status" value={state} onChange={setState} options={[{ value: 'all', label: 'All accounts' }, ...Object.entries(STATE).map(([value, s]) => ({ value, label: s.label }))]} />
        <Select label="Term" value={term} onChange={setTerm} options={[{ value: 'all', label: 'All terms' }, ...Object.entries(INSTALLMENT_TERM_LABEL).map(([value, label]) => ({ value, label }))]} />
        <Select label="Block" value={block} onChange={setBlock} options={[{ value: 'all', label: 'All blocks' }, ...blockNames.map((b) => ({ value: b, label: b }))]} />
        <SearchBox value={query} onChange={setQuery} placeholder="Search applicant, ID or lot…" />
        <ClearFilters active={filtersActive} onClick={clear} />
        <button className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>
      </div>

      <ErrorNote error={error} what="installment accounts" />

      <Stats items={[
        { label: 'Accounts', value: loading ? '…' : rows.length.toLocaleString(), sub: 'confirmed / completed' },
        { label: 'Total owed', value: loading ? '…' : peso(sum('owed')), sub: 'monthly × term, interest included' },
        { label: 'Collected', value: loading ? '…' : peso(sum('paid')), sub: 'verified monthly payments' },
        { label: 'Outstanding balance', value: loading ? '…' : peso(sum('left')), sub: `${behindCount} account${behindCount === 1 ? '' : 's'} behind`, color: behindCount ? '#DC2626' : undefined },
      ]} />

      <div className="card" style={{ marginTop: 18 }}>
        <div className="flex justify-between items-center mb-16">
          <p className="chart-title" style={{ marginBottom: 0 }}>Accounts</p>
          <span className="rp-total"><b>{rows.length.toLocaleString()}</b> account{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="table-wrap">
          <table className="rp-table">
            <thead><tr><th>Applicant</th><th>Plot</th><th>Term</th><th className="rp-num">Monthly</th><th className="rp-num">Paid</th><th className="rp-num">Balance</th><th>Progress</th><th>Last payment</th><th>Status</th></tr></thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={9} loading={loading}>No installment accounts for these filters.</EmptyRow>}
              {pg.slice(rows).map((a) => (
                <tr key={a.id}>
                  <td><b>{a.applicant}</b><br /><small className="user-id-cell">{a.id}</small></td>
                  <td>{a.plot}</td>
                  <td>{INSTALLMENT_TERM_LABEL[a.term] || a.term || '—'}</td>
                  <td className="rp-num">{peso(a.monthly)}</td>
                  <td className="rp-num">{peso(a.paid)}</td>
                  <td className="rp-num"><b>{peso(a.left)}</b></td>
                  <td>
                    {a.monthsCovered} / {a.months} mo
                    {a.behind > 0 && <><br /><small style={{ color: '#DC2626' }}>~{a.behind} mo behind</small></>}
                  </td>
                  <td>{a.lastPaid ? formatDate(a.lastPaid) : <span className="rp-muted">none yet</span>}</td>
                  <td><span className={`badge ${STATE[a.state].badge}`}>{STATE[a.state].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pg={pg} total={rows.length} />
        <p className="rp-muted" style={{ marginTop: 10 }}>"Behind" is an estimate: months since the down payment (or reservation) date, up to the term, minus months already covered by verified payments.</p>
      </div>
    </div>
  )
}
