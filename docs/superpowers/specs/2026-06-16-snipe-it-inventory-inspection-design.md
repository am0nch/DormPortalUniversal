# Snipe-IT Architecture: Inventory + Room Inspection Redesign

**Date:** 2026-06-16  
**Scope:** `dorm-db.js`, `modules/inventory.html`, `modules/room-inspection.html`  
**Approach:** Option A (schema upgrade) + Option C (inspection↔inventory linkage) — proper model/instance separation backed by IndexedDB object stores.

---

## Problem

Two gaps exist in the current system:

1. **No asset lifecycle.** `dormInventory` items have a `condition` field but no status (available / checked-out / in-maintenance / retired) and no history. There is no way to know which room a mattress is currently in or what happened to it last semester.

2. **Inspection is disconnected from inventory.** `room-inspection.html` uses hardcoded `SIDE_ITEMS` / `SHARED_ITEMS` JS constants. When a move-out inspection records damage and raises a charge, nothing writes back to the asset record. The inventory permanently shows "Good" even after a student destroyed a chair.

---

## Goals

- Asset Models (templates) are first-class objects — physical assets are instances of them.
- Every physical asset has a status label and an immutable checkout log.
- Room inspection's checklist is built from actual IDB assets in that room, not hardcoded constants.
- Damage charges from a move-out inspection write condition-change events back to the affected assets.
- All asset data lives in IndexedDB (not localStorage) to support unbounded checkout history.

---

## Non-goals

