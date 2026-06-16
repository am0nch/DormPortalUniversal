# Archived Attendance Semesters Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 13th tab to `reports.html` that reads archived attendance sessions from IDB, while also routing all accumulating semester data (attendance, maintenance, off-campus requests, assistance log) to IDB on archive.

**Architecture:** `dorm-db.js` gains four new entries in `ARCHIVE_SEM_FIELD` and a `migrateAttArchive()` method for one-time localStorage→IDB migration of legacy data. `attendance.html` is updated to call the async IDB path. `reports.html` gains the new tab with lazy-loaded accordion detail per semester.

**Tech Stack:** Vanilla JS ES6+, localStorage + IndexedDB via DormDB API, no build tools. No test runner — verification is grep/wc-l + manual browser testing. CI runs on push via `.github/workflows/validate.yml` (5 checks).

---

## Files

| File | Change |
|------|--------|
| `dorm-db.js` | Expand `ARCHIVE_SEM_FIELD`; expand `archiveSemester()` default keyList; add `async migrateAttArchive()` |
| `modules/attendance.html` | `archiveCurrentSemester()` → async, use `archiveSemester([DormDB.KEYS.ATTENDANCE])` |
| `modules/reports.html` | Tab button + panel HTML; `switchTab()` branch; `renderAttArchive()`, `toggleAttArchSem()`, `buildAttArchDetail()`, `printAttArchiveSem()` |
| `sw.js` | Bump `dormportal-v12` → `dormportal-v13` |

---

## Task 1: Expand `ARCHIVE_SEM_FIELD` in `dorm-db.js`

**File:** `dorm-db.js`

- [ ] **Verify uniqueness of target string**

```bash
grep -c "INV_AUDITS.*dateRange.*date" /home/richmond/DormPortalUniversal/dorm-db.js
```
Expected: `1`

- [ ] **Replace `ARCHIVE_SEM_FIELD` constant**

Find this exact block (lines 201–206):
```js
  const ARCHIVE_SEM_FIELD = {
    [K.INSPECTIONS]: { type: 'field',     field: 'semester'      },
    [K.INCIDENTS]:   { type: 'field',     field: 'semesterLabel' },
    [K.HISTORY]:     { type: 'field',     field: 'semester'      },
    [K.INV_AUDITS]:  { type: 'dateRange', field: 'date'          },
  };
```

Replace with:
```js
  const ARCHIVE_SEM_FIELD = {
    [K.INSPECTIONS]:   { type: 'field',     field: 'semester'      },
    [K.INCIDENTS]:     { type: 'field',     field: 'semesterLabel' },
    [K.HISTORY]:       { type: 'field',     field: 'semester'      },
    [K.INV_AUDITS]:    { type: 'dateRange', field: 'date'          },
    [K.ATTENDANCE]:    { type: 'field',     field: 'semesterLabel' },
    [K.MAINTENANCE]:   { type: 'dateRange', field: 'createdAt'     },
    [K.OFFCAMPUS_REQ]: { type: 'dateRange', field: 'createdAt'     },
    [K.ASSISTANCE]:    { type: 'dateRange', field: 'createdAt'     },
  };
```

> **Note on `dateRange` keys:** `createdAt` is an ISO datetime string (`"2026-02-14T10:30:00.000Z"`). The existing `dateRange` filter compares `r.createdAt >= semDef.startDate && r.createdAt <= semDef.endDate` where `semDef.startDate` is a plain date string (`"2026-01-01"`). ISO datetimes sort lexicographically correctly against date strings — no change to filter logic needed. If `semDef` (the semester definition) has no `startDate`/`endDate`, those records are skipped — same behaviour as `INV_AUDITS`.

- [ ] **Expand `archiveSemester()` default keyList**

Find this line (line 724):
```js
      const keys   = keyList || [K.INSPECTIONS, K.INV_AUDITS, K.HISTORY, K.INCIDENTS];
```

