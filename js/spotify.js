// Spotify dall'app: il server tiene i permessi (api/spotify.js), qui si parla direttamente con Spotify
// con un token che dura un'ora. Cosa suona e dove (iPhone, iPad, Echo…), comandi, ricerca, preferiti,
// playlist (anche crearle e modificarle), coda e il lettore dentro l'app (Web Playback SDK).
import { lsGet, lsSet, isIPad, scaldaImmagini } from './utils.js';
import { store, isSynced, me, myName, rerender } from './core.js';

const API = 'https://api.spotify.com/v1/';
/** Si sta guardando la musica: la zona Musica di Svago o una sua pagina interna. */
export const inMusica = () => /^#\/(svago\/musica|musica\/)/.test(location.hash);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

export const sp = {
  info: parse(lsGet('casa.spotify.info')), // { pronta, account: { p1: { nome } | null, p2 } }
  player: null, // cosa suona adesso (null = niente)
  playerAt: 0,
  devices: null,
  playlists: {}, // per account
  busy: '',
};
const tokens = {};

export class SpotifyError extends Error {
  constructor(msg, status, reason) { super(msg); this.status = status; this.reason = reason || ''; }
}

// ---------------------------------------------------------------------------
// Account collegati
// ---------------------------------------------------------------------------
export const collegati = () => ['p1', 'p2'].filter((k) => sp.info && sp.info.account && sp.info.account[k]);
/** L'account che si sta guardando: quello scelto, altrimenti il mio, altrimenti l'altro. */
export function chi() {
  const c = collegati();
  const scelto = lsGet('casa.spotify.chi');
  if (c.includes(scelto)) return scelto;
  if (c.includes(me())) return me();
  return c[0] || null;
}
export const scegliAccount = (k) => { lsSet('casa.spotify.chi', k); sp.player = null; sp.devices = null; salvatiMap.clear(); rerender(); aggiorna(); };

export async function caricaInfo() {
  if (!isSynced()) return;
  try {
    sp.info = await store.call('spotify?azione=stato');
    lsSet('casa.spotify.info', JSON.stringify(sp.info));
  } catch { /* senza rete restano le ultime informazioni */ }
  rerender();
}

/** Porta alla pagina di Spotify per dare il permesso; torna da sola all'app. */
export async function collega(clientId, per = me()) {
  const r = await store.call('spotify', { method: 'POST', body: { azione: 'collega', chi: per, clientId: clientId || undefined } });
  if (per === me()) lsSet('casa.spotify.chi', per);
  location.href = r.url;
}

export async function scollega(k) {
  await store.call('spotify', { method: 'POST', body: { azione: 'scollega', chi: k } });
  delete tokens[k];
  delete sp.playlists[k];
  sp.player = null;
  await caricaInfo();
}

// ---------------------------------------------------------------------------
// Chiamate a Spotify
// ---------------------------------------------------------------------------
const tokInVolo = {};
const entro = (pr, ms, msg) => Promise.race([pr, new Promise((_, ko) => setTimeout(() => ko(new SpotifyError(msg, 0, 'RETE')), ms))]);
async function token(k, nuovo = false) {
  const t = tokens[k];
  // la durata si conta da quando è arrivato (dal server: "resta"), mai con l'orologio del telefono contro quello del server
  if (!nuovo && t && t.fino - Date.now() > 5 * 60000) return t.token;
  // una sola richiesta alla volta per account, e mai appesa per sempre
  if (!tokInVolo[k]) {
    // "nuovo": il lettore dentro l'app ne vuole uno che duri ancora almeno 20 minuti
    tokInVolo[k] = entro(store.call(`spotify?azione=token&chi=${k}${nuovo ? '&min=1200' : ''}`), 10000, 'Spotify non risponde')
      .then((r) => { tokens[k] = { token: r.token, fino: Date.now() + (r.resta != null ? Number(r.resta) : Number(r.scade) - Date.now()) }; return r.token; })
      .finally(() => { delete tokInVolo[k]; });
  }
  try { return await tokInVolo[k]; } catch (e) {
    // permesso tolto da Spotify: la pagina torna a "Collega"
    if (/non è collegato/.test(e.message)) caricaInfo();
    throw e;
  }
}

// Spotify ogni tanto dice "troppe richieste": per un po' le letture in sottofondo aspettano
let pausaFino = 0;
export async function call(path, { method = 'GET', body } = {}, k = chi(), retry = true) {
  if (!k) throw new SpotifyError('Spotify non è collegato', 0);
  if (method === 'GET' && Date.now() < pausaFino) throw new SpotifyError('Spotify chiede una pausa', 429);
  const auth = await token(k, !retry);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000); // una richiesta appesa non deve bloccare il lettore
  let r;
  try {
    r = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${auth}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new SpotifyError('Spotify non risponde', 0, 'RETE');
  } finally { clearTimeout(timer); }
  if (r.status === 401 && retry) return call(path, { method, body }, k, false);
  if (r.status === 429) {
    pausaFino = Date.now() + Math.min(Number(r.headers.get('Retry-After')) || 5, 60) * 1000;
    throw new SpotifyError('Spotify chiede una pausa', 429);
  }
  if (r.status === 204 || r.status === 202) return null;
  const text = await r.text();
  const j = parse(text) || {};
  if (!r.ok) {
    const e = j.error || {};
    throw new SpotifyError(e.message || `Spotify ${r.status}`, r.status, e.reason);
  }
  return j;
}

// ---------------------------------------------------------------------------
// Stato del lettore
// ---------------------------------------------------------------------------
// Dopo un comando (play, pausa, avanti, barra…) per qualche secondo Spotify risponde ancora con lo stato
// di prima (con gli Echo anche 1–2 secondi): qui si ricorda cosa ci si aspetta, e finché Spotify non lo
// conferma (o passa il tempo) vale quello. Così la barra non va avanti per poi tornare indietro.
const ATTESA = 4500;
const MINIMO = 2500; // dopo un comando, per un po' vale quello che si è chiesto anche se Spotify "conferma" (tocchi veloci)
let attese = {};
const aspetta = (campo, valore) => { attese[campo] = { valore, at: Date.now() }; };
function conAttese(p) {
  if (!p) return p;
  const ora = Date.now();
  for (const [campo, a] of Object.entries(attese)) {
    if (ora - a.at > ATTESA) { delete attese[campo]; continue; }
    const v = a.valore;
    const presto = ora - a.at < MINIMO;
    if (campo === 'play') {
      if (!presto && p.is_playing === v.on && !attese.pos) { delete attese[campo]; continue; }
      p.is_playing = v.on;
      p.progress_ms = v.on ? v.ms + (ora - a.at) : v.ms;
    } else if (campo === 'pos') {
      const atteso = v + (p.is_playing ? ora - a.at : 0);
      if (!presto && Math.abs((p.progress_ms || 0) - atteso) < 2500) delete attese[campo];
      else p.progress_ms = atteso;
    } else if (campo === 'brano') {
      if (p.item && p.item.uri !== v.prima && (!v.nuovo || p.item.uri === v.nuovo.uri || ora - a.at > (v.piu ? 3500 : 1500))) { delete attese[campo]; continue; }
      if (v.nuovo) p.item = v.nuovo;
      p.progress_ms = Math.max(0, ora - a.at);
      if (v.context !== undefined) p.context = v.context;
    } else if (campo === 'shuffle') {
      if (!presto && p.shuffle_state === v) delete attese[campo]; else p.shuffle_state = v;
    } else if (campo === 'repeat') {
      if (!presto && (p.repeat_state || 'off') === v) delete attese[campo]; else p.repeat_state = v;
    } else if (campo === 'device') {
      if (!presto && p.device && p.device.id === v.id) delete attese[campo]; else p.device = v;
    }
  }
  return p;
}
/** Le cose che, se cambiano, vanno ridisegnate (i minuti li muove la pagina da sola). */
const firma = (p) => (p ? [p.item && p.item.uri, p.is_playing, p.shuffle_state, p.repeat_state, p.device && p.device.id, p.device && p.device.name, p.context && p.context.uri].join('|') : '-');
const firmaDev = (l) => (l || []).map((d) => `${d.id}:${d.is_active ? 1 : 0}:${d.name}`).join(',');

