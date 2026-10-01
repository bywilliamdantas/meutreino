import { persist } from "../persistence.js";
import { store } from "../store.js";
import { showToast } from "../ui/toast.js";
import { haptic, prefersReducedMotion } from "../utils/dom.js";
import { fmtClock, fmtDuration, todayKey } from "../utils/format.js";
import { newSessionId } from "../utils/ids.js";
import { render } from "../views/render.js";
import { sessionsFor, stampSnapshot } from "./sessions.js";
import { workoutLabel } from "./workouts.js";

export function activeElapsedMs() {
  const a = store.data.activeSession;
  if (!a) return 0;
  const base = a.elapsedMs || 0;
  if (a.state === "running" && a.startedAt) {
    return base + Math.max(0, Date.now() - a.startedAt);
  }
  return base;
}

export function startActiveSession(letter) {
  const a = store.data.activeSession;
  if (!letter) {
    showToast("Sem treino para iniciar");
    return;
  }
  if (a.state === "idle") {
    a.letter = letter;
    a.elapsedMs = 0;
    a.startedAt = Date.now();
    a.startedDate = todayKey();
    a.state = "running";
  } else if (a.state === "paused") {
    a.startedAt = Date.now();
    a.state = "running";
  } else if (a.state === "running") {
    return;
  }
  haptic([10, 30, 10]);
  render();
  persist();
}

export function pauseActiveSession() {
  const a = store.data.activeSession;
  if (a.state !== "running") return;
  a.elapsedMs = activeElapsedMs();
  a.startedAt = null;
  a.state = "paused";
  haptic(12);
  render();
  persist();
}

export function endActiveSession() {
  const a = store.data.activeSession;
  if (a.state === "idle") return;
  const letter = a.letter;
  const totalMs = activeElapsedMs();
  const dateKey = a.startedDate || todayKey();
  const arr = sessionsFor(dateKey).slice();
  let target = arr.find(s => s.letter === letter && !s.endedAt);
  const now = Date.now();
  if (target) {
    stampSnapshot(target);
    target.endedAt = now;
    if (!target.startedAt) target.startedAt = now - totalMs;
  } else {
    arr.push({
      id: newSessionId(),
      letter,
      log: {},
      startedAt: now - totalMs,
      endedAt: now
    });
  }
  store.data.sessions[dateKey] = arr;
  a.state = "idle";
  a.letter = null;
  a.elapsedMs = 0;
  a.startedAt = null;
  a.startedDate = null;
  haptic([20, 40, 20]);
  render();
  persist();
  showToast(`${workoutLabel(letter)[0].toUpperCase()}${workoutLabel(letter).slice(1)} finalizado · ${fmtDuration(totalMs)}`);
}

export function cancelActiveSession() {
  const a = store.data.activeSession;
  if (!a || a.state === "idle") return;
  a.state = "idle";
  a.letter = null;
  a.elapsedMs = 0;
  a.startedAt = null;
  a.startedDate = null;
  haptic([15, 30, 15]);
  render();
  persist();
  showToast("Treino cancelado");
}

export function renderHeroClock() {
  const el = document.getElementById("heroClock");
  const timeEl = document.getElementById("heroClockTime");
  if (!el || !timeEl) return;
  const a = store.data.activeSession;
  if (a.state === "idle") {
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  el.classList.toggle("paused", a.state === "paused");
  const ms = activeElapsedMs();
  timeEl.textContent = fmtClock(Math.floor(ms / 1000));
}

export async function syncWakeLock() {
  if (!("wakeLock" in navigator)) return;
  const a = store.data.activeSession;
  const training = a.state === "running" || store.overlay && store.overlay.type === "day" && store.overlay.dateKey === todayKey();
  const want = !!store.data.settings.keepAwake && training && document.visibilityState === "visible";
  try {
    if (want && !store.wakeLock) {
      store.wakeLock = await navigator.wakeLock.request("screen");
      store.wakeLock.addEventListener("release", () => {
        store.wakeLock = null;
      });
    } else if (!want && store.wakeLock) {
      await store.wakeLock.release();
      store.wakeLock = null;
    }
  } catch (e) {
    store.wakeLock = null;
  }
}

export function startHeroClockTicker() {
  if (store.heroClockInterval) {
    clearInterval(store.heroClockInterval);
  }
  store.heroClockInterval = setInterval(() => {
    const a = store.data.activeSession;
    if (a.state === "running") {
      renderHeroClock();
    }
  }, 1000);
}

export function runCountUp() {
  if (prefersReducedMotion()) {
    document.querySelectorAll("[data-count]").forEach(el => el.textContent = el.dataset.count);
    return;
  }
  document.querySelectorAll("[data-count]").forEach(el => {
    const target = parseInt(el.dataset.count, 10) || 0;
    if (target <= 0) {
      el.textContent = "0";
      return;
    }
    const start = performance.now();
    const duration = 500;
    function tick(t) {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);else el.textContent = target;
    }
    requestAnimationFrame(tick);
  });
}
