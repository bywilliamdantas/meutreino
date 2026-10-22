import { MONTH_NAMES_FULL } from "../data/constants.js";
import { ICONS } from "../data/icons.js";
import { store } from "../store.js";
import { colorFor, toneVars } from "../ui/helpers.js";
import { escapeAttr, escapeHtml } from "../utils/dom.js";
import { dateKeyFromDate, todayKey } from "../utils/format.js";
import { isRestLetter, sessionsFor } from "../workouts/sessions.js";
import { nextWorkoutLetter } from "../workouts/workouts.js";
import { renderOverlay } from "./overlays/overlay-manager.js";

/* Calendário do Histórico: mesmos blocos de dia da seção "Esta semana" (Início) —
   número, letra do treino na cor dele, selo de concluído e lua no descanso. */
export function buildMonthCalendar(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const mondayFirst = !!store.data.settings.weekStartsMonday;
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = mondayFirst ? (first.getDay() + 6) % 7 : first.getDay();
  const todayD = new Date();
  todayD.setHours(0, 0, 0, 0);
  const isCurrentMonth = year === todayD.getFullYear() && month === todayD.getMonth();
  let cells = "";
  for (let i = 0; i < startWeekday; i++) {
    cells += `<div class="cal-cell-empty" aria-hidden="true"></div>`;
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = dateKeyFromDate(d);
    const arr = sessionsFor(key);
    const work = arr.filter((s) => !isRestLetter(s.letter));
    const done = work.length > 0;
    const restOnly = !done && arr.length > 0;
    const doneLetter = done ? work[work.length - 1].letter : null;
    const isToday = key === todayKey();
    const isFuture = d > todayD;
    const toneAttr = doneLetter && store.data.workouts[doneLetter] ? ` style="${toneVars(colorFor(doneLetter, store.data.order))}"` : "";
    const cls = `week-day cal-day${done ? " done" : ""}${restOnly ? " rest" : ""}${isToday ? " today" : ""}${isFuture ? " future" : ""}`;
    const mark = done
      ? `<span class="week-day-mark" aria-hidden="true">${ICONS.checkDouble}</span>`
      : restOnly
        ? `<span class="week-day-mark" aria-hidden="true">${ICONS.moonSmall}</span>`
        : "";
    const main = `<span class="week-day-main">${done ? `<span class="week-day-letter">${escapeHtml(doneLetter || "✓")}</span>` : ""}<span class="week-day-num">${day}</span></span>`;
    const badge = arr.length > 1 ? `<span class="cal-badge">${arr.length}x</span>` : "";
    const label = `${day} de ${MONTH_NAMES_FULL[month]}${arr.length ? " — " + arr.length + " treino(s)" : isFuture ? "" : " — sem treino"}`;
    if (isFuture) {
      cells += `<div class="${cls}" role="img" aria-label="${escapeAttr(label)}">${main}</div>`;
    } else {
      cells += `<button type="button" class="${cls}"${toneAttr} data-role="calday" data-key="${escapeAttr(key)}" aria-label="${escapeAttr(label)}">${mark}${badge}${main}</button>`;
    }
  }
  const monthLabel = MONTH_NAMES_FULL[month].charAt(0).toUpperCase() + MONTH_NAMES_FULL[month].slice(1) + " de " + year;
  const weekdayShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const heads = Array.from({ length: 7 }, (_, i) => `<span class="week-dot-label">${weekdayShort[mondayFirst ? (i + 1) % 7 : i]}</span>`).join("");
  return `
    <div class="cal-header">
      <button class="cal-nav" id="calPrevBtn" aria-label="mês anterior">${ICONS.left}</button>
      <div class="cal-month-label">${monthLabel}</div>
      <button class="cal-nav" id="calNextBtn" aria-label="próximo mês" ${isCurrentMonth ? "disabled" : ""}>${ICONS.right}</button>
    </div>
    <div class="cal-weekdays">${heads}</div>
    <div class="cal-grid cal-grid-week">${cells}</div>
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
  // Treino em andamento hoje: "Detalhes" abre o treino ativo, não a última sessão já finalizada do dia.
  const openActive = hasActive && dateKey === todayKey() && !opts.mode && !opts.sessionId ? arr.find((s) => s.letter === a.letter && !s.endedAt) : null;
  if (hasActive && dateKey === todayKey() && !opts.mode && !opts.sessionId && !openActive) {
    sessionId = null;
    letter = a.letter;
    log = {};
    startedAt = Date.now();
  } else if (openActive) {
    sessionId = openActive.id;
    letter = openActive.letter;
    log = JSON.parse(JSON.stringify(openActive.log || {}));
    startedAt = openActive.startedAt || Date.now();
  } else if (opts.mode === "new") {
    sessionId = null;
    letter = opts.letter || (hasActive && dateKey === todayKey() ? a.letter : nextWorkoutLetter());
    log = {};
    startedAt = Date.now();
  } else if (opts.sessionId) {
    const sess = arr.find((s) => s.id === opts.sessionId);
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
    const sess0 = arr.find((x) => x.id === sessionId);
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
