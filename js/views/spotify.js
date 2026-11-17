// Spotify nella pagina Musica: cosa suona e dove (iPhone, iPad, Echo… o dentro l'app), ricerca,
// preferiti, playlist (crearle, rinominarle, aggiungere e togliere brani), album, artisti, coda.
// Sottopagine: #/musica/cerca, #/musica/preferiti, #/musica/pl/<id>, #/musica/album/<id>, #/musica/artista/<id>
import { html, raw, vibrate, lsGet, lsSet, isIPad, cap } from '../utils.js';
import { icon } from '../icons.js';
import { store, openSheet, closeSheet, toast, val, ui, setUi, me, isSynced, nameOf, sheetError, rerender, confirmSheet, state } from '../core.js';
import { currentTheme } from '../season.js';
import { THEMES } from '../data.js';
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
const devIcon = (d) => {
  if (d && S.eQui(d.id)) return isIPad() ? 'tablet' : /iPhone/.test(navigator.userAgent) ? 'phone' : 'laptop';
  if (comperotto(d)) return /iPad/.test(d.name) ? 'tablet' : /iPhone/.test(d.name) ? 'phone' : 'laptop';
  return DEV_ICON[d && d.type] || 'speaker';
};
const devNome = (d) => (d && S.eQui(d.id) ? cap(questo()) : comperotto(d) ? d.name.replace(/^Comperotto · /, '') : d ? d.name : '');
const nomiArtisti = (t) => (t.artists || []).map((a) => a.name).filter(Boolean).join(', ');
const sceltoOAttivo = () => S.attivo() || (sp.devices || []).find((d) => d.id === S.dispositivoScelto()) || null;
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
      <span class="row-main"><span class="row-title">${t.name}</span><span class="row-sub">${nomiArtisti(t)}</span></span>
    </button>
    <button class="sp-ic ${saved ? 'on' : ''}" data-action="sp-cuore" data-uri="${t.uri}" aria-label="${saved ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}">${icon('heart', saved ? 'sm filled' : 'sm')}</button>
    <button class="sp-ic" data-action="sp-menu" data-uri="${t.uri}" data-ctx="${ctxKey}" aria-label="Altro">${icon('dots', 'sm')}</button>
  </div>`;
}

function tile(p, href, { sub = '', ph = 'headphones', round = false, play = '' } = {}) {
  const on = play && play === ctxOra();
  return html`<div class="sp-tile ${on ? 'on' : ''} ${round ? 'round' : ''}">
    <a class="sp-tile-link" href="${href}">
      ${cover(p.img, ph, 'sp-tile-img')}
      <b>${p.name}</b>${sub ? html`<span>${sub}</span>` : ''}
    </a>
    ${play ? html`<span class="sp-tile-over"><button class="sp-tile-play" data-action="sp-suona" data-ctx="${play}" aria-label="Fai partire ${p.name}">${on && sp.player.is_playing ? eq(true) : icon('play', 'filled')}</button></span>` : ''}
  </div>`;
}
const plSub = (p) => (p.n != null ? plural(p.n, 'brano', 'brani') : p.owner || '');
const alSub = (a) => [nomiArtisti(a), a.anno].filter(Boolean).join(' · ');

// ---------------------------------------------------------------------------
// In riproduzione: scheda grande in Musica, barretta in basso nelle sottopagine
// ---------------------------------------------------------------------------
function nowCard() {
  const p = sp.player;
  const it = p && p.item;
  const dev = sceltoOAttivo();
  const playing = Boolean(p && p.is_playing);
  const img = it ? S.bestImage((it.album && it.album.images) || it.images || (it.show && it.show.images), 200) : '';
  const dur = (it && it.duration_ms) || 0;
  // la barra va verso dove sarà tra 5 secondi (il prossimo aggiornamento): così scorre liscia
  const pct = dur ? Math.min(100, ((S.progresso() + (playing ? 5000 : 0)) / dur) * 100) : 0;
  const vol = dev && dev.supports_volume !== false && dev.volume_percent != null ? dev.volume_percent : null;
  const saved = it ? S.salvato(it.uri) : false;
  if (it && it.uri && saved === undefined) queueMicrotask(() => S.controllaSalvati([it.uri]));
  const al = it && it.album;
  return html`<div class="card sp-now ${playing ? 'playing' : ''}" id="sp-now">
    <div class="sp-top">
      ${al && al.id ? html`<a class="sp-cover" href="#/musica/album/${al.id}" aria-label="Album">${icon('music', 'lg')}${img ? html`<img src="${img}" alt="" decoding="async">` : ''}</a>`
        : html`<div class="sp-cover">${icon('music', 'lg')}${img ? html`<img src="${img}" alt="" decoding="async">` : ''}</div>`}
      <div class="sp-meta">
        <b>${it ? it.name : sp.playerAt ? 'Niente in riproduzione' : 'Spotify'}</b>
        <span>${it ? nomiArtisti(it) || (it.show && it.show.name) || '' : sp.playerAt ? 'Cerca qualcosa o tocca una playlist' : 'Un attimo…'}</span>
        <button class="sp-dev ${dev ? '' : 'none'}" data-action="sp-dispositivi">${icon(dev ? devIcon(dev) : 'speaker', 'xs')}<span>${dev ? devNome(dev) : 'Scegli dove ascoltare'}</span>${icon('down', 'xs')}</button>
      </div>
      ${it && it.type !== 'episode' ? html`<button class="sp-ic big ${saved ? 'on' : ''}" data-action="sp-cuore" data-uri="${it.uri}" aria-label="${saved ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}">${icon('heart', saved ? 'filled' : '')}</button>` : ''}
    </div>
    ${it ? html`
      <div class="sp-bar" id="sp-bar-${it.id || 'x'}"><i style="width:${pct.toFixed(2)}%;transition-duration:${playing ? 5 : 0.3}s"></i></div>
      <div class="sp-ctrl">
        <button class="sp-btn ${p.shuffle_state ? 'on' : ''}" data-action="sp-casuale" aria-label="Ordine casuale" aria-pressed="${p.shuffle_state ? 'true' : 'false'}">${icon('shuffle', 'sm')}</button>
        <button class="sp-btn" data-action="sp-indietro" aria-label="Precedente">${icon('prev', 'filled')}</button>
        <button class="sp-play" data-action="sp-playpausa" aria-label="${playing ? 'Pausa' : 'Riproduci'}">${icon(playing ? 'pause' : 'play', 'filled')}</button>
        <button class="sp-btn" data-action="sp-avanti" aria-label="Successivo">${icon('next', 'filled')}</button>
        <button class="sp-btn" data-action="sp-dispositivi" aria-label="Dove ascoltare">${icon(dev ? devIcon(dev) : 'speaker', 'sm')}</button>
      </div>
      ${vol != null ? html`<label class="sp-vol">${icon('volume', 'sm')}<input type="range" min="0" max="100" step="1" value="${vol}" data-input="sp-volume" aria-label="Volume"></label>` : ''}` : ''}
  </div>`;
}

function mini() {
  const p = sp.player;
  const it = p && p.item;
  if (!it) return '';
  const img = S.bestImage((it.album && it.album.images) || it.images || (it.show && it.show.images), 64);
  return html`<div class="sp-mini-space"></div><div class="sp-mini" id="sp-mini">
    <a class="sp-mini-main" href="#/musica">${cover(img, 'music', 'sp-tcover')}<span class="row-main"><b>${it.name}</b><span>${nomiArtisti(it)}${p.device ? ` · ${devNome(p.device)}` : ''}</span></span></a>
    <button class="sp-btn" data-action="sp-playpausa" aria-label="${p.is_playing ? 'Pausa' : 'Riproduci'}">${icon(p.is_playing ? 'pause' : 'play', 'filled')}</button>
    <button class="sp-btn" data-action="sp-avanti" aria-label="Successivo">${icon('next', 'filled')}</button>
  </div>`;
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
      <button class="btn primary" data-action="sp-collega" data-v="${k}">Ricollega</button></div>` : ''}
    <a class="sp-search" href="#/musica/cerca">${icon('search', 'sm')}<span>Cerca brani, artisti, album</span></a>
    <div class="section-title"><span>${acc.length > 1 ? 'Libreria' : `La libreria di ${nameOf(k)}`}</span><button class="card-link" data-action="sp-account">Spotify ${icon('right', 'xs')}</button></div>
    ${acc.length > 1 ? html`<div class="segmented sp-who">${acc.map((x) => html`<button class="${x === k ? 'on' : ''}" data-action="sp-chi" data-v="${x}">${nameOf(x)}</button>`)}</div>` : ''}
    <div class="sp-grid">
      <div class="sp-tile special"><a class="sp-tile-link" href="#/musica/preferiti"><span class="sp-img sp-tile-img sp-fav">${icon('heart', 'filled')}</span><b>Brani che ti piacciono</b><span>Preferiti</span></a></div>
      <div class="sp-tile special"><button class="sp-tile-link" data-action="sp-nuova-pl"><span class="sp-img sp-tile-img sp-new">${icon('plus')}</span><b>Nuova playlist</b><span>Creane una</span></button></div>
      ${shown.map((p) => tile(p, `#/musica/pl/${p.id}`, { sub: plSub(p), play: p.uri }))}
    </div>
    ${!pl ? html`<p class="muted small sp-wait">Cerco le playlist…</p>` : ''}
    ${list.length > 10 ? html`<button class="card-link sp-more" data-action="sp-tutte">${tutte ? 'Mostra meno' : `Mostra tutte (${list.length})`}</button>` : ''}`;
}

// ---------------------------------------------------------------------------
// Sottopagine
// ---------------------------------------------------------------------------
const back = html`<a class="back-link" href="#/musica">${icon('left', 'sm')} Musica</a>`;
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
      contesti.set('cerca', {});
      const nessuno = !r.track.length && !r.artist.length && !r.album.length && !r.playlist.length;
      corpo = nessuno ? html`<p class="muted sp-wait">Niente per «${qq}».</p>` : html`
        ${r.track.length ? html`<div class="section-title"><span>Brani</span>${r.track.length > 5 ? html`<button class="card-link" data-action="sp-tipo" data-v="track">Tutti ${icon('right', 'xs')}</button>` : ''}</div>
          <div class="list">${r.track.slice(0, 5).map((t) => trackRow(t, 'cerca'))}</div>` : ''}
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
    contesti.set('cerca', {});
    let lista = '';
    if (tipo === 'track') lista = html`<div class="list">${items.map((t) => trackRow(t, 'cerca'))}</div>`;
    else if (tipo === 'artist') lista = html`<div class="sp-grid">${items.map((x) => tile(x, `#/musica/artista/${x.id}`, { ph: 'user', round: true, play: x.uri }))}</div>`;
    else if (tipo === 'album') lista = html`<div class="sp-grid">${items.map((x) => tile(x, `#/musica/album/${x.id}`, { sub: alSub(x), ph: 'disc', play: x.uri }))}</div>`;
    else lista = html`<div class="sp-grid">${items.map((x) => tile(x, `#/musica/pl/${x.id}`, { sub: plSub(x), play: x.uri }))}</div>`;
    corpo = html`${items.length ? lista : ok.length ? html`<p class="muted sp-wait">Niente per «${qq}».</p>` : ''}
      ${ok.length < pagine ? caricamento(keys[ok.length]) : ''}
      ${altri ? html`<button class="card-link sp-more" data-action="sp-altri" data-k="cerca.${tipo}.${qq}">Altri risultati</button>` : ''}`;
  }
  return html`${back}
    <header class="page-head"><div><p class="eyebrow">Spotify</p><h1>Cerca</h1></div></header>
    <form class="sp-q" data-form="sp-cerca" role="search">
      ${icon('search', 'sm')}
      <input id="sp-q" name="q" type="search" value="${q}" placeholder="Brani, artisti, album, playlist" data-input="sp-q" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Cerca su Spotify">
      ${q ? html`<button type="button" class="sp-q-x" data-action="sp-q-x" aria-label="Cancella">${icon('x', 'sm')}</button>` : ''}
    </form>
    ${qq.length >= 2 ? html`<div class="chips">${Object.entries(TIPO_LABEL).map(([k, l]) => html`<button class="chip ${tipo === k ? 'on' : ''}" data-action="sp-tipo" data-v="${k}">${l}</button>`)}</div>` : ''}
    ${corpo}
    ${mini()}`;
}

