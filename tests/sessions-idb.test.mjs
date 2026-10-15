// Etapa 15 — histórico de sessões no IndexedDB (fake-indexeddb).
// Cobre: migração grande, interrupção, dados corrompidos, falha de gravação,
// lote/debounce, idempotência, liberação da cópia antiga e reversão.
import "fake-indexeddb/auto";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

// ---- ambiente mínimo (sem jsdom): localStorage fake + document vazio ----
function makeLS() {
  const m = new Map();
  const ls = {
    _fail: null, // (key) => Error | null
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      const e = ls._fail && ls._fail(k, v);
      if (e) throw e;
      m.set(k, String(v));
    },
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    _map: m
  };
  return ls;
}
globalThis.window = { localStorage: makeLS() };
globalThis.document = { getElementById: () => null };

const { store } = await import("../src/store.js");
const { loadData, persist } = await import("../src/persistence.js");
const S = await import("../src/storage/session-store.js");
const { dbReadDays, dbWriteDays } = await import("../src/storage/sessions-db.js");
const { idbPut, ST_META } = await import("../src/storage/idb.js");

const DEFAULT_DATA = JSON.parse(JSON.stringify(store.data));
S.TUNING.debounceMs = 5;
S.TUNING.maxWaitMs = 30;
S.TUNING.retryDelays = [1, 1];
S.TUNING.chunkDays = 50;

// um teste que falha no meio não pode deixar o put quebrado para os seguintes
const ORIG_PUT = IDBObjectStore.prototype.put;
afterEach(() => {
  IDBObjectStore.prototype.put = ORIG_PUT;
});

let n = 0;
function setup() {
  const user = `u${++n}`;
  window.localStorage = makeLS();
  store.currentUser = { username: user };
  store.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
  store.loadFailed = false;
  S.resetSessionStore();
  S.setFlushListener(null);
  return user;
}
const LEG = (u) => `gym-data:${u}`;
const CORE = (u) => `gym-data-v2:${u}`;
const JRN = (u) => `gym-journal:${u}`;
const ls = () => window.localStorage;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// "reinício do app": zera memória e estado do módulo, mantém localStorage e IndexedDB
const reboot = () => {
  store.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
  store.loadFailed = false;
  S.resetSessionStore();
};

function dayKey(i) {
  const d = new Date(Date.UTC(2020, 0, 1) + i * 86400000);
  return d.toISOString().slice(0, 10);
}
function makeSessions(days, setsPerDay = 40) {
  const out = {};
  for (let i = 0; i < days; i++) {
    const log = {};
    for (let e = 0; e < 4; e++) {
      log["e" + e] = Array.from({ length: setsPerDay / 4 }, (_, k) => ({ weight: 20 + k + (i % 50), reps: 8 + k, done: true }));
    }
    out[dayKey(i)] = [{ id: "s" + i, letter: "A", log, startedAt: i, endedAt: i + 1, snapshot: [{ id: "e0", name: "Supino", type: "strength" }] }];
  }
  return out;
}
function seedLegacy(u, sessions, extra = {}) {
  const data = {
    order: ["A", "B", "C"],
    workouts: {
      A: { name: "Treino A", exercises: [{ id: "e0", name: "Supino", type: "strength" }] },
      B: { name: "B", exercises: [] },
      C: { name: "C", exercises: [] }
    },
    sessions,
    body: [],
    schemaVersion: 4,
    activeSession: { letter: null, state: "idle", elapsedMs: 0, startedAt: null, startedDate: null },
    settings: { unit: "kg", displayName: "Fulano" },
    ...extra
  };
  const raw = JSON.stringify(data);
  ls().setItem(LEG(u), raw);
  return { data, raw };
}
const boot = async () => {
  await loadData();
  return S.migrateSessionsToIdb();
};
const sessionsJson = () => JSON.stringify(store.data.sessions);

// injeta falha em put de um store do IndexedDB; devolve função que restaura
function failPut(storeName, when = () => true, err = () => new DOMException("cota", "QuotaExceededError")) {
  const orig = IDBObjectStore.prototype.put;
  let calls = 0;
  IDBObjectStore.prototype.put = function (...a) {
    if (this.name === storeName) {
      calls++;
      if (when(calls, a[0])) throw err();
    }
    return orig.apply(this, a);
  };
  return () => {
    IDBObjectStore.prototype.put = orig;
  };
}
function countPuts(storeName) {
  const orig = IDBObjectStore.prototype.put;
  const c = { puts: 0 };
  IDBObjectStore.prototype.put = function (...a) {
    if (this.name === storeName) c.puts++;
    return orig.apply(this, a);
  };
  c.restore = () => {
    IDBObjectStore.prototype.put = orig;
  };
  return c;
}

