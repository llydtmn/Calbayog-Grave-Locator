// ─────────────────────────────────────────────────────────────────────────────
// LOTS SEED — per-block lot generator.
//
// Reality from the official block plans: each grid block is MOSTLY SOLD, with
// MANY sold-with-interment lots (| = 1 grave, || = 2), a handful of special lots
// (trees, lamp, reserve, delinquent, not-for-sale), and some COLOURED CELLS THAT
// HAVE NO LOT NUMBER (e.g. tree cells on the pathways). This module reproduces
// all of that:
//
//   • default per block = `sold`  (BLOCK_DEFAULT)
//   • verified specials read off the photos       (BLOCK_OVERRIDES, by lotNo)
//   • number-less coloured cells                   (BLOCK_EXTRAS)
//   • interment spread across the sold lots        (ILLUSTRATIVE_INTERMENT)
//
// ── Accuracy note ────────────────────────────────────────────────────────────
// The exact lot numbers that carry interment marks (and the grey "reserve" /
// white "vacant" cells in the dense blocks) cannot be read reliably from rotated
// phone photos. So interment is filled with a realistic, DETERMINISTIC spread so
// the blocks look like the plans (mostly sold, many with interment) instead of
// all-zero. Set ILLUSTRATIVE_INTERMENT = false to clear it, or drop exact data
// into BLOCK_OVERRIDES, e.g.  204: inter(1),  331: inter(2),  188: reserve,
// ─────────────────────────────────────────────────────────────────────────────
import { BLOCKS, getBlockById } from './blocks.js'
import { STATUS } from '../config/status.js'
import { CLASSIFICATION } from '../config/constants.js'

const C = CLASSIFICATION

// Status shorthands for the tables below.
const sold = { status: STATUS.SOLD }
const inter = (n = 1) => ({ status: STATUS.WITH_INTERMENT, intermentCount: n })
const reserve = { status: STATUS.RESERVE_LOT }
const tree = { status: STATUS.TREES }
const lamp = { status: STATUS.LAMP_POST }
const nfs = { status: STATUS.NOT_FOR_SALE }
const delinquent = { status: STATUS.DELINQUENT }
const vacant = { status: STATUS.AVAILABLE }

// Approximate interment spread over the sold lots (pending the office's records).
export const ILLUSTRATIVE_INTERMENT = true

export const BLOCK_DEFAULT = {
  'block-3': STATUS.SOLD, 'block-4': STATUS.SOLD, 'block-5': STATUS.SOLD,
  'block-6': STATUS.SOLD, 'block-7': STATUS.SOLD,
}

// Per-lot exceptions read from the uploaded plans (counts the plan shows noted).
export const BLOCK_OVERRIDES = {
  // Block 3 — 23 vacant + 21 reserve + 1 lamp (grey/white lot #s not legible in
  // the photo; add e.g. `32: vacant, 188: reserve, 158: lamp,` from the paper).
  // A small, explicit set is seeded below so the frontend has real AVAILABLE
  // lots to demo the reservation flow against — replace with the office's
  // exact vacant lot numbers once they're transcribed from the paper plan.
  'block-3': { 12: vacant, 45: vacant, 78: vacant, 133: vacant, 205: vacant },
  // Block 4 — many specials; couldn't fully count from the photo.
  'block-4': { 236: nfs },
  // Block 5 (Everlasting) — trees read from the plan (+ ~7 number-less, below).
  'block-5': {
    19: tree, 56: tree, 57: tree, 160: tree,
    289: tree, 308: tree, 318: tree, 327: tree, 337: tree,
  },
  // Block 6 — only special is 231 reserve.
  'block-6': { 231: reserve },
  // Block 7 (Perpetual) — trees + one delinquent read from the plan.
  'block-7': {
    138: tree, 148: tree, 157: tree, 167: tree, 366: tree, 395: tree,
    710: delinquent,
  },
}

// Coloured cells that have NO lot number (rendered after the numbered lots).
// Counts come from the plans (detected tree cells without numbers, plus the
// "no number but with interment" cells you mentioned).
export const BLOCK_EXTRAS = {
  'block-3': [inter(1), inter(1), inter(2), inter(1)],
  'block-4': [inter(1), inter(1), inter(1), inter(2), inter(1), inter(1)],
  'block-5': [tree, tree, tree, tree, tree, tree, tree, inter(1), inter(1), inter(2)],
  'block-6': [inter(1), inter(1), inter(1), inter(2)],
  'block-7': [tree, tree, tree, tree, tree, tree, tree, inter(1), inter(1), inter(2)],
}

function classifyLot(block, lotNo) {
  if (block.id === 'block-3' && block.counts) {
    const { premium, deluxe } = block.counts
    if (lotNo <= premium) return C.PREMIUM
    if (lotNo <= premium + deluxe) return C.DELUXE
    return C.REGULAR
  }
  const tiers = block.classifications || [C.REGULAR]
  if (tiers.length === 1) return tiers[0]
  const band = Math.ceil((block.maxLot || 1) / tiers.length)
  return tiers[Math.min(tiers.length - 1, Math.floor((lotNo - 1) / band))]
}

// Deterministic hash so the interment spread is stable across reloads.
function hash(n) { const x = Math.sin(n * 91.7) * 43758.5453; return x - Math.floor(x) }

// ── Generator ────────────────────────────────────────────────────────────────
export function generateLots(blockId) {
  const block = getBlockById(blockId)
  if (!block || !block.hasGrid || !block.maxLot) return []

  const overrides = BLOCK_OVERRIDES[blockId] || {}
  const fallback = BLOCK_DEFAULT[blockId] || STATUS.AVAILABLE
  const lots = []

  for (let n = 1; n <= block.maxLot; n++) {
    const o = overrides[n]
    let status = o ? o.status : fallback
    let intermentCount = o?.intermentCount || 0

    // Spread interment across plain sold lots (when not explicitly overridden).
    if (!o && status === STATUS.SOLD && ILLUSTRATIVE_INTERMENT) {
      const r = hash(n)
      if (r < 0.30) { status = STATUS.WITH_INTERMENT; intermentCount = r < 0.06 ? 2 : 1 }
    }

    lots.push({
      id: `${blockId}-${n}`, blockId, lotNo: n,
      classification: classifyLot(block, n),
      status, intermentCount, verified: !!o,
    })
  }

  // Number-less coloured cells.
  const extras = BLOCK_EXTRAS[blockId] || []
  extras.forEach((e, i) => {
    lots.push({
      id: `${blockId}-x${i}`, blockId, lotNo: null,
      classification: classifyLot(block, block.maxLot),
      status: e.status, intermentCount: e.intermentCount || 0, verified: true,
    })
  })

  return lots
}

const _cache = {}
export function getLotsForBlock(blockId) {
  if (!_cache[blockId]) _cache[blockId] = generateLots(blockId)
  return _cache[blockId]
}

export const ALL_GRID_BLOCK_IDS = BLOCKS.filter((b) => b.hasGrid).map((b) => b.id)