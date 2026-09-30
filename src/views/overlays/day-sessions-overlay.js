import { MONTH_NAMES_FULL, WEEKDAY_FULL } from "../../data/constants.js";
import { ICONS } from "../../data/icons.js";
import { persist } from "../../persistence.js";
import { store } from "../../store.js";
import { colorFor } from "../../ui/helpers.js";
import { showToast } from "../../ui/toast.js";
import { escapeHtml } from "../../utils/dom.js";
import { fmtDuration } from "../../utils/format.js";
import { sessionDurationMs, sessionsFor } from "../../workouts/sessions.js";
import { workoutLabel } from "../../workouts/workouts.js";
import { openDaySheet } from "../calendar.js";
import { render } from "../render.js";
import { closeOverlay } from "./overlay-manager.js";

export function renderDaySessionsOverlay(root) {
  const {
    dateKey
  } = store.overlay;
  const arr = sessionsFor(dateKey);
  const [y, m, dd] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  const dateLabel = `${WEEKDAY_FULL[d.getDay()]}, ${dd} de ${MONTH_NAMES_FULL[m - 1]}`;
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date" style="text-transform:capitalize;">${escapeHtml(dateLabel)}</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px;">${arr.length} treinos neste dia</p>
    <div class="sheet-day-sessions">
      ${arr.map((sess, idx) => {
    const wk = store.data.workouts[sess.letter];
    const isRest = wk?.isRest;
    const dur = sessionDurationMs(sess);
    const setsCount = Object.values(sess.log || {}).reduce((n, sets) => n + (Array.isArray(sets) ? sets.length : 0), 0);
    const metaBits = [];
    if (idx === 0) metaBits.push("1º");else if (idx === 1) metaBits.push("2º");else metaBits.push(idx + 1 + "º");
    if (dur) metaBits.push(fmtDuration(dur));
    if (setsCount) metaBits.push(setsCount + " série(s)");
    return `<div class="sheet-day-session" role="button" data-role="opensession" data-sessionid="${sess.id}">
          <div class="sds-chip" style="background:${colorFor(sess.letter, store.data.order)}">${isRest ? ICONS.moonSmall : sess.letter}</div>
          <div class="sds-info">
            <div class="sds-name">${escapeHtml(wk?.name || workoutLabel(sess.letter))}</div>
            <div class="sds-meta">${metaBits.join(" · ")}</div>
          </div>
          <button class="sds-del" data-role="delsession" data-sessionid="${sess.id}" aria-label="remover sessão">${ICONS.close}</button>
        </div>`;
  }).join("")}
    </div>
  </div>`;
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
  document.querySelectorAll('[data-role="opensession"]').forEach(b => {
    b.addEventListener("click", ev => {
      if (ev.target.closest('[data-role="delsession"]')) return;
      const sessionId = b.dataset.sessionid;
      store.overlay = null;
      openDaySheet(dateKey, {
        sessionId
      });
    });
  });
  document.querySelectorAll('[data-role="delsession"]').forEach(el => {
    el.addEventListener("click", ev => {
      ev.stopPropagation();
      const sessionId = el.dataset.sessionid;
      const before = sessionsFor(dateKey).slice();
      const origIdx = before.findIndex(x => x.id === sessionId);
      if (origIdx < 0) return;
      const removed = before[origIdx];
      const arr2 = before.filter(x => x.id !== sessionId);
      if (arr2.length) store.data.sessions[dateKey] = arr2;else delete store.data.sessions[dateKey];
      store.overlay = null;
      render();
      persist();
      showToast("Sessão removida", {
        label: "Desfazer",
        fn: async () => {
          const cur = sessionsFor(dateKey).slice();
          if (cur.some(x => x.id === removed.id)) return;
          cur.splice(Math.min(origIdx, cur.length), 0, removed);
          store.data.sessions[dateKey] = cur;
          render();
          await persist();
          showToast("Sessão restaurada");
        }
      });
    });
  });
}
