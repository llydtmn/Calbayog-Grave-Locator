// ─────────────────────────────────────────────────────────────────────────────
// API SURFACE — screens import ONLY from here (never from /data directly).
// Each function currently delegates to local seed data via the client; swapping
// to a real backend is a one-line change per function inside this file.
// ─────────────────────────────────────────────────────────────────────────────
import { local, USE_REMOTE } from './client'
import { supabase } from './supabaseClient'
import { BLOCKS, PARK_MAP, getBlockById } from '../data/blocks'
import { getLotsForBlock, ALL_GRID_BLOCK_IDS } from '../data/lots'
import { PRICING, CASH_PRICING, INSTALLMENT_FACTORS, INTERMENT_FEES, PRICING_NOTES } from '../data/pricing'
import { INSTALLMENT_INTEREST } from '../config/constants'
import { LEGEND } from '../data/legend'
import {
  createReservation, getMyReservations, getReservationById, cancelReservation,
  getPaymentSettings, getInstallmentPayments, submitMonthlyPayment,
} from './reservationApi'

// Row shape from Supabase (snake_case) → the shape screens already expect (camelCase).
function blockFromRow(row) {
  return {
    id: row.id, name: row.name, lawnName: row.lawn_name, hasGrid: row.has_grid,
    maxLot: row.max_lot, grid: row.grid_cols ? { cols: row.grid_cols } : undefined,
    classifications: row.classifications, subAreas: row.sub_areas || undefined,
    batches: row.batches || undefined, counts: row.counts || undefined,
    label: { x: row.label_x, y: row.label_y }, hotspot: row.hotspot,
    // GPS pin: use DB lat/lng columns if present, else fall back to the seed.
    coords: row.lat != null && row.lng != null ? [row.lat, row.lng] : getBlockById(row.id)?.coords,
  }
}
function lotFromRow(row) {
  return {
    id: row.id, blockId: row.block_id, lotNo: row.lot_no,
    classification: row.classification, status: row.status,
    intermentCount: row.interment_count, verified: row.verified,
    deceasedNames: row.deceased_names || [],
    deceasedRecords: deceasedRecordsFromRow(row),
  }
}

// Each person buried in a lot: { name, deathDate, burialDate } (dates 'YYYY-MM-DD'
// or null). Lots saved before supabase/deceased-dates.sql only have names.
function deceasedRecordsFromRow(row) {
  const recs = Array.isArray(row.deceased_records) ? row.deceased_records.filter((r) => r && r.name) : []
  if (recs.length) return recs.map((r) => ({ name: String(r.name), deathDate: r.deathDate || null, burialDate: r.burialDate || null }))
  return (row.deceased_names || []).map((name) => ({ name, deathDate: null, burialDate: null }))
}

// Same, for lots that came from local demo data (names only).
export function deceasedRecordsOf(lot) {
  const recs = Array.isArray(lot?.deceasedRecords) ? lot.deceasedRecords.filter((r) => r && r.name) : []
  if (recs.length) return recs
  return (lot?.deceasedNames || []).map((name) => ({ name, deathDate: null, burialDate: null }))
}
function memorialFromRow(row) {
  return {
    id: row.id, emoji: row.emoji, name: row.name, dates: row.dates,
    quote: row.quote, likes: row.likes, comments: row.comments,
    status: row.status || 'pending', userId: row.user_id,
  }
}

// Local (mock) mode: memorials created this session, per user. Not persisted.
const localMemorials = []

// ── Site / blocks ────────────────────────────────────────────────────────────
export function getSite() {
  if (USE_REMOTE) return getBlocks().then((blocks) => ({ map: PARK_MAP, blocks }))
  return local(() => ({ map: PARK_MAP, blocks: BLOCKS }))
}

export async function getBlocks() {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('blocks').select('*')
    if (error) throw error
    return data.map(blockFromRow)
  }
  return local(() => BLOCKS)
}

