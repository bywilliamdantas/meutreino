// Versão única: package.json -> APP_VERSION (app.js), CACHE_NAME (sw.js) e o regex
// que o sw.js usa para ler a versão publicada. Roda sobre o dist/ do `npm run build`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const version = JSON.parse(read("package.json")).version;
const APP_VERSION = `v${version}`;

test("código-fonte não tem versão escrita à mão", () => {
  const constants = read("src/data/constants.js");
  assert.match(constants, /__APP_VERSION__/);
  assert.doesNotMatch(constants, /APP_VERSION\s*=\s*"v?\d/);
  const swSrc = read("public/sw.js");
  assert.match(swSrc, /CACHE_NAME\s*=\s*"meus-treinos-__APP_VERSION__"/);
});

test("dist/sw.js: CACHE_NAME bate com o package.json e não sobra placeholder", () => {
  const sw = read("dist/sw.js");
  assert.match(sw, new RegExp(`const CACHE_NAME = "meus-treinos-${APP_VERSION.replace(/\./g, "\\.")}";`));
  assert.ok(!sw.includes("__APP_VERSION__"));
});

test("dist/app.js: APP_VERSION embutida bate com o package.json", () => {
  const app = read("dist/app.js");
  assert.ok(!app.includes("__APP_VERSION__"));
  assert.ok(app.includes("`" + APP_VERSION + "`") || app.includes(`"${APP_VERSION}"`), "versão não aparece no código");
});

test("regex do sw.js lê do dist/app.js a mesma versão do package.json", () => {
  const sw = read("dist/sw.js");
  const m = /const VERSION_RE = (\/.+\/);/.exec(sw);
  assert.ok(m, "VERSION_RE não encontrado no sw.js");
  const re = new Function(`return ${m[1]}`)();
  const found = re.exec(read("dist/app.js"));
  assert.ok(found, "o regex do sw.js não casa com o dist/app.js");
  assert.equal(found[1], APP_VERSION);
});
