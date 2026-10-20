// ─────────────────────────────────────────────────────────────────────────────
// MapViewport — wraps the ParkMap and gives it real-map pan + zoom: one-finger
// drag to pan, two-finger pinch to zoom (mouse-wheel on desktop). Taps still
// pass through to block markers; a tap is only swallowed if
// the user actually dragged/pinched. No external libraries.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState, useEffect, useCallback } from 'react'

const MIN = 1, MAX = 5

export default function MapViewport({ children, overlay }) {
  const wrapRef = useRef(null)
  const innerRef = useRef(null)
  const pointers = useRef(new Map())
  const pinch = useRef({ dist: 0, mid: { x: 0, y: 0 } })
  const moved = useRef(false)
  const [t, setT] = useState({ s: 1, x: 0, y: 0 })
  const [dims, setDims] = useState({ vw: 0, vh: 0, contentH: 0 })

  // Track viewport + content size (for the LOD marker overlay + culling).
  // Also center the map the first time we know its real size — the map is
  // shown at its natural (landscape) aspect ratio, so on most phones it's
  // shorter than the viewport and should sit centered, not pinned to the top.
  const centered = useRef(false)
  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current, inner = innerRef.current
      if (!w) return
      const next = { vw: w.clientWidth, vh: w.clientHeight, contentH: inner ? inner.clientHeight : w.clientWidth * 1674 / 939 }
      setDims(next)
      if (!centered.current && next.contentH > 0) {
        centered.current = true
        setT((p) => clamp(p.s, p.x, p.y))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    if (innerRef.current) ro.observe(innerRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the scaled map inside the viewport (centered when smaller than it).
  const clamp = useCallback((s, x, y) => {
    const wrap = wrapRef.current, inner = innerRef.current
    if (!wrap || !inner) return { s, x, y }
    const W = wrap.clientWidth, H = wrap.clientHeight
    const cw = W, ch = inner.clientHeight
    s = Math.min(MAX, Math.max(MIN, s))
    const sw = cw * s, sh = ch * s
    x = sw <= W ? (W - sw) / 2 : Math.min(0, Math.max(W - sw, x))
    y = sh <= H ? (H - sh) / 2 : Math.min(0, Math.max(H - sh, y))
    return { s, x, y }
  }, [])

  const rectPt = (e) => {
    const r = wrapRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onDown = (e) => {
    pointers.current.set(e.pointerId, rectPt(e))
    moved.current = false
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current.dist = Math.hypot(a.x - b.x, a.y - b.y)
      pinch.current.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
  }

  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    const prev = pointers.current.get(e.pointerId)
    const cur = rectPt(e)
    pointers.current.set(e.pointerId, cur)

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const prevMid = pinch.current.mid
      const ratio = dist / (pinch.current.dist || dist)
      setT(p => {
        const s = p.s * ratio
        const k = s / p.s
        const x = mid.x - k * (mid.x - p.x) + (mid.x - prevMid.x)
        const y = mid.y - k * (mid.y - p.y) + (mid.y - prevMid.y)
        return clamp(s, x, y)
      })
      pinch.current.dist = dist
      pinch.current.mid = mid
      moved.current = true
    } else if (pointers.current.size === 1) {
      const dx = cur.x - prev.x, dy = cur.y - prev.y
      if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true
      setT(p => clamp(p.s, p.x + dx, p.y + dy))
    }
  }

  const onUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current.dist = 0
  }

  const zoomAt = (factor, px, py) => setT(p => {
    const s = p.s * factor, k = s / p.s
    return clamp(s, px - k * (px - p.x), py - k * (py - p.y))
  })

  // Native (non-passive) wheel zoom so preventDefault works on desktop.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Swallow the click that ends a drag/pinch so it doesn't open a block.
  const onClickCapture = (e) => {
    if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false }
  }

  return (
    <div className="mv">
      <div
        ref={wrapRef}
        className="mv-vp"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={onClickCapture}
      >
        <div ref={innerRef} className="mv-content" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}>
          {children}
        </div>
        {overlay && (
          <div className="mv-overlay">
            {overlay({ scale: t.s, tx: t.x, ty: t.y, vw: dims.vw, vh: dims.vh, contentH: dims.contentH })}
          </div>
        )}
      </div>
    </div>
  )
}