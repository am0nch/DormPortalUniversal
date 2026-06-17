# CLAUDE.md — DormPortalUniversal v4

Multi-module dormitory administration system for APIU. Runs entirely in the browser — no server, no login, no internet required. Main menu (`index.html`) links to module files in `modules/`. All data flows through `dorm-db.js` (localStorage + IndexedDB for photos).

---

## Modules

| File | Purpose |
|------|---------|
| `modules/room-reservations.html` | Beds, check-in/out, clearance, holds, queue, history, away students |
| `modules/student-profiles.html` | Student directory, A4 profile cards, CSV/Excel import |
| `modules/floor-plan.html` | Visual room grid, bathroom pairing config |
| `modules/utilities.html` | Meter readings, per-student billing, archive |
| `modules/reports.html` | 13-tab report hub — all reports are print/PDF only, no SheetJS; tab 13 = Att. Archive (IDB-backed) |
| `modules/room-inspection.html` | Move-in/out checklists, charge calc, clearance pre-fill |
| `modules/key-inventory.html` | Key checkout/return/lost, overdue alerts, assigned keys |
| `modules/inventory.html` | Asset tracking, Code 39 barcodes, room templates, bedding |
| `modules/attendance.html` | Nightly roll call, curfew countdown, SARRA2 leave import |
| `modules/incidents.html` | Behavioral incident tracking, SARRA2 CSV export |
| `modules/student-admin.html` | Off-campus requests, Dean's assistance log |
| `modules/dorm-workers.html` | HR register for RAs/Monitors/Janitors/SWP, floor coverage |
| `modules/staff-scheduling.html` | Weekly shift grid, on-duty detection, A4 print |
| `modules/plant-requests.html` | Maintenance requests, urgency levels, dashboard |
| `modules/ra-portal.html` | Mobile-first RA launcher (attendance, inspection, incidents, maintenance) |
| `modules/monitor-portal.html` | Mobile-first Monitor launcher (incidents, key borrow log) |
| `modules/userguide.html` | Interactive Dean's User Guide |
| `modules/handbook.html` | APIU Residence Hall Handbook, fines reference |

---

## Architecture rules

| Rule | Detail |
|------|--------|
| No build process | Vanilla JS (ES6+) only. No npm, webpack, CDN. |
| SheetJS | Locked at 0.20.2, bundled inline in room-reservations, utilities, student-profiles. |
| Data access | All `dorm*` localStorage keys go through `DormDB`. No direct `localStorage.setItem/getItem` for data keys (BF-016). |
| Photos | IndexedDB only via `DormDB.getPhoto/savePhoto/deletePhoto`. Never base64 in `dormProfiles`. |
| Cross-tab sync | `DormDB.on(DormDB.KEYS.X, handler)` required in every module that reads another module's key. |
| emptyStudent() | Always use `emptyStudent(room)` to create bed slots. Never push raw `{}`. |
| ensureStudent() | Pass every externally-sourced row through `ensureStudent(s)` before storing. |
| Back-nav | Modules accept `?back=<module>` param. Nav link reads it and shows "← [Name]" or falls back to "← Menu". |
| New DormDB key | Add to `K` constants + getter/setter pair + `getMenuStats()` if countable + covered by `exportAll/importAll`. |
| Print pages | `@page { size: A4; margin: 12mm; }`. Landscape for floor plan, A5 for clearance cost card. |
| Editing | Targeted str_replace only. Grep for uniqueness first. Run `wc -l` after each change. |
| Columns (room-reservations) | `_COL_DEFS` n-values must be sequential 1-based integers. 18 columns total. |

---

## File stats (2026-06-17, post-bug-fix)

