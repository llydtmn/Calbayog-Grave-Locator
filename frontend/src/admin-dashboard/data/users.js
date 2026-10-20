// ─────────────────────────────────────────────────────────────────────────────
// SITE USERS — public GraveLocator app accounts (the User-Dashboard's
// customers), as seen from the admin side. Starts EMPTY — no demo users.
// Shape: { id, name, email, phone, plots: [{ blockId, lotNo }], joined, status }
// Served via api/getUsers(). Distinct from data/adminStaff.js (dashboard staff).
// ─────────────────────────────────────────────────────────────────────────────
export const USERS = []

export const getUserById = (id) => USERS.find((u) => u.id === id) || null