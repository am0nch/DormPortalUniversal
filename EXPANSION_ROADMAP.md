# DormPortalUniversal — Expansion Roadmap v3
**Revised with APIU Handbook policy grounding + BUGFIX_LOG pattern analysis**
*2026-06-03 · Covers Sessions 27–34*

---

## Context

DormPortalUniversal v4 has 10 working modules covering the physical/operational side of dorm management. The next expansion builds the **behavioral and human management layer**. Three inputs shape this plan:

1. **SARRA2 overlap** — Campus Leave, Citizenship Points, Program Attendance, and SWP hours/credits already live in SARRA2. DormPortalUniversal integrates at three defined seams rather than duplicating.
2. **APIU Handbook policies** — Specific curfew times, fines, procedures, and eligibility rules from the 2017 handbook must be pre-configured as defaults, not invented.
3. **BUGFIX_LOG patterns** — 19 documented bugs reveal recurring failure modes to avoid in every new module.

---

## SARRA2 Integration Seams

DormPortalUniversal is the **dorm operations layer**. SARRA2 is the **campus student affairs layer**. Data flows one way — DormPortalUniversal generates structured exports that SARRA2 operators import manually. No API coupling (browser-only constraint).

| Feature | Owned by | DormPortalUniversal role |
|---------|----------|--------------------------|
| Campus leave request & approval | SARRA2 | Import approved leave list (CSV snapshot) → pre-populate attendance |
| Citizenship Points ledger | SARRA2 | Document incident → export CSV for SARRA2 point deduction |
| Program/event attendance | SARRA2 | Not built here |
| SWP work hours & fee credits | SARRA2 | Assignment tracking + SARRA2 ID cross-reference only |
| Nightly bed checks | DormPortalUniversal | Full module |
| Curfew rules & violations | DormPortalUniversal | Full module |
| Physical incident reports | DormPortalUniversal | Full module; exports to SARRA2 on demand |
| Dorm worker HR (RAs, Monitors, Janitors) | DormPortalUniversal | Full module |
| Dean's case log | DormPortalUniversal | Full module |
| Off-campus move requests | DormPortalUniversal | Full module; integrates with Room Reservations clearance |
| Maintenance / plant requests | DormPortalUniversal | Full module (completes existing coming-soon card) |

---

## APIU Handbook Policy Grounding

Every new module must pre-configure these verified APIU policy values as defaults:

| Policy | Value | Used in module |
|--------|-------|----------------|
| Curfew time — Sun through Fri | **22:00** | Attendance (curfew config default) |
| Curfew time — Saturday | **23:00** | Attendance (curfew config default) |
| Nightly check starts | **15 minutes after closing** | Attendance (grace period default = 15 min) |
| Outside doors lock until | **05:00** | Attendance (info display) |
| Unauthorized room change fine | **1,000 Baht** | Incidents (pre-configured fine suggestion) |
| Improper check-out fine | **500 Baht** | Incidents + Room Inspection |
| Off-campus move notice period | **One month written notice required** | Student Admin (notice date field + 30-day check) |
| Room changes per year allowed | **One** | Room Reservations (informational; future enforcement) |
| Summer credit minimum | **3 credits OR 20+ hrs/week employed** | Student Admin (waiver eligibility display) |
| Residency exemption triggers | Commute <50 km, 6+ semesters, married, health, internship | Student Admin (waiver category field) |

---

## Patterns to Avoid — From BUGFIX_LOG

Every new module must be designed with these documented failure modes in mind:

| Bug pattern | Prevention rule |
|-------------|----------------|
| Status case mismatch (BF-007) | All status strings use **Title Case**: `'Open'` not `'open'`, `'Pending'` not `'pending'` |
| `position:fixed` scroll offset (BF-001) | Never add `window.scrollY` to a `getBoundingClientRect()` `top` value |
| Frozen divisor for shared splits (BF-008) | Always store the split count at record creation time; never use live occupant count at render time |
| Multi-select mutual exclusivity (BF-009) | Any form where one selection blocks another must call `sync*Dropdowns()` on every change |
| Per-section print data (BF-004) | Print functions that generate multiple columns/sections must pass section-specific arrays |
| Direct localStorage writes (BF-016) | All reads/writes go through DormDB methods; zero direct `localStorage.setItem/getItem` calls for any `dorm*` key |
| Export overlay vs snapshot (BF-017) | Any bulk-replace or restore operation must clear first, then write — never overlay |
| Plain string vs JSON in DormDB (BF-011/012) | DormDB handles encoding; modules never call `JSON.parse/stringify` on raw localStorage values |

