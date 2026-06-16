# Archived Semesters Tab — reports.html

**Date:** 2026-06-16 (revised v2 — IDB for all accumulating keys)
**Scope:** Add a 13th tab to `modules/reports.html` that reads archived attendance sessions from the IDB `dormkv_archive` store. Also routes ALL accumulating semester data to IDB — adding `K.ATTENDANCE`, `K.MAINTENANCE`, `K.OFFCAMPUS_REQ`, and `K.ASSISTANCE` to `ARCHIVE_SEM_FIELD` and the `archiveSemester()` default keyList.

---

## Background

The IDB `dormkv_archive` store (added in v4.2) currently covers four keys: `dormInspections`, `dormIncidents`, `dormHistory`, `dormInventoryAudits`. Three accumulating keys were left out and have no archive mechanism at all:

| Key | Module | Field shape |
|-----|--------|-------------|
| `dormAttendance` | attendance.html | `semesterLabel` + nested `records[]` per session |
| `dormMaintenance` | plant-requests.html | `createdAt` ISO date |
| `dormOffCampusReq` | student-admin.html | `createdAt` ISO date |
| `dormAssistance` | student-admin.html | `createdAt` ISO date |

**Why this matters:** Attendance is the most urgent — each session contains 100–200 student records (~15 KB/session × 30 sessions/semester = up to 2 MB in a single localStorage key). The other three are smaller individually but will accumulate indefinitely. Routing all four to IDB now prevents future quota issues and makes the archive system complete.

`dormAttendance` additionally has a separate legacy localStorage key (`dormAttendanceArchive`) written by `DormDB.archiveAttendance()` — a one-time migration is needed to move existing data to IDB.

The fix: add all four keys to `ARCHIVE_SEM_FIELD`, expand the `archiveSemester()` default keyList, migrate legacy attendance data, update `attendance.html` to use the async IDB path, and build the report tab.

---

## Data Flow (new)

```
attendance.html                    dorm-db.js                      IDB dormkv_archive
archiveCurrentSemester()
  → await archiveSemester(        ← reads dormAttendance (live)
      semLabel,                     filters by semesterLabel
      [K.ATTENDANCE]                writes to IDB key:
    )                               "dormAttendance__${semLabel}"
```

On first open of the Att. Archive tab in reports.html, a one-time migration moves any existing `dormAttendanceArchive` (localStorage) data into IDB, then clears the localStorage key.

---

## Changes — `dorm-db.js`

### 1. Expand `ARCHIVE_SEM_FIELD`

Add the four new keys. `ATTENDANCE` uses `type: 'field'` (exact `semesterLabel` match). The other three use `type: 'dateRange'` with `field: 'createdAt'` — they require `semDef.startDate`/`semDef.endDate` to be set in the semester registry, same as `INV_AUDITS`.

```js
const ARCHIVE_SEM_FIELD = {
  [K.INSPECTIONS]:   { type: 'field',     field: 'semester'      },
  [K.INCIDENTS]:     { type: 'field',     field: 'semesterLabel' },
  [K.HISTORY]:       { type: 'field',     field: 'semester'      },
  [K.INV_AUDITS]:    { type: 'dateRange', field: 'date'          },
  [K.ATTENDANCE]:    { type: 'field',     field: 'semesterLabel' },  // NEW
  [K.MAINTENANCE]:   { type: 'dateRange', field: 'createdAt'     },  // NEW
  [K.OFFCAMPUS_REQ]: { type: 'dateRange', field: 'createdAt'     },  // NEW
  [K.ASSISTANCE]:    { type: 'dateRange', field: 'createdAt'     },  // NEW
};
```

**Note on `dateRange` keys:** `createdAt` is an ISO datetime string (`"2026-02-14T10:30:00.000Z"`). The existing `dateRange` filter in `archiveSemester()` compares `r[field] >= semDef.startDate && r[field] <= semDef.endDate`. Since `semDef.startDate`/`endDate` are date strings (`"2026-01-01"`), the ISO prefix comparison works correctly (ISO datetime strings sort lexicographically). No change needed to the filter logic.

### 2. Expand `archiveSemester()` default keyList

```js
async archiveSemester(semLabel, keyList) {
  const keys = keyList || [
    K.INSPECTIONS, K.INV_AUDITS, K.HISTORY, K.INCIDENTS,
    K.ATTENDANCE, K.MAINTENANCE, K.OFFCAMPUS_REQ, K.ASSISTANCE,  // NEW
  ];
  // ... rest unchanged
```

