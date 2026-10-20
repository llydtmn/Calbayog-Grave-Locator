// ─────────────────────────────────────────────────────────────────────────────
// POIS — points of interest for the Google-Maps-style level-of-detail (LOD) map.
// Each POI has a `tier`: the lower the tier, the sooner it appears as you zoom.
//   tier 1 — far zoomed out: only top-level zones (lawns, entrance, parking)
//   tier 2 — mid zoom: the 10 blocks
//   tier 3 — closer: amenities, road lots, lawn names
//   tier 4 — max zoom: sub-areas, pathways, fine detail
// Positions are in IMAGE-relative % (same space as block.label / hotspots).
// `short` shows when a marker first appears; `full` shows once zoomed in further.
// ─────────────────────────────────────────────────────────────────────────────
import { BLOCKS } from './blocks'

// Zoom scale (MapViewport: 1 = whole park … 5 = max) at which each tier begins.
// Tier 1 starts below the minimum scale (1) so the top-level zones are already
// fully visible when fully zoomed out; deeper tiers fade in as you zoom further.
export const TIER_MIN = { 1: 0.5, 2: 1.5, 3: 2.3, 4: 3.2 }
export const FADE = 0.5          // scale window over which a marker fades in
export const LABEL_FULL = 2.8    // scale at/above which markers show their full label

const blockPOIs = BLOCKS.map((b) => ({
  id: b.id,
  kind: 'block',
  tier: 2,
  x: b.label.x,
  y: b.label.y,
  short: b.name.replace('Block ', 'B'),
  full: b.lawnName ? `${b.name} · ${b.lawnName}` : b.name,
  blockId: b.id,
  hasGrid: b.hasGrid,
}))

const extraPOIs = [
  // Tier 1 — zones (always-on, high-level)
  { id: 'z-lawns', kind: 'zone', tier: 1, x: 55, y: 52, short: 'Memorial Lawns', full: 'Memorial Lawns' },
  { id: 'z-entrance', kind: 'zone', tier: 1, x: 6, y: 42, short: 'Entrance', full: 'National Road Entrance' },
  { id: 'a-parking', kind: 'amenity', tier: 1, x: 88, y: 20, short: 'Parking', full: 'Parking Area' },

  // Tier 3 — amenities & roads
  { id: 'a-forest', kind: 'amenity', tier: 3, x: 93, y: 68, short: 'Mini Forest', full: 'Mini Forest' },
  { id: 'a-admin', kind: 'amenity', tier: 3, x: 12, y: 80, short: 'Office', full: 'Administration Office' },
  { id: 'a-rest', kind: 'amenity', tier: 3, x: 45, y: 88, short: 'Rest Room', full: 'Rest Room' },
  { id: 'r-1', kind: 'road', tier: 3, x: 45, y: 28, short: 'Road Lot 1', full: 'Road Lot 1' },
  { id: 'r-2', kind: 'road', tier: 3, x: 64, y: 52, short: 'Road Lot 2', full: 'Road Lot 2' },
  { id: 'r-3', kind: 'road', tier: 3, x: 85, y: 58, short: 'Road Lot 3', full: 'Road Lot 3' },

  // Tier 4 — sub-areas & pathways
  { id: 's-gol', kind: 'sub', tier: 4, x: 80, y: 30, short: 'Garden of Love', full: 'Garden of Love' },
  { id: 's-3a', kind: 'sub', tier: 4, x: 72, y: 42, short: '3A', full: 'Block 3A' },
  { id: 's-3c', kind: 'sub', tier: 4, x: 80, y: 54, short: '3C', full: 'Block 3C' },
  { id: 'p-1', kind: 'path', tier: 4, x: 34, y: 46, short: 'Pathway 1', full: 'Pathway 1' },
  { id: 'p-2', kind: 'path', tier: 4, x: 56, y: 57, short: 'Pathway 2', full: 'Pathway 2' },
  { id: 'p-3', kind: 'path', tier: 4, x: 70, y: 62, short: 'Pathway 3', full: 'Pathway 3' },
  { id: 'a-easement', kind: 'path', tier: 4, x: 20, y: 47, short: 'Easement', full: 'Easement' },
]

export const POIS = [...blockPOIs, ...extraPOIs]