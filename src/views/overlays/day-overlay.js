import { confetti } from "../../ui/confetti.js";
import { SET_TYPE_LABEL, SET_TYPE_NAME } from "../../config.js";
import { MONTH_NAMES_FULL, SET_TYPES, WEEKDAY_FULL } from "../../data/constants.js";
import { ICONS } from "../../data/icons.js";
import { exThumbHtml } from "../../exercises/exercise-visuals.js";
import { findExercise, lastLoggedValue, restForExercise } from "../../exercises/exercises.js";
import { persist } from "../../persistence.js";
import { checkPR, exercisePRs, suggestNext } from "../../stats/prs.js";
import { store } from "../../store.js";
import { colorFor } from "../../ui/helpers.js";
import { showToast } from "../../ui/toast.js";
import { escapeAttr, escapeHtml, haptic, safeUrl } from "../../utils/dom.js";
import { fmtClock, fmtDuration, fmtW, fromDisp, toDisp, todayKey, unit, weightStep } from "../../utils/format.js";
import { newSessionId } from "../../utils/ids.js";
import { isCardio, isWork, parseNum, roundToStep } from "../../utils/numbers.js";
import { activeElapsedMs, syncWakeLock } from "../../workouts/active-session.js";
import { computeSessionIntensity, sessionDurationMs, sessionHasData, sessionsFor, snapshotExercise, stampSnapshot } from "../../workouts/sessions.js";
import { workoutLabel } from "../../workouts/workouts.js";
import { render } from "../render.js";
import { closeOverlay, renderOverlay } from "./overlay-manager.js";
import { startRestTimer } from "./rest-timer.js";

export function ensureSetsForExercise(log, exId, defaultSets) {
  if (!Array.isArray(log[exId])) {
    const n = Math.max(1, parseInt(defaultSets, 10) || 1);
    log[exId] = Array.from({
      length: n
    }, () => ({
      weight: null,
      reps: null,
      done: false
    }));
  }
  return log[exId];
}

export function ensureCardioSets(log, exId) {
  if (!Array.isArray(log[exId]) || log[exId].length === 0) {
    log[exId] = [{
      minutes: null,
      done: false
    }];
  }
  log[exId].forEach(s => {
    if (!("minutes" in s)) s.minutes = null;
    if (!("done" in s)) s.done = false;
  });
  return log[exId];
}

/* Lista de exercícios exibida na folha do dia.
   - Sessão em andamento / nova: usa o treino atual (pode ter séries novas).
   - Sessão já registrada (finalizada ou de dia anterior): mostra SÓ o que foi
     registrado, com a quantidade de séries salva — mudar o treino depois
     (séries, exercícios apagados/adicionados) não altera o histórico. */
export function sessionExerciseList(w, log, sess, dateKey) {
  const template = w && w.exercises || [];
  const frozen = !!(sess && sessionHasData(sess.log) && (sess.endedAt || dateKey < todayKey()));
  if (!frozen) return {
    list: template,
    frozen: false
  };
  const base = Array.isArray(sess.snapshot) && sess.snapshot.length ? sess.snapshot : template;
  const seen = new Set();
  const list = [];
  base.forEach(ex => {
    if (Array.isArray(log[ex.id]) && log[ex.id].length && !seen.has(ex.id)) {
      seen.add(ex.id);
      list.push(ex);
    }
  });
  Object.keys(log).forEach(id => {
    if (seen.has(id) || !Array.isArray(log[id]) || !log[id].length) return;
    const fromTemplate = template.find(e => e.id === id);
    const isCardioLog = log[id].some(s => s && s.minutes != null);
    list.push(fromTemplate || {
      id,
      name: "Exercício removido",
      type: isCardioLog ? "cardio" : "strength"
    });
  });
  return {
    list,
    frozen: true
  };
}

export function isLinkedNext(w, idx) {
  const ex = w.exercises[idx];
  return !!(ex && ex.ss && idx < w.exercises.length - 1);
}