---

## Revised Module Scope — 4 new cards + 2 existing "coming soon" completed

| Module file | Covers | Status |
|-------------|--------|--------|
| `modules/attendance.html` | Nightly Attendance + Curfew settings + SARRA2 leave import | New card |
| `modules/incidents.html` | Incident Reports + SARRA2 citizenship export | New card |
| `modules/student-admin.html` | Off-Campus Move Requests + Dean's Assistance Log | New card |
| `modules/dorm-workers.html` | RAs, Monitors, Janitors, SWP assignment (not hours), Schedules, Job Docs | New card |
| `modules/staff-scheduling.html` | Weekly shift grid — reads dorm-workers roster | Completes existing coming-soon slot |
| `modules/plant-requests.html` | Maintenance/facility requests | Completes existing coming-soon slot |

**Not building:** `campus-leave.html`, standalone Citizenship Points, `program-attendance.html` (all SARRA2 territory).

---

## index.html Menu Restructure

The menu grows from 12 to 18 cards. A `section` property is added to the MODULES array. `renderCards()` inserts `<h2 class="menu-section">` separators between groups.

```
OPERATIONS          Room Reservations · Student Profiles · Floor Plan
                    Utilities · Reports · Key Inventory · Room Inspection · Inventory

STUDENT AFFAIRS     Nightly Attendance · Incident Reports · Student Admin

STAFF & FACILITIES  Dorm Workers · Staff Scheduling · Maintenance

REFERENCE           Dean's User Guide · Residence Hall Handbook
```

Section header CSS (fits existing navy theme):
```css
.menu-section {
  font-size: .7rem; font-weight: 800; text-transform: uppercase;
  letter-spacing: .08em; color: #888;
  border-bottom: 1px solid #dde3eb;
  margin: 20px 0 8px; padding-bottom: 4px;
  grid-column: 1 / -1;   /* spans full grid width */
}
```

---

## Phase 1 — dorm-db.js + index.html Foundation
**Start of Session 27 — must complete before any module work**

Single edit to `dorm-db.js` adds 8 new KEYS + getter/setter pairs + `getMenuStats()` fields. Single edit to `index.html` adds section headers and new `DormDB.on()` subscriptions.

### New KEYS constants (add to K object)

```js
LEAVES_IMPORT:  'dormLeavesImport',   // snapshot of current SARRA2 approved leave list
ATTENDANCE:     'dormAttendance',     // nightly attendance session records
CURFEW_CFG:     'dormCurfewConfig',   // curfew time rules and session settings
INCIDENTS:      'dormIncidents',      // incident report records
OFFCAMPUS_REQ:  'dormOffCampusReq',   // off-campus move requests
ASSISTANCE:     'dormAssistance',     // dean's assistance log entries
WORKERS:        'dormWorkers',        // worker HR records
WORKERS_CFG:    'dormWorkersConfig',  // worker settings + job document store
```

### New getter/setter pairs (follow existing pattern)

```js
getLeavesImport()  / saveLeavesImport(d)
getAttendance()    / saveAttendance(d)
getCurfewCfg()     / saveCurfewCfg(d)
getIncidents()     / saveIncidents(d)
getOffCampusReq()  / saveOffCampusReq(d)
getAssistance()    / saveAssistance(d)
getWorkers()       / saveWorkers(d)
getWorkersCfg()    / saveWorkersCfg(d)
```

### New getMenuStats() fields

```js
studentsOnLeave:     number,   // dormLeavesImport.students.length (current snapshot)
lastNightAbsent:     number,   // most recent completed attendance session absent count
unresolvedIncidents: number,   // dormIncidents where resolved === false
pendingOffCampus:    number,   // dormOffCampusReq where status === 'Pending'
activeWorkers:       number,   // dormWorkers where status === 'Active'
```

