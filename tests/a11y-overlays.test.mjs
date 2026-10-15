// Etapa 11 — painéis acessíveis: foco para dentro, Tab preso, Esc fecha, foco volta ao botão de origem,
// fundo inert, aria-labelledby, aviso aria-live do timer e botões só-ícone (aria-label + alvo de 44px).
// Roda no jsdom sobre o dist/ (como o behavior.test). Não há layout no jsdom: o tamanho real dos alvos
// foi conferido num Chromium (ver relatório da etapa); aqui o CSS é checado por texto.
import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const walk = (dir, ext, out = []) => {
  for (const f of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, ext, out);
    else if (ext.some((e) => f.name.endsWith(e))) out.push(p);
  }
  return out;
};
let fails = 0;
const check = (name, cond, extra = "") => {
  console.log((cond ? "OK   " : "FALHA") + " - " + name + (cond ? "" : " " + extra));
  if (!cond) fails++;
};

/* ---------- estático: botões só-ícone têm aria-label e alvo de 44px no CSS ---------- */
const css = walk("src/styles", [".css"])
  .map(read)
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const rulesFor = (cls, pseudo = "") =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) =>
      sel.split(",").some((x) =>
        x
          .trim()
          .replace(/\s+/g, " ")
          .endsWith("." + cls + pseudo)
      )
    )
    .map(([, , body]) => body);
const uses = (bodies, props) => bodies.some((b) => props.some((p) => new RegExp("(^|[;\\s])" + p + "\\s*:[^;]*var\\(--tap\\)").test(b)));
const boxOk = (cls) => uses(rulesFor(cls), ["width", "min-width"]) && uses(rulesFor(cls), ["height", "min-height"]);
const hitOk = (cls) => uses(rulesFor(cls, "::after"), ["inset"]);
// classes com alvo de 44px por caixa real ou por área invisível (::after)
const TAP_BOX = ["icon-btn", "progress-btn", "ex-del", "cal-nav", "sds-del", "reorder-btn", "greet-bell", "greet-avatar", "pw-toggle", "ex-link", "wl-play", "tab-title-add"];
const TAP_HIT = ["sheet-set-check", "perfil-avatar-edit"];
TAP_BOX.forEach((c) => check(`alvo 44px (caixa): .${c}`, boxOk(c)));
TAP_HIT.forEach((c) => check(`alvo 44px (área extra ::after): .${c}`, hitOk(c)));
check("alvo 44px: .tool-btn.icon", boxOk("icon"));
check(
  "alvo 44px: .step-btn tem altura 44 e, nos ajustes (.compact), largura 44",
  uses(rulesFor("step-btn"), ["height"]) && uses(rulesFor("step-btn").concat(css.match(/\.step-group\.compact \.step-btn\{[^}]*\}/g) || []), ["width"])
);

const ICON_ONLY = /<(button|a)\b([^>]*)>\s*(\$\{ICONS\.\w+\}|[−+×])\s*<\/\1>/g;
const known = new Set([...TAP_BOX, ...TAP_HIT, "tool-btn", "step-btn"]);
const found = [];
for (const f of walk("src", [".js"])) for (const m of read(f).matchAll(ICON_ONLY)) found.push({ f, attrs: m[2] });
check("estático: há botões só-ícone nos templates", found.length > 10, String(found.length));
check(
  "estático: todo botão só-ícone tem aria-label",
  found.every((x) => /aria-label=/.test(x.attrs)),
  found
    .filter((x) => !/aria-label=/.test(x.attrs))
    .map((x) => x.f)
    .join(", ")
);
const unknown = found.map((x) => /class="([^"]*)"/.exec(x.attrs)?.[1] || "").filter((c) => c && !c.split(/\s+/).some((k) => known.has(k)));
check("estático: toda classe de botão só-ícone tem alvo de 44px declarado neste teste", unknown.length === 0, unknown.join(", "));
const dialogs = walk("src", [".js"]).flatMap((f) => [...read(f).matchAll(/<div class="sheet" role="dialog"[^>]*>/g)].map((m) => f + " " + m[0]));
check(
  "estático: todo role=dialog tem aria-modal e aria-labelledby",
  dialogs.length >= 10 && dialogs.every((d) => /aria-modal="true"/.test(d) && /aria-labelledby="[^"]+"/.test(d)),
  dialogs.join("\n")
);

/* ---------- jsdom ---------- */
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
global.KeyboardEvent = window.KeyboardEvent;
global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.MutationObserver = window.MutationObserver;
global.getComputedStyle = window.getComputedStyle.bind(window);
global.Element = window.Element;
global.Node = window.Node;
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
navigator.serviceWorker = { register: async () => ({ addEventListener() {}, waiting: null }), addEventListener() {}, controller: null };

