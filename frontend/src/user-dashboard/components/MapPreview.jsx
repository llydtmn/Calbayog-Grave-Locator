// ─────────────────────────────────────────────────────────────────────────────
// MapPreview — small, non-interactive satellite map of the park for the Home
// screen "Explore the Park" card. Shows a mini red pin per block + the green
// Gate Entrance pin. All map gestures are off so a tap goes to the card
// (which opens the full Map tab).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { GATE } from '../data/blocks'

const miniPin = (fill, stroke) => L.divIcon({
  className: 'mp-pin',
  html: `<svg viewBox="0 0 24 36" width="16" height="24" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z"
          fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff"/>
  </svg>`,
  iconSize: [16, 24],
  iconAnchor: [8, 24],
})

export default function MapPreview({ blocks = [] }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const pinsRef = useRef(null)

  // Create a static map once.
  useEffect(() => {
    const map = L.map(elRef.current, {
      center: [12.06289, 124.60719],
      zoom: 18,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      // Static preview: no zoom/fade animations, so leaving Home mid-animation
      // can't throw Leaflet's "_leaflet_pos of undefined" error.
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    })
    L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            { maxNativeZoom: 19, maxZoom: 21 },
    ).addTo(map)
    pinsRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(elRef.current)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      pinsRef.current = null
    }
  }, [])

  // Pins + fit the whole park in view.
  useEffect(() => {
    const map = mapRef.current, group = pinsRef.current
    if (!map || !group) return
    group.clearLayers()

    const pts = blocks.filter((b) => Array.isArray(b.coords)).map((b) => b.coords)
    pts.forEach((c) => L.marker(c, { icon: miniPin('#EA4335', '#B31412'), interactive: false }).addTo(group))
    L.marker(GATE.coords, { icon: miniPin('#1E8E3E', '#0D652D'), interactive: false }).addTo(group)

    map.fitBounds(L.latLngBounds([GATE.coords, ...pts]), { padding: [22, 22], maxZoom: 19, animate: false })
  }, [blocks])

  return <div ref={elRef} className="hm-hero-map" aria-label="Satellite map of Calbayog Memorial Park" />
}