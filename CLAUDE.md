# CLAUDE.md — DormPortalUniversal v4
> Read this file at the start of every session. It is the single source of truth for project context, architecture decisions, data model, and editing rules.

---

## What this project is

**DormPortalUniversal v4** is a multi-module dormitory administration system for Asia-Pacific International University (APIU). It runs entirely in the browser — no server, no login, no internet required. Used exclusively by Dorm Deans and RAs on their own laptops.

The system is organized as a main menu (`index.html`) linking to separate HTML module files. All modules share data through `dorm-db.js`, a central data API backed by `localStorage`.

**Current modules (ready):**
- **Room Reservations** (`modules/room-reservations.html`) — beds, check-in/out, clearance, room holds, queue, history, away students
- **Student Profiles** (`modules/student-profiles.html`) — student directory, printable A4 profile cards, MS Forms CSV import, registrar Excel import
- **Floor Plan** (`modules/floor-plan.html`) — visual room grid, occupancy status, hot water bathroom pairing config
- **Electricity & Hot Water** (`modules/utilities.html`) — meter readings, per-student bill calculation, billing period archive
- **Reports** (`modules/reports.html`) — 8-tab report hub: archive, room, custom, pivot, holds, storage, clearance, fee collection
- **Room Inspection** (`modules/room-inspection.html`) — move-in/move-out checklists, per-side charge calculation, clearance pre-fill, printable A4 sheet + A5 cost card
- **Key Inventory** (`modules/key-inventory.html`) — key checkout/return/lost tracking, overdue alerts, fine recording, master inventory, shift print sheet
- **Inventory** (`modules/inventory.html`) — asset tracking with Code 39 barcode labels, room template comparison, condition assessment, maintenance flag push
- **Dean's User Guide** (`modules/userguide.html`) — interactive HTML guide covering all 8 ready modules; sticky sidebar TOC, collapsible sections, live search, print-friendly

**Coming soon:** Staff Scheduling, Maintenance

---

## Architecture — critical rules

| Rule | Detail |
|------|--------|
| **Multi-module layout** | `index.html` (menu) + `dorm-db.js` (data API) at root; module HTML files in `modules/` subfolder. |
| **No build process** | No npm, no webpack, no transpilation. Vanilla JS (ES6+) only. |
| **No external CDN** | SheetJS must be bundled inline. No other external dependencies. *(Pending: still CDN in room-reservations.html and utilities.html — see Pending Items.)* |
| **No backend** | All persistence is via `localStorage` + `IndexedDB` (auto-save) and `.xlsx` / `.json` export/import (manual save). |
| **Storage split** | Text/JSON data → `localStorage` via `DormDB`. Photos (profile pics) → IndexedDB via `DormDB.getPhoto/savePhoto/deletePhoto` (async). Never store base64 photos in `dormProfiles`. |
| **Data access** | All modules read/write through `DormDB` (from `dorm-db.js`). No direct `localStorage` calls for data keys. |
| **Editing method** | Use targeted `str_replace` on unique strings. Never rewrite the whole file. Grep for the target string first to confirm it is unique before editing. After each change, run `wc -l <file>`. |
| **SheetJS version** | Locked at `0.20.2`. Do not upgrade without explicit instruction. |
| **Storage backend** | `localStorage` (text) + `IndexedDB` (photos). IDB accessed via `DormDB.getPhoto/savePhoto/deletePhoto`. `exportAll`/`importAll` are async and include photos in the JSON backup. |
| **Back-nav pattern** | Floor Plan and Reports accept `?back=room-reservations`. Their nav link reads the param and shows "← Room Reservations" or falls back to "← Menu". |
| **DormDB.on() subscriptions** | Every module that reads data owned by another module must subscribe: `DormDB.on(DormDB.KEYS.X, handler)`. This keeps UI live when the user has two tabs open. |
| **reports.html — print-only** | Never add SheetJS or Excel export to `reports.html`. All output is CSS `@media print`. Intentionally lightweight. |
| **emptyStudent() is canonical** | Always use `emptyStudent(room)` to create bed slots. Never push a raw `{}` or partial object into `fullData`. Missing fields silently break `recalcWaiting()` and `getStatusText()`. |
| **ensureStudent() on import** | Pass every externally-sourced row through `ensureStudent(s)` before storing. It merges defaults from `emptyStudent()`. |
| **Update CLAUDE.md stats** | After any session that adds/removes significant lines, update the File Stats table using `wc -l`. |

---

## File stats (as of 2026-05-31, session 19)

| File | Lines | Size | Notes |
|------|-------|------|-------|
| `index.html` | 321 | ~15 KB | Main menu, 11 module cards (9 ready), live stats, dorm selector |
| `dorm-db.js` | 291 | ~12 KB | Central data API + IndexedDB photo subsystem |
| `modules/room-reservations.html` | 1,804 | ~130 KB | Active room reservations module |
| `modules/student-profiles.html` | 1,124 | ~52 KB | Student profiles, print cards, CSV/Excel import |
| `modules/floor-plan.html` | 494 | ~24 KB | Visual room grid + bathroom pairing config |
| `modules/utilities.html` | 644 | ~34 KB | Electricity & hot water billing |
| `modules/reports.html` | 1,050 | ~82 KB | 8-tab report hub (archive, room, custom, pivot, holds, storage, clearance, fee collection) |
| `modules/room-inspection.html` | 1,024 | ~55 KB | Move-in/out checklists, charge calc, cost sheet |
| `modules/key-inventory.html` | 1,178 | ~54 KB | Key checkout/return/lost, overdue alerts, fine recording, shift print, ledger, agreement |
| `modules/inventory.html` | 1,078 | ~55 KB | Asset inventory — Code 39 barcodes, room template, maintenance flags |
| `modules/userguide.html` | 1,331 | ~62 KB | Dean's User Guide — all 8 modules, sidebar TOC, collapsible, search |

