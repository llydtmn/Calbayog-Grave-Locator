// ─────────────────────────────────────────────────────────────────────────────
// API SURFACE — pages import ONLY from here (never from /data directly).
// Mirrors the User-Dashboard's api/index.js: every function currently resolves
// from local seed data via the shared client; swapping to a real backend is a
// one-line change per function. Because both dashboards import the exact same
// data/blocks.js, data/lots.js, data/pricing.js, and config/status.js, a single
// backend can serve identical block/lot/pricing/status data to both.
// ─────────────────────────────────────────────────────────────────────────────
import { local, USE_REMOTE, emitDataChange } from './client'
import { supabase } from './supabaseClient'
import { BLOCKS, PARK_MAP, getBlockById } from '../data/blocks'
import { getLotsForBlock } from '../data/lots'
import { PRICING, CASH_PRICING, INSTALLMENT_FACTORS, INTERMENT_FEES, PRICING_NOTES } from '../data/pricing'
import { INSTALLMENT_INTEREST } from '../config/constants'
import { LEGEND } from '../data/legend'
import { MEMORIALS } from '../data/memorials'
import { USERS, getUserById } from '../data/users'
import { ADMIN_STAFF } from '../data/adminStaff'
import { MEMORIAL_QUEUE, getMemorialQueueById } from '../data/memorialModeration'
import { SENT_NOTIFICATIONS, NOTIFICATION_STATS, SYSTEM_ALERTS } from '../data/notifications'
import { computeDashboardMetrics, computeBlockOccupancy } from '../data/dashboardMetrics'
import { MOCK_RESERVATIONS, getReservationByIdSync } from '../data/mockReservations'
import { PARK } from '../config/constants'
import { STATUS } from '../config/status'

// Supabase returns NO error when Row Level Security blocks a delete/update —
// it just affects 0 rows. Always .select() the changed rows and call this so
// a blocked change shows an error instead of "working" until you refresh.
function assertChanged(data, what) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error(`The database didn't ${what}. Your account may not have admin permission — run supabase/admin_access.sql and make sure your profiles.role is 'admin'.`)
  }
  return Array.isArray(data) ? data[0] : data
}

// Runs a mutation, then tells every data hook to refresh.
async function mutate(fn) {
  const result = await fn()
  emitDataChange()
  return result
}

// Row shape from Supabase (snake_case) → the shape pages already expect (camelCase).
function blockFromRow(row) {
  return {
    id: row.id, name: row.name, lawnName: row.lawn_name, hasGrid: row.has_grid,
    maxLot: row.max_lot, grid: row.grid_cols ? { cols: row.grid_cols } : undefined,
    classifications: row.classifications, subAreas: row.sub_areas || undefined,
    batches: row.batches || undefined, counts: row.counts || undefined,
    label: { x: row.label_x, y: row.label_y }, hotspot: row.hotspot,
    // GPS pin: use DB lat/lng columns if present, else fall back to the seed.
    coords: row.lat != null && row.lng != null ? [row.lat, row.lng] : getBlockById(row.id)?.coords,
  }
}
function lotFromRow(row) {
  return {
    id: row.id, blockId: row.block_id, lotNo: row.lot_no,
    classification: row.classification, status: row.status,
    intermentCount: row.interment_count, verified: row.verified,
    deceasedNames: row.deceased_names || [],
    deceasedRecords: deceasedRecordsFromRow(row),
  }
}

// Each person buried in a lot: { name, deathDate, burialDate } (dates 'YYYY-MM-DD'
// or null). Lots saved before supabase/deceased-dates.sql only have names.
function deceasedRecordsFromRow(row) {
  const recs = Array.isArray(row.deceased_records) ? row.deceased_records.filter((r) => r && r.name) : []
  if (recs.length) return recs.map((r) => ({ name: String(r.name), deathDate: r.deathDate || null, burialDate: r.burialDate || null }))
  return (row.deceased_names || []).map((name) => ({ name, deathDate: null, burialDate: null }))
}

// Accepts names (strings) or { name, deathDate, burialDate } and cleans them.
function toDeceasedRecords(list) {
  return (list || [])
    .map((d) => (typeof d === 'string' ? { name: d } : d || {}))
    .map((d) => ({ name: String(d.name || '').trim(), deathDate: d.deathDate || null, burialDate: d.burialDate || null }))
    .filter((d) => d.name)
}

