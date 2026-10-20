// ─────────────────────────────────────────────────────────────────────────────
// SiteMap — live satellite map of Calbayog Memorial Park with a red location
// pin (Google-Maps style) for every block that has GPS coords (block.coords),
// plus a green Gate Entrance pin.
// Tap a pin → popup with "View lots" / "Directions".
// "Directions" draws an in-app walking route from the user's current location
// to the block (no leaving the app). Route data: OSRM foot routing (no API key).
// If routing is unavailable, a straight dashed line is shown instead.
//
// Props:
//   blocks         — block list (each may carry coords: [lat, lng])
//   activeBlockId  — highlighted block (bigger pin)
//   onSelectBlock  — (block) => void, fired by "View lots"
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { GOOGLE_MAPS_URL, GATE } from '../data/blocks'

const ROUTE_API = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
const MAX_ROUTE_KM = 50 // farther than this = "too far from the park"

const PIN_SVG = `
<svg class="sm-pin-svg" viewBox="0 0 24 36" aria-hidden="true">
  <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z"
        fill="#EA4335" stroke="#B31412" stroke-width="1"/>
  <circle cx="12" cy="12" r="4.5" fill="#B31412"/>
</svg>`

const pinIcon = (name, active) => L.divIcon({
  className: `sm-pin${active ? ' sm-pin-active' : ''}`,
  html: `${PIN_SVG}<span class="sm-pin-label">${name}</span>`,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -40],
})

const GATE_SVG = `
<svg class="sm-pin-svg" viewBox="0 0 24 36" aria-hidden="true">
  <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z"
        fill="#1E8E3E" stroke="#0D652D" stroke-width="1"/>
  <path d="M7 16V9.5L12 7l5 2.5V16M9.5 16v-4h5v4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`

const gateIcon = L.divIcon({
  className: 'sm-pin sm-pin-gate',
  html: `${GATE_SVG}<span class="sm-pin-label">${GATE.name}</span>`,
  iconSize: [28, 42],
  iconAnchor: [14, 42],
  popupAnchor: [0, -40],
})

const meIcon = L.divIcon({
  className: 'sm-me',
  html: '<span class="sm-me-dot"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const fmtDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)
const fmtMinutes = (s) => `${Math.max(1, Math.round(s / 60))} min walk`

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported on this device.'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      (err) => reject(new Error(err.code === 1
        ? 'Location permission denied. Allow location access to see the route.'
        : 'Could not get your location. Try again outdoors.')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    )
  })
}

