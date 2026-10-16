// A versão vem do package.json (única fonte). O build (plugin no vite.config.js)
// troca __APP_VERSION__ abaixo pelo valor de "version" — não edite à mão.
// Os arquivos são servidos do cache na hora (stale-while-revalidate) e
// atualizados em segundo plano; o botão "Atualizar" e o banner de nova versão
// detectam qualquer diferença (veja refreshAssets e o marcador de pendência).
const CACHE_NAME = "meus-treinos-__APP_VERSION__";

// Fotos dos exercícios: cache À PARTE e SEM versão no nome, para sobreviver às atualizações do app
// (o app baixa tudo logo após o login — src/exercises/image-cache.js — e aqui elas saem do cache,
// sem rede). Mantenha o nome igual ao de IMAGE_CACHE_NAME naquele arquivo.
const IMAGE_CACHE = "meus-treinos-exercise-images-v1";
const IMAGE_HOSTS = ["cdn.jsdelivr.net"];
const isExerciseImage = (url) =>
  url.pathname.includes("/exercise-images/") || (url.pathname.includes("/free-exercise-db") && IMAGE_HOSTS.includes(url.hostname));

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
  "./assets/inter-latin.woff2"
];
const ASSETS = CORE.concat(OPTIONAL);

// users.json define quem pode entrar: continua "rede primeiro" (com o cache só
// como reserva offline) para que remover usuário ou trocar senha valha logo.
const NETWORK_FIRST_FILES = ["users.json"];
const NETWORK_TIMEOUT_MS = 4000;

// Lê a versão publicada no app.js (o build grava /*! APP_VERSION="vX.Y.Z" */ no topo).
const VERSION_RE = /APP_VERSION\s*=\s*"([^"]+)"/;

// Marcador guardado no cache: "o cache tem conteúdo mais novo do que a página aberta".
// É limpo na próxima navegação (a página que abre já vem do cache atualizado).
const PENDING_KEY = "./__update-pending__";
async function markPending(cache){ try { await cache.put(PENDING_KEY, new Response("1")); } catch(e){} }
async function clearPending(cache){ try { await cache.delete(PENDING_KEY); } catch(e){} }
async function isPending(cache){ try { return !!(await cache.match(PENDING_KEY)); } catch(e){ return false; } }

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
    await Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE).map((k) => caches.delete(k)));
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
  // o stale-while-revalidate pode já ter baixado a versão nova em segundo plano
  let changed = await isPending(cache);
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
        const m = VERSION_RE.exec(await res.clone().text());
        if(m) remoteVersion = m[1];
      }
    } catch(e){
      if(isCore) failed++;
    }
  }));
  if(changed) await markPending(cache);
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

/* ---------- tocar na notificação do lembrete: foca o app aberto ou abre um novo ---------- */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if ("focus" in c) return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(self.registration.scope);
  })());
});

/* ---------- fetch: cache na hora, atualizando em segundo plano ---------- */
self.addEventListener("fetch", (event) => {
  if(event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if(isExerciseImage(url) && (url.origin === location.origin || IMAGE_HOSTS.includes(url.hostname))){
    event.respondWith(exerciseImage(event.request));
    return;
  }
  if(url.origin !== location.origin) return;
  if(NETWORK_FIRST_FILES.some((f) => url.pathname.endsWith("/" + f))){
    event.respondWith(networkFirst(event.request));
    return;
  }
  // a atualização em segundo plano precisa ser registrada já, de forma síncrona
  let background;
  event.waitUntil(new Promise((resolve) => { background = resolve; }));
  event.respondWith(staleWhileRevalidate(event.request, background));
});

// a chave do cache ignora parâmetros da URL (?_u=...), para não acumular cópias
function cacheKey(request){
  const u = new URL(request.url);
  return u.origin + u.pathname;
}

// Baixa da rede ("no-cache" = valida com o servidor), guarda no cache e, se o
// conteúdo for diferente do que já estava guardado, marca "atualização pendente".
async function revalidate(cache, key, url, hadCache){
  const res = await fetch(url, { cache: "no-cache" });
  if(res && res.status === 200){
    const forCache = res.clone();
    const forDigest = hadCache ? res.clone() : null;
    try {
      if(hadCache){
        const old = await cache.match(key);
        if(old && (await digest(old)) !== (await digest(forDigest))) await markPending(cache);
      }
      await cache.put(key, forCache);
    } catch(e){}
  }
  return res;
}

async function offlineFallback(request, cache){
  if(request.mode === "navigate"){
    const shell = await cache.match("./index.html");
    if(shell) return shell;
  }
  return Response.error();
}

async function staleWhileRevalidate(request, background){
  try {
    const cache = await caches.open(CACHE_NAME);
    const key = cacheKey(request);
    const cached = await cache.match(key);

    if(cached){
      // abrir o app = a página que carrega agora já é a do cache (atualizada antes)
      if(request.mode === "navigate") await clearPending(cache);
      // resposta imediata; a rede atualiza o cache sem segurar a página
      background(revalidate(cache, key, request.url, true).catch(() => {}));
      return cached;
    }

    // primeira visita (nada em cache): vai à rede, como antes
    background();
    try {
      return await revalidate(cache, key, request.url, false);
    } catch(e){
      return await offlineFallback(request, cache);
    }
  } catch(e){
    background();
    return Response.error();
  }
}

/* ---------- fotos dos exercícios: cache primeiro; o que faltar é baixado e guardado ---------- */
async function exerciseImage(request){
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(request.url);
  if(hit) return hit;
  try {
    // pedido "cors" para poder conferir status/tipo antes de guardar (um <img> comum chega como no-cors/opaco)
    const res = await fetch(request.url, { mode: "cors", credentials: "omit" });
    const type = (res.headers && res.headers.get("content-type")) || "";
    if(res.ok && /^image\//i.test(type)){
      cache.put(request.url, res.clone()).catch(() => {});
    }
    return res;
  } catch(e){
    return Response.error();
  }
}

/* ---------- users.json: rede primeiro, cache como reserva (offline) ---------- */
async function networkFirst(request){
  const cache = await caches.open(CACHE_NAME);
  const key = cacheKey(request);

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
    network.catch(() => {});
    const cached = await cache.match(key);
    if(cached) return cached;
    return offlineFallback(request, cache);
  }
}
