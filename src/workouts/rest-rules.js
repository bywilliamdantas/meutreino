/* Regras puras do descanso entre séries e do "repetir anterior" (testáveis sem DOM). */

/* A série `setidx` é a última da lista de séries do exercício? */
export function isLastSet(sets, setidx) {
  return Array.isArray(sets) && sets.length > 0 && setidx === sets.length - 1;
}

/* Séries de um exercício quando o campo "séries" está vazio no editor
   (o mesmo número que aparece de exemplo no campo e na estimativa de duração). */
export const DEFAULT_SETS = 3;

/* Marcou a série: deve iniciar o descanso?
   - Superset (ex.ss): nunca inicia — vai direto para o próximo exercício.
   - Última série do exercício: inicia só se ainda há outras séries pendentes no treino
     (descanso antes do próximo exercício). `workoutPending` indefinido = há pendências.
   - Exercício sem cadastro (ex indefinido) segue a regra normal. */
export function shouldStartRest(ex, sets, setidx, workoutPending = true) {
  if (ex && ex.ss) return false;
  if (!isLastSet(sets, setidx)) return true;
  return workoutPending === true;
}

/* Peso e reps da série acima (o que a tela mostra: valor salvo ou, se vazio, o padrão).
   Retorna null se não há série acima. Não altera nada. */
export function previousSetValues(sets, setidx, defaults) {
  if (!Array.isArray(sets) || setidx < 1) return null;
  const prev = sets[setidx - 1];
  if (!prev) return null;
  const d = defaults || {};
  return {
    weight: prev.weight != null ? prev.weight : d.weight != null ? d.weight : null,
    reps: prev.reps != null ? prev.reps : d.reps != null ? d.reps : null
  };
}
