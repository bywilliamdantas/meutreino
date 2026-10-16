import { store } from "../../store.js";
import { syncWakeLock } from "../../workouts/active-session.js";
import { renderBackupsOverlay } from "../backups-view.js";
import { renderBodyOverlay } from "../body-view.js";
import { renderConfirmOverlay } from "./confirm-overlay.js";
import { flushAutoSave, renderDayOverlay } from "./day-overlay.js";
import { renderDaySessionsOverlay } from "./day-sessions-overlay.js";
import { renderImportChoiceOverlay } from "./import-choice-overlay.js";
import { renderExercisePickerOverlay, renderPickerOverlay } from "./picker-overlay.js";
import { renderPinOverlay } from "../pin-view.js";
import { renderProgressOverlay } from "./progress-overlay.js";
import { renderWeekDayOverlay } from "./week-day-overlay.js";

export function openProgressSheet(exId, name) {
  store.overlay = {
    type: "progress",
    exId,
    name
  };
  renderOverlay();
}

export function openImportChoice(parsed) {
  store.overlay = {
    type: "importChoice",
    parsed
  };
  renderOverlay();
}

export function openConfirm(msg, onYes, opts) {
  store.overlay = {
    type: "confirm",
    msg,
    onYes,
    yesLabel: opts?.yesLabel,
    noLabel: opts?.noLabel,
    yesStyle: opts?.yesStyle,
    onNo: opts?.onNo
  };
  renderOverlay();
}

export function openWorkoutPicker(dateKey) {
  store.overlay = {
    type: "picker",
    dateKey
  };
  renderOverlay();
}

export function openExercisePicker(opts) {
  store.overlay = {
    type: "exercisePicker",
    mode: opts.mode,
    letter: opts.letter,
    exId: opts.exId || null,
    query: "",
    selected: new Set(),
    customChecked: false,
    customGroup: ""
  };
  renderOverlay();
}

export function openDaySessionsSheet(dateKey) {
  store.overlay = {
    type: "daySessions",
    dateKey
  };
  renderOverlay();
}

export function openWeekDaySheet(dateKey) {
  store.overlay = {
    type: "weekDay",
    dateKey
  };
  renderOverlay();
}

export function closeOverlay() {
  flushAutoSave();
  store.overlay = null;
  if (store.sheetClockInterval) {
    clearInterval(store.sheetClockInterval);
    store.sheetClockInterval = null;
  }
  renderOverlay();
  syncWakeLock();
}

function rendererFor(type) {
  if (type === "day") return renderDayOverlay;
  if (type === "progress") return renderProgressOverlay;
  if (type === "importChoice") return renderImportChoiceOverlay;
  if (type === "confirm") return renderConfirmOverlay;
  if (type === "picker") return renderPickerOverlay;
  if (type === "daySessions") return renderDaySessionsOverlay;
  if (type === "weekDay") return renderWeekDayOverlay;
  if (type === "exercisePicker") return renderExercisePickerOverlay;
  if (type === "body") return renderBodyOverlay;
  if (type === "backups") return renderBackupsOverlay;
  if (type === "pin") return renderPinOverlay;
  return null;
}

export function renderOverlay() {
  const root = document.getElementById("sheetRoot");
  if (!root) return;
  const ov = store.overlay;
  if (!ov) {
    root.innerHTML = "";
    if (dlg.active) closeDialogA11y();
    return;
  }
  const render = rendererFor(ov.type);
  if (!render) return;
  /* Re-render do mesmo painel (ex.: trocar a letra no painel do dia): o innerHTML novo
     destrói o elemento focado, então guardamos onde o foco estava para devolvê-lo. */
  const same = dlg.active && dlg.overlay === ov;
  const focused = same && root.contains(document.activeElement) ? document.activeElement : null;
  const focusedSel = selectorOf(focused);
  render(root);
  enhanceDialog(root, ov, same, !!focused, focusedSel);
}

/* ============================================================
   Acessibilidade dos painéis (teclado e leitor de tela)

   Tudo passa por renderOverlay(), o único ponto por onde todo painel abre, re-renderiza e fecha:
   - abrir: foco vai para o primeiro elemento útil e o fundo vira inert (+ aria-hidden);
   - Tab fica preso no painel (e no timer de descanso, que segue usável sobre a folha);
   - Esc fecha, igual ao botão "fechar";
   - fechar: tira o inert e devolve o foco ao elemento que abriu o painel.
   O painel em si (role="dialog", aria-modal, aria-labelledby) é marcado nos templates de cada overlay.
   ============================================================ */
const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';

/* Fora do "fundo" inerte: o próprio painel, o timer de descanso (continua operável sobre a folha do
   dia), o aviso (toast, com o "Desfazer") e a região aria-live que anuncia o fim do descanso. */
const KEEP_ACTIVE = new Set(["sheetRoot", "restTimerRoot", "toast", "restLive", "exLightbox"]);
const NEVER_MUTED = /^(SCRIPT|STYLE|LINK|TEMPLATE)$/;

/* opener/openerSel: quem abriu o painel (e como reencontrá-lo se o render() o recriou);
   muted: os elementos do fundo que ganharam inert, para desfazer exatamente o que foi feito. */
const dlg = { active: false, overlay: null, opener: null, openerSel: null, muted: [] };

/* No Safari/iOS um toque num botão não move o foco (document.activeElement fica no body),
   então guardamos o último alvo clicado para saber a quem devolver o foco ao fechar. */
let lastActivator = null;

const hasLayout = () => document.documentElement.getClientRects().length > 0;

function visible(el) {
  if (el.closest("[hidden], [inert]")) return false;
  if (!hasLayout()) return true; // sem layout (jsdom) vale o que está no DOM
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
}

