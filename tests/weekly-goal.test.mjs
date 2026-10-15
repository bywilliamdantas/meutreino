// Testes unitários da meta semanal e da sequência de semanas (funções puras).
// Rodam sem build e sem navegador: node --test tests/weekly-goal.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { defaultWeeklyGoal, normalizeGoal, resolveWeeklyGoal, startOfWeek, weekSessionCount, weeklyStreak } from "../src/workouts/weekly-goal.js";

const isRest = (letter) => letter === "R";

/* Monta { "AAAA-MM-DD": [{letter}] } a partir de "AAAA-MM-DD" ou "AAAA-MM-DD:R". */
function sessionsOf(...entries) {
  const out = {};
  for (const e of entries) {
    const [key, letter = "A"] = e.split(":");
    (out[key] ||= []).push({ letter });
  }
  return out;
}

const d = (s) => new Date(`${s}T12:00:00`); // meio-dia local: sem ambiguidade de fuso
const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Calendário de referência (outubro de 2026):
//   dom 04 | seg 05 | ter 06 | qua 07 | qui 08 | sex 09 | sáb 10 | dom 11 | seg 12
const QUI = d("2026-10-08");

/* ---------- início da semana ---------- */

test("startOfWeek: domingo e segunda como início", () => {
  assert.equal(key(startOfWeek(QUI, false)), "2026-10-04"); // quinta -> domingo anterior
  assert.equal(key(startOfWeek(QUI, true)), "2026-10-05"); // quinta -> segunda anterior
  assert.equal(key(startOfWeek(d("2026-10-04"), false)), "2026-10-04"); // domingo é o próprio início
  assert.equal(key(startOfWeek(d("2026-10-04"), true)), "2026-09-28"); // domingo é o fim da semana (início seg)
  assert.equal(key(startOfWeek(d("2026-10-05"), true)), "2026-10-05"); // segunda é o próprio início
});

test("startOfWeek: atravessa mês e ano", () => {
  assert.equal(key(startOfWeek(d("2027-01-01"), true)), "2026-12-28"); // sexta
  assert.equal(key(startOfWeek(d("2027-01-01"), false)), "2026-12-27");
});

/* ---------- meta ---------- */

test("defaultWeeklyGoal: conta só treinos que não são descanso no ciclo", () => {
  assert.equal(defaultWeeklyGoal(["A", "B", "C"], isRest), 3);
  assert.equal(defaultWeeklyGoal(["A", "R", "B", "R", "C"], isRest), 3);
  assert.equal(defaultWeeklyGoal(["R"], isRest), 1); // nunca abaixo do mínimo
  assert.equal(defaultWeeklyGoal([], isRest), 1);
  assert.equal(defaultWeeklyGoal(undefined, isRest), 1);
});

test("resolveWeeklyGoal: usa a meta escolhida; sem ela, o padrão do ciclo", () => {
  const order = ["A", "B", "C", "R"];
  assert.equal(resolveWeeklyGoal(5, order, isRest), 5);
  assert.equal(resolveWeeklyGoal(null, order, isRest), 3);
  assert.equal(resolveWeeklyGoal(undefined, order, isRest), 3);
  assert.equal(resolveWeeklyGoal("", order, isRest), 3);
  assert.equal(resolveWeeklyGoal("abc", order, isRest), 3);
  assert.equal(resolveWeeklyGoal(0, order, isRest), 3); // 0 não é meta válida
  assert.equal(resolveWeeklyGoal(99, order, isRest), 14); // limitada ao máximo
});

test("normalizeGoal: inteiro entre 1 e 14", () => {
  assert.equal(normalizeGoal(2.6), 3);
  assert.equal(normalizeGoal(-4), 1);
  assert.equal(normalizeGoal(NaN), 1);
  assert.equal(normalizeGoal(100), 14);
});

/* ---------- contagem da semana ---------- */

test("weekSessionCount: ignora descanso e conta várias sessões no mesmo dia", () => {
  const sessions = sessionsOf("2026-10-05", "2026-10-06:R", "2026-10-07", "2026-10-07");
  assert.equal(weekSessionCount({ sessions, now: QUI, mondayStart: true, isRest }), 3);
});

test("weekSessionCount: aceita o formato antigo (objeto único por dia)", () => {
  const sessions = { "2026-10-05": { letter: "A" }, "2026-10-06": { letter: "R" } };
  assert.equal(weekSessionCount({ sessions, now: QUI, mondayStart: true, isRest }), 1);
});

