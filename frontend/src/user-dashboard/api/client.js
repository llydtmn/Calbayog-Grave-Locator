// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT — the single seam between the UI and the data source.
//
// Today every call resolves from local seed data (config ENV.USE_REMOTE = false).
// To go live: set VITE_USE_REMOTE=true + VITE_API_BASE_URL, and implement the
// remote branch in `request()`. No screen or hook needs to change.
// ─────────────────────────────────────────────────────────────────────────────
import { ENV } from '../config/constants'

// Resolve local seed data with a small simulated latency so loading states are
// exercised exactly as they will be against a real network.
export function local(resolver) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(resolver()), ENV.MOCK_LATENCY)
  })
}

// Remote fetch wrapper (used once USE_REMOTE is on). Kept tiny + dependency-free.
export async function request(path, options = {}) {
  if (!ENV.USE_REMOTE) {
    throw new Error('Remote API disabled. Set VITE_USE_REMOTE=true to enable.')
  }
  const res = await fetch(`${ENV.API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`)
  return res.json()
}

export const USE_REMOTE = ENV.USE_REMOTE