---

## Root-level files — what NOT to edit

| File | Status | Rule |
|------|--------|------|
| `Dorm Manager.code-workspace` | VS Code workspace config | Do not edit. Auto-managed by VS Code. Git-ignored. |
| `userguide.md` | User documentation | Edit only when asked to update docs. |
| `*.xlsx` (data exports) | User data files | Never edit programmatically. Git-ignored. |
| `*.json` (data backups) | User data files | Never edit programmatically. Git-ignored. |
| `clearance_a5_preview.html` | Design preview | Edit only when asked to work on clearance form layout. Git-ignored. |
| `.gitignore` | Git config | Excludes `*.json`, `*.xlsx`, `*.pdf`, `clearance_a5_preview.html`. |

Active code files: `index.html`, `dorm-db.js`, `modules/*.html`.

---

## New module checklist (for Staff Scheduling, Maintenance)

When building any of the five remaining modules, follow this order exactly:

1. **`dorm-db.js`** — Confirm the relevant `K` constant exists (e.g., `K.KEYS_INV`). Add getter/setter pair if missing. If the module needs a new stat in `getMenuStats()`, add it there.
2. **Create `modules/<name>.html`** with this structure:
   - `<script src="../dorm-db.js">` as the **first** `<script>` tag — no CDN scripts
   - Nav bar: back-link reads `?back` URL param; fallback `href="../index.html"`
   - Nav bar shows dorm name via `DormDB.getDormName()` and user via `DormDB.getCurrentUser()`
   - Subscribe to relevant keys: `DormDB.on(DormDB.KEYS.X, handler)`
   - `init()` function called at page bottom
3. **`index.html`** — Set `ready: true` for the module card. Add stat pills using the new `getMenuStats()` fields.
4. **CLAUDE.md** — Add the new module to the "Current modules" list, file stats table, and function list.

Print pages: use `@page { size: A4; margin: 12mm; }`. Floor plan uses landscape; profile cards portrait; clearance A5.

---

## localStorage budget — known risks

| Key | Typical size | Risk |
|-----|-------------|------|
| `dormData` | ~10–40 KB | Low — ~50 bytes/student |
| `dormHistory` | Grows unbounded | Medium — warn users if >500 archived records |
| `dormProfiles` | Varies | **High** — base64 profile photos are 50–200 KB each; 30 students with photos ≈ 3–6 MB |
| Total browser limit | ~5–10 MB | `autoSave()` already warns at >3,500 KB |

**Photo storage rule:** Profile photos stored as base64 inside `dormProfiles`. Advise users to crop/resize photos to thumbnail size before uploading. `DormDB.exportAll()` includes photos in the JSON backup.

---

## Data model

### Per-student object (`emptyStudent(room)`)

```javascript
{
  // Identity
  room: '',                    // Room number string e.g. '312', '311AC'
  name: '',                    // Full name
  studentType: 'regular',      // 'regular' | 'new' | 'visitor' | 'guest'

  // Reservation
  requestedRoom: '',           // Target room if requesting a move
  requestStatus: 'Confirmed',  // 'Confirmed' | 'Waiting'
  manualStatus: false,         // true = staff overrode auto-calculation

  // Period flags
  summer: false,               // Staying over summer break
  firstSem: false,             // Staying over 1st semester break
  graduating: false,           // true when moveOutReason !== ''

  // Move-out
  moveOutReason: '',           // '' | 'Graduating' | 'Off Campus' | 'Internship'
  offCampusType: '',           // 'Going Home' | 'Leaving Dorm' (when Off Campus)

  // Room hold (paid absence)
  roomHold: {
    active: false,             // true = room locked during student's absence
    paymentMethod: 'Not Paid', // 'Not Paid' | 'Cash' | 'QR'
    amountPaid: 0
  },

  // Dates
  returnDate: '',              // ISO date string (summer/1st sem return)

  // Keys
  keysReturned: false,

  // Solo occupancy
  solo: false,                 // true = paying for double-rate, no roommate

  // Storage
  storageRental: false,
  storageQty: 1,               // 1-3
  box1Color: '', box1No: '',
  box2Color: '', box2No: '',
  box3Color: '', box3No: '',
  paymentMethod: 'Not Paid',   // 'Not Paid' | 'Cash' | 'QR'
  totalAmount: 0,

  // Transfer in
  transferIn: {
    fromDorm: '',
    fromRoom: '',
    transferDate: '',
    notes: ''
  },

  // Clearance (graduating + leaving dorm students)
  clearance: {
    formCompleted: false,
    leaveDate: '',
    elecIn: 0, elecOut: 0,
    hotIn: 0, hotOut: 0,
    studentId: '',
    mobile: '',
    email: '',
    toDorm: '',
    toRoom: '',
    formNo: '',
    remarks: '',
    fees: {
      movingFee: false,    movingFeeAmt: 0,
      cleaningFee: false,  cleaningFeeAmt: 0,
      keyFee: false,       keyFeeAmt: 0,
      drawerFee: false,    drawerFeeAmt: 0,
      chairFee: false,     chairFeeAmt: 0,
      stoolFee: false,     stoolFeeAmt: 0,
      otherFee: false,     otherFeeAmt: 0,
      otherFeeDesc: ''
    }
  }
}
```

