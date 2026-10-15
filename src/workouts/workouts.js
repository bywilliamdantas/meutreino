import { MUSCLE_GROUPS } from "../data/muscle-groups.js";
import { store } from "../store.js";
import { isCardio, parseNum } from "../utils/numbers.js";
import { nextInCycle } from "./cycle.js";
import { isRestLetter, sessionsFor } from "./sessions.js";

export function workoutLabel(key) {
  const w = store.data.workouts[key];
  if (!w) return key;
  return w.isRest ? "descanso" : `Treino ${key}`;
}

export function categoryForWorkout(w) {
  if (!w) return "Outros";
  if (w.isRest) return "Descanso";
  const name = w.name || "";
  for (const g of MUSCLE_GROUPS) {
    if (g.test.test(name)) return g.cat;
  }
  return "Outros";
}

export function estimateWorkoutMs(w) {
  if (!w || w.isRest || !w.exercises || !w.exercises.length) return 0;
  let total = 0;
  w.exercises.forEach((ex) => {
    if (isCardio(ex)) {
      total += (parseNum(ex.mins) || 20) * 60000;
    } else {
      const sets = parseNum(ex.sets) || 3;
      const rest = parseNum(ex.rest) || 60;
      total += sets * (rest + 40) * 1000;
    }
  });
  return total;
}

export function nextWorkoutLetter() {
  const order = store.data.order.filter((k) => !isRestLetter(k));
  if (!order.length) return store.data.order[0];
  return nextInCycle(order, performedLetters());
}

/* Letras das sessões não-descanso, da mais antiga para a mais nova. */
function performedLetters() {
  const out = [];
  Object.keys(store.data.sessions)
    .sort()
    .forEach((k) => {
      sessionsFor(k).forEach((s) => {
        if (s.letter && !isRestLetter(s.letter)) out.push(s.letter);
      });
    });
  return out;
}

export function nextAvailableLetter() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const ch of alphabet) {
    if (!store.data.order.includes(ch)) return ch;
  }
  return null;
}

/* ============================================================
   INIT
   ============================================================ */
