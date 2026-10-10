// Testes unitários das migrações de dados (src/data-migrations.js).
// node --test tests/migrations.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  inlineAvatarOf,
  migrateActiveSession,
  migrateSessionEntry,
  migrateSessionSnapshots,
  migrateSessions,
  migrateSettings,
  migrateWorkouts
} from "../src/data-migrations.js";
import { SCHEMA_VERSION } from "../src/data/constants.js";

/* ---------- migrateSessionEntry ---------- */

test("migrateSessionEntry: vazio → null", () => {
  assert.equal(migrateSessionEntry(null), null);
  assert.equal(migrateSessionEntry(undefined), null);
});

test("migrateSessionEntry: formato mais antigo (string) vira { letter, log }", () => {
  assert.deepEqual(migrateSessionEntry("B"), { letter: "B", log: {} });
});

test("migrateSessionEntry: entrada sem log ganha log vazio", () => {
  assert.deepEqual(migrateSessionEntry({ letter: "A" }), { letter: "A", log: {} });
});

test("migrateSessionEntry: log com { weight, reps } vira lista de séries feitas", () => {
  const out = migrateSessionEntry({ letter: "A", log: { e1: { weight: "60,5", reps: "8" } } });
  assert.deepEqual(out.log.e1, [{ weight: 60.5, reps: 8, done: true }]);
});

test("migrateSessionEntry: log antigo vazio vira lista vazia; valor inválido também", () => {
  const out = migrateSessionEntry({ letter: "A", log: { e1: { weight: "", reps: null }, e2: 5, e3: null } });
  assert.deepEqual(out.log.e1, []);
  assert.deepEqual(out.log.e2, []);
  assert.deepEqual(out.log.e3, []);
});

test("migrateSessionEntry: log já em lista não é alterado", () => {
  const sets = [{ weight: 50, reps: 10, done: true }];
  assert.deepEqual(migrateSessionEntry({ letter: "A", log: { e1: sets } }).log.e1, sets);
});

/* ---------- migrateSessions ---------- */

test("migrateSessions: sem sessions cria objeto vazio", () => {
  const s = {};
  migrateSessions(s);
  assert.deepEqual(s.sessions, {});
});

test("migrateSessions: um objeto por dia vira array com id", () => {
  const s = { sessions: { "2026-10-01": { letter: "A", log: { e1: [{ weight: 1, reps: 1 }] }, startedAt: 10, endedAt: 20 } } };
  migrateSessions(s);
  const arr = s.sessions["2026-10-01"];
  assert.equal(arr.length, 1);
  assert.match(arr[0].id, /^s/);
  assert.equal(arr[0].letter, "A");
  assert.equal(arr[0].startedAt, 10);
  assert.equal(arr[0].endedAt, 20);
  assert.deepEqual(arr[0].log.e1, [{ weight: 1, reps: 1 }]);
});

test("migrateSessions: string por dia (formato mais antigo) vira sessão com a letra", () => {
  const s = { sessions: { "2026-10-01": "C" } };
  migrateSessions(s);
  assert.equal(s.sessions["2026-10-01"][0].letter, "C");
  assert.deepEqual(s.sessions["2026-10-01"][0].log, {});
  assert.equal(s.sessions["2026-10-01"][0].startedAt, null);
});

test("migrateSessions: arrays existentes ganham id e log, mas ids já existentes são mantidos", () => {
  const s = { sessions: { "2026-10-01": [{ id: "keep", letter: "A", log: { e1: "lixo" } }, { letter: "B" }] } };
  migrateSessions(s);
  const [a, b] = s.sessions["2026-10-01"];
  assert.equal(a.id, "keep");
  assert.deepEqual(a.log.e1, []);
  assert.match(b.id, /^s/);
  assert.deepEqual(b.log, {});
  assert.notEqual(a.id, b.id);
});

test("migrateSessions: é idempotente", () => {
  const s = { sessions: { "2026-10-01": { letter: "A", log: {} } } };
  migrateSessions(s);
  const once = JSON.stringify(s);
  migrateSessions(s);
  assert.equal(JSON.stringify(s), once);
});

/* ---------- migrateSessionSnapshots ---------- */

const workoutsFixture = () => ({
  A: { name: "A", exercises: [
    { id: "e1", name: "Supino", type: "strength", sets: 3, reps: "8", rest: 90 },
    { id: "e2", name: "Esteira", type: "cardio", mins: 20 },
    { id: "e3", name: "Meu exercício", group: "Peitoral" },
    { id: "e4", name: "Sem séries" }
  ] },
  R: { name: "Descanso", isRest: true, exercises: [] }
});

