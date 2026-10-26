/* Tests des profils : fiches de donne écrites par la table, stats, classements de tournoi, hall of fame. */
const test = require('node:test');
const assert = require('node:assert/strict');
global.E = require('../engine.js');
global.P = require('../profile.js');
const T = require('../table.js');

/** Joue une donne complète sur une table (IA partout, mains lues dans les écritures). Renvoie les écritures de fin. */
function playOut(doc, uid) {
  let r = T.apply(doc, { type: doc.status === 'lobby' ? 'start' : 'next' }, uid);
  const hands = {};
  for (const w of r.writes) { const m = w.path.match(/hands\/\d+-(\d)$/); if (m) hands[m[1]] = w.data.cards; }
  let d = r.doc, guard = 0;
  while (d.status === 'playing') {
    const g = T.getGame(d, hands);
    // les sièges humains jouent comme l'IA
    const seat = g.turn, move = g.phase === 'bid' ? { type: 'bid', bid: E.botBid(g, seat) } : { type: 'card', card: E.botPlay(g, seat) };
    r = T.apply(d, d.seats[seat].bot ? { type: 'botmove', seat, hands } : { ...move, seat, hands }, uid);
    d = r.doc; assert.ok(++guard < 300);
  }
  return { doc: d, writes: r.writes };
}

test('table : un profil ne tient qu\'un siège par table', () => {
  let d = T.initFree('ABCD', { target: 500 });
  d = T.apply(d, { type: 'sit', seat: 0, name: 'Léa', pid: 'pL' }, 'u1').doc;
  d = T.apply(d, { type: 'sit', seat: 2, name: 'Léa bis', pid: 'pL' }, 'u1').doc;
  assert.equal(d.seats[0].pid, 'pL');
  assert.equal(d.seats[2].pid, undefined);
  d = T.apply(d, { type: 'sit', seat: 1, name: 'Max' }, 'u2').doc;
  assert.equal(d.seats[1].pid, undefined);
});

test('table : chaque donne écrit une fiche par joueur avec profil, partie gagnée notée à la fin', () => {
  let d = T.initFree('ABCD', { target: 500 });
  d.createdAt = 123;
  d = T.apply(d, { type: 'sit', seat: 0, name: 'Léa', pid: 'pL' }, 'u1').doc;
  d = T.apply(d, { type: 'sit', seat: 1, name: 'Max', pid: 'pM' }, 'u1').doc;
  d = T.apply(d, { type: 'fillBots' }, 'u1').doc;
  const all = [];
  for (let k = 0; k < 40 && Math.max(...d.scores) < 500; k++) { const r = playOut(d, 'u1'); d = r.doc; all.push(...r.writes); }
  const recs = all.filter(w => w.path.startsWith('players/'));
  const lea = recs.filter(w => w.path.startsWith('players/pL/deals/')), max = recs.filter(w => w.path.startsWith('players/pM/deals/'));
  assert.equal(lea.length, d.n); assert.equal(max.length, d.n);
  assert.equal(new Set(lea.map(w => w.path)).size, d.n, 'clés distinctes');
  assert.match(lea[0].path, /^players\/pL\/deals\/room-ABCD-123-n0-s0$/);
  assert.equal(lea[0].data.partner, 'IA Nord');
  for (const w of lea) assert.equal(w.data.side, 0);
  const endL = lea.find(w => w.data.game), endM = max.find(w => w.data.game);
  assert.ok(endL && endM, 'fin de partie notée');
  assert.notEqual(endL.data.game.won, endM.data.game.won);
  // points cumulés = score de la partie
  assert.equal(lea.reduce((a, w) => a + w.data.pts, 0), d.scores[0]);
  const st = P.stats(lea.map(w => w.data));
  assert.equal(st.deals, d.n); assert.equal(st.games, 1);
  assert.ok(st.made <= st.taken && st.coinchesOk <= st.coinches);
});

