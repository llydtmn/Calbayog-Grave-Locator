// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY NOTICE — what personal data GraveLocator collects, why, who sees it,
// and the user's rights under the Data Privacy Act of 2012 (RA 10173).
// Shown from Sign Up (consent checkbox) and Profile → Privacy Notice.
// When you change the wording, bump PRIVACY_VERSION — the version a user agreed
// to is saved with their account at sign-up.
// ─────────────────────────────────────────────────────────────────────────────
import { PARK } from '../config/constants'

export const PRIVACY_VERSION = '2026-10-21'
const UPDATED = 'October 21, 2026'

const SECTIONS = [
  {
    title: 'Who we are',
    body: [
      `GraveLocator is the lot locator and reservation app of ${PARK.name}, ${PARK.address}. The park office is responsible for the personal information you give through this app.`,
    ],
  },
  {
    title: 'What we collect',
    list: [
      'Account details: full name, email address, mobile number and password (passwords are stored hashed — nobody, including staff, can read them).',
      'Reservation details: applicant name, email, contact number, chosen lot, preferred date, payment option and notes.',
      'Payment details: GCash receipt photos you upload and the amounts paid. We never ask for or store your GCash PIN, card or bank details.',
      'Memorials you create: name, dates and tribute message of your loved one.',
      'App activity: when you last used the app (to show staff if an account is active), and lots you recently viewed (saved only on your own device).',
    ],
  },
  {
    title: 'Why we collect it',
    list: [
      'To create and secure your account.',
      'To process lot reservations and verify payments.',
      'To contact you about your reservation or installment payments.',
      'To keep accurate records required by the park office.',
    ],
    after: 'We do not use your data for advertising, and we do not sell or share it with other companies.',
  },
  {
    title: 'Who can see it',
    list: [
      'You — your own account, reservations, payments and memorials only.',
      'Authorized park office staff — to process reservations and payments.',
      'Other users can NOT see your personal information. Your memorials are private to your account.',
      'The public lot map only shows each lot\'s status and the names (and dates) of those interred, taken from the park\'s interment records. Lot buyers\' and owners\' names are never shown.',
    ],
  },
  {
    title: 'How we protect it',
    list: [
      'All connections are encrypted (HTTPS).',
      'Data is stored in a secured database (Supabase) with access rules, so each account can only read its own records.',
      'Receipt photos are kept private and open only through links that expire after 10 minutes.',
      'Strong passwords and email verification are required for every account.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'We keep your information while your account is active and as long as the park office needs it for reservation and payment records. When your account is deleted, your profile, reservations, payments, memorials and receipt photos are permanently removed.',
    ],
  },
  {
    title: 'Your rights',
    body: ['Under the Data Privacy Act of 2012 (RA 10173), you have the right to:'],
    list: [
      'Be informed about how your data is used (this notice).',
      'Access your data — view it anytime in your Profile and My Reservations.',
      'Correct your data — use Profile → Edit Profile.',
      'Object or withdraw consent, and have your data deleted — contact the park office to delete your account.',
      'File a complaint with the National Privacy Commission (privacy.gov.ph).',
    ],
  },
  {
    title: 'Contact us',
    body: [
      `For privacy questions or to request account deletion, contact ${PARK.name} at ${PARK.tel}, or visit the park office at ${PARK.address}.`,
    ],
  },
]

export function PrivacyNoticeContent() {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--slate, #334155)' }}>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--stone, #8B9EA0)' }}>Last updated: {UPDATED}</p>
      {SECTIONS.map((s) => (
        <section key={s.title} style={{ marginBottom: 14 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--charcoal, #1E293B)' }}>{s.title}</h4>
          {(s.body || []).map((p, i) => <p key={i} style={{ margin: '0 0 6px' }}>{p}</p>)}
          {s.list && (
            <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
              {s.list.map((li, i) => <li key={i} style={{ marginBottom: 4 }}>{li}</li>)}
            </ul>
          )}
          {s.after && <p style={{ margin: 0, fontWeight: 600 }}>{s.after}</p>}
        </section>
      ))}
    </div>
  )
}

// Scrollable pop-up (same look as the Profile settings pop-ups).
export default function PrivacyNoticeModal({ onClose, onAgree }) {
  return (
    <div className="settings-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Privacy Notice">
      <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--ff-d)', color: 'var(--charcoal)' }}>Privacy Notice</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: '#8B9EA0' }}>&times;</button>
        </div>
        <div style={{ overflowY: 'auto', paddingRight: 4 }}>
          <PrivacyNoticeContent />
        </div>
        <button className="btn btn-primary btn-full" style={{ marginTop: 12 }} onClick={onAgree || onClose}>
          {onAgree ? 'I Agree' : 'Close'}
        </button>
      </div>
    </div>
  )
}