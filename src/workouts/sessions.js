import { store } from "../store.js";
import { isWork } from "../utils/numbers.js";
import { defaultWeeklyGoal, resolveWeeklyGoal, weeklyStreak, weekSessionCount } from "./weekly-goal.js";

export function sessionsFor(dateKey) {
  const v = store.data.sessions[dateKey];
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

/* Uma sessão "tem registro" quando alguma série foi guardada nela. */
export function sessionHasData(log) {
  return Object.values(log || {}).some((sets) => Array.isArray(sets) && sets.length > 0);
}

/* Foto do treino no momento do registro: nomes, tipos e metas das séries.
   Serve para o histórico não mudar quando o treino é editado depois. */
export function snapshotExercises(letter, onlyIds) {
  const w = store.data.workouts[letter];
  if (!w || w.isRest) return [];
  return (w.exercises || [])
    .filter((ex) => !onlyIds || onlyIds.has(ex.id))
    .map((ex) => {
      const o = {
        id: ex.id,
        name: ex.name || "",
        type: ex.type || "strength"
      };
      if (ex.sets !== undefined) o.sets = ex.sets;
      if (ex.reps !== undefined) o.reps = ex.reps;
      if (ex.rest !== undefined) o.rest = ex.rest;
      if (ex.mins !== undefined) o.mins = ex.mins;
      if (ex.group) o.group = ex.group;
      if (ex.ss) o.ss = true;
      if (ex.link) o.link = ex.link;
      return o;
    });
}

/* Registra a foto do treino na sessão (só quando há séries e ainda não está finalizada ou sem foto). */
export function stampSnapshot(sess) {
  if (!sess || !sessionHasData(sess.log)) return;
  if (sess.snapshot && sess.endedAt) return;
  sess.snapshot = snapshotExercises(sess.letter);
}

export function snapshotExercise(sess, exId) {
  return sess && Array.isArray(sess.snapshot) ? sess.snapshot.find((e) => e.id === exId) || null : null;
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
      if (!isRestLetter(arr[j].letter))
        return {
          date: keys[i],
          letter: arr[j].letter
        };
    }
  }
  return null;
}

export function dayHasTraining(dateKey) {
  return sessionsFor(dateKey).some((s) => !isRestLetter(s.letter));
}

/* Meta semanal padrão = treinos que não são descanso no ciclo. */
export function autoWeeklyGoal() {
  return defaultWeeklyGoal(store.data.order, isRestLetter);
}

/* Meta semanal efetiva (Ajustes → Treino) ou, se não definida, a padrão. */
export function currentWeeklyGoal() {
  return resolveWeeklyGoal(store.data.settings.weeklyGoal, store.data.order, isRestLetter);
}

/* Semanas seguidas em que a meta foi batida (descanso não conta; respeita weekStartsMonday). */
export function computeWeeklyStreak() {
  return weeklyStreak({
    sessions: store.data.sessions,
    goal: currentWeeklyGoal(),
    now: new Date(),
    mondayStart: !!store.data.settings.weekStartsMonday,
    isRest: isRestLetter
  });
}

export function totalSessions() {
  let n = 0;
  Object.keys(store.data.sessions).forEach((k) => (n += sessionsFor(k).length));
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
    if (ky === y && km === m) c += sessionsFor(key).filter((s) => !isRestLetter(s.letter)).length;
  }
  return c;
}

export function sessionsThisWeek() {
  return weekSessionCount({
    sessions: store.data.sessions,
    now: new Date(),
    mondayStart: !!store.data.settings.weekStartsMonday,
    isRest: isRestLetter
  });
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
  arr.forEach((s) => {
    const ms = sessionDurationMs(s);
    if (ms) total += ms;
  });
  return total > 0 ? total : null;
}

/* Série "feita" para fins de intensidade: marcada com ✓ OU com carga/reps/minutos preenchidos.
   (Antes, `done: false` anulava os valores digitados e toda sessão em que o ✓ não era tocado
   virava "Baixa".) Séries vazias e não marcadas não contam. */
export function isSetCounted(s) {
  if (!s) return false;
  if (s.done === true) return true;
  return s.weight != null || s.reps != null || s.minutes != null;
}

/* Volume (carga × reps) das séries de trabalho de força. */
export function sessionVolume(log) {
  let v = 0;
  Object.values(log || {}).forEach((sets) => {
    if (!Array.isArray(sets)) return;
    sets.forEach((s) => {
      if (isWork(s) && isSetCounted(s) && s.weight > 0 && s.reps > 0) v += s.weight * s.reps;
    });
  });
  return v;
}

