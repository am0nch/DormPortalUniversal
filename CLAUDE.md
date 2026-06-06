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
- **Reports** (`modules/reports.html`) — 12-tab report hub: archive, away students, room, custom, pivot, holds, storage, clearance, fee collection, attendance, incidents, bedding
- **Room Inspection** (`modules/room-inspection.html`) — move-in/move-out checklists, per-side charge calculation, clearance pre-fill, printable A4 sheet + A5 cost card
- **Key Inventory** (`modules/key-inventory.html`) — key checkout/return/lost tracking, overdue alerts, fine recording, master inventory, shift print sheet
- **Inventory** (`modules/inventory.html`) — asset tracking with Code 39 barcode labels, room template comparison, condition assessment, maintenance flag push
- **Dean's User Guide** (`modules/userguide.html`) — interactive HTML guide covering all 8 ready modules; sticky sidebar TOC, collapsible sections, live search, print-friendly
- **Residence Hall Handbook** (`modules/handbook.html`) — interactive APIU policy reference; 50+ policies, fines quick-reference table, system development roadmap; dark green theme, same sidebar/search pattern as userguide.html

- **Nightly Attendance** (`modules/attendance.html`) — nightly roll call, curfew countdown, SARRA2 leave import, mobile-first roster, session history, archive by semester
- **Incident Reports** (`modules/incidents.html`) — behavioral incident tracking, SARRA2 CSV export, fine defaults (handbook policy), follow-up management
- **Student Admin** (`modules/student-admin.html`) — off-campus move requests with 30-day notice tracking, waiver categories, Dean's assistance log
- **Dorm Workers** (`modules/dorm-workers.html`) — HR register for RAs, Monitors, Janitors, SWP workers; job documents; live floor coverage map
- **Staff Scheduling** (`modules/staff-scheduling.html`) — weekly shift grid, category filters, on-duty detection, "My Schedule" view, A4 landscape print
- **Maintenance** (`modules/plant-requests.html`) — plant/repair request tracking, urgency levels, dashboard with bar chart, history

---

## Architecture — critical rules

| Rule | Detail |
|------|--------|
| **Multi-module layout** | `index.html` (menu) + `dorm-db.js` (data API) at root; module HTML files in `modules/` subfolder. |
| **No build process** | No npm, no webpack, no transpilation. Vanilla JS (ES6+) only. |
| **No external CDN** | SheetJS must be bundled inline. No other external dependencies. All three SheetJS-using modules (room-reservations, utilities, student-profiles) are fully bundled as of session 24. |
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

## File stats (as of 2026-06-06, session 40)

| File | Lines | Notes |
|------|-------|-------|
| `index.html` | 642 | Main menu, 16 module cards (all ready), section headers, live stats; semester badge + modal + rollover UI |
| `dorm-db.js` | 470 | Central data API; 17 new keys; rolloverToSemester/flagKeyForVacatedStudent; INSP_CFG/INV_CFG/INCIDENTS_CFG |
| `modules/room-reservations.html` | 2,079 | Active room reservations (SheetJS bundled inline); semester col 18 + filter; archive restore modal; modernized UI (progressive disclosure; auto-show KPI cards) |
| `modules/student-profiles.html` | 1,224 | Student profiles, print cards, CSV/Excel import (SheetJS bundled inline); archived/Alumni toggle + Restore link |
| `modules/floor-plan.html` | 497 | Visual room grid + bathroom pairing config |
| `modules/utilities.html` | 674 | Electricity & hot water billing (SheetJS bundled inline) |
| `modules/reports.html` | 1,558 | 12-tab report hub (+ Away Students tab; archive semester filter + sort; bugs fixed) |
| `modules/room-inspection.html` | 1,148 | Move-in/out checklists, key issuance, charge calc, cost sheet |
| `modules/key-inventory.html` | 1,570 | Assigned key tracking + borrow log (MS Forms import), overdue alerts |
| `modules/inventory.html` | 1,772 | Asset inventory — Code 39 barcodes, room template, maintenance flags; 🛏️ Bedding tab; semester selects |
| `modules/attendance.html` | 1,220 | Nightly attendance, curfew countdown, SARRA2 leave import, session history; semester select |
| `modules/incidents.html` | 977 | Incident reports, SARRA2 CSV export, fine defaults, follow-up tracking; semester selects |
| `modules/student-admin.html` | 1,002 | Off-campus move requests + Dean's assistance log |
| `modules/dorm-workers.html` | 747 | HR register (RAs/Monitors/Janitors/SWP), job documents, floor coverage |
| `modules/staff-scheduling.html` | 624 | Weekly shift grid, category filters, on-duty detection, A4 print |
| `modules/plant-requests.html` | 607 | Maintenance requests, urgency levels, dashboard chart, history |
| `modules/userguide.html` | 2,397 | Dean's User Guide — all 16 modules + About/Version History/Roadmap/Legal; dev/testing disclaimer banner |
| `modules/handbook.html` | 1,865 | APIU Residence Hall Handbook — 50+ policies, fines table |

---

## Root-level files — what NOT to edit

| File | Status | Rule |
|------|--------|------|
| `SARRA2_INTEGRATION.md` | External integration guide | Edit when CSV formats or integration seams change. |
| `Dorm Manager.code-workspace` | VS Code workspace config | Do not edit. Auto-managed by VS Code. Git-ignored. |
| `userguide.md` | User documentation | Edit only when asked to update docs. |
| `*.xlsx` (data exports) | User data files | Never edit programmatically. Git-ignored. |
| `*.json` (data backups) | User data files | Never edit programmatically. Git-ignored. |
| `clearance_a5_preview.html` | Design preview | Edit only when asked to work on clearance form layout. Git-ignored. |
| `.gitignore` | Git config | Excludes `*.json`, `*.xlsx`, `*.pdf`, `clearance_a5_preview.html`. |

Active code files: `index.html`, `dorm-db.js`, `modules/*.html`.

---

## Report generation rules

When generating any institutional document (scholarly report, proposal, activity summary):

1. **Verify before writing** — run `wc -l` on all files and count K constants in `dorm-db.js` before stating any statistic. Numbers from memory or prior summaries are not reliable — always re-measure.
2. **No fabricated citations** — only cite sources that genuinely exist and were consulted. Do not invent references to fill out a bibliography.
3. **Estimates need labels** — any time-saving or performance claim must be clearly labelled "practitioner estimate, not a controlled measurement."
4. **Deliver to `/tmp/`, not repo** — institutional documents (proposals, faculty reports) go to `/tmp/` and are delivered via `SendUserFile`. Never commit them to the codebase.
5. **Terminology check** — use project-specific terms verbatim: "quality gate" (not "L99"), "DormPortalUniversal" (not "DormSystem"), "Known Pitfalls" (not "bug log").
6. **Pre-generation fact sheet** — before writing any document, extract and record: total line counts, DormDB key count, module count, known-pitfall count. Write the document from that verified baseline.

