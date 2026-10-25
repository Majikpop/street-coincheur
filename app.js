/* ===== Street Coincheur : application ===== */
const $app = document.getElementById('app');
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LETTER = i => String.fromCharCode(65 + i);
const isRed = s => s === 'H' || s === 'D';
const sym = s => (s === 'NT' || s === 'AT') ? `<span class="suit tx">${E.SYM[s]}</span>` : `<span class="suit ${isRed(s) ? 'red' : 'blk'}">${E.SYM[s]}</span>`;
const clone = o => JSON.parse(JSON.stringify(o));
const rnd = () => Math.random().toString(36).slice(2, 10);

/* ---------- Transports : local (ce téléphone) et en ligne (Firebase) ---------- */
function makeLocal() {
  const KEY = 'sc2_local';
  let data = LS.get(KEY, {});
  const subs = new Map();
  const col = p => Object.keys(data).filter(k => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'))
    .map(k => ({ ...clone(data[k]), id: k.slice(p.length + 1) }));
  const getter = key => key.endsWith('/*') ? col(key.slice(0, -2)) : (data[key] ? clone(data[key]) : null);
  let queued = false;
  const notify = () => {
    if (queued) return; queued = true;
    queueMicrotask(() => { queued = false; for (const [k, set] of subs) for (const cb of set) cb(getter(k)); });
  };
  const save = () => { LS.set(KEY, data); notify(); };
  function sub(key, cb) {
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key).add(cb); queueMicrotask(() => cb(getter(key)));
    return () => subs.get(key).delete(cb);
  }
  return {
    mode: 'local', uid: 'moi',
    watchDoc: (p, cb) => sub(p, cb),
    watchCol: (p, cb) => sub(p + '/*', cb),
    async get(p) { return data[p] ? clone(data[p]) : null; },
    async set(p, v) { data[p] = clone(v); save(); },
    async setMany(ws) { for (const w of ws) data[w.path] = clone(w.data); save(); },
    async create(p, v) { if (data[p]) return false; data[p] = clone(v); save(); return true; },
    async act(p, init, a) {
      const cur = data[p] || (init && init()); if (!cur) return 'Table introuvable';
      try { const r = T.apply(cur, a, this.uid); data[p] = r.doc; for (const w of r.writes) data[w.path] = w.data; save(); return true; }
      catch (e) { if (e instanceof T.Refused) return e.message; throw e; }
    },
  };
}

