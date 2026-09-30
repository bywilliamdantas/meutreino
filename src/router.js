import { TABS } from "./data/constants.js";
import { store } from "./store.js";
import { haptic } from "./utils/dom.js";
import { render } from "./views/render.js";

export function getTabFromHash() {
  const h = (window.location.hash || "").replace(/^#\/?/, "");
  return TABS.includes(h) ? h : null;
}

export function openPerfil() {
  haptic(6);
  store.perfilOpen = true;
  store.perfilEditingName = false;
  render();
  const scroller = document.getElementById("app");
  if (scroller) scroller.scrollTop = 0;
}

export function closePerfil() {
  store.perfilOpen = false;
  store.perfilEditingName = false;
  render();
}

export function goTab(tab, opts) {
  if (!TABS.includes(tab)) return;
  store.activeTab = tab;
  store.perfilOpen = false;
  store.dadosBackupOpen = false;
  if (tab === "treinos" && (!opts || !opts.keepWorkoutView)) {
    store.treinosView = "list";
    store.treinosEditKey = null;
  }
  try {
    window.location.hash = "/" + tab;
  } catch (e) {}
  render();
  if (!opts || !opts.keepScroll) {
    const scroller = document.getElementById("app");
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  }
}

export function initRouter() {
  window.addEventListener("hashchange", () => {
    if (!store.currentUser) return;
    const t = getTabFromHash();
    if (t && t !== store.activeTab) {
      store.activeTab = t;
      render();
      window.scrollTo(0, 0);
    } else if (!t) {
      try {
        window.location.hash = "/" + store.activeTab;
      } catch (e) {}
    }
  });
}
