// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS API (admin) — GCash merchant details, receipt review and monthly
// installment payments. Same tables the User-Dashboard reads/writes:
//   payment_settings      single row (id = 1): GCash name / number / instructions / QR path
//   reservations          payment_method, payment_status, receipt_path, due_now_* , installment fields
//   installment_payments  monthly payments on an installment reservation
// Storage buckets: "payment-qr" (public, the merchant QR) and
// "payment-receipts" (private, receipts uploaded by users — admins view them
// through short-lived signed URLs). See supabase/payment-feature.sql.
//
// Every write calls emitDataChange() so the Reports page and the tables
// refresh right away. A verified payment is what Reports counts as paid.
// ─────────────────────────────────────────────────────────────────────────────
import { local, USE_REMOTE, emitDataChange } from './client'
import { supabase } from './supabaseClient'
import { MOCK_RESERVATIONS } from '../data/mockReservations'

const QR_BUCKET = 'payment-qr'
const RECEIPT_BUCKET = 'payment-receipts'
const today = () => new Date().toISOString().slice(0, 10)
const round2 = (n) => Math.round(Number(n) * 100) / 100

async function mutate(fn) {
  const result = await fn()
  emitDataChange()
  return result
}

function assertChanged(data, what) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error(`The database didn't ${what}. Make sure your account's profiles.role is 'admin' and supabase/payment-feature.sql has been run.`)
  }
  return Array.isArray(data) ? data[0] : data
}

// ── Review helpers (used by the Reservations page tabs) ──────────────────────
export const CLOSED_RESERVATION = ['rejected', 'cancelled']
// GCash receipt waiting for review.
export const receiptToReview = (r) =>
  !CLOSED_RESERVATION.includes(r.status) && r.paymentMethod === 'gcash' && r.paymentStatus === 'pending_verification'
// Cash due when reserving, not yet marked as received.
export const cashToReceive = (r) =>
  !CLOSED_RESERVATION.includes(r.status) && r.paymentMethod !== 'gcash' && !r.dueNowReceivedOn
// Number for the tab badge: receipts + monthly payments waiting for review.
export const countPaymentsToReview = (reservations, installments) =>
  reservations.filter(receiptToReview).length + installments.filter((p) => p.status === 'pending').length

// Amount the client pays when reserving: full price (Cash / GCash) or
// down payment + MCF (Installment).
// Returns null when the amount isn't known (older records).
export function dueNowAmount(r) {
  if (r.dueNowAmount != null) return Number(r.dueNowAmount)
  if (r.paymentOption === 'installment') {
    return r.downPayment != null ? round2(Number(r.downPayment) + (Number(r.mcf) || 0)) : null
  }
  return r.price != null ? Number(r.price) : null
}

// ── GCash merchant settings ──────────────────────────────────────────────────
const LOCAL_SETTINGS_KEY = 'gl-admin:payment-settings'

function settingsFromRow(row) {
  return {
    gcashName: row?.gcash_name || '',
    gcashNumber: row?.gcash_number || '',
    gcashInstructions: row?.gcash_instructions || '',
    gcashQrPath: row?.gcash_qr_path || null,
    gcashQrUrl: row?.gcash_qr_path
      ? `${supabase.storage.from(QR_BUCKET).getPublicUrl(row.gcash_qr_path).data.publicUrl}?v=${encodeURIComponent(row.updated_at || '')}`
      : null,
    updatedAt: row?.updated_at || null,
  }
}

export async function getPaymentSettings() {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('payment_settings').select('*').eq('id', 1).maybeSingle()
    if (error) throw error
    return settingsFromRow(data)
  }
  return local(() => {
    try {
      return { gcashName: '', gcashNumber: '', gcashInstructions: '', gcashQrPath: null, gcashQrUrl: null, ...(JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY)) || {}) }
    } catch {
      return { gcashName: '', gcashNumber: '', gcashInstructions: '', gcashQrPath: null, gcashQrUrl: null }
    }
  })
}

