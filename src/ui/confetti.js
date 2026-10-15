import { prefersReducedMotion } from "../utils/dom.js";

// Confete discreto para recordes pessoais (respeita reduced-motion).
// As cores vêm dos tokens (tokens.css) e são resolvidas pelo CSS na hora de pintar.
export const CONFETTI_COLORS = ["var(--accent)", "var(--gold)", "var(--violet)", "var(--ok)", "var(--info)"];

export function confetti() {
  if (prefersReducedMotion()) return;
  const colors = CONFETTI_COLORS;
  const box = document.createElement("div");
  box.className = "confetti";
  for (let i = 0; i < 28; i++) {
    const p = document.createElement("i");
    p.style.cssText = `left:${10 + Math.random() * 80}%;background:${colors[i % 5]};--dx:${(Math.random() - 0.5) * 160}px;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * 0.15}s`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1800);
}
