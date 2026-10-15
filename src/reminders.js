import { notifyViaServiceWorker } from "./notify.js";
import { persist } from "./persistence.js";
import { store } from "./store.js";
import { showToast } from "./ui/toast.js";
import { pad, todayKey } from "./utils/format.js";
import { sessionsFor } from "./workouts/sessions.js";
import { nextWorkoutLetter, workoutLabel } from "./workouts/workouts.js";

export function checkReminder() {
  const r = store.data.settings.reminder;
  if (!r || !r.enabled) return;
  if (sessionsFor(todayKey()).length) return;
  const now = new Date();
  const hhmm = pad(now.getHours()) + ":" + pad(now.getMinutes());
  if (hhmm < r.time) return;
  if (r.lastNotifiedDate === todayKey()) return;
  r.lastNotifiedDate = todayKey();
  persist();
  const next = nextWorkoutLetter();
  const msg = `Não esqueça: hoje é ${workoutLabel(next)}.`;
  notifyViaServiceWorker("Hora do treino", msg, "lembrete-diario");
  showToast(msg);
}
