import { useState, useEffect } from 'react'
import { useBlocks, usePricing } from '../hooks'
import { useApp } from '../context/AppContext'
import { CLASSIFICATION } from '../config/constants'
import { statusLabel, statusMeta, isSellable } from '../config/status'
import { peso, percent, intermentMarks } from '../utils/format'
import { addRecentlyViewed } from '../hooks/useRecentlyViewed'
import { getLot, searchDeceased, deceasedRecordsOf } from '../api'

// 'YYYY-MM-DD' → "Mar 4, 2019" (read as a local date, so it never shifts a day)
function longDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── SearchScreen ─────────────────────────────────────────────────────────────
// One box searches two things:
//   • Names of the deceased (lots.deceased_names, server-side, similar
//     spellings too) → tap a name to open that lot's details.
//   • Blocks / lawns → tap to open the block on the map.
const NAME_SEARCH_DELAY = 300 // ms after the last keystroke

// Bold the parts of `text` that match a typed word.
function Highlight({ text, words }) {
  if (!words.length) return text
  const esc = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = String(text).split(new RegExp(`(${esc.join('|')})`, 'ig'))
  return parts.map((part, i) => (i % 2 ? <strong key={i} style={{ color: 'var(--sage)' }}>{part}</strong> : part))
}

// The typed text is saved on this page's history entry, so pressing Back from
// a lot brings the search back exactly as it was (a fresh visit starts empty).
const savedQuery = () => {
  const st = window.history.state
  return typeof st?.params?.q === 'string' ? st.params.q : ''
}
const saveQuery = (q) => {
  const st = window.history.state
  if (st && typeof st === 'object') window.history.replaceState({ ...st, params: { ...(st.params || {}), q } }, '')
}

