/* Banc d'essai de l'IA : `npm run bench` (aucune dépendance).
 *   npm run bench                      statistiques d'enchères (IA × 4) et jeu de la carte contre le hasard
 *   npm run bench -- --vs ancien.js    duplicate : l'IA actuelle contre une autre version du moteur
 *                                      (ex. `git show main:engine.js > /tmp/ancien.js`)
 *   npm run bench -- --calib           recalibre le modèle d'annonce (RESID et droite dans engine.js)
 *   --n 3000                           nombre de donnes
 */
const path = require('path');
const E = require('../engine.js');
const arg = k => { const i = process.argv.indexOf(k); return i < 0 ? null : process.argv[i + 1] || true; };
const N = +arg('--n') || 3000;

const IA = { bid: E.botBid, card: E.botPlay };
const RAND = { bid: E.botBid, card: (g, s) => { const l = E.legalCards(g, s); return l[Math.floor(Math.random() * l.length)]; } };

/** Joue une donne ; ai[camp] = { bid, card }. */
function play(deal, ai, opts = {}) {
  const g = E.newGame(deal, opts);
  for (let k = 0; g.phase === 'bid' && k < 100; k++) E.applyBid(g, g.turn, ai[E.team(g.turn)].bid(g, g.turn));
  while (g.phase === 'play') E.playCard(g, g.turn, ai[E.team(g.turn)].card(g, g.turn));
  return g;
}
const pct = (a, b) => (b ? Math.round(100 * a / b) : '-') + ' %';

/** Duplicate : chaque donne est jouée deux fois, camps inversés ; écart moyen en faveur de A. */
function duel(A, B, label, opts) {
  let diff = 0, wins = 0, ties = 0;
  for (let i = 0; i < N; i++) {
    const deal = E.makeDeal('duel' + i, i);
    const g1 = play(deal, [A, B], opts), g2 = play(deal, [B, A], opts);
    const a = (g1.result.ns - g1.result.ew) - (g2.result.ns - g2.result.ew);
    diff += a; if (a > 0) wins++; else if (a === 0) ties++;
  }
  console.log(`${label} : ${(diff / N / 2).toFixed(1)} pts/donne pour l'IA actuelle · donnes gagnées ${pct(wins, N - ties)} (égalités ${pct(ties, N)})`);
}

function stats(opts) {
  let passed = 0, made = 0, n = 0, co = 0, coOk = 0, sur = 0;
  const byVal = {};
  for (let i = 0; i < N; i++) {
    const g = play(E.makeDeal('stats' + i, i), [IA, IA], opts), r = g.result;
    if (r.passed) { passed++; continue; }
    n++; if (r.made) made++;
    const v = g.contract.value, k = v >= 250 ? 'capot' : v >= 130 ? '130+' : v >= 100 ? '100-120' : '80-90';
    const b = byVal[k] = byVal[k] || [0, 0]; b[0]++; if (r.made) b[1]++;
    if (g.contract.coinche > 1) { co++; if (!r.made) coOk++; if (g.contract.coinche === 4) sur++; }
  }
  console.log(`\n${opts.moc ? 'MOC' : 'Normal'} (IA × 4, ${N} donnes) : passées ${pct(passed, N)} · contrats réussis ${pct(made, n)} · coinches ${co} (${pct(co, n)}), gagnées par la défense ${pct(coOk, co)} · surcoinches ${sur}`);
  for (const [k, [c, m]] of Object.entries(byVal)) console.log(`  ${k} : ${pct(c, n)} des contrats, réussis ${pct(m, c)}`);
}

/** Points faits (belote comprise) par un preneur imposé à 80, toutes mains et couleurs : base du modèle d'annonce. */
function calib() {
  const rows = [];
  for (let i = 0; i < N; i++) {
    const deal = E.makeDeal('calib' + i, i);
    for (let s = 0; s < 4; s++) for (const t of E.SUITS) {
      if (deal.hands[s].filter(c => c.s === t).length < 2) continue;
      const g = E.newGame(deal);
      g.contract = { value: 80, suit: t, seat: s, coinche: 1 }; g.phase = 'play'; g.leader = E.next(g.dealer); g.turn = g.leader;
      while (g.phase === 'play') E.playCard(g, g.turn, E.botPlay(g, g.turn));
      const att = E.team(s);
      rows.push({ est: E.evalSuit(deal.hands[s], t).est, T: g.result.cardPts[att] + (g.result.belote === att ? 20 : 0) });
    }
  }
  let sx = 0, sy = 0, sxx = 0, sxy = 0; const n = rows.length;
  for (const r of rows) { sx += r.est; sy += r.T; sxx += r.est * r.est; sxy += r.est * r.T; }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
  const R = rows.map(r => r.T - a - b * r.est).sort((x, y) => x - y);
  const q = Array.from({ length: 20 }, (_, i) => Math.round(R[Math.floor((i + 0.5) / 20 * R.length)]));
  console.log(`${n} contrats imposés : points faits ≈ ${a.toFixed(1)} + ${b.toFixed(3)} × éval\nRESID = [${q.join(', ')}]`);
}

if (arg('--calib')) calib();
else if (arg('--vs')) {
  const O = require(path.resolve(String(arg('--vs'))));
  const OLD = { bid: O.botBid, card: O.botPlay };
  duel(IA, OLD, 'Normal, IA actuelle contre l\'autre version', {});
  duel(IA, OLD, 'MOC, IA actuelle contre l\'autre version', { moc: true });
} else {
  duel(IA, RAND, 'Jeu de la carte, IA contre le hasard (mêmes enchères)', {});
  stats({}); stats({ moc: true });
}
