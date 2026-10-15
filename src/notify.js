/* Notificação do sistema via service worker.
   No iPhone (PWA instalado) o construtor Notification não funciona: o único
   caminho suportado é registration.showNotification(). Isto NÃO é Web Push: a
   notificação só é disparada pelo próprio app, então só aparece com o app
   aberto. Devolve true se o sistema aceitou mostrar; false em qualquer outro
   caso (sem permissão, sem service worker, erro) — quem chama mantém o toast. */
import { store } from "./store.js";

async function activeRegistration() {
  if (store.swRegistration) return store.swRegistration;
  if (typeof navigator === "undefined" || !navigator.serviceWorker || !navigator.serviceWorker.getRegistration) return null;
  return (await navigator.serviceWorker.getRegistration()) || null;
}

export async function notifyViaServiceWorker(title, body, tag) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    const reg = await activeRegistration();
    if (!reg || typeof reg.showNotification !== "function") return false;
    await reg.showNotification(title, tag ? { body, tag } : { body });
    return true;
  } catch (e) {
    return false;
  }
}
