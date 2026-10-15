import { backupOffer, BACKUP_EVERY_OPTIONS, normalizeBackupEvery, workoutsSinceBackup } from "../backup/backup-reminder.js";
import { forEachLoggedSet } from "../stats/stats.js";
import { storageStatusText } from "../backup/storage-status.js";
import { REST_COLOR } from "../config.js";
import { APP_VERSION, MONTH_NAMES_FULL, WEEKDAY_FULL } from "../data/constants.js";
import { ICONS } from "../data/icons.js";
import { attachHandlers } from "../event-handlers.js";
import { exThumbHtml } from "../exercises/exercise-visuals.js";
import { daysSince, exerciseHistory, groupOptionsHtml, isCustomExerciseName, muscleGroupOf } from "../exercises/exercises.js";
import { heroMuscleSvg } from "../icons-svg.js";
import { store } from "../store.js";
import { getThemePref } from "../theme.js";
import { avatarInnerHtml, blockHeader, colorFor, toneVars, userDisplayName } from "../ui/helpers.js";
import { escapeAttr, escapeHtml } from "../utils/dom.js";
import { dateKeyFromDate, fmtDuration, fmtDurationShort, todayKey } from "../utils/format.js";
import { isCardio } from "../utils/numbers.js";
import { renderHeroClock, runCountUp, startHeroClockTicker, syncWakeLock } from "../workouts/active-session.js";
import {
  autoWeeklyGoal,
  computeWeeklyStreak,
  currentWeeklyGoal,
  isRestLetter,
  sessionsFor,
  sessionsThisMonth,
  sessionsThisWeek,
  totalDays,
  totalDurationForDay
} from "../workouts/sessions.js";
import { categoryForWorkout, estimateWorkoutMs, nextWorkoutLetter, workoutLabel } from "../workouts/workouts.js";
import { renderBodyCard } from "./body-view.js";
import { buildMonthCalendar } from "./calendar.js";
import { renderLogin } from "./login-view.js";
import { isLinkedNext } from "./overlays/day-overlay.js";
import { renderOverlay } from "./overlays/overlay-manager.js";
import { renderRestTimer } from "./overlays/rest-timer.js";
import { renderRecordsCard, renderStatsCard } from "./stats-view.js";
import { hasPin, pinSupported } from "../auth/pin.js";
import { readIdleDays } from "../auth/session.js";
import { SESSION_IDLE_OPTIONS } from "../data/constants.js";
import { storageUsageHtml, refreshStorageUsage } from "./storage-usage-view.js";
import { renderTabBar } from "./tabbar-view.js";

/* ============================================================
   RENDER PRINCIPAL
   ============================================================ */
/* Grupos musculares únicos de um treino (sem "Outros"), na ordem dos exercícios. */
function sameMonthKey(dk, y, m) {
  const [ky, km] = String(dk).split("-").map(Number);
  return ky === y && km === m;
}

export function workoutGroups(w) {
  const out = [];
  if (!w || w.isRest || !Array.isArray(w.exercises)) return out;
  w.exercises.forEach((ex) => {
    const g = muscleGroupOf(ex && ex.name, ex);
    if (g && g !== "Outros" && !out.includes(g)) out.push(g);
  });
  return out;
}

