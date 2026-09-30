import { SET_TYPE_NAME } from "../config.js";
import { initExIdCounter, initRestCounter } from "../counters.js";
import { migrateActiveSession, migrateSessions, migrateSettings, migrateWorkouts } from "../data-migrations.js";
import { persist } from "../persistence.js";
import { store } from "../store.js";
import { showToast } from "../ui/toast.js";
import { todayKey } from "../utils/format.js";
import { render } from "../views/render.js";
import { sessionsFor } from "../workouts/sessions.js";
import { takeAutoBackup } from "./auto-backup.js";
import { deliverFile } from "./validate.js";

export async function mergeImportData(parsed) {
  takeAutoBackup(true);
  migrateSessions(parsed);
  migrateSettings(parsed);
  migrateActiveSession(parsed);
  migrateWorkouts(parsed);
  Object.keys(parsed.sessions || {}).forEach(k => {
    const incoming = parsed.sessions[k] || [];
    const existing = sessionsFor(k);
    const seen = new Set(existing.map(x => x.id));
    const merged = existing.slice();
    incoming.forEach(x => {
      if (!seen.has(x.id)) merged.push(x);
    });
    store.data.sessions[k] = merged;
  });
  const seenBody = new Set((store.data.body || []).map(b => b.id));
  (parsed.body || []).forEach(b => {
    if (!seenBody.has(b.id)) store.data.body.push(b);
  });
  initExIdCounter();
  initRestCounter();
  store.overlay = null;
  render();
  await persist();
  showToast("Sessões mescladas");
}

export async function replaceImportData(parsed, msg) {
  takeAutoBackup(true);
  store.data = {
    ...store.data,
    ...parsed
  };
  store.data.body = Array.isArray(parsed.body) ? parsed.body : [];
  migrateSessions(store.data);
  migrateSettings(store.data);
  migrateActiveSession(store.data);
  migrateWorkouts(store.data);
  store.data.activeSession = {
    letter: null,
    state: "idle",
    elapsedMs: 0,
    startedAt: null,
    startedDate: null
  };
  store.data.settings.restTimerActive = null;
  initExIdCounter();
  initRestCounter();
  store.overlay = null;
  render();
  await persist();
  showToast(msg || "Backup importado");
}

export async function exportBackup() {
  try {
    const data = JSON.stringify(store.data, null, 2);
    const res = await deliverFile(data, `meus-treinos-backup-${todayKey()}.json`, "application/json", "Backup Meus Treinos");
    if (res === "cancelled") return;
    store.data.settings.lastBackupAt = new Date().toISOString();
    render();
    await persist();
    showToast(res === "shared" ? "Backup compartilhado" : "Backup exportado");
  } catch (e) {
    showToast("Não foi possível exportar");
  }
}

export async function exportCsv() {
  try {
    const rows = [["data", "ordem", "treino", "exercicio", "tipo", "serie", "tipo_serie", "peso_kg", "reps", "minutos", "feito", "rpe", "nota_exercicio", "nota_treino"]];
    Object.keys(store.data.sessions).sort().forEach(dateKey => {
      const arr = sessionsFor(dateKey);
      arr.forEach((sess, sessIdx) => {
        const letter = sess.letter;
        const log = sess.log || {};
        const w = store.data.workouts[letter];
        const exMap = {};
        (w?.exercises || []).forEach(ex => exMap[ex.id] = {
          name: ex.name || ex.id,
          type: ex.type || "strength"
        });
        Object.keys(log).forEach(exId => {
          const meta = exMap[exId] || {
            name: exId,
            type: "strength"
          };
          const xm = sess.meta && sess.meta[exId] || {};
          (log[exId] || []).forEach((s, i) => {
            rows.push([dateKey, String(sessIdx + 1), letter || "", meta.name, meta.type === "cardio" ? "cardio" : "forca", String(i + 1), SET_TYPE_NAME[s.type] || "normal", s.weight != null ? String(s.weight).replace(".", ",") : "", s.reps != null ? String(s.reps) : "", s.minutes != null ? String(s.minutes) : "", s.done ? "1" : "0", i === 0 && xm.rpe != null ? String(xm.rpe) : "", i === 0 && xm.note ? xm.note : "", i === 0 && sess.note ? sess.note : ""]);
          });
        });
      });
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
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