### Global state arrays (room-reservations.html)

```javascript
let fullData      = [];   // All student bed slots (2 per room by default)
let incomingQueue = [];   // Pre-reservation entries (queue panel)
let roomHistory   = [];   // Archived student records (vacated/graduated)
let awayStudents  = [];   // Temporarily away students (bed released, data preserved)
let filteredData  = [];   // Subset of fullData after floor filter
```

### Room history entry (pushed by `vacateAndArchive()`)

```javascript
{
  room, name, studentType,
  moveOutReason, offCampusType,
  leaveDate, archivedAt,          // ISO timestamp
  studentId, email, mobile,
  elecIn, elecOut, hotIn, hotOut,
  formNo, formCompleted,
  transferFrom, toDorm,
  totalFees, notes
}
```

### Incoming queue entry

```javascript
{
  id,                   // Date.now() — unique key
  name,
  studentType,          // 'regular' | 'new' | 'visitor' | 'guest'
  targetRoom,
  fromDorm, fromRoom,
  expectedMoveIn,       // ISO date string
  notes,
  addedAt               // ISO timestamp
}
```

---

## Key business logic

### Room availability states

| State | Condition | Badge colour |
|-------|-----------|--------------|
| `available` | Has at least one empty slot AND no active solo/hold lock | 🟢 Green |
| `soon` | All slots named but ≥1 student has a `leaveDate` set | 🟡 Yellow |
| `held` | Student with `roomHold.active = true` (paid absence) | 🟠 Amber |
| `full` | All slots named, nobody leaving | 🔴 Red |
| `locked` | Active solo resident with no `moveOutReason` | 🔴 Red |

### Waiting list logic (`recalcWaiting()`)

1. Build `activeSoloRooms` — rooms with a solo student who has no `moveOutReason`
2. Build `releasingSoloRooms` — rooms with a solo student who IS leaving
3. Build `heldRooms` — rooms with an active room hold
4. For each student with a `requestedRoom`: check all three sets. Block if locked/held. Otherwise assign Confirmed/Waiting by position.
5. `graduating = true` when `moveOutReason !== ''`

### Clearance button visibility

```
s.graduating && s.moveOutReason → shows clearance/archive button
```
All leaving students (Graduating, Off Campus Going Home, Off Campus Leaving Dorm, Internship) get the button. The modal title and fee section adapt based on move-out type.

### Room hold rules

- Only enabled when `summer === true` OR `firstSem === true`
- Blocks new reservations for that room (treated like active solo)
- Amber occupancy badge
- Shows "🏠 Room Held (away)" in Status column
- Payment tracked separately via hold payment modal

### `isHoldActive(s)` — correct formula

```js
s.roomHold.active && (s.summer || s.firstSem)
  && s.moveOutReason !== 'Graduating'
  && !(s.moveOutReason === 'Off Campus' && s.offCampusType === 'Leaving Dorm')
```

---

## Modals — room-reservations.html (8 operational + 2 system)

| ID | Purpose |
|----|---------|
| `generatorModal` | Create new dorm room layout |
| `storageModal` | Storage box management |
| `clearanceModal` | Full clearance form + fee assessment |
| `transferModal` | Record transfer-in from another dorm |
| `addIncomingModal` | Add or edit incoming queue entries |
| `historyModal` | Per-room history viewer |
| `restoreRoomModal` | Restore an away student to a room |
| `holdModal` | Room hold payment recording |
| `confirmModal` *(system)* | Styled replacement for `confirm()` |
| `promptModal` *(system)* | Styled replacement for `prompt()` |

`reportModal` and `allHistoryModal` removed — global reports live in `modules/reports.html`.

---

## All functions — room-reservations.html (106 total)

### Utilities
`escapeHtml` `getFloor` `matchesFloor` `debounce` `isHoldActive`

### Dorm setup
`buildMasterList` `addStu` `generateNewDorm` `parseRoomList` `toggleRoomListInput` `openGeneratorModal`

### Data model
`clearanceDef` `emptyStudent` `ensureStudent` `normaliseToRows`

### State management
`pushState` `undo` `redo`

### Persistence
`autoSave` `loadFromLS` `saveRoomHistory` `saveQueue` `saveAwayStudents` `markUnsaved` `markSaved` `recordUpdate`

### Away students
`markStudentAway` `openRestoreModal` `confirmRestoreToRoom` `removeAwayEntry` `renderAwayPanel` `toggleAwayPanel` `updateAwayBadge`

### Role / floor / search
`handleRoleChange` `updateRoleUI` `applyFloorFilter` `toggleSearch` `closeSearch` `doSearch`

### Room logic
`recalcWaiting` `roomHasVacancy` `getRoomsWithAvailability` `getOccupancyBadge` `getDuplicateWarning` `getStatusText`