async function fetchRoute(from, to) {
  const url = `${ROUTE_API}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Route service unavailable')
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found')
  const r = data.routes[0]
  return {
    path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distance: r.distance,
    duration: r.duration,
  }
}

function popupContent(b, onView, onRoute) {
  const box = document.createElement('div')
  box.className = 'sm-pop'
  box.innerHTML = `
    <p class="sm-pop-title">${b.name}</p>
    ${b.lawnName ? `<p class="sm-pop-sub">${b.lawnName}</p>` : ''}
    <div class="sm-pop-actions">
      <button type="button" class="sm-pop-btn" data-act="view">View lots</button>
      <button type="button" class="sm-pop-link" data-act="route">Directions</button>
    </div>`
  box.querySelector('[data-act="view"]').addEventListener('click', () => onView(b))
  box.querySelector('[data-act="route"]').addEventListener('click', () => onRoute(b))
  return box
}

export default function SiteMap({ blocks = [], activeBlockId, onSelectBlock }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const pinsRef = useRef(null)
  const routeLayerRef = useRef(null)
  const fittedRef = useRef(false)
  const reqIdRef = useRef(0)
  const selectRef = useRef(onSelectBlock)
  const routeFnRef = useRef(null)

  // null | { block, status: 'loading' | 'ok' | 'error', distance?, duration?, approx?, message? }
  const [route, setRoute] = useState(null)

  useEffect(() => { selectRef.current = onSelectBlock }, [onSelectBlock])

  const clearRoute = () => {
    reqIdRef.current += 1 // cancel any in-flight request
    routeLayerRef.current?.clearLayers()
    setRoute(null)
  }

  // Draw a route from the user's location to a block.
  const showRoute = async (b) => {
    const map = mapRef.current, layer = routeLayerRef.current
    if (!map || !layer) return
    const reqId = ++reqIdRef.current
    map.closePopup()
    layer.clearLayers()
    setRoute({ block: b, status: 'loading' })

    try {
      const me = await getPosition()
      if (reqId !== reqIdRef.current) return

      const straight = map.distance(me, b.coords)
      if (straight > MAX_ROUTE_KM * 1000) {
        throw new Error(`You're ${fmtDistance(straight)} away from the park. Directions work when you're nearby.`)
      }

      let path, distance, duration, approx = false
      try {
        ({ path, distance, duration } = await fetchRoute(me, b.coords))
      } catch {
        // Offline / service down → straight-line fallback.
        path = [me, b.coords]
        distance = straight
        duration = straight / 1.3 // ~1.3 m/s walking
        approx = true
      }
      if (reqId !== reqIdRef.current) return

      layer.clearLayers()
      // Route line (white casing + blue line, Google-style).
      L.polyline(path, { color: '#fff', weight: 9, opacity: 0.9 }).addTo(layer)
      L.polyline(path, { color: '#1A73E8', weight: 6, dashArray: approx ? '8 10' : null }).addTo(layer)
      // Walkways inside the cemetery usually aren't on the map — finish the
      // last stretch from where the road ends to the block pin.
      const end = path[path.length - 1]
      if (!approx && map.distance(end, b.coords) > 3) {
        L.polyline([end, b.coords], { color: '#1A73E8', weight: 4, dashArray: '4 8' }).addTo(layer)
      }
      L.marker(me, { icon: meIcon, interactive: false, zIndexOffset: 2000 }).addTo(layer)

      map.fitBounds(L.latLngBounds([...path, b.coords]), { padding: [60, 60], maxZoom: 19 })
      setRoute({ block: b, status: 'ok', distance, duration, approx })
    } catch (err) {
      if (reqId !== reqIdRef.current) return
      setRoute({ block: b, status: 'error', message: err.message })
    }
  }

  useEffect(() => { routeFnRef.current = showRoute })

  // Create the map once.
  useEffect(() => {
    const map = L.map(elRef.current, {
      center: [12.06289, 124.60719],
      zoom: 18,
      maxZoom: 21,
      zoomControl: true,
      attributionControl: true,
    })

    const street = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxNativeZoom: 19, maxZoom: 21, attribution: '© OpenStreetMap contributors' },
    ).addTo(map) // default layer
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxNativeZoom: 19, maxZoom: 21, attribution: 'Imagery © Esri' },
    )
    L.control.layers({ Map: street, Satellite: satellite }, null, { position: 'topright' }).addTo(map)

    routeLayerRef.current = L.layerGroup().addTo(map)
    pinsRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    // The map lives in a flex child — recompute size once layout settles.
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(elRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      pinsRef.current = null
      routeLayerRef.current = null
      fittedRef.current = false
    }
  }, [])

  // (Re)draw the gate pin + one red pin per block with coords.
  useEffect(() => {
    const map = mapRef.current, group = pinsRef.current
    if (!map || !group) return
    group.clearLayers()

    // Gate Entrance pin (green, so it stands out from the red block pins).
    L.marker(GATE.coords, { icon: gateIcon, title: GATE.name, riseOnHover: true })
      .bindPopup(`<div class="sm-pop"><p class="sm-pop-title">${GATE.name}</p><p class="sm-pop-sub">Main entrance of the park</p></div>`, { closeButton: false })
      .addTo(group)

    const pinned = blocks.filter((b) => Array.isArray(b.coords))
    pinned.forEach((b) => {
      L.marker(b.coords, {
        icon: pinIcon(b.name, b.id === activeBlockId),
        title: b.lawnName ? `${b.name} — ${b.lawnName}` : b.name,
        riseOnHover: true,
        zIndexOffset: b.id === activeBlockId ? 1000 : 0,
      })
        .bindPopup(
          popupContent(b, (blk) => selectRef.current?.(blk), (blk) => routeFnRef.current?.(blk)),
          { closeButton: false },
        )
        .addTo(group)
    })

    if (!fittedRef.current && pinned.length) {
      map.fitBounds(L.latLngBounds([GATE.coords, ...pinned.map((b) => b.coords)]), { padding: [48, 48], maxZoom: 19 })
      fittedRef.current = true
    }
  }, [blocks, activeBlockId])

  return (
    <div className="sm">
      <div ref={elRef} className="sm-map" />

      {route ? (
        <div className="sm-route" role="status">
          <div className="sm-route-info">
            <p className="sm-route-title">Route to {route.block.name}</p>
            {route.status === 'loading' && <p className="sm-route-sub">Finding your location…</p>}
            {route.status === 'ok' && (
              <p className="sm-route-sub">
                {fmtDistance(route.distance)} · {fmtMinutes(route.duration)}
                {route.approx && ' · straight line (offline)'}
              </p>
            )}
            {route.status === 'error' && <p className="sm-route-sub sm-route-err">{route.message}</p>}
          </div>
          {route.status === 'error' && (
            <button type="button" className="sm-route-btn" onClick={() => showRoute(route.block)}>Retry</button>
          )}
          <button type="button" className="sm-route-btn sm-route-close" onClick={clearRoute} aria-label="Clear route">✕</button>
        </div>
      ) : (
        <a className="sm-gmaps" href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#EA4335" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/>
          </svg>
          Open in Google Maps
        </a>
      )}
    </div>
  )
}