test('table de tournoi : fiche avec tournoi, table et donne', () => {
  const tour = { id: 'tX', name: 'Coupe', tables: 1, perSet: 1 };
  let d = T.initTour(tour, 0);
  d = T.apply(d, { type: 'sit', seat: 3, name: 'Zoé', pid: 'pZ' }, 'u1').doc;
  d = T.apply(d, { type: 'fillBots' }, 'u1').doc;
  // mains écrites à la création du tournoi
  const hw = T.tourHands(tour, 'graine'), hands = {};
  for (const w of hw) { const m = w.path.match(/hands\/0-(\d)$/); if (m) hands[m[1]] = w.data.cards; }
  let r = T.apply(d, { type: 'start' }, 'u1'); d = r.doc;
  while (d.status === 'playing') { const g = T.getGame(d, hands); r = T.apply(d, d.seats[g.turn].bot ? { type: 'botmove', seat: g.turn, hands } : { type: g.phase === 'bid' ? 'bid' : 'card', seat: g.turn, hands, ...(g.phase === 'bid' ? { bid: E.botBid(g, g.turn) } : { card: E.botPlay(g, g.turn) }) }, 'u1'); d = r.doc; }
  const rec = r.writes.find(w => w.path.startsWith('players/pZ/'));
  assert.equal(rec.path, 'players/pZ/deals/tour-tX-d0-s3');
  assert.deepEqual([rec.data.tid, rec.data.tname, rec.data.table, rec.data.side, rec.data.deal], ['tX', 'Coupe', 0, 1, 0]);
  assert.equal(rec.data.game, undefined);
});

const rec = (o = {}) => ({ kind: 'free', side: 0, partner: 'Bob', partnerPid: null, passed: false, role: 'me', contract: { value: 80, suit: 'S', coinche: 1 }, made: true, capot: false, belote: false, coinched: false, pts: 100, against: 62, at: 1, ...o });

test('stats : contrats, défense, coinches, capots, partenaires', () => {
  const st = P.stats([
    rec(),
    rec({ made: false, pts: 0 }),
    rec({ role: 'partner', capot: true, contract: { value: 250, suit: 'H', coinche: 1 } }),
    rec({ role: 'opp', made: false, coinched: true }),
    rec({ role: 'opp', made: true, coinched: true }),
    rec({ role: 'me', contract: { value: 120, suit: 'D', coinche: 2 }, partner: 'Ali', partnerPid: 'pA' }),
    rec({ passed: true, role: null, contract: null, made: null, belote: true, game: { won: true } }),
  ]);
  assert.equal(st.deals, 7);
  assert.equal(st.taken, 3); assert.equal(st.made, 2); assert.equal(Math.round(st.rate), 67);
  assert.equal(st.teamTaken, 4); assert.equal(st.capots, 1);
  assert.equal(st.defended, 2); assert.equal(st.sunk, 1);
  assert.equal(st.coinches, 2); assert.equal(st.coinchesOk, 1);
  assert.equal(st.belotes, 1); assert.equal(st.wins, 1); assert.equal(st.games, 1);
  assert.deepEqual(st.best, { value: 120, suit: 'D', coinche: 2 });
  assert.equal(st.partners[0].name, 'Bob'); assert.equal(st.partners[1].pid, 'pA');
});

test('classement de tournoi : place de sa ligne, ex æquo et tournoi terminé', () => {
  // 3 tables jouent la donne 0 : NS de la table 1 meilleure, tables 0 et 2 à égalité
  const results = [{ table: 0, deal: 0, ns: 90, ew: 72 }, { table: 1, deal: 0, ns: 140, ew: 22 }, { table: 2, deal: 0, ns: 90, ew: 72 }];
  assert.deepEqual(P.tourRank(results, 3, 1, 'NS'), { pos: 1, of: 3, pct: 100, played: 1 });
  assert.equal(P.tourRank(results, 3, 0, 'NS').pos, 2);
  assert.equal(P.tourRank(results, 3, 2, 'NS').pos, 2);
  assert.equal(P.tourRank(results, 3, 1, 'EO').pos, 3);
  const lines = P.tourLines([
    { kind: 'tour', tid: 't1', tname: 'A', table: 1, side: 0, at: 5 }, { kind: 'tour', tid: 't1', tname: 'A', table: 1, side: 0, at: 6 },
    { kind: 'tour', tid: 't1', tname: 'A', table: 0, side: 1, at: 7 }, { kind: 'free', at: 9 },
  ]);
  assert.deepEqual(lines, [{ tid: 't1', name: 'A', table: 1, side: 'NS', deals: 3, at: 7 }]);
  const st = P.stats([], { t1: { pos: 1, done: true, pct: 61 }, t2: { pos: 3, done: true, pct: 48 }, t3: { pos: 1, done: false, pct: 70 } });
  assert.deepEqual([st.tours, st.tourWins, st.podiums, st.bestPct], [3, 1, 2, 70]);
});

