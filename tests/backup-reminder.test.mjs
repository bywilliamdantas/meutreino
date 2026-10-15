// Testes da regra "devo oferecer backup?" (src/backup/backup-reminder.js)
// e da migração dos campos de frequência (src/data-migrations.js).
// node --test tests/backup-reminder.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  backupOffer,
  normalizeBackupEvery,
  shouldOfferBackup,
  snoozeUntilIso,
  workoutsSinceBackup,
  BACKUP_SNOOZE_DAYS
} from "../src/backup/backup-reminder.js";
import { migrateSettings } from "../src/data-migrations.js";
import { SCHEMA_VERSION } from "../src/data/constants.js";

const NOW = new Date("2026-10-13T12:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const ago = (d) => new Date(NOW - d * DAY).toISOString();
const base = { every: 7, lastBackupAt: ago(1), snoozedUntil: null, workoutsSince: 0, hasData: true, now: NOW };

/* ---------- normalizeBackupEvery ---------- */

test("normalizeBackupEvery: aceita 3, 7, 14 e 0 (desligado)", () => {
  [3, 7, 14, 0].forEach((n) => assert.equal(normalizeBackupEvery(n), n));
  assert.equal(normalizeBackupEvery("14"), 14);
  assert.equal(normalizeBackupEvery("0"), 0);
});

test("normalizeBackupEvery: inválido ou ausente → padrão 7", () => {
  [undefined, null, "", false, NaN, 5, -1, "abc", 100, {}].forEach((v) => assert.equal(normalizeBackupEvery(v), 7));
});

/* ---------- shouldOfferBackup / backupOffer ---------- */

test("desligado (0) nunca oferece, mesmo sem backup e com muitos treinos", () => {
  assert.equal(shouldOfferBackup({ ...base, every: 0, lastBackupAt: null, workoutsSince: 99 }), false);
});

test("sem dados nunca oferece", () => {
  assert.equal(shouldOfferBackup({ ...base, hasData: false, lastBackupAt: null }), false);
});

test("nunca exportou (lastBackupAt nulo) e há dados → oferece (never)", () => {
  const r = backupOffer({ ...base, lastBackupAt: null });
  assert.equal(r.offer, true);
  assert.equal(r.reason, "never");
  assert.equal(r.days, Infinity);
});

test("data inválida em lastBackupAt é tratada como nunca exportou", () => {
  assert.equal(backupOffer({ ...base, lastBackupAt: "lixo" }).reason, "never");
});

test("backup recente e poucos treinos → não oferece", () => {
  assert.equal(shouldOfferBackup({ ...base, lastBackupAt: ago(2), workoutsSince: 3 }), false);
});

test("N treinos desde o último backup → oferece (workouts)", () => {
  const r = backupOffer({ ...base, every: 7, lastBackupAt: ago(2), workoutsSince: 7 });
  assert.equal(r.offer, true);
  assert.equal(r.reason, "workouts");
  assert.equal(shouldOfferBackup({ ...base, every: 7, lastBackupAt: ago(2), workoutsSince: 6 }), false);
});

test("N dias desde o último backup → oferece (days), mesmo com 0 treinos novos", () => {
  const r = backupOffer({ ...base, every: 7, lastBackupAt: ago(7), workoutsSince: 0 });
  assert.equal(r.offer, true);
  assert.equal(r.reason, "days");
  assert.equal(shouldOfferBackup({ ...base, every: 7, lastBackupAt: ago(6.9) }), false);
});

test("a frequência escolhida muda o limite (3, 7, 14)", () => {
  const in5 = { ...base, lastBackupAt: ago(5), workoutsSince: 5 };
  assert.equal(shouldOfferBackup({ ...in5, every: 3 }), true);
  assert.equal(shouldOfferBackup({ ...in5, every: 7 }), false);
  assert.equal(shouldOfferBackup({ ...in5, every: 14 }), false);
  assert.equal(shouldOfferBackup({ ...in5, every: 14, lastBackupAt: ago(14) }), true);
});

test("every ausente/inválido usa o padrão 7", () => {
  assert.equal(shouldOfferBackup({ ...base, every: undefined, workoutsSince: 7 }), true);
  assert.equal(shouldOfferBackup({ ...base, every: undefined, workoutsSince: 6 }), false);
});

test("adiado (agora não) não oferece até o fim do adiamento", () => {
  const due = { ...base, lastBackupAt: null };
  assert.equal(shouldOfferBackup({ ...due, snoozedUntil: new Date(NOW + DAY).toISOString() }), false);
  assert.equal(shouldOfferBackup({ ...due, snoozedUntil: new Date(NOW).toISOString() }), true);
  assert.equal(shouldOfferBackup({ ...due, snoozedUntil: new Date(NOW - DAY).toISOString() }), true);
  assert.equal(shouldOfferBackup({ ...due, snoozedUntil: "lixo" }), true);
});

test("snoozeUntilIso adia por BACKUP_SNOOZE_DAYS dias", () => {
  assert.equal(new Date(snoozeUntilIso(NOW)).getTime(), NOW + BACKUP_SNOOZE_DAYS * DAY);
});

/* ---------- workoutsSinceBackup ---------- */

const workouts = { A: { exercises: [] }, B: { exercises: [] }, R: { isRest: true, exercises: [] } };
const sess = (letter, daysAgo, ended = true) => ({ id: `${letter}${daysAgo}`, letter, log: {}, endedAt: ended ? NOW - daysAgo * DAY : null });

test("workoutsSinceBackup: conta só treinos finalizados depois do backup, sem descanso", () => {
  const sessions = {
    "2026-10-01": [sess("A", 12)],
    "2026-10-09": [sess("B", 4), sess("R", 4)],
    "2026-10-11": [sess("A", 2), sess("A", 2, false)]
  };
  assert.equal(workoutsSinceBackup(sessions, workouts, ago(5)), 2);
  assert.equal(workoutsSinceBackup(sessions, workouts, ago(1)), 0);
});

test("workoutsSinceBackup: sem backup anterior conta tudo; entradas antigas (objeto) não quebram", () => {
  const sessions = { "2026-10-01": [sess("A", 12)], "2026-10-02": sess("B", 11) };
  assert.equal(workoutsSinceBackup(sessions, workouts, null), 2);
  assert.equal(workoutsSinceBackup(undefined, workouts, null), 0);
});

/* ---------- migração ---------- */

test("migrateSettings: arquivo antigo ganha backupEvery 7 e snooze nulo", () => {
  const s = { settings: { lastBackupAt: null } };
  migrateSettings(s);
  assert.equal(s.settings.backupEvery, 7);
  assert.equal(s.settings.backupSnoozedUntil, null);
});

test("migrateSettings: sem settings também cria os campos", () => {
  const s = {};
  migrateSettings(s);
  assert.equal(s.settings.backupEvery, 7);
});

test("migrateSettings: preserva 3, 14 e 0 (desligado)", () => {
  [3, 14, 0].forEach((n) => {
    const s = { settings: { backupEvery: n } };
    migrateSettings(s);
    assert.equal(s.settings.backupEvery, n);
  });
});

test("migrateSettings: valor inválido volta ao padrão; snooze inválido vira nulo", () => {
  const s = { settings: { backupEvery: 5, backupSnoozedUntil: "xx" } };
  migrateSettings(s);
  assert.equal(s.settings.backupEvery, 7);
  assert.equal(s.settings.backupSnoozedUntil, null);
});

test("migrateSettings: snooze válido é mantido; rodar duas vezes não muda nada", () => {
  const iso = new Date(NOW).toISOString();
  const s = { settings: { backupEvery: 14, backupSnoozedUntil: iso } };
  migrateSettings(s);
  const once = JSON.stringify(s);
  migrateSettings(s);
  assert.equal(JSON.stringify(s), once);
  assert.equal(s.settings.backupSnoozedUntil, iso);
});

test("não houve salto de SCHEMA_VERSION (continua 4)", () => {
  assert.equal(SCHEMA_VERSION, 4);
});
