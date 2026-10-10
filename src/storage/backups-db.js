import { AUTOBACKUP_MAX, autobackupKey, userId } from "../config.js";
import { ST_BACKUPS, runTx } from "./idb.js";

/* Registro no IndexedDB: { id, user, date, at, sessions, data }
   — o mesmo formato das entradas antigas do localStorage, mais id e user. */
export const backupId = (user, entry, i) => `${user}|${entry && entry.at ? entry.at : `${entry && entry.date || ""}#${i}`}`;

const sortKey = b => String(b && (b.at || b.date) || "");

export function sortNewest(rows) {
  return rows.slice().sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}

/* Lê (sem alterar nada) a lista antiga do localStorage.
   status: "none" | "ok" | "corrupt" */
export function readLegacyBackups(user = userId()) {
  let raw = null;
  try {
    raw = window.localStorage.getItem(autobackupKey());
  } catch (e) {
    return { status: "none", entries: [], raw: null };
  }
  if (raw == null || raw === "") return { status: "none", entries: [], raw };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { status: "corrupt", entries: [], raw };
  }
  if (!Array.isArray(parsed)) return { status: "corrupt", entries: [], raw };
  const entries = [];
  parsed.forEach((e, i) => {
    if (e && typeof e === "object") entries.push({ ...e, id: backupId(user, e, i), user });
  });
  return { status: "ok", entries, raw };
}

export async function dbListBackups(user = userId()) {
  const rows = await runTx(ST_BACKUPS, "readonly", s => {
    const r = s.index("user").getAll(user);
    return () => r.result;
  });
  return sortNewest(rows);
}

/* Grava vários registros numa transação (sem podar) — usado pela migração. */
export function dbPutBackups(records) {
  return runTx(ST_BACKUPS, "readwrite", s => {
    records.forEach(r => s.put(r));
  });
}

/* Grava o novo backup e poda os mais antigos além do limite, tudo na mesma
   transação: se a gravação falhar (cota), NADA é apagado. */
export function dbSaveBackup(record, user = userId(), max = AUTOBACKUP_MAX) {
  return runTx(ST_BACKUPS, "readwrite", s => {
    s.put(record);
    const req = s.index("user").getAll(user);
    req.onsuccess = () => {
      sortNewest(req.result).slice(max).forEach(r => s.delete(r.id));
    };
  });
}
