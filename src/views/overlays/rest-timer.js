import { playBeep } from "../../audio/beep.js";
import { restForExercise } from "../../exercises/exercises.js";
import { notifyViaServiceWorker } from "../../notify.js";
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

/* Anuncia o fim do descanso para leitor de tela numa região aria-live="polite" que fica no index.html
   (#restLive): ela precisa existir antes da mudança de texto e não pode estar dentro do #restTimerRoot,
   que é esvaziado ao terminar. Só escreve texto: o foco não se mexe. O texto é colocado depois de um
   instante e apagado depois, para a mesma frase ser anunciada de novo no próximo descanso. */
const ANNOUNCE_DELAY_MS = 100;
const ANNOUNCE_CLEAR_MS = 5000;
let announceTimers = [];

function announce(msg) {
  const live = document.getElementById("restLive");
  if (!live) return;
  announceTimers.forEach(clearTimeout);
  live.textContent = "";
  announceTimers = [
    setTimeout(() => {
      live.textContent = msg;
    }, ANNOUNCE_DELAY_MS),
    setTimeout(() => {
      live.textContent = "";
    }, ANNOUNCE_CLEAR_MS)
  ];
}

/* Só apita se o descanso acabou agora: ao voltar para o app minutos depois,
   um beep atrasado seria confuso (o toast e a vibração continuam como antes). */
const BEEP_MAX_LATE_MS = 3000;

export function finishRestTimer(root) {
  const active = store.data.settings.restTimerActive;
  const lateMs = active ? Date.now() - active.endsAt : 0;
  if (store.restTimerInterval) {
    clearInterval(store.restTimerInterval);
    store.restTimerInterval = null;
  }
  store.data.settings.restTimerActive = null;
  persist();
  haptic([200, 100, 200]);
  if (store.data.settings.beepEnabled !== false && lateMs < BEEP_MAX_LATE_MS) playBeep();
  notifyViaServiceWorker("Descanso acabou", "Bora pra próxima série.", "fim-descanso");
  showToast("Descanso acabou — próxima série!");
  announce("Descanso acabou. Próxima série.");
  root.innerHTML = "";
  applyRestLayout(root, false);
}

/* Posição do timer: acima da tab bar (que ele cobriria por inteiro) ou, com a folha
   do dia aberta (a tab bar fica sob o fundo escuro), rente ao rodapé. A altura da
   tab bar é medida, então acompanha safe-area e mudanças de tamanho. */
const GAP_ABOVE_TABBAR = 8;
const layoutCache = { on: false, bottom: "" };

function restBottomValue() {
  if (document.querySelector(".sheet-backdrop")) return "calc(10px + env(safe-area-inset-bottom))";
  const bar = document.getElementById("tabBar");
  const r = bar && bar.getBoundingClientRect();
  if (!r || r.height <= 0) return "";
  return Math.max(0, Math.round(document.documentElement.clientHeight - r.top + GAP_ABOVE_TABBAR)) + "px";
}

export function applyRestLayout(root, active) {
  const html = document.documentElement;
  if (!active) {
    if (layoutCache.on) html.classList.remove("rest-on");
    root.style.removeProperty("--rest-bottom");
    layoutCache.on = false;
    layoutCache.bottom = "";
    return;
  }
  if (!layoutCache.on) {
    html.classList.add("rest-on");
    layoutCache.on = true;
  }
  const bottom = restBottomValue();
  if (bottom !== layoutCache.bottom) {
    layoutCache.bottom = bottom;
    if (bottom) root.style.setProperty("--rest-bottom", bottom);
    else root.style.removeProperty("--rest-bottom");
  }
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
    applyRestLayout(root, false);
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
  applyRestLayout(root, true);
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