Replace with:
```js
      const keys   = keyList || [K.INSPECTIONS, K.INV_AUDITS, K.HISTORY, K.INCIDENTS, K.ATTENDANCE, K.MAINTENANCE, K.OFFCAMPUS_REQ, K.ASSISTANCE];
```

- [ ] **Verify line count**

```bash
wc -l /home/richmond/DormPortalUniversal/dorm-db.js
```
Expected: `799` (no line count change — both edits are in-place replacements that keep the same number of lines; the ARCHIVE_SEM_FIELD gains 4 lines and the keyList gains characters on one line, so actual delta is +4 lines → expect `803`)

> Correction: ARCHIVE_SEM_FIELD goes from 4 entries to 8 entries (+4 lines). Line count will be 803. If delta is unexpected (e.g. ±10), investigate before continuing.

---

## Task 2: Add `migrateAttArchive()` to `dorm-db.js`

**File:** `dorm-db.js`

- [ ] **Verify uniqueness of insertion anchor**

```bash
grep -c "Expose key constants for modules" /home/richmond/DormPortalUniversal/dorm-db.js
```
Expected: `1`

- [ ] **Insert `migrateAttArchive()` before `KEYS: K`**

Find this exact block:
```js
      await _arcDel(dormKey, semLabel);
      return toAdd.length;
    },

    // Expose key constants for modules that need them
    KEYS: K,
```

Replace with:
```js
      await _arcDel(dormKey, semLabel);
      return toAdd.length;
    },

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
      _w(K.ATT_ARCHIVE, []);
      return flat.length;
    },

    // Expose key constants for modules that need them
    KEYS: K,
```

- [ ] **BF-016 check — confirm no direct dorm* localStorage access introduced**

```bash
grep -n "localStorage\.\(setItem\|getItem\)" /home/richmond/DormPortalUniversal/dorm-db.js | grep "dorm"
```
Expected: no output. (`_w` and `_r` are the internal wrappers — not direct access.)

- [ ] **Verify line count**

```bash
wc -l /home/richmond/DormPortalUniversal/dorm-db.js
```
Expected: `~819` (Task 1 added 4 lines → 803; this task adds 16 lines → 819). Any delta > ±3 from 819 is a red flag.

- [ ] **Commit**

```bash
cd /home/richmond/DormPortalUniversal
git add dorm-db.js
git commit -m "$(cat <<'EOF'
feat(db): route attendance, maintenance, off-campus, assistance to IDB archive

- ARCHIVE_SEM_FIELD: add K.ATTENDANCE (field: semesterLabel),
  K.MAINTENANCE, K.OFFCAMPUS_REQ, K.ASSISTANCE (dateRange: createdAt)
- archiveSemester() default keyList now includes all 8 archivable keys
- migrateAttArchive(): one-time migration of dormAttendanceArchive
  (localStorage) into IDB dormkv_archive, grouped by semesterLabel

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update `archiveCurrentSemester()` in `attendance.html`

**File:** `modules/attendance.html`

- [ ] **Verify uniqueness of target**

```bash
grep -c "archiveAttendance" /home/richmond/DormPortalUniversal/modules/attendance.html
```
Expected: `1`

- [ ] **Replace `archiveCurrentSemester()` body**

Find this exact block:
```js
    () => {
      const count = DormDB.archiveAttendance(label);
      sessions = DormDB.getAttendance();
      renderHistory();
      showToast('🗄️ Archived ' + count + ' session' + (count!==1?'s':''));
    }
```

Replace with:
```js
    async () => {
      const result = await DormDB.archiveSemester(label, [DormDB.KEYS.ATTENDANCE]);
      const count  = result[DormDB.KEYS.ATTENDANCE] || 0;
      sessions = DormDB.getAttendance();
      renderHistory();
      showToast('🗄️ Archived ' + count + ' session' + (count!==1?'s':''));
    }
