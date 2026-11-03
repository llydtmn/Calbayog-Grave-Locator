// ─────────────────────────────────────────────────────────────────────────────
// REPORT DATA — pure functions behind the Reports & Analytics tabs.
// No React, no API calls: pages hand in lots / reservations / payments and get
// summaries back, so the numbers are easy to test and every report counts lots
// the same way the Dashboard does:
//   Available = available        Occupied = sold + with interment
//   Reserved  = reserve lot      Other    = not for sale, delinquent, trees,
//                                           lamp post, block-off
// ─────────────────────────────────────────────────────────────────────────────
import { STATUS } from '../config/status'
import { CLASSIFICATION_ORDER } from '../config/constants'

// ── Lot status groups ────────────────────────────────────────────────────────
export const GROUP = { AVAILABLE: 'available', OCCUPIED: 'occupied', RESERVED: 'reserved', OTHER: 'other' }
export const GROUP_ORDER = [GROUP.AVAILABLE, GROUP.OCCUPIED, GROUP.RESERVED, GROUP.OTHER]
export const GROUP_META = {
  [GROUP.AVAILABLE]: { label: 'Available', color: '#16A34A', statuses: [STATUS.AVAILABLE] },
  [GROUP.OCCUPIED]:  { label: 'Occupied',  color: '#DC2626', statuses: [STATUS.SOLD, STATUS.WITH_INTERMENT] },
  [GROUP.RESERVED]:  { label: 'Reserved',  color: '#D97706', statuses: [STATUS.RESERVE_LOT] },
  [GROUP.OTHER]:     { label: 'Other',     color: '#94A3B8', statuses: [STATUS.NOT_FOR_SALE, STATUS.DELINQUENT, STATUS.TREES, STATUS.LAMP_POST, STATUS.BLOCK_OFF] },
}
const STATUS_TO_GROUP = {}
GROUP_ORDER.forEach((g) => GROUP_META[g].statuses.forEach((s) => { STATUS_TO_GROUP[s] = g }))
export const groupOf = (status) => STATUS_TO_GROUP[status] || GROUP.OTHER

// "Block 1, Block 2, Block 2A, Block 3 …" instead of database order.
export function sortBlocks(blocks) {
  const key = (b) => {
    const m = /(\d+)\s*([A-Za-z]*)/.exec(b.name || b.id || '')
    return m ? [Number(m[1]), m[2].toUpperCase()] : [9999, String(b.name || b.id || '')]
  }
  return [...blocks].sort((a, b) => {
    const [an, as] = key(a); const [bn, bs] = key(b)
    return an - bn || as.localeCompare(bs)
  })
}

// ── Lot summaries ────────────────────────────────────────────────────────────
const blank = () => ({ total: 0, available: 0, occupied: 0, reserved: 0, other: 0, byStatus: {} })
function tally(row, lot) {
  row.total += 1
  row[groupOf(lot.status)] += 1
  row.byStatus[lot.status] = (row.byStatus[lot.status] || 0) + 1
}
function finish(row) {
  row.sold = row.byStatus[STATUS.SOLD] || 0
  row.withInterment = row.byStatus[STATUS.WITH_INTERMENT] || 0
  row.occupancyRate = row.total ? row.occupied / row.total : 0
  return row
}

// One row per block that has digitized lots, plus an "All blocks" total.
export function summarizeByBlock(lots, blocks) {
  const rows = new Map(sortBlocks(blocks).map((b) => [b.id, { blockId: b.id, name: b.name, ...blank() }]))
  const totals = { blockId: 'all', name: 'All blocks', ...blank() }
  for (const lot of lots) {
    let row = rows.get(lot.blockId)
    if (!row) { row = { blockId: lot.blockId, name: lot.blockId, ...blank() }; rows.set(lot.blockId, row) }
    tally(row, lot)
    tally(totals, lot)
  }
  return { rows: [...rows.values()].filter((r) => r.total > 0).map(finish), totals: finish(totals) }
}

// Blocks with no digitized lots yet (so a "0" in the report is not mistaken for "empty block").
export function undigitizedBlocks(lots, blocks) {
  const have = new Set(lots.map((l) => l.blockId))
  return sortBlocks(blocks).filter((b) => !have.has(b.id))
}

export function summarizeByClassification(lots) {
  const rows = new Map()
  for (const lot of lots) {
    const c = lot.classification || 'Unclassified'
    if (!rows.has(c)) rows.set(c, { classification: c, ...blank() })
    tally(rows.get(c), lot)
  }
  const rank = (c) => { const i = CLASSIFICATION_ORDER.indexOf(c); return i < 0 ? 99 : i }
  return [...rows.values()].map(finish).sort((a, b) => rank(a.classification) - rank(b.classification))
}