// ======================= MIGRAÇÃO =======================

test("migração com dados grandes: idêntica, sem apagar a cópia antiga", async () => {
  const u = setup();
  const sessions = makeSessions(4000);
  const { raw } = seedLegacy(u, sessions);
  assert.ok(raw.length > 5 * 1024 * 1024, `fixture deveria passar de 5 MB (${raw.length})`);
  const r = await boot();
  assert.equal(r.status, "migrated");
  assert.equal(r.days, 4000);
  assert.equal(S.sessionsMode(), "idb");
  const rows = await dbReadDays(u);
  assert.equal(Object.keys(rows.days).length, 4000);
  assert.equal(JSON.stringify(rows.days), JSON.stringify(sessions), "dias gravados idênticos ao original");
  assert.equal(ls().getItem(LEG(u)), raw, "cópia antiga intacta");
  const core = JSON.parse(ls().getItem(CORE(u)));
  assert.equal("sessions" in core, false, "núcleo sem sessões");
  assert.equal(core._sessionDays, 4000);
  assert.ok(ls().getItem(CORE(u)).length < 5000, "núcleo pequeno");
  // próximo boot lê do IndexedDB e fica igual
  reboot();
  await loadData();
  assert.equal(S.sessionsMode(), "idb");
  assert.equal(sessionsJson(), JSON.stringify(sessions));
  assert.equal(store.data.settings.displayName, "Fulano");
});

test("idempotente: segunda execução não faz nada e nada muda", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(30));
  assert.equal((await boot()).status, "migrated");
  assert.equal((await S.migrateSessionsToIdb()).status, "already");
  reboot();
  await loadData();
  assert.equal((await S.migrateSessionsToIdb()).status, "already");
  assert.equal(Object.keys((await dbReadDays(u)).days).length, 30);
});

test("interrupção no meio da cópia: legado intacto, modo antigo; reabrir conclui", async () => {
  const u = setup();
  const sessions = makeSessions(200);
  const { raw } = seedLegacy(u, sessions);
  const restore = failPut("sessions", (c) => c === 120); // cai na 3ª fatia (chunk = 50)
  const r1 = await boot();
  restore();
  assert.equal(r1.status, "copy-failed");
  assert.equal(S.sessionsMode(), "legacy");
  assert.equal(ls().getItem(CORE(u)), null, "sem núcleo = sem virada");
  assert.equal(ls().getItem(LEG(u)), raw);
  assert.ok(Object.keys((await dbReadDays(u)).days).length < 200, "cópia parcial no IndexedDB");
  reboot();
  const r2 = await boot();
  assert.equal(r2.status, "migrated");
  assert.equal(JSON.stringify((await dbReadDays(u)).days), JSON.stringify(sessions));
});

test("interrupção: dia sobrando de tentativa anterior é removido (sem duplicar)", async () => {
  const u = setup();
  const sessions = makeSessions(20);
  seedLegacy(u, sessions);
  await dbWriteDays(u, { "1999-01-01": [{ id: "velho", letter: "A", log: {} }] });
  assert.equal((await boot()).status, "migrated");
  const rows = await dbReadDays(u);
  assert.equal("1999-01-01" in rows.days, false);
  assert.equal(Object.keys(rows.days).length, 20);
});

test("interrupção: falha ao gravar o núcleo (cota) não vira a chave", async () => {
  const u = setup();
  const { raw } = seedLegacy(u, makeSessions(10));
  ls()._fail = (k) => (k === CORE(u) ? new DOMException("cota", "QuotaExceededError") : null);
  const r = await boot();
  assert.equal(r.status, "core-failed");
  assert.equal(S.sessionsMode(), "legacy");
  assert.equal(ls().getItem(CORE(u)), null);
  assert.equal(ls().getItem(LEG(u)), raw);
  ls()._fail = null;
  reboot();
  assert.equal((await boot()).status, "migrated");
});

test("interrupção: registro 'done' não gravado — mesmo assim o próximo boot usa o IndexedDB", async () => {
  const u = setup();
  const sessions = makeSessions(15);
  seedLegacy(u, sessions);
  const restore = failPut(ST_META, (_, v) => v && v.state === "done");
  const r = await boot();
  restore();
  assert.equal(r.status, "migrated");
  reboot();
  await loadData();
  assert.equal(S.sessionsMode(), "idb");
  assert.equal(sessionsJson(), JSON.stringify(sessions));
});