```

> `DormDB.archiveSemester(label, [DormDB.KEYS.ATTENDANCE])` returns `{ dormAttendance: N }` where N is the count of sessions moved to IDB. `DormDB.KEYS.ATTENDANCE` = `'dormAttendance'`.

- [ ] **Verify line count**

```bash
wc -l /home/richmond/DormPortalUniversal/modules/attendance.html
```
Expected: `1236` (was 1235, +1 line for `const result =` split vs `const count =` in one line). Delta should be 0 or +1 — investigate anything else.

- [ ] **Commit**

```bash
git add modules/attendance.html
git commit -m "$(cat <<'EOF'
feat(attendance): archive sessions to IDB via archiveSemester()

Replaces DormDB.archiveAttendance() (localStorage) with async
DormDB.archiveSemester([K.ATTENDANCE]) so sessions land in the
IDB dormkv_archive store, consistent with all other archivable keys.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add tab button + panel HTML + `switchTab()` branch in `reports.html`

**File:** `modules/reports.html`

- [ ] **Verify uniqueness of tab button anchor**

```bash
grep -c "data-tab=\"attendance\"" /home/richmond/DormPortalUniversal/modules/reports.html
```
Expected: `1`

- [ ] **Insert tab button after Attendance, before Incidents**

Find:
```html
  <button class="tab-btn" data-tab="attendance" onclick="switchTab('attendance')">📅 Attendance</button>
  <button class="tab-btn" data-tab="incidents" onclick="switchTab('incidents')">🚨 Incidents</button>
```

Replace with:
```html
  <button class="tab-btn" data-tab="attendance" onclick="switchTab('attendance')">📅 Attendance</button>
  <button class="tab-btn" data-tab="att-archive" onclick="switchTab('att-archive')">🗄️ Att. Archive</button>
  <button class="tab-btn" data-tab="incidents" onclick="switchTab('incidents')">🚨 Incidents</button>
```

- [ ] **Verify uniqueness of panel anchor**

```bash
grep -c "id=\"tab-attendance\"" /home/richmond/DormPortalUniversal/modules/reports.html
```
Expected: `1`

- [ ] **Insert tab panel after attendance panel, before incidents panel**

Find:
```html
<div id="tab-incidents" class="tab-panel">
```

Replace with:
```html
<!-- ── ATT. ARCHIVE TAB ── -->
<div id="tab-att-archive" class="tab-panel">
  <div class="tab-toolbar">
    <span style="font-size:.82rem;font-weight:700;color:#1e3a5f">Archived Attendance Sessions</span>
  </div>
  <div id="attArchBody"></div>
</div>

<div id="tab-incidents" class="tab-panel">
```

- [ ] **Add `switchTab()` branch**

Find:
```js
  if (name === 'attendance') renderAttendanceReport();
  if (name === 'incidents')  renderIncidentsReport();
```

Replace with:
```js
  if (name === 'attendance') renderAttendanceReport();
  if (name === 'att-archive') renderAttArchive();
  if (name === 'incidents')  renderIncidentsReport();
```

- [ ] **Verify line count**

```bash
wc -l /home/richmond/DormPortalUniversal/modules/reports.html
```
Expected: `~1613` (was 1604; +1 tab button, +6 panel lines, +1 switchTab line = +8 net, but comment line adds 1 more → ~1613). Investigate any delta > ±3 from 1613.

---

## Task 5: Add `renderAttArchive()`, `toggleAttArchSem()`, `buildAttArchDetail()`, `printAttArchiveSem()` to `reports.html`

**File:** `modules/reports.html`

- [ ] **Verify uniqueness of insertion anchor**

```bash
grep -c "Live reload on data changes" /home/richmond/DormPortalUniversal/modules/reports.html
```
Expected: `1`

- [ ] **Insert all four functions before the live reload block**

Find:
```js
// ── Live reload on data changes ────────────────────────────────────────────
```