// payload: { gcashName, gcashNumber, gcashInstructions }
export function savePaymentSettings(payload) {
  return mutate(async () => {
    if (USE_REMOTE) {
      const { data, error } = await supabase.from('payment_settings').upsert({
        id: 1,
        gcash_name: payload.gcashName?.trim() || null,
        gcash_number: payload.gcashNumber?.trim() || null,
        gcash_instructions: payload.gcashInstructions?.trim() || null,
      }).select()
      if (error) throw error
      return settingsFromRow(assertChanged(data, 'save the GCash details'))
    }
    return local(() => {
      const current = JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || '{}')
      const next = { ...current, ...payload }
      localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  })
}

// Uploads a new merchant QR image and points payment_settings at it.
export function uploadPaymentQr(file) {
  return mutate(async () => {
    if (!file) throw new Error('Choose an image first.')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('The QR must be a PNG, JPG or WebP image.')
    if (file.size > 5 * 1024 * 1024) throw new Error('The QR image must be under 5 MB.')
    if (!USE_REMOTE) {
      return local(() => {
        const current = JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || '{}')
        const next = { ...current, gcashQrUrl: URL.createObjectURL(file), gcashQrPath: 'local' }
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify({ ...next, gcashQrUrl: null }))
        return next
      })
    }
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `gcash-qr-${Date.now()}.${ext}`
    const { data: old } = await supabase.from('payment_settings').select('gcash_qr_path').eq('id', 1).maybeSingle()
    const { error: upErr } = await supabase.storage.from(QR_BUCKET).upload(path, file, { contentType: file.type, upsert: true })
    if (upErr) throw upErr
    const { data, error } = await supabase.from('payment_settings').upsert({ id: 1, gcash_qr_path: path }).select()
    if (error) throw error
    if (old?.gcash_qr_path && old.gcash_qr_path !== path) {
      await supabase.storage.from(QR_BUCKET).remove([old.gcash_qr_path]) // best effort
    }
    return settingsFromRow(assertChanged(data, 'save the QR image'))
  })
}

export function removePaymentQr() {
  return mutate(async () => {
    if (!USE_REMOTE) {
      return local(() => {
        const current = JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || '{}')
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify({ ...current, gcashQrPath: null, gcashQrUrl: null }))
        return true
      })
    }
    const { data: old } = await supabase.from('payment_settings').select('gcash_qr_path').eq('id', 1).maybeSingle()
    const { error } = await supabase.from('payment_settings').upsert({ id: 1, gcash_qr_path: null })
    if (error) throw error
    if (old?.gcash_qr_path) await supabase.storage.from(QR_BUCKET).remove([old.gcash_qr_path])
    return true
  })
}

// ── Receipts ─────────────────────────────────────────────────────────────────
// Receipts are private: get a 10-minute link to view one.
export async function getReceiptUrl(path) {
  if (!path) return null
  if (!USE_REMOTE) return null
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 600)
  if (error) throw error
  return data.signedUrl
}

