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

import { uid, lsGet, lsSet } from './utils.js';

export const COLLECTIONS = ['settings', 'spesa', 'freq', 'lavori', 'routine', 'ricette', 'desideri', 'gatti', 'eventiGatti', 'bacheca', 'musica', 'film', 'posizioni'];

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

export async function api(path, { method = 'GET', body, code, signal } = {}) {
  const r = await fetch(`api/${path}`, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(code ? { 'x-famiglia': code } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw new AuthError(j.error || 'Codice di famiglia sbagliato');
  if (!r.ok) throw new Error(j.error || `Errore ${r.status}`);
  return j;
}

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
    this.busy = null;
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
    while (this.queue.length) {
      const batch = this.queue.slice(0, 100);
      const r = await this.call('dati', { method: 'POST', body: { ops: batch } });
      this.queue.splice(0, batch.length);
      lsSet('casa.sync.q', JSON.stringify(this.queue));
      // se nessun altro ha cambiato quella raccolta nel frattempo, la mia copia è già uguale al server
      Object.entries(r.changes || {}).forEach(([c, [before, after]]) => {
        if ((this.versions[c] || 0) === before) this.versions[c] = after;
      });
      lsSet('casa.sync.v', JSON.stringify(this.versions));
    }
  }

  async pull() {
    const { v } = await this.call('dati');
    for (const c of COLLECTIONS) {
      const sv = v[c] || 0;
      if (sv !== (this.versions[c] || 0)) {
        const r = await this.call(`dati?col=${encodeURIComponent(c)}`);
        const map = r.items || {};
        // le mie modifiche non ancora spedite restano visibili
        this.queue.forEach((op) => { if (op.op === 'wipe') Object.keys(map).forEach((k) => delete map[k]); else if (op.col === c) applyOp(map, op); });
        this.versions[c] = r.v;
        if (this.synced.has(c)) this.attivo = Date.now(); // l'altro sta cambiando qualcosa: resto sveglio
        this.synced.add(c);
        this.write(c, map);
      } else if (!this.synced.has(c)) {
        this.synced.add(c);
        this.emit(c);
      }
    }
    lsSet('casa.sync.v', JSON.stringify(this.versions));
  }

  /** Spedisce le modifiche e scarica quelle degli altri. */
  sync() {
    if (this.fermato) return Promise.resolve(); // dispositivo scollegato (o codice cambiato): questo archivio non parla più col server
    if (this.busy) { this.again = true; return this.busy; }
    this.busy = (async () => {
      const era = this.offline;
      try {
        await this.flush();
        await this.pull();
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