test("sem IndexedDB gravável durante a migração: legado intacto, nada marcado", async () => {
  const u = setup();
  const { raw } = seedLegacy(u, makeSessions(10));
  const restore = failPut("sessions");
  const r = await boot();
  restore();
  assert.equal(r.status, "copy-failed");
  assert.equal(ls().getItem(LEG(u)), raw);
  assert.equal(ls().getItem(CORE(u)), null);
  // o app continua gravando no modo antigo
  store.data.settings.unit = "lb";
  await persist();
  assert.equal(JSON.parse(ls().getItem(LEG(u))).settings.unit, "lb");
});

// ======================= CORROMPIDOS =======================

test("legado com JSON inválido: não migra e não mexe em nada", async () => {
  const u = setup();
  ls().setItem(LEG(u), "{ isto não é json");
  const r = await boot();
  assert.equal(r.status, "load-failed"); // o carregamento já falha: a migração nem começa
  assert.equal(store.loadFailed, true);
  assert.equal(ls().getItem(LEG(u)), "{ isto não é json");
  assert.equal(ls().getItem(CORE(u)), null);
});

test("legado com 'sessions' de tipo errado: não migra", async () => {
  const u = setup();
  const { raw } = seedLegacy(u, []);
  const r = await boot();
  assert.equal(r.status, "corrupt-legacy");
  assert.equal(ls().getItem(LEG(u)), raw);
  assert.equal(ls().getItem(CORE(u)), null);
});

test("legado com dia em formato antigo (string) migra e é normalizado em memória", async () => {
  const u = setup();
  const sessions = { ...makeSessions(3), "2020-06-01": "A" };
  seedLegacy(u, sessions);
  const { raw } = { raw: ls().getItem(LEG(u)) };
  const r = await boot();
  assert.equal(r.status, "migrated");
  assert.equal(JSON.parse(ls().getItem(LEG(u))).sessions["2020-06-01"], "A", "cópia antiga fiel ao original");
  assert.equal(ls().getItem(LEG(u)), raw);
  const rows = await dbReadDays(u);
  assert.ok(Array.isArray(rows.days["2020-06-01"]), "no IndexedDB já normalizado (a diferença em memória foi gravada)");
  assert.equal(rows.days["2020-06-01"][0].letter, "A");
});

test("registro corrompido no IndexedDB: fica de fora, é reportado e NÃO é apagado", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(5));
  await boot();
  // injeta um registro malformado (sem o campo sessions) direto no store
  const { runTx } = await import("../src/storage/idb.js");
  await runTx("sessions", "readwrite", (s) => {
    s.put({ id: `${u}|2030-01-01`, user: u, date: "2030-01-01" });
  });
  reboot();
  await loadData();
  assert.equal(store.loadFailed, false);
  assert.equal(Object.keys(store.data.sessions).length, 5);
  assert.deepEqual(S.sessionsReport().corruptRows, [`${u}|2030-01-01`]);
  store.data.settings.unit = "lb";
  await persist({ flush: true });
  const raw = await runTx("sessions", "readonly", (s) => {
    const r = s.get(`${u}|2030-01-01`);
    return () => r.result;
  });
  assert.ok(raw, "registro corrompido continua lá");
});

test("núcleo corrompido (migração concluída): restaura configurações da cópia antiga, sessões do IndexedDB", async () => {
  const u = setup();
  const sessions = makeSessions(8);
  seedLegacy(u, sessions);
  await boot();
  ls().setItem(CORE(u), "{{{ lixo");
  reboot();
  await loadData();
  assert.equal(store.loadFailed, false);
  assert.equal(S.sessionsMode(), "idb");
  assert.equal(sessionsJson(), JSON.stringify(sessions));
  assert.equal(store.data.settings.displayName, "Fulano");
  assert.equal(ls().getItem(CORE(u) + ":corrupt"), "{{{ lixo", "ilegível preservado");
});

test("núcleo corrompido sem prova de migração: segue pelo caminho antigo", async () => {
  const u = setup();
  const sessions = makeSessions(4);
  seedLegacy(u, sessions);
  ls().setItem(CORE(u), "lixo");
  await loadData();
  assert.equal(S.sessionsMode(), "legacy");
  assert.equal(Object.keys(store.data.sessions).length, 4);
});

