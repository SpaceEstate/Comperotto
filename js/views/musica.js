// La nostra musica, anche a tema del periodo (Natale, Halloween, mare, Parigi…)
import { html, raw, cap, safeUrl, vibrate } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { THEMES, themeLabel, MUSIC_TYPES } from '../data.js';
import { state, store, openSheet, closeSheet, toast, val, emptyState, ui, setUi, themeChoices, me, whoBadge } from '../core.js';
import { currentTheme } from '../season.js';

const TYPE_ICON = { brano: 'music', album: 'disc', playlist: 'headphones' };

/** Riconosce i link di Spotify per mostrare il lettore integrato. */
export function spotifyEmbed(link) {
  const m = String(link || '').match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,40})/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator` : '';
}
const query = (m) => `${m.title} ${m.artist || ''}`.trim();
export const spotifySearch = (m) => `https://open.spotify.com/search/${encodeURIComponent(query(m))}`;
export const ytSearch = (m) => `https://music.youtube.com/search?q=${encodeURIComponent(query(m))}`;

function row(m) {
  const open = ui('musica.open', null) === m.id;
  const embed = spotifyEmbed(m.link);
  const link = safeUrl(m.link);
  return html`
    <div class="row music-row" id="m-${m.id}">
      <span class="chore-ico dot-ico tone-${m.type === 'playlist' ? 'sky' : m.type === 'album' ? 'plum' : 'oak'}">${icon(TYPE_ICON[m.type] || 'music')}</span>
      <button class="row-edit" data-action="musica-edit" data-id="${m.id}">
        <div class="row-title">${m.title}</div>
        <div class="row-sub">${m.artist ? html`<span>${m.artist}</span>` : ''}${(m.themes || []).filter((t) => t !== 'sempre').slice(0, 2).map((t) => html`<span class="pill">${icon(THEMES[t].icon, 'xs')} ${themeLabel(t, true)}</span>`)}${m.by ? whoBadge(m.by) : ''}</div>
      </button>
      ${embed
        ? html`<button class="icon-btn" data-action="musica-play" data-id="${m.id}" aria-label="Ascolta ${m.title}" style="${open ? 'background:var(--oak);color:var(--oak-ink)' : ''}">${icon(open ? 'x' : 'play', 'sm')}</button>`
        : html`<a class="icon-btn" href="${link || spotifySearch(m)}" target="_blank" rel="noopener" aria-label="Ascolta ${m.title}">${icon('play', 'sm')}</a>`}
    </div>
    ${open && embed ? html`<div class="embed"><iframe title="${m.title}" src="${embed}" height="${m.type === 'brano' ? 152 : 352}" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>` : ''}`;
}

export function render() {
  const theme = ui('musica.theme', 'tutti');
  const all = [...state.data.musica].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const cur = currentTheme();
  const used = Object.keys(THEMES).filter((t) => all.some((m) => (m.themes || []).includes(t)));
  const list = all.filter((m) => theme === 'tutti' || (m.themes || []).includes(theme));
  const seasonal = cur && theme === 'tutti' ? list.filter((m) => (m.themes || []).includes(cur.id)) : [];
  const rest = list.filter((m) => !seasonal.includes(m));

  return html`
    <div class="chips" style="margin-top:0">
      <button class="chip ${theme === 'tutti' ? 'on' : ''}" data-action="musica-theme" data-v="tutti">Tutta</button>
      ${used.map((t) => html`<button class="chip ${theme === t ? 'on' : ''}" data-action="musica-theme" data-v="${t}">${icon(THEMES[t].icon, 'xs')} ${themeLabel(t, true)}</button>`)}
    </div>

    ${seasonal.length ? html`
      <div class="section-title"><span>${icon(THEMES[cur.id].icon, 'xs')} Da ascoltare adesso · ${THEMES[cur.id].label}</span></div>
      <div class="list">${seasonal.map(row)}</div>` : ''}

    ${rest.length ? html`
      <div class="section-title"><span>${seasonal.length ? 'Il resto della nostra musica' : 'La nostra musica'}</span><span>${rest.length}</span></div>
      <div class="list">${rest.map(row)}</div>` : ''}

    ${!list.length ? emptyState('Silenzio in casa', 'Aggiungi le canzoni, gli album e le playlist che vi piacciono.', catFace('b')) : ''}

    <div class="hint">${icon('info', 'sm')}<div>Incolla un link di <b>Spotify</b> (Condividi → Copia link) per ascoltarla direttamente qui. Con altri link, o senza, il tasto ▶ apre la ricerca.</div></div>

    <button class="fab" data-action="musica-new">${icon('plus')} Musica</button>`;
}

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
      <label class="field"><span>Link (Spotify, YouTube, Apple Music…)</span><input name="link" type="url" inputmode="url" value="${m ? m.link || '' : ''}" placeholder="https://open.spotify.com/…"></label>
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
};
