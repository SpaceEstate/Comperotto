// Film e serie che ci piacciono, a tema e non, con "dove vederlo" sempre aggiornato
import { html, raw, norm, cap, vibrate } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { THEMES, themeLabel } from '../data.js';
import { state, store, openSheet, closeSheet, toast, val, emptyState, ui, setUi, rerender, themeChoices, confirmSheet, settings } from '../core.js';
import { currentTheme } from '../season.js';
import * as tmdb from '../tmdb.js';

const key = () => (settings().tmdbKey || '').trim();
const mainTheme = (f) => (f.themes && f.themes[0]) || 'sempre';

function poster(f) {
  const src = tmdb.img(f.poster, 'w342');
  if (src) return html`<img src="${src}" alt="" loading="lazy">`;
  return html`<div class="poster-ph th-${THEMES[mainTheme(f)] ? mainTheme(f) : 'sempre'}">${icon(f.kind === 'tv' ? 'tv' : 'film')}<span>${f.title}</span></div>`;
}

function providerStrip(f) {
  if (!f.tmdbId || !key()) return '';
  const p = tmdb.cachedProviders(f.kind || 'movie', f.tmdbId);
  if (!p) return '';
  const list = [...p.flatrate, ...p.free];
  if (!list.length) return '';
  return html`<div class="prov-strip">${list.slice(0, 3).map((x) => x.logo ? html`<img src="${x.logo}" alt="${x.name}" title="${x.name}">` : '')}</div>`;
}

function grid(list) {
  return html`<div class="posters">${list.map((f) => html`
    <button class="poster fade-in ${f.watched ? 'seen' : ''}" data-action="film-open" data-id="${f.id}" aria-label="${f.title}">
      ${poster(f)}
      ${f.fav ? html`<span class="p-fav">${icon('heart', 'filled')}</span>` : ''}
      ${f.watched ? html`<span class="p-seen">${icon('check', 'xs')}</span>` : ''}
      ${providerStrip(f)}
    </button>`)}</div>`;
}

