// La nostra musica, anche a tema del periodo (Natale, Halloween, mare, Parigi…).
// Si ascolta con il lettore di casa (js/player.js): uno solo, che resta acceso cambiando pagina.
import { html, raw, cap, safeUrl } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { THEMES, themeLabel, MUSIC_TYPES } from '../data.js';
import { state, store, openSheet, closeSheet, toast, val, emptyState, ui, setUi, themeChoices, me, whoBadge, pageHead, sheetError } from '../core.js';
import { currentTheme } from '../season.js';
import * as player from '../player.js';

const TYPE_ICON = { brano: 'music', album: 'disc', playlist: 'headphones', radio: 'radio' };
const query = (m) => `${m.title} ${m.artist || ''}`.trim();
export const spotifySearch = (m) => `https://open.spotify.com/search/${encodeURIComponent(query(m))}`;
export const ytSearch = (m) => `https://music.youtube.com/search?q=${encodeURIComponent(query(m))}`;

/** La voce come la vuole il lettore (null se si può solo aprire fuori dall'app). */
export function traccia(m) {
  const src = player.sorgente(m);
  if (!src) return null;
  return { id: m.id, title: m.title, artist: m.artist || '', cover: player.safeCover(m.cover), type: m.type || 'brano', ...src };
}

/** Le liste come si vedono adesso sullo schermo (la coda del lettore segue quest'ordine). */
function liste() {
  const theme = ui('musica.theme', 'tutti');
  const all = [...state.data.musica].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cur = currentTheme();
  const list = all.filter((m) => theme === 'tutti' || (m.themes || []).includes(theme));
  const seasonal = cur && theme === 'tutti' ? list.filter((m) => (m.themes || []).includes(cur.id)) : [];
  const rest = list.filter((m) => !seasonal.includes(m));
  return { theme, all, cur, list, seasonal, rest };
}

function row(m, np) {
  const src = player.sorgente(m);
  const link = safeUrl(m.link);
  const mine = np && np.id === m.id;
  const on = mine && np.playing;
  const cover = player.safeCover(m.cover);
  return html`
    <div class="row music-row ${mine ? 'on' : ''}" id="m-${m.id}">
      <span class="chore-ico dot-ico pl-cover tone-${m.type === 'playlist' ? 'sky' : m.type === 'album' ? 'plum' : m.type === 'radio' ? 'rose' : 'oak'}">${cover ? html`<img src="${cover}" alt="" loading="lazy" decoding="async">` : icon(TYPE_ICON[m.type] || 'music')}</span>
      <button class="row-edit" data-action="musica-edit" data-id="${m.id}">
        <div class="row-title">${mine ? html`<span class="eq ${on ? '' : 'paused'}" aria-hidden="true"><i></i><i></i><i></i></span>` : ''}${m.title}</div>
        <div class="row-sub">${m.artist ? html`<span>${m.artist}</span>` : ''}${(m.themes || []).filter((t) => t !== 'sempre' && THEMES[t]).slice(0, 2).map((t) => html`<span class="pill">${icon(THEMES[t].icon, 'xs')} ${themeLabel(t, true)}</span>`)}${m.by ? whoBadge(m.by) : ''}</div>
      </button>
      ${src
        ? html`<button class="icon-btn ${on ? 'on' : ''}" data-action="musica-play" data-id="${m.id}" aria-label="${on ? `Pausa: ${m.title}` : `Ascolta ${m.title}`}">${icon(on ? 'pause' : 'play', 'sm filled')}</button>`
        : html`<a class="icon-btn" href="${link || spotifySearch(m)}" target="_blank" rel="noopener" aria-label="Cerca ${m.title} ${link ? '' : 'su Spotify'}">${icon(link ? 'link' : 'search', 'sm')}</a>`}
    </div>`;
}

