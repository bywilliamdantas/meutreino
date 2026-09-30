import { bodySorted, newBodyId } from "../body-tracking.js";
import { BODY_MEASURES } from "../data/body-measures.js";
import { ICONS } from "../data/icons.js";
import { persist } from "../persistence.js";
import { store } from "../store.js";
import { isCollapsed, sectionHeader } from "../ui/helpers.js";
import { showToast } from "../ui/toast.js";
import { escapeHtml, haptic } from "../utils/dom.js";
import { fmtW, fromDisp, toDisp, todayKey, unit } from "../utils/format.js";
import { parseNum } from "../utils/numbers.js";
import { closeOverlay, renderOverlay } from "./overlays/overlay-manager.js";
import { buildLineChart } from "./overlays/progress-overlay.js";
import { render } from "./render.js";

export function renderBodyCard() {
  if (isCollapsed("body")) return sectionHeader("body", "Corpo");
  const list = bodySorted();
  let inner;
  if (!list.length) {
    inner = `<div class="sheet-empty" style="margin:0 0 12px;">Registre seu peso e medidas para acompanhar a evolução.</div>`;
  } else {
    const withW = list.filter(e => e.weight != null);
    let head = "";
    if (withW.length) {
      const last = withW[withW.length - 1];
      const prev = withW.length > 1 ? withW[withW.length - 2] : null;
      let delta = "";
      if (prev) {
        const dv = Math.round((toDisp(last.weight) - toDisp(prev.weight)) * 10) / 10;
        delta = `<span class="body-delta ${dv > 0 ? "up" : dv < 0 ? "down" : ""}">${dv > 0 ? "+" : ""}${String(dv).replace(".", ",")} ${unit()}</span>`;
      }
      head = `<div class="body-head"><div class="body-big">${fmtW(last.weight)} <span>${unit()}</span></div>${delta}</div>`;
    }
    const chartPts = withW.slice(-20).map(e => ({
      date: e.date,
      weight: Math.round(toDisp(e.weight) * 10) / 10
    }));
    const chart = chartPts.length >= 2 ? `<div class="chart-wrap">${buildLineChart(chartPts, unit())}</div>` : "";
    const measures = BODY_MEASURES.map(m => {
      const vals = list.filter(e => e[m.key] != null);
      if (!vals.length) return "";
      const last = vals[vals.length - 1];
      const prev = vals.length > 1 ? vals[vals.length - 2] : null;
      const dv = prev ? Math.round((last[m.key] - prev[m.key]) * 10) / 10 : null;
      return `<div class="body-measure"><span>${m.label}</span><b>${String(last[m.key]).replace(".", ",")} cm</b>${dv ? `<i class="${dv > 0 ? "up" : "down"}">${dv > 0 ? "+" : ""}${String(dv).replace(".", ",")}</i>` : ""}</div>`;
    }).join("");
    const recent = list.slice(-5).reverse().map(e => {
      const [, m, d] = e.date.split("-").map(Number);
      const bits = [];
      if (e.weight != null) bits.push(fmtW(e.weight) + " " + unit());
      BODY_MEASURES.forEach(ms => {
        if (e[ms.key] != null) bits.push(ms.label.toLowerCase() + " " + String(e[ms.key]).replace(".", ","));
      });
      return `<div class="progress-row"><span>${d}/${m}</span><span style="flex:1;">${escapeHtml(bits.join(" · "))}</span><button class="sds-del" data-role="delbody" data-id="${e.id}" aria-label="remover registro">${ICONS.close}</button></div>`;
    }).join("");
    inner = `${head}${chart}${measures ? `<div class="body-measures">${measures}</div>` : ""}<div class="progress-list" style="margin-top:10px;">${recent}</div>`;
  }
  return sectionHeader("body", "Corpo") + `<div class="card">
    ${inner}
    <button class="add-workout-btn" id="openBodyBtn" style="margin-top:12px;">${ICONS.plus} Registrar peso / medidas</button>
  </div>`;
}

export function openBodySheet() {
  store.overlay = {
    type: "body"
  };
  renderOverlay();
}

export function renderBodyOverlay(root) {
  const list = bodySorted();
  const lastOf = key => {
    const v = list.filter(e => e[key] != null);
    return v.length ? v[v.length - 1][key] : null;
  };
  const lastW = lastOf("weight");
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Registrar peso e medidas">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date">Peso e medidas</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    <div class="body-form">
      <label class="body-field wide"><span>Data</span><input type="date" id="bodyDate" value="${todayKey()}" max="${todayKey()}"></label>
      <label class="body-field wide"><span>Peso (${unit()})</span><input type="text" inputmode="decimal" id="bodyWeight" placeholder="${lastW != null ? fmtW(lastW) : "0"}" autocomplete="off"></label>
      ${BODY_MEASURES.map(m => `<label class="body-field"><span>${m.label} (cm)</span><input type="text" inputmode="decimal" data-measure="${m.key}" placeholder="${lastOf(m.key) != null ? String(lastOf(m.key)).replace(".", ",") : "0"}" autocomplete="off"></label>`).join("")}
    </div>
    <div class="sheet-actions"><button class="cta-btn" id="bodySave">Salvar</button></div>
  </div>`;
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
  document.getElementById("bodySave").addEventListener("click", async () => {
    const date = document.getElementById("bodyDate").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayKey()) {
      showToast("Data inválida");
      return;
    }
    const wv = parseNum(document.getElementById("bodyWeight").value);
    const entry = {
      weight: wv != null && wv > 0 ? fromDisp(wv) : null
    };
    root.querySelectorAll("[data-measure]").forEach(inp => {
      const v = parseNum(inp.value);
      entry[inp.dataset.measure] = v != null && v > 0 ? v : null;
    });
    const hasAny = entry.weight != null || BODY_MEASURES.some(m => entry[m.key] != null);
    if (!hasAny) {
      showToast("Preencha pelo menos um valor");
      return;
    }
    let existing = store.data.body.find(e => e.date === date);
    if (existing) {
      Object.keys(entry).forEach(k => {
        if (entry[k] != null) existing[k] = entry[k];
      });
    } else {
      store.data.body.push({
        id: newBodyId(),
        date,
        ...entry
      });
    }
    haptic([10, 30, 10]);
    closeOverlay();
    render();
    await persist();
    showToast("Registro salvo");
  });
}
