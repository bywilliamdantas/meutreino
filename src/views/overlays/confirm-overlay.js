import { ICONS } from "../../data/icons.js";
import { store } from "../../store.js";
import { escapeHtml } from "../../utils/dom.js";
import { closeOverlay, renderOverlay } from "./overlay-manager.js";

/* O foco abre em "Cancelar" (data-autofocus): confirmar altera dados e um Enter mantido ou sem querer não deve decidir por quem abriu o painel. */
export function renderConfirmOverlay(root) {
  const { msg, onYes, yesLabel, noLabel, onNo } = store.overlay;
  const yesText = yesLabel || "Confirmar";
  const noText = noLabel || "Cancelar";
  const yesClass = store.overlay.yesStyle === "accent" ? "footer-btn primary" : store.overlay.yesStyle === "danger" ? "footer-btn danger" : "footer-btn";
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date confirm-msg" id="sheetTitle">${escapeHtml(msg)}</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    <div class="sheet-actions">
      <button class="${yesClass}" id="confirmYes">${escapeHtml(yesText)}</button>
      <button class="footer-btn" id="confirmNo" data-autofocus>${escapeHtml(noText)}</button>
    </div>
  </div>`;
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
  document.getElementById("confirmNo").addEventListener("click", () => {
    store.overlay = null;
    renderOverlay();
    if (typeof onNo === "function") onNo();
  });
  document.getElementById("confirmYes").addEventListener("click", () => {
    store.overlay = null;
    renderOverlay();
    onYes();
  });
}
