/* Affiche « Nord-Sud contre Est-Ouest » (création originale), écran de sélection 2 contre 2,
   insérée dans la page pour profiter des polices chargées.
   Les bustes sont dessinés tournés vers la droite ; l'équipe Est-Ouest est retournée en miroir. */
window.SC_POSTER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="Street Coincheur : Nord-Sud contre Est-Ouest, Dedz et Lady V en rouge face à J0Z et Kapot en bleu">
  <defs>
    <radialGradient id="sc-glowR" cx="0%" cy="45%" r="80%"><stop offset="0" stop-color="#b3122c"/><stop offset=".55" stop-color="#4a0816"/><stop offset="1" stop-color="#0a0c1e" stop-opacity="0"/></radialGradient>
    <radialGradient id="sc-glowB" cx="100%" cy="45%" r="80%"><stop offset="0" stop-color="#1253b8"/><stop offset=".55" stop-color="#0a2156"/><stop offset="1" stop-color="#0a0c1e" stop-opacity="0"/></radialGradient>
    <linearGradient id="sc-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".48" stop-color="#e4e6f2"/><stop offset=".52" stop-color="#9ea3c4"/><stop offset="1" stop-color="#f1f2fa"/></linearGradient>
    <linearGradient id="sc-redcoat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3233f"/><stop offset=".55" stop-color="#8c0f24"/><stop offset="1" stop-color="#3a0610"/></linearGradient>
    <linearGradient id="sc-redleather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a2630"/><stop offset=".5" stop-color="#22121a"/><stop offset="1" stop-color="#0f080c"/></linearGradient>
    <linearGradient id="sc-bluecoat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f8dff"/><stop offset=".55" stop-color="#1546a8"/><stop offset="1" stop-color="#081c4a"/></linearGradient>
    <linearGradient id="sc-blueblazer" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a3a66"/><stop offset=".5" stop-color="#162042"/><stop offset="1" stop-color="#0a1024"/></linearGradient>
    <linearGradient id="sc-mirror" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8f2ff"/><stop offset=".45" stop-color="#3aa8ff"/><stop offset=".55" stop-color="#1b3fa0"/><stop offset="1" stop-color="#0a1a50"/></linearGradient>
    <linearGradient id="sc-fadeL" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#0a0c1e" stop-opacity="0"/><stop offset="1" stop-color="#0a0c1e" stop-opacity=".9"/></linearGradient>
    <pattern id="sc-dots" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="3" cy="3" r="1.1" fill="#ffffff"/></pattern>
    <pattern id="sc-stripes" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#efeae2"/><rect width="10" height="4" fill="#1a1626"/></pattern>
    <pattern id="sc-back" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#6a0a1c"/><rect width="3" height="6" fill="#a8142e"/></pattern>
    <filter id="sc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="sc-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>

  <!-- ===== Fond : deux camps séparés par une faille ===== -->
  <rect width="640" height="420" fill="#0a0c1e"/>
  <path d="M0 0 H 352 L 300 420 H 0 Z" fill="url(#sc-glowR)"/>
  <path d="M352 0 H 640 V 420 H 300 Z" fill="url(#sc-glowB)"/>
  <path d="M0 0 H 352 L 300 420 H 0 Z" fill="url(#sc-dots)" opacity=".07"/>
  <path d="M352 0 H 640 V 420 H 300 Z" fill="url(#sc-dots)" opacity=".07"/>
  <g stroke-width="2" opacity=".35">
    <path d="M326 210 L -20 60 M 326 210 L -20 150 M 326 210 L -20 300 M 326 210 L 60 -20" stroke="#ff5a6e"/>
    <path d="M326 210 L 660 60 M 326 210 L 660 150 M 326 210 L 660 300 M 326 210 L 590 -20" stroke="#5aa8ff"/>
  </g>

  <!-- ===== Arrière-plan : Dedz (Nord) et Kapot (Ouest) ===== -->
  <!-- DEDZ : gapette, moustache, blouson de cuir sur marinière -->
  <g transform="translate(96 156) scale(.8)" stroke="#07060f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M-128 300 C -126 180, -96 112, -40 96 L 44 96 C 98 112, 128 180, 130 300 Z" fill="url(#sc-redleather)"/>
    <path d="M-30 98 L 34 98 L 22 300 L -18 300 Z" fill="url(#sc-stripes)"/>
    <path d="M-40 96 L -66 70 L -30 150 L -14 300 L -40 300 L -56 180 Z" fill="#2c1820"/>
    <path d="M44 96 L 70 70 L 34 150 L 22 300 L 48 300 L 60 180 Z" fill="#1d1016"/>
    <path d="M-96 170 C -84 150, -70 140, -56 136" fill="none" stroke="#e3233f" stroke-width="2.5" opacity=".7"/>
    <path d="M-22 52 L 26 52 L 30 98 L -26 98 Z" fill="#b07a5c"/>
    <path d="M-22 52 L 4 52 L -2 98 L -26 98 Z" fill="#5c1a22" opacity=".55" stroke="none"/>
    <ellipse cx="-44" cy="0" rx="8" ry="13" fill="#c48c68"/>
    <path d="M-44 -18 L -42 26 C -38 46, -20 60, 2 62 C 22 60, 38 48, 44 28 L 46 -18 C 46 -50, -44 -54, -44 -18 Z" fill="#d9a07a"/>
    <path d="M-44 -18 L -42 26 C -38 46, -20 60, 2 62 C -14 46, -22 22, -20 -18 Z" fill="#6e1c28" opacity=".5" stroke="none"/>
    <path d="M-38 30 C -30 50, -14 60, 2 62 C 20 60, 34 50, 42 30 C 30 40, 16 44, 2 44 C -14 44, -28 40, -38 30 Z" fill="#3a1a1a" opacity=".28" stroke="none"/>
    <!-- gapette : visière basse, ombre sur les yeux -->
    <path d="M-44 -14 L 48 -14 L 46 2 C 18 8, -16 8, -44 0 Z" fill="#000" opacity=".45" stroke="none"/>
    <path d="M-52 -14 C -56 -62, 38 -72, 52 -32 C 66 -28, 80 -22, 84 -12 C 54 -8, 10 -10, -52 -8 Z" fill="#221a26"/>
    <path d="M-44 -30 C -12 -46, 26 -46, 50 -32" fill="none" stroke="#e3233f" stroke-width="2" opacity=".8"/>
    <!-- yeux plissés -->
    <path d="M-26 -2 L -8 -1" stroke-width="3.5"/><path d="M14 -1 L 30 -2" stroke-width="3.5"/>
    <circle cx="-14" cy="1" r="1.4" fill="#ffd9d9" stroke="none"/><circle cx="22" cy="1" r="1.4" fill="#ffd9d9" stroke="none"/>
    <path d="M6 4 L 2 22 L 10 24" fill="none" stroke-width="2.5"/>
    <!-- moustache en guidon -->
    <path d="M-24 30 C -30 28, -34 22, -32 16 C -28 24, -18 26, -8 25 C 0 24, 4 26, 6 29 C 8 26, 12 24, 20 25 C 30 26, 40 24, 44 16 C 46 22, 42 28, 36 30 C 26 36, 14 34, 6 33 C -2 34, -14 36, -24 30 Z" fill="#2a1610"/>
    <path d="M-6 42 L 18 41" stroke-width="2.5"/>
    <path d="M18 41 L 42 34" stroke="#e8c690" stroke-width="2.5"/>
  </g>

  <!-- KAPOT : crâne rasé, barbe poivre et sel, lunettes rondes (retourné en miroir) -->
  <g transform="translate(544 156) scale(-.8 .8)" stroke="#07060f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M-128 300 C -126 180, -96 112, -40 96 L 44 96 C 98 112, 128 180, 130 300 Z" fill="url(#sc-blueblazer)"/>
    <path d="M-34 90 C -16 82, 22 82, 38 90 L 34 300 L -30 300 Z" fill="#0d1430"/>
    <path d="M-32 104 C -12 98, 18 98, 36 104 M -32 118 C -12 112, 18 112, 36 118" fill="none" stroke="#2a3a6a" stroke-width="2"/>
    <path d="M-40 96 L -70 110 L -34 190 L -30 300 L -50 300 L -62 190 Z" fill="#1f2c56"/>
    <path d="M44 96 L 74 110 L 38 190 L 34 300 L 54 300 L 66 190 Z" fill="#141d3e"/>
    <path d="M-100 180 C -90 160, -76 148, -60 142" fill="none" stroke="#4f9dff" stroke-width="2.5" opacity=".7"/>
    <path d="M-22 50 L 26 50 L 30 92 L -26 92 Z" fill="#a8785a"/>
    <ellipse cx="-44" cy="0" rx="8" ry="13" fill="#b8855f"/>
    <path d="M-44 -20 C -46 -66, 46 -70, 46 -20 L 44 24 C 40 46, 22 62, 0 62 C -22 60, -40 46, -42 24 Z" fill="#c9946c"/>
    <path d="M-44 -20 C -46 -66, 0 -72, 14 -64 C -16 -56, -24 -30, -22 0 C -20 26, -12 48, 0 62 C -22 60, -40 46, -42 24 Z" fill="#1c2a66" opacity=".45" stroke="none"/>
    <path d="M6 -56 C 20 -58, 32 -50, 36 -40" fill="none" stroke="#ffffff" stroke-width="4" opacity=".5"/>
    <!-- barbe courte taillée -->
    <path d="M-40 16 C -38 46, -18 66, 2 66 C 24 66, 42 46, 44 16 C 36 26, 28 30, 22 30 C 14 26, -6 26, -16 30 C -26 30, -34 26, -40 16 Z" fill="#8d8f9e"/>
    <path d="M-40 16 C -38 46, -18 66, 2 66 C -10 52, -16 36, -16 30 C -26 30, -34 26, -40 16 Z" fill="#3a4470" opacity=".5" stroke="none"/>
    <path d="M-8 40 C 0 43, 10 43, 18 40" fill="#5a2a2a" stroke-width="2.5"/>
    <!-- lunettes rondes, reflet -->
    <circle cx="-14" cy="-6" r="13" fill="#9fd0ff" fill-opacity=".18" stroke-width="3"/>
    <circle cx="24" cy="-6" r="12" fill="#9fd0ff" fill-opacity=".18" stroke-width="3"/>
    <path d="M-1 -8 L 12 -8 M -27 -8 L -44 -12" stroke-width="2.5" fill="none"/>
    <path d="M-20 -12 L -10 -2 M 18 -12 L 28 -2" stroke="#ffffff" stroke-width="2.5" opacity=".9"/>
    <circle cx="-12" cy="-4" r="2.2" fill="#07060f" stroke="none"/><circle cx="26" cy="-4" r="2" fill="#07060f" stroke="none"/>
    <!-- un sourcil levé : il a déjà compté les atouts -->
    <path d="M-28 -24 L -4 -22" stroke-width="4"/><path d="M12 -26 C 20 -34, 30 -34, 38 -28" fill="none" stroke-width="4"/>
    <path d="M6 0 L 2 18 L 10 20" fill="none" stroke-width="2.5"/>
  </g>

  <!-- fondu des personnages du fond -->
  <rect x="0" y="230" width="640" height="190" fill="url(#sc-fadeL)"/>

  <!-- ===== Premier plan : Lady V (Sud) et J0Z (Est) ===== -->
  <!-- LADY V : chignon tiré, trench rouge col relevé, regard froid -->
  <g transform="translate(212 196)" stroke="#07060f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M-126 240 C -124 160, -96 112, -44 96 L 44 96 C 96 112, 124 160, 126 240 Z" fill="url(#sc-redcoat)"/>
    <path d="M-30 74 C -18 66, 20 66, 30 74 L 30 240 L -30 240 Z" fill="#14080c"/>
    <path d="M-44 96 L -72 52 L -46 66 L -20 150 L -26 240 L -54 240 L -60 170 Z" fill="#b3122c"/>
    <path d="M44 96 L 70 50 L 44 66 L 22 150 L 28 240 L 52 240 L 58 170 Z" fill="#7a0c20"/>
    <path d="M-100 170 C -88 146, -74 134, -58 128" fill="none" stroke="#ff8a9a" stroke-width="2.5" opacity=".6"/>
    <path d="M-18 48 L 16 48 L 18 76 L -20 76 Z" fill="#c99278"/>
    <path d="M-18 48 L 0 48 L -4 76 L -20 76 Z" fill="#6e1c28" opacity=".5" stroke="none"/>
    <path d="M-30 70 C -18 62, 18 62, 30 70 L 30 92 C 14 86, -14 86, -30 92 Z" fill="#1e0c12"/>
    <!-- chignon -->
    <circle cx="-40" cy="-46" r="20" fill="#170a0e"/>
    <path d="M-52 -54 C -44 -62, -32 -62, -26 -56" fill="none" stroke="#ff3b55" stroke-width="2" opacity=".7"/>
    <!-- visage anguleux -->
    <path d="M-40 -22 C -40 -52, -12 -64, 14 -62 C 38 -60, 46 -38, 44 -10 L 40 20 L 22 48 L 4 60 L -14 58 L -32 40 C -38 26, -40 6, -40 -22 Z" fill="#e6b597"/>
    <path d="M-40 -22 C -40 6, -38 26, -32 40 L -14 58 L -6 59 C -22 40, -26 10, -22 -20 C -20 -40, -10 -52, 4 -60 C -20 -60, -40 -48, -40 -22 Z" fill="#7a1c2a" opacity=".5" stroke="none"/>
    <path d="M12 16 L 34 6" stroke="#a0505a" stroke-width="2" opacity=".7"/>
    <!-- cheveux plaqués, une mèche rouge -->
    <path d="M-46 -12 C -52 -62, -10 -82, 20 -74 C 44 -68, 52 -46, 46 -22 C 40 -42, 20 -54, -4 -54 C -24 -52, -38 -38, -46 -12 Z" fill="#170a0e"/>
    <path d="M-30 -56 C -12 -66, 18 -66, 36 -50" fill="none" stroke="#ff3b55" stroke-width="2.5" opacity=".85"/>
    <ellipse cx="-41" cy="2" rx="6" ry="10" fill="#c99278"/>
    <!-- yeux mi-clos -->
    <path d="M-24 -10 C -18 -15, -8 -15, -2 -10 C -8 -7, -18 -7, -24 -10 Z" fill="#f4ece8" stroke-width="2"/>
    <path d="M14 -10 C 18 -14, 26 -14, 30 -10 C 26 -7, 18 -7, 14 -10 Z" fill="#f4ece8" stroke-width="2"/>
    <circle cx="-10" cy="-10" r="3.2" fill="#2a0a10" stroke="none"/><circle cx="24" cy="-10" r="2.8" fill="#2a0a10" stroke="none"/>
    <path d="M-27 -10 C -20 -18, -8 -18, 0 -12" fill="none" stroke-width="4"/>
    <path d="M12 -11 C 18 -17, 26 -17, 32 -12" fill="none" stroke-width="4"/>
    <path d="M-30 -24 L -16 -28 L -2 -24" fill="none" stroke-width="3"/><path d="M12 -24 L 24 -28 L 36 -23" fill="none" stroke-width="3"/>
    <path d="M8 -6 L 4 18 L 12 20" fill="none" stroke-width="2.5"/>
    <!-- bouche serrée, rouge sombre -->
    <path d="M-4 34 C 4 31, 14 31, 22 33 C 16 39, 4 40, -4 34 Z" fill="#8e0f22" stroke-width="2"/>
    <circle cx="-42" cy="18" r="10" fill="none" stroke="#e8b23a" stroke-width="3"/>
  </g>
  <!-- main de Lady V : une carte tenue entre deux doigts -->
  <g stroke="#07060f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <g transform="translate(296 262) rotate(14)">
      <rect x="-19" y="-58" width="38" height="54" rx="4" fill="#fffdf6"/>
      <text x="-14" y="-38" font-family="Bungee, 'DejaVu Sans', 'Arial Black', sans-serif" font-size="15" fill="#c8202b" stroke="none">J♥</text>
      <text x="0" y="-14" text-anchor="middle" font-family="'Atkinson Hyperlegible', 'DejaVu Sans', Arial, sans-serif" font-size="20" fill="#c8202b" stroke="none">♥</text>
    </g>
    <path d="M280 268 L 300 252 C 306 248, 312 252, 308 258 L 300 268 C 312 266, 318 274, 310 282 L 292 298 C 280 306, 266 300, 266 288 Z" fill="#e6b597"/>
    <path d="M262 286 L 290 296 L 280 330 L 248 318 Z" fill="#8c0f24"/>
  </g>

  <!-- J0Z : carré asymétrique, lunettes miroir, perfecto bleu (retournée en miroir) -->
  <g transform="translate(428 196) scale(-1 1)" stroke="#07060f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M-126 240 C -124 160, -96 112, -44 96 L 44 96 C 96 112, 124 160, 126 240 Z" fill="url(#sc-bluecoat)"/>
    <path d="M-28 100 L 30 100 L 22 240 L -20 240 Z" fill="#eef0f8"/>
    <path d="M-44 96 L -66 80 L -26 140 L -22 240 L -48 240 L -56 170 Z" fill="#1d5fd0"/>
    <path d="M44 96 L 64 80 L 28 140 L 24 240 L 50 240 L 58 170 Z" fill="#0d3482"/>
    <path d="M-48 176 L -24 178" stroke="#c8cfe8" stroke-width="2.5"/>
    <path d="M-100 170 C -88 146, -74 134, -58 128" fill="none" stroke="#9fd0ff" stroke-width="2.5" opacity=".7"/>
    <g transform="translate(-86 150) rotate(-14)"><rect x="-11" y="-11" width="22" height="22" rx="4" fill="#fffdf6" stroke-width="2.5"/><path d="M0 -7 L 6 0 L 0 7 L -6 0 Z" fill="#c8202b" stroke="none"/></g>
    <path d="M-18 50 L 18 50 L 20 98 L -22 98 Z" fill="#b07850"/>
    <path d="M-18 50 L 0 50 L -4 98 L -22 98 Z" fill="#1c2a66" opacity=".5" stroke="none"/>
    <path d="M-42 -16 C -42 -56, 42 -60, 44 -16 C 44 18, 30 46, 2 56 C -26 46, -42 18, -42 -16 Z" fill="#d39a6c"/>
    <path d="M-42 -16 C -42 18, -26 46, 2 56 C -16 38, -22 14, -20 -14 C -18 -36, -6 -50, 8 -56 C -20 -56, -42 -42, -42 -16 Z" fill="#1c2a66" opacity=".45" stroke="none"/>
    <!-- carré asymétrique, mèche bleu électrique -->
    <path d="M-52 52 C -66 -10, -50 -70, 4 -72 C 56 -72, 66 -20, 54 26 C 52 40, 48 48, 44 52 C 42 22, 42 -4, 34 -22 C 18 -42, -16 -46, -36 -20 C -36 6, -40 32, -52 52 Z" fill="#0c1230"/>
    <path d="M-36 -20 C -16 -50, 22 -54, 40 -28 C 18 -36, -8 -32, -24 -10 Z" fill="#0c1230"/>
    <path d="M-14 -64 C 12 -68, 40 -56, 50 -32 C 34 -48, 10 -54, -12 -52 Z" fill="#3aa8ff" stroke="none" filter="url(#sc-glow)"/>
    <!-- lunettes aviateur miroir -->
    <path d="M-30 -8 L 0 -8 C 2 6, -6 16, -16 16 C -26 16, -32 6, -30 -8 Z" fill="url(#sc-mirror)"/>
    <path d="M8 -8 L 38 -8 C 40 6, 34 16, 24 16 C 14 16, 6 6, 8 -8 Z" fill="url(#sc-mirror)"/>
    <path d="M0 -6 L 8 -6 M -30 -6 L -42 -8" stroke-width="2.5" fill="none"/>
    <path d="M-24 -3 L -12 -3 M 14 -3 L 26 -3" stroke="#ffffff" stroke-width="2" opacity=".85"/>
    <path d="M-28 -18 L -4 -16" stroke-width="4"/><path d="M10 -16 C 20 -24, 30 -24, 38 -20" fill="none" stroke-width="4"/>
    <path d="M6 16 C 3 24, 3 28, 10 30" fill="none" stroke-width="2.5"/>
    <!-- sourire en coin -->
    <path d="M-10 38 C 2 42, 14 40, 24 32" fill="none" stroke-width="3"/>
    <path d="M24 32 L 30 28" stroke-width="2.5"/>
    <circle cx="-44" cy="24" r="8" fill="none" stroke="#c8d2e8" stroke-width="3"/>
  </g>
  <!-- main de J0Z : éventail ouvert -->
  <g stroke="#07060f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" font-family="Bungee, 'DejaVu Sans', 'Arial Black', sans-serif" font-size="13">
    <g transform="translate(352 300)">
      <g transform="rotate(-28)"><rect x="-17" y="-62" width="34" height="48" rx="4" fill="#fffdf6"/><text x="-13" y="-46" fill="#17171c" stroke="none">A♠</text></g>
      <g transform="rotate(-9)"><rect x="-17" y="-64" width="34" height="48" rx="4" fill="#fffdf6"/><text x="-13" y="-48" fill="#c8202b" stroke="none">10♦</text></g>
      <g transform="rotate(10)"><rect x="-17" y="-64" width="34" height="48" rx="4" fill="#fffdf6"/><text x="-13" y="-48" fill="#17171c" stroke="none">K♣</text></g>
    </g>
    <path d="M378 330 C 378 304, 366 292, 350 292 C 332 292, 326 308, 332 320 C 338 334, 364 342, 378 330 Z" fill="#d39a6c"/>
    <path d="M362 300 L 362 314 M 350 298 L 350 314 M 340 300 L 340 314" stroke-width="2" fill="none"/>
    <path d="M386 328 L 330 316 L 324 350 L 380 362 Z" fill="#1546a8"/>
  </g>

  <!-- ===== Faille centrale et VS ===== -->
  <path d="M352 -4 L 334 92 L 346 96 L 320 214 L 332 218 L 300 424" fill="none" stroke="#ffffff" stroke-width="3" filter="url(#sc-glow)"/>
  <g transform="translate(326 66) skewX(-12)" font-family="Bungee, 'Arial Black', Impact, sans-serif" text-anchor="middle">
    <rect x="-38" y="-30" width="76" height="52" fill="#07060f" stroke="#ffffff" stroke-width="2.5"/>
    <text x="0" y="12" font-size="34"><tspan fill="#ff3b55">V</tspan><tspan fill="#4f9dff">S</tspan></text>
  </g>

  <!-- Bandeaux d'équipe et noms -->
  <g font-family="'Press Start 2P', ui-monospace, monospace">
    <path d="M0 14 H 250 L 238 40 H 0 Z" fill="#c8102e"/>
    <path d="M640 14 H 402 L 414 40 H 640 Z" fill="#1553c4"/>
    <text x="16" y="33" font-size="12" fill="#ffffff">NORD-SUD</text>
    <text x="624" y="33" font-size="12" fill="#ffffff" text-anchor="end">EST-OUEST</text>
    <g font-size="10" stroke="#07060f" stroke-width="4" paint-order="stroke">
      <text x="30" y="84" fill="#ffb3bd">N·DEDZ</text>
      <text x="182" y="106" fill="#ffb3bd">S·LADY V</text>
      <text x="610" y="84" text-anchor="end" fill="#b3d4ff">O·KAPOT</text>
      <text x="458" y="106" text-anchor="end" fill="#b3d4ff">E·J0Z</text>
    </g>
  </g>

  <!-- ===== Titre ===== -->
  <path d="M0 300 H 640 V 420 H 0 Z" fill="#0a0c1e" opacity=".35"/>
  <g font-family="Bungee, 'Arial Black', Impact, sans-serif" text-anchor="middle" stroke-linejoin="round">
    <g transform="translate(58 0) skewX(-10)">
      <text x="320" y="336" font-size="30" letter-spacing="14" fill="#ffffff" stroke="#07060f" stroke-width="5" paint-order="stroke">STREET</text>
    </g>
    <g transform="translate(70 0) skewX(-10)">
      <text x="316" y="396" font-size="64" fill="#ff1f3d" opacity=".95">COINCHEUR</text>
      <text x="324" y="396" font-size="64" fill="#2a7bff" opacity=".95">COINCHEUR</text>
      <text x="320" y="394" font-size="64" fill="url(#sc-chrome)" stroke="#07060f" stroke-width="3.5" paint-order="stroke">COINCHEUR</text>
    </g>
    <path d="M150 406 H 318 L 314 412 H 146 Z" fill="#e3233f"/><path d="M322 406 H 494 L 490 412 H 318 Z" fill="#2a7bff"/>
  </g>
</svg>`;