export function ensureMeta(exId) {
  store.overlay.meta = store.overlay.meta || {};
  store.overlay.meta[exId] = store.overlay.meta[exId] || {};
  return store.overlay.meta[exId];
}

export function cleanMeta(meta) {
  const out = {};
  Object.keys(meta || {}).forEach(id => {
    const m = meta[id] || {};
    const note = (m.note || "").trim();
    const rpe = m.rpe != null && !isNaN(m.rpe) ? m.rpe : null;
    if (note || rpe != null) {
      out[id] = {};
      if (rpe != null) out[id].rpe = rpe;
      if (note) out[id].note = note;
    }
  });
  return out;
}

export function scheduleAutoSave() {
  clearTimeout(store.autoSaveTimer);
  store.autoSaveTimer = setTimeout(() => {
    store.autoSaveTimer = null;
    autoSaveOverlay();
  }, 350);
}

export function flushAutoSave() {
  if (store.autoSaveTimer) {
    clearTimeout(store.autoSaveTimer);
    store.autoSaveTimer = null;
    autoSaveOverlay();
  }
}

export function setDefaults(ex, dateKey) {
  const last = lastLoggedValue(ex.id, dateKey);
  if (isCardio(ex)) {
    const dm = parseInt(ex.mins, 10) || null;
    return {
      minutes: dm != null ? dm : last && last.minutes != null ? last.minutes : 20
    };
  }
  const dr = parseInt(ex.reps, 10) || null;
  return {
    weight: last && last.weight != null ? last.weight : 0,
    reps: dr != null ? dr : last && last.reps != null ? last.reps : 10
  };
}

export function commitSetDefaults(ex, set, dateKey) {
  if (!ex) return;
  const d = setDefaults(ex, dateKey);
  if (isCardio(ex)) {
    if (set.minutes == null) set.minutes = d.minutes;
  } else {
    if (set.weight == null) set.weight = d.weight;
    if (set.reps == null) set.reps = d.reps;
  }
}

export function setNumHtml(s, i) {
  const t = SET_TYPES.includes(s.type) ? s.type : "normal";
  return (t === "normal" ? String(i + 1) : SET_TYPE_LABEL[t]) + (s.pr ? `<span class="set-pr">${ICONS.trophy}</span>` : "");
}

export function refreshSetInputs(root, exid, setidx) {
  const set = store.overlay.log[exid] && store.overlay.log[exid][setidx];
  if (!set) return;
  const q = f => root.querySelector(`[data-field="${f}"][data-exid="${exid}"][data-setidx="${setidx}"]`);
  const w = q("weight");
  if (w && set.weight != null) w.value = fmtW(set.weight);
  const r = q("reps");
  if (r && set.reps != null) r.value = String(set.reps);
  const m = q("minutes");
  if (m && set.minutes != null) m.textContent = set.minutes;
}


// Modo foco: só o exercício atual fica aberto; os outros mostram o progresso (ex.: 2/4).
function applyFocus(root, focusId) {
  const rows = [...root.querySelectorAll(".sheet-ex-row")];
  if (rows.length < 2 || !root.querySelector(".sheet-set")) return;
  const isDone = r => { const s = [...r.querySelectorAll(".sheet-set")]; return s.length > 0 && s.every(x => x.classList.contains("done")); };
  const cur = (focusId && rows.find(r => r.dataset.exid === focusId)) || rows.find(r => !isDone(r)) || rows[rows.length - 1];
  rows.forEach(r => {
    r.classList.toggle("is-collapsed", r !== cur);
    const n = r.querySelector(".sheet-ex-name");
    if (n) n.dataset.progress = r.querySelectorAll(".sheet-set.done").length + "/" + r.querySelectorAll(".sheet-set").length;
  });
}