export async function getBlock(blockId) {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('blocks').select('*').eq('id', blockId).single()
    if (error) throw error
    return blockFromRow(data)
  }
  return local(() => getBlockById(blockId))
}

// ── Lots ─────────────────────────────────────────────────────────────────────
export async function getLots(blockId) {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('lots').select('*').eq('block_id', blockId).order('lot_no')
    if (error) throw error
    return data.map(lotFromRow)
  }
  return local(() => getLotsForBlock(blockId))
}

export async function getLot(blockId, lotNo) {
  if (USE_REMOTE) {
    const { data, error } = await supabase
      .from('lots').select('*').eq('block_id', blockId).eq('lot_no', Number(lotNo)).maybeSingle()
    if (error) throw error
    return data ? lotFromRow(data) : null
  }
  return local(() => getLotsForBlock(blockId).find((l) => l.lotNo === Number(lotNo)) || null)
}

// ── Search: names of the deceased ───────────────────────────────────────────
// Finds lots whose interred names match what was typed — every word in any
// order ("romeo rosales" → "Rosales, Romeo"), plus close spellings on the
// server ("rosalez" → "Rosales"). Uses supabase/plot-import.sql → search_deceased.
// Returns [{ lotId, blockId, lotNo, classification, status, intermentCount, name, deathDate }]
export async function searchDeceased(query, limit = 30) {
  const q = String(query || '').trim()
  if (q.length < 2) return []
  if (USE_REMOTE) {
    const { data, error } = await supabase.rpc('search_deceased', { p_query: q, p_limit: limit })
    if (error) throw error
    const results = (data || []).map((r) => ({
      lotId: r.lot_id, blockId: r.block_id, lotNo: r.lot_no, classification: r.classification,
      status: r.status, intermentCount: r.interment_count, name: r.name, deathDate: null,
    }))

    // Add each person's date of death (helps tell apart people with the same name).
    // Skipped quietly if supabase/deceased-dates.sql hasn't been run yet.
    const lotIds = [...new Set(results.map((r) => r.lotId).filter(Boolean))]
    if (lotIds.length) {
      const { data: lots, error: datesErr } = await supabase.from('lots').select('id, deceased_records').in('id', lotIds)
      if (!datesErr) {
        const byLot = Object.fromEntries((lots || []).map((l) => [l.id, l.deceased_records || []]))
        results.forEach((r) => {
          const hit = (byLot[r.lotId] || []).find((p) => String(p?.name || '').toLowerCase() === String(r.name).toLowerCase())
          r.deathDate = hit?.deathDate || null
        })
      }
    }
    return results
  }
  // Local demo data: same "every word, any order" match (no fuzzy spelling).
  const words = q.toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').split(' ').filter(Boolean)
  return local(() => ALL_GRID_BLOCK_IDS.flatMap((blockId) => getLotsForBlock(blockId).flatMap((l) =>
    (l.deceasedNames || [])
      .filter((n) => words.every((w) => n.toLowerCase().includes(w)))
      .map((name) => ({ lotId: l.id, blockId, lotNo: l.lotNo, classification: l.classification, status: l.status, intermentCount: l.intermentCount, name, deathDate: null })),
  )).slice(0, limit))
}

// ── Pricing (static reference data — not stored in Supabase; edit pricing.js) ─
export function getPricing() {
  return local(() => ({
    installment: PRICING,
    cash: CASH_PRICING,
    factors: INSTALLMENT_FACTORS,
    interest: INSTALLMENT_INTEREST,
    interment: INTERMENT_FEES,
    notes: PRICING_NOTES,
  }))
}

export function getPricingFor(classification) {
  return local(() => PRICING[classification] || null)
}

// ── Legend ───────────────────────────────────────────────────────────────────
export function getLegend() {
  return local(() => LEGEND)
}

// ── Memorials (PRIVATE) ──────────────────────────────────────────────────────
// Each user only ever sees the memorials THEY created (any status, so they can
// see "Pending review" too). Enforced in the database by RLS (see
// supabase/memorials-private.sql); the user_id filter here is a second guard.
export async function getMemorials(userId) {
  if (USE_REMOTE) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data, error } = await supabase
      .from('memorials')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map(memorialFromRow)
  }
  return local(() => localMemorials.filter((m) => m.userId === (userId || 'local-user')))
}