Replace with:
```js
// ── ARCHIVED ATTENDANCE SEMESTERS ─────────────────────────────────────────
async function renderAttArchive() {
  const el = document.getElementById('attArchBody');
  el.innerHTML = '<p style="color:#aaa;text-align:center;padding:40px">Loading…</p>';

  if ((DormDB.getAttArchive ? DormDB.getAttArchive() : []).length > 0) {
    await DormDB.migrateAttArchive();
  }

  const allEntries = await DormDB.getArchivedSemesters();
  const entries = allEntries.filter(e => e.dormKey === DormDB.KEYS.ATTENDANCE);

  if (!entries.length) {
    el.innerHTML = '<p style="color:#aaa;text-align:center;padding:40px">No archived attendance sessions yet.<br>Archive a semester from the Attendance module or use the Archive Data button on the main menu.</p>';
    return;
  }

  const seen = new Set();
  const sems = [];
  for (const e of entries) {
    if (!seen.has(e.semLabel)) { seen.add(e.semLabel); sems.push(e); }
  }

  el.innerHTML = sems.map(e => {
    const safeId = 'att-arc-detail-' + e.semLabel.replace(/\W+/g, '-');
    return `
      <div style="background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:16px;margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:.95rem;font-weight:700;color:#1e3a5f">${escapeHtml(e.semLabel)}</div>
            <div style="margin-top:6px">
              <span style="background:#e8f0fe;color:#1e3a5f;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:12px">${e.count} session${e.count!==1?'s':''}</span>
            </div>
          </div>
          <button class="btn toggle-btn" data-sem="${escapeHtml(e.semLabel)}" onclick="toggleAttArchSem(this.dataset.sem)">▶ View Sessions</button>
        </div>
        <div id="${safeId}" style="display:none;margin-top:14px"></div>
      </div>`;
  }).join('');
}

async function toggleAttArchSem(semLabel) {
  const safeId = 'att-arc-detail-' + semLabel.replace(/\W+/g, '-');
  const detail = document.getElementById(safeId);
  const btn    = detail.parentElement.querySelector('.toggle-btn');

  if (detail.dataset.loaded !== '1') {
    btn.textContent = '⏳ Loading…';
    btn.disabled = true;
    const records = await DormDB.getArchiveRecords(DormDB.KEYS.ATTENDANCE, semLabel);
    detail.innerHTML = buildAttArchDetail(semLabel, records);
    detail.dataset.loaded = '1';
    btn.disabled = false;
  }

  const open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : 'block';
  btn.textContent = open ? '▶ View Sessions' : '▼ Hide Sessions';
}

function buildAttArchDetail(semLabel, records) {
  if (!records.length) return '<p style="color:#aaa;text-align:center;padding:20px">No sessions found.</p>';

  const sorted = records.slice().sort((a, b) => b.date.localeCompare(a.date));

  const absCounts = {};
  records.forEach(s => {
    (s.records || []).filter(r => r.status === 'Absent').forEach(r => {
      const k = r.studentName || r.studentId || 'Unknown';
      absCounts[k] = (absCounts[k] || 0) + 1;
    });
  });
  const absList = Object.entries(absCounts).sort((a, b) => b[1] - a[1]);

  const sessionTable = `
    <h3 style="font-size:.85rem;font-weight:700;color:#1e3a5f;margin:0 0 8px;border-bottom:2px solid #d9e6f5;padding-bottom:6px">Session Log</h3>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead><tr style="background:#1e3a5f;color:#fff">
        <th style="padding:6px 10px;text-align:left">Date</th>
        <th style="padding:6px 10px;text-align:left">Floor</th>
        <th style="padding:6px 10px;text-align:center">Present</th>
        <th style="padding:6px 10px;text-align:center">Absent</th>
        <th style="padding:6px 10px;text-align:center">On Leave</th>
        <th style="padding:6px 10px;text-align:center">Total</th>
        <th style="padding:6px 10px;text-align:left">Conducted By</th>
      </tr></thead><tbody>
      ${sorted.map((s, i) => {
        const sm = s.summary || {};
        return `<tr style="background:${i%2?'#f8f9fa':'#fff'}">
          <td style="padding:5px 10px">${escapeHtml(s.date)}</td>
          <td style="padding:5px 10px">${escapeHtml(s.floor||'All')}</td>
          <td style="padding:5px 10px;text-align:center;color:#2e7d32;font-weight:700">${sm.present||0}</td>
          <td style="padding:5px 10px;text-align:center;color:${sm.absent?'#c62828':'#2e7d32'};font-weight:700">${sm.absent||0}</td>
          <td style="padding:5px 10px;text-align:center">${sm.onLeave||0}</td>
          <td style="padding:5px 10px;text-align:center">${sm.total||0}</td>
          <td style="padding:5px 10px">${escapeHtml(s.conductedBy||'—')}</td>
        </tr>`;
      }).join('')}
      </tbody></table></div>`;

  const absTable = absList.length ? `
    <h3 style="font-size:.85rem;font-weight:700;color:#1e3a5f;margin:16px 0 8px;border-bottom:2px solid #d9e6f5;padding-bottom:6px">Absence Count per Student</h3>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead><tr style="background:#1e3a5f;color:#fff">
        <th style="padding:6px 10px;text-align:left">Student</th>
        <th style="padding:6px 10px;text-align:center">Absences</th>
        <th style="padding:6px 10px">Alert</th>
      </tr></thead><tbody>
      ${absList.map(([name, cnt], i) => `<tr style="background:${cnt>=3?'#fff8e1':i%2?'#f8f9fa':'#fff'}">
        <td style="padding:5px 10px">${escapeHtml(name)}</td>
        <td style="padding:5px 10px;text-align:center;font-weight:700;color:${cnt>=3?'#c62828':'#333'}">${cnt}</td>
        <td style="padding:5px 10px">${cnt>=3?'⚠️ Follow up':''}</td>
      </tr>`).join('')}
      </tbody></table></div>` : '';

  const printBtn = `<div class="no-print" style="margin-top:14px;text-align:right">
    <button class="btn btn-orange" data-sem="${escapeHtml(semLabel)}" onclick="printAttArchiveSem(this.dataset.sem)">🖨️ Print This Semester</button>
  </div>`;

  return sessionTable + absTable + printBtn;
}

function printAttArchiveSem(semLabel) {
  const safeId = 'att-arc-detail-' + semLabel.replace(/\W+/g, '-');
  const detail = document.getElementById(safeId);
  if (!detail) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Attendance Archive — ${escapeHtml(semLabel)} — ${escapeHtml(DormDB.getDormName())}</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;padding:0;margin:0}
      h1{font-size:12pt;margin-bottom:2mm}
      h3{font-size:10pt;color:#1e3a5f;margin:8pt 0 3pt;border-bottom:1pt solid #1e3a5f;padding-bottom:2pt}
      table{width:100%;border-collapse:collapse;margin-bottom:8pt}
      th,td{border:1pt solid #ccc;padding:3pt 6pt;font-size:8pt}
      th{background:#1e3a5f;color:#fff;text-align:left}
      .no-print{display:none}
      @page{size:A4;margin:12mm}
    </style>
  </head><body>
    <h1>📅 Attendance Archive — ${escapeHtml(semLabel)} — ${escapeHtml(DormDB.getDormName())}</h1>
    <p style="font-size:8pt;color:#888;margin-bottom:5mm">Printed: ${new Date().toLocaleString()}</p>
    ${detail.innerHTML}
  </body></html>`);
  win.document.close();
  win.print();
}

