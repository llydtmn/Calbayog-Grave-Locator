// ─────────────────────────────────────────────────────────────────────────────
// LotGrid — lays out a block's lots in the SAME column count as the official
// plan (block.grid.cols) using a back-and-forth (snake) row order, so it reads
// like the paper. Each lot is coloured by the status taxonomy with interment
// marks (| / ||) and the block-off X. Tapping a lot calls onSelectLot(lot).
// Wide blocks scroll horizontally. Pure DOM grid — fully offline.
// ─────────────────────────────────────────────────────────────────────────────
import { useLots } from '../hooks'
import { statusMeta } from '../config/status'
import { intermentMarks } from '../utils/format'

export default function LotGrid({ blockId, cols = 0, filter = 'all', onSelectLot }) {
  const { lots, loading } = useLots(blockId)

  if (loading) return <div className="lg-grid-msg">Loading lots…</div>
  if (!lots.length) return null

  // Order lots like the plan: fill rows of `cols`, reversing alternate rows.
  let ordered = lots
  if (cols > 1) {
    ordered = []
    for (let r = 0; r * cols < lots.length; r++) {
      const row = lots.slice(r * cols, r * cols + cols)
      ordered.push(...(r % 2 ? row.reverse() : row))
    }
  }

  const style = cols > 1
    ? { gridTemplateColumns: `repeat(${cols}, minmax(28px, 1fr))` }
    : { gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))' }

  return (
    <div className="lg-grid" role="grid" aria-label="Lot grid" style={style}>
      {ordered.map(lot => {
        const meta = statusMeta(lot.status)
        const dim = filter !== 'all' && lot.status !== filter
        const marks = intermentMarks(lot.intermentCount)
        return (
          <button
            key={lot.id}
            role="gridcell"
            className={`lg-cell${dim ? ' lg-cell-dim' : ''}${meta.pattern ? ' lg-cell-off' : ''}${lot.lotNo == null ? ' lg-cell-nonum' : ''}`}
            style={{ background: meta.fill, color: meta.text, borderColor: meta.border }}
            onClick={() => onSelectLot && onSelectLot(lot)}
            title={`${lot.lotNo == null ? '' : `Lot ${lot.lotNo} · `}${meta.label}`}
            aria-label={lot.lotNo == null ? `${meta.label}${marks ? `, ${lot.intermentCount} interred` : ''}` : `Lot ${lot.lotNo}, ${meta.label}${marks ? `, ${lot.intermentCount} interred` : ''}`}
          >
            {lot.lotNo != null && <span className="lg-cell-no">{lot.lotNo}</span>}
            {marks && <span className="lg-cell-marks">{marks}</span>}
          </button>
        )
      })}
    </div>
  )
}