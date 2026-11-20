// Archivio dati.
//  • Su Vercel (con il database collegato) i dati sono condivisi tra tutti i vostri
//    iPhone e iPad: l'app li tiene anche in memoria sul dispositivo, quindi si apre
//    subito e funziona senza rete; appena può manda le modifiche e scarica quelle degli altri.
//  • Altrove (es. aprendo i file in locale) salva solo su questo dispositivo.
//
// Interfaccia comune:
//   subscribe(col, fn(items, meta)) → unsubscribe
//   add(col, data) → id        set(col, id, data)       update(col, id, patch)
//   remove(col, id)            bump(col, id, data)  (contatore +1, per "spesso comprati")

import { uid, lsGet, lsSet, isIPad } from './utils.js';
import { VERSIONE } from './config.js';

export const COLLECTIONS = ['settings', 'spesa', 'freq', 'lavori', 'routine', 'ricette', 'desideri', 'gatti', 'eventiGatti', 'bacheca', 'musica', 'film', 'posizioni', 'liste', 'viaggi', 'valigia'];

let onError = (e) => console.error(e);
export const setErrorHandler = (fn) => { onError = fn; };

const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? null : v)));

// ---------------------------------------------------------------------------
// Solo su questo dispositivo
// ---------------------------------------------------------------------------
class LocalStore {
  constructor(prefix = 'casa.data.') {
    this.mode = 'local';
    this.prefix = prefix;
    this.memory = {};
    this.listeners = {};
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(this.prefix)) this.emit(e.key.slice(this.prefix.length));
    });
  }
  read(c) {
    try { const v = localStorage.getItem(this.prefix + c); if (v != null) return JSON.parse(v); } catch {}
    return this.memory[c] || {};
  }
  write(c, map) {
    this.memory[c] = map;
    try { localStorage.setItem(this.prefix + c, JSON.stringify(map)); }
    catch { onError(new Error('Memoria del dispositivo piena: prova foto più piccole.')); }
    this.emit(c);
  }
  meta() { return { fromCache: false }; }
  emit(c) {
    const arr = Object.entries(this.read(c)).map(([id, v]) => ({ ...v, id }));
    (this.listeners[c] || []).forEach((fn) => fn(arr, this.meta(c)));
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
  async wipe() { COLLECTIONS.forEach((c) => this.write(c, {})); }
}

// ---------------------------------------------------------------------------
// Condiviso tramite Vercel (api/dati)
// ---------------------------------------------------------------------------
export class AuthError extends Error {}

/** Applica un'operazione a una raccolta in memoria (stessa logica del server). */
function applyOp(map, op) {
  if (op.op === 'set') map[op.id] = clean(op.data);
  else if (op.op === 'update') map[op.id] = clean({ ...(map[op.id] || {}), ...op.data });
  else if (op.op === 'bump') map[op.id] = clean({ ...(map[op.id] || {}), ...op.data, count: ((map[op.id] && map[op.id].count) || 0) + 1 });
  else if (op.op === 'remove') delete map[op.id];
}

// Con il codice: chi sta usando l'app, con quale versione, su che cosa (iPhone, iPad) e se è installata sulla
// schermata Home (il server se lo ricorda per "Collegamento" in Impostazioni). L'iPad si presenta come un Mac:
// il tipo lo dice l'app.
const installata = () => { try { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; } catch { return false; } };
export const tipoDispositivo = () => (isIPad() ? 'iPad' : /iPhone/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'computer');
function intestazioni(code) {
  const h = { 'Content-Type': 'application/json' };
  if (!code) return h;
  const chi = lsGet('casa.me');
  return { ...h, 'x-famiglia': code, 'x-app': `${VERSIONE};${installata() ? 'home' : 'web'};${tipoDispositivo()}`, ...(chi === 'p1' || chi === 'p2' ? { 'x-chi': chi } : {}) };
}

