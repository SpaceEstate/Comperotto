// Spotify nella pagina Musica: cosa suona e dove (iPhone, iPad, Echo… o dentro l'app), ricerca,
// preferiti, playlist (crearle, rinominarle, aggiungere e togliere brani), album, artisti, coda.
// Sottopagine: #/musica/cerca, #/musica/preferiti, #/musica/pl/<id>, #/musica/album/<id>, #/musica/artista/<id>
import { html, raw, vibrate, lsGet, lsSet, isIPad, cap, norm, MONTHS, todayIso } from '../utils.js';
import { icon } from '../icons.js';
import { openSheet, closeSheet, toast, val, ui, setUi, me, isSynced, nameOf, sheetError, rerender, confirmSheet, state, cancella, settings, saveSettings } from '../core.js';
import { periodoMusica } from '../season.js';
import * as S from '../spotify.js';

const { sp } = S;
export const SOTTO = ['cerca', 'preferiti', 'pl', 'album', 'artista'];

// ---------------------------------------------------------------------------
// Pezzi comuni
// ---------------------------------------------------------------------------
const DEV_ICON = { Speaker: 'speaker', Smartphone: 'phone', Tablet: 'tablet', Computer: 'laptop', TV: 'tv', CastVideo: 'tv', CastAudio: 'speaker', AVR: 'speaker', STB: 'tv', Automobile: 'music', GameConsole: 'tv' };
const DEV_LABEL = { Speaker: 'Altoparlante', Smartphone: 'Telefono', Tablet: 'Tablet', Computer: 'Computer', TV: 'TV', CastVideo: 'TV', CastAudio: 'Altoparlante', AVR: 'Amplificatore', STB: 'TV', Automobile: 'Auto', GameConsole: 'Console' };
const questo = () => (isIPad() ? 'questo iPad' : /iPhone/.test(navigator.userAgent) ? 'questo iPhone' : 'questo dispositivo');
// i lettori dentro l'app (questo dispositivo o quelli dell'altro) si chiamano "Comperotto · iPad di …"
const comperotto = (d) => Boolean(d && /^Comperotto · /.test(d.name || ''));
const eQuesto = (d) => Boolean(d && (S.eQui(d.id) || d.id === S.QUI));
const devIcon = (d) => {
  if (eQuesto(d)) return isIPad() ? 'tablet' : /iPhone/.test(navigator.userAgent) ? 'phone' : 'laptop';
  if (comperotto(d)) return /iPad/.test(d.name) ? 'tablet' : /iPhone/.test(d.name) ? 'phone' : 'laptop';
  return DEV_ICON[d && d.type] || 'speaker';
};
const devNome = (d) => (eQuesto(d) ? cap(questo()) : comperotto(d) ? d.name.replace(/^Comperotto · /, '') : d ? d.name : '');
const nomiArtisti = (t) => (t.artists || []).map((a) => a.name).filter(Boolean).join(', ');
/** Dove suona (o suonerebbe toccando un brano): il dispositivo collegato, altrimenti quello di base. */
function sceltoOAttivo() {
  const a = S.attivo();
  if (a) return a;
  const dove = S.doveSuonare();
  if (dove === S.QUI) return { id: S.qui.id || S.QUI, name: questo() };
  return (sp.devices || []).find((d) => d.id === dove) || null;
}
const suonaOra = () => (sp.player && sp.player.item && sp.player.item.uri) || '';
const ctxOra = () => (sp.player && sp.player.context && sp.player.context.uri) || '';
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

/** Copertina con l'icona sotto (se l'immagine non arriva resta l'icona). */
const cover = (src, ph = 'music', cls = '') => html`<span class="sp-img ${cls}">${icon(ph)}${src ? html`<img src="${src}" alt="" loading="lazy" decoding="async">` : ''}</span>`;
const eq = (on) => html`<span class="sp-eq ${on ? '' : 'stop'}"><i></i><i></i><i></i></span>`;

// contesti da cui si fa partire un brano (playlist, album, preferiti, ricerca)
const contesti = new Map();

function trackRow(t, ctxKey, { numero = false } = {}) {
  const saved = S.salvato(t.uri);
  const on = t.uri === suonaOra();
  return html`<div class="row sp-track ${on ? 'on' : ''} ${t.ok ? '' : 'off'}">
    <button class="sp-track-main" data-action="sp-brano" data-uri="${t.uri}" data-ctx="${ctxKey}" aria-label="Fai partire ${t.name}">
      ${numero ? html`<span class="sp-num">${on ? eq(sp.player.is_playing) : t.n || ''}</span>` : cover(t.img, 'music', 'sp-tcover')}
      <span class="row-main"><span class="row-title">${t.name}</span><span class="row-sub">${t.e ? html`<i class="sp-e" title="Esplicito">E</i>` : ''}${nomiArtisti(t)}</span></span>
    </button>
    <button class="sp-ic ${saved ? 'on' : ''}" data-action="sp-cuore" data-uri="${t.uri}" aria-label="${saved ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}">${icon('heart', saved ? 'sm filled' : 'sm')}</button>
    <button class="sp-ic" data-action="sp-menu" data-uri="${t.uri}" data-ctx="${ctxKey}" aria-label="Altro">${icon('dots', 'sm')}</button>
  </div>`;
}

function tile(p, href, { sub = '', ph = 'headphones', round = false, play = '', cls = '' } = {}) {
  const on = play && play === ctxOra();
  return html`<div class="sp-tile ${on ? 'on' : ''} ${round ? 'round' : ''}">
    <a class="sp-tile-link" href="${href}">
      ${cover(p.img, ph, `sp-tile-img ${cls}`)}
      <b>${p.name}</b>${sub ? html`<span>${sub}</span>` : ''}
    </a>
    ${play ? html`<span class="sp-tile-over"><button class="sp-tile-play" data-action="sp-suona" data-ctx="${play}" aria-label="Fai partire ${p.name}">${on && sp.player.is_playing ? eq(true) : icon('play', 'filled')}</button></span>` : ''}
  </div>`;
}
const plSub = (p) => (p.n != null ? plural(p.n, 'brano', 'brani') : p.owner || '');
const alSub = (a) => [nomiArtisti(a), a.anno].filter(Boolean).join(' · ');