// ── Reservation payments (amount due when reserving) ─────────────────────────
function paymentRowFromReservation(row) {
  return {
    id: row.id, userId: row.user_id, applicantName: row.applicant_name, email: row.email,
    contactNumber: row.contact_number, blockName: row.block_name, lotNo: row.lot_no,
    classification: row.classification, price: row.price, status: row.status,
    paymentOption: row.payment_option,
    paymentMethod: row.payment_method || (row.payment_option === 'gcash' ? 'gcash' : 'cash'),
    paymentStatus: row.payment_status || 'not_required',
    receiptPath: row.receipt_path,
    installmentTerm: row.installment_term, downPayment: row.down_payment, mcf: row.mcf,
    monthlyAmount: row.monthly_amount, balance: row.balance,
    dueNowAmount: row.due_now_amount, dueNowReceivedOn: row.due_now_received_on, dueNowNote: row.due_now_note,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

function installmentFromRow(row) {
  return {
    id: row.id, reservationId: row.reservation_id, userId: row.user_id, kind: row.kind,
    amount: Number(row.amount), method: row.method, paidOn: row.paid_on, status: row.status,
    receiptPath: row.receipt_path, note: row.note, recordedBy: row.recorded_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

// Everything the Payments tab needs in one call.
export async function getPaymentOverview() {
  if (USE_REMOTE) {
    const [resQ, instQ] = await Promise.all([
      supabase.from('reservations').select('*').order('created_at', { ascending: false }),
      supabase.from('installment_payments').select('*').order('created_at', { ascending: false }),
    ])
    if (resQ.error) throw resQ.error
    if (instQ.error) throw instQ.error
    return {
      reservations: (resQ.data || []).map(paymentRowFromReservation),
      installments: (instQ.data || []).map(installmentFromRow),
    }
  }
  return local(() => ({
    reservations: MOCK_RESERVATIONS.map((r) => ({
      ...r,
      paymentMethod: r.paymentMethod || (r.paymentOption === 'gcash' ? 'gcash' : 'cash'),
      paymentStatus: r.paymentStatus || (r.paymentOption === 'gcash' ? 'pending_verification' : 'not_required'),
    })),
    installments: [],
  }))
}

// GCash receipt for the amount due when reserving: 'verified' | 'rejected'.
// Verifying records the money as received today, so it appears in Reports.
export function setReservationPaymentStatus(r, status, note = '') {
  return mutate(async () => {
    if (!['verified', 'rejected', 'pending_verification'].includes(status)) throw new Error('Unknown payment status.')
    const patch = { payment_status: status }
    if (status === 'verified') {
      patch.due_now_received_on = r.dueNowReceivedOn || today()
      patch.due_now_amount = dueNowAmount(r)
      if (note) patch.due_now_note = note
    } else {
      patch.due_now_received_on = null
      patch.due_now_note = note || null
    }
    if (USE_REMOTE) {
      const { data, error } = await supabase.from('reservations').update(patch).eq('id', r.id).select('id')
      if (error) throw error
      return assertChanged(data, 'update this payment')
    }
    return local(() => {
      const rec = MOCK_RESERVATIONS.find((x) => x.id === r.id)
      if (rec) Object.assign(rec, { paymentStatus: status, dueNowReceivedOn: patch.due_now_received_on, dueNowAmount: patch.due_now_amount ?? rec.dueNowAmount })
      return rec
    })
  })
}

// Cash paid at the office: mark the amount due when reserving as received.
// payload: { receivedOn, amount, note }
export function markDueNowReceived(r, payload = {}) {
  return mutate(async () => {
    const amount = round2(payload.amount ?? dueNowAmount(r) ?? 0)
    if (!(amount > 0)) throw new Error('Enter the amount received.')
    const patch = {
      due_now_received_on: payload.receivedOn || today(),
      due_now_amount: amount,
      due_now_note: payload.note?.trim() || null,
    }
    if (USE_REMOTE) {
      const { data, error } = await supabase.from('reservations').update(patch).eq('id', r.id).select('id')
      if (error) throw error
      return assertChanged(data, 'record this payment')
    }
    return local(() => {
      const rec = MOCK_RESERVATIONS.find((x) => x.id === r.id)
      if (rec) Object.assign(rec, { dueNowReceivedOn: patch.due_now_received_on, dueNowAmount: amount, dueNowNote: patch.due_now_note })
      return rec
    })
  })
}

// Undo a cash receipt recorded by mistake.
export function clearDueNowReceived(r) {
  return mutate(async () => {
    if (USE_REMOTE) {
      const { data, error } = await supabase.from('reservations')
        .update({ due_now_received_on: null, due_now_note: null }).eq('id', r.id).select('id')
      if (error) throw error
      return assertChanged(data, 'undo this payment')
    }
    return local(() => {
      const rec = MOCK_RESERVATIONS.find((x) => x.id === r.id)
      if (rec) rec.dueNowReceivedOn = null
      return rec
    })
  })
}

// ── Monthly installment payments ─────────────────────────────────────────────
// status: 'verified' | 'rejected' | 'voided' | 'pending'
export function setInstallmentPaymentStatus(id, status, note) {
  return mutate(async () => {
    if (!['verified', 'rejected', 'voided', 'pending'].includes(status)) throw new Error('Unknown payment status.')
    if (USE_REMOTE) {
      const patch = { status }
      if (note !== undefined) patch.note = note || null
      const { data, error } = await supabase.from('installment_payments').update(patch).eq('id', id).select('id')
      if (error) throw error
      return assertChanged(data, 'update this monthly payment')
    }
    return local(() => ({ id, status }))
  })
}

// Admin records a payment made at the office (counts as verified right away).
// payload: { reservation, amount, method, paidOn, note, kind }
export function recordInstallmentPayment(payload) {
  return mutate(async () => {
    const r = payload.reservation
    const amount = round2(payload.amount)
    if (!r) throw new Error('Choose the reservation this payment is for.')
    if (!(amount > 0) && payload.kind !== 'adjustment') throw new Error('Enter the amount paid.')
    if (USE_REMOTE) {
      const { data: auth } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('installment_payments').insert({
        reservation_id: r.id,
        user_id: r.userId,
        kind: payload.kind || 'monthly',
        amount,
        method: payload.method || 'cash',
        paid_on: payload.paidOn || today(),
        status: 'verified',
        note: payload.note?.trim() || null,
        recorded_by: auth?.user?.id || null,
      }).select()
      if (error) throw error
      return installmentFromRow(assertChanged(data, 'record this monthly payment'))
    }
    return local(() => ({ id: `pay-${Date.now()}`, reservationId: r.id, amount, status: 'verified' }))
  })
}

// Same formula as the User-Dashboard's summarizeInstallment(): the monthly
// amount already includes interest, so total owed = monthly × months.
const TERM_MONTHS = { '1yr': 12, '2yr': 24, '3yr': 36 }
export function installmentProgress(r, installments = []) {
  const months = TERM_MONTHS[r.installmentTerm] || 0
  const monthly = Number(r.monthlyAmount) || 0
  const mine = installments.filter((p) => p.reservationId === r.id)
  const paid = round2(mine.filter((p) => p.status === 'verified').reduce((s, p) => s + p.amount, 0))
  const owed = round2(monthly * months)
  return {
    months, monthly, owed, paid,
    left: Math.max(0, round2(owed - paid)),
    monthsCovered: monthly > 0 ? Math.min(months, Math.floor((paid + 0.005) / monthly)) : 0,
    pending: mine.filter((p) => p.status === 'pending').length,
  }
}