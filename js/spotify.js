// Spotify dall'app: il server tiene i permessi (api/spotify.js), qui si parla direttamente con Spotify
// con un token che dura un'ora. Cosa suona e dove (iPhone, iPad, Echo…), comandi, ricerca, preferiti,
// playlist (anche crearle e modificarle), coda e il lettore dentro l'app (Web Playback SDK).
import { lsGet, lsSet, isIPad } from './utils.js';
import { store, isSynced, me, myName, rerender } from './core.js';

const API = 'https://api.spotify.com/v1/';
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
export const scegliAccount = (k) => { lsSet('casa.spotify.chi', k); sp.player = null; sp.devices = null; rerender(); aggiorna(); };

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
async function token(k, nuovo = false) {
  const t = tokens[k];
  if (!nuovo && t && t.scade - Date.now() > 60000) return t.token;
  try {
    const r = await store.call(`spotify?azione=token&chi=${k}`);
    tokens[k] = r;
    return r.token;
  } catch (e) {
    // permesso tolto da Spotify: la pagina torna a "Collega"
    if (/non è collegato/.test(e.message)) caricaInfo();
    throw e;
  }
}

export async function call(path, { method = 'GET', body } = {}, k = chi(), retry = true) {
  if (!k) throw new SpotifyError('Spotify non è collegato', 0);
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${await token(k, !retry)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && retry) return call(path, { method, body }, k, false);
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
// Stato del lettore, dispositivi, playlist
// ---------------------------------------------------------------------------
let inCorso = null;
/** Rilegge cosa suona e dove (e, se serve, i dispositivi). */
export async function aggiorna({ dispositivi = false } = {}) {
  if (!chi()) return;
  if (inCorso) { await inCorso; if (!dispositivi) return; }
  if (inCorso) return inCorso; // un'altra richiesta è partita nel frattempo
  inCorso = (async () => {
    try {
      const [p, d] = await Promise.all([
        call('me/player?additional_types=track,episode'),
        dispositivi || !sp.devices ? call('me/player/devices') : null,
      ]);
      sp.player = p && p.device ? p : null;
      sp.playerAt = Date.now();
      if (d) sp.devices = d.devices || [];
    } catch {
      // senza rete o troppe richieste: ci riprovo al prossimo giro
    } finally {
      inCorso = null;
      rerender();
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
  let path = 'me/playlists?limit=50';
  for (let i = 0; path && i < 6; i++) {
    const j = await call(path, {}, k);
    const io = await mioId(k);
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
// Comandi
// ---------------------------------------------------------------------------
export const dispositivoScelto = () => lsGet('casa.spotify.dev');
export const scegliDispositivo = (id) => lsSet('casa.spotify.dev', id);
export const attivo = () => (sp.player && sp.player.device) || (sp.devices || []).find((d) => d.is_active) || null;

/** Dove far partire la musica: quello che suona già, altrimenti l'ultimo scelto se è acceso. */
export function doveSuonare() {
  const a = attivo();
  if (a && a.id) return a.id;
  const s = dispositivoScelto();
  if (s && (sp.devices || []).some((d) => d.id === s)) return s;
  return null;
}

const ripassa = () => { setTimeout(() => aggiorna(), 600); setTimeout(() => aggiorna(), 2000); };

/** Fa partire una playlist/album (context) o dei brani (uris) su un dispositivo. */
export async function suona({ context, uris, offset }, device = doveSuonare()) {
  if (!device) throw new SpotifyError('Scegli dove ascoltare', 0, 'NO_DEVICE');
  const q = `me/player/play?device_id=${encodeURIComponent(device)}`;
  await call(q, { method: 'PUT', body: { ...(context ? { context_uri: context } : { uris }), ...(offset ? { offset } : {}) } });
  scegliDispositivo(device);
  if (sp.player) sp.player.is_playing = true;
  ripassa();
}

export async function sposta(device) {
  await call('me/player', { method: 'PUT', body: { device_ids: [device], play: true } });
  scegliDispositivo(device);
  const d = (sp.devices || []).find((x) => x.id === device);
  if (sp.player && d) sp.player = { ...sp.player, device: d, is_playing: true };
  ripassa();
}

export async function playPausa() {
  const p = sp.player;
  if (!p) return;
  const suonava = p.is_playing;
  p.is_playing = !suonava; // subito sullo schermo, poi confermo
  if (suonava) p.progress_ms = progresso();
  sp.playerAt = Date.now();
  rerender();
  try {
    // suona dentro l'app: comando diretto al lettore (su iPhone/iPad deve partire dal tocco)
    if (qui.player && eQui(p.device && p.device.id)) await qui.player.togglePlay();
    else await call(suonava ? 'me/player/pause' : 'me/player/play', { method: 'PUT' });
  } catch (e) { p.is_playing = suonava; rerender(); throw e; }
  ripassa();
}

export async function salta(avanti = true) {
  await call(avanti ? 'me/player/next' : 'me/player/previous', { method: 'POST' });
  ripassa();
}

export async function casuale() {
  const p = sp.player;
  if (!p) return;
  const on = !p.shuffle_state;
  p.shuffle_state = on;
  rerender();
  await call(`me/player/shuffle?state=${on}`, { method: 'PUT' });
}

let volT;
export function volume(v) {
  const p = sp.player;
  if (p && p.device) p.device.volume_percent = v;
  clearTimeout(volT);
  return new Promise((ok, ko) => {
    volT = setTimeout(() => call(`me/player/volume?volume_percent=${Math.round(v)}`, { method: 'PUT' }).then(ok, ko), 250);
  });
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
  return Math.min(ms, p.item.duration_ms || ms);
}

// ---------------------------------------------------------------------------
// Giro di aggiornamento mentre la pagina Musica è aperta
// ---------------------------------------------------------------------------
let giro = null;
export function avviaGiro() {
  if (giro) return;
  giro = setInterval(() => {
    if (!location.hash.startsWith('#/musica') || !chi()) { clearInterval(giro); giro = null; return; }
    if (!document.hidden) aggiorna();
  }, 5000);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !location.hash.startsWith('#/musica')) return;
  // di ritorno (es. dalla pagina di Spotify): rileggo account e lettore
  caricaInfo().then(() => { if (chi()) { aggiorna({ dispositivi: true }); caricaPlaylist(); avviaGiro(); } });
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
/** Legge una volta e tiene a mente per qualche minuto; ridisegna la pagina quando arriva. */
export function leggi(key, fn, { maxAge = 5 * 60000, forza = false } = {}) {
  const c = cache.get(key);
  if (!forza && c && Date.now() - c.at < maxAge) return Promise.resolve(c.data);
  if (inVolo.has(key)) return inVolo.get(key);
  errori.delete(key);
  const pr = fn()
    .then((data) => { cache.set(key, { at: Date.now(), data }); return data; })
    .catch((e) => { errori.set(key, e); throw e; })
    .finally(() => { inVolo.delete(key); rerender(); });
  inVolo.set(key, pr);
  return pr;
}
export function dimentica(prefix) {
  for (const m of [cache, errori]) for (const k of [...m.keys()]) if (k.startsWith(prefix)) m.delete(k);
}
export const chiave = (...parti) => [chi(), ...parti].join(':');

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
    ok: t.is_playable !== false && !t.is_local,
  };
}
export const albumBreve = (a) => a && ({ id: a.id, uri: a.uri, name: a.name || '', img: bestImage(a.images, 300), anno: String(a.release_date || '').slice(0, 4), artists: (a.artists || []).map((x) => ({ id: x.id, name: x.name })), tipo: a.album_type || '' });
export const artistaBreve = (a) => a && ({ id: a.id, uri: a.uri, name: a.name || '', img: bestImage(a.images, 300) });
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
const registra = (list) => { list.forEach((t) => t && brani.set(t.uri, t)); return list; };

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
    artist: tutti(j.artists).map(artistaBreve),
    album: tutti(j.albums).map(albumBreve),
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

export async function album(id) {
  const a = await call(`albums/${encodeURIComponent(id)}?market=from_token`);
  const tracce = a.tracks || a.items || {};
  return { info: { ...albumBreve(a), big: bestImage(a.images, 600) }, list: registra(tutti(tracce).map((t) => brano(t, a)).filter(Boolean)) };
}

export async function artista(id) {
  const [a, al] = await Promise.all([
    call(`artists/${encodeURIComponent(id)}`),
    call(`artists/${encodeURIComponent(id)}/albums?include_groups=album,single,compilation&limit=30&market=from_token`).catch(() => null),
  ]);
  return { info: { ...artistaBreve(a), big: bestImage(a.images, 600) }, albums: tutti(al).map(albumBreve) };
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
  const d = doveSuonare();
  if (!d) throw new SpotifyError('Scegli dove ascoltare', 0, 'NO_DEVICE');
  await call(`me/player/queue?uri=${encodeURIComponent(uri)}&device_id=${encodeURIComponent(d)}`, { method: 'POST' });
}
export async function suonaCasuale(target, d = doveSuonare()) {
  if (!d) throw new SpotifyError('Scegli dove ascoltare', 0, 'NO_DEVICE');
  await call(`me/player/shuffle?state=true&device_id=${encodeURIComponent(d)}`, { method: 'PUT' }).catch(() => {});
  await suona(target, d);
  if (sp.player) sp.player.shuffle_state = true;
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
export const nomeQui = () => `Comperotto · ${isIPad() ? 'iPad' : /iPhone/.test(navigator.userAgent) ? 'iPhone' : 'web'}${myName() ? ` di ${myName()}` : ''}`;
export const eQui = (id) => Boolean(id && qui.id && id === qui.id);

let statoT;
/**
 * Accende il lettore dentro l'app. Va chiamata subito nel tocco: su iPhone e iPad l'audio
 * parte solo se il primo "play" arriva da un gesto (activateElement).
 */
export function attivaQui() {
  if (!window.Spotify) return caricaSdk().then(() => attivaQui());
  const k = chi();
  if (!qui.player || qui.chi !== k) {
    if (qui.player) qui.player.disconnect();
    const player = new window.Spotify.Player({ name: nomeQui(), getOAuthToken: (cb) => { token(k).then(cb).catch(() => {}); }, volume: 0.8 });
    qui.player = player;
    qui.chi = k;
    qui.id = null;
    qui.pronto = new Promise((ok, ko) => {
      const t = setTimeout(() => ko(new SpotifyError('Il lettore non risponde', 0, 'SDK')), 15000);
      player.addListener('ready', ({ device_id }) => { clearTimeout(t); qui.id = device_id; ok(device_id); });
      player.addListener('not_ready', () => { qui.id = null; });
      for (const ev of ['initialization_error', 'authentication_error', 'account_error']) {
        player.addListener(ev, ({ message }) => { clearTimeout(t); ko(new SpotifyError(message, 0, ev)); });
      }
      // cosa suona cambia subito sullo schermo (senza aspettare il prossimo giro)
      player.addListener('player_state_changed', () => { clearTimeout(statoT); statoT = setTimeout(() => aggiorna(), 400); });
    });
    qui.pronto.catch(() => { if (qui.player === player) { player.disconnect(); qui.player = null; } });
    player.connect();
  }
  if (qui.player.activateElement) qui.player.activateElement();
  return qui.pronto;
}
