// ─────────────────────────────────────────────────────────────────────────────
// MapMarkers — Google-Maps-style level-of-detail overlay. Renders POI markers in
// SCREEN space (always upright, constant size) anchored to the map, given the
// viewport transform from MapViewport. As you zoom in, more tiers fade in and
// labels grow from short → full. Markers outside the viewport are culled.
//
// The map is shown in its natural (unrotated) landscape orientation, so a POI
// at image-fraction (fx, fy) maps to screen:  x = tx + s·fx·vw ,  y = ty + s·fy·contentH
// ─────────────────────────────────────────────────────────────────────────────
import { POIS, TIER_MIN, FADE, LABEL_FULL } from '../data/pois'

const CULL_MARGIN = 64

export default function MapMarkers({ t, onSelectBlock, activeBlockId }) {
  const { scale, tx, ty, vw, vh, contentH } = t
  if (!vw || !contentH) return null

  return (
    <>
      {POIS.map((poi) => {
        // Smooth fade-in across the tier threshold.
        const start = TIER_MIN[poi.tier]
        const opacity = Math.max(0, Math.min(1, (scale - start) / FADE))
        if (opacity <= 0.02) return null

        // Screen position (natural landscape orientation) + viewport culling.
        const fx = poi.x / 100, fy = poi.y / 100
        const x = tx + scale * fx * vw
        const y = ty + scale * fy * contentH
        if (x < -CULL_MARGIN || x > vw + CULL_MARGIN || y < -CULL_MARGIN || y > vh + CULL_MARGIN) return null

        // Label LOD: dot → short label → full label as you zoom in.
        const mode = opacity < 0.5 ? 'dot' : (scale < LABEL_FULL ? 'short' : 'full')
        const label = mode === 'full' ? poi.full : poi.short
        const pop = 0.82 + 0.18 * opacity
        const isBlock = !!poi.blockId
        const active = isBlock && poi.blockId === activeBlockId

        return (
          <button
            key={poi.id}
            type="button"
            className={`mk mk-${poi.kind}${active ? ' mk-active' : ''}`}
            style={{ left: `${x}px`, top: `${y}px`, opacity, transform: `translate(-50%, -50%) scale(${pop})` }}
            onClick={isBlock ? () => onSelectBlock && onSelectBlock(poi) : undefined}
            tabIndex={isBlock ? 0 : -1}
            aria-label={poi.full}
          >
            <span className="mk-dot" />
            {mode !== 'dot' && <span className="mk-label">{label}</span>}
          </button>
        )
      })}
    </>
  )
}