import test from "node:test";
import assert from "node:assert/strict";
import { ICONS, lucideSvg } from "../src/data/icons.js";
import { LUCIDE } from "../src/data/lucide-paths.js";
import { TAB_DEFS } from "../src/data/constants.js";

/* Padrão do app (etapa 12): Lucide, viewBox 24x24, fill none, stroke currentColor,
   stroke-width 2.2, linecap/linejoin round. */
const ATTRS = ['viewBox="0 0 24 24"', 'fill="none"', 'stroke="currentColor"', 'stroke-width="2.2"', 'stroke-linecap="round"', 'stroke-linejoin="round"'];

test("lucideSvg monta o <svg> no padrão", () => {
  const svg = lucideSvg(20, "check");
  for (const a of ATTRS) assert.ok(svg.includes(a), a);
  assert.ok(svg.includes('width="20" height="20"'));
  assert.ok(svg.includes(LUCIDE.check));
});

test("todo ícone de ICONS segue o padrão e tem conteúdo", () => {
  for (const [name, svg] of Object.entries(ICONS)) {
    for (const a of ATTRS) assert.ok(svg.includes(a), `${name}: falta ${a}`);
    assert.match(svg, /<(path|circle|rect|line)\b/, `${name}: sem desenho`);
    assert.ok(!svg.includes("undefined"), `${name}: ícone Lucide inexistente`);
  }
});

test("logoDumbbell e dumbbell usam o halter do Lucide", () => {
  assert.ok(ICONS.dumbbell.includes(LUCIDE.dumbbell));
  assert.ok(ICONS.logoDumbbell.includes(LUCIDE.dumbbell));
  assert.ok(ICONS.dumbbell.includes('width="18"'));
  assert.ok(ICONS.logoDumbbell.includes('width="28"'));
});

test("ícones das abas (exceto Treinos, mantido) usam Lucide no padrão", () => {
  for (const t of TAB_DEFS) {
    if (t.id === "treinos") continue;
    for (const a of ATTRS) assert.ok(t.icon.includes(a), `${t.id}: falta ${a}`);
    assert.ok(t.icon.includes('width="22"'), t.id);
    assert.ok(!t.icon.includes("undefined"), t.id);
  }
});
