import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

// package.json é a ÚNICA fonte da versão. Dela saem, no build:
//  - APP_VERSION (src/data/constants.js), via define __APP_VERSION__
//  - CACHE_NAME (public/sw.js), trocando o placeholder __APP_VERSION__
//  - um comentário /*! APP_VERSION="..." */ no topo do app.js, que o sw.js lê
//    (o minificador troca o nome da constante, então o regex não a acharia no código)
const pkg = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const APP_VERSION = `v${pkg.version}`;

function versionPlugin() {
  let outDir;
  return {
    name: "meus-treinos-version",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    // roda depois de tudo escrito (inclusive minificado e public/ copiado)
    closeBundle() {
      const appPath = path.join(outDir, "app.js");
      const app = fs.readFileSync(appPath, "utf8");
      fs.writeFileSync(appPath, `/*! APP_VERSION="${APP_VERSION}" */\n` + app);

      const swPath = path.join(outDir, "sw.js");
      const sw = fs.readFileSync(swPath, "utf8");
      if (!sw.includes("__APP_VERSION__")) throw new Error("sw.js sem o placeholder __APP_VERSION__");
      fs.writeFileSync(swPath, sw.split("__APP_VERSION__").join(APP_VERSION));
    }
  };
}

export default defineConfig({
  // caminho relativo: funciona tanto em usuario.github.io/repo/ quanto num domínio próprio
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION)
  },
  plugins: [versionPlugin()],
  build: {
    outDir: "dist",
    // nomes de saída fixos (sem hash) para o service worker (sw.js) poder
    // pré-cachear "./app.js" e "./app.css" sem precisar descobrir o hash a cada build
    rollupOptions: {
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: (info) => {
          if (info.names?.some((n) => n.endsWith(".css"))) return "app.css";
          return "assets/[name][extname]";
        }
      }
    }
  }
});
