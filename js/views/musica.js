// La nostra musica, anche a tema del periodo (Natale, Halloween, mare, Parigi…), e Spotify:
// cosa suona, su quale dispositivo (iPhone, iPad, Echo…), le playlist da far partire con un tocco.
import { html, raw, cap, safeUrl, vibrate } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { THEMES, themeLabel, MUSIC_TYPES } from '../data.js';
import { state, store, openSheet, closeSheet, toast, val, emptyState, ui, setUi, themeChoices, me, whoBadge, pageHead, isSynced, nameOf, sheetError, rerender } from '../core.js';
import { currentTheme } from '../season.js';
import * as S from '../spotify.js';

const { sp } = S;
const TYPE_ICON = { brano: 'music', album: 'disc', playlist: 'headphones' };

/** Riconosce i link di Spotify per mostrare il lettore integrato. */
export function spotifyEmbed(link) {
  const m = String(link || '').match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,40})/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator` : '';
}
const query = (m) => `${m.title} ${m.artist || ''}`.trim();
export const spotifySearch = (m) => `https://open.spotify.com/search/${encodeURIComponent(query(m))}`;
export const ytSearch = (m) => `https://music.youtube.com/search?q=${encodeURIComponent(query(m))}`;

// ---------------------------------------------------------------------------
// Spotify: in riproduzione e dispositivi
// ---------------------------------------------------------------------------
const DEV_ICON = { Speaker: 'speaker', Smartphone: 'phone', Tablet: 'tablet', Computer: 'laptop', TV: 'tv', CastVideo: 'tv', CastAudio: 'speaker', AVR: 'speaker', STB: 'tv', Automobile: 'music', GameConsole: 'tv' };
const DEV_LABEL = { Speaker: 'Altoparlante', Smartphone: 'Telefono', Tablet: 'Tablet', Computer: 'Computer', TV: 'TV', CastVideo: 'TV', CastAudio: 'Altoparlante', AVR: 'Amplificatore', STB: 'TV', Automobile: 'Auto', GameConsole: 'Console' };
const devIcon = (d) => DEV_ICON[d && d.type] || 'speaker';
const artisti = (it) => (it.artists || []).map((a) => a.name).join(', ') || (it.show && it.show.name) || '';
const copertina = (it) => S.bestImage((it.album && it.album.images) || it.images || (it.show && it.show.images), 200);
const sceltoOAttivo = () => S.attivo() || (sp.devices || []).find((d) => d.id === S.dispositivoScelto()) || null;