const MISSING_DATES_SQL = 'Dates of death need a database update first: run supabase/deceased-dates.sql in the Supabase SQL Editor.'

// ── Site / blocks — identical surface to the User-Dashboard's api/index.js ──
export function getSite() {
  if (USE_REMOTE) return getBlocks().then((blocks) => ({ map: PARK_MAP, blocks }))
  return local(() => ({ map: PARK_MAP, blocks: BLOCKS }))
}

export async function getBlocks() {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('blocks').select('*')
    if (error) throw error
    return data.map(blockFromRow)
  }
  return local(() => BLOCKS)
}

export async function getBlock(blockId) {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('blocks').select('*').eq('id', blockId).single()
    if (error) throw error
    return blockFromRow(data)
  }
  return local(() => getBlockById(blockId))
}

// ── Lots — read here too, plus the admin-only write operations below ────────
export async function getLots(blockId) {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('lots').select('*').eq('block_id', blockId).order('lot_no')
    if (error) throw error
    return data.map(lotFromRow)
  }
  return local(() => getLotsForBlock(blockId))
}

export async function getLot(blockId, lotNo) {
  if (USE_REMOTE) {
    const { data, error } = await supabase
      .from('lots').select('*').eq('block_id', blockId).eq('lot_no', Number(lotNo)).maybeSingle()
    if (error) throw error
    return data ? lotFromRow(data) : null
  }
  return local(() => getLotsForBlock(blockId).find((l) => l.lotNo === Number(lotNo)) || null)
}

// Admin-only: change a lot's map status directly (e.g. marking it sold).
// `intermentCount` is optional — pass it when status === STATUS.WITH_INTERMENT
// so the number of burials in the lot is recorded alongside the status.
// Requires the signed-in Supabase user to have profiles.role = 'admin' (RLS).
// `deceased` is optional too — an array of names or of
// { name, deathDate, burialDate } replaces the lot's list (pass [] to clear it);
// leave it undefined to keep what is saved.
export function updateLotStatus(blockId, lotNo, status, intermentCount, deceased) {
  return mutate(async () => {
  const patch = { status }
  if (intermentCount != null) patch.interment_count = Number(intermentCount)
  let records = null
  if (Array.isArray(deceased)) {
    records = toDeceasedRecords(deceased)
    patch.deceased_records = records
    patch.deceased_names = records.map((r) => r.name)
  }

  if (USE_REMOTE) {
    const { data, error } = await supabase
      .from('lots')
      .update(patch)
      .eq('block_id', blockId)
      .eq('lot_no', Number(lotNo))
      .select()
    if (error) {
      if (/deceased_records/i.test(error.message || '')) throw new Error(MISSING_DATES_SQL)
      throw error
    }
    return lotFromRow(assertChanged(data, 'update this lot'))
  }
  // Local stub: mutate the cached in-memory lot so the UI reflects the change
  // for this session (no persistence yet — same caveat as createMemorial below).
  return local(() => {
    const lots = getLotsForBlock(blockId)
    const lot = lots.find((l) => l.lotNo === Number(lotNo))
    if (lot) {
      lot.status = status
      if (intermentCount != null) lot.intermentCount = Number(intermentCount)
      if (records) {
        lot.deceasedRecords = records
        lot.deceasedNames = patch.deceased_names
      }
    }
    return lot || null
  })
  })
}

// ── Excel import (Plot Management → Import Excel) ───────────────────────────
// Lot ids that have a pending/confirmed reservation — the import preview warns
// before changing them, and "replace" never deletes them.
export async function getActiveReservedLotIds(blockIds) {
  if (!USE_REMOTE || !blockIds?.length) return new Set()
  const { data, error } = await supabase
    .from('reservations').select('lot_id')
    .in('block_id', blockIds).in('status', ['pending', 'confirmed'])
  if (error) throw error
  return new Set((data || []).map((r) => r.lot_id).filter(Boolean))
}

