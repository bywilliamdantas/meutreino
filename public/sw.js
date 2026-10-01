// Ao publicar uma versão nova, mude CACHE_NAME aqui e APP_VERSION no app.js
// (mesmo número). Mas mesmo sem mudar, os arquivos são revalidados na rede a
// cada abertura e o botão "Atualizar" do app detecta qualquer diferença.
const CACHE_NAME = "meus-treinos-v8.1";

// Sem estes o app não funciona: se falharem, a instalação é abortada.
// app.js e app.css agora são gerados pelo build (Vite) a partir de src/, mas o
// nome de saída é fixo (sem hash), então esta lista continua igual depois de builds futuros.
const CORE = [
  "./",
  "./index.html",
  "./app.js",
  "./app.css",
  "./manifest.json",
  "./users.json"
];
// Ícones: se algum faltar, não impede a instalação.
const OPTIONAL = [
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/logo.png",
  "./gerar-hash.html"
];
const ASSETS = CORE.concat(OPTIONAL);

const NETWORK_TIMEOUT_MS = 4000;

// "reload" = ignora totalmente o cache HTTP do navegador
const freshRequest = (url) => new Request(url, { cache: "reload" });

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE.map(async (url) => {
      const res = await fetch(freshRequest(url));
      if(!res.ok) throw new Error("Falha ao baixar " + url);
      await cache.put(url, res);
    }));
    await Promise.allSettled(OPTIONAL.map(async (url) => {
      const res = await fetch(freshRequest(url));
      if(res.ok) await cache.put(url, res);
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* ---------- mensagens do app ---------- */
async function digest(response){
  const buf = await response.clone().arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Rebaixa todos os arquivos do servidor, atualiza o cache e informa se algo mudou.
async function refreshAssets(){
  const cache = await caches.open(CACHE_NAME);
  let changed = false;
  let failed = 0;
  let remoteVersion = null;
  await Promise.all(ASSETS.map(async (url) => {
    const isCore = CORE.includes(url);
    try {
      const res = await fetch(new Request(url, { cache: "no-cache" }));
      if(!res.ok){ if(isCore) failed++; return; }
      const old = await cache.match(url);
      const [novo, antigo] = await Promise.all([digest(res), old ? digest(old) : Promise.resolve(null)]);
      if(novo !== antigo){
        changed = true;
        await cache.put(url, res.clone());
      }
      if(url === "./app.js"){
        const m = /APP_VERSION\s*=\s*"([^"]+)"/.exec(await res.clone().text());
        if(m) remoteVersion = m[1];
      }
    } catch(e){
      if(isCore) failed++;
    }
  }));
  return { ok: failed === 0, changed, remoteVersion };
}

self.addEventListener("message", (event) => {
  const data = event.data;
  const type = typeof data === "string" ? data : (data && data.type);
  if(type === "SKIP_WAITING"){
    self.skipWaiting();
  } else if(type === "CHECK_UPDATE"){
    self.registration.update();
  } else if(type === "REFRESH_ASSETS"){
    const port = event.ports && event.ports[0];
    event.waitUntil(
      refreshAssets()
        .then((r) => { if(port) port.postMessage(r); })
        .catch((e) => { if(port) port.postMessage({ ok: false, error: String(e) }); })
    );
  }
});

/* ---------- fetch: rede primeiro, cache como reserva (offline) ---------- */
self.addEventListener("fetch", (event) => {
  if(event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if(url.origin !== location.origin) return;
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request){
  const cache = await caches.open(CACHE_NAME);
  // a chave do cache ignora parâmetros da URL (?_u=...), para não acumular cópias
  const u = new URL(request.url);
  const key = u.origin + u.pathname;

  // "no-cache" = sempre valida com o servidor (resposta 304 é barata), nunca usa cópia velha do navegador
  const network = fetch(request.url, { cache: "no-cache" }).then((res) => {
    if(res && res.status === 200){
      cache.put(key, res.clone()).catch(() => {});
    }
    return res;
  });

  try {
    const res = await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS))
    ]);
    if(res.ok) return res;
    const cachedOnError = await cache.match(key);
    return cachedOnError || res;
  } catch(e){
    // sem internet ou rede lenta: usa o que está guardado (a rede segue atualizando o cache em segundo plano)
    network.catch(() => {});
    const cached = await cache.match(key);
    if(cached) return cached;
    if(request.mode === "navigate"){
      const shell = await cache.match("./index.html");
      if(shell) return shell;
    }
    return Response.error();
  }
}