/* ---------- virada de semana ---------- */

test("virada de semana (início domingo): domingo abre a semana nova", () => {
  // Sáb 10/10 fecha a semana 04-10; dom 11/10 já é a semana seguinte.
  const sessions = sessionsOf("2026-10-10", "2026-10-11");
  const sat = d("2026-10-10");
  const sun = d("2026-10-11");
  assert.equal(weekSessionCount({ sessions, now: sat, mondayStart: false, isRest }), 1);
  assert.equal(weekSessionCount({ sessions, now: sun, mondayStart: false, isRest }), 1);
});

test("virada de semana (início segunda): domingo fecha a semana, segunda abre a nova", () => {
  const sessions = sessionsOf("2026-10-10", "2026-10-11", "2026-10-12");
  assert.equal(weekSessionCount({ sessions, now: d("2026-10-11"), mondayStart: true, isRest }), 2); // sáb+dom
  assert.equal(weekSessionCount({ sessions, now: d("2026-10-12"), mondayStart: true, isRest }), 1); // só seg
});

test("virada de semana: sequência que cruza a virada do ano", () => {
  // Meta 2. Semanas (início seg): 21-27/12, 28/12-03/01 (cruza o ano), 04-10/01.
  const sessions = sessionsOf("2026-12-22", "2026-12-24", "2026-12-29", "2027-01-02", "2027-01-05", "2027-01-07");
  const now = d("2027-01-08");
  assert.equal(weeklyStreak({ sessions, goal: 2, now, mondayStart: true, isRest }), 3);
});

test("virada de semana: semana atual ainda em andamento não quebra a sequência", () => {
  // Meta 2. Duas semanas fechadas batidas; hoje é segunda e ainda não treinou.
  const sessions = sessionsOf("2026-09-29", "2026-10-01", "2026-10-06", "2026-10-08");
  const now = d("2026-10-12"); // segunda: semana nova, zerada
  assert.equal(weeklyStreak({ sessions, goal: 2, now, mondayStart: true, isRest }), 2);
});

test("virada de semana: bater a meta na semana atual soma +1", () => {
  const sessions = sessionsOf("2026-09-29", "2026-10-01", "2026-10-06", "2026-10-08");
  const now = d("2026-10-12");
  const withCurrent = { ...sessions, ...sessionsOf("2026-10-12", "2026-10-13") };
  assert.equal(weeklyStreak({ sessions: withCurrent, goal: 2, now: d("2026-10-13"), mondayStart: true, isRest }), 3);
  assert.equal(weeklyStreak({ sessions, goal: 2, now, mondayStart: true, isRest }), 2);
});

/* ---------- semana sem treino ---------- */

test("semana sem treino no meio quebra a sequência", () => {
  // Meta 2. Semanas (início seg): 28/09 ok | 05/10 vazia | 12/10 ok | 19/10 (atual) ok.
  const sessions = sessionsOf("2026-09-29", "2026-10-01", "2026-10-13", "2026-10-15", "2026-10-20", "2026-10-22");
  const now = d("2026-10-22");
  assert.equal(weeklyStreak({ sessions, goal: 2, now, mondayStart: true, isRest }), 2);
});

test("sem nenhum treino: sequência 0", () => {
  assert.equal(weeklyStreak({ sessions: {}, goal: 3, now: QUI, mondayStart: true, isRest }), 0);
  assert.equal(weeklyStreak({ sessions: undefined, goal: 3, now: QUI, mondayStart: true, isRest }), 0);
});

test("semana anterior sem treino: sequência 0 mesmo com a atual em andamento", () => {
  const sessions = sessionsOf("2026-10-06"); // só 1 treino esta semana, meta 3
  assert.equal(weeklyStreak({ sessions, goal: 3, now: QUI, mondayStart: true, isRest }), 0);
});

test("semana só com descanso conta como semana sem treino", () => {
  // Meta 1. Semana passada só teve descanso -> não bateu a meta.
  const sessions = sessionsOf("2026-09-29:R", "2026-09-30:R", "2026-10-06");
  assert.equal(weeklyStreak({ sessions, goal: 1, now: QUI, mondayStart: true, isRest }), 1);
});

