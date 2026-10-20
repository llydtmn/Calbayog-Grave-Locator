// ─────────────────────────────────────────────────────────────────────────────
// ParkMap — the official Calbayog Memorial Park site plan (assets/park-map.png)
// with tappable block regions overlaid on top. The image provides all labels,
// roads and landmarks; we add one transparent <polygon> hotspot per block (in
// image-relative % coordinates) plus a pin marker so people can tell which areas
// are tappable. Fully offline — just an image + SVG overlay, no map APIs.
//
// Props:
//   animate        — fade the map in and pop the pins in, staggered (intro)
//   interactive    — block regions/pins are tappable (Map tab)
//   showPins       — render the static block pins (off when LOD markers are used)
//   onSelectBlock  — (block) => void, fired on block tap
//   activeBlockId  — currently highlighted block
// ─────────────────────────────────────────────────────────────────────────────
import { useSite } from '../hooks'
import { hotspotPoints } from '../data/blocks'
import parkMapImg from '../assets/park-map.png'

export default function ParkMap({ animate = false, interactive = false, showPins = true, onSelectBlock, activeBlockId }) {
  const { data: site, loading } = useSite()

  if (loading || !site) {
    return <div className="pm-loading">Loading park map…</div>
  }

  const { map, blocks } = site
  const pick = (b) => { if (interactive && onSelectBlock) onSelectBlock(b) }

  return (
    <div
      className={`pm-wrap${animate ? ' pm-animate' : ''}`}
      style={{ aspectRatio: String(map.aspect) }}
    >
      <img className="pm-img" src={parkMapImg} alt="Map of Calbayog Memorial Park" draggable="false" />

      {/* Tappable block regions (stretched to the image box). */}
      <svg className="pm-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden={!interactive}>
        {blocks.map((b, i) => {
          const isActive = activeBlockId === b.id
          return (
            <polygon
              key={b.id}
              className={`pm-hot${interactive ? ' pm-hot-tap' : ''}${isActive ? ' pm-hot-active' : ''}`}
              points={hotspotPoints(b.hotspot)}
              style={animate ? { animationDelay: `${0.25 + i * 0.07}s` } : undefined}
              onClick={() => pick(b)}
            />
          )
        })}
      </svg>

      {/* Pin markers — discoverability cue, positioned over each block. */}
      {showPins && blocks.map((b, i) => (
        <button
          key={b.id}
          type="button"
          className={`pm-pin${interactive ? ' pm-pin-tap' : ''}${activeBlockId === b.id ? ' pm-pin-active' : ''}`}
          style={{ left: `${b.label.x}%`, top: `${b.label.y}%`, animationDelay: `${0.25 + i * 0.07}s` }}
          onClick={() => pick(b)}
          tabIndex={interactive ? 0 : -1}
          aria-label={interactive ? `${b.name}${b.lawnName ? ` — ${b.lawnName}` : ''}` : undefined}
        >
          <span className="pm-pin-dot" />
        </button>
      ))}
    </div>
  )
}