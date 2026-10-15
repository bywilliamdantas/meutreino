// Sessão sem expiração na virada do dia + PIN (PBKDF2). Sem argumento: roda todos os cenários.
import { spawnSync } from "child_process";
import { JSDOM } from "jsdom";
import fs from "fs";
import crypto from "crypto";

const SCENARIOS = ["midnight", "expired", "expired-active", "idle7", "within", "live-expire", "live-active", "pin"];
const SCEN = process.argv[2];

if (!SCEN) {
  let bad = 0;
  for (const s of SCENARIOS) {
    const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname, s], { encoding: "utf8" });
    process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status !== 0) bad++;
  }
  process.exit(bad ? 1 : 0);
}

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

const SALT = "abc123",
  PASSWORD = "testpass";
const hash = crypto
  .createHash("sha256")
  .update(SALT + PASSWORD, "utf8")
  .digest("hex");
const USERS = {
  users: [
    { username: "a", name: "Ana", salt: SALT, hash },
    { username: "b", name: "Beto", salt: SALT, hash }
  ]
};
global.fetch = async (url) => (String(url).includes("users.json") ? { ok: true, json: async () => USERS } : { ok: false, status: 404, json: async () => ({}) });

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = Date.now();
const mkData = (active) => ({
  order: ["A", "B", "C"],
  workouts: {
    A: { name: "Treino A", exercises: [{ id: "e1", name: "Supino", sets: "3", reps: "10", rest: "", mins: "", type: "strength" }] },
    B: { name: "B", exercises: [] },
    C: { name: "C", exercises: [] }
  },
  sessions: { [keyOf(new Date(now - 3 * DAY))]: [{ id: "s1", letter: "A", log: { e1: [{ weight: 40, reps: 10, done: true }] }, startedAt: 1, endedAt: 2 }] },
  activeSession: active ? { letter: "A", state: "running", elapsedMs: 0, startedAt: now - 5000, startedDate: keyOf(new Date(now)) } : undefined
});
const sessionRec = (o) => localStorage.setItem("gym-session", JSON.stringify({ username: "a", name: "Ana", ...o }));
const seed = (rec, active) => {
  localStorage.setItem("gym-data:a", JSON.stringify(mkData(active)));
  if (rec) sessionRec(rec);
};

if (SCEN === "midnight") seed({ loginDay: keyOf(new Date(now - DAY)) }); // formato v8.1, "ontem"
if (SCEN === "expired") seed({ v: 2, lastOpenAt: now - 31 * DAY });
if (SCEN === "expired-active") seed({ v: 2, lastOpenAt: now - 31 * DAY }, true);
if (SCEN === "idle7") {
  localStorage.setItem("gym-idle-days:a", "7");
  seed({ v: 2, lastOpenAt: now - 10 * DAY });
}
if (SCEN === "within") seed({ v: 2, lastOpenAt: now - 29 * DAY });
if (SCEN === "live-expire" || SCEN === "live-active") seed({ v: 2, lastOpenAt: now - 1000 });
if (SCEN === "pin") seed({ v: 2, lastOpenAt: now - 1000 });

const errors = [];
process.on("unhandledRejection", (e) => errors.push("(promise) " + ((e && e.stack) || e)));
window.addEventListener("error", (e) => errors.push((e.error && e.error.stack) || e.message));
await import("../dist/app.js");
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
await wait(800);

let fails = 0;
const check = (name, cond, extra = "") => {
  console.log((cond ? "OK   " : "FALHA") + ` - [${SCEN}] ` + name + (cond ? "" : " " + extra));
  if (!cond) fails++;
};
const $ = (s) => document.querySelector(s);
const onLogin = () => !!$(".login-wrap");
const setVal = (el, v) => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const rec = () => JSON.parse(localStorage.getItem("gym-session") || "null");
const goAjustes = async () => {
  $('[data-role="gotab"][data-tab="ajustes"]').click();
  await wait();
};
const visible = async () => {
  document.dispatchEvent(new window.Event("visibilitychange"));
  await wait(300);
};

if (SCEN === "midnight") {
  check("sessão de ontem (v8.1) continua logada", !onLogin());
  check("registro convertido para v2 com acesso recente", rec() && rec().v === 2 && now - rec().lastOpenAt < 60000, JSON.stringify(rec()));
}
if (SCEN === "within") check("29 dias sem abrir (limite 30) continua logado", !onLogin());
if (SCEN === "expired") {
  check("31 dias sem abrir → tela de login", onLogin());
  check("sessão limpa", rec() === null);
  check("dados do usuário preservados", !!localStorage.getItem("gym-data:a"));
}
if (SCEN === "idle7") check("prazo configurado em 7 dias vale (10 dias → login)", onLogin());
if (SCEN === "expired-active") {
  check("31 dias, mas com treino ativo → NÃO vai para o login", !onLogin());
  check("sessão renovada", rec() && now - rec().lastOpenAt < 60000, JSON.stringify(rec()));
}
if (SCEN === "live-expire") {
  check("logado no início", !onLogin());
  sessionRec({ v: 2, lastOpenAt: now - 40 * DAY });
  await visible();
  check("app aberto, sem treino, 40 dias sem abrir → login", onLogin());
}
if (SCEN === "live-active") {
  check("logado no início", !onLogin());
  $("#startBtn").click();
  await wait(400);
  check("treino iniciado", JSON.parse(localStorage.getItem("gym-data:a")).activeSession.state === "running");
  sessionRec({ v: 2, lastOpenAt: now - 40 * DAY });
  await visible();
  check("treino ativo: app NÃO cai para o login mesmo vencida", !onLogin());
  check("sessão renovada ao voltar ao app", rec() && Date.now() - rec().lastOpenAt < 60000, JSON.stringify(rec()));
}

