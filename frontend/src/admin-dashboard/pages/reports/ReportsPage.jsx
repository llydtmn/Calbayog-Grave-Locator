// ─────────────────────────────────────────────────────────────────────────────
// REPORTS & ANALYTICS — one tab per report the park office needs:
//   Lot Status · Interments · Reservations · Installments · Collections
// Each tab owns its filters, CSV export and Print / Save-as-PDF.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { PARK } from '../../config/constants'
import LotStatusReport from './LotStatusReport'
import IntermentReport from './IntermentReport'
import ReservationsReport from './ReservationsReport'
import InstallmentReport from './InstallmentReport'
import CollectionsReport from './CollectionsReport'

const TABS = [
  { id: 'lots', label: 'Lot Status', Component: LotStatusReport },
  { id: 'interments', label: 'Interments', Component: IntermentReport },
  { id: 'reservations', label: 'Reservations', Component: ReservationsReport },
  { id: 'installments', label: 'Installments', Component: InstallmentReport },
  { id: 'collections', label: 'Collections', Component: CollectionsReport },
]
const TAB_KEY = 'gl-admin:report-tab'

function loadTab() {
  try {
    const t = sessionStorage.getItem(TAB_KEY)
    return TABS.some((x) => x.id === t) ? t : TABS[0].id
  } catch { return TABS[0].id }
}

export default function ReportsPage() {
  const [tab, setTab] = useState(loadTab)
  const pick = (id) => { setTab(id); try { sessionStorage.setItem(TAB_KEY, id) } catch { /* ignore */ } }
  const Active = (TABS.find((t) => t.id === tab) || TABS[0]).Component

  return (
    <div className="reports-page">
      <div className="page-header no-print">
        <div><h2>Reports & Analytics</h2><p>Reports for {PARK.name}: lots, interments, reservations and collections.</p></div>
      </div>

      <div className="pay-tabs no-print" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`pay-tab${tab === t.id ? ' active' : ''}`} onClick={() => pick(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <Active />
    </div>
  )
}