### Rendering
`applyFilter` `addInteractivity` `restoreFocus` `renderTable` `updateStats` `setMaxOccupants` `updateDormName`

### Column visibility
`applyColVis` `toggleColPicker` `toggleCol` `initColPicker`
> `toggleColPicker()` uses `position:fixed` panel. Top = `br.bottom + 4` — do NOT add `window.scrollY`.
> Columns are hidden by storing 1-based CSS nth-child indices in `dormCols`. Current table has 17 columns (n values 1–17). When adding a new column: add it to `_COL_DEFS` and `initColPicker()` labels list and increment the total count here.

### Dialogs
`askConfirm` `askPrompt` `_doConfirmYes` `_doConfirmNo` `_doPromptOk` `openModal` `closeModal` `showToast`

### Storage modal
`openStorageModal` `onStorageRentalChange` `updateStorageBoxFields` `updateStorageTotalDisplay` `saveStorage`

### Clearance modal
`openClearanceModal` `readClearanceFields` `saveClearance` `vacateAndArchive` `clFeeToggle` `clRecalc`

### Finance form
`printFinanceForm`

### CRUD
`quickRemoveStudent` `moveStudentToRoom`

### Transfer modal
`openTransferModal` `onTrfDormSelect` `saveTransfer` `clearTransfer`

### Incoming queue
`toggleQueuePanel` `updateQueueBadge` `openAddIncomingModal` `openEditIncomingModal` `onIqDormSelect` `populateRoomDropdown` `onIqRoomSelect` `updateRoomHint` `getIqTargetRoom` `saveIncomingEntry` `confirmIncomingToRoom` `removeIncomingEntry` `renderQueue`

### Room hold
`openHoldModal` `saveHold`

### Per-room history
`openHistoryModal` `storageSubRow` `resolveStorage`
> Global archive (renderAllHistory, printAllHistory, openAllHistoryModal) moved to reports.html.

### Save / load / reset
`saveToExcel` `loadFromInput` `exportEmptyTemplate` `resetToEmbedded` `resetAllEdits`

### Init
`init` `_runInit`

---

## reports.html — functions (33 total)

**Utilities:** `escapeHtml` `getFloor` `matchesFloor` `isHoldActive`

**Tab control:** `switchTab(name)` — matches `data-tab` attr on buttons + `id="tab-{name}"` on panels

**Archive tab:** `renderArchive` `storageSubRow` `resolveStorage` `printArchive`

**Room report:** `renderRoomReport` `printRoomReport`

**Custom report:** `generateCustomReport` `buildPivotRows` (closure `cv` inside generateCustomReport)

**Pivot:** `renderPivot` `printPivotReport`

**Holds:** `renderHolds` `printHoldReport`

**Storage:** `renderStorage` `printStorageReport`

**Clearance tab:** `renderClearance` `printClearanceOverview` `populateClearanceRooms` `populateClearanceOccupants` `onClOccChange` `resetClearanceForm` `loadClearanceData` `_getInspChargesRpt` `clRptFeeToggle` `clRptRecalc` `_clCardHtml` `_clA4Sheet` `_clReadFormData` `printClearanceForm`

> All data read via `DormDB`. `resolveStorage` writes via `DormDB.saveHistory()`. No SheetJS — print/PDF only.
> `printClearanceForm()` ports `printFinanceForm()` from room-reservations; `_getInspChargesRpt()` ports `_getInspectionCharges()`. Both read-only — no writes back to dormData.

---

## Table columns — room-reservations.html (17)

| # | Header | Data field | Notes |
|---|--------|------------|-------|
| 1 | Room & Occup. | `room` | Shows badge, incoming count, history count |
| 2 | ❄️ AC | computed | Air-conditioned room flag |
| 3 | Name | `name` | Includes Transfer In + Profile badges |
| 4 | 🪪 ID | `studentId` | Hidden by default; cross-module identity key |
| 5 | Req. Room | `requestedRoom` | Debounced input |
| 6 | Reservation | `requestStatus` | Confirmed / Waiting |
| 7 | ☀️ | `summer` | Checkbox |
| 8 | 📖 | `firstSem` | Checkbox |
| 9 | 🚪 Move Out | `moveOutReason` | Select + Off Campus sub-select |
| 10 | Leave Date | `clearance.leaveDate` | Date input |
| 11 | Return Date | `returnDate` | Date input |
| 12 | 📊 Status | computed | `getStatusText()` — roommates or departure status |
| 13 | 🔑 | `keysReturned` | Checkbox |
| 14 | 📦 Storage | `storageRental` | Summary + Manage button |
| 15 | 🧍 Solo | `solo` | Checkbox |
| 16 | 🏠 Hold | `roomHold.active` | Checkbox + 💳 payment button |
| 17 | 📋 Clearance | — | Button for all `graduating && moveOutReason` students |

---

## Excel save format

Sheet 1 `DormData` — one row per bed slot, columns:
`Room, Name, Requested Room, Status, Summer, 1st Semester, Move Out, Move Out Reason, Off Campus Type, Student Type, Leave Date, Return Date, Keys Returned, Solo, Storage Rental, Storage Qty, Payment Method, Total Amount, Transfer From Dorm, Transfer From Room, Transfer Date, Student ID, Mobile, Email, To Dorm, To Room, Elec IN, Elec OUT, Hot IN, Hot OUT, Form No, Clearance Done, Moving Fee, Cleaning Fee, Key Fee, Drawer Fee, Chair Fee, Stool Fee, Other Fee Desc, Other Fee Amt, Room Hold Active, Room Hold Payment, Room Hold Amount`

