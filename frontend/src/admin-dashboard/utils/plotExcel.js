// ─────────────────────────────────────────────────────────────────────────────
// PLOT EXCEL — read an office Excel/CSV of lots, and write one back out.
//
// Header names are flexible (any order, any sheet). Two layouts both work:
//
//  A) GraveLocator layout
//     Block | Lot No | Classification | Status | Interments | Name of Deceased 1 | Name of Deceased 2 …
//
//  B) The office's SALES CONTROL sheet (one sheet per block, e.g. "Block 7")
//     Lot No. | Class | Buyer's Name | C.O. No. | Remarks | Date of Sale | W/ Interment |
//     Name of Deceased 1 | Name of Deceased 2
//     → no Status column: status comes from Buyer's Name + W/ Interment:
//         TREE / LAMP POST in Buyer's Name (or Class) → Trees / Lamp Post
//         X / XX in W/ Interment                       → With Interment (1 / 2)
//         a buyer's name                               → Sold
//         no buyer                                     → Available
//     Buyer's name, C.O. No., remarks and dates are NOT saved — the lots table
//     is public, so only what a visitor should see (status + names of the
//     deceased) goes in.
//
//  • Block        "Block 8", "8", "block-8", "2A" or the lawn name. Optional:
//                 if missing, the sheet name (e.g. "Block 7") or the block
//                 picked in the import dialog is used.
//  • Lot No       204 or "Lot 204". Blank = a coloured cell with no number.
//  • Classification / Class   Regular, Special Regular (Spl. Reg., S. Reg., …),
//                 Deluxe (De Luxe), Premium, Garden, Columbary 1&2 / 3&4.
//                 Blank = keep the current one.
//  • Status       Available/Vacant, Sold, With Interment, Reserve Lot,
//                 Not For Sale, Delinquent, Trees, Lamp Post, Block-Off.
//  • Interments   0, 1, 2 … or tally marks: X / XX, | / ||.
//  • Name of Deceased 1, 2, …  one name (or "A & B") per cell. If the file has
//                 these columns, a blank row clears the lot's names; if the
//                 file has no name columns, saved names are kept.
//  • Date of Death 1, 2, … / Date of Burial 1, 2, …  (optional) — matched to
//                 Name of Deceased with the same number. Excel dates,
//                 2019-03-04, 03/04/2019 (month/day/year) or "March 4, 2019".
//                 If the file has no date columns, saved dates are kept.
//
// A lot listed more than once (e.g. the sheet was pasted twice) uses the LAST
// row; the preview lists the lots whose repeated rows disagree.
//
// SheetJS is loaded only when an import/export runs.
// ─────────────────────────────────────────────────────────────────────────────
import { STATUS, STATUS_ORDER, statusLabel } from '../config/status'
import { CLASSIFICATION_ORDER } from '../config/constants'

const loadXlsx = () => import('xlsx')

const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

// ── Header aliases ───────────────────────────────────────────────────────────
const HEADERS = {
  block: ['block', 'blockno', 'blocknumber', 'blockname', 'blk', 'lawn', 'lawnname'],
  lotNo: ['lot', 'lotno', 'lotnumber', 'lotnum', 'no', 'number', 'lotid'],
  classification: ['classification', 'class', 'type', 'lottype', 'category'],
  status: ['status', 'lotstatus', 'state'],
  interments: ['interments', 'interment', 'intermentcount', 'noofinterments', 'noofinterment', 'winterment', 'withinterment', 'burials', 'graves'],
  buyer: ['buyersname', 'buyername', 'buyer', 'owner', 'ownername', 'ownersname', 'lotowner', 'purchaser'],
}
const isDeceasedHeader = (h) => /^(nameofdeceased|nameofthedeceased|deceased|decedent|nameofinterred|interredname|interred)/.test(h)
const DEATH_HEADER = /^(dateofdeath|deathdate|datedied|dateofdemise|dod)(\d*)$/
const BURIAL_HEADER = /^(dateofburial|burialdate|dateofinterment|intermentdate|dateinterred|dateburied)(\d*)$/