test("migrateSessionSnapshots: cria a foto só com exercícios que têm séries", () => {
  const s = {
    workouts: workoutsFixture(),
    sessions: { "2026-10-01": [{ id: "s1", letter: "A", log: { e1: [{ weight: 60, reps: 8 }], e2: [{ minutes: 20 }], e4: [] } }] }
  };
  migrateSessionSnapshots(s);
  const snap = s.sessions["2026-10-01"][0].snapshot;
  assert.deepEqual(snap.map(e => e.id), ["e1", "e2"]);
  assert.deepEqual(snap[0], { id: "e1", name: "Supino", type: "strength", sets: 3, reps: "8", rest: 90 });
  assert.deepEqual(snap[1], { id: "e2", name: "Esteira", type: "cardio", mins: 20 });
});

test("migrateSessionSnapshots: guarda o grupo muscular escolhido; tipo padrão é strength", () => {
  const s = {
    workouts: workoutsFixture(),
    sessions: { "2026-10-01": [{ id: "s1", letter: "A", log: { e3: [{ weight: 10, reps: 10 }] } }] }
  };
  migrateSessionSnapshots(s);
  assert.deepEqual(s.sessions["2026-10-01"][0].snapshot, [{ id: "e3", name: "Meu exercício", type: "strength", group: "Peitoral" }]);
});

test("migrateSessionSnapshots: não sobrescreve foto existente e nunca mexe no log", () => {
  const log = { e1: [{ weight: 60, reps: 8 }] };
  const existing = [{ id: "e1", name: "Nome antigo", type: "strength" }];
  const s = {
    workouts: workoutsFixture(),
    sessions: { "2026-10-01": [{ id: "s1", letter: "A", log, snapshot: existing }] }
  };
  const logBefore = JSON.stringify(log);
  migrateSessionSnapshots(s);
  assert.equal(s.sessions["2026-10-01"][0].snapshot, existing);
  assert.equal(JSON.stringify(s.sessions["2026-10-01"][0].log), logBefore);
});

test("migrateSessionSnapshots: ignora treino de descanso, letra inexistente e sessão sem séries", () => {
  const s = {
    workouts: workoutsFixture(),
    sessions: {
      "2026-10-01": [{ id: "a", letter: "R", log: { e1: [{ weight: 1, reps: 1 }] } }],
      "2026-10-02": [{ id: "b", letter: "Z", log: { e1: [{ weight: 1, reps: 1 }] } }],
      "2026-10-03": [{ id: "c", letter: "A", log: {} }]
    }
  };
  migrateSessionSnapshots(s);
  assert.equal(s.sessions["2026-10-01"][0].snapshot, undefined);
  assert.equal(s.sessions["2026-10-02"][0].snapshot, undefined);
  assert.equal(s.sessions["2026-10-03"][0].snapshot, undefined);
});

test("migrateSessionSnapshots: sem workouts ou sessions não faz nada nem lança erro", () => {
  assert.doesNotThrow(() => migrateSessionSnapshots({}));
  assert.doesNotThrow(() => migrateSessionSnapshots({ sessions: {} }));
  assert.doesNotThrow(() => migrateSessionSnapshots({ workouts: {} }));
});

/* ---------- inlineAvatarOf ---------- */

test("inlineAvatarOf: só devolve string não vazia", () => {
  assert.equal(inlineAvatarOf({ settings: { avatarUrl: "data:image/png;base64,AAA" } }), "data:image/png;base64,AAA");
  assert.equal(inlineAvatarOf({ settings: { avatarUrl: "" } }), null);
  assert.equal(inlineAvatarOf({ settings: { avatarUrl: null } }), null);
  assert.equal(inlineAvatarOf({ settings: { avatarUrl: 42 } }), null);
  assert.equal(inlineAvatarOf({ settings: {} }), null);
  assert.equal(inlineAvatarOf({}), null);
  assert.equal(inlineAvatarOf(null), null);
});

/* ---------- migrateSettings ---------- */

test("migrateSettings: dados antigos recebem todos os padrões", () => {
  const s = {};
  migrateSettings(s);
  assert.deepEqual(s.settings, {
    reminder: { enabled: false, time: "18:00", lastNotifiedDate: null },
    lastBackupAt: null,
    workoutsCollapsed: false,
    collapsedSections: {},
    restDuration: 90,
    weekStartsMonday: false,
    weeklyGoal: null,
    restTimerActive: null,
    unit: "kg",
    keepAwake: true,
    beepEnabled: true,
    avatarUrl: null,
    displayName: ""
  });
});

test("migrateSettings: preserva valores já escolhidos", () => {
  const s = { settings: { unit: "lb", restDuration: 120, weekStartsMonday: true, keepAwake: false, beepEnabled: false, displayName: "Ana", reminder: { enabled: true, time: "07:30", lastNotifiedDate: "2026-10-01" } } };
  migrateSettings(s);
  assert.equal(s.settings.unit, "lb");
  assert.equal(s.settings.restDuration, 120);
  assert.equal(s.settings.weekStartsMonday, true);
  assert.equal(s.settings.keepAwake, false);
  assert.equal(s.settings.beepEnabled, false);
  assert.equal(s.settings.displayName, "Ana");
  assert.deepEqual(s.settings.reminder, { enabled: true, time: "07:30", lastNotifiedDate: "2026-10-01" });
});

