import { THEME_KEY } from "./data/constants.js";

/* Cor da barra do navegador/PWA (<meta name="theme-color">) de cada tema.
   Tem de ser igual ao --bg do tema em src/styles/tokens.css — e o claro também
   é o valor estático do index.html. tests/tokens.test.mjs confere os três. */
export const THEME_COLOR = { light: "#f3f2ef", dark: "#0e0b12" };

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
      meta.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
    }
  } catch (e) {}
}