/* Últimas sessões do MESMO treino (antes de beforeKey) com volume registrado: base de comparação. */
export function intensityBaseline(letter, beforeKey, limit = 5) {
  const keys = Object.keys(store.data.sessions)
    .filter((k) => k < beforeKey)
    .sort()
    .reverse();
  const out = [];
  for (const k of keys) {
    const arr = sessionsFor(k).slice().reverse();
    for (const sess of arr) {
      if (!sess || sess.letter !== letter) continue;
      const volume = sessionVolume(sess.log);
      if (!(volume > 0)) continue;
      out.push({ volume, durationMs: sessionDurationMs(sess) });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mean = (a) => a.reduce((t, x) => t + x, 0) / a.length;
const MIN_DENSITY_MS = 10 * 60000;

/* Intensidade da sessão = quanto do treino foi feito + quão pesado/duro foi.
   - Completude: séries feitas ÷ séries do treino. Menos de 50% = Baixa, sempre.
   - Esforço (usa o que existir, cada sinal vai de 0 a 1):
       · RPE médio dos exercícios (RPE 5 = 0 … RPE 9 = 1);
       · volume (carga × reps) comparado à média das últimas sessões do mesmo treino
         (70% da média = 0, igual = 0,5, 130% = 1);
       · densidade: volume por minuto, comparado do mesmo jeito (só com duração conhecida).
   - Nota = 30% completude + 70% esforço médio → Alta ≥ 0,70 · Média ≥ 0,45 · Baixa abaixo.
   - Sem RPE e sem histórico ainda: só a completude (≥ 90% Alta; ≥ 50% Média).
   opts: { meta: {exId:{rpe}}, history: intensityBaseline(...), durationMs } — todos opcionais. */
export function sessionIntensityDetail(w, log, opts = {}) {
  if (!w || w.isRest || !w.exercises || !w.exercises.length) return null;
  let total = 0,
    done = 0;
  w.exercises.forEach((ex) => {
    const sets = (log && log[ex.id]) || [];
    sets.forEach((s) => {
      if (!isWork(s)) return;
      total++;
      if (isSetCounted(s)) done++;
    });
  });
  if (total === 0) return null;
  const completion = done / total;
  const detail = { label: "Baixa", score: null, completion, rpe: null, volumeRatio: null, densityRatio: null };
  const signals = [];

  const meta = opts.meta || {};
  const rpes = w.exercises.map((ex) => meta[ex.id] && meta[ex.id].rpe).filter((r) => typeof r === "number" && r > 0);
  if (rpes.length) {
    detail.rpe = mean(rpes);
    signals.push(clamp01((detail.rpe - 5) / 4));
  }

  const hist = Array.isArray(opts.history) ? opts.history : [];
  const vol = sessionVolume(log);
  if (hist.length && vol > 0) {
    detail.volumeRatio = vol / mean(hist.map((h) => h.volume));
    signals.push(clamp01((detail.volumeRatio - 0.7) / 0.6));
  }
  const dur = opts.durationMs;
  if (vol > 0 && dur >= MIN_DENSITY_MS) {
    const hd = hist.filter((h) => h.durationMs >= MIN_DENSITY_MS);
    if (hd.length) {
      const base = mean(hd.map((h) => h.volume / (h.durationMs / 60000)));
      detail.densityRatio = vol / (dur / 60000) / base;
      signals.push(clamp01((detail.densityRatio - 0.7) / 0.6));
    }
  }

  if (completion < 0.5) {
    detail.label = "Baixa";
  } else if (!signals.length) {
    detail.label = completion >= 0.9 ? "Alta" : "Média";
  } else {
    detail.score = 0.3 * completion + 0.7 * mean(signals);
    detail.label = detail.score >= 0.7 ? "Alta" : detail.score >= 0.45 ? "Média" : "Baixa";
  }
  return detail;
}

export function computeSessionIntensity(w, log, opts) {
  const d = sessionIntensityDetail(w, log, opts);
  return d ? d.label : null;
}

/* Texto curto que explica a nota (vai no title/tooltip da estatística). */
export function describeIntensity(d) {
  if (!d) return "";
  const parts = [`${Math.round(d.completion * 100)}% das séries feitas`];
  if (d.rpe != null) parts.push(`RPE médio ${d.rpe.toFixed(1).replace(".", ",")}`);
  const pct = (r) => `${r >= 1 ? "+" : "−"}${Math.abs(Math.round((r - 1) * 100))}%`;
  if (d.volumeRatio != null) parts.push(`volume ${pct(d.volumeRatio)} vs. média recente`);
  if (d.densityRatio != null) parts.push(`ritmo ${pct(d.densityRatio)} vs. média recente`);
  return parts.join(" · ");
}