Sheet 2 `IncomingQueue` — optional, loaded if present

Sheet 3 `RoomHistory` — optional, loaded if present

---

## localStorage keys

All keys managed through `DormDB` constants in `dorm-db.js`.

| Key | Owner | Content |
|-----|-------|---------|
| `dormData` | room-reservations | JSON of `fullData` array |
| `dormQueue` | room-reservations | JSON of `incomingQueue` array |
| `dormHistory` | room-reservations | JSON of `roomHistory` array |
| `dormAway` | room-reservations | JSON of `awayStudents` array |
| `dormUserName` | shared | Current user's name |
| `dormLastUpdate` | shared | Last save timestamp |
| `dormLastUser` | shared | Last user to save |
| `dormNameSelect` | shared | Selected dorm name |
| `dormNameCustom` | shared | Custom dorm name (when "Other") |
| `dormMaxOccupants` | shared | Max beds per room |
| `dormRole` | shared | Dean / RA role (RA UI removed — key retained for future user access control) |
| `dormFloor` | shared | Last active floor filter |
| `dormCols` | room-reservations | Hidden column indices |
| `dormProfiles` | student-profiles | JSON of profile records |
| `dormFloorPlan` | floor-plan | Bathroom pairing config |
| `dormUtilities` | utilities | Billing period records |
| `dormPwdHash` | auth | PBKDF2 hash (unused — password gate removed) |
| `dormKeysInv` | key-inventory | Reserved |
| `dormInspections` | room-inspection | Reserved |
| `dormInventory` | inventory | Reserved |
| `dormSchedule` | staff-scheduling | Reserved |
| `dormMaintenance` | maintenance | Reserved |

---

## Pending items

- [ ] 4 changes from previous Python script that failed to apply (changes 13, 14, 15, 22)
- [ ] Bundle SheetJS 0.20.2 inline — replace `<script src="https://cdn.sheetjs.com/xlsx-0.20.2/...">` in **both** `room-reservations.html` line 6 and `utilities.html` line 6 in a single session
- [ ] Q1: Refactor table event listeners to use event delegation on tbody (performance)
- [ ] Build 2 remaining modules: Staff Scheduling, Maintenance (Room Inspection ✅, Key Inventory ✅, Inventory ✅)
- [ ] Password gate re-enable (code removed, ready to re-add to `index.html` when ready)
- [ ] Push project to GitHub (`.gitignore` ready; pending `git init` + remote setup)

---

## Completed improvements (2026-05-31, session 19)

- [x] `.gitignore` — created: excludes `*.json`, `*.xlsx`, `*.pdf`, `clearance_a5_preview.html`; `memory/` rule removed (actual memory folder is outside project directory in `~/.claude/`)
- [x] Root-level cleanup — standalone backup HTML files, JSON backups, and Excel exports removed from project folder; CLAUDE.md root-level files table and file stats updated to reflect current state

---

## Completed improvements (2026-05-31, session 18)

- [x] `modules/userguide.html` — NEW module (1,331 lines): Interactive Dean's User Guide covering all 8 ready modules (Room Reservations, Student Profiles, Floor Plan, Utilities, Reports, Key Inventory, Room Inspection, Inventory) + Getting Started + Tips & Reference. Features: sticky left sidebar with grouped TOC + active-section highlighting via IntersectionObserver; collapsible subsections with smooth max-height transition; live text search with yellow highlight; responsive (hamburger sidebar on mobile); print-friendly CSS (`@media print` hides sidebar/nav); back-nav via `?back` URL param; dorm name pulled from DormDB
- [x] `index.html` — Dean's User Guide card added (📖, `ready: true`, "10 modules covered" blue pill stat)
- [x] `CLAUDE.md` — User Guide added to module list + file stats table + session 18 completed improvements

## Completed improvements (2026-05-31, session 17)

- [x] `modules/inventory.html` — NEW module (1,078 lines): 6-tab asset inventory — Dashboard (6 stat cards: total/good/fair/poor+damaged/missing/flagged; top maintenance flags; rooms-with-missing-items table), Items (full CRUD with search/filter by location/category/condition), By Location (per-location item list + template comparison showing missing items for student rooms), Labels (Code 39 SVG barcode generation — pure JS no CDN; multi-select → A4 label sheet print, 3-column grid), Maintenance Flags (push items to `dormMaintenance` as Plant Service stubs), Settings (room template editor + category manager + custom locations + "Seed All Rooms")
- [x] `dorm-db.js` — Added `INV_TEMPLATE: 'dormInvTemplate'` key; `getInvTemplate()` / `saveInvTemplate()` methods; `maintenanceFlagged` stat in `getMenuStats()`; fixed `lowStock` filter to only count consumable items (`isConsumable: true`)
- [x] `index.html` — Inventory card set to `ready: true`; updated desc; `getStats()` shows `lowStock` (orange) + `maintenanceFlagged` (red) + "No issues" (green) pills

