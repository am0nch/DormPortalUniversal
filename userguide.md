# DormPortalUniversal v4 — User Guide

> For Dorm Deans at Asia-Pacific International University (APIU).
> Interactive version available inside the app: **Dean's User Guide** module.

---

## What this is

DormPortalUniversal v4 is a **multi-module dormitory administration system** that runs entirely in your browser — no internet connection, no server, no login required. All data is saved automatically to your browser's local storage and can be exported as a `.json` backup.

Access it at: **https://am0nch.github.io/DormPortalUniversal/**

Each dean's data is stored **privately in their own browser**. Other users who open the same link always see an empty system — your data is never uploaded or shared.

---

## Modules

| Module | Description |
|--------|-------------|
| 🛏️ **Room Reservations** | Student bed slots, check-in/out, move-out, clearance forms, room holds, storage rental, incoming queue, away students, transfer in, undo/redo |
| 👤 **Student Profiles** | Full student directory, A4 profile card print, Registrar Excel import, MS Forms CSV import, photo storage |
| 🏢 **Floor Plan** | Visual room grid with occupancy colors, hot water bathroom pairing config, A4 landscape print |
| ⚡ **Electricity & Hot Water** | Monthly meter readings, per-student bill calculation, billing period archive, Excel export |
| 📊 **Reports** | 8-tab hub: archive, room report, custom report, pivot, holds, storage, clearance forms, fee collection — print/PDF only |
| 🔑 **Key Inventory** | Key checkout/return/lost tracking, overdue alerts, fine recording, shift print sheet, borrower ledger, agreement print |
| 🔍 **Room Inspection** | Move-in/out checklists (Side A/B/Shared/Bathroom), damage charge calculation, A4 inspection sheet, A5 cost card |
| 📦 **Inventory** | Asset tracking with Code 39 barcode labels, room template comparison, maintenance flag push, 6-tab layout |
| 📖 **Dean's User Guide** | Interactive in-app reference covering all modules — sticky TOC, collapsible sections, live search |

**Coming soon:** Staff Scheduling, Maintenance

---

## First-Time Setup

1. Open the app and enter your name when prompted
2. Select your **dorm** from the dropdown (top-right of the menu)
3. Go to **🛏️ Room Reservations** → click **🏗️ Generate Dorm Setup**
4. Choose Sequential (prefix + floors + rooms per floor) or Custom list (`101-106, 201-227`)
5. Set **Max occupants/room** (default: 2) and click **Generate**

To restore existing data: click **📂 Restore Backup** on the main menu and select a `.json` backup file.

---

## Data Persistence

| Storage type | What it holds | Limit |
|-------------|--------------|-------|
| `localStorage` | All module data (rooms, keys, inspections, inventory, utilities, profiles) | ~5–10 MB total |
| `IndexedDB` | Student profile photos (separate from the 5–10 MB limit) | Browser-dependent |
| `.json` export | Full backup of all data including photos | No limit (file on your computer) |

Auto-save runs after every change. The Room Reservations status bar shows current localStorage usage and warns at **3,500 KB**.

**Important:** localStorage is tied to a specific browser on a specific computer. To move data or back it up:
- Use **💾 Export All Data** on the main menu → saves a `.json` file
- Use **📂 Restore Backup** to load it on another computer or browser

Do not use **Incognito / Private mode** — data does not persist after the window closes.

---

## Room Reservations — Key Workflows

### Room occupancy badges

| Badge | Meaning |
|-------|---------|
| 🟢 Available | At least one empty bed, no locks |
| 🟡 Leaving Soon | All beds filled but ≥1 student has a leave date |
| 🟠 Room Hold | Student away on a paid hold |
| 🔴 Full / Locked | All beds filled, or solo student with no move-out |

### Move-out workflow

1. Set **🚪 Move Out** reason: Graduating / Off Campus Going Home / Off Campus Leaving Dorm / Internship
2. A **📋 Clearance** button appears — click to open the clearance form
3. Fill in student ID, meter readings, and any applicable fees
4. Click **🖨️ Print Finance Form** to generate the Finance Office clearance sheet
5. Click **Archive & Vacate** to remove the student and archive the record

### Room hold

- Requires **☀️ Summer** or **📖 1st Sem** checked first
- Check **🏠 Hold** → room badge turns 🟠 Amber and locks against new reservations
- Click **💳** to record the hold payment

### Away students

- Click **📤 Away** below a student's name to temporarily release their bed
- Data is preserved in the Away panel
- Click **↩ Restore** to move them back to a room when they return

### Incoming queue

- Click **📥 Incoming Queue** in the toolbar → **➕ Add Incoming Student**
- Enter name, type, target room, expected move-in date
- When the room becomes available, click **✅ Confirm** to place them

### Storage rental

