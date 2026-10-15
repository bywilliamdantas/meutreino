#!/usr/bin/env node
/* Ferramenta das imagens de exercícios (precisa de internet; o app em si não precisa).
     npm run imagens:verificar   confere cada id de EXERCISE_IMAGE_MAP contra o banco real
                                  (yuhonas/free-exercise-db), sugere o id certo quando não existe
                                  e lista os exercícios da biblioteca que ficaram sem imagem.
     npm run imagens:baixar      copia as fotos (0.jpg e 1.jpg) para public/exercise-images/,
                                  para o app funcionar offline. Pode rodar de novo: pula o que já existe. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXERCISE_IMAGE_MAP, EXERCISE_IMAGE_SOURCES } from "../src/exercises/exercise-images.js";
import { EXERCISE_LIBRARY } from "../src/data/exercise-library.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "public", "exercise-images");
const CDN = EXERCISE_IMAGE_SOURCES[1];
const DB_URL = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";

const mode = process.argv[2] || "verificar";

async function loadDb() {
  const res = await fetch(DB_URL);
  if (!res.ok) throw new Error(`Não consegui baixar o banco (${res.status}). Confira a internet.`);
  return res.json(); // [{ id, name, images: ["Id/0.jpg", ...] }]
}

const tokens = (s) => new Set(String(s).toLowerCase().replace(/[_-]+/g, " ").split(/\s+/).filter(Boolean));
function suggest(id, db) {
  const t = tokens(id);
  return db
    .map((e) => ({ id: e.id, score: [...tokens(e.id)].filter((x) => t.has(x)).length / Math.max(t.size, 1) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.id);
}

async function verify() {
  const db = await loadDb();
  const ids = new Set(db.map((e) => e.id));
  const bad = Object.entries(EXERCISE_IMAGE_MAP).filter(([, id]) => !ids.has(id));
  console.log(`Banco: ${db.length} exercícios. Mapeados no app: ${Object.keys(EXERCISE_IMAGE_MAP).length}.`);
  if (bad.length) {
    console.log(`\n❌ ${bad.length} id(s) NÃO existem no banco (o app mostra o ícone nesses):`);
    for (const [name, id] of bad) console.log(`  - "${name}": ${id}\n      talvez: ${suggest(id, db).join(" | ")}`);
  } else {
    console.log("\n✅ Todos os ids mapeados existem no banco.");
  }
  const lib = new Set(Object.keys(EXERCISE_IMAGE_MAP).map((n) => n.toLowerCase()));
  const without = [...new Set(Object.values(EXERCISE_LIBRARY).flat())].filter((n) => !lib.has(n.toLowerCase()) && !EXERCISE_LIBRARY.Cardio.includes(n));
  console.log(`\nℹ️  ${without.length} exercício(s) da biblioteca sem imagem (usam o ícone). Para ligar um, adicione em EXERCISE_IMAGE_MAP.`);
  if (process.argv.includes("--lista")) without.forEach((n) => console.log("  - " + n));
  else console.log("   (rode com --lista para ver os nomes)");
  process.exitCode = bad.length ? 1 : 0;
}

async function download() {
  const ids = [...new Set(Object.values(EXERCISE_IMAGE_MAP))];
  let ok = 0;
  let skipped = 0;
  const failed = [];
  for (const id of ids) {
    for (const frame of [0, 1]) {
      const file = path.join(OUT, id, `${frame}.jpg`);
      if (fs.existsSync(file) && fs.statSync(file).size > 0) {
        skipped++;
        continue;
      }
      try {
        const res = await fetch(`${CDN}${encodeURIComponent(id)}/${frame}.jpg`);
        if (!res.ok) throw new Error(String(res.status));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        ok++;
      } catch (e) {
        failed.push(`${id}/${frame}.jpg (${e.message})`);
      }
    }
  }
  console.log(`Baixadas: ${ok} · já existiam: ${skipped} · falharam: ${failed.length}`);
  failed.forEach((f) => console.log("  ✗ " + f));
  console.log(`Pasta: ${path.relative(root, OUT)} — faça o build normalmente (npm run build).`);
  process.exitCode = failed.length ? 1 : 0;
}

(mode === "baixar" ? download() : verify()).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
