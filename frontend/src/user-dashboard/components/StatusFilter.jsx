// ─────────────────────────────────────────────────────────────────────────────
// StatusFilter — chip row for filtering the lot grid by status. Driven by the
// central STATUS_ORDER so a new status appears here automatically. Controlled:
// parent owns the active value. `counts` (optional) shows how many lots match.
// ─────────────────────────────────────────────────────────────────────────────
import { STATUS_ORDER, statusLabel, statusFill, statusMeta } from '../config/status'

export default function StatusFilter({ value, onChange, counts }) {
  const chips = ['all', ...STATUS_ORDER]

  return (
    <div className="lg-filter" role="tablist" aria-label="Filter lots by status">
      {chips.map(s => {
        const active = value === s
        const label = s === 'all' ? 'All' : statusLabel(s)
        const n = counts ? (s === 'all' ? counts.__total : counts[s] || 0) : null
        return (
          <button
            key={s}
            role="tab"
            aria-selected={active}
            className={`lg-chip${active ? ' active' : ''}`}
            onClick={() => onChange(s)}
          >
            {s !== 'all' && (
              <span
                className={`lg-chip-dot${statusMeta(s).pattern ? ' lg-chip-dot-off' : ''}`}
                style={{ background: statusFill(s), borderColor: statusMeta(s).border }}
              />
            )}
            <span>{label}</span>
            {n != null && <span className="lg-chip-count">{n}</span>}
          </button>
        )
      })}
    </div>
  )
}