// ── Live reload on data changes ────────────────────────────────────────────
```

- [ ] **BF-016 check**

```bash
grep -n "localStorage\.\(setItem\|getItem\)" /home/richmond/DormPortalUniversal/modules/reports.html | grep "dorm"
```
Expected: no output.

- [ ] **Verify line count**

```bash
wc -l /home/richmond/DormPortalUniversal/modules/reports.html
```
Expected: `~1730`. The four new functions add ~115 lines. Final count from Task 4 was ~1613; 1613 + 115 = ~1728. Any delta > ±5 from 1728 is a red flag.

- [ ] **Commit**

```bash
git add modules/reports.html
git commit -m "$(cat <<'EOF'
feat(reports): add Archived Attendance Semesters tab (IDB-backed)

- Tab 13: 🗄️ Att. Archive — reads dormkv_archive IDB store
- renderAttArchive(): migration gate + semester card index from IDB
- toggleAttArchSem(): lazy-loads session records per semester on expand
- buildAttArchDetail(): session log + absence count tables + print btn
- printAttArchiveSem(): per-semester A4 print via window.open()

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Bump SW cache + final checks + push

**Files:** `sw.js`, `CLAUDE.md`

- [ ] **Verify uniqueness of cache name**

```bash
grep -c "dormportal-v12" /home/richmond/DormPortalUniversal/sw.js
```
Expected: `1`