function tabbables(scope) {
  return [...scope.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.tabIndex >= 0 && visible(el));
}

/* Seletor que reencontra o elemento depois que um render() recria o DOM: id, senão data-*, senão aria-label. */
function selectorOf(el) {
  if (!el || el.nodeType !== 1) return null;
  const q = (v) => String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  if (el.id) return `[id="${q(el.id)}"]`;
  const tag = el.tagName.toLowerCase();
  const data = Object.entries(el.dataset || {})
    .map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}="${q(v)}"]`)
    .join("");
  if (data) return tag + data;
  const label = el.getAttribute("aria-label");
  return label ? `${tag}[aria-label="${q(label)}"]` : null;
}

function focusEl(el) {
  try {
    el.focus({ preventScroll: true });
  } catch (e) {}
}

function currentPanel() {
  return document.querySelector('#sheetRoot .sheet[role="dialog"]');
}

/* Primeiro elemento útil: o marcado com data-autofocus; senão o primeiro foco possível que não seja
   o "fechar" (que é o primeiro do cabeçalho); senão o próprio "fechar"; senão o painel. */
function focusInitial(panel) {
  const items = tabbables(panel);
  const target = panel.querySelector("[data-autofocus]") || items.find((el) => el.id !== "sheetClose") || items[0] || panel;
  focusEl(target);
}

function setBackground(on) {
  if (!on) {
    dlg.muted.forEach((el) => {
      el.removeAttribute("inert");
      el.removeAttribute("aria-hidden");
    });
    dlg.muted = [];
    return;
  }
  if (dlg.muted.length) return;
  [...document.body.children].forEach((el) => {
    if (KEEP_ACTIVE.has(el.id) || NEVER_MUTED.test(el.tagName)) return;
    el.setAttribute("inert", ""); // some do Tab e do toque; aria-hidden cobre iOS < 15.5, que não tem inert
    el.setAttribute("aria-hidden", "true");
    dlg.muted.push(el);
  });
}

function pickOpener(root) {
  const a = document.activeElement;
  if (a && a !== document.body && a !== document.documentElement && !root.contains(a)) return a;
  return lastActivator && lastActivator.isConnected && !root.contains(lastActivator) ? lastActivator : null;
}

function enhanceDialog(root, ov, same, hadFocus, focusedSel) {
  const panel = root.querySelector('.sheet[role="dialog"]');
  if (!panel) return;
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("tabindex", "-1"); // alvo de foco de reserva; fora da ordem do Tab
  if (same) {
    if (!hadFocus) return; // o foco não estava no painel: não rouba
    const el = focusedSel ? panel.querySelector(focusedSel) : null;
    focusEl(el && !el.disabled ? el : panel);
    return;
  }
  /* Painel novo. Se já havia um aberto (ex.: confirmação aberta de dentro de outro painel),
     o elemento de origem continua sendo o primeiro, o que abriu a cadeia. */
  if (!dlg.active) {
    dlg.opener = pickOpener(root);
    dlg.openerSel = selectorOf(dlg.opener);
  }
  dlg.active = true;
  dlg.overlay = ov;
  focusInitial(panel); // antes do aria-hidden, para o foco nunca ficar dentro de um fundo escondido
  setBackground(true);
}

/* Desfaz o inert sem mexer no foco (o painel sumiu por um caminho que não passou por renderOverlay). */
function releaseDialogA11y() {
  setBackground(false);
  dlg.active = false;
  dlg.overlay = null;
  dlg.opener = null;
  dlg.openerSel = null;
}

function closeDialogA11y() {
  const { opener, openerSel } = dlg;
  releaseDialogA11y();
  const target = opener && opener.isConnected ? opener : openerSel ? document.querySelector(openerSel) : null;
  if (target) focusEl(target);
}

function trapTab(ev, panel) {
  const timer = document.getElementById("restTimerRoot");
  const items = [...tabbables(panel), ...(timer ? tabbables(timer) : [])];
  if (!items.length) {
    ev.preventDefault();
    focusEl(panel);
    return;
  }
  const a = document.activeElement;
  const inScope = !!a && (panel.contains(a) || (!!timer && timer.contains(a)));
  const first = items[0];
  const last = items[items.length - 1];
  if (ev.shiftKey) {
    if (!inScope || a === first || a === panel) {
      ev.preventDefault();
      focusEl(last);
    }
  } else if (!inScope || a === last) {
    ev.preventDefault();
    focusEl(first);
  }
}

function onKeydown(ev) {
  if (!dlg.active) return;
  if (!store.overlay) return releaseDialogA11y();
  if (ev.key === "Escape") {
    if (ev.defaultPrevented || ev.isComposing) return;
    ev.preventDefault();
    closeOverlay();
    return;
  }
  if (ev.key !== "Tab" || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const panel = currentPanel();
  if (panel) trapTab(ev, panel);
}

/* Rede de segurança: se o foco vazar para o fundo por qualquer caminho, volta para o painel. */
function onFocusIn(ev) {
  if (!dlg.active) return;
  if (!store.overlay) return releaseDialogA11y();
  const t = ev.target;
  const panel = currentPanel();
  if (!panel || !t || !t.nodeType) return;
  const inside = (id) => {
    const el = document.getElementById(id);
    return !!el && el.contains(t);
  };
  if (panel.contains(t) || inside("restTimerRoot") || inside("toast") || inside("exLightbox")) return;
  focusInitial(panel);
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener(
    "click",
    (ev) => {
      const t = ev.target;
      if (t && typeof t.closest === "function") lastActivator = t.closest('button, a[href], [role="button"], [tabindex]');
    },
    true
  );
}
