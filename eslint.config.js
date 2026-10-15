import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "dist/"] },
  js.configs.recommended,
  {
    // código do app: ES modules rodando no navegador
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        // injetado pelo Vite (define em vite.config.js); fora do build não existe
        __APP_VERSION__: "readonly"
      }
    }
  },
  {
    // service worker (script clássico, não é módulo)
    files: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.serviceworker }
    }
  },
  {
    // testes e config do Vite: Node. Os testes de navegador simulado (jsdom)
    // também usam window/document/localStorage como globais.
    files: ["tests/**/*.mjs", "vite.config.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser }
    }
  },
  {
    rules: {
      // `try { ... } catch (e) {}` é o padrão do projeto para localStorage/IndexedDB/
      // crypto indisponíveis (modo privado, quota): falhar em silêncio é intencional.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": ["error", { caughtErrors: "none" }]
    }
  }
];
