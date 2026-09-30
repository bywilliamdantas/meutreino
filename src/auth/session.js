import { bootApp } from "../boot.js";
import { SESSION_KEY } from "../config.js";
import { AUTOBACKUP_KEY, STORAGE_KEY } from "../data/constants.js";
import { getTabFromHash } from "../router.js";
import { store } from "../store.js";
import { showToast } from "../ui/toast.js";
import { todayKey } from "../utils/format.js";
import { renderLogin } from "../views/login-view.js";
import { tryLogin } from "./crypto.js";

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

export function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY) || window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && s.username) {
      if (!s.loginDay || s.loginDay !== todayKey()) {
        clearSession();
        return null;
      }
      return {
        username: s.username,
        name: s.name || s.username
      };
    }
  } catch (e) {}
  return null;
}

export function writeSession(user, keep) {
  const raw = JSON.stringify({
    username: user.username,
    name: user.name,
    loginDay: todayKey()
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
  const still = readSession();
  if (!still) {
    store.currentUser = null;
    store.overlay = null;
    try {
      window.location.hash = "";
    } catch (e) {}
    renderLogin();
    showToast("Um novo dia começou — faça login de novo.");
  }
}

export async function doLogin(username, password, keep) {
  store.authBusy = true;
  store.authError = "";
  renderLogin();
  const r = await tryLogin(username, password);
  store.authBusy = false;
  if (!r.ok) {
    store.authError = r.msg;
    renderLogin();
    return;
  }
  migrateUserDataIfNeeded(r.user.username);
  store.currentUser = r.user;
  writeSession(r.user, keep);
  rememberUser(r.user.username, keep);
  if (keep) storeCredential(r.user, password);
  store.authError = "";
  store.activeTab = getTabFromHash() || "inicio";
  await bootApp();
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