export function renderDayOverlay(root) {
  const {
    dateKey,
    letter,
    log,
    startedAt,
    mode
  } = store.overlay;
  const [y, m, dd] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  const isToday = dateKey === todayKey();
  const dateLabel = `${WEEKDAY_FULL[d.getDay()]}, ${dd} de ${MONTH_NAMES_FULL[m - 1]}`;
  const w = store.data.workouts[letter] || {
    exercises: []
  };
  const a = store.data.activeSession;
  const hasActiveHere = (a.state === "running" || a.state === "paused") && dateKey === todayKey() && a.letter === letter;
  const elapsed = hasActiveHere ? Math.floor(activeElapsedMs() / 1000) : Math.floor((Date.now() - startedAt) / 1000);
  const sessObj = store.overlay.sessionId ? sessionsFor(dateKey).find(s => s.id === store.overlay.sessionId) : null;
  const shown = sessionExerciseList(w, log, sessObj && sessObj.letter === letter ? sessObj : null, dateKey);
  const dayEx = shown.list;
  store.overlay.frozen = shown.frozen;
  const wv = {
    ...w,
    exercises: dayEx
  };
  const hasExercises = !w.isRest && dayEx.length > 0;
  const exercisesHtml = w.isRest ? `<div class="sheet-empty">Dia de descanso — nada para registrar.</div>` : dayEx.length ? `<div class="sheet-exercises">${dayEx.map((ex, i) => {
    const linked = isLinkedNext(wv, i) || i > 0 && isLinkedNext(wv, i - 1);
    if (isCardio(ex)) return renderCardioRow(ex, log, dateKey, linked);
    return renderStrengthRow(ex, log, dateKey, linked);
  }).join("")}</div>` : `<div class="empty-state">
            <div class="empty-icon">${ICONS.dumbbell}</div>
            <p class="empty-title">Treino sem exercícios</p>
            <p class="empty-sub">Adicione exercícios na aba "Treinos" antes de registrar.</p>
          </div>`;
  let durationLabel = "—";
  if (hasActiveHere) durationLabel = fmtClock(elapsed);else if (store.overlay.sessionId) {
    const sess = sessionsFor(dateKey).find(s => s.id === store.overlay.sessionId);
    const ms = sess ? sessionDurationMs(sess) : null;
    if (ms) durationLabel = fmtDuration(ms);
  }
  const intensity = computeSessionIntensity(wv, log);
  const color = colorFor(letter, store.data.order);
  const sessionHeadHtml = `<div class="sheet-session-head">
    <div class="ssh-top">
      <span class="ssh-badge" style="background:${color}">${w.isRest ? ICONS.moonSmall : letter}</span>
      <div class="ssh-titles">
        <div class="ssh-name">${escapeHtml(w.name || workoutLabel(letter))}</div>
        <div class="ssh-date">${isToday ? "Hoje" : escapeHtml(dateLabel)}${hasActiveHere ? ` · <span class="ssh-live">em andamento</span>` : ""}</div>
      </div>
      <button class="icon-btn" id="sheetClose" aria-label="fechar">${ICONS.close}</button>
    </div>
    ${hasExercises ? `<div class="ssh-stats">
      <div class="ssh-stat"><span class="ssh-stat-num" id="sheetClockTime">${durationLabel}</span><span class="ssh-stat-label">duração</span></div>
      <div class="ssh-stat"><span class="ssh-stat-num">${dayEx.length}</span><span class="ssh-stat-label">exercício${dayEx.length === 1 ? "" : "s"}</span></div>
      <div class="ssh-stat"><span class="ssh-stat-num">${intensity || "—"}</span><span class="ssh-stat-label">intensidade</span></div>
    </div>` : ""}
  </div>`;
  let html = `<div class="sheet-backdrop" id="sheetBackdrop"></div>`;
  html += `<div class="sheet" role="dialog" aria-modal="true" aria-label="Registrar treino" id="daySheet">
    <div class="sheet-handle" id="sheetHandle"></div>
    ${sessionHeadHtml}
    <div class="sheet-chips">
      ${store.data.order.map(k => {
    const wk = store.data.workouts[k];
    const label = wk?.isRest ? "Desc." : k;
    const active = k === letter;
    return `<button class="chip" data-role="sheetletter" data-letter="${k}" aria-pressed="${active}" style="${active ? `background:${colorFor(k, store.data.order)};color:#fff;border-color:transparent` : ""}">${label}</button>`;
  }).join("")}
    </div>
    ${hasExercises ? `<p class="sheet-hint">Toque no número da série para marcar aquecimento (A), drop set (D) ou até a falha (F). Aquecimento não entra nas estatísticas.</p>` : ""}
    ${exercisesHtml}
    ${hasExercises ? `<label class="sheet-note-wrap"><span>Observações do treino</span>
      <textarea id="sessionNote" class="sheet-note-area" rows="2" placeholder="Sono, dor, energia…">${escapeHtml(store.overlay.note || "")}</textarea></label>` : ""}
    <div class="sheet-actions">
      ${mode === "new" ? `<button class="cta-btn" id="sheetCreate">Salvar treino</button>` : ""}
    </div>
  </div>`;
  root.innerHTML = html;
  applyFocus(root);
  root.querySelectorAll(".sheet-ex-name").forEach(n => n.addEventListener("click", e => {
    if (e.target.closest("a")) return;
    applyFocus(root, n.closest(".sheet-ex-row").dataset.exid);
  }));
  document.getElementById("sheetBackdrop").addEventListener("click", closeOverlay);
  document.getElementById("sheetClose").addEventListener("click", closeOverlay);
  if (store.sheetClockInterval) {
    clearInterval(store.sheetClockInterval);
    store.sheetClockInterval = null;
  }
  const clockEl = document.getElementById("sheetClockTime");
  if (clockEl && hasActiveHere) {
    store.sheetClockInterval = setInterval(() => {
      const a2 = store.data.activeSession;
      const hasActive = (a2.state === "running" || a2.state === "paused") && dateKey === todayKey() && a2.letter === letter;
      if (!hasActive) return;
      clockEl.textContent = fmtClock(Math.floor(activeElapsedMs() / 1000));
    }, 1000);
  }
  document.querySelectorAll('[data-role="sheetletter"]').forEach(b => {
    b.addEventListener("click", () => {
      if (store.overlay.frozen && b.dataset.letter !== store.overlay.letter) {
        haptic(6);
        showToast("Treino já registrado — as séries salvas não podem ser trocadas");
        return;
      }
      haptic(6);
      store.overlay.letter = b.dataset.letter;
      renderOverlay();
    });
  });
  root.querySelectorAll(".step-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      haptic(6);
      const exid = btn.dataset.exid;
      const setidx = parseInt(btn.dataset.setidx, 10);
      const role = btn.dataset.role;
      const sets = store.overlay.log[exid];
      if (!sets || !sets[setidx]) return;
      const set = sets[setidx];
      commitSetDefaults(findExercise(exid), set, store.overlay.dateKey);
      if (role === "wplus" || role === "wminus") {
        const cur = set.weight != null ? toDisp(Number(set.weight)) : 0;
        const next = Math.max(0, roundToStep(cur + (role === "wplus" ? 1 : -1) * weightStep(), 0.1));
        set.weight = fromDisp(next);
      } else if (role === "rplus" || role === "rminus") {
        const cur = set.reps != null ? Number(set.reps) : 0;
        set.reps = Math.max(0, cur + (role === "rplus" ? 1 : -1));
      } else if (role === "mplus" || role === "mminus") {
        const cur = set.minutes != null ? Number(set.minutes) : 0;
        set.minutes = Math.max(0, cur + (role === "mplus" ? 1 : -1));
      } else {
        return;
      }
      refreshSetInputs(root, exid, setidx);
      autoSaveOverlay();
    });
  });
  root.querySelectorAll('input.step-value.input[data-field="weight"]').forEach(inp => {
    inp.addEventListener("input", () => {
      const exid = inp.dataset.exid;
      const setidx = parseInt(inp.dataset.setidx, 10);
      const sets = store.overlay.log[exid];
      if (!sets || !sets[setidx]) return;
      sets[setidx].weight = fromDisp(parseNum(inp.value));
      autoSaveOverlay();
    });
    inp.addEventListener("blur", () => {
      const exid = inp.dataset.exid;
      const setidx = parseInt(inp.dataset.setidx, 10);
      const sets = store.overlay.log[exid];
      if (!sets || !sets[setidx]) return;
      const wv = sets[setidx].weight;
      inp.value = wv == null ? "" : fmtW(wv);
    });
  });
  root.querySelectorAll('input.step-value.input[data-field="reps"]').forEach(inp => {
    inp.addEventListener("input", () => {
      const exid = inp.dataset.exid;
      const setidx = parseInt(inp.dataset.setidx, 10);
      const sets = store.overlay.log[exid];
      if (!sets || !sets[setidx]) return;
      sets[setidx].reps = parseNum(inp.value);
      autoSaveOverlay();
    });
    inp.addEventListener("blur", () => {
      const exid = inp.dataset.exid;
      const setidx = parseInt(inp.dataset.setidx, 10);
      const sets = store.overlay.log[exid];
      if (!sets || !sets[setidx]) return;
      const r = sets[setidx].reps;
      inp.value = r == null ? "" : String(r);
    });
  });
  root.querySelectorAll('[data-role="settype"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const exid = btn.dataset.exid;
      const setidx = parseInt(btn.dataset.setidx, 10);
      const sets = store.overlay.log[exid];
      if (!sets || !sets[setidx]) return;
      const set = sets[setidx];
      const cur = SET_TYPES.indexOf(set.type || "normal");
      const next = SET_TYPES[(cur + 1) % SET_TYPES.length];
      if (next === "normal") delete set.type;else set.type = next;
      if (next === "warm") set.pr = false;
      haptic(6);
      btn.innerHTML = setNumHtml(set, setidx);
      const row = btn.closest(".sheet-set");
      SET_TYPES.forEach(t => row.classList.remove("t-" + t));
      row.classList.add("t-" + next);
      btn.setAttribute("aria-label", `série ${setidx + 1}, tipo ${SET_TYPE_NAME[next]}. Toque para mudar`);
      autoSaveOverlay();
    });
  });
  root.querySelectorAll('[data-role="toggleSet"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const exid = btn.dataset.exid;
      const setidx = parseInt(btn.dataset.setidx, 10);
      const sets = store.overlay.log[exid];
      if (!sets || !sets[setidx]) return;
      const set = sets[setidx];
      const ex = findExercise(exid);
      set.done = !set.done;
      let prMsg = null;
      if (set.done) {
        commitSetDefaults(ex, set, store.overlay.dateKey);
        refreshSetInputs(root, exid, setidx);
        set.pr = false;
        if (ex && !isCardio(ex) && isWork(set)) {
          prMsg = checkPR(exid, set, sets, setidx);
          if (prMsg) set.pr = true;
        }
      } else {
        set.pr = false;
      }
      const row = btn.closest(".sheet-set");
      row.classList.toggle("done", set.done);
      {
        const exRow = btn.closest(".sheet-ex-row");
        const all = [...exRow.querySelectorAll(".sheet-set")];
        if (set.done && all.every(x => x.classList.contains("done"))) { applyFocus(root, exid); setTimeout(() => applyFocus(root), 700); } else applyFocus(root, exid);
      }
      const numBtn = row.querySelector('[data-role="settype"]');
      if (numBtn) numBtn.innerHTML = setNumHtml(set, setidx);
      autoSaveOverlay();
      if (set.done) {
        if (prMsg) {
          haptic([30, 50, 30, 50, 80]);
          confetti();
          showToast(prMsg);
        } else {
          haptic([10, 30, 10]);
        }
        if (ex && ex.ss) {
          if (!prMsg) showToast("Superset — vá para o próximo exercício");
        } else {
          startRestTimer(exid);
        }
      } else {
        haptic(6);
      }
    });
  });
  root.querySelectorAll('[data-role="applysuggest"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const exid = btn.dataset.exid;
      const ex = findExercise(exid);
      const sug = suggestNext(ex, store.overlay.dateKey);
      const sets = store.overlay.log[exid];
      if (!sug || !sets) return;
      sets.forEach((s, i) => {
        if (s.done) return;
        s.weight = sug.weight;
        s.reps = sug.reps;
        refreshSetInputs(root, exid, i);
      });
      haptic(8);
      autoSaveOverlay();
      showToast("Sugestão aplicada");
    });
  });
  root.querySelectorAll('[data-role="exrpe"]').forEach(sel => {
    sel.addEventListener("change", () => {
      const v = sel.value ? parseInt(sel.value, 10) : null;
      ensureMeta(sel.dataset.exid).rpe = v;
      autoSaveOverlay();
    });
  });
  root.querySelectorAll('[data-role="exnote"]').forEach(inp => {
    inp.addEventListener("input", () => {
      ensureMeta(inp.dataset.exid).note = inp.value;
      scheduleAutoSave();
    });
  });
  const noteEl = document.getElementById("sessionNote");
  if (noteEl) noteEl.addEventListener("input", () => {
    store.overlay.note = noteEl.value;
    scheduleAutoSave();
  });
  const createBtn = document.getElementById("sheetCreate");
  if (createBtn) createBtn.addEventListener("click", () => {
    const {
      dateKey: dk,
      letter: lt,
      log: lg,
      startedAt: st,
      mode: md
    } = store.overlay;
    if (md !== "new") return;
    const arr = sessionsFor(dk).slice();
    const cleanLog = JSON.parse(JSON.stringify(lg));
    Object.keys(cleanLog).forEach(exId => {
      cleanLog[exId] = (cleanLog[exId] || []).filter(s => s.minutes != null || s.weight != null || s.reps != null || s.done);
    });
    const meta = cleanMeta(store.overlay.meta);
    const note = (store.overlay.note || "").trim();
    let sess = arr.find(s => s.letter === lt && !s.endedAt);
    if (sess) {
      sess.log = cleanLog;
    } else {
      sess = {
        id: newSessionId(),
        letter: lt,
        log: cleanLog,
        startedAt: st,
        endedAt: null
      };
      arr.push(sess);
    }
    if (Object.keys(meta).length) sess.meta = meta;else delete sess.meta;
    if (note) sess.note = note;else delete sess.note;
    stampSnapshot(sess);
    store.data.sessions[dk] = arr;
    haptic([10, 40, 10]);
    closeOverlay();
    render();
    persist();
    showToast("Séries salvas");
  });
  enableSheetDrag(root.querySelector("#daySheet"), root.querySelector("#sheetHandle"));
  syncWakeLock();
}