test("descanso não ajuda a bater a meta", () => {
  // Meta 3: dois treinos + dois descansos = 2 treinos, não bate.
  const sessions = sessionsOf("2026-10-05", "2026-10-06:R", "2026-10-07", "2026-10-08:R");
  assert.equal(weekSessionCount({ sessions, now: QUI, mondayStart: true, isRest }), 2);
  assert.equal(weeklyStreak({ sessions, goal: 3, now: QUI, mondayStart: true, isRest }), 0);
});

test("dias de descanso planejados não quebram a sequência semanal", () => {
  // Caso real do pedido: ciclo A/B/C com folgas no meio, meta 3 (seg/qua/sex).
  // Antes ("dias seguidos") isso nunca passava de 1.
  const sessions = sessionsOf(
    "2026-09-28",
    "2026-09-30",
    "2026-10-02", // semana passada: 3 de 3
    "2026-10-05",
    "2026-10-07" // esta semana até quinta: 2 de 3 (em andamento)
  );
  assert.equal(weeklyStreak({ sessions, goal: 3, now: QUI, mondayStart: true, isRest }), 1);
  const comSexta = { ...sessions, ...sessionsOf("2026-10-09") };
  assert.equal(weeklyStreak({ sessions: comSexta, goal: 3, now: d("2026-10-09"), mondayStart: true, isRest }), 2);
});

/* ---------- troca do início da semana ---------- */

test("troca do início da semana muda a sequência com as mesmas sessões", () => {
  // Meta 2. Dom 04/10 + seg 05/10.
  //  - Início domingo: ambos na mesma semana (04-10) -> meta batida -> 1.
  //  - Início segunda: dom 04 fica na semana anterior (28/09-04/10) e seg 05 na atual,
  //    cada uma com 1 treino -> nenhuma bate -> 0.
  const sessions = sessionsOf("2026-10-04", "2026-10-05");
  assert.equal(weeklyStreak({ sessions, goal: 2, now: QUI, mondayStart: false, isRest }), 1);
  assert.equal(weeklyStreak({ sessions, goal: 2, now: QUI, mondayStart: true, isRest }), 0);
});

test("troca do início da semana muda também o 'x de y'", () => {
  const sessions = sessionsOf("2026-10-04", "2026-10-05");
  assert.equal(weekSessionCount({ sessions, now: QUI, mondayStart: false, isRest }), 2);
  assert.equal(weekSessionCount({ sessions, now: QUI, mondayStart: true, isRest }), 1);
});

test("troca do início da semana: no domingo o 'agora' cai em semanas diferentes", () => {
  // Hoje é domingo 11/10. Início domingo: semana nova (vazia). Início segunda: semana 05-11.
  const sessions = sessionsOf("2026-10-06", "2026-10-08");
  const sun = d("2026-10-11");
  assert.equal(weekSessionCount({ sessions, now: sun, mondayStart: false, isRest }), 0);
  assert.equal(weekSessionCount({ sessions, now: sun, mondayStart: true, isRest }), 2);
  // Início segunda: a semana 05-11 já bateu a meta (2) -> 1.
  // Início domingo: a semana nova (vazia) não quebra; a anterior (04-10) bateu -> também 1,
  // mas por outro caminho (semana atual 0 de 2 em andamento).
  assert.equal(weeklyStreak({ sessions, goal: 2, now: sun, mondayStart: true, isRest }), 1);
  assert.equal(weeklyStreak({ sessions, goal: 2, now: sun, mondayStart: false, isRest }), 1);
  // Com meta 3 nenhuma das duas bate, em qualquer modo.
  assert.equal(weeklyStreak({ sessions, goal: 3, now: sun, mondayStart: true, isRest }), 0);
});

/* ---------- robustez ---------- */

test("ignora chaves de data inválidas e entradas vazias", () => {
  const sessions = { lixo: [{ letter: "A" }], "2026-10-06": [null, { letter: "A" }], "2026-10-07": [] };
  assert.equal(weekSessionCount({ sessions, now: QUI, mondayStart: true, isRest }), 1);
});

test("meta inválida é normalizada (nunca divide por zero nem conta como 0)", () => {
  const sessions = sessionsOf("2026-10-06");
  assert.equal(weeklyStreak({ sessions, goal: 0, now: QUI, mondayStart: true, isRest }), 1); // vira meta 1
  assert.equal(weeklyStreak({ sessions, goal: undefined, now: QUI, mondayStart: true, isRest }), 1);
});
