/**
 * DormDB — Central data API for Dorm Manager
 * All modules read/write through this file. localStorage is the current backend;
 * swap _r/_w internals to IndexedDB when data grows past ~5 MB.
 */
const DormDB = (() => {

  // ── Storage key constants ──────────────────────────────────────────────────
  const K = {
    // Room reservations (existing keys — must not change)
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
    INVENTORY:    'dormInventory',
    INV_TEMPLATE: 'dormInvTemplate',
    SCHEDULE:    'dormSchedule',
    MAINTENANCE: 'dormMaintenance',
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
    FLOOR_PLAN:      'dormFloorPlan',
    UTILITIES:       'dormUtilities',
    PHOTOS_MIGRATED: 'dormPhotosInIDB',
  };

  // ── Generic read / write ───────────────────────────────────────────────────
  function _r(key, def) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : def;
    } catch(e) {
      console.error('DormDB read error:', key, e);
      return def;
    }
  }

  function _w(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      _broadcast(key);
    } catch(e) {
      console.error('DormDB write error:', key, e);
      throw e;
    }
  }

  // ── IndexedDB — photo storage ─────────────────────────────────────────────
  let _idbReady = null;
  function _openIDB() {
    if (_idbReady) return _idbReady;
    _idbReady = new Promise((resolve, reject) => {
      const req = indexedDB.open('DormManagerDB', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('photos', { keyPath: 'id' });
      req.onsuccess  = e => resolve(e.target.result);
      req.onerror    = e => reject(e.target.error);
    });
    return _idbReady;
  }

  function _dataURLtoBlob(dataURL) {
    const [header, b64] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // ── BroadcastChannel — cross-tab sync ─────────────────────────────────────
  let _channel = null;
  const _subs = {};

  try { _channel = new BroadcastChannel('dorm-sync'); } catch(e) { /* private mode */ }

  function _broadcast(key) {
    if (_channel) _channel.postMessage({ key, ts: Date.now() });
    (_subs[key] || []).forEach(fn => { try { fn(); } catch(e) {} });
  }

  if (_channel) {
    _channel.onmessage = (e) => {
      (_subs[e.data.key] || []).forEach(fn => { try { fn(); } catch(e) {} });
    };
  }

  // ── Password — PBKDF2 / SHA-256 ───────────────────────────────────────────
  async function hashPwd(pwd) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey(
      'raw', enc.encode(pwd), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode('APIU-DormPortal-Salt-v4'), iterations: 100000, hash: 'SHA-256' },
      base, 256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {

    // Room reservations
    getRooms:       ()  => _r(K.ROOMS, []),
    saveRooms:      (d) => _w(K.ROOMS, d),
    getQueue:       ()  => _r(K.QUEUE, []),
    saveQueue:      (d) => _w(K.QUEUE, d),
    getHistory:     ()  => _r(K.HISTORY, []),
    saveHistory:    (d) => _w(K.HISTORY, d),
    getAway:        ()  => _r(K.AWAY, []),
    saveAway:       (d) => _w(K.AWAY, d),

    // Shared settings — getters
    getDormName() {
      const sel = localStorage.getItem(K.NAME_SEL) || 'Elijah Hall';
      return sel === 'Other'
        ? (localStorage.getItem(K.NAME_CUSTOM) || 'Custom Dorm')
        : sel;
    },
    getMaxOcc:      ()  => parseInt(localStorage.getItem(K.MAX_OCC) || '2'),
    getCurrentUser: ()  => localStorage.getItem(K.USER) || 'Unknown',

    // Shared settings — setters (route all writes here for BroadcastChannel sync)
    saveDormName(sel, custom) {
      localStorage.setItem(K.NAME_SEL, sel);
      localStorage.setItem(K.NAME_CUSTOM, custom || '');
      _broadcast(K.NAME_SEL);
    },
    saveMaxOcc:      (v)    => localStorage.setItem(K.MAX_OCC, String(v)),
    saveCurrentUser: (name) => localStorage.setItem(K.USER, name),
    saveLastSave(ts, user) {
      localStorage.setItem(K.LAST_UPDATE, ts);
      localStorage.setItem(K.LAST_USER, user);
    },
    getLastSave: () => ({ ts: localStorage.getItem(K.LAST_UPDATE)||'', user: localStorage.getItem(K.LAST_USER)||'' }),
    getFloor:    ()    => localStorage.getItem(K.FLOOR) || '',
    saveFloor:   (v)   => localStorage.setItem(K.FLOOR, v || ''),
    getCols()          { try { return JSON.parse(localStorage.getItem(K.COLS) || '[]'); } catch { return []; } },
    saveCols:    (arr) => localStorage.setItem(K.COLS, JSON.stringify(arr)),
    getPhotosFlag: ()  => localStorage.getItem(K.PHOTOS_MIGRATED),
    setPhotosFlag: (v) => localStorage.setItem(K.PHOTOS_MIGRATED, v),

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
    getInventory:    ()  => _r(K.INVENTORY, []),
    saveInventory:   (d) => _w(K.INVENTORY, d),
    getInvTemplate:  ()  => _r(K.INV_TEMPLATE, []),
    saveInvTemplate: (d) => _w(K.INV_TEMPLATE, d),
    getSchedule:     ()  => _r(K.SCHEDULE, []),
    saveSchedule:    (d) => _w(K.SCHEDULE, d),
    getMaintenance:  ()  => _r(K.MAINTENANCE, []),
    saveMaintenance: (d) => _w(K.MAINTENANCE, d),
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
    getFloorPlan:    ()  => _r(K.FLOOR_PLAN, { bathroomPairs: [], soloPairs: [] }),
    saveFloorPlan:   (d) => _w(K.FLOOR_PLAN, d),
    getUtilities:    ()  => _r(K.UTILITIES, []),
    saveUtilities:   (d) => _w(K.UTILITIES, d),

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
        profileCount:       profiles.length,
        profilesComplete:   profiles.filter(p => pctOf(p) >= 90).length,
        depositsCollected:  assigned.filter(k => k.depositPaid).length,
        depositsPending:    assigned.filter(k => !k.depositPaid && k.status === 'With Student').length,
        studentsOnLeave:    (leavesImp.students || []).length,
        lastNightAbsent:    (() => { const done = attendance.filter(s => s.status === 'Completed').sort((a,b) => b.date.localeCompare(a.date)); return done.length ? ((done[0].summary && done[0].summary.absent) || 0) : 0; })(),
        unresolvedIncidents: incidents.filter(i => !i.resolved).length,
        pendingOffCampus:   offcampus.filter(r => r.status === 'Pending').length,
        activeWorkers:      workers.filter(w => w.status === 'Active').length,
      };
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
    getPwdHash:  ()  => localStorage.getItem(K.PWD),
    savePwdHash: (h) => {
      if (h) localStorage.setItem(K.PWD, h);
      else   localStorage.removeItem(K.PWD);
    },

    // Photo storage — IndexedDB (async)
    async getPhoto(id) {
      const db = await _openIDB();
      return new Promise((res, rej) => {
        const req = db.transaction('photos', 'readonly').objectStore('photos').get(id);
        req.onsuccess = () => res(req.result || null);
        req.onerror   = () => rej(req.error);
      });
    },
    async savePhoto(id, blob) {
      const db = await _openIDB();
      return new Promise((res, rej) => {
        const req = db.transaction('photos', 'readwrite').objectStore('photos').put({ id, blob });
        req.onsuccess = () => res();
        req.onerror   = () => rej(req.error);
      });
    },
    async deletePhoto(id) {
      const db = await _openIDB();
      return new Promise((res, rej) => {
        const req = db.transaction('photos', 'readwrite').objectStore('photos').delete(id);
        req.onsuccess = () => res();
        req.onerror   = () => rej(req.error);
      });
    },

    // Full backup — export / import all managed keys (async: includes IDB photos)
    async exportAll() {
      const dump = {};
      for (const v of Object.values(K)) {
        const val = localStorage.getItem(v);
        if (val !== null) {
          try { dump[v] = JSON.parse(val); }
          catch { dump[v] = val; }
        }
      }
      try {
        const db = await _openIDB();
        const photos = {};
        await new Promise((res, rej) => {
          const tx = db.transaction('photos', 'readonly');
          const req = tx.objectStore('photos').openCursor();
          const pending = [];
          req.onsuccess = e => {
            const cursor = e.target.result;
            if (cursor) {
              pending.push(new Promise(r => {
                const reader = new FileReader();
                reader.onloadend = () => { photos[cursor.value.id] = reader.result; r(); };
                reader.readAsDataURL(cursor.value.blob);
              }));
              cursor.continue();
            } else {
              Promise.all(pending).then(() => { dump._photos = photos; res(); });
            }
          };
          req.onerror = () => rej(req.error);
        });
      } catch(e) { dump._photosFailed = (dump._photosFailed||0)+1; console.warn('Photo export skipped:', e); }
      return dump;
    },
    async importAll(dump) {
      const valid = new Set(Object.values(K));
      // Clear any managed key absent from the backup so restore is a true
      // point-in-time snapshot, not an overlay on top of current state.
      for (const v of Object.values(K)) {
        if (!(v in dump)) { localStorage.removeItem(v); _broadcast(v); }
      }
      for (const [k, v] of Object.entries(dump)) {
        if (k === '_photos') continue;
        if (valid.has(k) && v !== null) {
          if (typeof v === 'string') localStorage.setItem(k, v);
          else _w(k, v);
        }
      }
      if (dump._photos) {
        try {
          const db = await _openIDB();
          // Clear IDB before restoring so deleted photos don't persist as orphans
          await new Promise((res, rej) => {
            const req = db.transaction('photos', 'readwrite').objectStore('photos').clear();
            req.onsuccess = res; req.onerror = () => rej(req.error);
          });
          for (const [id, dataURL] of Object.entries(dump._photos)) {
            await this.savePhoto(id, _dataURLtoBlob(dataURL));
          }
          localStorage.setItem(K.PHOTOS_MIGRATED, 'true');
        } catch(e) { console.warn('Photo restore failed:', e); }
      }
    },

    // Expose key constants for modules that need them
    KEYS: K,
  };

})();
