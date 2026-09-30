import { store } from "../store.js";
import { dateKeyFromDate, todayKey } from "../utils/format.js";
import { isPerformed, isWork } from "../utils/numbers.js";

export function sessionsFor(dateKey) {
  const v = store.data.sessions[dateKey];
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

export function firstSessionFor(dateKey) {
  return sessionsFor(dateKey)[0] || null;
}

export function sessionLetter(key) {
  const first = firstSessionFor(key);
  return first ? first.letter || null : null;
}

export function sessionLog(key) {
  const first = firstSessionFor(key);
  return first ? first.log || {} : {};
}

export function lastSessionEntry() {
  const keys = Object.keys(store.data.sessions).sort();
  if (keys.length === 0) return null;
  for (let i = keys.length - 1; i >= 0; i--) {
    const arr = sessionsFor(keys[i]);
    if (arr.length) {
      const last = arr[arr.length - 1];
      return {
        date: keys[i],
        letter: last.letter
      };
    }
  }
  return null;
}

export function isRestLetter(letter) {
  return !!(letter && store.data.workouts[letter] && store.data.workouts[letter].isRest);
}

export function lastNonRestSessionEntry() {
  const keys = Object.keys(store.data.sessions).sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    const arr = sessionsFor(keys[i]);
    for (let j = arr.length - 1; j >= 0; j--) {
      if (!isRestLetter(arr[j].letter)) return {
        date: keys[i],
        letter: arr[j].letter
      };
    }
  }
  return null;
}

export function dayHasTraining(dateKey) {
  return sessionsFor(dateKey).some(s => !isRestLetter(s.letter));
}

export function computeStreak() {
  let cursor = new Date();
  if (!dayHasTraining(todayKey())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (dayHasTraining(dateKeyFromDate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function totalSessions() {
  let n = 0;
  Object.keys(store.data.sessions).forEach(k => n += sessionsFor(k).length);
  return n;
}

export function totalDays() {
  return Object.keys(store.data.sessions).length;
}

export function sessionsThisMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  let c = 0;
  for (const key of Object.keys(store.data.sessions)) {
    const [ky, km] = key.split("-").map(Number);
    if (ky === y && km === m) c += sessionsFor(key).filter(s => !isRestLetter(s.letter)).length;
  }
  return c;
}

export function sessionsThisWeek() {
  const now = new Date();
  const day = now.getDay();
  const offset = store.data.settings.weekStartsMonday ? day === 0 ? 6 : day - 1 : day;
  const start = new Date(now);
  start.setDate(now.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  let c = 0;
  for (const key of Object.keys(store.data.sessions)) {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt >= start) c += sessionsFor(key).filter(s => !isRestLetter(s.letter)).length;
  }
  return c;
}

export function sessionDurationMs(session) {
  if (!session || !session.startedAt || !session.endedAt) return null;
  const ms = session.endedAt - session.startedAt;
  if (ms <= 0) return null;
  return ms;
}

export function totalDurationForDay(dateKey) {
  const arr = sessionsFor(dateKey);
  let total = 0;
  arr.forEach(s => {
    const ms = sessionDurationMs(s);
    if (ms) total += ms;
  });
  return total > 0 ? total : null;
}

export function computeSessionIntensity(w, log) {
  if (!w || w.isRest || !w.exercises || !w.exercises.length) return null;
  let total = 0,
    done = 0;
  w.exercises.forEach(ex => {
    const sets = log && log[ex.id] || [];
    sets.forEach(s => {
      if (!isWork(s)) return;
      total++;
      if (isPerformed(s)) done++;
    });
  });
  if (total === 0) return null;
  const ratio = done / total;
  if (ratio >= 0.9) return "Alta";
  if (ratio >= 0.5) return "Média";
  return "Baixa";
}
