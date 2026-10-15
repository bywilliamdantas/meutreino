import { coreKey, journalKey, storageKey, userId } from "../config.js";
import { migrateActiveSession, migrateSessionSnapshots, migrateSessions, migrateSettings, migrateWorkouts } from "../data-migrations.js";
import { store } from "../store.js";
import { ST_META, idbGet, idbPut, isQuotaError, openDb } from "./idb.js";
import { dbListDayKeys, dbReadDays, dbReadDaysSubset, dbWriteDays, migrationMetaKey } from "./sessions-db.js";

/* ============================================================
   HISTÓRICO DE SESSÕES NO INDEXEDDB (v8.6 — etapa 15)

   Dois modos, decididos no boot:
   - "legacy": tudo no localStorage (`gym-data:<user>`), como antes.
   - "idb":    o núcleo (tudo menos sessions) em `gym-data-v2:<user>` e as
               sessões no IndexedDB, um registro por dia.

   O PONTO DE VIRADA é a existência do núcleo no localStorage (uma única
   gravação síncrona, feita só depois de a cópia ter sido lida de volta e
   comparada). Antes disso nada mudou; o dado antigo nunca é apagado pela
   migração.

   Gravação: persist() só grava o núcleo + um diário com os dias sujos (poucos
   KB, síncrono). O IndexedDB é gravado depois (debounce), numa transação só,
   e relido para conferir; só então o diário é limpo. Se o app for encerrado
   antes, o diário é reaplicado no próximo boot.
   ============================================================ */

export const TUNING = {
  debounceMs: 600,
  maxWaitMs: 3000,
  retryDelays: [300, 1200],
  chunkDays: 200
};

const fresh = () => ({
  mode: "legacy",
  blocked: false, // modo idb, mas a leitura falhou: não grava nada por cima
  name: null, // username (chave do localStorage)
  user: null, // id no IndexedDB
  saved: new Map(), // data -> JSON do que está confirmado no IndexedDB
  marked: new Set(), // dias sujos conhecidos (vão para o diário)
  timer: null,
  firstAt: 0,
  flushing: null,
  again: false,
  migratedAt: null,
  lastError: null,
  report: {},
  listener: null
});

const st = fresh();

const ls = () => window.localStorage;
const sig = (v) => JSON.stringify(v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const currentName = () => (store.currentUser ? store.currentUser.username : null);

export const sessionsMode = () => st.mode;
export const sessionsReport = () => st.report;

/* Quem quiser saber o resultado de cada flush (indicador de "salvo"). */
export function setFlushListener(fn) {
  st.listener = fn;
}

export function resetSessionStore() {
  clearTimeout(st.timer);
  const listener = st.listener;
  Object.assign(st, fresh(), { listener });
}

/* ---------- núcleo e diário (localStorage, síncronos) ---------- */

export function readCoreRaw() {
  try {
    return ls().getItem(coreKey());
  } catch (e) {
    return null;
  }
}

export function writeCore() {
  const rest = { ...store.data };
  delete rest.sessions;
  const days = store.data.sessions ? Object.keys(store.data.sessions).length : 0;
  ls().setItem(coreKey(st.name), JSON.stringify({ ...rest, _sessionsIn: "idb", _sessionDays: days, _migratedAt: st.migratedAt }));
}

function journalFor(dates) {
  const days = {};
  const cur = store.data.sessions || {};
  dates.forEach((d) => {
    days[d] = Object.prototype.hasOwnProperty.call(cur, d) ? { v: cur[d] } : null;
  });
  return days;
}

function writeJournal(dates) {
  const key = journalKey(st.name);
  if (!dates.length) {
    ls().removeItem(key);
    return;
  }
  ls().setItem(key, JSON.stringify({ v: 1, days: journalFor(dates) }));
}

function readJournal() {
  let raw = null;
  try {
    raw = ls().getItem(journalKey());
  } catch (e) {
    return null;
  }
  if (raw == null || raw === "") return null;
  try {
    const j = JSON.parse(raw);
    if (j && j.days && typeof j.days === "object") return j;
  } catch (e) {}
  return { corrupt: true, days: {} };
}

/* Parte síncrona do persist() no modo idb: núcleo + diário. Lança em caso de erro. */
export function saveCoreAndJournal() {
  writeCore();
  writeJournal([...st.marked]);
}

export function markSessionsDirty(date) {
  if (st.mode === "idb" && date) st.marked.add(date);
}

/* ---------- flush (IndexedDB, assíncrono, em lote) ---------- */

function collectBatch(saved) {
  const cur = store.data.sessions || {};
  const puts = {};
  const sigs = {};
  Object.keys(cur).forEach((d) => {
    const s = sig(cur[d]);
    if (saved.get(d) !== s) {
      puts[d] = cur[d];
      sigs[d] = s;
    }
  });
  const dels = [];
  saved.forEach((_, d) => {
    if (!Object.prototype.hasOwnProperty.call(cur, d)) dels.push(d);
  });
  return { puts, sigs, dels };
}

async function retrying(fn) {
  let err;
  for (let i = 0; i <= TUNING.retryDelays.length; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      if (isQuotaError(e) || i === TUNING.retryDelays.length) break;
      await wait(TUNING.retryDelays[i]);
    }
  }
  throw err;
}

