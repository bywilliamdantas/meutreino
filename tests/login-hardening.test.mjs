// Etapa 14: login endurecido (PBKDF2 em users.json, só apelido, gerar-hash fora do build)
// e lembretes via service worker (registration.showNotification, com toast como reserva).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const b64 = (buf) => Buffer.from(buf).toString("base64");

const { verifyPassword, tryLogin } = await import("../src/auth/crypto.js");
const { notifyViaServiceWorker } = await import("../src/notify.js");
const { store } = await import("../src/store.js");

// registro no formato novo, igual ao que tools/gerar-hash.html produz
function newRecord(password, extra = {}) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 600000, 32, "sha256");
  return { username: "ana", name: "Ana", alg: "PBKDF2-SHA256", iter: 600000, salt: b64(salt), hash: b64(hash), ...extra };
}
// registro no formato antigo (SHA-256 de salt + senha, em hexadecimal)
function legacyRecord(password) {
  const salt = "abc123def456";
  return {
    username: "bia",
    name: "Bia",
    salt,
    hash: crypto
      .createHash("sha256")
      .update(salt + password, "utf8")
      .digest("hex")
  };
}

test("formato novo: senha certa confere, errada não", async () => {
  const u = newRecord("senha-longa-1");
  assert.equal(await verifyPassword(u, "senha-longa-1"), true);
  assert.equal(await verifyPassword(u, "senha-longa-2"), false);
});

test("formato antigo continua valendo durante a transição", async () => {
  const u = legacyRecord("velha123");
  assert.equal(await verifyPassword(u, "velha123"), true);
  assert.equal(await verifyPassword(u, "velha124"), false);
});

test("registro novo malformado ou com iterações baixas nunca confere", async () => {
  const ok = newRecord("x-senha-x");
  assert.equal(await verifyPassword({ ...ok, iter: 1000 }, "x-senha-x"), false);
  assert.equal(await verifyPassword({ ...ok, iter: "abc" }, "x-senha-x"), false);
  assert.equal(await verifyPassword({ ...ok, salt: "" }, "x-senha-x"), false);
  assert.equal(await verifyPassword({ ...ok, salt: "%%%" }, "x-senha-x"), false);
});

test("salt único: dois registros da mesma senha têm salt e hash diferentes", () => {
  const a = newRecord("mesma-senha"),
    b = newRecord("mesma-senha");
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.equal(Buffer.from(a.salt, "base64").length, 16);
  assert.equal(Buffer.from(a.hash, "base64").length, 32);
});

test("tryLogin aceita os dois formatos e mantém as mensagens existentes", async () => {
  const users = [newRecord("nova-senha-9"), legacyRecord("velha123")];
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ users }) });
  const a = await tryLogin("ANA", "nova-senha-9");
  assert.deepEqual(a, { ok: true, user: { username: "ana", name: "Ana" } });
  const b = await tryLogin("bia", "velha123");
  assert.deepEqual(b, { ok: true, user: { username: "bia", name: "Bia" } });
  assert.equal((await tryLogin("ana", "errada")).msg, "Usuário ou senha inválidos.");
  assert.equal((await tryLogin("zeca", "qualquer")).msg, "Usuário ou senha inválidos.");
  assert.equal((await tryLogin("ana", "")).msg, "Preencha usuário e senha.");
});

test("public/users.json: só apelido (sem sobrenome) e nenhum campo extra de identificação", () => {
  const { users } = JSON.parse(read("public/users.json"));
  assert.ok(users.length > 0);
  for (const u of users) {
    assert.ok(u.name, "sem apelido");
    assert.ok(!/\s/.test(u.name.trim()), `nome completo exposto: ${u.name}`);
    assert.deepEqual(
      Object.keys(u).filter((k) => !["username", "name", "salt", "hash", "alg", "iter"].includes(k)),
      []
    );
  }
});

test("gerar-hash.html fica no repositório (tools/) e fora do build de produção", () => {
  assert.ok(fs.existsSync(path.join(root, "tools/gerar-hash.html")));
  assert.ok(!fs.existsSync(path.join(root, "public/gerar-hash.html")));
  assert.ok(!fs.existsSync(path.join(root, "dist/gerar-hash.html")), "dist/ não pode ter gerar-hash.html");
  assert.ok(!read("public/sw.js").includes("gerar-hash"), "sw.js não deve pré-cachear gerar-hash.html");
  assert.ok(!read("dist/sw.js").includes("gerar-hash"));
});

