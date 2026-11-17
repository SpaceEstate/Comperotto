// Il lettore musicale di casa: uno solo per tutta l'app, sempre lo stesso.
//
// Com'era prima: ogni brano apriva il suo lettore Spotify dentro la lista. Cambiando pagina si
// spegneva, certi ridisegni della pagina lo ricreavano da capo, e due lettori potevano suonare insieme.
//
// Com'è adesso:
//  • lo STATO qui sotto (S) è l'unica fonte di verità: mini lettore e lettore grande si disegnano da lì;
//  • tutti i comandi (play, pausa, avanti, indietro, posizione) passano da queste funzioni, mai
//    direttamente al "motore";
//  • i motori (Spotify con la sua iFrame API ufficiale, oppure l'audio del dispositivo per file e radio)
//    mandano solo eventi; quelli di un brano precedente vengono scartati (contatore "giro"),
//    così non ci sono salti avanti-indietro;
//  • dopo un comando aspetto la conferma del motore e intanto ignoro gli aggiornamenti vecchi
//    (Spotify, subito dopo un seek, rimanda ancora la posizione di prima: era la causa dei salti);
//  • il lettore vive fuori dalle pagine (in fondo al <body>): navigando la musica continua.
import { html, lsGet, lsSet, vibrate } from './utils.js';
import { icon } from './icons.js';