- [ ] **Bump cache name in `sw.js`**

Find:
```js
dormportal-v12
```

Replace with:
```js
dormportal-v13
```

- [ ] **Run full BF-016 check across all modules**

```bash
grep -n "localStorage\.\(setItem\|getItem\)" /home/richmond/DormPortalUniversal/modules/*.html | grep "dorm"
```
Expected: no output.

- [ ] **Verify final line counts**

```bash
wc -l /home/richmond/DormPortalUniversal/dorm-db.js \
       /home/richmond/DormPortalUniversal/modules/attendance.html \
       /home/richmond/DormPortalUniversal/modules/reports.html \
       /home/richmond/DormPortalUniversal/sw.js
```

- [ ] **Update CLAUDE.md File Stats table** with new line counts for `dorm-db.js`, `attendance.html`, `reports.html`. Also update:
  - Pending items: remove the ATT_ARCHIVE write-only bullet, mark it complete
  - Add to Completed (2026-06-16) section

- [ ] **Commit**

```bash
git add sw.js CLAUDE.md
git commit -m "$(cat <<'EOF'
chore: bump SW cache to v13, update CLAUDE.md stats

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Push**

```bash
git push
```

- [ ] **Confirm CI passes** — check `.github/workflows/validate.yml` run on GitHub. All 5 checks must be green: BF-016, script src, SW precache, manifest, K constants.

---

## Manual Test Checklist

After pushing, open the app in a browser (or serve locally via `python3 -m http.server`) and verify:

**New tab appears:**
- [ ] Reports → tab bar shows `🗄️ Att. Archive` between `📅 Attendance` and `🚨 Incidents`
- [ ] Clicking the tab activates it without JS errors in console

**Empty state:**
- [ ] If no attendance data has been archived yet, the tab shows the "No archived attendance sessions yet" message

**After archiving a semester from Attendance module:**
- [ ] Go to Attendance → Settings → enter a semester label → Archive
- [ ] Toast shows count (e.g. "Archived 3 sessions")
- [ ] Return to Reports → Att. Archive tab — semester card appears with correct session count
- [ ] Click `▶ View Sessions` — loading spinner briefly appears, then session log + absence tables render
- [ ] Button label toggles to `▼ Hide Sessions`; click again collapses
- [ ] Second expand uses cached content (no IDB fetch, instant)

**Migration (if legacy `dormAttendanceArchive` exists):**
- [ ] Open DevTools → Application → Local Storage — check if `dormAttendanceArchive` has data
- [ ] Open Att. Archive tab — migration runs silently
- [ ] After tab loads, `dormAttendanceArchive` in Local Storage should be `[]`
- [ ] IDB → dormkv (or dormkv_archive) store should have entries keyed `dormAttendance__<semLabel>`

**Print:**
- [ ] Expand a semester → click `🖨️ Print This Semester` → print preview opens with A4 layout, print button hidden

**Other tabs unaffected:**
- [ ] Switch to each existing tab — no regressions in Archive, Attendance, Incidents, Bedding tabs
