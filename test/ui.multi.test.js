/* Tests d'interface « plusieurs téléphones » : la vraie page (index.html + scripts) tourne dans jsdom,
 * un navigateur par joueur, tous branchés sur un faux Firebase commun (test/support/fakefb.js).
 * Les joueurs cliquent comme des humains pressés : passer ou coincher quand c'est possible, sinon la
 * première annonce proposée ; jouer la première carte autorisée.
 *
 * Nécessite jsdom (non installé par défaut, le reste des tests n'a aucune dépendance) :
 *   npm i --no-save jsdom@24 && node --test test/ui.multi.test.js
 * Sans jsdom, ces tests sont ignorés. Compter une à deux minutes. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { /* jsdom absent : tests ignorés */ }
const SKIP = JSDOM ? false : 'jsdom non installé (npm i --no-save jsdom@24)';

const ROOT = path.join(__dirname, '..');
const fake = require('./support/fakefb.js');
const wait = ms => new Promise(r => setTimeout(r, ms));

// La page avec ses scripts inlinés (pas de réseau, pas de config.js : la config de test est injectée).
function pageHtml() {
  return fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<link[^>]*>/g, '')
    .replace(/<script src="config\.js[^"]*"><\/script>/, '')
    .replace(/<script src="(\w+)\.js[^"]*"><\/script>/g, (m, f) => '<script>' + fs.readFileSync(path.join(ROOT, f + '.js'), 'utf8') + '<\/script>');
}

const opened = [];
const closeAll = () => { while (opened.length) try { opened.pop().close(); } catch (e) {} };

function phone(name, { online = true } = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/scrollTo|navigation|Not implemented/.test(e.message)) errors.push(e.message); });
  const dom = new JSDOM(pageHtml(), {
    runScripts: 'dangerously', url: 'https://coinche.test/', virtualConsole: vc,
    beforeParse(w) {
      w.SC_FB_IMPORT = async m => fake[m];
      if (online) w.SC_FIREBASE_CONFIG = { apiKey: 'test', projectId: 'test' };
      w.SC_APP_NAME = name; w.scrollTo = () => {}; w.fetch = async () => ({ text: async () => '' });
    },
  });
  const w = dom.window;
  opened.push(w);
  const q = s => w.document.querySelector(s);
  return {
    name, w, q, errors,
    S: () => w.eval('S'),
    busy: () => w.eval('typeof busy === "function" ? busy() : false'),
    click(sel) { const el = q(sel); assert.ok(el, `${name} : élément introuvable ${sel}`); el.click(); },
    type(sel, v) { const el = q(sel); assert.ok(el, `${name} : champ introuvable ${sel}`); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); },
  };
}

// Un coup « humain » si c'est à ce téléphone d'agir ; renvoie true si un clic a eu lieu.
function step(p) {
  if (!p.S().doc || p.busy()) return false;
  const q = p.q;
  const rv = q('[data-a=reveal]'); if (rv) { rv.click(); return true; }
  if (q('[data-a=bid]')) {
    const pass = q('[data-a=bid][data-t=pass]'), co = q('[data-a=bid][data-t=coinche]');
    if (pass && Math.random() < 0.75) { pass.click(); return true; }
    if (co && Math.random() < 0.5) { co.click(); return true; }
    const v = q('[data-a=selVal]'), s = q('[data-a=selSuit]');
    if (v && s) { v.click(); q('[data-a=selSuit]').click(); const b = q('[data-a=bid][data-t=bid]'); if (b && !b.disabled) { b.click(); return true; } }
    if (co) { co.click(); return true; }
    if (pass) { pass.click(); return true; }
    return false;
  }
  const card = q('.hand.mine .card.ok'); if (card) { card.click(); return true; }
  return false;
}
async function drive(phones, until, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { await wait(100); if (until()) return true; phones.forEach(step); }
  return false;
}
const status = p => p.S().doc && p.S().doc.status;

test('table libre en ligne : un ami rejoint par le code, deux IA, une donne complète vue des deux côtés', { skip: SKIP, timeout: 120000 }, async t => {
  t.after(closeAll);
  fake.reset();
  const a = phone('Fab'); await wait(300);
  assert.strictEqual(a.S().net, 'online', 'connexion au faux serveur');
  a.type('#homeName', 'Fabien'); a.click('[data-a=createRoom]'); await wait(500);
  const code = a.S().cur && a.S().cur.code;
  assert.match(code || '', /^[A-Z]{4}$/, 'code de table à 4 lettres');

  const b = phone('Ami'); await wait(300);
  b.type('#homeName', 'Julien'); b.type('#code', code.toLowerCase()); b.click('[data-a=joinCode]'); await wait(500);
  a.click('[data-a=sit][data-s="0"]'); await wait(400);
  b.click('[data-a=sit][data-s="1"]'); await wait(400);
  a.click('[data-a=fillBots]'); await wait(600);
  a.click('[data-a=start]');

  assert.ok(await drive([a, b], () => status(a) === 'between'), 'la donne va jusqu\'au bout');
  for (let k = 0; k < 50 && !(a.q('.verdict') && b.q('.verdict')); k++) await wait(100); // pause de fin de pli
  assert.ok(a.q('.verdict') && b.q('.verdict'), 'les deux téléphones affichent le résultat');
  assert.strictEqual(a.q('.verdict').textContent, b.q('.verdict').textContent, 'même verdict des deux côtés');
  assert.deepStrictEqual([...a.errors, ...b.errors], [], 'aucune erreur de script');
  assert.strictEqual(fake.stats.aborted, 0, 'aucune transaction abandonnée');
});