// Saves one block's lots from the Excel file in a single transaction
// (supabase/plot-import.sql → admin_import_lots). Lots in the file are added
// or updated; with `replace`, lots NOT in the file are removed (except ones
// with an active reservation). The block becomes a grid block, its max lot is
// recalculated, and `gridCols` (if given) sets how many columns the grid has.
// Dates of death/burial from the file are saved right after (only for lots
// whose dates changed); names-only changes keep saved dates (DB trigger).
// Returns { inserted, updated, unchanged, deleted, kept, datesSaved }.
export function importLots(blockId, rows, { replace = false, gridCols = null } = {}) {
  return mutate(async () => {
    const payload = rows.map((r) => ({
      lot_no: r.lotNo ?? null,
      extra_index: r.lotNo == null ? r.extraIndex : null,
      classification: r.classification,
      status: r.status,
      interment_count: Number(r.intermentCount) || 0,
      deceased_names: Array.isArray(r.deceasedNames) ? r.deceasedNames : null, // null = keep saved names
    }))
    const cols = Number(gridCols) > 0 ? Math.round(Number(gridCols)) : null

    if (USE_REMOTE) {
      const { data, error } = await supabase.rpc('admin_import_lots', {
        p_block_id: blockId, p_rows: payload, p_replace: !!replace, p_grid_cols: cols,
      })
      if (error) {
        if (/admin_import_lots/i.test(error.message || '')) {
          throw new Error('The import function is missing — run supabase/plot-import.sql in the Supabase SQL Editor first.')
        }
        throw error
      }
      const datesSaved = await saveImportedDates(blockId, rows)
      return { ...(data || {}), datesSaved }
    }

    // Local demo mode: update the in-memory seed so the grid reflects the file.
    return local(() => {
      const block = getBlockById(blockId)
      const lots = getLotsForBlock(blockId)
      const result = { inserted: 0, updated: 0, unchanged: 0, deleted: 0, kept: 0 }
      const ids = new Set()
      payload.forEach((p, i) => {
        const id = p.lot_no != null ? `${blockId}-${p.lot_no}` : `${blockId}-x${p.extra_index}`
        ids.add(id)
        const cur = lots.find((l) => l.id === id)
        const names = p.deceased_names ?? cur?.deceasedNames ?? []
        const src = rows[i] || {}
        const oldRecs = cur?.deceasedRecords || []
        const records = src.deceasedRecords
          ? toDeceasedRecords(src.deceasedRecords)
          : names.map((n) => oldRecs.find((r) => r.name.toLowerCase() === n.toLowerCase()) || { name: n, deathDate: null, burialDate: null })
        const next = { id, blockId, lotNo: p.lot_no, classification: p.classification, status: p.status, intermentCount: p.interment_count, deceasedNames: names, deceasedRecords: records, verified: true }
        if (!cur) { lots.push(next); result.inserted += 1 }
        else if (cur.status !== next.status || cur.classification !== next.classification || (cur.intermentCount || 0) !== next.intermentCount || (cur.deceasedNames || []).join('\n') !== names.join('\n') || src.recordsChanged) {
          Object.assign(cur, next); result.updated += 1
        } else result.unchanged += 1
      })
      if (replace) {
        for (let i = lots.length - 1; i >= 0; i--) {
          if (!ids.has(lots[i].id)) { lots.splice(i, 1); result.deleted += 1 }
        }
      }
      // Numbered lots first (in order), then number-less cells — like the plans.
      lots.sort((a, b) => (a.lotNo == null) - (b.lotNo == null) || (a.lotNo ?? 0) - (b.lotNo ?? 0) || a.id.localeCompare(b.id))
      if (block) {
        block.hasGrid = lots.length > 0
        block.maxLot = lots.reduce((m, l) => (l.lotNo > m ? l.lotNo : m), 0) || null
        if (cols) block.grid = { cols }
      }
      return result
    })
  })
}

// Saves the dates of death/burial from an Excel import, a few lots at a time.
async function saveImportedDates(blockId, rows) {
  const todo = rows.filter((r) => r.recordsChanged && r.lotNo != null && Array.isArray(r.deceasedRecords))
  let saved = 0
  for (let i = 0; i < todo.length; i += 8) {
    const batch = todo.slice(i, i + 8)
    const results = await Promise.all(batch.map((r) => supabase
      .from('lots')
      .update({ deceased_records: toDeceasedRecords(r.deceasedRecords) })
      .eq('block_id', blockId)
      .eq('lot_no', r.lotNo)))
    for (const { error } of results) {
      if (error) {
        if (/deceased_records/i.test(error.message || '')) throw new Error(`Lots were imported, but not the dates. ${MISSING_DATES_SQL}`)
        throw error
      }
    }
    saved += batch.length
  }
  return saved
}