const pad = (n) => String(n).padStart(2, "0");
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const pk = (day) => key(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), day));
const sets = (n) => Array.from({ length: n }, (_, i) => ({ weight: 40 + i, reps: 10, done: true }));
const sessions = {};
for (let d = 1; d <= 5; d++) sessions[pk(d)] = [{ id: "s" + d, letter: "A", log: d <= 3 ? { e1: sets(3) } : {}, startedAt: 1, endedAt: 3600001 }];
sessions[pk(2)].push({ id: "s2b", letter: "B", log: {}, startedAt: 1, endedAt: 1800001 });
const data = {
  order: ["A", "B", "C"],
  workouts: {
    A: {
      name: "Treino A",
      exercises: [
        { id: "e1", name: "Supino reto com barra", sets: "3", reps: "10", rest: "1", mins: "", type: "strength" },
        { id: "e3", name: "Esteira", sets: "", reps: "", rest: "", mins: "20", type: "cardio" }
      ]
    },
    B: { name: "Treino B", exercises: [] },
    C: { name: "Treino C", exercises: [] }
  },
  sessions,
  body: [{ id: "b1", date: pk(1), weight: 80 }]
};
localStorage.setItem("gym-data:u", JSON.stringify(data));
localStorage.setItem("gym-session", JSON.stringify({ username: "u", name: "U", loginDay: key(now) }));
global.fetch = async (url) =>
  String(url).includes("users.json")
    ? { ok: true, json: async () => ({ users: [{ username: "u", name: "U", salt: "x", hash: "y" }] }) }
    : { ok: false, status: 404, json: async () => ({}) };

const errors = [];
process.on("unhandledRejection", (e) => errors.push("(promise) " + ((e && e.stack) || e)));
window.addEventListener("error", (e) => errors.push((e.error && e.error.stack) || e.message));
await import("../dist/app.js");
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
await wait(700);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const tab = async (id) => {
  $(`[data-role="gotab"][data-tab="${id}"]`).click();
  await wait();
};
const dialog = () => $('#sheetRoot [role="dialog"]');
const inDialog = () => !!dialog() && dialog().contains(document.activeElement);
const keydown = (k, opts = {}) => {
  const ev = new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts });
  (document.activeElement || document.body).dispatchEvent(ev);
  return ev;
};
const tabbables = () =>
  $$('#sheetRoot button:not([disabled]), #sheetRoot input, #sheetRoot select, #sheetRoot textarea, #sheetRoot [tabindex="0"], #sheetRoot a[href]');
const mutedOk = () => ["inert", "aria-hidden"].every((a) => $(".screen").hasAttribute(a) && $("#tabBar").hasAttribute(a));
const labelOf = (d) =>
  (d.getAttribute("aria-labelledby") || "")
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent.trim() || "")
    .join(" ")
    .trim();
const openFrom = async (el) => {
  el.focus();
  el.click();
  await wait();
};

async function suite(name, open, { opener } = {}) {
  const el = opener();
  await openFrom(el);
  const d = dialog();
  check(`${name}: painel abriu com role=dialog e aria-modal`, !!d && d.getAttribute("aria-modal") === "true");
  check(`${name}: aria-labelledby aponta para um título não vazio`, !!d && labelOf(d).length > 2, d && labelOf(d));
  check(`${name}: foco foi para dentro do painel`, inDialog(), String(document.activeElement && document.activeElement.outerHTML.slice(0, 60)));
  check(`${name}: fundo (.screen e tabbar) ficou inert + aria-hidden`, mutedOk());
  check(
    `${name}: região aria-live e timer não ficam inert`,
    !$("#restLive").hasAttribute("inert") && !$("#restLive").closest("[aria-hidden]") && !$("#restTimerRoot").hasAttribute("inert")
  );
  const items = tabbables();
  items[items.length - 1].focus();
  let ev = keydown("Tab");
  check(
    `${name}: Tab no último elemento volta ao primeiro (não escapa)`,
    ev.defaultPrevented && document.activeElement === items[0],
    String(document.activeElement && document.activeElement.id)
  );
  ev = keydown("Tab", { shiftKey: true });
  check(`${name}: Shift+Tab no primeiro vai ao último`, ev.defaultPrevented && document.activeElement === items[items.length - 1]);
  $(".screen").querySelector("button, a, input")?.focus?.();
  document.dispatchEvent(new window.Event("focusin", { bubbles: true }));
  const outside = $("#tabBar button");
  outside.focus();
  outside.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
  check(`${name}: foco que vaza para o fundo volta para o painel`, inDialog());
  keydown("Escape");
  await wait(60);
  check(`${name}: Esc fecha o painel`, !dialog() && $("#sheetRoot").innerHTML === "");
  check(
    `${name}: fundo deixa de ser inert`,
    !$(".screen").hasAttribute("inert") && !$(".screen").hasAttribute("aria-hidden") && !$("#tabBar").hasAttribute("inert")
  );
  const back = (el.id && document.getElementById(el.id)) || el;
  check(
    `${name}: foco volta ao botão de origem`,
    document.activeElement === back || (el.dataset.role && document.activeElement.dataset.role === el.dataset.role),
    String(document.activeElement && document.activeElement.outerHTML.slice(0, 80))
  );
}

