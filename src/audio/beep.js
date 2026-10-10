/* ============================================================
   BEEP DO TIMER DE DESCANSO (Web Audio)
   O iOS só deixa o áudio tocar depois de um gesto do usuário: o
   AudioContext é criado/retomado no primeiro toque (initAudioUnlock) e
   fica pronto para quando o descanso acabar, sem nenhum toque na hora.
   Se o sistema suspender o áudio de novo (app em segundo plano), o próximo
   toque retoma. Sem suporte a Web Audio, tudo vira no-op.
   ============================================================ */
let ctx = null;
let listening = false;

function audioCtor() {
  return typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext || null : null;
}

/* Cria (1ª vez) ou retoma o AudioContext. Chame dentro de um gesto do usuário. */
export function unlockAudio() {
  const Ctor = audioCtor();
  if (!Ctor) return false;
  try {
    if (!ctx) ctx = new Ctor();
    if (ctx.state !== "running") {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => {});
      /* uma amostra silenciosa: em versões do iOS é isto que realmente abre a saída de áudio */
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    }
    return true;
  } catch (e) {
    return false;
  }
}

/* Liga o destravamento ao primeiro (e a cada novo) toque. Idempotente. */
export function initAudioUnlock() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  const onGesture = () => {
    if (ctx && ctx.state === "running") return;
    unlockAudio();
  };
  ["touchend", "pointerup", "click", "keydown"].forEach(ev => document.addEventListener(ev, onGesture, { capture: true, passive: true }));
}

function tone() {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.25);
}

/* Beep curto (880 Hz, ~0,2 s). Retorna true se tocou na hora; se o áudio ainda
   estava suspenso, tenta retomar e tocar em seguida (e retorna false). */
export function playBeep() {
  if (!ctx) return false;
  try {
    if (ctx.state === "running") {
      tone();
      return true;
    }
    const p = ctx.resume();
    if (p && p.then) p.then(() => { if (ctx.state === "running") tone(); }).catch(() => {});
  } catch (e) {}
  return false;
}

/* Só para testes: volta ao estado inicial. */
export function _resetAudioForTests() {
  ctx = null;
  listening = false;
}
