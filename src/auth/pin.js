/* ============================================================
   PIN de 4 dígitos (opcional) — fica só NESTE aparelho.
   - Guardado como PBKDF2-HMAC-SHA256 (600 mil iterações) com salt aleatório
     de 16 bytes, via crypto.subtle. Nunca em texto puro.
   - Chave própria por usuário no localStorage ("gym-pin:<usuario>"), FORA de
     store.data: não entra em exportação nem nos backups automáticos.
   - Não substitui a senha: ela continua valendo (users.json não muda) e é o
     caminho de recuperação. 5 erros seguidos bloqueiam o PIN até entrar com
     a senha uma vez.
   ============================================================ */

export const PIN_KEY_PREFIX = "gym-pin:";
export const PIN_ITERATIONS = 600000;
export const PIN_MAX_FAILS = 5;

const pinKey = (username) =>
  PIN_KEY_PREFIX +
  String(username || "")
    .trim()
    .toLowerCase();

export const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
export const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

export function pinSupported() {
  return typeof crypto !== "undefined" && !!crypto.subtle && !!crypto.getRandomValues;
}

export const isValidPin = (pin) => /^\d{4}$/.test(String(pin || ""));

/* PINs óbvios (0000, 1111, 1234, 4321…) são recusados. */
export function isWeakPin(pin) {
  if (/^(\d)\1{3}$/.test(pin)) return true;
  const d = pin.split("").map(Number);
  const step = d[1] - d[0];
  return Math.abs(step) === 1 && d[2] - d[1] === step && d[3] - d[2] === step;
}

export async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function readPin(username) {
  try {
    const rec = JSON.parse(window.localStorage.getItem(pinKey(username)) || "null");
    return rec && rec.hash && rec.salt && rec.iter ? rec : null;
  } catch (e) {
    return null;
  }
}

export const hasPin = (username) => !!username && !!readPin(username);

function writePin(username, rec) {
  window.localStorage.setItem(pinKey(username), JSON.stringify(rec));
}

export async function setPin(user, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, PIN_ITERATIONS);
  writePin(user.username, {
    v: 1,
    alg: "PBKDF2-SHA256",
    iter: PIN_ITERATIONS,
    salt: toB64(salt),
    hash: toB64(hash),
    username: user.username,
    name: user.name || user.username,
    fails: 0,
    createdAt: new Date().toISOString()
  });
}

export function removePin(username) {
  try {
    window.localStorage.removeItem(pinKey(username));
  } catch (e) {}
}

export function resetPinFails(username) {
  const rec = readPin(username);
  if (!rec || !rec.fails) return;
  rec.fails = 0;
  try {
    writePin(username, rec);
  } catch (e) {}
}

/* → { ok, locked, left, rec } */
export async function verifyPin(username, pin) {
  const rec = readPin(username);
  if (!rec) return { ok: false, locked: false, left: 0 };
  if ((rec.fails || 0) >= PIN_MAX_FAILS) return { ok: false, locked: true, left: 0 };
  let good = false;
  try {
    const got = await derive(String(pin), fromB64(rec.salt), rec.iter);
    good = sameBytes(got, fromB64(rec.hash));
  } catch (e) {
    return { ok: false, locked: false, left: PIN_MAX_FAILS - (rec.fails || 0), error: true };
  }
  if (good) {
    resetPinFails(username);
    return { ok: true, locked: false, left: PIN_MAX_FAILS, rec };
  }
  rec.fails = (rec.fails || 0) + 1;
  try {
    writePin(username, rec);
  } catch (e) {}
  const left = Math.max(0, PIN_MAX_FAILS - rec.fails);
  return { ok: false, locked: left === 0, left };
}