---

## Module expansion planning

Before proposing or building any new module:

1. **Audit SARRA2 overlap first** — read `SARRA2_INTEGRATION.md` and the Cross-module dependency map. Features listed as "SARRA2 territory" (SWP hours, Citizenship Points, Program Attendance, Campus Leave) must not be duplicated here.
2. **Audit existing keys** — `grep -n "^\s*[A-Z_]*:" dorm-db.js`. A key existing means the feature was planned; a getter/setter pair means it is already implemented.
3. **Audit existing modules** — read the "Current modules" list above. Never reimplement something already listed.
4. **Define integration seams** — if the new module reads another module's DormDB key, add it to the Cross-module dependency map before writing a single line of code.
5. **Roadmap against a verified baseline** — always build the baseline (steps 1–3 above) before drafting a roadmap. Never propose features from memory alone.

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
  semesterLabel,                  // semester the student occupied the dorm (from s.semester || getCurrentSemester())
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

## Modals — room-reservations.html (9 operational + 2 system)

| ID | Purpose |
|----|---------|
| `generatorModal` | Create new dorm room layout |
| `storageModal` | Storage box management |
| `clearanceModal` | Full clearance form + fee assessment |
| `transferModal` | Record transfer-in from another dorm |
| `addIncomingModal` | Add or edit incoming queue entries |
| `historyModal` | Per-room history viewer |
| `restoreRoomModal` | Restore an away student to a room |
| `archRestoreModal` | Restore an archived student from history (re-admit returning alumni) |
| `holdModal` | Room hold payment recording |
| `confirmModal` *(system)* | Styled replacement for `confirm()` |
| `promptModal` *(system)* | Styled replacement for `prompt()` |

`reportModal` and `allHistoryModal` removed — global reports live in `modules/reports.html`.

---

## All functions — room-reservations.html (108 total)

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
> Columns are hidden by storing 1-based CSS nth-child indices in `dormCols`. Current table has 18 columns (n values 1–18). When adding a new column: add it to `_COL_DEFS` and `initColPicker()` labels list and increment the total count here.

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

### Archive restore
`openArchiveRestoreModal` `confirmArchiveRestoreToRoom`

### Save / load / reset
`saveToExcel` `loadFromInput` `exportEmptyTemplate` `resetToEmbedded` `resetAllEdits`

### Init
`init` `_runInit`

---

## reports.html — functions (42 total)

**Utilities:** `escapeHtml` `getFloor` `matchesFloor` `isHoldActive`

**Tab control:** `switchTab(name)` — matches `data-tab` attr on buttons + `id="tab-{name}"` on panels

**Archive tab:** `renderArchive` `storageSubRow` `resolveStorage` `printArchive` `_archSort` `_seedSemesterFilter`

**Away Students tab:** `renderAway` `printAway` `_awaySort`

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
| 18 | 📅 Semester | `semester` | Hidden by default; `<select>` from shared semester registry |

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

- [ ] 4 changes from previous Python script that failed to apply (changes 13, 14, 15, 22) — original diffs unknown
- [x] Build 2 remaining modules: Staff Scheduling ✅, Maintenance ✅ (all 6 new modules complete)
- [x] Update Dean's User Guide (userguide.html) to cover the 6 new modules added in sessions 27–34 ✅
- [ ] Password gate re-enable (code removed, ready to re-add to `index.html` when ready)
- [ ] Enable GitHub Pages (remote ✅, code pushed ✅; pending Pages config in GitHub settings)
- [ ] ATT_ARCHIVE (`dormAttendanceArchive`) is write-only — `DormDB.archiveAttendance()` moves sessions there but no module reads them back. Future work: add an "Archived Semesters" section to `reports.html` → Attendance tab using `DormDB.getAttArchive()`.
- [ ] `userguide.html` needs updating to document: semester rollover UI, Alumni view in Student Profiles, Away Students report tab, archive restore flow

---

## Completed improvements (2026-06-06, session 40 — Room Reservations UI Modernization)

- [x] **`modules/room-reservations.html`** — Full UI/UX modernization using progressive disclosure pattern. Five stacked gray toolbar rows collapsed into three distinct zones: navy unified page header (breadcrumb + unsaved badge + last-saved meta), white consolidated toolbar (dorm select + max occupants + semester badge + file actions), and gray filter bar (search + floor/semester filters + count + Queue/Away/Floor Plan/Reports). Table visible without scrolling past controls. (1,978 → 2,079 lines)
- [x] **`modules/room-reservations.html`** — 21-card stat sprawl replaced with 6 always-visible KPI cards (Students, Empty Beds, Waiting, Move Out, Held, Away) in a compact inline strip. Secondary stat cards (Summer, 1st Sem, Leaving Dorm, Storage, Revenue, Keys Back, Clearance Done, Confirmed) auto-appear in the same strip when their value is > 0 and disappear when zero — no manual toggle required.
- [x] **`modules/room-reservations.html`** — All 21 original stat `id` attributes preserved (removed IDs retained as hidden `<span>` elements) so `updateStats()` never throws null-reference errors.
- [x] **`modules/room-reservations.html`** — `_refreshSecondaryCards()` function added; `updateStats()` patched via IIFE to call it after every data refresh; immediate call in IIFE catches values already set by page-load render.
- [x] **`modules/room-reservations.html`** — Footer actions (Queue, Away, Floor Plan, Reports) moved to filter bar where they sit adjacent to the table. Overflow menu (···) added to toolbar for infrequently-used actions (Reset to Elijah Hall, Empty Template). `toggleOverflow()` helper added with click-outside-to-close behavior.

## Completed improvements (2026-06-06, session 39 — Code Review Bug Fixes)