function nowCard() {
  const p = sp.player;
  const it = p && p.item;
  const dev = sceltoOAttivo();
  const playing = Boolean(p && p.is_playing);
  const img = it ? copertina(it) : '';
  const dur = (it && it.duration_ms) || 0;
  // la barra va verso dove sarà tra 5 secondi (il prossimo aggiornamento): così scorre liscia
  const pct = dur ? Math.min(100, ((S.progresso() + (playing ? 5000 : 0)) / dur) * 100) : 0;
  const vol = dev && dev.supports_volume !== false && dev.volume_percent != null ? dev.volume_percent : null;
  return html`<div class="card sp-now ${playing ? 'playing' : ''}" id="sp-now">
    <div class="sp-top">
      <div class="sp-cover">${icon('music', 'lg')}${img ? html`<img src="${img}" alt="" decoding="async">` : ''}</div>
      <div class="sp-meta">
        <b>${it ? it.name : sp.playerAt ? 'Niente in riproduzione' : 'Spotify'}</b>
        <span>${it ? artisti(it) : sp.playerAt ? 'Tocca una playlist per farla partire' : 'Un attimo…'}</span>
        <button class="sp-dev ${dev ? '' : 'none'}" data-action="sp-dispositivi">${icon(dev ? devIcon(dev) : 'speaker', 'xs')}<span>${dev ? dev.name : 'Scegli dove ascoltare'}</span>${icon('down', 'xs')}</button>
      </div>
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

function playlistGrid(k) {
  const pl = sp.playlists[k];
  const list = (pl && pl.list) || [];
  const tutte = ui('sp.tutte', false);
  const ctx = sp.player && sp.player.context && sp.player.context.uri;
  const shown = tutte ? list : list.slice(0, 12);
  if (!pl) return html`<p class="muted small sp-wait">Cerco le playlist…</p>`;
  if (!list.length) return html`<p class="muted small sp-wait">Nessuna playlist su questo account.</p>`;
  return html`<div class="sp-grid">${shown.map((p) => html`
    <button class="sp-pl ${ctx === p.uri ? 'on' : ''}" data-action="sp-playlist" data-uri="${p.uri}" aria-label="Fai partire ${p.name}">
      <span class="sp-pl-img">${icon('headphones', 'lg')}${p.img ? html`<img src="${p.img}" alt="" loading="lazy" decoding="async">` : ''}${ctx === p.uri ? html`<span class="sp-eq ${sp.player.is_playing ? '' : 'stop'}"><i></i><i></i><i></i></span>` : ''}</span>
      <b>${p.name}</b>
      ${p.n != null ? html`<span>${p.n === 1 ? '1 brano' : `${p.n} brani`}</span>` : ''}
    </button>`)}</div>
    ${list.length > 12 ? html`<button class="card-link sp-more" data-action="sp-tutte">${tutte ? 'Mostra meno' : `Mostra tutte (${list.length})`}</button>` : ''}`;
}

function spotifyBlock() {
  if (!isSynced() || !sp.info) return '';
  const k = S.chi();
  if (!k) {
    return html`<div class="card sp-connect">
      <span class="sp-logo">${icon('music')}</span>
      <div class="row-main"><b>Spotify</b><span>Le vostre playlist e la musica sugli Echo, da qui.</span></div>
      <button class="btn primary" data-action="sp-collega" ${sp.busy === 'collega' ? raw('disabled') : ''}>Collega</button>
    </div>`;
  }
  const acc = S.collegati();
  return html`
    ${nowCard()}
    <div class="section-title"><span>${acc.length > 1 ? 'Playlist' : `Le playlist di ${nameOf(k)}`}</span><button class="card-link" data-action="sp-account">Spotify ${icon('right', 'xs')}</button></div>
    ${acc.length > 1 ? html`<div class="segmented sp-who">${acc.map((x) => html`<button class="${x === k ? 'on' : ''}" data-action="sp-chi" data-v="${x}">${nameOf(x)}</button>`)}</div>` : ''}
    ${playlistGrid(k)}`;
}

// ---------------------------------------------------------------------------
// La nostra musica
// ---------------------------------------------------------------------------
function row(m) {
  const open = ui('musica.open', null) === m.id;
  const embed = spotifyEmbed(m.link);
  const link = safeUrl(m.link);
  // con Spotify collegato i nostri brani partono sul dispositivo scelto (anche quelli senza link: li cerco)
  const connect = isSynced() && S.chi() && (embed || !link);
  return html`
    <div class="row music-row" id="m-${m.id}">
      <span class="chore-ico dot-ico tone-${m.type === 'playlist' ? 'sky' : m.type === 'album' ? 'plum' : 'oak'}">${icon(TYPE_ICON[m.type] || 'music')}</span>
      <button class="row-edit" data-action="musica-edit" data-id="${m.id}">
        <div class="row-title">${m.title}</div>
        <div class="row-sub">${m.artist ? html`<span>${m.artist}</span>` : ''}${(m.themes || []).filter((t) => t !== 'sempre').slice(0, 2).map((t) => html`<span class="pill">${icon(THEMES[t].icon, 'xs')} ${themeLabel(t, true)}</span>`)}${m.by ? whoBadge(m.by) : ''}</div>
      </button>
      ${connect
        ? html`<button class="icon-btn" data-action="musica-sp" data-id="${m.id}" aria-label="Fai partire ${m.title}">${icon('play', 'sm')}</button>`
        : embed
          ? html`<button class="icon-btn" data-action="musica-play" data-id="${m.id}" aria-label="Ascolta ${m.title}" style="${open ? 'background:var(--oak);color:var(--oak-ink)' : ''}">${icon(open ? 'x' : 'play', 'sm')}</button>`
          : html`<a class="icon-btn" href="${link || spotifySearch(m)}" target="_blank" rel="noopener" aria-label="Ascolta ${m.title}">${icon('play', 'sm')}</a>`}
    </div>
    ${open && embed && !connect ? html`<div class="embed"><iframe title="${m.title}" src="${embed}" height="${m.type === 'brano' ? 152 : 352}" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>` : ''}`;
}

export function render() {
  const theme = ui('musica.theme', 'tutti');
  const all = [...state.data.musica].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cur = currentTheme();
  const used = Object.keys(THEMES).filter((t) => all.some((m) => (m.themes || []).includes(t)));
  const list = all.filter((m) => theme === 'tutti' || (m.themes || []).includes(theme));
  const seasonal = cur && theme === 'tutti' ? list.filter((m) => (m.themes || []).includes(cur.id)) : [];
  const rest = list.filter((m) => !seasonal.includes(m));
  const spot = spotifyBlock();

  return html`
    <a class="back-link phone-only" href="#/">${icon('left', 'sm')} Home</a>
    ${pageHead('Musica', { eyebrow: 'La colonna sonora di casa' })}
    ${spot}
    ${spot && all.length ? html`<div class="section-title"><span>La nostra musica</span><span>${all.length}</span></div>` : ''}
    ${used.length ? html`<div class="chips" style="margin-top:0">
      <button class="chip ${theme === 'tutti' ? 'on' : ''}" data-action="musica-theme" data-v="tutti">Tutta</button>
      ${used.map((t) => html`<button class="chip ${theme === t ? 'on' : ''}" data-action="musica-theme" data-v="${t}">${icon(THEMES[t].icon, 'xs')} ${themeLabel(t, true)}</button>`)}
    </div>` : ''}

    ${seasonal.length ? html`
      <div class="section-title"><span>${icon(THEMES[cur.id].icon, 'xs')} Da ascoltare adesso · ${THEMES[cur.id].label}</span></div>
      <div class="list">${seasonal.map(row)}</div>` : ''}

    ${rest.length ? html`
      ${seasonal.length || !spot ? html`<div class="section-title"><span>${seasonal.length ? 'Il resto della nostra musica' : 'La nostra musica'}</span><span>${rest.length}</span></div>` : ''}
      <div class="list">${rest.map(row)}</div>` : ''}

    ${!list.length ? emptyState('Silenzio in casa', 'Aggiungi le canzoni, gli album e le playlist che vi piacciono.', catFace('b')) : ''}


    <button class="fab" data-action="musica-new">${icon('plus')} Musica</button>`;
}

// Entrando nella pagina: account, lettore, dispositivi e playlist (una volta per visita)
let dentro = false;
export function after() {
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

/** Tira giù per aggiornare: anche lettore, dispositivi e playlist. */
export async function refresh() {
  if (!isSynced() || !S.chi()) return;
  await Promise.all([S.aggiorna({ dispositivi: true }), S.caricaPlaylist(S.chi(), true).catch(() => {})]);
}

// copertine che non arrivano: resta l'icona sotto
document.addEventListener('error', (ev) => {
  const el = ev.target;
  if (el && el.tagName === 'IMG' && el.closest('.sp-cover, .sp-pl-img')) el.remove();
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
// Fogli: dove ascoltare, account, Client ID
// ---------------------------------------------------------------------------
let inAttesa = null; // cosa far partire appena si sceglie il dispositivo

function devList() {
  const list = sp.devices;
  if (!list) return html`<p class="muted small" style="padding:14px">Cerco i dispositivi…</p>`;
  if (!list.length) {
    return html`<div class="sp-nodev">${icon('speaker', 'lg')}<p><b>Nessun dispositivo acceso</b></p>
      <p class="small">Apri Spotify sul telefono, oppure chiedi una volta ad Alexa di mettere musica da Spotify: poi l’Echo compare qui.</p></div>`;
  }
  const cur = sceltoOAttivo();
  return html`<div class="list">${list.map((d) => html`
    <button class="set-row sp-devrow ${d.is_restricted || !d.id ? 'off' : ''}" data-action="sp-dispositivo" data-id="${d.id || ''}" ${d.is_restricted || !d.id ? raw('disabled') : ''}>
      ${icon(devIcon(d))}
      <div class="row-main"><b>${d.name}</b><span>${d.is_active ? (sp.player && sp.player.is_playing ? 'Sta suonando' : 'In pausa') : d.is_restricted ? 'Non si comanda da qui' : DEV_LABEL[d.type] || 'Dispositivo'}</span></div>
      ${cur && cur.id === d.id ? html`<span class="sp-check">${icon('check', 'sm')}</span>` : ''}
    </button>`)}</div>`;
}

function devSheet(msg = '') {
  openSheet({
    title: 'Dove ascoltare?',
    body: html`${msg ? html`<p class="prose" style="margin-top:-4px">${msg}</p>` : ''}
      <div id="sp-devlist">${devList()}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" type="button" data-action="sp-cerca-dev">${icon('refresh', 'sm')} Aggiorna</button></div>`,
  });
  aggiornaDev();
}