test("IndexedDB esvaziado pelo navegador: recupera da cópia antiga em vez de abrir sem histórico", async () => {
  const u = setup();
  const sessions = makeSessions(12);
  seedLegacy(u, sessions);
  await boot();
  await dbWriteDays(u, {}, Object.keys(sessions)); // some tudo
  reboot();
  await loadData();
  assert.equal(store.loadFailed, false);
  assert.equal(Object.keys(store.data.sessions).length, 12);
  assert.equal(S.sessionsReport().recoveredFromLegacy, true);
  assert.equal(Object.keys((await dbReadDays(u)).days).length, 12, "regravado no IndexedDB");
});

test("IndexedDB esvaziado e sem cópia antiga: loadFailed e nada é gravado por cima", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(6));
  await boot();
  ls().removeItem(LEG(u));
  await dbWriteDays(u, {}, Object.keys(makeSessions(6)));
  const coreBefore = ls().getItem(CORE(u));
  reboot();
  await loadData();
  assert.equal(store.loadFailed, true);
  store.data.settings.unit = "lb";
  await persist({ flush: true });
  assert.equal(ls().getItem(CORE(u)), coreBefore, "núcleo (e a contagem de dias) preservado");
});

// ======================= GRAVAÇÃO =======================

test("gravação em lote com debounce: 10 persist() viram uma transação só, e persist() não espera o IndexedDB", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(10));
  await boot();
  const spy = countPuts("sessions");
  const d = dayKey(3);
  for (let i = 0; i < 10; i++) {
    store.data.sessions[d] = [{ id: "x", letter: "B", log: { e0: [{ weight: i, reps: 5, done: true }] } }];
    S.markSessionsDirty(d);
    await persist();
  }
  assert.equal(spy.puts, 0, "persist() voltou sem gravar sessões no IndexedDB");
  assert.ok(ls().getItem(JRN(u)), "diário já guarda o dia sujo (síncrono)");
  assert.equal(JSON.parse(ls().getItem(CORE(u))).settings.unit, "kg");
  await wait(60);
  spy.restore();
  assert.equal(spy.puts, 1, "um único put, só do dia alterado");
  assert.equal((await dbReadDays(u)).days[d][0].log.e0[0].weight, 9);
  assert.equal(ls().getItem(JRN(u)), null, "diário limpo após confirmar e reler");
});

test("rede de segurança: mutação in-place sem markSessionsDirty também é gravada", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(6));
  await boot();
  const d = dayKey(2);
  store.data.sessions[d][0].endedAt = 987654; // como em active-session.js
  await persist({ flush: true });
  assert.equal((await dbReadDays(u)).days[d][0].endedAt, 987654);
});

test("apagar um dia remove o registro", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(6));
  await boot();
  delete store.data.sessions[dayKey(1)];
  S.markSessionsDirty(dayKey(1));
  await persist({ flush: true });
  const rows = await dbReadDays(u);
  assert.equal(dayKey(1) in rows.days, false);
  assert.equal(Object.keys(rows.days).length, 5);
});

test("falha de gravação: nada se perde (diário), indicador de erro, retry e reaplicação no boot", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(5));
  await boot();
  const results = [];
  S.setFlushListener((ok, err) => results.push([ok, err && err.name]));
  const novo = "2099-01-01";
  store.data.sessions[novo] = [{ id: "novo", letter: "A", log: { e0: [{ weight: 100, reps: 5, done: true }] } }];
  S.markSessionsDirty(novo);
  const restore = failPut("sessions");
  await persist();
  await wait(60);
  assert.deepEqual(results.at(-1), [false, "QuotaExceededError"]);
  assert.equal(novo in (await dbReadDays(u)).days, false);
  const j = JSON.parse(ls().getItem(JRN(u)));
  assert.equal(j.days[novo].v[0].id, "novo", "dia preservado no diário");
  // app morre e reabre com o IndexedDB ainda falhando
  reboot();
  await loadData();
  assert.equal(store.data.sessions[novo][0].id, "novo", "diário reaplicado no boot");
  assert.ok(ls().getItem(JRN(u)), "diário continua enquanto não confirmar");
  // IndexedDB volta a funcionar: retry (botão ou próxima gravação)
  restore();
  assert.equal(await S.flushNow(), true);
  assert.equal((await dbReadDays(u)).days[novo][0].id, "novo");
  assert.equal(ls().getItem(JRN(u)), null);
});

