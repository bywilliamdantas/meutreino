import { APP_VERSION } from "../data/constants.js";
import { ICONS } from "../data/icons.js";
import { store } from "../store.js";
import { showToast } from "../ui/toast.js";
import { haptic } from "../utils/dom.js";
import { render } from "../views/render.js";

export function setUpdateButtonState(phase) {
  const btn = document.getElementById("checkUpdateBtn");
  const label = document.getElementById("checkUpdateLabel");
  const icon = document.getElementById("checkUpdateIcon");
  if (!btn || !label || !icon) return;
  btn.classList.remove("loading", "success");
  if (phase === "idle") {
    label.textContent = "Atualizar";
    icon.innerHTML = ICONS.refresh;
  } else if (phase === "loading") {
    label.textContent = "Verificando…";
    icon.innerHTML = "";
    btn.classList.add("loading");
  } else if (phase === "success") {
    label.textContent = "Atualizado";
    icon.innerHTML = ICONS.checkSm;
    btn.classList.add("success");
    setTimeout(() => setUpdateButtonState("idle"), 1800);
  } else if (phase === "available") {
    label.textContent = "Atualizar";
    icon.innerHTML = ICONS.refresh;
    btn.classList.add("success");
  }
}

export function reloadOnce() {
  if (store.reloadingForUpdate) return;
  store.reloadingForUpdate = true;
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("_u", String(Date.now()));
    window.location.replace(u.toString());
  } catch (e) {
    window.location.reload();
  }
}

try {
  const cleanUrl = new URL(window.location.href);
  if (cleanUrl.searchParams.has("_u")) {
    cleanUrl.searchParams.delete("_u");
    window.history.replaceState(null, "", cleanUrl.pathname + (cleanUrl.search || "") + cleanUrl.hash);
  }
} catch (e) {}

export function swRequest(worker, msg, timeoutMs) {
  return new Promise(resolve => {
    if (!worker) {
      resolve(null);
      return;
    }
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    ch.port1.onmessage = e => {
      clearTimeout(timer);
      resolve(e.data);
    };
    try {
      worker.postMessage(msg, [ch.port2]);
    } catch (e) {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export function waitInstalled(worker, timeoutMs) {
  return new Promise(resolve => {
    if (!worker || worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, timeoutMs);
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

export function applyWaitingUpdate(reg) {
  if (reg && reg.waiting) {
    reg.waiting.postMessage("SKIP_WAITING");
    setTimeout(reloadOnce, 2500);
  } else {
    reloadOnce();
  }
}

export async function checkAssetsChanged() {
  const worker = store.swRegistration && store.swRegistration.active || navigator.serviceWorker.controller;
  const res = await swRequest(worker, {
    type: "REFRESH_ASSETS"
  }, 20000);
  if (!res || !res.ok) return null;
  const versionDiffers = !!(res.remoteVersion && res.remoteVersion !== APP_VERSION);
  return res.changed || versionDiffers;
}

export async function checkForUpdate() {
  if (!("serviceWorker" in navigator)) {
    showToast("Atualização não suportada neste navegador");
    return;
  }
  if (!store.swRegistration) {
    showToast("Serviço ainda iniciando — tente em instantes");
    return;
  }
  if (store.updateBusy) return;
  store.updateBusy = true;
  setUpdateButtonState("loading");
  haptic(6);
  try {
    try {
      await store.swRegistration.update();
    } catch (e) {}
    if (store.swRegistration.installing) await waitInstalled(store.swRegistration.installing, 15000);
    if (store.swRegistration.waiting) {
      setUpdateButtonState("available");
      showToast("Atualizando…");
      applyWaitingUpdate(store.swRegistration);
      return;
    }
    const changed = await checkAssetsChanged();
    if (changed === true) {
      setUpdateButtonState("available");
      showToast("Atualizando…");
      setTimeout(reloadOnce, 500);
      return;
    }
    if (changed === false) {
      setUpdateButtonState("success");
      showToast("Você já está na versão mais recente");
      haptic([10, 30, 10]);
      return;
    }
    throw new Error("sem resposta do service worker");
  } catch (e) {
    console.error("[update]", e);
    setUpdateButtonState("idle");
    showToast("Não foi possível verificar agora. Confira a conexão.");
  } finally {
    store.updateBusy = false;
  }
}

export async function backgroundUpdateCheck() {
  if (!store.swRegistration || store.updateBusy || store.updateAvailable) return;
  const now = Date.now();
  if (now - store.lastBgCheck < 3 * 60 * 1000) return;
  store.lastBgCheck = now;
  try {
    await store.swRegistration.update();
  } catch (e) {
    return;
  }
  if (store.swRegistration.waiting || store.swRegistration.installing) return;
  const changed = await checkAssetsChanged();
  if (changed === true && !store.updateAvailable) {
    store.updateAvailable = {
      reload: true
    };
    render();
  }
}

export async function hardRefreshApp() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {
    console.error("[hardRefresh]", e);
  }
  reloadOnce();
}

/* ============================================================
   HANDLERS
   ============================================================ */
