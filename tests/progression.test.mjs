// Testes unitários de e1rm, suggestNext (3 sessões + RPE + deload) e muscleGroupOf.
// Rodam sem build e sem navegador: node --test tests/progression.test.mjs
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { e1rm } from "../src/utils/numbers.js";
import { store } from "../src/store.js";
import { isStalled, recentWorkSessions, suggestNext } from "../src/stats/prs.js";
import { muscleGroupOf, customGroupFor } from "../src/exercises/exercises.js";
import { EXERCISE_LIBRARY } from "../src/data/exercise-library.js";
import { PRIMARY_GROUP, buildPrimaryGroupMap, libraryGroupsByName } from "../src/data/exercise-primary-group.js";

/* ---------- e1rm ---------- */

test("e1rm: fórmula de Epley (peso × (1 + reps/30))", () => {
  assert.equal(e1rm(100, 10), 100 * (1 + 10 / 30));
  assert.ok(Math.abs(e1rm(80, 5) - 93.3333333) < 1e-6);
});

test("e1rm: 1 rep (ou menos) devolve o próprio peso", () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 0), 100);
  assert.equal(e1rm(100, null), 100);
});

test("e1rm: peso inválido ou zero devolve 0", () => {
  assert.equal(e1rm(0, 10), 0);
  assert.equal(e1rm(-5, 10), 0);
  assert.equal(e1rm(null, 10), 0);
  assert.equal(e1rm(undefined, 10), 0);
});

/* ---------- suggestNext ---------- */

const EX = { id: "e1", name: "Supino reto com barra", type: "strength", reps: "8" };
const TODAY = "2026-12-31";

/* Registra uma sessão por data: sess("2026-10-01", [[60, 8], [60, 8]], rpe) */
function addSession(date, sets, rpe, exId = EX.id) {
  const sess = {
    id: `s-${date}-${(store.data.sessions[date] || []).length}`,
    letter: "A",
    log: { [exId]: sets.map(([weight, reps, extra]) => ({ weight, reps, done: true, ...(extra || {}) })) }
  };
  if (rpe != null) sess.meta = { [exId]: { rpe } };
  (store.data.sessions[date] ||= []).push(sess);
}

beforeEach(() => {
  store.data.sessions = {};
  store.data.settings.unit = "kg";
});

test("suggestNext: sem histórico, cardio, sem meta de reps ou sem exercício → null", () => {
  assert.equal(suggestNext(EX, TODAY), null);
  assert.equal(suggestNext(null, TODAY), null);
  addSession("2026-10-01", [[60, 8]]);
  assert.equal(suggestNext({ ...EX, type: "cardio" }, TODAY), null);
  assert.equal(suggestNext({ ...EX, reps: "" }, TODAY), null);
  assert.equal(suggestNext({ ...EX, reps: "abc" }, TODAY), null);
});

test("suggestNext: bateu a meta de reps → +2,5 kg", () => {
  addSession("2026-10-01", [
    [60, 8],
    [60, 8],
    [60, 9]
  ]);
  const s = suggestNext(EX, TODAY);
  assert.equal(s.weight, 62.5);
  assert.equal(s.reps, 8);
  assert.ok(!s.deload);
});

test("suggestNext: não bateu a meta → mesma carga, +1 rep (limitada à meta)", () => {
  addSession("2026-10-01", [
    [60, 6],
    [60, 7]
  ]);
  let s = suggestNext(EX, TODAY);
  assert.equal(s.weight, 60);
  assert.equal(s.reps, 7); // menor número de reps na carga mais alta (6) + 1
  store.data.sessions = {};
  addSession("2026-10-01", [
    [60, 7],
    [60, 7]
  ]);
  assert.equal(suggestNext(EX, TODAY).reps, 8);
});

test("suggestNext: usa só séries de trabalho na carga mais alta (aquecimento é ignorado)", () => {
  addSession("2026-10-01", [
    [40, 12, { type: "warm" }],
    [60, 8],
    [60, 8]
  ]);
  assert.equal(suggestNext(EX, TODAY).weight, 62.5);
});

test("suggestNext: só considera sessões antes de beforeKey", () => {
  addSession("2026-10-01", [[60, 8]]);
  addSession("2026-10-10", [[70, 8]]);
  assert.equal(suggestNext(EX, "2026-10-10").weight, 62.5);
  assert.equal(suggestNext(EX, "2026-10-11").weight, 72.5);
});

test("suggestNext: RPE 10 na sessão que bateu a meta → repete a carga", () => {
  addSession(
    "2026-10-01",
    [
      [60, 8],
      [60, 8]
    ],
    10
  );
  const s = suggestNext(EX, TODAY);
  assert.equal(s.weight, 60);
  assert.equal(s.reps, 8);
  assert.match(s.text, /RPE 10/);
});

