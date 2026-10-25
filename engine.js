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

  function applyBid(g, seat, bid) {
    if (g.phase !== 'bid' || g.turn !== seat) throw new Error('Pas votre tour');
    const opts = legalBidOptions(g, seat);
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
    if (trump === 'AT') { // fournir, et monter dans la couleur demandée sauf si le partenaire est maître
      if (!follow.length) return hand.slice();
      const best = Math.max(...g.trick.filter(x => x.card.s === led).map(x => TRUMP_ORD.indexOf(x.card.r)));
      const up = follow.filter(c => TRUMP_ORD.indexOf(c.r) > best);
      return up.length && !partnerMaster ? up : follow;
    }
    const trumpsInTrick = g.trick.filter(x => x.card.s === trump).map(x => TRUMP_ORD.indexOf(x.card.r));
    const bestT = trumpsInTrick.length ? Math.max(...trumpsInTrick) : -1;
    const myTrumps = hand.filter(c => c.s === trump);
    const higher = myTrumps.filter(c => TRUMP_ORD.indexOf(c.r) > bestT);
    if (led === trump) {
      if (follow.length) return higher.length && !partnerMaster ? higher : follow; // partenaire maître : pas obligé de monter
      return hand.slice();
    }
    if (follow.length) return follow;
    if (!myTrumps.length) return hand.slice();
    if (partnerMaster) return hand.slice(); // partenaire maître : défausse libre, pas d'obligation de couper ni de surcouper
    return higher.length ? higher : myTrumps; // couper / surcouper, sinon sous-couper
  }

  function playCard(g, seat, card) {
    if (g.phase !== 'play' || g.turn !== seat) throw new Error('Pas votre tour');
    if (!legalCards(g, seat).some(c => sameCard(c, card))) throw new Error('Carte interdite');
    const t = g.contract.suit;
    if (SUITS.includes(t) && card.s === t && (card.r === 'K' || card.r === 'Q')) {
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
  function evalSuit(hand, t) {
    const tr = hand.filter(c => c.s === t);
    const w = { J: 25, '9': 18, A: 12, '10': 8, K: 5, Q: 5, '8': 2, '7': 2 };
    let est = tr.reduce((a, c) => a + w[c.r], 0) + 10 * tr.length;
    for (const s of SUITS) if (s !== t) {
      const sc = hand.filter(c => c.s === s);
      if (sc.some(c => c.r === 'A')) { est += 12; if (sc.some(c => c.r === '10')) est += 6; }
      if (!sc.length && tr.length >= 3) est += 6; // coupe franche
    }
    if (tr.some(c => c.r === 'K') && tr.some(c => c.r === 'Q')) est += 15;
    return { est, n: tr.length, J: tr.some(c => c.r === 'J'), nine: tr.some(c => c.r === '9') };
  }

  function botBid(g, seat) {
    const d = botBidNormal(g, seat), opts = legalBidOptions(g, seat);
    if (d.type !== 'pass' || opts.pass) return d;
    // MOC : monter d'un cran si la main tient (toujours face à son partenaire), sinon coincher
    const cur = g.contract, v = opts.values[0], hand = g.hands[seat];
    const ranked = SUITS.map(s => ({ s, e: evalSuit(hand, s) })).sort((a, b) => b.e.est - a.e.est)[0];
    const withPartner = cur && cur.seat === partner(seat);
    if (v !== undefined && (!opts.coinche || withPartner || (v <= 130 && ranked.e.est >= 70 + (v - 80)))) {
      return { type: 'bid', value: v, suit: withPartner ? cur.suit : ranked.s };
    }
    return opts.coinche ? { type: 'coinche' } : { type: 'bid', value: v, suit: ranked.s };
  }

  function botBidNormal(g, seat) {
    const opts = legalBidOptions(g, seat);
    if (g.surQueue) return { type: 'pass' };
    const hand = g.hands[seat], cur = g.contract;
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
    if (opts.coinche && cur.value >= 100 && SUITS.includes(cur.suit)) {
      const e = evalSuit(hand, cur.suit);
      const aces = SUITS.filter(s => s !== cur.suit && hand.some(c => c.s === s && c.r === 'A')).length;
      if (e.n >= 3 && (e.J || e.nine) && aces >= 1) return { type: 'coinche' };
    }
    let best = null;
    for (const s of SUITS) {
      const e = evalSuit(hand, s);
      if (e.n < 3 && !(e.n === 2 && e.J && e.nine)) continue;
      if (!e.J && !(e.nine && e.n >= 3)) continue;
      if (e.est < 88) continue;
      const v = Math.min(160, 80 + Math.floor((e.est - 88) / 11) * 10);
      if (!best || v > best.value) best = { value: v, suit: s };
    }
    // Tout atout : beaucoup de valets et de 9 ; sans atout : as et 10 secs dans plusieurs couleurs
    const has = (r, s) => hand.some(c => c.r === r && c.s === s);
    const J = SUITS.filter(s => has('J', s)).length, N = SUITS.filter(s => has('9', s)).length;
    const A = SUITS.filter(s => has('A', s)).length, A10 = SUITS.filter(s => has('A', s) && has('10', s)).length;
    if ((J >= 3 && N >= 2) || J === 4) { const v = Math.min(140, 80 + (J + N - 5) * 10); if (!best || v > best.value) best = { value: Math.max(80, v), suit: 'AT' }; }
    if (A >= 3 && A10 >= 2) { const v = Math.min(140, 80 + (A + A10 - 4) * 10); if (!best || v > best.value) best = { value: Math.max(80, v), suit: 'NT' }; }
    if (best && opts.values.includes(best.value) && myPrev < 2) return { type: 'bid', ...best };
    return { type: 'pass' };
  }

  function unseen(g, seat) {
    const known = new Set([...g.played, ...g.hands[seat]].map(id));
    const all = [];
    for (const s of SUITS) for (const r of RANKS) if (!known.has(r + s)) all.push({ s, r });
    return all;
  }

  function isMaster(g, seat, card) {
    const t = g.contract.suit;
    const out = unseen(g, seat).filter(c => c.s === card.s);
    const ord = isTrumpOf(card, t) ? TRUMP_ORD : PLAIN_ORD;
    if (out.some(c => ord.indexOf(c.r) > ord.indexOf(card.r))) return false;
    if (card.s !== t) {
      // une coupe adverse reste possible si des atouts traînent
      return true;
    }
    return true;
  }

  function botPlay(g, seat) {
    const legal = legalCards(g, seat);
    if (legal.length === 1) return legal[0];
    const t = g.contract.suit;
    const attacker = team(seat) === team(g.contract.seat);
    const pts = c => points(c, t);
    const byLow = arr => arr.slice().sort((a, b) => pts(a) - pts(b) || strength(a, t, a.s) - strength(b, t, b.s));
    const myTrumps = legal.filter(c => c.s === t);
    const outTrumps = unseen(g, seat).filter(c => c.s === t).length;

    if (!g.trick.length) {
      if (attacker && myTrumps.length && outTrumps > 0) {
        const master = myTrumps.find(c => isMaster(g, seat, c));
        if (master) return master;
        if (seat === g.contract.seat && myTrumps.length >= 3) return byLow(myTrumps)[0];
      }
      const aces = legal.filter(c => c.s !== t && isMaster(g, seat, c));
      if (aces.length) return aces.sort((a, b) => pts(b) - pts(a))[0];
      const plain = legal.filter(c => c.s !== t);
      return byLow(plain.length ? plain : legal)[0];
    }

    const led = g.trick[0].card.s;
    const winSeat = trickWinner(g.trick, t);
    const winCard = g.trick.find(x => x.seat === winSeat).card;
    const last = g.trick.length === 3;
    if (team(winSeat) === team(seat)) {
      const safe = last || isMaster(g, seat, winCard);
      if (safe) {
        const plain = legal.filter(c => c.s !== t || !isMaster(g, seat, c));
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
      const master = sorted.find(c => isMaster(g, seat, c));
      const trickPts = g.trick.reduce((a, x) => a + pts(x.card), 0);
      if (master && (master.s !== t || trickPts >= 10)) return master;
      if (sorted[0].s === t && trickPts >= 10) return sorted[0];
    }
    const nonT = legal.filter(c => c.s !== t);
    return byLow(nonT.length ? nonT : legal)[0];
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

  /**
   * Bilan joueur par joueur. En duplicate, le Sud de chaque table a reçu exactement les mêmes cartes :
   * chaque joueur est comparé aux joueurs assis à la même place sur les autres tables (ses « pairs »).
   * Les enchères détaillées (r.bids) n'existent que pour les résultats enregistrés depuis le bilan ; sans elles,
   * seuls contrats, coinches et belotes sont comptés.
   */
  function playerStats(results, tables, mp = matchpoints(results)) {
    const nameOf = (r, s) => (r.seats && r.seats[s]) || ((s % 2 ? r.names?.ew : r.names?.ns) || '').split(' & ')[s < 2 ? 0 : 1] || SEAT_NAME[SEATS[s]];
    const byDeal = {};
    for (const r of results) (byDeal[r.deal] = byDeal[r.deal] || []).push(r);
    const players = [];
    for (let t = 0; t < tables; t++) for (let s = 0; s < 4; s++) {
      const p = { table: t, seat: s, side: s % 2 ? 'EO' : 'NS', name: SEAT_NAME[SEATS[s]], played: 0, withBids: 0,
        bidDeals: 0, bids: 0, bidSum: 0, maxBid: 0, opened: 0, suits: {}, declarer: 0, made: 0, failed: 0, declPctSum: 0, declPctN: 0,
        coinches: 0, coincheWon: 0, surcoinches: 0, belotes: 0, capots: 0, alone: 0, missed: 0, higher: 0, duels: 0 };
      for (const r of results) if (r.table === t) {
        p.played++; p.name = nameOf(r, s);
        const tm = s % 2, c = r.contract;
        if (r.bids) {
          p.withBids++;
          const mine = r.bids.filter(b => b.seat === s && b.type === 'bid');
          if (mine.length) p.bidDeals++;
          for (const b of mine) { p.bids++; p.bidSum += b.value; p.maxBid = Math.max(p.maxBid, b.value); p.suits[b.suit] = (p.suits[b.suit] || 0) + 1; }
          const first = r.bids.find(b => b.type === 'bid');
          if (first && first.seat === s) p.opened++;
          if (r.bids.some(b => b.seat === s && b.type === 'surcoinche')) p.surcoinches++;
        }
        const coinchedBy = r.coincheBy ?? (r.bids ? (r.bids.find(b => b.type === 'coinche') || {}).seat : undefined);
        if (c && c.coinche >= 2 && coinchedBy === s) { p.coinches++; if (!r.made) p.coincheWon++; }
        if (r.beloteSeat === s) p.belotes++;
        if (c && c.seat === s) {
          p.declarer++; if (r.made) p.made++; else p.failed++;
          if (r.cardPts && r.cardPts[tm] === 250) p.capots++;
          const m = mp[r.deal][t], pct = tm ? m.ewPct : m.nsPct;
          if (pct !== null) { p.declPctSum += pct; p.declPctN++; }
        }
        // mêmes cartes, autres tables : a-t-il pris quand les autres passaient, ou l'inverse ?
        const peers = byDeal[r.deal].filter(o => o.table !== t);
        if (peers.length) {
          p.duels++;
          const peerTook = peers.filter(o => o.contract && o.contract.seat === s);
          if (c && c.seat === s && !peerTook.length) p.alone++;
          if (!(c && c.seat === s) && peerTook.length * 2 > peers.length) p.missed++;
          if (c && c.seat === s && peerTook.length && c.value > Math.max(...peerTook.map(o => o.contract.value))) p.higher++;
        }
      }
      p.bidRate = p.withBids ? p.bidDeals / p.withBids : null;
      p.avgBid = p.bids ? p.bidSum / p.bids : null;
      p.declRate = p.played ? p.declarer / p.played : null;
      p.successRate = p.declarer ? p.made / p.declarer : null;
      p.declPct = p.declPctN ? p.declPctSum / p.declPctN : null;
      p.coincheRate = p.played ? p.coinches / p.played : null;
      const fav = Object.entries(p.suits).sort((a, b) => b[1] - a[1])[0];
      p.favSuit = fav ? fav[0] : null;
      players.push(p);
    }
    const avg = (xs, k) => { const v = xs.map(x => x[k]).filter(x => x !== null && x !== undefined); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    for (const p of players) {
      const peers = players.filter(o => o.seat === p.seat && o.table !== p.table && o.played);
      p.peers = peers.length;
      p.vs = {};
      for (const k of ['bidRate', 'avgBid', 'declRate', 'successRate', 'declPct', 'coincheRate', 'opened', 'declarer', 'coinches', 'belotes']) p.vs[k] = avg(peers, k);
      p.styles = playerStyles(p);
    }
    return players;
  }

  /** Traits de jeu d'un joueur, du plus marquant au plus discret (au moins un). */
  function playerStyles(p) {
    const out = [], vs = p.vs, gt = (a, b, d) => a !== null && b !== null && a - b > d;
    if (p.coinches >= 2 && (vs.coinches === null || p.coinches >= vs.coinches * 1.5)) out.push('coincheur');
    if (p.declarer >= 3 && p.successRate === 1) out.push('sniper');
    const bold = gt(p.bidRate, vs.bidRate, 0.12) || (p.bids >= 3 && gt(p.avgBid, vs.avgBid, 10)) || (p.alone >= 2 && p.alone > p.missed);
    const shy = gt(vs.bidRate, p.bidRate, 0.12) || (p.missed >= 2 && p.missed > p.alone);
    if (bold && !shy) out.push('fonceur');
    if (p.failed >= 2 && p.successRate !== null && p.successRate < 0.6) out.push('kamikaze');
    if (shy && !bold) out.push('prudent');
    if (p.capots) out.push('capot');
    if (p.declarer === 0 && p.played) out.push('partenaire');
    if (p.belotes >= 2) out.push('belote');
    if (!out.length) out.push('equilibre');
    return out;
  }

  /**
   * Bilan de fin de tournoi. Une paire = une ligne (table, NS ou EO) : elle reste à sa table, les séries tournent.
   * Pour chaque paire : classement, victoires à la table (score brut), contrats pris et défendus, coinches, capots,
   * écart cumulé à la moyenne des autres tables, meilleure et pire donne, pourcentage par tour.
   * Pour le tournoi : totaux, contrats par couleur, donnes les plus disputées, distinctions.
   */
  function tourStats(results, tables, perSet) {
    const mp = matchpoints(results), st = standings(results, tables);
    const pairs = st.map(l => ({
      table: l.table, side: l.side, names: l.names, pct: l.pct, played: l.played, compared: l.compared, rank: null,
      won: 0, lost: 0, tied: 0, points: 0, net: 0, tops: 0, zeros: 0,
      taken: 0, made: 0, failed: 0, defended: 0, sets: 0, coinched: 0, coincheWon: 0, coinchedAgainst: 0, capots: 0, belotes: 0,
      best: null, worst: null, byRound: Array.from({ length: tables }, () => ({ sum: 0, n: 0, pct: null })),
    }));
    const pairOf = (t, tm) => pairs[t * 2 + tm];
    for (const side of ['NS', 'EO']) {
      const ranked = pairs.filter(p => p.side === side && p.pct !== null).sort((a, b) => b.pct - a.pct);
      ranked.forEach((p, i) => { p.rank = i && ranked[i - 1].pct === p.pct ? ranked[i - 1].rank : i + 1; });
    }
    const field = { deals: new Set(results.map(r => r.deal)).size, expectedDeals: tables * perSet, expected: tables * tables * perSet, results: results.length,
      contracts: 0, made: 0, passed: 0, coinches: 0, surcoinches: 0, capots: 0, bySuit: {} };
    for (const s of CONTRACTS) field.bySuit[s] = { n: 0, made: 0 };
    for (const r of results) {
      const m = mp[r.deal][r.table];
      const round = (Math.floor(r.deal / perSet) - r.table + tables) % tables;
      for (const tm of [0, 1]) {
        const p = pairOf(r.table, tm), mine = tm ? r.ew : r.ns, theirs = tm ? r.ns : r.ew;
        p.points += mine;
        if (mine > theirs) p.won++; else if (mine < theirs) p.lost++; else p.tied++;
        const pct = tm ? m.ewPct : m.nsPct;
        p.net += tm ? -m.diff : m.diff;
        if (pct !== null) {
          if (pct === 100) p.tops++; if (pct === 0) p.zeros++;
          const cell = p.byRound[round]; cell.sum += pct; cell.n++;
          const line = { deal: r.deal, pct, diff: tm ? -m.diff : m.diff, contract: r.contract, made: r.made };
          if (!p.best || line.diff > p.best.diff) p.best = line;
          if (!p.worst || line.diff < p.worst.diff) p.worst = line;
        }
        if (r.cardPts && r.cardPts[tm] === 250) p.capots++;
        if (r.belote === tm || (r.beloteSeat != null && team(r.beloteSeat) === tm)) p.belotes++;
      }
      if (!r.contract) { field.passed++; continue; }
      const att = team(r.contract.seat), A = pairOf(r.table, att), D = pairOf(r.table, 1 - att), k = r.contract.coinche || 1;
      field.contracts++; field.bySuit[r.contract.suit].n++;
      if (r.made) { field.made++; field.bySuit[r.contract.suit].made++; }
      if (k >= 2) field.coinches++; if (k === 4) field.surcoinches++;
      if (r.cardPts && r.cardPts.includes(250)) field.capots++;
      A.taken++; D.defended++;
      if (r.made) A.made++; else { A.failed++; D.sets++; }
      if (k >= 2) { D.coinched++; A.coinchedAgainst++; if (!r.made) D.coincheWon++; }
    }
    for (const p of pairs) for (const c of p.byRound) c.pct = c.n ? c.sum / c.n : null;

    // donnes les plus disputées : plus grand écart entre la meilleure et la pire table (côté NS)
    const swings = Object.entries(mp).map(([deal, byT]) => {
      const rs = results.filter(r => r.deal === +deal).sort((a, b) => (b.ns - b.ew) - (a.ns - a.ew));
      return { deal: +deal, spread: rs.length > 1 ? (rs[0].ns - rs[0].ew) - (rs[rs.length - 1].ns - rs[rs.length - 1].ew) : 0, lines: rs };
    }).filter(s => s.lines.length > 1).sort((a, b) => b.spread - a.spread || a.deal - b.deal);

    // distinctions : la paire en tête sur un critère, départagée par le classement puis la table
    const pick = (score, min = 1) => {
      const c = pairs.filter(p => score(p) >= min).sort((a, b) => score(b) - score(a) || (b.pct ?? -1) - (a.pct ?? -1) || a.table - b.table);
      return c[0] || null;
    };
    const rate = p => (p.taken >= 3 ? p.made / p.taken : -1);
    const awards = [];
    const add = (key, title, p, value, detail) => { if (p) awards.push({ key, title, table: p.table, side: p.side, names: p.names, value, detail }); };
    let p = pick(rate, 0); add('preneur', 'Meilleur preneur', p, p && rate(p), p && `${p.made}/${p.taken} contrats réussis`);
    p = pick(x => x.sets); add('defense', 'Défense de fer', p, p && p.sets, p && `${p.sets} contrat${p.sets > 1 ? 's' : ''} adverse${p.sets > 1 ? 's' : ''} mis dedans`);
    p = pick(x => x.coincheWon); add('coinche', "Coincheur d'or", p, p && p.coincheWon, p && `${p.coincheWon} coinche${p.coincheWon > 1 ? 's' : ''} gagnante${p.coincheWon > 1 ? 's' : ''} sur ${p.coinched}`);
    p = pick(x => x.capots); add('capot', 'Roi du capot', p, p && p.capots, p && `${p.capots} capot${p.capots > 1 ? 's' : ''}`);
    p = pick(x => (x.best ? x.best.diff : -Infinity), -Infinity);
    add('coup', 'Plus beau coup', p && p.best ? p : null, p && p.best && p.best.diff, p && p.best && `donne ${p.best.deal + 1} : ${Math.round(p.best.diff)} points de mieux que la moyenne`);
    p = pick(x => (x.compared ? -x.zeros : -Infinity), -Infinity);
    add('regulier', 'Pas un zéro', p && !p.zeros ? p : null, 0, 'aucune donne au plus bas');

    return { pairs, field, swings, awards, players: playerStats(results, tables, mp), complete: field.results >= field.expected };
  }

  return {
    SUITS, CONTRACTS, SYM, SUIT_NAME, RANK_FR, SEATS, SEAT_NAME, BID_VALUES, team, partner, next,
    hashStr, makeDeal, newGame, legalBidOptions, applyBid, legalCards, playCard, trickWinner, points, sortHand, sameCard,
    scoreDeal, botBid, botPlay, setForTable, dealsOfSet, matchpoints, standings, tourStats, playerStats,
  };
})();
if (typeof module !== 'undefined') module.exports = E;