- Click **📦 Manage** in the Storage column
- Up to 3 boxes per student; each tracked with color, box number, and payment status (Cash / QR / Not Paid)
- Unpaid rentals appear in Reports → 💰 Fee Collection

---

## Key Inventory — Key Workflows

1. Go to **Settings** tab → configure fine amounts and return time limits
2. Click **Generate from Rooms** to auto-create A+B keys for all occupied rooms
3. **Check-out** a key: enter student name and room → status changes to Active
4. **Return**: click Return on an active key → records return time
5. **Lost**: click Lost → fine modal appears (Cash / Account / Waived)
6. Overdue keys are flagged automatically every 60 seconds
7. Print **Shift Sheet** for handover; print **Ledger** for the master signature record

---

## Room Inspection — Key Workflows

1. Click **New Inspection** → select room, type (move-in / move-out), date, semester
2. Assign Side A (door-side) and Side B (balcony-side) occupants
3. Fill checklist for each section: Side A, Side B, Shared Fixtures, Bathroom
4. Conditions: Good / Fair / Poor / Missing — each triggers a severity multiplier on replacement costs
5. At move-out, charges are calculated automatically vs. the paired move-in record
6. Click **✏️ Edit Charges** after saving to adjust individual repair costs
7. Print **A4 Inspection Sheet** (full record) or **A5 Cost Card** (for posting in the room)
8. Poor/Missing items at move-out are pushed as stubs to the Maintenance module

---

## Inventory — Key Workflows

1. Go to **Settings** → configure room item template (standard items per room) and categories
2. Click **Seed All Rooms** to auto-populate template items for all student rooms
3. **Items tab**: add/edit/remove items; filter by location, category, condition
4. **By Location**: select a room → see which template items are present or missing
5. **Labels tab**: select items → **Print Labels** → A4 sheet with Code 39 barcodes (scannable with any USB barcode scanner)
6. **Maintenance Flags**: items marked Poor/Damaged/Missing → click **Push to Maintenance** to create a repair stub

---

## Reports — 8 Tabs

| Tab | Contents |
|-----|----------|
| 📁 Archive | All archived (vacated) student records; filterable; printable |
| 🏠 Room Report | Current occupancy snapshot; printable A4 |
| 📄 Custom | Build a filtered, column-selected report |
| 📊 Pivot | Summary counts by floor, type, and status |
| 🏠 Holds | All active room holds with payment status |
| 📦 Storage | All storage rentals; paid vs. unpaid |
| 📋 Clearance | Active clearance overview + printable Finance Office form builder |
| 💰 Fee Collection | Aggregated outstanding fees: storage, holds, clearance, key fines |

Reports are **print/PDF only** — no Excel export from this module.

---

## Known Limitations

| Limitation | Details |
|-----------|---------|
| **Single-user per browser** | Two deans writing simultaneously (different tabs on the same browser) will overwrite each other — last write wins |
| **No server sync** | Data is not shared between computers automatically; use Export/Restore for handoffs |
| **Storage ceiling** | All text data shares the ~5–10 MB localStorage limit; the system warns at 3,500 KB |
| **Full-array reads** | All data is loaded and saved as complete JSON arrays — no partial reads or indexes; large datasets (1,000+ items) will slow down |
| **No offline install** | The GitHub Pages link requires an initial internet connection to load; after that it works offline until the page is refreshed |
| **BroadcastChannel** | Cross-tab sync is disabled in Incognito/Private mode with no warning |

---

## Data Safety Tips

- **Export weekly** — click **💾 Export All Data** on the main menu; save the `.json` file to a USB drive or cloud storage
- **Crop photos** before uploading to Student Profiles — aim for under 500×700 px to keep file size manageable
- **Do not clear browser data** without exporting first — this deletes all localStorage and IndexedDB data
- **Do not use Incognito mode** for regular use — data is lost when the window closes
- The `.gitignore` in the GitHub repository excludes all `*.json`, `*.xlsx`, and `*.pdf` files — no student data is ever committed to the repository

---

## Version History

| Version | Description |
|---------|-------------|
| **v4** (2026) | Multi-module system: 9 modules, `dorm-db.js` central API, IndexedDB photo storage, GitHub Pages deployment |
| **v3** (2025) | Single HTML file (~1,600 lines): room reservations, storage, clearance, queue, history, holds, transfer in |
| **v2** (2024) | Single HTML file: room table, basic move-out, Excel export/import |
| **v1** (2023) | Proof-of-concept spreadsheet replacement |

---

## Credits

Developed by **Richmond Panganiban Ilao**, Dorm Dean, Elijah Hall — APIU.
Built with [Claude Code](https://claude.ai/code) by Anthropic.
© 2026 Richmond Panganiban Ilao. All rights reserved.

Student data processed by this system is stored locally on the user's device only and is never transmitted to any server or third party.