| File | Lines |
|------|-------|
| `index.html` | 1,794 |
| `dorm-db.js` | 974 |
| `modules/room-reservations.html` | 2,153 |
| `modules/student-profiles.html` | 1,246 |
| `modules/floor-plan.html` | 514 |
| `modules/utilities.html` | 688 |
| `modules/reports.html` | 1,764 |
| `modules/room-inspection.html` | 1,592 |
| `modules/key-inventory.html` | 1,587 |
| `modules/inventory.html` | 2,718 |
| `modules/attendance.html` | 1,236 |
| `modules/incidents.html` | 993 |
| `modules/student-admin.html` | 1,014 |
| `modules/dorm-workers.html` | 759 |
| `modules/staff-scheduling.html` | 1,281 |
| `modules/plant-requests.html` | 722 |
| `modules/ra-portal.html` | 605 |
| `modules/monitor-portal.html` | 571 |
| `modules/userguide.html` | 2,785 |
| `modules/handbook.html` | 1,875 |

---

## Data model

### `emptyStudent(room)` — key fields

```js
{
  room, name, studentType,           // 'regular'|'new'|'visitor'|'guest'
  requestedRoom, requestStatus,       // 'Confirmed'|'Waiting'
  manualStatus, summer, firstSem,
  graduating, moveOutReason,          // ''|'Graduating'|'Off Campus'|'Internship'
  offCampusType,                      // 'Going Home'|'Leaving Dorm'
  roomHold: { active, paymentMethod, amountPaid },
  returnDate, keysReturned, solo,
  storageRental, storageQty, paymentMethod, totalAmount,
  box1Color, box1No, box2Color, box2No, box3Color, box3No,
  transferIn: { fromDorm, fromRoom, transferDate, notes },
  studentId, semester, side,
  clearance: {
    formCompleted, leaveDate, elecIn, elecOut, hotIn, hotOut,
    studentId, mobile, email, toDorm, toRoom, formNo, remarks,
    fees: { movingFee/Amt, cleaningFee/Amt, keyFee/Amt, drawerFee/Amt,
            chairFee/Amt, stoolFee/Amt, otherFee/Amt, otherFeeDesc }
  }
}
```

Other factory functions: `emptyProfile()` (student-profiles), `emptyKey()` / `emptyAssignedKey()` (key-inventory), `emptyRequest()` (plant-requests), `emptyWorker()` (dorm-workers).

### `isHoldActive(s)` — correct formula

```js
s.roomHold.active && (s.summer || s.firstSem)
  && s.moveOutReason !== 'Graduating'
  && !(s.moveOutReason === 'Off Campus' && s.offCampusType === 'Leaving Dorm')
```

### Room availability states

| State | Condition | Badge |
|-------|-----------|-------|
| available | ≥1 empty slot, no solo/hold lock | 🟢 Green |
| soon | All slots named, ≥1 has leaveDate | 🟡 Yellow |
| held | `roomHold.active = true` | 🟠 Amber |
| full | All slots named, nobody leaving | 🔴 Red |
| locked | Active solo, no moveOutReason | 🔴 Red |

---

## Known pitfalls — do not reintroduce

| Area | Pitfall | Fix |
|------|---------|-----|
| Column picker panel | `window.scrollY` added to `position:fixed` top → panel jumps | Remove it; fixed is already viewport-relative |
| renderTable() | Full-array `.filter()` inside row loop → O(n²) | Pre-compute `occMap`, `iqMap`, `histMap` Maps before loop |
| AC room normalization | `426` vs `426AC` as different rooms in utilities | Use `getStudentSlotsFlexible()` |
| Maintenance stubs | `status: 'open'` didn't match `getMenuStats()` `'Open'` check | Always write `status: 'Open'` (Title case) |
| Edit Charges modal | Bathroom cost editable inline AND via `ec_bathCost` → double-edit | `ec_bathCost` is the sole control |
| Shared charge split | Live occupant count wrong if occupant leaves mid-semester | Use `c.splitBy` (set at generate time) |
| `importAll()` crash | `JSON.parse` on plain string like `dormUserName="Richmond"` | Restore plain strings via `localStorage.setItem` directly |
| Photos in localStorage | Base64 in `dormProfiles` → quota exceeded | Photos → IndexedDB only via `DormDB.savePhoto/getPhoto` |
| `_COL_DEFS` n-values | Non-sequential → hides wrong CSS nth-child | Sequential 1-based integers only |
| `ensureStudent` on import | Missing fields break `recalcWaiting()` | Always `ensureStudent(row)` before pushing to `fullData` |