// Painéis de dentro das abas
await tab("treinos");
$('[data-role="openworkout"][data-letter="A"]').click();
await wait();
await suite("progresso", null, { opener: () => $('[data-role="viewprogress"]:not([disabled])') });
await tab("historico");
$("#calPrevBtn").click();
await wait();
await suite("sessões do dia (2 treinos)", null, { opener: () => $(`[data-role="calday"][data-key="${pk(2)}"]`) });
await suite("painel do dia", null, { opener: () => $(`[data-role="calday"][data-key="${pk(3)}"]`) });
await tab("progresso");
if ($("#openBodyBtn")) await suite("peso e medidas", null, { opener: () => $("#openBodyBtn") });
await tab("ajustes");
$("#openDadosBackupBtn").click();
await wait();
await suite("backups", null, { opener: () => $("#openBackupsBtn") });
await suite("confirmação", null, { opener: () => $("#hardRefreshBtn") });

// Confirmação: abre em "Cancelar"; fechar não executa a ação
$("#hardRefreshBtn").focus();
$("#hardRefreshBtn").click();
await wait();
check("confirmação: foco inicial em Cancelar (ação segura)", document.activeElement && document.activeElement.id === "confirmNo");
check("confirmação: rótulo é a própria mensagem", /Limpar o cache/.test(labelOf(dialog())));
$("#confirmNo").click();
await wait(60);
check("confirmação: Cancelar devolve o foco ao botão de origem", document.activeElement.id === "hardRefreshBtn");

// Re-render do mesmo painel não perde o foco dentro dele
await tab("historico");
$(`[data-role="calday"][data-key="${pk(3)}"]`).click();
await wait();
const chipB = $('[data-role="sheetletter"][data-letter="B"]');
chipB.focus();
chipB.click();
await wait(60);
check(
  "re-render do painel do dia mantém o foco no mesmo chip",
  inDialog() && document.activeElement.dataset.letter === "B",
  String(document.activeElement && document.activeElement.outerHTML.slice(0, 80))
);
keydown("Escape");
await wait(60);

// Painel aberto sem foco prévio (toque no Safari): origem vem do último clique
document.activeElement && document.activeElement.blur && document.activeElement.blur();
const day4 = $(`[data-role="calday"][data-key="${pk(4)}"]`);
day4.click();
await wait(60);
keydown("Escape");
await wait(60);
check(
  "origem sem foco (Safari/iOS): volta ao último elemento tocado",
  document.activeElement && document.activeElement.dataset.key === pk(4),
  String(document.activeElement && document.activeElement.outerHTML.slice(0, 80))
);

/* ---------- timer de descanso: aria-live sem roubar foco ---------- */
const live = $("#restLive");
check("timer: #restLive existe com aria-live=polite", !!live && live.getAttribute("aria-live") === "polite");
// marca uma série (não a última) no painel do dia: o descanso de 1s começa e termina sozinho
await tab("historico");
$(`[data-role="calday"][data-key="${pk(3)}"]`).click();
await wait();
const setBtns = $$('[data-role="toggleSet"]');
setBtns[0].click();
await wait(60); // desmarca
setBtns[0].click();
await wait(100); // marca de novo -> inicia o descanso
const timerShown = !!$(".rest-timer");
check("timer: descanso iniciou ao marcar a série", timerShown);
const afterStart = document.activeElement;
check("timer: botões do timer ficam no ciclo do Tab e não inert", !$("#restTimerRoot").closest("[inert]"));
if (timerShown) {
  const timerBtns = $$("#restTimerRoot button");
  const items = tabbables().concat(timerBtns);
  items[items.length - 1].focus();
  const ev = keydown("Tab");
  check("timer: Tab no último botão do timer volta ao primeiro do painel", ev.defaultPrevented && document.activeElement === tabbables()[0]);
}
await wait(1700);
check("timer: fim do descanso é anunciado na região aria-live", /Descanso acabou/.test(live.textContent), JSON.stringify(live.textContent));
check(
  "timer: o anúncio não move o foco",
  document.activeElement === afterStart || document.activeElement === document.body || !!dialog()?.contains(document.activeElement)
);
check("timer: timer saiu da tela ao terminar", !$(".rest-timer"));
keydown("Escape");
await wait(60);

/* ---------- botões só-ícone no DOM real ---------- */
const textOf = (el) => {
  const c = el.cloneNode(true);
  c.querySelectorAll("svg").forEach((s) => s.remove());
  return c.textContent.trim();
};
const unlabeled = [];
const audit = (where) =>
  $$("button, a[href]").forEach((el) => {
    if (textOf(el) === "" && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.title)
      unlabeled.push(where + ": " + el.outerHTML.slice(0, 70));
  });
for (const t of ["inicio", "treinos", "historico", "progresso", "ajustes"]) {
  await tab(t);
  audit(t);
}
check("DOM: nenhum botão sem texto e sem aria-label nas 5 abas", unlabeled.length === 0, unlabeled.join(" | "));

check("sem erros de script durante o teste", errors.length === 0, errors.join(" | "));
process.exit(fails ? 1 : 0);
