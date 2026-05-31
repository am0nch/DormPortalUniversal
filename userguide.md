# DormPortalUniversal v4 — User Guide

> For Dorm Deans and Resident Advisors at Asia-Pacific International University (APIU).

---

## 1. Overview

DormPortalUniversal v4 is a single HTML file that runs entirely in your web browser — no internet connection, no login, and no installation required. Open the file, and the app is ready.

**Two kinds of saving:**

| Type | How | When it happens |
|------|-----|-----------------|
| Auto-save | Browser storage (localStorage) | Every time you make a change |
| Manual save | 💾 Save Excel | When you click the button |

Auto-save keeps your work safe if you accidentally close the tab, but it only works on the same browser on the same computer. To move data to another computer or share it, always use **💾 Save Excel**.

If you see the yellow banner **"⚠️ Unsaved changes"**, it means you have changes that have not been exported to Excel yet.

---

## 2. First-Time Setup

### Dorm name and settings

At the top of the page, set:

- **🏢 Dormitory** — choose your dorm from the list, or select "Other (custom)" and type a name
- **👥 Max/room** — maximum occupants per room (1–4); default is 2
- **👤 Role** — choose **Dean (all floors)** to see every floor, or **RA (floor only)** to restrict the view to one floor

### Generating a new dorm layout

If you are setting up the app for the first time with no existing Excel file:

1. Click **🏗️ Generate Dorm Setup**
2. Choose a generation method:
   - **Sequential** — enter a room prefix (e.g. `101`), number of floors, and rooms per floor
   - **Custom list / ranges** — type room numbers directly (e.g. `101-106, 201-227`)
3. Set **Max occupants/room**
4. Click **Generate**

This creates all room slots in the table. You can then type student names directly into the **Name** column.

### Loading an existing Excel file

1. Click **⟳ Load File** and select a `.xlsx` file previously saved from this app
2. All data is restored: students, storage, clearance forms, incoming queue, history, and away students

---

## 3. Main Table — Column Reference

Each row represents one bed slot. Rooms with two beds appear as two consecutive rows.

| Column | What it is | How to edit |
|--------|-----------|-------------|
| **Room & Occup.** | Room number and occupancy badge | Read-only; badge updates automatically |
| **❄️** | Air-conditioned room marker | Checkbox |
| **Name** | Student's full name | Type directly; shows "📥 Transfer In" badge if transferred |
| **Req. Room** | Room the student wants to move to | Type a room number |
| **Reservation** | Confirmed or Waiting status | Dropdown (auto-calculated; can be overridden) |
| **☀️** | Staying over summer break | Checkbox |
| **📖** | Staying over 1st semester break | Checkbox |
| **🚪 Move Out** | Reason for leaving | Dropdown — see §5 |
| **Leave Date** | Date the student departs | Date picker (opens after clearance is set) |
| **Return Date** | Date the student returns (for summer/break stays) | Date picker |
| **📊 Status** | Computed status message | Read-only |
| **🔑** | Room key returned | Checkbox |
| **📦 Storage** | Storage box rental | Shows summary; click **Manage** to open modal |
| **🧍** | Solo occupancy (paying double-rate, no roommate) | Checkbox |
| **🏠 Hold** | Room hold during paid absence | Checkbox + 💳 button to record payment |
| **📋 Clearance** | Opens the clearance/graduation form | Button appears when a move-out reason is set |

---

## 4. Room Occupancy Badges

The colored badge next to each room number shows its current availability.

| Badge | Color | Meaning |
|-------|-------|---------|
| 🟢 Available | Green | At least one empty bed, no locks |
| 🟡 Leaving Soon | Yellow | All beds filled but ≥1 student has a leave date set |
| 🟠 Room Hold | Amber | A student is away on a paid hold |
| 🔴 Full | Red | All beds filled, nobody leaving |
| 🔴 Locked | Red | A solo student with no move-out planned |

A small **📥 (n)** counter on the room badge means there are incoming students queued for that room. A **📜 (n)** counter means there are archived history records.

---

## 5. Student Types

Set via the **Name** cell's type selector or the Incoming Queue form.

| Type | Use for |
|------|---------|
| 🎓 Regular Student | Standard enrolled student |
| 🆕 New Student | First-time incoming student |
| 👤 Visitor | Short-stay visitor (non-enrolled) |
| 🏨 Guest | Temporary guest |

---

## 6. Move-Out Workflow

Use this when a student is leaving — permanently or temporarily.

1. In the student's row, open the **🚪 Move Out** dropdown and select a reason:
   - **🎓 Graduating** — student is finishing their degree
   - **🏠 Off Campus → 🏠 Going Home** — leaving for a break, intending to return
   - **🏠 Off Campus → 🚪 Leaving Dorm** — permanently vacating
   - **💼 Internship** — leaving for internship placement