export async function api(path, { method = 'GET', body, code, signal } = {}) {
  const r = await fetch(`api/${path}`, {
    method,
    cache: 'no-store',
    headers: intestazioni(code),
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw new AuthError(j.error || 'Codice di famiglia sbagliato');
  if (!r.ok) throw Object.assign(new Error(j.error || `Errore ${r.status}`), { status: r.status, indice: Number.isInteger(j.indice) ? j.indice : null });
  return j;
}

// ---------------------------------------------------------------------------
// La copia dei dati sul dispositivo: IndexedDB, che ha tanto spazio (le foto delle ricette riempiono presto
// i circa 5 MB di localStorage, e allora la copia non si salverebbe più). Se IndexedDB non si apre resta
// localStorage, come prima. Coda delle modifiche e versioni restano in localStorage (sono piccole).
// ---------------------------------------------------------------------------
function apriIdb() {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === 'undefined') { ko(new Error('IndexedDB non c’è')); return; }
    const t = setTimeout(() => ko(new Error('IndexedDB non risponde')), 3000); // l'avvio non resta mai appeso
    let r;
    try { r = indexedDB.open('comperotto', 1); } catch (e) { clearTimeout(t); ko(e); return; }
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('raccolte')) r.result.createObjectStore('raccolte'); };
    r.onsuccess = () => { clearTimeout(t); ok(r.result); };
    r.onerror = () => { clearTimeout(t); ko(r.error || new Error('IndexedDB')); };
    r.onblocked = () => { clearTimeout(t); ko(new Error('IndexedDB bloccato')); };
  });
}
const esito = (r) => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

class SyncStore extends LocalStore {
  constructor(code) {
    super('casa.sync.');
    this.mode = 'sync';
    this.code = code;
    this.versions = JSON.parse(lsGet('casa.sync.v') || '{}');
    this.queue = JSON.parse(lsGet('casa.sync.q') || '[]');
    this.synced = new Set();
    this.lastSync = Number(lsGet('casa.sync.at') || 0);
    this.onAuthLost = () => {};
    this.onChange = () => {};
    this.onScarto = () => {};
    this.busy = null;
    this.erroreInvio = null; // l'ultima volta che le mie modifiche non sono riuscite a partire
    this.idb = null;
    this.nonSalvate = new Set(); // raccolte la cui copia qui non si è salvata: al prossimo avvio si riscaricano
    this.copia = new Set(); // raccolte di cui qui c'è la copia intera (salvata o appena scaricata): bastano i pezzi
  }

  /**
   * All'avvio, prima di disegnare: la copia dei dati salvata su questo dispositivo. La prima volta sposta in
   * IndexedDB quella che c'era in localStorage (e libera lo spazio).
   */
  async carica() {
    try {
      this.idb = await apriIdb();
      this.idb.onclose = () => { this.idb = null; this.riapri = true; };
      this.riapri = false;
      const st = this.idb.transaction('raccolte', 'readonly').objectStore('raccolte');
      const valori = await Promise.all(COLLECTIONS.map((c) => esito(st.get(c))));
      // l'ultima volta IndexedDB non si era aperto: la copia buona è quella di localStorage
      const daLs = lsGet('casa.sync.ls') === '1';
      const spostate = [];
      COLLECTIONS.forEach((c, i) => {
        let vecchia = null;
        if (daLs || !valori[i]) { try { vecchia = JSON.parse(localStorage.getItem(this.prefix + c) || 'null'); } catch {} }
        if (vecchia && typeof vecchia === 'object') { this.memory[c] = vecchia; spostate.push(c); this.copia.add(c); }
        else if (valori[i] && typeof valori[i] === 'object') { this.memory[c] = valori[i]; this.copia.add(c); }
      });
      // spostate in IndexedDB: tolgo la copia di localStorage solo quando quella nuova è salvata davvero
      spostate.forEach((c) => this.salva(c).then((ok) => { if (ok) try { localStorage.removeItem(this.prefix + c); } catch {} }));
      if (daLs) lsSet('casa.sync.ls', null);
    } catch {
      this.idb = null; // si resta su localStorage (e la prossima volta si riparte da lì)
      lsSet('casa.sync.ls', '1');
    }
    // le modifiche fatte qui e non ancora partite si vedono sempre (la copia salvata può essere di un attimo prima)
    this.queue.forEach((op) => {
      if (!op.col || op.op === 'bump') return;
      const m = this.read(op.col);
      applyOp(m, op);
    });
  }

  read(c) {
    if (!this.memory[c]) this.memory[c] = this.idb || this.riapri ? {} : super.read(c);
    return this.memory[c];
  }