export function autoSaveOverlay() {
  if (!store.overlay || store.overlay.type !== "day") return;
  if (store.overlay.mode === "new") return;
  const {
    dateKey,
    sessionId,
    letter,
    log,
    startedAt
  } = store.overlay;
  const arr = sessionsFor(dateKey).slice();
  let sess = arr.find(s => s.id === sessionId);
  if (!sess) {
    sess = {
      id: sessionId || newSessionId(),
      letter,
      log: {},
      startedAt,
      endedAt: null
    };
    arr.push(sess);
  }
  sess.letter = letter;
  sess.log = JSON.parse(JSON.stringify(log));
  const meta = cleanMeta(store.overlay.meta);
  if (Object.keys(meta).length) sess.meta = meta;else delete sess.meta;
  const note = (store.overlay.note || "").trim();
  if (note) sess.note = note;else delete sess.note;
  if (!sess.startedAt) sess.startedAt = startedAt;
  stampSnapshot(sess);
  store.data.sessions[dateKey] = arr;
  persist();
}

export function exExtrasHtml(ex) {
  const meta = store.overlay.meta && store.overlay.meta[ex.id] || {};
  const rpeOpts = `<option value="">RPE</option>` + [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => `<option value="${n}" ${meta.rpe === n ? "selected" : ""}>RPE ${n}</option>`).join("");
  return `<div class="sheet-ex-extra">
    <select class="sheet-rpe" data-role="exrpe" data-exid="${ex.id}" aria-label="Esforço percebido (RPE)">${rpeOpts}</select>
    <input class="sheet-note" type="text" data-role="exnote" data-exid="${ex.id}" value="${escapeAttr(meta.note || "")}" placeholder="Observação…" aria-label="Observação do exercício" autocomplete="off">
  </div>`;
}