// ── Deceased records: [{ name, deathDate, burialDate }] ─────────────────────
// Older lots only have deceasedNames, so fall back to those (no dates).
export function deceasedRecordsOf(lot) {
  const recs = Array.isArray(lot?.deceasedRecords) ? lot.deceasedRecords.filter((r) => r && r.name) : []
  if (recs.length) return recs.map((r) => ({ name: r.name, deathDate: r.deathDate || null, burialDate: r.burialDate || null }))
  return (lot?.deceasedNames || []).map((name) => ({ name, deathDate: null, burialDate: null }))
}
const recordsSig = (list) => JSON.stringify((list || []).map((r) => [r.name, r.deathDate || null, r.burialDate || null]))

const pad2 = (n) => String(n).padStart(2, '0')
const isoDate = (y, m, d) => {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${pad2(m)}-${pad2(d)}` : null
}
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}` }

// Excel date / "2019-03-04" / "03/04/2019" (month/day) / "March 4, 2019" → 'YYYY-MM-DD'
export function parseDateCell(v, label, XLSX) {
  if (v === '' || v == null) return { value: null }
  let iso = null
  if (typeof v === 'number') {
    // Excel stores dates as day numbers (1 = 1900-01-01).
    const p = XLSX?.SSF?.parse_date_code?.(v)
    if (p) iso = isoDate(p.y, p.m, p.d)
    else if (v > 0 && v < 2958466) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000)
      iso = isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    }
  } else if (v instanceof Date) {
    iso = isoDate(v.getFullYear(), v.getMonth() + 1, v.getDate())
  } else {
    const s = String(v).trim()
    let m
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) iso = isoDate(+m[1], +m[2], +m[3])
    else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) iso = isoDate(+m[3], +m[1], +m[2])
    else if (/[a-z]/i.test(s) && !Number.isNaN(Date.parse(s))) {
      const d = new Date(s)
      iso = isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
    }
  }
  if (!iso) return { error: `${label} "${v}" is not a date — use 2019-03-04 or 03/04/2019` }
  if (iso < '1900-01-01') return { error: `${label} ${iso} is before 1900` }
  if (iso > todayIso()) return { error: `${label} ${iso} is in the future` }
  return { value: iso }
}

// ── Status aliases → STATUS values ───────────────────────────────────────────
const STATUS_ALIASES = {
  [STATUS.AVAILABLE]: ['available', 'vacant', 'open', 'empty', 'unsold', 'free', 'a', 'v'],
  [STATUS.SOLD]: ['sold', 's', 'occupied', 'owned'],
  [STATUS.WITH_INTERMENT]: ['withinterment', 'interment', 'interred', 'buried', 'wi', 'soldwithinterment'],
  [STATUS.RESERVE_LOT]: ['reservelot', 'reserve', 'reserved', 'r'],
  [STATUS.NOT_FOR_SALE]: ['notforsale', 'nfs'],
  [STATUS.DELINQUENT]: ['delinquent', 'd'],
  [STATUS.TREES]: ['trees', 'tree', 't'],
  [STATUS.LAMP_POST]: ['lamppost', 'lamp', 'lp'],
  [STATUS.BLOCK_OFF]: ['blockoff', 'blocked', 'x'],
}
const STATUS_LOOKUP = {}
Object.entries(STATUS_ALIASES).forEach(([value, list]) => list.forEach((a) => { STATUS_LOOKUP[a] = value }))
STATUS_ORDER.forEach((s) => { STATUS_LOOKUP[norm(statusLabel(s))] = s; STATUS_LOOKUP[norm(s)] = s })

// Words that can appear in Buyer's Name / Class instead of a person's name.
const MARKER_STATUSES = new Set([STATUS.TREES, STATUS.LAMP_POST, STATUS.NOT_FOR_SALE, STATUS.BLOCK_OFF, STATUS.RESERVE_LOT, STATUS.DELINQUENT])
function markerStatus(v) {
  const key = norm(v)
  if (!key || key.length < 3 || /,/.test(String(v))) return null // single letters / "Last, First" are names
  const s = STATUS_LOOKUP[key]
  return s && MARKER_STATUSES.has(s) ? s : null
}

export function parseStatus(v) {
  const key = norm(v)
  if (!key) return { value: null }
  return STATUS_LOOKUP[key] ? { value: STATUS_LOOKUP[key] } : { error: `Unknown status "${v}"` }
}

