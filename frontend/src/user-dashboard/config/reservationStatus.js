// ─────────────────────────────────────────────────────────────────────────────
// RESERVATION STATUS TAXONOMY — business-process state for a reservation
// record. Distinct from config/status.js, which describes a lot's physical
// state on the map (available/sold/reserve_lot/etc). A reservation's status
// changes independently of (but eventually drives) the underlying lot status.
// ─────────────────────────────────────────────────────────────────────────────

export const RESERVATION_STATUS = {
  PENDING:   'pending',
  CONFIRMED: 'confirmed',
  REJECTED:  'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
}

export const RESERVATION_STATUS_META = {
  [RESERVATION_STATUS.PENDING]:   { label: 'Pending',   badge: 'badge-pending' },
  [RESERVATION_STATUS.CONFIRMED]: { label: 'Confirmed', badge: 'badge-confirmed' },
  [RESERVATION_STATUS.REJECTED]:  { label: 'Rejected',  badge: 'badge-rejected' },
  [RESERVATION_STATUS.CANCELLED]: { label: 'Cancelled', badge: 'badge-cancelled' },
  [RESERVATION_STATUS.COMPLETED]: { label: 'Completed', badge: 'badge-completed' },
}

export const reservationStatusLabel = (s) => (RESERVATION_STATUS_META[s] || RESERVATION_STATUS_META[RESERVATION_STATUS.PENDING]).label
export const reservationStatusBadge = (s) => (RESERVATION_STATUS_META[s] || RESERVATION_STATUS_META[RESERVATION_STATUS.PENDING]).badge

// Payment options offered on the reservation form (frontend-only; the real
// billing/installment plan is set up by the office once the backend exists).
export const PAYMENT_OPTIONS = [
  { id: 'cash',        label: 'Cash' },
  { id: 'installment', label: 'Installment' },
  { id: 'gcash',       label: 'GCash' },
]

// How the amount due now is paid. For the Cash / GCash options it is the option
// itself; for Installment the client picks one of these for the down payment + MCF.
export const PAYMENT_METHODS = [
  { id: 'cash',  label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
]

// Installment terms offered on the price list (monthly figures come from data/pricing.js).
export const INSTALLMENT_TERMS = [
  { id: '1yr', label: '1 year',  months: 12 },
  { id: '2yr', label: '2 years', months: 24 },
  { id: '3yr', label: '3 years', months: 36 },
]

// True when this reservation's amount due now is paid through GCash (and so has a
// receipt to review). Falls back to paymentOption for records without paymentMethod.
export const usesGcash = (r) => (r.paymentMethod || r.paymentOption) === 'gcash'

// ── Monthly installment payments ─────────────────────────────────────────────
export const INSTALLMENT_PAYMENT_STATUS_META = {
  pending:  { label: 'Under review', badge: 'badge-pending' },
  verified: { label: 'Verified',     badge: 'badge-confirmed' },
  rejected: { label: 'Rejected',     badge: 'badge-rejected' },
  voided:   { label: 'Voided',       badge: 'badge-cancelled' },
}

const TERM_MONTHS = { '1yr': 12, '2yr': 24, '3yr': 36 }
const round2 = (n) => Math.round(n * 100) / 100

// Progress of an installment. The monthly amount already includes the interest,
// so "total left to pay" = monthly × months − verified payments (NOT the
// principal "balance" from the price list). Keep identical to the admin app.
export function summarizeInstallment(r, payments = []) {
  const months = TERM_MONTHS[r.installmentTerm] || 0
  const monthly = Number(r.monthlyAmount) || 0
  const sum = (status) => round2(payments.filter((p) => p.status === status).reduce((s, p) => s + Number(p.amount), 0))
  const totalOwed = round2(monthly * months)
  const totalPaid = sum('verified')
  const totalLeft = Math.max(0, round2(totalOwed - totalPaid))
  return {
    months, monthly, totalOwed, totalPaid, totalLeft,
    pendingAmount: sum('pending'),
    monthsCovered: monthly > 0 ? Math.min(months, Math.floor((totalPaid + 0.005) / monthly)) : 0,
    nextDue: Math.min(monthly, totalLeft),
  }
}

// GCash receipt review state. Only meaningful when paymentOption === 'gcash'
// (cash reservations are 'not_required'). The office verifies the uploaded
// receipt photo before a GCash reservation can be confirmed.
export const PAYMENT_STATUS = {
  NOT_REQUIRED:         'not_required',
  PENDING_VERIFICATION: 'pending_verification',
  VERIFIED:             'verified',
  REJECTED:             'rejected',
}

export const PAYMENT_STATUS_META = {
  [PAYMENT_STATUS.NOT_REQUIRED]:         { label: 'No receipt needed',    badge: 'badge-cancelled' },
  [PAYMENT_STATUS.PENDING_VERIFICATION]: { label: 'Receipt under review', badge: 'badge-pending' },
  [PAYMENT_STATUS.VERIFIED]:             { label: 'Payment verified',     badge: 'badge-confirmed' },
  [PAYMENT_STATUS.REJECTED]:             { label: 'Receipt rejected',     badge: 'badge-rejected' },
}

export const paymentStatusLabel = (s) => (PAYMENT_STATUS_META[s] || PAYMENT_STATUS_META[PAYMENT_STATUS.PENDING_VERIFICATION]).label
export const paymentStatusBadge = (s) => (PAYMENT_STATUS_META[s] || PAYMENT_STATUS_META[PAYMENT_STATUS.PENDING_VERIFICATION]).badge