---

## Pending items

- [ ] `userguide.html` — all major sections documented ✅; Att. Archive tab section not yet added to userguide
- [ ] GitHub Pages enabled ✅ — SW cache must be bumped (`dormportal-vN`) after every deploy that touches HTML/JS (currently at v16)
- [ ] Cross-module dep map: add `dormSchedule`, `dormWorkersConfig.masterSchedule`, `dormInventoryAudits`; IDB stores `dormInventoryModels` + `dormInventoryAssets` added (Task 12)
- [ ] 3 unmerged branches: `claude/dorm-mis-migration-3oy2h2` (WIP full-stack), `claude/test-coverage-analysis-bBZsg` (104 Vitest tests), `claude/wonderful-hawking-TRPrZ` (multi-agent workflow)
- [ ] `archiveAttendance()` in dorm-db.js is dead code — old sync path replaced by `archiveSemester([K.ATTENDANCE])`; safe to remove
- [ ] `migrateAttArchive()` not fully atomic — mid-loop IDB failure could leave `dormAttendanceArchive` partially migrated, causing duplicate sessions on retry

## Completed (2026-06-18, Dean auth redesign)

- [x] **index.html** — Dean-only security redesign: replaced HMAC session machinery with plain `sessionStorage.setItem('dormPortalUnlocked','1')` (HMAC was theater — key was in localStorage); removed M365 as auth bypass (M365 = cloud sync only); removed open-access mode — no password → first-run setup overlay prompts Dean to create password; removed staff role from main gate (single Dean credential; Staff Access PIN stays in Portal Access modal for future use); `openPwdModal()` no longer gates on M365 backup being configured; bumped SW cache v15→v16. 1,867→1,794 lines

## Completed (2026-06-17, post-Snipe-IT bug fixes)

- [x] **modules/inventory.html** — `DormDB.on(KEYS.INVENTORY)` → `'dormInventoryAssets'` so Items/Location/Labels/Maintenance tabs refresh after save/delete (same-tab AND cross-tab); folded retired `dormInvTemplate` handler into `dormInventoryModels` (also refreshes Settings/Location/Dashboard); `closeAssetDetail()` helper revokes blob URLs on all three close paths (×button, Escape, backdrop). 2,713→2,718 lines
- [x] **modules/room-inspection.html** — `_writeBackAssets`: hoisted `getAllAssets()` before loop + Map lookup (O(n)→O(1) IDB reads); `pushMaintenanceStubs`: dedup now filters `status==='Open'` so repaired assets re-stub on re-inspection; `renderSettings`: iterates `Object.entries(def)` instead of `SIDE_ITEMS=[]`, adds `data-name` attrs; `saveDefaultCharges`: reads `[data-name]` inputs instead of empty arrays (was silently wiping all charges); `itemRows`: signature drops template array, iterates `Object.entries(dataObj)` — fixes blank tables in all inspection prints; `printRoomCostSheet`: reads IDB models grouped by scope (`per-side` vs other) instead of `SIDE_ITEMS=[]`. 1,585→1,592 lines
- [x] **sw.js** — Bumped cache `dormportal-v14` → `dormportal-v15`

## Completed (2026-06-17, Snipe-IT inventory + inspection)

