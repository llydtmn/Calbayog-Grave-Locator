import { useState, useEffect } from 'react'
import BottomNav from '../components/BottomNav'
import { useMemorials, useBlocks } from '../hooks'
import { useApp } from '../context/AppContext'
import { usePrefs } from '../context/PrefsContext'
import { LANGUAGES } from '../i18n'
import * as api from '../api'
import {
  useValidation, hasErrors, FieldError, invalidStyle, todayISO,
  nameError, phoneError, integerError, dateError, dateOrderError, textError,
  passwordError, confirmPasswordError, PASSWORD_RULES, onlyDigits, onlyPhoneChars,
} from '../utils/validation'

// ── MemorialsScreen (PRIVATE) ────────────────────────────────────────────────
// Shows ONLY the signed-in user's own memorials. Privacy is enforced in the
// database (RLS in supabase/memorials-private.sql); the app also filters by owner.
export function MemorialsScreen({ onNavigate, onBack, modal }) {
  const { user, userKey } = useApp()
  const { t } = usePrefs()
  const ownerKey = userKey || user?.id // works whether AppContext exposes userKey or not
  const { memorials, loading, reload } = useMemorials(ownerKey)
  const { blocks } = useBlocks()
  const creating = modal === 'create'
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [deathDate, setDeathDate] = useState('')
  const [blockId, setBlockId] = useState('')
  const [lotNo, setLotNo] = useState('')
  const [tribute, setTribute] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const { touch, reset, setTried, shown } = useValidation()

  function resetForm() {
    setFullName(''); setBirthDate(''); setDeathDate('')
    setBlockId(''); setLotNo(''); setTribute(''); setNotice('')
    reset()
  }

  const block = blocks.find((b) => b.id === blockId)
  const errors = {
    fullName: nameError(fullName, { label: 'Name of deceased' }),
    birthDate: dateError(birthDate, { label: 'Birth date' }),
    deathDate: dateError(deathDate, { label: 'Death date' }) || dateOrderError(birthDate, deathDate),
    blockId: lotNo && !blockId ? 'Choose the block for this lot.' : '',
    lotNo: integerError(lotNo, { label: 'Lot number', required: false, max: block?.maxLot || 99999 }),
    tribute: textError(tribute, { label: 'Tribute', max: 500 }),
  }
  const err = shown(errors)

  useEffect(() => {
    if (!creating) resetForm()
  }, [creating])

  async function handlePublish() {
    setTried(true)
    if (hasErrors(errors)) return
    setSubmitting(true)
    try {
      await api.createMemorial(
        { name: fullName.trim(), birthDate, deathDate, blockId, lotNo, quote: tribute.trim(), userId: ownerKey },
        ownerKey,
      )
      resetForm()
      onBack('memorials')
      reload()
    } catch (err) {
      setNotice(err.message || t('mem.submitErr'))
    } finally {
      setSubmitting(false)
    }
  }

  if (creating) return (
    <div className="screen active" style={{ background:'var(--cream)' }}>
      <div className="hdr hdr-row" style={{ flexShrink:0 }}>
        <button className="back-btn" onClick={() => { resetForm(); onBack('memorials') }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2>{t('mem.createTitle')}</h2>
      </div>
      <div className="form-wrap">
        <div className="upload-zone">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
          <span>{t('mem.upload')}</span>
        </div>
        <div className="field">
          <label className="lbl">{t('mem.fullName')}</label>
          <input className="inp" placeholder={t('mem.fullNamePh')} maxLength={100} value={fullName} onChange={(e)=>setFullName(e.target.value)} onBlur={touch('fullName')} style={invalidStyle(err('fullName'))}/>
          <FieldError msg={err('fullName')} />
        </div>
        <div className="field">
          <label className="lbl">{t('mem.birth')}</label>
          <input className="inp" type="date" min="1900-01-01" max={todayISO()} value={birthDate} onChange={(e)=>setBirthDate(e.target.value)} onBlur={touch('birthDate')} style={invalidStyle(err('birthDate'))}/>
          <FieldError msg={err('birthDate')} />
        </div>
        <div className="field">
          <label className="lbl">{t('mem.death')}</label>
          <input className="inp" type="date" min={birthDate || '1900-01-01'} max={todayISO()} value={deathDate} onChange={(e)=>setDeathDate(e.target.value)} onBlur={touch('deathDate')} style={invalidStyle(err('deathDate'))}/>
          <FieldError msg={err('deathDate')} />
        </div>
        <div className="field">
          <label className="lbl">{t('mem.block')}</label>
          <select className="inp" value={blockId} onChange={(e)=>setBlockId(e.target.value)} onBlur={touch('blockId')} style={invalidStyle(err('blockId'))}>
            <option value="">{t('mem.selectBlock')}</option>
            {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <FieldError msg={err('blockId')} />
        </div>
        <div className="field">
          <label className="lbl">{t('mem.lot')}</label>
          <input className="inp" inputMode="numeric" maxLength={5} placeholder={t('mem.lotPh')} value={lotNo} onChange={(e)=>setLotNo(onlyDigits(e.target.value))} onBlur={touch('lotNo')} style={invalidStyle(err('lotNo'))}/>
          <FieldError msg={err('lotNo')} />
        </div>
        <div className="field mb-20">
          <label className="lbl">{t('mem.tribute')}</label>
          <textarea className="inp" rows="4" maxLength={500} placeholder={t('mem.tributePh')} value={tribute} onChange={(e)=>setTribute(e.target.value)} onBlur={touch('tribute')} style={invalidStyle(err('tribute'))}/>
          <FieldError msg={err('tribute')} />
        </div>
        {notice && <p style={{ color:'#DC2626', fontSize:13, margin:'0 0 12px' }}>{notice}</p>}
        <button className="btn btn-primary btn-full" onClick={handlePublish} disabled={submitting}>
          {submitting ? t('mem.submitting') : t('mem.publish')}
        </button>
        <p style={{ fontSize:12, color:'var(--stone)', textAlign:'center', marginTop:10 }}>
          {t('mem.formNote')}
        </p>
      </div>
    </div>
  )

  return (
    <div className="screen active" style={{ background:'var(--cream)' }}>
      <div className="hdr flex justify-between items-center" style={{ flexDirection:'row' }}>
        <div>
          <h2 style={{ margin:0 }}>{t('mem.title')}</h2>
          <p className="f12" style={{ margin:'2px 0 0', color:'rgba(255,255,255,.75)' }}>{t('mem.private')}</p>
        </div>
        <button onClick={() => onNavigate('memorials', {}, { modal: 'create' })} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:10, padding:'6px 14px', color:'#fff', fontFamily:'var(--ff-b)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> {t('mem.create')}
        </button>
      </div>
      <div className="scroll-body">
        {loading && <p className="f13 c-stone" style={{ textAlign:'center', padding:20 }}>{t('mem.loading')}</p>}
        {!loading && memorials.length === 0 && (
          <div className="memorial-card" style={{ textAlign:'center' }}>
            <span style={{ fontSize:32 }}>🕊️</span>
            <p style={{ margin:'6px 0 0', fontFamily:'var(--ff-d)', fontSize:16, fontWeight:700, color:'var(--charcoal)' }}>{t('mem.empty')}</p>
            <p className="f13 c-stone" style={{ margin:'4px 0 0' }}>{t('mem.emptyBody')}</p>
          </div>
        )}
        {memorials.map(m => (
          <div key={m.id || m.name} className="memorial-card">
            <div className="flex gap-12 items-center mb-10">
              <div className="mem-photo">{m.emoji}</div>
              <div>
                <p style={{ margin:0, fontFamily:'var(--ff-d)', fontSize:16, fontWeight:700, color:'var(--charcoal)' }}>{m.name}</p>
                <p className="f12 c-stone" style={{ margin:'2px 0 0' }}>{m.dates}</p>
                {m.status && !['approved', 'featured'].includes(m.status) && (
                  <span className={`badge badge-${m.status === 'rejected' ? 'rejected' : 'pending'}`} style={{ display:'inline-block', marginTop:4 }}>
                    {m.status === 'rejected' ? t('mem.rejected') : t('mem.pending')}
                  </span>
                )}
              </div>
            </div>
            <p className="f13 c-slate italic lh-16" style={{ margin:'0 0 12px' }}>{m.quote}</p>
            <div className="mem-actions-row">
              <div className="mem-react">
                <button className="react-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#D4827A" stroke="#D4827A" strokeWidth="1"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> {m.likes}
                </button>
                <button className="react-btn">💬 {m.comments}</button>
              </div>
              <button className="share-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> {t('mem.share')}
              </button>
            </div>
          </div>
        ))}
      </div>
      <BottomNav active="memorials" onNavigate={onNavigate} />
    </div>
  )
}

// ── ProfileScreen ────────────────────────────────────────────────────────────
const ICONS = {
  edit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  reservations: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>,
  password: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  bell: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  globe: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  sun: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>,
  moon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
}

const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B9EA0" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
const Check = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>

// Shared small modal shell — dims the background, centers a card.
function SettingsModal({ title, onClose, children }) {
  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e)=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:17, fontFamily:'var(--ff-d)', color:'var(--charcoal)' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, lineHeight:1, color:'#8B9EA0' }}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// One tappable row in a choice list (Language / Theme).
