// validateBackup: validação do conteúdo das séries com arquivos corrompidos.
// Roda sem build: node --test tests/import-validate.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { importFixMessage, validateBackup } from "../src/backup/validate.js";

const backup = (log, extra = {}) => ({
  order: ["A"],
  workouts: { A: { name: "A", exercises: [{ id: "e1", name: "x" }] } },
  sessions: { "2026-01-10": [{ id: "s1", letter: "A", log, ...extra }] }
});
const setsOf = (p) => p.sessions["2026-01-10"][0].log.e1;

test("série válida passa intacta e não conta como corrigida", () => {
  const sets = [
    { weight: 80, reps: 8, done: true, type: "normal" },
    { weight: 0, reps: 12, done: true },
    { minutes: 20, done: true },
    { weight: null, reps: null, done: false },
    { weight: 42.5, reps: 10, type: "fail" }
  ];
  const p = backup({ e1: JSON.parse(JSON.stringify(sets)) });
  const v = validateBackup(p);
  assert.deepEqual([v.ok, v.fixed, v.dropped], [true, 0, 0]);
  assert.deepEqual(setsOf(p), sets);
  assert.equal(importFixMessage(v), "");
});

test("peso, reps e minutos inválidos viram null (NaN, Infinity, negativo, texto, objeto)", () => {
  const p = backup({
    e1: [
      { weight: NaN, reps: 10, done: true },
      { weight: 50, reps: Infinity, done: true },
      { weight: -20, reps: -3, minutes: -1, done: true },
      { weight: "abc", reps: {}, minutes: [], done: true },
      { weight: true, reps: 5, done: true }
    ]
  });
  // JSON.stringify transforma NaN/Infinity em null; aqui testamos também o objeto direto (ex.: backup automático)
  const v = validateBackup(p);
  assert.equal(v.ok, true);
  assert.equal(v.fixed, 5);
  assert.deepEqual(
    setsOf(p).map((s) => [s.weight, s.reps, s.minutes ?? null]),
    [
      [null, 10, null],
      [50, null, null],
      [null, null, null],
      [null, null, null],
      [null, 5, null]
    ]
  );
});

test("texto numérico é convertido (inclui vírgula decimal)", () => {
  const p = backup({
    e1: [
      { weight: "42,5", reps: " 10 ", minutes: "30", done: true },
      { weight: "", reps: "12abc" }
    ]
  });
  const v = validateBackup(p);
  assert.equal(v.fixed, 2);
  assert.deepEqual(setsOf(p)[0], { weight: 42.5, reps: 10, minutes: 30, done: true });
  assert.deepEqual([setsOf(p)[1].weight, setsOf(p)[1].reps], [null, null]);
});

test("tipo de série desconhecido vira normal; tipos conhecidos ficam", () => {
  const p = backup({
    e1: [
      { weight: 1, reps: 1, type: "warm" },
      { weight: 1, reps: 1, type: "drop" },
      { weight: 1, reps: 1, type: "fail" },
      { weight: 1, reps: 1, type: "turbo" },
      { weight: 1, reps: 1, type: 7 }
    ]
  });
  const v = validateBackup(p);
  assert.equal(v.fixed, 2);
  assert.deepEqual(
    setsOf(p).map((s) => s.type),
    ["warm", "drop", "fail", "normal", "normal"]
  );
});

test("entradas que não são objeto são descartadas e contadas", () => {
  const p = backup({ e1: [null, 5, "x", [], { weight: 10, reps: 5, done: true }], e2: "lixo", e3: null });
  const v = validateBackup(p);
  assert.equal(v.ok, true);
  assert.equal(v.dropped, 4 + 2);
  assert.equal(setsOf(p).length, 1);
  assert.deepEqual(p.sessions["2026-01-10"][0].log.e2, []);
  assert.deepEqual(p.sessions["2026-01-10"][0].log.e3, []);
});

test("log corrompido (não é objeto) é zerado; sessão que não é objeto é descartada", () => {
  const p = backup({ e1: [] });
  p.sessions["2026-01-10"][0].log = "quebrado";
  p.sessions["2026-01-11"] = [null, 3, { id: "s2", letter: "A", log: [1, 2] }];
  const v = validateBackup(p);
  assert.equal(v.ok, true);
  assert.deepEqual(p.sessions["2026-01-10"][0].log, {});
  assert.equal(p.sessions["2026-01-11"].length, 1);
  assert.deepEqual(p.sessions["2026-01-11"][0].log, {});
  assert.equal(v.dropped, 1 + 2 + 1);
});

