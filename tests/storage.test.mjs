// Migração localStorage → IndexedDB (avatar + backups automáticos) e medidor de espaço.
// Modos: migrate | failure | usage | restore
import "fake-indexeddb/auto";
import { JSDOM } from "jsdom";
import fs from "fs";

const MODE = process.argv[2] || "migrate";
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
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const AVATAR = "data:image/jpeg;base64," + "A".repeat(20000);

const mkData = (n) => ({
  order: ["A", "B", "C"],
  workouts: { A: { name: "Treino A", exercises: [{ id: "e1", name: "Supino", type: "strength" }] }, B: { name: "B", exercises: [] }, C: { name: "C", exercises: [] } },
  sessions: { "2026-09-01": [{ id: "s" + n, letter: "A", log: { e1: [{ weight: 40 + n, reps: 10, done: true }] }, startedAt: 1, endedAt: 2, snapshot: [{ id: "e1", name: "Supino", type: "strength" }] }] },
  body: [], schemaVersion: 3,
  settings: { avatarUrl: AVATAR, unit: "kg" },
});
const legacyBackups = [4, 3, 2, 1, 0].map((n) => ({ date: `2026-09-0${n + 1}`, at: `2026-09-0${n + 1}T10:00:00.000Z`, sessions: 1, data: mkData(n) }));
const legacyRaw = JSON.stringify(legacyBackups);

localStorage.setItem("gym-data:u", JSON.stringify(mkData(9)));
localStorage.setItem("gym-autobackups:u", legacyRaw);
localStorage.setItem("gym-session", JSON.stringify({ username: "u", name: "U", loginDay: today }));

if (MODE === "failure") {
  // IndexedDB recusa gravar backups (ex.: cota) — a cópia antiga TEM de sobreviver.
  const origPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...a) {
    if (this.name === "autobackups") throw new DOMException("cota", "QuotaExceededError");
    return origPut.apply(this, a);
  };
}
if (MODE === "usage") {
  localStorage.setItem("gym-big", "x".repeat(Math.round(5 * 1024 * 1024 * 0.4))); // 0,4 M chars ≈ 0,8*5MB... força >70%
  navigator.storage = { estimate: async () => ({ usage: 50, quota: 100 }), persisted: async () => true, persist: async () => true };
}

global.fetch = async (url) => String(url).includes("users.json")
  ? { ok: true, json: async () => ({ users: [{ username: "u", name: "U", salt: "x", hash: "y" }] }) }
  : { ok: false, status: 404, json: async () => ({}) };

const errors = [];
process.on("unhandledRejection", (e) => errors.push("(promise) " + (e && e.stack || e)));
window.addEventListener("error", (e) => errors.push((e.error && e.error.stack) || e.message));
await import("../dist/app.js");
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
await wait(900);

let fails = 0;
const check = (name, cond, extra = "") => { console.log((cond ? "OK   " : "FALHA") + " - " + name + (cond ? "" : " " + extra)); if (!cond) fails++; };
const $ = (s) => document.querySelector(s);
const idb = (store, key) => new Promise((res, rej) => {
  const o = indexedDB.open("meus-treinos");
  o.onsuccess = () => { const r = o.result.transaction(store).objectStore(store)[key === "*" ? "getAll" : "get"](...(key === "*" ? [] : [key])); r.onsuccess = () => { o.result.close(); res(r.result); }; r.onerror = () => rej(r.error); };
  o.onerror = () => rej(o.error);
});
const mainStored = () => JSON.parse(localStorage.getItem("gym-data:u"));
const openDados = async () => {
  $('[data-role="gotab"][data-tab="ajustes"]').click(); await wait();
  $("#openDadosBackupBtn").click(); await wait(500);
};

if (MODE === "migrate") {
  const bk = await idb("autobackups", "*");
  check("5 backups copiados para o IndexedDB", bk.length === 5, String(bk.length));
  // a abertura de hoje cria 1 backup novo e a poda (máx. 5) descarta o mais antigo, como antes
  check("4 backups antigos mais recentes idênticos ao original", legacyBackups.slice(0, 4).every((b) => bk.some((r) => r.at === b.at && JSON.stringify(r.data) === JSON.stringify(b.data))));
  check("backup de hoje criado depois da migração", bk.some((r) => r.date === today));
  check("backup novo não carrega a foto", bk.filter((r) => r.date === today).every((r) => r.data.settings.avatarUrl === null));
  check("cópia antiga dos backups removida do localStorage (só após confirmar)", localStorage.getItem("gym-autobackups:u") === null);
  const av = await idb("avatars", "u");
  check("avatar no IndexedDB, idêntico", av && av.dataUrl === AVATAR);
  check("avatar removido do JSON principal", mainStored().settings.avatarUrl === null);
  check("histórico de sessões e snapshot intactos", JSON.stringify(mainStored().sessions) === JSON.stringify(mkData(9).sessions));
  check("schemaVersion 4", mainStored().schemaVersion === 4);
  const meta = await idb("meta", "migration:u");
  check("registro de migração gravado", !!meta && meta.backups === 5 && meta.avatar === "moved", JSON.stringify(meta));
  check("avatar aparece na tela", !!$("img.avatar-img") && $("img.avatar-img").getAttribute("src") === AVATAR);
  check("hoje não gerou backup extra além do limite de 5", bk.length <= 5);
  await openDados();
  check("cartão de espaço em uso aparece", !!$("#storageUsageCard .usage-bar"));
  check("contador de backups = 5", /5 cópia/.test($("#autoBackupCountText").textContent), $("#autoBackupCountText").textContent);
  $("#openBackupsBtn").click(); await wait(500);
  check("tela de backups lista as 5 cópias", document.querySelectorAll('[data-role="restorebackup"]').length === 5, String(document.querySelectorAll('[data-role="restorebackup"]').length));
}

if (MODE === "failure") {
  check("falha no IndexedDB: cópia antiga dos backups preservada", localStorage.getItem("gym-autobackups:u") === legacyRaw);
  check("falha no IndexedDB: nenhum backup perdido na lista", (await (async () => { await openDados(); $("#openBackupsBtn").click(); await wait(500); return document.querySelectorAll('[data-role="restorebackup"]').length; })()) === 5);
  check("avatar migrou mesmo assim (falha foi só nos backups)", mainStored().settings.avatarUrl === null && (await idb("avatars", "u"))?.dataUrl === AVATAR);
  $("#sheetClose")?.click(); await wait();
  check("erro de backup fica visível em Dados e backup", /backup automático/.test($("#storageUsageCard")?.textContent || ""), $("#storageUsageCard")?.textContent);
}

if (MODE === "usage") {
  await openDados();
  const card = $("#storageUsageCard");
  check("aviso aparece acima de 70%", !!card.querySelector(".usage-alert"), card.textContent);
  check("aviso cita o limite de ~5 MB", /5 MB/.test(card.textContent));
  check("segunda barra (cota do aparelho) com 50%", /50%/.test(card.textContent), card.textContent);
}

check("sem erros de JavaScript", errors.length === 0, errors.join("\n"));
process.exit(fails ? 1 : 0);
