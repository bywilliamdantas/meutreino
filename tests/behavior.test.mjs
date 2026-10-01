// Verifica os ajustes do sistema: login, home, ajustes, histórico, cardio e séries preservadas.
import { JSDOM } from "jsdom";
import fs from "fs";

const MODE = process.argv[2] || "app"; // "login" | "app"
const indexHtml = fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const cleanedHtml = indexHtml.replace(/<script type="module".*?<\/script>/s, "").replace(/<link rel="stylesheet".*?>/s, "");
const dom = new JSDOM(cleanedHtml, { url: "https://example.github.io/meus-treinos/", pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
Object.defineProperty(global, "navigator", { value: window.navigator, writable: true, configurable: true });
global.localStorage = window.localStorage;
Object.defineProperty(global, "location", { value: window.location, writable: true, configurable: true });
global.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
window.matchMedia = global.matchMedia;
global.CustomEvent = window.CustomEvent;
global.HTMLElement = window.HTMLElement;
global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.MutationObserver = window.MutationObserver;
global.getComputedStyle = window.getComputedStyle.bind(window);
global.Element = window.Element;
global.Node = window.Node;
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
navigator.serviceWorker = { register: async () => ({ addEventListener() {}, waiting: null }), addEventListener() {}, controller: null };
global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });

const pad = (n) => String(n).padStart(2, "0");
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const pk = (day) => key(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), day));

if (MODE === "app") {
  const sets = (n) => Array.from({ length: n }, (_, i) => ({ weight: 40 + i, reps: 10, done: true }));
  const sessions = {};
  for (let d = 1; d <= 10; d++) {
    sessions[pk(d)] = [{ id: "s" + d, letter: "A", log: d === 1 ? { e1: sets(3) } : {}, startedAt: 1, endedAt: 3600001 }];
  }
  const data = {
    order: ["A", "B", "C"],
    workouts: {
      A: { name: "Treino A", exercises: [
        { id: "e1", name: "Supino reto com barra", sets: "5", reps: "10", rest: "", mins: "", type: "strength" },
        { id: "e2", name: "Crucifixo", sets: "4", reps: "12", rest: "", mins: "", type: "strength" },
        { id: "e3", name: "Esteira", sets: "", reps: "", rest: "", mins: "20", type: "cardio" },
      ] },
      B: { name: "Treino B", exercises: [] },
      C: { name: "Treino C", exercises: [] },
    },
    sessions,
  };
  localStorage.setItem("gym-data:u", JSON.stringify(data));
  localStorage.setItem("gym-session", JSON.stringify({ username: "u", name: "U", loginDay: key(now) }));
  global.fetch = async (url) => String(url).includes("users.json")
    ? { ok: true, json: async () => ({ users: [{ username: "u", name: "U", salt: "x", hash: "y" }] }) }
    : { ok: false, status: 404, json: async () => ({}) };
}

const errors = [];
process.on("unhandledRejection", (e) => errors.push("(promise) " + (e && e.stack || e)));
window.addEventListener("error", (e) => errors.push((e.error && e.error.stack) || e.message));
await import("../dist/app.js");
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
await wait(700);

let fails = 0;
const check = (name, cond, extra = "") => { console.log((cond ? "OK   " : "FALHA") + " - " + name + (cond ? "" : " " + extra)); if (!cond) fails++; };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const tab = async (id) => { $(`[data-role="gotab"][data-tab="${id}"]`).click(); await wait(); };
const stored = () => JSON.parse(localStorage.getItem("gym-data:u"));