const CLASS_LOOKUP = {}
CLASSIFICATION_ORDER.forEach((c) => { CLASS_LOOKUP[norm(c)] = c })
const SPECIAL_REGULAR = CLASS_LOOKUP[norm('Special Regular')]
;['specialreg', 'splreg', 'splregular', 'specreg', 'specregular', 'sreg', 'sregular', 'spreg', 'spregular', 'specialregular']
  .forEach((k) => { CLASS_LOOKUP[k] = SPECIAL_REGULAR })
CLASS_LOOKUP.reg = CLASS_LOOKUP[norm('Regular')]
CLASS_LOOKUP.dlx = CLASS_LOOKUP[norm('Deluxe')]
CLASS_LOOKUP.columbary12 = CLASS_LOOKUP[norm('Columbary 1&2')]
CLASS_LOOKUP.columbary34 = CLASS_LOOKUP[norm('Columbary 3&4')]

export function parseClassification(v) {
  const key = norm(v)
  if (!key) return { value: null }
  if (CLASS_LOOKUP[key]) return { value: CLASS_LOOKUP[key] }
  const marker = markerStatus(v)            // e.g. Class = "TREE"
  if (marker) return { value: null, marker }
  return { error: `Unknown classification "${v}"` }
}

export function parseLotNo(v) {
  if (v === '' || v == null) return { value: null }
  if (typeof v === 'number') {
    return Number.isInteger(v) && v > 0 ? { value: v } : { error: `Lot No "${v}" must be a whole number` }
  }
  const s = String(v).trim()
  const m = s.match(/^(?:lot\s*(?:no\.?)?\s*#?\s*)?(\d+)$/i)
  if (m && Number(m[1]) > 0) return { value: Number(m[1]) }
  if (/^\d+\s*-?\s*[a-z]$/i.test(s)) return { error: `Lot No "${s}" has a letter — lettered lots (like 640-A) aren't supported yet, so this row was skipped` }
  return { error: `Lot No "${v}" is not a number` }
}

export function parseInterments(v) {
  if (v === '' || v == null) return { value: null }
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? { value: v } : { error: `Interments "${v}" must be 0 or more` }
  const s = String(v).replace(/\s+/g, '')
  if (!s) return { value: null }
  if (/^\d+$/.test(s)) return { value: Number(s) }
  if (/^[xX|Il]+$/.test(s)) return { value: s.length } // tally marks: X, XX, |, ||
  return { error: `Interments "${v}" is not a number or X / XX` }
}

// "Block 8" / "8" / "block-8" / "B8" / "Infinite Lawn" → block object
export function matchBlock(value, blocks) {
  const key = norm(value)
  if (!key) return null
  const short = key.replace(/^block/, '').replace(/^blk/, '').replace(/^b(?=\d)/, '')
  return blocks.find((b) => {
    const id = norm(b.id).replace(/^block/, '')
    const name = norm(b.name).replace(/^block/, '')
    return id === short || name === short || norm(b.name) === key || (b.lawnName && norm(b.lawnName) === key)
  }) || null
}

function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = rows[i].map(norm)
    const col = {}
    Object.entries(HEADERS).forEach(([field, aliases]) => {
      const idx = cells.findIndex((c) => aliases.includes(c))
      if (idx !== -1) col[field] = idx
    })
    const deceased = cells.map((c, idx) => (isDeceasedHeader(c) ? idx : -1)).filter((idx) => idx !== -1)
    // Date columns are matched to a name column by number ("Date of Death 2" → name 2).
    const dateCols = (re) => {
      const out = {}
      cells.forEach((c, idx) => {
        const m = c.match(re)
        if (m) out[m[2] ? Number(m[2]) : 1] = idx
      })
      return out
    }
    const deathCols = dateCols(DEATH_HEADER)
    const burialCols = dateCols(BURIAL_HEADER)
    const hasData = col.status != null || col.interments != null || col.classification != null || col.buyer != null || deceased.length
    if (col.lotNo != null && hasData) return { index: i, col, deceased, deathCols, burialCols }
  }
  return null
}

