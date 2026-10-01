import { readAutoBackups } from "../backup/auto-backup.js";
import { storageStatusText } from "../backup/storage-status.js";
import { REST_COLOR } from "../config.js";
import { APP_VERSION, MONTH_NAMES_FULL, WEEKDAY_FULL } from "../data/constants.js";
import { ICONS } from "../data/icons.js";
import { attachHandlers } from "../event-handlers.js";
import { exThumbHtml } from "../exercises/exercise-visuals.js";
import { daysSince, exerciseHistory } from "../exercises/exercises.js";
import { heroMuscleSvg } from "../icons-svg.js";
import { store } from "../store.js";
import { getThemePref } from "../theme.js";
import { avatarInnerHtml, blockHeader, colorFor, userDisplayName } from "../ui/helpers.js";
import { escapeAttr, escapeHtml } from "../utils/dom.js";
import { dateKeyFromDate, fmtDuration, fmtDurationShort, todayKey } from "../utils/format.js";
import { isCardio } from "../utils/numbers.js";
import { renderHeroClock, runCountUp, startHeroClockTicker, syncWakeLock } from "../workouts/active-session.js";
import { computeStreak, isRestLetter, sessionsFor, sessionsThisMonth, sessionsThisWeek, totalDays, totalDurationForDay } from "../workouts/sessions.js";
import { categoryForWorkout, estimateWorkoutMs, nextWorkoutLetter, workoutLabel } from "../workouts/workouts.js";
import { renderBodyCard } from "./body-view.js";
import { buildMonthCalendar } from "./calendar.js";
import { renderLogin } from "./login-view.js";
import { isLinkedNext } from "./overlays/day-overlay.js";
import { renderOverlay } from "./overlays/overlay-manager.js";
import { renderRestTimer } from "./overlays/rest-timer.js";
import { renderRecordsCard, renderStatsCard } from "./stats-view.js";
import { renderTabBar } from "./tabbar-view.js";

