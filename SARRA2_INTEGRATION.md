# SARRA2 ↔ DormPortalUniversal Integration Guide

**Audience:** SARRA2 developers or any technical reviewer who needs to understand how the two systems exchange data.

---

## Architecture Overview

DormPortalUniversal is a **browser-only application** — no server, no database, no API. All data is stored in the browser's `localStorage`. There is no network communication.

Integration with SARRA2 is therefore **one-way via CSV file exchange**:

| Direction | Mechanism | Who acts |
|-----------|-----------|----------|
| SARRA2 → Dorm Manager | SARRA2 exports a CSV → Dean imports it via browser file picker | Dean imports manually |
| Dorm Manager → SARRA2 | Dean clicks Export → browser downloads a CSV → SARRA2 imports it | Dean exports manually |

There are **three integration seams**. No seam requires code changes on either side — they communicate through files.

---

## Seam 1 — Leave List Import (SARRA2 → Dorm Manager)

### Purpose
Pre-mark students on approved campus leave as **On Leave** in nightly attendance sessions, so they aren't counted as Absent.

### Workflow
1. SARRA2 operator exports the current approved campus leave list as a CSV.
2. Dorm Dean opens `modules/attendance.html` → **Leave Import** tab → picks the file.
3. The system parses it and replaces the current leave snapshot.
4. Next time an attendance session is opened, students on the list are auto-marked **On Leave**.

### Expected CSV Format

The parser is **flexible** — it matches column headers by keyword rather than exact name. Any of the following header patterns work:

| Data | Accepted column name patterns (case-insensitive) |
|------|--------------------------------------------------|
| Student ID | `student_id`, `studentid`, `id`, `sarra2` (any header containing these) |
| Name | `student_name`, `studentname`, `name` |
| Room | `room` |
| Leave type | `leave_type`, `leavetype`, `type` |
| Expected return | `return`, `expected` (any header containing these) |

Columns not matched are silently ignored. A row is included if it has a student ID **or** a name — either is sufficient.

**Minimum viable CSV (2 columns):**
```csv
StudentID,Name
123456,James Lee
123457,Maria Santos
```

**Full CSV (all fields):**
```csv
StudentID,StudentName,Room,LeaveType,ExpectedReturn
123456,James Lee,312,Weekend Leave,2026-06-08
123457,Maria Santos,204,Overnight Leave,2026-06-07
```

### Code Location
- **File:** `modules/attendance.html`
- **Functions:** `importLeaveList(file)` (line ~659), `parseLeaveCSV(text)` (line ~682)
- **localStorage key:** `dormLeavesImport`

### Data Model Stored
```json
{
  "importedAt": "2026-06-04T10:00:00.000Z",
  "importedBy": "Dean Richmond",
  "validFrom": "",
  "validTo": "",
  "students": [
    {
      "studentId": "123456",
      "name": "James Lee",
      "room": "312",
      "leaveType": "Weekend Leave",
      "expectedReturn": "2026-06-08"
    }
  ]
}
```

**Important:** This is a **snapshot** (not a ledger). Each import replaces the entire previous list. There is no cumulative history — the system stores one snapshot at a time.

---

## Seam 2 — Incident / Citizenship Point Export (Dorm Manager → SARRA2)

### Purpose
Report citizenship point deductions and fines to SARRA2 for official tracking after a behavioral incident is documented.

### Workflow
1. Dean documents an incident in `modules/incidents.html` — records students involved, fills in citizenship points suggested and fine amount per student.
2. Dean goes to the **History** tab, checks the incidents to export, clicks **Export Selected for SARRA2**.
3. Browser downloads a `.csv` file instantly (no internet required).
4. SARRA2 operator imports the file via SARRA2's citizenship points import procedure.
5. Dean clicks **Mark SARRA2 Sent** on each exported record to clear the backlog counter.

### CSV Format (exact, fixed columns)

```
IncidentID,Date,Type,Severity,StudentID,Name,Room,Role,PointsDeducted,FineSuggested,Notes
```

| Column | Type | Notes |
|--------|------|-------|
| `IncidentID` | integer (timestamp) | Unique ID — `Date.now()` at record creation |
| `Date` | `YYYY-MM-DD` | Date of incident |
| `Type` | string | One of: `Curfew Violation`, `Noise Complaint`, `Property Damage`, `Unauthorized Room Change`, `Unauthorized Entry`, `Harassment`, `Cleanliness`, `Theft`, `Other` |
| `Severity` | string | One of: `Minor`, `Moderate`, `Major`, `Emergency` |
| `StudentID` | string | APIU student ID — same ID used in SARRA2 |
| `Name` | string | Student full name |
| `Room` | string | Room number at time of incident |
| `Role` | string | `Primary`, `Secondary`, or `Witness` |
| `PointsDeducted` | integer | 0 if none suggested; dean sets this per student |
| `FineSuggested` | number | Baht amount; 0 if none |
| `Notes` | string | Incident description (newlines stripped; commas replaced with semicolons) |

