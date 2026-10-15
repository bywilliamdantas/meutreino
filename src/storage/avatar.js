import { userId } from "../config.js";
import { inlineAvatarOf } from "../data-migrations.js";
import { store } from "../store.js";
import { ST_AVATARS, idbGet, idbPut } from "./idb.js";

export async function readAvatar(user = userId()) {
  const rec = await idbGet(ST_AVATARS, user);
  return rec && typeof rec.dataUrl === "string" && rec.dataUrl ? rec.dataUrl : null;
}

export function writeAvatar(dataUrl, user = userId()) {
  return idbPut(ST_AVATARS, { user, dataUrl, updatedAt: new Date().toISOString() });
}

/* Preenche store.avatarUrl (usado por avatarInnerHtml). Se o IndexedDB não
   responder, cai para a foto inline que ainda estiver nos dados. */
export async function loadAvatarIntoStore() {
  let url = null;
  try {
    url = await readAvatar();
  } catch (e) {}
  store.avatarUrl = url || inlineAvatarOf(store.data);
}

/* Nova foto escolhida pelo usuário. */
export async function setAvatar(dataUrl) {
  try {
    await writeAvatar(dataUrl);
    store.data.settings.avatarUrl = null;
  } catch (e) {
    // IndexedDB indisponível/cheio: mantém o comportamento antigo, sem perder a foto
    store.data.settings.avatarUrl = dataUrl;
  }
  store.avatarUrl = dataUrl;
}

/* Importar/restaurar pode trazer uma foto inline (arquivos exportados e
   backups antigos). Move para o IndexedDB e só limpa o campo depois de ler de
   volta e conferir. Se o arquivo não tem foto, a atual é mantida. */
export async function adoptInlineAvatar(data = store.data) {
  const inline = inlineAvatarOf(data);
  if (!inline) return;
  try {
    await writeAvatar(inline);
    if ((await readAvatar()) === inline) data.settings.avatarUrl = null;
  } catch (e) {}
  store.avatarUrl = inline;
}
