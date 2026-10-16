/* Cache offline das imagens dos exercícios.

   Logo após o login (ver bootApp), baixa as 2 fotos de cada exercício mapeado em EXERCISE_IMAGE_MAP e
   guarda no Cache Storage ("meus-treinos-exercise-images-v1"). O service worker (public/sw.js) entrega
   essas fotos direto do cache, sem rede — então elas aparecem offline e não são baixadas de novo a cada
   acesso. Esse cache NÃO é apagado quando o app atualiza de versão (o sw.js só limpa os caches antigos
   do app, não este).

   - Só baixa o que ainda não está no cache: rodar de novo (a cada abertura do app) é barato e também
     repõe o que o navegador tiver apagado por falta de espaço.
   - Cada foto é guardada sob a URL da fonte em que foi achada (EXERCISE_IMAGE_SOURCES), que é a mesma
     URL que o <img> pede — o service worker só precisa procurar pela URL. */
import { EXERCISE_IMAGE_MAP, EXERCISE_IMAGE_SOURCES, exerciseImageUrl } from "./exercise-images.js";

export const IMAGE_CACHE_NAME = "meus-treinos-exercise-images-v1";
const CONCURRENCY = 6;
const FRAMES = [0, 1];

let running = null;

export const imageCacheSupported = () => typeof caches !== "undefined" && typeof fetch === "function";

/* [{ id, frame }] de todas as fotos que o app sabe mostrar */
export function allImageJobs() {
  const ids = [...new Set(Object.values(EXERCISE_IMAGE_MAP))];
  const jobs = [];
  for (const id of ids) for (const frame of FRAMES) jobs.push({ id, frame });
  return jobs;
}

async function fetchImage(url) {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res || !res.ok) return null;
  const type = res.headers.get("content-type") || "";
  return /^image\//i.test(type) ? res : null;
}

/* Baixa o que falta. Retorna { total, cached, downloaded, failed }. */
async function run() {
  const jobs = allImageJobs();
  const out = { total: jobs.length, cached: 0, downloaded: 0, failed: 0 };
  if (!imageCacheSupported()) return out;
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const abs = (u) => new URL(u, document.baseURI).href;
  const urlsFor = (job) => EXERCISE_IMAGE_SOURCES.map((_, s) => abs(exerciseImageUrl(job.id, job.frame, s)));

  const pending = jobs.filter((job) => {
    const hit = urlsFor(job).some((u) => have.has(u));
    if (hit) out.cached++;
    return !hit;
  });
  if (!pending.length) return out;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    out.failed = pending.length;
    return out;
  }

  /* fonte local que não responde (./exercise-images/ quando as fotos não foram copiadas para o app)
     é descartada depois de 3 falhas seguidas, para não pedir centenas de 404. A última fonte (CDN)
     nunca é descartada. */
  const misses = EXERCISE_IMAGE_SOURCES.map(() => 0);
  const queue = pending.slice();
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const urls = urlsFor(job);
      let ok = false;
      for (let s = 0; s < urls.length && !ok; s++) {
        if (s < urls.length - 1 && misses[s] >= 3) continue;
        try {
          const res = await fetchImage(urls[s]);
          if (res) {
            await cache.put(urls[s], res);
            misses[s] = 0;
            ok = true;
          } else misses[s]++;
        } catch (e) {
          /* offline ou bloqueado: tenta a próxima fonte */
        }
      }
      if (ok) out.downloaded++;
      else out.failed++;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

/* Uma execução por vez; chamadas repetidas devolvem a mesma promessa. Nunca rejeita. */
export function precacheExerciseImages() {
  if (!running) {
    running = run()
      .catch(() => ({ total: 0, cached: 0, downloaded: 0, failed: 0, error: true }))
      .finally(() => {
        running = null;
      });
  }
  return running;
}
