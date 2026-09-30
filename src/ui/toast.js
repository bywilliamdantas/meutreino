import { store } from "../store.js";

export function showToast(msg, action) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-action";
    b.textContent = action.label;
    b.addEventListener("click", () => {
      clearTimeout(store.toastTimer);
      t.classList.remove("show");
      action.fn();
    });
    t.appendChild(b);
  }
  t.classList.add("show");
  clearTimeout(store.toastTimer);
  store.toastTimer = setTimeout(() => t.classList.remove("show"), action ? 6500 : 2400);
}