// ── Pricing ──────────────────────────────────────────────────────────────────
export function getPricing() {
  // NOTE: pricing is static reference data — not yet moved to Supabase.
  return local(() => ({
    installment: PRICING,
    cash: CASH_PRICING,
    factors: INSTALLMENT_FACTORS,
    interest: INSTALLMENT_INTEREST,
    interment: INTERMENT_FEES,
    notes: PRICING_NOTES,
  }))
}

// ── Legend ───────────────────────────────────────────────────────────────────
export function getLegend() {
  return local(() => LEGEND)
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export function getDashboardMetrics() {
  if (USE_REMOTE) {
    return (async () => {
      const [{ data: lots, error: lotsError }, { count: totalUsers, error: usersError }] = await Promise.all([
        supabase.from('lots').select('status'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
      ])
      if (lotsError) throw lotsError
      if (usersError) throw usersError

      const available = lots.filter((l) => l.status === STATUS.AVAILABLE).length
      const occupied = lots.filter((l) => l.status === STATUS.SOLD || l.status === STATUS.WITH_INTERMENT).length
      const reserved = lots.filter((l) => l.status === STATUS.RESERVE_LOT).length

      return {
        totalPlots: lots.length,
        available,
        occupied,
        reserved,
        totalUsers: totalUsers || 0,
        // Memorial moderation isn't tracked in the DB yet (no `status` column
        // on `memorials`), so this stays 0 until that schema gap is closed —
        // same limitation as getMemorialQueue() below.
        pendingItems: 0,
      }
    })()
  }
  return local(() => computeDashboardMetrics())
}

export function getBlockOccupancy() {
  if (USE_REMOTE) {
    return (async () => {
      const [{ data: blocks, error: blocksError }, { data: lots, error: lotsError }] = await Promise.all([
        supabase.from('blocks').select('id, name'),
        supabase.from('lots').select('block_id, status'),
      ])
      if (blocksError) throw blocksError
      if (lotsError) throw lotsError

      return blocks
        .map((b) => {
          const blockLots = lots.filter((l) => l.block_id === b.id)
          const occupied = blockLots.filter((l) => l.status === STATUS.SOLD || l.status === STATUS.WITH_INTERMENT).length
          return {
            blockId: b.id,
            name: b.name,
            total: blockLots.length,
            occupied,
            occupancyRate: blockLots.length ? occupied / blockLots.length : 0,
          }
        })
        .filter((b) => b.total > 0)
    })()
  }
  return local(() => computeBlockOccupancy())
}

// ── Users (with REAL activity status) ────────────────────────────────────────
// Uses the admin-only SQL function admin_list_users() (see
// supabase/user-activity.sql), which adds last sign-in, last seen and email
// confirmation from Supabase Auth. Falls back to plain profiles if the
// function hasn't been created yet.
const ONLINE_MS = 5 * 60 * 1000            // seen in the last 5 minutes
const ACTIVE_MS = 30 * 24 * 60 * 60 * 1000 // activity in the last 30 days

function userStatus({ lastSeenAt, lastSignInAt, emailConfirmedAt, bannedUntil }) {
  const now = Date.now()
  const t = (v) => (v ? new Date(v).getTime() : 0)
  if (t(bannedUntil) > now) return 'suspended'
  if (now - t(lastSeenAt) < ONLINE_MS) return 'online'
  if (!emailConfirmedAt && !lastSignInAt) return 'unverified'
  const lastActive = Math.max(t(lastSeenAt), t(lastSignInAt))
  return lastActive && now - lastActive < ACTIVE_MS ? 'active' : 'inactive'
}

export async function getUsers() {
  if (USE_REMOTE) {
    const rpc = await supabase.rpc('admin_list_users')
    let rows = rpc.data
    let hasActivity = !rpc.error
    if (rpc.error) {
      // Function not installed yet (or not admin) — fall back to profiles only.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      rows = data
    }
    return rows.map((row) => {
      const lastActive = [row.last_seen_at, row.last_sign_in_at].filter(Boolean).sort().pop() || null
      return {
        id: row.id,
        name: row.full_name || '(no name set)',
        email: row.email,
        phone: row.phone || '',
        role: row.role || 'user',
        // Plot ownership isn't tracked yet (would need a user_id column on
        // `lots`), so this always shows empty for now rather than fake data.
        plots: [],
        joined: row.created_at ? String(row.created_at).slice(0, 10) : null,
        lastActive,
        status: hasActivity
          ? userStatus({
              lastSeenAt: row.last_seen_at,
              lastSignInAt: row.last_sign_in_at,
              emailConfirmedAt: row.email_confirmed_at,
              bannedUntil: row.banned_until,
            })
          : 'active',
      }
    })
  }
  return local(() => USERS)
}

// NOTE: create/edit/delete still only affect the local sample data, even in
// remote mode. Deleting or editing a real Supabase Auth account safely
// requires the service_role key, which must stay server-side — doing this
// for real would need a small backend endpoint or Supabase Edge Function,
// not a direct call from the browser.
export function createUser(payload) {
  return mutate(async () => {
    if (USE_REMOTE) {
      // A real account needs Supabase Auth + the service_role key (server only).
      throw new Error('New accounts are created when users sign up in the app. Adding them here needs a server function.')
    }
    return local(() => {
      const rec = { id: `usr-${Date.now()}`, plots: [], joined: new Date().toISOString().slice(0, 10), ...payload }
      USERS.unshift(rec)
      return rec
    })
  })
}

export function updateUser(id, patch) {
  return mutate(async () => {
    if (USE_REMOTE) {
      const { data, error } = await supabase.from('profiles')
        .update({ full_name: patch.name, phone: patch.phone }).eq('id', id).select()
      if (error) throw error
      assertChanged(data, 'save this user')
      return { id, ...patch }
    }
    return local(() => {
      const u = getUserById(id)
      if (u) Object.assign(u, patch)
      return u
    })
  })
}

// Deletes the account AND everything it owns: installment payments,
// reservations (their lots go back to available), memorials, profile and login,
// all in one transaction (supabase/admin-delete-user.sql). The function returns
// the receipt photos to remove; Storage files can't be deleted from SQL, so
// they're removed here afterwards.
export function deleteUser(id) {
  return mutate(async () => {
    if (USE_REMOTE) {
      const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: id })
      if (error) {
        if (/foreign key|violates/i.test(error.message || '')) {
          throw new Error('This user still has linked data. Run supabase/admin-delete-user.sql in the Supabase SQL Editor, then try again.')
        }
        throw error
      }

      // Remove receipt photos, grouped by bucket. The account is already gone,
      // so a failure here only leaves orphan files; it doesn't undo the delete.
      const byBucket = {}
      for (const f of data?.files || []) {
        if (f?.bucket && f?.path) (byBucket[f.bucket] ||= []).push(f.path)
      }
      for (const [bucket, paths] of Object.entries(byBucket)) {
        const { error: stErr } = await supabase.storage.from(bucket).remove(paths)
        if (stErr) console.warn(`User deleted, but some files in "${bucket}" were not removed:`, stErr.message)
      }

      return {
        id,
        reservations: data?.reservations ?? 0,
        payments: data?.payments ?? 0,
        memorials: data?.memorials ?? 0,
        lotsReleased: data?.lots_released ?? 0,
      }
    }
    return local(() => {
      const idx = USERS.findIndex((u) => u.id === id)
      if (idx >= 0) USERS.splice(idx, 1)
      return { id }
    })
  })
}