function ChoiceRow({ selected, title, sub, icon, onClick }) {
  return (
    <button type="button" className={`choice-row${selected ? ' selected' : ''}`} onClick={onClick}>
      {icon && <span className="settings-icon" style={{ flexShrink:0 }}>{icon}</span>}
      <span style={{ flex:1, textAlign:'left' }}>
        <span className="settings-title" style={{ display:'block' }}>{title}</span>
        {sub && <span className="settings-sub" style={{ display:'block' }}>{sub}</span>}
      </span>
      {selected && <Check />}
    </button>
  )
}

function LanguageModal({ onClose }) {
  const { lang, setLang, t } = usePrefs()
  return (
    <SettingsModal title={t('profile.language')} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {LANGUAGES.map((l) => (
          <ChoiceRow key={l.id} selected={lang === l.id} title={l.label} sub={l.native !== l.label ? l.native : null}
            onClick={() => { setLang(l.id); onClose() }} />
        ))}
      </div>
      {lang !== 'en' && <p style={{ fontSize:12, color:'var(--stone)', margin:'12px 0 0' }}>{t('lang.note')}</p>}
    </SettingsModal>
  )
}

function ThemeModal({ onClose }) {
  const { theme, setTheme, t } = usePrefs()
  const options = [
    { id:'light', title:t('theme.light'), sub:t('theme.lightSub'), icon:ICONS.sun },
    { id:'dark', title:t('theme.dark'), sub:t('theme.darkSub'), icon:ICONS.moon },
    { id:'system', title:t('theme.system'), sub:t('theme.systemSub'), icon:ICONS.globe },
  ]
  return (
    <SettingsModal title={t('profile.theme')} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {options.map((o) => (
          <ChoiceRow key={o.id} selected={theme === o.id} title={o.title} sub={o.sub} icon={o.icon}
            onClick={() => setTheme(o.id)} />
        ))}
      </div>
    </SettingsModal>
  )
}

