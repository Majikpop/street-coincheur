/* Banc d'essai de l'IA : `npm run bench` (aucune dépendance).
 *   npm run bench                      statistiques d'enchères (IA × 4) et jeu de la carte contre le hasard
 *   npm run bench -- --vs ancien.js    duplicate : l'IA actuelle contre une autre version du moteur
 *                                      (ex. `git show main:engine.js > /tmp/ancien.js`)
 *   npm run bench -- --calib           recalibre le modèle d'annonce (MODEL dans engine.js) ; long : --n 500 suffit
 *   --n 1000                           nombre de donnes
 */
const path = require('path');
const E = require('../engine.js');
const arg = k => { const i = process.argv.indexOf(k); return i < 0 ? null : process.argv[i + 1] || true; };
const N = +arg('--n') || 1000;

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
  let diff = 0, sq = 0, wins = 0, ties = 0;
  for (let i = 0; i < N; i++) {
    const deal = E.makeDeal('duel' + i, i);
    const g1 = play(deal, [A, B], opts), g2 = play(deal, [B, A], opts);
    const a = ((g1.result.ns - g1.result.ew) - (g2.result.ns - g2.result.ew)) / 2;
    diff += a; sq += a * a; if (a > 0) wins++; else if (a === 0) ties++;
  }
  const m = diff / N, ci = 2 * Math.sqrt(Math.max(0, sq / N - m * m) / N);
  console.log(`${label} : ${m.toFixed(1)} ± ${ci.toFixed(1)} pts/donne pour l'IA actuelle · donnes gagnées ${pct(wins, N - ties)} (égalités ${pct(ties, N)})`);
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

/** Points faits (belote comprise) par un preneur imposé à 80, toutes mains et contrats : base du modèle d'annonce. */
function calib() {
  const rows = { suit: [], AT: [], NT: [] };
  for (let i = 0; i < N; i++) {
    const deal = E.makeDeal('calib' + i, i);
    for (let s = 0; s < 4; s++) for (const t of E.CONTRACTS) {
      const h = deal.hands[s], suit = E.SUITS.includes(t);
      if (suit && h.filter(c => c.s === t).length < 2) continue;
      const g = E.newGame(deal);
      g.contract = { value: 80, suit: t, seat: s, coinche: 1 }; g.phase = 'play'; g.leader = E.next(g.dealer); g.turn = g.leader;
      while (g.phase === 'play') E.playCard(g, g.turn, E.botPlay(g, g.turn));
      const att = E.team(s);
      rows[suit ? 'suit' : t].push({ x: suit ? [1, E.evalSuit(h, t).est] : E.handFeats(h, t), T: g.result.cardPts[att] + (g.result.belote === att ? 20 : 0) });
    }
    if (i % 50 === 49) process.stderr.write(`${i + 1}/${N}\r`);
  }
  for (const [k, R] of Object.entries(rows)) {
    const w = ols(R);
    const res = R.map(r => r.T - r.x.reduce((a, x, j) => a + x * w[j], 0)).sort((x, y) => x - y);
    const q = Array.from({ length: 20 }, (_, i) => Math.round(res[Math.floor((i + 0.5) / 20 * res.length)]));
    console.log(`${k} (${R.length} contrats) : poids [${w.map(x => +x.toFixed(k === 'suit' ? 3 : 1)).join(', ')}]\n  resid: [${q.join(', ')}]`);
  }
}
/** Moindres carrés : poids w minimisant Σ (T − w·x)². */
function ols(rows) {
  const k = rows[0].x.length, A = Array.from({ length: k }, () => Array(k + 1).fill(0));
  for (const { x, T } of rows) for (let i = 0; i < k; i++) { for (let j = 0; j < k; j++) A[i][j] += x[i] * x[j]; A[i][k] += x[i] * T; }
  for (let i = 0; i < k; i++) {
    let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = 0; r < k; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= k; c++) A[r][c] -= f * A[i][c]; }
  }
  return A.map((r, i) => r[k] / r[i]);
}

if (arg('--calib')) calib();
else if (arg('--vs')) {
  const O = require(path.resolve(String(arg('--vs'))));
  const OLD = { bid: O.botBid, card: O.botPlay };
  duel(IA, OLD, 'Normal, IA actuelle contre l\'autre version', {});
  duel(IA, OLD, 'MOC, IA actuelle contre l\'autre version', { moc: true });
  duel(IA, { bid: E.botBid, card: O.botPlay }, 'Jeu de la carte seul (mêmes enchères), contre l\'autre version', {});
} else {
  duel(IA, RAND, 'Jeu de la carte, IA contre le hasard (mêmes enchères)', {});
  duel(IA, { bid: E.botBid, card: E.playHeuristic }, 'Jeu de la carte, simulation contre règles simples', {});
  stats({}); stats({ moc: true });
}
