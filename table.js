/* ===== Protocole d'une table (pur, sans réseau) =====
 * Un document « table » décrit les 4 sièges, la donne en cours (JSON du moteur) et la progression.
 * Toute modification passe par T.apply(doc, action, uid) : même code en local et dans une transaction Firestore.
 */
const T = (() => {
  const EMPTY = () => ({ uid: null, name: '', bot: false });
  const clone = o => JSON.parse(JSON.stringify(o));

  function initTour(tour, table) {
    return {
      kind: 'tour', tid: tour.id, table,
      tour: { id: tour.id, name: tour.name, tables: tour.tables, perSet: tour.perSet, seed: tour.seed },
      seats: [EMPTY(), EMPTY(), EMPTY(), EMPTY()],
      round: 0, doneDeals: [], status: 'lobby', game: null, rev: 0, at: 0,
    };
  }
  function initFree(code, seed, opts = {}) {
    return {
      kind: 'free', code, seed, n: 0, scores: [0, 0], target: opts.target || 1000, moc: !!opts.moc,
      seats: [EMPTY(), EMPTY(), EMPTY(), EMPTY()],
      status: 'lobby', game: null, rev: 0, at: 0,
    };
  }

  const currentSet = d => E.setForTable(d.tour.tables, d.table, d.round);
  function nextDealIdx(d) {
    if (d.kind === 'free') return d.n;
    const done = new Set(d.doneDeals);
    let round = d.round;
    while (round < d.tour.tables) {
      const set = E.setForTable(d.tour.tables, d.table, round);
      const idx = E.dealsOfSet(d.tour.perSet, set).find(x => !done.has(x));
      if (idx !== undefined) return { idx, round };
      round++;
    }
    return null;
  }

  const full = d => d.seats.every(s => s.bot || s.uid);
  const getGame = d => (d.game ? JSON.parse(d.game) : null);

  function deal(d) {
    if (d.kind === 'free') {
      if (Math.max(...d.scores) >= d.target) d.scores = [0, 0];
      d.game = JSON.stringify(E.newGame(E.makeDeal(d.seed, d.n), { moc: d.moc }));
      d.n++;
    } else {
      const nx = nextDealIdx(d);
      if (!nx) { d.status = 'finished'; d.game = null; return; }
      d.round = nx.round;
      d.game = JSON.stringify(E.newGame(E.makeDeal(d.tour.seed, nx.idx)));
    }
    d.status = 'playing';
  }

  function names(d, tm) {
    const n = i => d.seats[i].name || E.SEAT_NAME[E.SEATS[i]];
    return tm === 0 ? `${n(0)} & ${n(2)}` : `${n(1)} & ${n(3)}`;
  }

  /** Fin de donne : renvoie les écritures annexes (résultat duplicate). */
  function finish(d, g) {
    const r = g.result, writes = [];
    d.status = 'between';
    if (d.kind === 'free') { d.scores[0] += r.ns; d.scores[1] += r.ew; }
    else {
      d.doneDeals = [...d.doneDeals, g.idx];
      writes.push({
        path: `tournaments/${d.tid}/results/t${d.table}-d${g.idx}`,
        data: {
          table: d.table, deal: g.idx, set: Math.floor(g.idx / d.tour.perSet), ns: r.ns, ew: r.ew,
          contract: g.contract ? { value: g.contract.value, suit: g.contract.suit, seat: g.contract.seat, coinche: g.contract.coinche } : null,
          made: r.made, cardPts: r.cardPts, names: { ns: names(d, 0), ew: names(d, 1) }, at: Date.now(),
        },
      });
    }
    return writes;
  }

  class Refused extends Error {}
  const refuse = m => { throw new Refused(m); };

  /**
   * Applique une action. Lance Refused si elle n'est plus valable (tour déjà joué, siège pris…).
   * Renvoie { doc, writes }.
   */
  function apply(doc, a, uid) {
    const d = clone(doc); let writes = [];
    const seat = a.seat;
    const s = seat !== undefined ? d.seats[seat] : null;
    const canAct = i => d.seats[i] && !d.seats[i].bot && d.seats[i].uid === uid;
    switch (a.type) {
      case 'sit':
        if (s.bot || (s.uid && s.uid !== uid)) refuse('Siège déjà pris');
        d.seats[seat] = { uid, name: (a.name || '').slice(0, 24), bot: false }; break;
      case 'takeover':
        if (s.bot) refuse('Siège tenu par l\'IA');
        d.seats[seat] = { uid, name: (a.name || s.name || '').slice(0, 24), bot: false }; break;
      case 'leave':
        if (d.status === 'playing') refuse('Impossible de quitter pendant une donne');
        if (!s.bot && s.uid !== uid) refuse('Ce n\'est pas votre siège');
        d.seats[seat] = EMPTY(); break;
      case 'bot':
        if (s.uid || s.bot) refuse('Siège déjà pris');
        d.seats[seat] = { uid: null, name: 'IA ' + E.SEAT_NAME[E.SEATS[seat]], bot: true }; break;
      case 'fillBots':
        d.seats = d.seats.map((x, i) => (x.uid || x.bot) ? x : { uid: null, name: 'IA ' + E.SEAT_NAME[E.SEATS[i]], bot: true }); break;
      case 'start':
        if (d.status !== 'lobby') refuse('Déjà commencé');
        if (!full(d)) refuse('Il manque des joueurs');
        if (!d.seats.some((x, i) => canAct(i))) refuse('Asseyez-vous d\'abord');
        deal(d); break;
      case 'next':
        if (d.status !== 'between') refuse('Donne en cours');
        if (!full(d)) refuse('Il manque des joueurs');
        deal(d); break;
      case 'bid': case 'card': case 'botmove': {
        if (d.status !== 'playing') refuse('Pas de donne en cours');
        const g = getGame(d);
        if (g.turn !== seat || g.phase === 'done') refuse('Ce n\'est plus ce tour');
        if (a.rev !== undefined && a.rev !== doc.rev) refuse('Coup périmé');
        if (a.type === 'botmove') {
          if (!d.seats[seat].bot) refuse('Pas un siège IA');
          if (g.phase === 'bid') E.applyBid(g, seat, E.botBid(g, seat)); else E.playCard(g, seat, E.botPlay(g, seat));
        } else {
          if (!canAct(seat)) refuse('Ce n\'est pas votre siège');
          try {
            if (a.type === 'bid') { if (g.phase !== 'bid') refuse('Enchères terminées'); E.applyBid(g, seat, a.bid); }
            else { if (g.phase !== 'play') refuse('Enchères en cours'); E.playCard(g, seat, a.card); }
          } catch (e) { if (e instanceof Refused) throw e; refuse(e.message); }
        }
        if (g.phase === 'done') writes = finish(d, g);
        d.game = JSON.stringify(g);
        break;
      }
      default: refuse('Action inconnue');
    }
    d.rev = (doc.rev || 0) + 1;
    d.at = Date.now();
    return { doc: d, writes };
  }

  return { initTour, initFree, apply, getGame, currentSet, nextDealIdx, Refused, names };
})();
if (typeof module !== 'undefined') module.exports = T;
