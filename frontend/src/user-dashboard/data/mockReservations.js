// ─────────────────────────────────────────────────────────────────────────────
// MOCK RESERVATIONS — in-memory store standing in for a real backend table.
// Read/written only through src/api/reservationApi.js (never import this
// module directly from a screen). Starts EMPTY — no demo user data.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_RESERVATIONS = []

let _seq = MOCK_RESERVATIONS.length + 1
export function nextReservationId() {
  return `res-${1000 + _seq++}`
}