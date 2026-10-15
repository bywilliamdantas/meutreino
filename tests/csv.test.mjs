// CSV: nome do snapshot primeiro, coluna grupo_muscular e neutralização de fórmulas.
// Roda sem build: node --test tests/csv.test.mjs
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { store } from "../src/store.js";
import { CSV_HEADER, buildCsv, buildCsvRows, csvCell, neutralizeFormula } from "../src/backup/csv.js";

beforeEach(() => {
  store._libGroupMap = null;
  store.data = {
    order: ["A"],
    workouts: {
      A: {
        name: "A",
        exercises: [
          { id: "e1", name: "Nome NOVO do supino", type: "strength" },
          { id: "e2", name: "Agachamento sumô", type: "strength" },
          { id: "e3", name: "Meu exercício", type: "strength", group: "Bíceps" }
        ]
      }
    },
    sessions: {
      "2026-01-10": [
        {
          id: "s1",
          letter: "A",
          note: "=nota",
          snapshot: [
            { id: "e1", name: "Supino reto com barra", type: "strength" },
            { id: "e3", name: "Meu exercício", type: "strength", group: "Costas / Dorsal" }
          ],
          log: {
            e1: [{ weight: 80.5, reps: 8, done: true, type: "warm" }],
            e2: [{ weight: 100, reps: 5, done: true }],
            e3: [{ weight: 10, reps: 10, done: false }],
            e9: [{ weight: 1, reps: 1, done: true }]
          },
          meta: { e1: { rpe: 8, note: "@fulano" } }
        }
      ]
    }
  };
});

const col = (row, name) => row[CSV_HEADER.indexOf(name)];

test("CSV: cabeçalho ganha grupo_muscular (no fim, sem mover as colunas antigas)", () => {
  assert.equal(CSV_HEADER[CSV_HEADER.length - 1], "grupo_muscular");
  assert.equal(CSV_HEADER[3], "exercicio");
  assert.equal(CSV_HEADER.length, 15);
});

test("CSV: usa o nome do snapshot da sessão, não o nome atual do treino", () => {
  const rows = buildCsvRows();
  assert.equal(col(rows[1], "exercicio"), "Supino reto com barra");
  assert.equal(col(rows[1], "tipo_serie"), "aquecimento");
});

test("CSV: sem snapshot do exercício usa o treino atual; sem nada usa o id", () => {
  const rows = buildCsvRows();
  assert.equal(col(rows[2], "exercicio"), "Agachamento sumô"); // e2 não está no snapshot
  assert.equal(col(rows[4], "exercicio"), "e9");
});

test("CSV: grupo_muscular — snapshot/ex.group, biblioteca (grupo principal) e Outros", () => {
  const rows = buildCsvRows();
  assert.equal(col(rows[1], "grupo_muscular"), "Peitoral");
  assert.equal(col(rows[2], "grupo_muscular"), "Quadríceps"); // duplicata: grupo principal
  assert.equal(col(rows[3], "grupo_muscular"), "Costas / Dorsal"); // grupo do snapshot, não o atual
  assert.equal(col(rows[4], "grupo_muscular"), "Outros");
});

test("neutralizeFormula: prefixa apóstrofo em = + - @ e só nesses", () => {
  for (const c of ["=1+1", "+1", "-1", "@SUM(A1)", "=cmd|' /C calc'!A0"]) assert.equal(neutralizeFormula(c), "'" + c);
  for (const c of ["", "abc", "1=1", "a-b", "80,5", "'ok", " =x"]) assert.equal(neutralizeFormula(c), c);
});

test("CSV: notas e nomes que começam com fórmula saem com apóstrofo, dentro das aspas", () => {
  const csv = buildCsv();
  assert.ok(csv.includes('"\'=nota"'), "nota do treino");
  assert.ok(csv.includes('"\'@fulano"'), "nota do exercício");
  assert.ok(!/(^|,)"[=+\-@]/m.test(csv), "nenhuma célula começa com = + - @");
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
});
