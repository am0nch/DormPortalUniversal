# Snipe-IT Inventory + Room Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade inventory and room inspection to a Snipe-IT-style asset model/instance architecture backed by IndexedDB, with live inspection checklists drawn from actual room assets and full condition write-back on save.

**Architecture:** Two new IDB object stores (`dormInventoryModels`, `dormInventoryAssets`) replace the `dormInventory` localStorage key. Room inspection replaces hardcoded `SIDE_ITEMS`/`SHARED_ITEMS` constants with a live `getAssetsByRoom()` query; move-in/out saves write condition events back to each asset's `checkoutLog`. AC room detection is centralised in `DormDB.isAcRoom()` instead of per-module string checks.

**Tech Stack:** Vanilla JS (ES6+), IndexedDB (existing `DormManagerDB`), BroadcastChannel (`dorm-sync`), no build process.

**Spec:** `docs/superpowers/specs/2026-06-16-snipe-it-inventory-inspection-design.md`

---

## File Map

| File | Change type |
|---|---|
| `dorm-db.js` | IDB v4, 2 new stores, async API, BroadcastChannel IDB events, `normalizeRoomId`, `isAcRoom`, `_cachedStats`, `exportAll`/`importAll` async upgrade, `K.INVENTORY` retired |
| `modules/inventory.html` | Models tab (new), Items tab upgrades, Dashboard additions, async `pushToMaintenance`, asset detail drawer |
| `modules/room-inspection.html` | Replace SIDE_ITEMS/SHARED_ITEMS with live IDB query, move-in/out write-back, barcode scan highlight, photoId on condition-change events |
| `modules/floor-plan.html` | `isAC` string check → `DormDB.isAcRoom()` |
| `modules/utilities.html` | `isAC` string check → `DormDB.isAcRoom()` |
| `index.html` | Subscription update, `_refreshIdbStats` call |
| `sw.js` | Cache version bump |

---

## Task 1: IDB v4 — new stores + private helpers in `dorm-db.js`

**Files:**
- Modify: `dorm-db.js`

- [ ] **Step 1: Bump IDB version and add store constants**

Find the line `const IDB_VERSION = 3;` and replace with:

```js
const IDB_VERSION = 4;
const IDB_INV_MODELS = 'dormInventoryModels';
const IDB_INV_ASSETS = 'dormInventoryAssets';
```

- [ ] **Step 2: Add v4 stores in `onupgradeneeded`**

Find the `req.onupgradeneeded` block. The current guard structure ends with:
```js
if (!db.objectStoreNames.contains(IDB_KV_ARC))  db.createObjectStore(IDB_KV_ARC);
```

Add immediately after that line, still inside the `onupgradeneeded` handler:
```js
if (oldVersion < 4) {
  db.createObjectStore(IDB_INV_MODELS, { keyPath: 'id' })
    .createIndex('category', 'category');
  const assetStore = db.createObjectStore(IDB_INV_ASSETS, { keyPath: 'id' });
  assetStore.createIndex('location',    'location');
  assetStore.createIndex('modelId',     'modelId');
  assetStore.createIndex('statusLabel', 'statusLabel');
}
```

Note: The existing `onupgradeneeded` doesn't use `oldVersion` yet. The full event signature is `e => { const db = e.target.result;`. Change it to:
```js
req.onupgradeneeded = e => {
  const db = e.target.result;
  const oldVersion = e.oldVersion;
  if (!db.objectStoreNames.contains(IDB_PHOTOS))  db.createObjectStore(IDB_PHOTOS, { keyPath: 'id' });
  if (!db.objectStoreNames.contains(IDB_KV))      db.createObjectStore(IDB_KV);
  if (!db.objectStoreNames.contains(IDB_KV_ARC))  db.createObjectStore(IDB_KV_ARC);
  if (oldVersion < 4) {
    db.createObjectStore(IDB_INV_MODELS, { keyPath: 'id' })
      .createIndex('category', 'category');
    const assetStore = db.createObjectStore(IDB_INV_ASSETS, { keyPath: 'id' });
    assetStore.createIndex('location',    'location');
    assetStore.createIndex('modelId',     'modelId');
    assetStore.createIndex('statusLabel', 'statusLabel');
  }
};
```

- [ ] **Step 3: Add private IDB helpers for the new stores**

Add these four functions immediately after `_arcReadAll()` (before the `_r` / `_w` section):

```js
// ── Inventory IDB helpers (dormInventoryModels + dormInventoryAssets) ────────
function _invGetAll(storeName) {
  return _openIDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => res(req.result ?? []);
    req.onerror   = () => rej(req.error);
  }));
}

function _invGetByIndex(storeName, indexName, value) {
  return _openIDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(storeName, 'readonly')
                  .objectStore(storeName).index(indexName).getAll(value);
    req.onsuccess = () => res(req.result ?? []);
    req.onerror   = () => rej(req.error);
  }));
}

function _invPut(storeName, record) {
  return _openIDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  }));
}

function _invDelete(storeName, id) {
  return _openIDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  }));
}
```

- [ ] **Step 4: Verify IDB opens without errors**

Open `index.html` in the browser. Open DevTools → Application → IndexedDB → `DormManagerDB`. Confirm version is 4 and stores `dormInventoryModels` + `dormInventoryAssets` appear with correct indexes.

- [ ] **Step 5: Commit**

```bash
git add dorm-db.js
git commit -m "feat(db): IDB v4 — add dormInventoryModels + dormInventoryAssets stores"
```

---

## Task 2: Public async API + BroadcastChannel IDB events in `dorm-db.js`

**Files:**
- Modify: `dorm-db.js`

- [ ] **Step 1: Add `_cachedStats` and `_refreshIdbStats`**

Add immediately before the `function _broadcast(key)` line:

```js
// ── Cached IDB stats (for synchronous getMenuStats) ───────────────────────
const _cachedStats = { invMaint: 0, invCheckedOut: 0, invLowStock: 0, invMaintFlagged: 0 };

async function _refreshIdbStats() {
  try {
    const [maint, checkedOut, allAssets] = await Promise.all([
      _invGetByIndex(IDB_INV_ASSETS, 'statusLabel', 'in-maintenance'),
      _invGetByIndex(IDB_INV_ASSETS, 'statusLabel', 'checked-out'),
      _invGetAll(IDB_INV_ASSETS),
    ]);
    _cachedStats.invMaint      = maint.length;
    _cachedStats.invCheckedOut = checkedOut.length;
    _cachedStats.invLowStock   = allAssets.filter(a => a.isConsumable && typeof a.qty === 'number' && a.qty <= (a.reorderAt || 0)).length;
    _cachedStats.invMaintFlagged = allAssets.filter(a => a.maintenanceFlag && !a.maintenancePushed).length;
  } catch(e) { /* best-effort */ }
}
```

- [ ] **Step 2: Add `_broadcastIdb` helper and extend `_channel.onmessage`**

Add `_broadcastIdb` immediately after the existing `_broadcast` function:

