import { bootApp } from "../boot.js";
import { SESSION_KEY } from "../config.js";
import { AUTOBACKUP_KEY, SESSION_IDLE_DAYS, STORAGE_KEY } from "../data/constants.js";
import { getTabFromHash } from "../router.js";
import { store } from "../store.js";
import { showToast } from "../ui/toast.js";
import { renderLogin } from "../views/login-view.js";
import { fetchUsers, tryLogin } from "./crypto.js";
import { isValidPin, resetPinFails, verifyPin } from "./pin.js";

export function migrateUserDataIfNeeded(username) {
  try {
    const newKey = `${STORAGE_KEY}:${username}`;
    const newAb = `${AUTOBACKUP_KEY}:${username}`;
    if (window.localStorage.getItem(newKey) == null) {
      const old = window.localStorage.getItem(STORAGE_KEY);
      if (old != null) window.localStorage.setItem(newKey, old);
    }
    if (window.localStorage.getItem(newAb) == null) {
      const oldAb = window.localStorage.getItem(AUTOBACKUP_KEY);
      if (oldAb != null) window.localStorage.setItem(newAb, oldAb);
    }
  } catch (e) {}
}

const LAST_USER_KEY = "gym-last-user";

// Só o nome de usuário fica guardado (a senha nunca é gravada pelo app — quem
// guarda a senha é o gerenciador de senhas do navegador/iCloud Keychain).
export function readRememberedUser() {
  try {
    return window.localStorage.getItem(LAST_USER_KEY) || "";
  } catch (e) {}
  return "";
}

function rememberUser(username, keep) {
  try {
    if (keep) window.localStorage.setItem(LAST_USER_KEY, username);
    else window.localStorage.removeItem(LAST_USER_KEY);
  } catch (e) {}
}

