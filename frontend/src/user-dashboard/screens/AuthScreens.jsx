import ParkMap from '../components/ParkMap'
import { ENV } from '../config/constants'
import { useApp } from '../context/AppContext'

// ── SplashScreen ────────────────────────────────────────────────────────────
export function SplashScreen({ onDone }) {
  return (
    <div className="screen active" id="screen-splash" style={{ background: 'linear-gradient(160deg,#0C4A6E 0%,#0284C7 60%,#38BDF8 100%)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* Decorative circles */}
      {[{w:300,h:300,t:-80,r:-80},{w:200,h:200,b:60,l:-60}].map((c,i) => (
        <div key={i} style={{ position:'absolute', width:c.w, height:c.h, borderRadius:'50%', border:'1px solid rgba(255,255,255,.1)', top:c.t, right:c.r, bottom:c.b, left:c.l }}/>
      ))}
      <div className="splash-logo-box">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="#38BDF8">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
      <p className="splash-title">GraveLocator</p>
      <p className="splash-sub">Cemetery Plot Finder · Calbayog City</p>
      <div className="splash-dots" style={{ position:'absolute', bottom:60 }}>
        {['#38BDF8','rgba(255,255,255,.4)','rgba(255,255,255,.4)'].map((c,i) => (
          <div key={i} className="splash-dot" style={{ background:c, animation:`pulse 1.2s ease-in-out ${i*.4}s infinite alternate` }}/>
        ))}
      </div>
    </div>
  )
}

// ── OnboardingScreen ─────────────────────────────────────────────────────────
const slides = [
  { icon:'#0C4A6E', bg:'rgba(12,74,110,.13)', border:'rgba(12,74,110,.2)', fill:'#0C4A6E', title:'Locate Cemetery Plots', desc:'Easily find any plot in Calbayog City Cemetery with our interactive map. Filter by availability, section, and more.', svgPath:<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#0C4A6E"/> },
  { icon:'#0284C7', bg:'rgba(2,132,199,.13)', border:'rgba(2,132,199,.2)', title:'Browse Blocks & Lots', desc:'Explore the whole park from the official map. Tap any block to see its lots, classifications, and status.', svgPath:<path d="M9 20l-5.5 2.5V6L9 3.5m0 16.5l6-2.5m-6 2.5V3.5m6 14l5.5 2.5V6L15 3.5m0 14V3.5m0 0L9 6" fill="none" stroke="#0284C7" strokeWidth="2"/> },
  { icon:'#C9A84C', bg:'rgba(201,168,76,.13)', border:'rgba(201,168,76,.2)', title:'Create Digital Memorials', desc:'Honor your loved ones with a digital tribute. Share memories, photos, and tributes with family and friends.', svgPath:<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" fill="none" stroke="#C9A84C" strokeWidth="2"/> },
]

import { useState } from 'react'
import ForgotPassword from '../components/ForgotPassword'
import {
  useValidation, hasErrors, FieldError, invalidStyle,
  nameError, emailError, phoneError, passwordError, PASSWORD_RULES, onlyPhoneChars,
} from '../utils/validation'

export function OnboardingScreen({ onNext }) {
  const [current, setCurrent] = useState(0)
  const s = slides[current]
  const isLast = current === slides.length - 1

  return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 32px 16px' }}>
        <div className="slide-icon-box" style={{ background:s.bg, border:`2px solid ${s.border}` }}>
          <svg width="56" height="56" viewBox="0 0 24 24">{s.svgPath}</svg>
        </div>
        <h2 className="slide-title">{s.title}</h2>
        <p className="slide-desc">{s.desc}</p>
      </div>
      <div className="slide-dots">
        {slides.map((_,i) => <div key={i} className={`sdot${i===current?' active':''}`} onClick={()=>setCurrent(i)}/>)}
      </div>
      <div className="ob-footer">
        {isLast
          ? <button className="btn btn-primary" style={{width:'100%'}} onClick={onNext}>Get Started <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
          : <>
              <button style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:'#8B9EA0',textAlign:'center'}} onClick={onNext}>Skip</button>
              <button className="btn btn-primary btn-sm" onClick={()=>setCurrent(c=>c+1)}>Next <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
            </>
        }
      </div>
    </div>
  )
}

// ── LoginScreen ──────────────────────────────────────────────────────────────
export function LoginScreen({ onLogin }) {
  const [tab, setTab] = useState('login')     // 'login' | 'signup' | 'verify'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showResend, setShowResend] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  const { signIn, signUp, resendConfirmation, verifySignupCode } = useApp()
  const { touch, reset, setTried, shown } = useValidation()

  // Sign-up needs a strong password; log-in only checks it isn't empty
  // (so accounts made before this rule can still sign in).
  const isSignup = tab === 'signup'
  const errors = tab === 'verify' ? {} : {
    fullName: isSignup ? nameError(fullName, { label: 'Full name' }) : '',
    email: emailError(email),
    phone: isSignup ? phoneError(phone, { label: 'Phone number', required: true }) : '',
    password: isSignup ? passwordError(password) : (password ? '' : 'Enter your password.'),
  }
  const err = shown(errors)

  function resetMessages() {
    setError(''); setNotice(''); setShowResend(false)
  }

  function switchTab(next) {
    setTab(next)
    resetMessages()
    reset()
  }

  async function handleSubmit() {
    resetMessages()

    // Local-stub mode (no Supabase configured yet): log-in skips straight through.
    if (!ENV.USE_REMOTE && tab === 'login') return onLogin()
    if (tab !== 'verify') {
      setTried(true)
      if (hasErrors(errors)) return
    }
    if (!ENV.USE_REMOTE) return onLogin()

    const cleanEmail = email.trim().toLowerCase()

    setBusy(true)
    try {
      if (tab === 'login') {
        await signIn({ email: cleanEmail, password })
        onLogin()
      } else if (tab === 'signup') {
        const { confirmedImmediately } = await signUp({ email: cleanEmail, password, fullName: fullName.trim(), phone: phone.trim() })
        if (confirmedImmediately) {
          onLogin()
        } else {
          // No session yet — waiting on the 6-digit code from email.
          setNotice(`We sent a 6-digit code to ${email}. Enter it below to finish signing up.`)
          setTab('verify')
        }
      } else {
        // tab === 'verify'
        await verifySignupCode(cleanEmail, code.trim())
        onLogin()
      }
    } catch (err) {
      const msg = err.message || 'Something went wrong. Please try again.'
      setError(msg)
      if (/email.*not.*confirmed/i.test(msg)) setShowResend(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    setResendBusy(true)
    setError('')
    try {
      await resendConfirmation(email)
      setNotice('New code sent — check your inbox (and spam folder).')
      setShowResend(false)
    } catch (err) {
      setError(err.message || 'Could not resend the code. Try again in a moment.')
    } finally {
      setResendBusy(false)
    }
  }

  // Forgot password: same header, reset form instead of the login form.
  if (forgot) return (
    <div className="screen active" style={{ background:'var(--cream)' }}>
      <div className="login-hdr">
        <div className="login-logo-row">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#38BDF8">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <h1>GraveLocator</h1>
        </div>
        <p>Calbayog City Cemetery Portal</p>
      </div>
      <div className="login-scroll">
        <ForgotPassword
          initialEmail={email}
          onBack={() => { setForgot(false); resetMessages() }}
          onDone={() => onLogin()}
        />
      </div>
    </div>
  )

  return (
    <div className="screen active" style={{ background:'var(--cream)' }}>
      <div className="login-hdr">
        <div className="login-logo-row">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#38BDF8">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <h1>GraveLocator</h1>
        </div>
        <p>Calbayog City Cemetery Portal</p>
      </div>

      {tab !== 'verify' && (
        <div className="tab-bar">
          <button className={`tab-btn${tab==='login'?' active':''}`} onClick={()=>switchTab('login')}>Log In</button>
          <button className={`tab-btn${tab==='signup'?' active':''}`} onClick={()=>switchTab('signup')}>Sign Up</button>
        </div>
      )}

      <div className="login-scroll">
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:4 }}>
          {tab === 'verify' ? (
            <>
              <input
                className="inp"
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e)=>setCode(e.target.value.replace(/\D/g,''))}
                style={{ textAlign:'center', letterSpacing:6, fontSize:20 }}
              />
              {error && <p style={{ color:'#DC2626', fontSize:13, margin:0 }}>{error}</p>}
              {notice && <p style={{ color:'#166534', fontSize:13, margin:0 }}>{notice}</p>}
              <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={busy || code.length !== 6}>
                {busy ? 'Verifying…' : 'Confirm Code'}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendBusy}
                style={{ background:'none', border:'none', color:'#0284C7', fontSize:13, cursor:'pointer', textDecoration:'underline' }}
              >
                {resendBusy ? 'Sending…' : "Didn't get a code? Resend"}
              </button>
            </>
          ) : (
            <>
              {tab==='signup' && (
                <div>
                  <input className="inp" placeholder="Full Name" maxLength={100} value={fullName} onChange={(e)=>setFullName(e.target.value)} onBlur={touch('fullName')} style={invalidStyle(err('fullName'))}/>
                  <FieldError msg={err('fullName')} />
                </div>
              )}
              <div>
                <input className="inp" placeholder="Email Address" type="email" maxLength={254} autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} onBlur={touch('email')} style={invalidStyle(err('email'))}/>
                <FieldError msg={err('email')} />
              </div>
              {tab==='signup' && (
                <div>
                  <input className="inp" placeholder="Phone Number (e.g. 0917 123 4567)" inputMode="tel" autoComplete="tel" value={phone} onChange={(e)=>setPhone(onlyPhoneChars(e.target.value))} onBlur={touch('phone')} style={invalidStyle(err('phone'))}/>
                  <FieldError msg={err('phone')} />
                </div>
              )}
              <div>
                <input className="inp" placeholder="Password" type="password" maxLength={72} autoComplete={tab==='signup' ? 'new-password' : 'current-password'} value={password} onChange={(e)=>setPassword(e.target.value)} onBlur={touch('password')} style={invalidStyle(err('password'))}/>
                <FieldError msg={err('password')} />
              </div>
              {tab==='signup' && (
                <ul style={{ listStyle:'none', padding:0, margin:0, fontSize:12 }}>
                  {PASSWORD_RULES.map((r) => {
                    const ok = r.test(password)
                    return (
                      <li key={r.label} style={{ color: ok ? '#16A34A' : '#8B9EA0', marginBottom:2 }}>
                        {ok ? '✓' : '•'} {r.label.charAt(0).toUpperCase() + r.label.slice(1)}
                      </li>
                    )
                  })}
                </ul>
              )}
              {error && <p style={{ color:'#DC2626', fontSize:13, margin:0 }}>{error}</p>}
              {showResend && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendBusy}
                  style={{ background:'none', border:'none', color:'#0284C7', fontSize:13, textAlign:'left', padding:0, cursor:'pointer', textDecoration:'underline' }}
                >
                  {resendBusy ? 'Sending…' : 'Resend confirmation code'}
                </button>
              )}
              {notice && <p style={{ color:'#166534', fontSize:13, margin:0 }}>{notice}</p>}
              {tab==='login' && <p className="forgot" role="button" tabIndex={0} onClick={() => { resetMessages(); setForgot(true) }}>Forgot Password?</p>}
              <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={busy}>
                {busy ? 'Please wait…' : tab==='login' ? 'Log In' : 'Create Account'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
// ── MapIntroScreen ───────────────────────────────────────────────────────────
// The app's first screen: an animated map of the whole memorial park. The nine
// blocks draw themselves in, then the screen hands off to onboarding. Tap
// anywhere to continue immediately. (MobileApp also auto-advances on a timer.)
export function MapIntroScreen({ onDone }) {
  return (
    <div
      className="screen active pm-intro"
      onClick={onDone}
      role="button"
      aria-label="Calbayog Memorial Park — tap to continue"
    >
      <div className="pm-intro-brand">
        <div className="pm-intro-logo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#38BDF8">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div>
          <p className="pm-intro-title">GraveLocator</p>
          <p className="pm-intro-sub">Calbayog Memorial Park · Brgy. Rawis</p>
        </div>
      </div>

      <div className="pm-intro-stage">
        <ParkMap animate interactive={false} />
      </div>

      <p className="pm-intro-tagline">Where love outlasts a lifetime</p>
      <p className="pm-intro-hint">Tap to continue</p>
    </div>
  )
}