export function render() {
  const filter = ui('film.filter', 'davedere');
  const theme = ui('film.theme', 'tutti');
  const results = ui('film.results', null);
  const all = [...state.data.film].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const pass = (f) =>
    (filter === 'tutti' || (filter === 'davedere' && !f.watched) || (filter === 'visti' && f.watched) || (filter === 'preferiti' && f.fav)) &&
    (theme === 'tutti' || (f.themes || []).includes(theme));
  const list = all.filter(pass);
  const cur = currentTheme();
  const seasonal = cur && theme === 'tutti' ? list.filter((f) => (f.themes || []).includes(cur.id)) : [];
  const rest = seasonal.length ? list.filter((f) => !seasonal.includes(f)) : list;
  const used = Object.keys(THEMES).filter((t) => all.some((f) => (f.themes || []).includes(t)));

  return html`
    <form class="quick-add" data-form="film-search">
      <input id="film-q" name="q" placeholder="${key() ? 'Cerca un film o una serie…' : 'Aggiungi un film o una serie…'}" enterkeyhint="search" autocomplete="off" aria-label="Cerca film" value="${ui('film.q', '')}">
      <button type="submit" aria-label="Cerca">${icon(key() ? 'search' : 'plus')}</button>
    </form>

    ${results ? html`<div class="card" style="margin-top:12px">
      <div class="card-head"><h3 class="card-title">Risultati</h3><button class="icon-btn ghost" data-action="film-results-close" aria-label="Chiudi risultati">${icon('x', 'sm')}</button></div>
      ${results === 'loading' ? html`<p class="muted small">Cerco…</p>` : results.length ? html`<div class="list" style="box-shadow:none">${results.map((r, i) => html`
        <button class="row" data-action="film-pick" data-i="${i}">
          <span class="mini-poster">${r.poster ? html`<img src="${tmdb.img(r.poster, 'w92')}" alt="">` : icon(r.kind === 'tv' ? 'tv' : 'film')}</span>
          <span class="row-main"><span class="row-title">${r.title}</span><span class="row-sub">${r.kind === 'tv' ? 'Serie' : 'Film'}${r.year ? ` · ${r.year}` : ''}</span></span>
          ${icon('plus', 'sm')}
        </button>`)}</div>` : html`<p class="muted small">Nessun risultato. <button class="card-link" data-action="film-manual">Aggiungilo a mano</button></p>`}
    </div>` : ''}

    <div class="chips">
      ${[['davedere', 'Da vedere'], ['visti', 'Visti'], ['preferiti', 'Preferiti'], ['tutti', 'Tutti']].map(([v, l]) => html`<button class="chip ${filter === v ? 'on' : ''}" data-action="film-filter" data-v="${v}">${l}</button>`)}
    </div>
    ${used.length > 1 ? html`<div class="chips" style="margin-top:4px">
      <button class="chip ${theme === 'tutti' ? 'on' : ''}" data-action="film-theme" data-v="tutti">Ogni tema</button>
      ${used.map((t) => html`<button class="chip ${theme === t ? 'on' : ''}" data-action="film-theme" data-v="${t}">${icon(THEMES[t].icon, 'xs')} ${themeLabel(t, true)}</button>`)}
    </div>` : ''}

    ${seasonal.length ? html`<div class="section-title"><span>${icon(THEMES[cur.id].icon, 'xs')} Atmosfera ${THEMES[cur.id].label}</span></div>${grid(seasonal)}` : ''}
    ${rest.length ? html`${seasonal.length ? html`<div class="section-title"><span>Tutti gli altri</span></div>` : html`<div style="height:10px"></div>`}${grid(rest)}` : ''}
    ${!list.length ? emptyState(filter === 'visti' ? 'Ancora nessun film visto' : 'Nessun film qui', 'Cerca un titolo qui sopra per aggiungerlo.', catFace('a')) : ''}

    <p class="muted small attribution">${key()
      ? html`Dove vederlo: dati dal vivo di <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a> e JustWatch. Questo sito usa le API di TMDB ma non è approvato da TMDB.`
      : html`Aggiungi una chiave TMDB gratuita in Impostazioni per locandine e piattaforme aggiornate in automatico.`}</p>`;
}

