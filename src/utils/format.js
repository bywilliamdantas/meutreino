import { KG_PER_LB } from "../data/constants.js";
import { store } from "../store.js";

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function dateKeyFromDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey() {
  return dateKeyFromDate(new Date());
}

export function fmtWeight(v) {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return (Math.round(n * 1000) / 1000).toString().replace(".", ",");
}

export function fmtDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return "<1 min";
  if (totalMin < 60) return totalMin + " min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? h + "h" : h + "h " + m + "min";
}

export function fmtDurationShort(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return "<1min";
  if (totalMin < 60) return totalMin + "min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? h + "h" : h + "h" + m;
}

export function fmtClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = s % 60;
  if (h > 0) return h + ":" + pad(m) + ":" + pad(sec);
  return pad(m) + ":" + pad(sec);
}

export function unit() {
  return store.data.settings && store.data.settings.unit === "lb" ? "lb" : "kg";
}

export function toDisp(kg) {
  if (kg == null) return null;
  return unit() === "lb" ? kg / KG_PER_LB : kg;
}

export function fromDisp(v) {
  if (v == null) return null;
  const kg = unit() === "lb" ? v * KG_PER_LB : v;
  return Math.round(kg * 10000) / 10000;
}

export function fmtW(kg) {
  if (kg == null || kg === "" || isNaN(Number(kg))) return "";
  const d = toDisp(Number(kg));
  const r = unit() === "lb" ? Math.round(d * 10) / 10 : Math.round(d * 100) / 100;
  return String(r).replace(".", ",");
}

export function weightStep() {
  return unit() === "lb" ? 5 : 2.5;
}

export function fmtVolume(kg) {
  const v = Math.round(toDisp(kg));
  return v.toLocaleString("pt-BR") + " " + unit();
}
