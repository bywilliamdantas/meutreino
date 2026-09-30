import { store } from "../../store.js";
import { syncWakeLock } from "../../workouts/active-session.js";
import { renderBackupsOverlay } from "../backups-view.js";
import { renderBodyOverlay } from "../body-view.js";
import { renderConfirmOverlay } from "./confirm-overlay.js";
import { flushAutoSave, renderDayOverlay } from "./day-overlay.js";
import { renderDaySessionsOverlay } from "./day-sessions-overlay.js";
import { renderImportChoiceOverlay } from "./import-choice-overlay.js";
import { renderExercisePickerOverlay, renderPickerOverlay } from "./picker-overlay.js";
import { renderProgressOverlay } from "./progress-overlay.js";

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
    customChecked: false
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

export function renderOverlay() {
  const root = document.getElementById("sheetRoot");
  if (!store.overlay) {
    root.innerHTML = "";
    return;
  }
  if (store.overlay.type === "day") return renderDayOverlay(root);
  if (store.overlay.type === "progress") return renderProgressOverlay(root);
  if (store.overlay.type === "importChoice") return renderImportChoiceOverlay(root);
  if (store.overlay.type === "confirm") return renderConfirmOverlay(root);
  if (store.overlay.type === "picker") return renderPickerOverlay(root);
  if (store.overlay.type === "daySessions") return renderDaySessionsOverlay(root);
  if (store.overlay.type === "exercisePicker") return renderExercisePickerOverlay(root);
  if (store.overlay.type === "body") return renderBodyOverlay(root);
  if (store.overlay.type === "backups") return renderBackupsOverlay(root);
}
