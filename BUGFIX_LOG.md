# Bug Fix Log — DormPortalUniversal v4

> **How to add an entry:** Copy the template below. Assign the next sequential BF-NNN ID. Insert at the **top** of the log so the most recent fix is always first.

---

## Template

```
### BF-XXX — [Short descriptive title]
**Date:** YYYY-MM-DD · **Severity:** Critical / High / Medium / Low · **File(s):** `path/to/file`

**Symptom:** What the dean/RA observes in the UI or in exported data.

**Root cause:** What was wrong in the code — function name, logic error, missing call.

**Fix:** What was changed and why it resolves the issue.
```

**Severity scale:**
| Level | Meaning |
|---|---|
| Critical | Silent data corruption or permanent data loss |
| High | Wrong output or calculation; key feature non-functional |
| Medium | Partial feature break; wrong UI state; workflow disruption |
| Low | Cosmetic or edge-case UX issue |

---

## Log

---

### BF-019 — Dorm selector not re-synced after backup restore
**Date:** 2026-06-02 · **Severity:** High · **File:** `index.html`

**Symptom:** After restoring a backup, the header correctly shows the restored dorm name, but the `<select>` dropdown still shows the pre-restore selection. The first time the dean touches the selector (even just to look), `updateMenuDorm()` fires and writes the stale pre-restore value back to `localStorage`, silently overwriting the just-restored dorm name.

**Root cause:** `restoreAll()` called `updateHeader()` after `importAll()`, which correctly reads the restored `dormNameSelect` from `localStorage` to update the header text — but it never updated the `<select>` DOM element's `.value` property, which is read by `updateMenuDorm()`.

**Fix:** Added explicit dropdown re-sync in `restoreAll()` after `importAll()` completes: reads `dormNameSelect`/`dormNameCustom` from localStorage and sets both the `<select>` value and the custom-name field visibility/value to match.

---

### BF-018 — Cleared keys during restore not broadcast to other tabs
**Date:** 2026-06-02 · **Severity:** Medium · **File:** `dorm-db.js`

**Symptom:** When restoring a backup in one browser tab while another module tab is open, any module whose `localStorage` key was cleared (because the key was absent from the old backup) does not update. The other tab continues showing stale data for the rest of the session.

**Root cause:** The new pre-clear loop in `importAll()` called `localStorage.removeItem(v)` directly without calling `_broadcast(v)`. Keys that were written via `_w()` were correctly broadcast to subscribers; cleared keys were not.

**Fix:** Added `_broadcast(v)` immediately after each `localStorage.removeItem(v)` in the pre-clear loop, so all `DormDB.on()` subscribers receive notification that those keys are now empty.

---

### BF-017 — Backup restore was an overlay, not a snapshot
**Date:** 2026-06-02 · **Severity:** Critical · **File:** `dorm-db.js`

**Symptom:** Restoring an older backup left data for newer modules (e.g., `dormKeysAssigned`, `dormInspections`, `dormInventory`) untouched in `localStorage`. After restore, Room Reservations showed students from the backup date, but Key Inventory showed current key assignments, creating a mixed-timeline data state with no indication anything was wrong.

**Root cause:** `importAll()` only iterated over the entries present in the dump and wrote them. It never cleared `localStorage` keys that existed on the current system but were absent from the backup (typically keys introduced in newer sessions that postdated the backup).

**Fix:** Added a pre-clear loop before the write loop: for every key in the `K` constants object, if the key is absent from the dump, `localStorage.removeItem(v)` is called first. Also added `clear()` of the IndexedDB `photos` object store before restoring photos, preventing orphaned photo blobs from persisting after a restore.

---

### BF-016 — Cross-tab sync broken for shared settings
**Date:** 2026-06-01 · **Severity:** Medium · **File:** `modules/room-reservations.html`, `modules/student-profiles.html`

**Symptom:** Changing the dorm name, max occupants, or column visibility in one tab was not reflected in another open tab because the `DormDB.on()` subscription mechanism was never triggered.

