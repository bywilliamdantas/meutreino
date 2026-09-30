import { SCHEMA_VERSION } from "./data/constants.js";
import { newSessionId } from "./utils/ids.js";
import { parseNum } from "./utils/numbers.js";

export function migrateSessionEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return {
    letter: entry,
    log: {}
  };
  if (!entry.log) entry.log = {};
  Object.keys(entry.log).forEach(exId => {
    const v = entry.log[exId];
    if (v && !Array.isArray(v)) {
      const weight = v.weight;
      const reps = v.reps;
      const hasAny = weight !== "" && weight != null || reps !== "" && reps != null;
      entry.log[exId] = hasAny ? [{
        weight: parseNum(weight),
        reps: parseNum(reps),
        done: true
      }] : [];
    }
    if (!Array.isArray(entry.log[exId])) entry.log[exId] = [];
  });
  return entry;
}

export function migrateSessions(s) {
  if (!s.sessions) {
    s.sessions = {};
    return;
  }
  Object.keys(s.sessions).forEach(k => {
    const v = s.sessions[k];
    if (Array.isArray(v)) {
      v.forEach(sess => {
        if (sess && !sess.id) sess.id = newSessionId();
        if (sess && !sess.log) sess.log = {};
        Object.keys(sess.log || {}).forEach(exId => {
          if (!Array.isArray(sess.log[exId])) sess.log[exId] = [];
        });
      });
      return;
    }
    const migrated = migrateSessionEntry(v);
    const session = {
      id: newSessionId(),
      letter: migrated?.letter || null,
      log: migrated?.log || {},
      startedAt: migrated?.startedAt || null,
      endedAt: migrated?.endedAt || null
    };
    s.sessions[k] = [session];
  });
}

export function migrateSettings(s) {
  if (!s.settings) s.settings = {};
  const d = {
    reminder: {
      enabled: false,
      time: "18:00",
      lastNotifiedDate: null
    },
    lastBackupAt: null,
    workoutsCollapsed: false,
    restDuration: 90,
    weekStartsMonday: false,
    restTimerActive: null
  };
  if (!s.settings.reminder) s.settings.reminder = {
    ...d.reminder
  };
  if (s.settings.reminder.enabled === undefined) s.settings.reminder.enabled = false;
  if (!s.settings.reminder.time) s.settings.reminder.time = "18:00";
  if (s.settings.reminder.lastNotifiedDate === undefined) s.settings.reminder.lastNotifiedDate = null;
  if (s.settings.lastBackupAt === undefined) s.settings.lastBackupAt = null;
  if (s.settings.workoutsCollapsed === undefined) s.settings.workoutsCollapsed = false;
  if (!s.settings.collapsedSections || typeof s.settings.collapsedSections !== "object" || Array.isArray(s.settings.collapsedSections)) {
    s.settings.collapsedSections = s.settings.workoutsCollapsed ? {
      workouts: true
    } : {};
  }
  if (s.settings.restDuration === undefined) s.settings.restDuration = 90;
  if (s.settings.weekStartsMonday === undefined) s.settings.weekStartsMonday = false;
  if (s.settings.restTimerActive === undefined) s.settings.restTimerActive = null;
  if (s.settings.unit !== "kg" && s.settings.unit !== "lb") s.settings.unit = "kg";
  if (s.settings.keepAwake === undefined) s.settings.keepAwake = true;
  if (s.settings.avatarUrl === undefined) s.settings.avatarUrl = null;
  if (s.settings.displayName === undefined) s.settings.displayName = "";
}

export function migrateActiveSession(s) {
  if (!s.activeSession || typeof s.activeSession !== "object") {
    s.activeSession = {
      letter: null,
      state: "idle",
      elapsedMs: 0,
      startedAt: null,
      startedDate: null
    };
  }
  const a = s.activeSession;
  if (!("letter" in a)) a.letter = null;
  if (!("state" in a)) a.state = "idle";
  if (!("elapsedMs" in a)) a.elapsedMs = 0;
  if (!("startedAt" in a)) a.startedAt = null;
  if (!("startedDate" in a)) a.startedDate = null;
}

export function migrateWorkouts(w) {
  if (!w) return;
  Object.values(w.workouts || {}).forEach(wk => {
    (wk.exercises || []).forEach(ex => {
      if (!ex.type) ex.type = "strength";
    });
  });
  if (!Array.isArray(w.body)) w.body = [];
  w.body = w.body.filter(b => b && typeof b === "object" && /^\d{4}-\d{2}-\d{2}$/.test(b.date || ""));
  w.body.forEach(b => {
    if (!b.id) b.id = "b" + Math.random().toString(36).slice(2, 9);
  });
  w.schemaVersion = SCHEMA_VERSION;
}