2. A **📋 Clearance** button appears in the last column. Click it to open the clearance form.
3. Fill in the clearance form (see §7).
4. When ready to vacate the bed, click **Archive & Vacate** inside the clearance modal.

> To remove a student without going through clearance (e.g. a data entry error), click the small **✕ Remove** button that appears on named, non-graduating rows.

---

## 7. Clearance Form (📋)

The clearance form collects all information needed by the Finance Office.

### Student Information
- Student ID, mobile number, email address
- Moving to (dorm and room, if transferring internally)

### Utility Meter Readings
- Electricity meter: IN reading and OUT reading
- Hot water meter: IN reading and OUT reading

### Fee Assessment
Check each applicable fee and enter the amount in Thai Baht (฿):

| Fee | When to charge |
|-----|---------------|
| Moving fee | Standard room move |
| Cleaning fee | Room left in poor condition |
| Room key not returned | Key is missing |
| Broken/missing drawer | Furniture damage |
| Broken/missing chair | Furniture damage |
| Broken/missing stool | Furniture damage |
| Other fees | Any additional charge — describe in the text field |

### Finishing up
- Enter a **Form No.** for your records
- Add any **Remarks** as needed
- Click **🖨️ Print Finance Form** to generate the printable clearance sheet
- Check **Form completed** once it is signed
- Click **Archive & Vacate** to remove the student from the table and move the record to the archive

---

## 8. Storage Rental (📦)

Students can rent up to 3 storage boxes per bed slot.

1. Click **Manage** in the **📦 Storage** column for a student's row
2. Check **Rent storage** to enable
3. Set the **Quantity** (1–3)
4. For each box, enter the **Color** and **Box number** label
5. Set the **Payment method**: Not Paid / Cash / QR
6. The **Total** is calculated automatically (100 ฿ per box)
7. Click **Save**

The storage column in the table shows a summary (e.g. `2 boxes · QR`).

---

## 9. Room Hold (🏠 Hold)

A room hold lets a student keep their bed during an approved absence while paying a hold fee.

**Requirements:** The student must have **☀️ Summer** or **📖 1st Semester** checked first.

1. Check the **🏠 Hold** checkbox in the student's row
2. The room badge turns 🟠 Amber and the bed is locked against new reservations
3. Click the **💳** button next to the checkbox to record the hold payment:
   - Enter the **Charge amount (฿)**
   - Select **Payment method**: Not Paid / Cash / QR
4. Click **Save**

The Status column shows **🏠 Room Held (away · [method])** while the hold is active.

---

## 10. Temporarily Away Students (📤 Away)

Use this for a student who needs to vacate their bed briefly (e.g. a family emergency) but is expected to return.

### Marking a student as away

1. In the student's row, click the small **📤 Away** button below the student's name
2. Enter the expected return date (YYYY-MM-DD format)
3. Confirm — the student's bed is released and their data is saved to the Away list

### Managing away students

Click **📤 Away** in the toolbar to open the Away panel.

Each entry shows the student's name, original room, return date, and type.

| Button | Action |
|--------|--------|
| **↩ Restore** | Move the student back to a room (choose from available rooms) |
| **✕ Discard** | Permanently remove the away record (cannot be undone) |

> Away data is saved in the Excel file. Always use **💾 Save Excel** before moving to another computer.

---

## 11. Incoming Queue (📥)

The queue holds pre-reservations for students who have not yet arrived.

### Adding an entry

1. Click **📥 Incoming Queue** in the toolbar
2. Click **➕ Add Incoming Student**
3. Fill in:
   - **Full Name**, **Student Type**
   - **Target Room** — the room they are requesting
   - **From Dorm / From Room** — if transferring from another dorm
   - **Expected Move-In** date
   - **Notes**
4. Click **Add to Queue**

### Queue table columns

| Column | Meaning |
|--------|---------|
| Room Status | Current availability of the target room |
| ✅ Confirm | Moves the student into the room (only shown when the room is available) |
| ✏️ Edit | Edit the queue entry |
| 🗑️ Remove | Delete the entry |

Room status indicators:
- ✅ Available now
- 🗓️ After [date] — available once a current student leaves
- 🚫 Full
- 🏠 Room hold (paid absence)
- 🔒 Solo locked

---

## 12. Transfer In

When a student physically moves in from another dorm:

1. Find the student's row in the table (or confirm them from the Incoming Queue)
2. Click the **📥 Transfer In** badge or button on the Name cell
3. Fill in the **Transfer In** modal:
   - **From Dorm**, **From Room**, **Move-in Date**, **Notes**
4. Click **Save Transfer**

A **📥 Transfer** badge appears next to the student's name in the table.

