import { useState, useEffect } from 'react'
import BottomNav from '../components/BottomNav'
import LotGrid from '../components/LotGrid'
import MapLegend from '../components/MapLegend'
import StatusFilter from '../components/StatusFilter'
import SiteMap from '../components/SiteMap'
import MapPreview from '../components/MapPreview'
import { useApp } from '../context/AppContext'
import { useBlocks, useLots } from '../hooks'
import { usePrefs } from '../context/PrefsContext'
import { useRecentlyViewed, timeAgo } from '../hooks/useRecentlyViewed'
import { statusMeta } from '../config/status'
import * as api from '../api'

// ── HomeScreen ───────────────────────────────────────────────────────────────
export function HomeScreen({ onNavigate }) {
  const { blocks } = useBlocks()
  const { setActiveBlockId, setActiveLot, user, userKey } = useApp()
  const { t, lang } = usePrefs()
  const { items: recent, clear: clearRecent } = useRecentlyViewed(userKey || user?.id)

  const quickItems = [
    { label: t('home.findLot'), screen: 'map', bg: 'rgba(12,74,110,.1)', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C4A6E" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    { label: t('home.directory'), screen: 'search', bg: 'rgba(2,132,199,.1)', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.2" fill="#0284C7"/><circle cx="3.5" cy="12" r="1.2" fill="#0284C7"/><circle cx="3.5" cy="18" r="1.2" fill="#0284C7"/></svg> },
    { label: t('home.digitalMemorials'), screen: 'memorials', bg: 'rgba(212,130,122,.1)', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D4827A" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> },
    { label: t('home.myReservations'), screen: 'my-reservations', bg: 'rgba(201,168,76,.14)', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg> },
  ]

  const lawns = blocks.filter(b => b.lawnName)
  const lotTotal = blocks.reduce((s, b) => s + (b.maxLot || 0), 0)

  const openLawn = (b) => { setActiveBlockId(b.id); onNavigate('map', { blockId: b.id }) }

  // Re-open a recently viewed lot with its latest status from the database.
  const openRecent = async (r) => {
    let fresh = null
    try { fresh = await api.getLot(r.blockId, r.lotNo) } catch { /* offline → use saved copy */ }
    const activeLot = {
      blockId: r.blockId, blockName: r.blockName, lawnName: r.lawnName, lotNo: r.lotNo,
      classification: fresh?.classification || r.classification,
      status: fresh?.status || r.status,
      intermentCount: fresh?.intermentCount ?? r.intermentCount,
    }
    setActiveLot(activeLot)
    onNavigate('plotdetail', { activeLot })
  }

  return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <div className="home-hdr">
        <div className="home-top">
          <div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginBottom: 2 }}>{t('home.welcome')}</p>
            <h2 style={{ fontFamily: 'var(--ff-d)', fontSize: 20, color: '#fff', margin: 0 }}>{t('home.hi', { name: user?.name || t('home.there') })}</h2>
          </div>
          <div className="hm-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#38BDF8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </div>
        </div>
        <div className="search-bar-ghost" onClick={() => onNavigate('search')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>{t('home.search')}</span>
        </div>
      </div>

      <div className="scroll-body">
        {/* Explore-the-park hero — opens the full interactive map */}
        <div className="hm-hero" onClick={() => onNavigate('map')}>
          <MapPreview blocks={blocks} />
          <div className="hm-hero-overlay">
            <div>
              <p className="hm-hero-title">{t('home.explore')}</p>
              <p className="hm-hero-sub">{t('home.exploreSub', { blocks: blocks.length, lawns: lawns.length, lots: lotTotal.toLocaleString() })}</p>
            </div>
            <span className="hm-hero-cta">{t('home.openMap')}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </span>
          </div>
        </div>

        <p className="section-label">{t('home.quick')}</p>
        <div className="quick-grid">
          {quickItems.map(q => (
            <div key={q.label} className="quick-btn" onClick={() => onNavigate(q.screen)}>
              <div className="quick-icon" style={{ background: q.bg }}>{q.icon}</div>
              <span className="quick-label">{q.label}</span>
            </div>
          ))}
        </div>

        {/* Browse by Lawn — horizontal cards that open straight to a block */}
        <p className="section-label">{t('home.browseLawn')}</p>
        <div className="hm-lawns">
          {lawns.map(b => (
            <div key={b.id} className="hm-lawn-card" onClick={() => openLawn(b)}>
              <div className="hm-lawn-leaf">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2"><path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>
              </div>
              <p className="hm-lawn-name">{b.lawnName}</p>
              <p className="hm-lawn-meta">{b.name}{b.maxLot ? ` · ${t('home.lots', { n: b.maxLot })}` : ''}</p>
            </div>
          ))}
        </div>

        <div className="hm-recent-head">
          <p className="section-label" style={{ margin: 0 }}>{t('home.recent')}</p>
          {recent.length > 0 && <button type="button" className="hm-recent-clear" onClick={clearRecent}>{t('home.clear')}</button>}
        </div>
        {recent.length === 0 && (
          <div className="card" style={{ textAlign: 'center', marginBottom: 10 }}>
            <p className="f13 c-stone" style={{ margin: 0 }}>{t('home.recentEmpty')}</p>
          </div>
        )}
        {recent.map(r => {
          const meta = r.status ? statusMeta(r.status) : null
          return (
            <div key={`${r.blockId}-${r.lotNo}`} className="card mb-10" onClick={() => openRecent(r)} style={{ cursor: 'pointer', marginBottom: 10 }}>
              <div className="flex justify-between items-center">
                <div className="flex gap-12 items-center" style={{ minWidth: 0 }}>
                  <div className="activity-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p className="fw7 f14 c-charcoal" style={{ margin: 0 }}>{t('home.lotLabel', { block: r.blockName, lot: r.lotNo })}</p>
                    <p className="f12 c-stone" style={{ margin: 0 }}>
                      {[r.lawnName, timeAgo(r.viewedAt, lang)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-12" style={{ flexShrink: 0 }}>
                  {meta && <span className="lg-status-pill" style={{ background: meta.fill, color: meta.text, borderColor: meta.border }}>{meta.label}</span>}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B9EA0" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  )
}

// ── MapScreen ────────────────────────────────────────────────────────────────
// Park view → tap a block → zoom into its lot grid → tap a lot → plot details.
// Park view is a live map (SiteMap) with a red GPS pin per block;
// the block view uses LotGrid, both coloured by
// the central status taxonomy. Deep-links from Search via context.activeBlockId.
export function MapScreen({ onNavigate, onBack, routeBlockId }) {
  const { blocks } = useBlocks()
  const { activeBlockId, setActiveBlockId, setActiveLot } = useApp()
  const { t } = usePrefs()
  const [filter, setFilter] = useState('all')

  // Deep-link: if Search set a block, open straight into its grid.
  useEffect(() => {
    if (routeBlockId && routeBlockId !== activeBlockId) setActiveBlockId(routeBlockId)
  }, [routeBlockId, activeBlockId, setActiveBlockId])


  // When a block is already chosen (URL / Back / Search), go straight to its
  // grid — never flash the park map first (that also caused Leaflet's
  // "_leaflet_pos" error when the half-drawn map was removed).
  const wantedId = routeBlockId || activeBlockId
  const view = wantedId ? blocks.find((x) => x.id === wantedId) || null : null
  const waitingForBlock = !!wantedId && !view

  const { lots } = useLots(view?.id)

  // Status counts for the filter chips.
  const counts = lots.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1
    return acc
  }, { __total: lots.length })

  const openBlock = (b) => {
    setFilter('all')
    setActiveBlockId(b.id)
    onNavigate('map', { blockId: b.id })
  }

  const backToPark = () => {
    setActiveBlockId(null)
    onBack('map')
  }

  const openLot = (lot) => {
    const activeLot = {
      blockId: view.id,
      blockName: view.name,
      lawnName: view.lawnName,
      lotNo: lot.lotNo,
      classification: lot.classification,
      status: lot.status,
      intermentCount: lot.intermentCount,
    }
    setActiveLot(activeLot)
    onNavigate('plotdetail', { activeLot })
  }

  // ── Lot-grid view ──────────────────────────────────────────────────────────
  if (view) {
    return (
      <div className="screen active" style={{ background: 'var(--cream)' }}>
        <div className="hdr hdr-row" style={{ flexShrink: 0 }}>
          <button className="back-btn" onClick={backToPark} aria-label={t('map.back')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h2 style={{ margin: 0 }}>{view.name}</h2>
            {view.lawnName && <p className="f12" style={{ margin: 0, color: 'rgba(255,255,255,.75)' }}>{view.lawnName}</p>}
          </div>
        </div>

        {view.hasGrid ? (
          <div className="pm-zoom" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <StatusFilter value={filter} onChange={setFilter} counts={counts} />
            <div className="lg-grid-scroll">
              <LotGrid blockId={view.id} cols={view.grid?.cols} filter={filter} onSelectLot={openLot} />
            </div>
            <MapLegend compact />
          </div>
        ) : (
          <div className="lg-empty">
            <span className="lg-empty-icon">🗺️</span>
            <p className="fw7 f15 c-charcoal" style={{ margin: '0 0 4px' }}>{t('map.notDigitized')}</p>
            <p className="f13 c-stone" style={{ margin: 0, textAlign: 'center', maxWidth: 260 }}>
              {t('map.notDigitizedBody', { block: `${view.name}${view.lawnName ? ` (${view.lawnName})` : ''}` })}
            </p>
            <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }} onClick={backToPark}>{t('map.backToPark')}</button>
          </div>
        )}

        <BottomNav active="map" onNavigate={onNavigate} />
      </div>
    )
  }

  if (waitingForBlock) {
    return (
      <div className="screen active" style={{ background: 'var(--cream)' }}>
        <div className="hdr"><h2 style={{ margin: 0 }}>{t('map.title')}</h2></div>
        <div className="lg-grid-msg" style={{ padding: 24 }}>…</div>
        <BottomNav active="map" onNavigate={onNavigate} />
      </div>
    )
  }

  // ── Park view ──────────────────────────────────────────────────────────────
  return (
    <div className="screen active" style={{ background: 'var(--cream)' }}>
      <div className="hdr">
        <h2 style={{ marginBottom: 4 }}>{t('map.title')}</h2>
        <p className="f12" style={{ margin: 0, color: 'rgba(255,255,255,.75)' }}>{t('map.hint')}</p>
      </div>

      <SiteMap blocks={blocks} activeBlockId={activeBlockId} onSelectBlock={openBlock} t={t} />

      <BottomNav active="map" onNavigate={onNavigate} />
    </div>
  )
}