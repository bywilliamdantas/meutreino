import { AUTOBACKUP_MAX, autobackupKey } from "../config.js";
import { store } from "../store.js";
import { todayKey } from "../utils/format.js";
import { totalDays, totalSessions } from "../workouts/sessions.js";

export function readAutoBackups() {
  try {
    const list = JSON.parse(window.localStorage.getItem(autobackupKey()) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function writeAutoBackups(list) {
  const copy = list.slice(0, AUTOBACKUP_MAX);
  while (copy.length) {
    try {
      window.localStorage.setItem(autobackupKey(), JSON.stringify(copy));
      return true;
    } catch (e) {
      copy.pop();
    }
  }
  return false;
}

export function hasMeaningfulData() {
  if (totalDays() > 0 || store.data.body && store.data.body.length) return true;
  return Object.values(store.data.workouts).some(w => (w.exercises || []).length > 0);
}

export function takeAutoBackup(force) {
  try {
    if (!hasMeaningfulData()) return;
    const list = readAutoBackups();
    const today = todayKey();
    if (!force && list[0] && list[0].date === today) return;
    const data = JSON.parse(JSON.stringify(store.data));
    data.activeSession = {
      letter: null,
      state: "idle",
      elapsedMs: 0,
      startedAt: null,
      startedDate: null
    };
    data.settings.restTimerActive = null;
    list.unshift({
      date: today,
      at: new Date().toISOString(),
      sessions: totalSessions(),
      data
    });
    writeAutoBackups(list);
  } catch (e) {}
}