async function flushOnce() {
  const { user, saved } = st;
  const { puts, sigs, dels } = collectBatch(saved);
  const putDates = Object.keys(puts);
  if (!putDates.length && !dels.length) {
    st.marked.clear();
    try {
      writeJournal([]);
    } catch (e) {}
    return true;
  }
  const batchDates = [...putDates, ...dels];
  st.marked.clear();
  try {
    await retrying(() => dbWriteDays(user, puts, dels));
    const back = await dbReadDaysSubset(user, batchDates);
    putDates.forEach((d) => {
      if (!(d in back) || sig(back[d]) !== sigs[d]) throw new Error("verify-failed:" + d);
    });
    dels.forEach((d) => {
      if (d in back) throw new Error("verify-failed:" + d);
    });
    putDates.forEach((d) => saved.set(d, sigs[d]));
    dels.forEach((d) => saved.delete(d));
    st.lastError = null;
    try {
      writeJournal([...st.marked]); // só o que ficou sujo durante a gravação
    } catch (e) {}
    return true;
  } catch (e) {
    batchDates.forEach((d) => st.marked.add(d)); // continua sujo; o diário preserva
    st.lastError = e;
    try {
      writeJournal([...st.marked]);
    } catch (e2) {}
    return false;
  }
}

export function flushSessions() {
  if (st.mode !== "idb" || st.blocked) return Promise.resolve(true);
  if (st.flushing) {
    st.again = true;
    return st.flushing;
  }
  st.flushing = (async () => {
    let ok = true;
    try {
      do {
        st.again = false;
        ok = await flushOnce();
      } while (st.again && ok);
    } finally {
      st.flushing = null;
    }
    return ok;
  })();
  return st.flushing;
}

function runFlush() {
  return flushSessions().then((ok) => {
    if (st.listener) st.listener(ok, st.lastError);
    return ok;
  });
}

/* Debounce: junta várias alterações numa gravação só, esperando no máximo maxWaitMs. */
export function scheduleFlush() {
  const now = Date.now();
  if (!st.timer) st.firstAt = now;
  clearTimeout(st.timer);
  const delay = Math.max(0, Math.min(TUNING.debounceMs, TUNING.maxWaitMs - (now - st.firstAt)));
  st.timer = setTimeout(() => {
    st.timer = null;
    runFlush();
  }, delay);
}

export function flushNow() {
  clearTimeout(st.timer);
  st.timer = null;
  return runFlush();
}

export const hasPendingFlush = () => !!st.timer || !!st.flushing || st.marked.size > 0;
export const isBlocked = () => st.blocked;

/* ---------- leitura no boot (modo idb) ---------- */

function readLegacyParsed() {
  try {
    const raw = ls().getItem(storageKey());
    if (raw == null) return null;
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : null;
  } catch (e) {
    return null;
  }
}

function runMigrations() {
  migrateSessions(store.data);
  migrateSettings(store.data);
  migrateActiveSession(store.data);
  migrateWorkouts(store.data);
  migrateSessionSnapshots(store.data);
}

/* Devolve true se carregou no modo idb; false se o núcleo é ilegível e não há
   prova de migração concluída (aí o chamador segue pelo caminho antigo).
   Lança em falha de leitura do IndexedDB: o chamador marca loadFailed e NADA é
   gravado por cima (st.blocked). */
