import { THEME_KEY } from "./data/constants.js";

export function getThemePref() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark" || t === "auto") return t;
  } catch (e) {}
  return "auto";
}

export function applyTheme(pref) {
  try {
    if (pref === "auto") {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(THEME_KEY);
    } else {
      document.documentElement.dataset.theme = pref;
      localStorage.setItem(THEME_KEY, pref);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const dark = pref === "dark" || pref === "auto" && !window.matchMedia("(prefers-color-scheme: light)").matches;
      meta.setAttribute("content", dark ? "#000000" : "#ffffff");
    }
  } catch (e) {}
}
