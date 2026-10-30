// ─────────────────────────────────────────────────────────────────────────────
// INTERMENT REGISTER — every person recorded on a lot (name, date of death, date
// of burial, block, lot). Built from lots.deceased_records, so it is only as
// complete as the names/dates the office has entered or imported.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { useAllLots, useBlocks } from '../../hooks'
import { formatDate } from '../../utils/date'
import { downloadCSV } from '../../utils/csv'
import { intermentRecords, intermentGaps, inRange, sortBlocks } from '../../utils/reportData'
import {
  Select, SearchBox, DateRangeFields, useDateRange, rangeText, Stats, usePaging, Pager, ReportToolbar, PrintHeader,
  ErrorNote, ClearFilters, EmptyRow, MonthlyBars, MONTHS,
} from './reportUi'

const TITLE = 'Interment Register'
const BASIS = [{ value: 'burialDate', label: 'Date of burial' }, { value: 'deathDate', label: 'Date of death' }]
const BASIS_LABEL = { burialDate: 'burial', deathDate: 'death' }

export default function IntermentReport() {
  const { lots, loading, error, reload } = useAllLots()
  const { blocks } = useBlocks()
  const dr = useDateRange('all')

  const [blockId, setBlockId] = useState('all')
  const [classification, setClassification] = useState('all')
  const [basis, setBasis] = useState('burialDate')
  const [query, setQuery] = useState('')
  const [chartYear, setChartYear] = useState(new Date().getFullYear())

  const blockName = useMemo(() => Object.fromEntries(blocks.map((b) => [b.id, b.name])), [blocks])
  const records = useMemo(() => intermentRecords(lots, (id) => blockName[id] || id), [lots, blockName])
  const gaps = useMemo(() => intermentGaps(lots), [lots])
  const classes = useMemo(() => [...new Set(records.map((r) => r.classification).filter(Boolean))], [records])

  const q = query.trim().toLowerCase()
  // Everything except the date range — feeds the by-month chart.
  const base = useMemo(() => records.filter((r) =>
    (blockId === 'all' || r.blockId === blockId)
    && (classification === 'all' || r.classification === classification)
    && (!q || `${r.name} ${r.lotNo ?? ''}`.toLowerCase().includes(q)),
  ), [records, blockId, classification, q])

  const { from, to } = dr.range
  const rows = useMemo(() => base
    .filter((r) => inRange(r[basis], from, to))
    .sort((a, b) => (b[basis] || '').localeCompare(a[basis] || '') || a.name.localeCompare(b.name)),
  [base, basis, from, to])
  const undated = base.filter((r) => !r[basis]).length

  const years = useMemo(() => [...new Set([new Date().getFullYear(), ...records.map((r) => Number((r[basis] || '').slice(0, 4))).filter(Boolean)])].sort((a, b) => b - a), [records, basis])
  const monthly = MONTHS.map((label, i) => ({
    label, value: base.filter((r) => (r[basis] || '').startsWith(`${chartYear}-${String(i + 1).padStart(2, '0')}`)).length,
  }))
  const pickMonth = (i) => {
    const mm = String(i + 1).padStart(2, '0')
    const last = new Date(chartYear, i + 1, 0).getDate()
    dr.setRange(`${chartYear}-${mm}-01`, `${chartYear}-${mm}-${last}`)
  }

  // Highlight the bar when the date range is exactly one whole month of the chart year.
  const activeMonth = (() => {
    const { from: f, to: t } = dr.range
    if (dr.preset !== 'custom' || !f || !t) return -1
    const [y, m] = f.split('-')
    return Number(y) === chartYear && f === `${y}-${m}-01` && t.slice(0, 7) === f.slice(0, 7) ? Number(m) - 1 : -1
  })()

  // Per-block counts for the filtered rows.
  const byBlock = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      if (!m.has(r.blockId)) m.set(r.blockId, { blockId: r.blockId, name: r.blockName, records: 0, lots: new Set() })
      const e = m.get(r.blockId); e.records += 1; e.lots.add(r.lotNo ?? r.id)
    }
    const order = new Map(sortBlocks(blocks).map((b, i) => [b.id, i]))
    return [...m.values()].sort((a, b) => (order.get(a.blockId) ?? 999) - (order.get(b.blockId) ?? 999))
  }, [rows, blocks])

  const resetKey = `${blockId}|${classification}|${basis}|${query}|${from}|${to}`
  const pg = usePaging(rows.length, resetKey)
  const filtersActive = blockId !== 'all' || classification !== 'all' || !!query || dr.preset !== 'all'
  const clear = () => { setBlockId('all'); setClassification('all'); setQuery(''); dr.reset() }

  const blockOptions = [{ value: 'all', label: 'All blocks' }, ...sortBlocks(blocks).map((b) => ({ value: b.id, label: b.name }))]
  const classOptions = [{ value: 'all', label: 'All classifications' }, ...classes.map((c) => ({ value: c, label: c }))]

  const exportCsv = () => downloadCSV(`gravelocator-interment-register-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
    ['Name of deceased', (r) => r.name],
    ['Date of death', (r) => r.deathDate],
    ['Date of burial', (r) => r.burialDate],
    ['Block', (r) => r.blockName],
    ['Lot No', (r) => r.lotNo ?? ''],
    ['Classification', (r) => r.classification || ''],
  ])

  return (
    <div>
      <PrintHeader title={TITLE} filters={[
        blockId !== 'all' && `Block: ${blockName[blockId] || blockId}`,
        classification !== 'all' && `Classification: ${classification}`,
        dr.preset !== 'all' && `${BASIS_LABEL[basis]} date: ${rangeText(dr.range)}`,
        query && `Search: "${query}"`,
      ]} />
      <ReportToolbar title={TITLE} description="People interred in the park, with date of death, date of burial and lot location.">
        <button className="btn btn-ghost" onClick={() => window.print()}>Print / PDF</button>
        <button className="btn btn-primary" onClick={exportCsv} disabled={!rows.length}>Export CSV (Excel)</button>
      </ReportToolbar>

      <div className="card no-print rp-filters">
        <Select label="Block" value={blockId} onChange={setBlockId} options={blockOptions} />
        <Select label="Classification" value={classification} onChange={setClassification} options={classOptions} />
        <Select label="Filter dates by" value={basis} onChange={setBasis} options={BASIS} />
        <DateRangeFields dr={dr} />
        <SearchBox value={query} onChange={setQuery} placeholder="Search name or lot no…" />
        <ClearFilters active={filtersActive} onClick={clear} />
        <button className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>
      </div>

      <ErrorNote error={error} what="lots" />

      <Stats items={[
        { label: 'Interments shown', value: loading ? '…' : rows.length.toLocaleString(), sub: `${byBlock.reduce((s, b) => s + b.lots.size, 0).toLocaleString()} lots` },
        { label: 'Names recorded (all)', value: loading ? '…' : gaps.named.toLocaleString(), sub: 'across every block' },
        { label: 'Interments marked on map', value: loading ? '…' : gaps.onMap.toLocaleString(), sub: 'tick marks (| / ||)' },
        { label: 'Marked but no name yet', value: loading ? '…' : gaps.missing.toLocaleString(), sub: `${gaps.lotsMissing.toLocaleString()} lots to complete`, color: gaps.missing ? '#B45309' : undefined },
      ]} />

      <div className="card" style={{ marginTop: 18 }}>
        <div className="flex justify-between items-center mb-16">
          <p className="chart-title" style={{ marginBottom: 0 }}>Interments by Month · {chartYear}</p>
          <label className="rp-switch no-print">Year
            <select className="filter-select" value={chartYear} onChange={(e) => setChartYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
        <MonthlyBars data={monthly} ariaLabel={`Interments by month for ${chartYear}`} onSelect={pickMonth} activeIndex={activeMonth} />
        <p className="rp-muted" style={{ marginTop: 8 }}>
          Counts by date of {BASIS_LABEL[basis]} (block, classification and search filters apply). Click a month to filter the register.
          {undated > 0 && <> {undated.toLocaleString()} record{undated === 1 ? ' has' : 's have'} no date of {BASIS_LABEL[basis]} and only show when no date filter is set.</>}
        </p>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <p className="chart-title">By Block</p>
        <div className="table-wrap">
          <table className="rp-table">
            <thead><tr><th>Block</th><th className="rp-num">Interments</th><th className="rp-num">Lots</th></tr></thead>
            <tbody>
              {byBlock.length === 0 && <EmptyRow cols={3} loading={loading}>No interment records for these filters.</EmptyRow>}
              {byBlock.map((b) => (
                <tr key={b.blockId}><td><b>{b.name}</b></td><td className="rp-num">{b.records.toLocaleString()}</td><td className="rp-num">{b.lots.size.toLocaleString()}</td></tr>
              ))}
            </tbody>
            {byBlock.length > 1 && (
              <tfoot><tr><td>Total</td><td className="rp-num">{rows.length.toLocaleString()}</td><td className="rp-num">{byBlock.reduce((s, b) => s + b.lots.size, 0).toLocaleString()}</td></tr></tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="flex justify-between items-center mb-16">
          <p className="chart-title" style={{ marginBottom: 0 }}>Register</p>
          <span className="rp-total"><b>{rows.length.toLocaleString()}</b> record{rows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="table-wrap">
          <table className="rp-table">
            <thead><tr><th>Name of deceased</th><th>Date of death</th><th>Date of burial</th><th>Block</th><th>Lot</th><th>Classification</th></tr></thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={6} loading={loading}>No interment records for these filters.</EmptyRow>}
              {pg.slice(rows).map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b></td>
                  <td>{r.deathDate ? formatDate(r.deathDate) : <span className="rp-muted">—</span>}</td>
                  <td>{r.burialDate ? formatDate(r.burialDate) : <span className="rp-muted">—</span>}</td>
                  <td>{r.blockName}</td>
                  <td>{r.lotNo ?? <span className="rp-muted">no number</span>}</td>
                  <td>{r.classification || '—'}</td>
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
