import { useState } from 'react'
import { useReservations, usePaymentOverview } from '../hooks'
import { useAdmin } from '../context/AdminContext'
import { RESERVATION_STATUS, RESERVATION_STATUS_META } from '../config/adminStatus'
import { PAYMENT_STATUS, paymentStatusMeta, PAYMENT_OPTION_LABEL } from '../config/paymentStatus'
import { formatDate } from '../utils/date'
import { peso } from '../utils/format'
import { PaymentReviewTab, GcashSettingsTab } from './PaymentsTab'
import { countPaymentsToReview } from '../api/paymentsApi'
import * as api from '../api'

const STATUS_FILTERS = ['all', ...Object.values(RESERVATION_STATUS)]
const TABS = [
  { id: 'reservations', label: 'Reservations' },
  { id: 'payments', label: 'Payments to Review' },
  { id: 'gcash', label: 'GCash Settings' },
]

export default function ReservationsPage() {
  const { reservations, loading } = useReservations()
  const { paymentReservations, installments } = usePaymentOverview()
  const { openModal, runAction, confirmAction } = useAdmin()
  const [tab, setTab] = useState('reservations')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  // Payment fields (method / receipt status / received) for each reservation.
  const payById = Object.fromEntries(paymentReservations.map((p) => [p.id, p]))
  const withPayment = (r) => {
    const p = payById[r.id]
    return p ? { ...r, paymentMethod: p.paymentMethod, paymentStatus: p.paymentStatus, dueNowReceivedOn: p.dueNowReceivedOn, installmentTerm: p.installmentTerm } : r
  }
  const toReview = countPaymentsToReview(paymentReservations, installments)

  const filtered = reservations.filter((r) => {
    const matchesStatus = status === 'all' || r.status === status
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || `${r.applicantName} ${r.email} ${r.blockName} ${r.lotNo}`.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const setReservationStatus = (id, next) =>
    runAction(() => api.updateReservationStatus(id, next), `${id} ${RESERVATION_STATUS_META[next].label.toLowerCase()}.`)

  // Confirming a GCash reservation whose receipt isn't verified yet asks first.
  const confirmReservation = (r) => {
    const p = payById[r.id]
    if (p?.paymentMethod === 'gcash' && p.paymentStatus !== PAYMENT_STATUS.VERIFIED) {
      confirmAction({
        title: 'Receipt not verified yet',
        message: `${r.applicantName}'s GCash receipt hasn't been verified. Confirm the reservation anyway? (Verify it under "Payments to Review".)`,
        confirmLabel: 'Confirm anyway',
        successMessage: `${r.id} confirmed.`,
        onConfirm: () => api.updateReservationStatus(r.id, RESERVATION_STATUS.CONFIRMED),
      })
      return
    }
    setReservationStatus(r.id, RESERVATION_STATUS.CONFIRMED)
  }

  const deleteReservation = (r) => confirmAction({
    title: 'Delete reservation?',
    message: `${r.id} for ${r.applicantName} (${r.blockName} · Lot ${r.lotNo}) will be removed permanently.`,
    confirmLabel: 'Delete',
    successMessage: `${r.id} deleted.`,
    onConfirm: () => api.deleteReservation(r.id),
  })

  const paymentCell = (r) => {
    const p = payById[r.id]
    if (!p) return <span className="pay-sub">{PAYMENT_OPTION_LABEL[r.paymentOption] || '—'}</span>
    if (p.paymentMethod === 'gcash') {
      const meta = paymentStatusMeta(p.paymentStatus)
      return <span className={`badge ${meta.badge}`}>GCash · {meta.label}</span>
    }
    return p.dueNowReceivedOn
      ? <span className="badge badge-confirmed">Cash · received</span>
      : <span className="badge badge-inactive">Cash · not yet paid</span>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Reservation Management</h2>
          <p>Review lot reservations, verify payments, and set the GCash details users pay to.</p>
        </div>
      </div>

      <div className="pay-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`pay-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'payments' && toReview > 0 && <span className="pay-tab-count">{toReview}</span>}
          </button>
        ))}
      </div>

      {tab === 'payments' && <PaymentReviewTab />}
      {tab === 'gcash' && <GcashSettingsTab />}

      {tab === 'reservations' && (
        <>
          <div className="filter-bar">
            <input className="filter-input" placeholder="Search by applicant, email, or lot…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
            <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All Statuses' : RESERVATION_STATUS_META[s].label}</option>
              ))}
            </select>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table className="res-table">
                <thead>
                  <tr>
                    <th>Reservation ID</th><th>Applicant</th><th>Email</th><th>Contact</th>
                    <th>Block</th><th>Lawn</th><th>Lot</th><th>Classification</th>
                    <th>Price</th><th>Option</th><th>Payment</th><th>Reservation Date</th><th>Submitted</th><th>Status</th><th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && filtered.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, color: 'var(--sage)' }}>{r.id}</td>
                      <td style={{ fontWeight: 600 }}>{r.applicantName}</td>
                      <td>{r.email}</td>
                      <td>{r.contactNumber}</td>
                      <td>{r.blockName}</td>
                      <td>{r.lawnName || '—'}</td>
                      <td>{r.lotNo}</td>
                      <td>{r.classification}</td>
                      <td>{peso(r.price)}</td>
                      <td>{PAYMENT_OPTION_LABEL[r.paymentOption] || r.paymentOption || '—'}</td>
                      <td>{paymentCell(r)}</td>
                      <td>{r.reservationDate}</td>
                      <td>{formatDate(r.createdAt?.slice(0, 10))}</td>
                      <td><span className={`badge ${RESERVATION_STATUS_META[r.status].badge}`}>{RESERVATION_STATUS_META[r.status].label}</span></td>
                      <td className="col-actions"><div className="action-cell">
                        <button className="btn btn-ghost btn-xs" onClick={() => openModal('modal-reservation-detail', withPayment(r))}>Details</button>
                        {r.status === RESERVATION_STATUS.PENDING && (
                          <>
                            <button className="btn btn-primary btn-xs" onClick={() => confirmReservation(r)}>Confirm</button>
                            <button className="btn btn-danger btn-xs" onClick={() => setReservationStatus(r.id, RESERVATION_STATUS.REJECTED)}>Reject</button>
                          </>
                        )}
                        {r.status === RESERVATION_STATUS.CONFIRMED && (
                          <button className="btn btn-danger btn-xs" onClick={() => setReservationStatus(r.id, RESERVATION_STATUS.CANCELLED)}>Cancel</button>
                        )}
                        <button className="btn btn-danger btn-xs" onClick={() => deleteReservation(r)} aria-label={`Delete ${r.id}`}>Delete</button>
                      </div></td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={15} style={{ textAlign: 'center', color: 'var(--dgray)', padding: 24 }}>No reservations match this search/filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}