export function exNameHtml(ex, fallback, linked, completed) {
  const url = safeUrl(ex.link);
  return `<div class="sheet-ex-name${linked ? " linked" : ""}">
    ${exThumbHtml(ex)}
    <span class="sheet-ex-title">${escapeHtml(ex.name || fallback)}</span>
    ${linked ? `<span class="ss-badge">superset</span>` : ""}
    ${url ? `<a class="ex-link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" aria-label="Ver vídeo ou técnica">${ICONS.link}</a>` : ""}
    ${completed ? `<span class="ex-done-badge" aria-label="exercício concluído">${ICONS.checkSm}</span>` : ""}
  </div>`;
}

export function renderStrengthRow(ex, log, dateKey, linked) {
  const last = lastLoggedValue(ex.id, dateKey);
  const sets = ensureSetsForExercise(log, ex.id, ex.sets);
  const def = setDefaults(ex, dateKey);
  const restSec = restForExercise(ex.id);
  const sug = suggestNext(ex, dateKey);
  const pr = exercisePRs(ex.id);
  const workSets = sets.filter(isWork);
  const allDone = workSets.length > 0 && workSets.every(s => s.done);
  const lastLabel = last ? `última vez: ${last.weight != null ? fmtW(last.weight) + " " + unit() : "—"} × ${last.reps != null ? last.reps : "—"}` : "primeira vez registrando";
  const restLabel = ex.ss ? "sem descanso (superset)" : `descanso ${restSec}s`;
  return `<div class="sheet-ex-row${linked ? " linked" : ""}" data-exid="${ex.id}">
    ${exNameHtml(ex, "Exercício", linked, allDone)}
    <div class="sheet-ex-last">${lastLabel} · ${restLabel}${pr ? ` · recorde ${fmtW(pr.maxWeight)} ${unit()}` : ""}</div>
    ${sug ? `<button type="button" class="suggest-chip" data-role="applysuggest" data-exid="${ex.id}"><span>${escapeHtml(sug.text)}</span><b>aplicar</b></button>` : ""}
    <div class="sheet-sets" data-exid="${ex.id}">
      ${sets.map((s, i) => {
    const initialWeight = s.weight != null ? s.weight : def.weight;
    const initialReps = s.reps != null ? s.reps : def.reps;
    const t = SET_TYPES.includes(s.type) ? s.type : "normal";
    return `<div class="sheet-set ${s.done ? "done" : ""} t-${t}" data-setidx="${i}">
          <button type="button" class="sheet-set-num" data-role="settype" data-exid="${ex.id}" data-setidx="${i}" aria-label="série ${i + 1}, tipo ${SET_TYPE_NAME[t]}. Toque para mudar">${setNumHtml(s, i)}</button>
          <div class="step-group">
            <button class="step-btn" data-role="wminus" data-exid="${ex.id}" data-setidx="${i}" aria-label="diminuir peso">−</button>
            <input class="step-value input" type="text" inputmode="decimal"
              data-field="weight" data-exid="${ex.id}" data-setidx="${i}"
              value="${escapeAttr(fmtW(initialWeight))}"
              aria-label="peso em ${unit()}">
            <span class="step-unit">${unit()}</span>
            <button class="step-btn" data-role="wplus" data-exid="${ex.id}" data-setidx="${i}" aria-label="aumentar peso">+</button>
          </div>
          <div class="step-group">
            <button class="step-btn" data-role="rminus" data-exid="${ex.id}" data-setidx="${i}" aria-label="diminuir reps">−</button>
            <input class="step-value input" type="text" inputmode="numeric"
              data-field="reps" data-exid="${ex.id}" data-setidx="${i}"
              value="${escapeAttr(initialReps != null && initialReps !== "" ? String(initialReps) : "")}"
              aria-label="repetições">
            <button class="step-btn" data-role="rplus" data-exid="${ex.id}" data-setidx="${i}" aria-label="aumentar reps">+</button>
          </div>
          <button class="sheet-set-check" data-role="toggleSet" data-exid="${ex.id}" data-setidx="${i}" aria-label="marcar série ${i + 1}">${ICONS.checkSm}</button>
        </div>`;
  }).join("")}
    </div>
    ${exExtrasHtml(ex)}
  </div>`;
}