```js
function _broadcastIdb(storeName) {
  if (_channel) _channel.postMessage({ store: storeName, ts: Date.now() });
  (_subs[storeName] || []).forEach(fn => { try { fn(); } catch(e) {} });
  if (storeName === IDB_INV_ASSETS) _refreshIdbStats();
}
```

Replace the existing `_channel.onmessage` handler (currently reads `{ key, val }`) with:

```js
if (_channel) {
  _channel.onmessage = ({ data }) => {
    if (data.store) {
      // IDB store changed in another tab
      (_subs[data.store] || []).forEach(fn => { try { fn(); } catch(e) {} });
      if (data.store === IDB_INV_ASSETS) _refreshIdbStats();
      return;
    }
    const { key, val } = data;
    if (val === _DELETED) delete _cache[key];
    else _cache[key] = val;
    (_subs[key] || []).forEach(fn => { try { fn(); } catch(e) {} });
  };
}
```

- [ ] **Step 3: Add public async API methods to the returned object**

In the returned object (the large object literal after `_init()`), add the following section before `KEYS: K,`:

```js
// ── Asset Models (dormInventoryModels IDB store) ──────────────────────────
getInvModels:  () => _invGetAll(IDB_INV_MODELS),
saveInvModel:  async (model) => { await _invPut(IDB_INV_MODELS, model); _broadcastIdb(IDB_INV_MODELS); },
deleteInvModel: async (id)   => { await _invDelete(IDB_INV_MODELS, id); _broadcastIdb(IDB_INV_MODELS); },

// ── Asset Instances (dormInventoryAssets IDB store) ───────────────────────
getAllAssets:        () => _invGetAll(IDB_INV_ASSETS),
getAssetsByRoom:     (room) => _invGetByIndex(IDB_INV_ASSETS, 'location', DormDB.normalizeRoomId(room)),
getAssetsByStatus:   (status) => _invGetByIndex(IDB_INV_ASSETS, 'statusLabel', status),
saveAsset: async (asset) => { await _invPut(IDB_INV_ASSETS, asset); _broadcastIdb(IDB_INV_ASSETS); },
deleteAsset: async (id)  => { await _invDelete(IDB_INV_ASSETS, id); _broadcastIdb(IDB_INV_ASSETS); },
async appendCheckoutEvent(assetId, event) {
  const all  = await _invGetAll(IDB_INV_ASSETS);
  const asset = all.find(a => a.id === assetId);
  if (!asset) return;
  asset.checkoutLog = [...(asset.checkoutLog || []), event];
  await _invPut(IDB_INV_ASSETS, asset);
  _broadcastIdb(IDB_INV_ASSETS);
},

// ── Shared helpers ────────────────────────────────────────────────────────
normalizeRoomId: (room) => room ? String(room).replace(/\s*AC$/i, '').trim() : '',
isAcRoom(room) {
  const norm = DormDB.normalizeRoomId(room);
  return _r(K.ROOMS, []).some(s => DormDB.normalizeRoomId(s.room) === norm && s.ac === true);
},
_refreshIdbStats,
get _cachedStats() { return _cachedStats; },
```

Note: `DormDB.normalizeRoomId` is referenced in `getAssetsByRoom` — this works because the returned object is assigned to `DormDB` at module close before any async calls.

- [ ] **Step 4: Update `getMenuStats()` to use `_cachedStats`**

Inside `getMenuStats()`, remove the line:
```js
const invent   = _r(K.INVENTORY, []);
```

Replace the two lines that use `invent`:
```js
lowStock:           invent.filter(i => typeof i.qty === 'number' && i.isConsumable && i.qty <= (i.reorderAt || 0)).length,
maintenanceFlagged: invent.filter(i => i.maintenanceFlag && !i.maintenancePushed).length,
```
with:
```js
lowStock:           _cachedStats.invLowStock,
maintenanceFlagged: _cachedStats.invMaintFlagged,
```

- [ ] **Step 5: Call `_refreshIdbStats()` at end of `_init()`**

Inside `_init()`, add before `_resolveReady()`:
```js
await _refreshIdbStats();
```

- [ ] **Step 6: Verify in browser**

Open DevTools Console and run:
```js
await DormDB.ready;
const models = await DormDB.getInvModels();
console.log('models:', models);  // expected: []
const assets = await DormDB.getAllAssets();
console.log('assets:', assets);  // expected: []
console.log('isAcRoom test:', DormDB.isAcRoom('302AC'));  // true/false depending on dormData
console.log('normalize:', DormDB.normalizeRoomId('302AC'));  // expected: '302'
```

- [ ] **Step 7: Commit**

```bash
git add dorm-db.js
git commit -m "feat(db): async asset/model API, BroadcastChannel IDB events, normalizeRoomId, isAcRoom"
```

---

## Task 3: `exportAll`/`importAll` async upgrade + `K.INVENTORY` retirement in `dorm-db.js`

**Files:**
- Modify: `dorm-db.js`

- [ ] **Step 1: Remove `K.INVENTORY` and `K.INV_TEMPLATE` from the K constant**

In the K object, remove these two lines:
```js
INVENTORY:    'dormInventory',
INV_TEMPLATE: 'dormInvTemplate',
```
Keep `INV_CFG` and `INV_AUDITS` — they are still used.

- [ ] **Step 2: Remove the retired getter/setter pair**

Remove these two lines from the returned object:
```js
getInventory:    ()  => _r(K.INVENTORY, []),
saveInventory:   (d) => _w(K.INVENTORY, d),
```

- [ ] **Step 3: Update `exportAll` to include IDB asset stores**

In `exportAll()`, add after the cache loop and before the photos block:

```js
// IDB inventory stores (not in _cache)
try {
  dump.dormInventoryModels = await _invGetAll(IDB_INV_MODELS);
  dump.dormInventoryAssets = await _invGetAll(IDB_INV_ASSETS);
} catch(e) { console.warn('Inventory IDB export failed:', e); }
```

- [ ] **Step 4: Update `importAll` to restore IDB asset stores**

In `importAll(dump)`, add after the photos block:

```js
// Restore inventory IDB stores
if (Array.isArray(dump.dormInventoryModels)) {
  for (const m of dump.dormInventoryModels) await _invPut(IDB_INV_MODELS, m);
}
if (Array.isArray(dump.dormInventoryAssets)) {
  for (const a of dump.dormInventoryAssets) await _invPut(IDB_INV_ASSETS, a);
}
if (dump.dormInventoryModels || dump.dormInventoryAssets) {
  _broadcastIdb(IDB_INV_ASSETS);
  _broadcastIdb(IDB_INV_MODELS);
}
```

- [ ] **Step 5: Verify export round-trip in browser**

```js
// In DevTools console — save a test model then export and check
await DormDB.saveInvModel({ id: 'test-1', name: 'Test Model', category: 'Furniture',
  scope: 'per-side', replacementCost: 100, expectedQtyPerRoom: 1,
  acRoomOnly: false, notes: '', createdAt: new Date().toISOString() });
const dump = await DormDB.exportAll();
console.log('models in dump:', dump.dormInventoryModels);  // expected: [{id:'test-1',...}]
// Clean up
await DormDB.deleteInvModel('test-1');
```