- [x] **dorm-db.js** — IDB v4: `dormInventoryModels` + `dormInventoryAssets` stores with indexes; private `_invGetAll/_invGetByIndex/_invPut/_invDelete/_invGetAndUpdate/_invClear` helpers; public async API (`getInvModels/saveInvModel/deleteInvModel/getAllAssets/getAssetsByRoom/saveAsset/deleteAsset/appendCheckoutEvent`); `normalizeRoomId/isAcRoom`; `_cachedStats/_refreshIdbStats`; `_broadcastIdb` for cross-tab IDB sync; `exportAll/importAll` extended for IDB stores; `K.INVENTORY/K.INV_TEMPLATE` retired. 826→974 lines
- [x] **modules/inventory.html** — Models tab (CRUD, seed-from-template); emptyItem upgraded with Snipe-IT fields (`modelId`, `assetTag`, `statusLabel`, `checkedOutTo`, `checkoutLog`); all 34 `getInventory/saveInventory` call sites migrated to async IDB API; model picker in item modal; status badges; asset detail drawer with checkout history + condition photos; dashboard "Checked Out" + "In Maintenance" stat cards; async `pushToMaintenance`; legacy room template section removed. 2,518→2,713 lines
- [x] **modules/room-inspection.html** — `SIDE_ITEMS/SHARED_ITEMS/INSP_TO_INV/COND_MAP/_syncInventoryConditions` removed; live asset checklist from `DormDB.getAssetsByRoom()`; `buildGrid` renders `<tr data-asset-id>` rows; `readSideItems/readSharedItems` read from asset rows; `generateCharges` iterates asset data; `useDefaultTemplate()` fallback; `_writeBackAssets` writes `checkout/checkin/condition-change` events back to IDB on save; barcode scanner highlights matching asset row. 1,378→1,565 lines
- [x] **modules/floor-plan.html** — `isAcRoom` reads `DormDB.isAcRoom()` instead of string suffix. 514 lines (unchanged)
- [x] **modules/utilities.html** — `isAC` delegates to `DormDB.isAcRoom()`. 688 lines (unchanged)
- [x] **index.html** — `dormInventory` subscription replaced with `dormInventoryAssets`+`dormInventoryModels` IDB subscriptions. 1,866→1,867 lines
- [x] **sw.js** — Bumped cache `dormportal-v13` → `dormportal-v14`

## Completed (2026-06-16, session 3)

- [x] **dorm-db.js** — Expanded `ARCHIVE_SEM_FIELD` from 4 to 8 keys; added `K.ATTENDANCE`, `K.MAINTENANCE`, `K.OFFCAMPUS_REQ`, `K.ASSISTANCE`; expanded `archiveSemester()` default keyList; added `async migrateAttArchive()` for one-time legacy data migration. 799→826 lines
- [x] **modules/attendance.html** — `archiveCurrentSemester()` updated from sync `archiveAttendance()` to async `archiveSemester([K.ATTENDANCE])`; archive button now routes sessions to IDB. 1,235→1,236 lines
- [x] **modules/reports.html** — Added 13th tab `🗄️ Att. Archive`; new functions: `renderAttArchive()`, `toggleAttArchSem()`, `buildAttArchDetail()`, `printAttArchiveSem()`; tab reads archived sessions from IDB with lazy-load accordion, absence aggregation table, per-semester A4 print. 1,604→1,764 lines
- [x] **sw.js** — Bumped cache `dormportal-v12` → `dormportal-v13`

## Completed (2026-06-16, session 1)

- [x] **ra-portal.html, monitor-portal.html** — Added `DormDB.on(WORKERS, …)` subscription in each init so identity refreshes when workers DB changes in another tab. 604→605 / 570→571 lines
- [x] **room-reservations.html** — Added `DormDB.on(PROFILES, …)` and `DormDB.on(INSPECTIONS, …)` subscriptions so table refreshes cross-tab. 2,151→2,153 lines
- [x] **plant-requests.html** — Added `DormDB.on(MAINTENANCE_CFG, …)` subscription so rate/category changes reflect immediately. 721→722 lines
- [x] **room-inspection.html** — Canvas photo compression: new `_compressImage()` helper (max 1024px / JPEG q=0.75, ~100–150 KB vs 2–8 MB raw); `onItemPhotoChange` made async to await compression. 1,358→1,378 lines
- [x] **dorm-db.js** — IDB bumped v2→v3; new `dormkv_archive` store (never loaded at startup); `ARCHIVE_SEM_FIELD` constant; private `_arcGet/Set/Del/ReadAll` helpers; four public async methods: `archiveSemester`, `getArchivedSemesters`, `getArchiveRecords`, `restoreArchive`. 679→799 lines
- [x] **index.html** — Archive Data + View Archive buttons in menu footer; `#archiveModal` (semester picker, record-count preview, Archive & Download JSON); `#archiveViewerModal` (grouped by semester, per-key counts, ↩ Restore); Tier 2 JSON auto-download on every archive operation. 1,691→1,866 lines
- [x] **userguide.html** — "Archive Old Semesters" subsection in Getting Started (archive flow, view, restore, comparison table); v4.2 version history entry. 2,546→2,626 lines
- [x] **sw.js** — Bumped cache `dormportal-v11` → `dormportal-v12` after v4.2 deploy

