export function parseNum(v) {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

export function roundToStep(v, step) {
  if (v == null) return null;
  return Math.round(v / step) * step;
}

export function isWork(s) {
  return !!s && s.type !== "warm";
}

export function isPerformed(s) {
  if (!s) return false;
  if (s.done === true) return true;
  if (s.done === false) return false;
  return s.weight != null || s.reps != null || s.minutes != null;
}

export function e1rm(w, r) {
  if (!(w > 0)) return 0;
  if (!(r > 1)) return w;
  return w * (1 + r / 30);
}

export function isCardio(ex) {
  return ex && ex.type === "cardio";
}

/* ---------- SVG do músculo (hero) ---------- */