// Reads every sheet and returns { rows, errors, sheets }.
//   rows:   [{ blockId, lotNo, classification, status, intermentCount, deceasedNames, deceasedRecords, where }]
//           deceasedNames = null when the sheet has no name columns (keep saved names)
//           deceasedRecords = null when the sheet has no date columns (keep saved dates)
//   errors: [{ where, message }]   where = "Block 7 row 12"
export async function readPlotFile(file, blocks, fallbackBlockId) {
  const XLSX = await loadXlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const rows = []
  const errors = []
  const sheets = []

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName]
    if (!ws || !ws['!ref']) return
    const firstRow = XLSX.utils.decode_range(ws['!ref']).s.r
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: true })
    const header = findHeader(grid)
    if (!header) return // not a lot sheet (e.g. an instructions sheet)
    sheets.push(sheetName.trim())

    const sheetBlock = matchBlock(sheetName, blocks)
    const { col, deceased, deathCols, burialCols } = header
    const hasDateCols = Object.keys(deathCols).length > 0 || Object.keys(burialCols).length > 0
    const cell = (r, field) => (col[field] == null ? '' : r[col[field]])

    for (let i = header.index + 1; i < grid.length; i++) {
      const r = grid[i]
      if (!r || r.every((c) => String(c).trim() === '')) continue
      const where = `${sheetName.trim()} row ${firstRow + i + 1}`
      const fail = (message) => errors.push({ where, message })

      const blockCell = cell(r, 'block')
      let block = null
      if (String(blockCell).trim()) {
        block = matchBlock(blockCell, blocks)
        if (!block) { fail(`Unknown block "${blockCell}"`); continue }
      } else {
        block = sheetBlock || blocks.find((b) => b.id === fallbackBlockId) || null
        if (!block) { fail('No block — add a Block column, name the sheet after the block, or pick a block in the import dialog'); continue }
      }

      const lot = parseLotNo(cell(r, 'lotNo'))
      const st = parseStatus(cell(r, 'status'))
      const cls = parseClassification(cell(r, 'classification'))
      const inter = parseInterments(cell(r, 'interments'))
      const bad = [lot, st, cls, inter].find((x) => x.error)
      if (bad) { fail(bad.error); continue }

      const buyer = clean(cell(r, 'buyer'))
      const names = deceased.length ? deceased.map((idx) => clean(r[idx])).filter(Boolean) : null

      // Dates of death / burial, paired with Name of Deceased 1, 2, … by number.
      let records = null
      if (hasDateCols && deceased.length) {
        records = []
        let dateErr = null
        deceased.forEach((idx, k) => {
          if (dateErr) return
          const n = k + 1
          const name = clean(r[idx])
          const death = deathCols[n] != null ? parseDateCell(r[deathCols[n]], `Date of Death ${n}`, XLSX) : { value: null }
          const burial = burialCols[n] != null ? parseDateCell(r[burialCols[n]], `Date of Burial ${n}`, XLSX) : { value: null }
          dateErr = death.error || burial.error || null
          if (dateErr) return
          if (!name && (death.value || burial.value)) { dateErr = `Date given for deceased ${n} but no name`; return }
          if (death.value && burial.value && burial.value < death.value) { dateErr = `Date of Burial ${n} is before the date of death`; return }
          if (name) records.push({ name, deathDate: death.value, burialDate: burial.value })
        })
        if (dateErr) { fail(dateErr); continue }
      }
      const marker = markerStatus(buyer) || cls.marker || null

      // Status: explicit Status column → TREE/LAMP POST marker → interments → buyer.
      let status = st.value || marker
      let intermentCount = inter.value
      if (status === STATUS.AVAILABLE && (intermentCount > 0 || names?.length)) {
        fail(`Lot ${lot.value ?? '(no number)'} is Available but has interment(s) or names — change the status to Sold / With Interment, or clear them`)
        continue
      }
      if (!intermentCount && names?.length && (!status || status === STATUS.SOLD || status === STATUS.WITH_INTERMENT)) {
        intermentCount = names.length
      }
      if (!status) {
        if (intermentCount > 0) status = STATUS.WITH_INTERMENT
        else if (buyer) status = STATUS.SOLD
        else if (col.buyer != null) status = STATUS.AVAILABLE
      }
      if (intermentCount > 0 && status === STATUS.SOLD) status = STATUS.WITH_INTERMENT
      if (status === STATUS.WITH_INTERMENT && !intermentCount) intermentCount = 1
      if (lot.value == null && !status) continue // nothing usable on this row

      rows.push({
        blockId: block.id, lotNo: lot.value, classification: cls.value, status, intermentCount,
        deceasedNames: names, deceasedRecords: records, where,
      })
    }
  })

  return { rows, errors, sheets }
}

