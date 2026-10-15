import { lucideSvg } from "./icons.js";

export const STORAGE_KEY = "gym-data",
  THEME_KEY = "gym-theme",
  /* Vem do package.json no build (vite.config.js define __APP_VERSION__).
     Fora do build (testes em Node) cai em "dev". */
  APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
  /* Sessão: só expira após N dias sem abrir o app (ou ao tocar em Sair). */
  SESSION_IDLE_DAYS = 30,
  SESSION_IDLE_OPTIONS = [7, 14, 30, 60, 90],
  /* 4 = foto de perfil e backups automáticos moram no IndexedDB;
     settings.avatarUrl deixa de ser gravado no localStorage (continua aceito
     na leitura e em arquivos exportados). Histórico/snapshot não mudaram. */
  SCHEMA_VERSION = 4,
  AUTOBACKUP_KEY = "gym-autobackups",
  /* v8.6: o histórico de sessões mora no IndexedDB; no localStorage ficam só o
     "núcleo" (tudo menos sessions) e um diário com os dias ainda não confirmados. */
  CORE_KEY = "gym-data-v2",
  JOURNAL_KEY = "gym-journal",
  TABS = ["inicio", "treinos", "historico", "progresso", "ajustes"],
  KG_PER_LB = 0.45359237,
  SET_TYPES = ["normal", "warm", "drop", "fail"],
  PALETTE = ["#ff5a36", "#2f8fff", "#22c55e", "#ffb020", "#7c5cfc", "#12b3a8"],
  WEEKDAY_FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"],
  MONTH_NAMES_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  TAB_DEFS = [{
    id: "inicio",
    label: "Início",
    icon: lucideSvg(22, "house")
  }, {
    id: "treinos",
    label: "Treinos",
    icon: lucideSvg(22, "bicepsFlexed")
  }, {
    id: "historico",
    label: "Histórico",
    icon: lucideSvg(22, "calendar")
  }, {
    id: "progresso",
    label: "Progresso",
    icon: lucideSvg(22, "chartLine")
  }, {
    id: "ajustes",
    label: "Ajustes",
    icon: lucideSvg(22, "settings")
  }];