### Archiving helper (add to dorm-db.js)

```js
archiveAttendance(semesterLabel)
// Moves all sessions where session.semesterLabel === semesterLabel
// from dormAttendance to dormAttendanceArchive. Trims live key.
// Called from attendance.html Settings tab "Archive This Semester" button.
```

`exportAll`/`importAll` automatically covers new keys — they iterate the full K object. No extra code needed.

---

## Phase 2 — Nightly Attendance & Curfew
**Session 27 · `modules/attendance.html`**

The core nightly safety check. Designed mobile-first — RAs use phones on the floor. Pre-configured with APIU handbook curfew times.

### Curfew config defaults (`dormCurfewConfig`)

```js
{
  enabled: true,
  weekdayCurfew: '22:00',      // APIU handbook: 22:00 Sun–Fri
  weekendCurfew: '23:00',      // APIU handbook: 23:00 Saturday
  graceMinutes: 15,            // APIU handbook: check starts 15 min after closing
  promptIncidentAfterSession: true,
  semesterLabel: '1st Semester 2026',
  showCountdownBanner: true
}
```

### Attendance session data model

```js
{
  id: Date.now(),
  date: '',                    // YYYY-MM-DD
  semesterLabel: '',
  dayOfWeek: '',               // 'Sat' | 'Sun' | 'Mon' ... (determines which curfew applies)
  curfewTime: '',              // snapshot from config at session creation time
  checkTime: '',               // actual time roll was called ('HH:MM')
  conductedBy: '',             // DormDB.getCurrentUser()
  raOnDuty: '',                // from dormWorkers (optional, user-selectable)
  floor: 'All' | '1' | '2' | '3' | '4',

  records: [{
    studentId: '', studentName: '', room: '', floor: '',
    status: 'Present' | 'Absent' | 'On Leave' | 'Away' | 'Exempt' | 'Not Set',
    // Status notes:
    //   'On Leave'  = populated from SARRA2 leave import
    //   'Away'      = student is in dormAway (temporary away)
    //   'Exempt'    = working late petition or medical — requires exemptionNote
    //   'Absent'    = unexplained; candidate for incident report
    leaveSource: '' | 'SARRA2' | 'Manual',
    exemptionNote: '',         // required when status === 'Exempt'
    notes: '',
    markedAt: ''
  }],

  summary: { total: 0, present: 0, absent: 0, onLeave: 0, away: 0, exempt: 0, notSet: 0 },
  status: 'In Progress' | 'Completed',
  completedAt: ''
}
```

### SARRA2 leave import model (`dormLeavesImport` — snapshot, not ledger)

```js
{
  importedAt: '',        // ISO timestamp
  importedBy: '',        // DormDB.getCurrentUser()
  validFrom: '',         // date range
  validTo: '',
  students: [{
    studentId: '', name: '', room: '',
    leaveType: '',         // whatever SARRA2 exports (informational)
    expectedReturn: ''     // date
  }]
}
```

### Tabs (5)

| Tab | Key content |
|-----|-------------|
| **Dashboard** | Last session summary; 7-day absent trend (CSS bar chart — no CDN); live curfew countdown banner; SARRA2 leave snapshot count + import date |
| **Take Attendance** | Roster pre-built from dormData minus dormAway; SARRA2 leave students auto-marked 'On Leave'; large Present / Absent / Leave / Exempt toggle buttons; sticky live tally header; "Complete Session" → prompts "Create Incident Reports for absent students?" |
| **Leave Import** | File picker (CSV or plain-text); parse with `importLeaveList(file)` → `parseLeaveCSV(text)`; shows current snapshot summary; "Re-import" replaces (never appends) — snapshot pattern not ledger |
| **History** | Paginated session list; click to expand full record; absent list per session; date range filter |
| **Settings** | Curfew times (pre-filled from handbook), grace period, semester label, auto-incident toggle; "Archive This Semester" button |

### Key functions
`generateRoster(floor)` `openSession(date, floor)` `markRecord(sessionId, studentId, status, note)` `completeSession(id)` `postSessionIncidentPrompt(session)` `importLeaveList(file)` `parseLeaveCSV(text)` `checkLiveCountdown()` `renderDashboard()` `renderTakeAttendance(session)` `renderLeaveImport()` `renderHistory()` `archiveCurrentSemester()`