## Completed improvements (2026-05-31, session 16)

- [x] `modules/reports.html` — 💰 Fee Collection tab (8th tab, 1,050 lines): 5 summary stat cards (total outstanding, storage unpaid, room hold pending, clearance pending, key fines); detail table aggregating unpaid amounts from: storage rentals (active + away), room holds (`paymentMethod === 'Not Paid'`), pending clearance forms (with or without fees assessed), and lost key fines (`!finePaid`); `printFeesReport()` opens A4 print window; live reload subscribed to `dormData`, `dormAway`, `dormKeysInv`; `_isActive()` helper refactored from repeated inline classList checks across all live reload handlers

## Completed improvements (2026-05-31, session 15)

- [x] `modules/key-inventory.html` — 📄 Agreement tab (5th tab): on-screen preview of Borrower Rules & Responsibilities Agreement styled with module theme (`#1e3a5f`, Segoe UI); "🖨️ Print Agreement" opens new A4 window; all values dynamic — dorm name, student return minutes, cash fine, account penalty; `_agreementHtml()` shared builder used by both screen and print; `renderAgreement()` refreshes on every tab switch

## Completed improvements (2026-05-31, session 14)

- [x] `modules/key-inventory.html` — 🖨️ Print Ledger button in toolbar: opens 2-page portrait A4 Master Borrower Agreement Signature Ledger in new window; rows 1–20 page 1, rows 21–48 page 2; dorm name from `DormDB.getDormName()`; fine amounts from `cfg`; reference HTML CSS used (Arial, `border: 1px solid #000`, `background: #e9ecef` headers)

## Completed improvements (2026-05-31, session 13)

- [x] `modules/reports.html` — New 📋 Clearance tab (7th tab): Section A = active clearance overview table (all students with moveOutReason); Section B = form builder (room selector → occupant selector → editable clearance form → print). `printClearanceForm()` ports `printFinanceForm()` from room-reservations; "Both occupants" generates two landscape A4 sheets with page-break; inspection charges auto-fill via `_getInspChargesRpt()`; live fee total; DormDB subscription for live reload. 14 new functions.

## Completed improvements (2026-05-31, session 12)

- [x] `dorm-db.js` — Added `KEYS_CFG: 'dormKeysConfig'` constant; `getKeysConfig()`/`saveKeysConfig()` methods (fine amounts, return time limits, semester label)
- [x] `modules/key-inventory.html` — NEW module: 4-tab Key Inventory (Dashboard, Active, Inventory, Settings); per-key records with embedded history; check-out/return/lost flow; overdue auto-detection every 60s; fine modal (Cash/Account/Waived); "Generate from Rooms" bootstraps A+B keys from room reservations; A4 print shift sheet; settings tab
- [x] `index.html` — Key Inventory card set to `ready: true`; stat pills show keysOverdue + keysLost

## Completed improvements (2026-05-31, session 11)

- [x] `dorm-db.js` — `exportAll()` fixed: try/catch per localStorage value so plain strings (e.g., `dormUserName = Richmond`) no longer crash `JSON.parse`; `importAll()` fixed: plain strings restored via `localStorage.setItem` directly (not `_w`/JSON.stringify) to stay compatible with direct `getItem` reads
- [x] `index.html` — Export All Data download anchor now appended to DOM before `.click()` (Firefox fix); try/catch shows error alert on failure
- [x] `modules/room-reservations.html` — RA role removed from UI (`roleSelect`, `raFloorDiv`, `raFloorSelect` deleted); `handleRoleChange()`, `updateRoleUI()`, `applyFloorFilter()` simplified; `_runInit` no longer reads/restores `dormRole`; `currentRole` stays permanently `'dean'`
- [x] `index.html` — Renamed from "Dorm Manager" to "Dormitory Administration"; h1 shows "🏛️ Dormitory Administration — [Dorm Name]"; dorm selector (dropdown + custom name field) added to header right; `updateMenuDorm()` saves to `dormNameSelect`/`dormNameCustom` and updates header live
- [x] `modules/utilities.html` — Hot water tab: `getStudentSlotsFlexible()` added (AC-suffix normalization); `buildRows()` HW section rewritten with `hwOcc()` + `coveredBases` Set to deduplicate `426` vs `426AC`; `renderSummary()` HW billing key uses `slot.room` via `getStudentSlotsFlexible`
- [x] `modules/room-inspection.html` — "↺ Reset to Code Defaults" button added to Settings tab; `resetDefaultCharges()` clears `dormInspDefaultCharges` from localStorage so new code `i.base` prices take effect

## Completed improvements (2026-05-30, session 10)

- [x] `modules/room-inspection.html` — 2 UX bugs fixed: (1) New Inspection modal form fields (Room/Type/Date/Semester) were overlapping and unclickable — fixed by adding `flex-direction:column;align-items:stretch` to each `.fg` div in the flex row; (2) Side assignment dropdowns had no mutual exclusivity — `syncSideDropdowns()` added, disabling already-taken sides for other occupants; called on every side change and on `populateOccupants()` completion

## Completed improvements (2026-05-30, session 9)

