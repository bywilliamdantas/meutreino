/* Ampliação da imagem do exercício + fallback das miniaturas.
   Tudo por ouvintes delegados no document (as listas são re-renderizadas via innerHTML o tempo todo).
   O modal vive em #exLightbox, fora do sistema de painéis (store.overlay): assim abre POR CIMA do
   painel do treino sem fechá-lo, e fechar o modal não mexe no treino em andamento. */
import { EXERCISE_IMAGE_SOURCES, exerciseImageUrl, markImageFailed } from "../exercises/exercise-images.js";
import { escapeAttr, escapeHtml } from "../utils/dom.js";

const ROOT_ID = "exLightbox";
let opener = null;

export function isLightboxOpen() {
  return !!document.getElementById(ROOT_ID);
}

export function closeExerciseLightbox() {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  root.remove();
  document.documentElement.classList.remove("ex-lightbox-open");
  const back = opener;
  opener = null;
  if (back && back.isConnected && typeof back.focus === "function") {
    try {
      back.focus({ preventScroll: true });
    } catch (e) {}
  }
}

function frameHtml(id, frame, label) {
  return `<figure class="exlb-frame" data-frame="${frame}">
    <img class="exlb-img" src="${escapeAttr(exerciseImageUrl(id, frame, 0))}" alt="${escapeAttr(label)}" decoding="async" draggable="false" data-exid-img="${escapeAttr(id)}" data-src-idx="0" data-big="1">
    <figcaption>${frame === 0 ? "Início" : "Fim"}</figcaption>
  </figure>`;
}

export function openExerciseLightbox(id, name, from) {
  if (!id) return;
  closeExerciseLightbox();
  opener = from || null;
  const title = name || "Exercício";
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "exlb";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", `Imagem do exercício: ${title}`);
  root.innerHTML = `<div class="exlb-card">
    <div class="exlb-head">
      <span class="exlb-title">${escapeHtml(title)}</span>
      <button type="button" class="exlb-close" id="exLightboxClose" aria-label="Fechar imagem">✕</button>
    </div>
    <div class="exlb-frames">${frameHtml(id, 0, `${title} — posição inicial`)}${frameHtml(id, 1, `${title} — posição final`)}</div>
  </div>`;
  document.body.appendChild(root);
  document.documentElement.classList.add("ex-lightbox-open");
  const btn = root.querySelector("#exLightboxClose");
  if (btn) btn.focus({ preventScroll: true });
}

/* Miniatura/imagem que falhou: tenta a próxima fonte; sem mais fontes, volta ao ícone. */
function onImgError(ev) {
  const img = ev.target;
  if (!img || img.tagName !== "IMG" || !img.dataset || !img.dataset.exidImg) return;
  const id = img.dataset.exidImg;
  const frame = img.closest(".exlb-frame") ? Number(img.closest(".exlb-frame").dataset.frame) || 0 : 0;
  const next = Number(img.dataset.srcIdx || 0) + 1;
  if (next < EXERCISE_IMAGE_SOURCES.length) {
    img.dataset.srcIdx = String(next);
    img.src = exerciseImageUrl(id, frame, next);
    return;
  }
  if (img.dataset.big) {
    /* modal: some só o quadro que falhou; se os dois falharem, fecha (a miniatura vira ícone abaixo) */
    const fig = img.closest(".exlb-frame");
    if (fig) fig.hidden = true;
    const root = document.getElementById(ROOT_ID);
    if (root && ![...root.querySelectorAll(".exlb-frame")].some((f) => !f.hidden)) {
      markImageFailed(id);
      closeExerciseLightbox();
      document.querySelectorAll(`.ex-thumb img[data-exid-img="${CSS.escape(id)}"]`).forEach(toIcon);
    }
    return;
  }
  markImageFailed(id);
  /* todas as miniaturas desse exercício na tela */
  document.querySelectorAll(`.ex-thumb img[data-exid-img="${CSS.escape(id)}"]`).forEach(toIcon);
}

function toIcon(img) {
  const thumb = img.closest(".ex-thumb");
  if (!thumb) return;
  const fb = thumb.querySelector(".ex-img-fallback");
  const span = document.createElement("span");
  span.className = thumb.className.replace(/\bex-thumb-img\b/, "").replace(/\bex-zoom\b/, "").replace(/\s+/g, " ").trim();
  span.setAttribute("style", thumb.getAttribute("style") || "");
  span.innerHTML = fb ? fb.innerHTML : "";
  thumb.replaceWith(span);
}

function onClick(ev) {
  const t = ev.target;
  if (!t || typeof t.closest !== "function") return;
  const zoom = t.closest('[data-role="zoomex"]');
  if (zoom) {
    ev.preventDefault();
    ev.stopPropagation(); // não deixa o clique expandir/selecionar a linha do exercício
    openExerciseLightbox(zoom.dataset.imgId, zoom.dataset.imgName, zoom);
    return;
  }
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  if (t.closest("#exLightboxClose") || t === root) {
    ev.preventDefault();
    ev.stopPropagation();
    closeExerciseLightbox();
  } else if (!t.closest(".exlb-card")) {
    closeExerciseLightbox();
  }
}

function onKeydown(ev) {
  if (!isLightboxOpen()) return;
  if (ev.key === "Escape") {
    ev.preventDefault(); // o gerenciador de painéis ignora Esc já tratado: o treino por baixo continua aberto
    ev.stopPropagation();
    closeExerciseLightbox();
  } else if (ev.key === "Tab") {
    ev.preventDefault(); // só há o botão de fechar: o foco fica nele
    const b = document.getElementById("exLightboxClose");
    if (b) b.focus({ preventScroll: true });
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("error", onImgError, true); // "error" de <img> não borbulha: captura
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeydown, true);
}
