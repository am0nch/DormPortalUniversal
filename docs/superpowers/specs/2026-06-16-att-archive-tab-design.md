# Archived Semesters Tab — reports.html

**Date:** 2026-06-16
**Scope:** Add a 13th tab to `modules/reports.html` that reads `dormAttendanceArchive` and presents archived attendance sessions grouped by semester with stats-first layout and per-semester print.

---

## Background

`DormDB.archiveAttendance(semLabel)` moves completed attendance sessions from `dormAttendance` → `dormAttendanceArchive` (localStorage, flat array). This has been write-only since it was built — no module reads the data back. The "Att. Archive" tab closes that gap.

---

## Data Source

`DormDB.getAttArchive()` — returns a flat array of session objects (same shape as live `dormAttendance` sessions):

```js
{
  semesterLabel,   // e.g. "1st Semester 2026"
  date,            // "YYYY-MM-DD"
  floor,           // "All" | "1,2" | "3" | "4"
  status,          // "Completed" | ...
  conductedBy,     // string
  summary: { present, absent, onLeave, total },
  records: [{ studentName, studentId, room, status }]
}
```

Only sessions with `status === 'Completed'` are shown. Sessions are grouped client-side by `semesterLabel`.

---

## Tab Placement

- Button added to `.tab-bar` immediately after the existing `📅 Attendance` button.
- Label: `🗄️ Att. Archive`
- `data-tab="att-archive"`, `onclick="switchTab('att-archive')"`
- `switchTab()` gets one new branch: `if (name === 'att-archive') renderAttArchive();`

---

## HTML Structure

```html
<button class="tab-btn" data-tab="att-archive" onclick="switchTab('att-archive')">🗄️ Att. Archive</button>
```

```html
<div id="tab-att-archive" class="tab-panel">
  <div class="tab-toolbar">
    <span style="font-size:.82rem;font-weight:700;color:#1e3a5f">Archived Attendance Sessions</span>
  </div>
  <div id="attArchBody"></div>
</div>
```

Panel inserted after `#tab-attendance` and before `#tab-incidents`.

---

## Render Logic — `renderAttArchive()`

### 1. Empty state

If archive is empty or has no completed sessions:

```
No archived attendance sessions yet.
Use the Archive Data button on the main menu to archive a semester.
```

Centered, grey, 40px padding.

### 2. Group by semester

```js
const sessions = (DormDB.getAttArchive() || []).filter(s => s.status === 'Completed');
// group by semesterLabel, sort newest-first
```

Sort order: `semLabel` descending (string compare — matches existing sort in `getArchivedSemesters()`).

### 3. Per-semester stat card

One card per semester. Each card contains:

| Element | Detail |
|---------|--------|
| Heading | Semester label (bold, navy) |
| Stat chip — Sessions | Count of completed sessions for this semester |
| Stat chip — Total Absences | Sum of `summary.absent` across sessions |
| Stat chip — ≥3 Absences | Count of students whose total absence count ≥ 3 |
| Top absentees | Up to 3 names with their absence count; computed from `records[]` |
| Toggle button | `▶ View Sessions` / `▼ Hide Sessions` |

Card styling: white background, `border-radius:8px`, `box-shadow:0 1px 4px rgba(0,0,0,.08)`, `padding:16px`, `margin-bottom:12px`.

Stat chips reuse the same inline style pattern as `renderAttendanceReport()`.

### 4. Accordion detail (hidden by default)

A `<div>` with `data-sem="${semLabel}"` and `style="display:none"` rendered directly below the card. Toggled via `toggleAttArchSem(semLabel)` which flips `display` between `none` and `block` and updates the button label.

Contents:

**Session log table** — columns: Date · Floor · Present · Absent · On Leave · Total · Conducted By. Rows sorted newest-first by `date`. Absent cell highlighted red if `> 0`.

**Absence count table** — columns: Student · Absences · Alert. Rows sorted by absence count descending. `⚠️ Follow up` alert if count ≥ 3. Row background `#fff8e1` if ≥ 3 absences (matches live Attendance tab style).

**Print button** — `🖨️ Print This Semester` at the bottom of the accordion. Calls `printAttArchiveSem(semLabel)`.

---

## Print Logic — `printAttArchiveSem(semLabel)`

1. Finds the accordion detail div via `document.querySelector('[data-sem="' + semLabel + '"]')`.
2. Opens `window.open('', '_blank')`.
3. Writes A4 print document with:
   - `@page { size: A4; margin: 12mm }`
   - Same `font-family`, table, and header styles as `printAttendanceReport()`
   - `<h1>` with semester label
   - Printed date/time line
   - Inner HTML of the accordion detail div
4. Calls `win.document.close(); win.print();`

---

## DormDB Subscription

None required. `dormAttendanceArchive` is written only by the archive flow in `index.html` and is not updated reactively while `reports.html` is open. The tab re-renders fresh on each `switchTab('att-archive')` call.

---

## Files Changed

| File | Change |
|------|--------|
| `modules/reports.html` | Add tab button, tab panel HTML, `renderAttArchive()`, `toggleAttArchSem()`, `printAttArchiveSem()`, one line in `switchTab()` |

No changes to `dorm-db.js`, `sw.js`, or any other file.

---

## Post-implementation checklist

- [ ] BF-016 check: no direct `dorm*` localStorage access added
- [ ] `wc -l modules/reports.html` — update CLAUDE.md File Stats table
- [ ] SW cache bump: `dormportal-v12` → `dormportal-v13` in `sw.js`
- [ ] Commit: `feat(reports): add Archived Semesters attendance tab`
