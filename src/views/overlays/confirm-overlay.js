import { ICONS } from "../../data/icons.js";
import { store } from "../../store.js";
import { escapeHtml } from "../../utils/dom.js";
import { closeOverlay, renderOverlay } from "./overlay-manager.js";

export function renderConfirmOverlay(root) {
  const {
    msg,
    onYes,
    yesLabel,
    noLabel,
    onNo
  } = store.overlay;
  const yesText = yesLabel || "Confirmar";
  const noText = noLabel || "Cancelar";
  const yesClass = store.overlay.yesStyle === "accent" ? "footer-btn primary" : store.overlay.yesStyle === "danger" ? "footer-btn danger" : "footer-btn";
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date" style="font-size:16px;">${escapeHtml(msg)}</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    <div class="sheet-actions">
      <button class="${yesClass}" id="confirmYes">${escapeHtml(yesText)}</button>
      <button class="footer-btn" id="confirmNo">${escapeHtml(noText)}</button>
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