// Pede ao navegador para salvar a credencial (Chrome/Edge/Android). No Safari
// o salvamento vem do <form> da tela de login.
function storeCredential(user, password) {
  try {
    if (window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
      const cred = new window.PasswordCredential({ id: user.username, password, name: user.name || user.username });
      navigator.credentials.store(cred).catch(() => {});
    }
  } catch (e) {}
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 10 * 60 * 1000;
const idleDaysKey = username => `gym-idle-days:${String(username || "").toLowerCase()}`;

/* Prazo de inatividade (dias) — preferência do aparelho, por usuário. Fica fora
   de store.data para poder ser lida antes de carregar os dados. */
export function readIdleDays(username) {
  try {
    const n = parseInt(window.localStorage.getItem(idleDaysKey(username)), 10);
    if (n >= 1 && n <= 365) return n;
  } catch (e) {}
  return SESSION_IDLE_DAYS;
}

export function writeIdleDays(username, days) {
  try {
    window.localStorage.setItem(idleDaysKey(username), String(days));
  } catch (e) {}
}

function readRawSession() {
  try {
    const local = window.localStorage.getItem(SESSION_KEY);
    if (local) return { raw: local, area: "local" };
    const sess = window.sessionStorage.getItem(SESSION_KEY);
    if (sess) return { raw: sess, area: "session" };
  } catch (e) {}
  return null;
}

/* Treino em andamento (activeSession.state diferente de "idle"): vale o estado
   em memória e, no boot (dados ainda não carregados), o JSON salvo. */
export function hasActiveWorkout(username) {
  const active = st => typeof st === "string" && st !== "idle";
  try {
    if (store.currentUser && (!username || store.currentUser.username === username) && store.data.activeSession && active(store.data.activeSession.state)) return true;
  } catch (e) {}
  try {
    const raw = username ? window.localStorage.getItem(`${STORAGE_KEY}:${username}`) : null;
    const d = raw ? JSON.parse(raw) : null;
    return !!(d && d.activeSession && active(d.activeSession.state));
  } catch (e) {}
  return false;
}

/* Registro v2: { v, username, name, lastOpenAt }. Registros da v8.1 (loginDay)
   são aceitos: o dia do login vira o "último acesso". */
function lastOpenOf(s) {
  const n = Number(s.lastOpenAt);
  if (Number.isFinite(n) && n > 0) return n;
  const t = s.loginDay ? new Date(`${s.loginDay}T00:00:00`).getTime() : NaN;
  return Number.isFinite(t) ? t : Date.now();
}

/* Marca "abri o app agora". Regrava no mesmo lugar (local/session) em que a
   sessão já estava; sem `force`, no máximo a cada 10 min. */
export function touchSession(force) {
  const cur = readRawSession();
  if (!cur) return;
  try {
    const s = JSON.parse(cur.raw);
    if (!s || !s.username) return;
    const last = lastOpenOf(s);
    if (!force && s.v === 2 && Date.now() - last < TOUCH_EVERY_MS) return;
    const store_ = cur.area === "local" ? window.localStorage : window.sessionStorage;
    store_.setItem(SESSION_KEY, JSON.stringify({ v: 2, username: s.username, name: s.name, lastOpenAt: Date.now() }));
  } catch (e) {}
}

/* A sessão NÃO expira na virada do dia. Só expira depois de N dias sem abrir o
   app — e nunca com um treino ativo (nesse caso segue valendo e é renovada). */
export function readSession() {
  const cur = readRawSession();
  if (!cur) return null;
  try {
    const s = JSON.parse(cur.raw);
    if (!s || !s.username) return null;
    const expired = Date.now() - lastOpenOf(s) > readIdleDays(s.username) * DAY_MS;
    if (expired) {
      if (!hasActiveWorkout(s.username)) {
        clearSession();
        return null;
      }
      touchSession(true);
    }
    return {
      username: s.username,
      name: s.name || s.username
    };
  } catch (e) {}
  return null;
}

export function writeSession(user, keep) {
  const raw = JSON.stringify({
    v: 2,
    username: user.username,
    name: user.name,
    lastOpenAt: Date.now()
  });
  try {
    if (keep) {
      window.localStorage.setItem(SESSION_KEY, raw);
      window.sessionStorage.removeItem(SESSION_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_KEY, raw);
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch (e) {}
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

export function enforceSessionExpiry() {
  if (!store.currentUser) return;
  // nunca derruba o app para o login com um treino ativo
  if (hasActiveWorkout(store.currentUser.username)) return;
  const still = readSession();
  if (!still) {
    store.currentUser = null;
    store.overlay = null;
    try {
      window.location.hash = "";
    } catch (e) {}
    renderLogin();
    showToast("Sua sessão expirou — faça login de novo.");
  }
}

async function finishLogin(user, keep, password) {
  migrateUserDataIfNeeded(user.username);
  store.currentUser = user;
  writeSession(user, keep);
  rememberUser(user.username, keep);
  if (password && keep) storeCredential(user, password);
  store.authError = "";
  store.loginUser = "";
  store.loginMode = null;
  store.activeTab = getTabFromHash() || "inicio";
  await bootApp();
}

export async function doLogin(username, password, keep) {
  store.authBusy = true;
  store.authError = "";
  store.loginUser = username;
  renderLogin();
  const r = await tryLogin(username, password);
  store.authBusy = false;
  if (!r.ok) {
    store.authError = r.msg;
    renderLogin();
    return;
  }
  resetPinFails(r.user.username);
  await finishLogin(r.user, keep, password);
}

/* Login com PIN. Online, confere se o usuário ainda existe em users.json;
   offline, vale o cadastro local (o PIN foi criado após uma senha válida). */
export async function doLoginPin(username, pin, keep) {
  store.authBusy = true;
  store.authError = "";
  store.loginUser = username;
  renderLogin();
  let user = null;
  const fail = msg => {
    store.authBusy = false;
    store.authError = msg;
    renderLogin();
  };
  if (!isValidPin(pin)) return fail("Digite os 4 dígitos do PIN.");
  const r = await verifyPin(username, pin);
  if (!r.ok) {
    if (r.locked) {
      store.loginMode = "password";
      return fail("PIN bloqueado por erros seguidos. Entre com a senha.");
    }
    return fail(r.error ? "Não foi possível verificar o PIN neste navegador." : `PIN incorreto. ${r.left} tentativa(s) restante(s).`);
  }
  user = { username: r.rec.username, name: r.rec.name };
  const users = await fetchUsers();
  if (users) {
    const u = users.find(x => x.username.toLowerCase() === user.username.toLowerCase());
    if (!u) return fail("Esse usuário não existe mais. Fale com seu treinador.");
    user = { username: u.username, name: u.name || u.username };
  }
  store.authBusy = false;
  await finishLogin(user, keep, null);
}

export function doLogout() {
  clearSession();
  store.currentUser = null;
  store.authError = "";
  store.overlay = null;
  try {
    window.location.hash = "";
  } catch (e) {}
  renderLogin();
}
