// Legibilidade: contraste WCAG AA (4,5:1) dos tokens de texto/botão nos dois temas,
// nenhuma fonte abaixo de 12px, e movimento reduzido em toda animação (inclusive o confete).
// Roda em Node puro (só lê arquivos e importa módulos sem DOM).
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
const blank = (m) => m.replace(/[^\n]/g, "");
const noComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, blank);

/* ---------- tokens por tema ---------- */
const tokens = read("src/styles/tokens.css");
const declsOf = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].replace(/\/\*.*?\*\//g, "").trim()]));
const bodyAfter = (re) => {
  const m = re.exec(tokens);
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
const dark = { ...light, ...declsOf(bodyAfter(/^:root\[data-theme="dark"\]\s*\{/m)) };

/* ---------- cor e contraste (WCAG 2.x) ---------- */
const parse = (v) => {
  v = v.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return { rgb: [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error("cor não suportada no teste: " + v);
};
const over = (fg, bg) => fg.rgb.map((c, i) => Math.round(c * fg.a + bg.rgb[i] * (1 - fg.a)));
const lum = (rgb) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const solid = (theme, name, under) => {
  const c = parse(theme[name]);
  return c.a < 1 ? { rgb: over(c, { rgb: under, a: 1 }), a: 1 } : c;
};

const MIN = 4.5;
for (const [label, T] of [
  ["claro", light],
  ["escuro", dark]
]) {
  const surfaces = ["--bg", "--surface", "--surface-2", "--surface-3"];
  const worst = (fgName, tintName) => {
    const rows = [];
    for (const s of surfaces) {
      const base = parse(T[s]).rgb;
      rows.push([`${fgName} / ${s}`, ratio(parse(T[fgName]).rgb, base)]);
      if (tintName) rows.push([`${fgName} / ${tintName} sobre ${s}`, ratio(parse(T[fgName]).rgb, solid(T, tintName, base).rgb)]);
    }
    return rows.sort((a, b) => a[1] - b[1])[0];
  };
  for (const [fg, tint] of [
    ["--accent-text", "--accent-soft"],
    ["--danger-text", "--danger-bg"],
    ["--text-muted", null],
    ["--text-secondary", null],
    ["--text-label", null]
  ]) {
    const [what, r] = worst(fg, tint);
    check(`contraste ${label}: ${fg} ≥ ${MIN}:1 em todos os fundos (pior: ${what} = ${r.toFixed(2)})`, r >= MIN, what + " " + r.toFixed(2));
  }
  // botões/superfícies laranja: texto escuro (--accent-on) em todo o gradiente
  for (const bg of ["--accent", "--accent-2", "--accent-hi", "--accent-deep"]) {
    const r = ratio(parse(T["--accent-on"]).rgb, parse(T[bg]).rgb);
    check(`contraste ${label}: --accent-on sobre ${bg} = ${r.toFixed(2)} ≥ ${MIN}`, r >= MIN);
  }
  // elementos sobre a tinta (login, hero, timer): o laranja e os vermelhos "on-ink" precisam passar nas três tintas
  for (const ink of ["--ink", "--ink-2", "--ink-3"]) {
    for (const fg of ["--accent", "--danger-on-ink", "--danger-on-ink-soft"]) {
      const r = ratio(parse(T[fg]).rgb, parse(T[ink]).rgb);
      check(`contraste ${label}: ${fg} sobre ${ink} = ${r.toFixed(2)} ≥ ${MIN}`, r >= MIN);
    }
  }
}

/* ---------- cor de texto laranja/vermelha crua só onde o contraste já está garantido ---------- */
// `color: var(--accent)` / `var(--danger)` puros só valem em: ícones (svg/.record-ico, sem texto), texto sobre a tinta
// (.login-*, .hero-*; conferido acima) e no :active de botão-ícone. (Cuidado: cor num contêiner é herdada pelo texto dentro dele.) Texto em fundo claro usa --accent-text / --danger-text.
const RAW_OK = [/svg/, /\.stat-mini/, /\.record-ico/, /\.sds-del/, /\.login-/, /\.hero-v2-/];
const rawBad = [];
for (const f of walk("src/styles", [".css"])) {
  if (f.endsWith("tokens.css")) continue;
  for (const m of noComments(read(f)).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/(^|[;\s])color\s*:\s*var\(--(accent|danger)\)/.test(m[2])) continue;
    const sel = m[1].trim();
    if (!sel.split(",").every((s) => RAW_OK.some((re) => re.test(s)))) rawBad.push(`${path.basename(f)}: ${sel}`);
  }
}
check("texto laranja/vermelho usa --accent-text/--danger-text (cru só em ícone e sobre a tinta)", rawBad.length === 0, rawBad.join(" | "));

/* ---------- nenhuma fonte abaixo de 12px ---------- */
const smallFonts = [];
for (const f of walk("src/styles", [".css"])) {
  noComments(read(f))
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
        const v = m[1].trim();
        const num = parseFloat(v);
        let px = NaN;
        if (/px$/.test(v)) px = num;
        else if (/r?em$/.test(v)) px = num * 16;
        else if (/%$/.test(v)) px = num * 0.16;
        else if (/^(xx-small|x-small|small|smaller)$/.test(v)) px = 0;
        if (!(px >= 12)) smallFonts.push(`${path.basename(f)}:${i + 1} ${v}`);
      }
    });
}
check("fontes: nenhum font-size < 12px nos CSS", smallFonts.length === 0, smallFonts.join(", "));
// texto dentro de SVG (viewBox 300 de largura no gráfico, escala ≈0,95 em 320px): ≥ 13 unidades rendem ≥ 12px
const svgSmall = [];
for (const f of walk("src", [".js"])) {
  read(f)
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) if (+m[1] < 13) svgSmall.push(`${f.split(path.sep).join("/")}:${i + 1} ${m[1]}`);
    });
}
check("fontes: texto em SVG com font-size ≥ 13 unidades do viewBox (≥ 12px na tela mais estreita)", svgSmall.length === 0, svgSmall.join(", "));

