/* ============================================================
   Gesto de arrastar nos cards da lista de Treinos.
   - arrastar para a DIREITA revela "Editar" (à esquerda do card);
   - arrastar para a ESQUERDA revela "Delete" (à direita do card).
   Só um card fica aberto por vez. Rolagem vertical continua livre
   (touch-action: pan-y) e um toque depois de arrastar não abre o treino.
   ============================================================ */

import { haptic } from "../utils/dom.js";

export const SWIPE_ACTION_W = 92; // largura do botão revelado (px)
export const SWIPE_LOCK_PX = 10; // movimento mínimo para decidir a direção

/* Decide o estado final ao soltar o dedo. Puro (testado em tests/swipe.test.mjs).
   `from` é o estado anterior ("none" | "edit" | "delete"). */
export function swipeDecision(dx, from = "none", actionW = SWIPE_ACTION_W) {
  const base = from === "edit" ? actionW : from === "delete" ? -actionW : 0;
  const pos = base + dx;
  if (pos > actionW / 2) return "edit";
  if (pos < -actionW / 2) return "delete";
  return "none";
}

/* Limita o deslocamento visual durante o arraste (com resistência além do botão). */
export function swipeClamp(pos, actionW = SWIPE_ACTION_W) {
  const max = actionW * 1.25;
  if (pos > actionW) pos = actionW + (pos - actionW) * 0.35;
  if (pos < -actionW) pos = -actionW + (pos + actionW) * 0.35;
  return Math.max(-max, Math.min(max, pos));
}

let openRow = null;

function setState(row, state) {
  const card = row.querySelector(".workout-list-card");
  row.dataset.state = state;
  const x = state === "edit" ? SWIPE_ACTION_W : state === "delete" ? -SWIPE_ACTION_W : 0;
  if (card) card.style.transform = x ? `translateX(${x}px)` : "";
  row.querySelectorAll(".wl-swipe-action").forEach((b) => {
    const visible = (state === "edit" && b.classList.contains("edit")) || (state === "delete" && b.classList.contains("delete"));
    b.tabIndex = visible ? 0 : -1;
  });
  if (state === "none") {
    if (openRow === row) openRow = null;
  } else {
    if (openRow && openRow !== row) setState(openRow, "none");
    openRow = row;
  }
}

export function closeOpenSwipe() {
  if (openRow) setState(openRow, "none");
}

export function attachSwipe(root = document) {
  openRow = null;
  root.querySelectorAll('.wl-swipe[data-swipe="1"]').forEach((row) => {
    const card = row.querySelector(".workout-list-card");
    if (!card) return;
    row.dataset.state = "none";
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let tracking = false;
    let horizontal = null;
    let pointerId = null;

    card.addEventListener("pointerdown", (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      if (ev.target.closest("button")) return; // play e afins mantêm o toque normal
      tracking = true;
      horizontal = null;
      dx = 0;
      startX = ev.clientX;
      startY = ev.clientY;
      pointerId = ev.pointerId;
    });
    card.addEventListener("pointermove", (ev) => {
      if (!tracking || ev.pointerId !== pointerId) return;
      const mx = ev.clientX - startX;
      const my = ev.clientY - startY;
      if (horizontal === null) {
        if (Math.abs(mx) < SWIPE_LOCK_PX && Math.abs(my) < SWIPE_LOCK_PX) return;
        horizontal = Math.abs(mx) > Math.abs(my);
        if (!horizontal) {
          tracking = false;
          return;
        }
        try {
          card.setPointerCapture(pointerId);
        } catch (e) {
          /* sem captura: segue sem ela */
        }
        row.classList.add("dragging");
      }
      dx = mx;
      const st = row.dataset.state;
      const base = st === "edit" ? SWIPE_ACTION_W : st === "delete" ? -SWIPE_ACTION_W : 0;
      const pos = swipeClamp(base + dx);
      card.style.transform = `translateX(${pos}px)`;
      row.dataset.dir = pos > 0 ? "right" : pos < 0 ? "left" : "";
      ev.preventDefault();
    });
    const finish = (ev) => {
      if (!tracking || (ev && ev.pointerId !== pointerId)) return;
      tracking = false;
      row.classList.remove("dragging");
      if (horizontal) {
        row.dataset.justSwiped = "1";
        setTimeout(() => delete row.dataset.justSwiped, 350);
        const next = swipeDecision(dx, row.dataset.state);
        setState(row, next);
        if (next !== "none") haptic(6);
      }
      horizontal = null;
    };
    card.addEventListener("pointerup", finish);
    card.addEventListener("pointercancel", () => {
      if (!tracking) return;
      tracking = false;
      row.classList.remove("dragging");
      setState(row, row.dataset.state || "none");
    });
    /* Fase de captura: um toque logo após arrastar, ou com o card aberto, só fecha. */
    card.addEventListener(
      "click",
      (ev) => {
        if (row.dataset.justSwiped || row.dataset.state !== "none") {
          ev.stopImmediatePropagation();
          ev.preventDefault();
          if (!row.dataset.justSwiped) setState(row, "none");
        }
      },
      true
    );
    /* Teclado: setas abrem as ações sem precisar do gesto. */
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        setState(row, row.dataset.state === "delete" ? "none" : "edit");
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        setState(row, row.dataset.state === "edit" ? "none" : "delete");
      } else if (ev.key === "Escape") setState(row, "none");
    });
  });
}

/* Toque fora fecha o card aberto (registrado uma vez). */
if (typeof document !== "undefined" && !globalThis.__wlSwipeOutside) {
  globalThis.__wlSwipeOutside = true;
  document.addEventListener(
    "pointerdown",
    (ev) => {
      if (openRow && !openRow.contains(ev.target)) setState(openRow, "none");
    },
    true
  );
}