async function aggiornaDev() {
  const box = () => document.getElementById('sp-devlist');
  const btn = document.querySelector('[data-action="sp-cerca-dev"] svg');
  if (btn) btn.classList.add('spin');
  await S.aggiorna({ dispositivi: true });
  if (btn) btn.classList.remove('spin');
  if (box()) box().innerHTML = devList().s;
}

/** Fa partire qualcosa: sul dispositivo che suona o sull'ultimo scelto, altrimenti chiede dove. */
async function suonaQui(target) {
  if (!S.doveSuonare()) {
    if (!sp.devices) await S.aggiorna({ dispositivi: true });
    if (!S.doveSuonare()) { inAttesa = target; devSheet(); return; }
  }
  try {
    await S.suona(target);
  } catch (e) {
    if (e.status === 404 || e.reason === 'NO_DEVICE' || e.reason === 'NO_ACTIVE_DEVICE') { inAttesa = target; devSheet('Quel dispositivo non risponde: scegline un altro.'); return; }
    throw e;
  }
}

function errore(e) {
  console.error(e);
  if (!(e instanceof S.SpotifyError) || !e.status) {
    const msg = (e && e.message) || '';
    toast(!msg || /fetch|load failed|network/i.test(msg) ? 'Spotify non risponde: controlla la connessione' : msg);
    return;
  }
  if (e.reason === 'PREMIUM_REQUIRED') toast('Per comandare la musica serve Spotify Premium');
  else if (e.status === 429) toast('Spotify chiede una pausa: riprova tra poco');
  else if (e.status === 403) toast('Adesso Spotify non permette questo comando');
  else if (e.status === 404) toast('Il dispositivo non risponde');
  else toast('Spotify non ha risposto: riprova');
}
const prova = (fn) => async (ctx) => { try { await fn(ctx); } catch (e) { errore(e); } };

