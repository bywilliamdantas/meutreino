// Testes da sequência de semanas: computeWeeklyStreak (ligação com o store, a meta,
// o início da semana e o descanso) + casos de borda de weeklyStreak.
// (A antiga computeStreak foi removida na v8.4; esta é a substituta.)
// node --test tests/streak.test.mjs
import test, { beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { store } from "../src/store.js";
import { computeWeeklyStreak } from "../src/workouts/sessions.js";
import { weeklyStreak } from "../src/workouts/weekly-goal.js";

/* "Hoje" fixo: quinta, 08/10/2026 (meio-dia local). */
const NOW = new Date("2026-10-08T12:00:00");

function setup({ goal = 2, mondayStart = true, order = ["A", "B", "R"] } = {}) {
  store.data.order = order;
  store.data.workouts = {
    A: { name: "A", exercises: [] },
    B: { name: "B", exercises: [] },
    C: { name: "C", exercises: [] },
    R: { name: "Descanso", isRest: true, exercises: [] }
  };
  store.data.settings.weeklyGoal = goal;
  store.data.settings.weekStartsMonday = mondayStart;
  store.data.sessions = {};
}

const add = (date, letter = "A") => {
  (store.data.sessions[date] ||= []).push({ id: `s${date}${letter}`, letter, log: {} });
};

beforeEach(() => {
  mock.timers.enable({ apis: ["Date"], now: NOW });
  setup();
});
afterEach(() => mock.timers.reset());

test("computeWeeklyStreak: sem sessões → 0", () => {
  assert.equal(computeWeeklyStreak(), 0);
});

test("computeWeeklyStreak: semanas seguidas batendo a meta (início segunda)", () => {
  // Semanas: 21/09, 28/09 e 05/10 (atual, já bateu a meta de 2)
  add("2026-09-22");
  add("2026-09-24");
  add("2026-09-29");
  add("2026-10-01");
  add("2026-10-06");
  add("2026-10-07");
  assert.equal(computeWeeklyStreak(), 3);
});

test("computeWeeklyStreak: semana atual em andamento não quebra a sequência", () => {
  add("2026-09-29");
  add("2026-10-01"); // semana anterior ok
  add("2026-10-06"); // semana atual: 1 de 2 (ainda dá tempo)
  assert.equal(computeWeeklyStreak(), 1);
});

test("computeWeeklyStreak: semana passada abaixo da meta zera a sequência", () => {
  add("2026-09-29"); // 1 de 2 na semana passada
  add("2026-10-06");
  add("2026-10-07"); // semana atual ok
  assert.equal(computeWeeklyStreak(), 1); // só a atual conta
});

test("computeWeeklyStreak: respeita weekStartsMonday", () => {
  // Dom 04/10 + seg 05/10 + ter 06/10, meta 2, hoje quinta 08/10.
  add("2026-10-04");
  add("2026-10-05");
  add("2026-10-06");
  // Início domingo: os 3 treinos caem na mesma semana (3 ≥ 2) → sequência 1.
  store.data.settings.weekStartsMonday = false;
  assert.equal(computeWeeklyStreak(), 1);
  // Início segunda: domingo fica na semana anterior (1 de 2, não bateu) e a atual tem 2 → ainda 1,
  // mas sem o treino de domingo a semana atual continuaria batendo; confirma a divisão pelo dia:
  store.data.settings.weekStartsMonday = true;
  store.data.sessions = {};
  add("2026-10-04");
  add("2026-10-05");
  assert.equal(computeWeeklyStreak(), 0); // 1 na semana anterior + 1 na atual: nenhuma bate a meta 2
  store.data.settings.weekStartsMonday = false;
  assert.equal(computeWeeklyStreak(), 1); // com início domingo, os 2 estão na mesma semana
});

test("computeWeeklyStreak: dias de descanso não contam para a meta", () => {
  add("2026-10-06", "A");
  add("2026-10-07", "R");
  add("2026-10-08", "R");
  assert.equal(computeWeeklyStreak(), 0); // só 1 treino de verdade
  add("2026-10-08", "B");
  assert.equal(computeWeeklyStreak(), 1);
});

test("computeWeeklyStreak: meta null usa o padrão (treinos sem descanso no ciclo)", () => {
  setup({ goal: null, order: ["A", "B", "C", "R"] }); // padrão = 3
  add("2026-10-05");
  add("2026-10-06");
  assert.equal(computeWeeklyStreak(), 0);
  add("2026-10-07");
  assert.equal(computeWeeklyStreak(), 1);
});

test("computeWeeklyStreak: duas sessões no mesmo dia contam as duas", () => {
  add("2026-10-06", "A");
  add("2026-10-06", "B");
  assert.equal(computeWeeklyStreak(), 1);
});

test("weeklyStreak: entradas inválidas e formato antigo não quebram", () => {
  const now = new Date("2026-10-08T12:00:00");
  assert.equal(weeklyStreak({ sessions: undefined, goal: 1, now }), 0);
  assert.equal(weeklyStreak({ sessions: {}, goal: 1, now }), 0);
  // formato antigo: um objeto por dia (não array)
  assert.equal(weeklyStreak({ sessions: { "2026-10-06": { letter: "A" } }, goal: 1, now, mondayStart: true }), 1);
  // chave de data inválida é ignorada
  assert.equal(weeklyStreak({ sessions: { lixo: [{ letter: "A" }] }, goal: 1, now }), 0);
});

test("weeklyStreak: meta inválida cai no mínimo (1)", () => {
  const now = new Date("2026-10-08T12:00:00");
  const sessions = { "2026-10-06": [{ letter: "A" }] };
  assert.equal(weeklyStreak({ sessions, goal: "abc", now, mondayStart: true }), 1);
  assert.equal(weeklyStreak({ sessions, goal: 0, now, mondayStart: true }), 1);
});