  write(c, map) {
    this.memory[c] = map;
    const fatto = this.salva(c);
    fatto.then((ok) => { if (ok) this.nonSalvate.delete(c); else this.nonSalvate.add(c); });
    this.emit(c);
    return fatto;
  }

  /**
   * La connessione a IndexedDB. iOS la chiude quando l'app resta a lungo in secondo piano: allora la riapro
   * (una riapertura sola anche se servono più salvataggi insieme). null = si usa localStorage.
   */
  async connessione() {
    if (this.idb) return this.idb;
    if (!this.riapri) return null;
    if (!this.riapertura) {
      this.riapertura = apriIdb()
        .then((db) => { db.onclose = () => { this.idb = null; this.riapri = true; }; this.idb = db; this.riapri = false; return db; })
        .catch(() => null)
        .finally(() => { this.riapertura = null; });
    }
    return this.riapertura;
  }

  /** Salva una raccolta su questo dispositivo (IndexedDB; altrimenti localStorage). true se è andata. */
  async salva(c, tentativo = 0) {
    const map = this.memory[c] || {};
    const db = await this.connessione();
    if (!db) {
      if (this.riapri) { this.pieno(); return false; } // IndexedDB c'era ma non si riapre: niente localStorage a metà
      try { localStorage.setItem(this.prefix + c, JSON.stringify(map)); return true; } catch { this.pieno(); return false; }
    }
    const ok = await new Promise((fine) => {
      try {
        const tx = db.transaction('raccolte', 'readwrite');
        tx.objectStore('raccolte').put(map, c);
        tx.oncomplete = () => fine(true);
        tx.onerror = () => fine(false);
        tx.onabort = () => fine(false);
      } catch { fine(null); } // connessione persa
    });
    if (ok === null && !tentativo) {
      if (this.idb === db) this.idb = null;
      this.riapri = true;
      return this.salva(c, 1);
    }
    if (!ok) this.pieno();
    return Boolean(ok);
  }

  /** Memoria piena (o copia che non si salva): lo dico una volta sola. */
  pieno() {
    if (this.avvisato) return;
    this.avvisato = true;
    onError(new Error('Memoria del dispositivo piena: i dati restano sul server, ma qui si riscaricano a ogni apertura'));
  }

  /** Le versioni delle raccolte, tranne quelle la cui copia qui non si è salvata (al prossimo avvio si riscaricano). */
  salvaVersioni() {
    const v = { ...this.versions };
    this.nonSalvate.forEach((c) => { delete v[c]; });
    lsSet('casa.sync.v', JSON.stringify(v));
  }
  // finché non ho sentito il server, i dati vengono "dalla cache" (serve a non caricare gli esempi due volte)
  meta(c) { return { fromCache: !this.synced.has(c) }; }

  enqueue(op) {
    this.queue.push(op);
    lsSet('casa.sync.q', JSON.stringify(this.queue));
    clearTimeout(this.kickT);
    this.kickT = setTimeout(() => this.sync(), 250);
  }
  set(c, id, data) { super.set(c, id, data); this.enqueue({ op: 'set', col: c, id, data: clean(data) }); }
  update(c, id, patch) { super.update(c, id, patch); this.enqueue({ op: 'update', col: c, id, data: clean(patch) }); }
  remove(c, id) { super.remove(c, id); this.enqueue({ op: 'remove', col: c, id }); }
  bump(c, id, data) { super.bump(c, id, data); this.enqueue({ op: 'bump', col: c, id, data: clean(data) }); }
  async wipe() { await super.wipe(); this.enqueue({ op: 'wipe' }); }

  call(path, opts = {}) { return api(path, { ...opts, code: this.code }); }