export async function loadFromCore(coreRaw) {
  const name = currentName();
  const user = userId();
  let core = null;
  try {
    core = JSON.parse(coreRaw);
  } catch (e) {}
  // enquanto não terminar de ler, nada é gravado por cima (blocked)
  Object.assign(st, { mode: "idb", name, user, blocked: true });
  if (!(core && core.order && core.workouts)) {
    const meta = await idbGet(ST_META, migrationMetaKey(user));
    if (!meta || (meta.state !== "verified" && meta.state !== "done")) {
      Object.assign(st, { mode: "legacy", blocked: false });
      return false;
    }
    try {
      ls().setItem(`${coreKey(name)}:corrupt`, coreRaw); // preserva o ilegível
    } catch (e) {}
    const leg = readLegacyParsed();
    core = leg ? { ...leg } : {};
    delete core.sessions;
    st.report.coreRestored = true;
  }
  const sessionDays = Number(core._sessionDays) || 0;
  const migratedAt = core._migratedAt || null;
  delete core._sessionsIn;
  delete core._sessionDays;
  delete core._migratedAt;
  store.data = { ...store.data, ...core };
  st.migratedAt = migratedAt;
  const rows = await dbReadDays(user); // se falhar, fica blocked e o chamador marca loadFailed
  const journal = readJournal();
  const jDays = journal && journal.days ? Object.keys(journal.days) : [];
  let days = rows.days;
  if (rows.corrupt.length) st.report.corruptRows = rows.corrupt;
  if (journal && journal.corrupt) st.report.journalCorrupt = true;
  let recovered = false;
  if (!Object.keys(days).length && sessionDays > 0 && !jDays.length) {
    // o núcleo diz que havia histórico e o IndexedDB veio vazio (apagado pelo navegador?)
    const leg = readLegacyParsed();
    const legSessions = leg && leg.sessions && typeof leg.sessions === "object" ? leg.sessions : null;
    if (!legSessions || !Object.keys(legSessions).length) throw new Error("sessions-missing");
    days = JSON.parse(JSON.stringify(legSessions));
    recovered = true;
    st.report.recoveredFromLegacy = true;
  }
  st.blocked = false;
  const sessions = {};
  Object.keys(days).forEach((d) => {
    sessions[d] = days[d];
    if (!recovered) st.saved.set(d, sig(days[d]));
  });
  jDays.forEach((d) => {
    const e = journal.days[d];
    if (e === null) delete sessions[d];
    else if (e && "v" in e) sessions[d] = e.v;
    st.marked.add(d);
  });
  store.data.sessions = sessions;
  runMigrations();
  if (jDays.length || recovered) {
    st.report.replayed = jDays.length;
    await flushSessions();
  }
  return true;
}

/* ---------- migração localStorage → IndexedDB ---------- */

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/* Idempotente. Nunca apaga o dado antigo. Em qualquer dúvida devolve um status
   diferente de "migrated" e o app segue no modo antigo. */
