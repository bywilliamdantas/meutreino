/* Cores das categorias: tokens --cat-* em src/styles/tokens.css (o -soft é o fundo da miniatura). */
export const EX_CATEGORY_RULES = [{
  icon: "exChest",
  color: "var(--cat-chest)",
  soft: "var(--cat-chest-soft)",
  test: /supino|peito|peck|crucifixo|voador|cross.?over/i
}, {
  icon: "exBack",
  color: "var(--cat-back)",
  soft: "var(--cat-back-soft)",
  test: /puxada|remada|costas|barra fixa|pulldown|dorsal|levantamento terra/i
}, {
  icon: "exLegs",
  color: "var(--cat-legs)",
  soft: "var(--cat-legs-soft)",
  test: /agachamento|leg press|extensora|flexora|perna|panturrilha|avanço|afund|stiff|glúte|glute|hack/i
}, {
  icon: "exShoulders",
  color: "var(--cat-shoulders)",
  soft: "var(--cat-shoulders-soft)",
  test: /desenvolvimento|elevação lateral|elevação frontal|ombro|arnold|encolhimento/i
}, {
  icon: "exArms",
  color: "var(--cat-arms)",
  soft: "var(--cat-arms-soft)",
  test: /rosca|tríceps|triceps|bíceps|biceps|paralelas|testa/i
}, {
  icon: "exCore",
  color: "var(--cat-core)",
  soft: "var(--cat-core-soft)",
  test: /abdomin|prancha|abs\b|oblíquo/i
}];
