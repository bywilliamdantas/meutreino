import { mergeImportData, replaceImportData } from "../../backup/import-export.js";
import { ICONS } from "../../data/icons.js";
import { store } from "../../store.js";
import { closeOverlay } from "./overlay-manager.js";

export function renderImportChoiceOverlay(root) {
  const {
    parsed
  } = store.overlay;
  const nTreinos = (parsed.order || []).length;
  const nSessoes = Object.keys(parsed.sessions || {}).length;
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Importar backup">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date">Importar backup</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    <p style="font-size:13px;color:var(--text-muted);margin:0 0 18px;line-height:1.5;">
      Este arquivo tem ${nTreinos} treino(s) e ${nSessoes} dia(s) registrado(s).
    </p>
    <div class="sheet-actions">
      <button class="cta-btn" id="importMergeBtn">Mesclar com os dados atuais</button>
      <button class="footer-btn danger" id="importReplaceBtn">${ICONS.trash} Substituir tudo</button>
      <button class="undo-link" id="importCancelBtn" style="margin-top:2px;">cancelar</button>
    </div>
  </div>`;
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
  document.getElementById("importCancelBtn").addEventListener("click", closeOverlay);
  document.getElementById("importMergeBtn").addEventListener("click", () => mergeImportData(parsed));
  document.getElementById("importReplaceBtn").addEventListener("click", () => replaceImportData(parsed));
}
