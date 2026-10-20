// ─────────────────────────────────────────────────────────────────────────────
// ADMIN STAFF SEED — dashboard login accounts (Settings → Admin Staff). Distinct
// from data/users.js, which is the public site's customer accounts.
// ─────────────────────────────────────────────────────────────────────────────
import { ADMIN_ROLE } from '../config/adminStatus'

export const ADMIN_STAFF = [
  { id: 'admin-1', name: 'Admin User', email: 'admin@calbayog.gov.ph', role: ADMIN_ROLE.SUPER_ADMIN, avatar: 'A' },
  { id: 'admin-2', name: 'Staff One', email: 'staff1@calbayog.gov.ph', role: ADMIN_ROLE.ADMIN, avatar: 'S' },
]
