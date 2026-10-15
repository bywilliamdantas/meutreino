import { playBeep, unlockAudio } from "./audio/beep.js";
import { setAvatar } from "./storage/avatar.js";
import { doLogout, hasActiveWorkout, writeIdleDays } from "./auth/session.js";
import { openPinSheet } from "./views/pin-view.js";
import { normalizeBackupEvery, snoozeUntilIso } from "./backup/backup-reminder.js";
import { exportBackup, exportCsv } from "./backup/import-export.js";
import { importFixMessage, validateBackup } from "./backup/validate.js";
import { newExId, newRestKey } from "./counters.js";
import { isSelectableGroup } from "./exercises/exercises.js";
import { loadData, persist } from "./persistence.js";
import { closePerfil, goTab, openPerfil } from "./router.js";
import { store } from "./store.js";
import { applyTheme } from "./theme.js";
import { showToast } from "./ui/toast.js";
import { attachSwipe } from "./ui/swipe.js";
import { applyWaitingUpdate, checkForUpdate, hardRefreshApp } from "./update/sw-update.js";
import { haptic, safeUrl } from "./utils/dom.js";
import { todayKey } from "./utils/format.js";
import { resizeImageFile } from "./utils/image.js";
import { openBackupsSheet } from "./views/backups-view.js";
import { openBodySheet } from "./views/body-view.js";
import { openDaySheet } from "./views/calendar.js";
import { undoToday } from "./views/overlays/day-overlay.js";
import {
  openConfirm,
  openDaySessionsSheet,
  openExercisePicker,
  openImportChoice,
  openProgressSheet,
  openWorkoutPicker
} from "./views/overlays/overlay-manager.js";
import { render } from "./views/render.js";
import { cancelActiveSession, endActiveSession, pauseActiveSession, startActiveSession, syncWakeLock } from "./workouts/active-session.js";
import { currentWeeklyGoal, isRestLetter, sessionsFor } from "./workouts/sessions.js";
import { MAX_WEEKLY_GOAL, MIN_WEEKLY_GOAL } from "./workouts/weekly-goal.js";
import { nextAvailableLetter, nextWorkoutLetter, workoutLabel } from "./workouts/workouts.js";