// ── Admin staff (dashboard login accounts) ───────────────────────────────────
export function getAdminStaff() {
  // NOTE: not yet wired to Supabase — this would be another table + RLS policy.
  return local(() => ADMIN_STAFF)
}

export function addAdminStaff(payload) {
  return mutate(() => local(() => {
    const rec = { id: `admin-${Date.now()}`, avatar: (payload.name || '?')[0].toUpperCase(), ...payload }
    ADMIN_STAFF.push(rec)
    return rec
  }))
}

export function removeAdminStaff(id) {
  return mutate(() => local(() => {
    const idx = ADMIN_STAFF.findIndex((a) => a.id === id)
    if (idx >= 0) ADMIN_STAFF.splice(idx, 1)
    return { id }
  }))
}

// ── Account: the signed-in admin changes their OWN password ──────────────────
// Supabase doesn't ask for the old password, so we check it first by signing in
// again with it. Creating passwords for OTHER staff needs a server function
// (service_role key), so that isn't done from the browser.
export async function changeOwnPassword(currentPassword, newPassword) {
  if (!USE_REMOTE) throw new Error('Changing passwords needs the Supabase connection (VITE_USE_REMOTE=true).')
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  if (!user?.email) throw new Error('You are not signed in.')

  const { error: checkErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (checkErr) throw new Error('Current password is incorrect.')

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return { ok: true }
}

// ── Memorials — public feed + admin moderation queue ─────────────────────────
export async function getMemorials() {
  if (USE_REMOTE) {
    const { data, error } = await supabase.from('memorials').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
  }
  return local(() => MEMORIALS)
}

export function createMemorial(payload) {
  return mutate(() => createMemorialRaw(payload))
}
async function createMemorialRaw(payload) {
  if (USE_REMOTE) {
    // Admin-added memorials skip moderation — the admin adding it IS the moderator.
    const { data, error } = await supabase.from('memorials').insert({ ...payload, status: 'approved' }).select().single()
    if (error) throw error
    return data
  }
  // Local stub: also add it to the moderation queue so it shows in the table.
  return local(() => {
    const rec = {
      id: `modq-${Date.now()}`, name: payload.name, submittedBy: payload.submitted_by || 'Admin',
      blockId: payload.block_id, lotNo: payload.lot_no, birth: payload.birth_date, death: payload.death_date,
      quote: payload.quote || '', submitted: new Date().toISOString().slice(0, 10), status: 'approved',
    }
    MEMORIAL_QUEUE.unshift(rec)
    return rec
  })
}

function queueRowFromMemorial(row) {
  return {
    id: row.id,
    name: row.name,
    submittedBy: row.submitted_by || '—',
    blockId: row.block_id,
    lotNo: row.lot_no,
    birth: row.birth_date,
    death: row.death_date,
    quote: row.quote || '',
    submitted: row.created_at,
    status: row.status,
  }
}

export function getMemorialQueue() {
  if (USE_REMOTE) {
    return (async () => {
      const { data, error } = await supabase.from('memorials').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data.map(queueRowFromMemorial)
    })()
  }
  return local(() => MEMORIAL_QUEUE)
}

export function updateMemorialQueueStatus(id, status) {
  return mutate(() => updateMemorialQueueStatusRaw(id, status))
}
function updateMemorialQueueStatusRaw(id, status) {
  if (USE_REMOTE) {
    return (async () => {
      const { data, error } = await supabase.from('memorials').update({ status }).eq('id', id).select()
      if (error) throw error
      return queueRowFromMemorial(assertChanged(data, 'update this memorial'))
    })()
  }
  return local(() => {
    const m = getMemorialQueueById(id)
    if (m) m.status = status
    return m
  })
}

// patch: { name, birth, death, blockId, lotNo, quote, status }
export function updateMemorial(id, patch) {
  return mutate(async () => {
    if (USE_REMOTE) {
      const { data, error } = await supabase.from('memorials').update({
        name: patch.name, quote: patch.quote, status: patch.status,
        birth_date: patch.birth || null, death_date: patch.death || null,
        block_id: patch.blockId || null, lot_no: patch.lotNo ? Number(patch.lotNo) : null,
      }).eq('id', id).select()
      if (error) throw error
      return queueRowFromMemorial(assertChanged(data, 'save this memorial'))
    }
    return local(() => {
      const m = getMemorialQueueById(id)
      if (m) Object.assign(m, { ...patch, lotNo: patch.lotNo ? Number(patch.lotNo) : null })
      return m
    })
  })
}

export function deleteMemorial(id) {
  return mutate(async () => {
    if (USE_REMOTE) {
      const { data, error } = await supabase.from('memorials').delete().eq('id', id).select('id')
      if (error) throw error
      assertChanged(data, 'delete this memorial')
      return { id }
    }
    return local(() => {
      const idx = MEMORIAL_QUEUE.findIndex((m) => m.id === id)
      if (idx >= 0) MEMORIAL_QUEUE.splice(idx, 1)
      return { id }
    })
  })
}

// ── Settings (saved on this device until a settings table exists) ───────────
const SETTINGS_KEY = 'gl-admin:settings'
const DEFAULT_SETTINGS = {
  cemeteryName: PARK.name, address: PARK.address, contactNumber: PARK.tel, tagline: PARK.tagline,
  emailNotifications: true, smsNotifications: true, memorialAlerts: true, newUserAlerts: true, systemAlerts: false,
}
export function getSettings() {
  return local(() => {
    try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) } }
    catch { return { ...DEFAULT_SETTINGS } }
  })
}
export function saveSettings(settings) {
  return mutate(() => local(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return settings
  }))
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function getNotifications() {
  // NOTE: not yet wired to Supabase.
  return local(() => ({ sent: SENT_NOTIFICATIONS, stats: NOTIFICATION_STATS, alerts: SYSTEM_ALERTS }))
}

