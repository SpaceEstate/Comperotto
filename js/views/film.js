// Film e serie che ci piacciono, per categoria (Famiglia, Natale, Halloween, Sempre, Thriller, Azione, Horror):
// copertina e "dove vederlo" arrivano da soli, e cercando un titolo la categoria si propone dal genere.
import { html, raw, norm, cap, vibrate, aCasoDelGiorno } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { FILM_CATS, filmCats, filmTemiNascosti, temiDaSalvare, categorieDaGeneri } from '../data.js';
import { state, store, openSheet, closeSheet, toast, val, emptyState, ui, setUi, themeChoices, pageHead, isSynced, settings, saveSettings, cancella } from '../core.js';
import { currentTheme } from '../season.js';

const mainTheme = (f) => filmCats(f)[0];
/** La categoria del periodo (Natale, Halloween), se il periodo ne ha una */
const catDelPeriodo = () => { const c = currentTheme(); return c && FILM_CATS[c.id] ? c.id : null; };
const FILTRI = [['davedere', 'Da vedere'], ['visti', 'Visti'], ['tutti', 'Tutti']];
// solo i film o solo le serie (si somma alle categorie); toccando di nuovo quello scelto si torna a tutti e due
const TIPI = [['movie', 'Film', 'film'], ['tv', 'Serie TV', 'tv']];
const tipoScelto = () => (TIPI.some(([v]) => v === ui('film.tipo', '')) ? ui('film.tipo', '') : '');
const delTipo = (tipo) => (f) => !tipo || (tipo === 'tv' ? f.kind === 'tv' : f.kind !== 'tv');
const safePoster = (u) => (typeof u === 'string' && /^https:\/\/(images\.justwatch\.com|is\d+-ssl\.mzstatic\.com|image\.tmdb\.org)\//.test(u) ? u : '');
const safeIcon = (u) => (typeof u === 'string' && /^https:\/\/images\.justwatch\.com\//.test(u) ? u : '');
const searchUrl = (title) => `https://www.justwatch.com/it/cerca?q=${encodeURIComponent(title)}`;
const DAY = 86400000;

const OFFER_GROUPS = [
  ['flatrate', 'Incluso nell’abbonamento'],
  ['free', 'Gratis'],
  ['rent', 'A noleggio'],
  ['buy', 'Da comprare'],
];
const streaming = (f) => (f.offers || []).filter((o) => o.t === 'flatrate' || o.t === 'free');
/** Il risultato di una ricerca è già nella nostra lista? */
const inList = (r) => state.data.film.find((f) => (f.jw && r.jw && f.jw === r.jw) || (norm(f.title) === norm(r.title) && (!f.year || !r.year || f.year === r.year)));

const rotte = new Set(); // copertine che non si sono caricate: al loro posto il riquadro con il titolo
function poster(f, size = '') {
  const src = safePoster(f.poster);
  if (src && !rotte.has(src)) return html`<img src="${src}" alt="" loading="lazy" decoding="async" data-poster="${f.id || ''}">`;
  const th = mainTheme(f);
  return html`<div class="poster-ph th-${FILM_CATS[th] && FILM_CATS[th].mia ? 'mia' : th} ${size}">${icon(f.kind === 'tv' ? 'tv' : 'film')}<span>${f.title}</span></div>`;
}
// un'immagine che non arriva (rete lenta, indirizzo cambiato) non lascia un buco
document.addEventListener('error', (ev) => {
  const el = ev.target;
  if (!el || el.tagName !== 'IMG') return;
  if (el.hasAttribute('data-poster')) {
    rotte.add(el.getAttribute('src'));
    const f = state.data.film.find((x) => x.id === el.dataset.poster);
    if (f) { const d = document.createElement('div'); d.innerHTML = poster(f).s; el.replaceWith(d.firstElementChild); }
    else el.remove();
  } else if (el.closest('.prov, .prov-strip, .fh-on, .mini-poster')) el.remove();
}, true);

function providerIcons(list, max = 3) {
  return list.slice(0, max).map((o) => (safeIcon(o.icon) ? html`<img src="${safeIcon(o.icon)}" alt="${o.name}" title="${o.name}">` : ''));
}

function grid(list) {
  return html`<div class="posters">${list.map((f) => html`
    <button class="poster ${f.watched ? 'seen' : ''}" data-action="film-open" data-id="${f.id}" aria-label="${f.title}">
      ${poster(f)}
      ${f.watched ? html`<span class="p-seen">${icon('check', 'xs')}</span>` : ''}
      ${streaming(f).length ? html`<div class="prov-strip">${providerIcons(streaming(f))}</div>` : ''}
    </button>`)}</div>`;
}

/** Il film di «Stasera guardiamo…»: uno da vedere, della categoria scelta (se c'è) e solo film o solo serie se scelto.
 *  Tutti hanno la stessa probabilità (anche a Natale, se non si sceglie la categoria Natale); cambia ogni giorno,
 *  e con il dado propone gli altri senza ripetersi finché non sono usciti tutti. */
function stasera(all, theme = 'tutti', tipo = '') {
  const daVedere = all.filter((f) => !f.watched && delTipo(tipo)(f));
  const pool = FILM_CATS[theme] ? daVedere.filter((f) => filmCats(f).includes(theme)) : daVedere;
  return aCasoDelGiorno(pool, (f) => f.id, ui('film.spin', 0), 'film').scelto;
}

/** «Stasera guardiamo…»: sempre in cima; con una categoria scelta propone solo film di quella categoria
 *  (se lì non c'è niente da vedere, la scheda non c'è). */
function featured(all, theme = 'tutti', tipo = '') {
  const f = stasera(all, theme, tipo);
  if (!f) return '';
  const src = safePoster(f.poster);
  const on = streaming(f);
  return html`<section class="film-hero" style="${src ? `--poster:url('${src}')` : ''}">
    <div class="fh-bg"></div>
    <div class="fh-poster">${poster(f)}</div>
    <div class="fh-body">
      <p class="fh-eyebrow">Stasera guardiamo…</p>
      <h2>${f.title}</h2>
      <p class="fh-meta">${f.kind === 'tv' ? 'Serie' : 'Film'}${f.year ? ` · ${f.year}` : ''} · ${filmCats(f).map((c) => FILM_CATS[c].label).join(', ')}</p>
      ${on.length ? html`<div class="fh-on">${on.slice(0, 3).map((o) => html`<span>${safeIcon(o.icon) ? html`<img src="${safeIcon(o.icon)}" alt="">` : ''}${o.name}</span>`)}</div>` : ''}
      <div class="fh-actions">
        <button class="btn primary" data-action="film-open" data-id="${f.id}">${icon('play', 'sm')} Dove vederlo</button>
        <button class="icon-btn" data-action="film-spin" aria-label="Proponine un altro">${icon('dice')}</button>
      </div>
    </div>
  </section>`;
}

/** All'apertura dell'app: le locandine e i loghi che si vedono per primi entrando in Film. */
export function locandine() {
  const all = [...state.data.film].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const theme = FILM_CATS[ui('film.theme', 'tutti')] ? ui('film.theme', 'tutti') : 'tutti';
  const primo = stasera(all, theme, tipoScelto());
  // prima quelli da vedere (la pagina parte da lì), poi i già visti
  const film = [...(primo ? [primo] : []), ...all.filter((f) => !f.watched), ...all.filter((f) => f.watched)].slice(0, 160);
  return [
    ...film.map((f) => safePoster(f.poster)),
    ...film.flatMap((f) => streaming(f).slice(0, 3).map((o) => safeIcon(o.icon))),
  ].filter((u) => u && !rotte.has(u));
}

/** Il titolo della zona Film. */
export const testa = () => ({ eyebrow: 'Da vedere sul divano' });
export const render = () => html`${pageHead('Film', testa())}${corpo()}`;

export function corpo() {
  const filter = FILTRI.some(([v]) => v === ui('film.filter', 'davedere')) ? ui('film.filter', 'davedere') : 'davedere';
  const theme = FILM_CATS[ui('film.theme', 'tutti')] ? ui('film.theme', 'tutti') : 'tutti';
  const tipo = tipoScelto();
  const results = ui('film.results', null);
  const all = [...state.data.film].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const pass = (f) =>
    (filter === 'tutti' || (filter === 'davedere' && !f.watched) || (filter === 'visti' && f.watched)) &&
    (theme === 'tutti' || filmCats(f).includes(theme)) && delTipo(tipo)(f);
  const list = all.filter(pass);
  const cur = catDelPeriodo();
  const seasonal = cur && theme === 'tutti' ? list.filter((f) => filmCats(f).includes(cur)) : [];
  const rest = seasonal.length ? list.filter((f) => !seasonal.includes(f)) : list;

  return html`
    <form class="quick-add" data-form="film-search">
      <span class="cerca-box"><input id="film-q" name="q" placeholder="Cerca un film o una serie…" enterkeyhint="search" autocomplete="off" aria-label="Cerca film" value="${ui('film.q', '')}">${cancella('film-q', 'film-results-close')}</span>
      <button type="submit" aria-label="Cerca">${icon('search')}</button>
    </form>

    ${results ? html`<div class="card film-results fade-in">
      <div class="card-head"><h3 class="card-title">Risultati</h3><button class="icon-btn ghost" data-action="film-results-close" aria-label="Chiudi risultati">${icon('x', 'sm')}</button></div>
      ${results === 'loading' ? html`<p class="muted small">Cerco…</p>` : results.length ? html`<div class="list" style="box-shadow:none">${results.map((r, i) => html`
        <button class="row ${inList(r) ? 'in-list' : ''}" data-action="film-pick" data-i="${i}">
          <span class="mini-poster">${safePoster(r.poster) ? html`<img src="${safePoster(r.poster)}" alt="">` : icon(r.kind === 'tv' ? 'tv' : 'film')}</span>
          <span class="row-main"><span class="row-title">${r.title}</span><span class="row-sub">${r.kind === 'tv' ? 'Serie' : 'Film'}${r.year ? ` · ${r.year}` : ''}</span>
            ${(r.offers || []).filter((o) => o.t === 'flatrate' || o.t === 'free').length ? html`<span class="mini-prov">${providerIcons((r.offers || []).filter((o) => o.t === 'flatrate' || o.t === 'free'), 4)}</span>` : ''}</span>
          ${inList(r) ? html`<span class="pill ok">${icon('check', 'xs')} In lista</span>` : html`<span class="add-dot">${icon('plus', 'sm')}</span>`}
        </button>`)}</div>` : html`<p class="muted small">Nessun risultato. <button class="card-link" data-action="film-manual">Aggiungilo lo stesso</button></p>`}
    </div>` : ''}

    ${featured(all, theme, tipo)}

    <div class="chips" role="group" aria-label="Quali film">
      ${FILTRI.map(([v, l]) => html`<button class="chip ${filter === v ? 'on' : ''}" data-action="film-filter" data-v="${v}" aria-pressed="${filter === v ? 'true' : 'false'}">${l}</button>`)}
      <span class="chip-sep" aria-hidden="true"></span>
      ${TIPI.map(([v, l, ic]) => html`<button class="chip ${tipo === v ? 'on' : ''}" data-action="film-tipo" data-v="${tipo === v ? '' : v}" aria-pressed="${tipo === v ? 'true' : 'false'}">${icon(ic, 'xs')} ${l}</button>`)}
    </div>
    <div class="chips film-cats" role="group" aria-label="Categorie">
      ${Object.entries(FILM_CATS).map(([k, c]) => html`<button class="chip ${theme === k ? 'on' : ''}" data-action="film-theme" data-v="${theme === k ? 'tutti' : k}" aria-pressed="${theme === k ? 'true' : 'false'}">${icon(c.icon, 'xs')} ${c.label}</button>`)}
      <a class="chip chip-edit" href="#/impostazioni/categorie/film" aria-label="Togli o aggiungi categorie">${icon('pencil', 'xs')}</a>
    </div>

    ${seasonal.length ? html`<div class="section-title"><span>${icon(FILM_CATS[cur].icon, 'xs')} Atmosfera ${FILM_CATS[cur].label}</span></div>${grid(seasonal)}` : ''}
    ${rest.length ? html`${seasonal.length ? html`<div class="section-title"><span>Tutti gli altri</span></div>` : html`<div style="height:10px"></div>`}${grid(rest)}` : ''}
    ${!list.length ? emptyState(filter === 'visti' ? (tipo === 'tv' ? 'Ancora nessuna serie vista' : 'Ancora nessun film visto') : `${tipo === 'tv' ? 'Nessuna serie' : 'Nessun film'} ${theme !== 'tutti' ? FILM_CATS[theme].label : 'qui'}`, 'Cerca un titolo qui sopra per aggiungerlo.', catFace('a')) : ''}`;
}

// ---------------------------------------------------------------------------
// Copertine e piattaforme: si aggiornano da sole in sottofondo
// ---------------------------------------------------------------------------
const tried = new Set();
let busy = false;

async function lookup(q, kind) {
  const r = await store.call(`film?q=${encodeURIComponent(q)}${kind === 'tv' ? '&tipo=tv' : ''}`);
  return r.results || [];
}

function bestMatch(f, results) {
  const t = norm(f.title);
  const okKind = (r) => !f.kind || r.kind === f.kind;
  const okYear = (r) => !f.year || !r.year || Math.abs(r.year - f.year) <= 1;
  return results.find((r) => f.jw && r.jw === f.jw)
    || results.find((r) => okKind(r) && okYear(r) && norm(r.title) === t)
    || results.find((r) => okKind(r) && f.year && r.year === f.year)
    || results.find((r) => okKind(r) && okYear(r))
    || null;
}

async function refresh(f) {
  const res = await lookup(f.title, f.kind);
  const m = bestMatch(f, res);
  if (!m) { store.update('film', f.id, { lookupMiss: Date.now() }); return null; }
  const patch = { offersAt: Date.now(), lookupMiss: null };
  if (m.jw) patch.jw = m.jw;
  if (m.link) patch.link = m.link;
  if (m.offers) patch.offers = m.offers;
  if (safePoster(m.poster) && !safePoster(f.poster)) patch.poster = m.poster;
  if (!f.year && m.year) patch.year = m.year;
  store.update('film', f.id, patch);
  return { ...f, ...patch };
}

// Una volta sola: gli esempi iniziali passano alle categorie nuove, ma solo se non li avete cambiati
// (1: le categorie di adesso; 2: i film d'animazione anche in "Cartoni")
const ESEMPI = {
  'Mamma, ho perso l’aereo': [['natale'], ['natale', 'famiglia']],
  'Il Grinch': [['natale'], ['natale', 'famiglia']],
  'Hocus Pocus': [['halloween'], ['halloween', 'famiglia']],
  Luca: [['estate'], ['famiglia']],
  'Mamma Mia!': [['estate'], ['sempre']],
  'Il favoloso mondo di Amélie': [['aprile'], ['sempre']],
  'Midnight in Paris': [['aprile'], ['sempre']],
  Ratatouille: [['aprile', 'sempre'], ['famiglia']],
  'Gli Aristogatti': [['sempre'], ['famiglia']],
};
const CARTONI = ['Luca', 'Ratatouille', 'Gli Aristogatti'];
const uguali = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
function aggiornaEsempi() {
  const fatto = Number(settings().filmCats) || 0;
  if (fatto >= 2 || !state.loaded.has('film') || !state.loaded.has('settings')) return;
  // con il database condiviso aspetto i dati veri del server (all'inizio ci sono solo quelli salvati qui, magari nessuno)
  if (store.mode === 'sync' && !(store.synced && store.synced.has('film') && store.synced.has('settings'))) return;
  state.data.film.forEach((f) => {
    let th = f.themes || [];
    const e = ESEMPI[f.title];
    if (fatto < 1 && e && uguali(th, e[0])) th = e[1];
    if (CARTONI.includes(f.title) && e && uguali(th, e[1])) th = [...th, 'cartoni'];
    if (!uguali(th, f.themes)) store.update('film', f.id, { themes: th });
  });
  saveSettings({ filmCats: 2 });
}

export async function after() {
  aggiornaEsempi();
  if (!isSynced() || busy) return;
  const now = Date.now();
  const todo = state.data.film.filter((f) => !tried.has(f.id) && (
    (!safePoster(f.poster) && !(f.lookupMiss && now - f.lookupMiss < 7 * DAY)) ||
    (!f.watched && (!f.offersAt || now - f.offersAt > DAY))
  )).slice(0, 6);
  if (!todo.length) return;
  busy = true;
  try {
    for (const f of todo) {
      tried.add(f.id);
      try { await refresh(f); } catch { break; }
    }
  } finally { busy = false; }
}

// ---------------------------------------------------------------------------
function offersBlock(f) {
  const offers = f.offers || [];
  if (!offers.length) {
    return html`<p class="small" style="margin:0 0 12px">${f.offersAt ? 'Al momento non è su nessuna piattaforma in Italia.' : 'Cerco dove vederlo…'}</p>
      <a class="mini-btn" href="${f.link || searchUrl(f.title)}" target="_blank" rel="noopener">${icon('search', 'xs')} Cerca su JustWatch</a>`;
  }
  return html`${OFFER_GROUPS.map(([t, label]) => {
      const list = offers.filter((o) => o.t === t);
      return list.length ? html`<div class="prov-sec"><b>${label}</b><div class="prov-list">${list.map((o) => {
        const inner = html`${safeIcon(o.icon) ? html`<img src="${safeIcon(o.icon)}" alt="">` : ''}<span>${o.name}${o.price && t !== 'flatrate' ? html` <em>${o.price}</em>` : ''}</span>`;
        return o.url ? html`<a class="prov" href="${o.url}" target="_blank" rel="noopener">${inner}</a>` : html`<span class="prov">${inner}</span>`;
      })}</div></div>` : '';
    })}
    ${f.offersAt ? html`<p class="muted small" style="margin:6px 0 0">Aggiornato il ${new Date(f.offersAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</p>` : ''}`;
}

function detailSheet(f) {
  const src = safePoster(f.poster);
  openSheet({
    title: f.title,
    body: html`
      <div class="film-head">
        <div class="film-poster">${poster(f)}</div>
        <div>
          <p class="muted small" style="margin:0 0 8px">${f.kind === 'tv' ? 'Serie TV' : 'Film'}${f.year ? ` · ${f.year}` : ''}</p>
          <div class="chips wrap" style="gap:6px">${filmCats(f).map((c) => html`<span class="pill">${icon(FILM_CATS[c].icon, 'xs')} ${FILM_CATS[c].label}</span>`)}</div>
          <div class="wish-actions" style="flex-wrap:wrap">
            <button class="mini-btn ${f.watched ? 'primary' : ''}" data-action="film-watched" data-id="${f.id}">${icon(f.watched ? 'check' : 'eye', 'xs')} ${f.watched ? 'Visto' : 'Segna visto'}</button>
          </div>
        </div>
      </div>
      ${f.note ? html`<p class="recipe-note" style="margin-top:14px">${f.note}</p>` : ''}
      <div class="section-title"><span>Dove vederlo in Italia</span>${isSynced() ? html`<button class="card-link" data-action="film-refresh" data-id="${f.id}">${icon('refresh', 'xs')} Aggiorna</button>` : ''}</div>
      <div id="prov-box" class="card">${offersBlock(f)}</div>
      <div class="btn-row" style="margin-top:16px">
        <button class="btn danger" aria-label="Elimina" type="button" data-action="film-del" data-id="${f.id}">${icon('trash', 'sm')}</button>
        <button class="btn" type="button" data-action="film-edit" data-id="${f.id}">${icon('pencil', 'sm')} Modifica</button>
      </div>`,
    onOpen: async (root) => {
      // piattaforme vecchie di più di un giorno: le chiedo di nuovo
      if (!isSynced() || (f.offersAt && Date.now() - f.offersAt < DAY && !ui('film.force', false))) return;
      state.ui['film.force'] = false;
      const box = root.querySelector('#prov-box');
      try {
        const nf = await refresh(f);
        if (box.isConnected && nf) box.innerHTML = offersBlock(nf).s;
      } catch {
        if (box.isConnected) box.innerHTML = offersBlock({ ...f, offers: [], offersAt: 0 }).s;
      }
    },
  });
}

function editSheet(f = null, preset = {}) {
  const d = f || preset;
  // categoria proposta: quella già scelta, altrimenti dal genere (ricerca), altrimenti quella del periodo
  const proposte = f ? filmCats(f) : [...new Set([...(preset.categorie || []), ...categorieDaGeneri(preset.generi)])].filter((c) => FILM_CATS[c]);
  const scelte = proposte.length ? proposte : [catDelPeriodo() || 'sempre'];
  openSheet({
    title: f ? 'Modifica' : 'Nuovo film o serie',
    body: html`
      ${!f && safePoster(preset.poster) ? html`<div class="film-head" style="margin-bottom:14px"><div class="film-poster" style="width:84px"><img src="${safePoster(preset.poster)}" alt=""></div>
        <div><p class="muted small" style="margin:0">${preset.offers && preset.offers.length ? `Su ${[...new Set(preset.offers.filter((o) => o.t === 'flatrate' || o.t === 'free').map((o) => o.name))].slice(0, 3).join(', ') || 'noleggio o acquisto'}` : ''}</p></div></div>` : ''}
      <label class="field"><span>Titolo</span><input name="title" value="${d.title || ''}" required ${f ? '' : raw('autofocus')}></label>
      <div class="field-row">
        <label class="field"><span>Anno</span><input name="year" inputmode="numeric" value="${d.year || ''}"></label>
        <label class="field"><span>Tipo</span><select name="kind"><option value="movie" ${d.kind !== 'tv' ? raw('selected') : ''}>Film</option><option value="tv" ${d.kind === 'tv' ? raw('selected') : ''}>Serie TV</option></select></label>
      </div>
      <div class="field"><span>Categoria</span>${themeChoices('themes', scelte, FILM_CATS)}</div>
      <label class="field"><span>Nota</span><input name="note" value="${d.note || ''}" placeholder="es. da vedere sotto la coperta"></label>`,
    submit: f ? 'Salva' : 'Aggiungi',
    onSubmit: (fd) => {
      const title = cap(val(fd, 'title'));
      if (!title) return false;
      // le categorie tolte (e i temi di prima) restano salvate: riaccendendole il film torna lì
      const themes = temiDaSalvare(fd.getAll('themes'), f && f.themes, f ? filmTemiNascosti(f) : []);
      const data = { title, year: Number(val(fd, 'year')) || null, kind: val(fd, 'kind') || 'movie', themes, note: val(fd, 'note') };
      if (f) {
        const changed = f.title !== title || (f.year || null) !== data.year || (f.kind || 'movie') !== data.kind;
        store.update('film', f.id, changed ? { ...data, jw: null, poster: '', offers: [], offersAt: null, lookupMiss: null } : data);
        if (changed) tried.delete(f.id);
      } else {
        store.add('film', {
          ...data, watched: false,
          jw: preset.jw || null, link: preset.link || '', poster: safePoster(preset.poster),
          offers: preset.offers || [], offersAt: preset.offers ? Date.now() : null,
        });
        toast(`Aggiunto: ${title}`);
      }
    },
  });
}

export const actions = {
  'film-search': async ({ form }) => {
    const q = form.q.value.trim();
    if (!q) return;
    if (!isSynced()) { form.q.value = ''; editSheet(null, { title: cap(q) }); return; }
    state.ui['film.q'] = q;
    setUi('film.results', 'loading');
    // se intanto la ricerca è stata cancellata (X) o cambiata, questi risultati non servono più
    const ancora = () => ui('film.q', '') === q && ui('film.results', null) === 'loading';
    try { const r = await lookup(q); if (ancora()) setUi('film.results', r.slice(0, 8)); }
    catch { if (ancora()) { setUi('film.results', null); editSheet(null, { title: cap(q) }); } }
  },
  'film-results-close': () => { state.ui['film.q'] = ''; setUi('film.results', null); },
  // i risultati restano aperti finché non si chiudono con la X: se si apre il film sbagliato basta tornare indietro
  'film-manual': () => editSheet(null, { title: cap(ui('film.q', '')) }),
  'film-pick': ({ el }) => {
    const r = (ui('film.results', []) || [])[Number(el.dataset.i)];
    if (!r) return;
    const dup = inList(r);
    if (dup) { detailSheet(dup); return; }
    editSheet(null, r);
  },
  'film-spin': () => { vibrate(); setUi('film.spin', Number(ui('film.spin', 0)) + 1); },
  'film-filter': ({ el }) => setUi('film.filter', el.dataset.v),
  'film-tipo': ({ el }) => setUi('film.tipo', el.dataset.v || ''),
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