/* ============================================================
   HANDLERS
   ============================================================ */
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export function attachHandlers() {
  const $ = (id) => document.getElementById(id);
  const statusBtn = $("statusBtn");
  if (statusBtn)
    statusBtn.addEventListener("click", () => {
      haptic(6);
      const dateKey = todayKey();
      const arr = sessionsFor(dateKey);
      const act = store.data.activeSession;
      const hasActive = act.state === "running" || act.state === "paused";
      if (arr.length >= 2 && !hasActive) {
        openDaySessionsSheet(dateKey);
      } else {
        openDaySheet(dateKey);
      }
    });
  const buildWorkoutBtn = $("buildWorkoutBtn");
  if (buildWorkoutBtn)
    buildWorkoutBtn.addEventListener("click", () => {
      haptic(6);
      const arr = sessionsFor(todayKey());
      store.treinosEditKey = arr.length ? arr[arr.length - 1].letter : nextWorkoutLetter();
      store.treinosView = "edit";
      goTab("treinos", { keepWorkoutView: true });
    });
  const startBtn = $("startBtn");
  if (startBtn && !startBtn.disabled)
    startBtn.addEventListener("click", () => {
      const a = store.data.activeSession;
      let letter;
      if (a.state === "running" || a.state === "paused") {
        letter = a.letter;
      } else {
        const arr = sessionsFor(todayKey());
        const unfinished = arr.find((s) => !s.endedAt && !isRestLetter(s.letter));
        if (unfinished) {
          letter = unfinished.letter;
        } else if (arr.length) {
          // Já houve treino hoje: escolha livre entre os treinos (o recomendado vem destacado).
          haptic(6);
          openWorkoutPicker(todayKey());
          return;
        } else {
          letter = nextWorkoutLetter();
        }
      }
      if (!letter) return;
      startActiveSession(letter);
    });
  const stopBtn = $("stopBtn");
  if (stopBtn && !stopBtn.disabled) stopBtn.addEventListener("click", pauseActiveSession);
  const endBtn = $("endBtn");
  if (endBtn && !endBtn.disabled)
    endBtn.addEventListener("click", () => {
      openConfirm("Finalizar o treino?", endActiveSession, {
        yesLabel: "Treino Concluído",
        noLabel: "Cancelar Treino",
        yesStyle: "accent",
        onNo: cancelActiveSession
      });
    });
  const editTodayBtn = $("editTodayBtn");
  if (editTodayBtn)
    editTodayBtn.addEventListener("click", () => {
      const dateKey = todayKey();
      const arr = sessionsFor(dateKey);
      if (arr.length >= 2) {
        openDaySessionsSheet(dateKey);
      } else {
        openDaySheet(dateKey);
      }
    });
  const undoBtn = $("undoTodayBtn");
  if (undoBtn) undoBtn.addEventListener("click", undoToday);
  const addSecondBtn = $("addSecondBtn");
  if (addSecondBtn)
    addSecondBtn.addEventListener("click", () => {
      haptic(6);
      openWorkoutPicker(todayKey());
    });
  const retryLoadBtn = $("retryLoadBtn");
  if (retryLoadBtn)
    retryLoadBtn.addEventListener("click", async () => {
      showToast("Carregando…");
      await loadData();
      render();
    });
  const updateBtn = $("updateBtn");
  if (updateBtn)
    updateBtn.addEventListener("click", () => {
      if (!store.updateAvailable) return;
      haptic(6);
      showToast("Atualizando…");
      applyWaitingUpdate(store.updateAvailable.waiting ? store.updateAvailable : null);
    });
  const backupNowBtn = $("backupNowBtn");
  if (backupNowBtn) backupNowBtn.addEventListener("click", exportBackup);
  const backupSnoozeBtn = $("backupSnoozeBtn");
  if (backupSnoozeBtn)
    backupSnoozeBtn.addEventListener("click", async () => {
      store.data.settings.backupSnoozedUntil = snoozeUntilIso();
      render();
      await persist();
    });
  const backupEverySelect = $("backupEverySelect");
  if (backupEverySelect)
    backupEverySelect.addEventListener("change", async (e) => {
      const n = normalizeBackupEvery(parseInt(e.target.value, 10));
      store.data.settings.backupEvery = n;
      store.data.settings.backupSnoozedUntil = null;
      render();
      await persist();
      showToast(n === 0 ? "Lembrete de backup desligado" : `Sugerir backup a cada ${n} treinos`);
    });
  const pinRowBtn = $("pinRowBtn");
  if (pinRowBtn)
    pinRowBtn.addEventListener("click", () => {
      haptic(6);
      openPinSheet();
    });
  const idleDaysSelect = $("idleDaysSelect");
  if (idleDaysSelect)
    idleDaysSelect.addEventListener("change", (e) => {
      writeIdleDays(store.currentUser.username, parseInt(e.target.value, 10));
      showToast(`Pede login após ${e.target.value} dias sem abrir`);
    });
  const logoutBtn = $("logoutBtn");
  if (logoutBtn)
    logoutBtn.addEventListener("click", () => {
      openConfirm(
        hasActiveWorkout(store.currentUser.username) ? "Você tem um treino em andamento. Sair mesmo assim? Ele continua salvo." : "Sair da sua conta?",
        doLogout,
        {
          yesLabel: "Sair",
          noLabel: "Cancelar",
          yesStyle: "danger"
        }
      );
    });
  const greetBellBtn = $("greetBellBtn");
  if (greetBellBtn)
    greetBellBtn.addEventListener("click", () => {
      haptic(6);
      goTab("ajustes");
    });
  const openPerfilBtn = $("openPerfilBtn");
  if (openPerfilBtn) openPerfilBtn.addEventListener("click", openPerfil);
  const openPerfilFromAjustesBtn = $("openPerfilFromAjustesBtn");
  if (openPerfilFromAjustesBtn) openPerfilFromAjustesBtn.addEventListener("click", openPerfil);
  const perfilBackBtn = $("perfilBackBtn");
  if (perfilBackBtn) perfilBackBtn.addEventListener("click", closePerfil);
  const openDadosBackupBtn = $("openDadosBackupBtn");
  if (openDadosBackupBtn)
    openDadosBackupBtn.addEventListener("click", () => {
      haptic(6);
      store.dadosBackupOpen = true;
      render();
      const scroller = document.getElementById("app");
      if (scroller) scroller.scrollTop = 0;
    });
  const dadosBackupBackBtn = $("dadosBackupBackBtn");
  if (dadosBackupBackBtn)
    dadosBackupBackBtn.addEventListener("click", () => {
      store.dadosBackupOpen = false;
      render();
    });
  const perfilAvatarBtn = $("perfilAvatarBtn");
  const perfilAvatarInput = $("perfilAvatarInput");
  if (perfilAvatarBtn && perfilAvatarInput) {
    perfilAvatarBtn.addEventListener("click", () => perfilAvatarInput.click());
    perfilAvatarInput.addEventListener("change", async () => {
      const file = perfilAvatarInput.files && perfilAvatarInput.files[0];
      perfilAvatarInput.value = "";
      if (!file) return;
      try {
        const dataUrl = await resizeImageFile(file, 200);
        await setAvatar(dataUrl);
        render();
        await persist();
      } catch (e) {
        showToast("Não foi possível usar essa imagem");
      }
    });
  }
  const perfilEditBtn = $("perfilEditBtn");
  if (perfilEditBtn)
    perfilEditBtn.addEventListener("click", async () => {
      if (store.perfilEditingName) {
        const inp = $("perfilNameInput");
        const v = inp ? inp.value.trim() : "";
        store.data.settings.displayName = v;
        store.perfilEditingName = false;
        render();
        await persist();
      } else {
        store.perfilEditingName = true;
        render();
        const inp = $("perfilNameInput");
        if (inp) {
          inp.focus();
          inp.select();
        }
      }
    });
  const perfilNameInput = $("perfilNameInput");
  if (perfilNameInput) {
    perfilNameInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        $("perfilEditBtn")?.click();
      }
    });
  }
  const perfilAjustesBtn = $("perfilAjustesBtn");
  if (perfilAjustesBtn) perfilAjustesBtn.addEventListener("click", () => goTab("ajustes"));
  const perfilNotifBtn = $("perfilNotifBtn");
  if (perfilNotifBtn) perfilNotifBtn.addEventListener("click", () => goTab("ajustes"));
  const perfilSuporteBtn = $("perfilSuporteBtn");
  if (perfilSuporteBtn) perfilSuporteBtn.addEventListener("click", () => showToast("Fale com seu treinador para suporte"));
  document.querySelectorAll('[data-role="openhistoryday"]').forEach((el) => {
    el.addEventListener("click", () => {
      haptic(6);
      const dk = el.dataset.datekey;
      const arr = sessionsFor(dk);
      if (arr.length >= 2) openDaySessionsSheet(dk);
      else openDaySheet(dk);
    });
  });
  document.querySelectorAll('[data-role="togglesection"]').forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.dataset.section;
      haptic(6);
      const before = el.getBoundingClientRect().top;
      if (!store.data.settings.collapsedSections) store.data.settings.collapsedSections = {};
      if (store.data.settings.collapsedSections[id]) delete store.data.settings.collapsedSections[id];
      else store.data.settings.collapsedSections[id] = true;
      render();
      const again = document.querySelector(`[data-role="togglesection"][data-section="${id}"]`);
      if (again) window.scrollBy(0, again.getBoundingClientRect().top - before);
      await persist();
    });
  });
  document.querySelectorAll('[data-role="wname"]').forEach((el) => {
    el.addEventListener("change", async () => {
      store.data.workouts[el.dataset.letter].name = el.value || workoutLabel(el.dataset.letter);
      await persist();
    });
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") el.blur();
    });
  });
  document.querySelectorAll('[data-role="moveup"],[data-role="movedown"]').forEach((el) => {
    el.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      haptic(6);
      const key = el.dataset.letter;
      const dir = el.dataset.role === "moveup" ? -1 : 1;
      const idx = store.data.order.indexOf(key);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= store.data.order.length) return;
      [store.data.order[idx], store.data.order[newIdx]] = [store.data.order[newIdx], store.data.order[idx]];
      render();
      await persist();
    });
  });
  const reorderToggleBtn = document.getElementById("reorderToggleBtn");
  if (reorderToggleBtn)
    reorderToggleBtn.addEventListener("click", () => {
      haptic(6);
      store.treinosReorder = !store.treinosReorder;
      render();
    });
  document.querySelectorAll("details.ex-more").forEach((el) => {
    el.addEventListener("toggle", () => {
      if (!store.exMoreOpen) store.exMoreOpen = new Set();
      if (el.open) store.exMoreOpen.add(el.dataset.exid);
      else store.exMoreOpen.delete(el.dataset.exid);
    });
  });
  attachSwipe(document);
  const openWorkoutEditor = (key) => {
    if (!store.data.workouts[key]) return;
    haptic(6);
    store.treinosEditKey = key;
    store.treinosView = "edit";
    render();
    const scroller = document.getElementById("app");
    if (scroller) scroller.scrollTop = 0;
  };
  const deleteWorkout = async (key) => {
    const wk = store.data.workouts[key];
    if (!wk) return;
    if (store.data.order.length <= 1) {
      showToast("Mantenha pelo menos um treino");
      return;
    }
    const a = store.data.activeSession;
    if (a && (a.state === "running" || a.state === "paused") && a.letter === key) {
      showToast("Finalize o treino em andamento antes de excluir");
      return;
    }
    const idx = store.data.order.indexOf(key);
    const label = wk.isRest ? "Descanso" : `Treino ${key}`;
    store.data.order = store.data.order.filter((l) => l !== key);
    delete store.data.workouts[key];
    if (store.treinosEditKey === key) {
      store.treinosEditKey = null;
      store.treinosView = "list";
    }
    render();
    await persist();
    showToast(`${label} removido`, {
      label: "Desfazer",
      fn: async () => {
        if (store.data.workouts[key]) return;
        store.data.workouts[key] = wk;
        store.data.order.splice(Math.min(idx, store.data.order.length), 0, key);
        render();
        await persist();
        showToast("Restaurado");
      }
    });
  };
  document.querySelectorAll('[data-role="swipeedit"]').forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openWorkoutEditor(el.dataset.letter);
    });
  });
  document.querySelectorAll('[data-role="swipedelete"]').forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      haptic(10);
      deleteWorkout(el.dataset.letter);
    });
  });
  document.querySelectorAll('[data-role="startworkout"]').forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const a = store.data.activeSession;
      if (a && (a.state === "running" || a.state === "paused")) {
        showToast("Já existe um treino em andamento");
        return;
      }
      const key = el.dataset.letter;
      if (!store.data.workouts[key]) return;
      haptic(8);
      startActiveSession(key);
    });
  });
  document.querySelectorAll('[data-role="openworkout"]').forEach((el) => {
    const open = () => {
      if (store.treinosReorder) return;
      const row = el.closest(".wl-swipe");
      if (row && (row.dataset.justSwiped || (row.dataset.state && row.dataset.state !== "none"))) return;
      haptic(6);
      store.treinosEditKey = el.dataset.letter;
      store.treinosView = "edit";
      render();
      const scroller = document.getElementById("app");
      if (scroller) scroller.scrollTop = 0;
    };
    el.addEventListener("click", open);
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        open();
      }
    });
  });
  const treinosBackBtn = document.getElementById("treinosBackBtn");
  if (treinosBackBtn)
    treinosBackBtn.addEventListener("click", () => {
      store.treinosView = "list";
      store.treinosEditKey = null;
      render();
    });
  document.querySelectorAll('[data-role="wfilter"]').forEach((el) => {
    el.addEventListener("click", () => {
      haptic(4);
      store.treinosFilter = el.dataset.cat;
      render();
    });
  });
  document.querySelectorAll('[data-role="delworkout"]').forEach((el) => {
    el.addEventListener("click", () => deleteWorkout(el.dataset.letter));
  });
  document.querySelectorAll('[data-role="dupworkout"]').forEach((el) => {
    el.addEventListener("click", async () => {
      haptic(6);
      const src = store.data.workouts[el.dataset.letter];
      const nl = nextAvailableLetter();
      if (!src || !nl) {
        showToast("Limite atingido");
        return;
      }
      store.data.workouts[nl] = {
        name: `${src.name} (cópia)`,
        exercises: (src.exercises || []).map((e) => ({
          ...JSON.parse(JSON.stringify(e)),
          id: newExId()
        }))
      };
      store.data.order.push(nl);
      render();
      await persist();
      showToast(`Duplicado como Treino ${nl}`);
    });
  });
  document.querySelectorAll('[data-role="extype"]').forEach((el) => {
    el.addEventListener("click", async () => {
      haptic(6);
      const w = store.data.workouts[el.dataset.letter];
      const ex = w.exercises.find((e) => e.id === el.dataset.exid);
      if (!ex) return;
      const newType = el.dataset.type;
      if ((ex.type || "strength") === newType) return;
      ex.type = newType;
      render();
      await persist();
    });
  });
  document.querySelectorAll('[data-role="exgroup"]').forEach((el) => {
    el.addEventListener("change", async () => {
      const w = store.data.workouts[el.dataset.letter];
      const ex = w && w.exercises.find((e) => e.id === el.dataset.exid);
      if (!ex) return;
      if (isSelectableGroup(el.value)) ex.group = el.value;
      else delete ex.group;
      haptic(6);
      await persist();
    });
  });
  document.querySelectorAll('[data-role="exsets"], [data-role="exreps"], [data-role="exrest"], [data-role="exmins"]').forEach((el) => {
    el.addEventListener("change", async () => {
      const w = store.data.workouts[el.dataset.letter];
      const ex = w.exercises.find((e) => e.id === el.dataset.exid);
      if (!ex) return;
      const r = el.dataset.role;
      if (r === "exsets") ex.sets = el.value;
      if (r === "exreps") ex.reps = el.value;
      if (r === "exrest") ex.rest = el.value;
      if (r === "exmins") ex.mins = el.value;
      await persist();
    });
  });
  document.querySelectorAll('[data-role="openexname"]').forEach((el) => {
    el.addEventListener("click", () => {
      haptic(6);
      openExercisePicker({
        mode: "rename",
        letter: el.dataset.letter,
        exId: el.dataset.exid
      });
    });
  });
  document.querySelectorAll('[data-role="delex"]').forEach((el) => {
    el.addEventListener("click", async () => {
      const w = store.data.workouts[el.dataset.letter];
      if (!w) return;
      const idx = w.exercises.findIndex((e) => e.id === el.dataset.exid);
      if (idx < 0) return;
      const removed = w.exercises[idx];
      w.exercises.splice(idx, 1);
      render();
      await persist();
      showToast("Exercício removido", {
        label: "Desfazer",
        fn: async () => {
          const w2 = store.data.workouts[el.dataset.letter];
          if (!w2 || w2.exercises.some((e) => e.id === removed.id)) return;
          w2.exercises.splice(Math.min(idx, w2.exercises.length), 0, removed);
          render();
          await persist();
          showToast("Restaurado");
        }
      });
    });
  });
  document.querySelectorAll('[data-role="exmove"]').forEach((el) => {
    el.addEventListener("click", async () => {
      haptic(6);
      const w = store.data.workouts[el.dataset.letter];
      if (!w) return;
      const idx = w.exercises.findIndex((e) => e.id === el.dataset.exid);
      const ni = idx + parseInt(el.dataset.dir, 10);
      if (idx < 0 || ni < 0 || ni >= w.exercises.length) return;
      [w.exercises[idx], w.exercises[ni]] = [w.exercises[ni], w.exercises[idx]];
      render();
      await persist();
    });
  });
  document.querySelectorAll('[data-role="exss"]').forEach((el) => {
    el.addEventListener("click", async () => {
      haptic(6);
      const w = store.data.workouts[el.dataset.letter];
      const ex = w && w.exercises.find((e) => e.id === el.dataset.exid);
      if (!ex) return;
      if (ex.ss) delete ex.ss;
      else ex.ss = true;
      render();
      await persist();
    });
  });
  document.querySelectorAll('[data-role="exlink"]').forEach((el) => {
    el.addEventListener("click", async () => {
      const w = store.data.workouts[el.dataset.letter];
      const ex = w && w.exercises.find((e) => e.id === el.dataset.exid);
      if (!ex) return;
      const v = window.prompt("Link de vídeo ou técnica (deixe vazio para remover):", ex.link || "");
      if (v === null) return;
      const clean = safeUrl(v);
      if (v.trim() && !clean) {
        showToast("Link inválido");
        return;
      }
      if (clean) ex.link = clean;
      else delete ex.link;
      render();
      await persist();
    });
  });
  document.querySelectorAll('[data-role="viewprogress"]').forEach((el) => {
    if (el.disabled) return;
    el.addEventListener("click", () => openProgressSheet(el.dataset.exid, el.dataset.name));
  });
  document.querySelectorAll('[data-role="addex"]').forEach((el) => {
    el.addEventListener("click", () => {
      haptic(6);
      openExercisePicker({
        mode: "add",
        letter: el.dataset.letter
      });
    });
  });
  const addWorkoutBtn = $("addWorkoutBtn");
  if (addWorkoutBtn)
    addWorkoutBtn.addEventListener("click", async () => {
      const nextLetter = nextAvailableLetter();
      if (!nextLetter) {
        showToast("Limite atingido");
        return;
      }
      store.data.order.push(nextLetter);
      store.data.workouts[nextLetter] = {
        name: `Treino ${nextLetter}`,
        exercises: []
      };
      render();
      await persist();
    });
  const addRestBtn = $("addRestBtn");
  if (addRestBtn)
    addRestBtn.addEventListener("click", async () => {
      const key = newRestKey();
      store.data.order.push(key);
      store.data.workouts[key] = {
        name: "Descanso",
        exercises: [],
        isRest: true
      };
      render();
      await persist();
    });
  document.querySelectorAll('[data-role="calday"]').forEach((el) => {
    el.addEventListener("click", () => {
      const dateKey = el.dataset.key;
      const arr = sessionsFor(dateKey);
      if (arr.length >= 2) {
        openDaySessionsSheet(dateKey);
      } else {
        openDaySheet(dateKey);
      }
    });
  });
  const calPrevBtn = $("calPrevBtn");
  if (calPrevBtn)
    calPrevBtn.addEventListener("click", () => {
      store.historyMonth.setMonth(store.historyMonth.getMonth() - 1);
      store.historyExpanded = false;
      render();
    });
  const monthSessionsToggle = $("monthSessionsToggle");
  if (monthSessionsToggle)
    monthSessionsToggle.addEventListener("click", () => {
      haptic(6);
      store.historyExpanded = !store.historyExpanded;
      render();
    });
  const calNextBtn = $("calNextBtn");
  if (calNextBtn)
    calNextBtn.addEventListener("click", () => {
      const todayD = new Date();
      const isCurrent = store.historyMonth.getFullYear() === todayD.getFullYear() && store.historyMonth.getMonth() === todayD.getMonth();
      if (isCurrent) return;
      store.historyMonth.setMonth(store.historyMonth.getMonth() + 1);
      store.historyExpanded = false;
      render();
    });
  const reminderToggle = $("reminderToggle");
  if (reminderToggle)
    reminderToggle.addEventListener("change", async (e) => {
      store.data.settings.reminder.enabled = e.target.checked;
      store.data.settings.reminder.lastNotifiedDate = null;
      if (e.target.checked && typeof Notification !== "undefined" && Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch (err) {}
      }
      render();
      await persist();
    });
  const reminderTime = $("reminderTime");
  if (reminderTime)
    reminderTime.addEventListener("change", async (e) => {
      store.data.settings.reminder.time = e.target.value;
      await persist();
    });
  document.querySelectorAll('[data-role="settheme"]').forEach((el) => {
    el.addEventListener("click", () => {
      haptic(6);
      applyTheme(el.dataset.theme);
      render();
    });
  });
  const restMinus = $("restMinus");
  const restPlus = $("restPlus");
  const updateRest = async (delta) => {
    haptic(6);
    store.data.settings.restDuration = Math.max(15, Math.min(600, (store.data.settings.restDuration || 90) + delta));
    const v = $("restDurationVal");
    if (v) v.textContent = store.data.settings.restDuration + "s";
    await persist();
  };
  if (restMinus) restMinus.addEventListener("click", () => updateRest(-15));
  if (restPlus) restPlus.addEventListener("click", () => updateRest(15));
  const goalMinus = $("weeklyGoalMinus");
  const goalPlus = $("weeklyGoalPlus");
  const goalReset = $("weeklyGoalReset");
  const showGoal = () => {
    const v = $("weeklyGoalVal");
    if (v) v.textContent = currentWeeklyGoal();
    if (goalReset) goalReset.classList.toggle("hidden", store.data.settings.weeklyGoal == null);
  };
  const updateGoal = async (delta) => {
    haptic(6);
    const next = Math.max(MIN_WEEKLY_GOAL, Math.min(MAX_WEEKLY_GOAL, currentWeeklyGoal() + delta));
    store.data.settings.weeklyGoal = next;
    showGoal();
    await persist();
  };
  if (goalMinus) goalMinus.addEventListener("click", () => updateGoal(-1));
  if (goalPlus) goalPlus.addEventListener("click", () => updateGoal(1));
  if (goalReset)
    goalReset.addEventListener("click", async () => {
      haptic(6);
      store.data.settings.weeklyGoal = null;
      showGoal();
      await persist();
    });
  const weekStartToggle = $("weekStartToggle");
  if (weekStartToggle)
    weekStartToggle.addEventListener("change", async (e) => {
      store.data.settings.weekStartsMonday = e.target.checked;
      render();
      await persist();
    });
  const checkUpdateBtn = $("checkUpdateBtn");
  if (checkUpdateBtn) checkUpdateBtn.addEventListener("click", checkForUpdate);
  const hardRefreshBtn = $("hardRefreshBtn");
  if (hardRefreshBtn)
    hardRefreshBtn.addEventListener("click", () => {
      openConfirm("Limpar o cache do app e recarregar? Seus treinos e histórico continuam salvos.", hardRefreshApp, {
        yesLabel: "Recarregar",
        yesStyle: "accent"
      });
    });
  const exportBtn = $("exportBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportBackup);
  const exportCsvBtn = $("exportCsvBtn");
  if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCsv);
  const importBtn = $("importBtn");
  if (importBtn) importBtn.addEventListener("click", () => $("importFile").click());
  const importFile = $("importFile");
  if (importFile)
    importFile.addEventListener("change", async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        showToast("Arquivo grande demais para ser um backup");
        ev.target.value = "";
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const v = validateBackup(parsed);
        if (!v.ok) {
          showToast(v.error);
          ev.target.value = "";
          return;
        }
        openImportChoice(parsed);
        const fixMsg = importFixMessage(v);
        if (fixMsg) showToast(fixMsg);
      } catch (e) {
        showToast("Arquivo inválido");
      }
      ev.target.value = "";
    });
  document.querySelectorAll('[data-role="setunit"]').forEach((el) => {
    el.addEventListener("click", async () => {
      haptic(6);
      store.data.settings.unit = el.dataset.unit === "lb" ? "lb" : "kg";
      render();
      await persist();
    });
  });
  const beepToggle = $("beepToggle");
  if (beepToggle)
    beepToggle.addEventListener("change", async (e) => {
      store.data.settings.beepEnabled = e.target.checked;
      if (e.target.checked) {
        /* é um toque do usuário: destrava o áudio e toca uma prévia */
        unlockAudio();
        playBeep();
      }
      await persist();
    });
  const keepAwakeToggle = $("keepAwakeToggle");
  if (keepAwakeToggle)
    keepAwakeToggle.addEventListener("change", async (e) => {
      store.data.settings.keepAwake = e.target.checked;
      syncWakeLock();
      await persist();
    });
  document.querySelectorAll('[data-role="statsrange"]').forEach((el) => {
    el.addEventListener("click", () => {
      haptic(6);
      store.statsRange = parseInt(el.dataset.days, 10) || 30;
      render();
    });
  });
  document.querySelectorAll('[data-role="openrecord"]').forEach((el) => {
    el.addEventListener("click", () => openProgressSheet(el.dataset.exid, el.dataset.name));
  });
  const openBodyBtn = $("openBodyBtn");
  if (openBodyBtn)
    openBodyBtn.addEventListener("click", () => {
      haptic(6);
      openBodySheet();
    });
  document.querySelectorAll('[data-role="delbody"]').forEach((el) => {
    el.addEventListener("click", async () => {
      const idx = store.data.body.findIndex((b) => b.id === el.dataset.id);
      if (idx < 0) return;
      const removed = store.data.body[idx];
      store.data.body.splice(idx, 1);
      render();
      await persist();
      showToast("Registro removido", {
        label: "Desfazer",
        fn: async () => {
          if (store.data.body.some((b) => b.id === removed.id)) return;
          store.data.body.push(removed);
          render();
          await persist();
          showToast("Restaurado");
        }
      });
    });
  });
  const openBackupsBtn = $("openBackupsBtn");
  if (openBackupsBtn)
    openBackupsBtn.addEventListener("click", () => {
      haptic(6);
      openBackupsSheet();
    });
  const syncRetryBtn = $("syncRetryBtn");
  if (syncRetryBtn) syncRetryBtn.addEventListener("click", () => persist());
}