**Root cause:** Approximately 15 calls in `room-reservations.html` and 2 in `student-profiles.html` were writing shared settings directly via `localStorage.setItem()` instead of through `DormDB` setter methods. Direct `localStorage` writes bypass the `_broadcast()` call inside `_w()`.

**Fix:** All direct `localStorage` calls for shared settings routed through the `DormDB` setter methods (`saveDormName`, `saveMaxOcc`, `saveCols`, `saveFloor`, etc.) which were added to `dorm-db.js` for this purpose.

---

### BF-015 — `lowStock` menu stat counted non-consumable items
**Date:** 2026-05-31 · **Severity:** Low · **File:** `dorm-db.js`

**Symptom:** The Inventory module card on the main menu showed a "low stock" count for furniture and fixtures (beds, desks, chairs) that had `qty <= reorderAt`, even though low-stock tracking is only meaningful for consumables (light bulbs, cleaning supplies, etc.).

**Root cause:** The `lowStock` filter in `getMenuStats()` checked `i.qty <= (i.reorderAt || 0)` without requiring `i.isConsumable === true`, so any item with a small quantity relative to its reorder threshold triggered the warning.

**Fix:** Added `&& i.isConsumable` to the filter condition. Non-consumable items are never flagged as low stock regardless of quantity.

---

### BF-014 — Hot water billing double-counts rooms with AC suffix
**Date:** 2026-05-30 · **Severity:** High · **File:** `modules/utilities.html`

**Symptom:** For rooms named with an `AC` suffix (e.g., `426AC`), the hot water billing tab showed two billing rows — one for `426AC` and one for `426` — and both occupants were charged for both rows. Students in AC-suffix rooms were effectively billed twice for hot water.

**Root cause:** `buildRows()` matched hot water bathroom pairings by exact room string. The floor-plan config stored pairings using the base room number (e.g., `426`) but `dormData` stored the room as `426AC`. The lookup failed to match, so no deduplication occurred and both variants were billed independently.

**Fix:** Added `getStudentSlotsFlexible()` which normalises room strings by stripping the `AC` suffix before matching. Rewrote the hot water section using `hwOcc()` and a `coveredBases` Set to track already-processed base room numbers and skip duplicates.

---

### BF-013 — Export All Data silently fails in Firefox
**Date:** 2026-05-30 · **Severity:** High · **File:** `index.html`

**Symptom:** Clicking "Export All Data" in Firefox produced no download — the button appeared to work (no error shown) but no file was saved.

**Root cause:** The export function created an `<a>` element, set `href` and `download`, then called `.click()` without ever appending the element to the DOM. Chrome tolerates this; Firefox requires the element to be in the document before a programmatic click triggers a download.

**Fix:** Added `document.body.appendChild(a)` before `a.click()` and `document.body.removeChild(a)` immediately after, with a 60-second `setTimeout` to revoke the object URL.

---

### BF-012 — `importAll()` double-encodes plain string settings
**Date:** 2026-05-30 · **Severity:** High · **File:** `dorm-db.js`

**Symptom:** After restoring a backup, settings that are stored as plain strings (dorm name, username, last-save timestamp) were restored as JSON-encoded strings — e.g., `dormUserName` became `'"Richmond"'` instead of `'Richmond'`. Modules that read these via `localStorage.getItem()` directly received the extra quotes, breaking display and comparisons.

**Root cause:** `importAll()` restored all keys using `_w(k, v)`, which calls `JSON.stringify(val)` before writing. For values that were originally plain strings (written via raw `localStorage.setItem`), this added an extra layer of JSON encoding.

**Fix:** Added a type check in `importAll()`: if the value from the dump is already a `string`, restore it via `localStorage.setItem(k, v)` directly; otherwise use `_w(k, v)`.

---

### BF-011 — `exportAll()` crashes on plain string localStorage values
**Date:** 2026-05-30 · **Severity:** High · **File:** `dorm-db.js`

**Symptom:** Clicking "Export All Data" threw a JavaScript error and produced no download. The error occurred because `dormUserName` (and similar settings) were stored as plain strings, not JSON.

