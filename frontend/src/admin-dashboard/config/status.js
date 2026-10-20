// ─────────────────────────────────────────────────────────────────────────────
// LOT STATUS TAXONOMY  (single source of truth — imported by map AND search)
// Mirrors the printed legend on the Calbayog Memorial Park block plans.
// Do NOT redefine these colors anywhere else; import from here.
// ─────────────────────────────────────────────────────────────────────────────

export const STATUS = {
  AVAILABLE:      'available',       // white / empty lot
  SOLD:           'sold',            // tan / beige
  WITH_INTERMENT: 'with_interment',  // beige + "|" marks (see intermentCount: 0,1,2)
  RESERVE_LOT:    'reserve_lot',     // gray
  NOT_FOR_SALE:   'not_for_sale',    // blue
  DELINQUENT:     'delinquent',      // red
  TREES:          'trees',           // green
  LAMP_POST:      'lamp_post',       // yellow
  BLOCK_OFF:      'block_off',       // crossed-out / X
}

// Visual + label metadata per status. `fill` is the cell color, `mark` flags the
// cell that renders interment tick marks, `pattern` flags the crossed cell.
export const STATUS_META = {
  [STATUS.AVAILABLE]:      { label: 'Available',       fill: '#FFFFFF', text: '#2D3748', border: '#C9CFC4', sellable: true  },
  [STATUS.SOLD]:           { label: 'Sold',            fill: '#D8C6A8', text: '#4A3F2A', border: '#BFAE90', sellable: false },
  [STATUS.WITH_INTERMENT]: { label: 'With Interment',  fill: '#D8C6A8', text: '#4A3F2A', border: '#BFAE90', sellable: false, mark: true },
  [STATUS.RESERVE_LOT]:    { label: 'Reserve Lot',     fill: '#9CA3AF', text: '#FFFFFF', border: '#6B7280', sellable: false },
  [STATUS.NOT_FOR_SALE]:   { label: 'Not For Sale',    fill: '#7FB2D9', text: '#103A56', border: '#5E97C4', sellable: false },
  [STATUS.DELINQUENT]:     { label: 'Delinquent',      fill: '#DC2626', text: '#FFFFFF', border: '#B91C1C', sellable: false },
  [STATUS.TREES]:          { label: 'Trees',           fill: '#4CA85A', text: '#FFFFFF', border: '#3B8C49', sellable: false },
  [STATUS.LAMP_POST]:      { label: 'Lamp Post',       fill: '#F2D024', text: '#5A4A00', border: '#D4B400', sellable: false },
  [STATUS.BLOCK_OFF]:      { label: 'Block-Off',       fill: '#EFEBE3', text: '#8B9EA0', border: '#B7BDB2', sellable: false, pattern: true },
}

// Order used by the map legend + status filter chips.
export const STATUS_ORDER = [
  STATUS.AVAILABLE,
  STATUS.SOLD,
  STATUS.WITH_INTERMENT,
  STATUS.RESERVE_LOT,
  STATUS.NOT_FOR_SALE,
  STATUS.DELINQUENT,
  STATUS.TREES,
  STATUS.LAMP_POST,
  STATUS.BLOCK_OFF,
]

export const ALL_STATUSES = Object.values(STATUS)

export const statusMeta  = (s) => STATUS_META[s] || STATUS_META[STATUS.AVAILABLE]
export const statusLabel = (s) => statusMeta(s).label
export const statusFill  = (s) => statusMeta(s).fill
export const isSellable  = (s) => !!statusMeta(s).sellable