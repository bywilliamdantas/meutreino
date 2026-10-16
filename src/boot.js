import { enforceSessionExpiry, readSession, touchSession } from "./auth/session.js";
import { refreshBackupInfo, takeAutoBackup } from "./backup/auto-backup.js";
import { requestPersistentStorage } from "./backup/storage-status.js";
import { initAudioUnlock } from "./audio/beep.js";
import { storageKey } from "./config.js";
import { precacheExerciseImages } from "./exercises/image-cache.js";
import { loadData, persist, persistOnHide, storageAvailable } from "./persistence.js";
import { checkReminder } from "./reminders.js";
import { getTabFromHash, initRouter } from "./router.js";
import { store } from "./store.js";
import { loadAvatarIntoStore } from "./storage/avatar.js";
import { migrateLegacyStorage } from "./storage/legacy-migration.js";
import { migrateSessionsToIdb, sessionsMode } from "./storage/session-store.js";
import { applyTheme, getThemePref } from "./theme.js";
import "./ui/exercise-lightbox.js";
import { showToast } from "./ui/toast.js";
import { backgroundUpdateCheck, checkForUpdate, reloadOnce } from "./update/sw-update.js";
import { renderLogin } from "./views/login-view.js";
import { renderRestTimer } from "./views/overlays/rest-timer.js";
import { render } from "./views/render.js";
import { renderHeroClock, syncWakeLock } from "./workouts/active-session.js";

/* Baixa as fotos dos exercícios para o cache offline (no primeiro acesso após o login e, depois,
   só o que faltar). Roda em segundo plano, sem segurar a tela. */
function startImagePrecache() {
  precacheExerciseImages().then((r) => {
    if (r && r.downloaded > 0 && r.failed === 0 && r.cached === 0) showToast("Imagens dos exercícios salvas para uso offline");
  });
}

/* ============================================================
   BOOT
   ============================================================ */
export async function bootApp() {
  const app = document.getElementById("app");
  if (app) app.innerHTML = `<div class="loading">carregando…</div>`;
  await loadData();
  await migrateLegacyStorage();
  try {
    await migrateSessionsToIdb(); // histórico → IndexedDB (idempotente; não apaga a cópia antiga)
  } catch (e) {}
  await loadAvatarIntoStore();
  await refreshBackupInfo();
  await takeAutoBackup(false);
  render();
  requestPersistentStorage();
  startImagePrecache();
  if (store.data.settings.restTimerActive) {
    if (store.data.settings.restTimerActive.endsAt <= Date.now()) {
      store.data.settings.restTimerActive = null;
      persist();
    } else {
      renderRestTimer();
    }
  }
  checkReminder();
}

/* ============================================================
   INIT
   ============================================================ */
(async function init() {
  initAudioUnlock();
  applyTheme(getThemePref());
  initRouter();
  if (!storageAvailable()) {
    store.loadFailed = true;
    store.currentUser = readSession();
    if (store.currentUser) render();
    else renderLogin();
    showToast("Armazenamento indisponível (modo privado?).");
    return;
  }
  store.currentUser = readSession();
  if (store.currentUser) {
    touchSession(true);
    store.activeTab = getTabFromHash() || "inicio";
    await bootApp();
  } else {
    renderLogin();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && store.currentUser) persistOnHide();
    if (document.visibilityState === "visible" && store.currentUser) {
      enforceSessionExpiry();
      if (!store.currentUser) return;
      touchSession();
      checkReminder();
      renderRestTimer();
      renderHeroClock();
      syncWakeLock();
      backgroundUpdateCheck();
    }
  });
  setInterval(
    () => {
      if (store.currentUser) {
        enforceSessionExpiry();
        if (store.currentUser) checkReminder();
      }
    },
    5 * 60 * 1000
  );
  window.addEventListener("beforeunload", () => {
    if (!store.currentUser) return;
    if (sessionsMode() === "idb") {
      persistOnHide();
      return;
    }
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(store.data));
    } catch (e) {}
  });
  // no iOS o app costuma ser encerrado sem beforeunload: grava ao esconder
  window.addEventListener("pagehide", () => {
    if (store.currentUser) persistOnHide();
  });
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    if (mq.addEventListener)
      mq.addEventListener("change", () => {
        if (getThemePref() === "auto") applyTheme("auto");
      });
  }
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js", {
        updateViaCache: "none"
      });
      store.swRegistration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) {
        store.updateAvailable = reg;
        render();
      }
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            store.updateAvailable = reg;
            render();
          }
        });
      });
      const btn = document.getElementById("checkUpdateBtn");
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = "1";
        btn.addEventListener("click", checkForUpdate);
      }
      setTimeout(backgroundUpdateCheck, 2500);
    } catch (e) {}
  });
  navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
}
