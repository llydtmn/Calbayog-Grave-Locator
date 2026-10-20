// ─────────────────────────────────────────────────────────────────────────────
// MOCK RESERVATIONS — in-memory store standing in for a real backend table.
// Read/written only through the reservation functions in api/index.js
// (never import this module directly from a page). Starts EMPTY — no demo data.
// Kept structurally identical to the User-Dashboard's data/mockReservations.js.
// ─────────────────────────────────────────────────────────────────────────────
export const MOCK_RESERVATIONS = []

let _seq = MOCK_RESERVATIONS.length + 1
export function nextReservationId() {
  return `res-${1000 + _seq++}`
}

export function getReservationByIdSync(id) {
  return MOCK_RESERVATIONS.find((r) => r.id === id) || null
}