### index.html card stats

```js
getStats(s) {
  const pills = [];
  if (s.lastNightAbsent > 0) pills.push({ label: `${s.lastNightAbsent} absent last night`, cls: 'orange' });
  if (s.studentsOnLeave > 0) pills.push({ label: `${s.studentsOnLeave} on leave`, cls: 'blue' });
  if (!s.lastNightAbsent && !s.studentsOnLeave) pills.push({ label: 'All present', cls: 'green' });
  return pills;
}
```

### Mobile-first design constraint
The Take Attendance tab must work one-handed on a phone. Each student row: Room + Name + 4-button toggle bar (✓ Present / ✗ Absent / 🌙 Leave / 📝 Exempt). Sticky summary tally at top of screen. No horizontal scroll. Compact font-size for room/name.

### Print output
"Print Session Record" opens A4 portrait window: dorm name, date, curfew time, RA on duty, full roster table with status, conducted-by signature line. Used for physical records.

---

## Phase 3 — Incident Reports
**Session 28 · `modules/incidents.html`**

Documents behavioral incidents. SARRA2 receives the citizenship point export. Handbook fines pre-configured as defaults.

### Incident data model

```js
{
  id: Date.now(),
  date: '', time: '',
  semesterLabel: '',

  type: 'Curfew Violation' | 'Noise Complaint' | 'Property Damage' |
        'Unauthorized Room Change' | 'Unauthorized Entry' | 'Harassment' |
        'Cleanliness' | 'Theft' | 'Other',
  severity: 'Minor' | 'Moderate' | 'Major' | 'Emergency',

  studentsInvolved: [{
    studentId: '', name: '', room: '',
    role: 'Primary' | 'Secondary' | 'Witness',
    citizenshipPointsSuggested: 0,   // dean fills in; SARRA2 applies this
    fineSuggested: 0                 // pre-filled from fine defaults config
  }],

  description: '', witnesses: '', actionTaken: '',
  followUpRequired: false, followUpDate: '', followUpNotes: '',
  resolved: false, resolvedAt: '', resolvedBy: '',

  attendanceSessionId: '',    // link to nightly attendance session (curfew violations)
  roomInspectionId: '',       // link to room inspection (property damage)
  sarra2Exported: false,
  sarra2ExportedAt: '',

  reportedBy: '', createdAt: ''
}
```

### Fine defaults config (in Settings tab, seeded from handbook)

```js
fineDefaults: {
  'Unauthorized Room Change': 1000,   // APIU handbook: 1,000 Baht
  'Improper Check-Out': 500,          // APIU handbook: 500 Baht
  'Curfew Violation': 0,              // handbook says "disciplinary action" — dean discretion
  'Property Damage': 0                // varies by damage — dean fills in
}
```

### SARRA2 CSV export
Generated via `Blob` + object URL — no SheetJS needed:
```
StudentID,Name,Room,IncidentDate,Type,Severity,PointsDeducted,FineSuggested,Notes
```
One row per student per incident. Bulk export by date range available in History tab.

### Tabs (5)

| Tab | Key content |
|-----|-------------|
| **Dashboard** | Unresolved count (red badge if >0); by-type breakdown; follow-up overdue alerts (orange); SARRA2 export backlog count (how many not yet exported) |
| **New Report** | Full form; student lookup from dormData by name or ID; after save, if any `citizenshipPointsSuggested > 0`, prompt "Export to SARRA2 now?" |
| **Active** | Unresolved incidents; Resolve button; follow-up date alert; "Mark SARRA2 Sent" button per record |
| **History** | All records; filter by type/floor/date/resolved/sarra2Exported; "Export Selected for SARRA2" bulk button |
| **Settings** | Fine defaults per incident type (handbook values pre-loaded); default point suggestions per severity; semester label |

### Key functions
`emptyIncident()` `openIncidentModal(prefill)` `saveIncident()` `resolveIncident(id)` `exportIncidentToSarra2CSV(ids[])` `markSarra2Exported(ids[])` `renderDashboard()` `renderActive()` `renderHistory()`