- Manufacturer / supplier records (Snipe-IT has these; a dorm doesn't need them)
- Multi-level location hierarchy (Building → Floor → Room) — rooms are the deepest unit here
- License management, accessories, consumables tracking beyond what already exists
- Custom fields per category
- Migration of existing `dormInventory` localStorage data (inventory is empty)

---

## Data Model

### Asset Model (`dormInventoryModels` IDB store)

One record per type of asset. Defines the template; physical assets are instances.

```js
{
  id: String,            // generateId()
  name: String,          // 'Mattress', 'Study Table', 'Ceiling Fan'
  category: String,      // 'Furniture' | 'Fixtures' | 'Security' | 'Supplies' | 'Appliances'
  scope: String,         // 'per-side' | 'shared' | 'bathroom'
  replacementCost: Number,  // base replacement cost in THB
  expectedQtyPerRoom: Number,  // how many expected per standard room
  acRoomOnly: Boolean,   // true → only present in AC rooms
  notes: String,
  createdAt: String,     // ISO date
}
```

**Pre-seeded on first load** from current `ROOM_TEMPLATE` defaults and `SIDE_ITEMS`/`SHARED_ITEMS` constants so no data is lost.

### Asset Instance (`dormInventoryAssets` IDB store)

One record per physical object. The actual mattress in Room 302-A.

```js
{
  id: String,              // generateId()
  modelId: String,         // → dormInventoryModels.id
  name: String,            // usually from model, overridable
  category: String,
  location: String,        // room number or custom location id
  locationType: String,    // 'room' | 'storage' | 'custom'
  side: String,            // 'A' | 'B' | '' (shared)
  serialNo: String,
  brand: String,
  assetTag: String,        // unique barcode label
  description: String,
  isConsumable: Boolean,
  qty: Number,
  reorderAt: Number,
  notes: String,
  addedAt: String,         // ISO date
  lastChecked: String,     // ISO date
  purchaseDate: String,
  purchasePrice: Number,

  // Snipe-IT lifecycle fields
  statusLabel: String,     // 'available' | 'checked-out' | 'in-maintenance' | 'retired'
  checkedOutTo: String,    // room number when statusLabel === 'checked-out'
  condition: String,       // 'Good' | 'Average' | 'Poor' | 'Missing' — last known

  checkoutLog: [           // append-only event history
    {
      event: String,       // 'checkout' | 'checkin' | 'condition-change' | 'maintenance' | 'retired'
      room: String,
      side: String,
      date: String,        // ISO date
      by: String,          // DormDB.getCurrentUser()
      conditionBefore: String,
      conditionAfter: String,
      inspectionId: String,  // links to dormInspections record
      notes: String,
    }
  ],
}
```

**IDB indexes on `dormInventoryAssets`:** `location`, `modelId`, `statusLabel`  
**IDB indexes on `dormInventoryModels`:** `category`

---

## DormDB Changes (`dorm-db.js`)

### IDB version bump: v3 → v4

Two new object stores added in `onupgradeneeded`:

```js
if (oldVersion < 4) {
  db.createObjectStore('dormInventoryModels', { keyPath: 'id' })
    .createIndex('category', 'category');
  const assetStore = db.createObjectStore('dormInventoryAssets', { keyPath: 'id' });
  assetStore.createIndex('location',    'location');
  assetStore.createIndex('modelId',     'modelId');
  assetStore.createIndex('statusLabel', 'statusLabel');
}
```

### New async API

**Models:**
```js
DormDB.getInvModels()              // → Promise<Model[]>
DormDB.saveInvModel(model)         // upsert by id → Promise<void>
DormDB.deleteInvModel(id)          // → Promise<void>
```

**Assets:**
```js
DormDB.getAllAssets()              // → Promise<Asset[]>
DormDB.getAssetsByRoom(room)       // → Promise<Asset[]>  (uses location index)
DormDB.getAssetsByStatus(status)   // → Promise<Asset[]>  (uses statusLabel index)
DormDB.saveAsset(asset)            // upsert by id → Promise<void>
DormDB.deleteAsset(id)             // → Promise<void>
DormDB.appendCheckoutEvent(assetId, event)  // atomic: get → push → put → Promise<void>
```

### `getMenuStats()` additions

`getMenuStats()` is currently synchronous. IDB stats are pre-computed via a separate async helper called once at init and on cross-tab sync events:

```js
async function _refreshIdbStats() {
  const maint = await DormDB.getAssetsByStatus('in-maintenance');
  DormDB._cachedStats.invMaint = maint.length;
}
```

`getMenuStats()` reads `DormDB._cachedStats.invMaint` (defaults to 0 until first async refresh). This preserves the sync contract for all callers.

### `exportAll` / `importAll`

Both updated to include `dormInventoryModels` and `dormInventoryAssets` IDB stores so asset data survives a full export/import cycle.

### Legacy localStorage cleanup

`dormInventory` localStorage key is retired. `K.INVENTORY` constant removed after migration gate (inventory is empty, so no migration script needed — key simply stops being written).

---

## Inventory Module (`modules/inventory.html`)

### New tab: Models

Inserted before Settings tab. Full CRUD for the asset model library:

- Table: name, category, scope, replacement cost, expected qty, AC-only flag
- Add / Edit modal (same fields as model schema)
- Delete with guard: "X assets use this model — delete anyway?"
- Pre-seeded from `ROOM_TEMPLATE` on first load if `dormInventoryModels` store is empty

### Items tab — upgrades

- Add Item modal: **Model picker** dropdown pre-fills name, category, replacement cost, scope → side assignment
- Each row shows a **status badge**: Available (green) / Checked Out (blue) / In Maintenance (amber) / Retired (gray)
- Inline **Checkout** button on available items → sets `statusLabel = 'checked-out'`, `checkedOutTo = room`, appends `checkout` event
- Inline **Checkin** button on checked-out items → inverse
- Item detail drawer (click row): shows full `checkoutLog` timeline — room history, condition events, linked inspection IDs

### Dashboard tab — additions

Two new stat cards: **In Maintenance** and **Checked Out**. Existing cards (Total, by Condition, Missing) unchanged.

### Settings tab

Room Template section removed — superseded by Models tab. Other settings unchanged.

### Unchanged tabs

By Location, Labels, Maintenance, Bedding, Audit Log — UI unchanged; queries migrate from `DormDB.getInventory()` → `await DormDB.getAllAssets()`.

---

## Room Inspection Module (`modules/room-inspection.html`)

### Checklist source: constants → live IDB query

`SIDE_ITEMS` and `SHARED_ITEMS` constants are removed.

On opening a new inspection for room R:

```
assets = await DormDB.getAssetsByRoom(R)
sideA  = assets.filter(a => a.side === 'A')
sideB  = assets.filter(a => a.side === 'B')
shared = assets.filter(a => a.side === '')
```

Each checklist row carries the asset's `id` — the grid is now asset-aware.

**Fallback** (room has no assets recorded): Banner shown — *"No assets recorded for this room. Add them in Inventory first, or tap 'Use Default Template' to pre-populate from models."* Default template button runs the same populate-from-models logic as the current "Populate Room" feature in inventory.

### `getDefaultCharges()` source change

Reads replacement costs from `await DormDB.getInvModels()` keyed by model name, instead of hardcoded `SIDE_ITEMS` base values.

### Move-in save — asset write-back

For each asset in the checklist:

```js
asset.statusLabel  = 'checked-out'
asset.checkedOutTo = room
checkoutLog.push({ event: 'checkout', room, side, date, by: currentUser,
                   conditionAfter: recordedCondition, inspectionId: rec.id })
await DormDB.saveAsset(asset)
```

### Move-out save — asset write-back

`conditionBefore` source: read the `conditionAfter` of the most recent `checkout` event in `asset.checkoutLog`; if no prior checkout event exists, fall back to `asset.condition`.

For each asset in the checklist:

```js
const lastCheckout = [...asset.checkoutLog].reverse().find(e => e.event === 'checkout');
const conditionBefore = lastCheckout?.conditionAfter ?? asset.condition;

// Always append checkin
checkoutLog.push({ event: 'checkin', room, side, date, by: currentUser,
                   conditionBefore, conditionAfter: currentCondition,
                   inspectionId: rec.id })

// If condition degraded
if (severity exists for conditionBefore → conditionAfter):
  asset.condition   = currentCondition
  asset.statusLabel = currentCondition === 'Missing' ? 'in-maintenance' : 'available'
  checkoutLog.push({ event: 'condition-change', ... })

asset.checkedOutTo = ''
await DormDB.saveAsset(asset)
```

### What doesn't change

- Charge calculation (`SEVERITY` multipliers) — identical logic, reads asset data instead of DOM element names
- Photos (existing IDB pattern, `insp_<id>_<slotKey>` photo IDs)
- Key issuance on move-in (`_writeKeyIssuanceFromInspection`)
- Clearance pre-fill on move-out
- Print / A4 inspection sheet
- Charges tab and Edit Charges modal
- `calcChargeTotal()` signature

---

## Room Number Normalization

### Problem

AC status is currently encoded in the room number string (`302AC`, `302 AC`, `302`). This causes three bugs:

1. `isAcRoom()` in inventory, inspection, floor-plan, and utilities each independently check `room.includes('AC')` — string detection, not a data lookup.
2. `dormInventoryAssets.location` could silently store `'302AC'` or `'302'` for the same physical room, making IDB index queries unreliable.
3. `room-reservations.html`'s room generator already has an `s.ac` boolean on every slot (the AC column checkbox at line 1025–1026) — but it's never used by inventory or inspection.

### Fix: canonical room IDs + `isAcRoom()` lookup

**Canonical form:** room numbers stored without suffix — always `'302'`, never `'302AC'` or `'302 AC'`.

**Helper added to `dorm-db.js`** (used by all callers):

```js
// Strip AC suffix for a canonical room id
DormDB.normalizeRoomId = (room) => room ? room.replace(/\s*AC$/i, '').trim() : '';
```

**`isAcRoom()` replaced** — reads the `ac` boolean from `dormData` instead of string-matching:

```js
// In dorm-db.js — replaces per-module isAcRoom/isAC helpers
DormDB.isAcRoom = (room) => {
  const norm = DormDB.normalizeRoomId(room);
  return DormDB.getRooms().some(s => DormDB.normalizeRoomId(s.room) === norm && s.ac === true);
};
```

All per-module `isAcRoom` / `isAC` functions in `inventory.html`, `room-inspection.html`, `floor-plan.html`, and `utilities.html` are removed and replaced with `DormDB.isAcRoom(room)`.

### Impact on this implementation

- `dormInventoryAssets.location` always stores the normalized room id (`'302'`).
- `getAssetsByRoom(room)` normalizes its argument before querying the IDB index.
- Template pre-population (`acRoomOnly` filter) calls `DormDB.isAcRoom(room)` — no string suffix checks.
- `room-inspection.html`'s `_isAC` local variable (line 574) replaced by `await DormDB.isAcRoom(room)`.

### Scope boundary

This spec only changes the four files listed above. Fixing the room-list generator in `room-reservations.html` (which produces mixed-format strings at line 836–838) is a separate task — it does not block this implementation because `normalizeRoomId()` handles the stripping at read time.

---

## Cross-module dependency map additions

| DormDB key / store | Written by | Read by |
|---|---|---|
| `dormInventoryModels` (IDB) | inventory | inventory, room-inspection |
| `dormInventoryAssets` (IDB) | inventory, room-inspection | inventory, room-inspection, index.html (stats) |

---

## Sequence: move-out inspection with damage

```
Dean opens move-out form for Room 302
  → getAssetsByRoom('302AC') → 24 assets loaded into grid
Dean sets Chair (Side A) condition: Good → Poor
Dean clicks Save Inspection
  → dormInspections record saved (existing flow)
  → charges calculated (existing SEVERITY logic)
  → clearance pre-filled (existing flow)
  → FOR EACH asset in grid:
       appendCheckoutEvent(asset.id, { event:'checkin', conditionBefore, conditionAfter, inspectionId })
       IF condition degraded:
         saveAsset({ ...asset, condition: 'Poor', statusLabel: 'available' })
         appendCheckoutEvent(asset.id, { event:'condition-change', ... })
```

---

## Files changed

| File | Type of change |
|---|---|
| `dorm-db.js` | IDB v4 upgrade, 2 new stores, 8 new async methods, `normalizeRoomId`, `isAcRoom` lookup, `_cachedStats`, getMenuStats update, exportAll/importAll update |
| `modules/inventory.html` | Models tab (new), Items tab upgrades, Dashboard additions, Settings cleanup, all queries → async IDB, `isAcRoom` → `DormDB.isAcRoom` |
| `modules/room-inspection.html` | Remove SIDE_ITEMS/SHARED_ITEMS, live asset query, move-in/move-out write-back, `_isAC` → `DormDB.isAcRoom` |
| `modules/floor-plan.html` | `isAC` string check → `DormDB.isAcRoom` |
| `modules/utilities.html` | `isAC` string check → `DormDB.isAcRoom` |
| `sw.js` | Cache version bump after deploy |
