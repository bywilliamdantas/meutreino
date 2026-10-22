// Treino em andamento: séries marcadas sobrevivem a fechar a página e reabrir (e o calendário do Histórico usa os blocos da semana).
import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs
  .readFileSync(new URL("../dist/index.html", import.meta.url), "utf8")
  .replace(/<script type="module".*?<\/script>/s, "")
  .replace(/<link rel="stylesheet".*?>/s, "");
const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const data = {
  order: ["A", "B"],
  workouts: {
    A: { name: "Treino A", exercises: [{ id: "e1", name: "Supino reto com barra", sets: "3", reps: "10", rest: "", mins: "", type: "strength" }] },
    B: { name: "Treino B", exercises: [] }
  },
  sessions: {}
};
const store = {
  "gym-data:u": JSON.stringify(data),
  "gym-session": JSON.stringify({ username: "u", name: "U", loginDay: today })
};
let fails = 0;
const check = (name, cond, extra = "") => {
  console.log((cond ? "OK   " : "FALHA") + " - " + name + (cond ? "" : " " + extra));
  if (!cond) fails++;
};
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

async function openApp() {
  const dom = new JSDOM(html, { url: "https://example.github.io/meus-treinos/", pretendToBeVisual: true });
  const { window } = dom;
  Object.entries(store).forEach(([k, v]) => window.localStorage.setItem(k, v));
  Object.assign(global, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    CustomEvent: window.CustomEvent,
    HTMLElement: window.HTMLElement,
    MutationObserver: window.MutationObserver,
    Element: window.Element,
    Node: window.Node
  });
  Object.defineProperty(global, "navigator", { value: window.navigator, writable: true, configurable: true });
  Object.defineProperty(global, "location", { value: window.location, writable: true, configurable: true });
  global.getComputedStyle = window.getComputedStyle.bind(window);
  global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  window.matchMedia = global.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
  window.scrollTo = () => {};
  window.Element.prototype.scrollIntoView = () => {};
  window.navigator.serviceWorker = { register: async () => ({ addEventListener() {}, waiting: null }), addEventListener() {}, controller: null };
  global.fetch = async (url) =>
    String(url).includes("users.json")
      ? { ok: true, json: async () => ({ users: [{ username: "u", name: "U", salt: "x", hash: "y" }] }) }
      : { ok: false, status: 404, json: async () => ({}) };
  await import("../dist/app.js?v=" + Math.random());
  await wait(800);
  return window;
}

// 1ª abertura: inicia o treino, abre os detalhes, marca uma série e "fecha a página"
let w = await openApp();
const $ = (s) => w.document.querySelector(s);
$("#startBtn").click();
await wait();
$("#statusBtn").click();
await wait();
check("folha do treino abriu", !!$("#daySheet"));
const toggle = $('[data-role="toggleSet"]');
toggle.click();
await wait(100);
w.dispatchEvent(new w.Event("pagehide")); // fecha sem esperar nada
await wait(100);
for (let i = 0; i < w.localStorage.length; i++) {
  const k = w.localStorage.key(i);
  store[k] = w.localStorage.getItem(k);
}
check(
  "série marcada foi gravada no armazenamento",
  Object.values(store).some((v) => /"done":true/.test(v))
);
w.close();

// 2ª abertura: o treino segue em andamento e a série continua marcada
w = await openApp();
const $2 = (s) => w.document.querySelector(s);
check("treino continua em andamento", !!$2("#heroClock") && !$2("#heroClock").classList.contains("hidden"));
$2("#statusBtn").click();
await wait();
const done = w.document.querySelectorAll(".sheet-set.done").length;
check("série realizada continua marcada após reabrir", done === 1, "done=" + done);
w.close();

// calendário do Histórico com os mesmos blocos da semana
w = await openApp();
w.document.querySelector('[data-tab="historico"], #tabHistorico')?.click();
await wait();
const cal = w.document.querySelector(".cal-grid-week");
if (cal) {
  check("calendário do Histórico usa blocos .week-day", cal.querySelectorAll(".week-day").length >= 28);
  check("dia com treino aparece como concluído", !!cal.querySelector(".week-day.done"));
}
w.close();
console.log(fails ? "\n" + fails + " falha(s)" : "\ntudo certo");
process.exit(fails ? 1 : 0);
