import { restForExercise } from "../../exercises/exercises.js";
import { persist } from "../../persistence.js";
import { store } from "../../store.js";
import { showToast } from "../../ui/toast.js";
import { haptic } from "../../utils/dom.js";
import { pad } from "../../utils/format.js";

export function startRestTimer(exId) {
  const duration = exId ? restForExercise(exId) : store.data.settings.restDuration || 90;
  const endsAt = Date.now() + duration * 1000;
  store.data.settings.restTimerActive = {
    endsAt,
    duration
  };
  persist();
  renderRestTimer();
}

export function stopRestTimer() {
  store.data.settings.restTimerActive = null;
  if (store.restTimerInterval) {
    clearInterval(store.restTimerInterval);
    store.restTimerInterval = null;
  }
  persist();
  renderRestTimer();
}

export function finishRestTimer(root) {
  if (store.restTimerInterval) {
    clearInterval(store.restTimerInterval);
    store.restTimerInterval = null;
  }
  store.data.settings.restTimerActive = null;
  persist();
  haptic([200, 100, 200]);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("Descanso acabou", {
        body: "Bora pra próxima série."
      });
    } catch (e) {}
  }
  showToast("Descanso acabou — próxima série!");
  root.innerHTML = "";
}

export function buildRestTimerDom(root, C) {
  root.innerHTML = `<div class="rest-timer">
    <div class="rest-ring">
      <svg viewBox="0 0 44 44">
        <circle class="ring-bg" cx="22" cy="22" r="18"/>
        <circle class="ring-fg" id="restRingFg" cx="22" cy="22" r="18"
          stroke-dasharray="${C}" stroke-dashoffset="0"/>
      </svg>
    </div>
    <div class="rest-info">
      <div class="rest-label">descanso</div>
      <div class="rest-time" id="restTime"></div>
    </div>
    <button class="rest-btn" id="restPlus30">+30s</button>
    <button class="rest-btn primary" id="restStop">pular</button>
  </div>`;
  document.getElementById("restStop").addEventListener("click", () => {
    haptic(6);
    stopRestTimer();
  });
  document.getElementById("restPlus30").addEventListener("click", () => {
    haptic(6);
    const t = store.data.settings.restTimerActive;
    if (t) {
      t.endsAt += 30000;
      t.duration += 30;
      persist();
      renderRestTimer();
    }
  });
}

export function renderRestTimer() {
  const root = document.getElementById("restTimerRoot");
  if (!root) return;
  const t = store.data.settings.restTimerActive;
  if (!t) {
    root.innerHTML = "";
    if (store.restTimerInterval) {
      clearInterval(store.restTimerInterval);
      store.restTimerInterval = null;
    }
    return;
  }
  const remainMs = t.endsAt - Date.now();
  const remain = Math.max(0, Math.ceil(remainMs / 1000));
  if (remain <= 0) {
    finishRestTimer(root);
    return;
  }
  const C = 2 * Math.PI * 18;
  if (!root.firstElementChild) buildRestTimerDom(root, C);
  const timeEl = document.getElementById("restTime");
  const txt = `${pad(Math.floor(remain / 60))}:${pad(remain % 60)}`;
  if (timeEl && timeEl.textContent !== txt) timeEl.textContent = txt;
  const fg = document.getElementById("restRingFg");
  if (fg) {
    const pct = Math.min(1, Math.max(0, remainMs / (t.duration * 1000)));
    fg.style.strokeDashoffset = String(C * (1 - pct));
  }
  if (!store.restTimerInterval) {
    store.restTimerInterval = setInterval(renderRestTimer, 250);
  }
}
