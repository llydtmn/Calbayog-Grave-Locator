// ─────────────────────────────────────────────────────────────────────────────
// FORMAT UTILS
// ─────────────────────────────────────────────────────────────────────────────

// ₱1,234.56  (omits centavos when whole).
export function peso(value) {
  if (value == null) return '—'
  const n = Number(value)
  const hasCentavos = Math.round(n * 100) % 100 !== 0
  return '₱' + n.toLocaleString('en-PH', {
    minimumFractionDigits: hasCentavos ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

// 0 → '', 1 → '|', 2 → '||'  (interment tick marks).
export function intermentMarks(count) {
  return '|'.repeat(Math.max(0, Math.min(2, count || 0)))
}

// 0.18 → '18%'
export function percent(rate) {
  return `${Math.round(rate * 100)}%`
}