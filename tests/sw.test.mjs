// Service worker: stale-while-revalidate, primeira visita, offline, marcador de
// "atualização pendente" (banner de nova versão) e handlers existentes.
// Executa o public/sw.js num sandbox com Cache API e fetch falsos.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const swSource = fs.readFileSync(path.join(root, "public/sw.js"), "utf8").split("__APP_VERSION__").join("vTESTE");

const BASE = "https://app.test/repo/";
const abs = (u) => new URL(typeof u === "string" ? u : u.url, BASE + "sw.js").href;

function setup() {
  const stores = new Map();
  const makeCache = (store) => ({
    async match(k) {
      const r = store.get(abs(k));
      return r ? r.clone() : undefined;
    },
    async put(k, res) {
      store.set(abs(k), res);
    },
    async delete(k) {
      return store.delete(abs(k));
    }
  });
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      return makeCache(stores.get(name));
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    }
  };

  // rede falsa: url -> {body,status} | "offline" | "hang"
  const net = new Map();
  const calls = [];
  const fakeFetch = (input) => {
    const url = abs(input);
    calls.push(url);
    const r = net.get(url);
    if (r === "hang") return new Promise(() => {});
    if (r === "offline" || (!r && net.get("*") === "offline")) return Promise.reject(new TypeError("offline"));
    if (!r) return Promise.resolve(new Response("nf", { status: 404 }));
    return Promise.resolve(new Response(r.body, { status: r.status || 200 }));
  };

  const handlers = {};
  const log = { skipWaiting: 0, update: 0 };
  const self = {
    addEventListener: (t, fn) => {
      handlers[t] = fn;
    },
    skipWaiting: () => {
      log.skipWaiting++;
    },
    registration: {
      update: () => {
        log.update++;
      }
    },
    clients: { claim: async () => {} }
  };
  const sandbox = {
    self,
    caches,
    fetch: fakeFetch,
    Response,
    crypto: globalThis.crypto,
    URL,
    location: new URL(BASE + "sw.js"),
    setTimeout,
    clearTimeout,
    console,
    Promise,
    Request: class extends Request {
      constructor(u, o) {
        super(abs(u), o);
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(swSource, sandbox);

  const seedCache = async (url, body) => {
    const c = await caches.open("meus-treinos-vTESTE");
    await c.put(url, new Response(body));
  };
  const cacheText = async (url) => {
    const c = await caches.open("meus-treinos-vTESTE");
    const r = await c.match(url);
    return r ? r.text() : null;
  };

  async function doFetch(url, { mode = "no-cors" } = {}) {
    const waits = [];
    let responded;
    const event = {
      request: { url: abs(url), method: "GET", mode },
      respondWith: (p) => {
        responded = Promise.resolve(p);
      },
      waitUntil: (p) => {
        waits.push(p);
      }
    };
    handlers.fetch(event);
    return { responded, done: () => Promise.all(waits) };
  }

  async function message(data) {
    const ch = new MessageChannel();
    const got = new Promise((resolve) => {
      ch.port1.onmessage = (e) => {
        resolve(e.data);
        ch.port1.close();
      };
    });
    const waits = [];
    handlers.message({ data, ports: [ch.port2], waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
    return got;
  }

  return { net, calls, caches, handlers, log, seedCache, cacheText, doFetch, message };
}

const seedCore = (t) => {
  for (const f of ["", "index.html", "app.js", "app.css", "manifest.json", "users.json"]) {
    t.net.set(BASE + f, { body: "novo:" + f });
  }
};
// cache já igual à rede em todos os arquivos essenciais (isola o efeito do que o teste mexer)
const seedCoreCache = async (t) => {
  for (const f of ["", "index.html", "app.js", "app.css", "manifest.json", "users.json"]) {
    await t.seedCache("./" + f, "novo:" + f);
  }
};
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r("TIMEOUT"), ms))]);

test("com cache: responde na hora, mesmo com a rede travada", async () => {
  const t = setup();
  await t.seedCache("./app.js", "velho");
  t.net.set(BASE + "app.js", "hang");
  const { responded } = await t.doFetch(BASE + "app.js");
  const res = await withTimeout(responded, 300);
  assert.notEqual(res, "TIMEOUT");
  assert.equal(await res.text(), "velho");
});

test("com cache: atualiza o cache em segundo plano", async () => {
  const t = setup();
  await t.seedCache("./app.js", "velho");
  t.net.set(BASE + "app.js", { body: "novo" });
  const { responded, done } = await t.doFetch(BASE + "app.js");
  assert.equal(await (await responded).text(), "velho");
  await done();
  assert.equal(await t.cacheText("./app.js"), "novo");
});