// Deceased names on a lot, whichever field holds them.
export const lotDeceased = (lot) => {
  if (Array.isArray(lot.deceasedRecords) && lot.deceasedRecords.length) return lot.deceasedRecords.map((r) => r.name)
  return lot.deceasedNames || []
}

// status filter values: 'all' | 'g:<group>' | 's:<status>'
// `from` / `to` + `dateOf(lot)` add a date-range filter (see lotStatusDate below).
export function filterLots(lots, { blockId = 'all', classification = 'all', status = 'all', query = '', from = '', to = '', dateOf = null } = {}) {
  const q = query.trim().toLowerCase()
  const byDate = !!(dateOf && (from || to))
  return lots.filter((l) => {
    if (byDate && !inRange(dateOf(l), from, to)) return false
    if (blockId !== 'all' && l.blockId !== blockId) return false
    if (classification !== 'all' && l.classification !== classification) return false
    if (status.startsWith('g:') && groupOf(l.status) !== status.slice(2)) return false
    if (status.startsWith('s:') && l.status !== status.slice(2)) return false
    if (q && !`${l.lotNo ?? ''} ${lotDeceased(l).join(' ')}`.toLowerCase().includes(q)) return false
    return true
  })
}

export function sortLots(lots, blocks) {
  const order = new Map(sortBlocks(blocks).map((b, i) => [b.id, i]))
  const idx = (l) => (order.has(l.blockId) ? order.get(l.blockId) : 999)
  return [...lots].sort((a, b) => idx(a) - idx(b) || (a.lotNo ?? Infinity) - (b.lotNo ?? Infinity))
}

// ── Dates ────────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
export const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// 'YYYY-MM-DD' stays as is; a timestamp becomes the LOCAL calendar date
// (so a 11pm Manila reservation isn't filed under the previous UTC day).
export function toLocalDate(v) {
  if (!v) return ''
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : isoLocal(d)
}

export function presetRange(preset, now = new Date()) {
  const y = now.getFullYear(); const m = now.getMonth()
  switch (preset) {
    case 'month':     return { from: isoLocal(new Date(y, m, 1)), to: isoLocal(new Date(y, m + 1, 0)) }
    case 'lastmonth': return { from: isoLocal(new Date(y, m - 1, 1)), to: isoLocal(new Date(y, m, 0)) }
    case '30d':       return { from: isoLocal(new Date(y, now.getMonth(), now.getDate() - 29)), to: isoLocal(now) }
    case 'year':      return { from: `${y}-01-01`, to: `${y}-12-31` }
    default:          return { from: '', to: '' }
  }
}

export function inRange(date, from, to) {
  if (!from && !to) return true
  if (!date) return false
  const d = String(date).slice(0, 10)
  return !(from && d < from) && !(to && d > to)
}

// ── Lot status date ──────────────────────────────────────────────────────────
// The lots table does not store when a status changed, so the date a lot "got"
// its status is taken from the records the office already keeps:
//   Occupied (sold / with interment) → latest date of burial (else date of death)
//   Reserved                         → date of its active reservation
//   Available / Other                → no date
// A lot with no such record has no date, so it only shows while no date range is set.
const ACTIVE_RESERVATION = ['pending', 'confirmed', 'completed']

// lot id (or "blockId|lotNo") → latest active reservation date, from the reservations list.
export function reservationDateByLot(reservations) {
  const map = new Map()
  for (const r of reservations || []) {
    if (!ACTIVE_RESERVATION.includes(r.status)) continue
    const d = toLocalDate(r.reservationDate || r.createdAt)
    if (!d) continue
    for (const key of [r.lotId, r.blockId != null && r.lotNo != null ? `${r.blockId}|${r.lotNo}` : null]) {
      if (key != null && (!map.has(key) || d > map.get(key))) map.set(key, d)
    }
  }
  return map
}

const latest = (dates) => dates.filter(Boolean).sort().pop() || ''

// 'YYYY-MM-DD' or '' when the lot has no dated record.
export function lotStatusDate(lot, reservationDates) {
  const g = groupOf(lot.status)
  if (g === GROUP.OCCUPIED) {
    const recs = lotRecords(lot)
    return latest(recs.map((r) => toLocalDate(r.burialDate))) || latest(recs.map((r) => toLocalDate(r.deathDate)))
  }
  if (g === GROUP.RESERVED) {
    return reservationDates?.get(lot.id) || reservationDates?.get(`${lot.blockId}|${lot.lotNo}`) || ''
  }
  return ''
}

// Whole months from an ISO date up to `now` (0 if in the future).
export function monthsBetween(startIso, now = new Date()) {
  const s = new Date(`${startIso}T00:00:00`)
  if (Number.isNaN(s.getTime())) return 0
  let m = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth())
  if (now.getDate() < s.getDate()) m -= 1
  return Math.max(0, m)
}