let inCorso = null;
/** Rilegge cosa suona e dove (e, se serve, i dispositivi). Ridisegna solo se qualcosa è cambiato. */
export async function aggiorna({ dispositivi = false } = {}) {
  if (!chi()) return;
  if (inCorso) { await inCorso; if (!dispositivi) return; }
  if (inCorso) return inCorso; // un'altra richiesta è partita nel frattempo
  inCorso = (async () => {
    const prima = sp.playerAt ? firma(sp.player) : null;
    const devPrima = firmaDev(sp.devices);
    let cambia = false;
    try {
      const [p, d] = await Promise.all([
        call('me/player?additional_types=track,episode'),
        dispositivi || !sp.devices || (quiSuona() && Date.now() - devAt > 60000) ? call('me/player/devices') : null,
      ]);
      // nel frattempo un comando ha già cambiato lo stato sullo schermo: questa risposta è vecchia
      const nuovo = conAttese(p && p.device ? p : null);
      const vecchio = sp.player;
      const stima = progresso();
      // stesso brano che suona e posizione quasi uguale alla mia stima (la rete fa ±qualche decimo):
      // tengo la mia, così la barra non fa scattini avanti e indietro
      const quasi = nuovo && vecchio && nuovo.is_playing && vecchio.is_playing && nuovo.item && vecchio.item
        && nuovo.item.uri === vecchio.item.uri && Math.abs((nuovo.progress_ms || 0) - stima) < 1500;
      if (quasi) { nuovo.progress_ms = stima; }
      sp.player = nuovo;
      sp.playerAt = Date.now();
      if (d) { sp.devices = d.devices || []; devAt = Date.now(); }
      cambia = firma(sp.player) !== prima || firmaDev(sp.devices) !== devPrima;
    } catch {
      // senza rete o troppe richieste: ci riprovo al prossimo giro
      cambia = prima === null;
      if (!sp.playerAt) sp.playerAt = Date.now();
    } finally {
      inCorso = null;
      if (cambia) rerender();
      avviaGiro(); // se ora suona (o si è fermato) il giro cambia passo
      guardaAvanti();
      aggiornaMediaSession();
    }
  })();
  return inCorso;
}

export async function caricaPlaylist(k = chi(), forza = false) {
  if (!k) return;
  const salvate = sp.playlists[k] || parse(lsGet(`casa.spotify.pl.${k}`));
  if (salvate) sp.playlists[k] = salvate;
  if (salvate && salvate.at && !forza && Date.now() - salvate.at < 10 * 60000) return;
  const list = [];
  const io = await mioId(k);
  let path = 'me/playlists?limit=50';
  for (let i = 0; path && i < 6; i++) {
    const j = (await call(path, {}, k)) || {};
    (j.items || []).filter(Boolean).forEach((p) => list.push(playlistBreve(p, io)));
    path = j.next ? j.next.replace(API, '') : '';
  }
  sp.playlists[k] = { at: Date.now(), list };
  lsSet(`casa.spotify.pl.${k}`, JSON.stringify(sp.playlists[k]));
  rerender();
}