- [ ] **Step 6: Commit**

```bash
git add dorm-db.js
git commit -m "feat(db): retire K.INVENTORY, export/import IDB asset stores"
```

---

## Task 4: AC room normalization — `floor-plan.html` + `utilities.html`

**Files:**
- Modify: `modules/floor-plan.html`
- Modify: `modules/utilities.html`

- [ ] **Step 1: Fix `floor-plan.html`**

Find (line 277):
```js
const isAC = room.includes('AC');
```
Replace with:
```js
const isAC = DormDB.isAcRoom(room);
```

- [ ] **Step 2: Fix `utilities.html`**

Find:
```js
function isAC(room) { return room.includes('AC'); }
```
Replace with:
```js
function isAC(room) { return DormDB.isAcRoom(room); }
```

- [ ] **Step 3: Verify in browser**

Open Floor Plan. Confirm AC rooms still show the ❄️ badge. Open Utilities. Confirm AC column still shows correctly. Open DevTools Console — no errors.

- [ ] **Step 4: Run BF-016 check**

```bash
grep -n "localStorage\.\(setItem\|getItem\)" modules/floor-plan.html modules/utilities.html | grep "dorm"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add modules/floor-plan.html modules/utilities.html
git commit -m "fix: isAcRoom reads dormData s.ac boolean instead of string suffix"
```

---

## Task 5: `index.html` — subscription update + `_refreshIdbStats`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace dormInventory subscription**

Find:
```js
DormDB.on('dormInventory',    refreshStats);
```
Replace with:
```js
DormDB.on('dormInventoryAssets', async () => { await DormDB._refreshIdbStats(); refreshStats(); });
DormDB.on('dormInventoryModels', refreshStats);
```

- [ ] **Step 2: Verify `getMenuStats` stat cards still render**

Open `index.html`. The menu dashboard should load without errors. `lowStock` and `maintenanceFlagged` stat cards show 0 (since inventory is empty). Check DevTools Console — no errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix(index): subscribe to dormInventoryAssets IDB events for stats refresh"
```

---

## Task 6: `inventory.html` — Models tab (new)

**Files:**
- Modify: `modules/inventory.html`

- [ ] **Step 1: Add Models tab button**

Find the tabs row containing:
```html
<button class="tab-btn" data-tab="settings" onclick="switchTab('settings')">⚙️ Settings</button>
```
Insert before it:
```html
<button class="tab-btn" data-tab="models" onclick="switchTab('models')">🗂️ Models</button>
```

- [ ] **Step 2: Add Models tab panel HTML**

Find the `<div id="tab-settings"` panel. Insert this panel before it:

```html
<div id="tab-models" class="tab-panel">
  <div class="toolbar" style="margin-bottom:12px">
    <button class="btn btn-green" onclick="openModelModal()">➕ Add Model</button>
    <span id="modelsCount" style="font-size:.78rem;color:#888;margin-left:8px"></span>
  </div>
  <div class="tbl-wrap">
    <table class="h-tbl" id="modelsTable">
      <thead>
        <tr>
          <th>Name</th><th>Category</th><th>Scope</th><th>Replacement Cost</th>
          <th>Qty/Room</th><th>AC Only</th><th></th>
        </tr>
      </thead>
      <tbody id="modelsBody"></tbody>
    </table>
  </div>
</div>

<!-- Model modal -->
<div class="modal" id="modelModal">
  <div class="modal-content" style="max-width:480px">
    <span class="close-btn" onclick="closeModelModal()">&times;</span>
    <h2 id="modelModalTitle">Add Asset Model</h2>
    <div class="fg"><label>Name</label><input type="text" id="mm_name" placeholder="e.g. Mattress"></div>
    <div class="fg-row">
      <div class="fg"><label>Category</label>
        <select id="mm_cat">
          <option>Furniture</option><option>Fixtures</option>
          <option>Security</option><option>Supplies</option><option>Appliances</option>
        </select>
      </div>
      <div class="fg"><label>Scope</label>
        <select id="mm_scope">
          <option value="per-side">Per-Side</option>
          <option value="shared">Shared</option>
          <option value="bathroom">Bathroom</option>
        </select>
      </div>
    </div>
    <div class="fg-row">
      <div class="fg"><label>Replacement Cost (฿)</label><input type="number" id="mm_cost" min="0" value="0"></div>
      <div class="fg"><label>Expected Qty/Room</label><input type="number" id="mm_qty" min="1" value="1"></div>
    </div>
    <div class="fg" style="align-items:center;gap:8px">
      <label style="width:auto">AC Rooms Only</label>
      <input type="checkbox" id="mm_acOnly" style="width:18px;height:18px">
    </div>
    <div class="fg"><label>Notes</label><textarea id="mm_notes" rows="2"></textarea></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModelModal()">Cancel</button>
      <button class="btn btn-green" onclick="saveModelModal()">Save Model</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add Models JS functions**

Add after the existing `switchTab` function:

```js
// ── Asset Models ─────────────────────────────────────────────────────────────
let _editingModelId = null;
let _models = [];

async function loadModels() {
  _models = await DormDB.getInvModels();
}

async function renderModels() {
  await loadModels();
  const tbody = document.getElementById('modelsBody');
  document.getElementById('modelsCount').textContent = `${_models.length} model${_models.length !== 1 ? 's' : ''}`;
  if (!_models.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg" style="text-align:center">No models yet. Add one or seed from the room template.</td></tr>';
    return;
  }
  tbody.innerHTML = _models.map(m => `
    <tr>
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${catBadge(m.category)}</td>
      <td><span style="font-size:.75rem;color:#555">${m.scope}</span></td>
      <td>฿${(m.replacementCost||0).toLocaleString()}</td>
      <td>${m.expectedQtyPerRoom||1}</td>
      <td>${m.acRoomOnly ? '❄️' : '—'}</td>
      <td>
        <button class="btn btn-sm btn-blue" onclick="openModelModal('${escapeHtml(m.id)}')">✏️</button>
        <button class="btn btn-sm btn-red" onclick="deleteModel('${escapeHtml(m.id)}')">✕</button>
      </td>
    </tr>
  `).join('');
}

function openModelModal(id) {
  _editingModelId = id || null;
  const m = id ? _models.find(x => x.id === id) : null;
  document.getElementById('modelModalTitle').textContent = id ? 'Edit Asset Model' : 'Add Asset Model';
  document.getElementById('mm_name').value    = m?.name || '';
  document.getElementById('mm_cat').value     = m?.category || 'Furniture';
  document.getElementById('mm_scope').value   = m?.scope || 'per-side';
  document.getElementById('mm_cost').value    = m?.replacementCost || 0;
  document.getElementById('mm_qty').value     = m?.expectedQtyPerRoom || 1;
  document.getElementById('mm_acOnly').checked = !!m?.acRoomOnly;
  document.getElementById('mm_notes').value   = m?.notes || '';
  document.getElementById('modelModal').classList.add('open');
}
function closeModelModal() {
  document.getElementById('modelModal').classList.remove('open');
  _editingModelId = null;
}

async function saveModelModal() {
  const name = document.getElementById('mm_name').value.trim();
  if (!name) { alert('Model name is required.'); return; }
  const model = {
    id:                _editingModelId || generateId(),
    name,
    category:          document.getElementById('mm_cat').value,
    scope:             document.getElementById('mm_scope').value,
    replacementCost:   parseFloat(document.getElementById('mm_cost').value) || 0,
    expectedQtyPerRoom: parseInt(document.getElementById('mm_qty').value) || 1,
    acRoomOnly:        document.getElementById('mm_acOnly').checked,
    notes:             document.getElementById('mm_notes').value.trim(),
    createdAt:         _editingModelId ? (_models.find(m => m.id === _editingModelId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
  };
  await DormDB.saveInvModel(model);
  closeModelModal();
  renderModels();
}

async function deleteModel(id) {
  const assets = await DormDB.getAllAssets();
  const inUse  = assets.filter(a => a.modelId === id).length;
  if (inUse && !confirm(`${inUse} asset(s) use this model. Delete anyway?`)) return;
  await DormDB.deleteInvModel(id);
  renderModels();
}

async function seedModelsFromTemplate() {
  const existing = await DormDB.getInvModels();
  if (existing.length) { alert('Models already exist — clear them first to re-seed.'); return; }
  const tpl = getTemplate(); // existing ROOM_TEMPLATE getter
  // Derive scope from name heuristics (matches SIDE_ITEMS from room-inspection)
  const sideNames = new Set(['Bed Frame','Mattress','Mattress Pad','Bed Decker','Study Desk','Study Table',
    'Chair','Stool','Dressing Stool','Bookshelf','Book Shelf','Wardrobe','Drawer Unit','Built-in Closet',
    'Closet Key','Drawer Key']);
  for (const t of tpl) {
    const scope = sideNames.has(t.name) ? 'per-side' : 'shared';
    await DormDB.saveInvModel({
      id: generateId(),
      name: t.name,
      category: t.category,
      scope,
      replacementCost: 0,
      expectedQtyPerRoom: t.qty || 1,
      acRoomOnly: !!t.acOnly,
      notes: '',
      createdAt: new Date().toISOString(),
    });
  }
  renderModels();
  showToast('Models seeded from room template.');
}
```

- [ ] **Step 4: Wire Models tab into `switchTab`**

In `switchTab`, find the chain of `if (name === ...)` lines. Add:
```js
if (name === 'models')  renderModels();
```

- [ ] **Step 5: Verify in browser**

Open Inventory → Models tab. Confirm the table renders, Add Model modal opens, saves, and appears in the table. Open DevTools → Application → IndexedDB → `dormInventoryModels`. Confirm records appear.

- [ ] **Step 6: Run `wc -l`**

```bash
wc -l modules/inventory.html
```

Record the new count.

- [ ] **Step 7: Commit**

```bash
git add modules/inventory.html
git commit -m "feat(inventory): add Models tab with CRUD and seed-from-template"
```

---

## Task 7: `inventory.html` — upgrade `emptyItem` + Items tab async + status badges

**Files:**
- Modify: `modules/inventory.html`

- [ ] **Step 1: Update `emptyItem()`**

Replace the current `emptyItem` function:

```js
function emptyItem(location, locationType) {
  return {
    id: generateId(),
    name: '', category: 'Furniture',
    location: DormDB.normalizeRoomId(location || ''),
    locationType: locationType || 'room',
    side: '',
    description: '', serialNo: '', brand: '',
    isConsumable: false, qty: 1, reorderAt: 0,
    condition: 'Good',
    maintenanceFlag: false, maintenancePushed: false, maintenanceNotes: '',
    notes: '', addedAt: new Date().toISOString(),
    lastChecked: '', purchaseDate: '', purchasePrice: 0,
    // Snipe-IT lifecycle fields
    modelId:      '',
    assetTag:     '',
    statusLabel:  'available',   // 'available'|'checked-out'|'in-maintenance'|'retired'
    checkedOutTo: '',
    checkoutLog:  [],
  };
}
```

- [ ] **Step 2: Migrate all `DormDB.getInventory()` / `DormDB.saveInventory()` calls to IDB**

Run this to find every occurrence:
```bash
grep -n "DormDB\.getInventory\|DormDB\.saveInventory" modules/inventory.html
```

For each occurrence:
- `DormDB.getInventory()` → `await DormDB.getAllAssets()` (make containing function async if not already)
- `DormDB.saveInventory(arr)` → replace with a loop: `for (const a of arr) await DormDB.saveAsset(a);`

Note: Single-item saves (edit modal) become `await DormDB.saveAsset(item)`. Bulk saves (populate room, clear room) loop through the array.

- [ ] **Step 2b: Fix audit snapshot function**

The audit snapshot function (search: `DormDB.saveInvAudits`) currently reads `DormDB.getInventory()` to stamp `lastChecked` on all items and build the snapshot. Make the function async and replace:

```js
// Before
const inv = DormDB.getInventory();
inv.forEach(i => { i.lastChecked = today; });
DormDB.saveInventory(inv);
```
with:
```js
// After
const inv = await DormDB.getAllAssets();
for (const i of inv) {
  i.lastChecked = today;
  await DormDB.saveAsset(i);
}
```

The rest of the snapshot logic (condition counting, `DormDB.saveInvAudits(audits)`) is unchanged.

- [ ] **Step 3: Add Model picker to Add/Edit Item modal**

Find the Add Item modal. After the `im_name` field, add:
```html
<div class="fg"><label>Model (optional)</label>
  <select id="im_model"><option value="">— No model —</option></select>
</div>
```

In `_fillModal(item)`, add after setting name:
```js
// Populate model picker
const models = await DormDB.getInvModels();
const sel = document.getElementById('im_model');
sel.innerHTML = '<option value="">— No model —</option>' +
  models.map(m => `<option value="${escapeHtml(m.id)}"${item.modelId===m.id?' selected':''}>${escapeHtml(m.name)}</option>`).join('');
// Auto-fill from model selection
sel.onchange = () => {
  const m = models.find(x => x.id === sel.value);
  if (!m) return;
  document.getElementById('im_name').value = m.name;
  document.getElementById('im_cat').value  = m.category;
  document.getElementById('im_price').value = m.replacementCost || 0;
  if (m.scope === 'per-side' && !document.getElementById('im_side').value)
    document.getElementById('im_side').value = 'A';
};
```

Make `_fillModal` async. In `saveItemModal()`, read `modelId`:
```js
item.modelId = document.getElementById('im_model').value || '';
```

- [ ] **Step 4: Add status badge constants and helper**

Add near the top of the script section (alongside existing `COND_COLOR` etc.):

```js
const STATUS_BADGE = {
  'available':       '<span class="badge" style="background:#d4edda;color:#155724">Available</span>',
  'checked-out':     '<span class="badge" style="background:#cce5ff;color:#004085">Checked Out</span>',
  'in-maintenance':  '<span class="badge" style="background:#fff3cd;color:#856404">In Maintenance</span>',
  'retired':         '<span class="badge" style="background:#e2e3e5;color:#383d41">Retired</span>',
};
function statusBadge(s) { return STATUS_BADGE[s] || STATUS_BADGE['available']; }
```

