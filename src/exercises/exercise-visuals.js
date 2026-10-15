import { EX_CATEGORY_RULES } from "../data/exercise-category-rules.js";
import { ICONS } from "../data/icons.js";
import { isCardio } from "../utils/numbers.js";
import { toneVars } from "../ui/helpers.js";

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

export function exThumbHtml(ex, size) {
  const v = exerciseVisual(ex);
  const cls = size === "sm" ? "ex-thumb ex-thumb-sm" : "ex-thumb";
  return `<span class="${cls}" style="${toneVars(v.color, v.soft)}">${v.icon}</span>`;
}
