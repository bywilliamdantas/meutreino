import { SCHEMA_VERSION } from "../data/constants.js";

export function validateBackup(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return {
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
  const consistent = p.order.every(k => typeof k === "string" && p.workouts[k] && typeof p.workouts[k] === "object");
  if (!consistent) return {
    ok: false,
    error: "Backup com treinos inconsistentes"
  };
  Object.values(p.workouts).forEach(w => {
    if (!Array.isArray(w.exercises)) w.exercises = [];
    if (typeof w.name !== "string") w.name = "Treino";
    w.exercises = w.exercises.filter(e => e && typeof e === "object" && e.id);
  });
  if (p.sessions && typeof p.sessions === "object" && !Array.isArray(p.sessions)) {
    Object.keys(p.sessions).forEach(k => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) delete p.sessions[k];
    });
  } else {
    p.sessions = {};
  }
  return {
    ok: true
  };
}

export async function deliverFile(content, filename, mime, shareTitle) {
  try {
    const file = new File([content], filename, {
      type: mime
    });
    if (navigator.canShare && navigator.canShare({
      files: [file]
    })) {
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
