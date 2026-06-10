/**
 * DormDB — Central data API for DormPortalUniversal
 *
 * Storage backend: IndexedDB (write-through synchronous cache)
 *   - Reads are synchronous via in-memory _cache.
 *   - Writes update _cache immediately + persist to IDB async (fire-and-forget).
 *   - On startup, _cache is populated from IDB; first-ever load migrates from localStorage.
 *   - BroadcastChannel carries the new value in each message so cross-tab cache stays live.
 *
 * Every module's init() must begin with: await DormDB.ready
 */
const DormDB = (() => {

  // ── Storage key constants ──────────────────────────────────────────────────
  const K = {
    // Room reservations
    ROOMS:       'dormData',
    QUEUE:       'dormQueue',
    HISTORY:     'dormHistory',
    AWAY:        'dormAway',
    // Shared settings
    NAME_SEL:    'dormNameSelect',
    NAME_CUSTOM: 'dormNameCustom',
    MAX_OCC:     'dormMaxOccupants',
    USER:        'dormUserName',
    LAST_UPDATE: 'dormLastUpdate',
    LAST_USER:   'dormLastUser',
    ROLE:        'dormRole',
    FLOOR:       'dormFloor',
    COLS:        'dormCols',
    // Auth
    PWD:         'dormPwdHash',
    // New modules
    PROFILES:    'dormProfiles',
    KEYS_INV:      'dormKeysInv',
    KEYS_CFG:      'dormKeysConfig',
    KEYS_ASSIGNED: 'dormKeysAssigned',
    INSPECTIONS: 'dormInspections',
    INSP_CFG:    'dormInspConfig',
    INVENTORY:    'dormInventory',
    INV_TEMPLATE: 'dormInvTemplate',
    INV_CFG:     'dormInvCfg',
    SCHEDULE:       'dormSchedule',
    MAINTENANCE:    'dormMaintenance',
    MAINTENANCE_CFG:'dormMaintenanceConfig',
    // Behavioral / admin modules
    LEAVES_IMPORT:  'dormLeavesImport',
    ATTENDANCE:     'dormAttendance',
    ATT_ARCHIVE:    'dormAttendanceArchive',
    CURFEW_CFG:     'dormCurfewConfig',
    INCIDENTS:      'dormIncidents',
    INCIDENTS_CFG:  'dormIncidentsConfig',
    OFFCAMPUS_REQ:  'dormOffCampusReq',
    ASSISTANCE:     'dormAssistance',
    WORKERS:        'dormWorkers',
    WORKERS_CFG:    'dormWorkersConfig',
    // Bedding inventory
    BEDDING:       'dormBedding',
    BEDDING_STOCK: 'dormBeddingStock',
    BEDDING_COUNT: 'dormBeddingCount',
    BEDDING_CFG:   'dormBeddingCfg',
    // Shared semester registry
    SEMESTER_CFG:  'dormSemesterCfg',
    M365_CFG:      'dormM365Cfg',
    FLOOR_PLAN:      'dormFloorPlan',
    UTILITIES:       'dormUtilities',
    PHOTOS_MIGRATED: 'dormPhotosInIDB',
    MAINTENANCE_IMPORTS: 'dormMaintenanceImports',
    PORTAL_PINS:         'dormPortalPins',
    LAST_ROSTER_PULL:    'dormLastRosterPull',
    MERGE_LOG:           'dormMergeLog',
  };

  // ── In-memory cache ───────────────────────────────────────────────────────
  const _cache = Object.create(null);

  // ── Ready promise — resolves when _cache is populated from IDB ────────────
  let _resolveReady;
  const _readyPromise = new Promise(r => { _resolveReady = r; });

  // ── IndexedDB ─────────────────────────────────────────────────────────────
  // Re-use the existing 'DormManagerDB' database (already holds 'photos').
  // Version bumped from 1 → 2 to add the 'dormkv' key-value store.
  const IDB_NAME    = 'DormManagerDB';
  const IDB_VERSION = 2;
  const IDB_KV      = 'dormkv';   // store for all DormDB key-value data
  const IDB_PHOTOS  = 'photos';

  let _dbPromise = null;
  function _openIDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_PHOTOS)) db.createObjectStore(IDB_PHOTOS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(IDB_KV))     db.createObjectStore(IDB_KV);
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = ()  => { _dbPromise = null; reject(req.error); };
    });
    return _dbPromise;
  }

  // Fire-and-forget write to dormkv store
  function _idbSet(key, val) {
    _openIDB().then(db => {
      db.transaction(IDB_KV, 'readwrite').objectStore(IDB_KV).put(val, key);
    }).catch(e => console.warn('IDB write failed:', key, e));
  }

  // Fire-and-forget delete from dormkv store
  function _idbDel(key) {
    _openIDB().then(db => {
      db.transaction(IDB_KV, 'readwrite').objectStore(IDB_KV).delete(key);
    }).catch(e => console.warn('IDB delete failed:', key, e));
  }

  // Read all entries from dormkv store
  function _idbReadAll(db) {
    return new Promise((resolve, reject) => {
      const result = Object.create(null);
      const req = db.transaction(IDB_KV, 'readonly').objectStore(IDB_KV).openCursor();
      req.onsuccess = e => {
        const cur = e.target.result;
        if (cur) { result[cur.key] = cur.value; cur.continue(); }
        else resolve(result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ── Generic read / write (synchronous via cache) ──────────────────────────
  function _r(key, def) {
    return key in _cache ? _cache[key] : def;
  }

  // Update cache + persist to IDB + notify subscribers / other tabs
  function _w(key, val) {
    _cache[key] = val;
    _idbSet(key, val);
    _broadcast(key);
  }

  // Remove from cache + IDB + notify
  function _del(key) {
    delete _cache[key];
    _idbDel(key);
    _broadcast(key);
  }

  // ── BroadcastChannel — cross-tab sync ─────────────────────────────────────
  // The new value is included in every message so the receiving tab updates
  // its cache directly without a round-trip back to IDB.
  const _DELETED = '__DORMDB_DELETED__'; // sentinel for deletions
  let _channel = null;
  const _subs = {};

  try { _channel = new BroadcastChannel('dorm-sync'); } catch(e) { /* private/unsupported */ }

  function _broadcast(key) {
    const val = key in _cache ? _cache[key] : _DELETED;
    if (_channel) _channel.postMessage({ key, val, ts: Date.now() });
    (_subs[key] || []).forEach(fn => { try { fn(); } catch(e) {} });
  }

  if (_channel) {
    _channel.onmessage = ({ data: { key, val } }) => {
      if (val === _DELETED) delete _cache[key];
      else _cache[key] = val;
      (_subs[key] || []).forEach(fn => { try { fn(); } catch(e) {} });
    };
  }

  // ── Startup: populate cache from IDB, migrate from localStorage if empty ──
  async function _init() {
    try {
      const db  = await _openIDB();
      const idb = await _idbReadAll(db);

      if (Object.keys(idb).length > 0) {
        // Subsequent load — use IDB as source of truth
        Object.assign(_cache, idb);
        // Pick up any K-keys absent from IDB (new constants added after first migration)
        for (const key of Object.values(K)) {
          if (key in _cache) continue;
          const raw = localStorage.getItem(key);
          if (raw === null) continue;
          let val;
          try { val = JSON.parse(raw); } catch { val = raw; }
          _cache[key] = val;
          _idbSet(key, val);
        }
      } else {
        // First load — migrate every managed key from localStorage
        for (const key of Object.values(K)) {
          const raw = localStorage.getItem(key);
          if (raw === null) continue;
          let val;
          try { val = JSON.parse(raw); } catch { val = raw; } // handle plain strings
          _cache[key] = val;
          _idbSet(key, val);
        }
      }
    } catch(e) {
      // IDB unavailable — fall back to localStorage for this session
      console.warn('DormDB: IDB unavailable, falling back to localStorage.', e);
      for (const key of Object.values(K)) {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        try { _cache[key] = JSON.parse(raw); } catch { _cache[key] = raw; }
      }
    }
    _resolveReady();
  }

  _init(); // start immediately when dorm-db.js loads

  // ── Password — PBKDF2 / SHA-256 with random per-password salt ───────────
  // Returns { hash, salt } (both lowercase hex strings).
  // Pass saltHex to reproduce a hash for verification; omit to generate a fresh random salt.
  async function hashPwd(pwd, saltHex) {
    const enc       = new TextEncoder();
    const saltBytes = saltHex
      ? new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
      : crypto.getRandomValues(new Uint8Array(16));
    const base = await crypto.subtle.importKey(
      'raw', enc.encode(pwd), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      base, 256
    );
    const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash, salt };
  }

  // Legacy: fixed salt used before random-salt migration — read-only, never write new hashes with this
  async function _hashLegacy(pwd) {
    const enc  = new TextEncoder();
    const base = await crypto.subtle.importKey(
      'raw', enc.encode(pwd), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode('APIU-DormPortal-Salt-v4'), iterations: 100000, hash: 'SHA-256' },
      base, 256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function _dataURLtoBlob(dataURL) {
    const [header, b64] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {

    // Promise that resolves when the cache is populated from IDB.
    // Every module init() must begin with: await DormDB.ready
    get ready() { return _readyPromise; },

    // Room reservations
    getRooms:       ()  => _r(K.ROOMS, []),
    saveRooms:      (d) => _w(K.ROOMS, d),
    getQueue:       ()  => _r(K.QUEUE, []),
    saveQueue:      (d) => _w(K.QUEUE, d),
    getHistory:     ()  => _r(K.HISTORY, []),
    saveHistory:    (d) => _w(K.HISTORY, d),
    getAway:        ()  => _r(K.AWAY, []),
    saveAway:       (d) => _w(K.AWAY, d),

    // Shared settings
    getDormName() {
      const sel = _r(K.NAME_SEL, 'Elijah Hall');
      return sel === 'Other' ? (_r(K.NAME_CUSTOM, '') || 'Custom Dorm') : sel;
    },
    getDormNameSel:  () => _r(K.NAME_SEL, 'Elijah Hall'),
    getDormNameCust: () => _r(K.NAME_CUSTOM, ''),
    saveDormName(sel, custom) {
      // Write both keys before broadcasting so any NAME_SEL subscriber
      // that calls getDormName() sees the updated custom name too.
      _cache[K.NAME_SEL] = sel;
      _cache[K.NAME_CUSTOM] = custom || '';
      _idbSet(K.NAME_SEL, sel);
      _idbSet(K.NAME_CUSTOM, custom || '');
      _broadcast(K.NAME_SEL);
    },
    getMaxOcc:       ()     => _r(K.MAX_OCC, 2),
    saveMaxOcc:      (v)    => _w(K.MAX_OCC, v),
    getCurrentUser:  ()     => _r(K.USER, '') || 'Unknown',
    saveCurrentUser: (name) => _w(K.USER, name),
    saveLastSave(ts, user) {
      _cache[K.LAST_UPDATE] = ts;
      _cache[K.LAST_USER] = user;
      _idbSet(K.LAST_UPDATE, ts);
      _idbSet(K.LAST_USER, user);
      _broadcast(K.LAST_UPDATE);
    },
    getLastSave: () => ({ ts: _r(K.LAST_UPDATE, ''), user: _r(K.LAST_USER, '') }),
    getFloor:    ()    => _r(K.FLOOR, '') || '',
    saveFloor:   (v)   => _w(K.FLOOR, v || ''),
    getCols:     ()    => _r(K.COLS, []),
    saveCols:    (arr) => _w(K.COLS, arr),
    getPhotosFlag: ()  => _r(K.PHOTOS_MIGRATED, null),
    setPhotosFlag: (v) => _w(K.PHOTOS_MIGRATED, v),

    // New module data
    getProfiles:     ()  => _r(K.PROFILES, []),
    saveProfiles:    (d) => _w(K.PROFILES, d),
    getKeys:         ()  => _r(K.KEYS_INV, []),
    saveKeys:        (d) => _w(K.KEYS_INV, d),
    getKeysConfig:    ()  => _r(K.KEYS_CFG, { fineAmountCash:50, fineAmountAccount:100, studentReturnMinutes:15, workerReturnHours:8, semesterLabel:'', keyDepositAmount:100 }),
    saveKeysConfig:   (d) => _w(K.KEYS_CFG, d),
    getAssignedKeys:  ()  => _r(K.KEYS_ASSIGNED, []),
    saveAssignedKeys: (d) => _w(K.KEYS_ASSIGNED, d),
    getInspections:  ()  => _r(K.INSPECTIONS, []),
    saveInspections: (d) => _w(K.INSPECTIONS, d),
    getInspCfg()         { return _r(K.INSP_CFG, { defaultCharges: {}, semesterLabel: '' }); },
    saveInspCfg:     (d) => _w(K.INSP_CFG, d),
    getInventory:    ()  => _r(K.INVENTORY, []),
    saveInventory:   (d) => _w(K.INVENTORY, d),
    getInvTemplate:  ()  => _r(K.INV_TEMPLATE, []),
    saveInvTemplate: (d) => _w(K.INV_TEMPLATE, d),
    getInvCfg()          { return _r(K.INV_CFG, { categories: [], customLocs: [] }); },
    saveInvCfg:      (d) => _w(K.INV_CFG, d),
    getSchedule:     ()  => _r(K.SCHEDULE, []),
    saveSchedule:    (d) => _w(K.SCHEDULE, d),
    getMaintenance:    ()  => _r(K.MAINTENANCE, []),
    saveMaintenance:   (d) => _w(K.MAINTENANCE, d),
    getMaintenanceCfg()    { return _r(K.MAINTENANCE_CFG, { defaultAssignee: '', msFormsFile: '' }); },
    saveMaintenanceCfg:(d) => _w(K.MAINTENANCE_CFG, d),
    getMaintenanceImports: ()  => _r(K.MAINTENANCE_IMPORTS, []),
    saveMaintenanceImports:(d) => _w(K.MAINTENANCE_IMPORTS, d),
    getLeavesImport:  ()  => _r(K.LEAVES_IMPORT, {}),
    saveLeavesImport: (d) => _w(K.LEAVES_IMPORT, d),
    getAttendance:    ()  => _r(K.ATTENDANCE, []),
    saveAttendance:   (d) => _w(K.ATTENDANCE, d),
    getAttArchive:    ()  => _r(K.ATT_ARCHIVE, []),
    saveAttArchive:   (d) => _w(K.ATT_ARCHIVE, d),
    getCurfewCfg()        { return _r(K.CURFEW_CFG, { enabled: true, weekdayCurfew: '22:00', weekendCurfew: '23:00', graceMinutes: 15, promptIncidentAfterSession: true, semesterLabel: '1st Semester 2026', showCountdownBanner: true }); },
    saveCurfewCfg:    (d) => _w(K.CURFEW_CFG, d),
    getIncidents:     ()  => _r(K.INCIDENTS, []),
    saveIncidents:    (d) => _w(K.INCIDENTS, d),
    getIncidentsCfg()     { return _r(K.INCIDENTS_CFG, { fineDefaults: { 'Unauthorized Room Change': 1000, 'Curfew Violation': 0, 'Property Damage': 0 }, pointDefaults: { minor: 0, moderate: 1, major: 3, emergency: 5 }, semesterLabel: '' }); },
    saveIncidentsCfg: (d) => _w(K.INCIDENTS_CFG, d),
    getOffCampusReq:  ()  => _r(K.OFFCAMPUS_REQ, []),
    saveOffCampusReq: (d) => _w(K.OFFCAMPUS_REQ, d),
    getAssistance:    ()  => _r(K.ASSISTANCE, []),
    saveAssistance:   (d) => _w(K.ASSISTANCE, d),
    getWorkers:       ()  => _r(K.WORKERS, []),
    saveWorkers:      (d) => _w(K.WORKERS, d),
    getWorkersCfg()       { return _r(K.WORKERS_CFG, { semesterLabel: '', raFloorAssignments: {}, jobDocs: [] }); },
    saveWorkersCfg:   (d) => _w(K.WORKERS_CFG, d),
    getBedding:       () => _r(K.BEDDING, []),
    saveBedding:      (d) => _w(K.BEDDING, d),
    getBeddingStock:  () => _r(K.BEDDING_STOCK, []),
    saveBeddingStock: (d) => _w(K.BEDDING_STOCK, d),
    getBeddingCount:  () => _r(K.BEDDING_COUNT, []),
    saveBeddingCount: (d) => _w(K.BEDDING_COUNT, d),
    getBeddingCfg() {
      return _r(K.BEDDING_CFG, {
        currentSemester: '1st Semester 2026',
        items: [
          { id: 'pillow',     name: 'Pillow',            price: 165, enabled: true },
          { id: 'set',        name: 'Set (Case+Cover)',   price: 235, enabled: true },
          { id: 'pillowcase', name: 'Pillow Case',        price: 65,  enabled: true },
          { id: 'mattress',   name: 'Mattress Protector', price: 350, enabled: true },
          { id: 'blanket',    name: 'Blanket',            price: 160, enabled: true },
        ]
      });
    },
    saveBeddingCfg:   (d) => _w(K.BEDDING_CFG, d),
    getSemesterCfg() {
      return _r(K.SEMESTER_CFG, {
        current: '1st Semester 2026',
        list: [
          { label: '1st Semester 2026', type: 'Academic', startDate: '2026-08-01', endDate: '2026-12-31' },
          { label: '2nd Semester 2026', type: 'Academic', startDate: '2027-01-01', endDate: '2027-05-31' },
          { label: 'Summer 2026',       type: 'Summer',   startDate: '2027-05-01', endDate: '2027-07-31' },
        ]
      });
    },
    saveSemesterCfg:  (d) => _w(K.SEMESTER_CFG, d),
    getCurrentSemester() {
      return _r(K.SEMESTER_CFG, { current: '1st Semester 2026' }).current || '1st Semester 2026';
    },
    getM365Cfg() {
      const def = {
        enabled: false, clientId: '', tenantId: 'common',
        folderPath: 'Nightly Checking', accessToken: '',
        refreshToken: '', tokenExpiry: 0, userEmail: '',
        sharedFolderDriveId: '', sharedFolderItemId: ''
      };
      const stored = _r(K.M365_CFG, null);
      // Merge defaults onto stored so new fields are back-filled on upgrade
      return stored ? Object.assign({}, def, stored) : def;
    },
    saveM365Cfg:         (d)  => _w(K.M365_CFG, d),
    getMergeLog:         ()   => _r(K.MERGE_LOG, []),
    saveMergeLog:        (d)  => _w(K.MERGE_LOG, d),
    getPortalPins()           { return _r(K.PORTAL_PINS, { raPortalHash: '', monPortalHash: '' }); },
    savePortalPins:      (d)  => _w(K.PORTAL_PINS, d),
    getLastRosterPull:   ()   => _r(K.LAST_ROSTER_PULL, ''),
    saveLastRosterPull:  (ts) => _w(K.LAST_ROSTER_PULL, ts),
    getFloorPlan:        ()   => _r(K.FLOOR_PLAN, { bathroomPairs: [], soloPairs: [] }),
    saveFloorPlan:       (d)  => _w(K.FLOOR_PLAN, d),
    getUtilities:        ()   => _r(K.UTILITIES, []),
    saveUtilities:       (d)  => _w(K.UTILITIES, d),

    // Cross-module stats for the main menu dashboard
    getMenuStats() {
      const rooms    = _r(K.ROOMS, []);
      const queue    = _r(K.QUEUE, []);
      const history  = _r(K.HISTORY, []);
      const away     = _r(K.AWAY, []);
      const keys     = _r(K.KEYS_INV, []);
      const assigned = _r(K.KEYS_ASSIGNED, []);
      const maint    = _r(K.MAINTENANCE, []);
      const inspect  = _r(K.INSPECTIONS, []);
      const invent   = _r(K.INVENTORY, []);
      const profiles   = _r(K.PROFILES, []);
      const attendance = _r(K.ATTENDANCE, []);
      const incidents  = _r(K.INCIDENTS, []);
      const offcampus  = _r(K.OFFCAMPUS_REQ, []);
      const leavesImp  = _r(K.LEAVES_IMPORT, {});
      const workers    = _r(K.WORKERS, []);
      const REQ = ['firstName','surname','studentId','cellPhone','email','birthDate',
                   'nationality','homeAddress','fatherName','motherName',
                   'emergencyName','emergencyPhone','bloodType'];
      const pctOf = p => REQ.filter(f => p[f] && String(p[f]).trim()).length / REQ.length * 100;
      return {
        totalStudents:      rooms.filter(s => s.name && s.name.trim()).length,
        checkingOut:        rooms.filter(s => s.graduating && s.moveOutReason).length,
        inQueue:            queue.length,
        awayCount:          away.length,
        archived:           history.length,
        keysOverdue:        keys.filter(k => k.status === 'Overdue').length,
        keysLost:           keys.filter(k => k.status === 'Lost').length,
        openMaintenance:    maint.filter(m => m.status === 'Open').length,
        highUrgency:        maint.filter(m => m.urgency === 'High' || m.urgency === 'Emergency').length,
        failedInspections:  inspect.filter(r => r.type==='move-out' && r.charges && [...(r.charges.sideA||[]),...(r.charges.sideB||[]),...(r.charges.shared||[]),...(r.charges.bathroom||[])].reduce((a,c)=>a+c.amount,0)>0).length,
        lowStock:           invent.filter(i => typeof i.qty === 'number' && i.isConsumable && i.qty <= (i.reorderAt || 0)).length,
        maintenanceFlagged: invent.filter(i => i.maintenanceFlag && !i.maintenancePushed).length,
        profileCount:       profiles.filter(p => !p.archived).length,
        profilesComplete:   profiles.filter(p => !p.archived && pctOf(p) >= 90).length,
        depositsCollected:  assigned.filter(k => k.depositPaid).length,
        depositsPending:    assigned.filter(k => !k.depositPaid && k.status === 'With Student').length,
        studentsOnLeave:    (leavesImp.students || []).length,
        lastNightAbsent:    (() => { const done = attendance.filter(s => s.status === 'Completed').sort((a,b) => b.date.localeCompare(a.date)); return done.length ? ((done[0].summary && done[0].summary.absent) || 0) : 0; })(),
        unresolvedIncidents: incidents.filter(i => !i.resolved).length,
        pendingOffCampus:   offcampus.filter(r => r.status === 'Pending').length,
        activeWorkers:      workers.filter(w => w.status === 'Active').length,
        beddingSoldThisSem: (() => { const sem = _r(K.SEMESTER_CFG, { current: '' }).current || ''; return _r(K.BEDDING, []).filter(t => t.semester === sem).length; })(),
        beddingMissing:     (() => { const sem = _r(K.SEMESTER_CFG, { current: '' }).current || ''; const cts = _r(K.BEDDING_COUNT, []).filter(x => x.semester === sem).sort((a,b) => b.countDate.localeCompare(a.countDate)); return cts.length ? cts[0].items.reduce((a,i) => a + Math.max(0,(i.expected||0)-(i.actual||0)), 0) : 0; })(),
      };
    },

    // Semester rollover
    rolloverToSemester(newLabel) {
      const rooms = _r(K.ROOMS, []);
      let rolled = 0, skipped = 0;
      const updated = rooms.map(s => {
        if (!s.name || !s.name.trim()) return s;
        if (s.graduating && s.moveOutReason) { skipped++; return s; }
        rolled++;
        return {
          ...s,
          semester: newLabel,
          summer: false,
          firstSem: false,
          returnDate: '',
          requestedRoom: '',
          requestStatus: 'Confirmed',
          manualStatus: false,
          keysReturned: false,
          roomHold: { active: false, paymentMethod: 'Not Paid', amountPaid: 0 },
        };
      });
      _w(K.ROOMS, updated);
      return { rolled, skipped };
    },

    // Flag an assigned key as 'Pending Return' when its student is vacated
    flagKeyForVacatedStudent(studentId, name) {
      const keys = _r(K.KEYS_ASSIGNED, []);
      let changed = false;
      const updated = keys.map(k => {
        const match = (studentId && k.studentId === studentId) ||
          (!studentId && k.studentName && k.studentName.toLowerCase() === (name || '').toLowerCase());
        if (match && k.status === 'With Student') { changed = true; return { ...k, status: 'Pending Return' }; }
        return k;
      });
      if (changed) _w(K.KEYS_ASSIGNED, updated);
    },

    // Archive attendance sessions for a completed semester
    archiveAttendance(semesterLabel) {
      const all      = _r(K.ATTENDANCE, []);
      const toArc    = all.filter(s => s.semesterLabel === semesterLabel);
      const remaining = all.filter(s => s.semesterLabel !== semesterLabel);
      const existing = _r(K.ATT_ARCHIVE, []);
      _w(K.ATT_ARCHIVE, [...existing, ...toArc]);
      _w(K.ATTENDANCE, remaining);
      return toArc.length;
    },

    // Reactive subscriptions — returns unsubscribe fn
    on(key, fn) {
      if (!_subs[key]) _subs[key] = [];
      _subs[key].push(fn);
      return () => { _subs[key] = _subs[key].filter(f => f !== fn); };
    },

    // Password helpers
    hashPwd,
    // Verify admin password. Handles legacy plain-string (fixed salt) and new {hash,salt} format.
    async verifyPwd(pwd) {
      const stored = _r(K.PWD, null);
      if (!stored) return false;
      if (typeof stored === 'string') return (await _hashLegacy(pwd)) === stored;
      const { hash } = await hashPwd(pwd, stored.salt);
      return hash === stored.hash;
    },
    // Verify a portal PIN against a stored hash value (same dual-format handling as verifyPwd).
    async verifyPin(pin, stored) {
      if (!stored) return false;
      if (typeof stored === 'string') return (await _hashLegacy(pin)) === stored;
      const { hash } = await hashPwd(pin, stored.salt);
      return hash === stored.hash;
    },
    getPwdHash:    ()  => _r(K.PWD, null),
    // Returns just the hash string for sessionStorage comparison (works for both formats).
    getPwdHashStr: ()  => { const s = _r(K.PWD, null); return s ? (typeof s === 'string' ? s : s.hash) : null; },
    savePwdHash:   (h) => { if (h) _w(K.PWD, h); else _del(K.PWD); },

    // Photo storage — IndexedDB 'photos' store (async, unchanged)
    async getPhoto(id) {
      const db = await _openIDB();
      return new Promise((res, rej) => {
        const req = db.transaction(IDB_PHOTOS, 'readonly').objectStore(IDB_PHOTOS).get(id);
        req.onsuccess = () => res(req.result || null);
        req.onerror   = () => rej(req.error);
      });
    },
    async savePhoto(id, blob) {
      const db = await _openIDB();
      return new Promise((res, rej) => {
        const req = db.transaction(IDB_PHOTOS, 'readwrite').objectStore(IDB_PHOTOS).put({ id, blob });
        req.onsuccess = () => res();
        req.onerror   = () => rej(req.error);
      });
    },
    async deletePhoto(id) {
      const db = await _openIDB();
      return new Promise((res, rej) => {
        const req = db.transaction(IDB_PHOTOS, 'readwrite').objectStore(IDB_PHOTOS).delete(id);
        req.onsuccess = () => res();
        req.onerror   = () => rej(req.error);
      });
    },

    // Full backup — export all managed keys + photos
    async exportAll() {
      const dump = {};
      // Read from in-memory cache (already mirrors IDB)
      for (const key of Object.values(K)) {
        if (key in _cache) dump[key] = _cache[key];
      }
      // Photos from IDB
      try {
        const db = await _openIDB();
        const photos = {};
        await new Promise((res, rej) => {
          const tx  = db.transaction(IDB_PHOTOS, 'readonly');
          const req = tx.objectStore(IDB_PHOTOS).openCursor();
          const pending = [];
          req.onsuccess = e => {
            const cur = e.target.result;
            if (cur) {
              pending.push(new Promise(r => {
                const reader = new FileReader();
                reader.onloadend = () => { photos[cur.value.id] = reader.result; r(); };
                reader.readAsDataURL(cur.value.blob);
              }));
              cur.continue();
            } else {
              Promise.all(pending).then(() => { dump._photos = photos; res(); });
            }
          };
          req.onerror = () => rej(req.error);
        });
      } catch(e) { dump._photosFailed = (dump._photosFailed || 0) + 1; console.warn('Photo export skipped:', e); }
      return dump;
    },

    async importAll(dump) {
      const valid = new Set(Object.values(K));
      // Clear managed keys absent from the backup
      for (const key of Object.values(K)) {
        if (!(key in dump)) _del(key);
      }
      // Restore present keys
      for (const [k, v] of Object.entries(dump)) {
        if (k === '_photos') continue;
        if (valid.has(k) && v !== null) _w(k, v);
      }
      // Restore photos
      if (dump._photos) {
        try {
          const db = await _openIDB();
          await new Promise((res, rej) => {
            const req = db.transaction(IDB_PHOTOS, 'readwrite').objectStore(IDB_PHOTOS).clear();
            req.onsuccess = res; req.onerror = () => rej(req.error);
          });
          for (const [id, dataURL] of Object.entries(dump._photos)) {
            await this.savePhoto(id, _dataURLtoBlob(dataURL));
          }
          _w(K.PHOTOS_MIGRATED, 'true');
        } catch(e) { console.warn('Photo restore failed:', e); }
      }
    },

    async mergeAll(dump) {
      const MERGE_KEYS = new Set([
        K.INSPECTIONS, K.ATTENDANCE, K.ATT_ARCHIVE,
        K.INCIDENTS, K.KEYS_ASSIGNED, K.HISTORY, K.MAINTENANCE
      ]);
      const summary = []; let totalAdded = 0;
      for (const key of MERGE_KEYS) {
        if (!(key in dump)) continue;
        const incoming = Array.isArray(dump[key]) ? dump[key] : [];
        if (!incoming.length) continue;
        const existing = _r(key, []);
        // dormHistory has no id field — use archivedAt as the unique key instead
        const uq = key === K.HISTORY ? 'archivedAt' : 'id';
        const seen = new Set(existing.map(e => e[uq]).filter(Boolean));
        const toAdd = incoming.filter(item => item[uq] && !seen.has(item[uq]));
        if (toAdd.length) {
          _w(key, [...existing, ...toAdd]);
          summary.push({ key, added: toAdd.length });
          totalAdded += toAdd.length;
        }
      }
      // Photos: add new entries without clearing existing
      if (dump._photos) {
        try {
          const db = await _openIDB();
          const existingKeys = await new Promise((res, rej) => {
            const req = db.transaction(IDB_PHOTOS,'readonly').objectStore(IDB_PHOTOS).getAllKeys();
            req.onsuccess = () => res(new Set(req.result));
            req.onerror = () => rej(req.error);
          });
          for (const [id, dataURL] of Object.entries(dump._photos)) {
            if (!existingKeys.has(id)) await this.savePhoto(id, _dataURLtoBlob(dataURL));
          }
        } catch(e) { console.warn('Photo merge failed:', e); }
      }
      return { totalAdded, summary };
    },

    // Expose key constants for modules that need them
    KEYS: K,
  };

})();