// uscite: "Album", "Singolo", "EP" (per Spotify un EP è un singolo con 4 brani o più), "Compilation"
const tipoUscita = (a) => (a.tipo === 'compilation' ? 'Compilation' : a.tipo === 'single' ? (a.n >= 4 ? 'EP' : 'Singolo') : 'Album');
const GRUPPO_LABEL = { album: 'Album', single: 'Singoli ed EP', compilation: 'Compilation', appears_on: 'Appare in' };
/** "12 marzo 2025", "marzo 2025" o "2025", secondo quanto è precisa la data che dà Spotify. */
function dataLunga(a) {
  const [y, m, d] = String(a.data || '').split('-').map(Number);
  if (!y) return '';
  if (!m || a.precisione === 'year') return String(y);
  if (!d || a.precisione === 'month') return `${MONTHS[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
/** 2712000 → "45 min", 4500000 → "1 h 15 min" */
function durataLunga(ms) {
  const min = Math.round((ms || 0) / 60000);
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}
/** Una riga di un'uscita (ultima uscita, discografia): copertina, nome, anno · tipo · brani, e "fai partire". */
function rigaAlbum(x, { lunga = false } = {}) {
  const on = x.uri === ctxOra();
  return html`<div class="row sp-uscita ${on ? 'on' : ''}">
    <a class="sp-track-main" href="#/musica/album/${x.id}">
      ${cover(x.img, 'disc', 'sp-ucover')}
      <span class="row-main"><span class="row-title">${x.name}</span><span class="row-sub">${[lunga ? dataLunga(x) : x.anno, tipoUscita(x), x.n ? plural(x.n, 'brano', 'brani') : ''].filter(Boolean).join(' · ')}</span></span>
    </a>
    <button class="sp-ic" data-action="sp-suona" data-ctx="${x.uri}" aria-label="Fai partire ${x.name}">${on && sp.player && sp.player.is_playing ? eq(true) : icon('play', 'sm filled')}</button>
  </div>`;
}

// ---------------------------------------------------------------------------
// In riproduzione: scheda grande in Musica, barretta in basso nelle sottopagine
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Titolo e copertina cambiano insieme: se la copertina del brano nuovo non è ancora scaricata, per un
// attimo (al massimo 1,2 secondi) resta tutto il brano di prima; i brani in arrivo si scaricano in anticipo.
// ---------------------------------------------------------------------------
const copertinaDi = (it, min) => (it ? S.bestImage((it.album && it.album.images) || it.images || (it.show && it.show.images), min) : '');
const mostrati = {};
let riprovaT = null;
function insieme(vista, it, min) {
  const img = copertinaDi(it, min);
  const m = mostrati[vista];
  S.precarica(img);
  if (!it || !m || !m.it || m.it.uri === it.uri || S.pronta(img)) {
    mostrati[vista] = { it, img };
    return { it, img };
  }
  if (!m.arriva || m.arriva !== it.uri) { m.arriva = it.uri; m.dal = Date.now(); }
  if (Date.now() - m.dal > 1200) { mostrati[vista] = { it, img }; return { it, img }; }
  clearTimeout(riprovaT);
  riprovaT = setTimeout(rerender, 1250);
  return { it: m.it, img: m.img };
}

/** La canzone del giorno: dai tuoi «Scelti per te», altrimenti dalla musica del periodo (cambia ogni giorno, o con il dado). */
function consigliata() {
  const pt = S.letto(S.chiave('perte'));
  const pool = ((pt && pt.scelti.length ? pt.scelti : S.letto(chiaveTema())) || []).filter((t) => t && t.ok !== false);
  if (!pool.length) return null;
  const seme = [...todayIso()].reduce((a, c) => a + c.charCodeAt(0), 0) + Number(ui('sp.spin', 0));
  const i = seme % pool.length;
  // parte quella, e dopo le altre (come una piccola playlist)
  contesti.set('consiglio', { uris: [...pool.slice(i), ...pool.slice(0, i)].map((t) => t.uri) });
  return pool[i];
}
// La scheda in cima a Musica è fatta come «Stasera guardiamo…» dei film: dietro la copertina sfocata,
// davanti copertina, titolo e artista; i tasti tondi (dado o cuore, e le casse per scegliere dove ascoltare).
/** La copertina dietro la scheda: solo un indirizzo https pulito (finisce dentro lo stile). */
const fondo = (src) => (src && /^https:\/\/[^\s"'()\\<>]+$/.test(src) ? `--copertina:url('${src}')` : '');
const copertina = (al, img) => {
  const dentro = html`${icon('music', 'lg')}${img ? html`<img src="${img}" alt="" decoding="async">` : ''}`;
  return al && al.id ? html`<a class="sp-cover" href="#/musica/album/${al.id}" aria-label="Apri l’album">${dentro}</a>` : html`<div class="sp-cover">${dentro}</div>`;
};
/** Le casse: aprono «Dove ascoltare?». Se la musica va (o andrebbe) su un altro dispositivo si accendono e accanto c'è il suo nome. */
function casse(dev) {
  const nome = dev ? devNome(dev) : '';
  const altrove = Boolean(dev && !eQuesto(dev));
  const label = nome ? `Dove ascoltare (ora: ${nome})` : 'Scegli dove ascoltare';
  return html`<button class="icon-btn sp-casse ${altrove ? 'altrove' : ''}" data-action="sp-dispositivi" aria-label="${label}" title="${label}">${icon('casse')}</button>${altrove ? html`<button class="sp-dove" data-action="sp-dispositivi" tabindex="-1" aria-hidden="true">${nome}</button>` : ''}`;
}

function consiglioCard() {
  const t = consigliata();
  if (!t) return '';
  const img = t.big || t.img;
  return html`<section class="card sp-now sp-consiglio" id="sp-now" style="${fondo(img)}">
    <div class="sp-now-bg" aria-hidden="true"></div>
    ${copertina(t.album, img)}
    <div class="sp-meta">
      <p class="sp-eyebrow">Da ascoltare oggi</p>
      <h2 class="sp-titolo">${t.name}</h2>
      <p class="sp-artisti">${t.e ? html`<i class="sp-e">E</i>` : ''}${nomiArtisti(t)}</p>
    </div>
    <div class="sp-tasti">
      <button class="icon-btn" data-action="sp-spin" aria-label="Un’altra canzone">${icon('dice')}</button>
      ${casse(sceltoOAttivo())}
    </div>
    <button class="btn primary sp-ascolta" data-action="sp-brano" data-uri="${t.uri}" data-ctx="consiglio">${icon('play', 'sm filled')} Ascolta</button>
  </section>`;
}

function nowCard() {
  const p = sp.player;
  // niente in riproduzione (e nessun comando in arrivo): una canzone consigliata, che parte solo se la tocchi
  if ((!p || !p.item) && sp.playerAt && !S.inArrivo()) { const c = consiglioCard(); if (c) return c; }
  const vis = insieme('grande', p && p.item, 200);
  const it = vis.it;
  const playing = Boolean(p && p.is_playing);
  const img = vis.img;
  const dur = (it && it.duration_ms) || 0;
  // mentre si trascina comanda il dito; altrimenti la posizione vera (poi la muove l'orologio qui sotto)
  const pos = sp.trascino != null ? sp.trascino : S.progresso();
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
  ultimo = ''; // i minuti li riscrive il disegno: l'orologio riparte da qui
  const saved = it ? S.salvato(it.uri) : false;
  if (it && it.uri && saved === undefined) queueMicrotask(() => S.controllaSalvati([it.uri]));
  const fermo = !it && sp.playerAt && !S.inArrivo(); // niente in riproduzione (e nessuna canzone da consigliare)
  return html`<section class="card sp-now ${playing ? 'playing' : ''}" id="sp-now" style="${fondo(img)}">
    <div class="sp-now-bg" aria-hidden="true"></div>
    ${copertina(it && it.album, img)}
    <div class="sp-meta">
      ${it ? html`<p class="sp-eyebrow">${playing ? 'In riproduzione' : 'In pausa'}</p>` : ''}
      <h2 class="sp-titolo">${it ? it.name : fermo ? 'Niente in riproduzione' : 'Spotify'}</h2>
      <p class="sp-artisti">${it ? nomiArtisti(it) || (it.show && it.show.name) || '' : fermo ? 'Cerca qualcosa o tocca una playlist' : 'Un attimo…'}</p>
    </div>
    <div class="sp-tasti">
      ${it && it.type !== 'episode' ? html`<button class="icon-btn sp-cuore ${saved ? 'on' : ''}" data-action="sp-cuore" data-uri="${it.uri}" aria-label="${saved ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}" aria-pressed="${saved ? 'true' : 'false'}">${icon('heart', saved ? 'filled' : '')}</button>` : ''}
      ${casse(sceltoOAttivo())}
    </div>
    ${it ? html`<div class="sp-sotto">
      <div class="sp-seek no-gesture" id="sp-seek-${it.id || 'x'}">
        <div class="sp-bar"><i style="width:${pct.toFixed(2)}%"></i></div>
        <input type="range" min="0" max="${dur}" step="1000" value="${Math.round(pos)}" data-change="sp-seek" aria-label="Posizione nel brano">
      </div>
      <div class="sp-times"><span id="sp-t1">${tempo(pos)}</span><span id="sp-t2">-${tempo(dur - pos)}</span></div>
      <div class="sp-ctrl">
        <button class="sp-btn ${p.shuffle_state ? 'on' : ''}" data-action="sp-casuale" aria-label="Ordine casuale" aria-pressed="${p.shuffle_state ? 'true' : 'false'}">${icon('shuffle', 'sm')}</button>
        <button class="sp-btn" data-action="sp-indietro" aria-label="Precedente">${icon('prev', 'filled')}</button>
        <button class="sp-play" data-action="sp-playpausa" aria-label="${playing ? 'Pausa' : 'Riproduci'}">${icon(playing ? 'pause' : 'play', 'filled')}</button>
        <button class="sp-btn" data-action="sp-avanti" aria-label="Successivo">${icon('next', 'filled')}</button>
        ${bottoneRipeti(p, 'sp-btn', 'sm')}
      </div>
    </div>` : ''}
  </section>`;
}

/** Ripeti: spento, tutto (playlist o album), solo questo brano (con il piccolo "1"). */
function bottoneRipeti(p, cls, size) {
  const r = (p && p.repeat_state) || 'off';
  const nome = r === 'track' ? 'Ripeti: solo questo brano' : r === 'context' ? 'Ripeti: tutto' : 'Ripeti: spento';
  return html`<button class="${cls} sp-rep ${r !== 'off' ? 'on' : ''} ${r === 'track' ? 'uno' : ''}" type="button" data-action="sp-ripeti" aria-label="${nome}" title="${nome}">${icon('repeat', size)}</button>`;
}

/** 83000 → "1:23" */
function tempo(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// la barra del brano: mentre il dito trascina mostro subito dove si arriva, al rilascio ci vado (azione sp-seek)
let ultimo = '';
function mostraPosizione(ms, dito = false) {
  const it = sp.player && sp.player.item;
  const dur = (it && it.duration_ms) || 0;
  const bar = document.querySelector('#sp-now .sp-bar > i');
  if (!bar || !dur) return;
  bar.classList.toggle('dito', dito); // sotto il dito niente scivolamento
  bar.style.width = `${Math.min(100, (ms / dur) * 100).toFixed(2)}%`;
  const testo = `${tempo(ms)}|${tempo(dur - ms)}`;
  if (testo === ultimo) return; // i numeri cambiano una volta al secondo
  ultimo = testo;
  const t1 = document.getElementById('sp-t1'), t2 = document.getElementById('sp-t2');
  if (t1) t1.textContent = tempo(ms);
  if (t2) t2.textContent = `-${tempo(dur - ms)}`;
}
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el || !el.matches || !el.matches('.sp-seek input, .np-seek input')) return;
  el._busy = true; // il ridisegno non mi sposta il pallino sotto il dito
  sp.trascino = Number(el.value);
  mostraPosizione(sp.trascino, true);
  mostraNp(sp.trascino);
}, true);
// l'orologio delle barre: 4 volte al secondo, solo con un lettore sullo schermo e la musica che va
const quanto = (ms, dur) => `${Math.min(100, (ms / dur) * 100).toFixed(2)}%`;
setInterval(() => {
  const p = sp.player;
  if (document.hidden || sp.trascino != null || !p || !p.item || !p.is_playing) return;
  const grande = document.getElementById('sp-now');
  const piccolo = document.querySelector('#sp-mini .sp-mini-bar > i');
  const finestra = npAperto && document.getElementById('np-seek');
  if (!grande && !piccolo && !finestra) return;
  const ms = S.progresso();
  if (grande) mostraPosizione(ms);
  if (finestra) mostraNp(ms);
  if (piccolo && p.item.duration_ms) piccolo.style.width = quanto(ms, p.item.duration_ms);
  if (p.item.duration_ms && ms >= p.item.duration_ms - 250) S.fineBrano(); // finito: chiedo subito il prossimo
}, 250);

/**
 * Il mini lettore in basso, su tutte le pagine tranne Musica (lì c'è quello grande): copertina, titolo,
 * artista e dove suona; play/pausa e avanti; un tocco apre la finestra del lettore (senza cambiare pagina).
 */
export function miniLettore(r = []) {
  // con la zona Musica sullo schermo c'è già il lettore grande
  if (!isSynced() || !S.chi() || (r[0] === 'svago' && r[1] === 'musica')) return '';
  const p = sp.player;
  if (!p || !p.item) return '';
  const { it, img } = insieme('mini', p.item, 64);
  const dur = p.item.duration_ms || 0;
  const dove = p.device ? devNome(p.device) : '';
  return html`<div class="sp-mini ${p.is_playing ? 'playing' : ''}" id="sp-mini">
    <button class="sp-mini-main" type="button" data-action="np-apri" data-gesto aria-label="Apri il lettore: ${it.name}">${cover(img, 'music', 'sp-tcover')}<span class="row-main"><b>${it.name}</b><span>${nomiArtisti(it) || (it.show && it.show.name) || ''}${dove ? html` · <em>${icon(devIcon(p.device), 'xs')}${dove}</em>` : ''}</span></span></button>
    <button class="sp-btn" data-action="sp-playpausa" aria-label="${p.is_playing ? 'Pausa' : 'Riproduci'}">${icon(p.is_playing ? 'pause' : 'play', 'filled')}</button>
    <button class="sp-btn" data-action="sp-avanti" aria-label="Successivo">${icon('next', 'filled')}</button>
    <span class="sp-mini-bar" aria-hidden="true"><i style="width:${dur ? quanto(S.progresso(), dur) : '0%'}"></i></span>
  </div>`;
}

// ---------------------------------------------------------------------------
// La finestra del lettore: si apre toccando il mini lettore, senza lasciare la pagina. Sul telefono sale
// dal basso (si chiude anche trascinandola giù), su iPad è una finestra al centro.
// ---------------------------------------------------------------------------
let npAperto = false;
let npUltimo = '';
export const lettoreAperto = () => npAperto;
export function apriLettore() {
  if (!sp.player || !sp.player.item) return;
  npAperto = true;
  document.documentElement.classList.add('np-open');
  rerender();
  // un attimo dopo (la finestra è disegnata): il dito può trascinarla giù, la tastiera ha dove fermarsi
  requestAnimationFrame(() => {
    trascinaGiu();
    if (matchMedia('(hover: hover)').matches) { const b = document.querySelector('#np .np-head .np-icon'); if (b) b.focus(); }
  });
}
export function chiudiLettore() {
  if (!npAperto) return;
  npAperto = false;
  document.documentElement.classList.remove('np-open');
  const f = document.querySelector('#np .np-full');
  if (f) f.style.transform = '';
  rerender();
}
/** Minuti e barra del lettore grande (anche mentre il dito trascina). */
function mostraNp(ms) {
  const it = sp.player && sp.player.item;
  const dur = (it && it.duration_ms) || 0;
  const box = document.getElementById('np-seek');
  if (!box || !dur) return;
  const r = box.querySelector('input');
  if (r && !r._busy) r.value = Math.round(ms);
  if (r) r.style.setProperty('--p', `${Math.min(100, (ms / dur) * 100).toFixed(2)}%`);
  const testo = `${tempo(ms)}|${tempo(dur - ms)}`;
  if (testo === npUltimo) return;
  npUltimo = testo;
  const t1 = document.getElementById('np-t1'), t2 = document.getElementById('np-t2');
  if (t1) t1.textContent = tempo(ms);
  if (t2) t2.textContent = `-${tempo(dur - ms)}`;
}
/** Da dove arriva quello che suona: playlist, album, artista, preferiti (con il link alla sua pagina). */
function contesto(p) {
  const uri = (p.context && p.context.uri) || '';
  const [, tipo, id] = uri.split(':');
  if (tipo === 'playlist' && id) {
    const nota = ((sp.playlists[S.chi()] || {}).list || []).find((x) => x.id === id);
    const letta = S.letto(S.chiave('pl', id, 0));
    const nome = (nota && nota.name) || (letta && letta.info && letta.info.name) || S.letto(S.chiave('plnome', id));
    // una playlist che non conosco ancora: chiedo il nome a Spotify (una volta, poi resta)
    if (!nome && npAperto && !S.fallito(S.chiave('plnome', id))) queueMicrotask(() => S.nomePlaylist(id).catch(() => {}));
    return { nome: nome || 'Playlist', href: `#/musica/pl/${id}` };
  }
  if (tipo === 'album' && id) return { nome: (p.item.album && p.item.album.name) || 'Album', href: `#/musica/album/${id}` };
  if (tipo === 'artist' && id) {
    const a = (p.item.artists || []).find((x) => x.id === id);
    return { nome: a ? a.name : 'Artista', href: `#/musica/artista/${id}` };
  }
  if (/:collection/.test(uri)) return { nome: 'Brani che ti piacciono', href: '#/musica/preferiti' };
  return { nome: p.device ? devNome(p.device) : 'Spotify', href: '' };
}
/** Il contenuto della finestra (sempre disegnato quando c'è un brano: così si apre e si chiude scorrendo). */
export function grandeLettore() {
  const p = sp.player;
  const it = p && p.item;
  if (!isSynced() || !S.chi() || !it) {
    if (npAperto) { npAperto = false; document.documentElement.classList.remove('np-open'); }
    return '';
  }
  const playing = Boolean(p.is_playing);
  const vis = insieme('finestra', it, 600);
  const img = vis.img;
  const dur = it.duration_ms || 0;
  const pos = sp.trascino != null ? sp.trascino : S.progresso();
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
  npUltimo = '';
  const saved = S.salvato(it.uri);
  if (npAperto && it.uri && saved === undefined) queueMicrotask(() => S.controllaSalvati([it.uri]));
  const ctx = contesto(p);
  const dev = p.device || sceltoOAttivo();
  const mo = vis.it;
  const a0 = (mo.artists || [])[0];
  const al = mo.album;
  // i prossimi brani: letti all'apertura e a ogni cambio di brano
  const kq = S.chiave('coda', it.uri);
  const dopo = S.letto(kq);
  if (npAperto && !dopo && !S.fallito(kq)) queueMicrotask(() => S.leggi(kq, () => S.coda(), { maxAge: 60000 }).catch(() => {}));
  return html`
    <div class="np-bg" aria-hidden="true" ${img ? raw(`style="background-image:url('${img}')"`) : ''}></div>
    <header class="np-head np-drag">
      <button class="np-icon" type="button" data-action="np-chiudi" aria-label="Riduci il lettore">${icon('down')}</button>
      <div class="np-head-t"><small>In riproduzione</small>${ctx.href ? html`<a href="${ctx.href}">${ctx.nome}</a>` : html`<b>${ctx.nome}</b>`}</div>
      <button class="np-icon" type="button" data-action="np-chiudi" aria-label="Chiudi">${icon('x')}</button>
    </header>
    <div class="np-scroll">
      <div class="np-art np-drag ${playing ? '' : 'ferma'}" data-gesto>${icon('music', 'lg')}${img ? html`<img src="${img}" alt="" decoding="async">` : ''}</div>
      <div class="np-info">
        <div class="np-info-t">
          <h2>${al && al.id ? html`<a href="#/musica/album/${al.id}">${mo.name}</a>` : mo.name}</h2>
          <p>${a0 && a0.id ? html`<a href="#/musica/artista/${a0.id}">${nomiArtisti(mo)}</a>` : nomiArtisti(mo) || (mo.show && mo.show.name) || ''}</p>
        </div>
        ${it.type !== 'episode' ? html`<button class="np-icon ${saved ? 'on' : ''}" type="button" data-action="sp-cuore" data-uri="${it.uri}" aria-label="${saved ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}">${icon('heart', saved ? 'filled' : '')}</button>` : ''}
        ${it.id ? html`<a class="np-icon" href="https://open.spotify.com/${it.type === 'episode' ? 'episode' : 'track'}/${it.id}" target="_blank" rel="noopener" aria-label="Apri nell’app Spotify">${icon('link')}</a>` : ''}
      </div>
      <div class="np-seek no-gesture" id="np-seek">
        <input type="range" min="0" max="${dur}" step="1000" value="${Math.round(pos)}" data-change="sp-seek" aria-label="Posizione nel brano" style="--p:${pct.toFixed(2)}%">
        <div class="np-times"><span id="np-t1">${tempo(pos)}</span><span id="np-t2">-${tempo(dur - pos)}</span></div>
      </div>
      <div class="np-ctrl">
        <button class="np-icon np-side ${p.shuffle_state ? 'on' : ''}" type="button" data-action="sp-casuale" aria-label="Ordine casuale" aria-pressed="${p.shuffle_state ? 'true' : 'false'}">${icon('shuffle')}</button>
        <button class="np-icon np-skip" type="button" data-action="sp-indietro" aria-label="Precedente">${icon('prev', 'filled')}</button>
        <button class="np-big" type="button" data-action="sp-playpausa" aria-label="${playing ? 'Pausa' : 'Riproduci'}">${icon(playing ? 'pause' : 'play', 'filled')}</button>
        <button class="np-icon np-skip" type="button" data-action="sp-avanti" aria-label="Successivo">${icon('next', 'filled')}</button>
        ${bottoneRipeti(p, 'np-icon np-side', '')}
      </div>
      <button class="np-dev" type="button" data-action="sp-dispositivi">${icon(dev ? devIcon(dev) : 'speaker', 'xs')}<span>${dev ? `Su ${devNome(dev)}` : 'Scegli dove ascoltare'}</span>${icon('down', 'xs')}</button>
      ${dopo && dopo.length ? html`<div class="np-queue"><div class="np-qt">${icon('queue', 'xs')} Dopo</div>
        ${dopo.map((t, i) => html`<button class="np-q" type="button" data-action="np-salta" data-i="${i}" data-uri="${t.uri}" aria-label="Fai partire ${t.name}">${cover(t.img, 'music', 'sp-tcover')}<span class="row-main"><b>${t.name}</b><span>${nomiArtisti(t)}</span></span>${icon('play', 'xs filled')}</button>`)}</div>` : ''}
    </div>`;
}
/**
 * Un dito che scorre di lato su `el` (la copertina, il mini lettore): segue il dito e, lasciato andare
 * abbastanza lontano, cambia brano (verso sinistra = avanti, verso destra = indietro), come su Spotify.
 */
