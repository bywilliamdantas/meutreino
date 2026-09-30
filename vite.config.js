import { defineConfig } from "vite";

export default defineConfig({
  // caminho relativo: funciona tanto em usuario.github.io/repo/ quanto num domínio próprio
  base: "./",
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
