import { findExercise, muscleGroupOf } from "../exercises/exercises.js";
import { store } from "../store.js";
import { dateKeyFromDate } from "../utils/format.js";
import { isCardio, isPerformed, isWork } from "../utils/numbers.js";
import { sessionsFor } from "../workouts/sessions.js";
import { exercisePRs } from "./prs.js";

export function weekStartOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const offset = store.data.settings.weekStartsMonday ? day === 0 ? 6 : day - 1 : day;
  x.setDate(x.getDate() - offset);
  return x;
}

export function forEachLoggedSet(cb) {
  Object.keys(store.data.sessions).forEach(k => {
    sessionsFor(k).forEach(sess => {
      if (store.data.workouts[sess.letter] && store.data.workouts[sess.letter].isRest) return;
      Object.keys(sess.log || {}).forEach(exId => {
        const arr = sess.log[exId];
        if (!Array.isArray(arr)) return;
        const ex = findExercise(exId) || (Array.isArray(sess.snapshot) ? sess.snapshot.find(e => e.id === exId) : null);
        arr.forEach(s => cb(s, k, ex, sess));
      });
    });
  });
}

export function collectStats(days) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const startKey = dateKeyFromDate(start),
    endKey = dateKeyFromDate(end);
  const groups = {};
  let volume = 0,
    sets = 0,
    cardioMin = 0;
  const sessionIds = new Set();
  forEachLoggedSet((s, k, ex, sess) => {
    if (k < startKey || k > endKey) return;
    if (!isPerformed(s)) return;
    if (isCardio(ex)) {
      if (s.minutes != null) cardioMin += s.minutes;
      sessionIds.add(sess.id);
      return;
    }
    if (!isWork(s)) return;
    sessionIds.add(sess.id);
    sets++;
    const g = muscleGroupOf(ex && ex.name);
    groups[g] = (groups[g] || 0) + 1;
    if (s.weight > 0 && s.reps > 0) volume += s.weight * s.reps;
  });
  return {
    volume,
    sets,
    cardioMin,
    sessions: sessionIds.size,
    groups
  };
}

export function weeklyVolume(n) {
  const first = weekStartOf(new Date());
  first.setDate(first.getDate() - 7 * (n - 1));
  const buckets = Array.from({
    length: n
  }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + 7 * i);
    return {
      start: d,
      volume: 0
    };
  });
  forEachLoggedSet((s, k, ex) => {
    if (isCardio(ex) || !isWork(s) || !isPerformed(s) || !(s.weight > 0 && s.reps > 0)) return;
    const [y, m, d] = k.split("-").map(Number);
    const idx = Math.round((weekStartOf(new Date(y, m - 1, d)) - first) / 86400000 / 7);
    if (idx >= 0 && idx < n) buckets[idx].volume += s.weight * s.reps;
  });
  return buckets;
}

export function collectRecords() {
  const out = [];
  store.data.order.forEach(key => {
    const w = store.data.workouts[key];
    if (!w || w.isRest) return;
    let best = null;
    (w.exercises || []).forEach(ex => {
      if (isCardio(ex) || !ex.name) return;
      const pr = exercisePRs(ex.id);
      if (!pr) return;
      if (!best || pr.maxWeightDate > best.pr.maxWeightDate || pr.maxWeightDate === best.pr.maxWeightDate && pr.maxWeight > best.pr.maxWeight) {
        best = {
          ex,
          pr,
          key
        };
      }
    });
    if (best) out.push(best);
  });
  return out;
}
