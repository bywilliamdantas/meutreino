import { TAB_DEFS } from "../data/constants.js";
import { goTab } from "../router.js";
import { store } from "../store.js";
import { haptic } from "../utils/dom.js";

/* ============================================================
   TABBAR
   ============================================================ */
export 
function renderTabBar() {
  let bar = document.getElementById("tabBar");
  if (!store.currentUser) {
    if (bar) bar.innerHTML = "";
    return;
  }
  if (!bar) return;
  bar.innerHTML = TAB_DEFS.map(t => `<button type="button" class="tab-btn ${store.activeTab === t.id ? "active" : ""}" data-role="gotab" data-tab="${t.id}" aria-label="${t.label}" aria-current="${store.activeTab === t.id ? "page" : "false"}">
    <span class="tab-btn-icon">${t.icon}</span>
    <span class="tab-btn-label">${t.label}</span>
  </button>`).join("");
  bar.querySelectorAll('[data-role="gotab"]').forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.tab === store.activeTab) return;
      haptic(6);
      goTab(btn.dataset.tab);
    });
  });
}

/* ============================================================
   LOGIN
   ============================================================ */
