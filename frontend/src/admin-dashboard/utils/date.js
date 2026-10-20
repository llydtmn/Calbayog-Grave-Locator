// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILS
// ─────────────────────────────────────────────────────────────────────────────

// 'YYYY-MM-DD' → 'Mar 15, 2026'
export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
