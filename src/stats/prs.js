import { store } from "../store.js";
import { fmtW, fromDisp, toDisp, unit, weightStep } from "../utils/format.js";
import { e1rm, isCardio, isPerformed, isWork, roundToStep } from "../utils/numbers.js";
import { sessionsFor } from "../workouts/sessions.js";

export function forEachWorkSet(exId, cb) {
  Object.keys(store.data.sessions).sort().forEach(k => {
    sessionsFor(k).forEach(sess => {
      const sets = sess.log && sess.log[exId];
      if (!Array.isArray(sets)) return;
      sets.forEach(s => {
        if (!isWork(s) || !isPerformed(s) || !(s.weight > 0)) return;
        cb(s, k, sess);
      });
    });
  });
}

export function bestBefore(exId, dateKey, sessionId) {
  let has = false,
    maxWeight = 0,
    best1rm = 0;
  forEachWorkSet(exId, (s, k, sess) => {
    if (k > dateKey) return;
    if (k === dateKey && sess.id === sessionId) return;
    has = true;
    if (s.weight > maxWeight) maxWeight = s.weight;
    const e = e1rm(s.weight, s.reps);
    if (e > best1rm) best1rm = e;
  });
  return has ? {
    maxWeight,
    best1rm
  } : null;
}

export function exercisePRs(exId) {
  let out = null;
  forEachWorkSet(exId, (s, k) => {
    const e = e1rm(s.weight, s.reps);
    if (!out) out = {
      maxWeight: s.weight,
      maxWeightDate: k,
      maxWeightReps: s.reps,
      best1rm: e,
      best1rmDate: k,
      lastDate: k
    };
    if (s.weight >= out.maxWeight) {
      out.maxWeight = s.weight;
      out.maxWeightDate = k;
      out.maxWeightReps = s.reps;
    }
    if (e >= out.best1rm) {
      out.best1rm = e;
      out.best1rmDate = k;
    }
    out.lastDate = k;
  });
  return out;
}

export function checkPR(exId, set, sets, idx) {
  if (!(set.weight > 0)) return null;
  const prior = bestBefore(exId, store.overlay.dateKey, store.overlay.sessionId);
  if (!prior) return null;
  let bestW = prior.maxWeight,
    best1 = prior.best1rm;
  sets.forEach((s, i) => {
    if (i === idx || !s.done || !isWork(s) || !(s.weight > 0)) return;
    bestW = Math.max(bestW, s.weight);
    best1 = Math.max(best1, e1rm(s.weight, s.reps));
  });
  if (set.weight > bestW + 1e-9) return `Novo recorde de carga: ${fmtW(set.weight)} ${unit()}`;
  const e = e1rm(set.weight, set.reps);
  if (e > best1 + 0.05) return `Novo recorde de 1RM estimado: ${fmtW(e)} ${unit()}`;
  return null;
}

export function lastWorkSets(exId, beforeKey) {
  const keys = Object.keys(store.data.sessions).filter(k => k < beforeKey).sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    const arr = sessionsFor(keys[i]);
    for (let j = arr.length - 1; j >= 0; j--) {
      const raw = arr[j].log && arr[j].log[exId];
      if (!Array.isArray(raw)) continue;
      const sets = raw.filter(s => isWork(s) && isPerformed(s) && s.weight > 0);
      if (sets.length) return sets;
    }
  }
  return null;
}

export function suggestNext(ex, beforeKey) {
  if (!ex || isCardio(ex)) return null;
  const target = parseInt(ex.reps, 10);
  if (!target) return null;
  const sets = lastWorkSets(ex.id, beforeKey);
  if (!sets) return null;
  const top = Math.max(...sets.map(s => s.weight));
  const atTop = sets.filter(s => s.weight === top);
  const minReps = Math.min(...atTop.map(s => s.reps != null ? s.reps : 0));
  if (minReps >= target) {
    const next = fromDisp(roundToStep(toDisp(top) + weightStep(), 0.1));
    return {
      weight: next,
      reps: target,
      text: `Sugestão: ${fmtW(next)} ${unit()} × ${target} (bateu ${target} reps)`
    };
  }
  const reps = Math.min(target, minReps + 1);
  return {
    weight: top,
    reps,
    text: `Sugestão: ${fmtW(top)} ${unit()} × ${reps} (busque +1 rep)`
  };
}
