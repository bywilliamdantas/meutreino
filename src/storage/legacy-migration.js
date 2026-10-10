import { autobackupKey, userId } from "../config.js";
import { inlineAvatarOf } from "../data-migrations.js";
import { persist } from "../persistence.js";
import { store } from "../store.js";
import { readAvatar, writeAvatar } from "./avatar.js";
import { dbListBackups, dbPutBackups, readLegacyBackups } from "./backups-db.js";
import { ST_META, idbPut, openDb } from "./idb.js";
import { SCHEMA_VERSION } from "../data/constants.js";

/* ============================================================
   MIGRAÇÃO ÚNICA (v8.1 → v8.2): localStorage → IndexedDB
   Regras:
   1. Copia para o IndexedDB e espera a transação confirmar.
   2. LÊ DE VOLTA e compara byte a byte (JSON) com o original.
   3. Só então apaga a cópia antiga. Qualquer dúvida = não apaga.
   É idempotente: se algo falhar no meio, a próxima abertura continua de onde
   parou (o gatilho é a existência do dado antigo, não um "flag" que poderia
   ficar marcado sem ter terminado).
   ============================================================ */

const strip = ({ id, user, ...rest }) => JSON.stringify(rest);

async function migrateBackups(user, report) {
  const legacy = readLegacyBackups(user);
  if (legacy.status === "none") return;
  if (legacy.status === "corrupt") {
    report.backups = "corrupt"; // ilegível: não mexe, não apaga
    return;
  }
  if (legacy.entries.length) {
    await dbPutBackups(legacy.entries);
    const stored = new Map((await dbListBackups(user)).map(r => [r.id, r]));
    const verified = legacy.entries.every(e => {
      const b = stored.get(e.id);
      return !!b && strip(b) === strip(e);
    });
    if (!verified) {
      report.backups = "unverified";
      return;
    }
  }
  window.localStorage.removeItem(autobackupKey());
  report.backups = legacy.entries.length;
}

async function migrateAvatar(user, report) {
  const inline = inlineAvatarOf(store.data);
  if (!inline) return;
  const existing = await readAvatar(user);
  if (existing && existing !== inline) {
    // já existe outra foto no IndexedDB (escolhida depois): não sobrescreve
    // nem apaga a antiga — fica como está.
    report.avatar = "kept-inline";
    return;
  }
  if (!existing) {
    await writeAvatar(inline, user);
    if (await readAvatar(user) !== inline) {
      report.avatar = "unverified";
      return;
    }
  }
  store.data.settings.avatarUrl = null;
  report.avatar = "moved";
  await persist(); // regrava o JSON principal já sem a foto
}

export async function migrateLegacyStorage() {
  const report = { ok: true, backups: "none", avatar: "none" };
  const user = userId();
  try {
    await openDb();
  } catch (e) {
    return { ...report, ok: false, reason: "idb-unavailable" };
  }
  try {
    await migrateBackups(user, report);
  } catch (e) {
    report.ok = false;
    report.backupsError = String(e && e.name || e);
  }
  try {
    await migrateAvatar(user, report);
  } catch (e) {
    report.ok = false;
    report.avatarError = String(e && e.name || e);
  }
  if (typeof report.backups === "number" || report.avatar === "moved") {
    try {
      await idbPut(ST_META, { key: `migration:${user}`, schema: SCHEMA_VERSION, at: new Date().toISOString(), backups: report.backups, avatar: report.avatar });
    } catch (e) {}
  }
  return report;
}
