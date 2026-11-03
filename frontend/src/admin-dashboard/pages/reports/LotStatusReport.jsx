// ─────────────────────────────────────────────────────────────────────────────
// LOT STATUS REPORT — available / occupied / reserved lots in each block, with a
// drill-down lot list. Lot status is a live snapshot (the lots table does not
// keep when a status changed), so the "Status date" filter uses the records the
// office already has: date of burial for occupied lots, reservation date for
// reserved lots (see lotStatusDate in utils/reportData.js). Available lots have
// no date, so they only show while no date range is set.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef, useState } from 'react'
import { useAllLots, useBlocks, usePricing, useReservations } from '../../hooks'
import { STATUS_META, STATUS_ORDER, statusLabel } from '../../config/status'
import { peso, percent } from '../../utils/format'
import { downloadCSV } from '../../utils/csv'
import { downloadLotListExcel } from '../../utils/lotExcel'
import {
  GROUP_ORDER, GROUP_META, groupOf, summarizeByBlock, summarizeByClassification, undigitizedBlocks,
  filterLots, sortLots, sortBlocks, lotDeceased, reservationDateByLot, lotStatusDate,
} from '../../utils/reportData'
import { Select, SearchBox, DateRangeFields, useDateRange, rangeText, Stats, usePaging, Pager, ReportToolbar, PrintHeader, ErrorNote, ClearFilters, EmptyRow } from './reportUi'
import { formatDate } from '../../utils/date'

const TITLE = 'Lot Status by Block'
// Statuses that share a group (sold + with interment, the "other" ones) get their own filter option;
// Available and Reserve Lot are a group of one, so the group option covers them.
const inMultiGroup = (s) => GROUP_META[groupOf(s)].statuses.length > 1

function StatusPill({ status }) {
  const m = STATUS_META[status]
  if (!m) return <span>{status}</span>
  return <span className="rp-pill" style={{ background: m.fill, color: m.text, borderColor: m.border }}>{m.label}</span>
}

