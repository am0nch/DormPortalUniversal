# DormPortal Universal — Hub

> Browser-only dormitory admin system for APIU (Elijah Hall) · 20 modules · Vanilla JS ES6+ · No build tools · Deployed to GitHub Pages

---

## Project Documentation

| Doc | Purpose |
|-----|---------|
| [[CLAUDE]] | Architecture rules, data model, pitfalls, session log — source of truth for development |
| [[BUGFIX_LOG]] | Bug entries BF-001 through BF-023 |
| [[EXPANSION_ROADMAP]] | Planned features and future module ideas |
| [[SARRA2_INTEGRATION]] | How DormPortal and SARRA2 exchange data |

---

## User-Facing Docs

| Doc | Purpose |
|-----|---------|
| [[userguide]] | Dean's User Guide (markdown source; live version is inside the app) |
| [[handbook]] | APIU Residence Hall Handbook + fines reference |

---

## Modules (20 total)

| Module | File | Notes |
|--------|------|-------|
| Room Reservations | `modules/room-reservations.html` | 21 columns, Away/Queue, hold logic |
| Student Profiles | `modules/student-profiles.html` | Directory, A4 cards, CSV/Excel import |
| Floor Plan | `modules/floor-plan.html` | Visual room grid, bathroom config |
| Utilities | `modules/utilities.html` | Meter readings, billing, archive |
| Reports | `modules/reports.html` | 13 tabs — print/PDF only, no SheetJS |
| Room Inspection | `modules/room-inspection.html` | Move-in/out checklists, charge calc |
| Key Inventory | `modules/key-inventory.html` | Checkout/return/lost, overdue alerts |
| Inventory | `modules/inventory.html` | Asset tracking, barcodes, bedding |
| Attendance | `modules/attendance.html` | Nightly roll call, curfew countdown |
| Incidents | `modules/incidents.html` | Behavioral incidents, SARRA2 CSV export |
| Student Admin | `modules/student-admin.html` | Off-campus requests, Dean's log |
| Dorm Workers | `modules/dorm-workers.html` | HR register — RA/Monitor/Janitor/SWP |
| Staff Scheduling | `modules/staff-scheduling.html` | Weekly shifts, on-duty detection, print |
| Plant Requests | `modules/plant-requests.html` | Maintenance requests, urgency levels |
| RA Portal | `modules/ra-portal.html` | Mobile-first RA launcher |
| Monitor Portal | `modules/monitor-portal.html` | Mobile-first Monitor launcher |
| User Guide | `modules/userguide.html` | Interactive in-app guide |
| Handbook | `modules/handbook.html` | In-app handbook |

---

## Implementation Plans

Completed feature plans linked to their design specs:

| Plan | Spec |
|------|------|
| [[2026-06-16-snipe-it-inventory-inspection]] | [[2026-06-16-snipe-it-inventory-inspection-design]] |
| [[2026-06-16-att-archive-tab]] | [[2026-06-16-att-archive-tab-design]] |
| [[2026-06-16-archive-system]] | [[2026-06-15-archive-system-design]] |
| [[2026-06-16-cross-tab-subscriptions]] | [[2026-06-15-cross-tab-subscriptions-design]] |
| [[2026-06-16-inspection-photo-compression]] | [[2026-06-15-inspection-photo-compression-design]] |
| [[2026-06-15-inventory-inspection-bugfix]] | *(no separate spec)* |

---

## Pending Items

- [ ] SW cache bump required after every deploy — currently at **v25**
- [ ] Cross-module dep map: add `dormSchedule`, `dormWorkersConfig.masterSchedule`, `dormInventoryAudits` to [[CLAUDE]]
- [ ] 3 unmerged branches: `dorm-mis-migration`, `test-coverage-analysis` (104 Vitest tests), `wonderful-hawking` (multi-agent workflow)
- [ ] `migrateAttArchive()` not fully atomic — see [[BUGFIX_LOG]] for risk

---

## Obsidian Setup Note

Exclude these folders in **Settings → Files & Links → Excluded files** to hide tooling noise from search and graph view:

```
.claude
.serena
serena
```