export async function migrateSessionsToIdb() {
  if (st.mode === "idb") return { status: "already" };
  if (store.loadFailed) return { status: "load-failed" };
  const name = currentName();
  const user = userId();
  let raw = null;
  try {
    raw = ls().getItem(storageKey());
  } catch (e) {
    return { status: "no-legacy" };
  }
  if (raw == null || raw === "") return { status: "no-legacy" };
  let legacy;
  try {
    legacy = JSON.parse(raw);
  } catch (e) {
    return { status: "corrupt-legacy" };
  }
  if (!legacy || typeof legacy !== "object" || !legacy.order || !legacy.workouts) return { status: "corrupt-legacy" };
  const rawSessions = legacy.sessions === undefined ? {} : legacy.sessions;
  if (!rawSessions || typeof rawSessions !== "object" || Array.isArray(rawSessions)) return { status: "corrupt-legacy" };
  try {
    await openDb();
  } catch (e) {
    return { status: "idb-unavailable" };
  }
  const dates = Object.keys(rawSessions);
  try {
    // 1) copiar (em fatias) e limpar sobras de uma tentativa anterior
    const existing = await dbListDayKeys(user);
    const stale = existing.filter((d) => !Object.prototype.hasOwnProperty.call(rawSessions, d));
    for (const part of chunk(stale, TUNING.chunkDays)) await dbWriteDays(user, {}, part);
    for (const part of chunk(dates, TUNING.chunkDays)) {
      const puts = {};
      part.forEach((d) => {
        puts[d] = rawSessions[d];
      });
      await dbWriteDays(user, puts, []);
    }
    // 2) ler tudo de volta e comparar dia a dia
    const back = await dbReadDays(user);
    const backDates = Object.keys(back.days);
    if (back.corrupt.length || backDates.length !== dates.length) return { status: "unverified" };
    for (const d of dates) {
      if (!(d in back.days) || sig(back.days[d]) !== sig(rawSessions[d])) return { status: "unverified" };
    }
    await idbPut(ST_META, { key: migrationMetaKey(user), state: "verified", days: dates.length, legacyChars: raw.length, at: new Date().toISOString() });
  } catch (e) {
    return { status: "copy-failed", error: String((e && e.name) || e) };
  }
  // 3) núcleo no localStorage, lido de volta; esta gravação é o ponto de virada
  const migratedAt = new Date().toISOString();
  const rest = { ...legacy };
  delete rest.sessions;
  const coreJson = JSON.stringify({ ...rest, _sessionsIn: "idb", _sessionDays: dates.length, _migratedAt: migratedAt });
  const ck = coreKey(name);
  try {
    ls().setItem(ck, coreJson);
    if (ls().getItem(ck) !== coreJson) throw new Error("core-readback");
  } catch (e) {
    try {
      ls().removeItem(ck);
    } catch (e2) {}
    return { status: "core-failed", error: String((e && e.name) || e) };
  }
  // 4) a partir daqui o app usa o IndexedDB
  Object.assign(st, { mode: "idb", name, user, migratedAt, blocked: false });
  dates.forEach((d) => st.saved.set(d, sig(rawSessions[d])));
  try {
    await flushSessions(); // grava o que as migrações em memória mudaram (ex.: ids novos)
    await idbPut(ST_META, { key: migrationMetaKey(user), state: "done", days: dates.length, legacyChars: raw.length, at: migratedAt });
  } catch (e) {}
  return { status: "migrated", days: dates.length };
}

/* ---------- cópia antiga: só sai depois de um backup exportado e conferência ---------- */

export async function releaseLegacyCopy() {
  if (st.mode !== "idb" || st.blocked) return "skip";
  let raw = null;
  try {
    raw = ls().getItem(storageKey());
  } catch (e) {
    return "skip";
  }
  if (raw == null) return "none";
  const migrated = Date.parse(st.migratedAt || "");
  const backup = Date.parse((store.data.settings && store.data.settings.lastBackupAt) || "");
  if (!(migrated > 0 && backup > migrated)) return "waiting-backup";
  if (!(await flushSessions())) return "flush-failed";
  if (st.marked.size) return "pending";
  const rows = await dbReadDays(st.user);
  const mem = store.data.sessions || {};
  const memDates = Object.keys(mem);
  if (rows.corrupt.length || memDates.length !== Object.keys(rows.days).length) return "mismatch";
  for (const d of memDates) {
    if (!(d in rows.days) || sig(rows.days[d]) !== sig(mem[d])) return "mismatch";
  }
  ls().removeItem(storageKey());
  return "released";
}

/* ---------- reversão (emergência; sem botão na interface) ---------- */

export async function rollbackToLocalStorage() {
  if (st.mode !== "idb" || st.blocked) return "skip";
  if (!(await flushSessions())) throw new Error("flush-failed");
  const rows = await dbReadDays(st.user);
  const full = { ...store.data, sessions: rows.days };
  const json = JSON.stringify(full);
  const key = storageKey();
  ls().setItem(key, json);
  if (ls().getItem(key) !== json) throw new Error("rollback-readback");
  ls().removeItem(coreKey(st.name));
  ls().removeItem(journalKey(st.name));
  try {
    await idbPut(ST_META, { key: migrationMetaKey(st.user), state: "rolled-back", at: new Date().toISOString() });
  } catch (e) {}
  const listener = st.listener;
  clearTimeout(st.timer);
  Object.assign(st, fresh(), { listener });
  return "rolled-back";
}