## Completed (2026-06-14, session 3)

- [x] **student-profiles.html** — Print photo fix: `window.print()` now waits for blob-URL `<img>` `load` event before firing (photo was blank in every print/PDF because `#printCard` is `display:none` on screen so the browser never decoded the image). Also replaced `window.onafterprint =` assignment with `addEventListener('afterprint', ..., { once: true })` to prevent blob URL leaks on consecutive prints. 1,234 → 1,245 lines
- [x] **student-profiles.html** — Print background forced to `#fff` (`body,#printCard{background:#fff!important}` in `@media print`)
- [x] **sw.js** — Bumped cache `dormportal-v7` after student-profiles deploy
- [x] **index.html + room-reservations.html** — M365 username auto-fill: OAuth `/me` response now saves `cfg.displayName` and calls `DormDB.saveCurrentUser()` immediately on sign-in; room-reservations checks M365 identity before falling through to `window.prompt()`. 1,595→1,601 / 2,141→2,150 lines
- [x] **sw.js** — Bumped cache `dormportal-v8` after M365/room-reservations deploy
- [x] **staff-scheduling.html** — Master Schedule "+" bug: removed `slotFull = matched.length > 0` guard (was hiding "+" after first assignment) and removed single-worker-per-slot conflict check in `saveMasterEntry()`. Multiple workers (e.g. one per floor) can now be assigned to the same time slot. 1,285 → 1,280 lines
- [x] **sw.js** — Bumped cache `dormportal-v9` after Master Schedule fix

## Completed (2026-06-14, session 2)

- [x] **Serena MCP onboarding** — 6 memory files written: `mem:core`, `mem:tech_stack`, `mem:suggested_commands`, `mem:conventions`, `mem:task_completion`, `mem:data_model`
- [x] **Security — XSS fix** — `floor-plan.html`: added `escapeHtml`, escaped `s.name`/`s.id` in room grid innerHTML (no escape function existed)
- [x] **Security — XSS fix** — `utilities.html`: added `escapeHtml`, escaped `b.room`/`b.name`/`b.studentId` in billing table innerHTML
- [x] **CSS tokens** — `floor-plan.html`: replaced 11 hardcoded hex values with CSS variables (`#1e3a5f`→`var(--dp-accent)`, `#f0f4f8`→`var(--dp-bg)`, `#1565c0`→`var(--dp-blue)`, `#e67e22`→`var(--dp-orange)`, `#e0e0e0`→`var(--dp-border)`, `#aaa`/`#666`→text tokens). 509→513 lines
- [x] **sw.js** — Bumped cache `dormportal-v5` → `dormportal-v6` after deploy

## Completed (2026-06-14)

- [x] **userguide.html** — 5 new subsections: Barcode Scanner, Audit Log, Print Check Form (Inventory); Slot View, Master Schedule & Auto-Populate (Staff Scheduling). 4 existing subsections updated (Items: Side A/B field; By Location: Side grouping; Settings: Clear Room Items; Weekly: overnight chip + CSV import). TOC JS updated. 2,447 → 2,545 lines
- [x] **index.html + dorm-db.js** — M365 OneDrive auto-sync on data change merged from Ultraplan branch (1,526→1,595 / 673→676)
- [x] **Branch merge** — `claude/refine-local-plan-jkvjic` fast-forward merged to main (097cc11)

