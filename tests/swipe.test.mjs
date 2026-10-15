// Gesto dos cards de Treinos: direita revela "Editar", esquerda revela "Delete".
import test from "node:test";
import assert from "node:assert/strict";
import { swipeDecision, swipeClamp, SWIPE_ACTION_W } from "../src/ui/swipe.js";

test("arrastar para a direita além da metade abre Editar", () => {
  assert.equal(swipeDecision(60), "edit");
});
test("arrastar para a esquerda além da metade abre Delete", () => {
  assert.equal(swipeDecision(-60), "delete");
});
test("arraste curto não abre nada", () => {
  assert.equal(swipeDecision(20), "none");
  assert.equal(swipeDecision(-20), "none");
});
test("com Delete aberto, arrastar para a direita fecha", () => {
  assert.equal(swipeDecision(70, "delete"), "none");
});
test("deslocamento visual é limitado", () => {
  assert.ok(swipeClamp(1000) <= SWIPE_ACTION_W * 1.25);
  assert.ok(swipeClamp(-1000) >= -SWIPE_ACTION_W * 1.25);
});
