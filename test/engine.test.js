/* Tests du moteur : `node --test` (aucune dépendance). */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const S = 0, EST = 1, N = 2, O = 3;
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const c = str => ({ r: str.slice(0, -1), s: str.slice(-1) }); // 'JS' -> valet de pique
const hand = str => str.split(' ').map(c);
const key = x => x.r + x.s;

// hasard reproductible propre aux tests (indépendant du moteur)
function lcg(seed) {
  let a = seed >>> 0;
  return () => (a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296;
}

/** Joue une donne complète ; `pick` choisit enchères et cartes, le moteur valide tout. */
function playDeal(deal, { moc = false, bid = E.botBid, card = E.botPlay } = {}) {
  const g = E.newGame(deal, { moc });
  let guard = 0;
  while (g.phase === 'bid') { E.applyBid(g, g.turn, bid(g, g.turn)); assert.ok(++guard < 200, 'enchères sans fin'); }
  while (g.phase === 'play') E.playCard(g, g.turn, card(g, g.turn));
  return g;
}
const randomCard = r => (g, seat) => { const l = E.legalCards(g, seat); return l[Math.floor(r() * l.length)]; };

/** 8 plis « par rang » à l'atout pique : 7, 8, 9, 10, V, D, R, A (le dernier rapporte le dix de der). */
const RANK_TRICK_PTS = [0, 0, 14, 40, 26, 12, 16, 44]; // total 152
function scored({ value, suit = 'S', seat = S, coinche = 1, winners, beloteSeat = null }) {
  const tricks = RANKS.map((r, i) => ({
    cards: E.SUITS.map((s, k) => ({ seat: k, card: { r, s } })),
    winner: winners[i],
  }));
  return E.scoreDeal({ contract: { value, suit, seat, coinche }, tricks, beloteSeat });
}
// NS gagne les plis 10, V et A : 40 + 26 + 44 + 10 de der = 120 ; EO 42
const NS_120 = [EST, EST, EST, S, N, O, EST, S];

// ===================== Donne =====================

test('makeDeal : 32 cartes distinctes, 8 par main, donneur tournant', () => {
  for (let i = 0; i < 8; i++) {
    const d = E.makeDeal('seed', i);
    assert.equal(d.idx, i);
    assert.equal(d.dealer, i % 4);
    assert.equal(d.hands.length, 4);
    d.hands.forEach(h => assert.equal(h.length, 8));
    assert.equal(new Set(d.hands.flat().map(key)).size, 32);
  }
});

test('makeDeal : reproductible (même graine + index) et variable sinon', () => {
  assert.deepEqual(E.makeDeal('tournoi-A', 3), E.makeDeal('tournoi-A', 3));
  assert.notDeepEqual(E.makeDeal('tournoi-A', 3).hands, E.makeDeal('tournoi-A', 4).hands);
  assert.notDeepEqual(E.makeDeal('tournoi-A', 3).hands, E.makeDeal('tournoi-B', 3).hands);
});

test('points : chaque contrat totalise 152 points de cartes (+10 de der = 162)', () => {
  const deck = E.SUITS.flatMap(s => RANKS.map(r => ({ r, s })));
  for (const t of E.CONTRACTS) assert.equal(deck.reduce((a, x) => a + E.points(x, t), 0), 152, t);
});

// ===================== Donnes complètes =====================

function checkFinishedDeal(g) {
  assert.equal(g.phase, 'done');
  const r = g.result;
  if (r.passed) { assert.equal(g.contract, null); assert.equal(r.ns + r.ew, 0); return; }
  assert.equal(g.tricks.length, 8);
  g.tricks.forEach(t => assert.equal(new Set(t.cards.map(x => x.seat)).size, 4));
  assert.equal(new Set(g.tricks.flatMap(t => t.cards.map(x => key(x.card)))).size, 32);
  g.hands.forEach(h => assert.equal(h.length, 0));
  assert.equal(r.tricks[0] + r.tricks[1], 8);
  const capot = r.tricks.includes(8);
  assert.equal(r.cardPts[0] + r.cardPts[1], capot ? 250 : 162);
  // barème recalculé indépendamment
  const { value: v, coinche: m, seat } = g.contract;
  const att = E.team(seat), def = 1 - att;
  const s = [0, 0];
  if (r.made) {
    if (m === 1) { s[att] = v + r.cardPts[att]; s[def] = r.cardPts[def]; } else s[att] = 160 + v * m;
  } else s[def] = 160 + v * m;
  if (r.belote !== null) s[r.belote] += 20;
  assert.deepEqual([r.ns, r.ew], s);
}

test('donnes complètes IA : règles respectées, cartes et score cohérents', () => {
  const seen = new Set();
  for (const seed of ['alpha', 'beta', 'gamma', 'delta']) for (let i = 0; i < 40; i++) {
    const g = playDeal(E.makeDeal(seed, i));
    checkFinishedDeal(g);
    if (g.contract) seen.add(g.contract.suit);
  }
  assert.ok(seen.size >= 4, 'plusieurs contrats différents joués : ' + [...seen]);
});

test('donnes complètes au hasard : toute carte légale est acceptée, sur chaque contrat', () => {
  const r = lcg(42);
  for (const suit of E.CONTRACTS) for (let i = 0; i < 25; i++) {
    const deal = E.makeDeal('aleatoire-' + suit, i);
    const first = E.next(deal.dealer);
    const bid = (g, seat) => (seat === first && !g.contract ? { type: 'bid', value: 80, suit } : { type: 'pass' });
    const g = playDeal(deal, { bid, card: randomCard(r) });
    assert.equal(g.contract.suit, suit);
    checkFinishedDeal(g);
  }
});

test('donnes complètes en MOC : personne ne passe avant la coinche', () => {
  for (let i = 0; i < 40; i++) {
    const g = playDeal(E.makeDeal('moc', i), { moc: true });
    checkFinishedDeal(g);
    assert.ok(g.contract, 'une donne MOC est toujours jouée');
    const bids = g.bids.slice(0, g.bids.findIndex(b => b.type === 'coinche') + 1 || undefined);
    const capotByPartner = (b, k) => k > 0 && bids.slice(0, k).some(x => x.type === 'bid' && x.value === 250 && E.team(x.seat) === E.team(b.seat));
    bids.forEach((b, k) => { if (b.type === 'pass') assert.ok(capotByPartner(b, k), 'passe interdite en MOC'); });
  }
});

test('donne complète scriptée : capot et belote du preneur', () => {
  const deal = { idx: 0, dealer: O, hands: [
    hand('7S 8S 9S 10S JS QS KS AS'), hand('7H 8H 9H 10H JH QH KH AH'),
    hand('7D 8D 9D 10D JD QD KD AD'), hand('7C 8C 9C 10C JC QC KC AC'),
  ] };
  const g = E.newGame(deal);
  E.applyBid(g, S, { type: 'bid', value: 80, suit: 'S' });
  for (const s of [EST, N, O]) E.applyBid(g, s, { type: 'pass' });
  assert.equal(g.phase, 'play');
  assert.equal(g.beloteSeat, S);
  while (g.phase === 'play') E.playCard(g, g.turn, E.legalCards(g, g.turn)[0]);
  assert.deepEqual(g.result.tricks, [8, 0]);
  assert.deepEqual(g.result.cardPts, [250, 0]);
  assert.equal(g.beloteSaid, 2);
  assert.deepEqual([g.result.ns, g.result.ew], [80 + 250 + 20, 0]);
});

test('duplicate : la même donne jouée par les mêmes IA donne le même résultat', () => {
  for (let i = 0; i < 10; i++) {
    const a = playDeal(E.makeDeal('dup', i)), b = playDeal(E.makeDeal('dup', i));
    assert.deepEqual(a.result, b.result);
    assert.deepEqual(a.bids, b.bids);
  }
});

// ===================== Score =====================

test('score : contrat réussi = annonce + points faits, défense garde ses points', () => {
  const r = scored({ value: 110, winners: NS_120 });
  assert.deepEqual(r.cardPts, [120, 42]);
  assert.equal(r.made, true);
  assert.deepEqual([r.ns, r.ew], [230, 42]);
});

test('score : chute = 160 + annonce pour la défense', () => {
  const r = scored({ value: 130, winners: NS_120 });
  assert.equal(r.made, false);
  assert.deepEqual([r.ns, r.ew], [0, 290]);
});

test('score : contrat d\'Est-Ouest, comptes inversés', () => {
  const winners = NS_120.map(w => E.next(w)); // EO fait 120
  const r = scored({ value: 100, seat: EST, winners });
  assert.deepEqual(r.cardPts, [42, 120]);
  assert.deepEqual([r.ns, r.ew], [42, 220]);
});

test('score : 82 points minimum même pour un 80', () => {
  // NS gagne 9, 10 et V : 14 + 40 + 26 = 80
  const r = scored({ value: 80, winners: [EST, EST, S, N, S, EST, EST, O] });
  assert.deepEqual(r.cardPts, [80, 82]);
  assert.equal(r.made, false);
  assert.deepEqual([r.ns, r.ew], [0, 240]);
});

test('score : la belote compte pour réussir le contrat et reste à son détenteur', () => {
  let r = scored({ value: 130, winners: NS_120, beloteSeat: N }); // 120 + 20 ≥ 130
  assert.equal(r.made, true);
  assert.equal(r.belote, 0);
  assert.deepEqual([r.ns, r.ew], [130 + 120 + 20, 42]);

  r = scored({ value: 160, winners: NS_120, beloteSeat: S }); // chute, belote gardée
  assert.equal(r.made, false);
  assert.deepEqual([r.ns, r.ew], [20, 320]);

  r = scored({ value: 110, winners: NS_120, beloteSeat: EST }); // belote en défense, sans effet sur le contrat
  assert.equal(r.made, true);
  assert.deepEqual([r.ns, r.ew], [230, 62]);
});

test('score : capot = 250 points de cartes', () => {
  const r = scored({ value: 80, winners: Array(8).fill(S) });
  assert.deepEqual(r.cardPts, [250, 0]);
  assert.deepEqual([r.ns, r.ew], [330, 0]);
});

test('score : capot subi par le preneur', () => {
  const r = scored({ value: 80, winners: Array(8).fill(EST) });
  assert.deepEqual(r.cardPts, [0, 250]);
  assert.equal(r.made, false);
  assert.deepEqual([r.ns, r.ew], [0, 240]);
});

test('score : capot annoncé (250) exige tous les plis', () => {
  let r = scored({ value: 250, winners: Array(8).fill(N) });
  assert.equal(r.made, true);
  assert.deepEqual([r.ns, r.ew], [500, 0]);

  r = scored({ value: 250, winners: [S, S, S, S, S, S, S, EST] });
  assert.equal(r.made, false);
  assert.deepEqual([r.ns, r.ew], [0, 410]);
});

test('score : donne passée', () => {
  const r = E.scoreDeal({ contract: null, tricks: [], beloteSeat: null });
  assert.equal(r.passed, true);
  assert.deepEqual([r.ns, r.ew], [0, 0]);
});

// ===================== Coinche / surcoinche : barème =====================

test('score coinché : réussi = 160 + annonce × 2, rien pour la défense', () => {
  const r = scored({ value: 100, coinche: 2, winners: NS_120 });
  assert.deepEqual([r.ns, r.ew], [360, 0]);
});

test('score coinché : chute = 160 + annonce × 2 pour la défense', () => {
  const r = scored({ value: 130, coinche: 2, winners: NS_120 });
  assert.deepEqual([r.ns, r.ew], [0, 420]);
});

test('score surcoinché : × 4, réussi ou chuté', () => {
  assert.deepEqual((({ ns, ew }) => [ns, ew])(scored({ value: 100, coinche: 4, winners: NS_120 })), [560, 0]);
  assert.deepEqual((({ ns, ew }) => [ns, ew])(scored({ value: 130, coinche: 4, winners: NS_120 })), [0, 680]);
});

test('score coinché : la belote s\'ajoute en plus', () => {
  const r = scored({ value: 100, coinche: 2, winners: NS_120, beloteSeat: O });
  assert.deepEqual([r.ns, r.ew], [360, 20]);
});

// ===================== Enchères =====================

const fresh = (opts) => E.newGame({ idx: 0, dealer: O, hands: E.makeDeal('enchères', 0).hands }, opts); // Sud parle en premier

test('enchères : quatre passes, donne passée', () => {
  const g = fresh();
  assert.equal(g.turn, S);
  for (const s of [S, EST, N, O]) E.applyBid(g, s, { type: 'pass' });
  assert.equal(g.phase, 'done');
  assert.equal(g.result.passed, true);
});

test('enchères : trois passes après une annonce, le jeu commence derrière le donneur', () => {
  const g = fresh();
  E.applyBid(g, S, { type: 'pass' });
  E.applyBid(g, EST, { type: 'bid', value: 90, suit: 'H' });
  for (const s of [N, O]) E.applyBid(g, s, { type: 'pass' });
  assert.equal(g.phase, 'bid');
  E.applyBid(g, S, { type: 'pass' });
  assert.equal(g.phase, 'play');
  assert.equal(g.turn, S);
  assert.deepEqual(g.contract, { value: 90, suit: 'H', seat: EST, coinche: 1 });
});

test('enchères : surenchère obligatoire, tour et contrat vérifiés', () => {
  const g = fresh();
  assert.throws(() => E.applyBid(g, EST, { type: 'pass' }), /Pas votre tour/);
  E.applyBid(g, S, { type: 'bid', value: 100, suit: 'S' });
  assert.deepEqual(E.legalBidOptions(g, EST).values, [110, 120, 130, 140, 150, 160, 250]);
  assert.throws(() => E.applyBid(g, EST, { type: 'bid', value: 100, suit: 'H' }), /Annonce invalide/);
  assert.throws(() => E.applyBid(g, EST, { type: 'bid', value: 110, suit: 'X' }), /Annonce invalide/);
});

test('coinche : seulement par l\'adversaire du preneur', () => {
  const g = fresh();
  assert.equal(E.legalBidOptions(g, S).coinche, false);
  assert.throws(() => E.applyBid(g, S, { type: 'coinche' }), /Coinche impossible/);
  E.applyBid(g, S, { type: 'bid', value: 80, suit: 'D' });
  assert.equal(E.legalBidOptions(g, EST).coinche, true);
  E.applyBid(g, EST, { type: 'pass' });
  assert.equal(E.legalBidOptions(g, N).coinche, false);
  assert.throws(() => E.applyBid(g, N, { type: 'coinche' }), /Coinche impossible/);
});

test('coinche puis surcoinche : l\'équipe preneuse parle dans l\'ordre de jeu', () => {
  const g = fresh();
  E.applyBid(g, S, { type: 'bid', value: 80, suit: 'D' });
  E.applyBid(g, EST, { type: 'coinche' });
  assert.equal(g.contract.coinche, 2);
  assert.equal(g.contract.coincheBy, EST);
  assert.deepEqual(g.surQueue, [N, S]);
  assert.equal(g.turn, N);
  assert.deepEqual(E.legalBidOptions(g, N), { pass: true, values: [], coinche: false, surcoinche: true });
  E.applyBid(g, N, { type: 'pass' });
  assert.equal(g.turn, S);
  E.applyBid(g, S, { type: 'surcoinche' });
  assert.equal(g.contract.coinche, 4);
  assert.equal(g.phase, 'play');
  assert.equal(g.surQueue, null);
});

test('coinche sans surcoinche : le jeu commence coinché', () => {
  const g = fresh();
  E.applyBid(g, S, { type: 'pass' });
  E.applyBid(g, EST, { type: 'bid', value: 120, suit: 'NT' });
  E.applyBid(g, N, { type: 'coinche' });
  assert.deepEqual(g.surQueue, [O, EST]);
  E.applyBid(g, O, { type: 'pass' });
  E.applyBid(g, EST, { type: 'pass' });
  assert.equal(g.phase, 'play');
  assert.equal(g.contract.coinche, 2);
});

test('coinche : plus aucune surenchère possible ensuite', () => {
  const g = fresh();
  E.applyBid(g, S, { type: 'bid', value: 80, suit: 'D' });
  E.applyBid(g, EST, { type: 'coinche' });
  assert.deepEqual(E.legalBidOptions(g, N).values, []);
  E.applyBid(g, N, { type: 'bid', value: 90, suit: 'D' }); // traité comme « pas de surcoinche »
  assert.equal(g.contract.value, 80);
  assert.equal(g.turn, S);
});

test('coinche jouée jusqu\'au bout : barème × 2 appliqué', () => {
  for (let i = 0; i < 20; i++) {
    const deal = E.makeDeal('coinche-complète', i);
    const first = E.next(deal.dealer);
    const bid = (g, seat) => {
      if (!g.contract) return { type: 'bid', value: 100, suit: 'H' };
      if (!g.surQueue && E.legalBidOptions(g, seat).coinche) return { type: 'coinche' };
      return { type: 'pass' };
    };
    const g = playDeal(deal, { bid });
    assert.equal(g.contract.seat, first);
    assert.equal(g.contract.coinche, 2);
    checkFinishedDeal(g);
    const r = g.result, att = E.team(first);
    if (r.made) assert.equal(att ? r.ew : r.ns, 160 + 200 + (r.belote === att ? 20 : 0));
    else assert.equal(att ? r.ns : r.ew, 160 + 200 + (r.belote === 1 - att ? 20 : 0));
  }
});

test('MOC : passe interdite tant qu\'on peut monter ou coincher', () => {
  const g = fresh({ moc: true });
  assert.equal(E.legalBidOptions(g, S).pass, false);
  assert.throws(() => E.applyBid(g, S, { type: 'pass' }), /MOC/);
  E.applyBid(g, S, { type: 'bid', value: 250, suit: 'C' });
  assert.equal(E.legalBidOptions(g, EST).pass, false); // il reste la coinche
  E.applyBid(g, EST, { type: 'coinche' });
  E.applyBid(g, N, { type: 'pass' }); // surcoinche toujours facultative
  E.applyBid(g, S, { type: 'pass' });
  assert.equal(g.phase, 'play');
});

test('MOC : passe permise derrière le capot annoncé du partenaire', () => {
  const g = fresh({ moc: true });
  E.applyBid(g, S, { type: 'bid', value: 160, suit: 'C' });
  E.applyBid(g, EST, { type: 'bid', value: 250, suit: 'H' });
  assert.equal(E.legalBidOptions(g, N).pass, false);
  E.applyBid(g, N, { type: 'coinche' });
  E.applyBid(g, O, { type: 'pass' });
  E.applyBid(g, EST, { type: 'pass' });
  assert.equal(g.phase, 'play');

  const h = fresh({ moc: true });
  E.applyBid(h, S, { type: 'bid', value: 250, suit: 'C' });
  E.applyBid(h, EST, { type: 'coinche' });
  // après une coinche, la file de surcoinche ne dépend plus du MOC
  assert.equal(E.legalBidOptions(h, N).pass, true);
});

// ===================== Cartes jouables =====================

function inPlay(hands, suit, trick) {
  const g = E.newGame({ idx: 0, dealer: O, hands: hands.map(hand) });
  E.applyBid(g, S, { type: 'bid', value: 80, suit });
  for (const s of [EST, N, O]) E.applyBid(g, s, { type: 'pass' });
  g.trick = trick.map(([seat, card]) => ({ seat, card: c(card) }));
  for (const x of g.trick) g.hands[x.seat] = g.hands[x.seat].filter(y => key(y) !== key(x.card));
  g.turn = E.next(trick[trick.length - 1][0]);
  return g;
}
const legal = (g, seat = g.turn) => E.legalCards(g, seat).map(key).sort();

test('cartes : fournir la couleur demandée', () => {
  const g = inPlay(['AH 7S', 'KH 8H JS 7C', '7D', '8D'], 'S', [[S, 'AH']]);
  assert.deepEqual(legal(g), ['8H', 'KH']);
});

test('cartes : couper quand l\'adversaire est maître, surcouper si possible', () => {
  const g = inPlay(['7H 7D', 'AH 8D', 'JS 8S 8C', '9S QS 9D'], 'C', [[S, '7H'], [EST, 'AH']]);
  // atout trèfle : Nord n'a pas de cœur, l'adversaire (Est) est maître → doit couper
  assert.deepEqual(legal(g), ['8C']);
  const h = inPlay(['AH 7D', 'JC 7D', '9C QC 7S', '8D'], 'C', [[S, 'AH'], [EST, 'JC']]);
  // Nord doit couper mais ne peut surcouper le valet : il sous-coupe
  assert.deepEqual(legal(h), ['9C', 'QC']);
  const k = inPlay(['AH 7D', '8C 7D', '9C 7C 7S', '8D'], 'C', [[S, 'AH'], [EST, '8C']]);
  assert.deepEqual(legal(k), ['9C']); // surcoupe obligatoire
});

test('cartes : partenaire maître, défausse libre', () => {
  const g = inPlay(['AH 7D', '7H 8D', '9C 7S', '8S'], 'C', [[S, 'AH'], [EST, '7H']]);
  assert.deepEqual(legal(g), ['7S', '9C']);
});

test('cartes : monter à l\'atout demandé, sauf partenaire maître', () => {
  const g = inPlay(['9S 7D', '10S 7D', 'JS 7S 8D', '8D'], 'S', [[S, '9S'], [EST, '10S']]);
  assert.deepEqual(legal(g), ['7S', 'JS']); // Sud (partenaire) maître avec le 9 : pas obligé de monter
  const h = inPlay(['10S 7D', 'AS 7D', 'JS 7S 8D', '8D'], 'S', [[S, '10S'], [EST, 'AS']]);
  assert.deepEqual(legal(h), ['JS']); // Est maître avec l'as : Nord doit monter
});

test('cartes : sans atout et tout atout', () => {
  const nt = inPlay(['AH 7D', 'KH 7S 8D', '9D', '10D'], 'NT', [[S, 'AH']]);
  assert.deepEqual(legal(nt), ['KH']);
  const at = inPlay(['9H 7D', '7H JH 8D', '9D', '10D'], 'AT', [[S, '9H']]);
  assert.deepEqual(legal(at), ['JH']); // tout atout : il faut monter dans la couleur
  assert.equal(E.trickWinner([{ seat: S, card: c('9H') }, { seat: EST, card: c('JS') }], 'AT'), S);
});

test('cartes : jouer une carte interdite ou hors tour est refusé', () => {
  const g = inPlay(['AH 7S', 'KH 8H JS 7C', '7D', '8D'], 'S', [[S, 'AH']]);
  assert.throws(() => E.playCard(g, EST, c('JS')), /Carte interdite/);
  assert.throws(() => E.playCard(g, N, c('7D')), /Pas votre tour/);
});

// ===================== Duplicate =====================

test('duplicate : rotation des séries, chaque table joue chaque série une fois', () => {
  for (const tables of [1, 2, 3, 5]) {
    for (let round = 0; round < tables; round++) {
      const sets = Array.from({ length: tables }, (_, t) => E.setForTable(tables, t, round));
      assert.equal(new Set(sets).size, tables, 'séries distinctes au tour ' + round);
    }
    for (let t = 0; t < tables; t++) {
      const sets = Array.from({ length: tables }, (_, round) => E.setForTable(tables, t, round));
      assert.deepEqual(sets.slice().sort(), Array.from({ length: tables }, (_, i) => i));
    }
  }
});

test('duplicate : donnes d\'une série', () => {
  assert.deepEqual(E.dealsOfSet(3, 0), [0, 1, 2]);
  assert.deepEqual(E.dealsOfSet(3, 2), [6, 7, 8]);
  assert.deepEqual(E.dealsOfSet(1, 4), [4]);
});

test('duplicate : toutes les tables reçoivent la même donne', () => {
  const seed = 'tournoi-du-samedi';
  const tables = 3, perSet = 2;
  const byIdx = {};
  for (let round = 0; round < tables; round++) for (let t = 0; t < tables; t++)
    for (const idx of E.dealsOfSet(perSet, E.setForTable(tables, t, round))) (byIdx[idx] = byIdx[idx] || []).push(E.makeDeal(seed, idx));
  assert.equal(Object.keys(byIdx).length, tables * perSet);
  for (const deals of Object.values(byIdx)) {
    assert.equal(deals.length, tables);
    deals.forEach(d => assert.deepEqual(d, deals[0]));
  }
});

test('points de match : 2 / 1 / 0 par comparaison, en pourcentage', () => {
  const mp = E.matchpoints([
    { deal: 0, table: 0, ns: 300, ew: 0 },
    { deal: 0, table: 1, ns: 100, ew: 0 },
    { deal: 0, table: 2, ns: 0, ew: 0 },
    { deal: 1, table: 0, ns: 0, ew: 250 },
    { deal: 1, table: 1, ns: 0, ew: 250 },
  ]);
  assert.equal(mp[0][0].nsPct, 100);
  assert.equal(mp[0][1].nsPct, 50);
  assert.equal(mp[0][2].nsPct, 0);
  assert.equal(mp[0][2].ewPct, 100);
  assert.equal(mp[0][0].n, 2);
  assert.ok(Math.abs(mp[0][0].diff - (300 - 400 / 3)) < 1e-9);
  assert.equal(mp[1][0].nsPct, 50); // égalité
  assert.equal(mp[1][1].ewPct, 50);
  assert.equal(mp[1][0].diff, 0);
});

test('points de match : une donne jouée à une seule table n\'est pas comparée', () => {
  const mp = E.matchpoints([{ deal: 5, table: 0, ns: 160, ew: 0 }]);
  assert.equal(mp[5][0].nsPct, null);
  assert.equal(mp[5][0].ewPct, null);
  assert.equal(mp[5][0].n, 0);
});

test('classement : moyenne des pourcentages par ligne NS et EO', () => {
  const names = t => ({ ns: 'NS' + t, ew: 'EO' + t });
  const results = [
    { deal: 0, table: 0, ns: 300, ew: 0, names: names(0) },
    { deal: 0, table: 1, ns: 0, ew: 0, names: names(1) },
    { deal: 1, table: 0, ns: 0, ew: 100, names: names(0) },
    { deal: 1, table: 1, ns: 0, ew: 100, names: names(1) },
    { deal: 2, table: 1, ns: 80, ew: 0, names: names(1) }, // pas encore jouée ailleurs
  ];
  const st = E.standings(results, 2);
  assert.equal(st.length, 4);
  const line = (t, side) => st.find(l => l.table === t && l.side === side);
  assert.deepEqual(line(0, 'NS'), { table: 0, side: 'NS', pct: 75, compared: 2, played: 2, names: 'NS0' });
  assert.deepEqual(line(0, 'EO'), { table: 0, side: 'EO', pct: 25, compared: 2, played: 2, names: 'EO0' });
  assert.deepEqual(line(1, 'NS'), { table: 1, side: 'NS', pct: 25, compared: 2, played: 3, names: 'NS1' });
  assert.deepEqual(line(1, 'EO'), { table: 1, side: 'EO', pct: 75, compared: 2, played: 3, names: 'EO1' });
});

test('classement : table sans résultat', () => {
  const st = E.standings([], 2);
  assert.equal(st.length, 4);
  st.forEach(l => { assert.equal(l.pct, null); assert.equal(l.played, 0); });
});

test('duplicate de bout en bout : deux tables d\'IA, classement complémentaire', () => {
  const seed = 'mini-tournoi', tables = 2, perSet = 3, results = [];
  for (let round = 0; round < tables; round++) for (let t = 0; t < tables; t++)
    for (const idx of E.dealsOfSet(perSet, E.setForTable(tables, t, round))) {
      const g = playDeal(E.makeDeal(seed, idx));
      results.push({ deal: idx, table: t, ns: g.result.ns, ew: g.result.ew });
    }
  const mp = E.matchpoints(results);
  // mêmes donnes, mêmes IA : chaque donne est une égalité parfaite
  for (const deal of Object.values(mp)) for (const m of Object.values(deal)) { assert.equal(m.nsPct, 50); assert.equal(m.diff, 0); }
  E.standings(results, tables).forEach(l => { assert.equal(l.pct, 50); assert.equal(l.compared, tables * perSet); });
});
