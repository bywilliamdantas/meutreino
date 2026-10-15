import { store } from "../store.js";
import { fmtW, fromDisp, toDisp, unit, weightStep } from "../utils/format.js";
import { e1rm, isCardio, isPerformed, isWork, roundToStep } from "../utils/numbers.js";
import { sessionsFor } from "../workouts/sessions.js";

export function forEachWorkSet(exId, cb) {
  Object.keys(store.data.sessions)
    .sort()
    .forEach((k) => {
      sessionsFor(k).forEach((sess) => {
        const sets = sess.log && sess.log[exId];
        if (!Array.isArray(sets)) return;
        sets.forEach((s) => {
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
  return has
    ? {
        maxWeight,
        best1rm
      }
    : null;
}

export function exercisePRs(exId) {
  let out = null;
  forEachWorkSet(exId, (s, k) => {
    const e = e1rm(s.weight, s.reps);
    if (!out)
      out = {
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
  const keys = Object.keys(store.data.sessions)
    .filter((k) => k < beforeKey)
    .sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    const arr = sessionsFor(keys[i]);
    for (let j = arr.length - 1; j >= 0; j--) {
      const raw = arr[j].log && arr[j].log[exId];
      if (!Array.isArray(raw)) continue;
      const sets = raw.filter((s) => isWork(s) && isPerformed(s) && s.weight > 0);
      if (sets.length) return sets;
    }
  }
  return null;
}

/* Últimas `limit` sessões (da mais recente para a mais antiga) em que o exercício
   teve séries de trabalho feitas, antes de `beforeKey`. Cada item traz as séries,
   a data e o RPE anotado naquela sessão (sess.meta[exId].rpe), se existir. */
export function recentWorkSessions(exId, beforeKey, limit = 3) {
  const keys = Object.keys(store.data.sessions)
    .filter((k) => k < beforeKey)
    .sort();
  const out = [];
  for (let i = keys.length - 1; i >= 0 && out.length < limit; i--) {
    const arr = sessionsFor(keys[i]);
    for (let j = arr.length - 1; j >= 0 && out.length < limit; j--) {
      const sess = arr[j];
      const raw = sess.log && sess.log[exId];
      if (!Array.isArray(raw)) continue;
      const sets = raw.filter((s) => isWork(s) && isPerformed(s) && s.weight > 0);
      if (!sets.length) continue;
      const rpe = sess.meta && sess.meta[exId] && sess.meta[exId].rpe;
      out.push({
        date: keys[i],
        sets,
        rpe: rpe != null && !isNaN(rpe) ? Number(rpe) : null
      });
    }
  }
  return out;
}

/* Resumo de uma sessão: carga mais alta, reps mínimas nessa carga e melhor 1RM estimado. */
function summarizeSession(item) {
  const top = Math.max(...item.sets.map((s) => s.weight));
  const atTop = item.sets.filter((s) => s.weight === top);
  return {
    top,
    minReps: Math.min(...atTop.map((s) => (s.reps != null ? s.reps : 0))),
    best1rm: Math.max(...item.sets.map((s) => e1rm(s.weight, s.reps))),
    rpe: item.rpe
  };
}

/* Estagnação: 3 sessões seguidas em que as duas mais recentes não superaram (com 0,5% de
   tolerância no 1RM estimado) a mais antiga das três. */
export const STALL_SESSIONS = 3;
export const DELOAD_FACTOR = 0.9;
const STALL_TOLERANCE = 1.005;

export function isStalled(summaries) {
  if (summaries.length < STALL_SESSIONS) return false;
  const [latest, middle, oldest] = summaries;
  return latest.best1rm <= oldest.best1rm * STALL_TOLERANCE && middle.best1rm <= oldest.best1rm * STALL_TOLERANCE;
}

export function suggestNext(ex, beforeKey) {
  if (!ex || isCardio(ex)) return null;
  const target = parseInt(ex.reps, 10);
  if (!target) return null;
  const history = recentWorkSessions(ex.id, beforeKey, STALL_SESSIONS).map(summarizeSession);
  if (!history.length) return null;
  const last = history[0];
  const step = weightStep();
  const hitTarget = last.minReps >= target;

  /* Estagnou em 3 sessões e a última ainda não bateu a meta de reps: deload de ~10%. */
  if (!hitTarget && isStalled(history)) {
    let next = roundToStep(toDisp(last.top) * DELOAD_FACTOR, step);
    if (!(next < toDisp(last.top))) next = toDisp(last.top) - step;
    next = fromDisp(Math.max(next, step));
    return {
      weight: next,
      reps: target,
      deload: true,
      text: `Sugestão: deload ${fmtW(next)} ${unit()} × ${target} (~10% a menos; estagnou em ${STALL_SESSIONS} sessões)`
    };
  }

  if (hitTarget) {
    /* RPE 10 = esforço máximo: segurar a carga; RPE ≤ 6 = sobrou muito: salto maior. */
    if (last.rpe != null && last.rpe >= 10) {
      return {
        weight: last.top,
        reps: target,
        text: `Sugestão: ${fmtW(last.top)} ${unit()} × ${target} (RPE ${last.rpe}: repita a carga)`
      };
    }
    const jump = last.rpe != null && last.rpe <= 6 ? step * 2 : step;
    const next = fromDisp(roundToStep(toDisp(last.top) + jump, 0.1));
    const why = last.rpe != null && last.rpe <= 6 ? `bateu ${target} reps, RPE ${last.rpe}: sobrou` : `bateu ${target} reps`;
    return {
      weight: next,
      reps: target,
      text: `Sugestão: ${fmtW(next)} ${unit()} × ${target} (${why})`
    };
  }
  const reps = Math.min(target, last.minReps + 1);
  return {
    weight: last.top,
    reps,
    text: `Sugestão: ${fmtW(last.top)} ${unit()} × ${reps} (busque +1 rep)`
  };
}