export function SearchScreen({ onNavigate, onBack }) {
  const [query, setQuery] = useState(savedQuery)
  const { blocks } = useBlocks()
  const { setActiveBlockId, setActiveLot } = useApp()
  const [names, setNames] = useState({ q: '', results: [], loading: false, error: '' })

  const q = query.trim().toLowerCase()
  const words = q.replace(/[^a-z0-9ñ]+/g, ' ').split(' ').filter(Boolean)
  const blockResults = q
    ? blocks.filter(b =>
        b.name.toLowerCase().includes(q) ||
        (b.lawnName || '').toLowerCase().includes(q) ||
        (b.subAreas || []).some(s => s.toLowerCase().includes(q))
      )
    : []

  // Name search runs on the server, a moment after typing stops.
  useEffect(() => {
    saveQuery(query)
    const text = query.trim()
    if (text.length < 2) { setNames({ q: text, results: [], loading: false, error: '' }); return undefined }
    setNames((n) => ({ ...n, loading: true, error: '' }))
    let alive = true
    const timer = setTimeout(() => {
      searchDeceased(text)
        .then((results) => { if (alive) setNames({ q: text, results, loading: false, error: '' }) })
        .catch((e) => { if (alive) setNames({ q: text, results: [], loading: false, error: e?.message || 'Name search is unavailable right now.' }) })
    }, NAME_SEARCH_DELAY)
    return () => { alive = false; clearTimeout(timer) }
  }, [query])

  const openBlock = (b) => { setActiveBlockId(b.id); onNavigate('map', { blockId: b.id }) }
  const openNameResult = (r) => {
    const block = blocks.find((b) => b.id === r.blockId)
    const activeLot = {
      blockId: r.blockId,
      blockName: block?.name || r.blockId,
      lawnName: block?.lawnName || '',
      lotNo: r.lotNo,
      classification: r.classification,
      status: r.status,
      intermentCount: r.intermentCount,
    }
    setActiveLot(activeLot)
    onNavigate('plotdetail', { activeLot })
  }

  const nameSearchDone = names.q === query.trim() && !names.loading
  const nothingFound = q.length >= 2 && nameSearchDone && !names.error && names.results.length === 0 && blockResults.length === 0

  return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <div className="hdr" style={{ padding: '14px 16px' }}>
        <div className="flex gap-10 items-center">
          <button className="back-btn" onClick={() => onBack('home')} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="search-inp-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className="search-inp-ghost"
              placeholder="Search a name, block or lawn…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus={!query}
            />
          </div>
        </div>
      </div>

      {!q ? (
        <div className="scroll-body">
          <p className="f13 c-stone" style={{ margin: '0 0 14px' }}>
            Type the name of a loved one (e.g. <em>Rosales</em> or <em>Romeo Rosales</em>) to find their lot, or a block / lawn name.
          </p>
          <p className="f12 c-stone fw7" style={{ textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Browse Lawns</p>
          {['Timeless Memory Lawn','Everlasting Lawn','Eternal Lawn','Perpetual Lawn'].map(s => (
            <div key={s} className="recent-item" onClick={() => setQuery(s)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B9EA0" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span>{s}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="scroll-body">
          {/* Names of the deceased */}
          {q.length >= 2 && (names.loading || names.results.length > 0 || names.error) && (
            <>
              <p className="f12 c-stone fw7" style={{ textTransform:'uppercase', letterSpacing:1, margin:'0 0 8px' }}>
                Names {names.results.length > 0 && `· ${names.results.length}${names.results.length >= 30 ? '+' : ''}`}
              </p>
              {names.loading && names.results.length === 0 && <p className="f13 c-stone" style={{ margin:'0 0 14px' }}>Searching names…</p>}
              {names.error && <p className="f13" style={{ color:'#DC2626', margin:'0 0 14px' }}>{names.error}</p>}
              {names.results.map((r, i) => {
                const block = blocks.find((b) => b.id === r.blockId)
                const meta = statusMeta(r.status)
                return (
                  <div key={`${r.lotId}-${i}`} className="card search-name-card" style={{ cursor:'pointer', marginBottom:10 }} onClick={() => openNameResult(r)}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                      <div style={{ minWidth:0 }}>
                        <p className="fw7 f15 c-charcoal" style={{ margin:'0 0 2px' }}>🕊️ <Highlight text={r.name} words={words} /></p>
                        <p className="f12 c-stone" style={{ margin:0 }}>
                          {r.deathDate && <>d. {longDate(r.deathDate)} · </>}
                          {block?.name || r.blockId} · Lot {r.lotNo ?? '—'}{block?.lawnName ? ` · ${block.lawnName}` : ''}
                        </p>
                      </div>
                      <span className="lg-status-pill" style={{ background:meta.fill, color:meta.text, borderColor:meta.border, flexShrink:0 }}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Blocks & lawns */}
          {blockResults.length > 0 && (
            <p className="f12 c-stone fw7" style={{ textTransform:'uppercase', letterSpacing:1, margin:'14px 0 8px' }}>Blocks & Lawns</p>
          )}
          {blockResults.map(b => (
            <div key={b.id} className="card" style={{ cursor:'pointer', marginBottom:10 }} onClick={() => openBlock(b)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <p className="fw7 f15 c-charcoal" style={{ margin:'0 0 2px' }}>{b.name}</p>
                  <p className="f12 c-stone" style={{ margin:'0 0 6px' }}>{b.lawnName || 'Lawn area'}{b.maxLot ? ` · ${b.maxLot} lots` : ''}</p>
                  <span className="badge badge-available">{(b.classifications || []).join(' · ')}</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); openBlock(b) }}>View Map</button>
              </div>
            </div>
          ))}

          {(nothingFound || (q.length < 2 && blockResults.length === 0)) && (
            <div style={{ textAlign:'center', padding:40 }}>
              <p style={{ fontSize:32, marginBottom:12 }}>🔍</p>
              <p className="f14 c-stone">{q.length < 2 ? 'Type at least 2 letters to search names.' : `No names or blocks match "${query}"`}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── PlotDetailScreen ─────────────────────────────────────────────────────────
// Shows a lot's block, lawn, classification, status and reference pricing, and
// lets the user locate it on the map. Lot context comes from the map
// drill-down. Available lots also offer a "Reserve Lot" action that hands the
// lot off to the reservation flow (frontend-only demo — see
// BACKEND_INTEGRATION.md).
export function PlotDetailScreen({ onNavigate, onBack, routeLot }) {
  const { activeLot, setActiveLot, setActiveBlockId, user, userKey } = useApp()
  const { blocks } = useBlocks()
  const { pricing } = usePricing()

  // The full lot object is kept in history.state for normal navigation. A
  // direct URL may only have blockId/lotNo, so keep a safe sample fallback
  // rather than breaking the page while data is loading.
  const routeActiveLot = routeLot?.activeLot || null
  const routeBlock = routeLot?.blockId ? blocks.find((b) => b.id === routeLot.blockId) : null
  const lot = routeActiveLot || activeLot || (routeLot?.blockId && routeLot?.lotNo ? {
    blockId: routeLot.blockId,
    blockName: routeBlock?.name || `Block ${String(routeLot.blockId).replace(/^block[-_]/i, '')}`,
    lawnName: routeBlock?.lawnName || '',
    lotNo: routeLot.lotNo,
    classification: CLASSIFICATION.REGULAR,
    status: 'available',
    intermentCount: 0,
  } : {
    blockId: 'block-3', blockName: 'Block 3', lawnName: 'Timeless Memory Lawn',
    lotNo: 204, classification: CLASSIFICATION.REGULAR, status: 'available', intermentCount: 0,
  })
  // Always show the latest status + names from the database (the lot passed
  // in may be an older copy, e.g. from Recently Viewed or a search result).
  const [fresh, setFresh] = useState(null)
  const hasLotRef = !!(routeActiveLot || activeLot || (routeLot?.blockId && routeLot?.lotNo))
  useEffect(() => {
    setFresh(null)
    if (!hasLotRef || !lot.blockId || lot.lotNo == null) return undefined
    let alive = true
    getLot(lot.blockId, lot.lotNo).then((l) => { if (alive && l) setFresh(l) }).catch(() => {})
    return () => { alive = false }
  }, [hasLotRef, lot.blockId, lot.lotNo])
  const shown = fresh
    ? { ...lot, status: fresh.status, classification: fresh.classification, intermentCount: fresh.intermentCount, deceasedNames: fresh.deceasedNames, deceasedRecords: fresh.deceasedRecords }
    : lot
  const deceased = deceasedRecordsOf(shown)

  const meta = statusMeta(shown.status)
  const marks = intermentMarks(shown.intermentCount)
  const p = pricing?.installment?.[shown.classification] || null
  const interest = pricing?.interest || { '1yr': 0.18, '2yr': 0.24, '3yr': 0.34 }

  const planRows = [['1yr', '1 Year'], ['2yr', '2 Years'], ['3yr', '3 Years']]

  useEffect(() => {
    if (routeActiveLot && activeLot !== routeActiveLot) {
      setActiveLot(routeActiveLot)
    } else if (routeLot?.blockId && routeLot?.lotNo && !activeLot) {
      setActiveLot(lot)
    }
  }, [routeActiveLot, routeLot?.blockId, routeLot?.lotNo, activeLot, lot, setActiveLot])

  // Save this lot to "Recently Viewed" (skip the built-in sample fallback lot).
  const isRealLot = !!(routeActiveLot || activeLot || (routeLot?.blockId && routeLot?.lotNo))
  const recentOwner = userKey || user?.id
  useEffect(() => {
    if (isRealLot) addRecentlyViewed(recentOwner, lot)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealLot, recentOwner, lot.blockId, lot.lotNo])

  const locateOnMap = () => {
    if (lot.blockId) setActiveBlockId(lot.blockId)
    onNavigate('map', { blockId: lot.blockId })
  }

  return (
    <div className="screen active" style={{ background:'var(--cream)' }}>
      <div className="hdr hdr-row" style={{ flexShrink:0 }}>
        <button className="back-btn" onClick={() => onBack('map', lot.blockId ? { blockId: lot.blockId } : {})} aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2>Lot Details</h2>
      </div>

      <div className="plot-photo">
        <span style={{ fontSize:40 }}>🪦</span>
        <span className="f12 c-sage">{lot.blockName} · Lot {lot.lotNo ?? '—'}</span>
      </div>

      <div className="scroll-body">
        <div className="card" style={{ marginBottom:14 }}>
          <div className="info-grid">
            {[
              ['Block', lot.blockName],
              ['Lawn', lot.lawnName || '—'],
              ['Lot No.', lot.lotNo ?? '—'],
              ['Class', shown.classification],
              ['Area', p?.areaSqm ? `${p.areaSqm} m²` : '—'],
              ['Price / m²', p ? peso(p.pricePerSqm) : '—'],
            ].map(([l,v]) => (
              <div key={l} className="info-cell">
                <div className="info-lbl">{l}</div>
                <div className="info-val">{v}</div>
              </div>
            ))}
            <div className="info-cell">
              <div className="info-lbl">Status</div>
              <div className="info-val">
                <span className="lg-status-pill" style={{ background:meta.fill, color:meta.text, borderColor:meta.border }}>
                  {statusLabel(shown.status)}{marks ? ` ${marks}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Names of the deceased (from the office's records) */}
        {deceased.length > 0 && (
          <div className="card" style={{ marginBottom:14 }}>
            <p className="section-label" style={{ margin:'0 0 8px' }}>Interred Here</p>
            {deceased.map((d, i) => (
              <div key={i} className="deceased-row" style={{ alignItems:'flex-start' }}>
                <span aria-hidden="true">🕊️</span>
                <span>
                  <span className="fw7 c-charcoal" style={{ display:'block' }}>{d.name}</span>
                  {(d.deathDate || d.burialDate) && (
                    <span className="f12 c-stone" style={{ display:'block' }}>
                      {[d.deathDate && `Died ${longDate(d.deathDate)}`, d.burialDate && `Buried ${longDate(d.burialDate)}`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pricing — reference only (the office handles all transactions). */}
        <div className="card" style={{ marginBottom:14 }}>
          <p className="section-label" style={{ margin:'0 0 4px' }}>Pricing (for reference)</p>
          <p className="f12 c-stone" style={{ margin:'0 0 10px' }}>Indicative figures only. Contact the park office to transact.</p>
          {p ? (
            <>
              {[
                ['Total Price', peso(p.totalPrice)],
                ['MCF', peso(p.mcf)],
                ['30% Down Payment', peso(p.downPayment30)],
                ['Total Cash Outlay', peso(p.cashOutlay)],
                ['Balance', peso(p.balance)],
              ].map(([l,v]) => (
                <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
              ))}
              <div className="fee-row total" style={{ borderTop:'1px solid var(--lgray)', marginTop:6, paddingTop:8 }}>
                <span className="fee-lbl fw7">Installment (monthly)</span><span className="fee-val">&nbsp;</span>
              </div>
              {planRows.map(([key,label]) => (
                <div key={key} className="fee-row">
                  <span className="fee-lbl">{label} <span style={{ color:'var(--gold)', fontWeight:700 }}>({percent(interest[key])})</span></span>
                  <span className="fee-val">{peso(p.monthly[key])}/mo</span>
                </div>
              ))}
            </>
          ) : <p className="f13 c-stone">No reference pricing for this classification.</p>}
        </div>

        {isSellable(shown.status) && (
          <button className="btn btn-gold btn-full" style={{ marginBottom: 10 }} onClick={() => onNavigate('reserve-form', { activeLot: shown })}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            Reserve Lot
          </button>
        )}
      </div>
    </div>
  )
}