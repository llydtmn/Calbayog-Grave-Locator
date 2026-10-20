// ─────────────────────────────────────────────────────────────────────────────
// DATA HOOKS — thin wrappers over the api/ surface with loading/error state.
// Screens use these instead of calling the API imperatively.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import * as api from '../api'

// Generic async-resource hook. Mirrors the Admin dashboard's version — both
// support reload() so a screen can refetch after creating/editing something.
function useAsync(fn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.resolve(fn())
      .then((res) => { if (alive) setData(res) })
      .catch((err) => { if (alive) setError(err) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadTick])

  const reload = useCallback(() => setReloadTick((t) => t + 1), [])
  return { data, loading, error, reload }
}

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
  const { data, loading, error } = useAsync(
    () => (blockId ? api.getLots(blockId) : Promise.resolve([])),
    [blockId],
  )
  return { lots: data || [], loading, error }
}

export function useLot(blockId, lotNo) {
  const { data, loading, error } = useAsync(
    () => (blockId && lotNo ? api.getLot(blockId, lotNo) : Promise.resolve(null)),
    [blockId, lotNo],
  )
  return { lot: data, loading, error }
}

export function usePricing() {
  const { data, loading, error } = useAsync(() => api.getPricing(), [])
  return { pricing: data, loading, error }
}

export function useLegend() {
  const { data, loading, error } = useAsync(() => api.getLegend(), [])
  return { legend: data || [], loading, error }
}

// Private: only the signed-in user's own memorials. Re-fetches when the user changes.
export function useMemorials(userId) {
  const { data, loading, error, reload } = useAsync(() => api.getMemorials(userId), [userId])
  return { memorials: data || [], loading, error, reload }
}

// ── Reservations ─────────────────────────────────────────────────────────────
export function useMyReservations(userId) {
  const { data, loading, error, reload } = useAsync(() => api.getMyReservations(userId), [userId])
  return { reservations: data || [], loading, error, reload }
}

export function useReservation(id) {
  const { data, loading, error, reload } = useAsync(
    () => (id ? api.getReservationById(id) : Promise.resolve(null)),
    [id],
  )
  return { reservation: data, loading, error, reload }
}

// ── Payment ──────────────────────────────────────────────────────────────────
// GCash account name / number / QR set by the admin (shown on the reservation form).
export function usePaymentSettings() {
  const { data, loading, error } = useAsync(() => api.getPaymentSettings(), [])
  return { paymentSettings: data, loading, error }
}

// Monthly payments / adjustments on one installment reservation.
export function useInstallmentPayments(reservationId) {
  const { data, loading, error, reload } = useAsync(
    () => (reservationId ? api.getInstallmentPayments(reservationId) : Promise.resolve([])),
    [reservationId],
  )
  return { payments: data || [], loading, error, reload }
}