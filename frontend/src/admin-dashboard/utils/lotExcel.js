// ─────────────────────────────────────────────────────────────────────────────
// LOT LIST → ORGANIZED EXCEL WORKBOOK
// Used by Reports & Analytics → Lot Status → "Export lot list (Excel)".
// A CSV can only hold one table, so this builds a multi-sheet .xlsx instead:
//   Summary · Lot List · one sheet per block · Available Lots · Interments
// Pure data in, file out: the page hands in numbers it already computed, so the
// workbook always matches what the report shows on screen.
// xlsx is loaded on demand so it doesn't slow down the admin page.
// ─────────────────────────────────────────────────────────────────────────────

const LOT_HEADERS = ['Block', 'Lot No', 'Classification', 'Status', 'Status date', 'Interments', 'Name of deceased']
const LOT_WIDTHS = [14, 9, 18, 18, 14, 12, 55]
const PESO = '"₱"#,##0'

const lotRow = (l) => [l.block, l.lotNo === '' ? '' : l.lotNo, l.classification, l.status, l.statusDate || '', l.interments, l.deceased]

// Excel sheet names: max 31 chars, none of  \ / ? * [ ] :  and unique.
function sheetName(raw, used) {
  const base = String(raw || 'Sheet').replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Sheet'
  let name = base; let n = 2
  while (used.has(name.toLowerCase())) { name = `${base.slice(0, 28)} ${n++}` }
  used.add(name.toLowerCase())
  return name
}

export async function downloadLotListExcel({
  filename,        // 'gravelocator-lot-report-2026-10-30.xlsx'
  generatedOn,     // 'October 30, 2026'
  filtersText,     // '' when no filters are active
  lots,            // [{ block, lotNo, classification, status, statusDate, interments, deceased, group }] — the filtered list, already sorted
  blockRows,       // [{ name, total, available, occupied, reserved, other, occupancyRate, interments }] (last row = All blocks)
  classRows,       // [{ name, total, available, occupied, reserved, other, occupancyRate, price, availableValue }]
  statusRows,      // [{ label, count }]
  notDigitized,    // ['Block 1', 'Block 2', …]
}) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const used = new Set()
  const { encode_cell: at, encode_range: rng } = XLSX.utils

  // ── Summary ────────────────────────────────────────────────────────────────
  const all = blockRows[blockRows.length - 1] || { total: 0, available: 0, occupied: 0, reserved: 0, other: 0, occupancyRate: 0, interments: 0 }
  const aoa = []
  const fmts = [] // [row, col, z]
  const mark = (z, r, cols) => cols.forEach((c) => fmts.push([r, c, z]))

  aoa.push(['Calbayog Memorial Park — Lot Status Report'])
  aoa.push(['Generated', generatedOn])
  aoa.push(['Filters applied', filtersText || 'None (all records)'])
  aoa.push([])

  aoa.push(['OVERVIEW'])
  aoa.push(['Total lots', 'Available', 'Occupied', 'Reserved', 'Other', 'Occupancy', 'Total interments'])
  mark('#,##0', aoa.length, [0, 1, 2, 3, 4, 6]); mark('0.0%', aoa.length, [5])
  aoa.push([all.total, all.available, all.occupied, all.reserved, all.other, all.occupancyRate, all.interments])
  aoa.push([])

  aoa.push(['LOT STATUS BY BLOCK'])
  aoa.push(['Block', 'Total', 'Available', 'Occupied', 'Reserved', 'Other', 'Occupancy', 'Interments'])
  blockRows.forEach((r) => {
    mark('#,##0', aoa.length, [1, 2, 3, 4, 5, 7]); mark('0.0%', aoa.length, [6])
    aoa.push([r.name, r.total, r.available, r.occupied, r.reserved, r.other, r.occupancyRate, r.interments])
  })
  aoa.push([])

  aoa.push(['LOT STATUS BY CLASSIFICATION'])
  aoa.push(['Classification', 'Total', 'Available', 'Occupied', 'Reserved', 'Other', 'Occupancy', 'List price', 'Available value'])
  let availValue = 0
  classRows.forEach((r) => {
    availValue += r.availableValue || 0
    mark('#,##0', aoa.length, [1, 2, 3, 4, 5]); mark('0.0%', aoa.length, [6]); mark(PESO, aoa.length, [7, 8])
    aoa.push([r.name, r.total, r.available, r.occupied, r.reserved, r.other, r.occupancyRate, r.price || '', r.availableValue || ''])
  })
  mark(PESO, aoa.length, [8])
  aoa.push(['Value of available lots', '', '', '', '', '', '', '', availValue])
  aoa.push([])

  aoa.push(['STATUS BREAKDOWN'])
  aoa.push(['Status', 'Lots', '% of total'])
  statusRows.forEach((s) => {
    mark('#,##0', aoa.length, [1]); mark('0.0%', aoa.length, [2])
    aoa.push([s.label, s.count, all.total ? s.count / all.total : 0])
  })
  aoa.push([])

  aoa.push(['NOTES'])
  aoa.push(['Occupied = sold + with interment. Reserved = reserve lots. Other = not for sale, delinquent, trees, lamp posts and block-off cells.'])
  aoa.push(['Occupancy = occupied ÷ total, the same as the Dashboard.'])
  aoa.push(['Available value = available lots × the price-list total for that classification (cash price, before discounts).'])
  if (notDigitized.length) aoa.push([`Not yet digitized (no lots to count): ${notDigitized.join(', ')}.`])
  aoa.push(['Sheets in this file: Summary · Lot List · one sheet per block · Available Lots · Interments.'])

  const sum = XLSX.utils.aoa_to_sheet(aoa)
  fmts.forEach(([r, c, z]) => { const cell = sum[at({ r, c })]; if (cell && typeof cell.v === 'number') cell.z = z })
  sum['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, sum, sheetName('Summary', used))

  // ── Lot sheets ─────────────────────────────────────────────────────────────
  const addLots = (name, rows) => {
    const ws = XLSX.utils.aoa_to_sheet([LOT_HEADERS, ...rows.map(lotRow)])
    ws['!cols'] = LOT_WIDTHS.map((wch) => ({ wch }))
    ws['!autofilter'] = { ref: rng({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: LOT_HEADERS.length - 1 } }) }
    XLSX.utils.book_append_sheet(wb, ws, sheetName(name, used))
  }

  addLots('Lot List', lots)

  const byBlock = new Map() // list is already sorted, so insertion order = block order
  lots.forEach((l) => { if (!byBlock.has(l.block)) byBlock.set(l.block, []); byBlock.get(l.block).push(l) })
  byBlock.forEach((rows, block) => addLots(block, rows))

  addLots('Available Lots', lots.filter((l) => l.group === 'available'))
  addLots('Interments', lots.filter((l) => l.interments > 0))

  XLSX.writeFile(wb, filename)
}