## Completed (2026-06-13, session 2)

- [x] **reports.html** — Active tab text invisible (navy-on-navy) due to CSS specificity conflict: dorm-ui.css `.tabs .tab-btn.active { color: var(--dp-accent) }` (0,3,0) beat module's (0,2,0). Fixed by switching container from `.tabs` → `.tab-bar`; dorm-ui.css handles active/hover for `.tab-bar` with no conflict
- [x] **reports, key-inventory, room-inspection, inventory, userguide** — Removed inline `#scrollTopBtn background:#1e3a5f` and `:hover{background:#2d5282}` overrides; dorm-ui.css `var(--dp-accent)` + `brightness(.9)` hover now apply
- [x] **sw.js** — Bumped cache to `dormportal-v6` (v4→CSS fix; v5→2026-06-14 M365 deploy; v6→XSS/CSS-token fixes)
- [x] **.gitignore** — Added `.serena/` and `serena/` to exclude Serena MCP project files from repo

## Completed (2026-06-13)

- [x] **dorm-ui.css** — Fixed `.page-header a` missing from nav link color/hover selectors (room-reservations gap); tab hover hardcoded `--dp-navy`/`--dp-navy-light` → `var(--dp-accent-bg)`/`var(--dp-accent)` for pill and underline tabs
- [x] **10 modules** (dorm-workers, plant-requests, incidents, staff-scheduling, attendance, student-admin, reports, inventory, key-inventory, room-inspection) — Inline `.tab-btn` hover standardised to `var(--dp-accent-bg)`/`var(--dp-accent)`; reports hover was full-navy (looked active); inventory separated combined active+hover selector; key-inventory/room-inspection added missing hover state
- [x] **floor-plan.html** — `.ftab` active/hover switched to `var(--dp-accent)`; added missing `.ftab:hover` state
- [x] **student-profiles.html** — `.nav-back`/`.nav-dorm` hardcoded `#a8c8f0` → standard `color:#fff;opacity:.82` pattern with hover restore
- [x] **floor-plan, student-profiles, utilities, room-reservations** — Removed inline `#scrollTopBtn background:#1e3a5f` override; `dorm-ui.css` `var(--dp-accent)` and `brightness(.9)` hover now apply
- [x] **index.html, ra-portal.html, monitor-portal.html** — Added `<link rel="icon">` favicon tag

## Completed (2026-06-11)

