import { SCHEMA_VERSION, SET_TYPES } from "../data/constants.js";

const SET_NUMERIC_FIELDS = ["weight", "reps", "minutes"];

/* Chaves de treino e ids vão para atributos HTML (data-letter, data-exid…):
   só letras, números, "_" e "-". Qualquer outra coisa num arquivo importado é recusada. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const isSafeId = (v) => typeof v === "string" && SAFE_ID.test(v);

/* Valor numérico de uma série: número finito e >= 0. Texto numérico ("40", "42,5") vira número.
   Qualquer outra coisa (NaN, Infinity, negativo, texto, objeto) vira null. Devolve [valor, mudou]. */
function cleanSetNumber(v) {
  if (v === undefined || v === null) return [v, false];
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? [v, false] : [null, true];
  if (typeof v === "string") {
    const t = v.trim().replace(",", ".");
    const n = t === "" ? NaN : Number(t);
    return Number.isFinite(n) && n >= 0 ? [n, true] : [null, true];
  }
  return [null, true];
}

/* Conserta uma série no lugar. Devolve true se mudou alguma coisa. */
function cleanSet(s) {
  let changed = false;
  SET_NUMERIC_FIELDS.forEach((f) => {
    if (!(f in s)) return;
    const [val, ch] = cleanSetNumber(s[f]);
    if (ch) {
      s[f] = val;
      changed = true;
    }
  });
  if ("type" in s && !SET_TYPES.includes(s.type)) {
    s.type = "normal";
    changed = true;
  }
  return changed;
}

/* Valida o log de uma sessão ({ exId: [séries] }). Séries que não são objetos são descartadas;
   campos inválidos viram null / "normal". Soma em `stats` (fixed = séries consertadas,
   dropped = entradas descartadas). */
function cleanLog(log, stats) {
  Object.keys(log).forEach((exId) => {
    if (!isSafeId(exId)) {
      delete log[exId];
      stats.dropped++;
      return;
    }
    const v = log[exId];
    if (Array.isArray(v)) {
      const kept = [];
      v.forEach((s) => {
        if (!s || typeof s !== "object" || Array.isArray(s)) {
          stats.dropped++;
          return;
        }
        if (cleanSet(s)) stats.fixed++;
        kept.push(s);
      });
      log[exId] = kept;
    } else if (v && typeof v === "object") {
      /* formato antigo: { weight, reps } — a migração depois o transforma em série */
      if (cleanSet(v)) stats.fixed++;
    } else {
      stats.dropped++;
      log[exId] = [];
    }
  });
}

/* Valida as sessões: descarta sessões que não são objetos e limpa o conteúdo das séries. */
function cleanSessions(sessions, stats) {
  Object.keys(sessions).forEach((k) => {
    const v = sessions[k];
    const list = Array.isArray(v) ? v : [v];
    const kept = [];
    list.forEach((sess) => {
      if (!sess || typeof sess !== "object" || Array.isArray(sess)) {
        if (typeof sess === "string" && isSafeId(sess))
          kept.push(sess); // formato antigo (só a letra do treino)
        else stats.dropped++;
        return;
      }
      if (sess.log !== undefined && (!sess.log || typeof sess.log !== "object" || Array.isArray(sess.log))) {
        sess.log = {};
        stats.dropped++;
      }
      if (sess.log) cleanLog(sess.log, stats);
      if ("id" in sess && !isSafeId(sess.id)) delete sess.id; // a migração gera um id novo
      if (sess.letter != null && !isSafeId(sess.letter)) {
        sess.letter = null;
        stats.dropped++;
      }
      if (Array.isArray(sess.snapshot)) {
        const snap = sess.snapshot.filter((ex) => ex && typeof ex === "object" && isSafeId(ex.id));
        stats.dropped += sess.snapshot.length - snap.length;
        sess.snapshot = snap;
      } else if (sess.snapshot !== undefined) {
        delete sess.snapshot;
        stats.dropped++;
      }
      kept.push(sess);
    });
    if (Array.isArray(v)) sessions[k] = kept;
    else if (kept.length) sessions[k] = kept[0];
    else delete sessions[k];
  });
}

/* Texto para avisar o usuário depois de validar um arquivo ("" quando nada precisou de conserto). */
export function importFixMessage(v) {
  if (!v || (!v.fixed && !v.dropped)) return "";
  const parts = [];
  if (v.fixed) parts.push(`${v.fixed} ${v.fixed === 1 ? "série corrigida" : "séries corrigidas"}`);
  if (v.dropped) parts.push(`${v.dropped} ${v.dropped === 1 ? "entrada descartada" : "entradas descartadas"}`);
  return `Importação: ${parts.join(" e ")} (dados inválidos no arquivo)`;
}

export function validateBackup(p) {
  if (!p || typeof p !== "object" || Array.isArray(p))
    return {
      ok: false,
      error: "Arquivo inválido"
    };
  if (typeof p.schemaVersion === "number" && p.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: "Backup de uma versão mais nova do app"
    };
  }
  if (!Array.isArray(p.order) || !p.workouts || typeof p.workouts !== "object" || Array.isArray(p.workouts)) {
    return {
      ok: false,
      error: "Formato de backup inválido"
    };
  }
  const consistent = p.order.every((k) => typeof k === "string" && p.workouts[k] && typeof p.workouts[k] === "object");
  if (!consistent)
    return {
      ok: false,
      error: "Backup com treinos inconsistentes"
    };
  if (!p.order.every(isSafeId) || !Object.keys(p.workouts).every(isSafeId))
    return {
      ok: false,
      error: "Backup com nomes de treino inválidos"
    };
  const stats = {
    fixed: 0,
    dropped: 0
  };
  Object.values(p.workouts).forEach((w) => {
    if (!w || typeof w !== "object") return;
    if (!Array.isArray(w.exercises)) w.exercises = [];
    if (typeof w.name !== "string") w.name = "Treino";
    const before = w.exercises.length;
    w.exercises = w.exercises.filter((e) => e && typeof e === "object" && isSafeId(e.id));
    stats.dropped += before - w.exercises.length;
  });
  if (Array.isArray(p.body)) {
    p.body.forEach((b) => {
      if (b && typeof b === "object" && "id" in b && !isSafeId(b.id)) delete b.id; // a migração gera um id novo
    });
  }
  if (p.sessions && typeof p.sessions === "object" && !Array.isArray(p.sessions)) {
    Object.keys(p.sessions).forEach((k) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) delete p.sessions[k];
    });
  } else {
    p.sessions = {};
  }
  cleanSessions(p.sessions, stats);
  return {
    ok: true,
    fixed: stats.fixed,
    dropped: stats.dropped
  };
}

export async function deliverFile(content, filename, mime, shareTitle) {
  try {
    const file = new File([content], filename, {
      type: mime
    });
    if (
      navigator.canShare &&
      navigator.canShare({
        files: [file]
      })
    ) {
      await navigator.share({
        files: [file],
        title: shareTitle
      });
      return "shared";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled";
  }
  const blob = new Blob([content], {
    type: mime
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
