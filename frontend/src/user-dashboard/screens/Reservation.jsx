// ─────────────────────────────────────────────────────────────────────────────
// RESERVATION SCREENS — Reserve Lot → Form → Summary → Confirm → Success →
// My Reservations → Reservation Detail. Frontend-only: everything here talks
// to api/reservationApi.js (mock/local data), never to Supabase directly. See
// BACKEND_INTEGRATION.md for what a backend developer needs to change.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import BottomNav from '../components/BottomNav'
import { useApp } from '../context/AppContext'
import { useMyReservations, useReservation, usePricing, usePaymentSettings, useInstallmentPayments } from '../hooks'
import { ENV } from '../config/constants'
import { PAYMENT_OPTIONS, reservationStatusLabel, reservationStatusBadge, RESERVATION_STATUS, paymentStatusLabel, paymentStatusBadge, PAYMENT_METHODS, INSTALLMENT_TERMS, usesGcash, summarizeInstallment, INSTALLMENT_PAYMENT_STATUS_META } from '../config/reservationStatus'
import { peso, percent } from '../utils/format'
import { compressReceipt, isReceiptImage, RECEIPT_MAX_MB } from '../utils/image'
import * as api from '../api'
import {
  useValidation, hasErrors, FieldError, invalidStyle, todayISO,
  nameError, emailError, phoneError, textError, amountError, onlyPhoneChars, onlyDecimal,
} from '../utils/validation'

const BackHeader = ({ title, sub, onBack }) => (
  <div className="hdr hdr-row" style={{ flexShrink: 0 }}>
    <button className="back-btn" onClick={onBack} aria-label="Back">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <div>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {sub && <p className="f12" style={{ margin: 0, color: 'rgba(255,255,255,.75)' }}>{sub}</p>}
    </div>
  </div>
)

// ── InstallmentCard ──────────────────────────────────────────────────────────
// Shows what an installment costs: what is due now (down payment + MCF) and the
// monthly amount after that. Used on the form, the summary and the detail screen.
// i: { term, downPayment, mcf, monthly, balance, interestRate? }
function InstallmentCard({ title = 'Installment Plan', i, method }) {
  const dueNow = Number(i.downPayment) + Number(i.mcf)
  const term = INSTALLMENT_TERMS.find((t) => t.id === i.term)
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <p className="section-label" style={{ margin: '0 0 10px' }}>{title}</p>
      {[
        ['Term', term ? `${term.label} (${term.months} months)` : i.term],
        ['Down payment (30%)', peso(i.downPayment)],
        ['MCF (Memorial Care Fund)', peso(i.mcf)],
        ['Due now', peso(dueNow)],
        ['Monthly payment', `${peso(i.monthly)} × ${term ? term.months : '—'} months`],
        ['Balance before interest', peso(i.balance)],
        ['Total of monthly payments', term ? peso(Number(i.monthly) * term.months) : '—'],
        ...(method ? [['Due now paid via', PAYMENT_METHODS.find((m) => m.id === method)?.label || method]] : []),
      ].map(([l, v]) => (
        <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
      ))}
      {i.interestRate != null && (
        <p className="f11 c-stone" style={{ margin: '8px 0 0' }}>Monthly amounts already include {percent(i.interestRate)} yearly interest.</p>
      )}
    </div>
  )
}