// ---------------------------------------------------------------------------
// Da un link al "motore" giusto
// ---------------------------------------------------------------------------
const SPOTIFY_RE = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,40})/;
const AUDIO_RE = /\.(mp3|m4a|aac|oga|ogg|opus|wav|flac)(?:[?#].*)?$/i;

/** { kind: 'track'|'album'|…, id, uri, url } da un link di Spotify, altrimenti null */
export function spotifyRef(link) {
  const m = String(link || '').trim().match(SPOTIFY_RE);
  return m ? { kind: m[1], id: m[2], uri: `spotify:${m[1]}:${m[2]}`, url: `https://open.spotify.com/${m[1]}/${m[2]}` } : null;
}

/** Cosa può suonare il lettore per questa voce della nostra musica (null = solo link esterno). */
export function sorgente(m) {
  const sp = spotifyRef(m && m.link);
  if (sp) return { engine: 'spotify', uri: sp.uri, open: sp.url, kind: sp.kind };
  const u = String((m && m.link) || '').trim();
  if (/^https:\/\/[^\s]+$/i.test(u) && (m.type === 'radio' || AUDIO_RE.test(u))) return { engine: 'audio', url: u, open: u, kind: m.type === 'radio' ? 'radio' : 'file' };
  return null;
}

const CONTENITORI = new Set(['album', 'playlist', 'artist', 'show']); // dentro ci sono più brani

// ---------------------------------------------------------------------------
// Stato (l'unica fonte di verità)
// ---------------------------------------------------------------------------
const now = () => performance.now();
const S = {
  queue: [],        // [{ id, title, artist, cover, type, engine, uri|url, open, kind }]
  index: -1,
  context: '',      // es. "La nostra musica · Natale"
  status: 'idle',   // idle | loading | playing | paused | ended | error
  buffering: false,
  blocked: false,   // il browser vuole un tocco diretto sul lettore (Safari)
  pos: 0,           // posizione in ms all'istante posAt
  posAt: 0,
  dur: 0,           // durata in ms (0 = non ancora nota)
  live: false,      // radio in diretta: niente durata
  preview: false,   // Spotify senza accesso: anteprima di 30 secondi
  seek: null,       // { to, until }: dopo un seek ignoro le posizioni vecchie
  intent: null,     // { paused, until }: dopo play/pausa ignoro gli stati vecchi
  drag: null,       // ms sotto il dito mentre si trascina la barra
  err: '',
  gen: 0,           // "giro": cresce a ogni cambio brano, gli eventi dei giri vecchi si scartano
  loaded: 0,        // giro per cui il motore ha davvero caricato il brano (0 = da caricare)
  attesaPlay: 0,    // numero dell'ultimo comando "play" non ancora confermato dal motore (0 = nessuno)
  vuoi: null,       // { paused, at }: l'ultima cosa chiesta dall'utente (per rimediare a un play partito in ritardo)
  expanded: false,
  // possibilità del dispositivo (solo per l'audio diretto)
  canVolume: false,
  volume: 1,
  airplay: false,
  outputs: [],      // uscite audio elencabili (setSinkId)
  sinkId: '',
};
const cur = () => S.queue[S.index] || null;
const playing = () => S.status === 'playing' || (S.status === 'loading' && !S.blocked);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Posizione attuale (stimata tra un aggiornamento e l'altro, così la barra scorre fluida). */
function position() {
  if (S.drag != null) return S.drag;
  if (S.status !== 'playing' || S.buffering) return S.pos;
  const p = S.pos + (now() - S.posAt);
  return S.dur ? Math.min(p, S.dur) : p;
}

// chi deve sapere che è cambiato il brano o lo stato (la pagina Musica evidenzia la riga)
const ascolta = new Set();
let ultimaChiave = '';
export const onChange = (fn) => { ascolta.add(fn); return () => ascolta.delete(fn); };
function avvisa() {
  const t = cur();
  const k = `${t ? t.id : ''}|${S.status}|${S.blocked}`;
  if (k === ultimaChiave) return;
  ultimaChiave = k;
  ascolta.forEach((fn) => { try { fn(); } catch {} });
}

/** Per il resto dell'app: cosa sta suonando. */
export function nowPlaying() {
  const t = cur();
  return t ? { id: t.id, status: S.status, playing: playing() } : null;
}
export const isPlaying = () => Boolean(cur()) && playing();

// ---------------------------------------------------------------------------
// Motore 1: Spotify (iFrame API ufficiale). Un solo riquadro, creato una volta e mai ricreato.
// ---------------------------------------------------------------------------
const spotify = {
  api: null,
  ctrl: null,
  creating: null,
  host: null,
  creato: '',         // il brano con cui è nato il riquadro
  attesaReady: false, // dopo loadEntity il riquadro si riavvia: finché non è pronto scarto gli eventi
  attesaDa: 0,
  loadApi() {
    if (window.SpotifyIframeApi) return Promise.resolve(window.SpotifyIframeApi);
    if (!this.api) {
      this.api = new Promise((ok, ko) => {
        const prima = window.onSpotifyIframeApiReady;
        window.onSpotifyIframeApiReady = (API) => {
          window.SpotifyIframeApi = API;
          ok(API);
          if (typeof prima === 'function') { try { prima(API); } catch {} }
        };
        const s = document.createElement('script');
        s.src = 'https://open.spotify.com/embed/iframe-api/v1';
        s.async = true;
        s.onerror = () => { this.api = null; s.remove(); ko(new Error('Spotify non raggiungibile')); };
        document.head.appendChild(s);
        setTimeout(() => ko(new Error('Spotify non risponde')), 20000);
      });
    }
    return this.api;
  },
  ensure(uri, height) {
    if (this.ctrl) return Promise.resolve(this.ctrl);
    if (!this.creating) {
      this.creating = this.loadApi().then((API) => new Promise((ok) => {
        const el = document.createElement('div');
        this.host.replaceChildren(el);
        this.attesaReady = true;
        this.attesaDa = now();
        this.creato = uri;
        API.createController(el, { uri, width: '100%', height }, (c) => {
          c.addListener('ready', () => evento('spotify', 'ready'));
          c.addListener('playback_update', (e) => evento('spotify', 'update', e && e.data));
          c.addListener('playback_started', (e) => evento('spotify', 'started', e && e.data));
          this.ctrl = c;
          const f = this.host.querySelector('iframe');
          if (f) { f.setAttribute('title', 'Lettore Spotify'); f.style.width = '100%'; }
          ok(c);
        });
      })).catch((e) => { this.creating = null; throw e; });
    }
    return this.creating;
  },
  altezza(h) {
    const f = this.host && this.host.querySelector('iframe');
    if (f && f.getAttribute('height') !== String(h)) { f.setAttribute('height', String(h)); f.style.height = `${h}px`; }
  },
  // Regole provate sul riquadro di Spotify: play() prima del "pronto" viene messo in coda (va bene);
  // seek() prima che il brano parta viene ignorato; pause() prima che parta dà errore
  // ("no list was loaded"). Quindi pausa e seek solo dopo che il brano è partito davvero.
  suonato: false,
  ultimaPausa: 0,
  carica(uri, startAt) { if (this.ctrl) { this.attesaReady = true; this.attesaDa = now(); this.suonato = false; this.ctrl.loadEntity(uri, false, startAt || 0); } },
  // eventi del brano di prima: li scarto finché il riquadro non dice "pronto" (al massimo 4 s, per sicurezza)
  inAttesa() { if (this.attesaReady && now() - this.attesaDa > 4000) this.attesaReady = false; return this.attesaReady; },
  play() { if (this.ctrl) this.ctrl.play(); },
  resume() { if (this.ctrl) this.ctrl.resume(); },
  pause() { if (this.ctrl && this.suonato) { this.ultimaPausa = now(); this.ctrl.pause(); } },
  seek(sec) { if (this.ctrl && this.suonato) this.ctrl.seek(Math.max(0, Math.round(sec))); },
};

// ---------------------------------------------------------------------------
// Motore 2: l'audio del dispositivo (file audio e radio in diretta). Volume e uscita audio solo qui.
// ---------------------------------------------------------------------------
const audio = {
  el: null,
  get() {
    if (this.el) return this.el;
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.setAttribute('playsinline', '');
    a.setAttribute('x-webkit-airplay', 'allow');
    ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'playing', 'pause', 'waiting', 'stalled', 'canplay', 'ended', 'error', 'seeked'].forEach((t) => a.addEventListener(t, () => evento('audio', t)));
    if (window.WebKitPlaybackTargetAvailabilityEvent) {
      a.addEventListener('webkitplaybacktargetavailabilitychanged', (e) => { S.airplay = e.availability === 'available'; disegna(); });
    }
    // il volume si può cambiare? (su iPhone e iPad no: si usano i tasti laterali)
    try { a.volume = 0.5; S.canVolume = Math.abs(a.volume - 0.5) < 0.01; a.volume = 1; } catch { S.canVolume = false; }
    root.appendChild(a);
    this.el = a;
    return a;
  },
  carica(url, startAt) {
    const a = this.get();
    this.inizio = startAt || 0;
    a.src = url;
    a.load();
  },
  play() {
    const a = this.get();
    const g = S.gen;
    const p = a.play();
    if (p && p.catch) {
      p.catch((e) => {
        if (g !== S.gen) return; // nel frattempo è cambiato brano: niente da dire
        if (e && e.name === 'AbortError') return;
        if (e && e.name === 'NotAllowedError') { bloccato(); return; }
        errore('Non riesco a riprodurre questo audio');
      });
    }
  },
  pause() { if (this.el) this.el.pause(); },
  seek(sec) { const a = this.el; if (!a) return; try { a.currentTime = sec; } catch {} },
  ferma() {
    const a = this.el;
    if (!a) return;
    a.pause();
    if (a.getAttribute('src')) { a.removeAttribute('src'); a.load(); }
  },
};

// ---------------------------------------------------------------------------
// Eventi dei motori → stato
// ---------------------------------------------------------------------------
let fineT = null;   // in playlist e album aspetto un attimo: magari Spotify passa da solo al brano dopo
let bloccoT = null; // se il play non viene confermato, il browser vuole un tocco
let fineGiro = 0;   // giro già concluso (l'avanzamento automatico parte una volta sola)

function evento(motore, tipo, d) {
  const t = cur();
  // un play di Spotify rimasto in coda che parte quando ormai suona altro: lo fermo subito (mai due brani insieme)
  if (motore === 'spotify' && tipo === 'update' && d && !d.isPaused && d.playingURI && (!t || t.engine !== 'spotify')) {
    spotify.suonato = true;
    if (now() - spotify.ultimaPausa > 1200) spotify.pause();
    return;
  }
  if (!t || t.engine !== motore || S.loaded !== S.gen) return;
  if (motore === 'spotify') return eventoSpotify(t, tipo, d || {});
  return eventoAudio(t, tipo);
}

function confermaPlay(paused) {
  // un comando appena dato vince sugli stati vecchi in arrivo
  if (S.intent && now() < S.intent.until && S.intent.paused !== paused) return false;
  S.intent = null;
  if (!paused) { S.blocked = false; S.attesaPlay = 0; clearTimeout(bloccoT); }
  return true;
}

/** Il browser non ha lasciato partire l'audio senza un tocco diretto (succede con Safari). */
function bloccato() {
  S.blocked = true;
  S.status = 'paused';
  S.buffering = false;
  S.intent = null;
  S.attesaPlay = 0;
  clearTimeout(bloccoT);
  const t = cur();
  if (t && t.engine === 'spotify' && !S.expanded) espandi(); // il tocco va dato nel riquadro di Spotify
  disegna();
  avvisa();
}

function eventoSpotify(t, tipo, d) {
  if (tipo === 'ready') { spotify.attesaReady = false; return; }
  if (spotify.inAttesa()) return; // eventi del brano di prima
  if (tipo === 'started') {
    clearTimeout(fineT);
    return;
  }
  if (tipo !== 'update') return;
  const contenitore = CONTENITORI.has(t.kind);
  if (!d.playingURI) { S.buffering = true; disegna(); return; } // sta caricando
  if (!contenitore && d.playingURI !== t.uri) return; // un brano diverso da quello chiesto: vecchio
  // coda finita: gli ultimi aggiornamenti di Spotify (fermo sull'ultimo istante) non lo rimettono "in riproduzione"
  if (S.status === 'ended' && fineGiro === S.gen && d.position >= (S.dur || d.duration) - 1500) return;
  if (!d.isPaused) {
    spotify.suonato = true;
    // l'utente aveva messo pausa mentre il play era ancora in coda: lo rimetto in pausa io
    if (S.vuoi && S.vuoi.paused && now() - S.vuoi.at < 10000 && now() - spotify.ultimaPausa > 1200) spotify.pause();
  }
  if (d.duration > 0) S.dur = d.duration;
  S.preview = !contenitore && t.kind === 'track' && S.dur > 0 && S.dur <= 30500;
  S.buffering = Boolean(d.isBuffering);
  // posizione: dopo un seek scarto quelle lontane dal punto chiesto, per un paio di secondi
  let posOk = true;
  if (S.seek) {
    if (Math.abs(d.position - S.seek.to) <= 1600 || now() > S.seek.until) S.seek = null;
    else posOk = false;
  }
  if (posOk && S.drag == null) { S.pos = d.position; S.posAt = now(); }
  if (confermaPlay(Boolean(d.isPaused))) {
    if (d.isPaused) { if (S.status !== 'ended') S.status = 'paused'; }
    else S.status = 'playing';
  }
  // fine del brano: Spotify si ferma sull'ultimo istante senza dire "pausa"
  if (S.dur > 0 && d.position >= S.dur - 350 && posOk) {
    if (fineGiro !== S.gen) {
      clearTimeout(fineT);
      const g = S.gen;
      fineT = setTimeout(() => { if (g === S.gen) finito(); }, contenitore ? 3000 : 250);
    }
  }
  disegna();
  avvisa();
}

function eventoAudio(t, tipo) {
  const a = audio.el;
  if (!a) return;
  if (tipo === 'error') {
    // svuotato da me, o un caricamento interrotto perché nel frattempo si è scelto altro
    if (!a.getAttribute('src') || !a.error || a.error.code === 1) return;
    errore(t.kind === 'radio' ? 'La radio non risponde: riprova tra poco' : 'Questo file audio non si apre');
    return;
  }
  const d = a.duration;
  S.live = d === Infinity || t.kind === 'radio';
  S.dur = Number.isFinite(d) && !S.live ? d * 1000 : 0;
  if (tipo === 'loadedmetadata' && audio.inizio && !S.live) { try { a.currentTime = audio.inizio; } catch {} audio.inizio = 0; }
  if (tipo === 'waiting' || tipo === 'stalled') S.buffering = !a.paused;
  if (tipo === 'playing' || tipo === 'canplay' || tipo === 'seeked') S.buffering = false;
  if (S.seek && (tipo === 'seeked' || now() > S.seek.until)) S.seek = null;
  if (!S.seek && S.drag == null) { S.pos = a.currentTime * 1000; S.posAt = now(); }
  if (tipo === 'playing' || tipo === 'play') { if (confermaPlay(false)) S.status = 'playing'; }
  if (tipo === 'pause' && !a.ended) { if (confermaPlay(true) && S.status !== 'loading') S.status = 'paused'; }
  if (tipo === 'ended') { finito(); return; }
  mediaSession();
  disegna();
  avvisa();
}

function errore(msg) {
  S.err = msg;
  S.status = 'error';
  S.buffering = false;
  S.intent = null;
  S.attesaPlay = 0;
  clearTimeout(bloccoT);
  disegna();
  avvisa();
}

/** Brano finito: si passa al successivo (una volta sola per giro). */
function finito() {
  if (fineGiro === S.gen) return;
  fineGiro = S.gen;
  if (S.index < S.queue.length - 1) { avvia(S.index + 1, { autoplay: true }); return; }
  S.status = 'ended';
  S.pos = S.dur;
  S.posAt = now();
  disegna();
  avvisa();
  salva();
}

// ---------------------------------------------------------------------------
// Comandi (gli unici modi per toccare l'audio)
// ---------------------------------------------------------------------------
function zittisciAltri(t) {
  if (t.engine !== 'audio') audio.ferma();
  if (t.engine !== 'spotify' && spotify.ctrl) spotify.pause();
}

function avvia(i, { autoplay = true, startAt = 0 } = {}) {
  const t = S.queue[i];
  if (!t) return;
  S.index = i;
  S.gen += 1;
  S.loaded = 0;
  S.status = autoplay ? 'loading' : 'paused';
  S.pos = startAt * 1000;
  S.posAt = now();
  S.dur = 0;
  S.live = t.kind === 'radio';
  S.preview = false;
  S.buffering = autoplay;
  S.blocked = false;
  S.seek = null;
  S.intent = null;
  S.attesaPlay = 0;
  S.vuoi = { paused: !autoplay, at: now() };
  S.err = '';
  clearTimeout(fineT);
  clearTimeout(bloccoT);
  zittisciAltri(t);
  const g = S.gen;
  if (t.engine === 'audio') {
    S.loaded = g;
    audio.carica(t.url, startAt);
    if (autoplay) { controllaBlocco(); audio.play(); }
  } else {
    const h = CONTENITORI.has(t.kind) ? 352 : 80;
    if (spotify.ctrl) {
      S.loaded = g;
      spotify.altezza(h);
      spotify.carica(t.uri, startAt);
      if (autoplay) { controllaBlocco(); spotify.play(); }
    } else {
      spotify.ensure(t.uri, h).then(() => {
        if (g !== S.gen) return; // nel frattempo si è scelto altro: ci pensa il suo avvio
        S.loaded = g;
        spotify.altezza(h);
        // il riquadro è nato con un altro brano (scelto mentre Spotify si preparava) o deve partire da un punto preciso
        if (spotify.creato !== t.uri || startAt) spotify.carica(t.uri, startAt);
        if (autoplay) attendiPronto(g, () => { spotify.play(); controllaBlocco(); });
      }).catch((e) => { if (g === S.gen) errore(e.message || 'Spotify non raggiungibile'); });
    }
  }
  mediaSession();
  disegna();
  avvisa();
  salva();
}

// la prima volta il riquadro di Spotify deve finire di prepararsi prima del play
function attendiPronto(g, fn) {
  const t0 = now();
  const prova = () => {
    if (g !== S.gen) return;
    if (!spotify.attesaReady || now() - t0 > 8000) { fn(); return; }
    setTimeout(prova, 120);
  };
  prova();
}

/**
 * Se dopo qualche secondo il motore non ha confermato QUESTO play, il browser vuole un tocco diretto
 * (Safari blocca l'audio fatto partire "da fuori"). Una rete lenta invece conferma subito
 * ("sto caricando, non in pausa"), quindi non si confonde con il blocco.
 */
let comandi = 0;
function controllaBlocco() {
  const n = ++comandi;
  S.attesaPlay = n;
  clearTimeout(bloccoT);
  bloccoT = setTimeout(() => { if (S.attesaPlay === n && cur()) bloccato(); }, 5000);
}

/** Suona una voce, con la sua "coda" (la lista com'è adesso sullo schermo). */
export function playItem(id, list, context = '') {
  const q = (list || []).filter(Boolean);
  const i = q.findIndex((x) => x.id === id);
  if (i < 0) return;
  const t = cur();
  if (t && t.id === id && S.status !== 'error') { toggle(); return; }
  S.queue = q;
  S.context = context;
  fineGiro = 0;
  vibrate(6);
  avvia(i, { autoplay: true });
}

export function toggle() {
  const t = cur();
  if (!t) return;
  vibrate(6);
  if (playing()) { pausa(); return; }
  if (S.status === 'ended' || S.status === 'error' || S.loaded !== S.gen) {
    // finito, in errore o ripreso dopo un riavvio dell'app: ricarico (dal punto in cui era)
    const da = S.status === 'ended' || S.status === 'error' || S.live ? 0 : Math.floor(S.pos / 1000);
    fineGiro = 0;
    avvia(S.index, { autoplay: true, startAt: da });
    return;
  }
  S.status = 'loading';
  S.blocked = false;
  S.intent = { paused: false, until: now() + 1800 };
  S.vuoi = { paused: false, at: now() };
  controllaBlocco();
  if (t.engine === 'audio') audio.play(); else spotify.resume();
  disegna();
  avvisa();
}

function pausa() {
  const t = cur();
  if (!t) return;
  S.pos = position();
  S.posAt = now();
  S.status = 'paused';
  S.buffering = false;
  S.intent = { paused: true, until: now() + 1800 };
  S.vuoi = { paused: true, at: now() };
  S.attesaPlay = 0;
  clearTimeout(bloccoT);
  if (t.engine === 'audio') audio.pause(); else spotify.pause();
  disegna();
  avvisa();
  salva();
}
export const pause = () => { if (playing()) pausa(); };

export function next() {
  if (S.index < S.queue.length - 1) { vibrate(6); fineGiro = 0; avvia(S.index + 1, { autoplay: true }); }
}
export function prev() {
  vibrate(6);
  if (!S.live && position() > 3500) { seekTo(0); return; } // come sui lettori veri: prima torna all'inizio
  if (S.index > 0) { fineGiro = 0; avvia(S.index - 1, { autoplay: true }); } else seekTo(0);
}
export function jump(i) {
  if (i >= 0 && i < S.queue.length && i !== S.index) { vibrate(6); fineGiro = 0; avvia(i, { autoplay: true }); }
}

export function seekTo(ms) {
  const t = cur();
  if (!t || S.live) return;
  ms = clamp(ms, 0, S.dur ? Math.max(0, S.dur - 600) : ms);
  S.pos = ms;
  S.posAt = now();
  if (S.status === 'ended') S.status = 'paused';
  if (S.loaded === S.gen && t.engine === 'spotify' && !spotify.suonato) {
    // il riquadro di Spotify non ha ancora fatto partire il brano: lo ricarico da quel punto
    avvia(S.index, { autoplay: S.status === 'loading' || S.status === 'playing', startAt: Math.floor(ms / 1000) });
    return;
  }
  if (S.loaded === S.gen && S.dur) {
    S.seek = { to: ms, until: now() + 2500 };
    if (t.engine === 'audio') audio.seek(ms / 1000); else spotify.seek(ms / 1000);
  }
  fineGiro = 0;
  disegna();
  salva();
}

/** Chiude il lettore: la musica si ferma e il mini lettore sparisce. */
export function close() {
  clearTimeout(fineT);
  clearTimeout(bloccoT);
  audio.ferma();
  if (spotify.ctrl) spotify.pause();
  S.gen += 1;
  S.queue = [];
  S.index = -1;
  S.status = 'idle';
  S.blocked = false;
  S.err = '';
  riduci();
  lsSet('casa.player', null);
  disegna();
  avvisa();
}

/** Titoli, artisti e copertine cambiati nella nostra musica: aggiorno la coda senza fermare nulla. */
export function aggiornaVoci(fn) {
  let cambiato = false;
  S.queue = S.queue.map((t) => {
    const n = fn(t.id);
    if (!n) return t;
    const x = { ...t, title: n.title, artist: n.artist, cover: n.cover || t.cover };
    if (x.title !== t.title || x.artist !== t.artist || x.cover !== t.cover) cambiato = true;
    return x;
  });
  if (cambiato) { disegna(); mediaSession(); salva(); }
}

// ---------------------------------------------------------------------------
// Volume e uscita audio (solo dove funzionano davvero)
// ---------------------------------------------------------------------------
export function setVolume(v) {
  S.volume = clamp(v, 0, 1);
  if (audio.el) audio.el.volume = S.volume;
  lsSet('casa.player.vol', String(S.volume));
}

async function elencaUscite() {
  S.outputs = [];
  try {
    if (!('setSinkId' in HTMLMediaElement.prototype) || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput' && d.label);
    // ha senso solo se c'è davvero da scegliere
    if (list.length > 1) S.outputs = list.map((d) => ({ id: d.deviceId, label: d.label }));
  } catch {}
}

export async function scegliUscita(id) {
  const a = audio.get();
  try {
    if (id === '__picker' && navigator.mediaDevices && navigator.mediaDevices.selectAudioOutput) {
      const d = await navigator.mediaDevices.selectAudioOutput();
      id = d.deviceId;
    }
    await a.setSinkId(id);
    S.sinkId = id;
    lsSet('casa.player.sink', id || null);
  } catch {
    S.sinkId = a.sinkId || '';
  }
  disegna();
}

// ---------------------------------------------------------------------------
// Comandi dalla schermata bloccata e dalle cuffie (solo per l'audio diretto:
// con Spotify li gestisce il suo riquadro)
// ---------------------------------------------------------------------------
let msPronta = false;
function mediaSession() {
  if (!('mediaSession' in navigator)) return;
  const t = cur();
  const ms = navigator.mediaSession;
  if (!t || t.engine !== 'audio') { if (msPronta) { ms.metadata = null; } return; }
  try {
    ms.metadata = new window.MediaMetadata({ title: t.title, artist: t.artist || '', album: S.context || 'Fam. Comperotto', artwork: t.cover ? [{ src: t.cover, sizes: '300x300' }] : [{ src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    if (!msPronta) {
      msPronta = true;
      ms.setActionHandler('play', () => { if (!playing()) toggle(); });
      ms.setActionHandler('pause', () => pause());
      ms.setActionHandler('previoustrack', () => prev());
      ms.setActionHandler('nexttrack', () => next());
      try { ms.setActionHandler('seekto', (d) => { if (d && Number.isFinite(d.seekTime)) seekTo(d.seekTime * 1000); }); } catch {}
    }
    if (S.dur && ms.setPositionState) ms.setPositionState({ duration: S.dur / 1000, position: clamp(position(), 0, S.dur) / 1000, playbackRate: 1 });
  } catch {}
}

// ---------------------------------------------------------------------------
// Ricordo cosa stava suonando (riaprendo l'app il mini lettore è lì, in pausa)
// ---------------------------------------------------------------------------
let salvatoAt = 0;
function salva() {
  salvatoAt = now();
  const t = cur();
  if (!t) { lsSet('casa.player', null); return; }
  lsSet('casa.player', JSON.stringify({ q: S.queue.slice(0, 200), i: S.index, c: S.context, p: S.live ? 0 : Math.round(position()) }));
}
function ripristina() {
  try {
    const x = JSON.parse(lsGet('casa.player') || 'null');
    if (!x || !Array.isArray(x.q) || !x.q[x.i]) return;
    S.queue = x.q.filter((t) => t && t.id && (t.engine === 'spotify' || t.engine === 'audio'));
    S.index = clamp(S.queue.findIndex((t) => t.id === x.q[x.i].id), 0, S.queue.length - 1);
    S.context = String(x.c || '');
    S.pos = Number(x.p) || 0;
    S.status = 'paused';
    S.loaded = -1; // il motore non ha ancora niente: al play si carica dal punto salvato
  } catch {}
}

// ---------------------------------------------------------------------------
// Interfaccia: mini lettore in basso + lettore grande
// ---------------------------------------------------------------------------
let root = null;
const $ = {};
const fmt = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
const TIPO_ICONA = { brano: 'music', album: 'disc', playlist: 'headphones', radio: 'radio' };
const COVER_OK = /^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-[a-z]+\.spotifycdn\.com|[a-z0-9-]+\.scdn\.co)\/[\w\-./%~]+$/;
export const safeCover = (u) => (typeof u === 'string' && COVER_OK.test(u) ? u : '');
/** Copertina più grande quando Spotify la offre (640 px invece di 300) */
const grande = (u) => u.replace(/ab67616d00001e02/, 'ab67616d0000b273');

export function mount() {
  if (root) return;
  root = document.createElement('div');
  root.id = 'player';
  root.className = 'player no-gesture';
  root.hidden = true;
  root.innerHTML = html`
    <div class="pl-mini" role="region" aria-label="Musica in riproduzione">
      <button class="pl-mini-open" type="button" data-pl="espandi" aria-label="Apri il lettore">
        <span class="pl-cover" data-r="miniCover"></span>
        <span class="pl-meta"><b data-r="miniTitle"></b><span data-r="miniSub"></span></span>
      </button>
      <button class="pl-btn" type="button" data-pl="play" data-r="miniPlay" aria-label="Riproduci"></button>
      <button class="pl-btn pl-next-mini" type="button" data-pl="next" data-r="miniNext" aria-label="Brano successivo">${icon('next', 'filled')}</button>
      <i class="pl-mini-bar" aria-hidden="true"><i data-r="miniBar"></i></i>
    </div>
    <div class="pl-backdrop" data-pl="riduci"></div>
    <section class="pl-full" role="dialog" aria-modal="true" aria-label="Lettore musicale" data-r="full" inert>
      <div class="pl-bg" data-r="bg" aria-hidden="true"></div>
      <header class="pl-head pl-drag">
        <button class="pl-icon" type="button" data-pl="riduci" aria-label="Riduci il lettore">${icon('down')}</button>
        <div class="pl-head-t"><small>In riproduzione</small><b data-r="context"></b></div>
        <button class="pl-icon" type="button" data-pl="chiudi" aria-label="Ferma e chiudi il lettore">${icon('x')}</button>
      </header>
      <div class="pl-scroll">
        <div class="pl-art pl-drag" data-r="art"></div>
        <div class="pl-info">
          <div class="pl-info-t"><h2 data-r="title"></h2><p data-r="artist"></p></div>
          <a class="pl-icon" data-r="open" target="_blank" rel="noopener" aria-label="Apri nell’app">${icon('link')}</a>
        </div>
        <div class="pl-badges" data-r="badges"></div>
        <div class="pl-seek" data-r="seekBox">
          <input type="range" min="0" max="1" step="1" value="0" data-r="range" aria-label="Posizione nel brano">
          <div class="pl-times"><span data-r="tNow">0:00</span><span data-r="tLeft">0:00</span></div>
        </div>
        <div class="pl-live" data-r="liveBox" hidden><i></i>In diretta</div>
        <div class="pl-ctrl">
          <button class="pl-icon pl-skip" type="button" data-pl="prev" data-r="prev" aria-label="Brano precedente">${icon('prev', 'filled')}</button>
          <button class="pl-big" type="button" data-pl="play" data-r="bigPlay" aria-label="Riproduci"></button>
          <button class="pl-icon pl-skip" type="button" data-pl="next" data-r="next" aria-label="Brano successivo">${icon('next', 'filled')}</button>
        </div>
        <div class="pl-extra" data-r="extra">
          <label class="pl-vol" data-r="volBox" hidden>${icon('volume', 'sm')}<input type="range" min="0" max="100" step="1" data-r="vol" aria-label="Volume"></label>
          <button class="pl-out" type="button" data-pl="airplay" data-r="airplay" hidden>${icon('airplay', 'sm')}<span>AirPlay</span></button>
          <label class="pl-out" data-r="sinkBox" hidden>${icon('speaker', 'sm')}<select data-r="sink" aria-label="Uscita audio"></select></label>
          <button class="pl-out" type="button" data-pl="picker" data-r="picker" hidden>${icon('speaker', 'sm')}<span>Uscita audio</span></button>
        </div>
        <p class="pl-hint" data-r="hint" role="status" hidden></p>
        <div class="pl-source" data-r="source" hidden><div data-r="spotifyHost"></div></div>
        <div class="pl-queue" data-r="queueBox" hidden><div class="pl-qt">${icon('queue', 'xs')} Dopo</div><div data-r="queue"></div></div>
      </div>
    </section>
    <span class="sr-only" aria-live="polite" data-r="live"></span>`.s;
  document.body.appendChild(root);
  root.querySelectorAll('[data-r]').forEach((el) => { $[el.dataset.r] = el; });
  spotify.host = $.spotifyHost;

  root.addEventListener('click', onClick);
  // una copertina che non arriva lascia posto al disegno, senza buchi
  root.addEventListener('error', (ev) => {
    const img = ev.target;
    if (!img || img.tagName !== 'IMG') return;
    if (img.dataset.fallback && img.getAttribute('src') !== img.dataset.fallback) { img.src = img.dataset.fallback; return; }
    const ph = document.createElement('span');
    ph.className = 'pl-ph';
    ph.innerHTML = icon('music', img.closest('.pl-art') ? 'lg' : '').s;
    img.replaceWith(ph);
  }, true);
  // barra della posizione: mentre il dito scorre muovo solo l'interfaccia; al rilascio UN seek
  const r = $.range;
  const daValore = () => Number(r.value) * 1000;
  const inizio = () => { if (S.dur && !S.live) { S.drag = daValore(); } };
  r.addEventListener('pointerdown', inizio);
  r.addEventListener('touchstart', inizio, { passive: true });
  r.addEventListener('input', () => { if (!S.dur || S.live) return; S.drag = daValore(); disegnaTempo(true); });
  r.addEventListener('change', () => { if (!S.dur || S.live) { S.drag = null; return; } const to = daValore(); S.drag = null; seekTo(to); });
  const fine = () => { setTimeout(() => { if (S.drag != null && !r.matches(':active')) { S.drag = null; disegnaTempo(true); } }, 0); };
  r.addEventListener('pointerup', fine);
  r.addEventListener('touchend', fine, { passive: true });
  r.addEventListener('blur', () => { if (S.drag != null) { S.drag = null; disegnaTempo(true); } });
  $.vol.addEventListener('input', () => setVolume(Number($.vol.value) / 100));
  $.sink.addEventListener('change', () => scegliUscita($.sink.value));
  trascinaGiu();

  const vol = Number(lsGet('casa.player.vol'));
  if (vol > 0 && vol <= 1) S.volume = vol;
  ripristina();
  // quando l'app va in sottofondo ricordo il punto esatto
  window.addEventListener('pagehide', salva);
  document.addEventListener('visibilitychange', () => { if (document.hidden) salva(); else ciclo(); });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => elencaUscite().then(disegna));
  disegna();
}

function onClick(ev) {
  const b = ev.target.closest('[data-pl]');
  if (!b || !root.contains(b)) return;
  ev.preventDefault();
  ev.stopPropagation();
  const a = b.dataset.pl;
  if (a === 'play') toggle();
  else if (a === 'next') next();
  else if (a === 'prev') prev();
  else if (a === 'espandi') espandi();
  else if (a === 'riduci') riduci();
  else if (a === 'chiudi') close();
  else if (a === 'jump') jump(Number(b.dataset.i));
  else if (a === 'airplay') { try { audio.get().webkitShowPlaybackTargetPicker(); } catch {} }
  else if (a === 'picker') scegliUscita('__picker');
}

export function espandi() {
  if (!cur()) return;
  S.expanded = true;
  $.full.inert = false;
  document.documentElement.classList.add('pl-open');
  root.classList.add('expanded');
  const f = $.full;
  f.style.transform = '';
  if (cur().engine === 'audio') elencaUscite().then(disegna);
  disegna();
  setTimeout(() => { if (S.expanded) { const x = root.querySelector('.pl-head [data-pl="riduci"]'); if (x) x.focus({ preventScroll: true }); } }, 60);
}

export function riduci() {
  if (!S.expanded) return;
  S.expanded = false;
  root.classList.remove('expanded');
  document.documentElement.classList.remove('pl-open');
  $.full.inert = true;
  $.full.style.transform = '';
  disegna();
}
export const isExpanded = () => S.expanded;

/** Sul telefono il lettore grande si chiude anche trascinandolo giù, come gli altri fogli. */
function trascinaGiu() {
  let y0 = null, dy = 0, t0 = 0;
  const f = $.full;
  f.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || !e.target.closest('.pl-drag') || e.target.closest('button, a, input, iframe')) return;
    if (matchMedia('(min-width: 700px) and (min-height: 560px)').matches) return;
    if (f.querySelector('.pl-scroll').scrollTop > 0) return; // prima si torna in cima scorrendo

    y0 = e.touches[0].clientY; dy = 0; t0 = e.timeStamp;
    f.style.transition = 'none';
  }, { passive: true });
  f.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    f.style.transform = `translateY(${dy}px)`;
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  const fine = (e) => {
    if (y0 == null) return;
    const v = dy / Math.max(1, e.timeStamp - t0);
    y0 = null;
    f.style.transition = '';
    if (dy > 130 || (v > 0.5 && dy > 30)) riduci(); else f.style.transform = '';
  };
  f.addEventListener('touchend', fine);
  f.addEventListener('touchcancel', fine);
}

// ---------- disegno ----------
let ultimoSecondo = -1;
let disegnato = '';

function copertina(t, big = false) {
  const c = safeCover(t.cover);
  return c
    ? html`<img src="${big ? grande(c) : c}" alt="" decoding="async" data-fallback="${c}">`
    : html`<span class="pl-ph">${icon(TIPO_ICONA[t.type] || 'music', big ? 'lg' : '')}</span>`;
}

function disegna() {
  if (!root) return;
  const t = cur();
  root.hidden = !t;
  document.documentElement.classList.toggle('has-player', Boolean(t));
  if (!t) { fermaCiclo(); return; }
  const on = playing();
  const attesa = (S.status === 'loading' || S.buffering) && !S.blocked && S.status !== 'paused';
  // parti che cambiano solo con il brano
  const chiave = `${S.gen}|${t.id}|${t.title}|${t.artist}|${t.cover}|${S.queue.length}|${S.index}|${S.context}`;
  if (chiave !== disegnato) {
    disegnato = chiave;
    $.miniCover.innerHTML = copertina(t).s;
    $.miniTitle.textContent = t.title;
    $.title.textContent = t.title;
    $.artist.textContent = t.artist || '';
    $.artist.hidden = !t.artist;
    $.context.textContent = S.context || 'La nostra musica';
    $.art.innerHTML = copertina(t, true).s;
    const c = safeCover(t.cover);
    $.bg.style.backgroundImage = c ? `url("${c}")` : '';
    $.open.href = t.open || '#';
    $.open.hidden = !t.open;
    $.open.setAttribute('aria-label', t.engine === 'spotify' ? 'Apri in Spotify' : 'Apri il link');
    const dopo = S.queue.slice(S.index + 1, S.index + 6);
    $.queueBox.hidden = !dopo.length;
    $.queue.innerHTML = html`${dopo.map((x, k) => html`<button class="pl-q" type="button" data-pl="jump" data-i="${S.index + 1 + k}">
      <span class="pl-cover sm">${copertina(x)}</span><span class="pl-meta"><b>${x.title}</b><span>${x.artist || ''}</span></span></button>`)}`.s;
    $.live.textContent = `In riproduzione: ${t.title}${t.artist ? `, ${t.artist}` : ''}`;
  }
  $.miniSub.textContent = S.blocked ? 'Tocca per far partire' : S.status === 'error' ? S.err : attesa && S.status === 'loading' ? 'Carico…' : (t.artist || S.context || '');
  // play/pausa (con la rotellina mentre carica)
  const ico = attesa ? html`<span class="pl-spin" aria-hidden="true"></span>` : icon(on ? 'pause' : 'play', 'filled');
  const lab = on ? 'Pausa' : 'Riproduci';
  [$.miniPlay, $.bigPlay].forEach((b) => {
    const k = attesa ? 'spin' : on ? 'pause' : 'play';
    if (b.dataset.k !== k) { b.dataset.k = k; b.innerHTML = ico.s; }
    b.setAttribute('aria-label', lab);
  });
  root.classList.toggle('is-playing', on && !attesa);
  const haNext = S.index < S.queue.length - 1;
  $.next.disabled = !haNext;
  $.miniNext.hidden = !haNext;
  $.prev.disabled = S.index <= 0 && (S.live || S.status === 'idle');
  // diretta / durata
  $.seekBox.hidden = S.live;
  $.liveBox.hidden = !S.live;
  // etichette: anteprima di Spotify, radio
  const badges = [];
  if (t.engine === 'spotify') badges.push(html`<span class="pl-badge">Spotify</span>`);
  if (S.preview) badges.push(html`<span class="pl-badge warn">Anteprima di 30 secondi</span>`);
  if (t.kind === 'radio') badges.push(html`<span class="pl-badge">Radio</span>`);
  const bs = html`${badges}`.s;
  if ($.badges.dataset.s !== bs) { $.badges.dataset.s = bs; $.badges.innerHTML = bs; }
  // avvisi
  let hint = '';
  if (S.status === 'error') hint = S.err;
  else if (S.blocked) hint = t.engine === 'spotify' ? 'Safari chiede un tocco diretto: premi ▶ nel riquadro di Spotify qui sotto. Poi il lettore si comanda da qui.' : 'Il dispositivo chiede un tocco: premi ▶ per far partire l’audio.';
  else if (S.preview) hint = 'Spotify fa sentire 30 secondi a chi non ha fatto l’accesso in questo browser. Per il brano intero tocca il link in alto e si apre l’app di Spotify.';
  $.hint.textContent = hint;
  $.hint.hidden = !hint;
  $.hint.classList.toggle('warn', S.blocked || S.status === 'error');
  $.source.hidden = t.engine !== 'spotify';
  root.classList.toggle('is-blocked', S.blocked);
  // volume e uscita audio: solo con l'audio diretto e solo se il dispositivo li permette
  const audioOn = t.engine === 'audio';
  $.volBox.hidden = !(audioOn && S.canVolume);
  if (!$.volBox.hidden && document.activeElement !== $.vol) $.vol.value = String(Math.round(S.volume * 100));
  $.airplay.hidden = !(audioOn && S.airplay);
  const picker = audioOn && !S.outputs.length && navigator.mediaDevices && typeof navigator.mediaDevices.selectAudioOutput === 'function';
  $.picker.hidden = !picker;
  $.sinkBox.hidden = !(audioOn && S.outputs.length > 1);
  if (!$.sinkBox.hidden) {
    const opts = S.outputs.map((o) => html`<option value="${o.id}" ${o.id === (S.sinkId || 'default') ? 'selected' : ''}>${o.label}</option>`);
    const s = html`${opts}`.s;
    if ($.sink.dataset.s !== s) { $.sink.dataset.s = s; $.sink.innerHTML = s; }
  }
  $.extra.hidden = $.volBox.hidden && $.airplay.hidden && $.picker.hidden && $.sinkBox.hidden;
  disegnaTempo(true);
  avvisa();
  if (on) ciclo(); else fermaCiclo();
}

function disegnaTempo(forza = false) {
  if (!root || !cur()) return;
  const p = position();
  const pct = S.dur ? clamp(p / S.dur, 0, 1) : 0;
  $.miniBar.style.transform = `scaleX(${S.live ? 1 : pct})`;
  root.classList.toggle('is-live', S.live);
  if (S.live) return;
  const sec = Math.floor(p / 1000);
  if (!forza && sec === ultimoSecondo) { $.range.style.setProperty('--p', `${pct * 100}%`); return; }
  ultimoSecondo = sec;
  const max = Math.max(1, Math.round(S.dur / 1000));
  if ($.range.max !== String(max)) $.range.max = String(max);
  if (S.drag == null) $.range.value = String(clamp(sec, 0, max));
  $.range.style.setProperty('--p', `${pct * 100}%`);
  $.range.disabled = !S.dur;
  $.tNow.textContent = fmt(p);
  $.tLeft.textContent = S.dur ? `-${fmt(Math.max(0, S.dur - p))}` : '--:--';
  $.range.setAttribute('aria-valuetext', S.dur ? `${fmt(p)} di ${fmt(S.dur)}` : 'Durata non ancora nota');
}

// la barra scorre fluida tra un aggiornamento e l'altro (solo mentre suona e si vede)
let raf = 0;
function ciclo() {
  if (raf || document.hidden || !playing()) return;
  const tick = () => {
    raf = 0;
    if (document.hidden || !playing()) return;
    disegnaTempo();
    if (now() - salvatoAt > 10000) salva();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function fermaCiclo() { if (raf) cancelAnimationFrame(raf); raf = 0; }

// per le prove automatiche: lo stato in sola lettura
export const _stato = () => ({ ...S, queue: S.queue.map((t) => t.id), position: Math.round(position()) });