test("migrateSettings: unidade inválida volta para kg", () => {
  const s = { settings: { unit: "stone" } };
  migrateSettings(s);
  assert.equal(s.settings.unit, "kg");
});

test("migrateSettings: weeklyGoal é arredondada, limitada a 14 e inválida vira null", () => {
  const goal = (v) => { const s = { settings: { weeklyGoal: v } }; migrateSettings(s); return s.settings.weeklyGoal; };
  assert.equal(goal(3), 3);
  assert.equal(goal(3.6), 4);
  assert.equal(goal(99), 14);
  assert.equal(goal(0), null);
  assert.equal(goal(-2), null);
  assert.equal(goal("abc"), null);
  assert.equal(goal(null), null);
});

test("migrateSettings: workoutsCollapsed antigo vira collapsedSections.workouts", () => {
  const s = { settings: { workoutsCollapsed: true } };
  migrateSettings(s);
  assert.deepEqual(s.settings.collapsedSections, { workouts: true });
});

test("migrateSettings: collapsedSections inválido (array/string) é recriado", () => {
  const a = { settings: { collapsedSections: [] } };
  migrateSettings(a);
  assert.deepEqual(a.settings.collapsedSections, {});
  const b = { settings: { collapsedSections: "x" } };
  migrateSettings(b);
  assert.deepEqual(b.settings.collapsedSections, {});
  const c = { settings: { collapsedSections: { stats: true } } };
  migrateSettings(c);
  assert.deepEqual(c.settings.collapsedSections, { stats: true });
});

test("migrateSettings: reminder incompleto é completado; beepEnabled não-booleano vira true", () => {
  const s = { settings: { reminder: { time: "" }, beepEnabled: "sim" } };
  migrateSettings(s);
  assert.deepEqual(s.settings.reminder, { time: "18:00", enabled: false, lastNotifiedDate: null });
  assert.equal(s.settings.beepEnabled, true);
});

test("migrateSettings: é idempotente", () => {
  const s = {};
  migrateSettings(s);
  const once = JSON.stringify(s);
  migrateSettings(s);
  assert.equal(JSON.stringify(s), once);
});

/* ---------- migrateActiveSession ---------- */

test("migrateActiveSession: sem sessão ativa cria o estado ocioso", () => {
  const s = {};
  migrateActiveSession(s);
  assert.deepEqual(s.activeSession, { letter: null, state: "idle", elapsedMs: 0, startedAt: null, startedDate: null });
});

test("migrateActiveSession: valor inválido é substituído; campos faltando são completados", () => {
  const bad = { activeSession: "x" };
  migrateActiveSession(bad);
  assert.equal(bad.activeSession.state, "idle");
  const partial = { activeSession: { letter: "A", state: "running" } };
  migrateActiveSession(partial);
  assert.deepEqual(partial.activeSession, { letter: "A", state: "running", elapsedMs: 0, startedAt: null, startedDate: null });
});

/* ---------- migrateWorkouts ---------- */

test("migrateWorkouts: sem dados não faz nada", () => {
  assert.doesNotThrow(() => migrateWorkouts(null));
  assert.doesNotThrow(() => migrateWorkouts(undefined));
});

test("migrateWorkouts: exercícios sem tipo viram strength; mantém cardio", () => {
  const w = { workouts: { A: { exercises: [{ id: "1" }, { id: "2", type: "cardio" }] } } };
  migrateWorkouts(w);
  assert.equal(w.workouts.A.exercises[0].type, "strength");
  assert.equal(w.workouts.A.exercises[1].type, "cardio");
});

test("migrateWorkouts: não apaga o grupo muscular dos exercícios", () => {
  const w = { workouts: { A: { exercises: [{ id: "1", group: "Bíceps" }] } } };
  migrateWorkouts(w);
  assert.equal(w.workouts.A.exercises[0].group, "Bíceps");
});

test("migrateWorkouts: body inválido vira lista; registros sem data válida saem; ganham id", () => {
  const w = { workouts: {}, body: [{ date: "2026-10-01", weight: 80 }, { date: "01/10/2026" }, null, "x", { date: "2026-10-02", id: "keep" }] };
  migrateWorkouts(w);
  assert.equal(w.body.length, 2);
  assert.match(w.body[0].id, /^b/);
  assert.equal(w.body[1].id, "keep");
  const w2 = { body: "lixo" };
  migrateWorkouts(w2);
  assert.deepEqual(w2.body, []);
});

test("migrateWorkouts: grava a versão atual do schema", () => {
  const w = {};
  migrateWorkouts(w);
  assert.equal(w.schemaVersion, SCHEMA_VERSION);
});
