/* ===== Profils joueurs : fiches de donne, stats, classements de tournoi, hall of fame (pur, sans réseau) =====
 * Un profil est un document players/<pid>. Chaque donne jouée par un siège qui porte ce profil laisse une fiche
 * players/<pid>/deals/<clé>, écrite dans la transaction de fin de donne (clé déterministe : rejouer l'écriture ne double rien).
 * Les stats se recalculent à partir des fiches ; le résumé (players/<pid>.summary) sert au hall of fame.
 */
const P = (E => {
  const KEY_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  /** Code secret de récupération du profil, à noter : XXXX-XXXX. */
  const newKey = (rand = Math.random) => Array.from({ length: 8 }, (_, i) => (i === 4 ? '-' : '') + KEY_ABC[Math.floor(rand() * KEY_ABC.length)]).join('');
  const normKey = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');

  /** Fiches de donne d'une donne terminée, une par siège portant un profil. d = table après la donne (scores à jour). */
  function dealRecords(d, g) {
    const r = g.result, out = [];
    const where = d.kind === 'tour' ? `tour-${d.tid}-d${g.idx}` : `room-${d.code}-${d.createdAt || 0}-n${g.idx}`;
    const over = d.kind === 'free' && Math.max(...d.scores) >= d.target;
    for (let s = 0; s < 4; s++) {
      const seat = d.seats[s]; if (!seat || seat.bot || !seat.pid) continue;
      const side = E.team(s), c = g.contract;
      const name = i => d.seats[i].name || E.SEAT_NAME[E.SEATS[i]];
      const rec = {
        at: Date.now(), kind: d.kind, seat: s, side,
        me: name(s), partner: name(E.partner(s)), opp: `${name(E.next(s))} & ${name(E.partner(E.next(s)))}`,
        partnerPid: d.seats[E.partner(s)].pid || null,
        passed: !c,
        role: !c ? null : c.seat === s ? 'me' : E.team(c.seat) === side ? 'partner' : 'opp',
        contract: c ? { value: c.value, suit: c.suit, coinche: c.coinche } : null,
        made: c ? !!r.made : null,
        capot: !!(c && r.tricks[E.team(c.seat)] === 8),
        belote: g.beloteSeat === s,
        coinched: (g.bids || []).some(b => b.seat === s && b.type === 'coinche'),
        pts: side === 0 ? r.ns : r.ew, against: side === 0 ? r.ew : r.ns,
      };
      if (d.kind === 'tour') Object.assign(rec, { tid: d.tid, tname: d.tour.name, table: d.table, deal: g.idx });
      else rec.code = d.code;
      // même règle que l'écran de résultat : à égalité, Nord-Sud l'emporte
      if (over) rec.game = { won: (d.scores[0] >= d.scores[1] ? 0 : 1) === side, mine: d.scores[side], theirs: d.scores[1 - side] };
      out.push({ path: `players/${seat.pid}/deals/${where}-s${s}`, data: rec });
    }
    return out;
  }

  /** Place d'une ligne (table, côté) dans le classement d'un tournoi : ex æquo à la même place. */
  function tourRank(results, tables, table, side) {
    const lines = E.standings(results, tables).filter(l => l.side === side && l.played);
    const me = lines.find(l => l.table === table);
    if (!me) return null;
    const pos = me.pct === null ? null : 1 + lines.filter(l => l.pct !== null && l.pct > me.pct + 1e-9).length;
    return { pos, of: lines.length, pct: me.pct, played: me.played };
  }

  /** Lignes jouées dans chaque tournoi, d'après les fiches : tid -> { tid, name, table, side, deals, at }. */
  function tourLines(recs) {
    const out = {};
    for (const r of recs) if (r.kind === 'tour') {
      const k = r.tid, side = r.side === 0 ? 'NS' : 'EO';
      const t = out[k] = out[k] || { tid: k, name: r.tname, lines: {}, deals: 0, at: 0 };
      t.deals++; t.at = Math.max(t.at, r.at || 0);
      const lk = r.table + side; t.lines[lk] = (t.lines[lk] || 0) + 1;
    }
    // la ligne retenue est celle où le joueur a joué le plus de donnes
    return Object.values(out).map(t => {
      const [lk] = Object.entries(t.lines).sort((a, b) => b[1] - a[1])[0];
      return { tid: t.tid, name: t.name, table: +lk.slice(0, -2), side: lk.slice(-2), deals: t.deals, at: t.at };
    }).sort((a, b) => b.at - a.at);
  }

  /** Stats d'un joueur. tours = tid -> { name, pos, of, pct, done } (classements connus). */
  function stats(recs, tours = {}) {
    const s = { deals: recs.length, taken: 0, made: 0, teamTaken: 0, teamMade: 0, defended: 0, sunk: 0, capots: 0, belotes: 0,
      coinches: 0, coinchesOk: 0, pts: 0, games: 0, wins: 0, best: null, partners: [], tours: 0, tourWins: 0, podiums: 0, bestPct: null };
    const partners = {};
    for (const r of recs) {
      s.pts += r.pts || 0;
      if (r.belote) s.belotes++;
      if (r.game) { s.games++; if (r.game.won) s.wins++; }
      const pk = r.partnerPid || 'n:' + r.partner;
      partners[pk] = partners[pk] || { name: r.partner, pid: r.partnerPid || null, n: 0 };
      partners[pk].n++;
      if (r.passed) continue;
      if (r.role === 'opp') {
        s.defended++;
        if (!r.made) s.sunk++;
        if (r.coinched) { s.coinches++; if (!r.made) s.coinchesOk++; }
      } else {
        s.teamTaken++; if (r.made) s.teamMade++;
        if (r.made && r.capot) s.capots++;
        if (r.role === 'me') {
          s.taken++;
          if (r.made) {
            s.made++;
            const v = r.contract.value * r.contract.coinche;
            if (!s.best || v > s.best.value * s.best.coinche) s.best = r.contract;
          }
        }
      }
    }
    s.rate = s.taken ? s.made / s.taken * 100 : null;
    s.partners = Object.values(partners).sort((a, b) => b.n - a.n).slice(0, 3);
    for (const t of Object.values(tours)) {
      s.tours++;
      if (t.done && t.pos === 1) s.tourWins++;
      if (t.done && t.pos && t.pos <= 3) s.podiums++;
      if (t.pct !== null && t.pct !== undefined && (s.bestPct === null || t.pct > s.bestPct)) s.bestPct = t.pct;
    }
    return s;
  }

  /** Résumé publié sur le profil, lu par le hall of fame. */
  const summary = s => ({
    deals: s.deals, taken: s.taken, made: s.made, rate: s.rate, capots: s.capots, belotes: s.belotes,
    coinches: s.coinches, coinchesOk: s.coinchesOk, sunk: s.sunk, games: s.games, wins: s.wins, pts: s.pts,
    tours: s.tours, tourWins: s.tourWins, podiums: s.podiums, bestPct: s.bestPct,
  });

  /** Titres honorifiques gagnés. */
  function titles(s) {
    const t = [];
    if (s.tourWins) t.push({ icon: '🏆', name: s.tourWins > 1 ? `Champion ×${s.tourWins}` : 'Champion', why: 'Vainqueur de tournoi' });
    else if (s.podiums) t.push({ icon: '🥉', name: 'Sur le podium', why: 'Top 3 d\'un tournoi' });
    if (s.capots >= 3) t.push({ icon: '💥', name: 'Roi du capot', why: `${s.capots} capots` });
    if (s.coinchesOk >= 5) t.push({ icon: '🎯', name: 'Coincheur d\'élite', why: `${s.coinchesOk} coinches gagnantes` });
    if (s.taken >= 20 && s.rate >= 70) t.push({ icon: '🧱', name: 'Preneur sûr', why: `${Math.round(s.rate)} % de contrats réussis` });
    if (s.belotes >= 25) t.push({ icon: '👑', name: 'Belote et rebelote', why: `${s.belotes} belotes` });
    if (s.wins >= 10) t.push({ icon: '⭐', name: 'Vieux briscard', why: `${s.wins} parties gagnées` });
    if (s.tours >= 5) t.push({ icon: '🎟️', name: 'Bête de concours', why: `${s.tours} tournois` });
    if (s.deals >= 500) t.push({ icon: '🏃', name: 'Marathonien', why: `${s.deals} donnes` });
    return t;
  }

  /** Tableaux d'honneur du hall of fame, à partir des profils publiés (summary). */
  const BOARDS = [
    { key: 'tourWins', title: 'Tournois gagnés', val: x => x.tourWins, sub: x => `${x.podiums} podium${x.podiums > 1 ? 's' : ''}`, tie: x => x.podiums },
    { key: 'wins', title: 'Parties gagnées', val: x => x.wins, sub: x => `sur ${x.games}`, tie: x => -x.games },
    { key: 'rate', title: 'Meilleur preneur', val: x => (x.taken >= 10 ? x.rate : null), fmt: v => Math.round(v) + ' %', sub: x => `${x.made}/${x.taken} contrats`, tie: x => x.taken, note: '10 contrats pris minimum' },
    { key: 'capots', title: 'Capots', val: x => x.capots, tie: x => x.deals },
    { key: 'coinchesOk', title: 'Coinches gagnantes', val: x => x.coinchesOk, sub: x => `sur ${x.coinches}`, tie: x => -x.coinches },
    { key: 'belotes', title: 'Belotes', val: x => x.belotes },
    { key: 'deals', title: 'Donnes jouées', val: x => x.deals },
  ];
  function boards(players, top = 5) {
    return BOARDS.map(b => ({
      ...b,
      rows: players.filter(p => p.summary && b.val(p.summary)).map(p => ({ p, v: b.val(p.summary), t: b.tie ? b.tie(p.summary) : 0 }))
        .sort((x, y) => y.v - x.v || y.t - x.t).slice(0, top),
    }));
  }

  /** Code admin saisi : majuscules, groupes de 4 séparés par des tirets (XXXX-XXXX-XXXX-XXXX). */
  const normAdmin = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-');

  /** Prénom comparable : sans casse, accents, espaces ni ponctuation (« Léa », « lea », « LÉA » sont le même). */
  const nameKey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  /** Liste admin des profils : doublons probables (même prénom), profil à garder, codes de récupération, codes orphelins.
   * keys = documents profileKeys ({ id: code, pid }) ; counts = pid -> nombre de fiches de donne (sinon le résumé publié). */
  function adminRows(players, keys, counts = {}) {
    const ids = new Set(players.map(p => p.id)), codes = {}, orphans = [];
    for (const k of keys) {
      if (ids.has(k.pid)) (codes[k.pid] = codes[k.pid] || []).push(k.id);
      else orphans.push(k.id);
    }
    const rows = players.map(p => ({
      id: p.id, name: p.name || '', key: nameKey(p.name), createdAt: p.createdAt || 0, updatedAt: p.updatedAt || 0,
      deals: counts[p.id] ?? (p.summary ? p.summary.deals : 0), codes: codes[p.id] || [], dups: 0, keep: false,
    }));
    const groups = {};
    for (const r of rows) (groups[r.key] = groups[r.key] || []).push(r);
    // à garder : le profil du groupe qui a le plus de donnes, puis le plus récemment utilisé
    for (const g of Object.values(groups)) {
      g.sort((a, b) => b.deals - a.deals || b.updatedAt - a.updatedAt);
      g.forEach((r, i) => { r.dups = g.length - 1; r.keep = g.length > 1 && i === 0; });
    }
    rows.sort((a, b) => (b.dups > 0) - (a.dups > 0) || a.key.localeCompare(b.key) || b.deals - a.deals || b.updatedAt - a.updatedAt);
    return { rows, orphans, dupGroups: Object.values(groups).filter(g => g.length > 1).length };
  }

  return { newKey, normKey, normAdmin, nameKey, adminRows, dealRecords, tourRank, tourLines, stats, summary, titles, boards };
})(typeof E !== 'undefined' ? E : require('./engine.js'));
if (typeof module !== 'undefined') module.exports = P;