- [ ] **Step 5: Add status badge column to Items table**

In `renderItems()`, find where the table row HTML is built. Add a status badge cell:
```js
<td>${statusBadge(i.statusLabel)}</td>
```
Add the matching `<th>Status</th>` to the table header.

- [ ] **Step 6: Verify in browser**

Open Inventory → Items. Confirm table loads (async). Add an item — confirm Model picker appears and auto-fills. Status badge shows "Available". Check DevTools → `dormInventoryAssets` — item appears.

- [ ] **Step 7: Run wc -l and commit**

```bash
wc -l modules/inventory.html
git add modules/inventory.html
git commit -m "feat(inventory): emptyItem Snipe-IT fields, async IDB queries, model picker, status badges"
```

---

## Task 8: `inventory.html` — asset detail drawer + dashboard + pushToMaintenance fix

**Files:**
- Modify: `modules/inventory.html`

- [ ] **Step 1: Add asset detail drawer HTML**

Add before the closing `</body>`:
```html
<div class="modal" id="assetDetailModal">
  <div class="modal-content" style="max-width:560px">
    <span class="close-btn" onclick="document.getElementById('assetDetailModal').classList.remove('open')">&times;</span>
    <h2 id="adName" style="font-size:1rem;color:#1e3a5f"></h2>
    <div id="adMeta" style="font-size:.8rem;color:#555;margin-bottom:14px"></div>
    <h3 style="font-size:.82rem;font-weight:700;color:#1e3a5f;margin-bottom:8px">History</h3>
    <div id="adLog" style="max-height:340px;overflow-y:auto"></div>
  </div>
</div>
```

- [ ] **Step 2: Add `openAssetDetail(id)` function**

```js
async function openAssetDetail(id) {
  const assets = await DormDB.getAllAssets();
  const item   = assets.find(a => a.id === id);
  if (!item) return;
  document.getElementById('adName').textContent = item.name + (item.side ? ` — Side ${item.side}` : '');
  document.getElementById('adMeta').innerHTML =
    `<strong>Status:</strong> ${statusBadge(item.statusLabel)} &nbsp;
     <strong>Condition:</strong> ${item.condition || 'Good'} &nbsp;
     ${item.assetTag ? `<strong>Tag:</strong> <code>${escapeHtml(item.assetTag)}</code>` : ''}`;
  const log = item.checkoutLog || [];
  document.getElementById('adLog').innerHTML = log.length ? log.slice().reverse().map(e => {
    let icon = { checkout:'📤', checkin:'📥', 'condition-change':'⚠️', maintenance:'🔧', retired:'🗄️' }[e.event] || '•';
    let detail = '';
    if (e.conditionBefore && e.conditionAfter) detail = ` <span style="color:#888">${e.conditionBefore} → ${e.conditionAfter}</span>`;
    let photoHtml = '';
    if (e.photoId) {
      photoHtml = `<img data-photoid="${escapeHtml(e.photoId)}" src="" alt="condition photo"
        style="max-width:120px;max-height:90px;border-radius:4px;margin-top:4px;cursor:pointer;border:1px solid #ddd"
        onclick="openPhotoViewer(null,'${escapeHtml(e.photoId)}')"
        onload="this.style.display='block'" onerror="this.style.display='none'">`;
      // Async load photo blob
      DormDB.getPhoto(e.photoId).then(blob => {
        if (!blob) return;
        const img = document.querySelector(`img[data-photoid="${CSS.escape(e.photoId)}"]`);
        if (img) img.src = URL.createObjectURL(blob);
      });
    }
    return `<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:.78rem">
      ${icon} <strong>${e.event}</strong>${detail} &mdash; ${escapeHtml(e.room||'')}${e.side?' Side '+e.side:''}<br>
      <span style="color:#aaa">${e.date||''} · ${escapeHtml(e.by||'')}</span>
      ${e.notes ? `<br><span style="color:#666">${escapeHtml(e.notes)}</span>` : ''}
      ${photoHtml}
    </div>`;
  }).join('') : '<p class="empty-msg">No history recorded yet.</p>';
  document.getElementById('assetDetailModal').classList.add('open');
}
```

- [ ] **Step 3: Wire row click to open detail drawer**

In `renderItems()`, on each `<tr>` add `onclick="openAssetDetail('${escapeHtml(i.id)}')"` and `style="cursor:pointer"`.

- [ ] **Step 4: Add "In Maintenance" + "Checked Out" stat cards to Dashboard**

In `renderDashboard()`, find where stat cards are built. Add two cards using `_cachedStats`:

```js
{ val: DormDB._cachedStats.invCheckedOut, lbl: 'Checked Out',    color: '#2980b9' },
{ val: DormDB._cachedStats.invMaint,      lbl: 'In Maintenance', color: '#e67e22' },
```

- [ ] **Step 5: Fix `pushToMaintenance` to use async IDB**

Replace the existing `pushToMaintenance` function:

```js
async function pushToMaintenance(id) {
  const assets  = await DormDB.getAllAssets();
  const item    = assets.find(i => i.id === id);
  if (!item) return;
  const maint   = DormDB.getMaintenance();
  maint.push({
    id:          generateId(),
    room:        item.location,
    title:       item.name,
    description: item.maintenanceNotes || '',
    urgency:     'Normal',
    status:      'Open',
    source:      'inventory',
    createdAt:   new Date().toISOString(),
  });
  DormDB.saveMaintenance(maint);
  item.maintenancePushed = true;
  await DormDB.saveAsset(item);
  renderMaintenance();
  showToast('Pushed to Maintenance.');
}
```

- [ ] **Step 6: Remove Room Template section from Settings tab**

In the Settings tab HTML, find and delete the Room Template section (the `<div class="sec-card">` block containing `tplBody` / `addTemplateRow` / `saveTemplate` / `seedFromTemplate`). These are superseded by the Models tab. Remove the matching JS functions: `renderSettings` template section, `addTemplateRow`, `saveTemplate`, and the old `seedFromTemplate` (not to be confused with `seedModelsFromTemplate` added in Task 6).

```bash
grep -n "tplBody\|addTemplateRow\|saveTemplate\|tpl_cat\|tpl_ac\|tpl_qty\|tpl_name\|getTemplate\|saveTemplate" modules/inventory.html | head -20
```

Remove only the template management functions and HTML. Keep `getTemplate()` if it is called from `getMissingItems()` — if so, make `getTemplate()` delegate to `DormDB.getInvModels()`:

```js
async function getTemplate() {
  const models = await DormDB.getInvModels();
  return models.map(m => ({ name: m.name, category: m.category, qty: m.expectedQtyPerRoom, acOnly: m.acRoomOnly }));
}
```

- [ ] **Step 7: Verify in browser**

