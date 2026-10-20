// ─────────────────────────────────────────────────────────────────────────────
// PLOT REF HELPERS — every admin record that points at a lot (a user's
// holding, a memorial submission) stores { blockId, lotNo }, the same pair
// used by data/lots.js / api.getLot(). This keeps admin data addressable
// against the exact same lots the public site and a future backend use —
// never a free-text "B-204" string that only this dashboard understands.
// ─────────────────────────────────────────────────────────────────────────────
import { getBlockById } from '../data/blocks'

// { blockId: 'block-3', lotNo: 204 } → "Block 3 · Lot 204"
export function plotLabel({ blockId, lotNo }) {
  const block = getBlockById(blockId)
  const name = block ? block.name : blockId
  return lotNo ? `${name} · Lot ${lotNo}` : name
}

// Short form for table cells: "B3-204"
export function plotShort({ blockId, lotNo }) {
  const block = getBlockById(blockId)
  const num = block ? block.name.replace(/^Block\s*/i, '') : '?'
  return lotNo ? `B${num}-${lotNo}` : `B${num}`
}