### Batch creation from Attendance
When `postSessionIncidentPrompt(session)` fires in attendance.html, it writes to `dormIncidents` via `DormDB.saveIncidents()`. Records are pre-filled: `type: 'Curfew Violation'`, `attendanceSessionId` linked, `date` from session. incidents.html Active tab reflects them immediately via `DormDB.on(KEYS.INCIDENTS, ...)`.

### Print output
"Print Incident Report" generates an A4 record: header, student(s), description, action taken, follow-up fields, signature lines. Used for official records and parent notification.

---

## Phase 4 — Student Admin
**Session 29 · `modules/student-admin.html`**

Two dean-facing tools: formal off-campus move workflow (with handbook-required 30-day notice tracking) and a private assistance log.

### Off-Campus Move Request data model

```js
{
  id: Date.now(),
  studentId: '', studentName: '', room: '',
  requestDate: '', targetMoveDate: '',

  // Handbook-grounded fields:
  noticeGivenDate: '',                  // 30-day notice requirement tracking
  thirtyDayNoticeOK: false,             // computed: targetMoveDate - noticeGivenDate >= 30

  reason: 'Financial' | 'Academic' | 'Family' | 'Health' | 'Personal' |
          'Graduation' | 'Internship' | 'Other',
  reasonDetail: '',
  newAddress: '',

  // Handbook waiver categories:
  waiverCategory: '' | 'Commute <50km' | '6+ Semesters' | 'Married' |
                  'Health/Disability' | 'Internship' | 'Self-Supporting',
  waiverDocumented: false,

  parentApproval: false, parentName: '', parentContact: '',

  status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed',
  reviewedBy: '', reviewDate: '', reviewNotes: '',

  linkedClearanceInitiated: false,
  createdBy: '', createdAt: ''
}
```

### "Initiate Clearance" integration (writes to dormData)

When dean clicks "Start Clearance" on an Approved request:
```js
function initiateOffCampusClearance(reqId) {
  const req = offCampusReqs.find(r => r.id === reqId);
  const rooms = DormDB.getRooms();
  const si = rooms.findIndex(s =>
    s.studentId === req.studentId || s.name === req.studentName
  );
  if (si < 0) return showToast('❌ Student not found in Room Reservations');
  rooms[si].moveOutReason = 'Off Campus';
  rooms[si].offCampusType = 'Leaving Dorm';
  rooms[si].clearance.leaveDate = req.targetMoveDate;
  DormDB.saveRooms(rooms);     // triggers BroadcastChannel → room-reservations updates live
  req.linkedClearanceInitiated = true;
  DormDB.saveOffCampusReq(offCampusReqs);
  showToast('✅ Clearance started — complete in Room Reservations');
}
```

### Dean's Assistance Log data model

```js
{
  id: Date.now(),
  date: '', time: '',
  type: 'Hospital Transport' | 'Airport Transport' | 'Emergency Response' |
        'Financial Assistance' | 'Counseling' | 'Administrative Help' |
        'Disciplinary Follow-up' | 'Family Liaison' | 'Other',
  students: [{ studentId: '', name: '', room: '' }],  // multi-student support
  description: '', outcome: '',
  followUpRequired: false, followUpDate: '', followUpNotes: '',
  followUpCompleted: false,
  hoursSpent: 0, cost: 0,    // cost = out-of-pocket (gas, etc.) for records
  providedBy: '', createdAt: ''
}
```

### Tabs (3)

| Tab | Key content |
|-----|-------------|
| **Off-Campus Requests** | CRUD list; 30-day notice compliance badge (green/red); approve/reject workflow; "Start Clearance" button (only when Approved + clearance not yet initiated) |
| **Assistance Log** | CRUD; pending follow-up alerts (orange if overdue); monthly summary by type at top; multi-student support |
| **Reports** | Assistance hours by dean (semester total); request count by reason and status; 30-day notice compliance rate; printable A4 summary |

---

## Phase 5 — Dorm Workers Management
**Sessions 30–31 · `modules/dorm-workers.html`**

HR register for all dorm staff. The **single source of truth for the worker roster**, which Staff Scheduling (Phase 6) reads.

