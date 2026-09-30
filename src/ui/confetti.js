// Confete discreto para recordes pessoais (respeita reduced-motion).
export function confetti() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#ff5a36", "#ffb020", "#7c5cfc", "#22c55e", "#2f8fff"];
  const box = document.createElement("div");
  box.className = "confetti";
  for (let i = 0; i < 28; i++) {
    const p = document.createElement("i");
    p.style.cssText = `left:${10 + Math.random() * 80}%;background:${colors[i % 5]};--dx:${(Math.random() - 0.5) * 160}px;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * 0.15}s`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1800);
}