Open Inventory → Dashboard. Confirm new stat cards. Click an item row — detail drawer opens. Click an item with `maintenanceFlag=true` → push button works and updates the asset in IDB. Open Settings tab — Room Template section is gone.

- [ ] **Step 8: Run wc -l and commit**

```bash
wc -l modules/inventory.html
git add modules/inventory.html
git commit -m "feat(inventory): asset detail drawer, dashboard stats, async pushToMaintenance, remove legacy room template"
```

---

## Task 9: `room-inspection.html` — remove old inventory sync + replace SIDE_ITEMS/SHARED_ITEMS

**Files:**
- Modify: `modules/room-inspection.html`

- [ ] **Step 1: Remove old inventory sync (`_syncInventoryConditions`)**

Find and delete the entire `_syncInventoryConditions` function and its two supporting constants (`INSP_TO_INV`, `COND_MAP`) which currently use `DormDB.getInventory()` keyword-matching. These are fully replaced by `_writeBackAssets` in Task 10.

```bash
grep -n "_syncInventoryConditions\|INSP_TO_INV\|COND_MAP" modules/room-inspection.html
```

Also find and remove the call site of `_syncInventoryConditions(...)` inside `saveInspection()`.

- [ ] **Step 2: Remove `SIDE_ITEMS`, `SHARED_ITEMS`, keep `SEVERITY`, replace `getDefaultCharges`**

Delete the entire `SIDE_ITEMS` and `SHARED_ITEMS` constant blocks (lines ~290–325). **Do not delete `SEVERITY`** — it is still used in charge calculation.

Replace `getDefaultCharges()` with an async version:

```js
async function getDefaultCharges() {
  const saved = DormDB.getInspCfg().defaultCharges;
  if (saved && Object.keys(saved).length) return saved;
  const models = await DormDB.getInvModels();
  const d = {};
  models.forEach(m => { if (m.name) d[m.name] = m.replacementCost || 0; });
  return d;
}
```

Keep `SEVERITY` — it's still needed for charge calculation. Only remove `SIDE_ITEMS` and `SHARED_ITEMS`.

- [ ] **Step 2: Replace `_isAC` local variable with `DormDB.isAcRoom`**

Find:
```js
const _isAC=_selRoom.toUpperCase().endsWith('AC');
```
Replace with:
```js
const _isAC = DormDB.isAcRoom(_selRoom);
```

- [ ] **Step 3: Add `_roomAssets` store and `loadRoomAssets(room)` function**

Add at the top of the script section (near other module-level variables):
```js
let _roomAssets = []; // assets loaded for the current inspection room
```

Add the loader function:
```js
async function loadRoomAssets(room) {
  const norm = DormDB.normalizeRoomId(room);
  _roomAssets = norm ? await DormDB.getAssetsByRoom(norm) : [];
  return _roomAssets;
}
```

- [ ] **Step 4: Rewrite checklist grid builders to use `_roomAssets`**

The current `buildGrid(side, gridId, defaults)` function loops over `SIDE_ITEMS` / `SHARED_ITEMS`. Replace its data source:

```js
async function buildGrid(side, gridId, defaults) {
  const tbody = document.getElementById(gridId)?.querySelector('tbody') ||
                document.getElementById(gridId);
  if (!tbody) return;

  // Filter assets for this side
  let items;
  if (side === 'shared') {
    items = _roomAssets.filter(a => a.side === '' || a.side == null);
  } else {
    items = _roomAssets.filter(a => a.side === side);
  }

  // Fallback: if no assets, show empty-room banner (handled by caller)
  tbody.innerHTML = items.map(asset => {
    const base = defaults[asset.name] || asset.purchasePrice || 0;
    return `<tr data-asset-id="${escapeHtml(asset.id)}">
      <td>${escapeHtml(asset.name)}</td>
      <td><input type="number" class="qty-inp" value="1" min="0"></td>
      <td>
        <select class="cond-sel good" onchange="styleCondSel(this);refreshChargesPreview()">
          <option value="Good">Good</option>
          <option value="Average">Average</option>
          <option value="Poor">Poor</option>
          <option value="Missing">Missing</option>
          <option value="N/A">N/A</option>
        </select>
      </td>
      <td><input type="number" class="charge-inp" value="${base}" min="0" style="width:100%">฿</td>
      <td><input type="text" class="notes-inp" placeholder="Notes…"></td>
      <td><label class="photo-btn" title="Attach photo">
        <input type="file" accept="image/*" capture="environment"
          onchange="onItemPhotoChange(this,'${escapeHtml(asset.id)}')">
        <span class="ph-icon">📷</span>
      </label></td>
    </tr>`;
  }).join('');
}
```

- [ ] **Step 5: Update the form open flow to load assets first**

The room dropdown calls `populateOccupants()` (`onchange="populateOccupants()"`). At the end of `populateOccupants()`, add the asset load:

```js
// At the end of populateOccupants(), after existing occupant logic:
const room = document.getElementById('insp_room').value;
await loadRoomAssets(room);

const hasAssets = _roomAssets.length > 0;
document.getElementById('noAssetsWarning').style.display = hasAssets ? 'none' : 'block';
document.getElementById('inspChecklistSection').style.display = hasAssets ? 'block' : 'none';

if (hasAssets) {
  const defaults = await getDefaultCharges();
  await buildGrid('A',      'gridSideA', defaults);
  await buildGrid('B',      'gridSideB', defaults);
  await buildGrid('shared', 'gridShared', defaults);
}
```

Make `populateOccupants` async.
```

Add the warning banner HTML near the checklist section:
```html
<div id="noAssetsWarning" style="display:none;background:#fff3cd;border:1px solid #ffc107;
     border-radius:8px;padding:14px 16px;margin:12px 0;font-size:.83rem">
  ⚠️ No assets recorded for this room.
  <a href="inventory.html" style="color:#1e3a5f;font-weight:700">Go to Inventory</a>
  to add items first, or
  <button class="btn btn-sm btn-orange" onclick="useDefaultTemplate()">Use Default Template</button>
