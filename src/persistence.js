import { storageKey } from "./config.js";
import { initExIdCounter, initRestCounter } from "./counters.js";
import { migrateActiveSession, migrateSessionSnapshots, migrateSessions, migrateSettings, migrateWorkouts } from "./data-migrations.js";
import { store } from "./store.js";
import { showToast } from "./ui/toast.js";

export function storageAvailable() {
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

export async function withRetry(fn, attempts = 3, baseDelay = 250) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

export async function loadData() {
  try {
    const raw = await withRetry(() => window.localStorage.getItem(storageKey()), 3, 200);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.order && parsed.workouts) {
        store.data = {
          ...store.data,
          ...parsed
        };
        migrateSessions(store.data);
        migrateSettings(store.data);
        migrateActiveSession(store.data);
        migrateWorkouts(store.data);
        migrateSessionSnapshots(store.data);
      }
    }
    store.loadFailed = false;
  } catch (e) {
    store.loadFailed = true;
  }
  initExIdCounter();
  initRestCounter();
}

export async function persist() {
  store.saveInFlight = true;
  updateSyncUI("busy");
  try {
    await withRetry(() => window.localStorage.setItem(storageKey(), JSON.stringify(store.data)), 3, 250);
    store.saveInFlight = false;
    updateSyncUI("ok");
  } catch (e) {
    store.saveInFlight = false;
    const full = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
    updateSyncUI(full ? "full" : "err");
    if (full) showToast("Armazenamento cheio — exporte um backup");
  }
}

export function updateSyncUI(s) {
  const row = document.getElementById("syncRow");
  if (!row) return;
  const dot = document.getElementById("syncDot");
  const text = document.getElementById("syncText");
  const retryBtn = document.getElementById("syncRetryBtn");
  dot.className = "sync-dot";
  retryBtn.style.display = "none";
  if (s === "busy") {
    row.classList.remove("hidden");
    dot.classList.add("busy");
    text.textContent = "salvando…";
  } else if (s === "ok") {
    dot.classList.add("ok");
    text.textContent = "salvo neste aparelho";
    setTimeout(() => {
      if (!store.saveInFlight) row.classList.add("hidden");
    }, 1300);
  } else if (s === "err" || s === "full") {
    row.classList.remove("hidden");
    dot.classList.add("err");
    text.textContent = s === "full" ? "armazenamento cheio" : "falha ao salvar";
    retryBtn.style.display = "inline";
  }
}