**Root cause:** `exportAll()` read every managed `localStorage` key and called `JSON.parse(val)` unconditionally. Plain strings like `Richmond` are not valid JSON, so `JSON.parse` threw a `SyntaxError` that aborted the entire export.

**Fix:** Wrapped each `JSON.parse` call in a `try/catch` per key. On parse failure, the raw string value is stored directly in the dump object. This allows mixed JSON and plain-string values to coexist in the same backup.

---

### BF-010 — New Inspection modal form fields overlapping and unclickable
**Date:** 2026-05-30 · **Severity:** High · **File:** `modules/room-inspection.html`

**Symptom:** When opening the "New Inspection" modal, the Room, Type, Date, and Semester fields overlapped each other and could not be clicked or focused. The modal was effectively unusable for creating new inspections.

**Root cause:** The form row used a CSS flexbox layout (`display:flex`) without specifying `flex-direction:column` and `align-items:stretch` on each `.fg` field container. The fields collapsed and overlapped when the flex container had insufficient width.

**Fix:** Added `flex-direction:column; align-items:stretch` to each `.fg` div in the modal's flex row, forcing each field to render as a full-width stacked block.

---

### BF-009 — Side assignment dropdowns allowed duplicate side selection
**Date:** 2026-05-30 · **Severity:** Medium · **File:** `modules/room-inspection.html`

**Symptom:** In a two-occupant inspection, both Occupant 1 and Occupant 2 could be assigned to the same side (e.g., both set to "Side A"), making it impossible to enter Side B data and causing charge calculations to apply Side A items to both students.

**Root cause:** The side-assignment `<select>` dropdowns for each occupant had no mutual-exclusivity logic. Each rendered independently with the full list of options.

**Fix:** Added `syncSideDropdowns()`, which iterates all occupant dropdowns and disables the option that has already been selected by another occupant. Called on every side-change event and after `populateOccupants()` completes.

---

### BF-008 — Shared charge per-person split used wrong divisor
**Date:** 2026-05-30 · **Severity:** High · **File:** `modules/room-inspection.html`

**Symptom:** The per-person amount shown for shared charges (e.g., bathroom fixtures, door) was wrong whenever an occupant had been marked away or removed after the inspection was created. The per-person line showed a higher amount than expected.

**Root cause:** `renderCharges()` calculated the per-person split by dividing the charge amount by the live occupant count read from the DOM at render time. If the number of visible occupants changed (e.g., one was removed), the divisor changed without the charge record being updated.

**Fix:** Changed `renderCharges()` to use `c.splitBy` — the occupant count frozen at the time the charge was generated — as the divisor. The split is now stable regardless of subsequent UI changes.

---

### BF-007 — Maintenance stubs never counted in menu stats
**Date:** 2026-05-30 · **Severity:** Medium · **File:** `modules/room-inspection.html`, `dorm-db.js`

**Symptom:** The Maintenance module card on the main menu always showed 0 open items even after move-out inspections generated maintenance stubs for damaged or missing items.

**Root cause:** `pushMaintenanceStubs()` wrote stub records with `status: 'open'` (lowercase). `getMenuStats()` filtered with `m.status === 'Open'` (Title case). The case mismatch meant no stubs were ever counted.

**Fix:** Changed `pushMaintenanceStubs()` to write `status: 'Open'` to match the canonical form used throughout `getMenuStats()` and the future Maintenance module.

---

### BF-006 — Edit Charges modal allowed silent bathroom cost override
**Date:** 2026-05-30 · **Severity:** Medium · **File:** `modules/room-inspection.html`

**Symptom:** When opening the Edit Charges modal after saving an inspection, the bathroom cost appeared as a regular editable line item alongside other charges. Editing it there did not update the `ec_bathCost` input that controls the actual bathroom charge calculation, causing a silent discrepancy between the displayed total and the saved total.

**Root cause:** The Edit Charges modal rendered all charge categories including bathroom as individual editable rows. The bathroom section is specifically controlled by `ec_bathCost` (a single cost input) and should not be broken out as individual line items.