const sameNames = (a, b) => (a || []).join('\n') === (b || []).join('\n')
const rowSig = (r) => JSON.stringify([r.classification, r.status, r.intermentCount, r.deceasedNames, r.deceasedRecords])

// Groups parsed rows by block and compares them with the lots already saved.
//   existingByBlock: { [blockId]: lots[] }
//   reservedIds:     Set of lot ids that have a pending/confirmed reservation
// Returns { plans, errors, repeats: { conflicts: [{ lotNo, block, wheres, used }], identical } }
export function buildImportPlan(rows, blocks, existingByBlock, reservedIds = new Set()) {
  const byBlock = new Map()
  const conflicts = []
  let identical = 0

  rows.forEach((row) => {
    if (!byBlock.has(row.blockId)) byBlock.set(row.blockId, { byNo: new Map(), extras: [] })
    const g = byBlock.get(row.blockId)
    if (row.lotNo == null) { g.extras.push(row); return }
    const prev = g.byNo.get(row.lotNo)
    if (!prev) { g.byNo.set(row.lotNo, { row, wheres: [row.where], differs: false }); return }
    // Listed again → the later row wins.
    if (rowSig(prev.row) !== rowSig(row)) prev.differs = true
    else identical += 1
    prev.wheres.push(row.where)
    prev.row = row
  })

  const plans = [...byBlock.entries()].map(([blockId, g]) => {
    const block = blocks.find((b) => b.id === blockId)
    byBlock.get(blockId).byNo.forEach((entry, lotNo) => {
      if (entry.differs) conflicts.push({ block: block?.name || blockId, lotNo, wheres: entry.wheres, used: entry.wheres[entry.wheres.length - 1] })
    })
    const fileRows = [
      ...[...g.byNo.values()].map((e) => ({ ...e.row, id: `${blockId}-${e.row.lotNo}` })).sort((a, b) => a.lotNo - b.lotNo),
      ...g.extras.map((r, i) => ({ ...r, id: `${blockId}-x${i}`, extraIndex: i })),
    ]

    const existing = existingByBlock[blockId] || []
    const byId = new Map(existing.map((l) => [l.id, l]))
    const fileIds = new Set(fileRows.map((r) => r.id))
    let added = 0, changed = 0, same = 0, withNames = 0
    const warnings = []

    const final = fileRows.map((r) => {
      const cur = byId.get(r.id)
      const next = {
        id: r.id,
        lotNo: r.lotNo,
        classification: r.classification || cur?.classification || block?.classifications?.[0] || 'Regular',
        status: r.status || cur?.status || STATUS.AVAILABLE,
        intermentCount: r.intermentCount ?? cur?.intermentCount ?? 0,
        deceasedNames: r.deceasedNames,            // null = keep saved names
        deceasedRecords: r.deceasedRecords,        // null = keep saved dates
        recordsChanged: false,
        extraIndex: r.extraIndex,
      }
      const namesAfter = next.deceasedNames ?? cur?.deceasedNames ?? []
      if (next.deceasedRecords) {
        next.recordsChanged = recordsSig(next.deceasedRecords) !== recordsSig(cur ? deceasedRecordsOf(cur) : [])
      }
      if (namesAfter.length) withNames += 1
      if (!cur) added += 1
      else if (
        cur.classification !== next.classification || cur.status !== next.status ||
        (cur.intermentCount || 0) !== next.intermentCount || !sameNames(cur.deceasedNames, namesAfter) ||
        next.recordsChanged
      ) {
        changed += 1
        if (reservedIds.has(r.id) && cur.status !== next.status) {
          warnings.push(`Lot ${r.lotNo ?? '(no number)'} has an active reservation — status will change from ${statusLabel(cur.status)} to ${statusLabel(next.status)}`)
        }
      } else same += 1
      return next
    })

    const missing = existing.filter((l) => !fileIds.has(l.id))
    const removable = missing.filter((l) => !reservedIds.has(l.id)).length

    return {
      blockId,
      block,
      rows: final,
      added, changed, same, withNames,
      missing: missing.length,
      removable,
      protectedCount: missing.length - removable,
      maxLot: final.reduce((m, r) => (r.lotNo > m ? r.lotNo : m), 0),
      warnings,
    }
  }).sort((a, b) => blocks.indexOf(a.block) - blocks.indexOf(b.block))

  conflicts.sort((a, b) => a.block.localeCompare(b.block) || a.lotNo - b.lotNo)
  return { plans, errors: [], repeats: { conflicts, identical } }
}