Calling `DormDB.archiveSemester(semLabel)` from index.html's archive modal now archives all eight key types into IDB automatically. The archive modal's count preview will show counts for the four new keys when they have matching records — no change needed to the modal UI itself.

### 3. Add `async migrateAttArchive()` method

One-time migration from localStorage → IDB. Called by the report tab on first render if legacy data exists.

```js
async migrateAttArchive() {
  const flat = _r(K.ATT_ARCHIVE, []);
  if (!flat.length) return 0;
  const bySem = {};
  flat.forEach(s => {
    const k = s.semesterLabel || 'Unknown';
    if (!bySem[k]) bySem[k] = [];
    bySem[k].push(s);
  });
  for (const [semLabel, records] of Object.entries(bySem)) {
    const existing = await _arcGet(K.ATTENDANCE, semLabel);
    const merged   = existing ? [...existing.records, ...records] : records;
    await _arcSet(K.ATTENDANCE, semLabel, {
      dormKey: K.ATTENDANCE, semLabel,
      records: merged,
      archivedAt: new Date().toISOString(),
      count: merged.length,
    });
  }
  _w(K.ATT_ARCHIVE, []);   // clear localStorage entry
  return flat.length;
},
```

### 4. Keep `archiveAttendance()` — no change needed

The method stays unchanged as a fallback. `attendance.html` will no longer call it after the update below. If it is ever called (e.g. from older cached code), it writes to `dormAttendanceArchive` in localStorage, which the migration gate in `renderAttArchive()` will pick up on the next report tab open.

### 5. No migration needed for `MAINTENANCE`, `OFFCAMPUS_REQ`, `ASSISTANCE`

These keys have never had a separate archive key — their data simply lives in the live localStorage key indefinitely. No migration step needed: on the user's next `archiveSemester()` call (via index.html archive modal), records matching the semester date range will be moved to IDB. Records from semesters with no date range defined in the registry stay in live localStorage until the user defines dates and re-archives.

---

## Changes — `modules/attendance.html`

`archiveCurrentSemester()` (line ~1037) currently calls `DormDB.archiveAttendance(label)` synchronously. Update to use the async IDB path:

**Before:**
```js
function archiveCurrentSemester() {
  const label = document.getElementById('archiveSemLabel').value.trim();
  if (!label) { showToast('⚠️ Enter a semester label first'); return; }
  askConfirm(
    `Archive all sessions labelled "${label}"? ...`,
    () => {
      const count = DormDB.archiveAttendance(label);
      sessions = DormDB.getAttendance();
      renderHistory();
      showToast('🗄️ Archived ' + count + ' session' + (count!==1?'s':''));
    }
  );
}
```

**After:**
```js
function archiveCurrentSemester() {
  const label = document.getElementById('archiveSemLabel').value.trim();
  if (!label) { showToast('⚠️ Enter a semester label first'); return; }
  askConfirm(
    `Archive all sessions labelled "${label}"? ...`,
    async () => {
      const result = await DormDB.archiveSemester(label, [DormDB.KEYS.ATTENDANCE]);
      const count  = result[DormDB.KEYS.ATTENDANCE] || 0;
      sessions = DormDB.getAttendance();
      renderHistory();
      showToast('🗄️ Archived ' + count + ' session' + (count!==1?'s':''));
    }
  );
}
```

---

## Changes — `modules/reports.html`

### Tab button

Added after `📅 Attendance`, before `🚨 Incidents`:

```html
<button class="tab-btn" data-tab="att-archive" onclick="switchTab('att-archive')">🗄️ Att. Archive</button>
```

### Tab panel

Inserted after `#tab-attendance`, before `#tab-incidents`:

```html
<div id="tab-att-archive" class="tab-panel">
  <div class="tab-toolbar">
    <span style="font-size:.82rem;font-weight:700;color:#1e3a5f">Archived Attendance Sessions</span>
  </div>
  <div id="attArchBody"></div>
</div>
```

### `switchTab()` addition

```js
if (name === 'att-archive') renderAttArchive();
```

### `async renderAttArchive()`

