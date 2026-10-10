// Regras do descanso entre séries e do "repetir anterior" (funções puras).
// node --test tests/rest-rules.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { isLastSet, previousSetValues, shouldStartRest } from "../src/workouts/rest-rules.js";

const sets = (n) => Array.from({ length: n }, () => ({ weight: null, reps: null, done: false }));

test("isLastSet: só o último índice da lista", () => {
  assert.equal(isLastSet(sets(3), 2), true);
  assert.equal(isLastSet(sets(3), 1), false);
  assert.equal(isLastSet(sets(1), 0), true);
  assert.equal(isLastSet([], 0), false);
  assert.equal(isLastSet(undefined, 0), false);
});

test("descanso inicia nas séries do meio", () => {
  const s = sets(4);
  assert.equal(shouldStartRest({ id: "e1" }, s, 0), true);
  assert.equal(shouldStartRest({ id: "e1" }, s, 2), true);
});

test("descanso NÃO inicia na última série", () => {
  assert.equal(shouldStartRest({ id: "e1" }, sets(4), 3), false);
  assert.equal(shouldStartRest({ id: "e1" }, sets(1), 0), false);
});

test("exercício sem cadastro (ex indefinido) segue a regra normal", () => {
  assert.equal(shouldStartRest(undefined, sets(3), 0), true);
  assert.equal(shouldStartRest(undefined, sets(3), 2), false);
});

test("superset: nunca inicia descanso (comportamento antigo preservado)", () => {
  const ss = { id: "e1", ss: true };
  assert.equal(shouldStartRest(ss, sets(3), 0), false);
  assert.equal(shouldStartRest(ss, sets(3), 1), false);
  assert.equal(shouldStartRest(ss, sets(3), 2), false);
});

test("previousSetValues: copia peso e reps da série acima", () => {
  const s = [{ weight: 40, reps: 10 }, { weight: null, reps: null }, { weight: null, reps: null }];
  assert.deepEqual(previousSetValues(s, 1, { weight: 0, reps: 8 }), { weight: 40, reps: 10 });
});

test("previousSetValues: série acima vazia usa o padrão que a tela mostra", () => {
  const s = [{ weight: null, reps: null }, { weight: null, reps: null }];
  assert.deepEqual(previousSetValues(s, 1, { weight: 25, reps: 12 }), { weight: 25, reps: 12 });
});

test("previousSetValues: peso 0 salvo é valor válido (não cai no padrão)", () => {
  const s = [{ weight: 0, reps: 15 }, { weight: null, reps: null }];
  assert.deepEqual(previousSetValues(s, 1, { weight: 30, reps: 10 }), { weight: 0, reps: 15 });
});

test("previousSetValues: primeira série não tem anterior", () => {
  assert.equal(previousSetValues(sets(3), 0, { weight: 1, reps: 1 }), null);
  assert.equal(previousSetValues(undefined, 1, {}), null);
});

test("previousSetValues: não altera as séries", () => {
  const s = [{ weight: null, reps: null }, { weight: null, reps: null }];
  const copy = JSON.stringify(s);
  previousSetValues(s, 1, { weight: 20, reps: 10 });
  assert.equal(JSON.stringify(s), copy);
});

test("previousSetValues: sem padrões e sem valor devolve null nos campos", () => {
  const s = [{ weight: null, reps: null }, {}];
  assert.deepEqual(previousSetValues(s, 1, null), { weight: null, reps: null });
});
