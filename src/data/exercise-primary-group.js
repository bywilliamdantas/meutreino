import { EXERCISE_LIBRARY } from "./exercise-library.js";

/* Exercícios que aparecem em mais de um grupo da biblioteca. O grupo PRINCIPAL é o usado
   nas estatísticas (muscleGroupOf); os demais grupos só servem para a navegação do picker.
   Chave: nome em minúsculas. O teste tests/progression.test.mjs garante que toda duplicata
   da biblioteca está aqui e que o principal é um dos grupos em que ela aparece. */
export const PRIMARY_GROUP = {
  "agachamento sumô": "Quadríceps",
  "afundo búlgaro": "Quadríceps",
  "afundo caminhando": "Quadríceps",
  "afundo reverso": "Glúteos",
  "sissy squat": "Quadríceps",
  "pistol squat": "Quadríceps",
  "step-up": "Glúteos",
  "levantamento terra": "Posteriores de coxa",
  "levantamento terra sumô": "Posteriores de coxa",
  "levantamento terra romeno": "Posteriores de coxa",
  "good morning": "Posteriores de coxa",
  "nordic curl": "Posteriores de coxa",
  "pull-through": "Glúteos",
  "abdução no cabo": "Abdutores",
  "adução no cabo": "Adutores",
  "copenhagen plank": "Adutores",
  "supino inclinado com barra": "Peitoral superior",
  "supino inclinado com halteres": "Peitoral superior",
  "supino declinado com halteres": "Peitoral inferior",
  "pullover com halter": "Costas / Dorsal",
  "remada alta": "Trapézio",
  "farmer's walk": "Antebraço",
  "face pull": "Deltoide posterior",
  "y-raise no cabo": "Trapézio",
  "rosca martelo": "Bíceps",
  "paralelas": "Tríceps"
};

/* Nome (minúsculas) → todos os grupos da biblioteca em que ele aparece, na ordem da biblioteca. */
export function libraryGroupsByName(library = EXERCISE_LIBRARY) {
  const map = {};
  Object.keys(library).forEach(g => library[g].forEach(n => {
    const k = n.toLowerCase();
    (map[k] ||= []).includes(g) || map[k].push(g);
  }));
  return map;
}

/* Nome (minúsculas) → grupo principal. Duplicata sem entrada em PRIMARY_GROUP usa o primeiro grupo. */
export function buildPrimaryGroupMap(library = EXERCISE_LIBRARY, overrides = PRIMARY_GROUP) {
  const out = {};
  const byName = libraryGroupsByName(library);
  Object.keys(byName).forEach(k => {
    const gs = byName[k];
    out[k] = gs.length > 1 && gs.includes(overrides[k]) ? overrides[k] : gs[0];
  });
  return out;
}
