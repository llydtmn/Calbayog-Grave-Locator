// ─────────────────────────────────────────────────────────────────────────────
// ForgotPassword — reset a password using only an email address.
//   1. Enter email        → Supabase emails a 6-digit recovery code
//   2. Enter code + new password → password is changed and the user is signed in
//   3. Success            → continue into the app
// Needs the Supabase "Reset Password" email template to include {{ .Token }}.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import * as api from '../api'
import { ENV } from '../config/constants'

const RESEND_SECONDS = 60
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function friendlyError(err) {
  const msg = err?.message || ''
  if (/expired|invalid|otp/i.test(msg)) return 'That code is wrong or has expired. Check the latest email or request a new code.'
  if (/rate|too many|seconds/i.test(msg)) return 'Too many requests. Please wait a minute and try again.'
  if (/same.*password|different from the old/i.test(msg)) return 'Your new password must be different from your old one.'
  if (/password/i.test(msg)) return msg
  return msg || 'Something went wrong. Please try again.'
}

export default function ForgotPassword({ initialEmail = '', onBack, onDone }) {
  const [step, setStep] = useState('email') // 'email' | 'code' | 'done'
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cooldown, setCooldown] = useState(0)

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function sendCode() {
    setError(''); setNotice('')
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.')
    setBusy(true)
    try {
      if (ENV.USE_REMOTE) await api.requestPasswordReset(email)
      setStep('code')
      setCooldown(RESEND_SECONDS)
      setNotice(`If an account exists for ${email.trim()}, we sent a 6-digit code. Check your inbox and spam folder.`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword() {
    setError(''); setNotice('')
    if (code.length < 6) return setError('Enter the 6-digit code from the email.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError("Passwords don't match.")
    setBusy(true)
    try {
      if (ENV.USE_REMOTE) await api.resetPasswordWithCode(email, code, password)
      setStep('done')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const linkBtn = { background:'none', border:'none', color:'#0284C7', fontSize:13, cursor:'pointer', textDecoration:'underline', padding:0 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:4 }}>
      <div>
        <h3 style={{ margin:0, fontFamily:'var(--ff-d)', fontSize:18, color:'var(--charcoal)' }}>
          {step === 'done' ? 'Password updated' : 'Reset your password'}
        </h3>
        <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--stone)' }}>
          {step === 'email' && 'Enter the email you used to sign up. We’ll send you a 6-digit code.'}
          {step === 'code' && `Enter the code sent to ${email.trim()} and choose a new password.`}
          {step === 'done' && 'Your password has been changed. You’re now signed in.'}
        </p>
      </div>

      {step === 'email' && (
        <>
          <input className="inp" placeholder="Email Address" type="email" autoComplete="email"
            value={email} onChange={(e)=>setEmail(e.target.value)}
            onKeyDown={(e)=>{ if (e.key === 'Enter') sendCode() }} />
          {error && <p style={{ color:'#DC2626', fontSize:13, margin:0 }}>{error}</p>}
          <button className="btn btn-primary btn-full" onClick={sendCode} disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Send Code'}
          </button>
        </>
      )}

      {step === 'code' && (
        <>
          {notice && <p style={{ color:'#166534', fontSize:13, margin:0 }}>{notice}</p>}
          <input className="inp" placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code"
            maxLength={8} value={code} onChange={(e)=>setCode(e.target.value.replace(/\D/g,''))}
            style={{ textAlign:'center', letterSpacing:6, fontSize:20 }} />
          <div style={{ position:'relative' }}>
            <input className="inp" placeholder="New Password" type={showPw ? 'text' : 'password'} autoComplete="new-password"
              value={password} onChange={(e)=>setPassword(e.target.value)} style={{ paddingRight:64 }} />
            <button type="button" onClick={()=>setShowPw((s)=>!s)}
              style={{ ...linkBtn, position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', textDecoration:'none', fontWeight:600 }}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          <input className="inp" placeholder="Confirm New Password" type={showPw ? 'text' : 'password'} autoComplete="new-password"
            value={confirm} onChange={(e)=>setConfirm(e.target.value)}
            onKeyDown={(e)=>{ if (e.key === 'Enter') resetPassword() }} />
          {error && <p style={{ color:'#DC2626', fontSize:13, margin:0 }}>{error}</p>}
          <button className="btn btn-primary btn-full" onClick={resetPassword} disabled={busy || code.length < 6 || !password || !confirm}>
            {busy ? 'Updating…' : 'Reset Password'}
          </button>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
            <button type="button" style={linkBtn} onClick={()=>{ setStep('email'); setCode(''); setError(''); setNotice('') }}>
              Use a different email
            </button>
            <button type="button" style={{ ...linkBtn, opacity: cooldown > 0 ? .5 : 1 }} disabled={busy || cooldown > 0} onClick={sendCode}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </>
      )}

      {step === 'done' && (
        <button className="btn btn-primary btn-full" onClick={onDone}>Continue</button>
      )}

      {step !== 'done' && (
        <button type="button" style={{ ...linkBtn, alignSelf:'center', marginTop:4 }} onClick={onBack}>
          ← Back to Log In
        </button>
      )}
    </div>
  )
}