- [x] `modules/room-inspection.html` — 7 bugs fixed: (1) Critical: `printInspectionSheet` `itemRows()` now receives a specific charge array per section, fixing wrong Side B charges on the printed sheet; (2) AC Unit now auto-defaults to N/A for non-AC rooms in `buildItemGrids`; (3) Edit Charges modal no longer shows bathroom as an editable line — `ec_bathCost` is the sole control, preventing silent override; (4) `pushMaintenanceStubs` now writes `status:'Open'` (Title case) matching `getMenuStats` check — maintenance stubs now counted on menu; (5) `renderCharges` uses `c.splitBy` instead of live occupant count for shared charge per-person calculation; (6) Charges preview label changed from "Grand Total (per student)" to "Total Charges (all sides + per-person splits)"; (7) `generateCharges` unused `bathroom` parameter removed

## Completed improvements (2026-05-30, session 8)

- [x] `modules/room-inspection.html` — NEW module: move-in/move-out checklists; items split into Side A (door), Side B (balcony), Shared Fixtures, Bathroom; auto charge calculation vs. paired move-in record; severity multiplier table; post-save "✏️ Edit Charges" modal (repair costs updatable after the fact); A4 inspection sheet print; A5 room cost sheet print (for posting in room); Charges tab per-student summary; Settings tab (default replacement costs + semester label); maintenance stubs written on Poor/Missing items at move-out
- [x] `modules/room-reservations.html` — `side: ''` field added to `emptyStudent()` + `ensureStudent()`; Side A/B cycle button in Name cell (green=A, blue=B); `cycleSide(ri)` function; `_getInspectionCharges()` helper reads latest move-out inspection; `openClearanceModal()` pre-fills Other fee from inspection charges when not already set
- [x] `dorm-db.js` — `failedInspections` in `getMenuStats()` now counts move-out inspections with non-zero total charges (replaces placeholder `result==='Fail'` check)
- [x] `index.html` — Room Inspection card set to `ready: true`; updated desc and stats (shows "N with charges" pill)

## Completed improvements (2026-05-30, session 7)

- [x] `modules/room-reservations.html` — "Columns ▾" button moved from footer bar to the toolbar area (alongside Load File, Save Excel, Undo, Redo)
- [x] `modules/room-reservations.html` — 🪪 ID column relocated from position 17 (last) to position 4 (next to Name); `_COL_DEFS` renumbered; all `addInteractivity` ci values shifted; default-hidden updated to `{4}`; ID input now has keyboard arrow navigation via `addInteractivity`

## Completed improvements (2026-05-30, session 6)

- [x] Cross-module Student ID identity: `studentId: ''` added as top-level field to `emptyStudent()` and `ensureStudent()`
- [x] `modules/room-reservations.html` — new 🪪 ID column (col 17, hidden by default); input debounced to `s.studentId`; `initColPicker` defaults to `{17}` hidden
- [x] `modules/room-reservations.html` — `_hasProfile()` checks `s.studentId` first (falls back to `s.clearance.studentId`, then name)
- [x] `modules/room-reservations.html` — `openClearanceModal()` auto-populates `cl_id` from `s.studentId` when clearance field is blank
- [x] `modules/room-reservations.html` — `vacateAndArchive()` uses `s.studentId||c.studentId` for history entry
- [x] `modules/room-reservations.html` — `saveToExcel()` exports `s.studentId||c.studentId`; `loadFromInput()` reads 'Student ID' into top-level `s.studentId`
- [x] `modules/student-profiles.html` — `getRoomFromReservations()` checks `r.studentId` first (then `r.clearance.studentId`, then name)
- [x] `modules/utilities.html` — `getStudentSlots()` helper; per-student bill list in Summary tab shows Student ID column
- [x] `modules/floor-plan.html` — `getOccupancy()` now returns `{ name, id }` objects; room cards show first name + grey student ID
- [x] `modules/reports.html` — Room Report adds ID column; Custom Report adds "Student ID" checkbox + `cv()` case + `colMap` entry; history rows include `studentId`

---

## Completed improvements (2026-05-30, session 5)

- [x] `dorm-db.js` — IndexedDB photo subsystem: `_openIDB()`, `_dataURLtoBlob()`, `getPhoto/savePhoto/deletePhoto` (async)
- [x] `dorm-db.js` — `exportAll()` / `importAll()` made async; photos serialized as base64 under `_photos` key; full round-trip on restore
- [x] `dorm-db.js` — Added `PHOTOS_MIGRATED: 'dormPhotosInIDB'` key constant
- [x] `modules/student-profiles.html` — `compressPhoto()`: Canvas-based JPEG resize (800×1040 max, 82% quality); ~25–50 KB output
- [x] `modules/student-profiles.html` — `migratePhotosToIDB()`: one-time migration of legacy base64 photos to IDB on load
- [x] `modules/student-profiles.html` — `init()` made async; runs migration before render
- [x] `modules/student-profiles.html` — `handlePhotoUpload/saveProfile/deleteCurrentProfile/openEditModal/printCard/closeModal` made async; photo pipeline uses Blob/Object URLs; `photoDataUrl` variable removed
- [x] `modules/student-profiles.html` — `emptyProfile()`: removed `photoDataUrl` field
- [x] `modules/room-reservations.html` — `autoSave()`/`loadFromLS()`/`saveRoomHistory()`/`saveQueue()`/`saveAwayStudents()` now use `DormDB` methods (no direct `localStorage` data calls)
- [x] `index.html` — `exportAll()`/`restoreAll()` made async with `await DormDB.exportAll/importAll()`