  async flush() {
    let n = 100;
    while (this.queue.length) {
      const batch = this.queue.slice(0, n);
      let r;
      try {
        r = await this.call('dati', { method: 'POST', body: { ops: batch } });
      } catch (e) {
        // Il server non accetterà mai questo pacchetto (troppo grande, o con una modifica non valida):
        // invece di restare bloccato per sempre mando a pezzi più piccoli e tolgo solo la modifica che non passa.
        if (e.status !== 400 && e.status !== 413) throw e;
        if (e.status === 400 && e.indice != null && e.indice < batch.length) this.scarta(batch[e.indice], e.status);
        else if (batch.length > 1) n = batch.length > 10 ? 10 : 1;
        else this.scarta(batch[0], e.status);
        continue;
      }
      this.queue.splice(0, batch.length);
      lsSet('casa.sync.q', JSON.stringify(this.queue));
      // se nessun altro ha cambiato quella raccolta nel frattempo, la mia copia è già uguale al server
      Object.entries(r.changes || {}).forEach(([c, [before, after]]) => {
        if ((this.versions[c] || 0) === before) this.versions[c] = after;
      });
      this.salvaVersioni();
    }
  }

  /** Toglie dalla coda una modifica che il server non accetterà mai; quella raccolta si riscarica com'è sul server. */
  scarta(op, status) {
    const i = this.queue.indexOf(op);
    if (i >= 0) this.queue.splice(i, 1);
    lsSet('casa.sync.q', JSON.stringify(this.queue));
    if (op.col) this.versions[op.col] = -1;
    else this.versions = {};
    this.salvaVersioni();
    this.onScarto(op, status);
  }

  /**
   * Una raccolta dal server. Se qui c'è già la copia intera chiedo solo i pezzi cambiati dopo la mia versione
   * (e quelli tolti); altrimenti, o se il server non può, tutta. A pagine se è grande (al massimo qualche MB l'una).
   */
  async scarica(c) {
    const dal = this.copia.has(c) && this.versions[c] > 0 && !this.queue.some((op) => op.op === 'wipe') ? this.versions[c] : 0;
    const prova = async (dal) => {
      const base = `dati?col=${encodeURIComponent(c)}&pagine=1${dal ? `&dal=${dal}` : ''}`;
      let r = await this.call(base);
      const pezzi = Boolean(dal && r.pezzi);
      const arrivati = {};
      const tolti = new Set();
      const raccogli = (x) => { Object.assign(arrivati, x.items || {}); (x.tolti || []).forEach((id) => tolti.add(id)); };
      raccogli(r);
      // se cambia mentre la scarico, tengo la versione della prima pagina: al prossimo giro la riscarico
      const v = r.v;
      for (let i = 0; r.prossimo && i < 100; i++) {
        r = await this.call(`${base}&da=${encodeURIComponent(r.prossimo)}`);
        if (Boolean(r.pezzi) !== pezzi) return null; // il server ha cambiato idea a metà: riparto con tutto
        raccogli(r);
      }
      // i pezzi si uniscono alla mia copia di adesso (con anche quello che ho cambiato mentre arrivavano)
      const map = pezzi ? { ...(this.memory[c] || {}) } : {};
      Object.assign(map, arrivati);
      tolti.forEach((id) => { delete map[id]; });
      return { map, v, pezzi, toccati: new Set([...Object.keys(arrivati), ...tolti]) };
    };
    return (await prova(dal)) || prova(0);
  }

  async pull() {
    const { v } = await this.call('dati');
    const salvate = [];
    for (const c of COLLECTIONS) {
      const sv = v[c] || 0;
      if (sv !== (this.versions[c] || 0)) {
        const r = await this.scarica(c);
        const map = r.map;
        // le mie modifiche non ancora spedite restano visibili (con i pezzi: solo sui documenti appena arrivati,
        // sugli altri ci sono già; così un "+1" non si conta due volte)
        this.queue.forEach((op) => {
          if (op.op === 'wipe') Object.keys(map).forEach((k) => delete map[k]);
          else if (op.col === c && (!r.pezzi || r.toccati.has(op.id))) applyOp(map, op);
        });
        this.versions[c] = r.v;
        if (this.synced.has(c)) this.attivo = Date.now(); // l'altro sta cambiando qualcosa: resto sveglio
        this.synced.add(c);
        salvate.push(this.write(c, map));
        this.copia.add(c);
      } else if (!this.synced.has(c)) {
        this.synced.add(c);
        this.emit(c);
      }
    }
    // la versione nuova vale solo quando la copia qui è salvata: se l'app si chiude prima, al prossimo avvio riscarico
    await Promise.all(salvate);
    this.salvaVersioni();
  }