test('hall of fame : tableaux triés, seuil du meilleur preneur', () => {
  const pl = (id, s) => ({ id, name: id, summary: { deals: 0, taken: 0, made: 0, rate: null, capots: 0, belotes: 0, coinches: 0, coinchesOk: 0, games: 0, wins: 0, tours: 0, tourWins: 0, podiums: 0, ...s } });
  const b = P.boards([pl('a', { wins: 3, games: 5, taken: 5, made: 5, rate: 100 }), pl('b', { wins: 7, games: 9, taken: 20, made: 15, rate: 75 }), pl('c', {})]);
  const by = k => b.find(x => x.key === k).rows.map(r => r.p.id);
  assert.deepEqual(by('wins'), ['b', 'a']);
  assert.deepEqual(by('rate'), ['b']);
  assert.deepEqual(by('capots'), []);
});

test('code de profil : format et normalisation', () => {
  const k = P.newKey();
  assert.match(k, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(P.normKey(' abcd efgh '), 'ABCD-EFGH');
  assert.equal(P.normKey(k.toLowerCase().replace('-', '')), k);
});

test('option belote : choisie à la création de la table ou du tournoi, transmise à chaque donne', () => {
  assert.equal(T.initFree('ABCD', {}).belote, true);
  const d = T.initFree('ABCD', { belote: false });
  d.seats = d.seats.map((x, i) => ({ uid: null, name: 'IA ' + i, bot: true }));
  d.seats[0] = { uid: 'u', name: 'A', bot: false };
  const r = T.apply(d, { type: 'start' }, 'u');
  assert.equal(JSON.parse(r.doc.game).noBelote, true);
  const t = T.initTour({ id: 't1', name: 'X', tables: 1, perSet: 2, belote: false }, 0);
  assert.equal(t.tour.belote, false);
  assert.equal(T.initTour({ id: 't1', name: 'X', tables: 1, perSet: 2 }, 0).tour.belote, undefined);
});

test('coinche à la volée à la table', () => {
  let d = T.initFree('ABCD', {});
  d.seats = [{ uid: 'u', name: 'A', bot: false }, { uid: 'v', name: 'B', bot: false }, { uid: 'w', name: 'C', bot: false }, { uid: 'x', name: 'D', bot: false }];
  let r = T.apply(d, { type: 'start' }, 'u'); d = r.doc;
  const hands = [0, 1, 2, 3].map(s => r.writes.find(w => w.path === T.handPath('rooms/ABCD', 0, s)).data.cards);
  d = T.apply(d, { type: 'bid', seat: 1, bid: { type: 'bid', value: 80, suit: 'S' }, hands }, 'v').doc;
  assert.equal(d.speed, 'normal');
  const on = { value: 80, suit: 'S', seat: 1 };
  assert.throws(() => T.apply(d, { type: 'bid', seat: 0, bid: { type: 'coinche' }, on: { ...on, value: 90 }, hands }, 'u'), /contrat a changé/);
  assert.throws(() => T.apply(d, { type: 'bid', seat: 3, bid: { type: 'coinche' }, on, hands }, 'x'), /plus ce tour/); // partenaire du preneur
  d = T.apply(d, { type: 'bid', seat: 0, bid: { type: 'coinche' }, on, hands }, 'u').doc; // Sud coinche alors que c'est à Nord
  assert.equal(T.getGame(d, hands).contract.coinche, 2);
});