test("formato antigo de sessão: letra em texto fica; { weight, reps } é limpo; null é removido", () => {
  const p = backup({ e1: [] });
  p.sessions["2026-02-01"] = "A";
  p.sessions["2026-02-02"] = { letter: "A", log: { e1: { weight: "abc", reps: 8 } } };
  p.sessions["2026-02-03"] = null;
  const v = validateBackup(p);
  assert.equal(p.sessions["2026-02-01"], "A");
  assert.equal(p.sessions["2026-02-02"].log.e1.weight, null);
  assert.equal(p.sessions["2026-02-02"].log.e1.reps, 8);
  assert.ok(!("2026-02-03" in p.sessions));
  assert.equal(v.fixed, 1);
});

test("arquivo vindo de JSON real (NaN/Infinity viram null) continua válido", () => {
  const raw =
    '{"order":["A"],"workouts":{"A":{"name":"A","exercises":[]}},"sessions":{"2026-01-10":[{"id":"s","letter":"A","log":{"e1":[{"weight":1e999,"reps":"9","done":true},{"weight":null,"reps":null}]}}]}}';
  const p = JSON.parse(raw); // 1e999 → Infinity
  const v = validateBackup(p);
  assert.equal(v.fixed, 1); // conta séries, não campos: a 1ª série teve dois campos consertados
  assert.deepEqual(setsOf(p)[0], { weight: null, reps: 9, done: true });
});

test("regras antigas continuam: sem order/workouts é inválido; chave de data ruim some", () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup({ order: [], workouts: [] }).ok, false);
  const p = backup({ e1: [] });
  p.sessions["ontem"] = [];
  assert.equal(validateBackup(p).ok, true);
  assert.ok(!("ontem" in p.sessions));
});

test("importFixMessage: singular, plural e os dois juntos", () => {
  assert.equal(importFixMessage({ ok: true, fixed: 1, dropped: 0 }), "Importação: 1 série corrigida (dados inválidos no arquivo)");
  assert.equal(importFixMessage({ ok: true, fixed: 3, dropped: 0 }), "Importação: 3 séries corrigidas (dados inválidos no arquivo)");
  assert.equal(importFixMessage({ ok: true, fixed: 2, dropped: 1 }), "Importação: 2 séries corrigidas e 1 entrada descartada (dados inválidos no arquivo)");
});

test("chave de treino com HTML é recusada (evita XSS ao importar)", () => {
  const bad = 'A"><img src=x onerror=alert(1)>';
  const v = validateBackup({ order: [bad], workouts: { [bad]: { name: "x", exercises: [] } }, sessions: {} });
  assert.equal(v.ok, false);
  const extra = validateBackup({ order: ["A"], workouts: { A: { name: "x", exercises: [] }, [bad]: { name: "y", exercises: [] } }, sessions: {} });
  assert.equal(extra.ok, false);
});

test("ids inseguros de exercício, sessão, snapshot e log são descartados", () => {
  const bad = '"><svg onload=alert(2)>';
  const p = {
    order: ["A"],
    workouts: {
      A: {
        name: "A",
        exercises: [
          { id: "e1", name: "ok" },
          { id: bad, name: "ruim" }
        ]
      }
    },
    sessions: { "2026-01-10": [{ id: bad, letter: bad, log: { e1: [{ weight: 10, reps: 5 }], [bad]: [] }, snapshot: [{ id: "e1" }, { id: bad }] }] },
    body: [{ id: bad, date: "2026-01-10", weight: 80 }]
  };
  const v = validateBackup(p);
  assert.equal(v.ok, true);
  assert.deepEqual(
    p.workouts.A.exercises.map((e) => e.id),
    ["e1"]
  );
  const s = p.sessions["2026-01-10"][0];
  assert.equal("id" in s, false);
  assert.equal(s.letter, null);
  assert.deepEqual(Object.keys(s.log), ["e1"]);
  assert.deepEqual(
    s.snapshot.map((e) => e.id),
    ["e1"]
  );
  assert.equal("id" in p.body[0], false);
  assert.equal(v.dropped, 4);
});