/* ============================================================
   RENDER PRINCIPAL
   ============================================================ */
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
  const streak = computeStreak();
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
  const backupDays = daysSince(store.data.settings.lastBackupAt);
  const backupDue = totalDays() > 0 && backupDays >= 14;
  if (backupDue) {
    const daysTxt = backupDays === Infinity ? "Você ainda não exportou um backup" : `Já fazem ${Math.floor(backupDays)} dias sem backup`;
    banners += `<div class="banner info"><span>${daysTxt}.</span><button id="backupNowBtn">exportar</button></div>`;
  }
  const bannersHtml = banners ? `<div class="banners">${banners}</div>` : "";
  const todayDuration = totalDurationForDay(todayKey());
  const todayIsRest = todayCount > 0 && isRestLetter(todayArr[todayArr.length - 1].letter);
  let eyebrowText = "Próximo treino";
  if (isRunning) eyebrowText = "Treinando agora";else if (isPaused) eyebrowText = "Pausado";else if (todayIsRest) eyebrowText = "Descanso";else if (todayCount === 1) eyebrowText = "Treino de hoje";else if (todayCount > 1) eyebrowText = todayCount + " treinos hoje";
  const heroSub = todayCount > 0 ? todayDuration ? `concluído em ${fmtDuration(todayDuration)}` : "concluído hoje" : store.data.workouts[heroKey]?.isRest ? "dia de recuperação" : hasActive ? "toque em Detalhes para registrar" : "pronto para começar?";
  let heroActionsHtml;
  if (!hasActive) {
    heroActionsHtml = `<div class="hero-v2-actions">
      <button type="button" class="hero-v2-btn primary" id="startBtn">${ICONS.playSm} Iniciar</button>
      <button type="button" class="hero-v2-btn ghost" id="statusBtn">${ICONS.calendarSmall} Detalhes</button>
    </div>`;
  } else if (isRunning) {
    heroActionsHtml = `<div class="hero-v2-actions">
      <button type="button" class="hero-v2-btn primary" id="stopBtn">${ICONS.pause} Pausar</button>
      <button type="button" class="hero-v2-btn ghost" id="endBtn">Finalizar</button>
    </div>
    <button type="button" class="hero-v2-link" id="statusBtn">Ver detalhes do treino</button>`;
  } else {
    heroActionsHtml = `<div class="hero-v2-actions">
      <button type="button" class="hero-v2-btn primary" id="startBtn">${ICONS.playSm} Retomar</button>
      <button type="button" class="hero-v2-btn ghost" id="endBtn">Finalizar</button>
    </div>
    <button type="button" class="hero-v2-link" id="statusBtn">Ver detalhes do treino</button>`;
  }
  const heroSecondaryRowHtml = !hasActive && todayCount > 0 ? `<div class="hero-v2-secondary-row">
         <button type="button" class="hero-v2-chip" id="editTodayBtn">${ICONS.pencil} Editar</button>
         <button type="button" class="hero-v2-chip undo" id="undoTodayBtn">${ICONS.trash} Desfazer</button>
         <button type="button" class="hero-v2-chip" id="addSecondBtn">${ICONS.plus} Novo</button>
       </div>` : "";
  const heroHtml = `<div class="card hero-card-v2" id="heroCard">
    <div class="hero-muscle">${heroMuscleSvg()}</div>
    <div class="hero-v2-top">
      <span class="hero-v2-badge">${eyebrowText}</span>
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
    <div class="stat-card-v3 streak">
      <span class="stat-mini">${ICONS.flame}</span>
      <span class="stat-num" data-count="${streak}">0</span>
      <span class="stat-label">dias seguidos</span>
    </div>
    <div class="stat-card-v3 week">
      <span class="stat-mini">${ICONS.calendarSmall}</span>
      <span class="stat-num" data-count="${thisWeek}">0</span>
      <span class="stat-label">essa semana</span>
    </div>
    <div class="stat-card-v3 month">
      <span class="stat-mini">${ICONS.chart}</span>
      <span class="stat-num" data-count="${total}">0</span>
      <span class="stat-label">no mês</span>
    </div>
  </div>`;
  const hour = now.getHours();
  const greetWord = hour < 5 ? "Boa madrugada," : hour < 12 ? "Bom dia," : hour < 18 ? "Boa tarde," : "Boa noite,";
  const dateLabel = `${weekdayLabel}, ${now.getDate()} de ${MONTH_NAMES_FULL[now.getMonth()]}`;
  const firstName = (userDisplayName() || "Treinador").split(" ")[0];
  const greetHtml = `<div class="greet-row">
    <div>
      <div class="greet-hello">${greetWord} <span class="accent">${escapeHtml(firstName)}</span></div>
      <div class="greet-date">${dateLabel}</div>
    </div>
    <div class="greet-actions">
      <button type="button" class="greet-bell" id="greetBellBtn" aria-label="Lembretes">${ICONS.bell}</button>
      <button type="button" class="greet-avatar" id="openPerfilBtn" aria-label="Abrir perfil">${avatarInnerHtml()}</button>
    </div>
  </div>`;
  const weekDayShort = ["D", "S", "T", "Q", "Q", "S", "S"];
  const wOffset = store.data.settings.weekStartsMonday ? now.getDay() === 0 ? 6 : now.getDay() - 1 : now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - wOffset);
  weekStart.setHours(0, 0, 0, 0);
  let weekDotsHtml = `<div class="card week-dots-card">
    <p class="section-title" style="margin:0 0 10px;">Essa semana</p>
    <div class="week-dots">`;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dk = dateKeyFromDate(d);
    const dArr = sessionsFor(dk);
    const done = dArr.some(s => !isRestLetter(s.letter));
    const restOnly = !done && dArr.length > 0 && dArr.every(s => isRestLetter(s.letter));
    const isToday = dk === todayKey();
    const idx = store.data.settings.weekStartsMonday ? (i + 1) % 7 : i;
    weekDotsHtml += `<div class="week-dot-col">
      <span class="week-dot-label">${weekDayShort[idx]}</span>
      <span class="week-dot ${done ? "done" : ""} ${restOnly ? "rest" : ""} ${isToday ? "today" : ""}">${done ? ICONS.checkSm : restOnly ? ICONS.moonSmall : ""}</span>
    </div>`;
  }
  weekDotsHtml += `</div></div>`;
  const homeHtml = `${greetHtml}${bannersHtml}${heroHtml}${statsRowHtml}${weekDotsHtml}`;

  /* -------- workout edit card -------- */
  function renderWorkoutEditCard(key) {
    const w = store.data.workouts[key];
    if (!w) return "";
    const color = colorFor(key, store.data.order);
    return `<div class="card workout-card" data-letter="${key}">
      <div class="workout-head">
        <div class="workout-chip" style="background:${color}">${w.isRest ? ICONS.moonSmall : key}</div>
        <input class="workout-title-input" data-role="wname" data-letter="${key}" value="${escapeAttr(w.name)}" placeholder="${w.isRest ? "Nome do descanso" : "Nome do treino"}" aria-label="Nome de ${w.isRest ? "descanso" : "treino " + key}">
        <span class="edit-pencil">${ICONS.pencil}</span>
        ${w.isRest ? "" : `<button class="icon-btn" data-role="dupworkout" data-letter="${key}" aria-label="duplicar treino ${key}">${ICONS.copy}</button>`}
        ${store.data.order.length > 1 ? `<button class="icon-btn" data-role="delworkout" data-letter="${key}" aria-label="remover ${w.isRest ? "descanso" : "treino " + key}">${ICONS.close}</button>` : ""}
      </div>
      ${w.isRest ? `<div class="rest-note">Dia de descanso — sem exercícios para registrar.</div>` : `
      ${w.exercises.length > 0 ? w.exercises.map((ex, exIdx) => {
      const cardio = isCardio(ex);
      const hasHist = exerciseHistory(ex.id).length > 0;
      return `
        <div class="exercise-row${isLinkedNext(w, exIdx) || exIdx > 0 && isLinkedNext(w, exIdx - 1) ? " linked" : ""}" data-exid="${ex.id}">
          <div class="ex-row-top">
            <button type="button" class="ex-name-input ex-name-btn" data-role="openexname" data-letter="${key}" data-exid="${ex.id}" aria-label="Escolher nome do exercício">
              ${exThumbHtml(ex, "sm")}
              <span class="ex-name-text ${ex.name ? "" : "placeholder"}">${ex.name ? escapeHtml(ex.name) : cardio ? "Escolher exercício (Esteira, Bike...)" : "Escolher exercício"}</span>
              ${ICONS.pencil}
            </button>
            <button class="progress-btn" data-role="viewprogress" data-exid="${ex.id}" data-name="${escapeAttr(ex.name || "Exercício")}" ${hasHist ? "" : "disabled"} aria-label="Ver progresso">${ICONS.chart}</button>
            <button class="ex-del" data-role="delex" data-letter="${key}" data-exid="${ex.id}" aria-label="remover exercício">${ICONS.close}</button>
          </div>
          <div class="ex-type-toggle">
            <button class="ex-type-btn ${cardio ? "" : "active"}" data-role="extype" data-letter="${key}" data-exid="${ex.id}" data-type="strength">${ICONS.dumbbell} Força</button>
            <button class="ex-type-btn ${cardio ? "active" : ""}" data-role="extype" data-letter="${key}" data-exid="${ex.id}" data-type="cardio">${ICONS.cardio} Cardio</button>
          </div>
          <div class="ex-tools">
            <button class="tool-btn icon" data-role="exmove" data-dir="-1" data-letter="${key}" data-exid="${ex.id}" ${exIdx === 0 ? "disabled" : ""} aria-label="mover exercício para cima">${ICONS.up}</button>
            <button class="tool-btn icon" data-role="exmove" data-dir="1" data-letter="${key}" data-exid="${ex.id}" ${exIdx === w.exercises.length - 1 ? "disabled" : ""} aria-label="mover exercício para baixo">${ICONS.down}</button>
            ${exIdx < w.exercises.length - 1 ? `<button class="tool-btn ${ex.ss ? "active" : ""}" data-role="exss" data-letter="${key}" data-exid="${ex.id}" aria-pressed="${!!ex.ss}">Superset com o próximo</button>` : ""}
            <button class="tool-btn ${ex.link ? "active" : ""}" data-role="exlink" data-letter="${key}" data-exid="${ex.id}" aria-label="link de vídeo ou técnica">${ICONS.link} Link</button>
          </div>
          ${cardio ? `
            <div class="ex-row-bottom">
              <label class="ex-field"><span>minutos</span><input data-role="exmins" data-letter="${key}" data-exid="${ex.id}" value="${escapeAttr(ex.mins || "")}" placeholder="30" inputmode="numeric" aria-label="Minutos"></label>
            </div>
          ` : `
            <div class="ex-row-bottom">
              <label class="ex-field"><span>séries</span><input data-role="exsets" data-letter="${key}" data-exid="${ex.id}" value="${escapeAttr(ex.sets)}" placeholder="4" inputmode="numeric" aria-label="Séries"></label>
              <label class="ex-field"><span>reps</span><input data-role="exreps" data-letter="${key}" data-exid="${ex.id}" value="${escapeAttr(ex.reps)}" placeholder="12" inputmode="numeric" aria-label="Repetições"></label>
              <label class="ex-field"><span>descanso (s)</span><input data-role="exrest" data-letter="${key}" data-exid="${ex.id}" value="${escapeAttr(ex.rest || "")}" placeholder="90" inputmode="numeric" aria-label="Descanso em segundos"></label>
            </div>
          `}
        </div>`;
    }).join("") : `<div class="empty-state">
          <div class="empty-icon">${ICONS.dumbbell}</div>
          <p class="empty-title">Nenhum exercício ainda</p>
          <p class="empty-sub">Toque em "Adicionar exercício" para começar a montar este treino.</p>
        </div>`}
      <button class="add-exercise-btn" data-role="addex" data-letter="${key}">${ICONS.plus} Adicionar exercício</button>
      `}
    </div>`;
  }
  let workoutsHtml = "";
  if (store.treinosView === "edit" && store.treinosEditKey && store.data.workouts[store.treinosEditKey]) {
    workoutsHtml = `<button type="button" class="back-link" id="treinosBackBtn">${ICONS.left} Treinos</button>` + renderWorkoutEditCard(store.treinosEditKey);
  } else {
    store.treinosView = "list";
    const cats = [];
    store.data.order.forEach(k => {
      const c = categoryForWorkout(store.data.workouts[k]);
      if (!cats.includes(c)) cats.push(c);
    });
    if (!cats.includes(store.treinosFilter)) store.treinosFilter = "all";
    const filterChipsHtml = cats.length > 1 ? `<div class="wf-chips">
      <button type="button" class="wf-chip ${store.treinosFilter === "all" ? "active" : ""}" data-role="wfilter" data-cat="all">Todos</button>
      ${cats.map(c => `<button type="button" class="wf-chip ${store.treinosFilter === c ? "active" : ""}" data-role="wfilter" data-cat="${escapeAttr(c)}">${escapeHtml(c)}</button>`).join("")}
    </div>` : "";
    const lastDoneLetter = todayArr.length ? todayArr[todayArr.length - 1].letter : null;
    workoutsHtml = filterChipsHtml;
    store.data.order.forEach((key, idx) => {
      const w = store.data.workouts[key];
      const cat = categoryForWorkout(w);
      if (store.treinosFilter !== "all" && cat !== store.treinosFilter) return;
      const color = colorFor(key, store.data.order);
      const estMs = estimateWorkoutMs(w);
      const metaTxt = w.isRest ? "Dia de descanso" : `${estMs ? fmtDuration(estMs) + " · " : ""}${w.exercises.length} exercício${w.exercises.length === 1 ? "" : "s"}`;
      const doneToday = key === lastDoneLetter;
      workoutsHtml += `<div class="workout-list-card" data-role="openworkout" data-letter="${key}" role="button" tabindex="0">
        <span class="wl-icon" style="background:${color}22;color:${color}">${w.isRest ? ICONS.moonSmall : ICONS.dumbbell}</span>
        <span class="wl-info">
          <span class="wl-name">${escapeHtml(w.name)}</span>
          <span class="wl-meta">${metaTxt}</span>
        </span>
        ${store.data.order.length > 1 ? `<span class="wl-reorder">
          <button type="button" class="reorder-btn" data-role="moveup" data-letter="${key}" ${idx === 0 ? "disabled" : ""} aria-label="mover para cima">${ICONS.up}</button>
          <button type="button" class="reorder-btn" data-role="movedown" data-letter="${key}" ${idx === store.data.order.length - 1 ? "disabled" : ""} aria-label="mover para baixo">${ICONS.down}</button>
        </span>` : ""}
        ${doneToday ? `<span class="wl-check">${ICONS.checkSm}</span>` : `<span class="wl-arrow">${ICONS.right}</span>`}
      </div>`;
    });
    workoutsHtml += `<div class="row-2">
      <button class="add-workout-btn primary" id="addWorkoutBtn">${ICONS.plus} Novo treino</button>
      <button class="add-workout-btn" id="addRestBtn">${ICONS.moonSmall} Descanso</button>
    </div>`;
  }

  /* -------- histórico -------- */
  const legendWorkouts = store.data.order.filter(k => !store.data.workouts[k]?.isRest);
  const hasRest = store.data.order.some(k => store.data.workouts[k]?.isRest);
  let historyHtml = `<div class="card">
    <div class="legend">
      ${legendWorkouts.map(l => `<div class="legend-item"><span class="legend-dot" style="background:${colorFor(l, store.data.order)}"></span>${l}</div>`).join("")}
      ${hasRest ? `<div class="legend-item"><span class="legend-dot" style="background:${REST_COLOR}"></span>descanso</div>` : ""}
      <div class="legend-item"><span class="legend-dot" style="background:var(--dot-off)"></span>não treinou</div>
    </div>
    ${buildMonthCalendar(store.historyMonth)}
  </div>`;
  const monthKeys = Object.keys(store.data.sessions).filter(k => {
    const [ky, km] = k.split("-").map(Number);
    return ky === store.historyMonth.getFullYear() && km === store.historyMonth.getMonth() + 1;
  }).sort().reverse();
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
    monthKeys.forEach(dk => {
      monthTrainings += sessionsFor(dk).filter(s => !isRestLetter(s.letter)).length;
      monthMs += totalDurationForDay(dk) || 0;
    });
    const summaryBits = [`${monthKeys.length} dia${monthKeys.length === 1 ? "" : "s"}`, `${monthTrainings} treino${monthTrainings === 1 ? "" : "s"}`];
    if (monthMs) summaryBits.push(fmtDurationShort(monthMs));
    historyHtml += `<div class="month-sessions-summary">${summaryBits.join(" · ")}</div>
    <div class="card month-sessions-card compact">${shownKeys.map(dk => {
      const arr = sessionsFor(dk);
      const [, m, d] = dk.split("-").map(Number);
      const dur = totalDurationForDay(dk);
      return `<button type="button" class="month-session-row" data-role="openhistoryday" data-datekey="${dk}">
        <span class="ms-date">${d}/${m}</span>
        <span class="ms-letters">${arr.map(s => {
        const isRest = isRestLetter(s.letter);
        const bg = s.letter && store.data.workouts[s.letter] && !isRest ? colorFor(s.letter, store.data.order) : REST_COLOR;
        return `<span class="ms-chip" style="background:${bg}">${isRest ? ICONS.moonSmall : s.letter || "?"}</span>`;
      }).join("")}</span>
        ${dur ? `<span class="ms-duration">${fmtDurationShort(dur)}</span>` : ""}
        <span class="ms-arrow">${ICONS.right}</span>
      </button>`;
    }).join("")}${canCollapse ? `<button type="button" class="month-sessions-toggle" id="monthSessionsToggle">${expanded ? "Mostrar menos" : `Ver todas (${monthKeys.length} dias)`}</button>` : ""}</div>`;
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

    ${blockHeader("Treino")}
    <div class="card">
      <label class="reminder-row">
        <span>Lembrete diário de treino</span>
        <span class="switch">
          <input type="checkbox" id="reminderToggle" ${r.enabled ? "checked" : ""} aria-label="Ativar lembrete diário">
          <span class="slider"></span>
        </span>
      </label>
      <div class="reminder-time-row" id="reminderTimeRow" style="${r.enabled ? "" : "display:none;"}">
        <span>Horário</span>
        <input type="time" id="reminderTime" value="${r.time}" aria-label="Horário do lembrete">
      </div>
      <div class="reminder-row" style="margin-top:14px;">
        <span>Duração do descanso padrão</span>
        <div class="step-group" style="max-width:140px;">
          <button class="step-btn" id="restMinus" aria-label="diminuir">−</button>
          <div class="step-value" id="restDurationVal">${store.data.settings.restDuration}s</div>
          <button class="step-btn" id="restPlus" aria-label="aumentar">+</button>
        </div>
      </div>
      <div class="reminder-row" style="margin-top:14px;">
        <span>Semana começa na segunda</span>
        <span class="switch">
          <input type="checkbox" id="weekStartToggle" ${store.data.settings.weekStartsMonday ? "checked" : ""} aria-label="Semana começa na segunda">
          <span class="slider"></span>
        </span>
      </div>
      <div class="reminder-row" style="margin-top:14px;">
        <span>Manter a tela ligada no treino</span>
        <span class="switch">
          <input type="checkbox" id="keepAwakeToggle" ${store.data.settings.keepAwake ? "checked" : ""} aria-label="Manter a tela ligada durante o treino">
          <span class="slider"></span>
        </span>
      </div>
    </div>

    ${blockHeader("Aparência")}
    <div class="card">
      <div class="reminder-row" style="margin-bottom:14px;">
        <span>Tema</span>
      </div>
      <div class="theme-selector">
        <button class="theme-opt ${themePref === "light" ? "active" : ""}" data-role="settheme" data-theme="light">${ICONS.sunSmall} Claro</button>
        <button class="theme-opt ${themePref === "dark" ? "active" : ""}" data-role="settheme" data-theme="dark">${ICONS.moonSmall} Escuro</button>
        <button class="theme-opt ${themePref === "auto" ? "active" : ""}" data-role="settheme" data-theme="auto">${ICONS.autoSmall} Auto</button>
      </div>
      <div class="reminder-row" style="margin-top:14px;">
        <span>Unidade de peso</span>
        <div class="theme-selector" style="max-width:150px;">
          <button class="theme-opt ${store.data.settings.unit === "kg" ? "active" : ""}" data-role="setunit" data-unit="kg">kg</button>
          <button class="theme-opt ${store.data.settings.unit === "lb" ? "active" : ""}" data-role="setunit" data-unit="lb">lb</button>
        </div>
      </div>
    </div>

    ${blockHeader("Dados e backup")}
    <button type="button" class="card conta-row" id="openDadosBackupBtn">
      <span class="conta-avatar" style="background:var(--surface-3);color:var(--text-primary);">${ICONS.download}</span>
      <span class="conta-info">
        <span class="conta-name">Dados e backup</span>
        <span class="conta-username">Último backup: ${bkTxt}</span>
      </span>
      ${ICONS.right}
    </button>

    ${blockHeader("Sobre o app")}
    <div class="card">
      <div class="reminder-row">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <span>Versão do aplicativo</span>
          <span id="appVersionText" style="font-size:11px;color:var(--text-muted);">${APP_VERSION}</span>
        </div>
        <button class="footer-btn" id="checkUpdateBtn" style="flex:none;padding:9px 14px;">
          <span id="checkUpdateIcon">${ICONS.refresh}</span>
          <span id="checkUpdateLabel">Atualizar</span>
        </button>
      </div>
      <div class="reminder-row" style="margin-top:14px;">
        <span>Último backup exportado</span>
        <span class="status-pill">${bkTxt}</span>
      </div>
    </div>
    <div class="app-footer">William Dantas - ©2026</div>`;

  /* -------- dados e backup -------- */
  const backupCount = readAutoBackups().length;
  const storageLabel = storageStatusText();
  const dadosBackupHtml = `<button type="button" class="back-link" id="dadosBackupBackBtn">${ICONS.left} Ajustes</button>
    <h1 class="tab-title" style="margin-top:2px;">Dados e Backup</h1>

    <div class="backup-hero">
      <span class="bh-icon">${ICONS.cloudCheck}</span>
      <span class="bh-info">
        <span class="bh-title">Backup ativo</span>
        <span class="bh-sub">Proteção do aparelho: ${escapeHtml(storageLabel)}</span>
      </span>
    </div>

    <p class="settings-section">Gerenciar dados</p>
    <div class="card" style="padding:0 var(--s4);">
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
          <span class="sr-sub">${backupCount} cópia(s) neste aparelho</span>
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
        <div class="perfil-stat"><span class="perfil-stat-num" data-count="${streak}">0</span><span class="perfil-stat-label">dias seguidos</span></div>
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
  } else if (store.activeTab === "treinos") content = store.treinosView === "edit" ? workoutsHtml : `<h1 class="tab-title">${TAB_TITLES.treinos}</h1>${workoutsHtml}`;else if (store.activeTab === "historico") content = `<h1 class="tab-title">${TAB_TITLES.historico}</h1>${historyHtml}`;else if (store.activeTab === "progresso") content = `<h1 class="tab-title">${TAB_TITLES.progresso}</h1>${progressHtml}`;else if (store.activeTab === "ajustes") content = `<h1 class="tab-title">${TAB_TITLES.ajustes}</h1>${ajustesHtml}`;else {
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
}