// payload: { title, body, recipients, scheduledFor? }
export function sendNotification(payload) {
  return mutate(() => local(() => {
    const rec = { id: `notif-${Date.now()}`, unread: true, sentAt: new Date().toISOString(), ...payload }
    SENT_NOTIFICATIONS.unshift(rec)
    return rec
  }))
}

// Row shape from Supabase (snake_case) → the shape pages already expect
// (camelCase, per BACKEND_INTEGRATION.md's data model — same mapper shape as
// the User-Dashboard's reservationApi.js, since both read the same table).
function reservationFromRow(row) {
  return {
    id: row.id, userId: row.user_id, applicantName: row.applicant_name,
    email: row.email, contactNumber: row.contact_number,
    blockId: row.block_id, blockName: row.block_name, lawnName: row.lawn_name,
    lotId: row.lot_id, lotNo: row.lot_no, classification: row.classification,
    price: row.price, reservationDate: row.reservation_date,
    paymentOption: row.payment_option, notes: row.notes, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

// ── Reservations (admin view) ────────────────────────────────────────────────
// Frontend-only for now (see BACKEND_INTEGRATION.md). Reads/writes the same
// mock store the User-Dashboard's api/reservationApi.js uses conceptually —
// in production both dashboards would hit the same `reservations` table, so
// updateReservationStatus() here and cancelReservation() there are really the
// same backend operation viewed from two roles (admin vs the reservation's
// own user).
export function getReservations() {
  if (USE_REMOTE) {
    return (async () => {
      const { data, error } = await supabase.from('reservations').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data.map(reservationFromRow)
    })()
  }
  return local(() => MOCK_RESERVATIONS)
}

export function getReservationById(id) {
  if (USE_REMOTE) {
    return (async () => {
      const { data, error } = await supabase.from('reservations').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data ? reservationFromRow(data) : null
    })()
  }
  return local(() => getReservationByIdSync(id))
}

// status: one of RESERVATION_STATUS (config/adminStatus.js) — 'confirmed',
// 'rejected', or 'cancelled' from this page's action buttons.
export function updateReservationStatus(id, status) {
  return mutate(() => updateReservationStatusRaw(id, status))
}
function updateReservationStatusRaw(id, status) {
  if (USE_REMOTE) {
    return (async () => {
      // Atomic on the database side: updates the reservation AND mirrors the
      // change onto the lot's status (confirmed→sold, rejected/cancelled→
      // available) in one transaction — see set_reservation_status in
      // reservations-schema.sql.
      const { data, error } = await supabase.rpc('set_reservation_status', {
        p_reservation_id: id, p_status: status,
      })
      if (error) throw error
      return reservationFromRow(data)
    })()
  }
  return local(() => {
    const r = getReservationByIdSync(id)
    if (!r) return null
    r.status = status
    r.updatedAt = new Date().toISOString()
    return r
  })
}

// Deletes the reservation record. A pending/confirmed one is cancelled first
// so its lot is released back to available before the row disappears.
export function deleteReservation(id) {
  return mutate(async () => {
    if (USE_REMOTE) {
      const { data: row, error: readErr } = await supabase.from('reservations').select('status').eq('id', id).maybeSingle()
      if (readErr) throw readErr
      if (row && ['pending', 'confirmed'].includes(row.status)) {
        const { error: rpcErr } = await supabase.rpc('set_reservation_status', { p_reservation_id: id, p_status: 'cancelled' })
        if (rpcErr) throw rpcErr
      }
      const { data, error } = await supabase.from('reservations').delete().eq('id', id).select('id')
      if (error) throw error
      assertChanged(data, 'delete this reservation')
      return { id }
    }
    return local(() => {
      const idx = MOCK_RESERVATIONS.findIndex((r) => r.id === id)
      if (idx >= 0) MOCK_RESERVATIONS.splice(idx, 1)
      return { id }
    })
  })
}

// ── Reports: paid payments + monthly income ──────────────────────────────────
// A "paid payment" is money actually received:
//   1. Reservation initial payment (full cash payment or installment down
//      payment) — counted once it has a received date (due_now_received_on)
//      or its payment_status is 'verified'. Rejected/cancelled reservations
//      are skipped.
//   2. Installment payments (installment_payments table) with status 'verified'.
// Each item: { id, date:'YYYY-MM-DD', payer, plot, type, method, amount, source }
const RES_EXCLUDED = ['rejected', 'cancelled']

function reservationPayment(r) {
  const received = r.due_now_received_on
    || (r.payment_status === 'verified' ? String(r.updated_at || r.created_at || '').slice(0, 10) : null)
  if (!received || RES_EXCLUDED.includes(r.status)) return null
  const isInstallment = r.payment_option === 'installment'
  const amount = Number(r.due_now_amount ?? (isInstallment ? r.down_payment : r.price)) || 0
  if (amount <= 0) return null
  return {
    id: `res-${r.id}`,
    date: received,
    payer: r.applicant_name || '—',
    plot: [r.block_name, r.lot_no != null ? `Lot ${r.lot_no}` : null].filter(Boolean).join(' · ') || '—',
    type: isInstallment ? 'Down payment' : 'Full payment',
    method: r.payment_method || (r.payment_option === 'gcash' ? 'gcash' : 'cash'),
    amount,
    source: 'reservation',
  }
}

export async function getPaidPayments() {
  if (USE_REMOTE) {
    const [resQ, instQ] = await Promise.all([
      supabase.from('reservations').select(
        'id, applicant_name, block_name, lot_no, price, payment_option, payment_method, payment_status, status, down_payment, due_now_amount, due_now_received_on, created_at, updated_at',
      ),
      supabase.from('installment_payments').select('id, reservation_id, kind, amount, method, paid_on, status').eq('status', 'verified'),
    ])
    if (resQ.error) throw resQ.error
    const reservations = resQ.data || []
    const byId = Object.fromEntries(reservations.map((r) => [r.id, r]))

    const payments = reservations.map(reservationPayment).filter(Boolean)
    const warnings = []
    if (instQ.error) {
      warnings.push(`Installment payments could not be loaded (${instQ.error.message}).`)
    } else {
      for (const p of instQ.data || []) {
        const r = byId[p.reservation_id] || {}
        payments.push({
          id: `inst-${p.id}`,
          date: String(p.paid_on).slice(0, 10),
          payer: r.applicant_name || '—',
          plot: [r.block_name, r.lot_no != null ? `Lot ${r.lot_no}` : null].filter(Boolean).join(' · ') || '—',
          type: p.kind === 'adjustment' ? 'Adjustment' : 'Monthly installment',
          method: p.method || 'cash',
          amount: Number(p.amount) || 0,
          source: 'installment',
        })
      }
    }
    payments.sort((a, b) => b.date.localeCompare(a.date))
    return { payments, warnings }
  }

  // Local mock mode: treat confirmed/completed mock reservations as paid in full.
  return local(() => {
    const payments = MOCK_RESERVATIONS
      .filter((r) => ['confirmed', 'completed'].includes(r.status))
      .map((r) => ({
        id: `res-${r.id}`,
        date: String(r.updatedAt || r.createdAt).slice(0, 10),
        payer: r.applicantName,
        plot: `${r.blockName} · Lot ${r.lotNo}`,
        type: r.paymentOption === 'installment' ? 'Down payment' : 'Full payment',
        method: r.paymentOption === 'gcash' ? 'gcash' : 'cash',
        amount: Number(r.price) || 0,
        source: 'reservation',
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
    return { payments, warnings: [] }
  })
}

// Re-export the shared lot-status enum so pages never need to import both
// api/ and config/status.js just to compare a value.
export { STATUS }