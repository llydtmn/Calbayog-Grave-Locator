// ─────────────────────────────────────────────────────────────────────────────
// DATA HOOKS — thin wrappers over the api/ surface with loading/error state.
// Same useAsync pattern as the User-Dashboard's hooks/index.js. Pages use these
// instead of calling the API imperatively or reading seed data directly.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import * as api from '../api'
import * as paymentsApi from '../api/paymentsApi'
import { onDataChange } from '../api/client'

// Generic async-resource hook.
function useAsync(fn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0) // silent refresh after an action

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.resolve()
      .then(() => fn())
      // Copy so React re-renders even when local mode returns the same (mutated) array.
      .then((res) => { if (alive) setData(Array.isArray(res) ? [...res] : res && typeof res === 'object' ? { ...res } : res) })
      .catch((err) => { if (alive) setError(err) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadTick])

  // After a create/update/delete: re-fetch in the background without flipping
  // `loading`, so tables update in place instead of blinking empty.
  useEffect(() => {
    if (!refreshTick) return
    let alive = true
    Promise.resolve()
      .then(() => fn())
      .then((res) => { if (alive) setData(Array.isArray(res) ? [...res] : res && typeof res === 'object' ? { ...res } : res) })
      .catch((err) => { if (alive) setError(err) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick])

  const reload = useCallback(() => setReloadTick((t) => t + 1), [])
  useEffect(() => onDataChange(() => setRefreshTick((t) => t + 1)), [])
  return { data, loading, error, reload }
}

// ── Site / blocks / lots (same shape as the User-Dashboard) ─────────────────
export function useSite() {
  return useAsync(() => api.getSite(), [])
}

export function useBlocks() {
  const { data, loading, error } = useAsync(() => api.getBlocks(), [])
  return { blocks: data || [], loading, error }
}

export function useBlock(blockId) {
  const { data, loading, error } = useAsync(() => api.getBlock(blockId), [blockId])
  return { block: data, loading, error }
}

export function useLots(blockId) {
  const { data, loading, error, reload } = useAsync(
    () => (blockId ? api.getLots(blockId) : Promise.resolve([])),
    [blockId],
  )
  return { lots: data || [], loading, error, reload }
}

export function usePricing() {
  const { data, loading, error } = useAsync(() => api.getPricing(), [])
  return { pricing: data, loading, error }
}

export function useLegend() {
  const { data, loading, error } = useAsync(() => api.getLegend(), [])
  return { legend: data || [], loading, error }
}

// ── Admin dashboard ───────────────────────────────────────────────────────────
export function useDashboardMetrics() {
  const { data, loading, error } = useAsync(() => api.getDashboardMetrics(), [])
  return { metrics: data, loading, error }
}

export function useBlockOccupancy() {
  const { data, loading, error } = useAsync(() => api.getBlockOccupancy(), [])
  return { occupancy: data || [], loading, error }
}

// ── Site users ────────────────────────────────────────────────────────────────
export function useUsers() {
  const { data, loading, error, reload } = useAsync(() => api.getUsers(), [])
  return { users: data || [], loading, error, reload }
}

// ── Admin staff ───────────────────────────────────────────────────────────────
export function useAdminStaff() {
  const { data, loading, error, reload } = useAsync(() => api.getAdminStaff(), [])
  return { staff: data || [], loading, error, reload }
}

// ── Memorial moderation ───────────────────────────────────────────────────────
export function useMemorialQueue() {
  const { data, loading, error, reload } = useAsync(() => api.getMemorialQueue(), [])
  return { queue: data || [], loading, error, reload }
}

// ── Reservations ─────────────────────────────────────────────────────────────
export function useReservations() {
  const { data, loading, error, reload } = useAsync(() => api.getReservations(), [])
  return { reservations: data || [], loading, error, reload }
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function useSettings() {
  const { data, loading, error, reload } = useAsync(() => api.getSettings(), [])
  return { settings: data, loading, error, reload }
}

export function useNotifications() {
  const { data, loading, error, reload } = useAsync(() => api.getNotifications(), [])
  return {
    sent: data?.sent || [],
    stats: data?.stats || null,
    alerts: data?.alerts || [],
    loading, error, reload,
  }
}

// ── Reports: paid payments (monthly income) ──────────────────────────────────
export function usePaidPayments() {
  const { data, loading, error, reload } = useAsync(() => api.getPaidPayments(), [])
  return { payments: data?.payments || [], warnings: data?.warnings || [], loading, error, reload }
}

// ── Payments (GCash merchant details, receipts, monthly installments) ───────
export function usePaymentSettings() {
  const { data, loading, error, reload } = useAsync(() => paymentsApi.getPaymentSettings(), [])
  return { paymentSettings: data, loading, error, reload }
}

export function usePaymentOverview() {
  const { data, loading, error, reload } = useAsync(() => paymentsApi.getPaymentOverview(), [])
  return {
    paymentReservations: data?.reservations || [],
    installments: data?.installments || [],
    loading, error, reload,
  }
}