---

## 13. Room History (📜)

Every student who is archived (via clearance or quick-remove) is stored in the history.

### Per-room history

Click the **📜 (n)** badge on a room number to see archived records for that specific room.

### Global archive

Click **📁 Archive** in the toolbar to browse all archived records across every room.

- Filter by move-out type: 🎓 Graduating, 🏠 Going Home, 🚪 Leaving Dorm, 💼 Internship
- Filter by **Outstanding storage** to find students whose boxes have not been returned
- Search by name or room
- Click **🖨️ Print** to print the filtered list

---

## 14. Floor Filter and Role

### Role

| Role | What you see |
|------|-------------|
| Dean (all floors) | All rooms on all floors |
| RA (floor only) | Only rooms on your assigned floor |

Select your role and floor from the toolbar at the top.

### Floor filter

Use the **👥 Floor** dropdown to filter the table:
- **All floors**
- **1st & 2nd**
- **3rd**
- **4th**

The filter bar shows **Showing X / Y beds** to confirm how many rows are displayed.

### Search

Click **🔍 Search** to open a search box. Type any name or room number to filter the table instantly. Click **✕** or press **Escape** to close.

---

## 15. Reports and Print

| Button | What it produces |
|--------|-----------------|
| **📄 Custom Report** | Build a filtered, column-selected report for printing or review |
| **📊 Pivot** | Summary statistics table (counts by floor, type, status) |
| **🖨️ Print Report** | Print the current main table view |
| **🖨️ Print Pivot** | Print the pivot summary |
| **🏢 Floor Plan** | Visual floor-by-floor occupancy overview |
| **📐 A4 Floor Chart** | Printable room occupancy chart (A4 layout) |
| **🖨️ Hold Report** | List of all active room holds with amounts |

---

## 16. Save and Load (Excel)

### 💾 Save Excel

Exports all data to a `.xlsx` file named `[DormName]_DormData_v4.xlsx`.

The file contains up to four sheets:

| Sheet | Contents |
|-------|----------|
| `DormData` | All student bed slots and their data |
| `IncomingQueue` | Pre-reservation entries (if any) |
| `RoomHistory` | Archived student records (if any) |
| `AwayStudents` | Temporarily away students (if any) |

### ⟳ Load File

Select a `.xlsx` file to restore all data. This replaces the current table — make sure to save first if you have unsaved changes.

### 📄 Empty Template

Exports a minimal spreadsheet with room numbers and blank name columns — useful for bulk-entering student names in Excel before importing back.

### 🔄 Reset to Elijah Hall

Resets the table to the default Elijah Hall layout. **All current data will be lost.** Always save to Excel before using this.

---

## 17. Undo and Redo

| Button | Action |
|--------|--------|
| **↩️ Undo** | Revert the last change |
| **↪️ Redo** | Re-apply a reverted change |

Undo/redo history is session-based and is cleared when the page reloads.

---

## 18. Stats Bar Reference

The stats bar below the toolbar shows live counts. Hover over a card to see its label.

| Card | What it counts |
|------|---------------|
| ☀️ Summer | Students staying over summer |
| 📖 1st Sem | Students staying over 1st semester break |
| 🚪 Move Out | Total students with any move-out reason set |
| 🎓 Graduating | Graduating students |
| 🏠 Going Home | Off-campus / going home |
| 🚪 Leaving Dorm | Off-campus / leaving dorm permanently |
| 💼 Internship | On internship |
| 🏠 Held | Active room holds |
| 📥 In Queue | Entries in the incoming queue |
| 📦 Storage | Students with active storage rental |
| 💰 Revenue | Total storage revenue (฿) |
| 👥 Students | Total named beds |
| ⏳ Waiting | Students on the waiting list |
| 🧍 Solo | Solo occupancy rooms |
| 📜 Archived | Total archived (history) records |
| 🔑 Keys Back | Students who have returned their key |
| 📋 Clearance Done | Completed clearance forms |
| 📥 Transfer-In | Students who transferred in from another dorm |
| ✅ Confirmed | Confirmed reservation requests |
| 🏠 Empty Beds | Beds with no student assigned |

---

## 19. Tips and Keyboard Shortcuts

- **Escape** — closes any open modal
- **Auto-save** runs after every change. The browser keeps your latest data even if you close the tab by accident
- The **⚠️ Unsaved changes** banner appears whenever data has changed since the last Excel save. Dismiss it by clicking **💾 Save Excel**
- **Over capacity warning** — if more students are assigned to a room than the max occupants setting, a ⚠️ badge appears on the room number
- When a student's reservation is set manually (overriding the auto-calculation), the Manual Status flag is preserved through Excel saves and reloads
- The app works fully offline — no internet connection is needed once the file is open
