/* ---------- SVG do músculo (hero) ---------- */
export function heroMuscleSvg() {
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="skinGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffe0cc"/>
        <stop offset="55%" stop-color="#ffc3a3"/>
        <stop offset="100%" stop-color="#ffa878"/>
      </linearGradient>
      <linearGradient id="plateGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#4a5878"/>
        <stop offset="100%" stop-color="#1e2740"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff5a36" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#ff5a36" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="100" cy="100" r="95" fill="url(#glow)"/>
    <!-- antebraço/mão segurando halter -->
    <path d="M118 96 Q120 76 132 70 Q146 66 152 78 Q154 88 148 96 L142 110 Q136 118 126 116 Z" fill="url(#skinGrad)"/>
    <!-- braço/ombro -->
    <path d="M40 130 Q30 118 34 100 Q40 80 62 74 Q86 70 100 84 Q112 96 112 118 Q112 138 98 148 Q74 160 54 152 Q42 146 40 130 Z" fill="url(#skinGrad)"/>
    <!-- highlight do bíceps -->
    <path d="M62 96 Q80 90 92 100 Q100 108 96 120 Q86 128 72 124 Q60 118 62 96 Z" fill="#ffffff" opacity="0.28"/>
    <!-- sombra do bíceps -->
    <path d="M70 138 Q84 132 98 130 Q92 146 78 148 Q70 148 70 138 Z" fill="#e8794a" opacity="0.35"/>
    <!-- anilha do halter -->
    <circle cx="150" cy="62" r="44" fill="#2a3550" opacity="0.4" transform="translate(2,3)"/>
    <circle cx="150" cy="62" r="44" fill="url(#plateGrad)"/>
    <circle cx="150" cy="62" r="34" fill="#1a2138"/>
    <circle cx="150" cy="62" r="14" fill="#a8b4cc"/>
    <circle cx="145" cy="57" r="14" fill="#cdd6e8" opacity="0.55"/>
  </svg>`;
}