if (SCEN === "pin") {
  await goAjustes();
  check("linha 'PIN de acesso' em Ajustes → Conta", !!$("#pinRowBtn"));
  check("Ajustes avisa que o lembrete só aparece com o app aberto", /só aparece com o app aberto/.test($("#reminderHint")?.textContent || ""));
  check("Ajustes avisa o mesmo do fim de descanso", /fim de descanso só aparece com o app aberto/.test($("#restEndHint")?.textContent || ""));
  check("seletor de dias (padrão 30) em Ajustes", $("#idleDaysSelect") && $("#idleDaysSelect").value === "30");
  const sel = $("#idleDaysSelect");
  sel.value = "60";
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  check("alterar dias grava preferência do usuário", localStorage.getItem("gym-idle-days:a") === "60");
  $("#pinRowBtn").click();
  await wait();
  const tryPin = async (pass, p1, p2) => {
    setVal($("#pinCurrentPass"), pass);
    setVal($("#pinNew"), p1);
    setVal($("#pinNew2"), p2);
    $("#pinSave").click();
    await wait(900);
    return $("#pinError")?.textContent || "";
  };
  check("senha errada recusada", /Senha incorreta/.test(await tryPin("nope", "4821", "4821")));
  check("PIN fraco (1234) recusado", /fácil demais/.test(await tryPin(PASSWORD, "1234", "1234")));
  check("PINs diferentes recusados", /não são iguais/.test(await tryPin(PASSWORD, "4821", "4822")));
  check("nada gravado até aqui", localStorage.getItem("gym-pin:a") === null);
  await tryPin(PASSWORD, "4821", "4821");
  const raw = localStorage.getItem("gym-pin:a");
  const p = JSON.parse(raw || "null");
  check("PIN gravado como PBKDF2-SHA256 com 600 mil iterações", p && p.alg === "PBKDF2-SHA256" && p.iter === 600000, raw);
  check("salt aleatório de 16 bytes e hash de 32 bytes", p && Buffer.from(p.salt, "base64").length === 16 && Buffer.from(p.hash, "base64").length === 32);
  check("PIN nunca em texto puro", !raw.includes("4821"));
  check("PIN fora dos dados do app (exportação/backups)", !localStorage.getItem("gym-data:a").includes(p.hash) && localStorage.getItem("gym-pin:b") === null);
  check("Ajustes mostra PIN ativo", /Ativo/.test($("#pinRowBtn").textContent));

  // logout → login com PIN
  $("#openPerfilFromAjustesBtn").click();
  await wait();
  $("#logoutBtn").click();
  await wait();
  $("#confirmYes").click();
  await wait();
  check("saiu para o login", onLogin());
  setVal($("#loginUser"), "a");
  check(
    "usuário com PIN vê o campo de PIN e não a senha",
    !$("#loginPinWrap").classList.contains("hidden") && $("#loginPass").closest("label").classList.contains("hidden")
  );
  setVal($("#loginPin"), "9999");
  await wait(1200);
  check(
    "PIN errado: mensagem com tentativas e usuário mantido",
    /incorreto.*4 tentativa/.test($(".login-error")?.textContent || "") && $("#loginUser").value === "a",
    $(".login-error")?.textContent
  );
  check("PIN errado: segue na tela de PIN", onLogin() && !$("#loginPinWrap").classList.contains("hidden"));
  setVal($("#loginPin"), "4821");
  await wait(1500);
  check("PIN correto entra no app", !onLogin());
  check("contador de erros zerado", JSON.parse(localStorage.getItem("gym-pin:a")).fails === 0);

  // outro usuário não herda o PIN
  {
    // logout pela interface
    await goAjustes();
    $("#openPerfilFromAjustesBtn").click();
    await wait();
    $("#logoutBtn").click();
    await wait();
    $("#confirmYes").click();
    await wait();
  }
  setVal($("#loginUser"), "b");
  check(
    "outro usuário (sem PIN) continua só com senha",
    $("#loginPinWrap").classList.contains("hidden") && !$("#loginPass").closest("label").classList.contains("hidden")
  );

  // bloqueio após 5 erros e recuperação pela senha
  setVal($("#loginUser"), "a");
  for (let i = 0; i < 5; i++) {
    setVal($("#loginPin"), "0001");
    await wait(1100);
  }
  check(
    "5 erros bloqueiam o PIN e levam à senha",
    /bloqueado/.test($(".login-error")?.textContent || "") && !$("#loginPass").closest("label").classList.contains("hidden"),
    $(".login-error")?.textContent
  );
  setVal($("#loginPass"), PASSWORD);
  $("#loginSubmit").click();
  await wait(1000);
  check("senha entra mesmo com PIN bloqueado", !onLogin());
  check("login por senha destrava o PIN", JSON.parse(localStorage.getItem("gym-pin:a")).fails === 0);
}

check("sem erros de JavaScript", errors.length === 0, errors.join("\n"));
process.exit(fails ? 1 : 0);
