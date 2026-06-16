# Archived Semesters Tab — reports.html

**Date:** 2026-06-16 (revised — IDB path)
**Scope:** Add a 13th tab to `modules/reports.html` that reads archived attendance sessions from the IDB `dormkv_archive` store (same store used by inspections, incidents, history, and inventory audits). Also updates `dorm-db.js` and `modules/attendance.html` to route new archives to IDB instead of localStorage.

---

## Background

`DormDB.archiveAttendance(semLabel)` (called from `attendance.html`) moves completed attendance sessions from `dormAttendance` → `dormAttendanceArchive` in localStorage. This is the odd one out: every other archivable key (inspections, inventory audits, history, incidents) uses the IDB `dormkv_archive` store added in v4.2.

**Why this matters:** Each session can contain 100–200 student records. At ~15 KB/session × 30 sessions/semester, a single `dormAttendanceArchive` entry can reach 500 KB–2 MB — a real localStorage quota risk over multiple semesters.

The fix: route attendance archives to IDB, add a one-time migration for existing localStorage data, and build the report tab to read from IDB.

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

### 1. Add attendance to `ARCHIVE_SEM_FIELD`

```js
const ARCHIVE_SEM_FIELD = {
  [K.INSPECTIONS]: { type: 'field',     field: 'semester'      },
  [K.INCIDENTS]:   { type: 'field',     field: 'semesterLabel' },
  [K.HISTORY]:     { type: 'field',     field: 'semester'      },
  [K.INV_AUDITS]:  { type: 'dateRange', field: 'date'          },
  [K.ATTENDANCE]:  { type: 'field',     field: 'semesterLabel' },  // NEW
};
```

### 2. Add `K.ATTENDANCE` to `archiveSemester()` default keyList

```js
async archiveSemester(semLabel, keyList) {
  const keys = keyList || [K.INSPECTIONS, K.INV_AUDITS, K.HISTORY, K.INCIDENTS, K.ATTENDANCE];
  // ... rest unchanged
```

This means calling `DormDB.archiveSemester(semLabel)` from index.html's archive modal now also archives attendance into IDB automatically — no separate step needed.

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

The method stays unchanged. It will still function as a fallback, but `attendance.html` will no longer call it after the update below. No data inconsistency risk: if the old method is somehow called, it just writes to localStorage, which the migration in step 3 will pick up on the next report tab open.

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
| `dorm-db.js` | Add `K.ATTENDANCE` to `ARCHIVE_SEM_FIELD`; add to `archiveSemester()` default keyList; add `async migrateAttArchive()` |
| `modules/attendance.html` | `archiveCurrentSemester()` → async, use `archiveSemester([K.ATTENDANCE])` |
| `modules/reports.html` | Tab button + panel; `renderAttArchive()`, `toggleAttArchSem()`, `buildAttArchDetail()`, `printAttArchiveSem()`; one line in `switchTab()` |
| `sw.js` | Bump `dormportal-v12` → `dormportal-v13` |

No changes to `index.html`, `dorm-ui.css`, or `manifest.json`.

---

## Post-implementation checklist

- [ ] BF-016 check: no direct `dorm*` localStorage access added (migration write via `_w` is inside dorm-db.js — OK)
- [ ] `wc -l` all changed files — update CLAUDE.md File Stats table
- [ ] SW cache bump: `dormportal-v12` → `dormportal-v13` in `sw.js`
- [ ] Commit: `feat(reports): add Archived Attendance Semesters tab (IDB-backed)`