### Worker data model

```js
{
  id: Date.now(),
  category: 'RA' | 'Monitor' | 'Janitor' | 'SWP',

  name: '',
  studentId: '',              // blank for hired Janitors (not APIU students)
  employeeId: '',             // for Janitors; SWP use swpSarra2Id instead
  room: '', floor: '',        // student workers only

  jobTitle: '',
  jobDescriptionId: '',       // links into workersConfig.jobDocs[]
  assignedArea: '',           // e.g., 'Floor 3 corridor', 'Main Lobby', 'Bathrooms F2'

  startDate: '', endDate: '',
  status: 'Active' | 'On Leave' | 'Completed' | 'Terminated',

  // SWP fields — assignment + cross-reference only (SARRA2 tracks hours/credits)
  swpSarra2Id: '',            // SARRA2 SWP record ID for cross-reference
  swpSemesterTarget: '',      // text note: e.g., 'Complete 120 hrs by Dec 2026'
  swpSupervisor: '',          // dean or RA supervising this SWP worker

  contact: '', notes: '',
  createdBy: '', createdAt: ''
}
```

### Workers config + job documents (stored in `dormWorkersConfig`)

```js
{
  semesterLabel: '',
  raFloorAssignments: { 'Worker Name': 'Floor 3' },
  jobDocs: [{
    id: Date.now(),
    category: 'RA' | 'Monitor' | 'Janitor' | 'SWP',
    title: '',
    responsibilities: [],     // array of strings, each printed as a bullet
    requirements: '',
    compensation: '',         // text description; SARRA2 stores actual amounts for SWP
    createdBy: '', createdAt: '', version: '1.0'
  }]
}
```

### Tabs (6)

| Tab | Key content |
|-----|-------------|
| **Dashboard** | Active count by category; RA floor coverage map (which floors covered); today's on-duty workers (cross-checks dormSchedule for current time slot) |
| **Resident Assistants** | Full roster; floor assignment; contact; "View in Schedule →" link to staff-scheduling.html |
| **Monitors** | Roster; assigned area; shift timing (day/evening/night label) |
| **Janitors** | Staff roster; area assignments; employment dates; employment notes |
| **SWP (SARRA2)** | Assignment tracking only: name, SARRA2 ID, supervisor, semester target; note: "Hours and fee credits tracked in SARRA2 → [link to SARRA2]"; `swpSarra2Id` shown prominently for cross-reference |
| **Job Documents** | Create/edit job descriptions + agreements per category; "Print Agreement" (A4 portrait); version field; separate docs per category |

### Key functions
`emptyWorker()` `openWorkerModal(category, prefill)` `saveWorker()` `deactivateWorker(id)` `getActiveByCategory(cat)` `getWorkerOnDutyNow()` (checks dormSchedule for current day+time) `openJobDocModal(category)` `saveJobDoc()` `printAgreement(docId)` `renderDashboard()` `renderCategory(cat)` `renderJobDocs()`

---

## Phase 6 — Staff Scheduling
**Session 32 · `modules/staff-scheduling.html` (completes existing coming-soon card)**

Weekly shift planner. Reads worker roster from `dormWorkers`. The Nightly Attendance "RA on duty" selector queries this module's data.

### Schedule data model (populates existing `dormSchedule` key)

```js
// Array of weekly schedule blocks
{
  id: Date.now(),
  workerId: '',         // links to dormWorkers record
  workerName: '',
  category: 'RA' | 'Monitor' | 'Janitor' | 'SWP',
  floor: '',            // from worker's floor assignment
  weekStart: '',        // ISO date of Monday (YYYY-MM-DD)
  shifts: [{
    day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun',
    startTime: '', endTime: '',
    area: '', duties: ''
  }],
  publishedBy: '', publishedAt: ''
}
```

### Tabs (4)

| Tab | Key content |
|-----|-------------|
| **Weekly View** | 7-column Mon–Sun grid × active workers; click cell to assign/edit shift; "Who's On Duty Now?" computes current time slot and highlights active shifts |
| **My Schedule** | Filtered view for current logged-in user (if they appear in dormWorkers) |
| **Print Shift Sheet** | A4 portrait; dorm name + week range; grouped by category; used for notice board posting |
| **Settings** | Default shift templates per category; week start day (Sun or Mon) |

