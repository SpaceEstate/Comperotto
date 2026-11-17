// Spotify dall'app: il server tiene i permessi (api/spotify.js), qui si parla direttamente con Spotify
// con un token che dura un'ora. Playlist, cosa suona, dispositivi (iPhone, iPad, Echo…) e comandi.
import { lsGet, lsSet } from './utils.js';
import { store, isSynced, me, rerender } from './core.js';

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
    (j.items || []).filter(Boolean).forEach((p) => list.push({
      id: p.id,
      uri: p.uri,
      name: p.name || '',
      img: bestImage(p.images, 300),
      n: (p.items && p.items.total) ?? (p.tracks && p.tracks.total) ?? null,
      owner: (p.owner && p.owner.display_name) || '',
    }));
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
  await call(q, { method: 'PUT', body: context ? { context_uri: context, ...(offset ? { offset } : {}) } : { uris } });
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
  try { await call(suonava ? 'me/player/pause' : 'me/player/play', { method: 'PUT' }); } catch (e) { p.is_playing = suonava; rerender(); throw e; }
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