// Carica in sottofondo locandine e piattaforme dei film mostrati
let busy = false;
export async function after() {
  const k = key();
  if (!k || busy) return;
  busy = true;
  try {
    const todo = state.data.film.filter((f) => !f.tmdbId && !f.tmdbMiss).slice(0, 8);
    for (const f of todo) {
      try {
        const r = await tmdb.resolve(f, k);
        store.update('film', f.id, r ? { tmdbId: r.tmdbId, kind: r.kind, poster: r.poster || f.poster || '', year: r.year || f.year || null } : { tmdbMiss: true });
      } catch (e) { if (/non valida/.test(e.message)) throw e; }
    }
    const need = state.data.film.filter((f) => f.tmdbId && !tmdb.cachedProviders(f.kind || 'movie', f.tmdbId)).slice(0, 12);
    let changed = false;
    for (const f of need) {
      try { await tmdb.providers(f.kind || 'movie', f.tmdbId, k); changed = true; } catch (e) { if (/non valida/.test(e.message)) throw e; }
    }
    if (changed) rerender();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
}

function providerBlock(p, f) {
  const sec = (title, list) => (list.length ? html`<div class="prov-sec"><b>${title}</b><div class="prov-list">${list.map((x) => html`<span class="prov">${x.logo ? html`<img src="${x.logo}" alt="">` : ''}${x.name}</span>`)}</div></div>` : '');
  const none = !p.flatrate.length && !p.free.length && !p.rent.length && !p.buy.length;
  return html`
    ${none ? html`<p class="muted small" style="margin:0 0 10px">Al momento non risulta su nessuna piattaforma in Italia.</p>` : ''}
    ${sec('In abbonamento', p.flatrate)}${sec('Gratis', p.free)}${sec('Noleggio', p.rent)}${sec('Acquisto', p.buy)}
    <a class="mini-btn" href="${p.link || tmdb.justWatchUrl(f.title)}" target="_blank" rel="noopener">${icon('link', 'xs')} Apri la scheda completa</a>`;
}

function detailSheet(f) {
  const k = key();
  const src = tmdb.img(f.poster, 'w185');
  openSheet({
    title: f.title,
    body: html`
      <div class="film-head">
        <div class="film-poster">${src ? html`<img src="${src}" alt="">` : poster(f)}</div>
        <div>
          <p class="muted small" style="margin:0 0 8px">${f.kind === 'tv' ? 'Serie TV' : 'Film'}${f.year ? ` · ${f.year}` : ''}</p>
          <div class="chips wrap" style="gap:6px">${(f.themes || []).map((t) => html`<span class="pill">${icon((THEMES[t] || THEMES.sempre).icon, 'xs')} ${themeLabel(t, true)}</span>`)}</div>
          <div class="wish-actions" style="flex-wrap:wrap">
            <button class="mini-btn ${f.watched ? 'primary' : ''}" data-action="film-watched" data-id="${f.id}">${icon(f.watched ? 'check' : 'eye', 'xs')} ${f.watched ? 'Visto' : 'Segna visto'}</button>
            <button class="mini-btn" data-action="film-fav" data-id="${f.id}" style="${f.fav ? 'color:var(--rose)' : ''}">${icon('heart', f.fav ? 'xs filled' : 'xs')} ${f.fav ? 'Preferito' : 'Preferito?'}</button>
          </div>
        </div>
      </div>
      ${f.note ? html`<p class="recipe-note" style="margin-top:14px">${f.note}</p>` : ''}
      <div class="section-title"><span>Dove vederlo in Italia</span>${k && f.tmdbId ? html`<button class="card-link" data-action="film-refresh" data-id="${f.id}">${icon('refresh', 'xs')} Aggiorna</button>` : ''}</div>
      <div id="prov-box" class="card">${k && f.tmdbId ? html`<p class="muted small" style="margin:0">Controllo le piattaforme…</p>`
        : html`<p class="small" style="margin:0 0 10px">Il catalogo delle piattaforme cambia spesso: controlla qui dove si trova oggi.</p>
          <a class="mini-btn" href="${tmdb.justWatchUrl(f.title)}" target="_blank" rel="noopener">${icon('search', 'xs')} Cerca su JustWatch</a>`}</div>
      <div class="btn-row" style="margin-top:16px">
        <button class="btn danger" type="button" data-action="film-del" data-id="${f.id}">${icon('trash', 'sm')}</button>
        <button class="btn" type="button" data-action="film-edit" data-id="${f.id}">${icon('pencil', 'sm')} Modifica</button>
      </div>`,
    onOpen: async (root) => {
      if (!k || !f.tmdbId) return;
      const box = root.querySelector('#prov-box');
      try {
        const p = await tmdb.providers(f.kind || 'movie', f.tmdbId, k, { force: Boolean(ui('film.force', false)) });
        setUi('film.force', false);
        if (box.isConnected) box.innerHTML = providerBlock(p, f).s;
      } catch (e) {
        if (box.isConnected) box.innerHTML = html`<p class="small" style="margin:0 0 10px">${e.message}</p><a class="mini-btn" href="${tmdb.justWatchUrl(f.title)}" target="_blank" rel="noopener">${icon('search', 'xs')} Cerca su JustWatch</a>`.s;
      }
    },
  });
}

function editSheet(f = null, preset = {}) {
  const d = f || preset;
  const cur = currentTheme();
  openSheet({
    title: f ? 'Modifica' : 'Nuovo film o serie',
    body: html`
      <label class="field"><span>Titolo</span><input name="title" value="${d.title || ''}" required ${f ? '' : raw('autofocus')}></label>
      <div class="field-row">
        <label class="field"><span>Anno</span><input name="year" type="number" inputmode="numeric" value="${d.year || ''}"></label>
        <label class="field"><span>Tipo</span><select name="kind"><option value="movie" ${d.kind !== 'tv' ? raw('selected') : ''}>Film</option><option value="tv" ${d.kind === 'tv' ? raw('selected') : ''}>Serie TV</option></select></label>
      </div>
      <div class="field"><span>Tema</span>${themeChoices('themes', d.themes || (cur ? [cur.id] : ['sempre']), THEMES)}</div>
      <label class="field"><span>Nota</span><input name="note" value="${d.note || ''}" placeholder="es. da vedere sotto la coperta"></label>`,
    onSubmit: (fd) => {
      const title = cap(val(fd, 'title'));
      if (!title) return false;
      const data = { title, year: Number(val(fd, 'year')) || null, kind: val(fd, 'kind') || 'movie', themes: fd.getAll('themes').length ? fd.getAll('themes') : ['sempre'], note: val(fd, 'note') };
      if (f) {
        const changed = f.title !== title || (f.year || null) !== data.year || (f.kind || 'movie') !== data.kind;
        store.update('film', f.id, changed && !preset.tmdbId ? { ...data, tmdbId: null, tmdbMiss: false, poster: '' } : data);
      } else {
        store.add('film', { ...data, tmdbId: preset.tmdbId || null, poster: preset.poster || '', watched: false, fav: false });
        toast(`Aggiunto: ${title}`);
      }
    },
  });
}

export const actions = {
  'film-search': async ({ form }) => {
    const q = form.q.value.trim();
    if (!q) return;
    const k = key();
    if (!k) { form.q.value = ''; editSheet(null, { title: cap(q) }); return; }
    state.ui['film.q'] = q;
    setUi('film.results', 'loading');
    try { setUi('film.results', await tmdb.search(q, k)); }
    catch (e) { setUi('film.results', null); toast(e.message); }
  },
  'film-results-close': () => { state.ui['film.q'] = ''; setUi('film.results', null); },
  'film-manual': () => { const q = ui('film.q', ''); setUi('film.results', null); editSheet(null, { title: cap(q) }); },
  'film-pick': ({ el }) => {
    const r = (ui('film.results', []) || [])[Number(el.dataset.i)];
    if (!r) return;
    const dup = state.data.film.find((f) => (f.tmdbId && f.tmdbId === r.tmdbId) || (norm(f.title) === norm(r.title) && (!f.year || f.year === r.year)));
    state.ui['film.q'] = '';
    setUi('film.results', null);
    if (dup) { toast('È già nella lista'); return; }
    editSheet(null, r);
  },
  'film-filter': ({ el }) => setUi('film.filter', el.dataset.v),
  'film-theme': ({ el }) => setUi('film.theme', el.dataset.v),
  'film-open': ({ id }) => { const f = state.data.film.find((x) => x.id === id); if (f) detailSheet(f); },
  'film-watched': ({ id }) => {
    const f = state.data.film.find((x) => x.id === id);
    if (!f) return;
    vibrate();
    store.update('film', id, { watched: !f.watched, watchedAt: f.watched ? null : Date.now() });
    closeSheet();
    toast(f.watched ? 'Rimesso tra i da vedere' : 'Visto! Com’era?');
  },
  'film-fav': ({ id }) => {
    const f = state.data.film.find((x) => x.id === id);
    if (!f) return;
    vibrate();
    store.update('film', id, { fav: !f.fav });
    closeSheet();
  },
  'film-refresh': ({ id }) => { const f = state.data.film.find((x) => x.id === id); if (f) { state.ui['film.force'] = true; detailSheet(f); } },
  'film-edit': ({ id }) => { const f = state.data.film.find((x) => x.id === id); closeSheet(); if (f) setTimeout(() => editSheet(f), 320); },
  'film-del': ({ id }) => {
    const f = state.data.film.find((x) => x.id === id);
    closeSheet();
    if (!f) return;
    store.remove('film', id);
    toast(`Tolto: ${f.title}`, { undo: () => { const { id: _, ...rest } = f; store.set('film', id, rest); } });
  },
};
