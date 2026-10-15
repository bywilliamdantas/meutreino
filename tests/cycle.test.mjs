// Ciclo com pendentes: recomendação sem alterar a ordem da rotina.
// node --test tests/cycle.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { cycleDone, nextInCycle } from "../src/workouts/cycle.js";

const ORDER = ["A", "B", "C"];

test("sem histórico: recomenda o primeiro da rotina", () => {
  assert.equal(nextInCycle(ORDER, []), "A");
});

test("seguindo a ordem: A, B, C, A -> próximo B", () => {
  assert.equal(nextInCycle(ORDER, ["A"]), "B");
  assert.equal(nextInCycle(ORDER, ["A", "B"]), "C");
  assert.equal(nextInCycle(ORDER, ["A", "B", "C"]), "A");
  assert.equal(nextInCycle(ORDER, ["A", "B", "C", "A"]), "B");
});

test("escolha fora da ordem: fez C no lugar do A -> A continua pendente, depois B", () => {
  assert.equal(nextInCycle(ORDER, ["C"]), "A");
  assert.equal(nextInCycle(ORDER, ["C", "A"]), "B");
  assert.equal(nextInCycle(ORDER, ["C", "A", "B"]), "A"); // ciclo fechou
});

test("repetir o mesmo treino no ciclo não avança nada", () => {
  assert.equal(nextInCycle(ORDER, ["A", "A"]), "B");
  assert.deepEqual([...cycleDone(ORDER, ["A", "A"])], ["A"]);
});

test("vários treinos no mesmo dia contam individualmente", () => {
  assert.equal(nextInCycle(ORDER, ["A", "B"]), "C");
});

test("letras que não estão mais na rotina são ignoradas", () => {
  assert.equal(nextInCycle(ORDER, ["Z", "A"]), "B");
});

test("rotina com um só treino sempre recomenda ele", () => {
  assert.equal(nextInCycle(["A"], []), "A");
  assert.equal(nextInCycle(["A"], ["A"]), "A");
});

test("rotina vazia: sem recomendação", () => {
  assert.equal(nextInCycle([], ["A"]), undefined);
});

test("o histórico antigo na ordem gera a mesma recomendação do cálculo anterior", () => {
  // regra antiga: letra seguinte à última feita
  const legacy = (hist) => ORDER[(ORDER.indexOf(hist[hist.length - 1]) + 1) % ORDER.length];
  for (const hist of [["A"], ["A", "B"], ["A", "B", "C"], ["A", "B", "C", "A", "B"]]) {
    assert.equal(nextInCycle(ORDER, hist), legacy(hist));
  }
});
