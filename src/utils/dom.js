export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

export function escapeAttr(s) {
  return escapeHtml(s);
}

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function haptic(pattern = 10) {
  if (navigator.vibrate && !prefersReducedMotion()) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

export function safeUrl(u) {
  if (!u) return "";
  let s = String(u).trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const x = new URL(s);
    return x.protocol === "http:" || x.protocol === "https:" ? x.href : "";
  } catch (e) {
    return "";
  }
}