export function renderCardioRow(ex, log, dateKey, linked) {
  const last = lastLoggedValue(ex.id, dateKey);
  const sets = ensureCardioSets(log, ex.id);
  const def = setDefaults(ex, dateKey);
  const allDone = sets.length > 0 && sets.every(s => s.done);
  const lastLabel = last && last.minutes != null ? `última vez: ${last.minutes} min` : "primeira vez registrando";
  return `<div class="sheet-ex-row${linked ? " linked" : ""}" data-exid="${ex.id}">
    ${exNameHtml(ex, "Cardio", linked, allDone)}
    <div class="sheet-ex-last">${lastLabel}</div>
    <div class="sheet-sets" data-exid="${ex.id}">
      ${sets.map((s, i) => {
    const initialMin = s.minutes != null ? s.minutes : def.minutes;
    return `<div class="sheet-set ${s.done ? "done" : ""}" data-setidx="${i}">
          <div class="sheet-set-num">${i + 1}</div>
          <div class="step-group">
            <button class="step-btn" data-role="mminus" data-exid="${ex.id}" data-setidx="${i}" aria-label="diminuir minutos">−</button>
            <div class="step-value" data-field="minutes" data-exid="${ex.id}" data-setidx="${i}">${initialMin}</div>
            <span class="step-unit">min</span>
            <button class="step-btn" data-role="mplus" data-exid="${ex.id}" data-setidx="${i}" aria-label="aumentar minutos">+</button>
          </div>
          <button class="sheet-set-check" data-role="toggleSet" data-exid="${ex.id}" data-setidx="${i}" aria-label="marcar ${i + 1}">${ICONS.checkSm}</button>
        </div>`;
  }).join("")}
    </div>
    ${exExtrasHtml(ex)}
  </div>`;
}

