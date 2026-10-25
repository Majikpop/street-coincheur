/* ===== Protocole d'une table (pur, sans réseau) =====
 * Un document « table » décrit les 4 sièges, la donne en cours (JSON du moteur) et la progression.
 * Toute modification passe par T.apply(doc, action, uid) : même code en local et dans une transaction Firestore.
 * Les mains ne sont pas dans ce document : chaque main initiale est un document à part, <table>/hands/<donne>-<siège>,
 * lisible par le seul joueur assis à ce siège (voir firestore.rules). Une action de jeu apporte les mains que
 * le téléphone connaît (a.hands) ; la main restante se déduit des cartes déjà jouées.
 */
const T = (() => {
  const EMPTY = () => ({ uid: null, name: '', bot: false });
  const clone = o => JSON.parse(JSON.stringify(o));

  function initTour(tour, table) {
    return {
      kind: 'tour', tid: tour.id, table,
      tour: { id: tour.id, name: tour.name, tables: tour.tables, perSet: tour.perSet, ...(tour.seed ? { seed: tour.seed } : {}) },
      seats: [EMPTY(), EMPTY(), EMPTY(), EMPTY()],
      round: 0, doneDeals: [], status: 'lobby', game: null, rev: 0, at: 0,
    };
  }
  function initFree(code, opts = {}) {
    return {
      kind: 'free', code, n: 0, scores: [0, 0], target: opts.target || 1000, moc: !!opts.moc,
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

  const handPath = (base, hk, s) => `${base}/hands/${hk}-${s}`;
  const playedBy = (g, s) => [...g.tricks.flatMap(t => t.cards), ...g.trick].filter(x => x.seat === s).map(x => x.card);
  /** Cartes restantes d'un siège, que sa main soit connue ou non. */
  const left = (g, s) => (g.hands[s] ? g.hands[s].length : 8 - playedBy(g, s).length);
  /** Donne en cours, avec les mains connues (siège -> main initiale) ; les autres valent null. */
  function getGame(d, hands) {
    if (!d.game) return null;
    const g = JSON.parse(d.game);
    if (g.initialHands) return g; // donne d'avant les mains privées
    const t = g.phase === 'bid' ? null : g.contract && g.contract.suit;
    g.hands = [0, 1, 2, 3].map(s => {
      const h = hands && hands[s]; if (!h) return null;
      const out = playedBy(g, s);
      return E.sortHand(h.filter(c => !out.some(o => E.sameCard(o, c))), t);
    });
    return g;
  }
  const pack = g => { if (g.initialHands) return JSON.stringify(g); const { hands, ...pub } = g; return JSON.stringify(pub); };
  /** Les quatre jeux d'une donne terminée, retrouvés à partir des plis (null si la donne a été passée). */
  const dealHands = g => g.initialHands || (g.tricks.length === 8 ? [0, 1, 2, 3].map(s => playedBy(g, s)) : null);

  /** Mains de toutes les donnes d'un tournoi, une par table et par siège, écrites par l'organisateur. La graine n'est pas conservée. */
  function tourHands(tour, seed) {
    const writes = [];
    for (let i = 0; i < tour.tables * tour.perSet; i++) {
      const { hands } = E.makeDeal(seed, i);
      for (let t = 0; t < tour.tables; t++) for (let s = 0; s < 4; s++) writes.push({ path: handPath(`tournaments/${tour.id}/tables/t${t}`, i, s), data: { cards: hands[s] } });
    }
    return writes;
  }

  /** Nouvelle donne. Renvoie les écritures des mains privées (partie libre). */
  function deal(d) {
    let g, writes = [];
    if (d.kind === 'free') {
      if (Math.max(...d.scores) >= d.target) d.scores = [0, 0];
      g = E.newGame(E.makeDeal(Math.random().toString(36).slice(2) + Date.now().toString(36), d.n), { moc: d.moc });
      writes = g.initialHands.map((h, s) => ({ path: handPath(`rooms/${d.code}`, g.idx, s), data: { cards: h } }));
      d.n++;
    } else {
      const nx = nextDealIdx(d);
      if (!nx) { d.status = 'finished'; d.game = null; return []; }
      d.round = nx.round;
      if (d.tour.seed) { // tournoi créé avant les mains privées : donnes tirées de la graine publique
        d.game = JSON.stringify(E.newGame(E.makeDeal(d.tour.seed, nx.idx))); d.hk = null; d.status = 'playing'; return [];
      }
      g = E.newGame({ idx: nx.idx, dealer: nx.idx % 4, hands: [[], [], [], []] }); // mains écrites à la création du tournoi
    }
    delete g.initialHands;
    d.game = pack(g); d.hk = String(g.idx);
    d.status = 'playing';
    return writes;
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
        writes = deal(d); break;
      case 'next':
        if (d.status !== 'between') refuse('Donne en cours');
        if (!full(d)) refuse('Il manque des joueurs');
        writes = deal(d); break;
      case 'bid': case 'card': case 'botmove': {
        if (d.status !== 'playing') refuse('Pas de donne en cours');
        const g = getGame(d, a.hands);
        if (g.turn !== seat || g.phase === 'done') refuse('Ce n\'est plus ce tour');
        if (a.rev !== undefined && a.rev !== doc.rev) refuse('Coup périmé');
        if (a.type !== 'bid' && !g.hands[seat]) refuse('Main pas encore reçue');
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
        d.game = pack(g);
        break;
      }
      default: refuse('Action inconnue');
    }
    d.rev = (doc.rev || 0) + 1;
    d.at = Date.now();
    return { doc: d, writes };
  }

  return { initTour, initFree, apply, getGame, left, dealHands, tourHands, handPath, currentSet, nextDealIdx, Refused, names };
})();
if (typeof module !== 'undefined') module.exports = T;
