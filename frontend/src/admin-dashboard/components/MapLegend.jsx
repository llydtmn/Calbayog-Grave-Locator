// ─────────────────────────────────────────────────────────────────────────────
// MapLegend — renders the lot-status legend straight from the central taxonomy
// (data/legend.js → config/status.js), so the swatches always match the lots.
// `compact` shows a tighter, wrap-friendly row used inside the lot-grid header.
// ─────────────────────────────────────────────────────────────────────────────
import { useLegend } from '../hooks'

export default function MapLegend({ compact = false }) {
  const { legend } = useLegend()

  return (
    <div className={`lg-legend${compact ? ' lg-legend-compact' : ''}`}>
      {legend.map(item => (
        <div key={item.status} className="lg-legend-row">
          <span
            className={`lg-swatch${item.pattern ? ' lg-swatch-off' : ''}`}
            style={{ background: item.fill, borderColor: item.border }}
          >
            {item.mark && <span className="lg-swatch-mark">|</span>}
          </span>
          <span className="lg-legend-label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}