- [x] **`modules/reports.html`** — `printArchive()` was missing the `studentId` search branch present in `renderArchive()`, causing student-ID searches to show filtered results on screen but unfiltered results on print. Fixed by adding `|| (h.studentId || '').toLowerCase().includes(term)`. (1,547 → 1,558 lines)
- [x] **`modules/reports.html`** — `_awaySort` / `renderAway()` / `printAway()`: null return-date entries were substituted with `0` (Unix epoch 1970) causing them to sort to the top in ascending order instead of the bottom. Fixed with explicit null-last comparator: `if (!a._returnD) return 1; if (!b._returnD) return -1;`
- [x] **`modules/student-profiles.html`** — Alumni view was missing the documented "↩ Restore" button. Since `openArchiveRestoreModal` lives in `room-reservations.html` (a different page), added a "↩ Restore" button that navigates to Room Reservations where the archive restore modal is fully functional. (1,223 → 1,224 lines)
- [x] **`modules/reports.html`** — Added `DormDB.on(DormDB.KEYS.SEMESTER_CFG, _seedSemesterFilter)` subscription so the Archive tab semester filter dropdown refreshes when a new semester is added from the main menu's semester modal (previously only refreshed on tab switch or history change).
- [x] **`index.html`** — `startSemesterRollover()` was calling `refreshSemesterHeader()` explicitly after `saveSemesterCfg()`, causing a double render since `saveSemesterCfg` already broadcasts `SEMESTER_CFG` which triggers the subscription. Removed redundant call. (643 → 642 lines)
- [x] **`modules/userguide.html`** — Added development/testing disclaimer banner at top of main content and inside the Disclaimer subsection: "DormPortalUniversal v4 is currently under active development and testing. Features may be incomplete and unknown bugs may exist." (2,349 → 2,368 lines)

## Completed improvements (2026-06-06, sessions 37–38 — DormDB Audit + Semester Lifecycle)

### Session 37 — DormDB Disconnection Audit (all 10 findings fixed)
- [x] **`dorm-db.js`** — Added `INSP_CFG: 'dormInspConfig'` + `INV_CFG: 'dormInvCfg'` keys; `getInspCfg()`/`saveInspCfg()` + `getInvCfg()`/`saveInvCfg()` pairs (fixes CRITICAL backup loss for inspection settings and inventory categories); `getMaxOcc()` changed to `_r(K.MAX_OCC, 2)` (NaN-safe); `saveMaxOcc`, `saveCurrentUser`, `saveFloor`, `saveCols` changed to `_w()` (broadcast fixed); `saveLastSave` gets explicit `_broadcast()` calls; `getMenuStats()` bedding stat uses shared `SEMESTER_CFG` instead of `BEDDING_CFG.currentSemester`; `getMenuStats()` `profileCount`/`profilesComplete` filter `!p.archived`. (425 → 445 lines)
- [x] **`modules/room-inspection.html`** — `getDefaultCharges()`, `getSemesterPref()`, `saveDefaultCharges()`, `resetDefaultCharges()`, `saveSemesterPref()` all replaced direct `localStorage` calls with `DormDB.getInspCfg()`/`saveInspCfg()`; added `DormDB.on(PROFILES, populateRoomDropdowns)` subscription.
- [x] **`modules/inventory.html`** — `getCategories()`, `saveCategories()`, `getCustomLocations()`, `saveCustomLocations()` all replaced direct `localStorage` calls with `DormDB.getInvCfg()`/`saveInvCfg()`; removed dead conditional fallback in `_saveTpl()`.
- [x] **`modules/dorm-workers.html`** — Replaced dead `DormDB.getSchedule ?` ternary fallback with direct `DormDB.getSchedule()`; added `DormDB.on(SCHEDULE, renderDashboard)` subscription.
- [x] **`modules/student-profiles.html`** — Added `DormDB.on(ROOMS, renderList)` subscription (stale room column fix).
- [x] **`modules/attendance.html`** — Added `DormDB.on(CURFEW_CFG, ...)` subscription (cross-tab curfew changes now refresh live session).

### Session 38 — Semester-Scoped Data Persistence + Student Lifecycle
- [x] **`dorm-db.js`** — Added `rolloverToSemester(newLabel)` → resets semester-specific flags on continuing students, skips students pending checkout; returns `{ rolled, skipped }`; added `flagKeyForVacatedStudent(studentId, name)` → marks assigned keys as "Pending Return" when student vacates. (445 → 470 lines)
- [x] **`modules/room-reservations.html`** — `vacateAndArchive()`: adds `semesterLabel` to history entry; cross-module: marks matching `dormProfiles` entry as `archived: true` with `archivedAt`/`archivedSemester`; calls `flagKeyForVacatedStudent()`; `quickRemoveStudent()`: same cross-module additions; new `openArchiveRestoreModal(entry)` + `confirmArchiveRestoreToRoom(room)`: room-grid modal for re-admitting returning alumni, un-archives profile on confirm. (1,909 → 1,978 lines)
- [x] **`modules/student-profiles.html`** — `emptyProfile()` gets 3 new fields: `archived: false`, `archivedAt: ''`, `archivedSemester: ''`; `let showAlumni = false`; `toggleAlumni()` function; `renderList()` splits active vs archived profiles; Alumni view shows `archivedSemester` badge and ↩ Restore button (calls `openArchiveRestoreModal`); toolbar has Active/Alumni toggle button; `updateStats()` counts only active profiles. (1,186 → 1,223 lines)
- [x] **`modules/reports.html`** — Archive tab: `semesterLabel` column added; semester filter dropdown (`_seedSemesterFilter()`); sortable column headers (`_archSort()`); `printArchive()` respects active semester filter + landscape A4; new **Away Students tab** (`tab-away`): `renderAway()` shows Room/Name/ID/Type/Semester/Expected Return/Days Left/Away Since with overdue colouring; `_awaySort()` for column sort; `printAway()` A4 portrait; `storageSubRow` colspan fixed from 10 → 11. (1,420 → 1,547 lines)
- [x] **`index.html`** — Semester modal gets "🔄 Start New Semester Rollover" section: target semester dropdown, live preview (`updateRolloverPreview()`) showing continuing/pending counts, rollover button disabled when pending clearances exist; `startSemesterRollover()` calls `DormDB.rolloverToSemester()` + updates `cfg.current` + refreshes header; `escapeHtml()` helper added. (592 → 643 lines)

## Completed improvements (2026-06-04, session 35 — Bedding Inventory tab)

- [x] **`dorm-db.js`** — Added 4 new keys (BEDDING, BEDDING_STOCK, BEDDING_COUNT, BEDDING_CFG) with 8 getter/setter pairs; `getBeddingCfg()` defaults: 5 items (Pillow 165฿, Set 235฿, Pillow Case 65฿, Mattress Protector 350฿, Blanket 160฿); 2 new `getMenuStats()` fields: `beddingSoldThisSem` + `beddingMissing`. (383 → 409 lines)
- [x] **`modules/inventory.html`** — Added 7th tab (🛏️ Bedding): semester filter toolbar; Summary section (matches Excel layout: Starting/Added/Sold/Calculated/Physical/Missing/Revenue rows); Sales Ledger; Stock Events; Physical Counts. 4 modals (sale, stock, count, settings). Student lookup from dormData. Print A4 portrait report. All reads/writes via DormDB (BF-016 compliant). (1,081 → 1,750 lines)
- [x] **`modules/reports.html`** — Added 11th tab (🛏️ Bedding): semester selector, read-only summary table, payment breakdown stat cards, collapsible transaction list, 🖨️ Print Report button. `renderBeddingReport()` + `printBeddingReport()`. DormDB.on subscriptions for all 4 bedding keys. (1,245 → 1,420 lines)
- [x] **`index.html`** — Inventory card `getStats()` updated to show `beddingSoldThisSem` (blue pill) + `beddingMissing` (red pill). (431 → 433 lines)