function hero(info, { eyebrow, sub, ph = 'music', round = false }) {
  return html`<div class="sp-hero">
    ${cover(info.big || info.img, ph, `sp-hero-img ${round ? 'round' : ''} ${ph === 'heart' ? 'sp-fav' : ''}`)}
    <div class="sp-hero-txt"><p class="eyebrow">${eyebrow}</p><h1>${info.name}</h1>${sub ? html`<p class="muted small">${sub}</p>` : ''}</div>
  </div>`;
}
function azioni(ctxKey, { salva = '', menu = '' } = {}) {
  const saved = salva ? S.salvato(salva) : false;
  return html`<div class="sp-actions">
    <button class="btn primary" data-action="sp-suona" data-ctx="${ctxKey}">${icon('play', 'sm filled')} Riproduci</button>
    <button class="btn" data-action="sp-suona" data-ctx="${ctxKey}" data-casuale="1">${icon('shuffle', 'sm')} Casuale</button>
    ${salva ? html`<button class="icon-btn sp-save ${saved ? 'on' : ''}" data-action="sp-cuore" data-uri="${salva}" aria-label="${saved ? 'Togli dalla libreria' : 'Salva nella libreria'}">${icon('heart', saved ? 'filled' : '')}</button>` : ''}
    ${menu ? html`<button class="icon-btn" data-action="sp-pl-menu" data-id="${menu}" aria-label="Modifica playlist">${icon('dots')}</button>` : ''}
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
  return html`${back}
    ${hero({ name: 'Brani che ti piacciono', big: '' }, { eyebrow: 'Preferiti', sub: first ? plural(first.totale, 'brano', 'brani') : '', ph: 'heart' })}
    ${first && first.list.length ? azioni('preferiti') : ''}
    ${first && !first.list.length ? html`<div class="empty">${icon('heart', 'lg')}<p><b>Ancora nessun preferito</b></p><p class="small">Tocca il cuore accanto a un brano per salvarlo qui.</p></div>` : ''}
    ${listaPaginata('preferiti', 'preferiti')}
    ${mini()}`;
}

function playlistPage(id) {
  const first = S.letto(S.chiave('pl', id, 0));
  const ctxKey = `pl:${id}`;
  if (!first) return html`${back}${caricamento(S.chiave('pl', id, 0))}${mini()}`;
  const info = first.info || {};
  contesti.set(ctxKey, { context: info.uri, own: info.own ? id : null });
  const sub = [info.own ? '' : info.owner, info.n != null ? plural(info.n, 'brano', 'brani') : ''].filter(Boolean).join(' · ');
  return html`${back}
    ${hero(info, { eyebrow: info.own ? 'La tua playlist' : 'Playlist', sub, ph: 'headphones' })}
    ${info.descr ? html`<p class="muted small sp-descr">${info.descr}</p>` : ''}
    ${azioni(ctxKey, { salva: info.own ? '' : info.uri, menu: info.own ? id : '' })}
    ${first.list === null
      ? html`<p class="muted small sp-wait">Spotify mostra i brani solo delle vostre playlist: questa si può far partire e salvare.</p>`
      : first.list.length || first.altri ? listaPaginata(`pl:${id}`, ctxKey)
        : html`<div class="empty">${icon('headphones', 'lg')}<p><b>Playlist vuota</b></p><p class="small">Cerca un brano e tocca ⋯ → «Aggiungi a una playlist».</p>
          <a class="btn" href="#/musica/cerca">${icon('search', 'sm')} Cerca</a></div>`}
    ${mini()}`;
}

function albumPage(id) {
  const key = S.chiave('album', id);
  const r = S.letto(key);
  if (!r) return html`${back}${caricamento(key)}${mini()}`;
  const ctxKey = `album:${id}`;
  contesti.set(ctxKey, { context: r.info.uri });
  return html`${back}
    ${hero(r.info, { eyebrow: r.info.tipo === 'single' ? 'Singolo' : 'Album', sub: [nomiArtisti(r.info), r.info.anno, plural(r.list.length, 'brano', 'brani')].filter(Boolean).join(' · '), ph: 'disc' })}
    ${r.info.artists && r.info.artists[0] ? html`<a class="mini-btn sp-artlink" href="#/musica/artista/${r.info.artists[0].id}">${icon('user', 'xs')} ${r.info.artists[0].name}</a>` : ''}
    ${azioni(ctxKey, { salva: r.info.uri })}
    <div class="list">${r.list.map((t) => trackRow(t, ctxKey, { numero: true }))}</div>
    ${mini()}`;
}

function artistaPage(id) {
  const key = S.chiave('artista', id);
  const r = S.letto(key);
  if (!r) return html`${back}${caricamento(key)}${mini()}`;
  const ctxKey = `artista:${id}`;
  contesti.set(ctxKey, { context: r.info.uri });
  const album = r.albums.filter((a) => a.tipo !== 'single');
  const singoli = r.albums.filter((a) => a.tipo === 'single');
  return html`${back}
    ${hero(r.info, { eyebrow: 'Artista', ph: 'user', round: true })}
    <div class="sp-actions">
      <button class="btn primary" data-action="sp-suona" data-ctx="${ctxKey}">${icon('play', 'sm filled')} Riproduci</button>
      <button class="btn" data-action="sp-suona" data-ctx="${ctxKey}" data-casuale="1">${icon('shuffle', 'sm')} Casuale</button>
    </div>
    ${album.length ? html`<div class="section-title"><span>Album</span></div><div class="sp-grid">${album.map((x) => tile(x, `#/musica/album/${x.id}`, { sub: x.anno, ph: 'disc', play: x.uri }))}</div>` : ''}
    ${singoli.length ? html`<div class="section-title"><span>Singoli</span></div><div class="sp-grid">${singoli.map((x) => tile(x, `#/musica/album/${x.id}`, { sub: x.anno, ph: 'disc', play: x.uri }))}</div>` : ''}
    ${mini()}`;
}

/** Le sottopagine di Musica. */
export function render(r) {
  if (!isSynced() || !S.chi()) return html`${back}<div class="empty"><p><b>Spotify non è collegato</b></p></div>`;
  const [, sub, id] = r;
  if (sub === 'cerca') return cercaPage();
  if (sub === 'preferiti') return preferitiPage();
  if (sub === 'pl' && id) return playlistPage(id);
  if (sub === 'album' && id) return albumPage(id);
  if (sub === 'artista' && id) return artistaPage(id);
  return html`${back}`;
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
  parti(); // dall'ultima volta so già chi è collegato: parto subito
  S.caricaInfo().then(parti);
}
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/musica')) dentro = false; });

const muto = () => {};
function caricaPagine(base, fn) {
  const pagine = ui(`sp.pag.${base}`, 1);
  for (let i = 0; i < pagine; i++) {
    const key = S.chiave(base, i * 50);
    if (!S.letto(key) && !S.fallito(key)) { S.leggi(key, () => fn(i * 50)).catch(muto); return; }
  }
}
const uriDi = (list) => (list || []).map((t) => t.uri);

let cercaT;
let messoFuoco = false;
export function after(r) {
  avvia();
  if (!isSynced() || !S.chi()) return;
  const [, sub, id] = r;
  if (sub === 'cerca') {
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
    if (!S.letto(key) && !S.fallito(key)) S.leggi(key, () => S.album(id)).then((x) => S.controllaSalvati([x.info.uri, ...uriDi(x.list)])).catch(muto);
  } else if (sub === 'artista' && id) {
    const key = S.chiave('artista', id);
    if (!S.letto(key) && !S.fallito(key)) S.leggi(key, () => S.artista(id)).catch(muto);
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

/** Fa partire qualcosa: sul dispositivo che suona o sull'ultimo scelto, altrimenti chiede dove. */
export async function suonaQui(target, casuale = false) {
  if (!S.doveSuonare()) {
    if (!sp.devices) await S.aggiorna({ dispositivi: true });
    if (!S.doveSuonare()) { inAttesa = { target, casuale }; devSheet(); return; }
  }
  try {
    if (casuale) await S.suonaCasuale(target);
    else await S.suona(target);
  } catch (e) {
    if (e.status === 404 || e.reason === 'NO_DEVICE' || e.reason === 'NO_ACTIVE_DEVICE') { inAttesa = { target, casuale }; devSheet('Quel dispositivo non risponde: scegline un altro.'); return; }
    throw e;
  }
}

function devList() {
  const list = sp.devices;
  const cur = sceltoOAttivo();
  const quiAcceso = list && S.qui.id && list.find((d) => d.id === S.qui.id);
  // un vecchio lettore di questo stesso dispositivo (tentativo precedente) non va mostrato due volte
  const altri = (list || []).filter((d) => !S.eQui(d.id) && !(comperotto(d) && d.name === S.nomeQui()));
  const tocco = matchMedia('(pointer: coarse)').matches;
  const riga = (d) => html`
    <button class="set-row sp-devrow ${d.is_restricted || !d.id ? 'off' : ''}" data-action="sp-dispositivo" data-id="${d.id || ''}" ${d.is_restricted || !d.id ? raw('disabled') : ''}>
      ${icon(devIcon(d))}
      <div class="row-main"><b>${devNome(d)}</b><span>${d.is_active ? (sp.player && sp.player.is_playing ? 'Sta suonando' : 'In pausa') : S.eQui(d.id) || comperotto(d) ? 'Dentro l’app' : d.is_restricted ? 'Non si comanda da qui' : DEV_LABEL[d.type] || 'Dispositivo'}</span></div>
      ${cur && cur.id === d.id ? html`<span class="sp-check">${icon('check', 'sm')}</span>` : ''}
    </button>`;
  return html`<div class="list">
      ${quiAcceso ? riga(quiAcceso) : html`<button class="set-row sp-devrow" data-action="sp-qui">${icon(isIPad() ? 'tablet' : 'phone')}
        <div class="row-main"><b>Ascolta su ${questo()}</b><span>${sp.busy === 'qui' ? 'Accendo il lettore…' : 'Dentro l’app'}</span></div>${sp.busy === 'qui' ? icon('refresh', 'sm spin') : ''}</button>`}
      ${altri.map(riga)}
    </div>
    ${!list ? html`<p class="muted small" style="padding:10px 4px 0">Cerco gli altri dispositivi…</p>` : ''}
    ${list && !altri.length ? html`<p class="small muted sp-nodev-txt">Gli Echo compaiono qui quando Spotify è collegato ad Alexa: se non li vedi, chiedi una volta ad Alexa di mettere musica da Spotify.</p>` : ''}
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
}

function ridisegnaDev() { const box = document.getElementById('sp-devlist'); if (box) box.innerHTML = devList().s; }
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
  const a0 = t.artists && t.artists[0];
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
        ${a0 && a0.id ? link('user', `Vai a ${a0.name}`, `#/musica/artista/${a0.id}`) : ''}
        ${riga('home', 'Aggiungi a «La nostra musica»', `data-action="sp-nostra" data-uri="${uri}"`)}
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
  'sp-riprova': () => { S.dimentica(S.chiave('')); rerender(); },

  // lettore
  'sp-playpausa': prova(async () => { vibrate(); await S.playPausa(); }),
  'sp-avanti': prova(async () => { vibrate(); await S.salta(true); }),
  'sp-indietro': prova(async () => { vibrate(); await S.salta(false); }),
  'sp-casuale': prova(async () => { vibrate(); await S.casuale(); }),
  'sp-volume': prova(async ({ el }) => { await S.volume(Number(el.value)); }),
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
  'sp-q-x': () => { setUi('sp.q', ''); const el = document.getElementById('sp-q'); if (el) el.focus(); },
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
      onYes: () => prova(async () => { await S.eliminaPlaylist(id); location.hash = '#/musica'; toast('Playlist eliminata'); })(),
    });
  },
  // un brano di Spotify nella nostra lista di famiglia (con il tema del periodo)
  'sp-nostra': ({ el }) => {
    closeSheet();
    const t = S.brani.get(el.dataset.uri);
    if (!t) return;
    const cur = currentTheme();
    const gia = state.data.musica.some((m) => String(m.link || '').includes(t.id));
    if (gia) { toast('C’è già nella nostra musica'); return; }
    store.add('musica', { title: t.name, artist: nomiArtisti(t), type: 'brano', themes: [cur ? cur.id : 'sempre'], link: `https://open.spotify.com/track/${t.id}`, by: me() || '' });
    toast(`Aggiunto alla nostra musica${cur && THEMES[cur.id] ? ` · ${THEMES[cur.id].label}` : ''}`);
  },
};
