// ─────────────────────────────────────────────────────────────────────────────
// RESERVATION API — frontend-only mock service for the reservation feature.
// Same shape as the rest of api/index.js: every function resolves from local
// seed data via `local()`, gated behind USE_REMOTE exactly like getBlocks(),
// getMemorials(), etc. When a real reservations table/endpoint exists, replace
// the body of each function below with the Supabase/API call — screens and
// hooks never need to change, since they only ever import from api/index.js.
//
// NOT wired to Supabase yet: this is intentionally frontend-only for now (see
// BACKEND_INTEGRATION.md). Do not read MOCK_RESERVATIONS directly from a
// screen — always go through these functions or the useMyReservations /
// useReservation hooks.
// ─────────────────────────────────────────────────────────────────────────────
import { local, USE_REMOTE } from './client'
import { supabase } from './supabaseClient'
import { MOCK_RESERVATIONS, nextReservationId } from '../data/mockReservations'
import { RESERVATION_STATUS, PAYMENT_STATUS } from '../config/reservationStatus'
import { getLotsForBlock } from '../data/lots'
import { getBlockById } from '../data/blocks'
import { STATUS, isSellable } from '../config/status'

// Row shape from Supabase (snake_case) → the shape screens already expect
// (camelCase, per BACKEND_INTEGRATION.md's data model).
function reservationFromRow(row) {
  return {
    id: row.id, userId: row.user_id, applicantName: row.applicant_name,
    email: row.email, contactNumber: row.contact_number,
    blockId: row.block_id, blockName: row.block_name, lawnName: row.lawn_name,
    lotId: row.lot_id, lotNo: row.lot_no, classification: row.classification,
    price: row.price, reservationDate: row.reservation_date,
    paymentOption: row.payment_option, notes: row.notes, status: row.status,
    receiptPath: row.receipt_path, paymentStatus: row.payment_status,
    paymentMethod: row.payment_method, installmentTerm: row.installment_term,
    downPayment: row.down_payment, mcf: row.mcf, monthlyAmount: row.monthly_amount, balance: row.balance,
    dueNowAmount: row.due_now_amount, dueNowReceivedOn: row.due_now_received_on,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

// Storage folder for receipts = the signed-in user's auth id (the bucket's
// security rule only allows uploads into your own folder).
async function receiptFolder(fallback) {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || fallback
}
// Unique file name (crypto.randomUUID only exists on HTTPS / localhost).
const uniqueName = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

// payload: { userId, applicantName, email, contactNumber, blockId, lotNo,
//            classification, price, reservationDate, paymentOption, notes,
//            receiptFile (when paid via GCash: the receipt photo, as a File/Blob),
//            paymentMethod ('cash' | 'gcash' — how an installment's amount due now is paid),
//            installmentTerm, downPayment, mcf, monthlyAmount, balance (installment only) }
export async function createReservation(payload) {
  // How the amount due now is paid: the option itself, or the client's pick for an installment.
  const method = payload.paymentOption === 'installment' ? (payload.paymentMethod || 'cash') : payload.paymentOption
  if (USE_REMOTE) {
    // GCash: upload the receipt photo first (private bucket, one folder per
    // user), then hand its path to the RPC below.
    let receiptPath = null
    if (method === 'gcash') {
      if (!payload.receiptFile) throw new Error('A GCash receipt photo is required.')
      const type = payload.receiptFile.type || 'image/jpeg'
      const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
      receiptPath = `${await receiptFolder(payload.userId)}/${uniqueName()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('payment-receipts').upload(receiptPath, payload.receiptFile, { contentType: type })
      if (uploadError) throw uploadError
    }

    // Atomic on the database side: inserts the reservation AND flips the lot
    // to 'reserve_lot' in one transaction, re-checking availability with a
    // row lock so two people can't reserve the same lot at once.
    const { data, error } = await supabase.rpc('create_reservation', {
      p_applicant_name: payload.applicantName,
      p_email: payload.email,
      p_contact_number: payload.contactNumber,
      p_block_id: payload.blockId,
      p_lot_no: Number(payload.lotNo),
      p_classification: payload.classification || null,
      p_price: payload.price ?? null,
      p_reservation_date: payload.reservationDate,
      p_payment_option: payload.paymentOption,
      p_notes: payload.notes || '',
      p_receipt_path: receiptPath,
      p_payment_method: method,
      p_installment_term: payload.installmentTerm || null,
      p_down_payment: payload.downPayment ?? null,
      p_mcf: payload.mcf ?? null,
      p_monthly_amount: payload.monthlyAmount ?? null,
      p_balance: payload.balance ?? null,
    })
    if (error) throw error
    return reservationFromRow(data)
  }

  return local(() => {
    if (method === 'gcash' && !payload.receiptFile) {
      throw new Error('A GCash receipt photo is required.')
    }
    const block = getBlockById(payload.blockId)
    const lots = getLotsForBlock(payload.blockId)
    const lot = lots.find((l) => l.lotNo === Number(payload.lotNo))

    // Frontend-only duplicate-reservation guard (see BACKEND_INTEGRATION.md —
    // the backend must re-check this server-side; this does not prevent a
    // real race between two users).
    if (!lot || !isSellable(lot.status)) {
      throw new Error('This lot is no longer available for reservation.')
    }

    const record = {
      id: nextReservationId(),
      userId: payload.userId || 'local-demo-user',
      applicantName: payload.applicantName,
      email: payload.email,
      contactNumber: payload.contactNumber,
      blockId: payload.blockId,
      blockName: block?.name || payload.blockId,
      lawnName: block?.lawnName || null,
      lotId: lot.id,
      lotNo: lot.lotNo,
      classification: payload.classification || lot.classification,
      price: payload.price ?? null,
      reservationDate: payload.reservationDate,
      paymentOption: payload.paymentOption,
      notes: payload.notes || '',
      status: RESERVATION_STATUS.PENDING,
      paymentStatus: method === 'gcash' ? PAYMENT_STATUS.PENDING_VERIFICATION : PAYMENT_STATUS.NOT_REQUIRED,
      paymentMethod: method,
      installmentTerm: payload.installmentTerm || null,
      downPayment: payload.downPayment ?? null,
      mcf: payload.mcf ?? null,
      monthlyAmount: payload.monthlyAmount ?? null,
      balance: payload.balance ?? null,
      receiptUrl: payload.receiptFile ? URL.createObjectURL(payload.receiptFile) : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    MOCK_RESERVATIONS.unshift(record)
    // Reflect the reservation on the map immediately (mock/local only — see
    // "Prevent Frontend Duplicate Reservation Attempts" in the brief). A real
    // backend would do this server-side, atomically, alongside the insert.
    lot.status = STATUS.RESERVE_LOT
    return record
  })
}

// ── GCash payment details — set by the admin in Reservations → GCash Settings ─
// Remote: the single row in public.payment_settings (see
// supabase/payment-feature.sql); the QR image is in the public "payment-qr" bucket.
// Local demo: placeholder details so the GCash flow can be tried without a backend.
export async function getPaymentSettings() {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('payment_settings').select('*').eq('id', 1).maybeSingle()
    if (error) throw error
    return {
      gcashName: data?.gcash_name || '',
      gcashNumber: data?.gcash_number || '',
      gcashInstructions: data?.gcash_instructions || '',
      // ?v= makes phones load the new QR right away after the admin replaces it.
      gcashQrUrl: data?.gcash_qr_path
        ? `${supabase.storage.from('payment-qr').getPublicUrl(data.gcash_qr_path).data.publicUrl}?v=${encodeURIComponent(data.updated_at || '')}`
        : null,
    }
  }
  return local(() => ({
    gcashName: 'Calbayog Memorial Park (demo)',
    gcashNumber: '09XX XXX XXXX',
    gcashInstructions: '',
    gcashQrUrl: null,
  }))
}

export async function getMyReservations(userId = 'local-demo-user') {
  if (USE_REMOTE) {
    const { data, error } = await supabase
      .from('reservations').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) throw error
    return data.map(reservationFromRow)
  }
  return local(() => MOCK_RESERVATIONS.filter((r) => r.userId === userId))
}

export async function getReservationById(id) {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('reservations').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? reservationFromRow(data) : null
  }
  return local(() => MOCK_RESERVATIONS.find((r) => r.id === id) || null)
}

// User-initiated cancellation (distinct from admin's updateReservationStatus —
// kept as its own function since a real backend will likely apply different
// authorization rules to "user cancels their own" vs "admin changes status").
export async function cancelReservation(id) {
  if (USE_REMOTE) {
    // Atomic: cancels the reservation AND frees the lot back to 'available'
    // in one transaction. Authorized by ownership (checked inside the RPC),
    // not by admin role — see set_reservation_status for the admin path.
    const { data, error } = await supabase.rpc('cancel_my_reservation', { p_reservation_id: id })
    if (error) throw error
    return reservationFromRow(data)
  }
  return local(() => {
    const r = MOCK_RESERVATIONS.find((x) => x.id === id)
    if (!r) return null
    r.status = RESERVATION_STATUS.CANCELLED
    r.updatedAt = new Date().toISOString()
    // Free the lot back up locally so it can be reserved again in this demo.
    const lots = getLotsForBlock(r.blockId)
    const lot = lots.find((l) => l.lotNo === r.lotNo)
    if (lot && lot.status === STATUS.RESERVE_LOT) lot.status = STATUS.AVAILABLE
    return r
  })
}

// ── Monthly installment payments ─────────────────────────────────────────────
// Remote: public.installment_payments (see supabase/payment-feature.sql). A client
// can only READ their own entries and SUBMIT a GCash payment, which stays
// "pending" until an admin verifies the receipt. Cash payments are recorded by
// the admin. Local demo: kept in memory.
const LOCAL_PAYMENTS = []

function paymentFromRow(row) {
  return {
    id: row.id, reservationId: row.reservation_id, kind: row.kind, amount: Number(row.amount),
    method: row.method, paidOn: row.paid_on, status: row.status,
    receiptPath: row.receipt_path, note: row.note, createdAt: row.created_at,
  }
}

export async function getInstallmentPayments(reservationId) {
  if (USE_REMOTE) {
    const { data, error } = await supabase
      .from('installment_payments').select('*').eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map(paymentFromRow)
  }
  return local(() => LOCAL_PAYMENTS.filter((p) => p.reservationId === reservationId))
}

// payload: { reservationId, userId, amount, receiptFile }
export async function submitMonthlyPayment(payload) {
  if (!payload.receiptFile) throw new Error('A GCash receipt photo is required.')
  if (USE_REMOTE) {
    const type = payload.receiptFile.type || 'image/jpeg'
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
    const receiptPath = `${await receiptFolder(payload.userId)}/${uniqueName()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('payment-receipts').upload(receiptPath, payload.receiptFile, { contentType: type })
    if (uploadError) throw uploadError
    const { data, error } = await supabase.rpc('submit_monthly_payment', {
      p_reservation_id: payload.reservationId, p_amount: payload.amount, p_receipt_path: receiptPath,
    })
    if (error) throw error
    return paymentFromRow(data)
  }
  return local(() => {
    const record = {
      id: `pay-${Date.now()}`, reservationId: payload.reservationId, kind: 'monthly',
      amount: Number(payload.amount), method: 'gcash', paidOn: new Date().toISOString().slice(0, 10),
      status: 'pending', receiptPath: null, note: null, createdAt: new Date().toISOString(),
    }
    LOCAL_PAYMENTS.unshift(record)
    return record
  })
}