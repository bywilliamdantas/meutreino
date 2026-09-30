import { AUTOBACKUP_KEY, STORAGE_KEY } from "./data/constants.js";
import { store } from "./store.js";

export const AUTOBACKUP_MAX = 5;

export const SESSION_KEY = "gym-session";

export const USERS_URL = "users.json";

export function storageKey() {
  return store.currentUser ? `${STORAGE_KEY}:${store.currentUser.username}` : STORAGE_KEY;
}

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
