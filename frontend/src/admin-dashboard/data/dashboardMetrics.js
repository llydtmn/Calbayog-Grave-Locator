// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD METRICS — computed from the same shared data every other admin page
// reads, not a separately hardcoded set of numbers. Once a real backend exists,
// this file is the one place that likely becomes a single aggregate endpoint
// (e.g. GET /admin/dashboard-summary) instead of being recomputed client-side.
// ─────────────────────────────────────────────────────────────────────────────
import { BLOCKS } from './blocks'
import { getLotsForBlock } from './lots'
import { USERS } from './users'
import { MEMORIAL_QUEUE } from './memorialModeration'
import { STATUS } from '../config/status'
import { MEMORIAL_STATUS } from '../config/adminStatus'

// Every digitized lot across every block, in one flat list.
function allLots() {
  return BLOCKS.flatMap((b) => getLotsForBlock(b.id))
}

export function computeDashboardMetrics() {
  const lots = allLots()
  const total = lots.length

  const available = lots.filter((l) => l.status === STATUS.AVAILABLE).length
  const occupied = lots.filter((l) => l.status === STATUS.SOLD || l.status === STATUS.WITH_INTERMENT).length
  const reserved = lots.filter((l) => l.status === STATUS.RESERVE_LOT).length

  const pendingMemorials = MEMORIAL_QUEUE.filter((m) => m.status === MEMORIAL_STATUS.PENDING).length

  return {
    totalPlots: total,
    available,
    occupied,
    reserved,
    totalUsers: USERS.length,
    pendingItems: pendingMemorials,
    pendingMemorials,
  }
}

// Section/block occupancy — feeds the "Plot Status Distribution" and
// "Occupancy by Block" breakdowns from one place.
export function computeBlockOccupancy() {
  return BLOCKS.map((b) => {
    const lots = getLotsForBlock(b.id)
    const occupied = lots.filter((l) => l.status === STATUS.SOLD || l.status === STATUS.WITH_INTERMENT).length
    return {
      blockId: b.id,
      name: b.name,
      total: lots.length,
      occupied,
      occupancyRate: lots.length ? occupied / lots.length : 0,
    }
  }).filter((b) => b.total > 0)
}