test("primeira visita (sem cache): vai à rede e guarda no cache", async () => {
  const t = setup();
  t.net.set(BASE + "app.js", { body: "da-rede" });
  const { responded, done } = await t.doFetch(BASE + "app.js");
  assert.equal(await (await responded).text(), "da-rede");
  await done();
  assert.equal(await t.cacheText("./app.js"), "da-rede");
});

test("offline sem cache: navegação cai no index.html; outros pedidos falham", async () => {
  const t = setup();
  await t.seedCache("./index.html", "<shell>");
  t.net.set("*", "offline");
  const nav = await t.doFetch(BASE + "treinos", { mode: "navigate" });
  assert.equal(await (await nav.responded).text(), "<shell>");
  const other = await t.doFetch(BASE + "chunks/x.js");
  assert.equal((await other.responded).type, "error");
});

test("offline com cache: abre do cache sem erro", async () => {
  const t = setup();
  await t.seedCache("./", "<home>");
  t.net.set("*", "offline");
  const nav = await t.doFetch(BASE + "?_u=123", { mode: "navigate" });
  assert.equal(await (await nav.responded).text(), "<home>");
  await nav.done();
});

test("parâmetros da URL (?_u=) não geram cópia nova no cache", async () => {
  const t = setup();
  await t.seedCache("./app.js", "velho");
  t.net.set(BASE + "app.js?_u=1", { body: "novo" });
  const { done } = await t.doFetch(BASE + "app.js?_u=1");
  await done();
  assert.equal(await t.cacheText("./app.js"), "novo");
});

test("users.json continua rede primeiro (usuário removido/senha trocada valem logo)", async () => {
  const t = setup();
  await t.seedCache("./users.json", "usuarios-velhos");
  t.net.set(BASE + "users.json", { body: "usuarios-novos" });
  const { responded } = await t.doFetch(BASE + "users.json");
  assert.equal(await (await responded).text(), "usuarios-novos");
});

test("users.json offline: usa o cache como reserva", async () => {
  const t = setup();
  await t.seedCache("./users.json", "usuarios-guardados");
  t.net.set("*", "offline");
  const { responded } = await t.doFetch(BASE + "users.json");
  assert.equal(await (await responded).text(), "usuarios-guardados");
});

test("banner: versão nova baixada em segundo plano continua sendo avisada", async () => {
  const t = setup();
  seedCore(t);
  await seedCoreCache(t);
  await t.seedCache("./app.js", '/*! APP_VERSION="v1.0.0" */ velho');
  t.net.set(BASE + "app.js", { body: '/*! APP_VERSION="v1.1.0" */ novo' });

  // abre o app: serve o velho, baixa o novo em segundo plano
  const open = await t.doFetch(BASE + "app.js");
  assert.match(await (await open.responded).text(), /v1\.0\.0/);
  await open.done();
  assert.match(await t.cacheText("./app.js"), /v1\.1\.0/);

  // a checagem do app (REFRESH_ASSETS) vê "mudou" mesmo com o cache já atualizado
  const r1 = await t.message({ type: "REFRESH_ASSETS" });
  assert.equal(r1.ok, true);
  assert.equal(r1.changed, true);
  assert.equal(r1.remoteVersion, "v1.1.0");

  // recarregar (navegação) abre a versão nova e limpa o aviso
  const nav = await t.doFetch(BASE + "?_u=9", { mode: "navigate" });
  await nav.responded;
  await nav.done();
  const r2 = await t.message({ type: "REFRESH_ASSETS" });
  assert.equal(r2.changed, false);
});

test("sem mudança no servidor: não avisa nova versão", async () => {
  const t = setup();
  seedCore(t);
  await seedCoreCache(t);
  const open = await t.doFetch(BASE + "app.js");
  await open.responded;
  await open.done();
  const r = await t.message({ type: "REFRESH_ASSETS" });
  assert.equal(r.ok, true);
  assert.equal(r.changed, false);
});

test("handlers existentes: SKIP_WAITING, CHECK_UPDATE (texto e objeto)", async () => {
  const t = setup();
  t.handlers.message({ data: "SKIP_WAITING", ports: [] });
  t.handlers.message({ data: { type: "SKIP_WAITING" }, ports: [] });
  t.handlers.message({ data: { type: "CHECK_UPDATE" }, ports: [] });
  assert.equal(t.log.skipWaiting, 2);
  assert.equal(t.log.update, 1);
});

test("install pré-cacheia os arquivos essenciais", async () => {
  const t = setup();
  seedCore(t);
  let p;
  t.handlers.install({
    waitUntil: (x) => {
      p = x;
    }
  });
  await p;
  for (const f of ["app.js", "app.css", "index.html"]) {
    assert.equal(await t.cacheText("./" + f), "novo:" + f);
  }
});