**Fix:** Removed bathroom from the editable line-items list in the Edit Charges modal. `ec_bathCost` is now the sole control for bathroom charges, preventing silent overrides.

---

### BF-005 — AC Unit item not defaulting to N/A for non-AC rooms
**Date:** 2026-05-30 · **Severity:** Low · **File:** `modules/room-inspection.html`

**Symptom:** When creating a move-in or move-out inspection for a non-AC room (room name without `AC` suffix), the "AC Unit" checklist item defaulted to "Good" condition. The dean had to manually set it to N/A for every non-AC room to avoid generating incorrect charges.

**Root cause:** `buildItemGrids()` initialised all items with the default condition regardless of room type, with no check against the room name.

**Fix:** Added an AC-suffix check in `buildItemGrids()`: if the room name does not match `/AC/i`, the AC Unit item is pre-set to condition N/A and disabled.

---

### BF-004 — Printed inspection sheet showed Side A charges on both sides
**Date:** 2026-05-30 · **Severity:** Critical · **File:** `modules/room-inspection.html`

**Symptom:** The printed A4 inspection sheet showed identical charge line items for both Side A and Side B columns. A student in Side B who had no damage charges still appeared on the print with Side A's charges billed to them.

**Root cause:** The `itemRows()` helper inside `printInspectionSheet()` received the global `charges` array rather than a section-specific subset. Both the Side A and Side B columns called `itemRows(charges)` with the same full array.

**Fix:** Changed `printInspectionSheet()` to pass the section-specific charge array to `itemRows()` for each column: `itemRows(charges.sideA)` and `itemRows(charges.sideB)` respectively.

---

### BF-003 — `failedInspections` menu stat always showed zero
**Date:** 2026-05-30 · **Severity:** Medium · **File:** `dorm-db.js`

**Symptom:** The Room Inspection card on the main menu never showed the "N with charges" pill, even after multiple move-out inspections had been saved with damage charges.

**Root cause:** `getMenuStats()` computed `failedInspections` using a placeholder: `r.result === 'Fail'`. The `result` field was never actually written to inspection records — the module stores charges as arrays, not a pass/fail flag.

**Fix:** Replaced the placeholder with the correct logic: sum all charge amounts across `sideA`, `sideB`, `shared`, and `bathroom` arrays for each move-out inspection record, and count records where the total exceeds zero.

---

### BF-002 — Profile badge lookup used wrong student ID field priority
**Date:** 2026-05-30 · **Severity:** Medium · **File:** `modules/room-reservations.html`

**Symptom:** The "👤 Profile" badge in the Name column of Room Reservations sometimes failed to appear for students who had a matching profile, even when the student had a Student ID entered. The badge appeared inconsistently depending on how the student record was created.

**Root cause:** `_hasProfile()` checked `s.clearance.studentId` (the clearance-form copy of the ID) before `s.studentId` (the top-level canonical ID field added in session 6). If the top-level field was populated but the clearance field was blank, the lookup fell through to name-matching, which could fail on minor name formatting differences.

**Fix:** Reordered the lookup chain: check `s.studentId` first, then fall back to `s.clearance.studentId`, then fall back to name matching.

---

### BF-001 — Columns panel appeared in wrong position when page was scrolled
**Date:** 2026-05-30 · **Severity:** Low · **File:** `modules/room-reservations.html`

**Symptom:** Clicking the "Columns ▾" button while scrolled down the page caused the column visibility panel to appear far below the button — the further the page was scrolled, the further off the panel appeared.

**Root cause:** The panel used `position: fixed` (viewport-relative coordinates) but calculated its `top` position using `getBoundingClientRect().bottom + window.scrollY`. Adding `window.scrollY` to a `fixed`-position element's top coordinate double-counts the scroll offset.

**Fix:** Removed `+ window.scrollY` from the top calculation. `position: fixed` elements need only the `getBoundingClientRect()` value, which already returns viewport-relative coordinates.

---

*Last updated: 2026-06-02 — 19 entries*
