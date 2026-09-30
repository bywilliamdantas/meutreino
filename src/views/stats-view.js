import { ICONS } from "../data/icons.js";
import { collectRecords, collectStats, weeklyVolume } from "../stats/stats.js";
import { store } from "../store.js";
import { colorFor, isCollapsed, sectionHeader } from "../ui/helpers.js";
import { escapeAttr, escapeHtml } from "../utils/dom.js";
import { fmtVolume, fmtW, pad, unit } from "../utils/format.js";

export function renderStatsCard() {
  if (isCollapsed("stats")) return sectionHeader("stats", "Estatísticas");
  const st = collectStats(store.statsRange);
  const hasAny = st.sets > 0 || st.cardioMin > 0;
  let body;
  if (!hasAny) {
    body = `<div class="sheet-empty" style="margin:0;">Registre séries nos treinos para ver suas estatísticas.</div>`;
  } else {
    const entries = Object.keys(st.groups).map(g => [g, st.groups[g]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxSets = entries.length ? entries[0][1] : 1;
    const wk = weeklyVolume(8);
    const maxVol = Math.max(1, ...wk.map(b => b.volume));
    body = `<div class="stat-grid">
        <div><div class="sg-num">${escapeHtml(fmtVolume(st.volume))}</div><div class="sg-label">volume total</div></div>
        <div><div class="sg-num">${st.sets}</div><div class="sg-label">séries</div></div>
        <div><div class="sg-num">${st.sessions}</div><div class="sg-label">treinos</div></div>
      </div>
      ${st.cardioMin ? `<div class="sg-extra">${ICONS.cardio} ${st.cardioMin} min de cardio</div>` : ""}
      ${entries.length ? `<p class="bars-title">Séries por grupo muscular</p>
      <div class="hbars">${entries.map(([g, n]) => `<div class="hbar-row">
        <span class="hbar-name">${escapeHtml(g)}</span>
        <span class="hbar-track"><span class="hbar-fill" style="width:${Math.max(4, Math.round(n / maxSets * 100))}%"></span></span>
        <span class="hbar-val">${n}</span>
      </div>`).join("")}</div>` : ""}
      <p class="bars-title">Volume por semana</p>
      <div class="vbars">${wk.map((b, i) => `<div class="vbar-col" title="${escapeAttr(fmtVolume(b.volume))}">
        <span class="vbar-track"><span class="vbar-fill ${i === wk.length - 1 ? "current" : ""}" style="height:${b.volume ? Math.max(4, Math.round(b.volume / maxVol * 100)) : 0}%"></span></span>
        <span class="vbar-label">${pad(b.start.getDate())}/${pad(b.start.getMonth() + 1)}</span>
      </div>`).join("")}</div>`;
  }
  return sectionHeader("stats", "Estatísticas") + `<div class="card">
    <div class="theme-selector" style="margin-bottom:14px;">
      ${[7, 30, 90].map(d => `<button class="theme-opt ${store.statsRange === d ? "active" : ""}" data-role="statsrange" data-days="${d}">${d} dias</button>`).join("")}
    </div>
    ${body}
  </div>`;
}

export function renderRecordsCard() {
  const recs = collectRecords();
  if (!recs.length) return "";
  if (isCollapsed("records")) return sectionHeader("records", "Recordes");
  return sectionHeader("records", "Recordes") + `<div class="card records-card">
    ${recs.map(({
    ex,
    pr,
    key
  }) => {
    const [, m, d] = pr.maxWeightDate.split("-").map(Number);
    return `<button type="button" class="record-row" data-role="openrecord" data-exid="${ex.id}" data-name="${escapeAttr(ex.name)}">
        <span class="record-ico">${ICONS.trophy}</span>
        <span class="record-name">${escapeHtml(ex.name)}</span>
        <span class="record-w" style="background:${colorFor(key, store.data.order)}">${escapeHtml(key)}</span>
        <span class="record-val">${fmtW(pr.maxWeight)} ${unit()}${pr.maxWeightReps ? " × " + pr.maxWeightReps : ""}</span>
        <span class="record-date">${d}/${m}</span>
      </button>`;
  }).join("")}
  </div>`;
}