---

## Completed improvements (2026-05-30, session 3)

- [x] `modules/reports.html` — new 6-tab report hub (archive, room, custom, pivot, holds, storage); all data via DormDB; print/PDF only
- [x] `modules/room-reservations.html` — extracted ~436 lines of report functions/modals; heading renamed to "🛏️ Room Reservations — [Dorm]"
- [x] `modules/room-reservations.html` — Columns ▾ button fixed (`position:fixed` panel offset by `window.scrollY` — removed)
- [x] `modules/floor-plan.html` + `modules/reports.html` — dynamic back-nav: `?back=room-reservations` → "← Room Reservations"
- [x] `index.html` — Reports card added (📊, `ready: true`, shows archived count pill)

## Completed improvements (2026-05-30, sessions 1–2)

- [x] `modules/student-profiles.html` — Student Profiles module: profile list, completeness %, edit modal, photo upload, Style B A4 print card, Registrar Excel import, MS Forms CSV import
- [x] `modules/room-reservations.html` — "👤 Profile" badge on name cell for students with a matching profile record
- [x] `index.html` — Student Profiles card enabled (`ready: true`); Restore Backup button
- [x] `dorm-db.js` — `getMenuStats()` computes `profileCount` + `profilesComplete`
- [x] `modules/student-profiles.html` — 📤 Export Excel button (47 columns)
- [x] `modules/floor-plan.html` — visual room grid, bathroom pairing config, A4 landscape print
- [x] `modules/utilities.html` — monthly meter readings, per-student bill calc, Excel export, summary tab
- [x] `dorm-db.js` — added `getFloorPlan/saveFloorPlan` and `getUtilities/saveUtilities`

## Completed improvements (2026-05-29)

- [x] Multi-module system: `index.html` menu + `dorm-db.js` data API + `modules/` subfolder
- [x] `dorm-db.js` — typed localStorage API, BroadcastChannel cross-tab sync, `getMenuStats()`, PBKDF2 helpers, `exportAll/importAll`
- [x] `index.html` — responsive card grid, live stat badges, Export All Data button
- [x] `modules/room-reservations.html` — Menu nav link, `dorm-db.js` loaded
- [x] `isHoldActive(s)` helper, toast notifications, column visibility toggle, styled confirm/prompt modals
- [x] Away students panel: `markStudentAway`, `renderAwayPanel`, `restoreRoomModal`
- [x] `moveStudentToRoom()` — C3 complete

## Completed improvements (2026-05-28)

- [x] `closeModal()` clears all current*Student refs
- [x] `openModal()` sets `body.overflow='hidden'`; `closeModal()` restores
- [x] Global Escape key handler
- [x] `quickRemoveStudent()` — ✕ Remove button, archives minimal record
- [x] Over-capacity warning badge in room cell
- [x] `autoSave()` warns at >3,500 KB

---

## Dorm layout (Elijah Hall — default)

Floors 1–2: Rooms 101AC–106AC, 201AC–227AC (mix of AC and non-AC)
Floor 3: Rooms 301AC–327AC
Floor 4: Rooms 401AC–427AC

All rooms default to 2 beds. Max occupants configurable via dropdown (1–4). Custom layouts generated via 🏗️ Generate Dorm Setup.

---

## Session workflow for Claude Code

1. Read this file
2. Determine which file to edit:
   - Room reservations work → `modules/room-reservations.html`
   - Student profiles → `modules/student-profiles.html`
   - Floor plan → `modules/floor-plan.html`
   - Utilities / billing → `modules/utilities.html`
   - Reports → `modules/reports.html`
   - Menu / navigation → `index.html`
   - Data API / new keys → `dorm-db.js`
3. Run `grep -n "TODO\|FIXME\|PENDING"` on the relevant file to check inline notes
4. Plan change → confirm → apply via targeted str_replace
5. Run verification: `wc -l <file>`
6. **After every session — sync all MD files** (see rule below)

---

## MD sync rule — run at end of every session (or on demand)

**Trigger phrase:** say _"sync docs"_ or _"update all MD files"_ at any point to invoke this manually.

This rule also fires automatically at the end of every session where code was changed.

### What to update and when

| File | Update when |
|------|------------|
| `CLAUDE.md` → File stats table | Any file's line count changed |
| `CLAUDE.md` → Completed improvements | New feature or fix was shipped |
| `CLAUDE.md` → Pending items | A pending item was completed or a new one was identified |
| `CLAUDE.md` → Module function list | Functions added or removed from any module |
| `memory/project_state.md` | Any code changes, new pending items, or architectural decisions |
| `memory/module_<name>.md` | Functions, DormDB calls, modals, or data model changed for that module |
| `memory/module_dorm_db.md` | New key, method, or `getMenuStats()` field added to `dorm-db.js` |
| `memory/MEMORY.md` | A new memory file was created or an existing one's scope changed |

### How to run the sync

```
1. wc -l index.html dorm-db.js modules/*.html
2. Compare counts against CLAUDE.md File Stats table → update any that changed
3. For each module touched this session: update its memory/module_<name>.md
4. Update memory/project_state.md (completed work + remaining pending items)
5. Move completed items from Pending to Completed improvements in CLAUDE.md
```