</div>
<div id="inspChecklistSection"><!-- existing checklist content --></div>
```

- [ ] **Step 6: Add `useDefaultTemplate()` fallback function**

```js
async function useDefaultTemplate() {
  const room = document.getElementById('insp_room').value;
  if (!room) return;
  const models = await DormDB.getInvModels();
  if (!models.length) { alert('No asset models found. Add models in Inventory → Models tab first.'); return; }
  const norm = DormDB.normalizeRoomId(room);
  const isAC = DormDB.isAcRoom(room);
  // Create temporary in-memory assets (not saved to IDB — inspection only)
  _roomAssets = models
    .filter(m => !m.acRoomOnly || isAC)
    .flatMap(m => {
      const qty = m.scope === 'per-side' ? m.expectedQtyPerRoom : 1;
      return Array.from({ length: qty }, (_, i) => ({
        id: `tmp-${generateId()}`,
        modelId: m.id,
        name: m.name,
        category: m.category,
        location: norm,
        side: m.scope === 'per-side' ? (i === 0 ? 'A' : 'B') : '',
        statusLabel: 'available',
        checkedOutTo: '',
        condition: 'Good',
        checkoutLog: [],
        purchasePrice: m.replacementCost || 0,
      }));
    });
  document.getElementById('noAssetsWarning').style.display = 'none';
  document.getElementById('inspChecklistSection').style.display = 'block';
  const defaults = await getDefaultCharges();
  await buildGrid('A', 'gridSideA', defaults);
  await buildGrid('B', 'gridSideB', defaults);
  await buildGrid('shared', 'gridShared', defaults);
}
```

- [ ] **Step 7: Verify in browser**

Open Room Inspection. Select a room that has no inventory assets — confirm the warning banner appears with the fallback button. Click "Use Default Template" — confirm grids populate. Select a room that does have assets — confirm grids show the actual assets.

- [ ] **Step 8: Run wc -l and commit**

```bash
wc -l modules/room-inspection.html
git add modules/room-inspection.html
git commit -m "feat(inspection): live asset checklist from IDB, fallback template, DormDB.isAcRoom"
```

---

## Task 10: `room-inspection.html` — move-in/out asset write-back + photoId

**Files:**
- Modify: `modules/room-inspection.html`

- [ ] **Step 1: Add `_writeBackAssets(rec, type)` helper**

Add this function before `saveInspection()`:

```js
async function _writeBackAssets(rec, type) {
  const errors = [];
  for (const asset of _roomAssets) {
    if (asset.id.startsWith('tmp-')) continue; // skip default-template placeholders
    try {
      const fresh = (await DormDB.getAllAssets()).find(a => a.id === asset.id);
      if (!fresh) continue;

      if (type === 'move-in') {
        // Find the condition recorded in the grid for this asset
        const row = document.querySelector(`tr[data-asset-id="${CSS.escape(asset.id)}"]`);
        const condAfter = row?.querySelector('.cond-sel')?.value || 'Good';

        fresh.statusLabel  = 'checked-out';
        fresh.checkedOutTo = DormDB.normalizeRoomId(rec.room);
        fresh.checkoutLog  = [...(fresh.checkoutLog || []), {
          event: 'checkout', room: DormDB.normalizeRoomId(rec.room),
          side: fresh.side, date: rec.date, by: rec.recordedBy,
          conditionBefore: fresh.condition, conditionAfter: condAfter,
          inspectionId: rec.id, photoId: '', notes: '',
        }];
        fresh.condition = condAfter;
        await DormDB.saveAsset(fresh);

      } else { // move-out
        const row = document.querySelector(`tr[data-asset-id="${CSS.escape(asset.id)}"]`);
        const condAfter = row?.querySelector('.cond-sel')?.value || fresh.condition;
        const lastCheckout = [...(fresh.checkoutLog || [])].reverse().find(e => e.event === 'checkout');
        const condBefore = lastCheckout?.conditionAfter ?? fresh.condition;

        // Photo link: look up rec.photos for this asset's slot key
        const photoId = rec.photos?.[asset.id] || '';

        fresh.checkoutLog = [...(fresh.checkoutLog || []), {
          event: 'checkin', room: DormDB.normalizeRoomId(rec.room),
          side: fresh.side, date: rec.date, by: rec.recordedBy,
          conditionBefore: condBefore, conditionAfter: condAfter,
          inspectionId: rec.id, photoId, notes: '',
        }];

        const sevKey = `${condBefore.toLowerCase()}→${condAfter.toLowerCase()}`;
        if (SEVERITY[sevKey]) {
          fresh.condition   = condAfter;
          fresh.statusLabel = condAfter === 'Missing' ? 'in-maintenance' : 'available';
          fresh.checkoutLog = [...fresh.checkoutLog, {
            event: 'condition-change', room: DormDB.normalizeRoomId(rec.room),
            side: fresh.side, date: rec.date, by: rec.recordedBy,
            conditionBefore: condBefore, conditionAfter: condAfter,
            inspectionId: rec.id, photoId, notes: '',
          }];
        } else {
          fresh.statusLabel = 'available';
        }
        fresh.checkedOutTo = '';
        await DormDB.saveAsset(fresh);
      }
    } catch(e) {
      errors.push(asset.name);
      console.warn('Asset write-back failed:', asset.id, e);
    }
  }
  if (errors.length) {
    showToast(`Inspection saved. Could not update: ${errors.join(', ')}. Check Inventory.`);
  }
}
```

- [ ] **Step 2: Call `_writeBackAssets` from `saveInspection()`**

Find `saveInspection()`. After the line that calls `DormDB.saveInspections(inspections)`, add:

```js
// Write condition events back to asset records (best-effort)
await _writeBackAssets(rec, rec.type);
```

Make `saveInspection` async if it isn't already.

- [ ] **Step 3: Verify move-in write-back in browser**

1. Open Inventory — add a test asset to a room (e.g. Room 301, Side A, "Test Chair").
2. Open Room Inspection → new move-in for Room 301.
3. Confirm Test Chair appears in the Side A grid.
4. Set condition to "Good". Save inspection.
5. Open Inventory → Items. Confirm Test Chair now shows status "Checked Out".
6. Click the row → detail drawer → History shows one `checkout` event.

- [ ] **Step 4: Verify move-out write-back in browser**

1. Open Room Inspection → new move-out for Room 301.
2. Set Test Chair condition to "Poor". Save.
3. Open Inventory → Test Chair detail drawer → History shows `checkin` + `condition-change` events. Condition field shows "Poor".

- [ ] **Step 5: Run wc -l and commit**

```bash
wc -l modules/room-inspection.html
git add modules/room-inspection.html
git commit -m "feat(inspection): move-in/out asset write-back with checkoutLog + photoId on condition-change"
```

---

## Task 11: `room-inspection.html` — barcode scan to highlight asset row

**Files:**
- Modify: `modules/room-inspection.html`

- [ ] **Step 1: Add scan button to inspection form toolbar**

Find the inspection form toolbar (near the Save button). Add:
```html
<button type="button" class="btn btn-orange" onclick="openInspScanModal()">📷 Scan Asset</button>
```

- [ ] **Step 2: Add scanner modal HTML**

Add before closing `</body>`:
```html
<div class="modal" id="inspScanModal">
  <div class="modal-content" style="max-width:420px">
    <span class="close-btn" onclick="closeInspScanModal()">&times;</span>
    <h2 style="font-size:.95rem;color:#1e3a5f;margin-bottom:12px">Scan Asset Tag</h2>
    <div class="scan-video-wrap" id="inspScanWrap">
      <video id="inspScanVideo" playsinline muted autoplay style="display:none"></video>
      <div class="scan-aim"></div>
      <div id="inspScanStatus" class="scan-no-cam">Initialising camera…</div>
    </div>
    <div style="margin:10px 0;font-size:.78rem;text-align:center;color:#888">— or enter manually —</div>
    <div style="display:flex;gap:8px">
      <input type="text" id="inspScanInput" placeholder="Asset tag or serial…"
             style="flex:1;padding:8px;border:1.5px solid #cdd;border-radius:6px;font-family:monospace;font-size:.9rem"
             onkeydown="if(event.key==='Enter')handleInspScan(this.value.trim())">
      <button class="btn btn-blue" onclick="handleInspScan(document.getElementById('inspScanInput').value.trim())">Find</button>
    </div>
    <div id="inspScanResult" style="margin-top:10px;font-size:.82rem;color:#555"></div>
  </div>