// ── ReserveFormScreen ────────────────────────────────────────────────────────
// Reached from PlotDetailScreen with context.activeLot already set. Lot info
// (block/lawn/lot no./classification/price) is auto-filled and read-only —
// the applicant only fills in what the lot itself can't supply.
export function ReserveFormScreen({ onNavigate, onBack }) {
  const { activeLot, user, setReservationDraft } = useApp()
  const { pricing } = usePricing()
  const { paymentSettings, loading: paymentLoading } = usePaymentSettings()
  // GCash is only offered once the admin has saved a number or QR code.
  const gcashReady = !!(paymentSettings && (paymentSettings.gcashNumber || paymentSettings.gcashQrUrl))

  const lot = activeLot || { blockId: 'block-3', blockName: 'Block 3', lawnName: 'Timeless Memory Lawn', lotNo: 45, classification: 'Premium' }
  const price = pricing?.installment?.[lot.classification]?.totalPrice ?? null

  const [applicantName, setApplicantName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [contactNumber, setContactNumber] = useState(user?.phone || '')
  const [reservationDate, setReservationDate] = useState('')
  const [paymentOption, setPaymentOption] = useState(PAYMENT_OPTIONS[0].id)
  const [paymentMethod, setPaymentMethod] = useState('cash') // installment only: how the amount due now is paid
  const [installmentTerm, setInstallmentTerm] = useState(INSTALLMENT_TERMS[0].id)
  const [notes, setNotes] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState('')
  const [error, setError] = useState('')
  const { touch, setTried, shown } = useValidation()

  const today = todayISO()
  const errors = {
    applicantName: nameError(applicantName, { label: 'Full name' }),
    email: emailError(email),
    contactNumber: phoneError(contactNumber, { label: 'Contact number', required: true }),
    reservationDate: !reservationDate ? 'Choose your preferred date.'
      : !/^\d{4}-\d{2}-\d{2}$/.test(reservationDate) ? 'Enter a valid date.'
      : reservationDate < today ? 'Choose today or a later date.' : '',
    notes: textError(notes, { label: 'Notes', max: 500 }),
  }
  const err = shown(errors)

  // Installment: the amounts come straight from the price list for this lot + term.
  const plan = pricing?.installment?.[lot.classification] || null
  const installment = paymentOption === 'installment' && plan ? {
    term: installmentTerm, downPayment: plan.downPayment30, mcf: plan.mcf,
    monthly: plan.monthly[installmentTerm], balance: plan.balance,
    interestRate: pricing?.interest?.[installmentTerm] ?? null,
  } : null
  // How the amount due now is paid: the option itself, or the pick for an installment.
  const method = paymentOption === 'installment' ? paymentMethod : paymentOption
  const amountDueNow = installment ? installment.downPayment + installment.mcf : price

  // Downloads the QR so it can be scanned from the GCash app's gallery option.
  async function saveQr() {
    const url = paymentSettings?.gcashQrUrl
    if (!url) return
    try {
      const res = await fetch(url)
      const href = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = href
      a.download = 'gcash-qr.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
    } catch {
      window.open(url, '_blank')
    }
  }

  async function handleReceipt(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!isReceiptImage(file)) {
      setError(`Please choose a photo (JPG, PNG or WebP) under ${RECEIPT_MAX_MB} MB.`)
      e.target.value = ''
      return
    }
    setError('')
    const blob = await compressReceipt(file)
    if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    setReceiptFile(blob)
    setReceiptPreview(URL.createObjectURL(blob))
  }

  function handleContinue() {
    setTried(true)
    if (hasErrors(errors)) { setError('Please fix the highlighted fields.'); return }
    setError('')
    if (paymentOption === 'installment' && !installment) { setError("Installment details aren't available for this lot. Please choose another payment option."); return }
    if (method === 'gcash' && !receiptFile) { setError('Please upload a photo of your GCash receipt.'); return }
    setReservationDraft({
      applicantName: applicantName.trim(), email: email.trim().toLowerCase(), contactNumber: contactNumber.trim(),
      blockId: lot.blockId, blockName: lot.blockName, lawnName: lot.lawnName,
      lotNo: lot.lotNo, classification: lot.classification, price,
      reservationDate, paymentOption, notes: notes.trim(),
      paymentMethod: method, installment,
      receiptFile: method === 'gcash' ? receiptFile : null,
      receiptPreview: method === 'gcash' ? receiptPreview : '',
    })
    onNavigate('reserve-summary')
  }

  return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <BackHeader title="Reservation Form" sub={`${lot.blockName} · Lot ${lot.lotNo}`} onBack={() => onBack('plotdetail', { activeLot: lot })} />
      <div className="form-wrap">
        <p className="section-label" style={{ marginBottom: 10 }}>Cemetery Lot</p>
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="info-grid">
            {[
              ['Block', lot.blockName],
              ['Lawn', lot.lawnName || '—'],
              ['Lot No.', lot.lotNo],
              ['Classification', lot.classification],
              ['Price', price != null ? peso(price) : '—'],
            ].map(([l, v]) => (
              <div key={l} className="info-cell"><div className="info-lbl">{l}</div><div className="info-val">{v}</div></div>
            ))}
          </div>
        </div>

        <p className="section-label" style={{ marginBottom: 10 }}>Applicant Information</p>
        <div className="field">
          <label className="lbl">Full Name</label>
          <input className="inp" maxLength={100} value={applicantName} onChange={(e) => setApplicantName(e.target.value)} onBlur={touch('applicantName')} placeholder="Full name" style={invalidStyle(err('applicantName'))} />
          <FieldError msg={err('applicantName')} />
        </div>
        <div className="field">
          <label className="lbl">Email</label>
          <input className="inp" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={touch('email')} placeholder="you@email.com" style={invalidStyle(err('email'))} />
          <FieldError msg={err('email')} />
        </div>
        <div className="field">
          <label className="lbl">Contact Number</label>
          <input className="inp" inputMode="tel" value={contactNumber} onChange={(e) => setContactNumber(onlyPhoneChars(e.target.value))} onBlur={touch('contactNumber')} placeholder="0917 123 4567" style={invalidStyle(err('contactNumber'))} />
          <FieldError msg={err('contactNumber')} />
        </div>

        <p className="section-label" style={{ marginBottom: 10 }}>Reservation Details</p>
        <div className="field">
          <label className="lbl">Preferred Reservation Date</label>
          <input className="inp" type="date" min={today} value={reservationDate} onChange={(e) => setReservationDate(e.target.value)} onBlur={touch('reservationDate')} style={invalidStyle(err('reservationDate'))} />
          <FieldError msg={err('reservationDate')} />
        </div>
        <div className="field">
          <label className="lbl">Payment Option</label>
          <div className="pay-opts">
            {PAYMENT_OPTIONS.map((p) => (
              <div key={p.id} className={`pay-opt${paymentOption === p.id ? ' active' : ''}`} style={p.id === 'gcash' && !gcashReady ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={() => { if (p.id === 'gcash' && !gcashReady) return; setPaymentOption(p.id) }}>{p.label}</div>
            ))}
          </div>
          {!paymentLoading && !gcashReady && (
            <p className="f11 c-stone" style={{ margin: '6px 0 0' }}>GCash payment isn't available yet. Please choose Cash, or contact the park office.</p>
          )}
        </div>
        {paymentOption === 'installment' && (
          <>
            <div className="field">
              <label className="lbl">Installment Term</label>
              <div className="pay-opts">
                {INSTALLMENT_TERMS.map((t) => (
                  <div key={t.id} className={`pay-opt${installmentTerm === t.id ? ' active' : ''}`} onClick={() => setInstallmentTerm(t.id)}>{t.label}</div>
                ))}
              </div>
            </div>
            {installment && <InstallmentCard title="Installment Breakdown" i={installment} />}
            <div className="field">
              <label className="lbl">Pay the amount due now via</label>
              <div className="pay-opts">
                {PAYMENT_METHODS.map((m) => (
                  <div key={m.id} className={`pay-opt${paymentMethod === m.id ? ' active' : ''}`} style={m.id === 'gcash' && !gcashReady ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={() => { if (m.id === 'gcash' && !gcashReady) return; setPaymentMethod(m.id) }}>{m.label}</div>
                ))}
              </div>
              {!paymentLoading && !gcashReady && (
                <p className="f11 c-stone" style={{ margin: '6px 0 0' }}>GCash payment isn't available yet. Please choose Cash, or contact the park office.</p>
              )}
            </div>
          </>
        )}
        {method === 'gcash' && gcashReady && (
          <div className="card" style={{ marginBottom: 18 }}>
            <p className="section-label" style={{ margin: '0 0 10px' }}>Pay via GCash</p>
            {paymentSettings.gcashQrUrl && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <img src={paymentSettings.gcashQrUrl} alt="GCash QR code" style={{ width: '100%', maxWidth: 220, borderRadius: 10, border: '1px solid var(--lgray)', background: '#fff' }} />
                <div><button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={saveQr}>Save QR</button></div>
              </div>
            )}
            {[
              [installment ? 'Amount to send (due now)' : 'Amount to send', amountDueNow != null ? peso(amountDueNow) : '—'],
              ['Account Name', paymentSettings.gcashName || '—'],
              ['GCash Number', paymentSettings.gcashNumber || '—'],
            ].map(([l, v]) => (
              <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
            ))}
            {paymentSettings.gcashInstructions && (
              <p className="f12 c-stone" style={{ margin: '10px 0 0' }}>{paymentSettings.gcashInstructions}</p>
            )}
          </div>
        )}
        {method === 'gcash' && (
          <div className="field">
            <label className="lbl">GCash Receipt Photo</label>
            <input className="inp" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleReceipt} />
            {receiptPreview && (
              <img src={receiptPreview} alt="GCash receipt preview" style={{ marginTop: 10, width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--lgray)', background: '#fff' }} />
            )}
            <p className="f11 c-stone" style={{ margin: '6px 0 0' }}>After sending your payment, upload a clear photo of the receipt. The office will verify it before confirming your reservation.</p>
          </div>
        )}
        <div className="field mb-20">
          <label className="lbl">Additional Notes (optional)</label>
          <textarea className="inp" rows="3" maxLength={500} placeholder="Anything the office should know…" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={touch('notes')} style={invalidStyle(err('notes'))} />
          <FieldError msg={err('notes')} />
        </div>

        {error && <p style={{ color: '#DC2626', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
        <button className="btn btn-primary btn-full" onClick={handleContinue}>Review Reservation</button>
      </div>
    </div>
  )
}

// ── ReserveSummaryScreen ─────────────────────────────────────────────────────
export function ReserveSummaryScreen({ onNavigate, onBack }) {
  const { reservationDraft, user, setActiveReservationId } = useApp()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const d = reservationDraft
  useEffect(() => {
    if (!d) onNavigate('map', {}, { replace: true })
  }, [d, onNavigate])

  if (!d) return null

  async function handleConfirm() {
    if (submitting) return // prevent double-click submissions
    setSubmitting(true)
    setError('')
    try {
      const record = await api.createReservation({
        userId: user?.id || 'local-demo-user',
        applicantName: d.applicantName, email: d.email, contactNumber: d.contactNumber,
        blockId: d.blockId, lotNo: d.lotNo, classification: d.classification, price: d.price,
        reservationDate: d.reservationDate, paymentOption: d.paymentOption, notes: d.notes,
        receiptFile: d.receiptFile,
        paymentMethod: d.paymentMethod,
        installmentTerm: d.installment?.term, downPayment: d.installment?.downPayment, mcf: d.installment?.mcf,
        monthlyAmount: d.installment?.monthly, balance: d.installment?.balance,
      })
      setActiveReservationId(record.id)
      onNavigate('reserve-success')
    } catch (err) {
      setError(err.message || 'Could not submit this reservation. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <BackHeader title="Reservation Summary" onBack={() => onBack('reserve-form')} />
      <div className="form-wrap">
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="section-label" style={{ margin: '0 0 10px' }}>Applicant</p>
          {[['Name', d.applicantName], ['Email', d.email], ['Contact Number', d.contactNumber]].map(([l, v]) => (
            <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
          ))}
        </div>
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="section-label" style={{ margin: '0 0 10px' }}>Cemetery Lot</p>
          {[['Block', d.blockName], ['Lawn', d.lawnName || '—'], ['Lot Number', d.lotNo], ['Classification', d.classification]].map(([l, v]) => (
            <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
          ))}
        </div>
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="section-label" style={{ margin: '0 0 10px' }}>Reservation</p>
          {[
            ['Reservation Date', d.reservationDate],
            ['Price', d.price != null ? peso(d.price) : '—'],
            ['Payment Option', PAYMENT_OPTIONS.find((p) => p.id === d.paymentOption)?.label || d.paymentOption],
            ['Notes', d.notes || '—'],
          ].map(([l, v]) => (
            <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
          ))}
        </div>

        {d.installment && <InstallmentCard i={d.installment} method={d.paymentMethod} />}

        {d.receiptPreview && (
          <div className="card" style={{ marginBottom: 14 }}>
            <p className="section-label" style={{ margin: '0 0 10px' }}>GCash Receipt</p>
            <img src={d.receiptPreview} alt="GCash receipt" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 8 }} />
          </div>
        )}

        {!ENV.USE_REMOTE && (
          <div className="warn-box" style={{ marginBottom: 16 }}>
            <p className="warn-txt">This is a frontend demo only — confirming below does not submit to a real database yet. The park office will contact you to finalize a real reservation.</p>
          </div>
        )}

        {error && <p style={{ color: '#DC2626', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
        <div className="plot-actions">
          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => onBack('reserve-form')} disabled={submitting}>Back</button>
          <button className="btn btn-primary btn-sm" style={{ flex: 2 }} onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Confirm Reservation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ReserveSuccessScreen ─────────────────────────────────────────────────────
export function ReserveSuccessScreen({ onNavigate }) {
  const { activeReservationId } = useApp()
  return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <div className="success-wrap">
        <div className="success-icon" style={{ background: 'var(--pgreen)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ fontFamily: 'var(--ff-d)', textAlign: 'center', margin: '0 0 8px' }}>Reservation Submitted</h2>
        <p className="f13 c-stone" style={{ textAlign: 'center', maxWidth: 280, margin: '0 0 20px' }}>
          Your reservation is now pending review.{!ENV.USE_REMOTE && ' This is a frontend demo — no data has been sent to a real database yet.'}
        </p>
        {activeReservationId && (
          <div className="ref-box">
            <p className="f11 c-stone" style={{ margin: '0 0 2px', textAlign: 'center' }}>Reference No.</p>
            <p className="ref-num" style={{ textAlign: 'center' }}>{activeReservationId}</p>
          </div>
        )}
        <button className="btn btn-primary btn-full" style={{ marginBottom: 10 }} onClick={() => onNavigate('my-reservations')}>View My Reservations</button>
        <button className="btn btn-secondary btn-full" onClick={() => onNavigate('home')}>Back to Home</button>
      </div>
    </div>
  )
}

// ── MyReservationsScreen ─────────────────────────────────────────────────────
export function MyReservationsScreen({ onNavigate }) {
  const { user, setActiveReservationId } = useApp()
  const { reservations, loading } = useMyReservations(user?.id)

  const open = (r) => { setActiveReservationId(r.id); onNavigate('reservation-detail', { reservationId: r.id }) }

  return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <div className="hdr"><h2>My Reservations</h2></div>
      <div className="scroll-body">
        {loading && <p className="f13 c-stone" style={{ textAlign: 'center', padding: 20 }}>Loading reservations…</p>}
        {!loading && reservations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🪦</p>
            <p className="f14 c-stone" style={{ marginBottom: 18 }}>You don't have any reservations yet.</p>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('map')}>Find an Available Lot</button>
          </div>
        )}
        {reservations.map((r) => (
          <div key={r.id} className="card" style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => open(r)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <p className="fw7 f15 c-charcoal" style={{ margin: '0 0 2px' }}>{r.blockName} · Lot {r.lotNo}</p>
                <p className="f12 c-stone" style={{ margin: 0 }}>{r.lawnName} · {r.classification}</p>
              </div>
              <span className={`badge ${reservationStatusBadge(r.status)}`}>{reservationStatusLabel(r.status)}</span>
            </div>
            <div className="fee-row"><span className="fee-lbl">Reservation Date</span><span className="fee-val">{r.reservationDate}</span></div>
            <div className="fee-row"><span className="fee-lbl">Price</span><span className="fee-val">{r.price != null ? peso(r.price) : '—'}</span></div>
            {r.paymentOption === 'installment' && r.installmentTerm && (
              <div className="fee-row"><span className="fee-lbl">Due now</span><span className="fee-val">{peso(Number(r.downPayment) + Number(r.mcf))}</span></div>
            )}
            {usesGcash(r) && (
              <div className="fee-row"><span className="fee-lbl">Payment</span><span className={`badge ${paymentStatusBadge(r.paymentStatus)}`}>{paymentStatusLabel(r.paymentStatus)}</span></div>
            )}
          </div>
        ))}
      </div>
      <BottomNav active="profile" onNavigate={onNavigate} />
    </div>
  )
}

// ── InstallmentPaymentsCard ──────────────────────────────────────────────────
// Monthly payments on a confirmed installment: progress, history, and a form to
// pay by GCash with a receipt photo (the office verifies it). Paying in cash is
// done at the park office, where the admin records it.
async function downloadQrImage(url) {
  try {
    const res = await fetch(url)
    const href = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = href
    a.download = 'gcash-qr.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  } catch {
    window.open(url, '_blank')
  }
}

function InstallmentPaymentsCard({ r }) {
  const { user } = useApp()
  const { payments, reload } = useInstallmentPayments(r.id)
  const { paymentSettings } = usePaymentSettings()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const s = summarizeInstallment(r, payments)
  const canPay = r.status === RESERVATION_STATUS.CONFIRMED && s.totalLeft > 0
  const gcashReady = !!(paymentSettings && (paymentSettings.gcashNumber || paymentSettings.gcashQrUrl))
  const dueNow = Number(r.downPayment) + Number(r.mcf)
  const dueNowStatus = r.dueNowReceivedOn
    ? `received ${new Date(r.dueNowReceivedOn).toLocaleDateString()}`
    : usesGcash(r) ? (r.paymentStatus === 'verified' ? 'receipt verified' : paymentStatusLabel(r.paymentStatus).toLowerCase())
    : 'pay at the park office'

  async function pickReceipt(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!isReceiptImage(file)) {
      setError(`Please choose a photo (JPG, PNG or WebP) under ${RECEIPT_MAX_MB} MB.`)
      e.target.value = ''
      return
    }
    setError('')
    const blob = await compressReceipt(file)
    if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    setReceiptFile(blob)
    setReceiptPreview(URL.createObjectURL(blob))
  }

  async function submit() {
    const amtErr = amountError(amount, { label: 'Amount' })
    if (amtErr) { setError(amtErr); return }
    const value = Math.round(Number(amount) * 100) / 100
    if (!(value > 0)) { setError('Enter the amount you paid.'); return }
    if (value > s.totalLeft + 0.005) { setError(`That is more than the ${peso(s.totalLeft)} left to pay.`); return }
    if (!receiptFile) { setError('Please upload a photo of your GCash receipt.'); return }
    setBusy(true)
    setError('')
    try {
      await api.submitMonthlyPayment({ reservationId: r.id, userId: user?.id || 'local-demo-user', amount: value, receiptFile })
      setOpen(false)
      setAmount('')
      setReceiptFile(null)
      setReceiptPreview('')
      reload()
    } catch (err) {
      setError(err?.message || 'Could not submit the payment. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <p className="section-label" style={{ margin: '0 0 10px' }}>Monthly Payments</p>
      {[
        ['Progress', `${s.monthsCovered} of ${s.months} months paid`],
        ['Due now', `${peso(dueNow)} · ${dueNowStatus}`],
        ['Total of monthly payments', peso(s.totalOwed)],
        ['Total cost', peso(dueNow + s.totalOwed)],
        ['Paid so far (monthly)', peso(s.totalPaid)],
        ['Left to pay (monthly)', peso(s.totalLeft)],
        ...(s.pendingAmount > 0 ? [['Awaiting verification', peso(s.pendingAmount)]] : []),
      ].map(([l, v]) => (
        <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
      ))}

      {payments.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="f11 c-stone" style={{ margin: '0 0 6px', fontWeight: 700 }}>PAYMENT HISTORY</p>
          {payments.map((p) => {
            const meta = INSTALLMENT_PAYMENT_STATUS_META[p.status] || INSTALLMENT_PAYMENT_STATUS_META.pending
            return (
              <div key={p.id} className="fee-row" style={{ opacity: p.status === 'voided' ? 0.55 : 1 }}>
                <span className="fee-lbl">
                  {new Date(p.paidOn).toLocaleDateString()} · {p.kind === 'adjustment' ? 'Balance adjustment' : `Monthly (${p.method === 'gcash' ? 'GCash' : 'Cash'})`}
                </span>
                <span className="fee-val">
                  {p.kind === 'adjustment' ? `${p.amount > 0 ? '−' : '+'}${peso(Math.abs(p.amount))}` : peso(p.amount)}{' '}
                  <span className={`badge ${meta.badge}`}>{meta.label}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {canPay && !open && (
        <>
          <button className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={() => { setAmount(String(s.nextDue)); setOpen(true) }}>Pay Monthly Payment</button>
          <p className="f11 c-stone" style={{ margin: '8px 0 0' }}>Paying in cash? Pay at the park office — the office will record it here.</p>
        </>
      )}

      {open && (
        <div style={{ marginTop: 12 }}>
          {gcashReady ? (
            <>
              {paymentSettings.gcashQrUrl && (
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <img src={paymentSettings.gcashQrUrl} alt="GCash QR code" style={{ width: '100%', maxWidth: 220, borderRadius: 10, border: '1px solid var(--lgray)', background: '#fff' }} />
                  <div><button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => downloadQrImage(paymentSettings.gcashQrUrl)}>Save QR</button></div>
                </div>
              )}
              {[
                ['Account Name', paymentSettings.gcashName || '—'],
                ['GCash Number', paymentSettings.gcashNumber || '—'],
              ].map(([l, v]) => (
                <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
              ))}
              {paymentSettings.gcashInstructions && (
                <p className="f12 c-stone" style={{ margin: '10px 0 0' }}>{paymentSettings.gcashInstructions}</p>
              )}
              <div className="field" style={{ marginTop: 12 }}>
                <label className="lbl">Amount you paid</label>
                <input className="inp" inputMode="decimal" placeholder="e.g. 1500.00" value={amount} onChange={(e) => setAmount(onlyDecimal(e.target.value))} />
                <p className="f11 c-stone" style={{ margin: '6px 0 0' }}>Your monthly payment is {peso(s.monthly)}.</p>
              </div>
              <div className="field">
                <label className="lbl">GCash Receipt Photo</label>
                <input className="inp" type="file" accept="image/jpeg,image/png,image/webp" onChange={pickReceipt} />
                {receiptPreview && (
                  <img src={receiptPreview} alt="GCash receipt preview" style={{ marginTop: 10, width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--lgray)', background: '#fff' }} />
                )}
              </div>
            </>
          ) : (
            <p className="f12 c-stone" style={{ margin: 0 }}>GCash payment isn't available yet. Please pay at the park office.</p>
          )}
          {error && <p className="f12" style={{ color: '#DC2626', margin: '8px 0' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setOpen(false); setError('') }} disabled={busy}>Cancel</button>
            {gcashReady && <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit Payment'}</button>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ReservationDetailScreen ──────────────────────────────────────────────────
export function ReservationDetailScreen({ onNavigate, onBack }) {
  const { activeReservationId } = useApp()
  const { reservation, loading, reload } = useReservation(activeReservationId)
  const [cancelling, setCancelling] = useState(false)

  async function handleCancel() {
    if (!reservation || cancelling) return
    setCancelling(true)
    try {
      await api.cancelReservation(reservation.id)
      reload()
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <div className="screen active" style={{ background: 'var(--cream)' }}><p className="f13 c-stone" style={{ textAlign: 'center', padding: 40 }}>Loading…</p></div>
  if (!reservation) return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <BackHeader title="Reservation" onBack={() => onBack('my-reservations')} />
      <p className="f13 c-stone" style={{ textAlign: 'center', padding: 40 }}>Reservation not found.</p>
    </div>
  )

  const r = reservation
  return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <BackHeader title={`${r.blockName} · Lot ${r.lotNo}`} sub={r.lawnName} onBack={() => onBack('my-reservations')} />
      <div className="scroll-body">
        <div style={{ marginBottom: 14 }}>
          <span className={`badge ${reservationStatusBadge(r.status)}`}>{reservationStatusLabel(r.status)}</span>
        </div>
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="section-label" style={{ margin: '0 0 10px' }}>Applicant</p>
          {[['Name', r.applicantName], ['Email', r.email], ['Contact Number', r.contactNumber]].map(([l, v]) => (
            <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
          ))}
        </div>
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="section-label" style={{ margin: '0 0 10px' }}>Cemetery Lot</p>
          {[['Block', r.blockName], ['Lawn', r.lawnName || '—'], ['Lot Number', r.lotNo], ['Classification', r.classification]].map(([l, v]) => (
            <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
          ))}
        </div>
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="section-label" style={{ margin: '0 0 10px' }}>Reservation</p>
          {[
            ['Reservation Date', r.reservationDate],
            ['Price', r.price != null ? peso(r.price) : '—'],
            ['Payment Option', PAYMENT_OPTIONS.find((p) => p.id === r.paymentOption)?.label || r.paymentOption],
            ['Submitted', new Date(r.createdAt).toLocaleDateString()],
            ['Notes', r.notes || '—'],
          ].map(([l, v]) => (
            <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
          ))}
          {usesGcash(r) && (
            <div className="fee-row"><span className="fee-lbl">GCash Receipt</span><span className={`badge ${paymentStatusBadge(r.paymentStatus)}`}>{paymentStatusLabel(r.paymentStatus)}</span></div>
          )}
        </div>

        {r.paymentOption === 'installment' && r.installmentTerm && (
          <InstallmentCard
            i={{ term: r.installmentTerm, downPayment: r.downPayment, mcf: r.mcf, monthly: r.monthlyAmount, balance: r.balance }}
            method={r.paymentMethod || 'cash'}
          />
        )}

        {r.paymentOption === 'installment' && r.installmentTerm && (r.status === RESERVATION_STATUS.CONFIRMED || r.status === RESERVATION_STATUS.COMPLETED) && (
          <InstallmentPaymentsCard r={r} />
        )}

        {r.status === RESERVATION_STATUS.PENDING && (
          <button className="btn btn-danger btn-full" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel Reservation'}
          </button>
        )}
      </div>
    </div>
  )
}