if (MODE === "login") {
  const c = $(".login-copyright");
  check("7. copyright visível na tela de login", !!c && /William Dantas/.test(c.textContent) && /2026/.test(c.textContent), c && c.textContent);
  check("7. copyright fica no fim da tela (depois do rodapé)", $(".login-footer").nextElementSibling === c);
} else {
  // 3. home sem as seções
  check("3. home sem 'Último recorde'", !$("#goLastRecord") && !/Último recorde/.test($("#app").textContent));
  check("3. home sem 'Registrar peso' / 'Ver histórico'", !$("#qaWeight") && !$("#qaHistory"));
  check("4. Iniciar e Detalhes existem", !!$("#startBtn") && !!$("#statusBtn"));
  const css = fs.readFileSync(new URL("../src/styles/design.css", import.meta.url), "utf8") + fs.readFileSync(new URL("../src/styles/home.css", import.meta.url), "utf8");
  check("4. botões do hero com colunas iguais", !/hero-v2-actions\{[^}]*(1\.[0-9]+fr 1fr)/.test(css));

  // 6. Ajustes
  await tab("ajustes");
  const titles = $$(".section-title").map((e) => e.textContent.trim());
  check("6. ordem das seções de Ajustes", JSON.stringify(titles) === JSON.stringify(["Conta", "Treino", "Aparência", "Dados e backup", "Sobre o app"]), JSON.stringify(titles));
  check("6. 'Sobre o app' tem versão e botão Atualizar", !!$("#checkUpdateBtn") && !!$("#appVersionText"));
  $("#openDadosBackupBtn").click(); await wait();
  check("6. página Dados e Backup sem 'Sobre o app'", !/Sobre o app/i.test($("#app").textContent) && !$("#checkUpdateBtn"));
  $("#dadosBackupBackBtn").click(); await wait();

  // 5. Histórico compacto
  await tab("historico");
  $("#calPrevBtn").click(); await wait();
  check("5. mês com 10 dias mostra só 5 inicialmente", $$(".month-session-row").length === 5, String($$(".month-session-row").length));
  check("5. resumo do mês", /10 dias · 10 treinos/.test($(".month-sessions-summary")?.textContent || ""), $(".month-sessions-summary")?.textContent);
  $("#monthSessionsToggle").click(); await wait();
  check("5. 'Ver todas' expande para 10", $$(".month-session-row").length === 10);
  $("#monthSessionsToggle").click(); await wait();
  check("5. 'Mostrar menos' recolhe", $$(".month-session-row").length === 5);

  // 1. séries preservadas
  $("#monthSessionsToggle").click(); await wait();
  const row = $$(".month-session-row").find((r) => r.dataset.datekey === pk(1));
  row.click(); await wait();
  check("1. sessão antiga mostra só o exercício registrado", $$(".sheet-ex-row").length === 1, String($$(".sheet-ex-row").length));
  check("1. sessão antiga mantém 3 séries (treino atual tem 5)", $$(".sheet-set").length === 3, String($$(".sheet-set").length));
  $$('[data-role="rplus"]')[0].click(); await wait(500);
  const s1 = stored().sessions[pk(1)][0];
  check("1. após editar, séries salvas continuam 3", s1.log.e1.length === 3 && Object.keys(s1.log).join() === "e1", JSON.stringify(Object.keys(s1.log)) + s1.log.e1.length);
  check("1. sessão guarda foto do treino (snapshot)", Array.isArray(s1.snapshot) && s1.snapshot[0]?.name === "Supino reto com barra");
  $$('[data-role="sheetletter"]')[1].click(); await wait();
  check("1. trocar letra de treino registrado é bloqueado", stored().sessions[pk(1)][0].letter === "A");
  $("#sheetClose").click(); await wait();

  // 2. cardio
  await tab("treinos");
  $('[data-role="openworkout"][data-letter="B"]').click(); await wait();
  $('[data-role="addex"]').click(); await wait();
  const groups = $$(".ex-picker-group-title span:first-child").map((e) => e.textContent);
  check("2. grupo Cardio na lista de exercícios", groups.includes("Cardio"), groups.join());
  const input = $("#exPickerSearch");
  for (const name of ["Esteira", "Bicicleta", "Escada"]) {
    input.value = name; input.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(100);
    check(`2. '${name}' disponível`, $$(".ex-picker-item span").some((s) => s.textContent.trim() === name));
  }
  for (const name of ["Esteira", "Escada"]) {
    input.value = name; input.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(100);
    const cb = $$('.ex-picker-item input[type="checkbox"][data-name]').find((c) => c.dataset.name === name);
    cb.checked = true; cb.dispatchEvent(new window.Event("change", { bubbles: true }));
  }
  $("#exPickerConfirm").click(); await wait(400);
  const exs = stored().workouts.B.exercises;
  check("2. exercícios de cardio entram com tipo cardio", exs.length === 2 && exs.every((e) => e.type === "cardio"), JSON.stringify(exs.map((e) => e.type)));
}
check("sem erros de JavaScript", errors.length === 0, errors.join("\n"));
process.exit(fails ? 1 : 0);
