import { refreshBackupInfo } from "../backup/auto-backup.js";
import { store } from "../store.js";
import { WARN_RATIO, fmtBytes, readStorageUsage } from "../storage/usage.js";

const pct = r => Math.min(100, Math.round(r * 100));

function meter(label, o, extraCls) {
  const p = pct(o.ratio);
  const cls = o.ratio >= 0.9 ? "crit" : o.ratio >= WARN_RATIO ? "warn" : "ok";
  return `<div class="usage-meter ${extraCls || ""}">
    <div class="usage-row"><span class="usage-label">${label}</span><span class="usage-val">${fmtBytes(o.used)} de ${fmtBytes(o.limit)} · ${p}%</span></div>
    <div class="usage-bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${label}"><i style="--pct:${Math.max(p, o.used > 0 ? 2 : 0)}%"></i></div>
  </div>`;
}

export function storageUsageHtml() {
  const u = store.storageUsage;
  if (!u) {
    return `<div class="usage-card" id="storageUsageCard"><div class="usage-title">Espaço em uso</div><div class="usage-sub">calculando…</div></div>`;
  }
  const alerts = [];
  if (u.local.ratio >= WARN_RATIO) {
    const p = pct(u.local.ratio);
    alerts.push(u.level === "crit" ? `Armazenamento quase cheio (${p}% do limite do navegador). Exporte um backup agora: se encher, o app não consegue salvar novos treinos.` : `Seus dados já usam ${p}% do limite do navegador (~5 MB). Exporte um backup e fique de olho: se encher, o app não consegue salvar novos treinos.`);
  }
  if (u.origin && u.origin.ratio >= WARN_RATIO) {
    alerts.push(`O aparelho está com pouco espaço para o app (${pct(u.origin.ratio)}% da cota). Libere espaço no aparelho.`);
  }
  if (store.autoBackupError) {
    alerts.push(store.autoBackupError === "quota" ? "Sem espaço para o backup automático: as cópias novas não estão sendo salvas." : "Não foi possível salvar o backup automático. Exporte um arquivo para garantir.");
  }
  const alertHtml = alerts.map(a => `<div class="usage-alert ${u.level === "crit" || store.autoBackupError ? "crit" : "warn"}" role="alert">${a}</div>`).join("");
  const p = u.parts;
  return `<div class="usage-card ${alerts.length ? u.level === "ok" ? "warn" : u.level : "ok"}" id="storageUsageCard">
    <div class="usage-title">Espaço em uso</div>
    ${alertHtml}
    ${meter("Dados do app (limite do navegador)", u.local)}
    <div class="usage-breakdown">
      <span>Treinos e histórico: <b>${fmtBytes(p.main)}</b></span>
      <span>Backups automáticos: <b>${fmtBytes(p.backups)}</b></span>
      <span>Foto de perfil: <b>${fmtBytes(p.avatar)}</b></span>
    </div>
    ${u.origin ? meter("Espaço do aparelho para este app", u.origin) : ""}
    <div class="usage-foot">Valores estimados. Treinos e histórico ficam no limite de ~5 MB; backups automáticos e foto ficam em outro espaço, bem maior.</div>
  </div>`;
}

/* Recalcula e troca só o cartão (e o contador de cópias) no DOM — não chama
   render(), então não há laço. */
export async function refreshStorageUsage(force) {
  if (!force && Date.now() - store.storageUsageAt < 2000) return;
  store.storageUsageAt = Date.now();
  await refreshBackupInfo();
  store.storageUsage = await readStorageUsage();
  const card = document.getElementById("storageUsageCard");
  if (card) card.outerHTML = storageUsageHtml();
  const cnt = document.getElementById("autoBackupCountText");
  if (cnt) cnt.textContent = `${store.backupCount} cópia(s) neste aparelho`;
}