  /** Spedisce le modifiche e scarica quelle degli altri. */
  sync() {
    if (this.fermato) return Promise.resolve(); // dispositivo scollegato (o codice cambiato): questo archivio non parla più col server
    if (this.busy) { this.again = true; return this.busy; }
    this.busy = (async () => {
      const era = this.offline;
      try {
        // le mie modifiche partono prima; se non riescono a partire, quelle dell'altro arrivano lo stesso
        let partite = true;
        try { await this.flush(); } catch (e) {
          if (e instanceof AuthError) throw e;
          partite = false;
          this.erroreInvio = { at: Date.now(), status: e.status || 0 };
        }
        await this.pull();
        if (partite) this.erroreInvio = null;
        this.lastSync = Date.now();
        lsSet('casa.sync.at', String(this.lastSync));
        this.offline = false;
      } catch (e) {
        if (e instanceof AuthError) this.onAuthLost(e);
        else this.offline = true;
      } finally {
        this.busy = null;
        // i dati nuovi ridisegnano già da soli la pagina: qui serve solo se cambia "in linea / non in linea"
        if (this.offline !== era) this.onChange();
        if (this.again) { this.again = false; this.sync(); }
      }
    })();
    return this.busy;
  }

  start() {
    this.sync();
    // Mentre si usa l'app (o l'altro sta cambiando qualcosa) guardo il server ogni 6 secondi;
    // se nessuno tocca niente rallento fino a 30: meno batteria e meno lavoro per il server.
    this.attivo = Date.now();
    const giro = () => {
      const fermo = Date.now() - this.attivo;
      this.timer = setTimeout(async () => {
        if (!document.hidden) await this.sync();
        if (!this.fermato) giro();
      }, fermo < 60000 ? 6000 : fermo < 5 * 60000 ? 12000 : 30000);
    };
    giro();
    // ascoltatori tenuti da parte: si tolgono quando questo archivio viene scollegato
    const sveglia = () => { this.attivo = Date.now(); this.sync(); };
    const visibile = () => { if (!document.hidden) sveglia(); };
    const tocco = () => { this.attivo = Date.now(); };
    document.addEventListener('visibilitychange', visibile);
    window.addEventListener('online', sveglia);
    window.addEventListener('focus', sveglia);
    window.addEventListener('pointerdown', tocco, { passive: true });
    this.stacca = () => {
      document.removeEventListener('visibilitychange', visibile);
      window.removeEventListener('online', sveglia);
      window.removeEventListener('focus', sveglia);
      window.removeEventListener('pointerdown', tocco);
    };
  }

  /**
   * Scollega questo dispositivo (i dati restano sul server).
   * tieniCoda: il codice è cambiato su un altro dispositivo → le modifiche fatte qui e non ancora
   * spedite restano in coda e partono appena si scrive il codice nuovo (con "Esci" invece si buttano).
   */
  forget(tieniCoda = false) {
    this.fermato = true;
    clearTimeout(this.timer);
    clearTimeout(this.kickT);
    if (this.stacca) this.stacca();
    ['casa.sync.code', 'casa.sync.v', 'casa.sync.at', ...(tieniCoda ? [] : ['casa.sync.q'])].forEach((k) => lsSet(k, null));
    COLLECTIONS.forEach((c) => { try { localStorage.removeItem(this.prefix + c); } catch {} });
    this.memory = {};
    this.copia.clear();
    if (this.idb) { try { this.idb.transaction('raccolte', 'readwrite').objectStore('raccolte').clear(); } catch {} }
  }
}

// ---------------------------------------------------------------------------
// Scelta dell'archivio all'avvio
// ---------------------------------------------------------------------------
export let store = new LocalStore();

/** Chiede a /api/stato se l'app gira su Vercel con il database collegato. */
export async function detectBackend() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch('api/stato', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    if (j && j.app === 'comperotto') { lsSet('casa.sync.seen', '1'); return j; }
  } catch {}
  // senza rete: se questo dispositivo era già collegato, continua con i dati salvati
  if (lsGet('casa.sync.seen') && lsGet('casa.sync.code')) return { app: 'comperotto', storage: true, claimed: true, offline: true };
  return null;
}

export const savedCode = () => lsGet('casa.sync.code');
export function useSync(code) {
  lsSet('casa.sync.code', code);
  store = new SyncStore(code);
  return store;
}