// ── Interment register ───────────────────────────────────────────────────────
// One record per person buried: { name, deathDate, burialDate }.
export function lotRecords(lot) {
  if (Array.isArray(lot.deceasedRecords) && lot.deceasedRecords.length) return lot.deceasedRecords
  return (lot.deceasedNames || []).map((name) => ({ name, deathDate: null, burialDate: null }))
}

export function intermentRecords(lots, blockNameOf) {
  const out = []
  for (const lot of lots) {
    lotRecords(lot).forEach((r, i) => out.push({
      id: `${lot.id}#${i}`,
      blockId: lot.blockId, blockName: blockNameOf(lot.blockId), lotNo: lot.lotNo,
      classification: lot.classification, lotStatus: lot.status,
      name: r.name, deathDate: r.deathDate || '', burialDate: r.burialDate || '',
    }))
  }
  return out
}

// Map vs register: how many interments the map shows vs names actually recorded.
export function intermentGaps(lots) {
  let onMap = 0; let named = 0; let missing = 0; let lotsMissing = 0
  for (const lot of lots) {
    const count = Math.max(0, Number(lot.intermentCount) || 0)
    const recs = lotRecords(lot).length
    onMap += count; named += recs
    if (count > recs) { missing += count - recs; lotsMissing += 1 }
  }
  return { onMap, named, missing, lotsMissing }
}

// ── Reservations ─────────────────────────────────────────────────────────────
export const reservationDate = (r, basis) => toLocalDate(basis === 'reservation' ? r.reservationDate : r.createdAt)
const ACTIVE_VALUE = ['pending', 'confirmed', 'completed']

export function filterReservations(list, f = {}) {
  const { status = 'all', blockId = 'all', classification = 'all', option = 'all', basis = 'submitted', from = '', to = '', query = '' } = f
  const q = query.trim().toLowerCase()
  return list.filter((r) => {
    if (status !== 'all' && r.status !== status) return false
    if (blockId !== 'all' && r.blockId !== blockId) return false
    if (classification !== 'all' && r.classification !== classification) return false
    if (option !== 'all' && r.paymentOption !== option) return false
    if (!inRange(reservationDate(r, basis), from, to)) return false
    if (q && !`${r.id} ${r.applicantName} ${r.email} ${r.blockName} ${r.lotNo}`.toLowerCase().includes(q)) return false
    return true
  })
}

export function summarizeReservations(list, blocks) {
  const names = new Map(blocks.map((b) => [b.id, b.name]))
  const make = (blockId, name) => ({ blockId, name, total: 0, value: 0, byStatus: {} })
  const rows = new Map(); const totals = make('all', 'All blocks')
  const add = (row, r) => {
    row.total += 1
    row.byStatus[r.status] = (row.byStatus[r.status] || 0) + 1
    if (ACTIVE_VALUE.includes(r.status)) row.value += Number(r.price) || 0
  }
  for (const r of list) {
    const id = r.blockId || r.blockName || 'unknown'
    if (!rows.has(id)) rows.set(id, make(id, names.get(r.blockId) || r.blockName || 'Unknown block'))
    add(rows.get(id), r); add(totals, r)
  }
  const order = new Map(sortBlocks(blocks).map((b, i) => [b.id, i]))
  return { rows: [...rows.values()].sort((a, b) => (order.get(a.blockId) ?? 999) - (order.get(b.blockId) ?? 999)), totals }
}

// ── Installment accounts ─────────────────────────────────────────────────────
// `progressFn` is installmentProgress() from api/paymentsApi.js (passed in so this
// file stays free of API imports). "Behind" is an ESTIMATE: whole months since the
// down payment (or reservation) date, capped at the term, minus months paid.
export function buildInstallmentAccounts(reservations, installments, progressFn, now = new Date()) {
  return reservations
    .filter((r) => r.paymentOption === 'installment' && ['confirmed', 'completed'].includes(r.status))
    .map((r) => {
      const p = progressFn(r, installments)
      const start = toLocalDate(r.dueNowReceivedOn || r.createdAt)
      const expected = Math.min(p.months, start ? monthsBetween(start, now) : 0)
      const behind = Math.max(0, expected - p.monthsCovered)
      const paidOff = p.owed > 0 && p.left <= 0.005
      const lastPaid = installments
        .filter((i) => i.reservationId === r.id && i.status === 'verified')
        .map((i) => String(i.paidOn || '').slice(0, 10)).sort().pop() || ''
      return {
        id: r.id, applicant: r.applicantName || '—', blockName: r.blockName || '', lotNo: r.lotNo,
        plot: [r.blockName, r.lotNo != null ? `Lot ${r.lotNo}` : null].filter(Boolean).join(' · ') || '—',
        classification: r.classification, term: r.installmentTerm || '',
        ...p, start, behind, lastPaid,
        state: paidOff ? 'paid' : behind > 0 ? 'behind' : 'current',
      }
    })
}