test("suggestNext: RPE baixo (≤ 6) na sessão que bateu a meta → salto de 2 passos", () => {
  addSession(
    "2026-10-01",
    [
      [60, 8],
      [60, 8]
    ],
    6
  );
  assert.equal(suggestNext(EX, TODAY).weight, 65);
});

test("suggestNext: RPE intermediário mantém o passo normal", () => {
  addSession(
    "2026-10-01",
    [
      [60, 8],
      [60, 8]
    ],
    8
  );
  assert.equal(suggestNext(EX, TODAY).weight, 62.5);
});

test("suggestNext: usa o RPE da sessão mais recente, não o de sessões antigas", () => {
  addSession("2026-09-01", [[55, 8]], 10);
  addSession("2026-10-01", [[60, 8]], 7);
  assert.equal(suggestNext(EX, TODAY).weight, 62.5);
});

test("suggestNext: 3 sessões sem evolução e reps abaixo da meta → deload de ~10%", () => {
  addSession("2026-10-01", [
    [100, 6],
    [100, 6]
  ]);
  addSession("2026-10-08", [
    [100, 6],
    [100, 5]
  ]);
  addSession("2026-10-15", [
    [100, 6],
    [100, 5]
  ]);
  const s = suggestNext(EX, TODAY);
  assert.equal(s.deload, true);
  assert.equal(s.weight, 90);
  assert.equal(s.reps, 8);
  assert.match(s.text, /deload/);
});

test("suggestNext: deload arredonda ao passo (2,5 kg) e sempre fica abaixo da carga atual", () => {
  addSession("2026-10-01", [[62.5, 5]]);
  addSession("2026-10-08", [[62.5, 5]]);
  addSession("2026-10-15", [[62.5, 5]]);
  const s = suggestNext(EX, TODAY);
  assert.equal(s.weight, 57.5); // 62,5 × 0,9 = 56,25 → 57,5 (múltiplo de 2,5 mais próximo)
  assert.ok(s.weight < 62.5);
});

test("suggestNext: deload em lb usa o passo de 5 lb", () => {
  store.data.settings.unit = "lb";
  const kg = (lb) => lb * 0.45359237;
  addSession("2026-10-01", [[kg(200), 5]]);
  addSession("2026-10-08", [[kg(200), 5]]);
  addSession("2026-10-15", [[kg(200), 5]]);
  const s = suggestNext(EX, TODAY);
  assert.equal(s.deload, true);
  assert.ok(Math.abs(s.weight / 0.45359237 - 180) < 0.01);
});

test("suggestNext: só 2 sessões sem evolução ainda NÃO é estagnação", () => {
  addSession("2026-10-08", [[100, 5]]);
  addSession("2026-10-15", [[100, 5]]);
  const s = suggestNext(EX, TODAY);
  assert.ok(!s.deload);
  assert.equal(s.weight, 100);
  assert.equal(s.reps, 6);
});

test("suggestNext: houve evolução dentro das 3 sessões → sem deload", () => {
  addSession("2026-10-01", [[100, 5]]);
  addSession("2026-10-08", [[100, 6]]);
  addSession("2026-10-15", [[100, 6]]);
  const s = suggestNext(EX, TODAY);
  assert.ok(!s.deload);
  assert.equal(s.reps, 7);
});

test("suggestNext: estagnou mas a última sessão bateu a meta → aumenta em vez de deload", () => {
  addSession("2026-10-01", [[100, 8]]);
  addSession("2026-10-08", [[100, 8]]);
  addSession("2026-10-15", [[100, 8]]);
  const s = suggestNext(EX, TODAY);
  assert.ok(!s.deload);
  assert.equal(s.weight, 102.5);
});

test("suggestNext: só as 3 sessões mais recentes entram (a 4ª mais antiga é ignorada)", () => {
  addSession("2026-09-01", [[100, 5]]); // antiga: não entra na janela
  addSession("2026-10-01", [[100, 6]]);
  addSession("2026-10-08", [[100, 7]]);
  addSession("2026-10-15", [[100, 7]]);
  assert.ok(!suggestNext(EX, TODAY).deload); // 7 reps > 6 reps: houve evolução na janela
});

test("recentWorkSessions: ordem (mais recente primeiro), limite e leitura do RPE", () => {
  addSession("2026-10-01", [[60, 8]], 7);
  addSession("2026-10-08", [[60, 8]]);
  addSession("2026-10-08", [[65, 8]], 9); // duas sessões no mesmo dia contam separadas
  addSession("2026-10-15", [[70, 8]]);
  const r = recentWorkSessions(EX.id, TODAY, 3);
  assert.equal(r.length, 3);
  assert.deepEqual(
    r.map((x) => x.date),
    ["2026-10-15", "2026-10-08", "2026-10-08"]
  );
  assert.equal(r[1].rpe, 9);
  assert.equal(r[0].rpe, null);
});