// payload: { name, birthDate, deathDate, blockId, lotNo, quote, userId }
export async function createMemorial(payload) {
  const { name, birthDate, deathDate, blockId, lotNo, quote } = payload
  const birthYear = birthDate ? birthDate.slice(0, 4) : '?'
  const deathYear = deathDate ? deathDate.slice(0, 4) : '?'
  const block = getBlockById(blockId)
  const plotLabel = block ? `${block.name}${lotNo ? ` · Lot ${lotNo}` : ''}` : ''
  const dates = `${birthYear} – ${deathYear}${plotLabel ? ` · ${plotLabel}` : ''}`

  if (USE_REMOTE) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('memorials')
      .insert({
        name, quote, dates,
        emoji: '🕊️', likes: 0, comments: 0,
        birth_date: birthDate || null, death_date: deathDate || null,
        block_id: blockId || null, lot_no: lotNo ? Number(lotNo) : null,
        submitted_by: user?.user_metadata?.full_name || null,
        user_id: user?.id,
        status: 'pending',
      })
      .select()
      .single()
    if (error) throw error
    return memorialFromRow(data)
  }
  // Local stub: keep it in memory for this session, owned by this user only.
  return local(() => {
    const m = {
      id: `mem-${Date.now()}`, name, dates, quote, emoji: '🕊️', likes: 0, comments: 0,
      status: 'pending', userId: payload.userId || 'local-user',
    }
    localMemorials.unshift(m)
    return m
  })
}

// ── Auth (Supabase Auth — only active when USE_REMOTE is on) ────────────────
// privacyVersion: the Privacy Notice version the user agreed to. It's saved
// with the account (auth user_metadata) together with the time they agreed,
// as proof of consent under the Data Privacy Act (RA 10173).
export async function signUp({ email, password, fullName, phone, privacyVersion }) {
  const consent = privacyVersion
    ? { privacy_consent_version: privacyVersion, privacy_consent_at: new Date().toISOString() }
    : {}
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, phone, ...consent } },
  })
  if (error) throw error
  return data
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// Re-sends the confirmation link — used when a login attempt fails because
// the account exists but hasn't confirmed their email yet.
export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) throw error
}

// Verifies the 6-digit code from the confirmation email and logs the user in.
// Requires the "Confirm signup" email template to include {{ .Token }}.
export async function verifySignupCode(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Updates the signed-in user's display name/phone — both the auth session's
// metadata (so the app's greeting/profile update instantly) and the profiles
// table row (so it's consistent for anything querying that table directly).
export async function updateProfile({ fullName, phone }) {
  const { data, error } = await supabase.auth.updateUser({ data: { full_name: fullName, phone } })
  if (error) throw error

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: fullName, phone })
    .eq('id', data.user.id)
  if (profileError) throw profileError

  return data
}

// Changes the signed-in user's password. Supabase doesn't ask for the old
// password here since the user already has a valid session (they're signed in).
export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

// ── Forgot password (email + 6-digit code) ───────────────────────────────────
// Step 1: email the user a recovery code. Requires the Supabase "Reset Password"
// email template to include {{ .Token }}.
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
  if (error) throw error
}

// Step 2: check the code (this signs the user in) and set the new password.
export async function resetPasswordWithCode(email, token, newPassword) {
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: email.trim(), token: token.trim(), type: 'recovery',
  })
  if (verifyError) throw verifyError
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ── Reservations — re-exported so screens only ever import from api/ ────────
// (see reservationApi.js for the actual mock implementation + backend notes)
export {
  createReservation, getMyReservations, getReservationById, cancelReservation,
  // Payment (GCash merchant details, receipts, monthly installments)
  getPaymentSettings, getInstallmentPayments, submitMonthlyPayment,
}