export function enableSheetDrag(sheetEl, handleEl) {
  if (!sheetEl || !handleEl) return;
  let startY = 0,
    curY = 0,
    dragging = false;
  handleEl.addEventListener("pointerdown", e => {
    dragging = true;
    startY = e.clientY;
    curY = 0;
    sheetEl.classList.add("dragging");
    handleEl.setPointerCapture(e.pointerId);
  });
  handleEl.addEventListener("pointermove", e => {
    if (!dragging) return;
    curY = Math.max(0, e.clientY - startY);
    sheetEl.style.transform = `translateY(${curY}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheetEl.classList.remove("dragging");
    if (curY > 100) {
      closeOverlay();
    } else {
      sheetEl.style.transform = "";
    }
    curY = 0;
  };
  handleEl.addEventListener("pointerup", end);
  handleEl.addEventListener("pointercancel", end);
}

export async function undoToday() {
  const dateKey = todayKey();
  const arr = sessionsFor(dateKey);
  if (arr.length === 0) return;
  arr.pop();
  if (arr.length === 0) delete store.data.sessions[dateKey];else store.data.sessions[dateKey] = arr;
  const a = store.data.activeSession;
  if (a.startedDate === dateKey && a.state !== "idle") {
    a.state = "idle";
    a.letter = null;
    a.elapsedMs = 0;
    a.startedAt = null;
    a.startedDate = null;
  }
  render();
  await persist();
  showToast("Desfeito");
}
