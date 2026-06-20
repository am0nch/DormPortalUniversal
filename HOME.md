# DormPortal Universal — Hub

> Browser-only dormitory admin system for APIU (Elijah Hall) · 20 modules · Vanilla JS ES6+ · No build tools
> **Live app:** https://am0nch.github.io/DormPortalUniversal

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

## SW Cache

| Version | Date | What changed |
|---------|------|--------------|
| **v25** ← current | 2026-06-19 | Bedding semester dropdown stale-selection fix |
| v24 | 2026-06-19 | userguide Room Reservations — 21 columns, Away/Queue print |
| v23 | 2026-06-19 | userguide updated for password toggle + ZIP backup |
| v22 | 2026-06-19 | ZIP export/import with photos |
| v21 | 2026-06-19 | Password modal Change/Remove mode split |
| v20 | 2026-06-18 | Mobile header + Saved stamp + Dean name fixes |
| v19 | 2026-06-18 | Mobile header intermediate deploy |
| v18 | 2026-06-18 | Export modal fix + encrypted backup |
| v17 | 2026-06-18 | Att. Archive userguide; dead `archiveAttendance()` removed |
| v16 | 2026-06-18 | Dean-only auth redesign; M365 auth bypass removed |
| v15 | 2026-06-17 | room-inspection + inventory post-Snipe-IT bug fixes |
| v14 | 2026-06-17 | Snipe-IT inventory + room inspection IDB rewrite |

> Bump `dormportal-vN` in `sw.js` after **every deploy** that touches HTML or JS.

---

## Pre-Push Checklist

1. `grep -n "localStorage\.\(setItem\|getItem\)" modules/*.html | grep "dorm"` — zero hits required (BF-016)
2. Run `/code-review --fix` — fix all CONFIRMED findings before pushing
3. Bump SW cache: update `dormportal-vN` → `dormportal-v(N+1)` in `sw.js`
4. `wc -l <file>` — verify line count delta is expected
5. `git push`

---

## Cross-Module Dependency Map

| DormDB key | Written by | Read by |
|------------|-----------|---------|
| `dormData` | room-reservations | reports, floor-plan, utilities, room-inspection, key-inventory, student-profiles, index.html |
| `dormHistory` | room-reservations | reports (archive tab) |
| `dormAway` | room-reservations | reports (fee collection) |
| `dormProfiles` | student-profiles | room-reservations (profile badge), floor-plan |
| `dormKeysInv` | key-inventory | reports (fee collection), index.html |
| `dormKeysAssigned` | key-inventory, room-inspection | student-profiles, index.html |
| `dormInspections` | room-inspection | room-reservations (clearance pre-fill), reports |
| `dormInventoryAssets` | inventory | index.html |
| `dormInventoryModels` | inventory | index.html |
| `dormInventoryAudits` | inventory | inventory (audit log tab) |
| `dormMaintenance` | room-inspection, inventory | index.html |
| `dormWorkers` | dorm-workers | ra-portal, monitor-portal, staff-scheduling, index.html |
| `dormWorkersConfig` | staff-scheduling | staff-scheduling (scheduleCfg + masterSchedule) |
| `dormSchedule` | staff-scheduling | staff-scheduling |
| `dormSemesterCfg` | index.html | all modules with semester selects |

---

## Unmerged Branches

| Branch | Contents | Status |
|--------|----------|--------|
| `claude/dorm-mis-migration-3oy2h2` | Full-stack MIS migration (WIP) | Blocked — needs design decision |
| `claude/test-coverage-analysis-bBZsg` | 104 Vitest tests | Ready to review |
| `claude/wonderful-hawking-TRPrZ` | Multi-agent workflow | Ready to review |

---

## Pending Items

- [ ] Cross-module dep map: add `dormSchedule`, `dormWorkersConfig.masterSchedule`, `dormInventoryAudits` to [[CLAUDE]]
- [ ] `migrateAttArchive()` not fully atomic — mid-loop IDB failure could leave `dormAttendanceArchive` partially migrated (see [[BUGFIX_LOG]])
- [ ] Backward-compat stubs (`getInventory` etc.) in `dorm-db.js` — remove once confirmed no callers remain

---

## Obsidian Setup Note

Exclude these folders in **Settings → Files & Links → Excluded files** to hide tooling noise from search and graph view:

```
.claude
.serena
serena
```
