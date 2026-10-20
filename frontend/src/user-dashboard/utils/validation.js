// ─────────────────────────────────────────────────────────────────────────────
// FORM VALIDATION — shared rules for every admin form.
// Each *Error() function returns '' when the value is valid, or a message.
// The only*() helpers clean what the user types (e.g. letters never reach a
// number field). useValidation() decides WHEN to show an error: after the
// field loses focus, or after the user presses Save.
// ─────────────────────────────────────────────────────────────────────────────
import { createElement, useCallback, useState } from 'react'

const str = (v) => String(v ?? '').trim()

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const NAME_RE = /^\p{L}[\p{L}\p{M} .,'-]*$/u // letters (incl. ñ, é), spaces, . , ' -
const PH_MOBILE_RE = /^(09\d{9}|639\d{9})$/   // 09XXXXXXXXX or +63 9XXXXXXXXX
const PHONE_CHARS_RE = /[^\d+\s()-]/

// ── Typing filters (use in onChange) ────────────────────────────────────────
export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '')
export const onlyDecimal = (v) => {
  const [int, ...rest] = String(v ?? '').replace(/[^\d.]/g, '').split('.')
  return rest.length ? `${int}.${rest.join('').slice(0, 2)}` : int
}
export const onlyPhoneChars = (v) => String(v ?? '').replace(/[^\d+\s()-]/g, '').slice(0, 20)

// ── Dates ───────────────────────────────────────────────────────────────────
// Local date as YYYY-MM-DD (toISOString alone gives the UTC date, which is
// still "yesterday" in the Philippines before 8 AM).
export const todayISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Validators ──────────────────────────────────────────────────────────────
export function textError(v, { label = 'This field', required = false, min = 0, max = 500 } = {}) {
  const t = str(v)
  if (!t) return required ? `${label} is required.` : ''
  if (t.length < min) return `${label} must be at least ${min} characters.`
  if (t.length > max) return `${label} must be ${max} characters or fewer.`
  return ''
}

export function emailError(v, { required = true } = {}) {
  const t = str(v)
  if (!t) return required ? 'Email is required.' : ''
  if (t.length > 254 || t.includes('..') || !EMAIL_RE.test(t)) return 'Enter a valid email, e.g. name@example.com.'
  return ''
}

export function nameError(v, { label = 'Name', required = true, max = 100 } = {}) {
  const t = str(v)
  if (!t) return required ? `${label} is required.` : ''
  if (t.length < 2) return `${label} is too short.`
  if (t.length > max) return `${label} must be ${max} characters or fewer.`
  if (!NAME_RE.test(t)) return `${label} can only contain letters, spaces, and . , ' -`
  return ''
}

// PH mobile number (users, GCash).
export function phoneError(v, { label = 'Phone number', required = false } = {}) {
  const t = str(v)
  if (!t) return required ? `${label} is required.` : ''
  if (PHONE_CHARS_RE.test(t) || !PH_MOBILE_RE.test(onlyDigits(t))) return 'Enter a valid PH mobile number, e.g. 0917 123 4567.'
  return ''
}

// Landline or mobile (office contact number).
export function contactError(v, { label = 'Contact number', required = false } = {}) {
  const t = str(v)
  if (!t) return required ? `${label} is required.` : ''
  const d = onlyDigits(t)
  if (PHONE_CHARS_RE.test(t) || d.length < 7 || d.length > 13) return `${label} must be 7–13 digits, e.g. (055) 209 1234 or 0917 123 4567.`
  return ''
}

// Whole numbers: lot number, interment count.
export function integerError(v, { label = 'Number', required = true, min = 1, max } = {}) {
  const t = str(v)
  if (!t) return required ? `${label} is required.` : ''
  if (!/^\d+$/.test(t)) return `${label} must be a whole number.`
  const n = Number(t)
  if (n < min) return `${label} must be at least ${min}.`
  if (max != null && n > max) return `${label} can't be more than ${max}.`
  return ''
}

// Money: up to 2 decimals, more than 0 by default.
export function amountError(v, { label = 'Amount', required = true, min = 0.01, max = 10_000_000 } = {}) {
  const t = str(v)
  if (!t) return required ? `${label} is required.` : ''
  if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(t)) return `${label} must be a number with up to 2 decimals.`
  const n = Number(t)
  if (n < min) return min > 0 ? `${label} must be more than ₱0.` : `${label} can't be negative.`
  if (max != null && n > max) return `${label} can't be more than ${peso(max)}.`
  return ''
}

export function dateError(v, { label = 'Date', required = false, allowFuture = false, min = '1900-01-01' } = {}) {
  const t = str(v)
  if (!t) return required ? `${label} is required.` : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t))) return `Enter a valid ${label.toLowerCase()}.`
  if (t < min) return `${label} can't be before ${min.slice(0, 4)}.`
  if (!allowFuture && t > todayISO()) return `${label} can't be in the future.`
  return ''
}

export const dateOrderError = (start, end, msg = 'Death date must be on or after the birth date.') =>
  str(start) && str(end) && str(end) < str(start) ? msg : ''

// One name per line; can't list more names than interments.
export function deceasedNamesError(text, count) {
  const lines = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const e = nameError(lines[i], { label: `Name on line ${i + 1}` })
    if (e) return e
  }
  const n = Number(count)
  if (Number.isInteger(n) && n > 0 && lines.length > n) {
    return `You listed ${lines.length} names but only ${n} interment${n === 1 ? '' : 's'}.`
  }
  return ''
}

// ── Strong password (use when creating or changing a password, not at login) ─
export const PASSWORD_RULES = [
  { label: 'at least 8 characters', test: (p) => p.length >= 8 },
  { label: 'an uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'a lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'a number', test: (p) => /\d/.test(p) },
  { label: 'a symbol (e.g. ! @ # $)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
]

export function passwordError(v, { required = true } = {}) {
  const p = String(v ?? '')
  if (!p) return required ? 'Password is required.' : ''
  if (/\s/.test(p)) return "Password can't contain spaces."
  if (p.length > 72) return 'Password must be 72 characters or fewer.'
  const missing = PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.label)
  return missing.length ? `Password needs ${missing.join(', ')}.` : ''
}

export const confirmPasswordError = (password, confirm) =>
  !confirm ? 'Please confirm the password.' : password !== confirm ? "Passwords don't match." : ''

// ── Helpers ─────────────────────────────────────────────────────────────────
export const hasErrors = (errors) => Object.values(errors).some(Boolean)

// Show a field's error after it loses focus, or after Save was pressed once.
export function useValidation() {
  const [touched, setTouched] = useState({})
  const [tried, setTried] = useState(false)
  const touch = useCallback((k) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true })), [])
  const reset = useCallback(() => { setTouched({}); setTried(false) }, [])
  const shown = (errors) => (k) => ((tried || touched[k]) ? errors[k] || '' : '')
  return { touch, reset, tried, setTried, shown }
}

export const FIELD_ERROR_STYLE = { display: 'block', color: '#DC2626', fontSize: 12, marginTop: 4 }
export const invalidStyle = (msg, base) => (msg ? { ...base, borderColor: '#DC2626' } : base)

export function FieldError({ msg }) {
  return msg ? createElement('small', { style: FIELD_ERROR_STYLE, role: 'alert' }, msg) : null
}