import { JSDOM } from "jsdom";
import fs from "fs";
import crypto from "crypto";

const indexHtml = fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const cleanedHtml = indexHtml
  .replace(/<script type="module".*?<\/script>/s, "")
  .replace(/<link rel="stylesheet".*?>/s, "");

const dom = new JSDOM(cleanedHtml, { url: "https://example.github.io/meus-treinos/", pretendToBeVisual: true });
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

// senha de teste conhecida — recria exatamente o sha256Hex(salt+senha) do próprio app
const SALT = "abc123";
const PASSWORD = "testpass";
const hash = crypto.createHash("sha256").update(SALT + PASSWORD, "utf8").digest("hex");
const FAKE_USERS = { users: [{ username: "teste", name: "Usuário Teste", salt: SALT, hash }] };

global.fetch = async (url) => {
  const u = String(url);
  if (u.includes("users.json")) return { ok: true, json: async () => FAKE_USERS };
  return { ok: false, status: 404, json: async () => ({}) };
};

const errors = [];
process.on("unhandledRejection", (e) => errors.push("(promise) " + (e && e.stack || e)));
window.addEventListener("error", (e) => errors.push((e.error && e.error.stack) || e.message));

await import("../dist/app.js");
await new Promise((r) => setTimeout(r, 500));

const userInput = document.getElementById("loginUser");
const passInput = document.getElementById("loginPass");
const submitBtn = document.getElementById("loginSubmit");

function setNativeValue(el, value) {
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc.set.call(el, value);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}

if (!userInput || !passInput || !submitBtn) {
  console.log("FALHA: campos de login não encontrados. innerHTML:", document.getElementById("app").innerHTML.slice(0, 300));
  process.exit(1);
}

setNativeValue(userInput, "teste");
setNativeValue(passInput, PASSWORD);
submitBtn.click();

await new Promise((r) => setTimeout(r, 800));

console.log("=== erros capturados ===");
console.log(errors.length ? errors.join("\n---\n") : "(nenhum)");

const appEl = document.getElementById("app");
const tabBar = document.getElementById("tabBar");
const loggedIn = !appEl.innerHTML.includes("login-wrap");
console.log("logou (saiu da tela de login)?", loggedIn);
console.log("tabBar tem botões?", tabBar.children.length, "botões");
console.log("=== #app innerHTML (primeiros 1000 chars) ===");
console.log(appEl.innerHTML.slice(0, 1000));

process.exit(errors.length || !loggedIn ? 1 : 0);
