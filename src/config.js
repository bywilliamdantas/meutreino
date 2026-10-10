import { AUTOBACKUP_KEY, STORAGE_KEY } from "./data/constants.js";
import { store } from "./store.js";

export const AUTOBACKUP_MAX = 5;

export const SESSION_KEY = "gym-session";

export const USERS_URL = "users.json";

export function storageKey() {
  return store.currentUser ? `${STORAGE_KEY}:${store.currentUser.username}` : STORAGE_KEY;
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
