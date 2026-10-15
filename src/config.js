import { AUTOBACKUP_KEY, CORE_KEY, JOURNAL_KEY, STORAGE_KEY } from "./data/constants.js";
import { store } from "./store.js";

export const AUTOBACKUP_MAX = 5;

export const SESSION_KEY = "gym-session";

export const USERS_URL = "users.json";

export function storageKey() {
  return store.currentUser ? `${STORAGE_KEY}:${store.currentUser.username}` : STORAGE_KEY;
}

const keyFor = (base, name) => (name ? `${base}:${name}` : base);
const currentName = () => (store.currentUser ? store.currentUser.username : null);

/* Núcleo (tudo menos sessions) e diário de gravação pendente. `name` é o
   username (ou null); sem argumento vale o usuário atual. */
export function coreKey(name = currentName()) {
  return keyFor(CORE_KEY, name);
}

export function journalKey(name = currentName()) {
  return keyFor(JOURNAL_KEY, name);
}

/* Identificador do usuário atual nos bancos do IndexedDB (mesmo critério das
   chaves do localStorage, só que sem prefixo). */
export function userId() {
  return store.currentUser ? store.currentUser.username : "_default";
}

/* Chave LEGADA: até a v8.1 os backups automáticos ficavam aqui. Hoje só é lida
   pela migração para o IndexedDB (src/storage/legacy-migration.js). */
export function autobackupKey() {
  return store.currentUser ? `${AUTOBACKUP_KEY}:${store.currentUser.username}` : AUTOBACKUP_KEY;
}

export const SET_TYPE_LABEL = {
  normal: "",
  warm: "A",
  drop: "D",
  fail: "F"
};

export const SET_TYPE_NAME = {
  normal: "normal",
  warm: "aquecimento",
  drop: "drop set",
  fail: "até a falha"
};

export const REST_COLOR = "#8b8b94";