export default function LotStatusReport() {
  const { lots, loading, error, reload } = useAllLots()
  const { blocks } = useBlocks()
  const { pricing } = usePricing()
  const { reservations } = useReservations()
  const dr = useDateRange('all')

  const [blockId, setBlockId] = useState('all')
  const [classification, setClassification] = useState('all')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState(false) // false = 4 groups, true = every status
  const [exporting, setExporting] = useState(false)
  const listRef = useRef(null)

  const blockName = useMemo(() => Object.fromEntries(blocks.map((b) => [b.id, b.name])), [blocks])
  const classes = useMemo(() => [...new Set(lots.map((l) => l.classification).filter(Boolean))], [lots])

  // Date a lot got its status (burial date / reservation date) — '' when unknown.
  const resDates = useMemo(() => reservationDateByLot(reservations), [reservations])
  const dateOf = useMemo(() => {
    const cache = new Map()
    return (l) => { if (!cache.has(l.id)) cache.set(l.id, lotStatusDate(l, resDates)); return cache.get(l.id) }
  }, [resDates])
  const { from, to } = dr.range
  const dateActive = dr.preset !== 'all'

  // Summary + KPIs follow Block, Classification and the date range; the lot list follows every filter.
  const scope = useMemo(() => filterLots(lots, { blockId, classification, from, to, dateOf }), [lots, blockId, classification, from, to, dateOf])
  const undated = useMemo(() => filterLots(lots, { blockId, classification }).filter((l) => !dateOf(l)).length, [lots, blockId, classification, dateOf])
  const { rows, totals } = useMemo(() => summarizeByBlock(scope, blocks), [scope, blocks])
  const byClass = useMemo(() => summarizeByClassification(scope), [scope])
  const notDigitized = useMemo(() => undigitizedBlocks(lots, blocks), [lots, blocks])
  const list = useMemo(() => sortLots(filterLots(lots, { blockId, classification, status, query, from, to, dateOf }), blocks), [lots, blocks, blockId, classification, status, query, from, to, dateOf])

  const resetKey = `${blockId}|${classification}|${status}|${query}|${from}|${to}`
  const pg = usePaging(list.length, resetKey)
  const filtersActive = blockId !== 'all' || classification !== 'all' || status !== 'all' || !!query || dateActive
  const clear = () => { setBlockId('all'); setClassification('all'); setStatus('all'); setQuery(''); dr.reset() }

  const price = (c) => pricing?.installment?.[c]?.totalPrice || 0
  const availableValue = byClass.reduce((s, r) => s + r.available * price(r.classification), 0)

  // Clicking a number in the summary jumps to those lots below.
  const drill = (bId, filter) => {
    setBlockId(bId); setStatus(filter)
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    ...GROUP_ORDER.map((g) => ({ value: `g:${g}`, label: `${GROUP_META[g].label} (all)` })),
    ...STATUS_ORDER.filter(inMultiGroup).map((s) => ({ value: `s:${s}`, label: `— ${statusLabel(s)}` })),
  ]
  const blockOptions = [{ value: 'all', label: 'All blocks' }, ...sortBlocks(blocks).map((b) => ({ value: b.id, label: b.name }))]
  const classOptions = [{ value: 'all', label: 'All classifications' }, ...classes.map((c) => ({ value: c, label: c }))]

  const printFilters = [
    blockId !== 'all' && `Block: ${blockName[blockId] || blockId}`,
    classification !== 'all' && `Classification: ${classification}`,
    status !== 'all' && `Status: ${status.startsWith('g:') ? GROUP_META[status.slice(2)].label : statusLabel(status.slice(2))}`,
    query && `Search: "${query}"`,
    dateActive && `Status date: ${rangeText(dr.range)}`,
  ]

  // ── Exports ────────────────────────────────────────────────────────────────
  const stamp = new Date().toISOString().slice(0, 10)
  const exportSummary = () => {
    const cols = [['Block', (r) => r.name], ['Total lots', (r) => r.total]]
    if (detail) STATUS_ORDER.forEach((s) => cols.push([statusLabel(s), (r) => r.byStatus[s] || 0]))
    else GROUP_ORDER.forEach((g) => cols.push([GROUP_META[g].label, (r) => r[g]]))
    cols.push(['Occupancy %', (r) => Math.round(r.occupancyRate * 1000) / 10])
    downloadCSV(`gravelocator-lot-status-by-block-${stamp}.csv`, [...rows, totals], cols)
  }
  const exportList = () => downloadCSV(`gravelocator-lot-list-${stamp}.csv`, list, [
    ['Block', (l) => blockName[l.blockId] || l.blockId],
    ['Lot No', (l) => l.lotNo ?? ''],
    ['Classification', (l) => l.classification || ''],
    ['Status', (l) => statusLabel(l.status)],
    ['Status date', (l) => dateOf(l)],
    ['Interments', (l) => l.intermentCount || 0],
    ['Deceased', (l) => lotDeceased(l).join('; ')],
  ])

  // Organized workbook: Summary + Lot List + one sheet per block + Available Lots + Interments.
  // Summary follows Block/Classification (like the on-screen summary); the lot sheets follow every filter.
  const exportListExcel = async () => {
    setExporting(true)
    try {
      const sumInterments = (arr) => arr.reduce((s, l) => s + (Number(l.intermentCount) || 0), 0)
      await downloadLotListExcel({
        filename: `gravelocator-lot-report-${stamp}.xlsx`,
        generatedOn: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        filtersText: printFilters.filter(Boolean).join(' · '),
        lots: list.map((l) => ({
          block: blockName[l.blockId] || l.blockId,
          lotNo: l.lotNo ?? '',
          classification: l.classification || '',
          status: statusLabel(l.status),
          statusDate: dateOf(l),
          interments: l.intermentCount || 0,
          deceased: lotDeceased(l).join('; '),
          group: groupOf(l.status),
        })),
        blockRows: [...rows, totals].map((r) => ({
          ...r,
          interments: sumInterments(r.blockId === 'all' ? scope : scope.filter((l) => l.blockId === r.blockId)),
        })),
        classRows: byClass.map((r) => ({
          ...r, name: r.classification, price: price(r.classification), availableValue: r.available * price(r.classification),
        })),
        statusRows: STATUS_ORDER.map((s) => ({ label: statusLabel(s), count: totals.byStatus[s] || 0 })).filter((s) => s.count > 0),
        notDigitized: notDigitized.map((b) => b.name),
      })
    } catch (e) {
      console.error('Excel export failed', e)
      window.alert('Could not create the Excel file. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const cell = (row, key, filter) => {
    const n = key === 'total' ? row.total : (row[key] ?? row.byStatus[key] ?? 0)
    if (!n) return <span className="rp-muted">0</span>
    return <button className="rp-cell-btn" onClick={() => drill(row.blockId, filter)} title="Show these lots">{n.toLocaleString()}</button>
  }

  const cols = detail ? STATUS_ORDER : GROUP_ORDER
  const colHead = (c) => (detail ? statusLabel(c) : GROUP_META[c].label)
  const colFilter = (c) => (detail && inMultiGroup(c) ? `s:${c}` : `g:${groupOf(c)}`)
  const colVal = (row, c) => (detail ? row.byStatus[c] || 0 : row[c])

  return (
    <div>
      <PrintHeader title={TITLE} filters={printFilters} />
      <ReportToolbar title={TITLE} description="How many lots are available, occupied or reserved in each block. Click any number to see those lots.">
        <button className="btn btn-ghost" onClick={() => window.print()}>Print / PDF</button>
        <button className="btn btn-ghost" onClick={exportSummary} disabled={!rows.length}>Export summary (CSV)</button>
        <button className="btn btn-primary" onClick={exportListExcel} disabled={!list.length || exporting}>{exporting ? 'Preparing…' : 'Export lot list (Excel)'}</button>
      </ReportToolbar>

      <div className="card no-print rp-filters">
        <Select label="Block" value={blockId} onChange={setBlockId} options={blockOptions} />
        <Select label="Classification" value={classification} onChange={setClassification} options={classOptions} />
        <Select label="Lot status (list)" value={status} onChange={setStatus} options={statusOptions} />
        <DateRangeFields dr={dr} label="Status date" />
        <SearchBox value={query} onChange={setQuery} placeholder="Search lot no. or name of deceased…" />
        <ClearFilters active={filtersActive} onClick={clear} />
        <button className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>
      </div>

      <ErrorNote error={error} what="lots" />
      {dateActive && (
        <p className="rp-muted no-print" style={{ margin: '8px 2px 0' }}>
          Status date = date of burial (occupied lots) or reservation date (reserved lots). Showing lots dated {rangeText(dr.range)}; available and other lots have no date, and {undated.toLocaleString()} lot{undated === 1 ? '' : 's'} in this view ha{undated === 1 ? 's' : 've'} no recorded date, so they are hidden.
        </p>
      )}

      <Stats items={[
        { label: 'Total lots', value: loading ? '…' : totals.total.toLocaleString(), sub: `${rows.length} block${rows.length === 1 ? '' : 's'}` },
        { label: 'Available', value: loading ? '…' : totals.available.toLocaleString(), sub: percent(totals.total ? totals.available / totals.total : 0), color: GROUP_META.available.color },
        { label: 'Occupied', value: loading ? '…' : totals.occupied.toLocaleString(), sub: `${totals.sold.toLocaleString()} sold · ${totals.withInterment.toLocaleString()} with interment`, color: GROUP_META.occupied.color },
        { label: 'Reserved', value: loading ? '…' : totals.reserved.toLocaleString(), sub: percent(totals.total ? totals.reserved / totals.total : 0), color: GROUP_META.reserved.color },
      ]} />

      {/* Stacked bars — one per block */}
      <div className="card" style={{ marginTop: 18 }}>
        <p className="chart-title">Lot Status by Block</p>
        <div className="rp-legend">
          {GROUP_ORDER.map((g) => <span key={g}><i className="rp-dot" style={{ background: GROUP_META[g].color }} />{GROUP_META[g].label}</span>)}
        </div>
        <div style={{ marginTop: 14 }}>
          {rows.map((r) => (
            <div key={r.blockId} className="rp-sb-row">
              <span className="rp-sb-name">{r.name}</span>
              <div className="rp-sb-track" role="img" aria-label={`${r.name}: ${r.available} available, ${r.occupied} occupied, ${r.reserved} reserved, ${r.other} other`}>
                {GROUP_ORDER.map((g) => r[g] > 0 && (
                  <span key={g} className="rp-sb-seg" title={`${GROUP_META[g].label}: ${r[g]}`} style={{ width: `${(r[g] / r.total) * 100}%`, background: GROUP_META[g].color }} />
                ))}
              </div>
              <span className="rp-sb-total">{r.total.toLocaleString()}</span>
            </div>
          ))}
          {!loading && rows.length === 0 && <p className="rp-muted">No lots match these filters.</p>}
        </div>
      </div>

      {/* Summary table */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="flex justify-between items-center mb-16">
          <p className="chart-title" style={{ marginBottom: 0 }}>Block Summary</p>
          <label className="rp-switch no-print">
            <input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} /> Show every status
          </label>
        </div>
        <div className="table-wrap">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Block</th><th className="rp-num">Total</th>
                {cols.map((c) => <th key={c} className="rp-num">{colHead(c)}</th>)}
                <th className="rp-num">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow cols={cols.length + 3} loading={loading}>No lots match these filters.</EmptyRow>}
              {rows.map((r) => (
                <tr key={r.blockId}>
                  <td><b>{r.name}</b></td>
                  <td className="rp-num">{cell(r, 'total', 'all')}</td>
                  {cols.map((c) => <td key={c} className="rp-num">{colVal(r, c) ? cell(r, c, colFilter(c)) : <span className="rp-muted">0</span>}</td>)}
                  <td className="rp-num">{percent(r.occupancyRate)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr>
                  <td>All blocks</td>
                  <td className="rp-num">{totals.total.toLocaleString()}</td>
                  {cols.map((c) => <td key={c} className="rp-num">{colVal(totals, c).toLocaleString()}</td>)}
                  <td className="rp-num">{percent(totals.occupancyRate)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="rp-muted" style={{ marginTop: 10 }}>
          Occupied = sold + with interment. Reserved = reserve lots. Other = not for sale, delinquent, trees, lamp posts and block-off cells.
          Occupancy = occupied ÷ total, the same as the Dashboard.
          {notDigitized.length > 0 && <> Not yet digitized (no lots to count): {notDigitized.map((b) => b.name).join(', ')}.</>}
        </p>
      </div>

      {/* By classification */}
      <div className="card" style={{ marginTop: 18 }}>
        <p className="chart-title">By Classification</p>
        <div className="table-wrap">
          <table className="rp-table">
            <thead>
              <tr><th>Classification</th><th className="rp-num">Total</th><th className="rp-num">Available</th><th className="rp-num">Occupied</th><th className="rp-num">Reserved</th><th className="rp-num">Other</th><th className="rp-num">List price</th><th className="rp-num">Available value</th></tr>
            </thead>
            <tbody>
              {byClass.length === 0 && <EmptyRow cols={8} loading={loading}>No lots match these filters.</EmptyRow>}
              {byClass.map((r) => (
                <tr key={r.classification}>
                  <td><b>{r.classification}</b></td>
                  <td className="rp-num">{r.total.toLocaleString()}</td>
                  <td className="rp-num">{r.available.toLocaleString()}</td>
                  <td className="rp-num">{r.occupied.toLocaleString()}</td>
                  <td className="rp-num">{r.reserved.toLocaleString()}</td>
                  <td className="rp-num">{r.other.toLocaleString()}</td>
                  <td className="rp-num">{price(r.classification) ? peso(price(r.classification)) : '—'}</td>
                  <td className="rp-num">{price(r.classification) ? peso(r.available * price(r.classification)) : '—'}</td>
                </tr>
              ))}
            </tbody>
            {byClass.length > 1 && (
              <tfoot><tr><td colSpan={7} style={{ textAlign: 'right' }}>Value of available lots</td><td className="rp-num">{peso(availableValue)}</td></tr></tfoot>
            )}
          </table>
        </div>
        <p className="rp-muted" style={{ marginTop: 10 }}>Available value = available lots × the price-list total for that classification (cash price, before discounts).</p>
      </div>

      {/* Lot list */}
      <div ref={listRef} className="card" style={{ marginTop: 18, scrollMarginTop: 80 }}>
        <div className="flex justify-between items-center mb-16">
          <p className="chart-title" style={{ marginBottom: 0 }}>Lot List</p>
          <span className="rp-total"><b>{list.length.toLocaleString()}</b> lot{list.length === 1 ? '' : 's'}</span>
        </div>
        <div className="table-wrap">
          <table className="rp-table">
            <thead><tr><th>Block</th><th>Lot</th><th>Classification</th><th>Status</th><th>Status date</th><th className="rp-num">Interments</th><th>Name of deceased</th></tr></thead>
            <tbody>
              {list.length === 0 && <EmptyRow cols={7} loading={loading}>No lots match these filters.</EmptyRow>}
              {pg.slice(list).map((l) => (
                <tr key={l.id}>
                  <td>{blockName[l.blockId] || l.blockId}</td>
                  <td>{l.lotNo ?? <span className="rp-muted">no number</span>}</td>
                  <td>{l.classification || '—'}</td>
                  <td><StatusPill status={l.status} /></td>
                  <td>{dateOf(l) ? formatDate(dateOf(l)) : <span className="rp-muted">—</span>}</td>
                  <td className="rp-num">{l.intermentCount || 0}</td>
                  <td>{lotDeceased(l).join(', ') || <span className="rp-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pg={pg} total={list.length} />
      </div>
    </div>
  )
}