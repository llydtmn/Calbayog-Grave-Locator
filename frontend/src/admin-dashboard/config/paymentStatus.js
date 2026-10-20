// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT STATUSES (admin) — kept identical to the User-Dashboard's
// config/reservationStatus.js so both apps show the same labels.
// ─────────────────────────────────────────────────────────────────────────────

// GCash receipt for the amount due when reserving (reservations.payment_status).
export const PAYMENT_STATUS = {
  NOT_REQUIRED:         'not_required',
  PENDING_VERIFICATION: 'pending_verification',
  VERIFIED:             'verified',
  REJECTED:             'rejected',
}

export const PAYMENT_STATUS_META = {
  [PAYMENT_STATUS.NOT_REQUIRED]:         { label: 'No receipt (cash)',    badge: 'badge-cancelled' },
  [PAYMENT_STATUS.PENDING_VERIFICATION]: { label: 'Receipt to review',    badge: 'badge-pending' },
  [PAYMENT_STATUS.VERIFIED]:             { label: 'Payment verified',     badge: 'badge-confirmed' },
  [PAYMENT_STATUS.REJECTED]:             { label: 'Receipt rejected',     badge: 'badge-rejected' },
}
export const paymentStatusMeta = (s) => PAYMENT_STATUS_META[s] || PAYMENT_STATUS_META[PAYMENT_STATUS.NOT_REQUIRED]

// Monthly installment payments (installment_payments.status).
export const INSTALLMENT_PAYMENT_STATUS_META = {
  pending:  { label: 'To review', badge: 'badge-pending' },
  verified: { label: 'Verified',  badge: 'badge-confirmed' },
  rejected: { label: 'Rejected',  badge: 'badge-rejected' },
  voided:   { label: 'Voided',    badge: 'badge-cancelled' },
}

export const PAYMENT_OPTION_LABEL = { cash: 'Cash', installment: 'Installment', gcash: 'GCash' }
export const PAYMENT_METHOD_LABEL = { cash: 'Cash', gcash: 'GCash' }
export const INSTALLMENT_TERM_LABEL = { '1yr': '1 year', '2yr': '2 years', '3yr': '3 years' }