### Link between modules
- Dorm Workers dashboard: "View Schedule →" opens `staff-scheduling.html?worker=<id>`
- Staff Scheduling: "Edit Worker →" opens `dorm-workers.html?worker=<id>`
- Attendance "RA on Duty" dropdown: calls `getWorkerOnDutyNow()` from dormSchedule

---

## Phase 7 — Maintenance / Plant Requests
**Session 33 · `modules/plant-requests.html` (completes existing coming-soon card)**

The `getMenuStats()` fields `openMaintenance` and `highUrgency` already exist in `dorm-db.js`. The module brings those stats to life. Stubs written by Room Inspection and Inventory modules will already appear here on first load.

### Maintenance request data model (aligns with existing getMenuStats() checks)

```js
{
  id: Date.now(),
  room: '', floor: '', location: '',

  category: 'Electrical' | 'Plumbing' | 'Furniture' | 'HVAC' |
            'Structural' | 'Cleaning' | 'Other',
  description: '',
  urgency: 'Low' | 'Normal' | 'High' | 'Emergency',

  // Status 'Open' matches existing getMenuStats() check — never change casing
  status: 'Open' | 'In Progress' | 'Pending Parts' | 'Completed' | 'Deferred',

  assignedTo: '',
  targetDate: '', completedDate: '',
  inventoryItemId: '',     // link to inventory item that triggered this (if from Inventory module)
  inspectionId: '',        // link to room inspection (if from Room Inspection module)

  reportedBy: '', createdAt: '',
  resolutionNotes: ''
}
```

### Tabs (4)

| Tab | Key content |
|-----|-------------|
| **Dashboard** | Open count by urgency; rooms with multiple open requests; average days-to-resolution trend |
| **Requests** | Full CRUD; filter by status/urgency/floor; one-click status update buttons |
| **History** | Completed and deferred records; date range filter; resolution notes |
| **Settings** | Default assignee name; category management |

---

## Phase 8 — Reports Module Additions
**Session 34 · `modules/reports.html` (add 2 new tabs to existing 8-tab module)**

Print/CSS only — no SheetJS, consistent with reports.html contract. New tabs follow the exact same `.tab-btn` / `.tab-panel` pattern as existing 8 tabs.

### Tab 9: 📅 Attendance
- Per-floor absent rate across last 30 sessions (CSS bar chart)
- Per-student absence count table; rows where count > 3 highlighted orange
- Full session log table (date, floor, conducted-by, present/absent/leave counts)
- Subscribe to `DormDB.on(DormDB.KEYS.ATTENDANCE, renderAttendance)`

### Tab 10: 🚨 Incidents
- Semester incident count by type (table + simple CSS count bars)
- Unresolved incidents list
- SARRA2 export status: "X records not yet exported" (links to incidents.html for action)
- Subscribe to `DormDB.on(DormDB.KEYS.INCIDENTS, renderIncidents)`

---

## Cross-Module Dependency Map — New Keys

| DormDB key | Written by | Read by |
|------------|-----------|---------|
| `dormLeavesImport` | attendance (Leave Import tab) | attendance (pre-populate 'On Leave' in sessions) |
| `dormAttendance` | attendance | incidents (batch curfew stubs via postSessionIncidentPrompt), reports (attendance tab) |
| `dormCurfewConfig` | attendance (Settings tab) | attendance (session generation, countdown banner) |
| `dormIncidents` | incidents, attendance (batch curfew stubs) | reports (incidents tab) |
| `dormOffCampusReq` | student-admin | room-reservations dormData (via initiateOffCampusClearance writing moveOutReason) |
| `dormAssistance` | student-admin | (standalone — no cross-module readers currently) |
| `dormWorkers` | dorm-workers | staff-scheduling (shift roster), attendance (RA on duty lookup via dormSchedule) |
| `dormWorkersConfig` | dorm-workers | staff-scheduling (default shift templates) |
| `dormSchedule` | staff-scheduling | dorm-workers (dashboard "who's on duty now"), attendance (RA on duty pre-fill) |
| `dormMaintenance` | plant-requests, room-inspection (stubs), inventory (stubs) | index.html (openMaintenance, highUrgency stats) |