// ── Export (current block → .xlsx) / blank template ─────────────────────────
function addHelpSheet(XLSX, wb) {
  const help = [
    ['Column', 'Accepted values'],
    ['Block', 'Block 1 … Block 9, Block 2A, or the lawn name. Optional if the sheet is named after the block (e.g. "Block 7").'],
    ['Lot No', 'A whole number (e.g. 204). Leave blank for a coloured cell with no lot number.'],
    ['Classification', CLASSIFICATION_ORDER.join(', ') + '. "De Luxe", "Spl. Reg.", "S. Regular" also work. Blank = keep current.'],
    ['Status', STATUS_ORDER.map(statusLabel).join(', ') + '. "Vacant" = Available. Blank = worked out from the other columns.'],
    ['Interments', 'Number of burials: 0, 1, 2 … or X / XX. Any interment on a Sold lot makes it "With Interment".'],
    ['Name of Deceased 1, 2 …', 'One name per cell, e.g. "Rosales, Romeo". Add more columns if a lot has more names. Shown on Lot Details and searchable in the app.'],
    ['Date of Death 1, 2 …', 'Optional. Date of death of Name of Deceased with the same number: 2019-03-04, 03/04/2019 (month/day/year) or an Excel date. Leave the whole column out to keep the dates already saved.'],
    ['Date of Burial 1, 2 …', 'Optional. Date of burial / interment, same format. Can\'t be before the date of death.'],
    ["Buyer's Name (optional)", 'Only used to work out the status when there is no Status column: a name = Sold, blank = Available, TREE / LAMP POST = Trees / Lamp Post. It is not saved.'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(help)
  ws['!cols'] = [{ wch: 24 }, { wch: 110 }]
  XLSX.utils.book_append_sheet(wb, ws, 'How to fill')
}

export async function downloadPlotWorkbook(block, lots) {
  const XLSX = await loadXlsx()
  const wb = XLSX.utils.book_new()
  const name = block ? block.name : 'Block 8'
  const cls = block?.classifications?.[0] || 'Regular'
  const nameCols = Math.max(2, ...(lots || []).map((l) => deceasedRecordsOf(l).length))
  // Name, Date of Death, Date of Burial for each person.
  const columns = ['Block', 'Lot No', 'Classification', 'Status', 'Interments',
    ...Array.from({ length: nameCols }, (_, i) => [`Name of Deceased ${i + 1}`, `Date of Death ${i + 1}`, `Date of Burial ${i + 1}`]).flat()]
  const people = (records) => Array.from({ length: nameCols }, (_, i) => {
    const r = records[i]
    return r ? [r.name, r.deathDate || '', r.burialDate || ''] : ['', '', '']
  }).flat()
  const data = lots && lots.length
    ? lots.map((l) => [name, l.lotNo ?? '', l.classification, statusLabel(l.status), l.intermentCount || 0, ...people(deceasedRecordsOf(l))])
    : [
        [name, 1, cls, 'Sold', 0, ...people([])],
        [name, 2, cls, 'Available', 0, ...people([])],
        [name, 3, cls, 'With Interment', 2, ...people([
          { name: 'Dela Cruz, Juan', deathDate: '2019-03-04', burialDate: '2019-03-08' },
          { name: 'Dela Cruz, Maria', deathDate: '2021-07-15', burialDate: '' },
        ])],
        [name, '', cls, 'Trees', 0, ...people([])],
      ]
  const ws = XLSX.utils.aoa_to_sheet([columns, ...data])
  ws['!cols'] = [{ wch: 12 }, { wch: 9 }, { wch: 16 }, { wch: 16 }, { wch: 11 },
    ...Array.from({ length: nameCols }, () => [{ wch: 28 }, { wch: 14 }, { wch: 14 }]).flat()]
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  addHelpSheet(XLSX, wb)
  const file = lots && lots.length ? `${name.replace(/\s+/g, '-')}-plots.xlsx` : `${name.replace(/\s+/g, '-')}-template.xlsx`
  XLSX.writeFile(wb, file)
}