1. **Migration gate** — if `DormDB.getAttArchive().length > 0`, call `await DormDB.migrateAttArchive()` silently.
2. **Load index** — `const index = await DormDB.getArchivedSemesters()` filtered to `entry.dormKey === DormDB.KEYS.ATTENDANCE`.
3. **Empty state** — if no entries, render: *"No archived attendance sessions yet. Archive a semester from the Attendance module or use the Archive Data button on the main menu."*
4. **Semester stat cards** — one card per unique `semLabel` (sorted newest-first). Each card shows:
   - Semester label (bold, navy heading)
   - Stat chip: Sessions (from `entry.count`)
   - `▶ View Sessions` toggle button
   - Placeholder div `<div id="att-arc-detail-${safeSemId}" data-sem="${semLabel}" style="display:none"></div>`

   Note: session-level stats (total absences, top absentees) are computed lazily on first expand — not upfront — because loading all records for all semesters at once is expensive.

5. **Stat counts on cards** — `entry.count` (total sessions) is available from the index without loading records. Total absences and top absentees are shown only inside the expanded accordion, not on the card.

### `async toggleAttArchSem(semLabel)`

Called by the `▶ View Sessions` button. Uses a `data-loaded` attribute to avoid re-fetching:

```js
async function toggleAttArchSem(semLabel) {
  const id     = 'att-arc-detail-' + semLabel.replace(/\W+/g, '-');
  const detail = document.getElementById(id);
  const btn    = detail.previousElementSibling.querySelector('.toggle-btn');

  if (detail.dataset.loaded !== '1') {
    btn.textContent = '⏳ Loading…';
    const records = await DormDB.getArchiveRecords(DormDB.KEYS.ATTENDANCE, semLabel);
    detail.innerHTML = buildAttArchDetail(semLabel, records);
    detail.dataset.loaded = '1';
  }

  const open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : 'block';
  btn.textContent = open ? '▶ View Sessions' : '▼ Hide Sessions';
}
```

### `buildAttArchDetail(semLabel, records)`

Pure function (sync). Receives the session records array, returns HTML string:

- **Session log table** — Date · Floor · Present · Absent · On Leave · Total · Conducted By. Sorted newest-first. Absent cell red if `> 0`.
- **Absence count table** — aggregated from `session.records` where `status === 'Absent'`. Columns: Student · Absences · Alert (⚠️ if ≥ 3). Row background `#fff8e1` if ≥ 3. Sorted by count descending.
- **Print button** — `🖨️ Print This Semester` calls `printAttArchiveSem(semLabel)`.

### `printAttArchiveSem(semLabel)`

Sync — by the time print is reachable the accordion is already rendered.

1. Finds detail div by `id` (`att-arc-detail-${semLabel.replace(/\W+/g, '-')}`).
2. Opens `window.open('', '_blank')`.
3. Writes A4 print document — same style as `printAttendanceReport()`:
   - `@page { size: A4; margin: 12mm }`
   - Navy `<th>` headers, `font-family: Segoe UI`
   - `<h1>` with semester label + dorm name
   - Printed date line
   - Inner HTML of the detail div (minus the print button itself — filtered via `no-print` class on the button)

---

## Files Changed

| File | Change |
|------|--------|
| `dorm-db.js` | Add `K.ATTENDANCE`, `K.MAINTENANCE`, `K.OFFCAMPUS_REQ`, `K.ASSISTANCE` to `ARCHIVE_SEM_FIELD`; expand `archiveSemester()` default keyList; add `async migrateAttArchive()` |
| `modules/attendance.html` | `archiveCurrentSemester()` → async, use `archiveSemester([K.ATTENDANCE])` |
| `modules/reports.html` | Tab button + panel; `renderAttArchive()`, `toggleAttArchSem()`, `buildAttArchDetail()`, `printAttArchiveSem()`; one line in `switchTab()` |
| `sw.js` | Bump `dormportal-v12` → `dormportal-v13` |

No changes to `index.html`, `dorm-ui.css`, or `manifest.json`. The archive viewer modal in index.html (`#archiveViewerModal`) will automatically show the new key types once data exists — it reads `getArchivedSemesters()` which returns all IDB archive entries regardless of key type.

---

## Post-implementation checklist

- [ ] BF-016 check: no direct `dorm*` localStorage access added (migration write via `_w` is inside dorm-db.js — OK)
- [ ] `wc -l` all changed files — update CLAUDE.md File Stats table
- [ ] SW cache bump: `dormportal-v12` → `dormportal-v13` in `sw.js`
- [ ] Commit: `feat(reports): add Archived Attendance Semesters tab (IDB-backed)`
