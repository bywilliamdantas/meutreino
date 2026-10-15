// Imagens dos exercícios: mapeamento nome -> imagem, fallback para ícone e HTML da miniatura.
// (O comportamento do modal de ampliação foi checado em navegador real; aqui ficam as regras puras.)
import test from "node:test";
import assert from "node:assert/strict";
import { EXERCISE_LIBRARY } from "../src/data/exercise-library.js";
import {
  EXERCISE_IMAGE_MAP,
  EXERCISE_IMAGE_SOURCES,
  exerciseImageId,
  exerciseImageUrl,
  imageFailed,
  markImageFailed,
  resetFailedImages
} from "../src/exercises/exercise-images.js";
import { exThumbHtml } from "../src/exercises/exercise-visuals.js";

const libraryNames = new Set(Object.values(EXERCISE_LIBRARY).flat());

test("todo nome do mapa existe na biblioteca de exercícios (ou é um apelido comum)", () => {
  const ALIASES = new Set(["Crucifixo", "Voador", "Peck deck", "Back Extension"]);
  for (const name of Object.keys(EXERCISE_IMAGE_MAP)) {
    assert.ok(libraryNames.has(name) || ALIASES.has(name), `"${name}" não está em EXERCISE_LIBRARY`);
  }
});

test("ids têm o formato do free-exercise-db (sem espaço nem barra) e não há duplicata de nome", () => {
  const seen = new Set();
  for (const [name, id] of Object.entries(EXERCISE_IMAGE_MAP)) {
    assert.match(id, /^[A-Za-z0-9_'.-]+$/, `${name}: id inválido`);
    assert.ok(!seen.has(name.toLowerCase()), `nome repetido: ${name}`);
    seen.add(name.toLowerCase());
  }
});

test("cardio nunca tem imagem", () => {
  for (const name of EXERCISE_LIBRARY.Cardio) assert.equal(exerciseImageId(name), null, name);
});

test("busca ignora acento, caixa e espaços repetidos", () => {
  assert.equal(exerciseImageId("supino  RETO com barra"), "Barbell_Bench_Press_-_Medium_Grip");
  assert.equal(exerciseImageId("Elevacao lateral com halteres"), "Side_Lateral_Raise");
  assert.equal(exerciseImageId("Exercício inventado"), null);
  assert.equal(exerciseImageId(""), null);
  assert.equal(exerciseImageId(undefined), null);
});

test("URLs: fonte local primeiro, CDN depois; frame 0 e 1", () => {
  assert.equal(exerciseImageUrl("Pullups", 0, 0), "./exercise-images/Pullups/0.jpg");
  assert.equal(exerciseImageUrl("Pullups", 1, 0), "./exercise-images/Pullups/1.jpg");
  assert.ok(exerciseImageUrl("Pullups", 0, 1).startsWith("https://"));
  assert.equal(exerciseImageUrl("Pullups", 0, EXERCISE_IMAGE_SOURCES.length), null);
});

test("miniatura: exercício mapeado vira <img> clicável; sem zoom é só visual", () => {
  resetFailedImages();
  const z = exThumbHtml({ name: "Supino reto com barra" }, undefined, { zoom: true });
  assert.match(z, /<button[^>]*data-role="zoomex"/);
  assert.match(z, /<img class="ex-img" src="\.\/exercise-images\/Barbell_Bench_Press_-_Medium_Grip\/0\.jpg"/);
  assert.match(z, /aria-label="Ampliar imagem: Supino reto com barra"/);
  assert.ok(z.includes("ex-img-fallback"), "tem o ícone reserva escondido");
  const plain = exThumbHtml({ name: "Supino reto com barra" }, "sm");
  assert.ok(plain.startsWith("<span") && plain.includes("ex-thumb-sm") && !plain.includes("zoomex"));
});

test("miniatura: sem imagem (próprio, cardio, falha anterior) usa o ícone padrão", () => {
  resetFailedImages();
  for (const ex of [{ name: "Exercício inventado" }, { name: "Esteira" }, { name: "Esteira", type: "cardio" }, { name: "" }, {}]) {
    const h = exThumbHtml(ex, undefined, { zoom: true });
    assert.ok(!h.includes("<img") && h.includes("<svg"), JSON.stringify(ex));
  }
  markImageFailed("Barbell_Bench_Press_-_Medium_Grip");
  assert.ok(imageFailed("Barbell_Bench_Press_-_Medium_Grip"));
  const h = exThumbHtml({ name: "Supino reto com barra" }, undefined, { zoom: true });
  assert.ok(!h.includes("<img") && h.includes("<svg"), "id que falhou vai direto ao ícone");
  resetFailedImages();
});

test("nome com aspas/HTML não injeta marcação", () => {
  resetFailedImages();
  const evil = exThumbHtml({ name: '"><script>x</script>' }, undefined, { zoom: true });
  assert.ok(!evil.includes("<script>"));
});

test("cobertura: quase toda a biblioteca (fora cardio) tem foto e todos os ids existem no formato esperado", () => {
  const names = [...new Set(Object.entries(EXERCISE_LIBRARY).filter(([g]) => g !== "Cardio").flatMap(([, a]) => a))];
  const without = names.filter((n) => !exerciseImageId(n));
  assert.ok(without.length <= 30, `sem imagem demais (${without.length}): ${without.join(", ")}`);
  assert.equal(exerciseImageId("Rosca martelo no cabo"), "Cable_Hammer_Curls_-_Rope_Attachment");
  assert.equal(exerciseImageId("Encolhimento no Smith"), "Barbell_Shrug");
});

test("exercício próprio ganha foto da 'família' pelo nome; nome da biblioteca sem foto continua no ícone", () => {
  assert.equal(exerciseImageId("Supino reto na máquina nova"), "Barbell_Bench_Press_-_Medium_Grip");
  assert.equal(exerciseImageId("Rosca martelo pegada alta"), "Hammer_Curls");
  assert.equal(exerciseImageId("Remada unilateral com halter apoiada"), "One-Arm_Dumbbell_Row");
  assert.equal(exerciseImageId("Alongamento de peitoral"), null);
  assert.equal(exerciseImageId("Agachamento no cabo"), null, "está na biblioteca e não tem foto equivalente: ícone");
});
