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
| `modules/reports.html` | 12-tab report hub — all reports are print/PDF only, no SheetJS |
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

## File stats (2026-06-13)

| File | Lines |
|------|-------|
| `index.html` | 1,526 |
| `dorm-db.js` | 673 |
| `modules/room-reservations.html` | 2,141 |
| `modules/student-profiles.html` | 1,234 |
| `modules/floor-plan.html` | 509 |
| `modules/utilities.html` | 683 |
| `modules/reports.html` | 1,603 |
| `modules/room-inspection.html` | 1,335 |
| `modules/key-inventory.html` | 1,586 |
| `modules/inventory.html` | 2,517 |
| `modules/attendance.html` | 1,234 |
| `modules/incidents.html` | 991 |
| `modules/student-admin.html` | 1,013 |
| `modules/dorm-workers.html` | 758 |
| `modules/staff-scheduling.html` | 1,285 |
| `modules/plant-requests.html` | 720 |
| `modules/ra-portal.html` | 603 |
| `modules/monitor-portal.html` | 569 |
| `modules/userguide.html` | 2,545 |
| `modules/handbook.html` | 1,874 |

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

- [ ] `userguide.html` needs updating: semester rollover UI, Alumni view, Away Students tab, archive restore flow
- [ ] ATT_ARCHIVE is write-only — no module reads `dormAttendanceArchive` back; future: Archived Semesters section in reports.html
- [ ] GitHub Pages enabled ✅ — SW cache must be bumped (`dormportal-vN`) after every deploy that touches HTML/JS
- [ ] Cross-module dep map: add `dormSchedule`, `dormWorkersConfig.masterSchedule`, `dormInventoryAudits`

## Completed (2026-06-13, session 2)

- [x] **reports.html** — Active tab text invisible (navy-on-navy) due to CSS specificity conflict: dorm-ui.css `.tabs .tab-btn.active { color: var(--dp-accent) }` (0,3,0) beat module's (0,2,0). Fixed by switching container from `.tabs` → `.tab-bar`; dorm-ui.css handles active/hover for `.tab-bar` with no conflict
- [x] **reports, key-inventory, room-inspection, inventory, userguide** — Removed inline `#scrollTopBtn background:#1e3a5f` and `:hover{background:#2d5282}` overrides; dorm-ui.css `var(--dp-accent)` + `brightness(.9)` hover now apply
- [x] **sw.js** — Bumped cache to `dormportal-v4` to evict stale HTML on all devices after CSS fix commits
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
