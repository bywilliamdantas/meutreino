import { ICONS } from "../../data/icons.js";
import { exerciseHistory, findExercise } from "../../exercises/exercises.js";
import { exercisePRs } from "../../stats/prs.js";
import { store } from "../../store.js";
import { escapeHtml } from "../../utils/dom.js";
import { fmtW, toDisp, unit } from "../../utils/format.js";
import { isCardio } from "../../utils/numbers.js";
import { closeOverlay } from "./overlay-manager.js";

export function buildLineChart(hist, unit) {
  const w = 300,
    h = 140,
    padL = 34,
    padR = 14,
    padT = 14,
    padB = 24;
  const validPts = hist.filter(p => p.weight != null && !isNaN(p.weight) || p.minutes != null && !isNaN(p.minutes));
  const validValues = validPts.map(p => p.weight != null ? p.weight : p.minutes);
  if (validValues.length === 0) return "";
  let min = Math.min(...validValues),
    max = Math.max(...validValues);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const stepX = validPts.length > 1 ? (w - padL - padR) / (validPts.length - 1) : 0;
  const pts = validPts.map((p, i) => {
    const x = padL + i * stepX;
    const val = p.weight != null ? p.weight : p.minutes;
    const y = padT + (1 - (val - min) / (max - min)) * (h - padT - padB);
    return {
      x,
      y
    };
  });
  const linePath = pts.map((pt, i) => (i === 0 ? "M" : "L") + pt.x.toFixed(1) + " " + pt.y.toFixed(1)).join(" ");
  const circles = pts.map(pt => `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3.2" fill="var(--accent)"/>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Gráfico de evolução">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="var(--divider)" stroke-width="1"/>
    <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="var(--divider)" stroke-width="1"/>
    <text x="4" y="${padT + 4}" font-size="9" fill="var(--text-muted)">${max}${unit}</text>
    <text x="4" y="${h - padB + 4}" font-size="9" fill="var(--text-muted)">${min}${unit}</text>
    <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${circles}
  </svg>`;
}

export function renderProgressOverlay(root) {
  const {
    exId,
    name
  } = store.overlay;
  const ex = findExercise(exId);
  const cardio = isCardio(ex);
  const hist = exerciseHistory(exId);
  let body;
  if (hist.length === 0) {
    body = `<div class="sheet-empty">Ainda não há registros para "${escapeHtml(name)}".</div>`;
  } else if (cardio) {
    const chart = buildLineChart(hist, "min");
    body = `<div class="chart-wrap">${chart}</div>` + `<div class="progress-list">${hist.slice().reverse().map(p => {
      const [, mo, da] = p.date.split("-").map(Number);
      return `<div class="progress-row"><span>${da}/${mo}</span><span>${p.minutes != null ? p.minutes + " min" : "—"}</span><span>${p.totalMinutes ? p.totalMinutes + " min total" : ""}</span></div>`;
    }).join("")}</div>`;
  } else {
    const chart = buildLineChart(hist.map(p => ({
      ...p,
      weight: p.weight != null ? Math.round(toDisp(p.weight) * 10) / 10 : null
    })), unit());
    const prs = exercisePRs(exId);
    const prHtml = prs ? `<div class="pr-chips">
      <div class="pr-chip"><span>${ICONS.trophy} carga máx.</span><b>${fmtW(prs.maxWeight)} ${unit()}${prs.maxWeightReps ? " × " + prs.maxWeightReps : ""}</b></div>
      <div class="pr-chip"><span>1RM estimado</span><b>${fmtW(prs.best1rm)} ${unit()}</b></div>
    </div>` : "";
    body = prHtml + `<div class="chart-wrap">${chart || `<div class="sheet-empty">Só há repetições registradas, sem peso, até agora.</div>`}</div>` + `<div class="progress-list">${hist.slice().reverse().map(p => {
      const [, mo, da] = p.date.split("-").map(Number);
      return `<div class="progress-row"><span>${da}/${mo}</span><span>${p.weight != null ? fmtW(p.weight) + " " + unit() : "—"}</span><span>${p.reps != null ? p.reps + " reps" : "—"}</span></div>`;
    }).join("")}</div>`;
  }
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Progresso do exercício">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date">${escapeHtml(name)}</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    ${body}
  </div>`;
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
}
