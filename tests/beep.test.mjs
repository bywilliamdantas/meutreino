// Beep do timer (Web Audio) com um AudioContext falso: destravar no toque, tocar, no-op sem suporte.
// node --test tests/beep.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

const handlers = {};
globalThis.document = { addEventListener: (ev, fn) => { (handlers[ev] ||= []).push(fn); } };
globalThis.window = {};

const { initAudioUnlock, playBeep, unlockAudio, _resetAudioForTests } = await import("../src/audio/beep.js");

function installFakeAudio({ startState = "suspended", resumeTo = "running" } = {}) {
  const log = { created: 0, resumes: 0, oscillators: 0, silentBuffers: 0, started: [], stopped: [] };
  class FakeCtx {
    constructor() { log.created++; log.ctx = this; this.state = startState; this.currentTime = 0; this.destination = {}; }
    resume() { log.resumes++; this.state = resumeTo; return Promise.resolve(); }
    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, start() { log.silentBuffers++; } }; }
    createOscillator() {
      log.oscillators++;
      return { type: "", frequency: { setValueAtTime() {} }, connect() {}, start: (t) => log.started.push(t), stop: (t) => log.stopped.push(t) };
    }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  }
  window.AudioContext = FakeCtx;
  return log;
}

test.beforeEach(() => {
  _resetAudioForTests();
  delete window.AudioContext;
  delete window.webkitAudioContext;
});

test("sem suporte a Web Audio: tudo é no-op e não lança", () => {
  assert.equal(unlockAudio(), false);
  assert.equal(playBeep(), false);
});

test("antes do primeiro toque não há AudioContext: beep não toca", () => {
  const log = installFakeAudio();
  assert.equal(playBeep(), false);
  assert.equal(log.created, 0);
  assert.equal(log.oscillators, 0);
});

test("unlockAudio (num toque) cria o contexto, retoma e toca amostra silenciosa", () => {
  const log = installFakeAudio();
  assert.equal(unlockAudio(), true);
  assert.equal(log.created, 1);
  assert.equal(log.resumes, 1);
  assert.equal(log.silentBuffers, 1);
});

test("depois de destravado, playBeep toca um oscilador curto na hora", () => {
  const log = installFakeAudio();
  unlockAudio(); // fake resume() já deixa state = running
  assert.equal(playBeep(), true);
  assert.equal(log.oscillators, 1);
  assert.ok(log.stopped[0] - log.started[0] <= 0.3, "beep curto (<= 0,3 s)");
});

test("contexto suspenso de novo: playBeep tenta retomar e toca em seguida", async () => {
  const log = installFakeAudio({ startState: "running", resumeTo: "running" });
  unlockAudio();
  log.ctx.state = "suspended"; // o iOS suspendeu o áudio (app em segundo plano)
  assert.equal(playBeep(), false); // não toca na hora...
  assert.ok(log.resumes >= 1);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(log.oscillators, 1); // ...mas toca assim que o resume conclui
});

test("resume que não chega a running (sem gesto): não toca nada", async () => {
  const log = installFakeAudio({ startState: "suspended", resumeTo: "suspended" });
  unlockAudio();
  assert.equal(playBeep(), false);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(log.oscillators, 0);
});

test("prefixo webkit é aceito (Safari antigo)", () => {
  const log = installFakeAudio();
  window.webkitAudioContext = window.AudioContext;
  delete window.AudioContext;
  assert.equal(unlockAudio(), true);
  assert.equal(log.created, 1);
});

test("initAudioUnlock liga toque/click e o primeiro gesto cria o contexto", () => {
  const log = installFakeAudio();
  initAudioUnlock();
  for (const ev of ["touchend", "pointerup", "click", "keydown"]) assert.ok(handlers[ev]?.length >= 1, ev);
  assert.equal(log.created, 0);
  handlers.click[0]();
  assert.equal(log.created, 1);
  handlers.touchend[0](); // já running: não recria nem reabre
  assert.equal(log.created, 1);
});

test("initAudioUnlock é idempotente", () => {
  installFakeAudio();
  initAudioUnlock();
  const n = handlers.click.length;
  initAudioUnlock();
  initAudioUnlock();
  assert.equal(handlers.click.length, n);
});
