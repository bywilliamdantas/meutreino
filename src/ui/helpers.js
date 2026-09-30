import { REST_COLOR } from "../config.js";
import { PALETTE } from "../data/constants.js";
import { ICONS } from "../data/icons.js";
import { store } from "../store.js";
import { escapeAttr, escapeHtml } from "../utils/dom.js";

export function colorFor(key, order) {
  if (store.data.workouts[key]?.isRest) return REST_COLOR;
  const idx = order.indexOf(key);
  return PALETTE[idx >= 0 ? idx % PALETTE.length : 0];
}

export function userDisplayName() {
  return store.data.settings.displayName && store.data.settings.displayName.trim() || store.currentUser.name || store.currentUser.username;
}

export function userInitial() {
  const n = userDisplayName().trim();
  return n ? n[0].toUpperCase() : "?";
}

export function avatarInnerHtml(size) {
  const url = store.data.settings.avatarUrl;
  if (url) return `<img src="${escapeAttr(url)}" alt="" class="avatar-img">`;
  return `<span class="avatar-fallback">${escapeHtml(userInitial())}</span>`;
}

export function isCollapsed(id) {
  const c = store.data.settings.collapsedSections;
  return !!(c && c[id]);
}

export function sectionHeader(id, title, first, noToggle) {
  if (noToggle) {
    return `<p class="section-title${first ? "" : " spaced-title"}">${title}</p>`;
  }
  const c = isCollapsed(id);
  return `<div class="section-title-row${first ? "" : " spaced"}">
    <p class="section-title" style="margin:0;">${title}</p>
    <button type="button" class="toggle-visibility-btn" data-role="togglesection" data-section="${id}" aria-expanded="${c ? "false" : "true"}" aria-label="${c ? "mostrar" : "ocultar"} ${escapeAttr(title.toLowerCase())}">
      ${c ? ICONS.eyeOff + " Mostrar" : ICONS.eye + " Ocultar"}
    </button>
  </div>`;
}

export function blockHeader(title, first) {
  return `<p class="section-title${first ? "" : " spaced-title"}">${title}</p>`;
}
