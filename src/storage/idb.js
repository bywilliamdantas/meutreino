/* ============================================================
   IndexedDB — camada fina e sem dependências.
   Guarda o que NÃO precisa ser lido de forma síncrona e que pesa:
   foto de perfil e backups automáticos. Os dados principais continuam
   no localStorage (leitura síncrona no boot e gravação no beforeunload,
   que o IndexedDB não consegue garantir).
   ============================================================ */

export const DB_NAME = "meus-treinos";
export const DB_VERSION = 1;
export const ST_AVATARS = "avatars"; // chave: user
export const ST_BACKUPS = "autobackups"; // chave: id (índice por user)
export const ST_META = "meta"; // chave: key

let dbPromise = null;

export function idbAvailable() {
  try {
    return typeof globalThis.indexedDB !== "undefined" && globalThis.indexedDB !== null;
  } catch (e) {
    return false;
  }
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!idbAvailable()) {
      reject(new Error("indexeddb-unavailable"));
      return;
    }
    let req;
    try {
      req = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ST_AVATARS)) db.createObjectStore(ST_AVATARS, { keyPath: "user" });
      if (!db.objectStoreNames.contains(ST_BACKUPS)) {
        const s = db.createObjectStore(ST_BACKUPS, { keyPath: "id" });
        s.createIndex("user", "user", { unique: false });
      }
      if (!db.objectStoreNames.contains(ST_META)) db.createObjectStore(ST_META, { keyPath: "key" });
    };
    req.onsuccess = () => {
      const db = req.result;
      // outra aba/versão pediu upgrade: fecha para não bloquear
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error("indexeddb-open-failed"));
    req.onblocked = () => reject(new Error("indexeddb-blocked"));
  }).catch(e => {
    dbPromise = null; // permite nova tentativa depois
    throw e;
  });
  return dbPromise;
}

/* Executa `work(objectStore, tx)` numa transação e resolve só no `oncomplete`
   (ou seja, depois de o navegador confirmar a gravação). `work` pode devolver
   um valor ou uma função (lida no fim) para devolver resultados de requests. */
export async function runTx(storeName, mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(storeName, mode);
    } catch (e) {
      reject(e);
      return;
    }
    let out;
    tx.oncomplete = () => resolve(typeof out === "function" ? out() : out);
    tx.onerror = () => reject(tx.error || new Error("indexeddb-tx-error"));
    tx.onabort = () => reject(tx.error || new Error("indexeddb-tx-abort"));
    try {
      out = work(tx.objectStore(storeName), tx);
    } catch (e) {
      try {
        tx.abort();
      } catch (_) {}
      reject(e);
    }
  });
}

export function isQuotaError(e) {
  return !!e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
}

export const idbGet = (storeName, key) => runTx(storeName, "readonly", s => {
  const r = s.get(key);
  return () => r.result;
});

export const idbPut = (storeName, value) => runTx(storeName, "readwrite", s => {
  s.put(value);
});

export const idbDelete = (storeName, key) => runTx(storeName, "readwrite", s => {
  s.delete(key);
});
