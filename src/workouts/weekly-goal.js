/* ============================================================
   META SEMANAL E SEQUÊNCIA DE SEMANAS
   Funções puras: não leem o store nem o relógio. Tudo que dependem
   (sessões, meta, "agora", início da semana, o que é descanso) entra
   por parâmetro, o que permite testar com `node --test` sem navegador.
   src/workouts/sessions.js tem os wrappers que ligam isso ao store.
   ============================================================ */

export const MIN_WEEKLY_GOAL = 1;
export const MAX_WEEKLY_GOAL = 14;

function pad(n) {
  return String(n).padStart(2, "0");
}

function keyOf(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseKey(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/* Meta válida: inteiro entre MIN e MAX. Qualquer outra coisa vira o mínimo. */
export function normalizeGoal(goal) {
  const n = Math.round(Number(goal));
  if (!Number.isFinite(n)) return MIN_WEEKLY_GOAL;
  return Math.max(MIN_WEEKLY_GOAL, Math.min(MAX_WEEKLY_GOAL, n));
}

/* Padrão da meta = quantidade de treinos que não são descanso no ciclo. */
export function defaultWeeklyGoal(order, isRest) {
  const list = Array.isArray(order) ? order : [];
  return normalizeGoal(list.filter((letter) => !isRest(letter)).length);
}

/* Meta efetiva: a escolhida em Ajustes ou, se não houver (null/inválida), o padrão. */
export function resolveWeeklyGoal(setting, order, isRest) {
  const n = Number(setting);
  if (setting !== null && setting !== undefined && setting !== "" && Number.isFinite(n) && n >= MIN_WEEKLY_GOAL) {
    return normalizeGoal(n);
  }
  return defaultWeeklyGoal(order, isRest);
}

/* Meia-noite do primeiro dia da semana que contém `date`. */
export function startOfWeek(date, mondayStart) {
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = mondayStart ? (x.getDay() + 6) % 7 : x.getDay();
  x.setDate(x.getDate() - offset);
  return x;
}

/* Aceita o formato atual (array por dia) e o antigo (objeto único por dia). */
function entriesOf(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/* Mapa "chave do primeiro dia da semana" -> nº de sessões que NÃO são descanso. */
export function countByWeek(sessions, isRest, mondayStart) {
  const counts = new Map();
  for (const key of Object.keys(sessions || {})) {
    const day = parseKey(key);
    if (!day) continue;
    const n = entriesOf(sessions[key]).filter((s) => s && !isRest(s.letter)).length;
    if (!n) continue;
    const wk = keyOf(startOfWeek(day, mondayStart));
    counts.set(wk, (counts.get(wk) || 0) + n);
  }
  return counts;
}

/* Quantos treinos (sem descanso) já foram feitos na semana de `now`. */
export function weekSessionCount({ sessions, now = new Date(), mondayStart = false, isRest = () => false }) {
  const counts = countByWeek(sessions, isRest, mondayStart);
  return counts.get(keyOf(startOfWeek(now, mondayStart))) || 0;
}

/* Semanas seguidas em que a meta foi batida.
   - A semana atual conta se já bateu a meta; se ainda não bateu, ela está em
     andamento e NÃO quebra a sequência (a contagem parte da semana anterior).
   - Uma semana passada abaixo da meta (inclusive sem treino) encerra a contagem. */
export function weeklyStreak({ sessions, goal, now = new Date(), mondayStart = false, isRest = () => false }) {
  const target = normalizeGoal(goal);
  const counts = countByWeek(sessions, isRest, mondayStart);
  if (!counts.size) return 0;
  const cursor = startOfWeek(now, mondayStart);
  let streak = 0;
  if ((counts.get(keyOf(cursor)) || 0) >= target) streak++;
  cursor.setDate(cursor.getDate() - 7);
  while ((counts.get(keyOf(cursor)) || 0) >= target) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}
