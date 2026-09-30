import { JSDOM } from "jsdom";
import fs from "fs";

const indexHtml = fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const cleanedHtml = indexHtml
  .replace(/<script type="module".*?<\/script>/s, "")
  .replace(/<link rel="stylesheet".*?>/s, "");

const dom = new JSDOM(cleanedHtml, {
  url: "https://example.github.io/meus-treinos/",
  pretendToBeVisual: true,
});

const { window } = dom;

global.window = window;
global.document = window.document;
Object.defineProperty(global, "navigator", { value: window.navigator, writable: true, configurable: true });
global.localStorage = window.localStorage;
Object.defineProperty(global, "location", { value: window.location, writable: true, configurable: true });
global.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener(){}, addListener(){} }));
window.matchMedia = global.matchMedia;
global.CustomEvent = window.CustomEvent;
global.HTMLElement = window.HTMLElement;
global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.MutationObserver = window.MutationObserver;
global.getComputedStyle = window.getComputedStyle.bind(window);
global.Element = window.Element;
global.Node = window.Node;

navigator.serviceWorker = {
  register: async () => ({ addEventListener() {}, waiting: null }),
  addEventListener() {},
  controller: null,
};

global.fetch = async (url) => {
  const u = String(url);
  if (u.includes("users.json")) {
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(new URL("../dist/users.json", import.meta.url), "utf8")) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

const errors = [];
process.on("unhandledRejection", (e) => errors.push("(promise) " + (e && e.stack || e)));
window.addEventListener("error", (e) => errors.push((e.error && e.error.stack) || e.message));

try {
  await import("../dist/app.js");
} catch (e) {
  errors.push("(import síncrono) " + e.stack);
}

await new Promise((r) => setTimeout(r, 800));

console.log("=== erros capturados ===");
console.log(errors.length ? errors.join("\n---\n") : "(nenhum)");
const appEl = document.getElementById("app");
console.log("=== #app innerHTML (primeiros 800 chars) ===");
console.log(appEl ? appEl.innerHTML.slice(0, 800) : "#app não encontrado");
process.exit(errors.length ? 1 : 0);
