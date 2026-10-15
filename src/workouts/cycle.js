/* Ciclo com pendentes (funções puras, testáveis sem DOM).

   O ciclo é a rotina inteira (ex.: A, B, C), cada treino feito uma vez.
   - O treino recomendado é o primeiro da ordem configurada que ainda não foi feito no ciclo atual.
   - Escolher outro treino conta como feito no ciclo, mas não muda a ordem da rotina.
   - Fechou todos os treinos do ciclo: começa um ciclo novo.
   Nada é salvo à parte: o estado é calculado a partir do histórico, então desfazer/editar
   sessões, importar backup ou mudar a rotina sempre recalculam um resultado coerente. */

/* order: letras de treino da rotina (sem descanso), na ordem configurada.
   performed: letras das sessões não-descanso, da mais antiga para a mais nova. */
export function cycleDone(order, performed) {
  let done = new Set();
  if (!Array.isArray(order) || !order.length) return done;
  for (const letter of performed || []) {
    if (!order.includes(letter)) continue;
    done.add(letter);
    if (order.every((l) => done.has(l))) done = new Set();
  }
  return done;
}

/* Próximo treino recomendado (ou undefined se a rotina não tem treinos). */
export function nextInCycle(order, performed) {
  if (!Array.isArray(order) || !order.length) return undefined;
  const done = cycleDone(order, performed);
  return order.find((l) => !done.has(l)) || order[0];
}