/** L'immagine più piccola che sia almeno grande "min" (le copertine arrivano in più misure). */
export function bestImage(images, min = 300) {
  const ok = (images || []).filter((i) => i && typeof i.url === 'string' && /^https:\/\/[a-z0-9.-]*\.(scdn\.co|spotifycdn\.com)\//.test(i.url));
  if (!ok.length) return '';
  const sorted = [...ok].sort((a, b) => (a.width || 640) - (b.width || 640));
  return (sorted.find((i) => (i.width || 640) >= min) || sorted[sorted.length - 1]).url;
}

// ---------------------------------------------------------------------------
// Comandi: lo schermo cambia subito, i comandi partono uno alla volta (niente sorpassi)
// ---------------------------------------------------------------------------
/** "Questo iPhone/iPad" come dispositivo: il lettore dentro l'app (il suo id cambia a ogni avvio). */
export const QUI = 'qui';
// l'ultima scelta fatta in "Dove ascoltare?": { id: 'qui' | id di un altro dispositivo, at }
function scelta() {
  const v = lsGet('casa.spotify.dev');
  if (!v) return null;
  const o = parse(v);
  return o && typeof o === 'object' && o.id ? o : { id: String(v), at: 0 }; // prima era solo l'id
}
export const dispositivoScelto = () => { const s = scelta(); return s ? s.id : null; };
export const scegliDispositivo = (id) => lsSet('casa.spotify.dev', JSON.stringify({ id: !id || id === QUI || eQui(id) ? QUI : id, at: Date.now() }));
export const attivo = () => (sp.player && sp.player.device) || (sp.devices || []).find((d) => d.is_active) || null;

// il lettore dentro l'app non va su questo dispositivo (browser senza il necessario, account senza Premium…)
let quiGuasto = '';
/** Si può ascoltare dentro l'app, su questo iPhone/iPad? */
export function quiPossibile() {
  const a = sp.info && sp.info.account && sp.info.account[chi()];
  if (quiGuasto || (a && a.completo === false)) return false;
  return typeof navigator.requestMediaKeySystemAccess === 'function'; // il lettore di Spotify ne ha bisogno
}

const SCELTA_VALE = 30 * 60000;
/**
 * Dove far partire la musica: di base qui, sul dispositivo che si sta usando. Un altro (un Echo, l'iPad…)
 * solo se è stato scelto in "Dove ascoltare?" e ci si è ancora collegati: è lui che suona (o è in pausa),
 * oppure è stato scelto da poco. Restituisce QUI, l'id di un dispositivo o null (= chiedere dove).
 */
export function doveSuonare() {
  const s = scelta();
  const a = attivo();
  const acceso = (id) => (sp.devices || []).some((d) => d.id === id);
  if (s && s.id !== QUI) {
    if (a && a.id === s.id) return s.id;
    if (Date.now() - (s.at || 0) < SCELTA_VALE && acceso(s.id)) return s.id;
  }
  if (quiPossibile()) return QUI;
  // qui non si può: quello che suona già, altrimenti l'ultimo scelto se è acceso
  if (a && a.id) return a.id;
  if (s && s.id !== QUI && acceso(s.id)) return s.id;
  return null;
}

let fila = Promise.resolve();
function inFila(fn) {
  const r = fila.then(fn, fn);
  fila = r.catch(() => {});
  return r;
}
let ripassaT = [];
/** Dopo un comando rileggo presto lo stato vero (le attese evitano i salti all'indietro). */
function ripassa() {
  ripassaT.forEach(clearTimeout);
  ripassaT = [900, 2500, 5000].map((ms) => setTimeout(() => aggiorna(), ms));
}
const quiSuona = () => Boolean(qui.player && sp.player && eQui(sp.player.device && sp.player.device.id));

/** Un brano che conosco già (dalle liste) nella forma che usa Spotify per "cosa suona". */
function comeItem(uri) {
  const t = brani.get(uri);
  if (!t) return null;
  const images = [[t.xl, 640], [t.big, 300], [t.img, 64]].filter(([u]) => u).map(([url, width]) => ({ url, width }));
  return { uri: t.uri, id: t.id, name: t.name, duration_ms: t.ms, artists: t.artists, type: 'track', album: t.album ? { id: t.album.id, name: t.album.name, images } : { images } };
}

// ---------------------------------------------------------------------------
// Copertine caricate in anticipo: quando si salta, titolo e copertina cambiano insieme
// ---------------------------------------------------------------------------
const pronte = new Set();
const inCarico = new Set();
/** La copertina è già scaricata e pronta da mostrare? */
export const pronta = (url) => !url || pronte.has(url);
/** Scarica (e prepara) una copertina; quando è pronta ridisegna. */
export function precarica(url) {
  if (!url || pronte.has(url) || inCarico.has(url)) return;
  inCarico.add(url);
  const im = new Image();
  im.decoding = 'async';
  im.src = url;
  const fatto = () => { inCarico.delete(url); pronte.add(url); if (pronte.size > 300) pronte.delete(pronte.values().next().value); rerender(); };
  (im.decode ? im.decode() : new Promise((ok, ko) => { im.onload = ok; im.onerror = ko; })).then(fatto, fatto);
}
/** Tante copertine insieme, in silenzio (all'apertura dell'app): pronte per quando si entra in Musica. */
export function scaldaCopertine(urls) {
  return scaldaImmagini(urls.filter((u) => u && !pronte.has(u) && !inCarico.has(u)), {
    ogni: (u) => { pronte.add(u); if (pronte.size > 300) pronte.delete(pronte.values().next().value); },
  });
}
/** Le copertine di un brano conosciuto, in tutte le misure che usa l'app. */
const precaricaBrano = (t) => { if (t) [t.img, t.big, t.xl].forEach(precarica); };

/** Il prossimo brano, se lo so: dal lettore dentro l'app o dalla coda letta da Spotify. */
export function prossimo() {
  const it = sp.player && sp.player.item;
  if (!it) return null;
  if (quiSuona() && sp.prossimi && sp.prossimi.length) return sp.prossimi[0];
  const c = letto(chiave('coda', it.uri));
  return (c && c[0]) || null;
}
// ---------------------------------------------------------------------------
// iPhone e iPad fermano la musica dentro le app web quando lo schermo si spegne o si passa a un'altra app
// (è una regola di Apple, non di Spotify). Così:
//  - sulla schermata di blocco ci sono titolo, copertina e comandi (Media Session);
//  - se l'app Spotify di questo iPhone/iPad è a disposizione, uscendo dall'app la musica passa lì e continua.
// ---------------------------------------------------------------------------
const suIos = () => isIPad() || /iPhone|iPod/.test(navigator.userAgent);
let mediaFirma = '';
function aggiornaMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const p = sp.player;
  const it = p && p.item;
  if (!it || !quiSuona()) return;
  const f = `${it.uri}|${p.is_playing}`;
  if (f === mediaFirma) return;
  mediaFirma = f;
  try {
    const imgs = ((it.album && it.album.images) || []).filter((x) => x && x.url);
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: it.name || '', artist: (it.artists || []).map((a) => a.name).join(', '), album: (it.album && it.album.name) || '',
      artwork: imgs.map((x) => ({ src: x.url, sizes: `${x.width || 300}x${x.height || x.width || 300}`, type: 'image/jpeg' })),
    });
    navigator.mediaSession.playbackState = p.is_playing ? 'playing' : 'paused';
  } catch { /* browser senza Media Session completa */ }
}
if ('mediaSession' in navigator) {
  const comando = (fn) => () => { fn().catch(() => {}); };
  try {
    navigator.mediaSession.setActionHandler('play', comando(() => (sp.player && !sp.player.is_playing ? playPausa() : Promise.resolve())));
    navigator.mediaSession.setActionHandler('pause', comando(() => (sp.player && sp.player.is_playing ? playPausa() : Promise.resolve())));
    navigator.mediaSession.setActionHandler('nexttrack', comando(() => salta(true)));
    navigator.mediaSession.setActionHandler('previoustrack', comando(() => salta(false)));
  } catch { /* azione non disponibile */ }
}
let devAt = 0;
/** L'app Spotify di questo iPhone/iPad (se è aperta o in secondo piano compare tra i dispositivi). */
const appSpotifyQui = () => (sp.devices || []).find((d) => d.id && !d.is_restricted && d.type === (isIPad() ? 'Tablet' : 'Smartphone') && !/^Comperotto · /.test(d.name || ''));
function passaAllApp() {
  if (!suIos() || !quiSuona() || !sp.player || !sp.player.is_playing) return;
  const app = appSpotifyQui();
  const t = tokens[chi()];
  if (!app || !t) return;
  // "keepalive": la richiesta parte anche se la pagina viene sospesa subito dopo
  fetch(`${API}me/player`, { method: 'PUT', keepalive: true, headers: { Authorization: `Bearer ${t.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ device_ids: [app.id], play: true }) }).catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (document.hidden) passaAllApp(); });
window.addEventListener('pagehide', passaAllApp);

/** Quando cambia brano: leggo la coda (per sapere il prossimo) e preparo le copertine. */
let codaPer = '';
function guardaAvanti() {
  const it = sp.player && sp.player.item;
  if (!it || !it.uri || document.hidden) return;
  if (quiSuona() && sp.prossimi) { sp.prossimi.slice(0, 2).forEach(precaricaBrano); return; }
  if (codaPer === it.uri) return;
  codaPer = it.uri;
  leggi(chiave('coda', it.uri), () => coda(), { maxAge: 60000 }).then((l) => (l || []).slice(0, 2).forEach(precaricaBrano)).catch(() => {});
}

/** Fa partire una playlist/album (context) o dei brani (uris) su un dispositivo. */
export async function suona({ context, uris, offset }, device = doveSuonare()) {
  if (device === QUI) device = qui.id;
  if (!device) throw new SpotifyError('Scegli dove ascoltare', 0, 'NO_DEVICE');
  const primo = (offset && offset.uri) || (uris && uris[0]) || '';
  const nuovo = primo ? comeItem(primo) : null;
  const dev = (sp.devices || []).find((d) => d.id === device) || (sp.player && sp.player.device) || { id: device, name: '' };
  // subito sullo schermo: il brano nuovo (se lo conosco) dall'inizio, sul dispositivo scelto
  const prima = sp.player && sp.player.item ? sp.player.item.uri : '';
  sp.player = { ...(sp.player || {}), device: dev, is_playing: true, progress_ms: 0, item: nuovo || (sp.player && sp.player.item) || null, context: context ? { uri: context } : null };
  sp.playerAt = Date.now();
  attese = {};
  aspetta('brano', { prima, nuovo, context: context ? { uri: context } : null });
  aspetta('play', { on: true, ms: 0 });
  rerender();
  await inFila(() => call(`me/player/play?device_id=${encodeURIComponent(device)}`, { method: 'PUT', body: { ...(context ? { context_uri: context } : { uris }), ...(offset ? { offset } : {}) } }))
    .catch((e) => { attese = {}; ripassa(); throw e; });
  scegliDispositivo(device);
  ripassa();
}

export async function sposta(device) {
  const d = (sp.devices || []).find((x) => x.id === device) || { id: device, name: '' };
  if (sp.player) { sp.player = { ...sp.player, device: d, is_playing: true }; aspetta('device', d); aspetta('play', { on: true, ms: progresso() }); rerender(); }
  await inFila(() => call('me/player', { method: 'PUT', body: { device_ids: [device], play: true } })).catch((e) => { attese = {}; ripassa(); throw e; });
  scegliDispositivo(device);
  ripassa();
}

export async function playPausa() {
  const p = sp.player;
  if (!p) return;
  const on = !p.is_playing;
  const ms = progresso();
  p.is_playing = on; // subito sullo schermo, poi confermo
  p.progress_ms = ms;
  sp.playerAt = Date.now();
  aspetta('play', { on, ms });
  rerender();
  const qui_ = quiSuona();
  await inFila(async () => {
    // suona dentro l'app: comando diretto al lettore (su iPhone/iPad deve partire dal tocco)
    if (qui_) await (on ? qui.player.resume() : qui.player.pause());
    else await call(on ? 'me/player/play' : 'me/player/pause', { method: 'PUT' });
  }).catch((e) => {
    delete attese.play;
    ripassa();
    if (e.status === 403) return; // era già in pausa / già in riproduzione: vale lo stato vero
    throw e;
  });
  ripassa();
}

export async function salta(avanti = true) {
  const p = sp.player;
  if (p) {
    // avanti: il prossimo lo so quasi sempre (coda letta prima), e la sua copertina è già pronta
    const prox = avanti ? prossimo() : null;
    const nuovo = prox ? comeItem(prox.uri) : null;
    aspetta('brano', { prima: p.item ? p.item.uri : '', nuovo });
    if (nuovo) p.item = nuovo;
    p.progress_ms = 0;
    p.is_playing = true;
    sp.playerAt = Date.now();
    rerender();
  }
  const qui_ = quiSuona();
  await inFila(() => (qui_ ? (avanti ? qui.player.nextTrack() : qui.player.previousTrack()) : call(avanti ? 'me/player/next' : 'me/player/previous', { method: 'POST' })))
    .catch((e) => { delete attese.brano; ripassa(); throw e; });
  ripassa();
}

/**
 * Un brano della coda ("Dopo"): Spotify non ha il comando "vai a quel brano", quindi vado avanti fino a lui,
 * come toccare "avanti" più volte (i brani prima si saltano, come nell'app di Spotify).
 */
export async function saltaA(n, uri) {
  const p = sp.player;
  const nuovo = comeItem(uri);
  if (p) {
    aspetta('brano', { prima: p.item ? p.item.uri : '', nuovo, piu: n > 0 });
    if (nuovo) p.item = nuovo;
    p.progress_ms = 0;
    p.is_playing = true;
    sp.playerAt = Date.now();
    rerender();
  }
  const qui_ = quiSuona();
  await inFila(async () => {
    for (let k = 0; k <= n; k++) {
      if (qui_) await qui.player.nextTrack();
      else await call('me/player/next', { method: 'POST' });
    }
  }).catch((e) => { delete attese.brano; ripassa(); throw e; });
  ripassa();
}

export async function casuale() {
  const p = sp.player;
  if (!p) return;
  const on = !p.shuffle_state;
  p.shuffle_state = on;
  aspetta('shuffle', on);
  rerender();
  await inFila(() => call(`me/player/shuffle?state=${on}`, { method: 'PUT' })).catch((e) => { delete attese.shuffle; ripassa(); throw e; });
}

/** Ripeti, come su Spotify: niente → tutta la playlist o l'album → solo questo brano → niente. */
export async function ripeti() {
  const p = sp.player;
  if (!p) return;
  const giro = ['off', 'context', 'track'];
  const nuovo = giro[(giro.indexOf(p.repeat_state || 'off') + 1) % giro.length];
  p.repeat_state = nuovo;
  aspetta('repeat', nuovo);
  rerender();
  await inFila(() => call(`me/player/repeat?state=${nuovo}`, { method: 'PUT' })).catch((e) => { delete attese.repeat; ripassa(); throw e; });
}

/** Avanti e indietro nel brano (in millisecondi). */
export async function vaiA(ms) {
  const p = sp.player;
  ms = Math.max(0, Math.round(ms));
  if (p) { p.progress_ms = ms; sp.playerAt = Date.now(); }
  aspetta('pos', ms);
  if (attese.play) attese.play = { valore: { on: attese.play.valore.on, ms }, at: Date.now() };
  const qui_ = quiSuona();
  await inFila(() => (qui_ ? qui.player.seek(ms) : call(`me/player/seek?position_ms=${ms}`, { method: 'PUT' })))
    .catch((e) => { delete attese.pos; ripassa(); throw e; });
  ripassa();
}

/** Il nome di una playlist (per il lettore grande, quando suona una playlist che non è tra le nostre). */
export const nomePlaylist = (id) => leggi(chiave('plnome', id), () => call(`playlists/${encodeURIComponent(id)}?fields=name`).then((j) => (j && j.name) || ''), { maxAge: 7 * 86400000, conserva: true });

/** I prossimi brani in coda (per il lettore grande). */
export async function coda() {
  const j = await call('me/player/queue');
  return registra(((j && j.queue) || []).map((t) => brano(t)).filter(Boolean).slice(0, 5));
}

/** Cerca su Spotify (es. un brano della nostra lista senza link) e restituisce il primo risultato. */
export async function cerca(q, tipo = 'track') {
  const j = await call(`search?type=${tipo}&limit=1&market=from_token&q=${encodeURIComponent(q)}`);
  const list = (j[`${tipo}s`] && j[`${tipo}s`].items) || [];
  return list.find(Boolean) || null;
}

/** Quanto è andato avanti il brano (stimato tra un aggiornamento e l'altro). */
export function progresso() {
  const p = sp.player;
  if (!p || !p.item) return 0;
  const ms = (p.progress_ms || 0) + (p.is_playing ? Date.now() - sp.playerAt : 0);
  return Math.max(0, Math.min(ms, p.item.duration_ms || ms));
}

// ---------------------------------------------------------------------------
// Giro di aggiornamento. In Musica: ogni 5 secondi se suona, ogni 12 se è fermo. Nelle altre pagine
// (per il mini lettore in basso): ogni 10 secondi se suona, 30 se è in pausa, 60 se non c'è niente.
// Con l'app in secondo piano non chiede niente.
// ---------------------------------------------------------------------------
let giro = null;
let giroAt = 0;
function ritmo() {
  const p = sp.player;
  const suona = Boolean(p && p.is_playing);
  if (inMusica()) return suona ? 5000 : 12000;
  return suona ? 10000 : p ? 30000 : 60000;
}
export function avviaGiro() {
  if (!chi()) return;
  const ms = ritmo();
  if (giro && giroAt <= Date.now() + ms) return; // il prossimo giro arriva già prima
  clearTimeout(giro);
  giroAt = Date.now() + ms;
  giro = setTimeout(async () => {
    giro = null;
    if (!chi()) return;
    if (!document.hidden) await aggiorna();
    avviaGiro();
  }, ms);
}
/** All'avvio dell'app, se Spotify è collegato: cosa suona (per il mini lettore) e poi il giro. */
export function avviaSpotify() {
  if (!isSynced() || !chi()) return;
  aggiorna().finally(avviaGiro);
}
/** A fine brano chiedo subito il prossimo (senza aspettare il giro). */
let fineChiesta = '';
export function fineBrano() {
  const it = sp.player && sp.player.item;
  if (!it || fineChiesta === it.uri) return;
  fineChiesta = it.uri;
  setTimeout(() => aggiorna(), 700);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !isSynced()) return;
  if (!inMusica()) {
    // di ritorno nell'app: il mini lettore in basso deve dire il vero (es. la musica è finita nel frattempo)
    if (chi() && Date.now() - sp.playerAt > 5000) aggiorna().finally(avviaGiro);
    return;
  }
  // di ritorno (es. dalla pagina di Spotify): rileggo account e lettore
  caricaInfo().then(() => { if (chi()) { aggiorna({ dispositivi: true }); caricaPlaylist().catch(() => {}); avviaGiro(); } });
});

/** Link di Spotify → indirizzo interno ("spotify:album:…") per farlo partire. */
export function uriDaLink(link) {
  const m = String(link || '').match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,40})/);
  if (!m) return null;
  const uri = `spotify:${m[1]}:${m[2]}`;
  return m[1] === 'track' || m[1] === 'episode' ? { uris: [uri] } : { context: uri };
}

// ---------------------------------------------------------------------------
// Dati letti da Spotify (con una piccola memoria, così tornare indietro è immediato)
// ---------------------------------------------------------------------------
const cache = new Map();
const inVolo = new Map();
const errori = new Map();
/** Dato già letto (o undefined). */
export const letto = (key) => (cache.get(key) || {}).data;
export const fallito = (key) => errori.get(key) || null;
/**
 * Legge una volta e tiene a mente per qualche minuto; ridisegna la pagina quando arriva.
 * Con "conserva" resta anche sul dispositivo (i suggerimenti si vedono subito alla prossima apertura).
 */
export function leggi(key, fn, { maxAge = 5 * 60000, forza = false, conserva = false } = {}) {
  let c = cache.get(key);
  if (!c && conserva) {
    const salvato = parse(lsGet(`casa.spotify.c.${key}`));
    // ripreso da questo dispositivo: si vede subito (anche se poi lo rileggo perché è vecchio)
    if (salvato && salvato.data) { c = salvato; cache.set(key, c); if (conserva.dopo) conserva.dopo(c.data); rerender(); }
  }
  if (!forza && c && Date.now() - c.at < maxAge) return Promise.resolve(c.data);
  if (conserva && conserva.dopo) fn = ((f) => () => f().then((d) => { conserva.dopo(d); return d; }))(fn);
  if (inVolo.has(key)) return inVolo.get(key);
  errori.delete(key);
  const pr = fn()
    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      if (conserva) lsSet(`casa.spotify.c.${key}`, JSON.stringify({ at: Date.now(), data }));
      return data;
    })
    .catch((e) => { errori.set(key, e); throw e; })
    .finally(() => { inVolo.delete(key); rerender(); });
  inVolo.set(key, pr);
  return pr;
}
export function dimentica(prefix) {
  for (const m of [cache, errori]) for (const k of [...m.keys()]) if (k.startsWith(prefix)) m.delete(k);
}
export const chiaveDi = (k, ...parti) => [k, ...parti].join(':');
export const chiave = (...parti) => chiaveDi(chi(), ...parti);

const ids = {};
/** Il mio id su Spotify (per sapere quali playlist sono nostre e si possono modificare). */
export async function mioId(k = chi()) {
  const a = sp.info && sp.info.account && sp.info.account[k];
  if (a && a.id) return a.id;
  if (!ids[k]) ids[k] = call('me', {}, k).then((j) => j.id || '').catch(() => '');
  return ids[k];
}

// forme semplici di brani, album, artisti, playlist (le risposte di Spotify sono enormi)
const tutti = (x) => ((x && x.items) || []).filter(Boolean);
export function brano(t, album = null) {
  if (!t || !t.uri) return null;
  const al = t.album || album;
  return {
    id: t.id, uri: t.uri, name: t.name || '', ms: t.duration_ms || 0, n: t.track_number || 0,
    artists: (t.artists || []).map((a) => ({ id: a.id, name: a.name })),
    album: al ? { id: al.id, name: al.name || '' } : null,
    img: bestImage((al && al.images) || (t.show && t.show.images) || t.images, 64),
    big: bestImage((al && al.images) || t.images, 300),
    xl: bestImage((al && al.images) || t.images, 600),
    ok: t.is_playable !== false && !t.is_local,
    e: Boolean(t.explicit),
    disco: t.disc_number || 1,
  };
}
export const albumBreve = (a) => a && a.id && ({ id: a.id, uri: a.uri, name: a.name || '', img: bestImage(a.images, 300), anno: String(a.release_date || '').slice(0, 4), data: a.release_date || '', precisione: a.release_date_precision || 'day', artists: (a.artists || []).map((x) => ({ id: x.id, name: x.name })), tipo: a.album_type || '', n: a.total_tracks || 0 });
export const artistaBreve = (a) => a && a.id && ({ id: a.id, uri: a.uri, name: a.name || '', img: bestImage(a.images, 300) });
export function playlistBreve(p, io = '') {
  return p && {
    id: p.id, uri: p.uri, name: p.name || '', img: bestImage(p.images, 300),
    n: (p.items && p.items.total) ?? (p.tracks && p.tracks.total) ?? null,
    owner: (p.owner && p.owner.display_name) || '',
    own: Boolean(p.collaborative || (io && p.owner && p.owner.id === io)),
  };
}
/** Tutti i brani conosciuti per uri: servono al foglio "⋯" di un brano. */
export const brani = new Map();
export const registra = (list) => { (list || []).forEach((t) => t && brani.set(t.uri, t)); return list; };

// ---------------------------------------------------------------------------
// Ricerca
// ---------------------------------------------------------------------------
export const TIPI = ['track', 'artist', 'album', 'playlist'];
/** Cerca (Spotify oggi dà al massimo 10 risultati per tipo a ogni richiesta). */
export async function cercaSu(q, tipi = TIPI, offset = 0) {
  const j = await call(`search?type=${tipi.join(',')}&limit=10&offset=${offset}&market=from_token&q=${encodeURIComponent(q)}`);
  const io = await mioId();
  return {
    track: registra(tutti(j.tracks).map((t) => brano(t)).filter(Boolean)),
    artist: tutti(j.artists).map(artistaBreve).filter(Boolean),
    album: tutti(j.albums).map(albumBreve).filter(Boolean),
    playlist: tutti(j.playlists).map((p) => playlistBreve(p, io)),
    altri: Object.fromEntries(TIPI.map((t) => [t, Boolean(j[`${t}s`] && j[`${t}s`].next)])),
  };
}

// ---------------------------------------------------------------------------
// Pagine: preferiti, playlist, album, artista
// ---------------------------------------------------------------------------
export async function preferiti(offset = 0) {
  const j = await call(`me/tracks?limit=50&offset=${offset}&market=from_token`);
  const list = registra(tutti(j).map((x) => brano(x.item || x.track)).filter(Boolean));
  list.forEach((t) => salvatiMap.set(t.uri, true));
  return { list, totale: j.total || list.length, altri: Boolean(j.next) };
}

export async function playlist(id, offset = 0) {
  const io = await mioId();
  const [p, items] = await Promise.all([
    offset ? null : call(`playlists/${encodeURIComponent(id)}?market=from_token`),
    call(`playlists/${encodeURIComponent(id)}/items?limit=50&offset=${offset}&market=from_token&additional_types=track,episode`).catch((e) => (e.status === 403 || e.status === 404 ? null : Promise.reject(e))),
  ]);
  const list = items ? registra(tutti(items).map((x) => brano(x.item || x.track)).filter(Boolean)) : null;
  return {
    info: p ? { ...playlistBreve(p, io), big: bestImage(p.images, 600), descr: String(p.description || '').replace(/<[^>]*>/g, ''), snapshot: p.snapshot_id } : null,
    list, // null = Spotify non mostra i brani (playlist di altri)
    totale: items ? items.total : null,
    altri: Boolean(items && items.next),
  };
}

/** Un album con tutti i suoi brani (oltre i primi 50 a pagine), data di uscita e diritti. */
export async function album(id) {
  const a = await call(`albums/${encodeURIComponent(id)}?market=from_token`);
  const tracce = a.tracks || a.items || {};
  const list = tutti(tracce).map((t) => brano(t, a)).filter(Boolean);
  let next = tracce.next;
  for (let i = 0; next && i < 8; i++) {
    const j = await call(`albums/${encodeURIComponent(id)}/tracks?limit=50&offset=${list.length}&market=from_token`);
    list.push(...tutti(j).map((t) => brano(t, a)).filter(Boolean));
    next = j.next;
  }
  const diritti = [...new Set((a.copyrights || []).map((c) => `${c.type === 'P' ? '℗' : '©'} ${String(c.text || '').replace(/^\s*[©℗(][CcPp)]?\)?\s*/, '')}`))].slice(0, 2);
  return { info: { ...albumBreve(a), big: bestImage(a.images, 600), diritti }, list: registra(list) };
}

/** Un artista (nome, foto, generi). La discografia e i brani arrivano a parte. */
export async function artista(id) {
  const a = await call(`artists/${encodeURIComponent(id)}`);
  return { info: { ...artistaBreve(a), big: bestImage(a.images, 600), generi: (a.genres || []).slice(0, 3) } };
}

/** Album, singoli ed EP, compilation, "appare in": i gruppi della discografia di un artista. */
export const GRUPPI = ['album', 'single', 'compilation', 'appears_on'];
/** Un gruppo della discografia, 10 alla volta (dal 2026 Spotify non ne dà di più per richiesta). */
export async function discografia(id, gruppo, offset = 0) {
  const j = await call(`artists/${encodeURIComponent(id)}/albums?include_groups=${gruppo}&limit=10&offset=${offset}&market=from_token`);
  return { list: tutti(j).map(albumBreve).filter(Boolean), totale: j.total || 0, altri: Boolean(j.next) };
}

/**
 * I brani di un artista. Spotify non dà più "i più ascoltati" alle app nuove: la sua ricerca per artista li
 * mette comunque per primi. Solo i brani suoi (anche in collaborazione), senza doppioni dello stesso titolo.
 */
export async function braniArtista(id, nome) {
  const out = [];
  const visti = new Set();
  for (let o = 0; o < 30 && out.length < 10; o += 10) {
    const j = await call(`search?type=track&limit=10&offset=${o}&market=from_token&q=${encodeURIComponent(`artist:"${nome}"`)}`);
    tutti(j.tracks).map((t) => brano(t)).filter((t) => t && t.artists.some((x) => x.id === id)).forEach((t) => {
      const k = t.name.toLowerCase().replace(/\s*[-(].*$/, '');
      if (!visti.has(k)) { visti.add(k); out.push(t); }
    });
    if (!j.tracks || !j.tracks.next) break;
  }
  return registra(out.slice(0, 10));
}

// ---------------------------------------------------------------------------
// La libreria come su Spotify: album salvati e artisti seguiti
// ---------------------------------------------------------------------------
export async function albumSalvati(offset = 0) {
  const j = await call(`me/albums?limit=50&offset=${offset}&market=from_token`);
  return { list: tutti(j).map((x) => albumBreve(x.album || x.item)).filter(Boolean), totale: j.total || 0, altri: Boolean(j.next) };
}
export async function artistiSeguiti(dopo = '') {
  const j = await call(`me/following?type=artist&limit=50${dopo ? `&after=${encodeURIComponent(dopo)}` : ''}`);
  const a = j.artists || {};
  return { list: tutti(a).map(artistaBreve).filter(Boolean), dopo: (a.cursors && a.cursors.after) || '', altri: Boolean(a.next) };
}

// ---------------------------------------------------------------------------
// In cima a Musica, come su Spotify: ascoltati di recente e i tuoi artisti del momento
// ---------------------------------------------------------------------------
/** Le ultime cose ascoltate (album, playlist, artisti, "Brani che ti piacciono"), senza doppioni. */
export async function ascoltatiDiRecente(k = chi()) {
  const j = (await call('me/player/recently-played?limit=50', {}, k)) || {};
  const out = [];
  const visti = new Set();
  for (const x of tutti(j)) {
    const t = x.track || x.item;
    if (!t || !t.uri) continue;
    const ctx = (x.context && x.context.uri) || '';
    const [, tipo, id] = ctx.split(':');
    let v = null;
    if (/:collection$/.test(ctx)) v = { tipo: 'preferiti', uri: ctx, id: 'preferiti', name: 'Brani che ti piacciono' };
    else if (tipo === 'playlist' && id) v = { tipo: 'playlist', uri: ctx, id };
    else if (tipo === 'artist' && id) v = { tipo: 'artist', uri: ctx, id, name: ((t.artists || []).find((a) => a.id === id) || {}).name || '' };
    else if (t.album && t.album.id) v = { tipo: 'album', uri: t.album.uri, id: t.album.id, name: t.album.name || '', img: bestImage(t.album.images, 300), artists: (t.album.artists || t.artists || []).map((a) => ({ id: a.id, name: a.name })) };
    if (!v || visti.has(v.uri)) continue;
    visti.add(v.uri);
    out.push(v);
    if (out.length >= 10) break;
  }
  // nomi e foto che il "recente" non porta: playlist e artisti, uno alla volta (sono pochi)
  for (const v of out) {
    if (v.tipo === 'playlist') {
      const p = await call(`playlists/${encodeURIComponent(v.id)}?fields=name,images,owner(display_name)`, {}, k).catch(tranneTroppe);
      if (p) { v.name = p.name || 'Playlist'; v.img = bestImage(p.images, 300); v.owner = (p.owner && p.owner.display_name) || ''; }
    } else if (v.tipo === 'artist') {
      const a = await call(`artists/${encodeURIComponent(v.id)}`, {}, k).catch(tranneTroppe);
      if (a) { v.name = a.name || v.name; v.img = bestImage(a.images, 300); }
    }
  }
  return out.filter((v) => v.name);
}
/** Gli artisti che ascolti di più nelle ultime settimane. */
export async function artistiDelMomento(k = chi()) {
  const j = (await call('me/top/artists?limit=10&time_range=short_term', {}, k)) || {};
  return tutti(j).map(artistaBreve).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Preferiti (la libreria di Spotify): brani, album, playlist
// ---------------------------------------------------------------------------
const salvatiMap = new Map();
export const salvato = (uri) => salvatiMap.get(uri);
/** Chiede a Spotify quali di questi sono già tra i preferiti (a gruppi di 40). */
export async function controllaSalvati(uris) {
  const da = [...new Set(uris.filter((u) => u && !salvatiMap.has(u)))];
  for (let i = 0; i < da.length; i += 40) {
    const parte = da.slice(i, i + 40);
    parte.forEach((u) => salvatiMap.set(u, false)); // intanto: così non lo richiedo di nuovo
    try {
      const j = await call(`me/library/contains?uris=${encodeURIComponent(parte.join(','))}`);
      if (Array.isArray(j)) parte.forEach((u, n) => salvatiMap.set(u, Boolean(j[n])));
    } catch { parte.forEach((u) => salvatiMap.delete(u)); return; }
  }
  if (da.length) rerender();
}
export async function salva(uri, si = true) {
  const prima = salvatiMap.get(uri);
  salvatiMap.set(uri, si);
  rerender();
  try {
    await call(`me/library?uris=${encodeURIComponent(uri)}`, { method: si ? 'PUT' : 'DELETE' });
  } catch (e) { salvatiMap.set(uri, prima); rerender(); throw e; }
  dimentica(chiave('preferiti'));
  if (uri.startsWith('spotify:album:')) dimentica(chiave('mieialbum'));
  if (uri.startsWith('spotify:artist:')) dimentica(chiave('seguiti'));
  if (uri.startsWith('spotify:playlist:')) caricaPlaylist(chi(), true).catch(() => {});
}

// ---------------------------------------------------------------------------
// Le nostre playlist: crearle, rinominarle, aggiungere e togliere brani
// ---------------------------------------------------------------------------
export async function nuovaPlaylist(name) {
  const p = await call('me/playlists', { method: 'POST', body: { name, public: false, description: '' } });
  await caricaPlaylist(chi(), true).catch(() => {});
  return p;
}
export async function rinomina(id, name) {
  await call(`playlists/${encodeURIComponent(id)}`, { method: 'PUT', body: { name } });
  dimentica(chiave('pl', id));
  await caricaPlaylist(chi(), true).catch(() => {});
}
export async function eliminaPlaylist(id) {
  await call(`me/library?uris=${encodeURIComponent(`spotify:playlist:${id}`)}`, { method: 'DELETE' });
  dimentica(chiave('pl', id));
  await caricaPlaylist(chi(), true).catch(() => {});
}
export async function aggiungiA(id, uris) {
  await call(`playlists/${encodeURIComponent(id)}/items`, { method: 'POST', body: { uris } });
  dimentica(chiave('pl', id));
  caricaPlaylist(chi(), true).catch(() => {});
}
export async function togliDa(id, uris) {
  await call(`playlists/${encodeURIComponent(id)}/items`, { method: 'DELETE', body: { items: uris.map((uri) => ({ uri })) } });
  dimentica(chiave('pl', id));
  caricaPlaylist(chi(), true).catch(() => {});
}

// ---------------------------------------------------------------------------
// Coda e "casuale" all'avvio
// ---------------------------------------------------------------------------
export async function inCoda(uri) {
  // la coda è quella di dove sta suonando
  const a = attivo();
  if (!a || !a.id) throw new SpotifyError('Scegli dove ascoltare', 0, 'NO_DEVICE');
  await call(`me/player/queue?uri=${encodeURIComponent(uri)}&device_id=${encodeURIComponent(a.id)}`, { method: 'POST' });
}
export async function suonaCasuale(target, d = doveSuonare()) {
  if (d === QUI) d = qui.id;
  if (!d) throw new SpotifyError('Scegli dove ascoltare', 0, 'NO_DEVICE');
  const casuale = () => call(`me/player/shuffle?state=true&device_id=${encodeURIComponent(d)}`, { method: 'PUT' }).then(() => true, () => false);
  const prima = await casuale();
  await suona(target, d);
  // un dispositivo appena acceso (es. questo iPhone) accetta "casuale" solo quando sta già suonando
  if (!prima) casuale();
  if (sp.player) { sp.player.shuffle_state = true; aspetta('shuffle', true); }
}

// ---------------------------------------------------------------------------
// Il lettore dentro l'app: questo iPhone/iPad diventa un dispositivo Spotify
// ---------------------------------------------------------------------------
export const qui = { player: null, id: null, chi: null, pronto: null };
let sdk = null;
/** Carica il lettore di Spotify (una volta sola, quando serve). */
export function caricaSdk() {
  if (window.Spotify) return Promise.resolve();
  if (sdk) return sdk;
  sdk = new Promise((ok, ko) => {
    window.onSpotifyWebPlaybackSDKReady = ok;
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.async = true;
    s.onerror = () => { sdk = null; ko(new SpotifyError('Il lettore di Spotify non si carica', 0, 'SDK')); };
    document.head.appendChild(s);
  });
  return sdk;
}
const idDa = (uri) => String(uri || '').split(':')[2] || '';
/** Il brano come lo descrive il lettore dentro l'app → come lo descrive Spotify. */
function daSdk(tr, dur) {
  return {
    uri: tr.uri, id: tr.id || idDa(tr.uri), name: tr.name || '', duration_ms: dur || tr.duration_ms || 0, type: tr.type || 'track',
    artists: (tr.artists || []).map((a) => ({ id: idDa(a.uri), name: a.name })),
    album: tr.album ? { id: idDa(tr.album.uri), name: tr.album.name || '', images: (tr.album.images || []).map((x) => ({ url: x.url, width: x.width || 300 })) } : null,
  };
}
/** La musica suona (o suonava pochi secondi fa: passaggio tra due brani) dentro l'app, su questo dispositivo. */
export const quiInUso = () => Boolean(qui.player && (qui.suona || Date.now() - (qui.suonavaAt || 0) < 15000));

/** Sta per partire qualcosa di nuovo (comando mandato, Spotify non l'ha ancora confermato). */
export const inArrivo = () => Boolean(attese.brano);
export const nomeQui = () => `Comperotto · ${isIPad() ? 'iPad' : /iPhone/.test(navigator.userAgent) ? 'iPhone' : 'web'}${myName() ? ` di ${myName()}` : ''}`;
export const eQui = (id) => Boolean(id && qui.id && id === qui.id);

let statoT;
/**
 * Prepara il lettore dentro l'app (senza farlo suonare): entrando in Musica, così al primo tocco
 * su un brano è già pronto e la musica parte subito da qui.
 */
export function preparaQui() {
  if (!window.Spotify) return caricaSdk().then(() => preparaQui());
  const k = chi();
  if (!k) return Promise.reject(new SpotifyError('Spotify non è collegato', 0));
  if (qui.player && qui.chi === k && qui.staccato) {
    // il lettore c'era ma si è staccato (es. l'app è rimasta in secondo piano): aspetto che torni pronto
    const player = qui.player;
    qui.staccato = false;
    qui.pronto = new Promise((ok, ko) => {
      const pronto = ({ device_id }) => { clearTimeout(t); player.removeListener && player.removeListener('ready', pronto); ok(device_id); };
      const t = setTimeout(() => { player.removeListener && player.removeListener('ready', pronto); qui.staccato = true; ko(new SpotifyError('Il lettore non risponde', 0, 'SDK')); }, 10000);
      player.addListener('ready', pronto);
    });
    player.connect();
    qui.pronto.catch(() => {});
  }
  if (!qui.player || qui.chi !== k) {
    if (qui.player) qui.player.disconnect();
    const player = new window.Spotify.Player({ name: nomeQui(), getOAuthToken: (cb) => { token(k, true).then(cb).catch(() => {}); }, volume: 0.8 });
    // a metà ascolto (es. dopo un'ora) Spotify può rifiutare il permesso: ne prendo uno nuovo e ricollego, una volta al minuto al massimo
    player.addListener('authentication_error', () => {
      if (qui.player !== player || !qui.id || Date.now() - (qui.ricollegato || 0) < 60000) return;
      qui.ricollegato = Date.now();
      delete tokens[k];
      player.connect();
    });
    qui.player = player;
    qui.chi = k;
    qui.id = null;
    qui.staccato = false;
    qui.pronto = new Promise((ok, ko) => {
      const t = setTimeout(() => ko(new SpotifyError('Il lettore non risponde', 0, 'SDK')), 15000);
      player.addListener('ready', ({ device_id }) => { clearTimeout(t); qui.id = device_id; qui.staccato = false; ok(device_id); });
      player.addListener('not_ready', () => { qui.id = null; qui.staccato = true; });
      for (const ev of ['initialization_error', 'authentication_error', 'account_error']) {
        player.addListener(ev, ({ message }) => { clearTimeout(t); ko(new SpotifyError(message, 0, ev)); });
      }
      // suona qui: lo stato arriva dal lettore stesso, subito e preciso (niente attese di Spotify)
      player.addListener('player_state_changed', (st) => {
        // sta suonando qui? (per non ricaricare l'app nel mezzo, anche tra un brano e l'altro)
        qui.suona = Boolean(st && !st.paused && st.track_window && st.track_window.current_track);
        if (qui.suona) qui.suonavaAt = Date.now();
        const p = sp.player;
        if (!st || !p || !eQui(p.device && p.device.id)) { clearTimeout(statoT); statoT = setTimeout(() => aggiorna(), 400); return; }
        const prima = firma(p);
        const tr = st.track_window && st.track_window.current_track;
        const tw = st.track_window || {};
        sp.prossimi = registra((tw.next_tracks || []).map((x) => brano(daSdk(x))).filter(Boolean));
        sp.prossimi.slice(0, 2).forEach(precaricaBrano);
        const att = attese.brano;
        if (att && att.valore.piu && att.valore.nuovo && tr && tr.uri !== att.valore.nuovo.uri && Date.now() - att.at < 3500) return; // brani di passaggio
        p.is_playing = !st.paused;
        p.progress_ms = st.position || 0;
        p.shuffle_state = Boolean(st.shuffle);
        p.repeat_state = ['off', 'context', 'track'][st.repeat_mode] || 'off';
        if (st.context && st.context.uri) p.context = { uri: st.context.uri };
        if (tr && (!p.item || p.item.uri !== tr.uri)) p.item = daSdk(tr, st.duration);
        sp.playerAt = Date.now();
        attese = {};
        aggiornaMediaSession();
        if (firma(p) !== prima) rerender();
      });
    });
    qui.pronto.catch((e) => {
      // browser che non lo regge, account senza Premium o senza permesso: qui non si riprova
      if (e && /^(initialization_error|account_error|authentication_error)$/.test(e.reason)) quiGuasto = e.reason;
      if (qui.player === player) { player.disconnect(); qui.player = null; qui.id = null; }
    });
    player.connect();
  }
  return qui.pronto;
}
/**
 * Accende il lettore dentro l'app. Va chiamata subito nel tocco: su iPhone e iPad l'audio
 * parte solo se il primo "play" arriva da un gesto (activateElement).
 */
export function attivaQui() {
  if (!window.Spotify) return caricaSdk().then(() => attivaQui());
  const pronto = preparaQui();
  if (qui.player && qui.player.activateElement) qui.player.activateElement();
  return pronto;
}

// ---------------------------------------------------------------------------
// Suggerimenti: musica a tema del periodo e "scelti per te"
// ---------------------------------------------------------------------------
/** Esegue fn su tutti, n alla volta. */
async function aGruppi(list, n, fn) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(...(await Promise.all(list.slice(i, i + n).map(fn))));
  return out;
}
/** Se Spotify chiede una pausa smetto: meglio riprovare dopo che tenere a mente una lista a metà. */
const tranneTroppe = (e) => { if (e && e.status === 429) throw e; return null; };

/** Trova su Spotify una lista di [titolo, artista] (2 ricerche alla volta). */
export async function trovaBrani(coppie) {
  const uno = async ([t, a]) => {
    for (const q of [`track:${t} artist:${a}`, `${t} ${a}`]) {
      const j = await call(`search?type=track&limit=1&market=from_token&q=${encodeURIComponent(q)}`).catch(tranneTroppe);
      const b = j && brano(tutti(j.tracks)[0]);
      if (b) return b;
    }
    return null;
  };
  const out = await aGruppi(coppie, 2, uno);
  const visti = new Set();
  return registra(out.filter((b) => b && !visti.has(b.uri) && visti.add(b.uri)));
}

/**
 * "Scelti per te": i tuoi artisti preferiti (dai brani salvati, o dalle tue playlist) → i loro brani più
 * ascoltati che non hai ancora salvato, e le loro uscite dell'ultimo anno.
 * (Spotify non dà più i "brani consigliati" alle app nuove: questo è il modo per avvicinarsi.)
 */
export async function perTe(k = chi()) {
  const piace = [];
  for (let o = 0; o < 150; o += 50) {
    const j = (await call(`me/tracks?limit=50&offset=${o}&market=from_token`, {}, k)) || {};
    piace.push(...tutti(j).map((x) => brano(x.item || x.track)).filter(Boolean));
    if (!j.next) break;
  }
  if (k === chi()) piace.forEach((t) => salvatiMap.set(t.uri, true)); // i cuori sono di chi si sta guardando
  if (piace.length < 10) {
    // pochi preferiti: guardo anche le sue playlist (e, se non bastano, cosa ha ascoltato di recente)
    const mie = ((sp.playlists[k] || {}).list || []).filter((p) => p.own).slice(0, 3);
    for (const p of mie) {
      const j = await call(`playlists/${encodeURIComponent(p.id)}/items?limit=50&market=from_token`, {}, k).catch(() => null);
      piace.push(...tutti(j).map((x) => brano(x.item || x.track)).filter(Boolean));
    }
    const acc = (sp.info && sp.info.account && sp.info.account[k]) || {};
    if (piace.length < 10 && acc.extra !== false) { // solo se il collegamento ha il permesso degli ascolti recenti
      const j = await call('me/player/recently-played?limit=50', {}, k).catch(() => null);
      piace.push(...tutti(j).map((x) => brano(x.track || x.item)).filter(Boolean));
    }
  }
  const conta = new Map();
  piace.forEach((t) => {
    const a = t.artists[0];
    if (!a || !a.id) return;
    conta.set(a.id, { ...a, n: ((conta.get(a.id) || {}).n || 0) + 1 });
  });
  const top = [...conta.values()].sort((a, b) => b.n - a.n).slice(0, 6);
  const gia = new Set(piace.map((t) => t.uri));
  const nomi = new Set(piace.map((t) => `${t.name}|${t.artists[0] && t.artists[0].id}`.toLowerCase()));
  const perArtista = await aGruppi(top, 2, async (a) => {
    const j = await call(`search?type=track&limit=10&market=from_token&q=${encodeURIComponent(`artist:"${a.name}"`)}`, {}, k).catch(tranneTroppe);
    return tutti(j && j.tracks).map((t) => brano(t))
      .filter((t) => t && t.ok && t.artists.some((x) => x.id === a.id) && !gia.has(t.uri) && !nomi.has(`${t.name}|${a.id}`.toLowerCase()))
      .slice(0, 3);
  });
  // un po' per artista, alternati
  const scelti = [];
  for (let r = 0; r < 3; r++) perArtista.forEach((l) => { if (l[r] && !scelti.some((x) => x.name === l[r].name)) scelti.push(l[r]); });
  // uscite dell'ultimo anno
  const limite = Date.now() - 365 * 86400000;
  const uscite = (a, g) => call(`artists/${encodeURIComponent(a.id)}/albums?include_groups=${g}&limit=5&market=from_token`, {}, k).then((j) => tutti(j).map(albumBreve)).catch((e) => tranneTroppe(e) || []);
  const nuovi = (await aGruppi(top, 2, async (a) => [...(await uscite(a, 'single')), ...(await uscite(a, 'album'))]))
    .flat()
    .filter((x) => x && Date.parse(x.data.length === 4 ? `${x.data}-01-01` : x.data) >= limite);
  const visti = new Set();
  const novita = nuovi.sort((a, b) => String(b.data).localeCompare(String(a.data))).filter((x) => !visti.has(x.name + x.artists.map((y) => y.id).join()) && visti.add(x.name + x.artists.map((y) => y.id).join())).slice(0, 10);
  return { scelti: registra(scelti.slice(0, 12)), novita, artisti: top.map(({ id, name }) => ({ id, name })) };
}
