import { newExId } from "../../counters.js";
import { EXERCISE_LIBRARY } from "../../data/exercise-library.js";
import { ICONS } from "../../data/icons.js";
import { exThumbHtml } from "../../exercises/exercise-visuals.js";
import { getAllExerciseNames, getCustomExerciseNames, isCardioName } from "../../exercises/exercises.js";
import { persist } from "../../persistence.js";
import { store } from "../../store.js";
import { colorFor } from "../../ui/helpers.js";
import { showToast } from "../../ui/toast.js";
import { escapeAttr, escapeHtml, haptic } from "../../utils/dom.js";
import { startActiveSession } from "../../workouts/active-session.js";
import { workoutLabel } from "../../workouts/workouts.js";
import { openDaySheet } from "../calendar.js";
import { render } from "../render.js";
import { closeOverlay } from "./overlay-manager.js";

export function renderPickerOverlay(root) {
  const {
    dateKey
  } = store.overlay;
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date">Escolher treino</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    <div class="sheet-picker">
      ${store.data.order.map(k => {
    const wk = store.data.workouts[k];
    const isRest = wk?.isRest;
    return `<button class="sheet-picker-item" data-role="pickletter" data-letter="${k}">
          <div class="spi-chip" style="background:${colorFor(k, store.data.order)}">${isRest ? ICONS.moonSmall : k}</div>
          <div class="spi-name">${escapeHtml(wk?.name || workoutLabel(k))}</div>
        </button>`;
  }).join("")}
    </div>
  </div>`;
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
  document.querySelectorAll('[data-role="pickletter"]').forEach(b => {
    b.addEventListener("click", () => {
      haptic(6);
      const letter = b.dataset.letter;
      store.overlay = null;
      startActiveSession(letter);
      openDaySheet(dateKey, {
        mode: "new",
        letter
      });
    });
  });
}

export function renderExercisePickerOverlay(root) {
  const {
    mode
  } = store.overlay;
  root.innerHTML = `<div class="sheet-backdrop" id="sheetBackdrop"></div>
  <div class="sheet" role="dialog" aria-modal="true">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-date">${mode === "rename" ? "Escolher exercício" : "Adicionar exercícios"}</div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    <input type="text" id="exPickerSearch" class="ex-picker-search" placeholder="Buscar ou digitar um novo nome…" value="${escapeAttr(store.overlay.query)}" autocomplete="off" autocapitalize="sentences">
    <div class="ex-picker-list" id="exPickerList"></div>
    ${mode === "add" ? `<button class="footer-btn primary" id="exPickerConfirm" style="width:100%;margin-top:12px;">Adicionar selecionados</button>` : ""}
  </div>`;
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
  const searchInput = document.getElementById("exPickerSearch");
  searchInput.addEventListener("input", e => {
    store.overlay.query = e.target.value;
    renderExercisePickerList();
  });
  renderExercisePickerList();
  if (mode === "add") {
    const confirmBtn = document.getElementById("exPickerConfirm");
    confirmBtn.addEventListener("click", async () => {
      const names = Array.from(store.overlay.selected);
      const q = store.overlay.query.trim();
      if (store.overlay.customChecked && q && !names.some(n => n.toLowerCase() === q.toLowerCase())) {
        names.push(q);
      }
      if (names.length === 0) {
        showToast("Selecione ao menos um exercício");
        return;
      }
      const w = store.data.workouts[store.overlay.letter];
      names.forEach(n => {
        w.exercises.push({
          id: newExId(),
          name: n,
          sets: "",
          reps: "",
          rest: "",
          mins: "",
          type: isCardioName(n) ? "cardio" : "strength"
        });
      });
      haptic([10, 30, 10]);
      closeOverlay();
      render();
      await persist();
      showToast(names.length === 1 ? "Exercício adicionado" : names.length + " exercícios adicionados");
    });
  }
  setTimeout(() => {
    try {
      searchInput.focus();
    } catch (e) {}
  }, 50);
}

export function renderExercisePickerList() {
  const listEl = document.getElementById("exPickerList");
  if (!listEl || !store.overlay || store.overlay.type !== "exercisePicker") return;
  const {
    mode,
    selected
  } = store.overlay;
  const qRaw = store.overlay.query.trim();
  const q = qRaw.toLowerCase();
  const itemHtml = n => {
    if (mode === "add") {
      return `<label class="ex-picker-item">
        <input type="checkbox" data-name="${escapeAttr(n)}" ${selected.has(n) ? "checked" : ""}>
        ${exThumbHtml({
        name: n
      }, "sm")}
        <span>${escapeHtml(n)}</span>
      </label>`;
    }
    return `<button type="button" class="ex-picker-item" data-role="pickexname" data-name="${escapeAttr(n)}">
      ${exThumbHtml({
      name: n
    }, "sm")}
      <span>${escapeHtml(n)}</span>
    </button>`;
  };
  const customRowHtml = () => {
    if (mode === "add") {
      return `<label class="ex-picker-item ex-picker-custom">
        <input type="checkbox" id="exPickerCustomCheck" ${store.overlay.customChecked ? "checked" : ""}>
        <span>${ICONS.plus} Adicionar “${escapeHtml(qRaw)}”</span>
      </label>`;
    }
    return `<button type="button" class="ex-picker-item ex-picker-custom" data-role="pickexname" data-name="${escapeAttr(qRaw)}">
      ${ICONS.plus} Usar “${escapeHtml(qRaw)}”
    </button>`;
  };
  let html = "";
  if (q) {
    const allNames = getAllExerciseNames();
    const filtered = allNames.filter(n => n.toLowerCase().includes(q));
    const exactMatch = allNames.some(n => n.toLowerCase() === q);
    if (!exactMatch) html += customRowHtml();
    filtered.forEach(n => {
      html += itemHtml(n);
    });
  } else {
    const custom = getCustomExerciseNames();
    if (custom.length) {
      html += `<details class="ex-picker-group">
        <summary class="ex-picker-group-title"><span>Meus exercícios</span> <span class="ex-picker-count">${custom.length}</span></summary>
        <div class="ex-picker-group-list">${custom.map(itemHtml).join("")}</div>
      </details>`;
    }
    Object.keys(EXERCISE_LIBRARY).forEach(group => {
      const list = EXERCISE_LIBRARY[group];
      html += `<details class="ex-picker-group">
        <summary class="ex-picker-group-title"><span>${escapeHtml(group)}</span> <span class="ex-picker-count">${list.length}</span></summary>
        <div class="ex-picker-group-list">${list.map(itemHtml).join("")}</div>
      </details>`;
    });
  }
  listEl.innerHTML = html;
  listEl.querySelectorAll("details.ex-picker-group").forEach(d => {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      listEl.querySelectorAll("details.ex-picker-group[open]").forEach(o => {
        if (o !== d) o.open = false;
      });
      d.scrollIntoView({
        block: "nearest"
      });
    });
  });
  if (mode === "add") {
    const customCheck = document.getElementById("exPickerCustomCheck");
    if (customCheck) customCheck.addEventListener("change", e => {
      store.overlay.customChecked = e.target.checked;
    });
    listEl.querySelectorAll('input[type="checkbox"][data-name]').forEach(cb => {
      cb.addEventListener("change", e => {
        const n = e.target.dataset.name;
        if (e.target.checked) store.overlay.selected.add(n);else store.overlay.selected.delete(n);
      });
    });
  } else {
    listEl.querySelectorAll('[data-role="pickexname"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const name = btn.dataset.name;
        const w = store.data.workouts[store.overlay.letter];
        const ex = w.exercises.find(e => e.id === store.overlay.exId);
        if (!ex) return;
        ex.name = name;
        if (isCardioName(name)) ex.type = "cardio";
        haptic(6);
        closeOverlay();
        render();
        await persist();
      });
    });
  }
}
