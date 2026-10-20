# BACKEND_INTEGRATION.md — Reservation Feature

This documents the **frontend-only** reservation feature added to both the
User-Dashboard and Admin-dashboard so a backend developer can wire it up to a
real database/API without touching the UI. Everything described below is
currently mock/local data — nothing is persisted to Supabase yet.

## 1. Reservation Data Model

Both dashboards use the same reservation object shape:

```js
{
  id,               // string, e.g. "res-1001"
  userId,           // the applicant's auth user id
  applicantName,    // string
  email,            // string
  contactNumber,    // string
  blockId,          // e.g. "block-3" — matches data/blocks.js
  blockName,        // denormalized display name, e.g. "Block 3"
  lawnName,         // denormalized, e.g. "Timeless Memory Lawn" (nullable)
  lotId,            // e.g. "block-3-45" — matches a lot's id from data/lots.js
  lotNo,            // number
  classification,   // e.g. "Premium" — matches config/constants.js CLASSIFICATION
  price,            // number, PHP (snapshot of the lot's price at reservation time)
  reservationDate,  // 'YYYY-MM-DD'
  paymentOption,    // 'cash' | 'installment'
  notes,            // string, optional
  status,           // 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed'
  createdAt,        // ISO timestamp
  updatedAt,        // ISO timestamp
}
```

`blockName`/`lawnName`/`classification`/`price` are denormalized onto the
record purely so the mock UI doesn't need a join. A real backend can either
keep denormalizing them on write, or drop them and have the frontend hydrate
via `getBlock(blockId)` / `getLot(blockId, lotNo)` — either works with the
current screens since they read these fields off the reservation object.

Status lives in:
- User-Dashboard: `src/config/reservationStatus.js`
- Admin-dashboard: `src/config/adminStatus.js` (`RESERVATION_STATUS`)

Both are kept value-identical on purpose.

## 2. Frontend API Functions

**User-Dashboard** (`src/api/reservationApi.js`, re-exported from
`src/api/index.js` — screens only ever import from `api/index.js`):

| Function | Purpose |
|---|---|
| `createReservation(payload)` | Submit a new reservation. `payload` is a subset of the model above (no `id`/`status`/timestamps). |
| `getMyReservations(userId)` | List the signed-in user's own reservations. |
| `getReservationById(id)` | Fetch one reservation (used by the detail screen). |
| `cancelReservation(id)` | User-initiated cancel — sets status to `cancelled`. |

**Admin-dashboard** (`src/api/index.js`):

| Function | Purpose |
|---|---|
| `getReservations()` | List all reservations (Reservations page). |
| `getReservationById(id)` | Fetch one reservation (detail modal). |
| `updateReservationStatus(id, status)` | Admin confirm/reject/cancel actions. |

Every function currently branches on `ENV.USE_REMOTE` (see
`config/constants.js`) exactly like the rest of `api/index.js` — when
`USE_REMOTE` is false they resolve from the in-memory mock arrays in
`data/mockReservations.js`; when true they currently `throw new Error(...)`
with a `TODO(backend)` comment marking exactly what Supabase call belongs
there. That's the integration point — replace the `throw` with the real
query/insert/update and the rest of the app needs no changes.

## 3. Expected Backend Shape

A `reservations` table with columns matching the model in section 1
(snake_case, e.g. `applicant_name`, `block_id`, `lot_no`, `payment_option`,
`reservation_date`, `created_at`, `updated_at`) is enough to satisfy both
dashboards as-is. `user_id` should be a foreign key to `auth.users`/`profiles`
so RLS can scope `getMyReservations` to `auth.uid()`.

Suggested RLS shape (mirrors the pattern already used for `memorials` in
`api/index.js`):
- Any authenticated user can `INSERT` a reservation for themselves.
- A user can `SELECT`/`UPDATE` (cancel) only their own rows.
- An admin (`profiles.role = 'admin'`) can `SELECT`/`UPDATE` all rows.

## 4. Integration Points (search for these)

- `src/api/reservationApi.js` (User-Dashboard) — every function has a
  `TODO(backend)` comment where the Supabase call goes.
- `src/api/index.js` (Admin-dashboard) — same, in the "Reservations (admin
  view)" section.
- Both currently import from `data/mockReservations.js` — once real queries
  are wired in, those imports (and the file itself) can be deleted.

**Important:** confirming a reservation should also flip the underlying lot's
status (e.g. to `sold`/`reserve_lot`) so the map and the reservation stay in
sync. The mock `createReservation()` does this locally as a plain in-memory
mutation (`lot.status = STATUS.RESERVE_LOT`); a real backend should do the
equivalent as part of the same transaction/RPC as the insert/update, not as a
separate client-side call, to avoid the two drifting apart under concurrent
users. The frontend's duplicate-reservation check (refusing to reserve a lot
that isn't `available`) is a UX nicety only — it is not a substitute for a
real unique/exclusion constraint or transaction on the backend.

## 5. Authentication

Both dashboards already have real Supabase Auth wired up behind
`ENV.USE_REMOTE` (see `context/AppContext.jsx` / `context/AdminContext.jsx`).
The signed-in user's id is available as `user.id` (User-Dashboard) — pass this
as `userId` into `createReservation`. In local-stub mode (`USE_REMOTE=false`)
there is no real session, so the reservation screens fall back to the literal
string `'local-demo-user'`.

## 6. Lot Availability

A lot's sellability is a pure function of its status:
`isSellable(status)` in `config/status.js` (only `available` returns `true`
today). Both the "Reserve Lot" button (User-Dashboard's `PlotDetailScreen`)
and the mock `createReservation()` guard check this. Lot data itself comes
from `data/lots.js` via `getLotsForBlock(blockId)` / `api.getLots(blockId)` —
same source both dashboards already use for the map.

## 7. What's Explicitly NOT Done Here

Per the frontend-only brief, none of the following were touched:
- No SQL/schema/migration files, no RLS policies, no Supabase functions or
  triggers, no service-role key usage.
- No real persistence — reservations created in the demo live only in memory
  for the current browser session/tab and reset on reload.