async function makeOnline(cfg) {
  const imp = window.SC_FB_IMPORT || (m => import(`https://www.gstatic.com/firebasejs/10.12.2/firebase-${m}.js`));
  const [{ initializeApp }, A, F] = await Promise.all([imp('app'), imp('auth'), imp('firestore')]);
  const app = initializeApp(cfg, window.SC_APP_NAME);
  const auth = A.getAuth(app);
  const db = F.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  if (window.SC_EMULATOR) {
    A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    F.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  const user = await new Promise((res, rej) => {
    const un = A.onAuthStateChanged(auth, u => { if (u) { un(); res(u); } });
    A.signInAnonymously(auth).catch(rej);
  });
  const onErr = e => { S.err = 'Connexion au serveur interrompue (' + (e.code || e.message) + '). Rechargez la page.'; render(); };
  return {
    mode: 'online', uid: user.uid,
    watchDoc: (p, cb) => F.onSnapshot(F.doc(db, p), s => cb(s.exists() ? s.data() : null), onErr),
    watchCol: (p, cb) => F.onSnapshot(F.collection(db, p), s => cb(s.docs.map(d => ({ ...d.data(), id: d.id }))), onErr),
    get: p => F.getDoc(F.doc(db, p)).then(s => (s.exists() ? s.data() : null)),
    set: (p, v) => F.setDoc(F.doc(db, p), v),
    async setMany(ws) {
      for (let i = 0; i < ws.length; i += 400) {
        const b = F.writeBatch(db);
        for (const w of ws.slice(i, i + 400)) b.set(F.doc(db, w.path), w.data);
        await b.commit();
      }
    },
    create: (p, v) => F.runTransaction(db, async tx => {
      const ref = F.doc(db, p); const s = await tx.get(ref);
      if (s.exists()) return false; tx.set(ref, v); return true;
    }),
    async act(p, init, a) {
      const ref = F.doc(db, p);
      try {
        await F.runTransaction(db, async tx => {
          const s = await tx.get(ref);
          const cur = s.exists() ? s.data() : (init && init());
          if (!cur) throw new T.Refused('Table introuvable');
          const r = T.apply(cur, a, user.uid);
          tx.set(ref, r.doc);
          for (const w of r.writes) tx.set(F.doc(db, w.path), w.data);
        });
        return true;
      } catch (e) { if (e instanceof T.Refused) return e.message; throw e; }
    },
  };
}

let NET = null, LOCAL = null;

/* ---------- État de l'interface ---------- */
const S = {
  view: 'home', net: 'connecting', err: '', busy: false, name: LS.get('sc_name', ''),
  tours: [], tour: null, tourId: null, results: [], tables: {},
  form: { name: '', tables: 2, perSet: 8 }, code: '',
  cur: null, doc: null, docLoaded: false,
  freeOpts: LS.get('sc_free', { target: 1000, moc: false }),
  hands: null, revealed: null, pending: false, confirm: null, showHands: false, bidSel: { value: null, suit: null },
  trickKey: null, trickSeen: 0, pauseUntil: 0,
};
const subs = {};
function unsub(k) { if (subs[k]) { subs[k](); delete subs[k]; } }

/* ---------- Navigation (ancre de l'adresse) ---------- */
function go(hash) { if (location.hash === '#' + hash || (!hash && !location.hash)) route(); else location.hash = hash; }
function route() {
  const h = new URLSearchParams(location.hash.slice(1));
  S.err = ''; S.confirm = null;
  if (!h.has('t') || h.has('n')) { /* garder la souscription tournoi si on reste dedans */ }
  unsub('table'); S.cur = null; S.doc = null; S.docLoaded = false; S.revealed = null; S.fxPrev = null;
  if (h.has('r')) openRoom(h.get('r').toUpperCase());
  else if (h.has('local')) openLocal();
  else if (h.has('t') && h.has('n')) { openTour(h.get('t')); openTable(NET, `tournaments/${h.get('t')}/tables/t${+h.get('n')}`, () => (S.tour ? T.initTour(S.tour, +h.get('n')) : null), { kind: 'tour', n: +h.get('n') }); }
  else if (h.has('t')) { openTour(h.get('t')); S.view = 'tour'; }
  else if (h.has('new')) { S.form = { name: '', tables: 2, perSet: 8 }; S.view = 'create'; }
  else { S.view = 'home'; }
  render(); window.scrollTo(0, 0);
}

function openTour(tid) {
  if (S.tourId === tid) return;
  ['tour', 'results', 'tables'].forEach(unsub);
  S.tourId = tid; S.tour = null; S.results = []; S.tables = {};
  subs.tour = NET.watchDoc('tournaments/' + tid, d => { S.tour = d ? { ...d, id: tid } : null; render(); });
  subs.results = NET.watchCol(`tournaments/${tid}/results`, rs => { S.results = rs; render(); });
  subs.tables = NET.watchCol(`tournaments/${tid}/tables`, ts => { S.tables = {}; for (const t of ts) S.tables[t.table] = t; render(); });
}
function openTable(net, path, init, meta) {
  S.cur = { net, path, init, ...meta }; S.view = 'table';
  subs.table = net.watchDoc(path, d => { S.doc = d; S.docLoaded = true; onDoc(); render(); });
}
function openRoom(code) { openTable(NET, 'rooms/' + code, null, { kind: 'free', code }); }
function openLocal() { openTable(LOCAL, 'rooms/LOCAL', () => T.initFree('LOCAL', S.freeOpts), { kind: 'free', code: null, local: true }); }
async function newLocal() { await LOCAL.set('rooms/LOCAL', T.initFree('LOCAL', S.freeOpts)); go('local'); }

/* ---------- Actions ---------- */
// Après un coup accepté, on attend que la table reçoive la nouvelle version avant d'autoriser un autre coup.
const busy = () => S.pending || (S.doc && S.awaitRev != null && S.doc.rev <= S.awaitRev);
async function act(a) {
  const c = S.cur; if (!c || busy()) return;
  S.pending = true; render();
  const before = S.doc ? S.doc.rev : -1;
  try {
    const r = await c.net.act(c.path, c.init, { ...a, hands: myHands() });
    if (r === true && c === S.cur) S.awaitRev = before;
    if (r !== true && !['Coup périmé', "Ce n'est plus ce tour", 'Déjà commencé', 'Donne en cours'].includes(r)) S.err = r;
  } catch (e) { S.err = 'Coup non transmis : ' + (e.code || e.message) + '. Vérifiez la connexion et réessayez.'; }
  S.pending = false; render();
}
function setName(v) { S.name = v.trim().slice(0, 24); LS.set('sc_name', S.name); }

async function createRoom() {
  if (!S.name) { S.err = 'Indiquez votre prénom pour créer une table.'; render(); return; }
  S.busy = true; render();
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  try {
    for (let k = 0; k < 6; k++) {
      const code = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('');
      if (await NET.create('rooms/' + code, T.initFree(code, S.freeOpts))) { S.busy = false; go('r=' + code); return; }
    }
  } catch (e) { S.err = 'Création impossible (' + (e.code || e.message) + ').'; }
  S.busy = false; render();
}
async function createTournament() {
  const f = S.form, id = 't' + Date.now().toString(36) + rnd().slice(0, 4);
  const tour = { id, name: f.name.trim() || 'Tournoi du ' + new Date().toLocaleDateString('fr-FR'), tables: f.tables, perSet: f.perSet, owner: NET.uid, createdAt: Date.now() };
  S.busy = true; render();
  try { await NET.set('tournaments/' + id, tour); await NET.setMany(T.tourHands(tour, rnd() + rnd())); S.busy = false; go('t=' + id); }
  catch (e) { S.busy = false; S.err = 'Création impossible (' + (e.code || e.message) + ').'; render(); }
}

/* ---------- Déroulé : pause de fin de pli, IA, vibration ---------- */
const uid = () => (S.cur ? S.cur.net.uid : null);
const mySeats = d => d ? [0, 1, 2, 3].filter(i => !d.seats[i].bot && d.seats[i].uid === uid()) : [];
/* Mains privées de la donne en cours que ce téléphone peut lire : ses sièges, et ceux de l'IA s'il est assis. */
const handsKey = () => (S.cur && S.doc && S.doc.hk != null ? S.cur.path + '#' + S.doc.hk : null);
const myHands = () => (S.hands && S.hands.key === handsKey() ? S.hands.cards : {});
const game = d => T.getGame(d, myHands());
function loadHands() {
  const d = S.doc, c = S.cur, key = handsKey(); if (!key) return;
  if (!S.hands || S.hands.key !== key) S.hands = { key, cards: {}, asked: {} };
  const h = S.hands, mine = mySeats(d);
  for (const s of [0, 1, 2, 3]) {
    if (!(mine.includes(s) || (mine.length && d.seats[s].bot)) || h.cards[s] || h.asked[s]) continue;
    h.asked[s] = true;
    c.net.get(T.handPath(c.path, d.hk, s))
      .then(v => { if (v) { h.cards[s] = v.cards; if (S.hands === h) { render(); scheduleBot(); } } else h.asked[s] = false; })
      .catch(() => { h.asked[s] = false; }); // siège changé entre-temps : nouvel essai à la prochaine version de la table
  }
}
let botTimer = null, pauseTimer = null, wasMyTurn = false, fxTimer = null, fxQueue = [];
const $fx = document.getElementById('fx');
function fx(main, sub = '', tone = '', delay = 0) {
  fxQueue.push({ main, sub, tone, at: Date.now() + delay });
  if (!fxTimer) playFx();
}
function playFx() {
  const n = fxQueue.shift(); if (!n) { fxTimer = null; return; }
  const wait = Math.max(0, n.at - Date.now());
  fxTimer = setTimeout(() => {
    $fx.className = ''; void $fx.offsetWidth;
    $fx.innerHTML = `<div class="fx-in"><div class="fx-main">${n.main}</div>${n.sub ? `<div class="fx-sub">${n.sub}</div>` : ''}</div>`;
    $fx.className = 'show ' + n.tone;
    fxTimer = setTimeout(() => { $fx.innerHTML = ''; $fx.className = ''; playFx(); }, 1500);
  }, wait);
}
/* Détecte les moments forts d'une version à l'autre de la table (jamais au premier affichage). */
function announce(d, g) {
  const key = (d.kind === 'free' ? d.n : '') + ':' + g.idx;
  const now = { key, phase: g.phase, coinche: g.contract ? g.contract.coinche : 1, belote: g.beloteSaid };
  const prev = S.fxPrev; S.fxPrev = now;
  if (!prev) return;
  const who = s => esc(seatName(d, s));
  if (prev.key !== key) {
    if (g.phase === 'bid') fx(`Donne ${d.kind === 'free' ? d.n : g.idx + 1}`, `${who(E.next(g.dealer))} parle en premier${g.moc ? ' · MOC !' : ''}`, g.moc ? 'hot' : '');
    return;
  }
  if (now.coinche > prev.coinche) fx(now.coinche === 4 ? 'Surcoinche !!' : 'Coinche !', `${valTxt(g.contract.value)} ${E.SYM[g.contract.suit]} ×${now.coinche}`, 'hot');
  if (prev.phase === 'bid' && g.phase === 'play') fx("C'est parti !", `${valTxt(g.contract.value)} ${E.SYM[g.contract.suit]} pour ${who(g.contract.seat)}`);
  if (now.belote > prev.belote) fx(now.belote === 1 ? 'Belote !' : 'Rebelote !', who(g.beloteSeat), 'cool', 700);
  if (prev.phase !== 'done' && g.phase === 'done') {
    const r = g.result, wait = Math.max(0, S.pauseUntil - Date.now());
    if (r.passed) fx('Donne passée', 'Personne ne prend', 'cool');
    else {
      const att = E.team(g.contract.seat);
      if (r.made && r.tricks[att] === 8) fx('Capot !!', `${esc(T.names(d, att))}`, 'good', wait);
      else if (r.made) fx('Contrat réussi', `${esc(T.names(d, att))} · ${att === 0 ? r.ns : r.ew} pts`, 'good', wait);
      else fx('Dedans !', `${esc(T.names(d, 1 - att))} · ${att === 0 ? r.ew : r.ns} pts`, 'hot', wait);
    }
  }
}
function onDoc() {
  loadHands();
  const d = S.doc, g = d && game(d);
  if (g) {
    const key = (d.kind === 'free' ? d.n : '') + ':' + g.idx;
    if (S.trickKey !== key) { S.trickKey = key; S.trickSeen = g.tricks.length; S.pauseUntil = 0; S.showHands = false; S.bidSel = { value: null, suit: null }; }
    else if (g.tricks.length > S.trickSeen) { S.trickSeen = g.tricks.length; S.pauseUntil = Date.now() + 1300; clearTimeout(pauseTimer); pauseTimer = setTimeout(() => { render(); scheduleBot(); }, 1320); }
    const mine = mySeats(d);
    const myTurn = d.status === 'playing' && g.phase !== 'done' && mine.includes(g.turn);
    if (myTurn && !wasMyTurn && mine.length === 1 && navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
    wasMyTurn = myTurn;
    announce(d, g);
  }
  scheduleBot();
}
function scheduleBot() {
  clearTimeout(botTimer);
  const d = S.doc; if (!d || d.status !== 'playing') return;
  const g = game(d); if (!g || g.phase === 'done' || !d.seats[g.turn].bot || !g.hands[g.turn]) return;
  const mine = mySeats(d); if (!mine.length) return; // seuls les joueurs assis font jouer l'IA
  const rank = d.seats.filter(s => !s.bot && s.uid).findIndex(s => s.uid === uid());
  const wait = Math.max(0, S.pauseUntil - Date.now()) + (g.phase === 'bid' ? 700 : 600) + Math.max(0, rank) * 350;
  const rev = d.rev, seat = g.turn;
  botTimer = setTimeout(() => { if (S.doc && S.doc.rev === rev) S.cur.net.act(S.cur.path, S.cur.init, { type: 'botmove', seat, rev, hands: myHands() }).catch(() => {}); }, wait);
}

/* ---------- Rendu : éléments communs ---------- */
const cardHTML = (c, cls = '') => `<span class="card ${isRed(c.s) ? 'red' : ''} ${cls}" aria-label="${E.RANK_FR[c.r]} de ${E.SUIT_NAME[c.s]}"><b>${E.RANK_FR[c.r]}</b><i>${E.SYM[c.s]}</i></span>`;
const valTxt = v => v === 250 ? 'Capot' : v;
function bidTxt(b) {
  if (b.type === 'pass') return 'Passe';
  if (b.type === 'coinche') return 'Coinche !';
  if (b.type === 'surcoinche') return 'Surcoinche !';
  return `${valTxt(b.value)} ${sym(b.suit)}`;
}
const contractTxt = c => c ? `${valTxt(c.value)} ${sym(c.suit)}${c.coinche === 2 ? ' · coinché' : c.coinche === 4 ? ' · surcoinché' : ''}` : 'Donne passée';
const pctTxt = p => p === null || p === undefined ? '–' : p.toFixed(1).replace('.', ',') + ' %';
const errBox = () => S.err ? `<div class="err" role="alert"><span>${esc(S.err)}</span><button data-a="clearErr" aria-label="Fermer">✕</button></div>` : '';
const back = (label, hash) => `<button class="btn ghost back" data-a="go" data-h="${esc(hash)}">‹ ${label}</button>`;

function netNote() {
  if (S.net === 'connecting') return `<p class="mode"><span class="dot"></span>Connexion au serveur…</p>`;
  if (S.net === 'online') return `<p class="mode"><span class="dot on"></span><span>En ligne : chaque joueur rejoint la table depuis son téléphone avec le lien.</span></p>`;
  return `<p class="mode"><span class="dot"></span><span>Hors ligne : les parties restent sur ce téléphone. Le jeu en réseau s'active une fois le serveur configuré.</span></p>`;
}
function nameField(id) {
  return `<div class="field"><label for="${id}">Votre prénom</label><input id="${id}" type="text" data-f="name" maxlength="24" autocomplete="given-name" placeholder="Prénom affiché à la table" value="${esc(S.name)}"></div>`;
}

/* ---------- Écrans ---------- */
function viewHome() {
  const tours = S.tours.map(t => `<button class="item" data-a="go" data-h="t=${esc(t.id)}">
      <span class="stack" style="gap:2px"><b>${esc(t.name)}</b><span class="meta">${t.tables} table${t.tables > 1 ? 's' : ''} · séries de ${t.perSet} donnes</span></span>
      <span class="chev" aria-hidden="true">›</span></button>`).join('');
  const online = S.net === 'online';
  return `<div class="wrap">
    <header class="stack" style="gap:14px">${window.SC_POSTER ? `<h1 class="sr-only">Street Coincheur</h1><div class="poster">${window.SC_POSTER}</div>` : '<h1 class="logo" aria-label="Street Coincheur"><span class="l1">Street</span><span class="l2">Coincheur</span></h1>'}
      <p class="tagline">La belote coinchée entre amis, à une table ou en donnes duplicate.</p>
      ${S.name ? '' : '<p class="insert" aria-hidden="true">Insérez un prénom pour jouer</p>'}</header>
    ${errBox()}
    ${nameField('homeName')}
    <section class="section"><h2>Partie libre</h2>
      <div class="sheet pad stack">
        ${freeOptions()}
        ${online ? `<p class="muted small">Créez une table, partagez le lien, chacun joue sur son téléphone. Les sièges vides peuvent être tenus par l'IA ou par un joueur déjà assis (passe-et-joue).</p>
        <button class="btn primary block" data-a="createRoom" ${S.busy ? 'disabled' : ''}>Créer une table en ligne</button>
        <div class="row join"><input id="code" type="text" data-f="code" maxlength="4" placeholder="CODE" value="${esc(S.code)}" aria-label="Code de table" autocapitalize="characters"><button class="btn" data-a="joinCode">Rejoindre</button></div>` : ''}
        <button class="btn ${online ? 'ghost' : 'primary'} block" data-a="newLocal">Jouer sur ce téléphone</button>
      </div></section>
    <section class="section">
      <div class="row between"><h2>Tournois duplicate</h2><button class="btn gold" data-a="go" data-h="new">Nouveau</button></div>
      ${S.tours.length ? `<div class="sheet list">${tours}</div>` : `<div class="sheet pad"><p class="muted small">Aucun tournoi. Créez-en un : toutes les tables jouent les mêmes donnes, et chaque paire est comparée à celles qui ont occupé la même position.</p></div>`}
      ${netNote()}
    </section>
    ${rulesBlock()}
  </div>`;
}

function freeOptions() {
  const o = S.freeOpts;
  const chips = [500, 1000, 1500, 2000].map(v => `<button class="chip ${o.target === v ? 'on' : ''}" data-a="optTarget" data-v="${v}" aria-pressed="${o.target === v}">${v}</button>`).join('');
  return `<div class="opts"><div class="field"><label>Partie en</label><div class="chips">${chips}</div></div>
    <button class="moc ${o.moc ? 'on' : ''}" data-a="optMoc" aria-pressed="${o.moc}"><span class="mbox" aria-hidden="true">${o.moc ? '✓' : ''}</span>
      <span><b>Mode MOC</b> · Monte ou Coinche<br><span class="muted small">Interdit de passer, dès l'entame : on surenchérit ou on coinche. Seule une coinche arrête l'enchère.</span></span></button></div>`;
}

function rulesBlock() {
  return `<details class="sheet rules"><summary>Règles et barème</summary><ul>
    <li>32 cartes, jeu dans le sens inverse des aiguilles d'une montre. Atout : J 20, 9 14, A 11, 10 10, K 4, Q 3. Hors atout : A 11, 10 10, K 4, Q 3, J 2. (J = valet, Q = dame, K = roi.)</li>
    <li>Enchères de 80 à 160 puis capot, à la couleur, sans atout (SA) ou tout atout (TA). Coinche par la défense, surcoinche par l'équipe preneuse.</li>
    <li>Fournir à la couleur demandée si on peut. Sinon, couper si l'adversaire est maître (en surcoupant si possible, sinon en sous-coupant).</li>
    <li>Partenaire maître (à la couleur ou parce qu'il a coupé) : on fournit si on peut, sinon défausse libre ; pas d'obligation de couper, de surcouper ni de monter sur son partenaire.</li>
    <li>Sans atout (SA) : pas d'atout, on fournit, la plus forte de la couleur demandée gagne. As 19, 10 10, K 4, Q 3, J 2.</li>
    <li>Tout atout (TA) : chaque couleur est atout ; on fournit et on monte dans la couleur demandée (sauf sur son partenaire). J 14, 9 9, A 6, 10 5, K 3, Q 1. Pas de belote en SA ni en TA.</li>
    <li>Contrat réussi si les points faits (belote comprise) atteignent l'annonce et au moins 82. Réussi : annonce + points faits. Chute : 160 + annonce pour la défense. Coinche ×2, surcoinche ×4. Belote +20, dix de der +10, capot 250.</li>
    <li>Mode MOC (Monte ou Coinche, partie libre) : interdit de passer, dès l'entame. Chacun surenchérit ou coinche ; face à son partenaire, on surenchérit. Seule une coinche met fin aux enchères (surcoinche possible).</li>
    <li>Duplicate : chaque donne est comparée entre les tables. Points de match : 2 si mieux, 1 si égalité, 0 sinon, en pourcentage. Classements séparés Nord-Sud et Est-Ouest.</li>
  </ul></details>`;
}

function viewCreate() {
  const f = S.form;
  return `<div class="wrap">${back('Retour', '')}
    <h1>Nouveau tournoi</h1>${errBox()}
    <div class="field"><label for="tname">Nom</label><input id="tname" type="text" data-f="tname" placeholder="Week-end rugby, novembre" value="${esc(f.name)}"></div>
    <div class="field"><label>Nombre de tables</label>
      <div class="stepper"><button data-a="step" data-k="tables" data-d="-1" aria-label="Moins">−</button><output class="num">${f.tables}</output><button data-a="step" data-k="tables" data-d="1" aria-label="Plus">+</button></div></div>
    <div class="field"><label>Donnes par série</label>
      <div class="stepper"><button data-a="step" data-k="perSet" data-d="-1" aria-label="Moins">−</button><output class="num">${f.perSet}</output><button data-a="step" data-k="perSet" data-d="1" aria-label="Plus">+</button></div>
      <p class="muted small">Règle le rythme : une table joue sa série, puis passe à la suivante sans attendre les autres.</p></div>
    <div class="sheet pad stack small"><p><b>${f.tables} série${f.tables > 1 ? 's' : ''} de ${f.perSet} donnes</b>, soit <b>${f.tables * f.perSet} donnes</b> par table.</p>
      <p class="muted">Au tour 1, la table 1 joue la série A, la table 2 la série B… Chaque série passe ensuite à la table suivante.</p></div>
    <button class="btn primary block" data-a="createTour" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Création…' : 'Créer le tournoi'}</button>
  </div>`;
}

function setProgress(table, set) {
  const deals = new Set(E.dealsOfSet(S.tour.perSet, set));
  return S.results.filter(r => r.table === table && deals.has(r.deal)).length;
}
function tableStatus(t, n) {
  const d = S.tables[n];
  if (!d || d.status === 'lobby') return `En attente · ${d ? d.seats.filter(s => s.uid || s.bot).length : 0}/4 assis`;
  if (d.status === 'finished') return 'Toutes les séries jouées';
  const set = E.setForTable(t.tables, n, d.round);
  return `Tour ${d.round + 1} · série ${LETTER(set)} · ${setProgress(n, set)}/${t.perSet}`;
}

function viewTour() {
  const t = S.tour;
  if (!t) return `<div class="wrap">${back('Tournois', '')}<p class="muted">${S.net === 'connecting' ? 'Chargement…' : 'Tournoi introuvable.'}</p></div>`;
  const tables = Array.from({ length: t.tables }, (_, n) => {
    const d = S.tables[n], seats = d ? d.seats : [];
    const who = seats.length ? [0, 2, 1, 3].map(i => esc(seats[i].name || '·')).join(' – ') : 'Personne pour l\'instant';
    return `<button class="item" data-a="go" data-h="t=${esc(t.id)}&n=${n}"><span class="stack" style="gap:2px"><b>Table ${n + 1}</b>
      <span class="meta">${tableStatus(t, n)}</span><span class="meta">${who}</span></span><span class="chev" aria-hidden="true">›</span></button>`;
  }).join('');
  const st = E.standings(S.results, t.tables);
  const rankList = side => {
    const lines = st.filter(l => l.side === side && l.played).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
    if (!lines.length) return `<p class="muted small pad">Aucune donne jouée.</p>`;
    return lines.map((l, i) => `<div class="rank rk-${side.toLowerCase()}"><span class="pos">${l.pct === null ? '–' : (i === 0 ? '1ER' : (i + 1) + 'E')}</span>
      <span style="min-width:0"><b>Table ${l.table + 1}</b> <span class="muted small">${esc(l.names)}</span><div class="bar"><i style="width:${l.pct ?? 0}%"></i></div>
      <span class="muted small">${l.played} jouée${l.played > 1 ? 's' : ''}, ${l.compared} comparée${l.compared > 1 ? 's' : ''}</span></span><span class="pct">${pctTxt(l.pct)}</span></div>`).join('');
  };
  const sched = `<div class="sched sheet"><table><thead><tr><th>Table</th>${Array.from({ length: t.tables }, (_, r) => `<th>Tour ${r + 1}</th>`).join('')}</tr></thead><tbody>
    ${Array.from({ length: t.tables }, (_, tb) => `<tr><td><b>${tb + 1}</b></td>${Array.from({ length: t.tables }, (_, r) => {
      const set = E.setForTable(t.tables, tb, r), n = setProgress(tb, set);
      return `<td><b>${LETTER(set)}</b> <span class="prog ${n >= t.perSet ? 'full' : ''}">${n}/${t.perSet}</span></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  const mp = E.matchpoints(S.results);
  const deals = [...new Set(S.results.map(r => r.deal))].sort((a, b) => a - b);
  const detail = deals.length ? deals.map(dl => {
    const rs = S.results.filter(r => r.deal === dl).sort((a, b) => a.table - b.table);
    return `<div class="sheet"><div class="row between pad" style="padding-bottom:6px"><b>Donne ${dl + 1}</b><span class="muted small">série ${LETTER(Math.floor(dl / t.perSet))} · donneur ${E.SEAT_NAME[E.SEATS[dl % 4]]}</span></div>
      <div class="sched"><table><thead><tr><th>Table</th><th>Contrat</th><th>NS</th><th>EO</th><th>% NS</th></tr></thead><tbody>
      ${rs.map(r => `<tr><td>${r.table + 1}</td><td>${r.contract ? contractTxt(r.contract) + ' ' + E.SEATS[r.contract.seat] + (r.made ? ' ✓' : ' ✗') : 'Passée'}</td>
        <td class="num">${r.ns}</td><td class="num">${r.ew}</td><td class="num">${pctTxt(mp[dl][r.table].nsPct)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }).join('') : `<p class="muted small">Les donnes apparaîtront ici dès qu'une table aura joué.</p>`;
  return `<div class="wrap">${back('Tournois', '')}
    <div class="stack" style="gap:4px"><p class="eyebrow">Tournoi duplicate</p><h1>${esc(t.name)}</h1>
      <p class="muted small">${t.tables} tables · séries de ${t.perSet} donnes · ${S.results.length} résultat${S.results.length > 1 ? 's' : ''}</p></div>
    ${errBox()}
    ${shareBox(`Tournoi « ${t.name} » : choisis ta table`, 't=' + t.id)}
    <section class="section"><h2>Tables</h2><div class="sheet list">${tables}</div></section>
    <section class="section"><h2>Classement</h2>
      <div class="sheet"><p class="eyebrow pad" style="padding-bottom:0">Lignes Nord-Sud</p>${rankList('NS')}</div>
      <div class="sheet"><p class="eyebrow pad" style="padding-bottom:0">Lignes Est-Ouest</p>${rankList('EO')}</div></section>
    <section class="section"><h2>Rotation des séries</h2>${sched}</section>
    <section class="section"><h2>Donne par donne</h2>${detail}</section>
  </div>`;
}

function shareBox(text, hash) {
  if (S.net !== 'online') return '';
  const url = location.origin + location.pathname + '#' + hash;
  return `<div class="share sheet pad stack"><p class="eyebrow">Inviter</p><p class="url num" id="shareUrl">${esc(url)}</p>
    <div class="row"><button class="btn" data-a="copy" data-u="${esc(url)}">Copier le lien</button>
    <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}" target="_blank" rel="noopener">Envoyer sur WhatsApp</a></div></div>`;
}

/* ---------- Table : salle d'attente, jeu, fin de donne ---------- */
const seatName = (d, i) => d.seats[i].name || E.SEAT_NAME[E.SEATS[i]];

function viewTable() {
  const c = S.cur, d = S.doc || (S.docLoaded && c.init ? c.init() : null);
  const title = c.kind === 'tour' ? `Table ${c.n + 1}${S.tour ? ' · ' + esc(S.tour.name) : ''}` : c.local ? 'Sur ce téléphone' : `Table ${esc(c.code)}`;
  const backH = c.kind === 'tour' ? 't=' + S.tourId : '';
  if (!S.docLoaded || (!S.doc && c.kind === 'tour' && !S.tour)) return `<div class="wrap">${back('Retour', backH)}<p class="muted">Chargement de la table…</p></div>`;
  if (d && S.lobbyOnly && d.status === 'between') return viewLobby(d, title, backH);
  if (!d) return `<div class="wrap">${back('Retour', backH)}<h1>Table introuvable</h1><p class="muted">Vérifiez le code ou le lien reçu.</p></div>`;
  // Entre deux donnes, un joueur sans siège (ou une table incomplète) arrive sur la sélection des sièges, pas sur le résultat.
  const seatedHere = mySeats(d).length > 0, fullTable = d.seats.every(s => s.uid || s.bot);
  if (d.status === 'playing' || (d.status === 'between' && d.game && seatedHere && fullTable)) return viewGame(d, title, backH);
  return viewLobby(d, title, backH);
}

function viewLobby(d, title, backH) {
  const c = S.cur, mine = mySeats(d), full = d.seats.every(s => s.uid || s.bot);
  const needName = !c.local && !mine.length;
  const seatCard = i => {
    const s = d.seats[i], label = E.SEAT_NAME[E.SEATS[i]];
    let body;
    if (s.bot) body = `<b>${esc(s.name)}</b><button class="lnk" data-a="leave" data-s="${i}">Retirer l'IA</button>`;
    else if (s.uid && s.uid === uid()) body = `<b>${esc(s.name || 'Vous')}</b><span class="you">vous</span><button class="lnk" data-a="leave" data-s="${i}">Se lever</button>`;
    else if (s.uid) body = S.confirm === 'take' + i
      ? `<b>${esc(s.name)}</b><span class="small muted">Reprendre ce siège sur ce téléphone ?</span><span class="row"><button class="lnk" data-a="takeover" data-s="${i}">Oui</button><button class="lnk" data-a="confirm" data-c="">Non</button></span>`
      : `<b>${esc(s.name)}</b><button class="lnk" data-a="confirm" data-c="take${i}">C'est moi</button>`;
    else body = `<button class="btn primary sm" data-a="sit" data-s="${i}">${mine.length ? 'Prendre aussi' : "S'asseoir"}</button><button class="lnk" data-a="bot" data-s="${i}">IA</button>`;
    const who = s.bot ? 'IA' : (s.name || '').trim().charAt(0).toUpperCase() || '?';
    return `<div class="sc s${i} t${i % 2} ${s.uid || s.bot ? 'taken' : ''}"><span class="eyebrow">${label}</span><span class="avatar ${s.uid || s.bot ? 'on' : ''}" aria-hidden="true">${s.uid || s.bot ? esc(who) : '?'}</span>${body}</div>`;
  };
  let status = '';
  if (d.status === 'finished') status = `<div class="sheet pad"><b>Toutes les séries de cette table sont jouées.</b> <span class="muted">Le classement complet est sur la page du tournoi.</span></div>`;
  else if (!full) status = `<p class="muted small">Il faut 4 sièges occupés. Un joueur déjà assis peut prendre un second siège pour jouer en passe-et-joue ; le jeu se masque alors entre ses deux mains.</p>`;
  return `<div class="wrap">${back('Retour', backH)}
    <div class="select-title"><p class="eyebrow">${c.kind === 'tour' ? 'Tournoi duplicate' : 'Partie libre'} · ${title}</p><h1>Sélection des joueurs</h1>
      ${d.kind === 'tour' && d.status !== 'finished' ? `<p class="muted small">Prochaine donne : série ${LETTER(E.setForTable(d.tour.tables, d.table, d.round))}, tour ${d.round + 1}</p>` : ''}
      ${d.kind === 'free' ? `<p class="muted small">Partie en ${d.target}${d.moc ? ' · <b class="mocb">MOC</b> Monte ou Coinche' : ''}${d.n ? ` · NS ${d.scores[0]} · EO ${d.scores[1]}` : ''}</p>` : ''}</div>
    ${errBox()}
    ${needName ? nameField('lobbyName') : ''}
    ${c.kind === 'free' && !c.local ? shareBox(`Viens jouer à la coinche, table ${d.code} :`, 'r=' + d.code) : ''}
    ${c.kind === 'tour' ? shareBox(`Table ${c.n + 1} du tournoi « ${S.tour ? S.tour.name : ''} » :`, `t=${S.tourId}&n=${c.n}`) : ''}
    <div class="teams" aria-hidden="true"><span class="a">P1 · Nord-Sud</span><span class="b">P2 · Est-Ouest</span></div>
    <div class="compass">${[2, 3, 1, 0].map(seatCard).join('')}<div class="mid" aria-hidden="true"><span class="vs">VS</span></div></div>
    ${status}
    ${d.status !== 'finished' ? `<div class="row wrapr">${!full ? `<button class="btn ghost" data-a="fillBots" ${busy() ? 'disabled' : ''}>Compléter avec l'IA</button>` : ''}
      <button class="btn primary grow" data-a="${d.status === 'between' ? 'next' : 'start'}" ${full && mine.length && !busy() ? '' : 'disabled'}>${d.status === 'between' ? 'Donne suivante' : 'Distribuer'}</button></div>` : ''}
    ${netNote()}
  </div>`;
}

function viewGame(d, title, backH) {
  const g = game(d), mine = mySeats(d);
  const paused = Date.now() < S.pauseUntil && !g.trick.length && g.lastTrick;
  const viewer = mine.length === 0 ? 0 : mine.length === 1 ? mine[0] : (mine.includes(S.revealed) ? S.revealed : mine[0]);
  const handVisible = mine.length === 1 || (mine.length > 1 && mine.includes(S.revealed));
  const cover = mine.length > 1 && g.phase !== 'done' && !paused && mine.includes(g.turn) && S.revealed !== g.turn;
  const pos = s => (s - viewer + 4) % 4;
  const lastBid = s => { for (let i = g.bids.length - 1; i >= 0; i--) if (g.bids[i].seat === s) return g.bids[i]; return null; };
  const tw = [0, 1].map(tm => g.tricks.filter(t => E.team(t.winner) === tm).length);

  const seats = [0, 1, 2, 3].map(s => {
    const p = pos(s), lb = g.phase === 'bid' ? lastBid(s) : null;
    const isTurn = g.turn === s && g.phase !== 'done' && !paused;
    const bub = lb ? `<span class="bub ${lb.type === 'pass' ? 'pass' : lb.type !== 'bid' ? 'hot' : ''}">${bidTxt(lb)}</span>` : '';
    const backs = p !== 0 && g.phase !== 'done' ? `<span class="backs">${'<i></i>'.repeat(T.left(g, s))}</span>` : '';
    return `<div class="seat p${p} t${s % 2} ${isTurn ? 'turn' : ''}">${p === 0 ? bub : ''}
      <span class="nm">${esc(seatName(d, s))}${g.dealer === s ? '<span class="dealer" title="Donneur">D</span>' : ''}</span>${p !== 0 ? backs + bub : ''}</div>`;
  }).join('');

  const shown = paused ? g.lastTrick : g.trick;
  const win = paused ? E.trickWinner(g.lastTrick, g.contract.suit) : null;
  const trick = `<div class="trick">${(shown || []).map(x => cardHTML(x.card, 't' + pos(x.seat) + (x.seat === win ? ' win' : ''))).join('')}</div>`;
  const contract = g.contract ? `<div class="contract">Contrat<br><b>${valTxt(g.contract.value)} ${sym(g.contract.suit)}</b> ${esc(seatName(d, g.contract.seat))}${g.contract.coinche > 1 ? `<br><span class="x2">${g.contract.coinche === 2 ? 'Coinché ×2' : 'Surcoinché ×4'}</span>` : ''}</div>` : '';
  const plis = g.phase !== 'bid' ? `<div class="plis">Plis<br><span class="a">NS ${tw[0]}</span> · <span class="b">EO ${tw[1]}</span></div>` : '';

  const canPlay = g.phase === 'play' && g.turn === viewer && mine.includes(viewer) && !paused && !cover && !busy();
  let hand;
  if (!mine.length) hand = `<div class="hand hidden">Vous regardez la table. Asseyez-vous à un siège libre entre deux donnes pour jouer.</div>`;
  else if (!handVisible) hand = `<div class="hand hidden">Vos cartes s'afficheront à votre tour.</div>`;
  else if (g.phase !== 'done' && !g.hands[viewer]) hand = `<div class="hand hidden">Distribution…</div>`;
  else {
    const legal = canPlay ? E.legalCards(g, viewer).map(x => x.r + x.s) : [];
    const cards = g.phase === 'done' ? [] : g.hands[viewer];
    hand = `<div class="hand ${canPlay ? 'mine' : ''}" role="group" aria-label="Votre main">${cards.map(x => {
      const ok = legal.includes(x.r + x.s);
      return canPlay ? `<button class="card ${isRed(x.s) ? 'red' : ''} ${ok ? 'ok' : 'no'}" data-a="play" data-c="${x.r + x.s}" ${ok ? '' : 'disabled'} aria-label="${E.RANK_FR[x.r]} de ${E.SUIT_NAME[x.s]}"><b>${E.RANK_FR[x.r]}</b><i>${E.SYM[x.s]}</i></button>` : cardHTML(x);
    }).join('')}</div>`;
  }
  const ctx = d.kind === 'free' ? `${title} · donne ${d.n}` : `${title} · série ${LETTER(Math.floor(g.idx / d.tour.perSet))} · donne ${g.idx + 1}`;
  return `<div class="game">
    ${hud(d, g, backH)}
    <div class="hudsub"><span>${ctx}</span>${d.kind === 'free' ? `<span>${d.moc ? '<b class="mocb">MOC</b> ' : ''}NS ${d.scores[0]} · EO ${d.scores[1]} / ${d.target}</span>` : ''}</div>
    ${S.err ? `<div class="gerr">${errBox()}</div>` : ''}
    <div class="felt">${contract}${plis}${seats}${trick}</div>
    <div class="handzone">${hand}</div>
    <div class="panel">${panel(d, g, viewer, mine, paused, cover)}</div>
    ${cover ? `<div class="cover"><p class="eyebrow">${g.phase === 'bid' ? 'Enchères' : 'Jeu de la carte'}</p><h2>À ${esc(seatName(d, g.turn))} de jouer</h2>
      <p>Passez le téléphone. Les autres ne regardent pas.</p><button class="btn gold" data-a="reveal">C'est moi, afficher mon jeu</button></div>` : ''}
  </div>`;
}

/* Jauges façon barres de vie : points de cartes ramassés par chaque camp pendant la donne. */
function hud(d, g, backH) {
  const pts = [0, 0];
  for (const t of g.tricks) for (const x of t.cards) pts[E.team(t.winner)] += E.points(x.card, g.contract ? g.contract.suit : null);
  if (g.tricks.length === 8) pts[E.team(g.tricks[7].winner)] += 10;
  const att = g.contract ? E.team(g.contract.seat) : null;
  const side = tm => {
    const w = Math.min(100, pts[tm] / 162 * 100);
    const goal = att === tm && g.contract.value <= 162 ? `<span class="goal" style="${tm === 0 ? 'left' : 'right'}:${g.contract.value / 162 * 100}%" title="Objectif ${g.contract.value}"></span>` : '';
    return `<div class="side ${tm === 0 ? 'ns' : 'eo'}"><span class="tn">${esc(T.names(d, tm))}</span><div class="life" role="meter" aria-valuemin="0" aria-valuemax="162" aria-valuenow="${pts[tm]}" aria-label="${tm === 0 ? 'Nord-Sud' : 'Est-Ouest'}"><i style="width:${w}%"></i>${goal}</div>
      <span class="pts">${pts[tm]}${att === tm ? ' / ' + valTxt(g.contract.value) : ''}</span></div>`;
  };
  return `<header class="hud"><button class="quit" data-a="go" data-h="${esc(backH)}" aria-label="Quitter la table">‹</button>${side(0)}<span class="vs" aria-hidden="true">VS</span>${side(1)}</header>`;
}

function panel(d, g, v, mine, paused, cover) {
  if (g.phase === 'done' && !paused) return resultPanel(d, g, mine);
  const turnName = esc(seatName(d, g.turn));
  const myTurn = g.turn === v && mine.includes(v) && !cover;
  const waitTxt = d.seats[g.turn].bot ? `${turnName} réfléchit…` : `À ${turnName}`;
  if (g.phase === 'bid') {
    if (!myTurn) return `<p class="status">${waitTxt}${d.seats[g.turn].bot ? '' : " d'annoncer"}</p>${bidHistory(d, g)}`;
    const o = E.legalBidOptions(g, v), dis = busy() ? 'disabled' : '';
    if (g.surQueue) return `<p class="status">Votre contrat est coinché : surcoincher ?</p>
      <div class="acts"><button class="btn" data-a="bid" data-t="pass" ${dis}>Passer</button><button class="btn gold" data-a="bid" data-t="surcoinche" ${dis}>Surcoincher</button></div>`;
    const sel = S.bidSel;
    if (sel.value !== null && !o.values.includes(sel.value)) sel.value = null;
    const vals = o.values.map(x => `<button class="${sel.value === x ? 'on' : ''}" data-a="selVal" data-v="${x}">${valTxt(x)}</button>`).join('');
    const suits = E.CONTRACTS.map(s => `<button class="${isRed(s) ? 'red' : ''} ${s === 'NT' || s === 'AT' ? 'tx' : ''} ${sel.suit === s ? 'on' : ''}" data-a="selSuit" data-s="${s}" aria-label="${E.SUIT_NAME[s]}">${E.SYM[s]}</button>`).join('');
    const can = sel.value !== null && sel.suit && !busy();
    const bidBtn = lbl => `<button class="btn primary" data-a="bid" data-t="bid" ${can ? '' : 'disabled'}>${sel.value !== null && sel.suit ? `${lbl} ${valTxt(sel.value)} ${E.SYM[sel.suit]}` : lbl}</button>`;
    const passBtn = o.pass ? `<button class="btn" data-a="bid" data-t="pass" ${dis}>Passer</button>` : '';
    return `<p class="status">À vous d'annoncer${g.contract ? ` · actuel : ${contractTxt(g.contract)} (${esc(seatName(d, g.contract.seat))})` : ''}</p>
      ${o.pass ? '' : `<p class="mocline">MOC · ${o.coinche ? 'surenchérissez ou coinchez !' : g.contract ? 'surenchérissez sur votre partenaire !' : 'annoncez, interdit de passer !'}</p>`}
      ${o.values.length ? `<div class="vals">${vals}</div><div class="suits">${suits}</div>` : ''}
      <div class="acts">${passBtn}${o.coinche ? `<button class="btn gold" data-a="bid" data-t="coinche" ${dis}>Coincher</button>` : bidBtn('Annoncer')}</div>
      ${o.coinche && o.values.length ? bidBtn('Surenchérir') : ''}${bidHistory(d, g)}`;
  }
  if (paused) {
    const w = E.trickWinner(g.lastTrick, g.contract.suit), pts = g.lastTrick.reduce((a, x) => a + E.points(x.card, g.contract.suit), 0);
    return `<p class="status">Pli pour ${esc(seatName(d, w))} · ${pts} point${pts > 1 ? 's' : ''}${g.tricks.length === 8 ? ' + 10 de der' : ''}</p>`;
  }
  const belote = g.beloteSaid ? `<p class="small muted">${g.beloteSaid === 1 ? 'Belote' : 'Rebelote'} pour ${esc(seatName(d, g.beloteSeat))}.</p>` : '';
  if (myTurn) return `<p class="status">À vous de jouer</p><p class="small muted">Les cartes jouables sont surélevées.</p>${belote}`;
  return `<p class="status">${waitTxt}${d.seats[g.turn].bot ? '' : ' de jouer'}</p>${belote}`;
}
function bidHistory(d, g) {
  if (!g.bids.length) return `<p class="small muted">Premier à parler : ${esc(seatName(d, E.next(g.dealer)))}.</p>`;
  return `<p class="small muted">${g.bids.map(b => `${esc(seatName(d, b.seat))} : ${bidTxt(b)}`).join(' · ')}</p>`;
}

function resultPanel(d, g, mine) {
  const r = g.result;
  let head;
  if (r.passed) head = `<div class="res-head"><span class="verdict">Donne passée</span><span class="muted small">Personne n'a annoncé.</span></div>`;
  else {
    const att = E.team(g.contract.seat);
    head = `<div class="res-head"><span class="verdict ${r.made ? 'ok' : 'bad'}">${r.made ? (r.tricks[att] === 8 ? 'Capot !' : 'Contrat réussi') : 'Dedans !'}</span><span class="small muted">${contractTxt(g.contract)} par ${esc(seatName(d, g.contract.seat))}</span></div>
      <p class="small muted">Points faits : NS ${r.cardPts[0]}, EO ${r.cardPts[1]}${r.belote !== null ? ` · belote ${r.belote === 0 ? 'NS' : 'EO'}` : ''} · plis ${r.tricks[0]}–${r.tricks[1]}${r.tricks[att] === 8 ? ' · capot !' : ''}</p>`;
  }
  const line = `<div class="scoreline"><div><p class="eyebrow">Nord-Sud</p><p class="big">${r.ns}</p><p class="small muted">${esc(T.names(d, 0))}</p></div>
    <div><p class="eyebrow">Est-Ouest</p><p class="big">${r.ew}</p><p class="small muted">${esc(T.names(d, 1))}</p></div></div>`;
  let extra = '', nextLbl = 'Donne suivante';
  if (d.kind === 'free') {
    const won = Math.max(...d.scores) >= d.target;
    extra = `<p class="small">Total : NS <b class="num">${d.scores[0]}</b> · EO <b class="num">${d.scores[1]}</b>${won ? ` · <b>${d.scores[0] >= d.scores[1] ? 'Nord-Sud' : 'Est-Ouest'} gagne la partie</b>` : ''}</p>`;
    if (won) nextLbl = 'Nouvelle partie';
  } else {
    const others = S.results.filter(x => x.deal === g.idx && x.table !== d.table);
    const mp = E.matchpoints(S.results), me = mp[g.idx] && mp[g.idx][d.table];
    extra = `<div class="stack" style="gap:6px"><p class="eyebrow">Comparaison duplicate</p>${others.length
      ? `<div class="sched"><table class="tbl"><thead><tr><th>Table</th><th>Contrat</th><th>NS</th><th>EO</th></tr></thead><tbody>
        ${others.map(o => `<tr><td>${o.table + 1}</td><td>${o.contract ? contractTxt(o.contract) + ' ' + E.SEATS[o.contract.seat] : 'Passée'}</td><td class="num">${o.ns}</td><td class="num">${o.ew}</td></tr>`).join('')}</tbody></table></div>
        <p class="small">Sur cette donne : Nord-Sud <b class="num">${pctTxt(me && me.nsPct)}</b>, Est-Ouest <b class="num">${pctTxt(me && me.ewPct)}</b>.</p>`
      : `<p class="small muted">Aucune autre table n'a encore joué cette donne.</p>`}</div>`;
    const nx = T.nextDealIdx(d);
    if (!nx) nextLbl = 'Terminer';
    else if (nx.round !== d.round) nextLbl = `Série ${LETTER(E.setForTable(d.tour.tables, d.table, nx.round))} (tour ${nx.round + 1})`;
  }
  const all = T.dealHands(g);
  const hands = S.showHands && all ? `<div class="hands4">${[2, 3, 1, 0].map(s => `<div class="h"><span>${E.SEAT_NAME[E.SEATS[s]]}</span><span class="cs">${E.sortHand(all[s], g.contract && g.contract.suit).map(x => cardHTML(x, 'sm')).join('')}</span></div>`).join('')}</div>` : '';
  const canNext = mine.length && !busy();
  return `${head}${line}${extra}${all ? `<button class="btn ghost" data-a="toggleHands">${S.showHands ? 'Masquer les quatre jeux' : 'Voir les quatre jeux'}</button>` : ''}${hands}
    ${canNext ? `<button class="btn primary block" data-a="next">${nextLbl}</button>` : `<p class="small muted">Un joueur assis lance la donne suivante.</p>`}
    ${mine.length ? `<button class="lnk" data-a="go" data-h="${d.kind === 'tour' ? `t=${S.tourId}&n=${d.table}&lobby=1` : (S.cur.local ? 'local&lobby=1' : 'r=' + d.code + '&lobby=1')}">Changer les sièges</button>` : ''}`;
}

/* ---------- Rendu global (préserve la saisie en cours) ---------- */
function render() {
  const a = document.activeElement, keep = a && a.id && a.tagName === 'INPUT' ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  const sc = window.scrollY;
  let html;
  if (S.view === 'table' && S.cur) html = viewTable();
  else html = ({ home: viewHome, create: viewCreate, tour: viewTour }[S.view] || viewHome)();
  const wasGame = !!$app.querySelector('.game');
  $app.innerHTML = html;
  if (!wasGame && $app.querySelector('.game')) window.scrollTo(0, 0);
  document.body.classList.toggle('in-game', !!$app.querySelector('.game'));
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch (e) {} } }
  if (!$app.querySelector('.game') || wasGame) window.scrollTo(0, sc);
}

/* ---------- Événements ---------- */
$app.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.f === 'name') setName(t.value);
  if (t.dataset.f === 'tname') S.form.name = t.value;
  if (t.dataset.f === 'code') S.code = t.value.toUpperCase();
});
$app.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a, d = b.dataset;
  const name = () => S.cur && S.cur.local ? (S.name || E.SEAT_NAME[E.SEATS[+d.s]]) : S.name;
  switch (a) {
    case 'go': S.lobbyOnly = /lobby=1/.test(d.h); go(d.h.replace(/&?lobby=1/, '')); break;
    case 'clearErr': S.err = ''; render(); break;
    case 'createRoom': createRoom(); break;
    case 'newLocal': newLocal(); break;
    case 'optTarget': S.freeOpts = { ...S.freeOpts, target: +d.v }; LS.set('sc_free', S.freeOpts); render(); break;
    case 'optMoc': S.freeOpts = { ...S.freeOpts, moc: !S.freeOpts.moc }; LS.set('sc_free', S.freeOpts); render(); break;
    case 'joinCode': { const c = S.code.trim().toUpperCase(); if (c.length === 4) go('r=' + c); else { S.err = 'Le code de table compte 4 lettres.'; render(); } break; }
    case 'step': { const lim = d.k === 'tables' ? [1, 12] : [1, 16]; S.form[d.k] = Math.min(lim[1], Math.max(lim[0], S.form[d.k] + +d.d)); render(); break; }
    case 'createTour': createTournament(); break;
    case 'copy':
      try { await navigator.clipboard.writeText(d.u); b.textContent = 'Lien copié'; }
      catch (err) { const r = document.createRange(); r.selectNodeContents(document.getElementById('shareUrl')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Lien sélectionné'; }
      break;
    case 'sit':
      if (!name()) { S.err = 'Indiquez votre prénom avant de vous asseoir.'; render(); const f = document.getElementById('lobbyName'); if (f) f.focus(); break; }
      S.err = ''; act({ type: 'sit', seat: +d.s, name: name() }); break;
    case 'takeover': S.confirm = null; act({ type: 'takeover', seat: +d.s, name: name() }); break;
    case 'confirm': S.confirm = d.c || null; render(); break;
    case 'leave': act({ type: 'leave', seat: +d.s }); break;
    case 'bot': act({ type: 'bot', seat: +d.s }); break;
    case 'fillBots': act({ type: 'fillBots' }); break;
    case 'start': S.lobbyOnly = false; act({ type: 'start' }); break;
    case 'next': S.lobbyOnly = false; act({ type: 'next' }); break;
    case 'reveal': S.revealed = game(S.doc).turn; render(); break;
    case 'selVal': S.bidSel.value = +d.v; render(); break;
    case 'selSuit': S.bidSel.suit = d.s; render(); break;
    case 'bid': {
      const g = game(S.doc);
      if (d.t === 'bid') { if (S.bidSel.value === null || !S.bidSel.suit) return; act({ type: 'bid', seat: g.turn, bid: { type: 'bid', value: S.bidSel.value, suit: S.bidSel.suit } }); }
      else act({ type: 'bid', seat: g.turn, bid: { type: d.t } });
      S.bidSel = { value: null, suit: null };
      break;
    }
    case 'play': { const g = game(S.doc); const [r, s] = [d.c.slice(0, -1), d.c.slice(-1)]; act({ type: 'card', seat: g.turn, card: { r, s } }); break; }
    case 'toggleHands': S.showHands = !S.showHands; render(); break;
  }
});
window.addEventListener('hashchange', route);

/* ---------- Démarrage ---------- */
(async function boot() {
  LOCAL = makeLocal();
  render();
  const cfg = window.SC_FIREBASE_CONFIG;
  if (cfg && cfg.apiKey && !/COLLER/.test(cfg.apiKey)) {
    try { NET = await makeOnline(cfg); S.net = 'online'; }
    catch (e) { NET = LOCAL; S.net = 'local'; S.err = 'Serveur injoignable (' + (e.code || e.message) + '). Mode hors ligne.'; }
  } else { NET = LOCAL; S.net = 'local'; }
  subs.tours = NET.watchCol('tournaments', ts => { S.tours = ts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); render(); });
  route();
})();