---

## L99 Quality Gate — Per Phase

Before marking any phase complete:

**Data model integrity**
- [ ] New field → in `empty*()` factory AND not a raw `{}` pushed anywhere
- [ ] All status strings use Title Case: `'Open'`, `'Pending'`, `'Active'`, `'Completed'`

**Cross-module correctness**
- [ ] `DormDB.on()` subscription for every foreign key the module reads
- [ ] New DormDB key: constant in K + getter/setter pair + getMenuStats() updated
- [ ] No direct `localStorage.setItem/getItem` for any `dorm*` key

**Architecture rules**
- [ ] `dorm-db.js` is the **first** `<script>` tag — no CDN before it
- [ ] Nav: `DormDB.getDormName()` + `DormDB.getCurrentUser()` populated in init()
- [ ] `init()` called via `window.addEventListener('load', init)` at page bottom
- [ ] Scroll-to-top ⇧ button present

**Rendering safety**
- [ ] No `window.scrollY` added to `position:fixed` element offset calculations
- [ ] Any multi-option dropdowns in same form call a `sync*()` exclusivity function
- [ ] Print functions pass section-specific arrays, not a shared global array

**New module checklist**
- [ ] `index.html` card set `ready: true` with correct `getMenuStats()` stat pills
- [ ] `exportAll`/`importAll` covers new key (automatic if added to K)
- [ ] CLAUDE.md file stats + function list updated after session

**Smoke tests per new module**
- [ ] Create record → hard reload → record persists
- [ ] Edit record → hard reload → edit persists
- [ ] Open two tabs → save in one → other tab stats update live (BroadcastChannel)
- [ ] Export All Data → re-import → new module data intact
- [ ] Ctrl+P → print preview → no clipped content, correct page size

---

## Storage Budget

| Key | Expected volume | Management strategy |
|-----|----------------|---------------------|
| `dormAttendance` | ~5 KB × 365 sessions = ~1.8 MB/year | **Critical**: `archiveAttendance(semesterLabel)` in Settings; trims live key to current semester |
| `dormIncidents` | ~1–5 KB × 100/semester | Keep all; semester label used for render filtering |
| `dormLeavesImport` | ~5 KB (single snapshot) | Replace on each import; never accumulates |
| `dormOffCampusReq` | ~1 KB × 50/semester | Keep all; low volume |
| `dormAssistance` | ~1 KB × 100/year | Keep all; low volume |
| `dormWorkers` | ~2 KB × 40 workers | Keep all; static |
| `dormWorkersConfig` | ~5 KB (job docs) | Keep all; low churn |
| `dormSchedule` | ~2 KB × 100 shift blocks | Keep 3 months; older auto-archived in "Start New Semester" flow |

**Risk**: Attendance is the only key that grows at a predictable rate. The archive button must be clearly labelled and documented in the Dean's User Guide when that module's guide section is written.

---

## Build Sequence

| Phase | Session | Deliverable | APIU policy grounded | SARRA2 seam |
|-------|---------|-------------|---------------------|-------------|
| 1 | 27a | `dorm-db.js` 8 keys + `index.html` section headers | — | Foundation |
| 2 | 27b | `attendance.html` — nightly roll, curfew, leave import | 22:00/23:00 curfew, 15-min grace | Import SARRA2 leave CSV |
| 3 | 28 | `incidents.html` — incident docs, SARRA2 export | 1,000/500 Baht fine defaults | Export CSV for SARRA2 |
| 4 | 29 | `student-admin.html` — off-campus requests + assistance log | 30-day notice, waiver categories | Clearance ↔ room-reservations |
| 5 | 30–31 | `dorm-workers.html` — HR register, SWP cross-ref, job docs | — | `swpSarra2Id` field |
| 6 | 32 | `staff-scheduling.html` — weekly shift planner | — | — |
| 7 | 33 | `plant-requests.html` — maintenance requests | — | — |
| 8 | 34 | `reports.html` — 2 new tabs (attendance + incidents) | — | SARRA2 export backlog count |