test("recentWorkSessions: ignora séries não feitas e sessões de outro exercício", () => {
  addSession("2026-10-01", [[60, 8, { done: false }]]);
  addSession("2026-10-02", [[60, 8]], null, "outro");
  assert.equal(recentWorkSessions(EX.id, TODAY).length, 0);
});

test("isStalled: precisa de 3 sessões", () => {
  const s = (best1rm) => ({ best1rm });
  assert.equal(isStalled([s(100), s(100)]), false);
  assert.equal(isStalled([s(100), s(100), s(100)]), true);
  assert.equal(isStalled([s(110), s(100), s(100)]), false); // mais recente evoluiu
  assert.equal(isStalled([s(100), s(100.4), s(100)]), true); // dentro da tolerância de 0,5%
  assert.equal(isStalled([s(100), s(101), s(100)]), false); // acima da tolerância
  assert.equal(isStalled([s(100), s(105), s(100)]), false); // a do meio evoluiu
});

/* ---------- muscleGroupOf (grupo escolhido ao criar exercício próprio) ---------- */

test("muscleGroupOf: exercício da biblioteca usa o grupo da biblioteca", () => {
  assert.equal(muscleGroupOf("Rosca Scott"), "Bíceps");
  assert.equal(muscleGroupOf("  rosca scott  "), "Bíceps");
});

test("muscleGroupOf: exercício próprio sem grupo cai em Outros", () => {
  assert.equal(muscleGroupOf("Meu exercício inventado"), "Outros");
  assert.equal(muscleGroupOf(""), "Outros");
  assert.equal(muscleGroupOf(undefined), "Outros");
});

test("muscleGroupOf: ex.group escolhido tem prioridade; grupo inválido é ignorado", () => {
  assert.equal(muscleGroupOf("Meu exercício inventado", { group: "Peitoral" }), "Peitoral");
  assert.equal(muscleGroupOf("Meu exercício inventado", { group: "Grupo que não existe" }), "Outros");
  assert.equal(muscleGroupOf("Meu exercício inventado", { group: "Cardio" }), "Outros"); // não é grupo selecionável
});

test("muscleGroupOf: duplicata da biblioteca usa o grupo PRINCIPAL, não o último", () => {
  assert.equal(muscleGroupOf("Agachamento sumô"), "Quadríceps"); // também em Glúteos e Adutores
  assert.equal(muscleGroupOf("agachamento sumô"), "Quadríceps");
  assert.equal(muscleGroupOf("Supino inclinado com barra"), "Peitoral superior");
  assert.equal(muscleGroupOf("Levantamento terra"), "Posteriores de coxa");
  assert.equal(muscleGroupOf("Rosca martelo"), "Bíceps");
  assert.equal(muscleGroupOf("Paralelas"), "Tríceps");
  assert.equal(muscleGroupOf("Farmer's Walk"), "Antebraço");
});

test("muscleGroupOf: ex.group continua mandando sobre o grupo principal da biblioteca", () => {
  assert.equal(muscleGroupOf("Agachamento sumô", { group: "Adutores" }), "Adutores");
});

test("grupo principal: toda duplicata da biblioteca tem entrada e ela é um dos seus grupos", () => {
  const byName = libraryGroupsByName();
  const dups = Object.keys(byName).filter((k) => byName[k].length > 1);
  assert.equal(dups.length, 26);
  for (const k of dups) {
    assert.ok(PRIMARY_GROUP[k], `${k}: sem grupo principal`);
    assert.ok(byName[k].includes(PRIMARY_GROUP[k]), `${k}: principal fora dos grupos em que aparece`);
  }
  for (const k of Object.keys(PRIMARY_GROUP)) assert.ok(byName[k] && byName[k].length > 1, `${k}: não é duplicata`);
});

test("grupo principal: duplicata sem entrada cai no primeiro grupo; nome único não muda", () => {
  const lib = { A: ["x", "y"], B: ["x", "z"], C: ["x"] };
  assert.deepEqual(buildPrimaryGroupMap(lib, {}), { x: "A", y: "A", z: "B" });
  assert.equal(buildPrimaryGroupMap(lib, { x: "C" }).x, "C");
  assert.equal(buildPrimaryGroupMap(lib, { x: "Z" }).x, "A"); // override inválido é ignorado
  const full = buildPrimaryGroupMap();
  assert.equal(full["rosca scott"], "Bíceps");
  assert.equal(Object.keys(full).length, Object.keys(libraryGroupsByName(EXERCISE_LIBRARY)).length);
});

test("customGroupFor: reaproveita o grupo já escolhido para o mesmo nome", () => {
  store.data.workouts = {
    A: { name: "A", exercises: [{ id: "x1", name: "Minha Remada", group: "Costas / Dorsal" }] },
    B: { name: "B", exercises: [{ id: "x2", name: "Sem grupo" }] }
  };
  assert.equal(customGroupFor("minha remada"), "Costas / Dorsal");
  assert.equal(customGroupFor("Sem grupo"), null);
  assert.equal(customGroupFor("Outro"), null);
});
