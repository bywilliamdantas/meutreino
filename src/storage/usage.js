import { coreKey, journalKey, storageKey } from "../config.js";
import { store } from "../store.js";

/* ~5 MB é o teto típico do localStorage por origem (varia por navegador).
   Contamos 2 bytes por caractere (UTF-16) — estimativa conservadora: melhor
   avisar um pouco antes do que depois. */
export const LOCAL_LIMIT_BYTES = 5 * 1024 * 1024;
export const WARN_RATIO = 0.7;
export const CRIT_RATIO = 0.9;

export function fmtBytes(n) {
  if (!(n > 0)) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  const mb = n / (1024 * 1024);
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1).replace(".", ",")} MB`;
}

export function localStorageBytes() {
  let chars = 0;
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      chars += k.length + (ls.getItem(k) || "").length;
    }
  } catch (e) {}
  return chars * 2;
}

/* Núcleo + diário + cópia antiga (que continua ocupando espaço até o próximo backup). */
function mainDataBytes() {
  try {
    const ls = window.localStorage;
    return [coreKey(), journalKey(), storageKey()].reduce((n, k) => n + (ls.getItem(k) || "").length * 2, 0);
  } catch (e) {
    return 0;
  }
}

/* usage = { local, origin|null, parts, ratio, level, worst } */
export async function readStorageUsage() {
  const localUsed = localStorageBytes();
  const local = { used: localUsed, limit: LOCAL_LIMIT_BYTES, ratio: localUsed / LOCAL_LIMIT_BYTES };
  let origin = null;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      if (e && e.quota > 0) origin = { used: e.usage || 0, limit: e.quota, ratio: (e.usage || 0) / e.quota };
    }
  } catch (e) {}
  const backupsBytes = (store.backupList || []).reduce((sum, b) => {
    try {
      return sum + JSON.stringify(b).length;
    } catch (e) {
      return sum;
    }
  }, 0);
  const parts = {
    main: mainDataBytes(),
    backups: backupsBytes,
    avatar: store.avatarUrl ? store.avatarUrl.length : 0
  };
  const worst = origin && origin.ratio > local.ratio ? "origin" : "local";
  const ratio = Math.max(local.ratio, origin ? origin.ratio : 0);
  const level = ratio >= CRIT_RATIO ? "crit" : ratio >= WARN_RATIO ? "warn" : "ok";
  return { local, origin, parts, ratio, level, worst };
}
