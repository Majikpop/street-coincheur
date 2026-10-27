/* Faux Firebase en mémoire pour les tests d'interface : mêmes fonctions que le SDK modulaire
 * (connexion anonyme, Firestore), latence aléatoire et transactions optimistes avec reprise,
 * pour simuler plusieurs téléphones sur une même table. Les règles Firestore ne sont pas appliquées. */
const store = new Map(), listeners = new Set(); let uidc = 0;
const stats = { tx: 0, retries: 0, aborted: 0 };
const clone = o => JSON.parse(JSON.stringify(o));
const lat = () => new Promise(r => setTimeout(r, 5 + Math.random() * 40));
function validate(v, path, inArr) { // mêmes contraintes que Firestore : pas d'undefined, pas de tableau dans un tableau
  if (v === undefined) throw new Error('undefined dans ' + path);
  if (Array.isArray(v)) { if (inArr) throw new Error('tableau imbriqué dans ' + path); v.forEach(x => validate(x, path, true)); }
  else if (v && typeof v === 'object') for (const k in v) validate(v[k], path + '.' + k, false);
}
const ref = path => ({ path, id: path.split('/').pop() });
const snap = p => { const e = store.get(p); return { id: p.split('/').pop(), ref: ref(p), exists: () => !!e, data: () => (e ? clone(e.data) : undefined) }; };
const childOf = (p, c) => p.startsWith(c + '/') && !p.slice(c.length + 1).includes('/');
const colSnap = path => { const docs = [...store.keys()].filter(k => childOf(k, path)).map(snap); return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) }; };
function deliver(l) { if (listeners.has(l)) l.col ? l.cb(colSnap(l.path)) : l.cb(snap(l.path)); }
function fire(paths) { for (const l of listeners) if (paths.some(p => (l.col ? childOf(p, l.path) : p === l.path))) setTimeout(() => deliver(l), 5 + Math.random() * 40); }
function write(p, v) { if (v === null) store.delete(p); else { validate(v, p); const e = store.get(p); store.set(p, { data: clone(v), ver: (e ? e.ver : 0) + 1 }); } }
const ver = p => (store.get(p) ? store.get(p).ver : 0);

module.exports = {
  stats, store,
  reset() { store.clear(); listeners.clear(); Object.assign(stats, { tx: 0, retries: 0, aborted: 0 }); },
  app: { initializeApp: (c, n) => ({ n }) },
  auth: {
    getAuth: () => ({ cbs: [], user: null }), connectAuthEmulator() {},
    onAuthStateChanged: (a, cb) => { a.cbs.push(cb); return () => { a.cbs = a.cbs.filter(x => x !== cb); }; },
    signInAnonymously: async a => { await lat(); a.user = { uid: 'anon' + ++uidc }; a.cbs.forEach(cb => cb(a.user)); return { user: a.user }; },
  },
  firestore: {
    initializeFirestore: () => ({}), connectFirestoreEmulator() {},
    doc: (db, path) => { if (path.split('/').length % 2) throw new Error('chemin de document impair ' + path); return ref(path); },
    collection: (db, path) => { if (path.split('/').length % 2 === 0) throw new Error('chemin de collection pair ' + path); return { path, col: true }; },
    onSnapshot: (r, cb) => { const l = { path: r.path, col: !!r.col, cb }; listeners.add(l); setTimeout(() => deliver(l), 10); return () => listeners.delete(l); },
    getDoc: async r => { await lat(); return snap(r.path); },
    getDocs: async r => { await lat(); return colSnap(r.path); },
    getCountFromServer: async r => { await lat(); const n = colSnap(r.path).size; return { data: () => ({ count: n }) }; },
    setDoc: async (r, v) => { await lat(); write(r.path, v); fire([r.path]); },
    writeBatch: () => {
      const ops = [];
      return { set: (r, v) => ops.push([r.path, v]), delete: r => ops.push([r.path, null]), commit: async () => { await lat(); ops.forEach(([p, v]) => write(p, v)); fire(ops.map(o => o[0])); } };
    },
    runTransaction: async (db, fn) => {
      stats.tx++;
      for (let k = 0; k < 8; k++) {
        const reads = new Map(), writes = [];
        const tx = { get: async r => { await lat(); reads.set(r.path, ver(r.path)); return snap(r.path); }, set: (r, v) => { writes.push([r.path, v]); }, delete: r => { writes.push([r.path, null]); } };
        const res = await fn(tx); await lat();
        if ([...reads].every(([p, v]) => ver(p) === v)) { writes.forEach(([p, v]) => write(p, v)); fire(writes.map(w => w[0])); return res; }
        stats.retries++;
      }
      stats.aborted++; const e = new Error('aborted'); e.code = 'aborted'; throw e;
    },
  },
};