function EditProfileModal({ user, onClose }) {
  const { updateProfile } = useApp()
  const { t } = usePrefs()
  const [fullName, setFullName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { touch, setTried, shown } = useValidation()

  const errors = {
    fullName: nameError(fullName, { label: 'Full name' }),
    phone: phoneError(phone),
  }
  const err = shown(errors)

  async function handleSave() {
    setTried(true)
    if (hasErrors(errors)) return
    setBusy(true); setError('')
    try {
      await updateProfile({ fullName: fullName.trim(), phone: phone.trim() })
      onClose()
    } catch (err) {
      setError(err.message || t('edit.err'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsModal title={t('profile.edit')} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div>
          <input className="inp" placeholder={t('edit.fullName')} maxLength={100} value={fullName} onChange={(e)=>setFullName(e.target.value)} onBlur={touch('fullName')} style={invalidStyle(err('fullName'))} />
          <FieldError msg={err('fullName')} />
        </div>
        <div>
          <input className="inp" placeholder={t('edit.phone')} inputMode="tel" value={phone} onChange={(e)=>setPhone(onlyPhoneChars(e.target.value))} onBlur={touch('phone')} style={invalidStyle(err('phone'))} />
          <FieldError msg={err('phone')} />
        </div>
        <input className="inp" value={user?.email || ''} disabled style={{ opacity:.6 }} />
        <p style={{ fontSize:12, color:'#8B9EA0', margin:0 }}>{t('edit.emailNote')}</p>
        {error && <p style={{ color:'#DC2626', fontSize:13, margin:0 }}>{error}</p>}
        <button className="btn btn-primary btn-full" onClick={handleSave} disabled={busy}>
          {busy ? t('edit.saving') : t('edit.save')}
        </button>
      </div>
    </SettingsModal>
  )
}

function ManagePasswordModal({ onClose }) {
  const { changePassword } = useApp()
  const { t } = usePrefs()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { touch, setTried, shown } = useValidation()

  const errors = {
    newPassword: passwordError(newPassword),
    confirmPassword: confirmPasswordError(newPassword, confirmPassword),
  }
  const err = shown(errors)

  async function handleSave() {
    setError('')
    setTried(true)
    if (hasErrors(errors)) return

    setBusy(true)
    try {
      await changePassword(newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.message || t('pw.err'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsModal title={t('profile.password')} onClose={onClose}>
      {success ? (
        <p style={{ color:'#166534', fontSize:14 }}>{t('pw.success')}</p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <input className="inp" placeholder={t('pw.new')} type="password" maxLength={72} autoComplete="new-password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} onBlur={touch('newPassword')} style={invalidStyle(err('newPassword'))} />
            <FieldError msg={err('newPassword')} />
          </div>
          <ul style={{ listStyle:'none', padding:0, margin:0, fontSize:12 }}>
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(newPassword)
              return (
                <li key={r.label} style={{ color: ok ? '#16A34A' : '#8B9EA0', marginBottom:2 }}>
                  {ok ? '✓' : '•'} {r.label.charAt(0).toUpperCase() + r.label.slice(1)}
                </li>
              )
            })}
          </ul>
          <div>
            <input className="inp" placeholder={t('pw.confirm')} type="password" maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} onBlur={touch('confirmPassword')} style={invalidStyle(err('confirmPassword'))} />
            <FieldError msg={err('confirmPassword')} />
          </div>
          {error && <p style={{ color:'#DC2626', fontSize:13, margin:0 }}>{error}</p>}
          <button className="btn btn-primary btn-full" onClick={handleSave} disabled={busy}>
            {busy ? t('pw.updating') : t('pw.update')}
          </button>
        </div>
      )}
    </SettingsModal>
  )
}

export function ProfileScreen({ onNavigate, onBack, onLogout, modal }) {
  const { user } = useApp()
  const { t, lang, theme } = usePrefs()
  const profile = user || { name:'', email:'', phone:'' }
  const openModal = modal || null

  const langLabel = LANGUAGES.find((l) => l.id === lang)?.label || 'English'
  const themeLabel = theme === 'dark' ? t('theme.dark') : theme === 'system' ? t('theme.system') : t('theme.light')

  const groups = [
    { label: t('profile.account'), items: [
      { id:'edit-profile', title:t('profile.edit'), sub:t('profile.editSub'), icon:ICONS.edit },
      { id:'my-reservations', title:t('profile.reservations'), sub:t('profile.reservationsSub'), icon:ICONS.reservations },
      { id:'manage-password', title:t('profile.password'), sub:t('profile.passwordSub'), icon:ICONS.password },
      { id:'notifications', title:t('profile.notifications'), sub:t('profile.notificationsSub'), icon:ICONS.bell },
    ]},
    { label: t('profile.preferences'), items: [
      { id:'language', title:t('profile.language'), sub:langLabel, icon:ICONS.globe },
      { id:'theme', title:t('profile.theme'), sub:themeLabel, icon:theme === 'dark' ? ICONS.moon : ICONS.sun },
    ]},
  ]

  function handleItemClick(id) {
    if (['edit-profile', 'manage-password', 'language', 'theme'].includes(id)) {
      onNavigate('profile', {}, { modal: id })
    } else if (id === 'my-reservations') {
      onNavigate('my-reservations')
    }
    // 'notifications': not built out yet — no-op for now.
  }

  return (
    <div className="screen active" style={{ background:'var(--cream)' }}>
      <div className="profile-hdr">
        <h2>{t('profile.title')}</h2>
        <div className="flex gap-12 items-center">
          <div className="avatar-box">👤</div>
          <div>
            <p className="profile-name">{profile.name}</p>
            <p className="profile-sub">{profile.email}</p>
            {profile.phone && <p className="profile-sub">{profile.phone}</p>}
          </div>
        </div>
      </div>
      <div className="scroll-body">
        {groups.map(g => (
          <div key={g.label} className="settings-group">
            <p className="settings-label">{g.label}</p>
            <div className="settings-card">
              {g.items.map(item => (
                <div key={item.id} className="settings-item" onClick={() => handleItemClick(item.id)} style={{ cursor:'pointer' }}>
                  <div className="settings-icon">{item.icon}</div>
                  <div className="flex-1">
                    <p className="settings-title">{item.title}</p>
                    <p className="settings-sub">{item.sub}</p>
                  </div>
                  <ChevronRight/>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button className="logout-btn" onClick={onLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> {t('profile.logout')}
        </button>
      </div>
      <BottomNav active="profile" onNavigate={onNavigate} />

      {openModal === 'edit-profile' && <EditProfileModal user={user} onClose={() => onBack('profile')} />}
      {openModal === 'manage-password' && <ManagePasswordModal onClose={() => onBack('profile')} />}
      {openModal === 'language' && <LanguageModal onClose={() => onBack('profile')} />}
      {openModal === 'theme' && <ThemeModal onClose={() => onBack('profile')} />}
    </div>
  )
}