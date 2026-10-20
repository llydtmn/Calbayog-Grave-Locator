import { useState, useEffect } from 'react'
import { useAdmin } from '../context/AdminContext'
import { STATUS, STATUS_META, STATUS_ORDER } from '../config/status'
import { USER_STATUS, USER_STATUS_META, ADMIN_ROLE, RESERVATION_STATUS, RESERVATION_STATUS_META, MEMORIAL_STATUS, MEMORIAL_STATUS_META } from '../config/adminStatus'
import { formatDate } from '../utils/date'
import { plotLabel, plotShort } from '../utils/plot'
import { peso } from '../utils/format'
import { paymentStatusMeta, PAYMENT_OPTION_LABEL, PAYMENT_METHOD_LABEL, INSTALLMENT_TERM_LABEL } from '../config/paymentStatus'
import * as api from '../api'
import {
  useValidation, hasErrors, FieldError, invalidStyle, todayISO,
  nameError, emailError, phoneError, integerError, dateError, dateOrderError, textError,
  onlyDigits, onlyPhoneChars,
} from '../utils/validation'
import { deceasedRecordsOf } from '../utils/plotExcel'

// Shared shell: reads context.modal, renders nothing when it's not this modal's id.
function Modal({ id, title, subtitle, children }) {
  const { modal, closeModal } = useAdmin()
  if (modal?.id !== id) return null
  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
      <div className="modal">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

// ── Update Lot — look up an existing lot by block+number, set its status ────
// With Interment: one row per person buried — name, date of death and
// (optional) date of burial.
const emptyPerson = () => ({ name: '', deathDate: '', burialDate: '' })

function UpdateLotModal() {
  const { modal, closeModal, runAction } = useAdmin()
  const isOpen = modal?.id === 'modal-updatelot'
  const record = modal?.record || null

  const [blocks, setBlocks] = useState([])
  const [blockId, setBlockId] = useState('')
  const [lotNo, setLotNo] = useState('')
  const [status, setStatus] = useState(STATUS.AVAILABLE)
  const [intermentCount, setIntermentCount] = useState(1)
  const [people, setPeople] = useState([emptyPerson()]) // [{ name, deathDate, burialDate }]
  const [saving, setSaving] = useState(false)
  const { touch, reset, setTried, shown } = useValidation()

  const needsIntermentCount = status === STATUS.WITH_INTERMENT

  useEffect(() => { api.getBlocks().then(setBlocks) }, [])
  useEffect(() => {
    if (!isOpen) return
    setBlockId(record?.blockId || '')
    setLotNo(record?.lotNo ?? '')
    setStatus(record?.status || STATUS.AVAILABLE)
    // Default to the lot's existing count when it already has interments,
    // otherwise start at 1 (about to record the first burial).
    setIntermentCount(record?.intermentCount > 0 ? record.intermentCount : 1)
    setPeople([emptyPerson()])
    reset()
  }, [isOpen, record, reset])

  // Load the lot's saved people (and interment count) once a lot is picked.
  useEffect(() => {
    if (!isOpen || !blockId || !lotNo) return undefined
    let alive = true
    api.getLot(blockId, Number(lotNo))
      .then((lot) => {
        if (!alive) return
        const saved = deceasedRecordsOf(lot).map((r) => ({ name: r.name, deathDate: r.deathDate || '', burialDate: r.burialDate || '' }))
        setPeople(saved.length ? saved : [emptyPerson()])
        if (lot?.intermentCount > 0) setIntermentCount(lot.intermentCount)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [isOpen, blockId, lotNo])

  if (!isOpen) return null
  const gridBlocks = blocks.filter((b) => b.hasGrid)
  const block = blocks.find((b) => b.id === blockId)
  const maxPeople = Math.max(1, Number(intermentCount) || 1)

  const setPerson = (i, k) => (e) => {
    const value = e.target.value
    setPeople((list) => list.map((p, j) => (j === i ? { ...p, [k]: value } : p)))
  }
  const addPerson = () => setPeople((list) => [...list, emptyPerson()])
  const removePerson = (i) => setPeople((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [emptyPerson()]))

  // Rows with nothing typed are ignored; a row with a date needs a name.
  const filled = people.filter((p) => p.name.trim() || p.deathDate || p.burialDate)
  const personErrors = {}
  if (needsIntermentCount) {
    people.forEach((p, i) => {
      const used = p.name.trim() || p.deathDate || p.burialDate
      personErrors[`name-${i}`] = used ? nameError(p.name, { label: 'Name' }) : ''
      personErrors[`death-${i}`] = dateError(p.deathDate, { label: 'Date of death' })
      personErrors[`burial-${i}`] = dateError(p.burialDate, { label: 'Date of burial' })
        || dateOrderError(p.deathDate, p.burialDate, "Burial can't be before the date of death.")
    })
  }

  const errors = {
    blockId: blockId ? '' : 'Choose a block.',
    lotNo: integerError(lotNo, { label: 'Lot number', max: block?.maxLot || 99999 }),
    intermentCount: needsIntermentCount ? integerError(intermentCount, { label: 'Number of interments', max: 50 }) : '',
    people: needsIntermentCount && filled.length > maxPeople
      ? `You listed ${filled.length} people but only ${maxPeople} interment${maxPeople === 1 ? '' : 's'}.`
      : '',
    ...personErrors,
  }
  const err = shown(errors)

  const submit = async () => {
    setTried(true)
    if (hasErrors(errors)) return
    setSaving(true)
    const records = filled.map((p) => ({ name: p.name.trim(), deathDate: p.deathDate || null, burialDate: p.burialDate || null }))
    const ok = await runAction(
      () => api.updateLotStatus(
        blockId, Number(lotNo), status,
        needsIntermentCount ? Number(intermentCount) : undefined,
        // With Interment → save the people; Available → clear them; others → keep.
        needsIntermentCount ? records : status === STATUS.AVAILABLE ? [] : undefined,
      ),
      `Lot ${lotNo} updated.`,
    )
    setSaving(false)
    if (ok) closeModal()
  }

  const small = { fontSize: 12, color: 'var(--dgray)', marginTop: 4 }
  const today = todayISO()

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
      <div className="modal">
        <h3>{record ? `Update ${plotLabel(record)}` : 'Update Lot'}</h3>
        <p>Look up a lot by block and lot number, then set its status.</p>
        <div className="modal-row">
          <div className="modal-field">
            <label>Block</label>
            <select value={blockId} onChange={e => setBlockId(e.target.value)} onBlur={touch('blockId')} disabled={!!record} style={invalidStyle(err('blockId'))}>
              <option value="">Select a block…</option>
              {gridBlocks.map(b => <option key={b.id} value={b.id}>{b.name}{b.lawnName ? ` — ${b.lawnName}` : ''}</option>)}
            </select>
            <FieldError msg={err('blockId')} />
          </div>
          <div className="modal-field">
            <label>Lot Number</label>
            <input
              inputMode="numeric" maxLength={5} placeholder="e.g. 204"
              value={lotNo} onChange={e => setLotNo(onlyDigits(e.target.value))} onBlur={touch('lotNo')}
              disabled={!!record} style={invalidStyle(err('lotNo'))}
            />
            <FieldError msg={err('lotNo')} />
          </div>
        </div>
        <div className="modal-field">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
        {needsIntermentCount && (
          <div className="modal-field">
            <label>Number of Interments</label>
            <input
              inputMode="numeric" maxLength={2} placeholder="e.g. 1"
              value={intermentCount} onChange={e => setIntermentCount(onlyDigits(e.target.value))} onBlur={touch('intermentCount')}
              style={invalidStyle(err('intermentCount'))}
            />
            <FieldError msg={err('intermentCount')} />
            <p style={small}>How many people are buried in this lot.</p>
          </div>
        )}
        {needsIntermentCount && (
          <div className="modal-field">
            <label>Deceased</label>
            {people.map((p, i) => (
              <div key={i} style={{ border: '1px solid var(--lgray)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      placeholder="Full name, e.g. Dela Cruz, Juan" maxLength={100}
                      value={p.name} onChange={setPerson(i, 'name')} onBlur={touch(`name-${i}`)}
                      style={invalidStyle(err(`name-${i}`))}
                    />
                    <FieldError msg={err(`name-${i}`)} />
                  </div>
                  <button
                    type="button" className="btn btn-ghost btn-xs" onClick={() => removePerson(i)}
                    title="Remove this person" aria-label={`Remove person ${i + 1}`} style={{ marginTop: 4 }}
                  >✕</button>
                </div>
                <div className="modal-row" style={{ marginTop: 8, marginBottom: 0 }}>
                  <div className="modal-field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 11 }}>Date of Death</label>
                    <input
                      type="date" min="1900-01-01" max={today}
                      value={p.deathDate} onChange={setPerson(i, 'deathDate')} onBlur={touch(`death-${i}`)}
                      style={invalidStyle(err(`death-${i}`))}
                    />
                    <FieldError msg={err(`death-${i}`)} />
                  </div>
                  <div className="modal-field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 11 }}>Date of Burial (optional)</label>
                    <input
                      type="date" min={p.deathDate || '1900-01-01'} max={today}
                      value={p.burialDate} onChange={setPerson(i, 'burialDate')} onBlur={touch(`burial-${i}`)}
                      style={invalidStyle(err(`burial-${i}`))}
                    />
                    <FieldError msg={err(`burial-${i}`)} />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-xs" onClick={addPerson} disabled={people.length >= maxPeople}>
              + Add another person
            </button>
            <FieldError msg={errors.people} />
            <p style={small}>
              Shown on the lot's details and searchable in the user app.
              {people.length >= maxPeople && ' To add more people, raise the Number of Interments first.'}
            </p>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={closeModal} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Status'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add / Edit User ────────────────────────────────────────────────────────────
function UserFormModal({ id, title, subtitle }) {
  const { modal, closeModal, runAction } = useAdmin()
  const isOpen = modal?.id === id
  const record = modal?.record || null
  const [form, setForm] = useState({ name: '', email: '', phone: '', status: USER_STATUS.ACTIVE })
  const [saving, setSaving] = useState(false)
  const { touch, reset, setTried, shown } = useValidation()

  useEffect(() => {
    if (!isOpen) return
    setForm(record
      ? { name: record.name || '', email: record.email || '', phone: record.phone || '', status: record.status || USER_STATUS.ACTIVE }
      : { name: '', email: '', phone: '', status: USER_STATUS.ACTIVE })
    reset()
  }, [isOpen, record, reset])
  if (!isOpen) return null

  const set = (k, filter) => (e) => {
    const value = filter ? filter(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [k]: value }))
  }
  const errors = {
    name: nameError(form.name, { label: 'Full name' }),
    email: emailError(form.email),
    phone: phoneError(form.phone),
  }
  const err = shown(errors)

  const submit = async () => {
    setTried(true)
    if (hasErrors(errors)) return
    const clean = { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim() }
    setSaving(true)
    const ok = await runAction(
      () => (record ? api.updateUser(record.id, clean) : api.createUser(clean)),
      record ? 'User updated.' : 'User added.',
    )
    setSaving(false)
    if (ok) closeModal()
  }

  return (
    <Modal id={id} title={title} subtitle={record ? record.name : subtitle}>
      <div className="modal-row">
        <div className="modal-field">
          <label>Full Name</label>
          <input value={form.name} onChange={set('name')} onBlur={touch('name')} placeholder="Full name" maxLength={100} style={invalidStyle(err('name'))} />
          <FieldError msg={err('name')} />
        </div>
        <div className="modal-field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} onBlur={touch('email')} placeholder="user@email.com" maxLength={254} style={invalidStyle(err('email'))} />
          <FieldError msg={err('email')} />
        </div>
      </div>
      <div className="modal-row">
        <div className="modal-field">
          <label>Phone</label>
          <input inputMode="tel" value={form.phone} onChange={set('phone', onlyPhoneChars)} onBlur={touch('phone')} placeholder="0917 123 4567" style={invalidStyle(err('phone'))} />
          <FieldError msg={err('phone')} />
        </div>
        <div className="modal-field">
          <label>Status</label>
          <select value={form.status} onChange={set('status')}>
            {Object.values(USER_STATUS).map(s => <option key={s} value={s}>{s === USER_STATUS.ACTIVE ? 'Active' : 'Inactive'}</option>)}
          </select>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={closeModal} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : record ? 'Save Changes' : 'Add User'}
        </button>
      </div>
    </Modal>
  )
}

// Shared memorial rules (Add + Edit).
function memorialErrors(form, blocks, { withSubmitter = false, tributeKey = 'tribute' } = {}) {
  const block = blocks.find((b) => b.id === form.blockId)
  return {
    name: nameError(form.name, { label: 'Name of deceased' }),
    ...(withSubmitter ? { submittedBy: nameError(form.submittedBy, { label: 'Submitted by', required: false }) } : {}),
    birth: dateError(form.birth, { label: 'Birth date' }),
    death: dateError(form.death, { label: 'Death date' }) || dateOrderError(form.birth, form.death),
    blockId: form.lotNo && !form.blockId ? 'Choose the block for this lot.' : '',
    lotNo: integerError(form.lotNo, { label: 'Lot number', required: false, max: block?.maxLot || 99999 }),
    [tributeKey]: textError(form[tributeKey], { label: 'Tribute message', max: 500 }),
  }
}

// ── Add Memorial ───────────────────────────────────────────────────────────────
function AddMemorialModal() {
  const { modal, closeModal, runAction } = useAdmin()
  const isOpen = modal?.id === 'modal-addmemorial'
  const [form, setForm] = useState({ name: '', submittedBy: '', birth: '', death: '', blockId: '', lotNo: '', tribute: '' })
  const [blocks, setBlocks] = useState([])
  const [saving, setSaving] = useState(false)
  const { touch, reset, setTried, shown } = useValidation()

  useEffect(() => { api.getBlocks().then(setBlocks) }, [])
  useEffect(() => {
    if (!isOpen) return
    setForm({ name: '', submittedBy: '', birth: '', death: '', blockId: '', lotNo: '', tribute: '' })
    reset()
  }, [isOpen, reset])
  if (!isOpen) return null

  const set = (k, filter) => (e) => {
    const value = filter ? filter(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [k]: value }))
  }
  const errors = memorialErrors(form, blocks, { withSubmitter: true })
  const err = shown(errors)

  const submit = async () => {
    setTried(true)
    if (hasErrors(errors)) return
    setSaving(true)
    const ok = await runAction(() => api.createMemorial({
        name: form.name.trim(), emoji: '🕊️',
        dates: `${form.birth || '?'} – ${form.death || '?'} · ${plotShort({ blockId: form.blockId, lotNo: form.lotNo })}`,
        quote: form.tribute.trim(), likes: 0, comments: 0,
        birth_date: form.birth || null, death_date: form.death || null,
        block_id: form.blockId || null, lot_no: form.lotNo ? Number(form.lotNo) : null,
        submitted_by: form.submittedBy.trim() || null,
      }), 'Memorial published.')
    setSaving(false)
    if (ok) closeModal()
  }

  return (
    <Modal id="modal-addmemorial" title="Add Memorial" subtitle="Create a digital memorial entry.">
      <div className="modal-row">
        <div className="modal-field">
          <label>Name of Deceased</label>
          <input value={form.name} onChange={set('name')} onBlur={touch('name')} placeholder="Full name" maxLength={100} style={invalidStyle(err('name'))} />
          <FieldError msg={err('name')} />
        </div>
        <div className="modal-field">
          <label>Submitted By (User)</label>
          <input value={form.submittedBy} onChange={set('submittedBy')} onBlur={touch('submittedBy')} placeholder="Plot owner name" maxLength={100} style={invalidStyle(err('submittedBy'))} />
          <FieldError msg={err('submittedBy')} />
        </div>
      </div>
      <div className="modal-row">
        <div className="modal-field">
          <label>Birth Date</label>
          <input type="date" min="1900-01-01" max={todayISO()} value={form.birth} onChange={set('birth')} onBlur={touch('birth')} style={invalidStyle(err('birth'))} />
          <FieldError msg={err('birth')} />
        </div>
        <div className="modal-field">
          <label>Death Date</label>
          <input type="date" min={form.birth || '1900-01-01'} max={todayISO()} value={form.death} onChange={set('death')} onBlur={touch('death')} style={invalidStyle(err('death'))} />
          <FieldError msg={err('death')} />
        </div>
      </div>
      <div className="modal-row">
        <div className="modal-field">
          <label>Block</label>
          <select value={form.blockId} onChange={set('blockId')} onBlur={touch('blockId')} style={invalidStyle(err('blockId'))}>
            <option value="">Select a block…</option>
            {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <FieldError msg={err('blockId')} />
        </div>
        <div className="modal-field">
          <label>Lot Number</label>
          <input inputMode="numeric" maxLength={5} value={form.lotNo} onChange={set('lotNo', onlyDigits)} onBlur={touch('lotNo')} placeholder="e.g. 204" style={invalidStyle(err('lotNo'))} />
          <FieldError msg={err('lotNo')} />
        </div>
      </div>
      <div className="modal-field">
        <label>Tribute Message</label>
        <textarea value={form.tribute} onChange={set('tribute')} onBlur={touch('tribute')} placeholder="Enter tribute…" maxLength={500} style={invalidStyle(err('tribute'))} />
        <FieldError msg={err('tribute')} />
      </div>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={closeModal} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Publishing…' : 'Publish Memorial'}</button>
      </div>
    </Modal>
  )
}

// ── Add Admin Staff ────────────────────────────────────────────────────────────
function AddAdminModal() {
  const { modal, closeModal, runAction } = useAdmin()
  const isOpen = modal?.id === 'modal-addadmin'
  const [form, setForm] = useState({ name: '', email: '', role: ADMIN_ROLE.VIEWER })
  const [saving, setSaving] = useState(false)
  const { touch, reset, setTried, shown } = useValidation()

  useEffect(() => {
    if (!isOpen) return
    setForm({ name: '', email: '', role: ADMIN_ROLE.VIEWER })
    reset()
  }, [isOpen, reset])
  if (!isOpen) return null

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const errors = {
    name: nameError(form.name, { label: 'Full name' }),
    email: emailError(form.email),
    role: Object.values(ADMIN_ROLE).includes(form.role) ? '' : 'Choose a role.',
  }
  const err = shown(errors)

  const submit = async () => {
    setTried(true)
    if (hasErrors(errors)) return
    setSaving(true)
    const ok = await runAction(
      () => api.addAdminStaff({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() }),
      'Staff member added.',
    )
    setSaving(false)
    if (ok) closeModal()
  }

  return (
    <Modal id="modal-addadmin" title="Add Admin Staff" subtitle="Grant dashboard access to a staff member.">
      <div className="modal-row">
        <div className="modal-field">
          <label>Full Name</label>
          <input value={form.name} onChange={set('name')} onBlur={touch('name')} placeholder="Full name" maxLength={100} style={invalidStyle(err('name'))} />
          <FieldError msg={err('name')} />
        </div>
        <div className="modal-field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} onBlur={touch('email')} placeholder="staff@calbayog.gov.ph" maxLength={254} style={invalidStyle(err('email'))} />
          <FieldError msg={err('email')} />
        </div>
      </div>
      <div className="modal-field">
        <label>Role</label>
        <select value={form.role} onChange={set('role')} style={invalidStyle(err('role'))}>
          {Object.values(ADMIN_ROLE).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <FieldError msg={err('role')} />
      </div>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={closeModal} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Adding…' : 'Add Staff'}</button>
      </div>
    </Modal>
  )
}

// ── Reservation Detail (admin view — same data the applicant sees, plus
// Confirm / Reject / Cancel actions) ─────────────────────────────────────────
function ReservationDetailModal() {
  const { modal, closeModal, runAction, confirmAction } = useAdmin()
  const isOpen = modal?.id === 'modal-reservation-detail'
  const r = modal?.record || null
  const [busy, setBusy] = useState(false)
  if (!isOpen || !r) return null

  const setStatus = async (status) => {
    setBusy(true)
    const ok = await runAction(() => api.updateReservationStatus(r.id, status), `Reservation ${RESERVATION_STATUS_META[status].label.toLowerCase()}.`)
    setBusy(false)
    if (ok) closeModal()
  }

  // Swaps this modal for the confirm dialog (same history entry).
  const askDelete = () => confirmAction({
    title: 'Delete reservation?',
    message: `${r.id} for ${r.applicantName} will be removed permanently.`,
    confirmLabel: 'Delete',
    successMessage: 'Reservation deleted.',
    onConfirm: () => api.deleteReservation(r.id),
  })

  return (
    <Modal id="modal-reservation-detail" title={`${r.blockName} · Lot ${r.lotNo}`} subtitle={r.lawnName}>
      <div style={{ marginBottom: 14 }}>
        <span className={`badge ${RESERVATION_STATUS_META[r.status].badge}`}>{RESERVATION_STATUS_META[r.status].label}</span>
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--dgray)', marginBottom: 6 }}>Applicant</p>
      {[['Name', r.applicantName], ['Email', r.email], ['Contact', r.contactNumber]].map(([l, v]) => (
        <div key={l} className="detail-row"><span className="detail-label">{l}</span><span className="detail-val">{v}</span></div>
      ))}
      <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--dgray)', margin: '14px 0 6px' }}>Cemetery Lot</p>
      {[['Block', r.blockName], ['Lawn', r.lawnName || '—'], ['Lot Number', r.lotNo], ['Classification', r.classification]].map(([l, v]) => (
        <div key={l} className="detail-row"><span className="detail-label">{l}</span><span className="detail-val">{v}</span></div>
      ))}
      <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--dgray)', margin: '14px 0 6px' }}>Reservation</p>
      {[
        ['Reservation Date', r.reservationDate],
        ['Price', peso(r.price)],
        ['Payment Option', `${PAYMENT_OPTION_LABEL[r.paymentOption] || r.paymentOption || '—'}${r.installmentTerm ? ` · ${INSTALLMENT_TERM_LABEL[r.installmentTerm]}` : ''}`],
        ['Paid via', PAYMENT_METHOD_LABEL[r.paymentMethod] || PAYMENT_OPTION_LABEL[r.paymentOption] || '—'],
        ['Payment Status', r.paymentMethod === 'gcash'
          ? paymentStatusMeta(r.paymentStatus).label
          : r.dueNowReceivedOn ? `Cash received ${formatDate(r.dueNowReceivedOn)}` : 'Cash not yet received'],
        ['Submitted', new Date(r.createdAt).toLocaleString()],
        ['Notes', r.notes || '—'],
      ].map(([l, v]) => (
        <div key={l} className="detail-row"><span className="detail-label">{l}</span><span className="detail-val">{v}</span></div>
      ))}

      <div className="modal-actions">
        <button className="btn btn-outline" onClick={closeModal} disabled={busy}>Close</button>
        <button className="btn btn-danger" onClick={askDelete} disabled={busy}>Delete</button>
        {r.status === RESERVATION_STATUS.PENDING && (
          <>
            <button className="btn btn-danger" onClick={() => setStatus(RESERVATION_STATUS.REJECTED)} disabled={busy}>Reject</button>
            <button className="btn btn-primary" onClick={() => setStatus(RESERVATION_STATUS.CONFIRMED)} disabled={busy}>Confirm</button>
          </>
        )}
        {r.status === RESERVATION_STATUS.CONFIRMED && (
          <button className="btn btn-danger" onClick={() => setStatus(RESERVATION_STATUS.CANCELLED)} disabled={busy}>Cancel Reservation</button>
        )}
      </div>
    </Modal>
  )
}

// ── Confirm (used by every Delete / Remove button) ─────────────────────────
function ConfirmModal() {
  const { modal, closeModal, runAction } = useAdmin()
  const isOpen = modal?.id === 'modal-confirm'
  const o = modal?.record || {}
  const [busy, setBusy] = useState(false)
  if (!isOpen) return null

  const confirm = async () => {
    setBusy(true)
    const ok = await runAction(() => o.onConfirm?.(), o.successMessage)
    setBusy(false)
    if (ok) closeModal()
  }

  return (
    <Modal id="modal-confirm" title={o.title || 'Are you sure?'} subtitle={o.message}>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={closeModal} disabled={busy}>Keep it</button>
        <button className="btn btn-danger" onClick={confirm} disabled={busy}>{busy ? 'Working…' : (o.confirmLabel || 'Delete')}</button>
      </div>
    </Modal>
  )
}

// ── View User ─────────────────────────────────────────────────────────────────
function UserViewModal() {
  const { modal, closeModal, openModal } = useAdmin()
  const u = modal?.id === 'modal-viewuser' ? modal.record : null
  if (!u) return null
  return (
    <Modal id="modal-viewuser" title={u.name} subtitle={u.email}>
      {[
        ['User ID', u.id],
        ['Phone', u.phone || '—'],
        ['Joined', formatDate(u.joined)],
        ['Status', USER_STATUS_META[u.status]?.label || u.status],
        ['Plots', u.plots?.length ? u.plots.map(plotLabel).join(', ') : 'None yet'],
      ].map(([l, v]) => (
        <div key={l} className="detail-row"><span className="detail-label">{l}</span><span className="detail-val">{v}</span></div>
      ))}
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={closeModal}>Close</button>
        <button className="btn btn-primary" onClick={() => openModal('modal-edituser', u)}>Edit User</button>
      </div>
    </Modal>
  )
}

// ── Edit Memorial ─────────────────────────────────────────────────────────────
function EditMemorialModal() {
  const { modal, closeModal, runAction } = useAdmin()
  const isOpen = modal?.id === 'modal-editmemorial'
  const record = modal?.record || null
  const [form, setForm] = useState({})
  const [blocks, setBlocks] = useState([])
  const [saving, setSaving] = useState(false)
  const { touch, reset, setTried, shown } = useValidation()

  useEffect(() => { api.getBlocks().then(setBlocks) }, [])
  useEffect(() => {
    if (!isOpen || !record) return
    setForm({
      name: record.name || '', birth: record.birth || '', death: record.death || '',
      blockId: record.blockId || '', lotNo: record.lotNo ?? '', quote: record.quote || '',
      status: record.status || MEMORIAL_STATUS.PENDING,
    })
    reset()
  }, [isOpen, record, reset])
  if (!isOpen || !record) return null

  const set = (k, filter) => (e) => {
    const value = filter ? filter(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [k]: value }))
  }
  const errors = memorialErrors(form, blocks, { tributeKey: 'quote' })
  const err = shown(errors)

  const submit = async () => {
    setTried(true)
    if (hasErrors(errors)) return
    setSaving(true)
    const ok = await runAction(
      () => api.updateMemorial(record.id, { ...form, name: String(form.name).trim(), quote: String(form.quote || '').trim() }),
      'Memorial updated.',
    )
    setSaving(false)
    if (ok) closeModal()
  }

  return (
    <Modal id="modal-editmemorial" title="Edit Memorial" subtitle={record.name}>
      <div className="modal-row">
        <div className="modal-field">
          <label>Name of Deceased</label>
          <input value={form.name || ''} onChange={set('name')} onBlur={touch('name')} maxLength={100} style={invalidStyle(err('name'))} />
          <FieldError msg={err('name')} />
        </div>
        <div className="modal-field">
          <label>Status</label>
          <select value={form.status} onChange={set('status')}>
            {Object.values(MEMORIAL_STATUS).map(s => <option key={s} value={s}>{MEMORIAL_STATUS_META[s].label}</option>)}
          </select>
        </div>
      </div>
      <div className="modal-row">
        <div className="modal-field">
          <label>Birth Date</label>
          <input type="date" min="1900-01-01" max={todayISO()} value={form.birth || ''} onChange={set('birth')} onBlur={touch('birth')} style={invalidStyle(err('birth'))} />
          <FieldError msg={err('birth')} />
        </div>
        <div className="modal-field">
          <label>Death Date</label>
          <input type="date" min={form.birth || '1900-01-01'} max={todayISO()} value={form.death || ''} onChange={set('death')} onBlur={touch('death')} style={invalidStyle(err('death'))} />
          <FieldError msg={err('death')} />
        </div>
      </div>
      <div className="modal-row">
        <div className="modal-field">
          <label>Block</label>
          <select value={form.blockId || ''} onChange={set('blockId')} onBlur={touch('blockId')} style={invalidStyle(err('blockId'))}>
            <option value="">Select a block…</option>
            {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <FieldError msg={err('blockId')} />
        </div>
        <div className="modal-field">
          <label>Lot Number</label>
          <input inputMode="numeric" maxLength={5} value={form.lotNo ?? ''} onChange={set('lotNo', onlyDigits)} onBlur={touch('lotNo')} style={invalidStyle(err('lotNo'))} />
          <FieldError msg={err('lotNo')} />
        </div>
      </div>
      <div className="modal-field">
        <label>Tribute Message</label>
        <textarea value={form.quote || ''} onChange={set('quote')} onBlur={touch('quote')} maxLength={500} style={invalidStyle(err('quote'))} />
        <FieldError msg={err('quote')} />
      </div>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={closeModal} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </Modal>
  )
}

// ── Notification Preview ─────────────────────────────────────────────────────
function NotificationPreviewModal() {
  const { modal, closeModal } = useAdmin()
  const n = modal?.id === 'modal-notif-preview' ? modal.record : null
  if (!n) return null
  return (
    <Modal id="modal-notif-preview" title="Preview" subtitle={`To: ${n.recipients}`}>
      <div className="notif-preview">
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--charcoal)' }}>{n.title || 'Announcement'}</p>
        <p style={{ fontSize: 13, color: 'var(--dgray)', marginTop: 6, whiteSpace: 'pre-wrap' }}>{n.body || 'No message yet.'}</p>
      </div>
      <div className="modal-actions">
        <button className="btn btn-outline" onClick={closeModal}>Close</button>
      </div>
    </Modal>
  )
}

export default function AllModals() {
  return (
    <>
      <UpdateLotModal />
      <UserFormModal id="modal-adduser" title="Add User" subtitle="Register a new user account manually." />
      <UserFormModal id="modal-edituser" title="Edit User Profile" />
      <AddMemorialModal />
      <AddAdminModal />
      <ReservationDetailModal />
      <ConfirmModal />
      <UserViewModal />
      <EditMemorialModal />
      <NotificationPreviewModal />
    </>
  )
}