- [x] **dorm-db.js** — Random PBKDF2 salt, `hashPwd()/{hash,salt}`, `verifyPwd()`, `verifyPin()`, `getPwdHashStr()`; legacy fixed-salt compat
- [x] **index.html** — M365 backup gate before password activation; PWA manifest + SW registration + install banner
- [x] **ra-portal.html / monitor-portal.html** — `DormDB.verifyPin()` for PINs; PWA manifest + SW + install banner; M365 PKCE legacy key fallback
- [x] **staff-scheduling.html** — Slot View, overnight support, CSV import, Master Schedule tab, Auto-Populate (semester dates), `getWeekStartForDate()`; O(n²) fix in `runAutoPopulate()` (Map pre-index); overnight guard for non-overnight categories
- [x] **inventory.html** — Full inventory overhaul: barcode scanner (camera + USB), Side A/B assignment, Clear Room Items, Audit Log + snapshots, printable A4 check form, quick condition update in scanner, barcode quick-view modal (🏷️), By Location grouping by side; code-review fixes: `closeScanModal` reset, Side filter "shared" value, `COND_COLOR`/`COND_BG` constants, `sideChip()` module-level, O(n²) audit log Set fix
- [x] **sw.js** — PWA service worker: cache-first for all 20 app shell files, offline fallback, `put()` error surfaced via `.catch()`
- [x] **dorm-db.js** — `K.INV_AUDITS / dormInventoryAudits`, `getInvAudits()`, `saveInvAudits()`; removed stale `K.ROLE`
- [x] **.github/workflows/validate.yml** — 5-check CI: BF-016, script src, SW precache, manifest, K constants
- [x] **manifest.json + icons/** — PWA manifest with RA/Monitor shortcuts; 192/512/180px icons

---

## Cross-module dependency map

| DormDB key | Written by | Read by |
|------------|-----------|---------|
| `dormData` | room-reservations | reports, floor-plan, utilities, room-inspection, key-inventory, student-profiles, index.html |
| `dormHistory` | room-reservations | reports (archive tab) |
| `dormAway` | room-reservations | reports (fee collection) |
| `dormProfiles` | student-profiles | room-reservations (profile badge), floor-plan |
| `dormKeysInv` | key-inventory | reports (fee collection), index.html |
| `dormKeysAssigned` | key-inventory, room-inspection | student-profiles, index.html |
| `dormInspections` | room-inspection | room-reservations (clearance pre-fill), reports |
| `dormInventory` | inventory | index.html |
| `dormInventoryAudits` | inventory | inventory (audit log tab) |
| `dormMaintenance` | room-inspection, inventory | index.html |
| `dormWorkers` | dorm-workers | ra-portal, monitor-portal, staff-scheduling, index.html |
| `dormWorkersConfig` | staff-scheduling (scheduleCfg + masterSchedule) | staff-scheduling |
| `dormSchedule` | staff-scheduling | staff-scheduling |
| `dormSemesterCfg` | index.html | all modules with semester selects |

---

## Session workflow

1. Identify files to edit from the modules table above
2. `grep -n "TODO\|FIXME"` on the relevant file
3. For changes touching 4+ files or data model: think through all cross-module effects first
4. Apply edits via targeted str_replace (grep for uniqueness first)
5. `wc -l <file>` to verify — unexpected delta is a red flag
6. BF-016 check: `grep -n "localStorage\.\(setItem\|getItem\)" modules/*.html | grep "dorm"` — any hit is a violation
7. Commit and push to `claude/ultrathink-modular-architecture-fT9NR`

**Before every push:** run `/code-review --fix`. All CONFIRMED findings must be fixed.

**New module checklist:** DormDB key + getter/setter → create `modules/<name>.html` (dorm-db.js first script, ?back nav, DormDB.on subscriptions, init() at bottom) → index.html card `ready: true` → update this file.

**Institutional documents** (proposals, reports): deliver to `/tmp/` via `SendUserFile`. Never commit to repo.

---

## Dorm layout (Elijah Hall — default)

Floors 1–2: Rooms 101AC–106AC, 201AC–227AC  
Floor 3: Rooms 301AC–327AC  
Floor 4: Rooms 401AC–427AC  
Default 2 beds/room. Max configurable 1–4 via dropdown.

---

## Tool Routing

Route every task through the correct tool(s) before responding. Apply these rules automatically — no explicit user instruction needed.

### Serena only
- Find symbol, trace call, locate file, list directory structure
- Read or navigate code before editing

### Serena → Claude
- Summarize a module, file, or doc → Serena reads it, Claude condenses it
- Explain what a component or function does → Serena reads it, Claude explains it
- Architecture or code flow overview → Serena `get_symbols_overview`, Claude narrates it
- Debug a complex bug → Serena navigates to find the location, Claude reasons through the cause

### Claude only
- Write new code or refactor existing code → Serena for context, Claude for edits
- Answer a general question with no code anchor → Claude directly

### Hard Rules

**Chaining constraints:**
- Never chain when one tool is sufficient
- When chaining, pass only the relevant section/symbol from Serena to Claude — never the entire file raw

**Tool preference:**
- Prefer `mcp__serena__*` tools (auto-approved in settings) over `mcp__plugin_serena_serena__*`

### Fallback Behavior
- If Serena has not activated a project (LSP not running): fall back to direct file reads via the Read tool and note this limitation in the response

### New Projects
When starting a new project, copy this `## Tool Routing` section into its `CLAUDE.md` to make routing explicit and allow project-specific overrides. Project-specific CLAUDE.md files override this global config.