## Completed improvements (2026-06-04, session 36 — Shared Semester Registry)

- [x] **`dorm-db.js`** — Added `K.SEMESTER_CFG: 'dormSemesterCfg'`; `getSemesterCfg()` (defaults: 3 semesters), `saveSemesterCfg()`, `getCurrentSemester()` helper. `exportAll`/`importAll` cover new key automatically. (409 → 425 lines)
- [x] **`index.html`** — Semester badge (`📅 Semester: [label]`) + `✏️ Manage` button in header right column; full `semesterModal` with Set Current / Registry table / + Add form; `openSemesterModal`, `closeSemesterModal`, `setCurrentSemester`, `addSemesterToList`, `deleteSemesterFromList`, `_renderSemesterTable`, `refreshSemesterHeader`; `DormDB.on(SEMESTER_CFG, refreshSemesterHeader)` subscription. (433 → 592 lines)
- [x] **`modules/room-reservations.html`** — `semester: ''` added to `emptyStudent()` + `ensureStudent()` guard; column 18 (`📅 Semester`, hidden by default) in `_COL_DEFS`; per-row `<select>` cell populated from registry; `_semesterOptions()` helper; semester filter `<select>` in filter-area; `populateSemesterFilter()` seeding from registry + data; `applyFilter()` extended for semester filtering; toolbar semester badge (`#rrSemLabel`); `saveToExcel()` exports `Semester` column; `loadFromInput()` reads `Semester` column; `DormDB.on(SEMESTER_CFG, ...)` subscription. (1,868 → 1,909 lines)
- [x] **`modules/student-profiles.html`** — `enrollmentSemester: ''` in `emptyProfile()`; `<select id="fEnrollmentSemester">` in Academic section of edit modal; `populateSemesterSelect()` helper; `openEditModal()` calls helper + sets value; `saveProfile()` reads value; `renderList()` shows semester pill badge; `DormDB.on(SEMESTER_CFG, populateSemesterSelect)`. (1,164 → 1,186 lines)
- [x] **`modules/attendance.html`** — `cfg_semester` + `archiveSemLabel` text inputs → `<select>`; `populateAttSemSelects()` helper; `loadSettings()` uses selects + falls back to `getCurrentSemester()`; `saveSettings()` fallback; `DormDB.on(SEMESTER_CFG, populateAttSemSelects)`. (1,198 → 1,215 lines)
- [x] **`modules/incidents.html`** — `cfg_semester` + `f_semester` text inputs → `<select>`; `populateIncSemSelects()` helper; `loadSettings()` / `saveSettings()` updated; `DormDB.on(SEMESTER_CFG, populateIncSemSelects)`. (959 → 977 lines)
- [x] **`modules/inventory.html`** — 4 bedding semester text inputs (`bdd_sale_semester`, `bdd_stock_semester`, `bdd_count_semester`, `bdd_cfg_semester`) → `<select>`; `populateBddSemSelects()` helper called by all 4 modal openers; `populateBddSemFilter()` seeds from shared registry first; `DormDB.on(SEMESTER_CFG, ...)` subscription. (1,750 → 1,769 lines)
- [x] **`CLAUDE.md`** — File stats table updated; column count 17 → 18 in architecture section; column 18 added to table.
- **Deferred:** `room-inspection.html` BF-016 violation (uses `localStorage('dormInspSemester')` directly) — noted for next session.

## Completed improvements (2026-06-04, post-expansion bugfixes)

- [x] **3 high-severity bugs fixed (code-review findings):** (1) `incidents.html:590` — CSV export now strips `\r\n` from description before comma-escaping, preventing multi-row injection in SARRA2 CSV; (2) `attendance.html:618` — `confirmCreateIncidents()` adds dedup guard (`attendanceSessionId` check) and extracts `base = Date.now()` before `.map()` to prevent duplicate records on double-tap and same-millisecond ID collision; (3) `student-admin.html:569` — `initiateOffCampusClearance()` separates ID match from name fallback, adds multi-match guard ("multiple students named X — add Student ID first") to prevent wrong-student clearance on shared names. (attendance.html: 1,192 → 1,198; student-admin.html: 993 → 1,002)
- [x] **BF-016 violation fixed (incidents.html):** `incCfg` was reading/writing `dormIncidentsConfig` via direct `localStorage` calls. Added `INCIDENTS_CFG` key to `dorm-db.js` K constants with `getIncidentsCfg()` / `saveIncidentsCfg()` and routed all access through DormDB. (dorm-db.js: 377 → 383 lines)

## Completed improvements (2026-06-04, sessions 27–34)

