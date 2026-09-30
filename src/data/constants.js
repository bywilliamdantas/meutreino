export const STORAGE_KEY = "gym-data",
  THEME_KEY = "gym-theme",
  APP_VERSION = "v8.0",
  SCHEMA_VERSION = 3,
  AUTOBACKUP_KEY = "gym-autobackups",
  TABS = ["inicio", "treinos", "historico", "progresso", "ajustes"],
  KG_PER_LB = 0.45359237,
  SET_TYPES = ["normal", "warm", "drop", "fail"],
  PALETTE = ["#ff5a36", "#2f8fff", "#22c55e", "#ffb020", "#7c5cfc", "#12b3a8"],
  WEEKDAY_FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"],
  MONTH_NAMES_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  TAB_DEFS = [{
    id: "inicio",
    label: "Início",
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>`
  }, {
    id: "treinos",
    label: "Treinos",
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 21c-.3 0-.5-.3-.5-.6V7C3 5 4.5 3.5 6.5 3.5S10 5 10 7v3.5c.8-2.7 3-4.5 6-4.5 3.3 0 5.5 2.7 5.5 6 0 1.8-.9 3.1-2.3 3.7-1.7.7-3.2 1.4-4.4 2.8C13.5 20.2 11.5 21 9 21z"/><path d="M13 12.5c1-1.9 3.5-2 4.7-.3"/><path d="M3 8h7"/></svg>`
  }, {
    id: "historico",
    label: "Histórico",
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`
  }, {
    id: "progresso",
    label: "Progresso",
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16M8 15l3-4 3 3 4-6"/></svg>`
  }, {
    id: "ajustes",
    label: "Ajustes",
    icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z"/></svg>`
  }];
