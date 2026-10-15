import { initExIdCounter, initRestCounter } from "../counters.js";
import { migrateActiveSession, migrateSessionSnapshots, migrateSessions, migrateSettings, migrateWorkouts } from "../data-migrations.js";
import { persist } from "../persistence.js";
import { store } from "../store.js";
import { showToast } from "../ui/toast.js";
import { todayKey } from "../utils/format.js";
import { render } from "../views/render.js";
import { sessionsFor } from "../workouts/sessions.js";
import { adoptInlineAvatar } from "../storage/avatar.js";
import { markSessionsDirty, releaseLegacyCopy } from "../storage/session-store.js";
import { takeAutoBackup } from "./auto-backup.js";
import { buildCsv } from "./csv.js";
import { deliverFile } from "./validate.js";

export async function mergeImportData(parsed) {
  await takeAutoBackup(true);
  migrateSessions(parsed);
  migrateSettings(parsed);
  migrateActiveSession(parsed);
  migrateWorkouts(parsed);
  migrateSessionSnapshots(parsed);
  Object.keys(parsed.sessions || {}).forEach((k) => {
    const incoming = parsed.sessions[k] || [];
    const existing = sessionsFor(k);
    const seen = new Set(existing.map((x) => x.id));
    const merged = existing.slice();
    incoming.forEach((x) => {
      if (!seen.has(x.id)) merged.push(x);
    });
    store.data.sessions[k] = merged;
    markSessionsDirty(k);
  });
  const seenBody = new Set((store.data.body || []).map((b) => b.id));
  (parsed.body || []).forEach((b) => {
    if (!seenBody.has(b.id)) store.data.body.push(b);
  });
  initExIdCounter();
  initRestCounter();
  store.overlay = null;
  render();
  await persist({ flush: true });
  showToast("Sessões mescladas");
}

export async function replaceImportData(parsed, msg) {
  await takeAutoBackup(true);
  store.data = {
    ...store.data,
    ...parsed
  };
  store.data.body = Array.isArray(parsed.body) ? parsed.body : [];
  migrateSessions(store.data);
  migrateSettings(store.data);
  migrateActiveSession(store.data);
  migrateWorkouts(store.data);
  migrateSessionSnapshots(store.data);
  store.data.activeSession = {
    letter: null,
    state: "idle",
    elapsedMs: 0,
    startedAt: null,
    startedDate: null
  };
  store.data.settings.restTimerActive = null;
  await adoptInlineAvatar(store.data);
  initExIdCounter();
  initRestCounter();
  store.overlay = null;
  render();
  await persist({ flush: true });
  showToast(msg || "Backup importado");
}

export async function exportBackup() {
  try {
    const out = { ...store.data, settings: { ...store.data.settings, avatarUrl: store.data.settings.avatarUrl || store.avatarUrl || null } };
    const data = JSON.stringify(out, null, 2);
    const res = await deliverFile(data, `meus-treinos-backup-${todayKey()}.json`, "application/json", "Backup Meus Treinos");
    if (res === "cancelled") return;
    store.data.settings.lastBackupAt = new Date().toISOString();
    render();
    await persist({ flush: true });
    try {
      await releaseLegacyCopy(); // só libera a cópia antiga se tudo conferir (ver session-store.js)
    } catch (e) {}
    showToast(res === "shared" ? "Backup compartilhado" : "Backup exportado");
  } catch (e) {
    showToast("Não foi possível exportar");
  }
}

export async function exportCsv() {
  try {
    const csv = buildCsv();
    const res = await deliverFile("\ufeff" + csv, `meus-treinos-${todayKey()}.csv`, "text/csv;charset=utf-8", "Treinos em CSV");
    if (res === "cancelled") return;
    showToast(res === "shared" ? "CSV compartilhado" : "CSV exportado");
  } catch (e) {
    showToast("Não foi possível exportar CSV");
  }
}

/* ============================================================
   TABBAR
   ============================================================ */
