// Intensidade da sessão: completude + esforço (RPE, volume e ritmo vs. histórico).
// node --test tests/intensity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { store } from "../src/store.js";
import {
  computeSessionIntensity,
  describeIntensity,
  intensityBaseline,
  isSetCounted,
  sessionIntensityDetail,
  sessionVolume
} from "../src/workouts/sessions.js";

const W = { exercises: [{ id: "e1" }, { id: "e2" }] };
const set = (weight, reps, done = false, extra = {}) => ({ weight, reps, done, ...extra });
const empty = () => ({ weight: null, reps: null, done: false });

test("série digitada sem o ✓ conta como feita (era a causa do 'sempre Baixa')", () => {
  assert.equal(isSetCounted(set(50, 10, false)), true);
  assert.equal(isSetCounted(set(50, 10, true)), true);
  assert.equal(isSetCounted({ minutes: 20, done: false }), true);
  assert.equal(isSetCounted(empty()), false);
  assert.equal(isSetCounted(undefined), false);
  const typedOnly = { e1: [set(50, 10), set(50, 10), set(50, 10)], e2: [set(30, 12), set(30, 12), set(30, 12)] };
  assert.equal(computeSessionIntensity(W, typedOnly), "Alta");
});

test("sem RPE e sem histórico: só a completude (≥90% Alta, ≥50% Média, senão Baixa)", () => {
  const all = { e1: [set(50, 10, true), set(50, 10, true)], e2: [set(30, 12, true), set(30, 12, true)] };
  assert.equal(computeSessionIntensity(W, all), "Alta");
  const part = { e1: [set(50, 10, true), set(50, 10, true)], e2: [empty(), empty()] };
  assert.equal(computeSessionIntensity(W, part), "Média");
  const few = { e1: [set(50, 10, true), empty()], e2: [empty(), empty()] };
  assert.equal(computeSessionIntensity(W, few), "Baixa");
});

test("aquecimento não entra na conta; descanso e treino vazio dão null", () => {
  const log = { e1: [{ ...set(20, 10, true), type: "warm" }, set(50, 10, true)], e2: [set(30, 12, true)] };
  assert.equal(sessionIntensityDetail(W, log).completion, 1);
  assert.equal(computeSessionIntensity({ isRest: true, exercises: [{ id: "e1" }] }, log), null);
  assert.equal(computeSessionIntensity({ exercises: [] }, log), null);
  assert.equal(computeSessionIntensity(W, { e1: [], e2: [] }), null);
});

test("RPE puxa a nota: treino completo mas leve = Baixa/Média; pesado = Alta", () => {
  const log = { e1: [set(50, 10, true), set(50, 10, true)], e2: [set(30, 12, true), set(30, 12, true)] };
  assert.equal(computeSessionIntensity(W, log, { meta: { e1: { rpe: 4 }, e2: { rpe: 5 } } }), "Baixa");
  assert.equal(computeSessionIntensity(W, log, { meta: { e1: { rpe: 7 } } }), "Média");
  assert.equal(computeSessionIntensity(W, log, { meta: { e1: { rpe: 9 }, e2: { rpe: 9 } } }), "Alta");
});

test("volume comparado ao histórico do mesmo treino", () => {
  const log = { e1: [set(50, 10, true), set(50, 10, true)], e2: [set(30, 10, true)] }; // 1000 + 300 = 1300
  assert.equal(sessionVolume(log), 1300);
  const mk = (v) => [{ volume: v, durationMs: null }];
  assert.equal(computeSessionIntensity(W, log, { history: mk(800) }), "Alta"); // +62%
  assert.equal(computeSessionIntensity(W, log, { history: mk(1300) }), "Média"); // igual
  assert.equal(computeSessionIntensity(W, log, { history: mk(2600) }), "Baixa"); // metade
  const d = sessionIntensityDetail(W, log, { history: mk(1300), meta: { e1: { rpe: 8 } } });
  assert.ok(Math.abs(d.volumeRatio - 1) < 1e-9 && d.rpe === 8);
});

test("ritmo (volume/min) só entra com duração conhecida de pelo menos 10 min", () => {
  const log = { e1: [set(100, 10, true)], e2: [set(100, 10, true)] }; // 2000 kg
  const hist = [{ volume: 2000, durationMs: 40 * 60000 }]; // 50 kg/min
  assert.equal(sessionIntensityDetail(W, log, { history: hist, durationMs: null }).densityRatio, null);
  assert.equal(sessionIntensityDetail(W, log, { history: hist, durationMs: 5 * 60000 }).densityRatio, null);
  const fast = sessionIntensityDetail(W, log, { history: hist, durationMs: 20 * 60000 });
  assert.ok(Math.abs(fast.densityRatio - 2) < 1e-9);
});

test("menos de 50% das séries = Baixa mesmo com RPE alto", () => {
  const log = { e1: [set(50, 10, true), empty()], e2: [empty(), empty()] };
  assert.equal(computeSessionIntensity(W, log, { meta: { e1: { rpe: 10 } } }), "Baixa");
});

test("intensityBaseline: só sessões anteriores, do mesmo treino, com volume; mais recentes primeiro", () => {
  store.data.sessions = {
    "2026-10-01": [{ letter: "A", log: { e1: [set(40, 10, true)] }, startedAt: 1000, endedAt: 1000 + 30 * 60000 }],
    "2026-10-05": [{ letter: "B", log: { e1: [set(99, 10, true)] } }],
    "2026-10-08": { letter: "A", log: { e1: [set(50, 10, true)] } },
    "2026-10-10": [{ letter: "A", log: { e1: [empty()] } }],
    "2026-10-15": [{ letter: "A", log: { e1: [set(80, 10, true)] } }]
  };
  const b = intensityBaseline("A", "2026-10-15");
  assert.deepEqual(
    b.map((x) => x.volume),
    [500, 400]
  );
  assert.equal(b[1].durationMs, 30 * 60000);
  assert.equal(intensityBaseline("A", "2026-10-15", 1).length, 1);
  assert.deepEqual(intensityBaseline("Z", "2026-10-15"), []);
});

test("describeIntensity resume os sinais usados", () => {
  assert.equal(describeIntensity(null), "");
  const txt = describeIntensity({ completion: 1, rpe: 8, volumeRatio: 1.12, densityRatio: 0.9 });
  assert.match(txt, /100% das séries feitas/);
  assert.match(txt, /RPE médio 8,0/);
  assert.match(txt, /volume \+12%/);
  assert.match(txt, /ritmo −10%/);
});
