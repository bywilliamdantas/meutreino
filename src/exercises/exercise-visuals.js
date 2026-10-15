import { EX_CATEGORY_RULES } from "../data/exercise-category-rules.js";
import { ICONS } from "../data/icons.js";
import { isCardio } from "../utils/numbers.js";
import { toneVars } from "../ui/helpers.js";
import { escapeAttr } from "../utils/dom.js";
import { exerciseImageId, exerciseImageUrl, imageFailed } from "./exercise-images.js";

export function exerciseVisual(ex) {
  if (isCardio(ex))
    return {
      icon: ICONS.cardio,
      color: "var(--cat-cardio)",
      soft: "var(--cat-cardio-soft)"
    };
  const name = (ex && ex.name) || "";
  for (const r of EX_CATEGORY_RULES) {
    if (r.test.test(name))
      return {
        icon: ICONS[r.icon],
        color: r.color,
        soft: r.soft
      };
  }
  return {
    icon: ICONS.dumbbell,
    color: "var(--cat-default)",
    soft: "var(--cat-default-soft)"
  };
}

/* Miniatura do exercício: foto quando existe (e carrega); senão o ícone da categoria.
   opts.zoom = true deixa a foto clicável (abre o modal de ampliação).
   O <img> não tem handler próprio: se falhar, o ouvinte global (ui/exercise-lightbox.js)
   troca de fonte e, por fim, de volta para o ícone — nunca fica espaço vazio. */
export function exThumbHtml(ex, size, opts) {
  const v = exerciseVisual(ex);
  const sm = size === "sm";
  const iconHtml = `<span class="${sm ? "ex-thumb ex-thumb-sm" : "ex-thumb"}" style="${toneVars(v.color, v.soft)}">${v.icon}</span>`;
  const id = isCardio(ex) ? null : exerciseImageId(ex && ex.name);
  if (!id || imageFailed(id)) return iconHtml;
  const cls = `ex-thumb ex-thumb-img${sm ? " ex-thumb-sm" : ""}`;
  const tone = toneVars(v.color, v.soft);
  const img = `<img class="ex-img" src="${escapeAttr(exerciseImageUrl(id, 0, 0))}" alt="" loading="lazy" decoding="async" draggable="false" data-exid-img="${escapeAttr(id)}" data-src-idx="0">`;
  const fallback = `<span class="ex-img-fallback" hidden>${v.icon}</span>`;
  if (opts && opts.zoom) {
    const label = `Ampliar imagem: ${(ex && ex.name) || "exercício"}`;
    return `<button type="button" class="${cls} ex-zoom" style="${tone}" data-role="zoomex" data-img-id="${escapeAttr(id)}" data-img-name="${escapeAttr((ex && ex.name) || "")}" aria-label="${escapeAttr(label)}">${img}${fallback}</button>`;
  }
  return `<span class="${cls}" style="${tone}">${img}${fallback}</span>`;
}