/* ---------- movimento reduzido ---------- */
const allCss = walk("src/styles", [".css"])
  .map((f) => noComments(read(f)))
  .join("\n");
const rm = [...allCss.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g)];
let rmBody = "";
for (const m of rm) {
  let i = m.index + m[0].length,
    depth = 1,
    j = i;
  while (depth && j < allCss.length) {
    const c = allCss[j++];
    if (c === "{") depth++;
    else if (c === "}") depth--;
  }
  rmBody += allCss.slice(i, j - 1);
}
const universal = /\*\s*,\s*\*::before\s*,\s*\*::after\s*\{([^}]*)\}/.exec(rmBody)?.[1] || "";
for (const prop of ["animation-duration", "animation-iteration-count", "transition-duration", "scroll-behavior"]) {
  check(`movimento: bloco reduce zera ${prop} em *, ::before e ::after com !important`, new RegExp(prop + "\\s*:[^;]+!important").test(universal));
}
check("movimento: o confete fica oculto em reduce (defesa em profundidade)", /\.confetti\s*\{[^}]*display\s*:\s*none/.test(rmBody));
const anims = [...allCss.matchAll(/animation\s*:\s*(\w+)/g)].map((m) => m[1]).filter((n) => n !== "none");
check(
  `movimento: ${anims.length} usos de animation no CSS, todos cobertos pelo seletor universal (${[...new Set(anims)].join(", ")})`,
  anims.length === 0 || universal !== ""
);
const jsMotion = walk("src", [".js"]).filter((f) => /requestAnimationFrame|\.animate\(|navigator\.vibrate/.test(read(f)));
const jsMotionBad = jsMotion.filter((f) => !/prefersReducedMotion|prefers-reduced-motion/.test(read(f)));
check("movimento: todo JS que anima/vibra consulta prefers-reduced-motion", jsMotionBad.length === 0, jsMotionBad.join(", "));

/* confete: com movimento reduzido não cria nada; sem, cria 28 peças com cores de token e remove depois */
let reduce = true,
  appended = [],
  timers = [];
global.window = { matchMedia: (q) => ({ matches: reduce && /prefers-reduced-motion/.test(q) }) };
global.document = {
  body: { appendChild: (n) => appended.push(n) },
  createElement: (tag) => ({
    tag,
    style: {},
    children: [],
    appendChild(c) {
      this.children.push(c);
    },
    remove() {
      this.removed = true;
    }
  })
};
global.setTimeout = (fn) => {
  timers.push(fn);
  return 0;
};
const { confetti, CONFETTI_COLORS } = await import("../src/ui/confetti.js");
confetti();
check("confete: com prefers-reduced-motion não cria elemento nenhum", appended.length === 0 && timers.length === 0);
reduce = false;
confetti();
check(
  "confete: sem reduced-motion cria o contêiner com 28 peças",
  appended.length === 1 && appended[0].children.length === 28,
  String(appended[0]?.children.length)
);
check(
  "confete: cores vêm de tokens (var(--...)), nunca de hex",
  CONFETTI_COLORS.every((c) => /^var\(--[\w-]+\)$/.test(c)) && appended[0].children.every((p) => /background:var\(--[\w-]+\)/.test(p.style.cssText))
);
timers.forEach((fn) => fn());
check("confete: remove o contêiner depois da animação", appended[0].removed === true);

process.exit(fails ? 1 : 0);