function accountSheet() {
  const io = me();
  const a = (sp.info && sp.info.account) || {};
  openSheet({
    title: 'Spotify',
    body: html`<div class="list">${['p1', 'p2'].map((k) => html`
      <div class="set-row">${icon('user')}
        <div class="row-main"><b>${nameOf(k)}</b><span>${a[k] ? `Collegato${a[k].nome ? ` come ${a[k].nome}` : ''}` : 'Non collegato'}</span></div>
        ${a[k]
          ? html`<button class="mini-btn" type="button" data-action="sp-scollega" data-v="${k}">Scollega</button>`
          : k === io ? html`<button class="mini-btn primary" type="button" data-action="sp-collega">Collega</button>` : ''}
      </div>`)}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" type="button" data-action="sp-ricarica">${icon('refresh', 'sm')} Aggiorna le playlist</button></div>`,
  });
}

function clientIdSheet() {
  openSheet({
    title: 'Collega Spotify',
    body: html`<label class="field"><span>Client ID dell’app Spotify</span>
      <input name="clientId" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="32 lettere e numeri" ${raw('autofocus')}></label>`,
    submit: 'Continua',
    onSubmit: async (fd) => {
      try { await S.collega(val(fd, 'clientId')); } catch (e) { sheetError(e.message); }
      return false;
    },
  });
}

// ---------------------------------------------------------------------------
// Foglio della nostra musica
// ---------------------------------------------------------------------------
function sheet(m = null) {
  const cur = currentTheme();
  openSheet({
    title: m ? 'Modifica' : 'Nuova musica',
    body: html`
      <div class="field"><span>Cos’è</span><div class="radio-chips">${Object.entries(MUSIC_TYPES).map(([k, l]) => html`
        <label><input type="radio" name="type" value="${k}" ${(m ? m.type : 'brano') === k ? raw('checked') : ''}><span>${icon(TYPE_ICON[k], 'xs')} ${l}</span></label>`)}</div></div>
      <label class="field"><span>Titolo</span><input name="title" value="${m ? m.title : ''}" required ${m ? '' : raw('autofocus')}></label>
      <label class="field"><span>Artista</span><input name="artist" value="${m ? m.artist || '' : ''}"></label>
      <div class="field"><span>Tema</span>${themeChoices('themes', m ? m.themes || [] : cur ? [cur.id] : ['sempre'], THEMES)}</div>
      <label class="field"><span>Link di Spotify o YouTube (facoltativo)</span><input name="link" type="url" inputmode="url" value="${m ? m.link || '' : ''}" placeholder="https://open.spotify.com/…"></label>
      ${m ? html`<div class="wish-actions">
        <a class="mini-btn" href="${spotifySearch(m)}" target="_blank" rel="noopener">${icon('search', 'xs')} Spotify</a>
        <a class="mini-btn" href="${ytSearch(m)}" target="_blank" rel="noopener">${icon('search', 'xs')} YouTube Music</a>
      </div>` : ''}`,
    extra: m ? html`<button class="btn danger" type="button" data-action="musica-del" data-id="${m.id}">${icon('trash', 'sm')}</button>` : '',
    onSubmit: (fd) => {
      const title = cap(val(fd, 'title'));
      if (!title) return false;
      const data = { title, artist: val(fd, 'artist'), type: val(fd, 'type') || 'brano', themes: fd.getAll('themes').length ? fd.getAll('themes') : ['sempre'], link: safeUrl(val(fd, 'link')) };
      if (m) store.update('musica', m.id, data);
      else store.add('musica', { ...data, by: me() || '' });
    },
  });
}

