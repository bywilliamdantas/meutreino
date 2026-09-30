import { readAutoBackups } from "../backup/auto-backup.js";
import { replaceImportData } from "../backup/import-export.js";
import { validateBackup } from "../backup/validate.js";
import { AUTOBACKUP_MAX } from "../config.js";
import { ICONS } from "../data/icons.js";
import { store } from "../store.js";
import { showToast } from "../ui/toast.js";
import { pad } from "../utils/format.js";
import { closeOverlay, openConfirm, renderOverlay } from "./overlays/overlay-manager.js";

export function openBackupsSheet() {
  store.overlay = {
    type: "backups"
  };
  renderOverlay();
}

export function renderBackupsOverlay(root) {
  const list = readAutoBackups();
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Backups automáticos">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date">Backups automáticos</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    <p style="font-size:12.5px;color:var(--text-muted);margin:0 0 14px;line-height:1.5;">
      O app guarda uma cópia por dia (as ${AUTOBACKUP_MAX} mais recentes) dentro do próprio aparelho.
      Isso protege contra erros seus, mas não substitui exportar um arquivo para o iCloud.
    </p>
    ${list.length ? `<div class="backup-list">${list.map((b, i) => {
    const [y, m, d] = String(b.date).split("-").map(Number);
    const nTreinos = (b.data && b.data.order || []).length;
    return `<div class="backup-row">
        <div class="backup-info"><div class="backup-date">${pad(d)}/${pad(m)}/${y}</div><div class="backup-meta">${b.sessions || 0} sessões · ${nTreinos} treino(s)</div></div>
        <button class="footer-btn" style="flex:none;padding:9px 14px;" data-role="restorebackup" data-idx="${i}">Restaurar</button>
      </div>`;
  }).join("")}</div>` : `<div class="sheet-empty">Ainda não há backups automáticos. O primeiro é criado quando você abre o app com dados salvos.</div>`}
  </div>`;
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
  root.querySelectorAll('[data-role="restorebackup"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const snap = list[idx];
      if (!snap || !snap.data) return;
      const [y, m, d] = String(snap.date).split("-").map(Number);
      openConfirm(`Restaurar o backup de ${pad(d)}/${pad(m)}/${y}? Seus dados atuais serão guardados antes.`, async () => {
        const data = JSON.parse(JSON.stringify(snap.data));
        const v = validateBackup(data);
        if (!v.ok) {
          showToast("Backup corrompido");
          return;
        }
        await replaceImportData(data, "Backup restaurado");
      }, {
        yesLabel: "Restaurar",
        yesStyle: "accent"
      });
    });
  });
}
/* ============================================================
   RENDER PRINCIPAL
   ============================================================ */