test('hors ligne : passe-et-joue à deux sièges sur un seul téléphone, avec écran de passage', { skip: SKIP, timeout: 120000 }, async t => {
  t.after(closeAll);
  const l = phone('Local', { online: false }); await wait(200);
  assert.strictEqual(l.S().net, 'local');
  l.click('[data-a=newLocal]'); await wait(300);
  l.click('[data-a=sit][data-s="0"]'); await wait(150);
  l.click('[data-a=sit][data-s="2"]'); await wait(150);
  l.click('[data-a=fillBots]'); await wait(300);
  l.click('[data-a=start]');
  let cover = false;
  assert.ok(await drive([l], () => { if (l.q('[data-a=reveal]')) cover = true; return status(l) === 'between'; }), 'la donne va jusqu\'au bout');
  assert.ok(cover, 'le jeu se masque entre les deux mains');
  assert.deepStrictEqual(l.errors, []);
});

test('tournoi duplicate : 2 tables, 6 téléphones (dont un en passe-et-joue et une IA), séries jouées et classement', { skip: SKIP, timeout: 300000 }, async t => {
  t.after(closeAll);
  fake.reset();
  const org = phone('Orga'); await wait(300);
  org.type('#homeName', 'Fabien');
  org.w.location.hash = 'new'; await wait(150);
  org.type('#tname', 'Test duplicate');
  while (org.S().form.perSet > 2) { org.click('[data-a=step][data-k=perSet][data-d="-1"]'); await wait(20); }
  org.click('[data-a=createTour]'); await wait(800);
  const tid = new URLSearchParams(org.w.location.hash.slice(1)).get('t');
  assert.ok(tid, 'tournoi créé');

  // Table 1 : quatre téléphones. Table 2 : A tient Sud et Nord (passe-et-joue), B tient Est, Ouest en IA.
  const plan = [['P1', 0, [0]], ['P2', 0, [1]], ['P3', 0, [2]], ['P4', 0, [3]], ['A', 1, [0, 2]], ['B', 1, [1]]];
  const ps = plan.map(([n, t, seats]) => Object.assign(phone(n), { t, seats }));
  await wait(400);
  for (const p of ps) p.w.location.hash = `t=${tid}&n=${p.t}`;
  await wait(800);
  for (const p of ps) {
    if (p.q('#lobbyName')) p.type('#lobbyName', p.name);
    for (const s of p.seats) { await wait(80); p.click(`[data-a=sit][data-s="${s}"]`); await wait(500); }
  }
  ps[4].click('[data-a=bot][data-s="3"]'); await wait(600);
  for (const p of ps) { const b = p.q('[data-a=start]'); if (b && !b.disabled) b.click(); }

  const tableDoc = t => { const e = fake.store.get(`tournaments/${tid}/tables/t${t}`); return e && e.data; };
  const finished = () => [0, 1].every(t => tableDoc(t) && tableDoc(t).status === 'finished');
  const t0 = Date.now();
  while (!finished() && Date.now() - t0 < 240000) {
    await wait(100);
    for (const p of ps) { if (step(p)) continue; const nx = p.q('[data-a=next]'); if (nx && !nx.disabled && Math.random() < 0.3) nx.click(); }
  }
  assert.ok(finished(), 'les deux tables ont joué toutes leurs séries');

  const results = [...fake.store.keys()].filter(k => k.startsWith(`tournaments/${tid}/results/`)).map(k => fake.store.get(k).data);
  assert.strictEqual(results.length, 2 * 2 * 2, '2 tables × 2 séries × 2 donnes');
  const lines = E.standings(results, 2);
  for (const l of lines) assert.ok(l.pct !== null && l.pct >= 0 && l.pct <= 100, `classement ${l.side} table ${l.table + 1}`);
  const ns = lines.filter(l => l.side === 'NS').map(l => l.pct);
  assert.ok(Math.abs(ns[0] + ns[1] - 100) < 1e-9, 'deux tables : les pourcentages Nord-Sud se complètent à 100');

  const errs = [org, ...ps].flatMap(p => p.errors.map(e => p.name + ' : ' + e));
  assert.deepStrictEqual(errs, [], 'aucune erreur de script');
  assert.strictEqual(fake.stats.aborted, 0, 'aucune transaction abandonnée');
});

// Le moteur sert aussi à vérifier le classement ci-dessus.
global.E = require(path.join(ROOT, 'engine.js'));
