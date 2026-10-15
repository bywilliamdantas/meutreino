// Tokens e tema: claro/escuro em sincronia, theme-color = --bg de cada tema,
// sem hacks de especificidade e sem style="" estático nas views.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { THEME_COLOR } from "../src/theme.js";

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

/* ---------- tokens.css ---------- */
const tokens = read("src/styles/tokens.css");
const declsOf = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const bodyAfter = (re) => {
  const m = re.exec(tokens);
  if (!m) return null;
  let i = tokens.indexOf("{", m.index) + 1,
    depth = 1,
    j = i;
  while (depth && j < tokens.length) {
    const c = tokens[j++];
    if (c === "{") depth++;
    else if (c === "}") depth--;
  }
  return tokens.slice(i, j - 1);
};
const light = declsOf(bodyAfter(/^:root\s*\{/m));
const darkAuto = declsOf(bodyAfter(/:root:not\(\[data-theme="light"\]\)\s*\{/));
const darkForced = declsOf(bodyAfter(/^:root\[data-theme="dark"\]\s*\{/m));

check(
  "tokens: tema escuro 'auto' e 'forçado' são idênticos",
  JSON.stringify(Object.entries(darkAuto).sort()) === JSON.stringify(Object.entries(darkForced).sort()),
  JSON.stringify(
    Object.keys(darkAuto)
      .filter((k) => darkAuto[k] !== darkForced[k])
      .concat(Object.keys(darkForced).filter((k) => !(k in darkAuto)))
  )
);
const orphan = Object.keys(darkForced).filter((k) => !(k in light) && k !== "color-scheme");
check("tokens: todo token do escuro existe no claro", orphan.length === 0, orphan.join(", "));
check("tokens: --bg definido nos dois temas", !!light["--bg"] && !!darkForced["--bg"]);

/* ---------- theme-color ---------- */
const html = read("index.html");
const meta = /<meta name="theme-color" content="([^"]+)"/.exec(html)?.[1];
const manifest = JSON.parse(read("public/manifest.json"));
const norm = (c) => String(c).toLowerCase();
check("theme-color: THEME_COLOR.light = --bg claro", norm(THEME_COLOR.light) === norm(light["--bg"]), `${THEME_COLOR.light} vs ${light["--bg"]}`);
check("theme-color: THEME_COLOR.dark = --bg escuro", norm(THEME_COLOR.dark) === norm(darkForced["--bg"]), `${THEME_COLOR.dark} vs ${darkForced["--bg"]}`);
check("theme-color: index.html = --bg claro", norm(meta) === norm(light["--bg"]), `${meta} vs ${light["--bg"]}`);
check(
  "theme-color: manifest.json = --bg claro",
  norm(manifest.theme_color) === norm(light["--bg"]) && norm(manifest.background_color) === norm(light["--bg"]),
  `${manifest.theme_color}/${manifest.background_color}`
);

/* ---------- CSS sem hacks e sem token indefinido ---------- */
const cssFiles = walk("src/styles", [".css"]);
const allCss = cssFiles.map((f) => [f, read(f)]);
const hacks = allCss.flatMap(([f, c]) => [...c.matchAll(/(\.[\w-]+)\1\1/g)].map((m) => f + ": " + m[0]));
check("css: sem hack de especificidade (.a.a.a)", hacks.length === 0, hacks.join(", "));
check("css: design.css sem camadas 'v8'/'Rodada'", !/Rodada|camada visual v8/i.test(read("src/styles/design.css")));
check(
  "css: tokens declarados só em tokens.css (fora dele, só custom properties de componente)",
  allCss.filter(([f]) => !f.endsWith("tokens.css")).every(([, c]) => !/:root\s*\{/.test(c))
);

const jsFiles = walk("src", [".js"]);
const assigned = new Set(Object.keys(light));
for (const [, c] of allCss) for (const m of c.matchAll(/(--[\w-]+)\s*:/g)) assigned.add(m[1]);
for (const f of jsFiles) for (const m of read(f).matchAll(/(--[\w-]+)\s*:|setProperty\(\s*["'`](--[\w-]+)/g)) assigned.add(m[1] || m[2]);
const used = new Set();
for (const [, c] of allCss) for (const m of c.matchAll(/var\((--[\w-]+)/g)) used.add(m[1]);
for (const f of jsFiles) for (const m of read(f).matchAll(/var\((--[\w-]+)/g)) used.add(m[1]);
const undef = [...used].filter((k) => !assigned.has(k));
check("css: todo var(--x) usado está definido", undef.length === 0, undef.join(", "));

/* ---------- views sem style="" estático ---------- */
const inlineBad = [];
for (const f of [...jsFiles, "index.html"]) {
  read(f)
    .split("\n")
    .forEach((line, i) => {
      inlineBad.push(...Array.from(line.matchAll(/style="(?!\$\{toneVars\(|--pct:)/g), () => `${f}:${i + 1}`));
    });
}
check("views: só style com valor de dado (--tone/--pct); nada de estilo estático inline", inlineBad.length === 0, inlineBad.join(", "));

/* ---------- nenhuma cor fixa (hex) fora de tokens.css ---------- */
// Toda cor nasce em tokens.css; CSS e JS usam var(--token). Exceções (cada uma com o porquê);
// um hex novo, ou diferente do listado, em qualquer arquivo de src/ ou no index.html derruba o teste.
const HEX_ALLOW = {
  "src/theme.js": ["#f3f2ef", "#0e0b12"], // theme-color da barra do navegador: literal por exigência do <meta>; igualdade com --bg conferida acima
  "index.html": ["#f3f2ef"], // idem (valor estático do <meta name=\"theme-color\">)
  "src/data/constants.js": ["#ff5a36", "#2f8fff", "#22c55e", "#ffb020", "#7c5cfc", "#12b3a8"], // PALETTE: cor de dado do treino (vira --tone inline, com alfa hex anexado)
  "src/config.js": ["#8b8b94"], // REST_COLOR: cor de dado do descanso (idem)
  "src/icons-svg.js": "*" // ilustração do logo (gradientes do desenho, não UI)
};
const blank = (m) => m.replace(/[^\n]/g, ""); // some o comentário mas mantém as quebras de linha (o número da linha do relatório continua certo)
const stripComments = (f, src) =>
  f.endsWith(".css")
    ? src.replace(/\/\*[\s\S]*?\*\//g, blank)
    : src
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/<!--[\s\S]*?-->/g, blank)
        .split("\n")
        .map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"))
        .join("\n");
const hexScan = [...walk("src", [".css", ".js"]), "index.html"].filter((f) => !f.endsWith("tokens.css"));
const hexBad = [];
for (const f of hexScan) {
  const key = f.split(path.sep).join("/");
  const allowed = HEX_ALLOW[key];
  if (allowed === "*") continue;
  stripComments(f, read(f))
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        if (![4, 5, 7, 9].includes(m[0].length)) continue;
        if (!(allowed || []).map(norm).includes(norm(m[0]))) hexBad.push(`${key}:${i + 1} ${m[0]}`);
      }
    });
}
check("cores: nenhum hex fora de tokens.css (exceções documentadas em HEX_ALLOW)", hexBad.length === 0, hexBad.join(", "));
const allowStale = Object.entries(HEX_ALLOW).filter(([f, v]) => v !== "*" && !v.every((h) => read(f).toLowerCase().includes(h)));
check("cores: toda exceção de HEX_ALLOW ainda existe no arquivo (sem exceção morta)", allowStale.length === 0, allowStale.map(([f]) => f).join(", "));

process.exit(fails ? 1 : 0);