export function render() {
  if (!store.currentUser) {
    renderLogin();
    return;
  }
  const app = document.getElementById("app");
  const next = nextWorkoutLetter();
  const a = store.data.activeSession;
  const isRunning = a.state === "running";
  const isPaused = a.state === "paused";
  const hasActive = isRunning || isPaused;
  const todayArr = sessionsFor(todayKey());
  const todayCount = todayArr.length;
  const streak = computeWeeklyStreak();
  const weeklyGoal = currentWeeklyGoal();
  const total = sessionsThisMonth();
  const thisWeek = sessionsThisWeek();
  const now = new Date();
  const weekdayLabel = WEEKDAY_FULL[now.getDay()];
  const heroKey = hasActive ? a.letter : todayCount ? todayArr[todayArr.length - 1].letter : next;
  const heroW = store.data.workouts[heroKey] || {
    name: heroKey,
    exercises: []
  };
  let banners = "";
  if (store.loadFailed) {
    banners += `<div class="banner"><span>Não foi possível carregar seus dados salvos.</span><button id="retryLoadBtn">tentar de novo</button></div>`;
  }
  if (store.updateAvailable) {
    banners += `<div class="banner info"><span>Nova versão do app disponível.</span><button id="updateBtn">atualizar</button></div>`;
  }
  const bkSettings = store.data.settings;
  const bkOffer = backupOffer({
    every: bkSettings.backupEvery,
    lastBackupAt: bkSettings.lastBackupAt,
    snoozedUntil: bkSettings.backupSnoozedUntil,
    workoutsSince: workoutsSinceBackup(store.data.sessions, store.data.workouts, bkSettings.lastBackupAt),
    hasData: totalDays() > 0
  });
  if (bkOffer.offer) {
    const w = bkOffer.workouts;
    const reasonTxt =
      bkOffer.reason === "never"
        ? "Você ainda não exportou um backup"
        : bkOffer.reason === "days"
          ? `Já fazem ${Math.floor(bkOffer.days)} dias sem backup`
          : `${w} treino${w === 1 ? "" : "s"} desde o último backup`;
    banners += `<div class="banner info"><span>Fazer backup agora? ${reasonTxt}.</span><span class="banner-actions"><button id="backupNowBtn">exportar</button><button id="backupSnoozeBtn" class="muted">agora não</button></span></div>`;
  }
  const bannersHtml = banners ? `<div class="banners">${banners}</div>` : "";
  const todayDuration = totalDurationForDay(todayKey());
  const todayIsRest = todayCount > 0 && isRestLetter(todayArr[todayArr.length - 1].letter);
  let eyebrowText = "Próximo treino";
  if (isRunning) eyebrowText = "Treinando agora";
  else if (isPaused) eyebrowText = "Pausado";
  else if (todayIsRest) eyebrowText = "Descanso";
  else if (todayCount === 1) eyebrowText = "Treino de hoje";
  else if (todayCount > 1) eyebrowText = todayCount + " treinos hoje";
  const heroSub =
    todayCount > 0
      ? todayDuration
        ? `concluído em ${fmtDuration(todayDuration)}`
        : "concluído hoje"
      : store.data.workouts[heroKey]?.isRest
        ? "dia de recuperação"
        : hasActive
          ? "toque em Detalhes para registrar"
          : heroW.exercises && heroW.exercises.length
            ? workoutGroups(heroW).map(escapeHtml).join(" · ") || "pronto para começar?"
            : "adicione exercícios para começar";
  const heroEmpty = !hasActive && todayCount === 0 && !heroW.isRest && !(heroW.exercises && heroW.exercises.length);
  let heroActionsHtml;
  if (!hasActive) {
    heroActionsHtml = `<div class="hero-v2-actions">
      <button type="button" class="hero-v2-btn primary" id="startBtn">${ICONS.playSm} Iniciar</button>
      <button type="button" class="hero-v2-btn ghost" id="statusBtn">${ICONS.calendarSmall} Detalhes</button>
    </div>${heroEmpty ? `<button type="button" class="hero-empty-cta" id="buildWorkoutBtn">${ICONS.plus} Montar este treino</button>` : ""}`;
  } else if (isRunning) {
    heroActionsHtml = `<div class="hero-v2-actions">
      <button type="button" class="hero-v2-btn primary" id="stopBtn">${ICONS.pauseSm} Pausar</button>
      <button type="button" class="hero-v2-btn ghost" id="endBtn">${ICONS.check} Finalizar</button>
    </div>
    <button type="button" class="hero-v2-link" id="statusBtn">Ver detalhes do treino</button>`;
  } else {
    heroActionsHtml = `<div class="hero-v2-actions">
      <button type="button" class="hero-v2-btn primary" id="startBtn">${ICONS.playSm} Retomar</button>
      <button type="button" class="hero-v2-btn ghost" id="endBtn">${ICONS.check} Finalizar</button>
    </div>
    <button type="button" class="hero-v2-link" id="statusBtn">Ver detalhes do treino</button>`;
  }
  const heroSecondaryRowHtml =
    !hasActive && todayCount > 0
      ? `<div class="hero-v2-secondary-row">
         <button type="button" class="hero-v2-chip" id="editTodayBtn">${ICONS.pencil} Editar</button>
         <button type="button" class="hero-v2-chip undo" id="undoTodayBtn">${ICONS.trash} Desfazer</button>
         <button type="button" class="hero-v2-chip" id="addSecondBtn">${ICONS.plus} Novo</button>
       </div>`
      : "";
  const heroEstMs = !hasActive && todayCount === 0 ? estimateWorkoutMs(heroW) : 0;
  const heroEstHtml = heroEstMs ? `<span class="hero-v2-est">${ICONS.timer} ~${Math.round(heroEstMs / 60000)} min</span>` : "";
  const heroHtml = `<div class="card hero-card-v2" id="heroCard">
    <div class="hero-muscle">${heroMuscleSvg()}</div>
    <div class="hero-v2-top">
      <span class="hero-v2-badge">${eyebrowText}</span>
      ${heroEstHtml}
      <div class="hero-clock hidden" id="heroClock">
        ${ICONS.timer}
        <span class="clock-time" id="heroClockTime">00:00</span>
      </div>
    </div>
    <div class="hero-v2-body">
      <div class="hero-v2-name">${escapeHtml(heroW.name || workoutLabel(heroKey))}</div>
      <div class="hero-v2-sub">${heroSub}</div>
    </div>
    ${heroActionsHtml}
    ${heroSecondaryRowHtml}
  </div>`;
  const statsRowHtml = `<div class="stats-row-v3">
    <div class="stat-card-v3 streak${streak === 0 ? " zero" : ""}">
      <span class="stat-mini">${ICONS.flame}</span>
      <span class="stat-num" data-count="${streak}">0</span>
      <span class="stat-label">${streak === 1 ? "semana seguida" : "semanas seguidas"}</span>
    </div>
    <div class="stat-card-v3 week">
      <span class="stat-mini">${ICONS.calendarSmall}</span>
      <span class="stat-num"><span data-count="${thisWeek}">0</span><span class="stat-of">/${weeklyGoal}</span></span>
      <span class="stat-label">nesta semana</span>
    </div>
    <div class="stat-card-v3 month">
      <span class="stat-mini">${ICONS.trophy}</span>
      <span class="stat-num" data-count="${total}">0</span>
      <span class="stat-label">${total === 1 ? "treino no mês" : "treinos no mês"}</span>
    </div>
  </div>`;
  const hour = now.getHours();
  const greetWord = hour < 5 ? "Boa madrugada," : hour < 12 ? "Bom dia," : hour < 18 ? "Boa tarde," : "Boa noite,";
  const dateLabel = `${weekdayLabel}, ${now.getDate()} de ${MONTH_NAMES_FULL[now.getMonth()]}`;
  const firstName = (userDisplayName() || "Treinador").split(" ")[0];
  const greetHtml = `<div class="greet-row">
    <div>
      <div class="greet-date">${dateLabel}</div>
      <div class="greet-hello">${greetWord} ${escapeHtml(firstName)}</div>
    </div>
    <div class="greet-actions">
      <button type="button" class="greet-bell" id="greetBellBtn" aria-label="Lembretes">${ICONS.bell}</button>
      <button type="button" class="greet-avatar" id="openPerfilBtn" aria-label="Abrir perfil">${avatarInnerHtml()}</button>
    </div>
  </div>`;
  const weekDayShort = ["D", "S", "T", "Q", "Q", "S", "S"];
  const wOffset = store.data.settings.weekStartsMonday ? (now.getDay() === 0 ? 6 : now.getDay() - 1) : now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - wOffset);
  weekStart.setHours(0, 0, 0, 0);
  let weekDotsHtml = `<div class="card week-dots-card">
    <div class="week-dots-head"><p class="section-title">Esta semana</p><span class="week-goal-pill">meta ${weeklyGoal}×</span></div>
    <div class="week-dots">`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dk = dateKeyFromDate(d);
    const dArr = sessionsFor(dk);
    const done = dArr.some((s) => !isRestLetter(s.letter));
    const restOnly = !done && dArr.length > 0 && dArr.every((s) => isRestLetter(s.letter));
    const isToday = dk === todayKey();
    const idx = store.data.settings.weekStartsMonday ? (i + 1) % 7 : i;
    const doneEntry = done ? dArr.filter((s) => !isRestLetter(s.letter)).pop() : null;
    const doneLetter = doneEntry && doneEntry.letter;
    const dotStyle = doneLetter && store.data.workouts[doneLetter] ? ` style="${toneVars(colorFor(doneLetter, store.data.order))}"` : "";
    const dotInner = done ? escapeHtml(doneLetter || "✓") : restOnly ? ICONS.moonSmall : isToday ? String(d.getDate()) : "";
    weekDotsHtml += `<div class="week-dot-col">
      <span class="week-dot ${done ? "done" : ""} ${restOnly ? "rest" : ""} ${isToday ? "today" : ""}"${dotStyle}>${dotInner}</span>
      <span class="week-dot-label">${weekDayShort[idx]}</span>
    </div>`;
  }
  weekDotsHtml += `</div></div>`;
  const homeHtml = `${greetHtml}${bannersHtml}${heroHtml}${statsRowHtml}${weekDotsHtml}`;

  /* -------- workout edit card -------- */
  function renderWorkoutEditCard(key) {
    const w = store.data.workouts[key];
    if (!w) return "";
    const color = colorFor(key, store.data.order);
    return `<div class="card workout-card" data-letter="${escapeAttr(key)}">
      <div class="workout-head">
        <div class="workout-chip" style="${toneVars(color)}">${w.isRest ? ICONS.moonSmall : key}</div>
        <input class="workout-title-input" data-role="wname" data-letter="${escapeAttr(key)}" value="${escapeAttr(w.name)}" placeholder="${w.isRest ? "Nome do descanso" : "Nome do treino"}" aria-label="Nome de ${w.isRest ? "descanso" : "treino " + escapeAttr(key)}">
        <span class="edit-pencil">${ICONS.pencil}</span>
        ${w.isRest ? "" : `<button class="icon-btn" data-role="dupworkout" data-letter="${escapeAttr(key)}" aria-label="duplicar treino ${escapeAttr(key)}">${ICONS.copy}</button>`}
        ${store.data.order.length > 1 ? `<button class="icon-btn" data-role="delworkout" data-letter="${escapeAttr(key)}" aria-label="remover ${w.isRest ? "descanso" : "treino " + escapeAttr(key)}">${ICONS.close}</button>` : ""}
      </div>
      ${
        w.isRest
          ? `<div class="rest-note">Dia de descanso — sem exercícios para registrar.</div>`
          : `
      ${
        w.exercises.length > 0
          ? w.exercises
              .map((ex, exIdx) => {
                const cardio = isCardio(ex);
                const hasHist = exerciseHistory(ex.id).length > 0;
                return `
        <div class="exercise-row${isLinkedNext(w, exIdx) || (exIdx > 0 && isLinkedNext(w, exIdx - 1)) ? " linked" : ""}" data-exid="${escapeAttr(ex.id)}">
          <div class="ex-row-top">
            <button type="button" class="ex-name-input ex-name-btn" data-role="openexname" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" aria-label="Escolher nome do exercício">
              ${exThumbHtml(ex, "sm")}
              <span class="ex-name-text ${ex.name ? "" : "placeholder"}">${ex.name ? escapeHtml(ex.name) : cardio ? "Escolher exercício (Esteira, Bike...)" : "Escolher exercício"}</span>
              ${ICONS.pencil}
            </button>
            <button class="progress-btn" data-role="viewprogress" data-exid="${escapeAttr(ex.id)}" data-name="${escapeAttr(ex.name || "Exercício")}" ${hasHist ? "" : "disabled"} aria-label="Ver progresso">${ICONS.chart}</button>
            <button class="ex-del" data-role="delex" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" aria-label="remover exercício">${ICONS.close}</button>
          </div>
          <details class="ex-more" data-exid="${escapeAttr(ex.id)}"${store.exMoreOpen && store.exMoreOpen.has(ex.id) ? " open" : ""}>
          <summary class="ex-more-summary"><span>Mais opções</span><span class="ex-more-tags">${cardio ? "Cardio" : "Força"}${ex.ss ? " · Superset" : ""}${ex.link ? " · Link" : ""}</span></summary>
          <div class="ex-type-toggle">
            <button class="ex-type-btn ${cardio ? "" : "active"}" data-role="extype" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" data-type="strength">${ICONS.dumbbell} Força</button>
            <button class="ex-type-btn ${cardio ? "active" : ""}" data-role="extype" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" data-type="cardio">${ICONS.cardio} Cardio</button>
          </div>
          ${
            !cardio && isCustomExerciseName(ex.name)
              ? `<label class="ex-picker-group-select">
            <span>Grupo muscular</span>
            <select data-role="exgroup" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" aria-label="Grupo muscular de ${escapeAttr(ex.name)}">
              ${groupOptionsHtml(ex.group)}
            </select>
          </label>`
              : ""
          }
          <div class="ex-tools">
            <button class="tool-btn icon" data-role="exmove" data-dir="-1" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" ${exIdx === 0 ? "disabled" : ""} aria-label="mover exercício para cima">${ICONS.up}</button>
            <button class="tool-btn icon" data-role="exmove" data-dir="1" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" ${exIdx === w.exercises.length - 1 ? "disabled" : ""} aria-label="mover exercício para baixo">${ICONS.down}</button>
            ${exIdx < w.exercises.length - 1 ? `<button class="tool-btn ${ex.ss ? "active" : ""}" data-role="exss" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" aria-pressed="${!!ex.ss}">Superset com o próximo</button>` : ""}
            <button class="tool-btn ${ex.link ? "active" : ""}" data-role="exlink" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" aria-label="link de vídeo ou técnica">${ICONS.link} Link</button>
          </div>
          </details>
          ${
            cardio
              ? `
            <div class="ex-row-bottom">
              <label class="ex-field"><span>Minutos</span><input data-role="exmins" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" value="${escapeAttr(ex.mins || "")}" placeholder="30" inputmode="numeric" aria-label="Minutos"></label>
            </div>
          `
              : `
            <div class="ex-row-bottom">
              <label class="ex-field"><span>Séries</span><input data-role="exsets" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" value="${escapeAttr(ex.sets)}" placeholder="3" inputmode="numeric" aria-label="Séries"></label>
              <label class="ex-field"><span>Reps</span><input data-role="exreps" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" value="${escapeAttr(ex.reps)}" placeholder="12" inputmode="numeric" aria-label="Repetições"></label>
              <label class="ex-field"><span>Descanso (s)</span><input data-role="exrest" data-letter="${escapeAttr(key)}" data-exid="${escapeAttr(ex.id)}" value="${escapeAttr(ex.rest || "")}" placeholder="90" inputmode="numeric" aria-label="Descanso em segundos"></label>
            </div>
          `
          }
        </div>`;
              })
              .join("")
          : `<div class="empty-state">
          <div class="empty-icon">${ICONS.dumbbell}</div>
          <p class="empty-title">Nenhum exercício ainda</p>
          <p class="empty-sub">Toque em "Adicionar exercício" para começar a montar este treino.</p>
        </div>`
      }
      <button class="add-exercise-btn" data-role="addex" data-letter="${escapeAttr(key)}">${ICONS.plus} Adicionar exercício</button>
      `
      }
    </div>`;
  }
  let workoutsHtml = "";
  if (store.treinosView === "edit" && store.treinosEditKey && store.data.workouts[store.treinosEditKey]) {
    workoutsHtml = `<button type="button" class="back-link" id="treinosBackBtn">${ICONS.left} Treinos</button>` + renderWorkoutEditCard(store.treinosEditKey);
  } else {
    store.treinosView = "list";
    const cats = [];
    store.data.order.forEach((k) => {
      const c = categoryForWorkout(store.data.workouts[k]);
      if (!cats.includes(c)) cats.push(c);
    });
    if (!cats.includes(store.treinosFilter)) store.treinosFilter = "all";
    const filterChipsHtml =
      cats.length > 1
        ? `<div class="wf-seg" role="tablist" aria-label="Filtrar treinos">
      <button type="button" role="tab" aria-selected="${store.treinosFilter === "all"}" class="wf-chip ${store.treinosFilter === "all" ? "active" : ""}" data-role="wfilter" data-cat="all">Todos</button>
      ${cats.map((c) => `<button type="button" role="tab" aria-selected="${store.treinosFilter === c}" class="wf-chip ${store.treinosFilter === c ? "active" : ""}" data-role="wfilter" data-cat="${escapeAttr(c)}">${escapeHtml(c)}</button>`).join("")}
    </div>`
        : "";
    const lastDoneLetter = todayArr.length ? todayArr[todayArr.length - 1].letter : null;
    const reordering = !!store.treinosReorder && store.data.order.length > 1;
    const canStart = !hasActive;
    const canDelete = store.data.order.length > 1;
    workoutsHtml = filterChipsHtml;
    store.data.order.forEach((key, idx) => {
      const w = store.data.workouts[key];
      const cat = categoryForWorkout(w);
      if (store.treinosFilter !== "all" && cat !== store.treinosFilter) return;
      const color = colorFor(key, store.data.order);
      const estMs = estimateWorkoutMs(w);
      const nEx = w.exercises.length;
      const metaTxt = w.isRest
        ? "Dia de recuperação no ciclo"
        : `${nEx} exercício${nEx === 1 ? "" : "s"}${estMs ? ` · ~${Math.round(estMs / 60000)} min` : ""}`;
      const groups = workoutGroups(w);
      const tagsHtml = groups.length ? `<span class="wl-tags">${groups.map((g) => `<span class="wl-tag">${escapeHtml(g)}</span>`).join("")}</span>` : "";
      const doneToday = key === lastDoneLetter;
      const isNext = !w.isRest && key === next && !doneToday;
      let sideHtml = "";
      if (reordering) {
        sideHtml = `<span class="wl-reorder">
          <button type="button" class="reorder-btn" data-role="moveup" data-letter="${escapeAttr(key)}" ${idx === 0 ? "disabled" : ""} aria-label="mover para cima">${ICONS.up}</button>
          <button type="button" class="reorder-btn" data-role="movedown" data-letter="${escapeAttr(key)}" ${idx === store.data.order.length - 1 ? "disabled" : ""} aria-label="mover para baixo">${ICONS.down}</button>
        </span>`;
      } else if (doneToday) {
        sideHtml = `<span class="wl-side"><span class="wl-check">${ICONS.checkSm}</span></span>`;
      } else if (!w.isRest && canStart && nEx) {
        sideHtml = `<span class="wl-side">${isNext ? `<span class="wl-next">Próximo</span>` : ""}<button type="button" class="wl-play ${isNext ? "primary" : ""}" data-role="startworkout" data-letter="${escapeAttr(key)}" aria-label="Iniciar ${escapeAttr(w.name || "treino " + key)}">${ICONS.playSm}</button></span>`;
      } else if (isNext) {
        sideHtml = `<span class="wl-side"><span class="wl-next">Próximo</span></span>`;
      }
      const swipeable = !reordering;
      workoutsHtml += `<div class="wl-swipe${w.isRest ? " rest" : ""}" data-letter="${escapeAttr(key)}"${swipeable ? ' data-swipe="1"' : ""}>
        ${
          swipeable
            ? `<button type="button" class="wl-swipe-action edit" data-role="swipeedit" data-letter="${escapeAttr(key)}" tabindex="-1" aria-label="Editar ${escapeAttr(w.name || key)}">${ICONS.pencil}<span>Editar</span></button>
        <button type="button" class="wl-swipe-action delete" data-role="swipedelete" data-letter="${escapeAttr(key)}" tabindex="-1" aria-label="Excluir ${escapeAttr(w.name || key)}"${canDelete ? "" : " disabled"}>${ICONS.trash}<span>Delete</span></button>`
            : ""
        }
        <div class="workout-list-card${reordering ? " reordering" : ""}${w.isRest ? " rest" : ""}" data-role="openworkout" data-letter="${escapeAttr(key)}" role="button" tabindex="0">
          <span class="wl-letter" style="${toneVars(color)}">${w.isRest ? ICONS.moon : escapeHtml(key)}</span>
          <span class="wl-info">
            <span class="wl-name">${escapeHtml(w.name)}</span>
            <span class="wl-meta">${metaTxt}</span>
            ${tagsHtml}
          </span>
          ${sideHtml}
        </div>
      </div>`;
    });
    const cycleTxt = store.data.order.map((k) => (store.data.workouts[k]?.isRest ? "Descanso" : escapeHtml(k))).join(" → ");
    workoutsHtml += `<div class="wl-footer">
      <span class="wl-cycle">Ciclo: ${cycleTxt}</span>
      ${store.data.order.length > 1 ? `<button type="button" class="wl-toolbar-btn${reordering ? " active" : ""}" id="reorderToggleBtn" aria-pressed="${reordering}">${reordering ? "Concluir" : "Reordenar"}</button>` : ""}
    </div>
    <p class="wl-swipe-hint">Arraste um treino para a direita para editar ou para a esquerda para excluir.</p>
    <div class="row-2">
      <button class="add-workout-btn" id="addRestBtn">${ICONS.moonSmall} Adicionar descanso</button>
    </div>`;
  }

  /* -------- histórico -------- */
  const hmY = store.historyMonth.getFullYear();
  const hmPrefix = `${hmY}-${String(store.historyMonth.getMonth() + 1).padStart(2, "0")}-`;
  let hmTrainings = 0;
  let hmMs = 0;
  Object.keys(store.data.sessions).forEach((dk) => {
    const [ky, km] = dk.split("-").map(Number);
    if (ky !== hmY || km !== store.historyMonth.getMonth() + 1) return;
    hmTrainings += sessionsFor(dk).filter((s) => !isRestLetter(s.letter)).length;
    hmMs += totalDurationForDay(dk) || 0;
  });
  let hmVolume = 0;
  forEachLoggedSet((set, dk) => {
    if (!String(dk).startsWith(hmPrefix) && !sameMonthKey(dk, hmY, store.historyMonth.getMonth() + 1)) return;
    const wv = parseFloat(set && set.weight);
    const rv = parseFloat(set && set.reps);
    if (wv > 0 && rv > 0) hmVolume += wv * rv;
  });
  const hmMin = Math.round(hmMs / 60000);
  const hmTime = hmMin >= 60 ? `${Math.floor(hmMin / 60)}h${String(hmMin % 60).padStart(2, "0")}` : `${hmMin}min`;
  const hmVol = hmVolume >= 1000 ? `${(hmVolume / 1000).toFixed(hmVolume >= 10000 ? 0 : 1).replace(".", ",")}t` : `${Math.round(hmVolume)}kg`;
  const historySummaryHtml = `<div class="hist-summary">
    <div class="hist-sum-card"><span class="hist-sum-label">Treinos</span><span class="hist-sum-num">${hmTrainings}</span></div>
    <div class="hist-sum-card"><span class="hist-sum-label">Tempo total</span><span class="hist-sum-num">${hmTime}</span></div>
    <div class="hist-sum-card"><span class="hist-sum-label">Volume</span><span class="hist-sum-num">${hmVol}</span></div>
  </div>`;
  const legendWorkouts = store.data.order.filter((k) => !store.data.workouts[k]?.isRest);
  const hasRest = store.data.order.some((k) => store.data.workouts[k]?.isRest);
  let historyHtml = `${historySummaryHtml}<div class="card">
    <div class="legend">
      ${legendWorkouts.map((l) => `<div class="legend-item"><span class="legend-dot" style="${toneVars(colorFor(l, store.data.order))}"></span>${l}</div>`).join("")}
      ${hasRest ? `<div class="legend-item"><span class="legend-dot" style="${toneVars(REST_COLOR)}"></span>descanso</div>` : ""}

    </div>
    ${buildMonthCalendar(store.historyMonth)}
  </div>`;
  const monthKeys = Object.keys(store.data.sessions)
    .filter((k) => {
      const [ky, km] = k.split("-").map(Number);
      return ky === store.historyMonth.getFullYear() && km === store.historyMonth.getMonth() + 1;
    })
    .sort()
    .reverse();
  historyHtml += `<p class="section-title spaced-title">Sessões do mês</p>`;
  if (!monthKeys.length) {
    historyHtml += `<div class="empty-state">
      <div class="empty-icon">${ICONS.timer}</div>
      <p class="empty-title">Nenhuma sessão nesse mês</p>
      <p class="empty-sub">Os treinos que você concluir vão aparecer aqui.</p>
    </div>`;
  } else {
    const MONTH_PREVIEW = 5;
    const canCollapse = monthKeys.length > MONTH_PREVIEW;
    const expanded = !canCollapse || store.historyExpanded;
    const shownKeys = expanded ? monthKeys : monthKeys.slice(0, MONTH_PREVIEW);
    let monthTrainings = 0;
    let monthMs = 0;
    monthKeys.forEach((dk) => {
      monthTrainings += sessionsFor(dk).filter((s) => !isRestLetter(s.letter)).length;
      monthMs += totalDurationForDay(dk) || 0;
    });
    const summaryBits = [`${monthKeys.length} dia${monthKeys.length === 1 ? "" : "s"}`, `${monthTrainings} treino${monthTrainings === 1 ? "" : "s"}`];
    if (monthMs) summaryBits.push(fmtDurationShort(monthMs));
    historyHtml += `<div class="month-sessions-summary">${summaryBits.join(" · ")}</div>
    <div class="card month-sessions-card compact">${shownKeys
      .map((dk) => {
        const arr = sessionsFor(dk);
        const [, m, d] = dk.split("-").map(Number);
        const dur = totalDurationForDay(dk);
        return `<button type="button" class="month-session-row" data-role="openhistoryday" data-datekey="${escapeAttr(dk)}">
        <span class="ms-date">${d}/${m}</span>
        <span class="ms-letters">${arr
          .map((s) => {
            const isRest = isRestLetter(s.letter);
            const bg = s.letter && store.data.workouts[s.letter] && !isRest ? colorFor(s.letter, store.data.order) : REST_COLOR;
            const wk = s.letter && store.data.workouts[s.letter];
            const title = (wk && wk.name) || (s.letter ? workoutLabel(s.letter) : "");
            return `<span class="ms-item"><span class="ms-chip" style="${toneVars(bg)}">${isRest ? ICONS.moonSmall : s.letter || "?"}</span>${title ? `<span class="ms-title">${escapeHtml(title)}</span>` : ""}</span>`;
          })
          .join("")}</span>
        ${dur ? `<span class="ms-duration">${fmtDurationShort(dur)}</span>` : ""}
        <span class="ms-arrow">${ICONS.right}</span>
      </button>`;
      })
      .join(
        ""
      )}${canCollapse ? `<button type="button" class="month-sessions-toggle" id="monthSessionsToggle">${expanded ? "Mostrar menos" : `Ver todas (${monthKeys.length} dias)`}</button>` : ""}</div>`;
  }
  const progressHtml = renderStatsCard() + renderRecordsCard() + renderBodyCard();

  /* -------- ajustes -------- */
  const r = store.data.settings.reminder;
  const themePref = getThemePref();
  const bkDays = daysSince(store.data.settings.lastBackupAt);
  const bkTxt = bkDays === Infinity ? "nunca" : bkDays < 1 ? "hoje" : `há ${Math.floor(bkDays)} dia(s)`;
  const ajustesHtml = `
    ${blockHeader("Conta", true)}
    <button type="button" class="card conta-row" id="openPerfilFromAjustesBtn">
      <span class="conta-avatar">${avatarInnerHtml()}</span>
      <span class="conta-info">
        <span class="conta-name">${escapeHtml(userDisplayName())}</span>
        <span class="conta-username">@${escapeHtml(store.currentUser.username)}</span>
      </span>
      ${ICONS.right}
    </button>
    <div class="card conta-extra">
      ${
        pinSupported()
          ? `<button type="button" class="settings-row" id="pinRowBtn">
        <span class="sr-icon">${ICONS.lock}</span>
        <span class="sr-info">
          <span class="sr-title">PIN de acesso</span>
          <span class="sr-sub">${hasPin(store.currentUser.username) ? "Ativo — entre com 4 dígitos neste aparelho" : "Troque a senha por 4 dígitos neste aparelho"}</span>
        </span>
        <span class="sr-chevron">${ICONS.right}</span>
      </button>`
          : ""
      }
      <div class="idle-row">
        <label class="reminder-row">
          <span>Manter conectado por</span>
          <select class="idle-select" id="idleDaysSelect" aria-label="Dias sem abrir o app até pedir login">
            ${[...new Set([...SESSION_IDLE_OPTIONS, readIdleDays(store.currentUser.username)])]
              .sort((a, b) => a - b)
              .map((d) => `<option value="${d}" ${d === readIdleDays(store.currentUser.username) ? "selected" : ""}>${d} dias</option>`)
              .join("")}
          </select>
        </label>
        <div class="idle-hint">Você só precisa entrar de novo se ficar esse tempo sem abrir o app, ou ao tocar em Sair. Não pede login na virada do dia nem no meio de um treino.</div>
      </div>
    </div>

    ${blockHeader("Treino")}
    <div class="card">
      <label class="reminder-row">
        <span>Lembrete diário de treino</span>
        <span class="switch">
          <input type="checkbox" id="reminderToggle" ${r.enabled ? "checked" : ""} aria-label="Ativar lembrete diário">
          <span class="slider"></span>
        </span>
      </label>
      <div class="reminder-time-row${r.enabled ? "" : " hidden"}" id="reminderTimeRow">
        <span>Horário</span>
        <input type="time" id="reminderTime" value="${r.time}" aria-label="Horário do lembrete">
      </div>
      <div class="idle-hint" id="reminderHint">O lembrete só aparece com o app aberto: ele não toca com o app fechado.</div>
      <div class="reminder-row mt-14">
        <span>Duração do descanso padrão</span>
        <div class="step-group compact">
          <button class="step-btn" id="restMinus" aria-label="diminuir">−</button>
          <div class="step-value" id="restDurationVal">${store.data.settings.restDuration}s</div>
          <button class="step-btn" id="restPlus" aria-label="aumentar">+</button>
        </div>
      </div>
      <div class="reminder-row mt-14">
        <span>Semana começa na segunda</span>
        <span class="switch">
          <input type="checkbox" id="weekStartToggle" ${store.data.settings.weekStartsMonday ? "checked" : ""} aria-label="Semana começa na segunda">
          <span class="slider"></span>
        </span>
      </div>
      <div class="reminder-row mt-14">
        <div class="label-stack">
          <span>Meta semanal</span>
          <span class="label-sub">treinos por semana · padrão do ciclo: ${autoWeeklyGoal()}</span>
          <button type="button" class="footer-btn mini${store.data.settings.weeklyGoal == null ? " hidden" : ""}" id="weeklyGoalReset">Usar padrão</button>
        </div>
        <div class="step-group compact">
          <button class="step-btn" id="weeklyGoalMinus" aria-label="diminuir meta semanal">−</button>
          <div class="step-value" id="weeklyGoalVal">${currentWeeklyGoal()}</div>
          <button class="step-btn" id="weeklyGoalPlus" aria-label="aumentar meta semanal">+</button>
        </div>
      </div>
      <label class="reminder-row mt-14">
        <span>Som ao fim do descanso</span>
        <span class="switch">
          <input type="checkbox" id="beepToggle" ${store.data.settings.beepEnabled !== false ? "checked" : ""} aria-label="Tocar um beep quando o descanso acabar">
          <span class="slider"></span>
        </span>
      </label>
      <div class="idle-hint" id="restEndHint">O aviso de fim de descanso só aparece com o app aberto.</div>
      <div class="reminder-row mt-14">
        <span>Manter a tela ligada no treino</span>
        <span class="switch">
          <input type="checkbox" id="keepAwakeToggle" ${store.data.settings.keepAwake ? "checked" : ""} aria-label="Manter a tela ligada durante o treino">
          <span class="slider"></span>
        </span>
      </div>
    </div>

    ${blockHeader("Aparência")}
    <div class="card">
      <div class="reminder-row mb-14">
        <span>Tema</span>
      </div>
      <div class="theme-selector">
        <button class="theme-opt ${themePref === "light" ? "active" : ""}" data-role="settheme" data-theme="light">${ICONS.sunSmall} Claro</button>
        <button class="theme-opt ${themePref === "dark" ? "active" : ""}" data-role="settheme" data-theme="dark">${ICONS.moonSmall} Escuro</button>
        <button class="theme-opt ${themePref === "auto" ? "active" : ""}" data-role="settheme" data-theme="auto">${ICONS.autoSmall} Auto</button>
      </div>
      <div class="reminder-row mt-14">
        <span>Unidade de peso</span>
        <div class="theme-selector compact">
          <button class="theme-opt ${store.data.settings.unit === "kg" ? "active" : ""}" data-role="setunit" data-unit="kg">kg</button>
          <button class="theme-opt ${store.data.settings.unit === "lb" ? "active" : ""}" data-role="setunit" data-unit="lb">lb</button>
        </div>
      </div>
    </div>

    ${blockHeader("Dados e backup")}
    <button type="button" class="card conta-row" id="openDadosBackupBtn">
      <span class="conta-avatar neutral">${ICONS.download}</span>
      <span class="conta-info">
        <span class="conta-name">Dados e backup</span>
        <span class="conta-username">Último backup: ${bkTxt}</span>
      </span>
      ${ICONS.right}
    </button>

    ${blockHeader("Sobre o app")}
    <div class="card">
      <div class="reminder-row">
        <div class="label-stack">
          <span>Versão do aplicativo</span>
          <span id="appVersionText" class="label-sub">${APP_VERSION}</span>
        </div>
        <button class="footer-btn compact" id="checkUpdateBtn">
          <span id="checkUpdateIcon">${ICONS.refresh}</span>
          <span id="checkUpdateLabel">Atualizar</span>
        </button>
      </div>
      <div class="reminder-row mt-14">
        <span>Último backup exportado</span>
        <span class="status-pill">${bkTxt}</span>
      </div>
    </div>
    <div class="app-footer">William Dantas - ©2026</div>`;

  /* -------- dados e backup -------- */
  const backupCount = store.backupCount;
  const storageLabel = storageStatusText();
  const dadosBackupHtml = `<button type="button" class="back-link" id="dadosBackupBackBtn">${ICONS.left} Ajustes</button>
    <h1 class="tab-title mt-2">Dados e Backup</h1>

    <div class="backup-hero">
      <span class="bh-icon">${ICONS.cloudCheck}</span>
      <span class="bh-info">
        <span class="bh-title">Backup ativo</span>
        <span class="bh-sub">Proteção do aparelho: ${escapeHtml(storageLabel)}</span>
      </span>
    </div>

    ${storageUsageHtml()}

    <p class="settings-section">Lembrete de backup</p>
    <div class="card conta-extra">
      <div class="idle-row">
        <label class="reminder-row">
          <span>Sugerir backup</span>
          <select class="idle-select" id="backupEverySelect" aria-label="Frequência do lembrete de backup">
            ${BACKUP_EVERY_OPTIONS.map((n) => `<option value="${n}" ${n === normalizeBackupEvery(store.data.settings.backupEvery) ? "selected" : ""}>a cada ${n} treinos</option>`).join("")}
            <option value="0" ${normalizeBackupEvery(store.data.settings.backupEvery) === 0 ? "selected" : ""}>desligado</option>
          </select>
        </label>
        <div class="idle-hint">Ao finalizar um treino, o app sugere exportar um backup quando passar esse número de treinos ou de dias desde o último. Você pode adiar com “agora não”.</div>
      </div>
    </div>

    <p class="settings-section">Gerenciar dados</p>
    <div class="card list">
      <button type="button" class="settings-row" id="exportBtn">
        <span class="sr-icon">${ICONS.download}</span>
        <span class="sr-info">
          <span class="sr-title">Exportar meus dados</span>
          <span class="sr-sub">Baixar cópia dos seus treinos e histórico</span>
        </span>
        <span class="sr-chevron">${ICONS.right}</span>
      </button>
      <button type="button" class="settings-row" id="exportCsvBtn">
        <span class="sr-icon">${ICONS.download}</span>
        <span class="sr-info">
          <span class="sr-title">Exportar em CSV</span>
          <span class="sr-sub">Planilha com todas as séries registradas</span>
        </span>
        <span class="sr-chevron">${ICONS.right}</span>
      </button>
      <button type="button" class="settings-row" id="importBtn">
        <span class="sr-icon">${ICONS.upload}</span>
        <span class="sr-info">
          <span class="sr-title">Importar dados</span>
          <span class="sr-sub">Restaurar backup anterior</span>
        </span>
        <span class="sr-chevron">${ICONS.right}</span>
      </button>
      <button type="button" class="settings-row" id="openBackupsBtn">
        <span class="sr-icon">${ICONS.info}</span>
        <span class="sr-info">
          <span class="sr-title">Backups automáticos</span>
          <span class="sr-sub" id="autoBackupCountText">${backupCount} cópia(s) neste aparelho</span>
        </span>
        <span class="sr-chevron">${ICONS.right}</span>
      </button>
      <button type="button" class="settings-row" id="hardRefreshBtn">
        <span class="sr-icon">${ICONS.broom}</span>
        <span class="sr-info">
          <span class="sr-title">Limpar cache do app</span>
          <span class="sr-sub">Libera espaço — treinos e histórico não são apagados</span>
        </span>
        <span class="sr-chevron">${ICONS.right}</span>
      </button>
    </div>

    <input type="file" id="importFile" accept="application/json">`;

  /* -------- perfil -------- */
  const perfilHtml = `<div class="perfil-page">
    <div class="perfil-head">
      <button type="button" class="back-link perfil-back" id="perfilBackBtn">${ICONS.left} Voltar</button>
      <div class="perfil-avatar-wrap">
        <div class="perfil-avatar">${avatarInnerHtml()}</div>
        <button type="button" class="perfil-avatar-edit" id="perfilAvatarBtn" aria-label="Alterar foto">${ICONS.camera}</button>
        <input type="file" id="perfilAvatarInput" accept="image/*" hidden>
      </div>
      <div class="perfil-name-row">
        <span class="perfil-name ${store.perfilEditingName ? "hidden" : ""}" id="perfilNameText">${escapeHtml(userDisplayName())}</span>
        <input class="perfil-name-input ${store.perfilEditingName ? "" : "hidden"}" id="perfilNameInput" value="${escapeAttr(userDisplayName())}" maxlength="40" placeholder="Seu nome">
      </div>
      <div class="perfil-username">@${escapeHtml(store.currentUser.username)}</div>
      <div class="perfil-stats">
        <div class="perfil-stat"><span class="perfil-stat-num" data-count="${streak}">0</span><span class="perfil-stat-label">${streak === 1 ? "semana seguida" : "semanas seguidas"}</span></div>
        <div class="perfil-stat"><span class="perfil-stat-num" data-count="${thisWeek}">0</span><span class="perfil-stat-label">essa semana</span></div>
        <div class="perfil-stat"><span class="perfil-stat-num" data-count="${total}">0</span><span class="perfil-stat-label">no mês</span></div>
      </div>
    </div>
    <div class="card perfil-menu">
      <button type="button" class="perfil-menu-item" id="perfilAjustesBtn">${ICONS.user}<span>Meus dados</span>${ICONS.right}</button>
      <button type="button" class="perfil-menu-item" id="perfilNotifBtn">${ICONS.bell}<span>Notificações</span>${ICONS.right}</button>
      <button type="button" class="perfil-menu-item" id="perfilSuporteBtn">${ICONS.help}<span>Suporte</span>${ICONS.right}</button>
      <button type="button" class="perfil-menu-item danger" id="logoutBtn">${ICONS.logout}<span>Sair</span></button>
    </div>
  </div>`;
  const TAB_TITLES = {
    treinos: "Treinos",
    historico: "Histórico",
    progresso: "Progresso",
    ajustes: "Ajustes"
  };
  let content;
  if (store.perfilOpen) {
    content = perfilHtml;
  } else if (store.dadosBackupOpen) {
    content = dadosBackupHtml;
  } else if (store.activeTab === "treinos")
    content =
      store.treinosView === "edit"
        ? workoutsHtml
        : `<div class="tab-title-row"><h1 class="tab-title">${TAB_TITLES.treinos}</h1><button type="button" class="tab-title-add" id="addWorkoutBtn" aria-label="Novo treino">${ICONS.plus}</button></div>${workoutsHtml}`;
  else if (store.activeTab === "historico") content = `<h1 class="tab-title">${TAB_TITLES.historico}</h1>${historyHtml}`;
  else if (store.activeTab === "progresso") content = `<h1 class="tab-title">${TAB_TITLES.progresso}</h1>${progressHtml}`;
  else if (store.activeTab === "ajustes") content = `<h1 class="tab-title">${TAB_TITLES.ajustes}</h1>${ajustesHtml}`;
  else {
    store.activeTab = "inicio";
    content = homeHtml;
  }
  app.innerHTML = `<div class="tab-panel" id="tabPanel">${content}</div>`;
  attachHandlers();
  runCountUp();
  renderOverlay();
  renderRestTimer();
  renderHeroClock();
  startHeroClockTicker();
  syncWakeLock();
  renderTabBar();
  if (store.dadosBackupOpen && !store.perfilOpen) refreshStorageUsage();
}
