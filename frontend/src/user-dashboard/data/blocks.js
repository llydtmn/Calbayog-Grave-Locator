// ─────────────────────────────────────────────────────────────────────────────
// BLOCKS SEED — Calbayog Memorial Park, keyed to the official site plan image
// (assets/park-map.png). Each block carries a `hotspot`: a polygon in IMAGE-
// RELATIVE percentage coordinates (0–100 on each axis) that the ParkMap overlays
// on the photo as a tappable region. The image itself supplies all the labels,
// roads and landmarks, so we no longer draw our own geometry.
//
// `hasGrid: true`  → a per-block lot grid has been transcribed (Blocks 3–7).
// `maxLot`         → highest printed lot number (drives the lot generator).
// `hotspot`        → [[x%,y%], …] tappable area over the map image.
// `label`          → {x%,y%} centroid for the tap pin.
// `coords`         → [lat, lng] real-world GPS pin for the Google-style site map
//                    (SiteMap). Blocks without coords (e.g. 2A) get no pin yet.
// ─────────────────────────────────────────────────────────────────────────────
import { CLASSIFICATION } from '../config/constants.js'

const C = CLASSIFICATION

// Native pixel size of assets/park-map.png (for aspect-ratio boxing).
export const PARK_MAP = { width: 1674, height: 939, aspect: 1674 / 939 }

export const BLOCKS = [
  {
    id: 'block-1', coords: [12.063061, 124.606824], name: 'Block 1', lawnName: null, hasGrid: false, maxLot: 24,
    classifications: [C.REGULAR],
    label: { x: 38.9, y: 21.7 },
    hotspot: [[4.5, 26.1], [23.3, 14.9], [31.1, 9.6], [41.8, 14.9], [59.7, 18.6], [73.2, 21.8], [73.2, 34.1], [59.7, 31.4], [41.8, 22.9], [31.1, 16.0], [23.3, 18.6], [4.5, 30.9]],
  },
  {
    id: 'block-2', coords: [12.063603, 124.607803], name: 'Block 2', lawnName: null, hasGrid: false, maxLot: null,
    classifications: [C.REGULAR, C.GARDEN],
    subAreas: ['Garden of Love', 'Estate of Eternal 1 & 2'],
    label: { x: 77.3, y: 28.9 },
    hotspot: [[75.3, 16.0], [80.3, 20.8], [80.3, 44.7], [73.2, 34.1]],
  },
  {
    id: 'block-2a', name: 'Block 2A', lawnName: null, hasGrid: false, maxLot: 13,
    classifications: [C.REGULAR],
    label: { x: 90.1, y: 53.8 },
    hotspot: [[84.8, 20.2], [96.2, 24.5], [94.4, 85.2], [84.8, 85.2]],
  },
  {
    id: 'block-3', coords: [12.063296, 124.607588], name: 'Block 3', lawnName: 'Timeless Memory Lawn', hasGrid: true, maxLot: 310,
    grid: { cols: 7 },
    classifications: [C.PREMIUM, C.DELUXE, C.REGULAR],
    counts: { premium: 95, deluxe: 74, regular: 141, total: 310 },
    subAreas: ['Block 3A', 'Block 3B', 'Block 3C'],
    batches: [26, 24, 22, 20, 19, 16, 16],
    label: { x: 73.3, y: 49.5 },
    hotspot: [[71.4, 41.0], [80.3, 42.1], [80.3, 59.1], [66.9, 60.7], [67.5, 44.7]],
  },
  {
    id: 'block-4', coords: [12.063066, 124.607857], name: 'Block 4', lawnName: 'Endless Love Lawn', hasGrid: true, maxLot: 489,
    grid: { cols: 12 },
    classifications: [C.REGULAR, C.SPECIAL_REGULAR],
    label: { x: 73.2, y: 72.0 },
    hotspot: [[66.9, 60.7], [80.3, 59.1], [80.3, 84.1], [65.1, 84.1]],
  },
  {
    id: 'block-5', coords: [12.063073, 124.607279], name: 'Block 5', lawnName: 'Everlasting Lawn', hasGrid: true, maxLot: 644,
    grid: { cols: 17 },
    classifications: [C.REGULAR, C.DELUXE, C.PREMIUM],
    label: { x: 59.8, y: 47.0 },
    hotspot: [[50.8, 35.6], [67.1, 39.1], [66.2, 41.7], [65.1, 60.0], [49.6, 58.5]],
  },
  {
    id: 'block-6', coords: [12.06281, 124.607489], name: 'Block 6', lawnName: 'Eternal Lawn', hasGrid: true, maxLot: 564,
    grid: { cols: 19 },
    classifications: [C.REGULAR],
    batches: [48, 44, 48, 52, 48, 60, 36, 50],
    label: { x: 53.7, y: 71.2 },
    hotspot: [[48.1, 58.9], [61.8, 62.3], [58.8, 84.1], [46.0, 79.7]],
  },
  {
    id: 'block-7', coords: [12.062782, 124.60696], name: 'Block 7', lawnName: 'Perpetual Lawn', hasGrid: true, maxLot: 765,
    grid: { cols: 24 },
    classifications: [C.REGULAR],
    label: { x: 41.1, y: 48.3 },
    hotspot: [[32.5, 31.7], [50.5, 35.7], [48.1, 58.9], [41.8, 69.2], [32.4, 46.0]],
  },
  {
    id: 'block-8', coords: [12.062552, 124.606638], name: 'Block 8', lawnName: 'Infinite Lawn', hasGrid: false, maxLot: null,
    classifications: [C.REGULAR],
    label: { x: 28.2, y: 35.7 },
    hotspot: [[23.9, 27.2], [32.4, 31.7], [32.4, 46.0], [23.9, 37.8]],
  },
  {
    id: 'block-9', coords: [12.062376, 124.606472], name: 'Block 9', lawnName: null, hasGrid: false, maxLot: null,
    classifications: [C.REGULAR],
    label: { x: 15.8, y: 33.3 },
    hotspot: [[6.3, 39.9], [9.0, 28.2], [23.9, 27.2], [23.9, 37.8]],
  },
]

// Main gate of the park (shown as its own pin on the site map).
export const GATE = { id: 'gate', name: 'Gate Entrance', coords: [12.062207, 124.606267] }
// Calbayog Memorial Park on Google Maps (shared link) + per-block directions.
export const GOOGLE_MAPS_URL = 'https://maps.app.goo.gl/tDj3Ku7bkMid1EEf9'
export const directionsUrl = ([lat, lng]) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

export const getBlockById = (id) => BLOCKS.find((b) => b.id === id) || null

// Helper: "x,y x,y …" string for an SVG <polygon> from a hotspot.
export const hotspotPoints = (hotspot) => hotspot.map(([x, y]) => `${x},${y}`).join(' ')