let scorso = 0; // un tocco appena dopo uno scorrimento non apre niente
function cambiaBrano(el, dx, v) {
  const avanti = dx < 0;
  if (Math.abs(dx) < 60 && !(Math.abs(v) > 0.45 && Math.abs(dx) > 24)) {
    el.style.transition = 'transform .22s ease, opacity .22s ease';
    el.style.transform = '';
    el.style.opacity = '';
    return;
  }
  scorso = Date.now();
  vibrate();
  el.style.transition = 'transform .16s ease-in, opacity .16s ease-in';
  el.style.transform = `translateX(${avanti ? -48 : 48}px)`;
  el.style.opacity = '0';
  setTimeout(() => {
    S.salta(avanti).catch(errore);
    el.style.transition = 'none';
    el.style.transform = `translateX(${avanti ? 36 : -36}px)`;
    requestAnimationFrame(() => {
      el.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1), opacity .2s ease';
      el.style.transform = '';
      el.style.opacity = '';
    });
  }, 160);
}

// la finestra: giù (dalla testa o dalla copertina) si chiude; di lato sulla copertina si cambia brano
let trascinaPronto = false;
function trascinaGiu() {
  const f = document.querySelector('#np .np-full');
  if (!f || trascinaPronto) return;
  trascinaPronto = true;
  let g = null;
  f.addEventListener('touchstart', (e) => {
    g = null;
    if (e.touches.length !== 1 || !e.target.closest('.np-drag') || e.target.closest('button, a, input')) return;
    const t = e.touches[0];
    g = { x0: t.clientX, y0: t.clientY, dx: 0, dy: 0, t0: e.timeStamp, asse: '', art: e.target.closest('.np-art') };
  }, { passive: true });
  f.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    g.dx = t.clientX - g.x0;
    g.dy = t.clientY - g.y0;
    if (!g.asse) {
      if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) return;
      const telefono = !matchMedia('(min-width: 700px) and (min-height: 560px)').matches;
      if (Math.abs(g.dx) > Math.abs(g.dy) && g.art) g.asse = 'x';
      else if (g.dy > 0 && telefono && f.querySelector('.np-scroll').scrollTop <= 0) { g.asse = 'y'; f.style.transition = 'none'; }
      else { g = null; return; }
    }
    if (g.asse === 'x') g.art.style.transition = 'none', g.art.style.transform = `translateX(${g.dx}px) rotate(${g.dx / 40}deg)`;
    else f.style.transform = `translateY(${Math.max(0, g.dy)}px)`;
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  const fine = (e) => {
    if (!g || !g.asse) { g = null; return; }
    const dt = Math.max(1, e.timeStamp - g.t0);
    if (g.asse === 'x') cambiaBrano(g.art, g.dx, g.dx / dt);
    else {
      f.style.transition = '';
      if (g.dy > 120 || (g.dy / dt > 0.5 && g.dy > 30)) chiudiLettore(); else f.style.transform = '';
    }
    g = null;
  };
  f.addEventListener('touchend', fine);
  f.addEventListener('touchcancel', fine);
}