export const actions = {
  'musica-theme': ({ el }) => setUi('musica.theme', el.dataset.v),
  'musica-new': () => sheet(),
  'musica-edit': ({ id }) => sheet(state.data.musica.find((m) => m.id === id)),
  'musica-play': ({ id }) => { vibrate(); setUi('musica.open', ui('musica.open', null) === id ? null : id); },
  'musica-del': ({ id }) => {
    const m = state.data.musica.find((x) => x.id === id);
    closeSheet();
    if (!m) return;
    store.remove('musica', id);
    toast(`Tolto: ${m.title}`, { undo: () => { const { id: _, ...rest } = m; store.set('musica', id, rest); } });
  },
  // un brano/album/playlist della nostra lista su Spotify: dal link, o cercandolo per titolo e artista
  'musica-sp': prova(async ({ id }) => {
    const m = state.data.musica.find((x) => x.id === id);
    if (!m) return;
    vibrate();
    let target = S.uriDaLink(m.link);
    if (!target) {
      const tipo = m.type === 'album' ? 'album' : m.type === 'playlist' ? 'playlist' : 'track';
      const r = await S.cerca(query(m), tipo);
      if (!r) { toast('Non lo trovo su Spotify'); return; }
      target = tipo === 'track' ? { uris: [r.uri] } : { context: r.uri };
    }
    await suonaQui(target);
  }),

  'sp-collega': prova(async () => {
    if (!me()) { toast('Prima scegli chi sei in Impostazioni'); return; }
    if (sp.info && !sp.info.pronta) { clientIdSheet(); return; }
    sp.busy = 'collega';
    rerender();
    try { await S.collega(); } catch (e) {
      if (/Client ID/.test(e.message)) clientIdSheet(); else throw e;
    } finally { sp.busy = ''; rerender(); }
  }),
  'sp-account': () => accountSheet(),
  'sp-scollega': prova(async ({ el }) => {
    closeSheet();
    await S.scollega(el.dataset.v);
    toast(`Spotify di ${nameOf(el.dataset.v)} scollegato`);
  }),
  'sp-ricarica': prova(async () => { closeSheet(); await S.caricaPlaylist(S.chi(), true); toast('Playlist aggiornate'); }),
  'sp-chi': ({ el }) => { S.scegliAccount(el.dataset.v); S.caricaPlaylist().catch(errore); },
  'sp-tutte': () => setUi('sp.tutte', !ui('sp.tutte', false)),
  'sp-playlist': prova(async ({ el }) => { vibrate(); await suonaQui({ context: el.dataset.uri }); }),
  'sp-playpausa': prova(async () => { vibrate(); await S.playPausa(); }),
  'sp-avanti': prova(async () => { vibrate(); await S.salta(true); }),
  'sp-indietro': prova(async () => { vibrate(); await S.salta(false); }),
  'sp-casuale': prova(async () => { vibrate(); await S.casuale(); }),
  'sp-volume': prova(async ({ el }) => { await S.volume(Number(el.value)); }),
  'sp-dispositivi': () => devSheet(),
  'sp-cerca-dev': () => aggiornaDev(),
  'sp-dispositivo': prova(async ({ id }) => {
    if (!id) return;
    vibrate();
    const d = (sp.devices || []).find((x) => x.id === id);
    closeSheet();
    const target = inAttesa;
    inAttesa = null;
    if (target) await S.suona(target, id);
    else if (sp.player) await S.sposta(id);
    else { S.scegliDispositivo(id); rerender(); }
    if (d) toast(`Su ${d.name}`);
  }),
};
