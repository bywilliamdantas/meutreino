import { store } from "./store.js";

export function bodySorted() {
  return (store.data.body || []).slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

export function newBodyId() {
  return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