test("tools/gerar-hash.html gera o formato novo e o app aceita o resultado", async () => {
  const dom = new JSDOM(read("tools/gerar-hash.html"), {
    runScripts: "dangerously",
    url: "https://exemplo.test/",
    beforeParse(w) {
      Object.defineProperty(w, "crypto", { value: crypto.webcrypto });
      w.TextEncoder = TextEncoder;
    }
  });
  const d = dom.window.document;
  const gerar = async (username, name, password) => {
    d.getElementById("username").value = username;
    d.getElementById("name").value = name;
    d.getElementById("password").value = password;
    d.getElementById("genBtn").click();
    for (let i = 0; i < 100 && !d.getElementById("out").value.includes(username); i++) await new Promise((r) => setTimeout(r, 100));
    return JSON.parse(d.getElementById("out").value).users;
  };
  const u1 = await gerar("carla", "Carla", "uma-senha-boa-1");
  const u2 = await gerar("dudu", "Dudu", "uma-senha-boa-1");
  const [c, e] = [u2.find((u) => u.username === "carla"), u2.find((u) => u.username === "dudu")];
  assert.equal(u1.length, 1);
  assert.equal(c.alg, "PBKDF2-SHA256");
  assert.equal(c.iter, 600000);
  assert.notEqual(c.salt, e.salt, "salt tem de ser único por usuário");
  assert.notEqual(c.hash, e.hash);
  assert.ok(!JSON.stringify(u2).includes("uma-senha-boa-1"), "senha nunca vai para o JSON");
  assert.equal(await verifyPassword(c, "uma-senha-boa-1"), true);
  assert.equal(await verifyPassword(c, "outra"), false);
  dom.window.close();
});

/* ---------- lembretes ---------- */
function fakeNotification(permission) {
  const made = [];
  globalThis.Notification = Object.assign(
    function Notif(...a) {
      made.push(a);
    },
    { permission }
  );
  return made;
}
const fakeReg = (impl) => {
  const calls = [];
  return {
    calls,
    showNotification: async (...a) => {
      calls.push(a);
      if (impl) await impl();
    }
  };
};

test("notificação usa registration.showNotification e nunca new Notification()", async () => {
  const made = fakeNotification("granted");
  const reg = fakeReg();
  store.swRegistration = reg;
  assert.equal(await notifyViaServiceWorker("Hora do treino", "Não esqueça", "t1"), true);
  assert.deepEqual(reg.calls, [["Hora do treino", { body: "Não esqueça", tag: "t1" }]]);
  assert.equal(made.length, 0, "new Notification() não pode ser chamado");
});

test("sem permissão, sem service worker ou com erro: devolve false (o toast cobre)", async () => {
  const reg = fakeReg();
  store.swRegistration = reg;
  fakeNotification("default");
  assert.equal(await notifyViaServiceWorker("a", "b"), false);
  fakeNotification("denied");
  assert.equal(await notifyViaServiceWorker("a", "b"), false);
  assert.equal(reg.calls.length, 0);
  delete globalThis.Notification;
  assert.equal(await notifyViaServiceWorker("a", "b"), false);
  fakeNotification("granted");
  store.swRegistration = null; // e sem navigator.serviceWorker (Node)
  assert.equal(await notifyViaServiceWorker("a", "b"), false);
  store.swRegistration = fakeReg(async () => {
    throw new Error("falhou");
  });
  assert.equal(await notifyViaServiceWorker("a", "b"), false);
  store.swRegistration = null;
});

test("sem store.swRegistration, procura o registro via navigator.serviceWorker", async () => {
  fakeNotification("granted");
  const reg = fakeReg();
  Object.defineProperty(globalThis, "navigator", { value: { serviceWorker: { getRegistration: async () => reg } }, configurable: true });
  assert.equal(await notifyViaServiceWorker("a", "b"), true);
  assert.equal(reg.calls.length, 1);
});

test("o código-fonte não usa mais new Notification()", () => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  for (const f of walk(path.join(root, "src")).filter((f) => f.endsWith(".js"))) {
    assert.ok(!/new\s+Notification\s*\(/.test(fs.readFileSync(f, "utf8")), `${f} ainda usa new Notification()`);
  }
});