- [x] **Phase 1 — dorm-db.js + index.html foundation:** Added 10 new KEYS (LEAVES_IMPORT, ATTENDANCE, ATT_ARCHIVE, CURFEW_CFG, INCIDENTS, INCIDENTS_CFG, OFFCAMPUS_REQ, ASSISTANCE, WORKERS, WORKERS_CFG) + 22 getter/setter pairs; 5 new getMenuStats() fields; archiveAttendance() helper; MAINTENANCE_CFG key + getter/setter. index.html: menu-section CSS headers; MODULES array expanded to 16 cards with section grouping (Operations, Student Affairs, Staff & Facilities, Reference); 4 new DormDB.on() subscriptions. (335 → 431 lines)
- [x] **Phase 2 — Nightly Attendance** (`attendance.html`, 1,192 lines): 5-tab mobile-first module; APIU handbook curfew defaults (22:00/23:00, 15-min grace); live countdown banner (3 states); SARRA2 leave import (snapshot pattern, flexible CSV parser); generateRoster() from dormData + dormAway + leavesImport; 6 status values (Present/Absent/On Leave/Away/Exempt/Not Set); sticky tally bar; post-session "create incident reports for absent students" flow; archiveCurrentSemester() via DormDB.archiveAttendance(); A4 print session record.
- [x] **Phase 3 — Incident Reports** (`incidents.html`, 959 lines): 5-tab purple (#7b1fa2) module; 9 incident types, 4 severities; studentsInvolved[] with role/fine/CP fields; SARRA2 CSV export via Blob+object URL (no SheetJS); handbook fine defaults pre-seeded (Unauthorized Room Change = 1,000 ฿); follow-up overdue detection; bulk SARRA2 export with checkbox selection; A4 print; BF-016 fix: INCIDENTS_CFG routed through DormDB instead of direct localStorage.
- [x] **Phase 4 — Student Admin** (`student-admin.html`, 993 lines): 3-tab blue (#1565c0) module; Off-Campus Requests with 30-day notice compliance badge (handbook policy), waiver categories (6), parent approval, approve/reject workflow, "Start Clearance" button writing directly to dormData; Dean's Assistance Log with multi-student support, 9 types, hours/cost tracking, overdue follow-up detection; Reports tab with notice compliance rate + A4 print.
- [x] **Phase 5 — Dorm Workers** (`dorm-workers.html`, 743 lines): 6-tab slate (#37474f) HR module; RA/Monitor/Janitor/SWP categories; Dashboard with floor coverage grid (F1–F4 RA names) + live on-duty via dormSchedule; SWP SARRA2 cross-reference fields (swpSarra2Id, swpSemesterTarget, swpSupervisor); Job Documents tab: create/edit per-category with responsibilities list, A4 agreement print with signature lines; ?worker=id deep-link.
- [x] **Phase 6 — Staff Scheduling** (`staff-scheduling.html`, 624 lines): 3-tab teal (#004d40) module; weekly Mon–Sun grid (configurable start day); shift chips color-coded by category; on-duty banner from real clock time; category filter chips; shift modal with per-category default start/end times from workersCfg; My Schedule tab filtered by current user; A4 landscape print sheet.
- [x] **Phase 7 — Maintenance** (`plant-requests.html`, 607 lines): 4-tab brown (#4e342e) module; urgency picker (Low/Normal/High/Emergency); Dashboard with hot-rooms list, avg days-to-resolution, urgency bar chart; quick-action status buttons; History tab with date range filter; status strings Title Case matching getMenuStats(); MAINTENANCE_CFG key for default assignee.
- [x] **Phase 8 — Reports additions** (`reports.html`, 1,053 → 1,245 lines): Attendance tab (session log, per-student absence counts with ≥3 alert, stat cards, A4 print); Incidents tab (by-type summary, unresolved table, SARRA2 backlog count with link, A4 print); DormDB.on() subscriptions for both new keys.

## Completed improvements (2026-06-02, session 26)

- [x] **Backend — domain rename:** `sarra2.apiu.ac.th` → `sarra2.apiu.edu` across all backend config files (`Makefile`, `config.py`, `.env.example`, `docker-compose.yml`, `BACKEND_DOCS.md`, `ABSORPTION_GUIDE.md`). Email addresses (`dorm@apiu.ac.th`, `mail.apiu.ac.th`) correctly left unchanged.
- [x] **CLAUDE.md — quality infrastructure:** Added Ultrathink triggers table (11 scenarios), quality gate checklist (6 categories), cross-module dependency map (14 DormDB keys), Known Pitfalls table (10 documented bugs), Manual Smoke Tests section (4 scenarios), and Autocompact rules. Session workflow updated with steps 4 (ultrathink check), 6 (quality gate), 8 (autocompact signal).

## Completed improvements (2026-06-02, session 25)

- [x] **Key Inventory — Assigned Key lifecycle:** New `🗂️ Assigned` tab with `dormKeysAssigned` storage key; `emptyAssignedKey()` data model; full issue/return/lost flow; configurable deposit amount (default 100 ฿) in Settings; `returnAssignedKey()` with deposit refund flag; `markAssignedLost()` with fine recording; Dashboard adds "Assigned (With Students)" + "Deposits Pending" stat cards. (1,181 → 1,570 lines)
- [x] **Key Inventory — Borrow Log rename:** "Active" tab renamed to "Borrow Log" (`tab-borrow`); `renderBorrow()` replaces `renderActive()`; `ReturnOnly` status support with ⚠️ warning badge; Monitor name column added.
- [x] **Key Inventory — MS Forms import:** `importBorrowFromForms()` — accepts `.xlsx`/`.csv` from MS Forms response export; flexible keyword column mapping; checkout/return rows auto-matched; idempotent via `formsId`; unmatched returns shown as `ReturnOnly` ⚠️; import summary toast. `emptyKey()` gets `formsId` + `monitorName` fields.
- [x] **Room Inspection — Key Issuance section:** Move-in form gets per-occupant key issuance block (Key issued checkbox + deposit amount + date + method); hidden on move-out. `_writeKeyIssuanceFromInspection()` on save → upserts `dormKeysAssigned` + updates `dormProfiles` keyReceived/deposit fields simultaneously. (1,027 → 1,146 lines)
- [x] **Student Profiles — keyReceived field:** `keyReceived: false` in `emptyProfile()`; "🔑 Key received" checkbox in edit modal; `renderList()` shows 🔑 badge; `DormDB.on('dormKeysAssigned', ...)` subscription added — live sync when inspection saves keys. (1,154 → 1,164 lines)
- [x] **dorm-db.js:** `KEYS_ASSIGNED: 'dormKeysAssigned'`; `getAssignedKeys/saveAssignedKeys`; `keyDepositAmount: 100` in `getKeysConfig()` defaults; `depositsCollected`/`depositsPending` in `getMenuStats()`. (311 → 317 lines)
- [x] **index.html:** `DormDB.on('dormKeysAssigned', refreshStats)` subscription added. (334 → 335 lines)
- [x] `CLAUDE.md` — File stats updated (session 25)

## Completed improvements (2026-06-01, session 24)

- [x] **Architecture — SheetJS CDN removed:** Bundled `xlsx.full.min.js` inline in `room-reservations.html`, `utilities.html`, `student-profiles.html`. All 3 files now fully offline-capable (~1 MB each with bundle).
- [x] **Architecture — DormDB setters added:** `dorm-db.js` now exposes `saveDormName`, `saveMaxOcc`, `saveCurrentUser`, `saveLastSave`, `getLastSave`, `getFloor`, `saveFloor`, `getCols`, `saveCols`, `getPhotosFlag`, `setPhotosFlag`. All 15 direct `localStorage` calls in `room-reservations.html` + 2 in `student-profiles.html` routed through DormDB — cross-tab sync now works for all shared settings.
- [x] **Performance — O(n²) fix:** Pre-compute `occMap`/`iqMap`/`histMap` Maps before `renderTable()` row loop. Eliminates 600 full-array scans per render for a 200-row table.
- [x] **Performance — Event delegation:** `addInteractivity()` replaced with one-time `initTableDelegation()` on `tbody` (capture-phase focus + keydown). Per-render listener attachment eliminated; `data-ri`/`data-ci` attrs drive navigation.
- [x] **UX — Scroll-to-top:** Added sticky ⇧ button to all 8 modules that were missing it (`room-reservations`, `utilities`, `student-profiles`, `floor-plan`, `reports`, `room-inspection`, `key-inventory`, `inventory`). All 10 modules now consistent.
- [x] **UX — Back-nav param:** `?back=` URL param handler added to `utilities.html` and `student-profiles.html` (others already had it). All modules now support contextual back-link labels.
- [x] **UX — Dorm name in nav:** `#navDorm` span added to `guide-nav` in `userguide.html` and `handbook.html`; populated via `DormDB.getDormName()`. All modules now show dorm name.
- [x] **UX — Photo export failure:** `index.html` `exportAll()` now alerts user if `dump._photosFailed > 0`; `dorm-db.js` tracks failure count in export.
- [x] `CLAUDE.md` — File stats + pending items updated (session 24)

## Completed improvements (2026-05-31, session 23)

- [x] `modules/userguide.html` — Sticky scroll-to-top button added (1,612 → 1,637 lines): fixed bottom-right ⇧ circle, navy `#1e3a5f`; fades in after 300px scroll, smooth scroll on click, hidden on print
- [x] `modules/handbook.html` — Sticky scroll-to-top button added (1,835 → 1,860 lines): same pattern, forest green `#1b4332` to match module theme
- [x] `CLAUDE.md` — File stats updated (session 23)

## Completed improvements (2026-05-31, session 22)

- [x] `modules/userguide.html` — New `sec-roadmap` section added (1,536 → 1,596 lines): "🗺️ Development Roadmap" in Reference group. Two subsections: Gap Analysis table (10 planned features with 🔴🟠🟡 priority badges) + Currently Supported Policies table (8 rows mapping handbook areas to modules). TOC array updated with sec-roadmap + 2 sub-items. Tip in sub-about-rationale updated to point to roadmap in this guide rather than handbook.
- [x] `modules/handbook.html` — `sec-roadmap` body replaced with cross-reference callout + styled link button pointing to `userguide.html#sec-roadmap` (1,868 → 1,835 lines). Hero description updated to remove roadmap mention.
- [x] `CLAUDE.md` — File stats updated (session 22)

## Completed improvements (2026-05-31, session 21)

- [x] `modules/handbook.html` — NEW module (1,868 lines): Interactive APIU Residence Hall Handbook (1st Ed., August 2017). 11 TOC groups covering 50+ policies. Features: `#1b4332` dark forest green theme; sticky sidebar with search + collapsible sections (identical pattern to userguide.html); Fines Quick Reference table (22 fine types with Baht amounts); System Development Roadmap section (moved to userguide.html in session 22). No DormDB writes — read-only reference module.
- [x] `index.html` — 📋 Residence Hall Handbook card added (ready: true, "50+ policies" + "Fines reference" pills). 321 → 331 lines.
- [x] `modules/userguide.html` — Cross-reference tip callout added to "About This Project" section pointing to the Handbook module. 1,535 → 1,536 lines.
- [x] `CLAUDE.md` — Handbook added to module list + file stats updated (session 21)
- [x] `memory/module_handbook.md` — new memory file created
- [x] `memory/MEMORY.md` — pointer to module_handbook.md added

## Completed improvements (2026-05-31, session 20)

- [x] `git init` — initialized repository; initial commit includes 14 files (all code + config, no data)
- [x] `modules/userguide.html` — 3 new sections added (1,331 → 1,535 lines):
  - **About This Project** (rationale, GitHub Pages access instructions, how auto-deploy works, requesting updates)
  - **Version History** (v4 module release table + v1–v3 summary)
  - **Disclaimer & Credits** (copyright, AI-assisted development attribution, data privacy + PDPA note, operational disclaimer)
- [x] `CLAUDE.md` — file stats updated; session 20 completed improvements added

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
4. **Check Ultrathink Triggers table** — if the task matches, apply maximum reasoning depth before writing a single line
5. Plan change → confirm → apply via targeted str_replace
6. **Run quality gate** — tick every applicable checkbox before marking the task done
7. Run verification: `wc -l <file>`
8. **Check autocompact signal** — suggest `/compact` if context is long or a major phase just completed
9. **After every session — sync all MD files** (see rule below)
10. **Run pre-push code review** (see rule below) — fix all CONFIRMED findings before pushing
11. **Commit and push directly to `main`** — this is a solo project; no PRs needed
12. **If generating an institutional document** — run the Report generation rules checklist first; deliver via `SendUserFile` to `/tmp/`, never commit to repo

### Git workflow (solo project)

```bash
git add <files>
git commit -m "type: description"
# run /code-review --fix before this:
git push origin main
```

No feature branches or pull requests required. Branch only when experimenting with something potentially breaking; merge back to main immediately once it works.

---

## Pre-push code review rule

**Trigger:** Before every `git push origin main` that contains functional code changes.

**How to run:** invoke `/code-review --fix` on the current diff.

The review checks 7 angles automatically:
- **Correctness** — logic errors, null/undefined deref, off-by-one, missing await, wrong conditions
- **Removed-behavior audit** — deleted guards or invariants not re-established elsewhere
- **Cross-file tracer** — callers broken by changed function signatures or return shapes
- **Architecture** — fixes at the wrong depth; special-casing something that should be generalised
- **Security** — XSS via unescaped HTML, direct localStorage writes bypassing DormDB, injection vectors
- **Performance** — redundant JSON.parse on hot paths, missing debounce on keypress handlers
- **Reuse / simplification** — logic duplicated from existing helpers; unnecessary complexity

**Gate:**
- All **CONFIRMED** findings must be fixed before pushing.
- **PLAUSIBLE** findings must be either fixed or explicitly accepted with a one-line reason in the commit message.
- **REFUTED** findings may be ignored.
- If no findings survive verification → push immediately.

**Skip when:** the commit is docs-only (`CLAUDE.md`, `userguide.html`, `handbook.html`), a revert, or a hotfix for a production incident where speed outweighs review overhead — note the skip in the commit message.

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

---

## Ultrathink triggers

When a task matches any row below, apply maximum reasoning depth — think through all side effects, data flows, and failure modes **before writing any code**. For user messages: prepend `ultrathink` to activate extended thinking.

| Trigger | Risk if skipped |
|---------|----------------|
| New module creation | Missing DormDB key, no index.html card stat, broken new-module checklist step → module never loads data |
| Cross-module data relationship change | Subscriber module doesn't get `DormDB.on()` → stale UI in second tab or second module |
| Data model change (`emptyStudent`, `emptyProfile`, `emptyKey`, `emptyAssignedKey`) | Missing `ensureStudent()` propagation → silent data loss on Excel import/restore |
| Any change touching 4 or more files simultaneously | Partial application leaves system in broken intermediate state |
| `recalcWaiting()` or room availability logic | Breaks reservation badges, status text, and hold/solo locking across all rooms |
| Backend Phase 1 — `dorm-db.js` async rewrite | One missed `await` breaks an entire module silently |
| SARRA2 absorption planning | Irreversible architectural decisions; wrong JWT field = auth fails for all users |
| Print layout code (A4/A5) | `@page` size, margin, and `page-break` errors only visible in print preview — not on screen |
| Conflict/merge/sync logic | Incorrect version comparison causes silent data loss with no error shown |
| Adding a column to the room-reservations table | `_COL_DEFS` n-values must be sequential; wrong index hides the wrong column silently |
| Security-adjacent code (auth, CORS, DEV_MODE gating) | DEV_MODE left `true` in production bypasses all JWT validation |

---

## Quality gate — pre-ship checklist

Zero known bugs shipped. Run every applicable item before calling a task done.

### Data model integrity
- [ ] New field → added to `emptyStudent()`/`emptyProfile()`/`emptyKey()` **AND** `ensureStudent()` **AND** `saveToExcel()` column list **AND** `loadFromInput()` reader
- [ ] No raw `{}` or partial object pushed to `fullData`, `incomingQueue`, `roomHistory`, or any DormDB-managed array — always use the `empty*()` factory
- [ ] No direct `localStorage.setItem/getItem` for any `dorm*` key — always through `DormDB`

### Cross-module correctness
- [ ] Module reads another module's DormDB key → `DormDB.on(KEYS.X, handler)` subscription exists in that module
- [ ] New DormDB key → constant added to `DormDB.KEYS` in `dorm-db.js` + getter/setter pair + `getMenuStats()` updated if countable + `exportAll/importAll` covers it
- [ ] Check the **Cross-module dependency map** below — update every module listed as a reader for the affected key

### String replace safety
- [ ] `grep -n "target string"` run first → confirmed unique before applying `str_replace`
- [ ] After edit: `wc -l` confirms file changed by expected amount (unexpected large delta = red flag)

### New module (full checklist)
- [ ] `dorm-db.js` script loaded **first** — no CDN scripts before it
- [ ] `DormDB.KEYS.X` constant exists before module tries to use it
- [ ] `DormDB.on()` subscriptions for all foreign keys read by this module
- [ ] Nav bar shows dorm name via `DormDB.getDormName()` and user via `DormDB.getCurrentUser()`
- [ ] `index.html` card set `ready: true` with correct stat pills from `getMenuStats()`
- [ ] CLAUDE.md updated: module list, file stats table, function list

### Rendering and UI
- [ ] New column in room-reservations → `_COL_DEFS` entry added + total column count comment updated in architecture section
- [ ] Print layout → `@page { size: A4/A5 portrait/landscape; margin: 12mm; }` present, tested in print preview
- [ ] Every async save shows a toast confirming success or failure
- [ ] Scroll-to-top ⇧ button present (all modules must have it)

### Zero console errors
- [ ] No reference to a function before it is defined
- [ ] No broken `DormDB.KEYS.X` where X doesn't exist in `dorm-db.js`
- [ ] All event handlers attached inside `init()`, called at page bottom

### Backend readiness (Phase 1 prep)
- [ ] Any new `DormDB.get*()` call written so it can be made async with minimal refactor (no sync-only assumptions)

---

## Cross-module dependency map

When you change a DormDB key, every module in the **Read by** column must be checked for subscription and rendering correctness.

| DormDB key | Written by | Read by |
|------------|-----------|---------|
| `dormData` | room-reservations | reports (all tabs), floor-plan (occupancy), utilities (billing), room-inspection (_getInspectionCharges), key-inventory (generate from rooms), student-profiles (profile badge room lookup), index.html (stats) |
| `dormHistory` | room-reservations (vacateAndArchive) | reports (archive tab) |
| `dormQueue` | room-reservations | reports (archive tab context) |
| `dormAway` | room-reservations (markStudentAway) | reports (fee collection — unpaid storage) |
| `dormProfiles` | student-profiles | room-reservations (_hasProfile badge), floor-plan (occupant names) |
| `dormKeysInv` | key-inventory (borrow log tab) | reports (fee collection — lost key fines), index.html (keysOverdue stat) |
| `dormKeysAssigned` | key-inventory (assigned tab), room-inspection (key issuance) | student-profiles (keyReceived live sync), index.html (depositsCollected/depositsPending) |
| `dormInspections` | room-inspection | room-reservations (_getInspectionCharges → clearance pre-fill), reports (clearance tab inspection charges) |
| `dormInventory` | inventory | index.html (lowStock, maintenanceFlagged stats) |
| `dormMaintenance` | room-inspection (push stubs), inventory (push stubs) | index.html (maintenanceFlagged stat) |
| `dormFloorPlan` | floor-plan | (standalone — no cross-module readers) |
| `dormUtilities` | utilities | (standalone — no cross-module readers) |
| `dormKeysConfig` | key-inventory (settings) | key-inventory (fine/deposit calc), room-inspection (deposit default) |
| `dormInspConfig` | room-inspection (settings) | room-inspection (default charges, semester label) |
| `dormNameSelect` / `dormNameCustom` | index.html (dorm selector) | all modules (getDormName()) |

---

## Known pitfalls — do not reintroduce

These bugs have been fixed before. Check this list when working in the affected area.

| Area | Pitfall | Fix |
|------|---------|-----|
| Column picker panel | Added `window.scrollY` to `position:fixed` top offset → panel jumps when page is scrolled | Remove `window.scrollY`; `position:fixed` is already viewport-relative |
| renderTable() performance | Full-array `.filter()` inside the row loop → O(n²) for 200 rows | Pre-compute `occMap`, `iqMap`, `histMap` Maps before the loop |
| AC room normalization | `426` vs `426AC` treated as different rooms in utilities billing | Use `getStudentSlotsFlexible()` which strips the AC suffix for matching |
| Maintenance stubs | `status: 'open'` (lowercase) didn't match `getMenuStats()` check for `'Open'` | Always write `status: 'Open'` (Title case) |
| Edit Charges modal | Bathroom cost appeared as editable inline line AND as `ec_bathCost` → silent double-edit | `ec_bathCost` is the sole control; remove inline bathroom line |
| Shared charge split | Used live occupant count for per-person calculation → wrong if one occupant leaves mid-semester | Use `c.splitBy` (set at generate time), not live count |
| `importAll()` crash | `JSON.parse` on plain string values like `dormUserName = "Richmond"` threw SyntaxError | Plain strings: restore via `localStorage.setItem` directly, not through `_w` |
| Photo in localStorage | Base64 photos stored in `dormProfiles` → quota exceeded at ~30 students with photos | Photos go to IndexedDB via `DormDB.savePhoto/getPhoto`; never in `dormProfiles` |
| `_COL_DEFS` n-values | Non-sequential n-values cause column hide/show to target wrong CSS nth-child | n-values must be sequential 1-based integers; verify after any column add/remove |
| DEV_MODE in production | `DEV_MODE=true` in docker-compose.yml bypasses all JWT validation | `docker-compose.yml` must always have `DEV_MODE: "false"`; only `.env` / `docker-compose.dev.yml` set it true |
| Excel import `ensureStudent` | Importing a row without passing through `ensureStudent()` → missing fields break `recalcWaiting()` | Always `ensureStudent(row)` every externally-sourced row before pushing to `fullData` |

---

## Manual smoke tests — run after changes

### After any room-reservations.html change
- [ ] Type a student name → appears in table → autosave runs (unsaved indicator disappears) → hard reload → name persists
- [ ] Clearance modal opens for a student with `moveOutReason` set
- [ ] Column visibility toggle (Columns ▾) opens and hides/shows a column correctly
- [ ] Floor filter dropdown filters rows correctly
- [ ] Search box finds a student by name
- [ ] Undo/Redo buttons revert and re-apply a name change

### After any dorm-db.js change
- [ ] Export All Data → download completes → re-import → all data intact, no console errors
- [ ] Open two browser tabs → edit data in one → other tab reflects change (BroadcastChannel)
- [ ] `getMenuStats()` returns correct counts visible on index.html card pills

### After any print layout change
- [ ] Open browser print preview (Ctrl+P) → correct page count, no content clipped at edges
- [ ] `@page` size matches the intended paper (A4 portrait/landscape, A5 portrait)
- [ ] Sidebar/nav hidden in print (check `@media print { display: none }`)

### After any new module
- [ ] Module card on `index.html` shows correct stats
- [ ] Back button returns to correct previous page
- [ ] Dorm name appears in module nav bar
- [ ] No console errors on first load (open DevTools before navigating)
- [ ] Module works when localStorage is empty (first-time use)

---

## Context management — autocompact

`/compact` compresses conversation history to free context for new work. Apply it proactively — the memory files persist across sessions, but the conversation does not.

### When to suggest `/compact`

| Signal | Action |
|--------|--------|
| A major task phase just completed (new module shipped, large feature done) | Sync memory files first → then suggest `/compact` |
| About to start a completely different task in the same session | Suggest `/compact` before beginning the new task |
| Session has had 6+ back-and-forth exchanges on a single problem | Suggest `/compact` |
| Many file reads have accumulated (context is visibly long) | Suggest `/compact` |

### Always before compacting
1. Run the MD sync rule — update `CLAUDE.md` stats + all relevant memory files
2. Confirm memory files saved — those survive; the conversation does not
3. Then tell the user: _"Context is getting long — run `/compact` before we continue so the next task starts clean"_

### Never compact mid-edit
Complete the current edit, run `wc -l`, confirm the change is correct — then compact. Never compact while a str_replace sequence is in progress.

---

## Self-improving agent patterns

These patterns reduce recurring mistakes and make each session more reliable than the last.

### 1 — Verification subagent (before generating reports)

Before writing any statistic in an administrative or scholarly document, spawn a quick Explore subagent to measure the codebase directly:

```
Agent({
  subagent_type: 'Explore',
  description: 'Verify codebase stats for report',
  prompt: 'Run: wc -l index.html dorm-db.js modules/*.html  AND  grep -c "^\s*[A-Z_]*:.*dormD" dorm-db.js  AND  grep -c "Pitfall\|Pitfalls\|- Area" CLAUDE.md. Return raw numbers only — no interpretation.'
})
```

Use the returned numbers verbatim. Never use a memorised count.

### 2 — Merge+sync routine (after merging feature branches)

Run these steps as one atomic unit — if any step fails, fix before proceeding to the next:

```
1. git fetch origin <feature-branch>
2. git merge origin/<feature-branch>
3. # Resolve all conflict markers (<<<<<<< / ======= / >>>>>>>)
4. wc -l index.html dorm-db.js modules/*.html
5. # Compare each count against CLAUDE.md File Stats → edit any that differ
6. git add index.html dorm-db.js modules/*.html CLAUDE.md
7. git commit -m "merge: <feature-branch> + sync CLAUDE.md stats"
8. git push -u origin <target-branch>
```

Never commit with unresolved conflict markers. Never push with stale CLAUDE.md line counts.

### 3 — BF-016 abstraction guard (after editing module HTML)

After writing or editing any module HTML file, run this check before committing:

```bash
grep -n "localStorage\.\(setItem\|getItem\)" modules/*.html | grep "dorm"
```

Any hit on a `dorm*` key that is not routed through DormDB is a BF-016 violation. Fix it — add the key to `dorm-db.js` K constants with getter/setter and route access through DormDB.

Known deferred violation: `room-inspection.html` uses `localStorage('dormInspSemester')` directly — this is tracked in Pending items.

### 4 — Context-aware planning (before proposing new features)

Before writing any roadmap or expansion plan, build a verified index of what already exists:

```
1. Read CLAUDE.md "Current modules" list (all 16 modules)
2. Read SARRA2_INTEGRATION.md seams table for overlap
3. grep -c "^\s*[A-Z_]*:" dorm-db.js   ← count existing K constants
4. grep -n "emptyStudent\|emptyProfile\|emptyKey\|emptyBedding\|emptyWorker" modules/*.html ← data model inventory
```

Propose new features only against this verified baseline. "I think there are about X modules" is not acceptable — measure first.

### 5 — Document scope enforcement

Institutional documents (proposals, faculty reports, activity summaries) follow this pipeline:

```
Generate → store at /tmp/<name>.html → SendUserFile → done
                                                       ↓
                                         NEVER git add / git commit
```

If a document was accidentally committed:
```bash
git rm --cached <file>
git commit -m "fix: remove institutional document from repo"
git push
```

Documents belong with the user, not in version control. The codebase is the product; documents about the product are ephemera.

### 6 — Pre-ship fact sheet (sessions touching 3+ files)

When a session modifies three or more files, generate an internal fact sheet before writing CLAUDE.md:

```
Files changed: <list with wc -l before/after>
New DormDB keys: <list or "none">
New functions: <list or "none">
Bugs fixed: <file:line citations or "none">
Breaking changes: <list or "none">
```

Write the CLAUDE.md "Completed improvements" entry from this fact sheet, not from memory. This prevents line count errors and omitted fixes in the session log.
