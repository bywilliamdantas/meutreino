import { enforceSessionExpiry, readSession } from "./auth/session.js";
import { takeAutoBackup } from "./backup/auto-backup.js";
import { requestPersistentStorage } from "./backup/storage-status.js";
import { storageKey } from "./config.js";
import { loadData, persist, storageAvailable } from "./persistence.js";
import { checkReminder } from "./reminders.js";
import { getTabFromHash, initRouter } from "./router.js";
import { store } from "./store.js";
import { applyTheme, getThemePref } from "./theme.js";
import { showToast } from "./ui/toast.js";
import { backgroundUpdateCheck, checkForUpdate, reloadOnce } from "./update/sw-update.js";
import { renderLogin } from "./views/login-view.js";
import { renderRestTimer } from "./views/overlays/rest-timer.js";
import { render } from "./views/render.js";
import { renderHeroClock, syncWakeLock } from "./workouts/active-session.js";

/* ============================================================
   BOOT
   ============================================================ */
export async function bootApp() {
  const app = document.getElementById("app");
  if (app) app.innerHTML = `<div class="loading">carregando…</div>`;
  await loadData();
  takeAutoBackup(false);
  render();
  requestPersistentStorage();
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
  applyTheme(getThemePref());
  initRouter();
  if (!storageAvailable()) {
    store.loadFailed = true;
    store.currentUser = readSession();
    if (store.currentUser) render();else renderLogin();
    showToast("Armazenamento indisponível (modo privado?).");
    return;
  }
  store.currentUser = readSession();
  if (store.currentUser) {
    store.activeTab = getTabFromHash() || "inicio";
    await bootApp();
  } else {
    renderLogin();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && store.currentUser) {
      enforceSessionExpiry();
      if (!store.currentUser) return;
      checkReminder();
      renderRestTimer();
      renderHeroClock();
      syncWakeLock();
      backgroundUpdateCheck();
    }
  });
  setInterval(() => {
    if (store.currentUser) {
      enforceSessionExpiry();
      if (store.currentUser) checkReminder();
    }
  }, 5 * 60 * 1000);
  window.addEventListener("beforeunload", () => {
    if (!store.currentUser) return;
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(store.data));
    } catch (e) {}
  });
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    if (mq.addEventListener) mq.addEventListener("change", () => {
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
