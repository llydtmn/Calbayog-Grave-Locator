// ─────────────────────────────────────────────────────────────────────────────
// LEGEND SEED — presentational legend rows for the map.
// Derived from the central status taxonomy so the legend can never drift from
// the colors actually rendered on lots.
// ─────────────────────────────────────────────────────────────────────────────
import { STATUS_ORDER, STATUS_META } from '../config/status'

export const LEGEND = STATUS_ORDER.map((status) => ({
  status,
  label:   STATUS_META[status].label,
  fill:    STATUS_META[status].fill,
  border:  STATUS_META[status].border,
  mark:    !!STATUS_META[status].mark,     // renders "|" interment ticks
  pattern: !!STATUS_META[status].pattern,  // renders the crossed block-off cell
}))

export default LEGEND