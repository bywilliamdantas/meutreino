import { EXERCISE_LIBRARY } from "../data/exercise-library.js";
import { store } from "../store.js";
import { isCardio, isWork } from "../utils/numbers.js";
import { sessionsFor } from "../workouts/sessions.js";

export function isCardioName(name) {
  const n = String(name || "").trim().toLowerCase();
  return !!n && (EXERCISE_LIBRARY["Cardio"] || []).some(c => c.toLowerCase() === n);
}

export function getLibraryNameSet() {
  const set = new Set();
  Object.values(EXERCISE_LIBRARY).forEach(arr => arr.forEach(n => set.add(n.toLowerCase())));
  return set;
}

export function getCustomExerciseNames() {
  const libSet = getLibraryNameSet();
  const names = new Set();
  Object.values(store.data.workouts).forEach(w => {
    (w.exercises || []).forEach(ex => {
      const n = (ex.name || "").trim();
      if (n && !libSet.has(n.toLowerCase())) names.add(n);
    });
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getAllExerciseNames() {
  const names = new Set();
  Object.values(EXERCISE_LIBRARY).forEach(arr => arr.forEach(n => names.add(n)));
  getCustomExerciseNames().forEach(n => names.add(n));
  return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function findExercise(exId) {
  for (const w of Object.values(store.data.workouts)) {
    const ex = (w.exercises || []).find(e => e.id === exId);
    if (ex) return ex;
  }
  return null;
}

export function lastLoggedValue(exId, beforeKey) {
  const keys = Object.keys(store.data.sessions).filter(k => k < beforeKey).sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    const arr = sessionsFor(keys[i]);
    for (let j = arr.length - 1; j >= 0; j--) {
      const rawSets = arr[j].log && arr[j].log[exId];
      const sets = Array.isArray(rawSets) ? rawSets.filter(x => x && x.type !== "warm" && x.type !== "drop") : null;
      if (sets && sets.length) {
        const last = sets[sets.length - 1];
        if (last && (last.weight != null || last.reps != null || last.minutes != null)) return last;
      }
    }
  }
  return null;
}

export function exerciseHistory(exId) {
  const ex = findExercise(exId);
  const cardio = isCardio(ex);
  const out = [];
  Object.keys(store.data.sessions).sort().forEach(k => {
    const arr = sessionsFor(k);
    const allSets = [];
    arr.forEach(sess => {
      const sets = sess.log && sess.log[exId];
      if (Array.isArray(sets)) allSets.push(...sets.filter(isWork));
    });
    if (allSets.length === 0) return;
    if (cardio) {
      const minutes = allSets.map(s => s.minutes).filter(v => v != null && !isNaN(v));
      if (minutes.length === 0) return;
      out.push({
        date: k,
        minutes: Math.max(...minutes),
        totalMinutes: minutes.reduce((a, b) => a + b, 0),
        weight: null,
        reps: null
      });
      return;
    }
    const weights = allSets.map(s => s.weight).filter(w => w != null);
    const reps = allSets.map(s => s.reps).filter(r => r != null);
    const maxWeight = weights.length ? Math.max(...weights) : null;
    const totalReps = reps.length ? reps.reduce((a, b) => a + b, 0) : null;
    if (maxWeight == null && totalReps == null) return;
    out.push({
      date: k,
      weight: maxWeight,
      reps: totalReps
    });
  });
  return out;
}

export function daysSince(iso) {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return Infinity;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

export function restForExercise(exId) {
  const ex = findExercise(exId);
  if (ex) {
    const n = parseInt(ex.rest, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return store.data.settings.restDuration || 90;
}

export function muscleGroupOf(name) {
  if (!name) return "Outros";
  if (!store._libGroupMap) {
    store._libGroupMap = {};
    Object.keys(EXERCISE_LIBRARY).forEach(g => EXERCISE_LIBRARY[g].forEach(n => {
      store._libGroupMap[n.toLowerCase()] = g;
    }));
  }
  return store._libGroupMap[String(name).trim().toLowerCase()] || "Outros";
}
