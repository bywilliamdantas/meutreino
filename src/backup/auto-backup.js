import { userId } from "../config.js";
import { store } from "../store.js";
import { dbListBackups, dbSaveBackup, readLegacyBackups, sortNewest } from "../storage/backups-db.js";
import { isQuotaError } from "../storage/idb.js";
import { showToast } from "../ui/toast.js";
import { todayKey } from "../utils/format.js";
import { totalDays, totalSessions } from "../workouts/sessions.js";

/* Lista (mais novo primeiro). Fonte principal: IndexedDB. Se a migração não
   conseguiu apagar a cópia antiga (ou o IndexedDB está indisponível), as
   entradas que ainda existem no localStorage também aparecem — nada some da
   tela só porque ainda não foi confirmado no destino. */
export async function listAutoBackups() {
  const user = userId();
  let rows = [];
  try {
    rows = await dbListBackups(user);
  } catch (e) {}
  const legacy = readLegacyBackups(user).entries;
  if (legacy.length) {
    const seen = new Set(rows.map(r => r.id));
    legacy.forEach(l => {
      if (!seen.has(l.id)) rows.push(l);
    });
    rows = sortNewest(rows);
  }
  return rows;
}

export async function refreshBackupInfo() {
  try {
    store.backupList = await listAutoBackups();
  } catch (e) {
    store.backupList = [];
  }
  store.backupCount = store.backupList.length;
  return store.backupList;
}

export function hasMeaningfulData() {
  if (totalDays() > 0 || store.data.body && store.data.body.length) return true;
  return Object.values(store.data.workouts).some(w => (w.exercises || []).length > 0);
}

function reportFailure(e) {
  store.autoBackupError = isQuotaError(e) ? "quota" : "falha";
  if (!store.autoBackupWarned) {
    store.autoBackupWarned = true;
    showToast(store.autoBackupError === "quota" ? "Sem espaço para o backup automático — exporte um arquivo" : "Não foi possível salvar o backup automático");
  }
}

/* O instantâneo é feito de forma SÍNCRONA, antes de qualquer await: quem chama
   sem esperar (ou logo antes de substituir os dados) continua pegando o estado
   anterior, como no código antigo. Falhas de gravação não são mais silenciosas:
   ficam em store.autoBackupError (mostrado em Dados e backup) e geram um aviso. */
export async function takeAutoBackup(force) {
  let snapshot;
  try {
    if (!hasMeaningfulData()) return;
    const data = JSON.parse(JSON.stringify(store.data));
    data.activeSession = {
      letter: null,
      state: "idle",
      elapsedMs: 0,
      startedAt: null,
      startedDate: null
    };
    data.settings.restTimerActive = null;
    data.settings.avatarUrl = null; // a foto tem registro próprio; não se repete em cada cópia
    snapshot = {
      date: todayKey(),
      at: new Date().toISOString(),
      sessions: totalSessions(),
      data
    };
  } catch (e) {
    return;
  }
  try {
    const list = await listAutoBackups();
    if (force || !(list[0] && list[0].date === snapshot.date)) {
      const user = userId();
      await dbSaveBackup({ ...snapshot, id: `${user}|${snapshot.at}`, user }, user);
      store.autoBackupError = null;
    }
  } catch (e) {
    reportFailure(e);
  }
  await refreshBackupInfo();
}
