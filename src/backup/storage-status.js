import { store } from "../store.js";

export function storageStatusText() {
  if (store.storagePersisted === null) return "verificando…";
  return store.storagePersisted ? "ativa" : "não garantida";
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persisted) {
      let p = await navigator.storage.persisted();
      if (!p && navigator.storage.persist) p = await navigator.storage.persist();
      store.storagePersisted = !!p;
    } else {
      store.storagePersisted = false;
    }
  } catch (e) {
    store.storagePersisted = false;
  }
  const el = document.getElementById("storageStatus");
  if (el) {
    el.textContent = storageStatusText();
    el.classList.toggle("ok", store.storagePersisted === true);
  }
}
