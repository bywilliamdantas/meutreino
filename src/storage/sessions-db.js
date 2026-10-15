import { ST_SESSIONS, runTx } from "./idb.js";

/* Registro por dia: { id: "user|AAAA-MM-DD", user, date, sessions }.
   `sessions` guarda o valor do dia exatamente como está em store.data.sessions. */
export const dayRowId = (user, date) => `${user}|${date}`;
export const migrationMetaKey = (user) => `sessions-migration:${user}`;

/* Grava e apaga dias numa única transação: ou tudo, ou nada. */
export function dbWriteDays(user, puts = {}, deletes = []) {
  return runTx(ST_SESSIONS, "readwrite", (s) => {
    Object.keys(puts).forEach((date) => s.put({ id: dayRowId(user, date), user, date, sessions: puts[date] }));
    deletes.forEach((date) => s.delete(dayRowId(user, date)));
  });
}

/* { days: { data: valor }, corrupt: [ids] } — registro malformado não derruba a
   leitura nem é apagado: só fica de fora e é reportado. */
export async function dbReadDays(user) {
  const rows = await runTx(ST_SESSIONS, "readonly", (s) => {
    const r = s.index("user").getAll(user);
    return () => r.result;
  });
  const days = {};
  const corrupt = [];
  rows.forEach((r) => {
    if (r && typeof r === "object" && typeof r.date === "string" && "sessions" in r) days[r.date] = r.sessions;
    else corrupt.push(r && r.id);
  });
  return { days, corrupt };
}

/* Só os dias pedidos (leitura de volta após gravar). Dia ausente não aparece. */
export function dbReadDaysSubset(user, dates) {
  return runTx(ST_SESSIONS, "readonly", (s) => {
    const reqs = dates.map((d) => [d, s.get(dayRowId(user, d))]);
    return () => {
      const out = {};
      reqs.forEach(([d, r]) => {
        if (r.result && "sessions" in r.result) out[d] = r.result.sessions;
      });
      return out;
    };
  });
}

export async function dbListDayKeys(user) {
  const rows = await runTx(ST_SESSIONS, "readonly", (s) => {
    const r = s.index("user").getAll(user);
    return () => r.result;
  });
  return rows.map((r) => r && r.date).filter((d) => typeof d === "string");
}
