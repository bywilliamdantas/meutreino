/* Detalhes do treino de um dia da seção "Esta semana" (Início).
   Tela SÓ de leitura: mostra o treino realizado e as séries registradas, sem botões de edição. */
import { SET_TYPE_LABEL, SET_TYPE_NAME } from "../../config.js";
import { MONTH_NAMES_FULL, SET_TYPES, WEEKDAY_FULL } from "../../data/constants.js";
import { ICONS } from "../../data/icons.js";
import { exThumbHtml } from "../../exercises/exercise-visuals.js";
import { store } from "../../store.js";
import { colorFor, toneVars } from "../../ui/helpers.js";
import { escapeHtml } from "../../utils/dom.js";
import { fmtDuration, fmtW, unit } from "../../utils/format.js";
import { isCardio } from "../../utils/numbers.js";
import { isRestLetter, sessionDurationMs, sessionsFor } from "../../workouts/sessions.js";
import { workoutLabel } from "../../workouts/workouts.js";
import { sessionExerciseList } from "./day-overlay.js";
import { closeOverlay } from "./overlay-manager.js";

const hasValue = (v) => v != null && v !== "";
const isLoggedSet = (s) => !!s && (s.done === true || (s.done === undefined && (hasValue(s.weight) || hasValue(s.reps) || hasValue(s.minutes))));

function setRowHtml(ex, s, i) {
  if (isCardio(ex) || (s.minutes != null && s.weight == null && s.reps == null)) {
    return `<li class="wd-set"><span class="wd-set-num">${i + 1}</span><span class="wd-set-val">${hasValue(s.minutes) ? escapeHtml(String(s.minutes)) : "—"} min</span></li>`;
  }
  const t = SET_TYPES.includes(s.type) ? s.type : "normal";
  const tag = t === "normal" ? "" : `<span class="wd-set-tag">${escapeHtml(SET_TYPE_NAME[t])}</span>`;
  const label = t === "normal" ? String(i + 1) : SET_TYPE_LABEL[t];
  const w = hasValue(s.weight) ? `${fmtW(s.weight)} ${unit()}` : "—";
  const r = hasValue(s.reps) ? `${escapeHtml(String(s.reps))} reps` : "—";
  return `<li class="wd-set"><span class="wd-set-num">${label}</span><span class="wd-set-val">${w} × ${r}</span>${tag}${s.pr ? `<span class="wd-set-pr" aria-label="recorde">${ICONS.trophy}</span>` : ""}</li>`;
}

function sessionHtml(sess, dateKey) {
  const wk = store.data.workouts[sess.letter];
  const log = sess.log || {};
  const { list } = sessionExerciseList(wk || { exercises: [] }, log, { ...sess, endedAt: sess.endedAt || 1 }, dateKey);
  const rows = list
    .map((ex) => {
      const sets = (Array.isArray(log[ex.id]) ? log[ex.id] : []).filter(isLoggedSet);
      if (!sets.length) return "";
      const meta = (sess.meta && sess.meta[ex.id]) || {};
      const extras = [meta.rpe != null ? `RPE ${meta.rpe}` : "", meta.note ? escapeHtml(meta.note) : ""].filter(Boolean).join(" · ");
      return `<li class="wd-ex">
        <div class="wd-ex-head">${exThumbHtml(ex, "sm")}<span class="wd-ex-name">${escapeHtml(ex.name || "Exercício")}</span></div>
        <ul class="wd-sets">${sets.map((s, i) => setRowHtml(ex, s, i)).join("")}</ul>
        ${extras ? `<div class="wd-ex-extra">${extras}</div>` : ""}
      </li>`;
    })
    .join("");
  const dur = sessionDurationMs(sess);
  const exCount = list.filter((ex) => (log[ex.id] || []).some(isLoggedSet)).length;
  const bits = [exCount ? `${exCount} exercício${exCount === 1 ? "" : "s"}` : "", dur ? fmtDuration(dur) : ""].filter(Boolean).join(" · ");
  return `<section class="wd-session">
    <div class="wd-head">
      <span class="ssh-badge" style="${toneVars(colorFor(sess.letter, store.data.order))}">${escapeHtml(sess.letter)}</span>
      <div class="ssh-titles">
        <div class="wd-name">${escapeHtml(wk?.name || workoutLabel(sess.letter))}</div>
        ${bits ? `<div class="ssh-date">${bits}</div>` : ""}
      </div>
    </div>
    ${rows ? `<ul class="wd-exercises">${rows}</ul>` : `<div class="sheet-empty">Nenhum exercício registrado neste treino.</div>`}
    ${sess.note ? `<p class="wd-note"><b>Observações:</b> ${escapeHtml(sess.note)}</p>` : ""}
  </section>`;
}

export function renderWeekDayOverlay(root) {
  const { dateKey } = store.overlay;
  const [y, m, dd] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  const dateLabel = `${WEEKDAY_FULL[d.getDay()]}, ${dd} de ${MONTH_NAMES_FULL[m - 1]}`;
  const sessions = sessionsFor(dateKey).filter((s) => !isRestLetter(s.letter));
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet week-day-sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date" id="sheetTitle"><span class="sr-only">Treino realizado em: </span>${escapeHtml(dateLabel)}</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    ${sessions.map((s) => sessionHtml(s, dateKey)).join("") || `<div class="sheet-empty">Nenhum treino neste dia.</div>`}
  </div>`;
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
}