// il mini lettore: di lato si cambia brano (un tocco apre la finestra)
{
  const box = document.getElementById('mini');
  let g = null;
  if (box) {
    box.addEventListener('touchstart', (e) => {
      g = null;
      const main = e.target.closest('.sp-mini-main');
      if (e.touches.length !== 1 || !main) return;
      const t = e.touches[0];
      g = { x0: t.clientX, y0: t.clientY, dx: 0, t0: e.timeStamp, asse: '', el: main };
    }, { passive: true });
    box.addEventListener('touchmove', (e) => {
      if (!g) return;
      const t = e.touches[0];
      g.dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;
      if (!g.asse) {
        if (Math.abs(g.dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(g.dx) <= Math.abs(dy)) { g = null; return; }
        g.asse = 'x';
      }
      g.el.style.transition = 'none';
      g.el.style.transform = `translateX(${g.dx}px)`;
      g.el.style.opacity = String(Math.max(0.35, 1 - Math.abs(g.dx) / 220));
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    const fine = (e) => {
      if (g && g.asse) cambiaBrano(g.el, g.dx, g.dx / Math.max(1, e.timeStamp - g.t0));
      g = null;
    };
    box.addEventListener('touchend', fine);
    box.addEventListener('touchcancel', fine);
  }
}

// ---------------------------------------------------------------------------
// Pagina Musica: lettore, ricerca, libreria
// ---------------------------------------------------------------------------
export function blocco() {
  if (!isSynced() || !sp.info) return '';
  const k = S.chi();
  if (!k) {
    return html`<div class="card sp-connect">
      <span class="sp-logo">${icon('music')}</span>
      <div class="row-main"><b>Spotify</b><span>Cerca, ascolta e crea playlist, anche sugli Echo.</span></div>
      <button class="btn primary" data-action="sp-collega" ${sp.busy === 'collega' ? raw('disabled') : ''}>Collega</button>
    </div>`;
  }
  const acc = S.collegati();
  const a = sp.info.account[k] || {};
  const pl = sp.playlists[k];
  const list = (pl && pl.list) || [];
  const tutte = ui('sp.tutte', false);
  const shown = tutte ? list : list.slice(0, 10);
  return html`
    ${nowCard()}
    ${a.completo === false ? html`<div class="card sp-ricollega">${icon('sparkles')}<div class="row-main"><b>Spotify ha cose nuove</b><span>Per salvare brani, creare playlist e ascoltare dentro l’app va ricollegato una volta.</span></div>
      <button class="btn primary" data-action="sp-collega" data-v="${k}">Ricollega</button></div>`
      : a.extra === false ? html`<div class="card sp-ricollega">${icon('sparkles')}<div class="row-main"><b>Ascoltati di recente e i tuoi artisti</b><span>Per vederli qui, come su Spotify, va ricollegato una volta.</span></div>
      <button class="btn primary" data-action="sp-collega" data-v="${k}">Ricollega</button></div>` : ''}
    <a class="sp-search" href="#/musica/cerca">${icon('search', 'sm')}<span>Cerca brani, artisti, album</span></a>
    ${recentiSezione()}
    ${artistiSezione()}
    ${temaSezione()}
    ${perTeSezione()}
    <div class="section-title"><span>${acc.length > 1 ? 'Libreria' : `La libreria di ${nameOf(k)}`}</span><button class="card-link" data-action="sp-account">Spotify ${icon('right', 'xs')}</button></div>
    ${acc.length > 1 ? html`<div class="segmented sp-who">${acc.map((x) => html`<button class="${x === k ? 'on' : ''}" data-action="sp-chi" data-v="${x}">${nameOf(x)}</button>`)}</div>` : ''}
    <div class="chips sp-chips">${LIBRERIA.map(([v, l]) => html`<button class="chip ${vistaLibreria() === v ? 'on' : ''}" data-action="sp-lib" data-v="${v}">${l}</button>`)}</div>
    ${vistaLibreria() === 'album' ? libreriaAlbum() : vistaLibreria() === 'artisti' ? libreriaArtisti() : html`
    <div class="sp-grid">
      <div class="sp-tile special"><a class="sp-tile-link" href="#/musica/preferiti"><span class="sp-img sp-tile-img sp-fav">${icon('heart', 'filled')}</span><b>Brani che ti piacciono</b><span>Preferiti</span></a></div>
      <div class="sp-tile special"><button class="sp-tile-link" data-action="sp-nuova-pl"><span class="sp-img sp-tile-img sp-new">${icon('plus')}</span><b>Nuova playlist</b><span>Creane una</span></button></div>
      ${shown.map((p) => tile(p, `#/musica/pl/${p.id}`, { sub: plSub(p), play: p.uri }))}
    </div>
    ${!pl ? html`<p class="muted small sp-wait">Cerco le playlist…</p>` : ''}
    ${list.length > 10 ? html`<button class="card-link sp-more" data-action="sp-tutte">${tutte ? 'Mostra meno' : `Mostra tutte (${list.length})`}</button>` : ''}`}`;
}

// La libreria a schede, come su Spotify: playlist, album salvati, artisti seguiti (ogni dispositivo ricorda la sua)
const LIBRERIA = [['playlist', 'Playlist'], ['album', 'Album'], ['artisti', 'Artisti']];
const vistaLibreria = () => { const v = ui('sp.lib', null) || lsGet('casa.spotify.lib'); return LIBRERIA.some(([x]) => x === v) ? v : 'playlist'; };
function libreriaAlbum() {
  const pagine = ui('sp.pag.mieialbum', 1);
  const keys = Array.from({ length: pagine }, (_, i) => S.chiave('mieialbum', i * 50));
  const ok = keys.map((x) => S.letto(x)).filter(Boolean);
  const list = ok.flatMap((x) => x.list);
  const ultimo = ok[ok.length - 1];
  return html`${list.length ? html`<div class="sp-grid">${list.map((x) => tile(x, `#/musica/album/${x.id}`, { sub: alSub(x), ph: 'disc', play: x.uri }))}</div>`
      : ok.length === pagine ? html`<p class="muted small sp-wait">Nessun album salvato: tocca ♥ in un album per tenerlo qui.</p>` : ''}
    ${ok.length < pagine ? caricamento(keys[ok.length]) : ''}
    ${ok.length === pagine && ultimo && ultimo.altri ? html`<button class="card-link sp-more" data-action="sp-altri" data-k="mieialbum">Altri album</button>` : ''}`;
}
function libreriaArtisti() {
  const pagine = ui('sp.pag.seguiti', 1);
  const keys = Array.from({ length: pagine }, (_, i) => S.chiave('seguiti', i));
  const ok = keys.map((x) => S.letto(x)).filter(Boolean);
  const list = ok.flatMap((x) => x.list);
  const ultimo = ok[ok.length - 1];
  return html`${list.length ? html`<div class="sp-grid">${list.map((x) => tile(x, `#/musica/artista/${x.id}`, { ph: 'user', round: true, play: x.uri, sub: 'Artista' }))}</div>`
      : ok.length === pagine ? html`<p class="muted small sp-wait">Nessun artista seguito: tocca «Segui» nella pagina di un artista.</p>` : ''}
    ${ok.length < pagine ? caricamento(keys[ok.length]) : ''}
    ${ok.length === pagine && ultimo && ultimo.altri ? html`<button class="card-link sp-more" data-action="sp-altri" data-k="seguiti">Altri artisti</button>` : ''}`;
}

/** In cima, come su Spotify: le ultime cose ascoltate (album, playlist, artisti, preferiti). */
function recentiSezione() {
  const r = S.letto(S.chiave('recenti'));
  if (!r || !r.length) return '';
  const href = (v) => (v.tipo === 'album' ? `#/musica/album/${v.id}` : v.tipo === 'playlist' ? `#/musica/pl/${v.id}` : v.tipo === 'artist' ? `#/musica/artista/${v.id}` : '#/musica/preferiti');
  return html`<div class="section-title"><span>Ascoltati di recente</span></div>
    <div class="sp-hs">${r.map((v) => tile(v, href(v), {
      sub: v.tipo === 'album' ? nomiArtisti(v) : v.tipo === 'playlist' ? ['Playlist', v.owner].filter(Boolean).join(' · ') : v.tipo === 'artist' ? 'Artista' : 'Preferiti',
      ph: v.tipo === 'artist' ? 'user' : v.tipo === 'album' ? 'disc' : v.tipo === 'preferiti' ? 'heart' : 'headphones',
      round: v.tipo === 'artist', cls: v.tipo === 'preferiti' ? 'sp-fav' : '', play: v.uri,
    }))}</div>`;
}
/** Gli artisti che ascolti di più nelle ultime settimane. */
function artistiSezione() {
  const r = S.letto(S.chiave('topartisti'));
  if (!r || !r.length) return '';
  return html`<div class="section-title"><span>I tuoi artisti</span></div>
    <div class="sp-hs">${r.map((x) => tile(x, `#/musica/artista/${x.id}`, { ph: 'user', round: true, play: x.uri, sub: 'Artista' }))}</div>`;
}

/** Riquadro di un brano: tocco = parte (con gli altri della stessa fila dopo), ⋯ = foglio del brano. */
function tileBrano(t, ctxKey) {
  const on = t.uri === suonaOra();
  return html`<div class="sp-tile ${on ? 'on' : ''}">
    <button class="sp-tile-link" data-action="sp-brano" data-uri="${t.uri}" data-ctx="${ctxKey}" aria-label="Fai partire ${t.name}">
      ${cover(t.big || t.img, 'music', 'sp-tile-img')}<b>${t.name}</b><span>${nomiArtisti(t)}</span>
    </button>
    <span class="sp-tile-over"><button class="sp-tile-play" data-action="sp-menu" data-uri="${t.uri}" data-ctx="${ctxKey}" aria-label="Altro">${on && sp.player.is_playing ? eq(true) : icon('dots')}</button></span>
  </div>`;
}

const chiaveTema = () => `tema:${periodoMusica().id}`;
function temaSezione() {
  const per = periodoMusica();
  const list = S.letto(chiaveTema());
  if (list) contesti.set('tema', { uris: list.map((t) => t.uri) });
  return html`<div class="section-title"><span>${icon(per.icon, 'xs')} ${/^Aspettando/.test(per.label) ? per.label : per.tile}</span>
      ${list && list.length ? html`<button class="card-link" data-action="sp-suona" data-ctx="tema" data-casuale="1">${icon('shuffle', 'xs')} Riproduci</button>` : ''}</div>
    ${list ? list.length ? html`<div class="sp-hs">${list.map((t) => tileBrano(t, 'tema'))}</div>` : '' : S.fallito(chiaveTema()) ? '' : html`<p class="muted small sp-wait">Cerco le canzoni giuste…</p>`}`;
}

function perTeSezione() {
  const r = S.letto(S.chiave('perte'));
  if (!r) return S.fallito(S.chiave('perte')) ? '' : html`<div class="section-title"><span>Scelti per te</span></div><p class="muted small sp-wait">Guardo cosa ti piace…</p>`;
  if (!r.scelti.length && !r.novita.length) return '';
  contesti.set('perte', { uris: r.scelti.map((t) => t.uri) });
  const tutti = ui('sp.perte.tutti', false);
  const da = r.artisti.slice(0, 3).map((a) => a.name).join(', ');
  return html`
    ${r.scelti.length ? html`<div class="section-title"><span>Scelti per te</span><button class="card-link" data-action="sp-suona" data-ctx="perte">${icon('play', 'xs filled')} Riproduci</button></div>
      ${da ? html`<p class="muted small sp-perche">Perché ascolti ${da}</p>` : ''}
      <div class="list">${(tutti ? r.scelti : r.scelti.slice(0, 5)).map((t) => trackRow(t, 'perte'))}</div>
      ${r.scelti.length > 5 ? html`<button class="card-link sp-more" data-action="sp-perte-tutti">${tutti ? 'Mostra meno' : 'Altri suggerimenti'}</button>` : ''}` : ''}
    ${r.novita.length ? html`<div class="section-title"><span>Novità dai tuoi artisti</span></div>
      <div class="sp-hs">${r.novita.map((x) => tile(x, `#/musica/album/${x.id}`, { sub: [nomiArtisti(x), x.tipo === 'single' ? 'singolo' : x.anno].filter(Boolean).join(' · '), ph: 'disc', play: x.uri }))}</div>` : ''}`;
}

// ---------------------------------------------------------------------------
// Sottopagine
// ---------------------------------------------------------------------------
// Indietro come su Spotify: torna alla pagina di Musica di prima (artista → album → indietro = artista);
// entrando da fuori (Musica, la Home, il lettore) riporta a Musica.
const storia = [];
function segnaStoria() {
  const h = location.hash;
  if (!/^#\/musica\//.test(h)) { storia.length = 0; return; }
  if (storia.length >= 2 && storia[storia.length - 2] === h) storia.pop();
  else if (storia[storia.length - 1] !== h) storia.push(h);
}
window.addEventListener('hashchange', segnaStoria);
segnaStoria();
const back = () => (storia.length >= 2
  ? html`<button class="back-link" type="button" data-action="sp-back">${icon('left', 'sm')} Indietro</button>`
  : html`<a class="back-link" href="#/svago/musica">${icon('left', 'sm')} Musica</a>`);
const caricamento = (key) => (S.fallito(key)
  ? html`<div class="sp-wait-box"><p class="muted">Spotify non ha risposto.</p><button class="btn" data-action="sp-riprova">${icon('refresh', 'sm')} Riprova</button></div>`
  : html`<p class="muted small sp-wait">Un attimo…</p>`);

const TIPO_LABEL = { tutto: 'Tutto', track: 'Brani', artist: 'Artisti', album: 'Album', playlist: 'Playlist' };
const recenti = () => { try { return JSON.parse(lsGet('casa.spotify.recenti') || '[]'); } catch { return []; } };
function ricorda(q) {
  q = String(q || '').trim();
  if (q.length < 2) return;
  lsSet('casa.spotify.recenti', JSON.stringify([q, ...recenti().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8)));
}

function cercaPage() {
  const q = ui('sp.q', '');
  const tipo = ui('sp.tipo', 'tutto');
  const qq = q.trim();
  let corpo = '';
  if (qq.length < 2) {
    const rec = recenti();
    corpo = rec.length
      ? html`<div class="section-title"><span>Cercati di recente</span><button class="card-link" data-action="sp-recenti-x">Cancella</button></div>
        <div class="chips wrap">${rec.map((r) => html`<button class="chip" data-action="sp-recente" data-v="${r}">${icon('search', 'xs')} ${r}</button>`)}</div>`
      : html`<div class="empty fade-in">${icon('search', 'lg')}<p><b>Cosa ascoltiamo?</b></p><p class="small">Un brano, un artista, un album o una playlist.</p></div>`;
  } else if (tipo === 'tutto') {
    const key = S.chiave('cerca', 'tutto', qq);
    const r = S.letto(key);
    if (!r) corpo = caricamento(key);
    else {
      // un brano trovato parte con dopo gli altri brani trovati
      contesti.set('cerca', { uris: r.track.map((t) => t.uri) });
      const nessuno = !r.track.length && !r.artist.length && !r.album.length && !r.playlist.length;
      const top = migliore(r, qq);
      corpo = nessuno ? html`<p class="muted sp-wait">Niente per «${qq}».</p>` : html`
        ${top ? html`<div class="section-title"><span>Risultato migliore</span></div>${schedaMigliore(top)}` : ''}
        ${r.track.length ? html`<div class="section-title"><span>Brani</span>${r.track.length > 4 ? html`<button class="card-link" data-action="sp-tipo" data-v="track">Tutti ${icon('right', 'xs')}</button>` : ''}</div>
          <div class="list">${r.track.slice(0, 4).map((t) => trackRow(t, 'cerca'))}</div>` : ''}
        ${r.artist.length ? html`<div class="section-title"><span>Artisti</span></div>
          <div class="sp-hs">${r.artist.map((x) => tile(x, `#/musica/artista/${x.id}`, { ph: 'user', round: true, play: x.uri }))}</div>` : ''}
        ${r.album.length ? html`<div class="section-title"><span>Album</span></div>
          <div class="sp-hs">${r.album.map((x) => tile(x, `#/musica/album/${x.id}`, { sub: alSub(x), ph: 'disc', play: x.uri }))}</div>` : ''}
        ${r.playlist.length ? html`<div class="section-title"><span>Playlist</span></div>
          <div class="sp-hs">${r.playlist.map((x) => tile(x, `#/musica/pl/${x.id}`, { sub: plSub(x), play: x.uri }))}</div>` : ''}`;
    }
  } else {
    const pagine = ui(`sp.pag.cerca.${tipo}.${qq}`, 1);
    const keys = Array.from({ length: pagine }, (_, i) => S.chiave('cerca', tipo, qq, i * 10));
    const parti = keys.map((k) => S.letto(k));
    const ok = parti.filter(Boolean);
    const items = ok.flatMap((r) => r[tipo] || []);
    const altri = ok.length === pagine && ok[ok.length - 1].altri[tipo];
    if (tipo !== 'track') contesti.set('cerca', {});
    let lista = '';
    if (tipo === 'track') { contesti.set('cerca', { uris: items.map((t) => t.uri) }); lista = html`<div class="list">${items.map((t) => trackRow(t, 'cerca'))}</div>`; }
    else if (tipo === 'artist') lista = html`<div class="sp-grid">${items.map((x) => tile(x, `#/musica/artista/${x.id}`, { ph: 'user', round: true, play: x.uri }))}</div>`;
    else if (tipo === 'album') lista = html`<div class="sp-grid">${items.map((x) => tile(x, `#/musica/album/${x.id}`, { sub: alSub(x), ph: 'disc', play: x.uri }))}</div>`;
    else lista = html`<div class="sp-grid">${items.map((x) => tile(x, `#/musica/pl/${x.id}`, { sub: plSub(x), play: x.uri }))}</div>`;
    corpo = html`${items.length ? lista : ok.length ? html`<p class="muted sp-wait">Niente per «${qq}».</p>` : ''}
      ${ok.length < pagine ? caricamento(keys[ok.length]) : ''}
      ${altri ? html`<button class="card-link sp-more" data-action="sp-altri" data-k="cerca.${tipo}.${qq}">Altri risultati</button>` : ''}`;
  }
  return html`${back()}
    <header class="page-head"><div><p class="eyebrow">Spotify</p><h1>Cerca</h1></div></header>
    <form class="sp-q" data-form="sp-cerca" role="search">
      ${icon('search', 'sm')}
      <input id="sp-q" name="q" type="search" value="${q}" placeholder="Brani, artisti, album, playlist" data-input="sp-q" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Cerca su Spotify">
      ${cancella('sp-q')}
    </form>
    ${qq.length >= 2 ? html`<div class="chips">${Object.entries(TIPO_LABEL).map(([k, l]) => html`<button class="chip ${tipo === k ? 'on' : ''}" data-action="sp-tipo" data-v="${k}">${l}</button>`)}</div>` : ''}
    ${corpo}`;
}

/** Il risultato migliore: l'artista, il brano, l'album o la playlist che somiglia di più a quello che si cerca. */
function migliore(r, q) {
  const qq = norm(q);
  const vicino = (x) => { const n = x && norm(x.name); return Boolean(n) && (n === qq || n.startsWith(qq) || qq.startsWith(n)); };
  const [a, t, al, pl] = [r.artist[0], r.track[0], r.album[0], r.playlist[0]];
  if (vicino(a)) return { tipo: 'artist', x: a };
  if (vicino(t)) return { tipo: 'track', x: t };
  if (vicino(al)) return { tipo: 'album', x: al };
  if (vicino(pl)) return { tipo: 'playlist', x: pl };
  return a ? { tipo: 'artist', x: a } : t ? { tipo: 'track', x: t } : null;
}
function schedaMigliore({ tipo, x }) {
  const href = tipo === 'artist' ? `#/musica/artista/${x.id}` : tipo === 'album' ? `#/musica/album/${x.id}` : tipo === 'playlist' ? `#/musica/pl/${x.id}` : x.album && x.album.id ? `#/musica/album/${x.album.id}` : '#/musica/cerca';
  const sotto = tipo === 'artist' ? 'Artista' : tipo === 'album' ? `${tipoUscita(x)} · ${nomiArtisti(x)}` : tipo === 'playlist' ? ['Playlist', x.owner].filter(Boolean).join(' · ') : `Brano · ${nomiArtisti(x)}`;
  const parti = tipo === 'track' ? `data-action="sp-brano" data-uri="${x.uri}" data-ctx="cerca"` : `data-action="sp-suona" data-ctx="${x.uri}"`;
  const on = tipo === 'track' ? x.uri === suonaOra() : x.uri === ctxOra();
  return html`<div class="sp-best ${on ? 'on' : ''}">
    <a class="sp-best-link" href="${href}">
      ${cover(tipo === 'track' ? x.big || x.img : x.img, tipo === 'artist' ? 'user' : tipo === 'album' ? 'disc' : 'music', `sp-best-img ${tipo === 'artist' ? 'round' : ''}`)}
      <b>${x.name}</b><span>${tipo === 'track' && x.e ? html`<i class="sp-e">E</i>` : ''}${sotto}</span>
    </a>
    <button class="sp-best-play" ${raw(parti)} aria-label="Fai partire ${x.name}">${on && sp.player && sp.player.is_playing ? eq(true) : icon('play', 'filled')}</button>
  </div>`;
}

function hero(info, { eyebrow, sub, ph = 'music', round = false }) {
  return html`<div class="sp-hero">
    ${cover(info.big || info.img, ph, `sp-hero-img ${round ? 'round' : ''} ${ph === 'heart' ? 'sp-fav' : ''}`)}
    <div class="sp-hero-txt"><p class="eyebrow">${eyebrow}</p><h1>${info.name}</h1>${sub ? html`<p class="muted small">${sub}</p>` : ''}</div>
  </div>`;
}
/**
 * I comandi di una pagina, come su Spotify: a sinistra ♥ (o «Segui») e ⋯, a destra «casuale» e il grande play.
 * Ci stanno anche sull'iPhone più piccolo.
 */
function azioni(ctxKey, { salva = '', menu = '', altro = '', segui = null } = {}) {
  const saved = salva ? S.salvato(salva) : false;
  return html`<div class="sp-actions sp-azioni">
    <div class="sp-az">
      ${segui ? html`<button class="btn sp-segui ${segui.on ? 'on' : ''}" data-action="sp-segui" data-uri="${segui.uri}" data-nome="${segui.nome}" aria-pressed="${segui.on ? 'true' : 'false'}">${segui.on ? html`${icon('check', 'xs')} Segui già` : 'Segui'}</button>` : ''}
      ${salva ? html`<button class="icon-btn sp-save ${saved ? 'on' : ''}" data-action="sp-cuore" data-uri="${salva}" aria-label="${saved ? 'Togli dalla libreria' : 'Salva nella libreria'}">${icon('heart', saved ? 'filled' : '')}</button>` : ''}
      ${menu ? html`<button class="icon-btn" data-action="sp-pl-menu" data-id="${menu}" aria-label="Modifica playlist">${icon('dots')}</button>` : ''}
      ${altro ? html`<button class="icon-btn" data-action="sp-altro" data-uri="${altro}" aria-label="Altro">${icon('dots')}</button>` : ''}
    </div>
    <div class="sp-az">
      <button class="icon-btn sp-casuale" data-action="sp-suona" data-ctx="${ctxKey}" data-casuale="1" aria-label="Casuale" title="Casuale">${icon('shuffle')}</button>
      <button class="sp-gioca" data-action="sp-suona" data-ctx="${ctxKey}" aria-label="Riproduci" title="Riproduci">${icon('play', 'filled')}</button>
    </div>
  </div>`;
}

function listaPaginata(base, ctxKey, opts = {}) {
  const pagine = ui(`sp.pag.${base}`, 1);
  const keys = Array.from({ length: pagine }, (_, i) => S.chiave(base, i * 50));
  const ok = keys.map((k) => S.letto(k)).filter(Boolean);
  const list = ok.flatMap((r) => r.list || []);
  const c = contesti.get(ctxKey) || {};
  if (c.lista) c.uris = list.map((t) => t.uri);
  return html`${list.length ? html`<div class="list">${list.map((t) => trackRow(t, ctxKey, opts))}</div>` : ''}
    ${ok.length < pagine ? caricamento(keys[ok.length]) : ''}
    ${ok.length === pagine && ok[ok.length - 1].altri ? html`<button class="card-link sp-more" data-action="sp-altri" data-k="${base}">Altri brani</button>` : ''}`;
}

function preferitiPage() {
  const first = S.letto(S.chiave('preferiti', 0));
  contesti.set('preferiti', { lista: true, uris: [] });
  return html`${back()}
    ${hero({ name: 'Brani che ti piacciono', big: '' }, { eyebrow: 'Preferiti', sub: first ? plural(first.totale, 'brano', 'brani') : '', ph: 'heart' })}
    ${first && first.list.length ? azioni('preferiti') : ''}
    ${first && !first.list.length ? html`<div class="empty">${icon('heart', 'lg')}<p><b>Ancora nessun preferito</b></p><p class="small">Tocca il cuore accanto a un brano per salvarlo qui.</p></div>` : ''}
    ${listaPaginata('preferiti', 'preferiti')}`;
}

function playlistPage(id) {
  const first = S.letto(S.chiave('pl', id, 0));
  const ctxKey = `pl:${id}`;
  if (!first) return html`${back()}${caricamento(S.chiave('pl', id, 0))}`;
  const info = first.info || {};
  contesti.set(ctxKey, { context: info.uri, own: info.own ? id : null });
  const sub = [info.own ? '' : info.owner, info.n != null ? plural(info.n, 'brano', 'brani') : ''].filter(Boolean).join(' · ');
  return html`${back()}
    ${hero(info, { eyebrow: info.own ? 'La tua playlist' : 'Playlist', sub, ph: 'headphones' })}
    ${info.descr ? html`<p class="muted small sp-descr">${info.descr}</p>` : ''}
    ${azioni(ctxKey, { salva: info.own ? '' : info.uri, menu: info.own ? id : '' })}
    ${first.list === null
      ? html`<p class="muted small sp-wait">Spotify mostra i brani solo delle vostre playlist: questa si può far partire e salvare.</p>`
      : first.list.length || first.altri ? listaPaginata(`pl:${id}`, ctxKey)
        : html`<div class="empty">${icon('headphones', 'lg')}<p><b>Playlist vuota</b></p><p class="small">Cerca un brano e tocca ⋯ → «Aggiungi a una playlist».</p>
          <a class="btn" href="#/musica/cerca">${icon('search', 'sm')} Cerca</a></div>`}`;
}

/** Un album: copertina, artisti (si toccano), brani (con i dischi), data, durata, diritti e "Altro di…". */
function albumPage(id) {
  const key = S.chiave('album', id);
  const r = S.letto(key);
  if (!r) return html`${back()}${caricamento(key)}`;
  const a = r.info;
  const ctxKey = `album:${id}`;
  contesti.set(ctxKey, { context: a.uri });
  const dischi = new Set(r.list.map((t) => t.disco)).size > 1;
  const durata = r.list.reduce((tot, t) => tot + (t.ms || 0), 0);
  const a0 = (a.artists || [])[0];
  const altro = a0 ? ['album', 'single'].flatMap((g) => (S.letto(S.chiave('disco', a0.id, g, 0)) || { list: [] }).list).filter((x) => x.id !== id) : [];
  let disco = 0;
  return html`${back()}
    <div class="sp-album">
      ${cover(a.big || a.img, 'disc', 'sp-album-img')}
      <div class="sp-album-txt">
        <h1>${a.name}</h1>
        <p class="sp-album-art">${(a.artists || []).map((x, i) => html`${i ? ', ' : ''}<a href="#/musica/artista/${x.id}">${x.name}</a>`)}</p>
        <p class="muted small">${[tipoUscita(a), a.anno].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
    ${azioni(ctxKey, { salva: a.uri, altro: a.uri })}
    <div class="list sp-album-list">${r.list.map((t) => {
      const testa = dischi && t.disco !== disco ? html`<div class="sp-disco-h">${icon('disc', 'xs')} Disco ${t.disco}</div>` : '';
      disco = t.disco;
      return html`${testa}${trackRow(t, ctxKey, { numero: true })}`;
    })}</div>
    <p class="sp-album-foot">${dataLunga(a)}<br>${plural(r.list.length, 'brano', 'brani')}, ${durataLunga(durata)}${(a.diritti || []).map((d) => html`<br><span>${d}</span>`)}</p>
    ${altro.length ? html`<div class="section-title"><span>Altro di ${a0.name}</span><a class="card-link" href="#/musica/artista/${a0.id}/discografia/album">Discografia ${icon('right', 'xs')}</a></div>
      <div class="sp-hs">${altro.slice(0, 12).map((x) => tile(x, `#/musica/album/${x.id}`, { sub: [x.anno, tipoUscita(x)].join(' · '), ph: 'disc', play: x.uri }))}</div>` : ''}`;
}

/** Un artista: segui, brani, ultima uscita, discografia (album, singoli ed EP, compilation) e dove appare. */
function artistaPage(id) {
  const key = S.chiave('artista', id);
  const r = S.letto(key);
  if (!r) return html`${back()}${caricamento(key)}`;
  const a = r.info;
  const ctxKey = `artista:${id}`;
  contesti.set(ctxKey, { context: a.uri });
  const segui = S.salvato(a.uri);
  const gr = Object.fromEntries(S.GRUPPI.map((g) => [g, S.letto(S.chiave('disco', id, g, 0))]));
  const kb = S.chiave('artista-brani', id);
  const brani = S.letto(kb);
  if (brani) contesti.set(`brani:${id}`, { uris: brani.map((t) => t.uri) });
  const tutti = ui(`sp.ab.${id}`, false);
  // l'ultima uscita: la più recente tra album e singoli
  const ultima = [...(gr.album ? gr.album.list : []), ...(gr.single ? gr.single.list : [])].sort((x, y) => String(y.data).localeCompare(String(x.data)))[0];
  const gruppi = ['album', 'single', 'compilation'].filter((g) => gr[g] && gr[g].list.length);
  const sel = gruppi.includes(ui(`sp.disco.${id}`, '')) ? ui(`sp.disco.${id}`, '') : gruppi[0];
  const carica = ['album', 'single', 'compilation'].some((g) => !gr[g] && !S.fallito(S.chiave('disco', id, g, 0)));
  return html`${back()}
    <div class="sp-artist">
      ${cover(a.big || a.img, 'user', 'sp-artist-img')}
      <div class="sp-artist-txt"><p class="eyebrow">Artista</p><h1>${a.name}</h1>${a.generi && a.generi.length ? html`<p class="sp-generi">${a.generi.join(' · ')}</p>` : ''}</div>
    </div>
    ${azioni(ctxKey, { altro: a.uri, segui: { uri: a.uri, nome: a.name, on: segui } })}
    <div class="section-title"><span>Brani</span></div>
    ${brani ? brani.length ? html`<div class="list">${(tutti ? brani : brani.slice(0, 5)).map((t) => trackRow(t, `brani:${id}`))}</div>
      ${brani.length > 5 ? html`<button class="card-link sp-more" data-action="sp-ab" data-id="${id}">${tutti ? 'Mostra meno' : 'Mostra altri'}</button>` : ''}`
      : html`<p class="muted small sp-wait">Nessun brano trovato.</p>` : caricamento(kb)}
    ${ultima ? html`<div class="section-title"><span>Ultima uscita</span></div><div class="list">${rigaAlbum(ultima, { lunga: true })}</div>` : ''}
    ${gruppi.length ? html`<div class="section-title"><span>Discografia</span><a class="card-link" href="#/musica/artista/${id}/discografia/${sel}">Mostra tutto ${icon('right', 'xs')}</a></div>
      ${gruppi.length > 1 ? html`<div class="chips sp-chips">${gruppi.map((g) => html`<button class="chip ${sel === g ? 'on' : ''}" data-action="sp-disco" data-id="${id}" data-v="${g}">${GRUPPO_LABEL[g]}</button>`)}</div>` : ''}
      <div class="sp-hs">${gr[sel].list.map((x) => tile(x, `#/musica/album/${x.id}`, { sub: [x.anno, tipoUscita(x)].join(' · '), ph: 'disc', play: x.uri }))}</div>`
      : carica ? html`<div class="section-title"><span>Discografia</span></div><p class="muted small sp-wait">Un attimo…</p>` : ''}
    ${gr.appears_on && gr.appears_on.list.length ? html`<div class="section-title"><span>Appare in</span>${gr.appears_on.altri ? html`<a class="card-link" href="#/musica/artista/${id}/discografia/appears_on">Tutto ${icon('right', 'xs')}</a>` : ''}</div>
      <div class="sp-hs">${gr.appears_on.list.map((x) => tile(x, `#/musica/album/${x.id}`, { sub: [x.anno, nomiArtisti(x)].filter(Boolean).join(' · '), ph: 'disc', play: x.uri }))}</div>` : ''}`;
}

/** Tutta la discografia di un artista, un gruppo alla volta (10 per volta: il massimo che Spotify concede). */
function discografiaPage(id, gruppo) {
  const r = S.letto(S.chiave('artista', id));
  const g = S.GRUPPI.includes(gruppo) ? gruppo : 'album';
  const pagine = ui(`sp.pag.disco.${id}.${g}`, 1);
  const keys = Array.from({ length: pagine }, (_, i) => S.chiave('disco', id, g, i * 10));
  const ok = keys.map((k) => S.letto(k)).filter(Boolean);
  const list = ok.flatMap((x) => x.list);
  const ultimo = ok[ok.length - 1];
  const primi = Object.fromEntries(S.GRUPPI.map((x) => [x, S.letto(S.chiave('disco', id, x, 0))]));
  const gruppi = S.GRUPPI.filter((x) => x === g || !primi[x] || primi[x].totale);
  return html`${back()}
    <header class="page-head"><div><p class="eyebrow">${r ? r.info.name : 'Artista'}</p><h1>Discografia</h1></div></header>
    <div class="chips sp-chips">${gruppi.map((x) => html`<button class="chip ${x === g ? 'on' : ''}" data-action="sp-disco-vai" data-id="${id}" data-v="${x}">${GRUPPO_LABEL[x]}${primi[x] && primi[x].totale ? html` <span class="sp-n">${primi[x].totale}</span>` : ''}</button>`)}</div>
    ${list.length ? html`<div class="list sp-disco">${list.map((x) => rigaAlbum(x, { lunga: true }))}</div>` : ok.length === pagine ? html`<p class="muted sp-wait">Niente qui.</p>` : ''}
    ${ok.length < pagine ? caricamento(keys[ok.length]) : ''}
    ${ok.length === pagine && ultimo && ultimo.altri ? html`<button class="card-link sp-more" data-action="sp-altri" data-k="disco.${id}.${g}">Altri</button>` : ''}`;
}

/** Le sottopagine di Musica. */
export function render(r) {
  if (!isSynced() || !S.chi()) return html`${back()}<div class="empty"><p><b>Spotify non è collegato</b></p></div>`;
  const [, sub, id] = r;
  if (sub === 'cerca') return cercaPage();
  if (sub === 'preferiti') return preferitiPage();
  if (sub === 'pl' && id) return playlistPage(id);
  if (sub === 'album' && id) return albumPage(id);
  if (sub === 'artista' && id) return r[3] === 'discografia' ? discografiaPage(id, r[4]) : artistaPage(id);
  return html`${back()}`;
}

// ---------------------------------------------------------------------------
// Caricamenti: entrando nella pagina e a ogni ridisegno (le letture sono in memoria)
// ---------------------------------------------------------------------------
let dentro = false;
function avvia() {
  if (dentro || !isSynced()) return;
  dentro = true;
  let partito = false;
  const parti = () => {
    if (partito || !S.chi()) return;
    partito = true;
    S.aggiorna({ dispositivi: true });
    S.caricaPlaylist().catch(errore);
    S.avviaGiro();
  };
  // di base la musica parte qui: il lettore dentro l'app si prepara subito, così al primo tocco su un
  // brano parte da questo iPhone/iPad senza altri passaggi
  const prepara = () => { if (S.chi() && !S.qui.player && S.quiPossibile()) S.preparaQui().catch(muto); };
  parti(); // dall'ultima volta so già chi è collegato: parto subito
  prepara();
  S.caricaInfo().then(() => { parti(); prepara(); });
}
window.addEventListener('hashchange', () => { if (!S.inMusica()) dentro = false; });

const muto = () => {};
function caricaPagine(base, fn) {
  const pagine = ui(`sp.pag.${base}`, 1);
  for (let i = 0; i < pagine; i++) {
    const key = S.chiave(base, i * 50);
    if (!S.letto(key) && !S.fallito(key)) { S.leggi(key, () => fn(i * 50)).catch(muto); return; }
  }
}
const uriDi = (list) => (list || []).map((t) => t.uri);
/** Una pagina della discografia (se non c'è già). false = sta ancora arrivando (le pagine dopo aspettano). */
function caricaDisco(id, g, offset) {
  const key = S.chiave('disco', id, g, offset);
  if (S.letto(key)) return true;
  if (!S.fallito(key)) S.leggi(key, () => S.discografia(id, g, offset), { maxAge: 30 * 60000 }).catch(muto);
  return false;
}

// gli account di cui in questa visita a Musica ho già chiesto i suggerimenti (cambiando account si chiedono quelli nuovi)
let suggerimenti = new Set();
window.addEventListener('hashchange', () => { if (!S.inMusica()) suggerimenti = new Set(); });
/** La lista a tema vale per tutti (una settimana), "per te" è del proprio account (qualche ora). */
async function caricaSuggerimenti(k = S.chi()) {
  if (!k) return;
  const acc = (sp.info && sp.info.account && sp.info.account[k]) || {};
  if (acc.extra !== false) {
    try { await S.leggi(S.chiaveDi(k, 'recenti'), () => S.ascoltatiDiRecente(k), { maxAge: 5 * 60000, conserva: true }); } catch { /* alla prossima */ }
    try { await S.leggi(S.chiaveDi(k, 'topartisti'), () => S.artistiDelMomento(k), { maxAge: 12 * 3600000, conserva: true }); } catch { /* idem */ }
  }
  try {
    const d = await S.leggi(S.chiaveDi(k, 'perte'), () => S.perTe(k), { maxAge: 6 * 3600000, conserva: { dopo: (x) => S.registra(x.scelti) } });
    if (k === S.chi()) S.controllaSalvati(uriDi(d.scelti));
  } catch { /* riprovo alla prossima visita */ }
  try { await S.leggi(chiaveTema(), () => S.trovaBrani(periodoMusica().brani), { maxAge: 7 * 86400000, conserva: { dopo: S.registra } }); } catch { /* idem */ }
}

/**
 * All'apertura dell'app, in sottofondo: cosa suona e dove, la libreria, i suggerimenti con le loro copertine
 * e il lettore dentro l'app già pronto. Entrando in Musica è tutto lì, e il primo brano parte subito.
 */
export async function precarica() {
  if (!isSynced()) return;
  await S.caricaInfo();
  const io = S.chi();
  if (!io) return;
  await S.aggiorna({ dispositivi: true });
  // il lettore dentro l'app si prepara subito: al primo tocco su un brano parte senza attese
  if (!S.qui.player && S.quiPossibile()) S.preparaQui().catch(muto);
  const account = [io, ...S.collegati().filter((x) => x !== io)];
  const copertine = (k) => {
    const pt = S.letto(S.chiaveDi(k, 'perte'));
    return [
      ...(S.letto(S.chiaveDi(k, 'recenti')) || []).map((x) => x.img),
      ...(S.letto(S.chiaveDi(k, 'topartisti')) || []).map((x) => x.img),
      ...((sp.playlists[k] || {}).list || []).slice(0, 12).map((p) => p.img),
      ...(pt ? [...pt.scelti.map((t) => t.big || t.img), ...pt.novita.map((x) => x.img)] : []),
    ];
  };
  for (const k of account) {
    await S.caricaPlaylist(k).catch(muto);
    await caricaSuggerimenti(k);
    const ora = k === io && sp.player && sp.player.item ? S.brano(sp.player.item) : null;
    S.scaldaCopertine([ora && ora.big, ora && ora.xl, ...copertine(k), ...(S.letto(chiaveTema()) || []).map((t) => t.big || t.img)]);
  }
}

let cercaT;
let messoFuoco = false;
export function after(r) {
  avvia();
  if (!isSynced() || !S.chi()) return;
  const [, sub, id] = r;
  if (!sub) {
    // suggerimenti: dopo il lettore e uno alla volta (Spotify non ama le raffiche di richieste)
    const k = S.chi();
    if (!suggerimenti.has(k) && sp.playerAt && sp.playlists[k]) { suggerimenti.add(k); setTimeout(() => caricaSuggerimenti(k), 600); }
    if (vistaLibreria() === 'album') caricaPagine('mieialbum', (o) => S.albumSalvati(o));
    if (vistaLibreria() === 'artisti') {
      const pagine = ui('sp.pag.seguiti', 1);
      for (let i = 0; i < pagine; i++) {
        const key = S.chiave('seguiti', i);
        if (S.letto(key)) continue;
        const prima = i ? S.letto(S.chiave('seguiti', i - 1)) : null;
        if (!S.fallito(key)) S.leggi(key, () => S.artistiSeguiti(prima ? prima.dopo : '')).catch(muto);
        break;
      }
    }
  } else if (sub === 'cerca') {
    const q = ui('sp.q', '').trim();
    const tipo = ui('sp.tipo', 'tutto');
    if (!messoFuoco) { messoFuoco = true; const el = document.getElementById('sp-q'); if (el && !q) el.focus(); }
    if (q.length >= 2) {
      if (tipo === 'tutto') {
        const key = S.chiave('cerca', 'tutto', q);
        if (!S.letto(key) && !S.fallito(key)) { clearTimeout(cercaT); cercaT = setTimeout(() => S.leggi(key, () => S.cercaSu(q)).then((x) => S.controllaSalvati(uriDi(x.track))).catch(muto), 300); }
      } else {
        const pagine = ui(`sp.pag.cerca.${tipo}.${q}`, 1);
        for (let i = 0; i < pagine; i++) {
          const key = S.chiave('cerca', tipo, q, i * 10);
          if (!S.letto(key) && !S.fallito(key)) { clearTimeout(cercaT); cercaT = setTimeout(() => S.leggi(key, () => S.cercaSu(q, [tipo], i * 10)).then((x) => S.controllaSalvati(uriDi(x.track))).catch(muto), i ? 0 : 300); break; }
        }
      }
    }
  } else if (sub === 'preferiti') {
    caricaPagine('preferiti', (o) => S.preferiti(o));
  } else if (sub === 'pl' && id) {
    caricaPagine(`pl:${id}`, (o) => S.playlist(id, o).then((x) => { S.controllaSalvati(uriDi(x.list).concat(x.info && !x.info.own ? [x.info.uri] : [])); return x; }));
  } else if (sub === 'album' && id) {
    const key = S.chiave('album', id);
    if (!S.letto(key) && !S.fallito(key)) S.leggi(key, () => S.album(id), { maxAge: 30 * 60000 }).then((x) => S.controllaSalvati([x.info.uri, ...uriDi(x.list)])).catch(muto);
    // "Altro di…": album e singoli dell'artista principale
    const x = S.letto(key);
    const a0 = x && x.info.artists && x.info.artists[0];
    if (a0 && a0.id) ['album', 'single'].forEach((g) => caricaDisco(a0.id, g, 0));
  } else if (sub === 'artista' && id) {
    const key = S.chiave('artista', id);
    if (!S.letto(key) && !S.fallito(key)) S.leggi(key, () => S.artista(id), { maxAge: 30 * 60000 }).then((x) => S.controllaSalvati([x.info.uri])).catch(muto);
    const x = S.letto(key);
    if (r[3] === 'discografia') {
      const g = S.GRUPPI.includes(r[4]) ? r[4] : 'album';
      S.GRUPPI.forEach((y) => caricaDisco(id, y, 0)); // i numeri sui bottoni
      const pagine = ui(`sp.pag.disco.${id}.${g}`, 1);
      for (let i = 1; i < pagine; i++) if (!caricaDisco(id, g, i * 10)) break;
    } else {
      S.GRUPPI.forEach((g) => caricaDisco(id, g, 0));
      const kb = S.chiave('artista-brani', id);
      if (x && !S.letto(kb) && !S.fallito(kb)) S.leggi(kb, () => S.braniArtista(id, x.info.name), { maxAge: 30 * 60000 }).then((l) => S.controllaSalvati(uriDi(l))).catch(muto);
    }
  }
}
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/musica/cerca')) messoFuoco = false; });

/** Tira giù per aggiornare. */
export async function refresh() {
  if (!isSynced() || !S.chi()) return;
  S.dimentica(S.chiave(''));
  await Promise.all([S.aggiorna({ dispositivi: true }), S.caricaPlaylist(S.chi(), true).catch(() => {})]);
}

// copertine che non arrivano: resta l'icona sotto
document.addEventListener('error', (ev) => {
  const el = ev.target;
  if (el && el.tagName === 'IMG' && el.closest('.sp-cover, .sp-img')) el.remove();
}, true);

// di ritorno dalla pagina di Spotify
{
  const esito = new URLSearchParams(location.search).get('spotify');
  if (esito) {
    history.replaceState(null, '', location.pathname + location.hash);
    const msg = {
      ok: 'Spotify collegato',
      annullato: 'Collegamento a Spotify annullato',
      utente: 'Spotify non conosce ancora questo account: va aggiunto agli utenti dell’app Spotify',
      errore: 'Spotify non ha risposto: riprova',
    }[esito];
    if (msg) setTimeout(() => toast(msg, { ms: esito === 'utente' ? 7000 : 3200 }), 700);
  }
}

// ---------------------------------------------------------------------------
// Far partire la musica e dove
// ---------------------------------------------------------------------------
let inAttesa = null; // cosa far partire appena si sceglie il dispositivo

/**
 * Fa partire qualcosa. Di base qui, sul dispositivo che si sta usando (dentro l'app); su un altro
 * (Echo, iPad…) se è stato scelto in "Dove ascoltare?" e ci si è ancora collegati. Se qui non si può
 * e non c'è altro, chiede dove.
 */
export async function suonaQui(target, casuale = false) {
  let dove = S.doveSuonare();
  if (dove === S.QUI) {
    // il lettore dentro l'app va acceso dentro il tocco: iPhone e iPad fanno suonare solo così
    const pronto = S.attivaQui();
    const lento = setTimeout(() => toast(`Accendo il lettore su ${questo()}…`, { ms: 2500 }), 800);
    try { dove = await pronto; } catch (e) { console.warn(e); dove = null; } finally { clearTimeout(lento); }
    if (!dove) { inAttesa = { target, casuale }; devSheet(`Su ${questo()} Spotify adesso non suona dentro l’app: scegli dove ascoltare.`); return; }
  } else if (!dove) {
    if (!sp.devices) await S.aggiorna({ dispositivi: true });
    dove = S.doveSuonare();
    if (!dove || dove === S.QUI) { inAttesa = { target, casuale }; devSheet(); return; }
  }
  const parti = () => (casuale ? S.suonaCasuale(target, dove) : S.suona(target, dove));
  try {
    await parti();
  } catch (e) {
    let err = e;
    // il lettore appena acceso a volte per Spotify "non c'è ancora": riprovo una volta
    if (S.eQui(dove) && (err.status === 404 || err.reason === 'NO_ACTIVE_DEVICE')) {
      await new Promise((ok) => setTimeout(ok, 1200));
      try { await parti(); return; } catch (e2) { err = e2; }
    }
    if (err.status === 404 || err.reason === 'NO_DEVICE' || err.reason === 'NO_ACTIVE_DEVICE') { inAttesa = { target, casuale }; devSheet('Quel dispositivo non risponde: scegline un altro.'); return; }
    throw err;
  }
}

// i dispositivi che non si vogliono vedere (es. l'Echo di qualcun altro): per nome, uguali per tutta la casa
const nascosti = () => (Array.isArray(settings().spotifyNascosti) ? settings().spotifyNascosti : []);

function devList() {
  const list = sp.devices;
  const cur = sceltoOAttivo();
  const quiAcceso = list && S.qui.id && list.find((d) => d.id === S.qui.id);
  // un vecchio lettore di questo stesso dispositivo (tentativo precedente) non va mostrato due volte
  const altri = (list || []).filter((d) => !S.eQui(d.id) && !(comperotto(d) && d.name === S.nomeQui()));
  const via = nascosti();
  // quello che sta suonando si vede sempre, anche se è tra i nascosti
  const visibili = altri.filter((d) => d.is_active || !via.includes(d.name));
  const celati = [...new Set(altri.filter((d) => !d.is_active && via.includes(d.name)).map((d) => d.name))];
  const tocco = matchMedia('(pointer: coarse)').matches;
  const riga = (d, puoiNascondere = false) => html`<div class="sp-devline">
    <button class="set-row sp-devrow ${d.is_restricted || !d.id ? 'off' : ''}" data-action="sp-dispositivo" data-id="${d.id || ''}" ${d.is_restricted || !d.id ? raw('disabled') : ''}>
      ${icon(devIcon(d))}
      <div class="row-main"><b>${devNome(d)}</b><span>${d.is_active ? (sp.player && sp.player.is_playing ? 'Sta suonando' : 'In pausa') : S.eQui(d.id) || comperotto(d) ? 'Dentro l’app' : d.is_restricted ? 'Non si comanda da qui' : DEV_LABEL[d.type] || 'Dispositivo'}</span></div>
      ${cur && cur.id === d.id ? html`<span class="sp-check">${icon('check', 'sm')}</span>` : ''}
    </button>
    ${puoiNascondere && !d.is_active ? html`<button class="sp-ic sp-nascondi" type="button" data-action="sp-nascondi" data-nome="${d.name}" aria-label="Nascondi ${d.name}">${icon('eyeoff', 'sm')}</button>` : ''}
  </div>`;
  return html`<div class="list">
      ${quiAcceso ? riga(quiAcceso) : html`<button class="set-row sp-devrow" data-action="sp-qui">${icon(isIPad() ? 'tablet' : 'phone')}
        <div class="row-main"><b>Ascolta su ${questo()}</b><span>${sp.busy === 'qui' ? 'Accendo il lettore…' : 'Dentro l’app'}</span></div>${sp.busy === 'qui' ? icon('refresh', 'sm spin') : cur && cur.id === S.QUI ? html`<span class="sp-check">${icon('check', 'sm')}</span>` : ''}</button>`}
      ${visibili.map((d) => riga(d, true))}
    </div>
    ${!list ? html`<p class="muted small" style="padding:10px 4px 0">Cerco gli altri dispositivi…</p>` : ''}
    ${list ? html`<details class="sp-echo-aiuto" ${!visibili.length && !celati.length ? raw('open') : ''}><summary>${icon('speaker', 'xs')} Manca un Echo di casa?</summary>
      <p class="small muted">Spotify fa vedere alle app solo gli Echo «svegli»: di’ all’Echo «Alexa, Spotify Connect» (o fagli mettere un brano da Spotify) e in pochi secondi compare qui. Se non compare nemmeno così, l’Alexa di casa è collegata a un altro Spotify: nell’app Alexa, Altro → Impostazioni → Musica e podcast → Spotify, collega quello di ${nameOf(S.chi())}.</p></details>` : ''}
    ${celati.length ? html`<p class="small muted sp-celati">${icon('eyeoff', 'xs')} Nascosti: ${celati.join(', ')} <button class="card-link" type="button" data-action="sp-mostra">Mostrali</button></p>` : ''}
    ${tocco ? html`<button class="card-link sp-apri" type="button" data-action="sp-apri-app">${icon('link', 'xs')} Apri l’app Spotify</button>` : ''}`;
}

function devSheet(msg = '') {
  S.caricaSdk().catch(muto); // così, se si sceglie "questo iPad", il lettore è già pronto al tocco
  openSheet({
    title: 'Dove ascoltare?',
    body: html`${msg ? html`<p class="prose" style="margin-top:-4px">${msg}</p>` : ''}
      <div id="sp-devlist">${devList()}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" type="button" data-action="sp-cerca-dev">${icon('refresh', 'sm')} Aggiorna</button></div>`,
  });
  aggiornaDev();
  seguiDispositivi();
}

/** Ridisegna la lista solo se è cambiata (e lascia aperto o chiuso l'aiuto come l'ha messo chi guarda). */
function ridisegnaDev() {
  const box = document.getElementById('sp-devlist');
  if (!box) return;
  const nuovo = devList().s;
  if (box._html === nuovo) return;
  const aiuto = box.querySelector('.sp-echo-aiuto');
  const aperto = aiuto ? aiuto.open : null;
  box.innerHTML = nuovo;
  box._html = nuovo;
  const dopo = box.querySelector('.sp-echo-aiuto');
  if (dopo && aperto != null) dopo.open = aperto;
}
// Mentre "Dove ascoltare?" è aperto la lista si aggiorna da sola (ogni 4 secondi, per due minuti): un Echo appena
// svegliato («Alexa, Spotify Connect») compare senza toccare niente.
let seguiT = null;
function seguiDispositivi() {
  clearTimeout(seguiT);
  const fino = Date.now() + 120000;
  const giro = async () => {
    if (!document.getElementById('sp-devlist') || Date.now() > fino) return;
    if (!document.hidden) { await S.aggiorna({ dispositivi: true }); ridisegnaDev(); }
    seguiT = setTimeout(giro, 4000);
  };
  seguiT = setTimeout(giro, 4000);
}
async function aggiornaDev() {
  const btn = document.querySelector('[data-action="sp-cerca-dev"] svg');
  if (btn) btn.classList.add('spin');
  await S.aggiorna({ dispositivi: true });
  if (btn) btn.classList.remove('spin');
  ridisegnaDev();
}
// di ritorno dall'app Spotify: la lista si aggiorna da sola
document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('sp-devlist')) setTimeout(aggiornaDev, 600); });

async function vaiSu(id) {
  const attesa = inAttesa;
  inAttesa = null;
  if (attesa) { if (attesa.casuale) await S.suonaCasuale(attesa.target, id); else await S.suona(attesa.target, id); }
  else if (sp.player) await S.sposta(id);
  else { S.scegliDispositivo(id); rerender(); }
}

// ---------------------------------------------------------------------------
// Errori
// ---------------------------------------------------------------------------
export function errore(e) {
  console.error(e);
  if (!(e instanceof S.SpotifyError) || (!e.status && !e.reason)) {
    const msg = (e && e.message) || '';
    toast(!msg || /fetch|load failed|network/i.test(msg) ? 'Spotify non risponde: controlla la connessione' : msg);
    return;
  }
  const r = e.reason;
  if (r === 'PREMIUM_REQUIRED' || r === 'account_error') toast('Per questo serve Spotify Premium');
  else if (r === 'initialization_error' || r === 'SDK') toast(`Su ${questo()} Spotify non suona dentro l’app: usa l’app Spotify o un Echo`);
  else if (r === 'authentication_error' || (e.status === 403 && /scope/i.test(e.message))) { toast('Va ricollegato Spotify: tocca «Ricollega» in Musica'); S.caricaInfo(); }
  else if (e.status === 429) toast('Spotify chiede una pausa: riprova tra poco');
  else if (e.status === 403) toast('Adesso Spotify non permette questo comando');
  else if (e.status === 404) toast('Il dispositivo non risponde');
  else toast('Spotify non ha risposto: riprova');
}
export const prova = (fn) => async (ctx) => { try { await fn(ctx); } catch (e) { errore(e); } };

// ---------------------------------------------------------------------------
// Fogli: brano (⋯), aggiungi a playlist, nuova playlist, playlist, account, Client ID
// ---------------------------------------------------------------------------
const mieePlaylist = () => ((sp.playlists[S.chi()] || {}).list || []).filter((p) => p.own);

function menuBrano(uri, ctxKey) {
  const t = S.brani.get(uri);
  if (!t) return;
  const c = contesti.get(ctxKey) || {};
  const saved = S.salvato(uri);
  const riga = (ic, label, attrs) => html`<button class="set-row" type="button" ${raw(attrs)}>${icon(ic)}<div class="row-main"><b>${label}</b></div></button>`;
  const link = (ic, label, href) => html`<a class="set-row" href="${href}">${icon(ic)}<div class="row-main"><b>${label}</b></div></a>`;
  openSheet({
    title: t.name,
    body: html`<div class="sp-sheet-head">${cover(t.big || t.img, 'music', 'sp-tcover big')}<div class="row-main"><span>${nomiArtisti(t)}</span>${t.album ? html`<span class="muted small">${t.album.name}</span>` : ''}</div></div>
      <div class="list">
        ${riga('play', 'Riproduci', `data-action="sp-brano" data-uri="${uri}" data-ctx="${ctxKey}"`)}
        ${riga('queue', 'Aggiungi in coda', `data-action="sp-coda" data-uri="${uri}"`)}
        ${riga('heart', saved ? 'Togli dai preferiti' : 'Aggiungi ai preferiti', `data-action="sp-cuore" data-uri="${uri}" data-chiudi="1"`)}
        ${riga('plus', 'Aggiungi a una playlist', `data-action="sp-aggiungi" data-uri="${uri}"`)}
        ${c.own ? riga('trash', 'Togli da questa playlist', `data-action="sp-togli" data-uri="${uri}" data-id="${c.own}"`) : ''}
        ${t.album && t.album.id ? link('disc', 'Vai all’album', `#/musica/album/${t.album.id}`) : ''}
        ${(t.artists || []).filter((x) => x.id).map((x) => link('user', `Vai a ${x.name}`, `#/musica/artista/${x.id}`))}
        ${t.id ? html`<button class="set-row" type="button" data-action="sp-condividi" data-url="https://open.spotify.com/track/${t.id}" data-nome="${t.name}">${icon('share')}<div class="row-main"><b>Condividi</b></div></button>` : ''}
      </div>`,
  });
}

/** "⋯" di un album o di un artista: vai all'artista, condividi, apri in Spotify. */
function menuAltro(uri) {
  const [, tipo, id] = String(uri || '').split(':');
  const al = tipo === 'album' ? S.letto(S.chiave('album', id)) : null;
  const ar = tipo === 'artist' ? S.letto(S.chiave('artista', id)) : null;
  const info = (al && al.info) || (ar && ar.info);
  if (!info) return;
  const url = `https://open.spotify.com/${tipo}/${id}`;
  const link = (ic, label, href, extra = '') => html`<a class="set-row" href="${href}" ${raw(extra)}>${icon(ic)}<div class="row-main"><b>${label}</b></div></a>`;
  openSheet({
    title: info.name,
    body: html`<div class="list">
      ${tipo === 'album' ? (info.artists || []).map((x) => link('user', `Vai a ${x.name}`, `#/musica/artista/${x.id}`)) : ''}
      ${tipo === 'artist' ? link('disc', 'Discografia', `#/musica/artista/${id}/discografia/album`) : ''}
      <button class="set-row" type="button" data-action="sp-condividi" data-url="${url}" data-nome="${info.name}">${icon('share')}<div class="row-main"><b>Condividi</b></div></button>
      ${link('link', 'Apri in Spotify', url, 'target="_blank" rel="noopener"')}
    </div>`,
  });
}

function aggiungiSheet(uri) {
  const t = S.brani.get(uri);
  const mie = mieePlaylist();
  openSheet({
    title: 'Aggiungi a una playlist',
    body: html`${t ? html`<p class="prose" style="margin-top:-4px">${t.name}</p>` : ''}
      <div class="list sp-addlist">
        <button class="set-row" type="button" data-action="sp-nuova-pl" data-uri="${uri}"><span class="sp-img sp-tcover sp-new">${icon('plus', 'sm')}</span><div class="row-main"><b>Nuova playlist</b></div></button>
        ${mie.map((p) => html`<button class="set-row" type="button" data-action="sp-aggiungi-a" data-id="${p.id}" data-uri="${uri}">${cover(p.img, 'headphones', 'sp-tcover')}<div class="row-main"><b>${p.name}</b><span>${plSub(p)}</span></div></button>`)}
      </div>`,
  });
}

function nuovaPlaylistSheet(uri = '') {
  openSheet({
    title: 'Nuova playlist',
    body: html`<label class="field"><span>Nome</span><input name="nome" required placeholder="es. Cena con gli amici" ${raw('autofocus')}></label>`,
    submit: uri ? 'Crea e aggiungi' : 'Crea',
    onSubmit: async (fd) => {
      const nome = cap(val(fd, 'nome'));
      if (!nome) { sheetError('Scrivi un nome'); return false; }
      try {
        const p = await S.nuovaPlaylist(nome);
        if (uri) { await S.aggiungiA(p.id, [uri]); toast(`Aggiunto a ${nome}`); }
        else { toast(`Playlist «${nome}» creata`); location.hash = `#/musica/pl/${p.id}`; }
      } catch (e) { errore(e); return false; }
    },
  });
}

function playlistMenu(id) {
  const first = S.letto(S.chiave('pl', id, 0));
  const info = (first && first.info) || {};
  openSheet({
    title: info.name || 'Playlist',
    body: html`<div class="list">
      <button class="set-row" type="button" data-action="sp-rinomina" data-id="${id}">${icon('pencil')}<div class="row-main"><b>Rinomina</b></div></button>
      <a class="set-row" href="#/musica/cerca">${icon('search')}<div class="row-main"><b>Cerca brani da aggiungere</b></div></a>
      <button class="set-row" type="button" data-action="sp-elimina-pl" data-id="${id}">${icon('trash')}<div class="row-main"><b style="color:var(--rose)">Elimina playlist</b></div></button>
    </div>`,
  });
}

function accountSheet() {
  const a = (sp.info && sp.info.account) || {};
  openSheet({
    title: 'Spotify',
    body: html`<div class="list">${['p1', 'p2'].map((k) => html`
      <div class="set-row">${icon('user')}
        <div class="row-main"><b>${nameOf(k)}</b><span>${a[k] ? `Collegato${a[k].nome ? ` come ${a[k].nome}` : ''}` : 'Non collegato'}</span></div>
        ${a[k]
          ? a[k].completo === false
            ? html`<button class="mini-btn primary" type="button" data-action="sp-collega" data-v="${k}">Ricollega</button>`
            : html`<button class="mini-btn" type="button" data-action="sp-scollega" data-v="${k}">Scollega</button>`
          : html`<button class="mini-btn primary" type="button" data-action="sp-collega" data-v="${k}">Collega</button>`}
      </div>`)}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" type="button" data-action="sp-ricarica">${icon('refresh', 'sm')} Aggiorna la libreria</button></div>`,
  });
}

async function vaiASpotify(per) {
  sp.busy = 'collega';
  rerender();
  try { await S.collega('', per); } catch (e) {
    if (/Client ID/.test(e.message)) clientIdSheet(per); else throw e;
  } finally { sp.busy = ''; rerender(); }
}

function clientIdSheet(per) {
  openSheet({
    title: 'Collega Spotify',
    body: html`<label class="field"><span>Client ID dell’app Spotify</span>
      <input name="clientId" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="32 lettere e numeri" ${raw('autofocus')}></label>`,
    submit: 'Continua',
    onSubmit: async (fd) => {
      try { await S.collega(val(fd, 'clientId'), per); } catch (e) { sheetError(e.message); }
      return false;
    },
  });
}

// ---------------------------------------------------------------------------
// Azioni
// ---------------------------------------------------------------------------
function daContesto(ctxKey, uri) {
  const c = contesti.get(ctxKey) || {};
  if (c.context) return { context: c.context, offset: uri ? { uri } : undefined };
  if (c.uris && c.uris.length) return { uris: c.uris, offset: uri ? { uri } : undefined };
  return uri ? { uris: [uri] } : null;
}

export const actions = {
  'sp-collega': prova(async ({ el }) => {
    const per = (el && el.dataset.v) || me();
    if (!per) { toast('Prima scegli chi sei in Impostazioni'); return; }
    if (sp.info && !sp.info.pronta) { clientIdSheet(per); return; }
    if (per === me()) { await vaiASpotify(per); return; }
    openSheet({
      title: `Spotify di ${nameOf(per)}`,
      body: html`<p class="prose" style="margin-top:-4px">Nella pagina di Spotify tocca «Non sei tu?» ed entra con l’account di ${nameOf(per)}.</p>
        <div class="btn-row"><button class="btn primary" type="button" data-action="sp-collega-altro" data-v="${per}">Continua</button></div>`,
    });
  }),
  'sp-collega-altro': prova(async ({ el }) => { await vaiASpotify(el.dataset.v); }),
  'sp-account': () => accountSheet(),
  'sp-scollega': prova(async ({ el }) => {
    closeSheet();
    await S.scollega(el.dataset.v);
    toast(`Spotify di ${nameOf(el.dataset.v)} scollegato`);
  }),
  'sp-ricarica': prova(async () => { closeSheet(); S.dimentica(S.chiave('')); await S.caricaPlaylist(S.chi(), true); toast('Libreria aggiornata'); }),
  'sp-chi': ({ el }) => { S.scegliAccount(el.dataset.v); S.caricaPlaylist().catch(errore); },
  'sp-tutte': () => setUi('sp.tutte', !ui('sp.tutte', false)),
  'sp-perte-tutti': () => setUi('sp.perte.tutti', !ui('sp.perte.tutti', false)),
  'sp-riprova': () => { S.dimentica(S.chiave('')); rerender(); },

  // la finestra del lettore
  'np-apri': () => { if (Date.now() - scorso < 450) return; vibrate(8); apriLettore(); },
  'np-salta': prova(async ({ el }) => { vibrate(); await S.saltaA(Number(el.dataset.i) || 0, el.dataset.uri); }),
  'np-chiudi': () => chiudiLettore(),
  // lettore
  'sp-playpausa': prova(async () => { vibrate(); await S.playPausa(); }),
  'sp-avanti': prova(async () => { vibrate(); await S.salta(true); }),
  'sp-indietro': prova(async () => { vibrate(); await S.salta(false); }),
  'sp-casuale': prova(async () => { vibrate(); await S.casuale(); }),
  'sp-ripeti': prova(async () => {
    vibrate();
    await S.ripeti();
    const r = sp.player && sp.player.repeat_state;
    toast(r === 'track' ? 'Ripeto questo brano' : r === 'context' ? 'Ripeto tutto' : 'Niente ripetizione', { ms: 1400 });
  }),
  'sp-back': () => { history.back(); },
  'sp-segui': prova(async ({ el }) => {
    vibrate();
    const si = !S.salvato(el.dataset.uri);
    await S.salva(el.dataset.uri, si);
    S.dimentica(S.chiave('seguiti'));
    toast(si ? `Segui ${el.dataset.nome}` : `Non segui più ${el.dataset.nome}`);
  }),
  'sp-ab': ({ el }) => setUi(`sp.ab.${el.dataset.id}`, !ui(`sp.ab.${el.dataset.id}`, false)),
  'sp-spin': () => { vibrate(10); setUi('sp.spin', Number(ui('sp.spin', 0)) + 1); },
  'sp-disco': ({ el }) => setUi(`sp.disco.${el.dataset.id}`, el.dataset.v),
  // i gruppi della discografia non riempiono la storia: "indietro" torna all'artista
  'sp-disco-vai': ({ el }) => { location.replace(`#/musica/artista/${el.dataset.id}/discografia/${el.dataset.v}`); window.scrollTo(0, 0); },
  'sp-lib': ({ el }) => { lsSet('casa.spotify.lib', el.dataset.v); setUi('sp.lib', el.dataset.v); },
  'sp-altro': ({ el }) => menuAltro(el.dataset.uri),
  'sp-condividi': prova(async ({ el }) => {
    closeSheet();
    const url = el.dataset.url;
    if (navigator.share) { try { await navigator.share({ title: el.dataset.nome || 'Spotify', url }); } catch { /* annullato */ } return; }
    try { await navigator.clipboard.writeText(url); toast('Link copiato'); } catch { toast('Non riesco a copiare il link'); }
  }),
  'sp-seek': prova(async ({ el }) => {
    const ms = Number(el.value);
    try { await S.vaiA(ms); } finally { sp.trascino = null; el._busy = false; rerender(); }
  }),
  'sp-suona': prova(async ({ el }) => {
    vibrate();
    const ctx = el.dataset.ctx || '';
    const target = ctx.startsWith('spotify:') ? { context: ctx } : daContesto(ctx);
    if (!target) return;
    await suonaQui(target, el.dataset.casuale === '1');
  }),
  'sp-brano': prova(async ({ el }) => {
    vibrate();
    closeSheet();
    const target = daContesto(el.dataset.ctx, el.dataset.uri);
    if (target) await suonaQui(target);
  }),
  'sp-coda': prova(async ({ el }) => {
    closeSheet();
    const t = S.brani.get(el.dataset.uri);
    try { await S.inCoda(el.dataset.uri); } catch (e) {
      if (e.reason === 'NO_DEVICE' || e.status === 404) { toast('Prima fai partire qualcosa, poi aggiungi in coda'); return; }
      throw e;
    }
    toast(`In coda: ${t ? t.name : 'brano'}`);
  }),

  // dispositivi
  'sp-dispositivi': () => devSheet(),
  'sp-cerca-dev': () => aggiornaDev(),
  // un dispositivo che non si vuole vedere (es. l'Echo di un'altra casa): sparisce dalla lista per tutti e due
  'sp-nascondi': ({ el }) => {
    const nome = el.dataset.nome;
    if (!nome) return;
    vibrate();
    const prima = nascosti();
    saveSettings({ spotifyNascosti: [...new Set([...prima, nome])] });
    ridisegnaDev();
    toast(`«${nome}» nascosto`, { undo: () => { saveSettings({ spotifyNascosti: prima }); ridisegnaDev(); } });
  },
  'sp-mostra': () => { saveSettings({ spotifyNascosti: [] }); ridisegnaDev(); },
  'sp-dispositivo': prova(async ({ id }) => {
    if (!id) return;
    vibrate();
    const d = (sp.devices || []).find((x) => x.id === id);
    closeSheet();
    await vaiSu(id);
    if (d) toast(`Su ${devNome(d)}`);
  }),
  // questo iPhone/iPad come altoparlante: il lettore va acceso dentro il tocco
  'sp-qui': prova(async () => {
    vibrate();
    const acc = sp.info && sp.info.account && sp.info.account[S.chi()];
    if (acc && acc.completo === false) { toast('Prima va ricollegato Spotify: tocca «Ricollega» in Musica'); return; }
    const pronto = S.attivaQui();
    sp.busy = 'qui';
    ridisegnaDev();
    try {
      const id = await pronto;
      await S.aggiorna({ dispositivi: true });
      closeSheet();
      await vaiSu(id);
      if (S.qui.player) S.qui.player.resume().catch(muto);
      toast(`Suona su ${questo()}`);
    } finally { sp.busy = ''; ridisegnaDev(); }
  }),
  'sp-apri-app': () => { location.href = 'spotify:'; },

  // ricerca
  'sp-q': ({ el }) => { state.ui['sp.q'] = el.value; rerender(); },
  'sp-cerca': ({ form }) => { const q = form.querySelector('input').value; ricorda(q); state.ui['sp.q'] = q; form.querySelector('input').blur(); rerender(); },
  'sp-tipo': ({ el }) => { ricorda(ui('sp.q', '')); setUi('sp.tipo', el.dataset.v); window.scrollTo(0, 0); },
  'sp-recente': ({ el }) => { state.ui['sp.q'] = el.dataset.v; ricorda(el.dataset.v); rerender(); },
  'sp-recenti-x': () => { lsSet('casa.spotify.recenti', null); rerender(); },
  'sp-altri': ({ el }) => setUi(`sp.pag.${el.dataset.k}`, ui(`sp.pag.${el.dataset.k}`, 1) + 1),

  // preferiti e playlist
  'sp-cuore': prova(async ({ el }) => {
    vibrate();
    const uri = el.dataset.uri;
    if (el.dataset.chiudi) closeSheet();
    const si = !S.salvato(uri);
    await S.salva(uri, si);
    if (uri.startsWith('spotify:track:')) toast(si ? 'Aggiunto ai preferiti' : 'Tolto dai preferiti');
    else toast(si ? 'Salvato nella libreria' : 'Tolto dalla libreria');
  }),
  'sp-menu': ({ el }) => menuBrano(el.dataset.uri, el.dataset.ctx),
  'sp-aggiungi': ({ el }) => aggiungiSheet(el.dataset.uri),
  'sp-aggiungi-a': prova(async ({ el }) => {
    closeSheet();
    const p = mieePlaylist().find((x) => x.id === el.dataset.id);
    await S.aggiungiA(el.dataset.id, [el.dataset.uri]);
    toast(`Aggiunto a ${p ? p.name : 'playlist'}`);
  }),
  'sp-togli': prova(async ({ el }) => {
    closeSheet();
    const t = S.brani.get(el.dataset.uri);
    await S.togliDa(el.dataset.id, [el.dataset.uri]);
    toast(`Tolto: ${t ? t.name : 'brano'}`);
  }),
  'sp-nuova-pl': ({ el }) => nuovaPlaylistSheet((el && el.dataset.uri) || ''),
  'sp-pl-menu': ({ id }) => playlistMenu(id),
  'sp-rinomina': ({ id }) => {
    const first = S.letto(S.chiave('pl', id, 0));
    openSheet({
      title: 'Rinomina',
      body: html`<label class="field"><span>Nome</span><input name="nome" required value="${(first && first.info && first.info.name) || ''}" ${raw('autofocus')}></label>`,
      onSubmit: async (fd) => {
        const nome = cap(val(fd, 'nome'));
        if (!nome) return false;
        try { await S.rinomina(id, nome); toast('Fatto'); } catch (e) { errore(e); return false; }
      },
    });
  },
  'sp-elimina-pl': ({ id }) => {
    const first = S.letto(S.chiave('pl', id, 0));
    confirmSheet({
      title: 'Eliminare la playlist?',
      text: `«${(first && first.info && first.info.name) || 'Playlist'}» sparisce anche da Spotify.`,
      onYes: () => prova(async () => { await S.eliminaPlaylist(id); location.hash = '#/svago/musica'; toast('Playlist eliminata'); })(),
    });
  },
};
