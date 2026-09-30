import { MONTH_NAMES_FULL } from "../data/constants.js";
import { ICONS } from "../data/icons.js";
import { store } from "../store.js";
import { colorFor } from "../ui/helpers.js";
import { escapeAttr } from "../utils/dom.js";
import { dateKeyFromDate, todayKey } from "../utils/format.js";
import { sessionsFor } from "../workouts/sessions.js";
import { nextWorkoutLetter } from "../workouts/workouts.js";
import { renderOverlay } from "./overlays/overlay-manager.js";

export function buildMonthCalendar(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = first.getDay();
  const todayD = new Date();
  todayD.setHours(0, 0, 0, 0);
  const isCurrentMonth = year === todayD.getFullYear() && month === todayD.getMonth();
  let cells = "";
  for (let i = 0; i < startWeekday; i++) {
    cells += `<div class="cal-cell empty"></div>`;
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = dateKeyFromDate(d);
    const arr = sessionsFor(key);
    const count = arr.length;
    const letter = count ? arr[arr.length - 1].letter : null;
    const isToday = key === todayKey();
    const isFuture = d > todayD;
    const style = letter ? `background:${colorFor(letter, store.data.order)};color:#fff` : "";
    const cls = "cal-cell" + (letter ? " filled" : "") + (isToday ? " today" : "") + (isFuture ? " future" : "");
    const label = `${day} de ${MONTH_NAMES_FULL[month]}${count ? " — " + count + " treino(s)" : isFuture ? "" : " — sem treino"}`;
    const badge = count > 1 ? `<span class="cal-badge">${count}x</span>` : "";
    if (isFuture) {
      cells += `<div class="${cls}" aria-label="${escapeAttr(label)}"><span>${day}</span></div>`;
    } else {
      cells += `<button class="${cls}" style="${style}" data-role="calday" data-key="${key}" aria-label="${escapeAttr(label)}"><span>${day}</span>${badge}</button>`;
    }
  }
  const totalCells = startWeekday + daysInMonth;
  const trailing = (7 - totalCells % 7) % 7;
  for (let i = 0; i < trailing; i++) {
    cells += `<div class="cal-cell empty"></div>`;
  }
  const monthLabel = MONTH_NAMES_FULL[month].charAt(0).toUpperCase() + MONTH_NAMES_FULL[month].slice(1) + " de " + year;
  return `
    <div class="cal-header">
      <button class="cal-nav" id="calPrevBtn" aria-label="mês anterior">${ICONS.left}</button>
      <div class="cal-month-label">${monthLabel}</div>
      <button class="cal-nav" id="calNextBtn" aria-label="próximo mês" ${isCurrentMonth ? "disabled" : ""}>${ICONS.right}</button>
    </div>
    <div class="cal-weekdays"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
    <div class="cal-grid">${cells}</div>
  `;
}

/* ============================================================
   OVERLAYS
   ============================================================ */

/* ============================================================
   OVERLAYS
   ============================================================ */
export function openDaySheet(dateKey, opts) {
  opts = opts || {};
  const arr = sessionsFor(dateKey);
  const a = store.data.activeSession;
  const hasActive = a.state === "running" || a.state === "paused";
  let sessionId, letter, log, startedAt;
  if (opts.mode === "new") {
    sessionId = null;
    letter = opts.letter || (hasActive && dateKey === todayKey() ? a.letter : nextWorkoutLetter());
    log = {};
    startedAt = Date.now();
  } else if (opts.sessionId) {
    const sess = arr.find(s => s.id === opts.sessionId);
    if (sess) {
      sessionId = sess.id;
      letter = sess.letter;
      log = JSON.parse(JSON.stringify(sess.log || {}));
      startedAt = sess.startedAt || Date.now();
    } else {
      sessionId = null;
      letter = nextWorkoutLetter();
      log = {};
      startedAt = Date.now();
    }
  } else if (arr.length) {
    const sess = arr[arr.length - 1];
    sessionId = sess.id;
    letter = sess.letter;
    log = JSON.parse(JSON.stringify(sess.log || {}));
    startedAt = sess.startedAt || Date.now();
  } else {
    sessionId = null;
    letter = hasActive && dateKey === todayKey() ? a.letter : dateKey === todayKey() ? nextWorkoutLetter() : store.data.order[0];
    log = {};
    startedAt = Date.now();
  }
  let meta = {},
    note = "";
  if (sessionId) {
    const sess0 = arr.find(x => x.id === sessionId);
    if (sess0) {
      meta = JSON.parse(JSON.stringify(sess0.meta || {}));
      note = sess0.note || "";
    }
  }
  store.overlay = {
    type: "day",
    mode: opts.mode || (sessionId ? "edit" : "new"),
    dateKey,
    sessionId,
    letter,
    log,
    startedAt,
    meta,
    note
  };
  renderOverlay();
}