export function render() {
  const { theme, all, cur, list, seasonal, rest } = liste();
  const used = Object.keys(THEMES).filter((t) => all.some((m) => (m.themes || []).includes(t)));
  const np = player.nowPlaying();
  const suonabili = (l) => l.some((m) => player.sorgente(m));

  return html`
    <a class="back-link phone-only" href="#/">${icon('left', 'sm')} Home</a>
    ${pageHead('Musica', { eyebrow: 'La colonna sonora di casa' })}
    <div class="chips" style="margin-top:0">
      <button class="chip ${theme === 'tutti' ? 'on' : ''}" data-action="musica-theme" data-v="tutti">Tutta</button>
      ${used.map((t) => html`<button class="chip ${theme === t ? 'on' : ''}" data-action="musica-theme" data-v="${t}">${icon(THEMES[t].icon, 'xs')} ${themeLabel(t, true)}</button>`)}
    </div>

    ${seasonal.length ? html`
      <div class="section-title"><span>${icon(THEMES[cur.id].icon, 'xs')} Da ascoltare adesso · ${THEMES[cur.id].label}</span>
        ${suonabili(seasonal) ? html`<button class="play-all" data-action="musica-play-all" data-v="seasonal">${icon('play', 'filled')} Ascolta</button>` : ''}</div>
      <div class="list">${seasonal.map((m) => row(m, np))}</div>` : ''}

    ${rest.length ? html`
      <div class="section-title"><span>${seasonal.length ? 'Il resto della nostra musica' : 'La nostra musica'} · ${rest.length}</span>
        ${suonabili(rest) ? html`<button class="play-all" data-action="musica-play-all" data-v="rest">${icon('play', 'filled')} Ascolta</button>` : ''}</div>
      <div class="list">${rest.map((m) => row(m, np))}</div>` : ''}

    ${!list.length ? emptyState('Silenzio in casa', 'Aggiungi le canzoni, gli album e le playlist che vi piacciono.', catFace('b')) : ''}

    <button class="fab" data-action="musica-new">${icon('plus')} Musica</button>`;
}

/** La coda: tutto ciò che si può ascoltare, nell'ordine dello schermo. */
function coda() {
  const { theme, cur, seasonal, rest } = liste();
  const ctx = theme !== 'tutti' && THEMES[theme] ? `La nostra musica · ${THEMES[theme].label}` : cur && seasonal.length ? `La nostra musica · ${THEMES[cur.id].label}` : 'La nostra musica';
  return { items: [...seasonal, ...rest].map(traccia).filter(Boolean), ctx };
}

// ---------------------------------------------------------------------------
// Copertine e titoli da Spotify (oEmbed pubblico, senza chiavi): arrivano da soli
// ---------------------------------------------------------------------------
async function oembed(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    return { title: String(j.title || '').trim(), cover: player.safeCover(j.thumbnail_url) };
  } catch { return null; } finally { clearTimeout(t); }
}

const provate = new Set();
let cercando = false;
export async function after() {
  if (cercando) return;
  const todo = state.data.musica.filter((m) => !provate.has(m.id) && !player.safeCover(m.cover) && player.spotifyRef(m.link)).slice(0, 8);
  if (!todo.length) return;
  cercando = true;
  try {
    for (const m of todo) {
      provate.add(m.id);
      const o = await oembed(player.spotifyRef(m.link).url);
      if (o && o.cover) store.update('musica', m.id, { cover: o.cover });
    }
  } finally { cercando = false; }
}

/** Titoli e copertine cambiati: il lettore aggiorna la sua coda senza fermarsi. */
export function aggiornaLettore() {
  const byId = new Map(state.data.musica.map((m) => [m.id, m]));
  player.aggiornaVoci((id) => { const m = byId.get(id); return m ? traccia(m) || { title: m.title, artist: m.artist || '', cover: player.safeCover(m.cover) } : null; });
}

