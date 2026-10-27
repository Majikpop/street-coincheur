/* ===== Moteur de coinche (sans DOM) ===== */
const E = (() => {
  const SUITS = ['S', 'H', 'D', 'C'];
  const SYM = { S: '♠', H: '♥', D: '♦', C: '♣', NT: 'SA', AT: 'TA' };
  const SUIT_NAME = { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle', NT: 'Sans atout', AT: 'Tout atout' };
  const CONTRACTS = ['S', 'H', 'D', 'C', 'NT', 'AT']; // couleurs + sans atout + tout atout
  const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_FR = { '7': '7', '8': '8', '9': '9', '10': '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
  const TRUMP_ORD = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J'];
  const PLAIN_ORD = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
  const TRUMP_PTS = { J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3, '8': 0, '7': 0 };
  const PLAIN_PTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };
  // Sans atout : l'as vaut 19 ; tout atout : chaque couleur est atout, barème réduit. Total toujours 152 + 10 de der.
  const NT_PTS = { A: 19, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };
  const AT_PTS = { J: 14, '9': 9, A: 6, '10': 5, K: 3, Q: 1, '8': 0, '7': 0 };
  const isTrumpOf = (c, t) => t === 'AT' || c.s === t; // en tout atout, toute carte est un atout de sa couleur
  const SEATS = ['S', 'E', 'N', 'O']; // ordre de jeu : sens inverse des aiguilles d'une montre
  const SEAT_NAME = { S: 'Sud', E: 'Est', N: 'Nord', O: 'Ouest' };
  const BID_VALUES = [80, 90, 100, 110, 120, 130, 140, 150, 160, 250];
  const team = s => s % 2; // 0 = Nord-Sud, 1 = Est-Ouest
  const partner = s => (s + 2) % 4;
  const next = s => (s + 1) % 4;

  // --- hasard reproductible ---
  function hashStr(str) {
    let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const id = c => c.r + c.s;
  const sameCard = (a, b) => a.r === b.r && a.s === b.s;

  function sortHand(hand, trump) {
    const order = trump && SUITS.includes(trump) ? [trump, ...SUITS.filter(s => s !== trump)] : ['S', 'H', 'C', 'D'];
    return hand.slice().sort((a, b) => {
      if (a.s !== b.s) return order.indexOf(a.s) - order.indexOf(b.s);
      const ord = isTrumpOf(a, trump) ? TRUMP_ORD : PLAIN_ORD;
      return ord.indexOf(b.r) - ord.indexOf(a.r);
    });
  }

  /** Donne n°idx d'un tournoi : identique pour toutes les tables. */
  function makeDeal(seed, idx) {
    const r = rng(hashStr(seed + '#' + idx));
    const deck = [];
    for (const s of SUITS) for (const rk of RANKS) deck.push({ s, r: rk });
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const hands = [0, 1, 2, 3].map(p => sortHand(deck.slice(p * 8, p * 8 + 8)));
    return { idx, dealer: idx % 4, hands };
  }

  const strength = (c, trump, led) => {
    if (trump === 'AT') return c.s === led ? 100 + TRUMP_ORD.indexOf(c.r) : -1;
    if (c.s === trump) return 100 + TRUMP_ORD.indexOf(c.r);
    if (c.s === led) return 10 + PLAIN_ORD.indexOf(c.r);
    return -1;
  };
  const points = (c, trump) => (trump === 'AT' ? AT_PTS[c.r] : trump === 'NT' ? NT_PTS[c.r] : c.s === trump ? TRUMP_PTS[c.r] : PLAIN_PTS[c.r]);

  function trickWinner(trick, trump) {
    const led = trick[0].card.s;
    let best = 0;
    for (let i = 1; i < trick.length; i++) if (strength(trick[i].card, trump, led) > strength(trick[best].card, trump, led)) best = i;
    return trick[best].seat;
  }

  // --- état d'une donne ---
  function newGame(deal, opts = {}) {
    const first = next(deal.dealer);
    return {
      idx: deal.idx, dealer: deal.dealer, hands: deal.hands.map(h => h.slice()), initialHands: deal.hands.map(h => h.slice()),
      phase: 'bid', turn: first, bids: [], contract: null, passes: 0, surQueue: null,
      trick: [], leader: first, tricks: [], played: [], beloteSeat: null, beloteSaid: 0, result: null, moc: !!opts.moc,
      ...(opts.belote === false ? { noBelote: true } : {}), ...(opts.strict ? { strict: true } : {}),
    };
  }

  function legalBidOptions(g, seat) {
    const o = { pass: true, values: [], coinche: false, surcoinche: false };
    if (g.phase !== 'bid' || g.turn !== seat) return o;
    if (g.surQueue) { o.surcoinche = true; return o; }
    const cur = g.contract ? g.contract.value : 0;
    o.values = BID_VALUES.filter(v => v > cur);
    if (g.contract && team(g.contract.seat) !== team(seat)) o.coinche = true;
    // MOC (« Monte ou Coinche ») : personne ne passe, dès l'entame ; seule issue : la coinche
    // (exception : capot annoncé par son partenaire, ni surenchère ni coinche possibles)
    if (g.moc && (o.values.length || o.coinche)) o.pass = false;
    return o;
  }

  // Coinche à la volée (hors MOC) : un défenseur coinche le contrat adverse à tout moment des enchères, même hors de son tour
  const canCoinche = (g, seat) => g.phase === 'bid' && !g.surQueue && !!g.contract && g.contract.coinche === 1
    && team(g.contract.seat) !== team(seat) && (g.turn === seat || !g.moc);

  function applyBid(g, seat, bid) {
    const flying = g.turn !== seat && bid.type === 'coinche' && canCoinche(g, seat);
    if (g.phase !== 'bid' || (g.turn !== seat && !flying)) throw new Error('Pas votre tour');
    const opts = flying ? { coinche: true } : legalBidOptions(g, seat);
    g.bids.push({ seat, ...bid });
    if (g.surQueue) {
      if (bid.type === 'surcoinche') { g.contract.coinche = 4; return startPlay(g); }
      g.surQueue.shift();
      if (!g.surQueue.length) return startPlay(g);
      g.turn = g.surQueue[0]; return g;
    }
    if (bid.type === 'pass') {
      if (!opts.pass) throw new Error('MOC : surenchérissez ou coinchez');
      g.passes++;
      if (!g.contract && g.passes === 4) { g.phase = 'done'; g.result = scoreDeal(g); return g; }
      if (g.contract && g.passes === 3) return startPlay(g);
    } else if (bid.type === 'bid') {
      if (!opts.values.includes(bid.value) || !CONTRACTS.includes(bid.suit)) throw new Error('Annonce invalide');
      g.contract = { value: bid.value, suit: bid.suit, seat, coinche: 1 };
      g.passes = 0;
    } else if (bid.type === 'coinche') {
      if (!opts.coinche) throw new Error('Coinche impossible');
      g.contract.coinche = 2; g.contract.coincheBy = seat;
      // l'équipe preneuse peut surcoincher, dans l'ordre de jeu
      const q = []; let s = next(seat);
      for (let k = 0; k < 3; k++, s = next(s)) if (team(s) === team(g.contract.seat)) q.push(s);
      g.surQueue = q; g.turn = q[0]; return g;
    }
    g.turn = next(seat);
    return g;
  }

  function startPlay(g) {
    g.phase = 'play'; g.surQueue = null;
    g.leader = next(g.dealer); g.turn = g.leader;
    // seules les mains connues de ce téléphone sont présentes ; la belote se déclare quand la carte est jouée
    for (let p = 0; p < 4; p++) if (g.hands[p]) g.hands[p] = sortHand(g.hands[p], g.contract.suit);
    return g;
  }

  function legalCards(g, seat) {
    const hand = g.hands[seat];
    if (g.phase !== 'play' || !g.trick.length) return hand.slice();
    const trump = g.contract.suit, led = g.trick[0].card.s;
    const follow = hand.filter(c => c.s === led);
    const partnerMaster = team(trickWinner(g.trick, trump)) === team(seat);
    if (trump === 'NT') return follow.length ? follow : hand.slice();
    if (trump === 'AT') { // fournir, et monter dans la couleur demandée, même sur son partenaire
      if (!follow.length) return hand.slice();
      const best = Math.max(...g.trick.filter(x => x.card.s === led).map(x => TRUMP_ORD.indexOf(x.card.r)));
      const up = follow.filter(c => TRUMP_ORD.indexOf(c.r) > best);
      return up.length ? up : follow;
    }
    const trumpsInTrick = g.trick.filter(x => x.card.s === trump).map(x => TRUMP_ORD.indexOf(x.card.r));
    const bestT = trumpsInTrick.length ? Math.max(...trumpsInTrick) : -1;
    const myTrumps = hand.filter(c => c.s === trump);
    const higher = myTrumps.filter(c => TRUMP_ORD.indexOf(c.r) > bestT);
    if (led === trump) {
      if (follow.length) return higher.length ? higher : follow; // atout demandé : monter si possible, même sur son partenaire
      return hand.slice();
    }
    if (follow.length) return follow;
    if (!myTrumps.length) return hand.slice();
    // partenaire maître : défausse libre, pas d'obligation de couper ni de surcouper ;
    // règle stricte (option) : s'il a coupé, on doit surcouper si on peut
    if (partnerMaster) return g.strict && bestT >= 0 && higher.length ? higher : hand.slice();
    return higher.length ? higher : myTrumps; // couper / surcouper, sinon sous-couper
  }

  function playCard(g, seat, card) {
    if (g.phase !== 'play' || g.turn !== seat) throw new Error('Pas votre tour');
    if (!legalCards(g, seat).some(c => sameCard(c, card))) throw new Error('Carte interdite');
    const t = g.contract.suit;
    if (!g.noBelote && SUITS.includes(t) && card.s === t && (card.r === 'K' || card.r === 'Q')) {
      const other = card.r === 'K' ? 'Q' : 'K';
      if (g.beloteSeat === seat) g.beloteSaid++;
      else if (g.beloteSeat === null && g.hands[seat].some(c => c.s === t && c.r === other)) { g.beloteSeat = seat; g.beloteSaid = 1; }
    }
    g.hands[seat] = g.hands[seat].filter(c => !sameCard(c, card));
    g.trick.push({ seat, card });
    g.played.push(card);
    if (g.trick.length < 4) { g.turn = next(seat); return { trickDone: false }; }
    const w = trickWinner(g.trick, t);
    g.tricks.push({ cards: g.trick, winner: w });
    g.lastTrick = g.trick; g.trick = []; g.leader = w; g.turn = w;
    if (g.tricks.length === 8) { g.phase = 'done'; g.result = scoreDeal(g); }
    return { trickDone: true, winner: w };
  }

  /**
   * Barème : contrat réussi = annonce + points faits (attaque), points faits (défense).
   * Coinché/surcoinché réussi = 160 + annonce × 2 (ou × 4) pour l'attaque, 0 pour la défense.
   * Chute = 160 + annonce × multiplicateur pour la défense. Belote (+20) toujours à son détenteur.
   * Capot = 250 points de cartes. Contrat 250 (capot annoncé) : il faut tous les plis.
   */
  function scoreDeal(g) {
    const r = { ns: 0, ew: 0, passed: false, made: null, cardPts: [0, 0], tricks: [0, 0], belote: null };
    if (!g.contract) { r.passed = true; return r; }
    const t = g.contract.suit;
    for (const tr of g.tricks) {
      const tm = team(tr.winner); r.tricks[tm]++;
      for (const x of tr.cards) r.cardPts[tm] += points(x.card, t);
    }
    r.cardPts[team(g.tricks[7].winner)] += 10; // dix de der
    for (const tm of [0, 1]) if (r.tricks[tm] === 8) { r.cardPts[tm] = 250; r.cardPts[1 - tm] = 0; }
    const att = team(g.contract.seat), def = 1 - att;
    const bel = g.beloteSeat !== null ? team(g.beloteSeat) : null;
    if (bel !== null) r.belote = bel;
    const attTotal = r.cardPts[att] + (bel === att ? 20 : 0);
    const v = g.contract.value, m = g.contract.coinche;
    r.made = v === 250 ? r.tricks[att] === 8 : attTotal >= v && attTotal >= 82;
    const s = [0, 0];
    if (r.made) {
      if (m === 1) { s[att] = v + r.cardPts[att]; s[def] = r.cardPts[def]; }
      else { s[att] = 160 + v * m; }
    } else s[def] = 160 + v * m;
    if (bel !== null) s[bel] += 20;
    r.ns = s[0]; r.ew = s[1];
    return r;
  }

  // ===== IA =====
  // Réglages de l'IA, ajustés au banc d'essai (tools/bench.js)
  // margin : gain minimal pour annoncer ; pOpp : chance supposée qu'un contrat adverse passe ;
  // coinche, sur : gain minimal pour coincher, pour surcoincher.
  const TUNE = { margin: 10, pOpp: 0.7, coinche: 0, sur: 0 };
  function evalSuit(hand, t, noBelote = false) {
    const tr = hand.filter(c => c.s === t);
    const w = { J: 25, '9': 18, A: 12, '10': 8, K: 5, Q: 5, '8': 2, '7': 2 };
    let est = tr.reduce((a, c) => a + w[c.r], 0) + 10 * tr.length;
    for (const s of SUITS) if (s !== t) {
      const sc = hand.filter(c => c.s === s);
      if (sc.some(c => c.r === 'A')) { est += 12; if (sc.some(c => c.r === '10')) est += 6; }
      if (!sc.length && tr.length >= 3) est += 6; // coupe franche
    }
    if (!noBelote && tr.some(c => c.r === 'K') && tr.some(c => c.r === 'Q')) est += 15;
    return { est, n: tr.length, J: tr.some(c => c.r === 'J'), nine: tr.some(c => c.r === '9') };
  }

  /* Modèle d'annonce calibré par simulation (npm run bench -- --calib) : points faits par le preneur avec l'IA
   * à la carte, selon sa seule main, à un écart près tiré de 20 quantiles (RESID).
   * Couleur : 38 + 0,855 × évaluation (belote comprise). Tout atout et sans atout : somme pondérée des
   * caractéristiques de handFeats (constante, puis une par caractéristique). */
  const MODEL = {
    suit: { resid: [-53, -41, -34, -29, -24, -20, -16, -12, -8, -4, -1, 3, 7, 11, 16, 21, 27, 34, 44, 64] },
    AT: { w: [58.9, 13.9, 6.3, 2.0, 0.5, 5.0, -5.5], resid: [-53, -37, -30, -24, -20, -16, -13, -9, -6, -3, 0, 3, 6, 10, 13, 18, 22, 28, 37, 54] },
    NT: { w: [50.8, 16.2, 7.5, 1.4, 1.6, -6.3, 2.0], resid: [-52, -37, -29, -24, -20, -16, -12, -10, -7, -3, 0, 3, 6, 10, 13, 17, 22, 28, 37, 55] },
  };
  /** Caractéristiques d'une main pour le tout atout (valets, 9, as, 10, valet-9 ensemble, 9 sec)
   *  ou le sans atout (as, 10, rois, as-10 ensemble, 10 sec, plus longue couleur). */
  function handFeats(h, t) {
    const has = (r, s) => h.some(c => c.r === r && c.s === s), len = s => h.filter(c => c.s === s).length;
    const cnt = r => SUITS.filter(s => has(r, s)).length, both = (a, b) => SUITS.filter(s => has(a, s) && has(b, s)).length;
    const sec = (r, guard) => SUITS.filter(s => has(r, s) && !has(guard, s) && len(s) === 1).length;
    if (t === 'AT') return [1, cnt('J'), cnt('9'), cnt('A'), cnt('10'), both('J', '9'), sec('9', 'J')];
    return [1, cnt('A'), cnt('10'), cnt('K'), both('A', '10'), sec('10', 'A'), Math.max(...SUITS.map(len))];
  }
  /** Points attendus du preneur (belote comprise à la couleur) pour un contrat t joué avec cette main. */
  function expectedPts(hand, t, noBelote) {
    if (SUITS.includes(t)) return 38 + 0.855 * evalSuit(hand, t, noBelote).est;
    return handFeats(hand, t).reduce((a, x, i) => a + x * MODEL[t].w[i], 0);
  }
  /** Écart moyen attendu (preneur − défense) pour un contrat v à t, avec mu points attendus, coinche m. */
  function contractEV(mu, v, t = 'S', m = 1) {
    const resid = (MODEL[t] || MODEL.suit).resid;
    let ev = 0;
    for (const r of resid) {
      const T = Math.max(0, Math.min(SUITS.includes(t) ? 182 : 162, mu + r));
      ev += T >= v && T >= 82 ? (m === 1 ? v + 2 * T - 162 : 160 + v * m) : -(160 + v * m);
    }
    return ev / resid.length;
  }

  /* Coinche : probabilité que le contrat adverse chute, vue de la main du défenseur (régression logistique
   * calibrée par simulation) ; on coinche quand le gain espéré (+v si chute) dépasse la perte (≈ 272 − v si réussi). */
  function defenseScore(hand, t) {
    const tr = hand.filter(c => c.s === t), has = (r, s) => hand.some(c => c.r === r && c.s === s);
    return (has('J', t) ? 20 : 0) + (has('9', t) ? 14 : 0) + (has('A', t) ? 8 : 0) + 6 * tr.length
      + SUITS.filter(s => s !== t).reduce((a, s) => a + (has('A', s) ? 10 : 0) + (has('10', s) ? 4 : 0), 0);
  }
  const pFail = (hand, c) => 1 / (1 + Math.exp(2.2 - 0.0477 * defenseScore(hand, c.suit) - 0.0218 * (c.value - 100)));
  const coincheEV = (hand, c) => { const p = pFail(hand, c); return p * c.value - (1 - p) * (272 - c.value); };

  function botBid(g, seat) {
    const d = botBidNormal(g, seat), opts = legalBidOptions(g, seat);
    if (d.type !== 'pass' || opts.pass) return d;
    // MOC : monter d'un cran (toujours face à son partenaire) ou coincher, selon ce qui coûte le moins
    const cur = g.contract, v = opts.values[0], hand = g.hands[seat];
    const ranked = CONTRACTS.map(s => ({ s, mu: expectedPts(hand, s, g.noBelote) })).sort((a, b) => b.mu - a.mu)[0];
    const withPartner = cur && cur.seat === partner(seat);
    if (v !== undefined && (!opts.coinche || withPartner)) return { type: 'bid', value: v, suit: withPartner ? cur.suit : ranked.s };
    if (v === undefined) return { type: 'coinche' };
    const bidEV = contractEV(ranked.mu, v, ranked.s);
    const p = SUITS.includes(cur.suit) ? pFail(hand, cur) : 0.3, coEV = (2 * p - 1) * (160 + 2 * cur.value);
    return bidEV > coEV ? { type: 'bid', value: v, suit: ranked.s } : { type: 'coinche' };
  }

  function botBidNormal(g, seat) {
    const opts = legalBidOptions(g, seat);
    const hand = g.hands[seat], cur = g.contract;
    if (g.surQueue) { // surcoincher si la main tient encore malgré la coinche (qui annonce du jeu en face)
      if (cur.seat !== seat || !SUITS.includes(cur.suit)) return { type: 'pass' };
      const mu = expectedPts(hand, cur.suit, g.noBelote) - 13;
      return contractEV(mu, cur.value, cur.suit, 4) > contractEV(mu, cur.value, cur.suit, 2) + TUNE.sur ? { type: 'surcoinche' } : { type: 'pass' };
    }
    const myPrev = g.bids.filter(b => b.seat === seat && b.type === 'bid').length;
    // soutien du partenaire
    if (cur && cur.seat === partner(seat) && !myPrev && SUITS.includes(cur.suit)) {
      const e = evalSuit(hand, cur.suit);
      let sup = 0;
      for (const s of SUITS) if (s !== cur.suit && hand.some(c => c.s === s && c.r === 'A')) sup += 10;
      if (e.J || e.nine) sup += 10;
      const v = Math.min(160, cur.value + sup);
      if (sup >= 10 && opts.values.includes(v)) return { type: 'bid', value: v, suit: cur.suit };
      return { type: 'pass' };
    }
    if (cur && cur.seat === partner(seat)) return { type: 'pass' };
    // coinche défensive
    if (opts.coinche && SUITS.includes(cur.suit) && coincheEV(hand, cur) > TUNE.coinche) return { type: 'coinche' };
    // Annonce (couleur, tout atout ou sans atout) : la plus rentable d'après le modèle, si elle vaut mieux que passer
    // (0 sans contrat ; face à un contrat adverse, ce que rapporte en moyenne de le laisser jouer).
    const alt = cur ? -(TUNE.pOpp * (cur.value + 40) - (1 - TUNE.pOpp) * (160 + cur.value)) : 0;
    let best = null;
    for (const t of CONTRACTS) {
      if (SUITS.includes(t)) { const e = evalSuit(hand, t); if (e.n < 2 || !(e.J || e.nine)) continue; }
      const mu = expectedPts(hand, t, g.noBelote);
      for (const v of opts.values) {
        if (v > 160) break;
        const ev = contractEV(mu, v, t);
        if (ev > alt + TUNE.margin && (!best || ev > best.ev)) best = { value: v, suit: t, ev };
      }
    }
    if (best) delete best.ev;
    if (best && opts.values.includes(best.value) && myPrev < 2) return { type: 'bid', ...best };
    return { type: 'pass' };
  }

  const DECK = SUITS.flatMap(s => RANKS.map(r => Object.freeze({ s, r })));
  const bit = c => 1 << (SUITS.indexOf(c.s) * 8 + RANKS.indexOf(c.r));
  /** Cartes que seat n'a pas vues (ni jouées, ni en main), en masque de bits : appelée à chaque coup simulé. */
  function unseen(g, seat) {
    let known = 0;
    for (const c of g.played) known |= bit(c);
    for (const c of g.hands[seat]) known |= bit(c);
    return DECK.filter((c, i) => !(known & (1 << i)));
  }

  /** Couleurs qu'un joueur n'a plus, déduites des plis : il n'a pas fourni ; à la couleur, s'il s'est défaussé
   *  alors que l'adversaire était maître, il n'a plus d'atout non plus (sinon il aurait dû couper). */
  function voids(g) {
    const t = g.contract.suit, v = [0, 1, 2, 3].map(() => new Set());
    for (const cards of [...g.tricks.map(x => x.cards), g.trick]) {
      if (!cards.length) continue;
      const led = cards[0].card.s;
      cards.forEach((x, i) => {
        if (i === 0 || x.card.s === led) return;
        v[x.seat].add(led);
        if (SUITS.includes(t) && x.card.s !== t && team(trickWinner(cards.slice(0, i), t)) !== team(x.seat)) v[x.seat].add(t);
      });
    }
    return v;
  }

  /** Carte maîtresse : aucune plus forte dehors, et (à la couleur) aucun adversaire encore à jouer ne peut la couper. */
  function isMaster(g, seat, card, rest = [], out = unseen(g, seat)) {
    const t = g.contract.suit;
    const ord = isTrumpOf(card, t) ? TRUMP_ORD : PLAIN_ORD;
    if (out.some(c => c.s === card.s && ord.indexOf(c.r) > ord.indexOf(card.r))) return false;
    if (SUITS.includes(t) && card.s !== t && rest.length && out.some(c => c.s === t)) {
      const v = voids(g);
      if (rest.some(s => team(s) !== team(seat) && v[s].has(card.s) && !v[s].has(t))) return false;
    }
    return true;
  }

  /** Jeu de la carte par règles simples : sert aux simulations de botPlay. */
  function playHeuristic(g, seat) {
    const legal = legalCards(g, seat);
    if (legal.length === 1) return legal[0];
    const t = g.contract.suit;
    const attacker = team(seat) === team(g.contract.seat);
    const pts = c => points(c, t);
    const byLow = arr => arr.slice().sort((a, b) => pts(a) - pts(b) || strength(a, t, a.s) - strength(b, t, b.s));
    const myTrumps = legal.filter(c => c.s === t);
    const out = unseen(g, seat), outTrumps = out.filter(c => c.s === t).length;
    const rest = []; // joueurs encore à jouer après moi dans ce pli
    for (let s = next(seat), k = g.trick.length + 1; k < 4; k++, s = next(s)) rest.push(s);
    const master = c => isMaster(g, seat, c, rest, out);

    if (!g.trick.length) {
      if (attacker && myTrumps.length && outTrumps > 0) {
        const topT = myTrumps.find(master);
        if (topT) return topT;
        if (seat === g.contract.seat && myTrumps.length >= 3) return byLow(myTrumps)[0];
      }
      const aces = legal.filter(c => c.s !== t && master(c));
      if (aces.length) return aces.sort((a, b) => pts(b) - pts(a))[0];
      const plain = legal.filter(c => c.s !== t);
      return byLow(plain.length ? plain : legal)[0];
    }

    const led = g.trick[0].card.s;
    const winSeat = trickWinner(g.trick, t);
    const winCard = g.trick.find(x => x.seat === winSeat).card;
    const last = g.trick.length === 3;
    if (team(winSeat) === team(seat)) {
      const safe = last || master(winCard);
      if (safe) {
        const plain = legal.filter(c => c.s !== t || !isMaster(g, seat, c, [], out));
        const pool = plain.length ? plain : legal;
        return pool.slice().sort((a, b) => pts(b) - pts(a))[0];
      }
      const nonT = legal.filter(c => c.s !== t);
      return byLow(nonT.length ? nonT : legal)[0];
    }
    const beats = legal.filter(c => strength(c, t, led) > strength(winCard, t, led));
    if (beats.length) {
      const sorted = beats.slice().sort((a, b) => strength(a, t, led) - strength(b, t, led));
      if (last) return sorted[0];
      const top = sorted.find(master);
      const trickPts = g.trick.reduce((a, x) => a + pts(x.card), 0);
      if (top && (top.s !== t || trickPts >= 10)) return top;
      if (sorted[0].s === t && trickPts >= 10) return sorted[0];
    }
    const nonT = legal.filter(c => c.s !== t);
    return byLow(nonT.length ? nonT : legal)[0];
  }

  /* Jeu de la carte par simulation : l'IA ne connaît que sa main et les cartes jouées. Elle tire MC_WORLDS
   * répartitions des cartes cachées compatibles avec ce qu'elle a vu (tailles des mains, couleurs manquantes),
   * joue la fin de donne avec les règles simples pour chaque carte possible, et garde la meilleure en moyenne.
   * Tirages reproductibles (graine tirée de la position) : une même donne donne le même jeu, en duplicate.
   * Garde-fou MC_BUDGET_MS : sur un appareil très lent, on s'arrête plus tôt (au moins MC_MIN mondes) ;
   * un coup prend ~50 ms au pire sur ordinateur, la limite ne joue donc que sur des téléphones très lents. */
  const MC_WORLDS = 20, MC_MIN = 4, MC_BUDGET_MS = 1500;
  function dealWorld(g, seat, r, v) {
    const pool = unseen(g, seat), need = [0, 0, 0, 0], playedBy = [0, 0, 0, 0]; // cartes restantes : 8 moins celles posées
    for (const tr of g.tricks) for (const x of tr.cards) playedBy[x.seat]++;
    for (const x of g.trick) playedBy[x.seat]++;
    for (let s = 0; s < 4; s++) need[s] = s === seat ? 0 : 8 - playedBy[s];
    for (let tries = 0; tries < 20; tries++) {
      const left = need.slice(), hands = [[], [], [], []];
      const cards = pool.map(c => ({ c, ok: [0, 1, 2, 3].filter(s => s !== seat && !(tries < 15 && v[s].has(c.s))), k: r() }))
        .sort((a, b) => a.ok.length - b.ok.length || a.k - b.k);
      let fail = false;
      for (const { c, ok } of cards) {
        const cand = ok.filter(s => left[s] > 0);
        if (!cand.length) { fail = true; break; }
        const s = cand[Math.floor(r() * cand.length)];
        hands[s].push(c); left[s]--;
      }
      if (!fail) { hands[seat] = g.hands[seat].slice(); return hands; }
    }
    return null;
  }
  function rollout(g, seat, card, hands) {
    const w = { ...g, hands: hands.map(h => h.slice()), trick: g.trick.slice(), tricks: g.tricks.slice(), played: g.played.slice(), result: null };
    playCard(w, seat, card);
    while (w.phase === 'play') playCard(w, w.turn, playHeuristic(w, w.turn));
    return (team(seat) === 0 ? 1 : -1) * (w.result.ns - w.result.ew);
  }
  function botPlay(g, seat) {
    const legal = legalCards(g, seat);
    if (legal.length === 1 || g.tricks.length >= 7) return legal.length === 1 ? legal[0] : playHeuristic(g, seat);
    const r = rng(hashStr(g.idx + ':' + seat + ':' + g.played.map(id).join('')));
    const v = voids(g), sum = legal.map(() => 0);
    let n = 0;
    const end = Date.now() + MC_BUDGET_MS;
    for (let k = 0; k < MC_WORLDS && (n < MC_MIN || Date.now() < end); k++) {
      const hands = dealWorld(g, seat, r, v);
      if (!hands) continue;
      legal.forEach((c, i) => { sum[i] += rollout(g, seat, c, hands); });
      n++;
    }
    if (!n) return playHeuristic(g, seat);
    const h = playHeuristic(g, seat);
    let best = legal.findIndex(c => sameCard(c, h)); // à égalité, la carte des règles simples
    legal.forEach((c, i) => { if (sum[i] > sum[best] + 1e-9) best = i; });
    return legal[best];
  }

  // ===== Duplicate =====
  /** Tour r : la table t joue la série (t + r) mod nb de tables. */
  const setForTable = (tables, table, round) => (table + round) % tables;
  const dealsOfSet = (perSet, set) => Array.from({ length: perSet }, (_, i) => set * perSet + i);

  /** Points de match : pour chaque donne, la ligne NS de chaque table est comparée aux autres (2 / 1 / 0). */
  function matchpoints(results) {
    const byDeal = {};
    for (const r of results) (byDeal[r.deal] = byDeal[r.deal] || []).push(r);
    const out = {}; // deal -> table -> {nsPct, ewPct, diff}
    for (const [deal, rs] of Object.entries(byDeal)) {
      out[deal] = {};
      const avg = rs.reduce((a, r) => a + (r.ns - r.ew), 0) / rs.length;
      for (const r of rs) {
        const net = r.ns - r.ew;
        let mp = 0; const n = rs.length - 1;
        for (const o of rs) if (o !== r) { const on = o.ns - o.ew; mp += net > on ? 2 : net === on ? 1 : 0; }
        const nsPct = n ? (mp / (2 * n)) * 100 : null;
        out[deal][r.table] = { nsPct, ewPct: nsPct === null ? null : 100 - nsPct, diff: net - avg, n };
      }
    }
    return out;
  }

  function standings(results, tables) {
    const mp = matchpoints(results);
    const lines = [];
    for (let t = 0; t < tables; t++) for (const side of ['NS', 'EO']) {
      let sum = 0, cnt = 0, played = 0, names = '';
      for (const r of results) if (r.table === t) {
        played++;
        names = side === 'NS' ? r.names?.ns || names : r.names?.ew || names;
        const m = mp[r.deal][t];
        if (m.nsPct !== null) { sum += side === 'NS' ? m.nsPct : m.ewPct; cnt++; }
      }
      lines.push({ table: t, side, pct: cnt ? sum / cnt : null, compared: cnt, played, names });
    }
    return lines;
  }

  return {
    SUITS, CONTRACTS, SYM, SUIT_NAME, RANK_FR, SEATS, SEAT_NAME, BID_VALUES, team, partner, next,
    hashStr, makeDeal, newGame, legalBidOptions, canCoinche, applyBid, legalCards, playCard, trickWinner, points, sortHand, sameCard,
    scoreDeal, evalSuit, handFeats, expectedPts, TUNE, botBid, botPlay, playHeuristic, setForTable, dealsOfSet, matchpoints, standings,
  };
})();
if (typeof module !== 'undefined') module.exports = E;
