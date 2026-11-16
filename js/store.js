// Archivio dati: Firebase (condiviso tra i telefoni, in tempo reale) oppure
// localStorage (solo questo dispositivo) se Firebase non è configurato.
//
// Interfaccia comune:
//   subscribe(col, fn(items, meta)) → unsubscribe
//   add(col, data) → id        set(col, id, data)       update(col, id, patch)
//   remove(col, id)            bump(col, id, data)  (contatore +1, per "spesso comprati")

import { FIREBASE_CONFIG, HOUSE_ID } from './config.js';
import { uid } from './utils.js';

export const COLLECTIONS = ['settings', 'spesa', 'freq', 'lavori', 'routine', 'ricette', 'desideri', 'gatti', 'eventiGatti', 'bacheca', 'musica', 'film'];

export const isCloud = Boolean(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

let onError = (e) => console.error(e);
export const setErrorHandler = (fn) => { onError = fn; };

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------
const PREFIX = 'casa.data.';
const memory = {}; // fallback se localStorage non è disponibile (es. navigazione privata)

class LocalStore {
  constructor() {
    this.listeners = {};
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(PREFIX)) this.emit(e.key.slice(PREFIX.length));
    });
  }
  read(c) {
    try { const v = localStorage.getItem(PREFIX + c); if (v != null) return JSON.parse(v); } catch {}
    return memory[c] || {};
  }
  write(c, map) {
    memory[c] = map;
    try { localStorage.setItem(PREFIX + c, JSON.stringify(map)); }
    catch (e) { onError(new Error('Spazio esaurito su questo dispositivo: prova foto più piccole.')); }
    this.emit(c);
  }
  emit(c) {
    const arr = Object.entries(this.read(c)).map(([id, v]) => ({ ...v, id }));
    (this.listeners[c] || []).forEach((fn) => fn(arr, { fromCache: false }));
  }
  subscribe(c, fn) {
    (this.listeners[c] ||= []).push(fn);
    queueMicrotask(() => this.emit(c));
    return () => { this.listeners[c] = this.listeners[c].filter((f) => f !== fn); };
  }
  add(c, data) { const id = uid(); this.set(c, id, { createdAt: Date.now(), ...data }); return id; }
  set(c, id, data) { const m = this.read(c); m[id] = clean(data); this.write(c, m); }
  update(c, id, patch) { const m = this.read(c); m[id] = clean({ ...(m[id] || {}), ...patch }); this.write(c, m); }
  remove(c, id) { const m = this.read(c); delete m[id]; this.write(c, m); }
  bump(c, id, data) { const m = this.read(c); m[id] = clean({ ...(m[id] || {}), ...data, count: ((m[id] && m[id].count) || 0) + 1 }); this.write(c, m); }
  async wipe() { COLLECTIONS.forEach((c) => { try { localStorage.removeItem(PREFIX + c); } catch {} delete memory[c]; this.emit(c); }); }
}

const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? null : v)));

// ---------------------------------------------------------------------------
// Firebase (caricato solo se configurato)
// ---------------------------------------------------------------------------
const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';

class CloudStore {
  async init() {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(FB + 'firebase-app.js'),
      import(FB + 'firebase-auth.js'),
      import(FB + 'firebase-firestore.js'),
    ]);
    this.fs = fs;
    this.authApi = auth;
    const app = initializeApp(FIREBASE_CONFIG);
    try {
      this.db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    } catch {
      this.db = fs.getFirestore(app);
    }
    this.auth = auth.getAuth(app);
    await auth.setPersistence(this.auth, auth.browserLocalPersistence).catch(() => {});
  }
  onAuth(fn) { return this.authApi.onAuthStateChanged(this.auth, fn); }
  login(email, password) { return this.authApi.signInWithEmailAndPassword(this.auth, email, password); }
  logout() { return this.authApi.signOut(this.auth); }
  resetPassword(email) { return this.authApi.sendPasswordResetEmail(this.auth, email); }
  get user() { return this.auth && this.auth.currentUser; }

  col(c) { return this.fs.collection(this.db, 'case', HOUSE_ID, c); }
  ref(c, id) { return this.fs.doc(this.db, 'case', HOUSE_ID, c, id); }
  subscribe(c, fn) {
    // per "settings" serve sapere quando arriva la risposta del server (decide se caricare gli esempi)
    return this.fs.onSnapshot(this.col(c), { includeMetadataChanges: c === 'settings' }, (snap) => {
      fn(snap.docs.map((d) => ({ ...d.data(), id: d.id })), { fromCache: snap.metadata.fromCache });
    }, (e) => onError(e));
  }
  add(c, data) {
    const ref = this.fs.doc(this.col(c));
    this.fs.setDoc(ref, clean({ createdAt: Date.now(), ...data })).catch(onError);
    return ref.id;
  }
  set(c, id, data) { this.fs.setDoc(this.ref(c, id), clean(data)).catch(onError); }
  update(c, id, patch) { this.fs.setDoc(this.ref(c, id), clean(patch), { merge: true }).catch(onError); }
  remove(c, id) { this.fs.deleteDoc(this.ref(c, id)).catch(onError); }
  bump(c, id, data) { this.fs.setDoc(this.ref(c, id), { ...clean(data), count: this.fs.increment(1) }, { merge: true }).catch(onError); }
  async wipe() {
    for (const c of COLLECTIONS) {
      const snap = await this.fs.getDocs(this.col(c));
      await Promise.all(snap.docs.map((d) => this.fs.deleteDoc(d.ref)));
    }
  }
}

export const store = isCloud ? new CloudStore() : new LocalStore();