**One row per student per incident.** An incident involving 3 students produces 3 rows with the same `IncidentID`.

**Example:**
```csv
IncidentID,Date,Type,Severity,StudentID,Name,Room,Role,PointsDeducted,FineSuggested,Notes
1749000000001,2026-06-04,Curfew Violation,Minor,123456,James Lee,312,Primary,1,0,Student returned after 22:00 curfew without exemption
1749000000001,2026-06-04,Curfew Violation,Minor,123457,Maria Santos,314,Secondary,0,0,Student returned after 22:00 curfew without exemption
```

### Code Location
- **File:** `modules/incidents.html`
- **Function:** `exportSarra2CSV(ids[])` (line ~581)
- **localStorage key:** `dormIncidents`

### Fine Defaults (pre-configured from APIU Handbook)
| Incident Type | Default Fine |
|---------------|-------------|
| Unauthorized Room Change | 1,000 ฿ |
| Improper Check-Out | 500 ฿ |
| Curfew Violation | 0 (dean discretion) |
| Property Damage | 0 (varies by case) |

These are stored in `dormIncidentsConfig` (localStorage) and editable by the dean in the Settings tab. Changing them here does **not** change anything in SARRA2 — they are suggestions only.

---

## Seam 3 — SWP Cross-Reference (Dorm Manager ↔ SARRA2)

### Purpose
Link a Student Work Program worker's dorm record to their SARRA2 SWP record for manual cross-lookup. **No data is exchanged** — this is a stored reference ID only.

### How it works
- Each SWP worker in `modules/dorm-workers.html` has a `swpSarra2Id` field.
- The dean enters the SARRA2 SWP record ID when setting up the worker.
- It is displayed prominently in the SWP tab so staff can look up the SARRA2 record.
- Hours worked and fee credits remain entirely in SARRA2.

### Code Location
- **File:** `modules/dorm-workers.html`
- **localStorage key:** `dormWorkers` (array of worker objects)
- **Field:** `worker.swpSarra2Id` (string)

---

## Development Setup

No build tools, no dependencies, no npm, no server required.

```bash
git clone https://github.com/am0nch/dormportaluniversal.git
cd dormportaluniversal
# Open index.html in Chrome or Edge
```

All data for a session lives in the browser's `localStorage` under that browser profile — it does not persist across different browsers or computers unless exported via **💾 Export All Data** and restored via **📂 Restore Backup**.

---

## Key Files

| File | Role |
|------|------|
| `index.html` | Main menu — module cards + live stats |
| `dorm-db.js` | Central data API — all localStorage keys, getters/setters, cross-tab BroadcastChannel sync |
| `modules/attendance.html` | Seam 1: leave import, nightly attendance sessions |
| `modules/incidents.html` | Seam 2: incident records, SARRA2 CSV export |
| `modules/dorm-workers.html` | Seam 3: worker HR register, SWP cross-reference |
| `CLAUDE.md` | Full technical reference: data models, localStorage keys, architecture rules, known bugs |

---

## localStorage Keys (SARRA2-relevant)

| Key | Contents | Relevant to |
|-----|----------|-------------|
| `dormLeavesImport` | Current SARRA2 leave snapshot | Seam 1 |
| `dormAttendance` | Array of nightly session records | Seam 1 (sessions use leave data) |
| `dormIncidents` | Array of incident records | Seam 2 |
| `dormIncidentsConfig` | Fine defaults and point suggestions | Seam 2 |
| `dormWorkers` | Array of worker HR records | Seam 3 |

All keys are read and written through the `DormDB` API in `dorm-db.js`. No module accesses `localStorage` directly for these keys.

---

## What SARRA2 Does NOT Need to Change

DormPortalUniversal was deliberately designed so that **SARRA2 requires zero code changes** to support the current integration. The CSV formats used for export/import match whatever SARRA2 already produces or accepts. If SARRA2's CSV export format changes, only the `parseLeaveCSV()` function in `modules/attendance.html` needs updating — and even then, only the column keyword matchers (currently `student_id`, `name`, `room`, `type`, `return`).

---

*Last updated: 2026-06-04 · DormPortalUniversal v4.1*
