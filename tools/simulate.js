/* Simulation d'un tournoi duplicate complet, par le vrai protocole de table (T.apply), sans réseau.
 * Usage : node tools/simulate.js [tables] [donnes par série] [graine] > tournoi.json
 * Chaque paire a un profil de joueur (prudente, agressive, coincheuse, distraite…) : les IA de base jouent
 * toutes pareil, ce qui donnerait 50 % partout. Le profil perturbe enchères et cartes, avec un hasard reproductible.
 * Sortie : { tour, results, store } ; `store` se colle tel quel dans localStorage.sc2_local (mode hors ligne).
 */
const E = global.E = require('../engine.js'); // table.js attend E en global, comme dans la page
const T = require('../table.js');

const tables = +process.argv[2] || 4, perSet = +process.argv[3] || 4, seed = process.argv[4] || 'street-sim';
const PAIRS = [ // [NS, EO] par table
  [['Marco', 'Léa'], ['Sami', 'Inès']],
  [['Paulo', 'Nina'], ['Hugo', 'Zoé']],
  [['Rachid', 'Emma'], ['Tom', 'Jade']],
  [['Yann', 'Chloé'], ['Max', 'Lou']],
  [['Iris', 'Noé'], ['Ana', 'Malo']],
  [['Eli', 'Rose'], ['Gabin', 'Mia']],
];
const PROFILES = [ // err : carte au hasard ; bold : surenchère gratuite ; coinche : coinche tentée ; shy : passe au lieu d'annoncer
  { label: 'solide', err: 0.04, bold: 0.05, coinche: 0.05, shy: 0.05 },
  { label: 'agressive', err: 0.10, bold: 0.45, coinche: 0.15, shy: 0 },
  { label: 'prudente', err: 0.06, bold: 0, coinche: 0.02, shy: 0.35 },
  { label: 'coincheuse', err: 0.08, bold: 0.10, coinche: 0.40, shy: 0.05 },
  { label: 'distraite', err: 0.30, bold: 0.10, coinche: 0.05, shy: 0.10 },
  { label: 'régulière', err: 0.02, bold: 0.10, coinche: 0.08, shy: 0.10 },
  { label: 'fougueuse', err: 0.15, bold: 0.30, coinche: 0.25, shy: 0 },
  { label: 'débutante', err: 0.40, bold: 0.15, coinche: 0.10, shy: 0.20 },
];

let a = E.hashStr(seed + '/jeu');
const rand = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };

function pickBid(g, seat, p) {
  const o = E.legalBidOptions(g, seat), base = E.botBid(g, seat);
  if (o.surcoinche) return rand() < p.coinche / 2 ? { type: 'surcoinche' } : { type: 'pass' };
  if (o.coinche && base.type !== 'coinche' && g.contract.value >= 90 && rand() < p.coinche) return { type: 'coinche' };
  if (base.type === 'bid' && rand() < p.shy && o.pass) return { type: 'pass' };
  if (base.type === 'bid' && rand() < p.bold) {
    const v = o.values.find(x => x >= base.value + 10 && x <= 160);
    if (v) return { ...base, value: v };
  }
  if (base.type === 'pass' && o.values.length && rand() < p.bold / 2 && !(g.contract && E.team(g.contract.seat) === E.team(seat))) {
    const v = o.values[0];
    if (v <= 110) return { type: 'bid', value: v, suit: E.SUITS[Math.floor(rand() * 4)] };
  }
  return base;
}
function pickCard(g, seat, p) {
  const l = E.legalCards(g, seat);
  return rand() < p.err ? l[Math.floor(rand() * l.length)] : E.botPlay(g, seat);
}

const tid = 'sim' + E.hashStr(seed).toString(36).slice(0, 5);
const tour = { id: tid, name: `Tournoi simulé · ${tables} tables`, tables, perSet, owner: 'moi', createdAt: Date.now() };
const store = { ['tournaments/' + tid]: tour };
for (const w of T.tourHands(tour, seed)) store[w.path] = w.data;

for (let t = 0; t < tables; t++) {
  const path = `tournaments/${tid}/tables/t${t}`;
  const pairs = PAIRS[t % PAIRS.length];
  const prof = [PROFILES[(2 * t) % PROFILES.length], PROFILES[(2 * t + 1) % PROFILES.length]];
  const names = [pairs[0][0], pairs[1][0], pairs[0][1], pairs[1][1]]; // S, E, N, O
  let d = T.initTour(tour, t);
  const run = (act, uid) => { const r = T.apply(d, act, uid); d = r.doc; for (const w of r.writes) store[w.path] = w.data; };
  for (let s = 0; s < 4; s++) run({ type: 'sit', seat: s, name: names[s] }, 'u' + s);
  run({ type: 'start' }, 'u0');
  while (d.status !== 'finished') {
    const hands = [0, 1, 2, 3].map(s => store[T.handPath(path, d.hk, s)].cards);
    let g = T.getGame(d, hands);
    while (g.phase !== 'done') {
      const seat = g.turn, p = prof[E.team(seat)];
      if (g.phase === 'bid') run({ type: 'bid', seat, bid: pickBid(g, seat, p), hands }, 'u' + seat);
      else run({ type: 'card', seat, card: pickCard(g, seat, p), hands }, 'u' + seat);
      g = T.getGame(d, hands);
    }
    run({ type: 'next' }, 'u0');
  }
  store[path] = d;
}

// les mains ne servent qu'au jeu : on les retire pour garder une sortie légère
for (const k of Object.keys(store)) if (k.includes('/hands/')) delete store[k];
const results = Object.entries(store).filter(([k]) => k.includes('/results/')).map(([, v]) => v);
const profiles = Array.from({ length: tables }, (_, t) => ({ table: t, NS: PROFILES[(2 * t) % PROFILES.length].label, EO: PROFILES[(2 * t + 1) % PROFILES.length].label }));
process.stdout.write(JSON.stringify({ tour, profiles, results, store }, null, 1));
