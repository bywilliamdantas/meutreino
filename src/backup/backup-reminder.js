/* Regra "devo oferecer backup?" — funções puras (sem store, sem DOM) para
   poderem ser testadas em Node. A tela e o fim do treino só chamam estas funções.

   Frequência (settings.backupEvery): 3, 7 ou 14 treinos; 0 = desligado.
   O mesmo número N vale para os dois gatilhos: N treinos OU N dias desde o
   último backup exportado (settings.lastBackupAt). "Agora não" adia o convite
   por BACKUP_SNOOZE_DAYS dias (settings.backupSnoozedUntil). */

export const BACKUP_EVERY_OPTIONS = [3, 7, 14],
  BACKUP_EVERY_DEFAULT = 7,
  BACKUP_SNOOZE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/* 0 (desligado) é um valor válido; qualquer coisa fora de 0/3/7/14 volta ao padrão. */
export function normalizeBackupEvery(v) {
  const n = Number(v);
  if (n === 0 && v !== "" && v !== null && v !== false) return 0;
  return BACKUP_EVERY_OPTIONS.includes(n) ? n : BACKUP_EVERY_DEFAULT;
}

function toMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/* Treinos finalizados (não conta descanso) depois do último backup.
   Sem backup anterior, conta todos. `workouts` é store.data.workouts. */
export function workoutsSinceBackup(sessions, workouts, lastBackupAt) {
  const since = toMs(lastBackupAt);
  let n = 0;
  Object.keys(sessions || {}).forEach((dateKey) => {
    const v = sessions[dateKey];
    const arr = Array.isArray(v) ? v : v ? [v] : [];
    arr.forEach((s) => {
      if (!s || !s.endedAt) return;
      if (s.letter && workouts && workouts[s.letter] && workouts[s.letter].isRest) return;
      if (since === null || s.endedAt > since) n++;
    });
  });
  return n;
}

/* Retorna { offer, reason, days, workouts }.
   reason: "never" (nunca exportou) | "days" | "workouts" | null */
export function backupOffer({ every, lastBackupAt, snoozedUntil, workoutsSince, hasData, now }) {
  const n = normalizeBackupEvery(every);
  const t = typeof now === "number" ? now : Date.now();
  const last = toMs(lastBackupAt);
  const days = last === null ? Infinity : Math.max(0, (t - last) / DAY_MS);
  const none = { offer: false, reason: null, days, workouts: workoutsSince || 0 };
  if (n === 0 || !hasData) return none;
  const snooze = toMs(snoozedUntil);
  if (snooze !== null && t < snooze) return none;
  if (last === null) return { ...none, offer: true, reason: "never" };
  if (days >= n) return { ...none, offer: true, reason: "days" };
  if ((workoutsSince || 0) >= n) return { ...none, offer: true, reason: "workouts" };
  return none;
}

export function shouldOfferBackup(input) {
  return backupOffer(input).offer;
}

export function snoozeUntilIso(now) {
  return new Date((typeof now === "number" ? now : Date.now()) + BACKUP_SNOOZE_DAYS * DAY_MS).toISOString();
}