// ---------------------------------------------------------------------------
// Link condivisi brevi (spotify.link): il server segue il rinvio e restituisce l'indirizzo vero
// ---------------------------------------------------------------------------
async function linkVero(link) {
  if (!/^https:\/\/(spotify\.link|spotify\.app\.link)\//i.test(link)) return link;
  try { const r = await store.call(`link?url=${encodeURIComponent(link)}`); return r && r.url ? r.url : link; } catch { return link; }
}

function sheet(m = null) {
  const cur = currentTheme();
  openSheet({
    title: m ? 'Modifica' : 'Nuova musica',
    body: html`
      <label class="field"><span>Link <em class="opt">facoltativo</em></span><input name="link" type="url" inputmode="url" autocomplete="off" value="${m ? m.link || '' : ''}" placeholder="Spotify, oppure un file audio o una radio">
        <span class="help" id="mus-link-help">Da Spotify: Condividi → Copia link. Con il link il brano si ascolta qui nell’app.</span></label>
      <div class="field"><span>Cos’è</span><div class="radio-chips">${Object.entries(MUSIC_TYPES).map(([k, l]) => html`
        <label><input type="radio" name="type" value="${k}" ${(m ? m.type || 'brano' : 'brano') === k ? raw('checked') : ''}><span>${icon(TYPE_ICON[k], 'xs')} ${l}</span></label>`)}</div></div>
      <label class="field"><span>Titolo</span><input name="title" value="${m ? m.title : ''}" required ${m ? '' : raw('autofocus')}></label>
      <label class="field"><span>Artista</span><input name="artist" value="${m ? m.artist || '' : ''}"></label>
      <div class="field"><span>Tema</span>${themeChoices('themes', m ? m.themes || [] : cur ? [cur.id] : ['sempre'], THEMES)}</div>
      ${m ? html`<div class="wish-actions">
        <a class="mini-btn" href="${spotifySearch(m)}" target="_blank" rel="noopener">${icon('search', 'xs')} Spotify</a>
        <a class="mini-btn" href="${ytSearch(m)}" target="_blank" rel="noopener">${icon('search', 'xs')} YouTube Music</a>
      </div>` : ''}`,
    extra: m ? html`<button class="btn danger" type="button" data-action="musica-del" data-id="${m.id}" aria-label="Elimina">${icon('trash', 'sm')}</button>` : '',
    onOpen: (root) => {
      // incollando un link di Spotify: tipo e titolo si compilano da soli
      const form = root.querySelector('#sheet-form');
      const help = root.querySelector('#mus-link-help');
      let ultimo = '';
      const guarda = async () => {
        const raw0 = form.link.value.trim();
        if (!raw0 || raw0 === ultimo) return;
        ultimo = raw0;
        const link = await linkVero(raw0);
        if (form.link.value.trim() !== raw0) return; // nel frattempo è cambiato
        if (link !== raw0) form.link.value = link;
        const sp = player.spotifyRef(link);
        if (!sp) {
          help.textContent = /^https:\/\//i.test(link) ? (player.sorgente({ link, type: form.type.value }) ? 'File audio: si ascolta qui nell’app.' : 'Per una radio in diretta scegli «Radio» qui sotto.') : 'Il link deve iniziare con https://';
          return;
        }
        const tipo = { track: 'brano', episode: 'brano', album: 'album', playlist: 'playlist', artist: 'playlist', show: 'playlist' }[sp.kind];
        const r = form.querySelector(`input[name=type][value="${tipo}"]`);
        if (r) r.checked = true;
        help.textContent = 'Link di Spotify ✓';
        if (!form.title.value.trim()) {
          const o = await oembed(sp.url);
          if (o && o.title && !form.title.value.trim()) form.title.value = o.title;
        }
      };
      form.link.addEventListener('change', guarda);
      form.link.addEventListener('paste', () => setTimeout(guarda, 30));
    },
    onSubmit: async (fd) => {
      const title = cap(val(fd, 'title'));
      if (!title) { sheetError('Scrivi il titolo'); return false; }
      const link = safeUrl(await linkVero(val(fd, 'link')));
      const type = val(fd, 'type') || 'brano';
      if (type === 'radio' && !/^https:\/\//i.test(link)) { sheetError('Per una radio serve il suo link (https://…)'); return false; }
      const data = { title, artist: val(fd, 'artist'), type, themes: fd.getAll('themes').length ? fd.getAll('themes') : ['sempre'], link };
      // il link è cambiato: la copertina vecchia non vale più
      if (m && (m.link || '') !== link) { data.cover = null; provate.delete(m.id); }
      if (m) store.update('musica', m.id, data);
      else store.add('musica', { ...data, by: me() || '' });
    },
  });
}

export const actions = {
  'musica-theme': ({ el }) => setUi('musica.theme', el.dataset.v),
  'musica-new': () => sheet(),
  'musica-edit': ({ id }) => { const m = state.data.musica.find((x) => x.id === id); if (m) sheet(m); },
  'musica-play': ({ id }) => {
    const { items, ctx } = coda();
    player.playItem(id, items, ctx);
  },
  'musica-play-all': ({ el }) => {
    const l = liste()[el.dataset.v === 'seasonal' ? 'seasonal' : 'rest'];
    const { items, ctx } = coda();
    const first = l.find((m) => player.sorgente(m));
    if (first) player.playItem(first.id, items, ctx);
  },
  'musica-del': ({ id }) => {
    const m = state.data.musica.find((x) => x.id === id);
    closeSheet();
    if (!m) return;
    store.remove('musica', id);
    toast(`Tolto: ${m.title}`, { undo: () => { const { id: _, ...rest } = m; store.set('musica', id, rest); } });
  },
};