test("encerrado antes do flush: o diário recupera no próximo boot", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(5));
  await boot();
  const novo = "2098-05-05";
  store.data.sessions[novo] = [{ id: "perdido?", letter: "C", log: {} }];
  S.markSessionsDirty(novo);
  await persist(); // debounce ainda pendente
  // "iOS mata o app": zera tudo sem deixar o timer rodar
  const timerless = S.resetSessionStore;
  timerless();
  reboot();
  await loadData();
  assert.equal(store.data.sessions[novo][0].id, "perdido?");
  assert.equal((await dbReadDays(u)).days[novo][0].id, "perdido?", "regravado no IndexedDB");
  assert.equal(ls().getItem(JRN(u)), null);
});

test("persistOnHide inicia o flush na hora", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(3));
  await boot();
  const { persistOnHide } = await import("../src/persistence.js");
  const d = dayKey(0);
  store.data.sessions[d] = [{ id: "h", letter: "A", log: {} }];
  S.markSessionsDirty(d);
  assert.equal(persistOnHide(), true);
  await wait(30);
  assert.equal((await dbReadDays(u)).days[d][0].id, "h");
});

// ======================= CÓPIA ANTIGA E REVERSÃO =======================

test("cópia antiga só sai depois de backup exportado + conferência", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(6));
  await boot();
  assert.equal(await S.releaseLegacyCopy(), "waiting-backup");
  assert.ok(ls().getItem(LEG(u)), "ainda existe");
  store.data.settings.lastBackupAt = new Date(Date.now() + 1000).toISOString();
  // divergência entre IndexedDB e memória: não pode apagar
  await dbWriteDays(u, { [dayKey(0)]: [{ id: "adulterado", letter: "A", log: {} }] });
  assert.equal(await S.releaseLegacyCopy(), "mismatch");
  assert.ok(ls().getItem(LEG(u)), "mismatch não apaga");
  // volta a bater (grava a memória por cima) e então libera
  store.data.sessions[dayKey(0)] = [{ id: "ok", letter: "A", log: {} }];
  S.markSessionsDirty(dayKey(0));
  await persist({ flush: true });
  assert.equal(await S.releaseLegacyCopy(), "released");
  assert.equal(ls().getItem(LEG(u)), null);
  // ainda abre normalmente
  reboot();
  await loadData();
  assert.equal(store.data.sessions[dayKey(0)][0].id, "ok");
});

test("reversão: reconstrói o JSON completo no localStorage e volta ao modo antigo", async () => {
  const u = setup();
  const sessions = makeSessions(7);
  seedLegacy(u, sessions);
  await boot();
  store.data.sessions["2031-02-02"] = [{ id: "depois", letter: "B", log: {} }];
  S.markSessionsDirty("2031-02-02");
  await persist();
  assert.equal(await S.rollbackToLocalStorage(), "rolled-back");
  assert.equal(S.sessionsMode(), "legacy");
  const full = JSON.parse(ls().getItem(LEG(u)));
  assert.equal(Object.keys(full.sessions).length, 8);
  assert.equal(full.sessions["2031-02-02"][0].id, "depois");
  assert.equal(ls().getItem(CORE(u)), null);
  assert.equal(ls().getItem(JRN(u)), null);
  reboot();
  await loadData();
  assert.equal(S.sessionsMode(), "legacy");
  assert.equal(Object.keys(store.data.sessions).length, 8);
});

test("reversão com cota cheia: não apaga nada", async () => {
  const u = setup();
  seedLegacy(u, makeSessions(4));
  await boot();
  ls()._fail = (k) => (k === LEG(u) ? new DOMException("cota", "QuotaExceededError") : null);
  await assert.rejects(() => S.rollbackToLocalStorage());
  assert.ok(ls().getItem(CORE(u)), "núcleo continua");
  assert.equal(S.sessionsMode(), "idb");
});

test("usuário novo (sem dados antigos): nada a migrar, segue no modo antigo", async () => {
  setup();
  const r = await boot();
  assert.equal(r.status, "no-legacy");
  assert.equal(S.sessionsMode(), "legacy");
});

test("usuários diferentes não se misturam", async () => {
  const a = setup();
  seedLegacy(a, makeSessions(3));
  await boot();
  const ls1 = window.localStorage;
  const b = `${a}-b`;
  store.currentUser = { username: b };
  reboot();
  ls1.setItem(LEG(b), JSON.stringify({ order: ["A"], workouts: { A: { name: "A", exercises: [] } }, sessions: makeSessions(2), settings: {} }));
  await boot();
  assert.equal(Object.keys((await dbReadDays(a)).days).length, 3);
  assert.equal(Object.keys((await dbReadDays(b)).days).length, 2);
});

test("idbPut disponível para o teste (sanidade)", async () => {
  assert.equal(typeof idbPut, "function");
});
