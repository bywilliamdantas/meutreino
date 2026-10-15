import { SET_TYPE_NAME } from "../config.js";
import { muscleGroupOf } from "../exercises/exercises.js";
import { store } from "../store.js";
import { sessionsFor } from "../workouts/sessions.js";

export const CSV_HEADER = [
  "data",
  "ordem",
  "treino",
  "exercicio",
  "tipo",
  "serie",
  "tipo_serie",
  "peso_kg",
  "reps",
  "minutos",
  "feito",
  "rpe",
  "nota_exercicio",
  "nota_treino",
  "grupo_muscular"
];

/* Injeção de fórmula: Excel/Sheets executam células que começam com = + - @. O apóstrofo
   na frente faz a planilha tratar a célula como texto. */
export function neutralizeFormula(v) {
  const s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

export function csvCell(v) {
  return `"${neutralizeFormula(v).replace(/"/g, '""')}"`;
}

/* Linhas do CSV a partir de store.data. O nome, o tipo e o grupo vêm primeiro da "foto" da
   sessão (snapshot), para o histórico sair como foi registrado; só depois do treino atual. */
export function buildCsvRows() {
  const rows = [CSV_HEADER];
  Object.keys(store.data.sessions)
    .sort()
    .forEach((dateKey) => {
      sessionsFor(dateKey).forEach((sess, sessIdx) => {
        if (!sess || typeof sess !== "object") return;
        const letter = sess.letter;
        const log = sess.log || {};
        const w = store.data.workouts[letter];
        const exMap = {};
        (w?.exercises || []).forEach((ex) => (exMap[ex.id] = ex));
        Object.keys(log).forEach((exId) => {
          const snap = Array.isArray(sess.snapshot) ? sess.snapshot.find((e) => e.id === exId) : null;
          const src = snap || exMap[exId] || null;
          const name = (src && src.name) || exId;
          const type = (src && src.type) || "strength";
          const group = muscleGroupOf(src && src.name, src);
          const xm = (sess.meta && sess.meta[exId]) || {};
          (log[exId] || []).forEach((s, i) => {
            rows.push([
              dateKey,
              String(sessIdx + 1),
              letter || "",
              name,
              type === "cardio" ? "cardio" : "forca",
              String(i + 1),
              SET_TYPE_NAME[s.type] || "normal",
              s.weight != null ? String(s.weight).replace(".", ",") : "",
              s.reps != null ? String(s.reps) : "",
              s.minutes != null ? String(s.minutes) : "",
              s.done ? "1" : "0",
              i === 0 && xm.rpe != null ? String(xm.rpe) : "",
              i === 0 && xm.note ? xm.note : "",
              i === 0 && sess.note ? sess.note : "",
              group
            ]);
          });
        });
      });
    });
  return rows;
}

export function buildCsv() {
  return buildCsvRows()
    .map((r) => r.map(csvCell).join(","))
    .join("\n");
}
