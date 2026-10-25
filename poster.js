/* Affiche « Dédé contre Josie » (création originale), insérée dans la page pour profiter des polices chargées. */
window.SC_POSTER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="Street Coincheur : Dédé contre Josie, cartes en main, sur un tapis de coinche">
  <defs>
    <radialGradient id="sc-felt" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#2c9463"/><stop offset=".65" stop-color="#17603f"/><stop offset="1" stop-color="#0c3f2a"/></radialGradient>
    <linearGradient id="sc-fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".38" stop-color="#ffc93c"/><stop offset=".7" stop-color="#ff8a1a"/><stop offset="1" stop-color="#e2241b"/></linearGradient>
    <linearGradient id="sc-leather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a54"/><stop offset=".5" stop-color="#1d1d2c"/><stop offset="1" stop-color="#0d0d16"/></linearGradient>
    <linearGradient id="sc-perfecto" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fd0ff"/><stop offset=".55" stop-color="#1a7fd6"/><stop offset="1" stop-color="#0b3f86"/></linearGradient>
    <linearGradient id="sc-mirror" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ff0ff"/><stop offset=".45" stop-color="#2bb8ff"/><stop offset=".55" stop-color="#5a3df0"/><stop offset="1" stop-color="#ff3d8a"/></linearGradient>
    <linearGradient id="sc-bgL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a1d10"/><stop offset="1" stop-color="#0e1130" stop-opacity="0"/></linearGradient>
    <linearGradient id="sc-bgR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#0b3a6e"/><stop offset="1" stop-color="#0e1130" stop-opacity="0"/></linearGradient>
    <pattern id="sc-stripes" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f5f2ea"/><rect width="12" height="5" fill="#1b2a6b"/></pattern>
    <pattern id="sc-back" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#2a2f7a"/><rect width="3.5" height="7" fill="#4048b0"/></pattern>
    <filter id="sc-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="sc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>

  <!-- Fond : nuit, camps en couleur, tapis -->
  <rect width="640" height="420" fill="#0e1130"/>
  <rect width="320" height="420" fill="url(#sc-bgL)"/>
  <rect x="320" width="320" height="420" fill="url(#sc-bgR)"/>
  <g fill="#ffffff" opacity=".06">
    <path d="M320 190 L 0 30 L 0 90 Z"/><path d="M320 190 L 0 250 L 0 330 Z"/><path d="M320 190 L 130 0 L 210 0 Z"/>
    <path d="M320 190 L 640 30 L 640 90 Z"/><path d="M320 190 L 640 250 L 640 330 Z"/><path d="M320 190 L 510 0 L 430 0 Z"/>
  </g>
  <circle cx="320" cy="190" r="150" fill="url(#sc-felt)" stroke="#ffc93c" stroke-width="6"/>
  <circle cx="320" cy="190" r="132" fill="none" stroke="#ffc93c" stroke-width="1.5" stroke-dasharray="4 7" opacity=".65"/>

  <!-- Auras -->
  <g filter="url(#sc-blur)" opacity=".85">
    <path d="M20 420 C 10 300, 60 200, 100 120 C 120 160, 150 90, 170 70 C 190 120, 230 110, 236 170 C 280 220, 290 330, 280 420 Z" fill="#ff5a1a"/>
    <path d="M620 420 C 630 300, 590 200, 548 110 C 530 150, 500 80, 478 66 C 462 120, 420 112, 410 170 C 364 220, 352 330, 362 420 Z" fill="#1aa3ff"/>
  </g>
  <g fill="none" stroke-linecap="round" opacity=".9">
    <path d="M70 150 L 52 128 M 228 120 L 246 98 M 40 230 L 18 222" stroke="#ffc93c" stroke-width="4"/>
    <path d="M416 118 L 400 96 L 410 92 L 394 70 M 590 150 L 610 130 L 602 126 L 622 104 M 604 236 L 628 228" stroke="#9fe6ff" stroke-width="3.5" stroke-linejoin="round"/>
  </g>

  <!-- Plaques de nom -->
  <g font-family="'Press Start 2P', monospace" font-size="13">
    <text x="22" y="34" fill="#ff8a3a">P1 · DÉDÉ</text>
    <text x="618" y="34" fill="#5fcbff" text-anchor="end">JOSIE · P2</text>
  </g>

  <!-- ================= DÉDÉ ================= -->
  <g stroke="#0a0614" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <!-- buste : blouson de cuir ouvert sur la marinière -->
    <path d="M6 420 C 10 330, 46 272, 112 254 L 190 254 C 252 270, 280 330, 286 420 Z" fill="url(#sc-leather)"/>
    <path d="M120 256 L 182 256 L 168 420 L 132 420 Z" fill="url(#sc-stripes)"/>
    <path d="M112 254 L 96 238 L 134 300 L 150 420 L 120 420 L 100 330 Z" fill="#2b2b40"/>
    <path d="M190 254 L 210 236 L 168 300 L 154 420 L 184 420 L 200 330 Z" fill="#2b2b40"/>
    <path d="M60 300 C 70 290, 84 286, 96 288" fill="none" stroke="#5a5a7a" stroke-width="3"/>
    <path d="M232 300 C 244 312, 252 330, 256 350" fill="none" stroke="#5a5a7a" stroke-width="3"/>
    <!-- bandana orange -->
    <path d="M122 250 L 180 250 L 172 272 L 151 266 L 130 274 Z" fill="#ff7a1a"/>
    <!-- cou -->
    <path d="M130 214 L 172 214 L 176 252 L 126 252 Z" fill="#d48a58"/>
    <!-- tête anguleuse + ombre portée -->
    <ellipse cx="108" cy="184" rx="9" ry="13" fill="#d48a58"/>
    <path d="M106 170 C 104 126, 198 116, 202 166 L 198 206 C 192 228, 174 244, 152 244 C 130 244, 114 232, 108 210 Z" fill="#f0b585"/>
    <path d="M106 170 C 106 200, 112 226, 142 242 C 126 220, 120 196, 124 172 Z" fill="#d48a58" stroke="none"/>
    <!-- barbe de trois jours -->
    <g fill="#5a3a28" stroke="none" opacity=".55">
      <circle cx="132" cy="228" r="1.6"/><circle cx="140" cy="234" r="1.6"/><circle cx="168" cy="234" r="1.6"/><circle cx="178" cy="226" r="1.6"/><circle cx="150" cy="238" r="1.6"/><circle cx="186" cy="214" r="1.6"/><circle cx="124" cy="216" r="1.6"/>
    </g>
    <!-- casquette baissée, ombre sur les yeux -->
    <path d="M100 170 C 104 182, 196 184, 202 172 L 202 190 C 170 198, 134 198, 102 188 Z" fill="#000" opacity=".38" stroke="none"/>
    <path d="M94 160 C 94 108, 202 98, 210 146 C 226 150, 246 158, 250 172 C 220 178, 170 172, 96 170 Z" fill="#343a5e"/>
    <path d="M104 150 C 136 132, 178 130, 206 144" fill="none" stroke="#5a628e" stroke-width="3"/>
    <path d="M206 146 C 222 150, 242 158, 248 170" fill="none" stroke="#5a628e" stroke-width="2"/>
    <!-- regard qui brille -->
    <g filter="url(#sc-glow)" stroke="none">
      <path d="M128 184 L 148 188 L 130 191 Z" fill="#ffb347"/>
      <path d="M182 182 L 162 188 L 180 190 Z" fill="#ffb347"/>
    </g>
    <path d="M156 188 C 162 200, 164 206, 154 209" fill="none" stroke-width="3"/>
    <!-- moustache en guidon -->
    <path d="M116 210 C 110 206, 108 198, 114 194 C 114 202, 122 206, 132 205 C 142 203, 150 207, 156 213 C 162 207, 170 203, 180 205 C 190 206, 198 202, 198 194 C 204 198, 202 206, 196 210 C 186 222, 168 220, 156 217 C 144 220, 126 222, 116 210 Z" fill="#2e1c10"/>
    <!-- bouche + cure-dent -->
    <path d="M144 228 C 152 231, 160 231, 168 227" fill="none" stroke-width="3"/>
    <path d="M168 227 L 196 216" stroke="#e8c690" stroke-width="3"/>
  </g>
  <!-- main de Dédé : éventail de dos -->
  <g stroke="#0a0614" stroke-width="3" stroke-linejoin="round" transform="translate(-6 -50)">
    <g transform="translate(232 292)">
      <rect x="-17" y="-56" width="34" height="48" rx="4" fill="url(#sc-back)" stroke="#f3f1ff" transform="rotate(-26)"/>
      <rect x="-17" y="-60" width="34" height="48" rx="4" fill="url(#sc-back)" stroke="#f3f1ff" transform="rotate(-4)"/>
      <rect x="-17" y="-56" width="34" height="48" rx="4" fill="url(#sc-back)" stroke="#f3f1ff" transform="rotate(18)"/>
    </g>
    <path d="M196 330 C 200 300, 214 286, 232 286 C 252 286, 258 304, 252 318 C 246 334, 214 342, 196 330 Z" fill="#f0b585" stroke-width="4"/>
    <path d="M216 296 L 216 312 M 228 294 L 228 312 M 240 296 L 240 312" stroke-width="2.5" fill="none"/>
    <path d="M188 328 L 258 314 L 264 350 L 194 364 Z" fill="url(#sc-leather)" stroke-width="4"/>
    <path d="M192 336 L 258 322" stroke="#5a5a7a" stroke-width="2"/>
  </g>

  <!-- ================= JOSIE ================= -->
  <g stroke="#0a0614" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <!-- perfecto bleu court sur tee blanc -->
    <path d="M354 420 C 360 330, 390 272, 452 254 L 528 254 C 594 270, 626 330, 634 420 Z" fill="url(#sc-perfecto)"/>
    <path d="M462 258 L 518 258 L 508 420 L 472 420 Z" fill="#f3f1ff"/>
    <path d="M452 254 L 432 240 L 472 296 L 470 420 L 440 420 L 438 330 Z" fill="#1468b8"/>
    <path d="M528 254 L 548 240 L 508 296 L 510 420 L 540 420 L 542 330 Z" fill="#0b4f9c"/>
    <path d="M440 330 L 470 334" stroke="#ffc93c" stroke-width="3"/>
    <path d="M384 300 C 396 290, 410 286, 424 288" fill="none" stroke="#9fe6ff" stroke-width="3"/>
    <!-- écusson ♦ sur l'épaule -->
    <g transform="translate(584 300) rotate(12)"><rect x="-13" y="-13" width="26" height="26" rx="5" fill="#fffdf6" stroke-width="3"/><text x="0" y="8" text-anchor="middle" font-family="'Atkinson Hyperlegible', 'DejaVu Sans', Arial, sans-serif" font-size="20" fill="#c8202b" stroke="none">♦</text></g>
    <!-- cou -->
    <path d="M468 214 L 510 214 L 514 256 L 464 256 Z" fill="#b97b4f"/>
    <!-- tête -->
    <path d="M442 166 C 442 120, 538 116, 538 166 C 538 206, 520 238, 490 242 C 460 238, 442 206, 442 166 Z" fill="#d89a68"/>
    <path d="M536 168 C 536 200, 522 228, 492 240 C 512 222, 522 198, 520 170 Z" fill="#b97b4f" stroke="none"/>
    <!-- carré asymétrique, mèche électrique -->
    <path d="M432 214 C 418 150, 440 102, 492 100 C 544 100, 566 146, 552 204 C 548 222, 544 234, 536 240 C 534 214, 534 190, 526 170 C 512 150, 476 140, 444 168 C 442 186, 440 202, 432 214 Z" fill="#14173f"/>
    <path d="M444 168 C 470 132, 514 124, 532 152 C 508 140, 482 146, 462 170 Z" fill="#14173f"/>
    <path d="M470 108 C 500 104, 528 116, 540 140 C 522 126, 500 120, 476 124 Z" fill="#2bb8ff" stroke="none" filter="url(#sc-glow)"/>
    <!-- lunettes aviateur miroir -->
    <path d="M452 176 L 486 176 C 488 190, 480 200, 468 200 C 456 200, 450 190, 452 176 Z" fill="url(#sc-mirror)"/>
    <path d="M494 176 L 528 176 C 530 190, 524 200, 512 200 C 500 200, 492 190, 494 176 Z" fill="url(#sc-mirror)"/>
    <path d="M486 178 L 494 178" stroke-width="3"/>
    <path d="M458 181 L 470 181" stroke="#ffffff" stroke-width="2.5" opacity=".8"/>
    <path d="M500 181 L 512 181" stroke="#ffffff" stroke-width="2.5" opacity=".8"/>
    <!-- sourcils : un levé -->
    <path d="M456 166 L 480 168" stroke-width="5"/><path d="M500 166 C 510 158, 520 158, 528 162" fill="none" stroke-width="5"/>
    <path d="M492 200 C 489 208, 489 212, 496 214" fill="none" stroke-width="3"/>
    <!-- sourire en coin -->
    <path d="M474 224 C 486 230, 500 228, 512 218" fill="#e2243f" stroke-width="3"/>
    <path d="M512 218 L 518 214" stroke-width="3"/>
    <circle cx="545" cy="214" r="11" fill="none" stroke="#ffc93c" stroke-width="3.5"/>
    <circle cx="436" cy="214" r="9" fill="none" stroke="#ffc93c" stroke-width="3.5"/>
  </g>
  <!-- main de Josie : éventail ouvert, faces visibles -->
  <g stroke="#0a0614" stroke-width="3" stroke-linejoin="round" transform="translate(6 -50)" font-family="Bungee, 'DejaVu Sans', 'Arial Black', sans-serif" font-size="13">
    <g transform="translate(408 292)">
      <g transform="rotate(-30)"><rect x="-17" y="-60" width="34" height="48" rx="4" fill="#fffdf6"/><text x="-12" y="-44" fill="#c8202b" stroke="none">A♥</text></g>
      <g transform="rotate(-10)"><rect x="-17" y="-62" width="34" height="48" rx="4" fill="#fffdf6"/><text x="-12" y="-46" fill="#17171c" stroke="none">K♠</text></g>
      <g transform="rotate(10)"><rect x="-17" y="-62" width="34" height="48" rx="4" fill="#fffdf6"/><text x="-12" y="-46" fill="#c8202b" stroke="none">Q♦</text></g>
      <g transform="rotate(30)"><rect x="-17" y="-60" width="34" height="48" rx="4" fill="#fffdf6"/><text x="-12" y="-44" fill="#17171c" stroke="none">J♣</text></g>
    </g>
    <path d="M444 330 C 440 300, 426 286, 408 286 C 388 286, 382 304, 388 318 C 394 334, 426 342, 444 330 Z" fill="#d89a68" stroke-width="4"/>
    <path d="M424 296 L 424 312 M 412 294 L 412 312 M 400 296 L 400 312" stroke-width="2.5" fill="none"/>
    <path d="M452 328 L 382 314 L 376 350 L 446 364 Z" fill="url(#sc-perfecto)" stroke-width="4"/>
    <path d="M448 336 L 380 322" stroke="#9fe6ff" stroke-width="2"/>
  </g>

  <!-- VS foudroyant -->
  <g transform="translate(320 64)" filter="url(#sc-glow)">
    <path d="M6 -40 L -22 6 L -2 6 L -14 44 L 24 -8 L 4 -8 L 16 -40 Z" fill="#ffc93c" stroke="#2a0a00" stroke-width="3" stroke-linejoin="round"/>
  </g>

  <!-- Titre -->
  <g font-family="Bungee, 'Arial Black', Impact, sans-serif" text-anchor="middle" stroke-linejoin="round">
    <g transform="translate(56 0) skewX(-10)">
      <text x="324" y="330" font-size="44" letter-spacing="10" fill="#05061a">STREET</text>
      <text x="320" y="326" font-size="44" letter-spacing="10" fill="url(#sc-fire)" stroke="#2a0a00" stroke-width="3" paint-order="stroke">STREET</text>
    </g>
    <g transform="translate(70 0) skewX(-10)">
      <text x="325" y="397" font-size="68" fill="#05061a">COINCHEUR</text>
      <text x="320" y="392" font-size="68" fill="url(#sc-fire)" stroke="#2a0a00" stroke-width="4" paint-order="stroke">COINCHEUR</text>
    </g>
  </g>
</svg>`;