</div>
```

- [ ] **Step 3: Add scanner JS (inline copy adapted from inventory.html scanner)**

```js
// ── Inspection barcode scanner ────────────────────────────────────────────────
let _inspScanStream = null, _inspScanLoop = null, _inspScanDetector = null;

function openInspScanModal() {
  document.getElementById('inspScanModal').classList.add('open');
  document.getElementById('inspScanResult').textContent = '';
  document.getElementById('inspScanInput').value = '';
  _startInspCamera();
}
function closeInspScanModal() {
  document.getElementById('inspScanModal').classList.remove('open');
  _stopInspCamera();
}

async function _startInspCamera() {
  const status = document.getElementById('inspScanStatus');
  if (!('BarcodeDetector' in window)) {
    status.textContent = '⚠️ Camera scan not supported. Enter tag manually.';
    document.getElementById('inspScanVideo').style.display = 'none';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = '⚠️ Camera unavailable. Enter tag manually.';
    return;
  }
  try {
    _inspScanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('inspScanVideo');
    video.srcObject = _inspScanStream;
    video.style.display = '';
    await video.play();
    status.textContent = '';
    _inspScanDetector = new BarcodeDetector({ formats: ['code_39', 'code_128', 'qr_code'] });
    _runInspScanLoop();
  } catch(err) {
    status.textContent = `⚠️ Camera error: ${err.message}`;
  }
}
function _stopInspCamera() {
  cancelAnimationFrame(_inspScanLoop);
  _inspScanLoop = null;
  if (_inspScanStream) { _inspScanStream.getTracks().forEach(t => t.stop()); _inspScanStream = null; }
}
function _runInspScanLoop() {
  const video = document.getElementById('inspScanVideo');
  async function tick() {
    if (!_inspScanStream) return;
    try {
      const codes = await _inspScanDetector.detect(video);
      if (codes.length) {
        const val = codes[0].rawValue.trim();
        handleInspScan(val);
        await new Promise(r => setTimeout(r, 2500));
      }
    } catch(_) {}
    _inspScanLoop = requestAnimationFrame(tick);
  }
  _inspScanLoop = requestAnimationFrame(tick);
}

function handleInspScan(raw) {
  if (!raw) return;
  // Match against _roomAssets by assetTag or serialNo
  const tag  = raw.toUpperCase();
  const match = _roomAssets.find(a =>
    (a.assetTag  && a.assetTag.toUpperCase()  === tag) ||
    (a.serialNo  && a.serialNo.toUpperCase()  === tag) ||
    (a.id.toUpperCase() === tag)
  );
  const resultEl = document.getElementById('inspScanResult');
  if (!match) {
    resultEl.innerHTML = `<span style="color:#c0392b">❌ Tag not found in this room's assets: "${escapeHtml(raw)}"</span>`;
    return;
  }
  // Highlight the matching row in the checklist
  document.querySelectorAll('tr[data-asset-id]').forEach(r => r.style.background = '');
  const row = document.querySelector(`tr[data-asset-id="${CSS.escape(match.id)}"]`);
  if (row) {
    row.style.background = '#fffde7';
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  resultEl.innerHTML = `<span style="color:#2c7a4d">✅ Found: <strong>${escapeHtml(match.name)}</strong>${match.side ? ` — Side ${match.side}` : ''}</span>`;
  setTimeout(closeInspScanModal, 1200);
}
```

- [ ] **Step 4: Verify in browser**

Open Room Inspection with a room that has assets. Click "Scan Asset". Enter the asset's tag or ID manually → the matching row highlights in yellow and scrolls into view. Modal closes after 1.2 s.

- [ ] **Step 5: Run wc -l and commit**

```bash
wc -l modules/room-inspection.html
git add modules/room-inspection.html
git commit -m "feat(inspection): barcode scan highlights matching asset row in checklist"
```

---

## Task 12: `sw.js` + `CLAUDE.md` — cache bump and stats update

**Files:**
- Modify: `sw.js`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Bump service worker cache version**

In `sw.js`, find the current cache name (e.g. `dormportal-v13`). Replace with `dormportal-v14`.

- [ ] **Step 2: Run `wc -l` on all changed files**

```bash
wc -l dorm-db.js modules/inventory.html modules/room-inspection.html \
       modules/floor-plan.html modules/utilities.html index.html
```

Record the new counts.

- [ ] **Step 3: Update CLAUDE.md file stats table**

In `CLAUDE.md`, update the `## File stats` table with the new line counts from Step 2. Update `## Pending items` to mark this feature complete. Add a new `## Completed` entry for today's session.

- [ ] **Step 4: Update cross-module dependency map in CLAUDE.md**

Add rows to the dependency map table:
```
| `dormInventoryModels` (IDB) | inventory | inventory, room-inspection |
| `dormInventoryAssets` (IDB) | inventory, room-inspection | inventory, room-inspection, index.html (stats) |
```

- [ ] **Step 5: Final BF-016 check**

```bash
grep -n "localStorage\.\(setItem\|getItem\)" \
  dorm-db.js modules/inventory.html modules/room-inspection.html \
  modules/floor-plan.html modules/utilities.html index.html | grep "dorm"
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add sw.js CLAUDE.md
git commit -m "chore: bump SW cache v14, update CLAUDE.md stats + dep map"
```

---

## Verification Checklist (run after all tasks complete)

- [ ] DevTools → Application → IndexedDB → `DormManagerDB` v4: stores `dormInventoryModels`, `dormInventoryAssets`, `dormkv`, `dormkv_archive`, `photos` all present
- [ ] Inventory Models tab: CRUD works, seed-from-template works
- [ ] Inventory Items tab: add item with model picker → asset stored in IDB, status badge shows
- [ ] Inventory Dashboard: "In Maintenance" and "Checked Out" stat cards visible
- [ ] Click inventory item row → detail drawer opens with empty history log
- [ ] Room Inspection: select room with assets → checklist shows real assets (not hardcoded SIDE_ITEMS)
- [ ] Room Inspection: select room without assets → warning banner + "Use Default Template" button works
- [ ] Move-in inspection save → asset in IDB shows `statusLabel: 'checked-out'` and one `checkout` event in `checkoutLog`
- [ ] Move-out inspection save with condition change → asset condition updated, `checkin` + `condition-change` events in log
- [ ] Scan button in inspection → camera opens (or manual input) → scanned tag highlights matching row
- [ ] Export All → JSON includes `dormInventoryModels` and `dormInventoryAssets` arrays
- [ ] Import All → assets and models restored to IDB
- [ ] Floor Plan: AC badge still shows correctly for AC rooms
- [ ] Utilities: AC column still shows correctly
- [ ] index.html stats refresh when an asset is saved in another tab
- [ ] No BF-016 violations
