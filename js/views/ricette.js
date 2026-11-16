// Ricette, divise per tema (Natale, Halloween, Pasqua, …)
import { html, raw, norm, cap, parseQty, resizeImage, safeImg, vibrate } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { THEMES, themeLabel } from '../data.js';
import { state, store, openSheet, closeSheet, toast, val, lines, pageHead, emptyState, ui, setUi, navigate, themeChoices, confirmSheet, rerender } from '../core.js';
import { addShopping } from './spesa.js';
import { currentTheme, seasonInfo } from '../season.js';

const mainTheme = (r) => (r.themes && r.themes[0]) || 'sempre';

export function placeholder(theme, cls = '') {
  const t = THEMES[theme] || THEMES.sempre;
  return html`<div class="r-ph th-${THEMES[theme] ? theme : 'sempre'} ${cls}">${icon(t.icon)}</div>`;
}

function card(r) {
  const img = safeImg(r.photo);
  return html`<a class="recipe-card fade-in" href="#/ricette/${r.id}">
    <div class="r-img">${img ? html`<div class="r-ph r-ph-cover" style="background-image:url('${img}')"></div>` : placeholder(mainTheme(r))}
      ${r.fav ? html`<span class="r-fav">${icon('heart')}</span>` : ''}</div>
    <div class="r-body"><h3 class="r-title">${r.title}</h3>
      <div class="r-meta">${r.time ? html`${icon('clock', 'xs')} ${r.time} min · ` : ''}${themeLabel(mainTheme(r), true)}</div></div>
  </a>`;
}

export function render(route) {
  if (route[1]) return detail(route[1]);
  const theme = ui('ricette.theme', 'tutte');
  const q = norm(ui('ricette.q', ''));
  const all = [...state.data.ricette].sort((a, b) => a.title.localeCompare(b.title, 'it'));
  const filtered = all.filter((r) =>
    (theme === 'tutte' || (theme === 'preferite' ? r.fav : (r.themes || []).includes(theme))) &&
    (!q || norm(r.title).includes(q) || (r.ingredients || []).some((i) => norm(i).includes(q))));
  const used = Object.keys(THEMES).filter((t) => all.some((r) => (r.themes || []).includes(t)));
  const season = seasonInfo();
  const sTheme = currentTheme();
  const seasonCount = sTheme ? all.filter((r) => (r.themes || []).includes(sTheme.id)).length : 0;

  return html`
    ${pageHead('Ricette', { eyebrow: `${all.length} nel ricettario`, actions: all.length ? html`<button class="icon-btn" data-action="ricetta-random" aria-label="Cosa cuciniamo?">${icon('dice')}</button>` : '' })}

    ${sTheme && theme === 'tutte' && !q ? html`<a class="season-banner" href="#/ricette" data-action="ricette-theme" data-theme="${sTheme.id}">
      <span class="s-ico tone-oak dot-ico">${icon(THEMES[sTheme.id].icon, 'lg')}</span>
      <div><b>${season ? season.title : sTheme.label}</b><span>${seasonCount ? `${seasonCount} ricette di ${THEMES[sTheme.id].label}` : `Aggiungi le vostre ricette di ${THEMES[sTheme.id].label}`}${sTheme.days != null ? ` · mancano ${sTheme.days} giorni` : ''}</span></div>
    </a>` : ''}

    <div class="search">${icon('search', 'sm')}<input id="ricette-q" type="search" placeholder="Cerca per nome o ingrediente" value="${ui('ricette.q', '')}" data-input="ricette-q" aria-label="Cerca ricette"></div>

    <div class="chips" style="margin-top:0">
      <button class="chip ${theme === 'tutte' ? 'on' : ''}" data-action="ricette-theme" data-theme="tutte">Tutte</button>
      <button class="chip ${theme === 'preferite' ? 'on' : ''}" data-action="ricette-theme" data-theme="preferite">${icon('heart', 'xs')} Preferite</button>
      ${Object.entries(THEMES).filter(([id]) => used.includes(id) || id === theme).map(([id, t]) => html`<button class="chip ${theme === id ? 'on' : ''}" data-action="ricette-theme" data-theme="${id}">${icon(t.icon, 'xs')} ${t.short || t.label}</button>`)}
    </div>

    ${filtered.length ? html`<div class="recipes" style="margin-top:8px">${filtered.map(card)}</div>`
      : emptyState(q ? 'Nessuna ricetta trovata' : 'Ricettario vuoto', q ? 'Prova con un altro ingrediente.' : 'Aggiungi la prima ricetta di casa.', catFace('b'))}

    <button class="fab" data-action="ricetta-new">${icon('plus')} Ricetta</button>`;
}

function detail(id) {
  const r = state.data.ricette.find((x) => x.id === id);
  if (!r) return emptyState('Ricetta non trovata', html`<a href="#/ricette">Torna alle ricette</a>`);
  const img = safeImg(r.photo);
  const picked = ui(`ingr.${id}`, null);
  const ingr = r.ingredients || [];
  const sel = picked || ingr.map(() => true);
  const n = sel.filter(Boolean).length;
  return html`
    <div class="recipe-hero">
      ${img ? html`<img src="${img}" alt="">` : placeholder(mainTheme(r))}
      <div class="hero-bar">
        <a class="icon-btn" href="#/ricette" aria-label="Indietro">${icon('left')}</a>
        <div style="display:flex;gap:8px">
          <button class="icon-btn" data-action="ricetta-fav" data-id="${r.id}" aria-label="Preferita" style="${r.fav ? 'color:var(--rose)' : ''}">${icon('heart', r.fav ? 'filled' : '')}</button>
          <button class="icon-btn" data-action="ricetta-edit" data-id="${r.id}" aria-label="Modifica">${icon('pencil')}</button>
        </div>
      </div>
    </div>
    <article class="recipe-sheet">
      <h1>${r.title}</h1>
      <div class="facts">
        ${r.time ? html`<span class="fact">${icon('clock', 'sm')} ${r.time} min</span>` : ''}
        ${r.servings ? html`<span class="fact">${icon('users', 'sm')} ${r.servings} ${r.servings > 12 ? 'pezzi' : 'porzioni'}</span>` : ''}
        ${(r.themes || []).map((t) => html`<span class="fact">${icon((THEMES[t] || THEMES.sempre).icon, 'sm')} ${themeLabel(t, true)}</span>`)}
        <button class="fact wake ${ui('wake', false) ? 'on' : ''}" data-action="wake">${icon('bulb', 'sm')} ${ui('wake', false) ? 'Schermo sempre acceso' : 'Tieni lo schermo acceso'}</button>
      </div>
      <div class="recipe-cols"><div class="col-ingr">

      ${ingr.length ? html`
        <div class="section-title"><span>Ingredienti</span><button class="card-link" data-action="ingr-all" data-id="${r.id}">${sel.every(Boolean) ? 'Nessuno' : 'Tutti'}</button></div>
        <div class="list ingr">${ingr.map((x, i) => html`
          <button class="row" data-action="ingr-toggle" data-id="${r.id}" data-i="${i}">
            <span class="check sq ${sel[i] ? 'on' : ''}">${icon('check')}</span>
            <span class="row-main"><span class="row-title">${x}</span></span>
          </button>`)}</div>
        <button class="btn primary block" style="margin-top:12px" data-action="ricetta-spesa" data-id="${r.id}" ${n ? '' : raw('disabled')}>${icon('basket', 'sm')} Aggiungi alla spesa (${n})</button>` : ''}
      </div><div class="col-steps">

      ${(r.steps || []).length ? html`<div class="section-title"><span>Preparazione</span></div><ol class="steps">${r.steps.map((s) => html`<li>${s}</li>`)}</ol>` : ''}
      ${r.note ? html`<div class="section-title"><span>Il nostro segreto</span></div><p class="recipe-note">${r.note}</p>` : ''}
      <button class="btn block" style="margin-top:22px" data-action="ricetta-edit" data-id="${r.id}">${icon('pencil', 'sm')} Modifica ricetta</button>
      </div></div>
    </article>`;
}

function recipeSheet(r = null) {
  let photo = r ? r.photo || '' : '';
  openSheet({
    title: r ? 'Modifica ricetta' : 'Nuova ricetta',
    body: html`
      <label class="field"><span>Nome</span><input name="title" value="${r ? r.title : ''}" placeholder="es. Lasagne della nonna" required ${r ? '' : raw('autofocus')}></label>
      <div class="field"><span>Tema</span>${themeChoices('themes', r ? r.themes || [] : ['sempre'], THEMES)}</div>
      <div class="field-row">
        <label class="field"><span>Tempo (min)</span><input name="time" type="number" inputmode="numeric" min="0" value="${r && r.time ? r.time : ''}"></label>
        <label class="field"><span>Porzioni</span><input name="servings" type="number" inputmode="numeric" min="0" value="${r && r.servings ? r.servings : ''}"></label>
      </div>
      <label class="field"><span>Ingredienti</span><textarea name="ingredients" placeholder="Uno per riga&#10;200 g farina&#10;2 uova">${r ? (r.ingredients || []).join('\n') : ''}</textarea></label>
      <label class="field"><span>Preparazione</span><textarea name="steps" placeholder="Un passaggio per riga" style="min-height:150px">${r ? (r.steps || []).join('\n') : ''}</textarea></label>
      <label class="field"><span>Nota / segreto</span><input name="note" value="${r ? r.note || '' : ''}"></label>
      <div class="field"><span>Foto</span><div class="photo-pick">
        <span class="thumb" id="r-thumb" style="${safeImg(photo) ? `background-image:url('${safeImg(photo)}')` : ''}">${safeImg(photo) ? '' : icon('camera')}</span>
        <label class="btn" style="height:42px">${icon('upload', 'sm')} Scegli<input type="file" accept="image/*" id="r-photo" hidden></label>
        ${photo ? html`<button class="btn danger" type="button" id="r-photo-del" style="height:42px">${icon('trash', 'sm')}</button>` : ''}
      </div></div>`,
    extra: r ? html`<button class="btn danger" type="button" data-action="ricetta-del" data-id="${r.id}">${icon('trash', 'sm')}</button>` : '',
    onOpen: (root) => {
      const thumb = root.querySelector('#r-thumb');
      root.querySelector('#r-photo').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try { photo = await resizeImage(f, 800, 0.72); thumb.style.backgroundImage = `url('${photo}')`; thumb.innerHTML = ''; } catch { toast('Foto non valida'); }
      });
      const del = root.querySelector('#r-photo-del');
      if (del) del.addEventListener('click', () => { photo = ''; thumb.style.backgroundImage = ''; del.remove(); });
    },
    onSubmit: (fd) => {
      const title = cap(val(fd, 'title'));
      if (!title) return false;
      const data = {
        title, themes: fd.getAll('themes').length ? fd.getAll('themes') : ['sempre'],
        time: Number(val(fd, 'time')) || null, servings: Number(val(fd, 'servings')) || null,
        ingredients: lines(val(fd, 'ingredients')), steps: lines(val(fd, 'steps')), note: val(fd, 'note'), photo,
      };
      if (r) store.update('ricette', r.id, data);
      else { const id = store.add('ricette', { ...data, fav: false }); setTimeout(() => navigate(`#/ricette/${id}`), 50); }
    },
  });
}

// Mentre si cucina lo schermo non si spegne (Screen Wake Lock, iOS 16.4+)
let wakeLock = null;
export function releaseWake() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  state.ui.wake = false;
}
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden && state.ui.wake && 'wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }
});

export const actions = {
  wake: async () => {
    if (state.ui.wake) { releaseWake(); setUi('wake', false); return; }
    if (!('wakeLock' in navigator)) { toast('Su questo dispositivo non si può: aggiorna iOS'); return; }
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { if (!document.hidden) { state.ui.wake = false; rerender(); } });
      vibrate();
      setUi('wake', true);
      toast('Lo schermo resta acceso finché sei sulla ricetta');
    } catch { toast('Non riesco a tenere acceso lo schermo'); }
  },
  'ricette-theme': ({ el, ev }) => { ev.preventDefault(); setUi('ricette.theme', el.dataset.theme); if (location.hash !== '#/ricette') navigate('#/ricette'); },
  'ricette-q': ({ el }) => setUi('ricette.q', el.value),
  'ricetta-new': () => recipeSheet(),
  'ricetta-edit': ({ id }) => recipeSheet(state.data.ricette.find((r) => r.id === id)),
  'ricetta-fav': ({ id }) => { const r = state.data.ricette.find((x) => x.id === id); if (r) { vibrate(); store.update('ricette', id, { fav: !r.fav }); } },
  'ricetta-del': ({ id }) => {
    const r = state.data.ricette.find((x) => x.id === id);
    closeSheet();
    if (!r) return;
    confirmSheet({ title: `Eliminare “${r.title}”?`, text: 'La ricetta verrà tolta dal ricettario di casa.', onYes: () => { store.remove('ricette', id); navigate('#/ricette'); } });
  },
  'ricetta-random': () => {
    const theme = currentTheme();
    let pool = state.data.ricette;
    const themed = theme ? pool.filter((r) => (r.themes || []).includes(theme.id)) : [];
    if (themed.length && Math.random() < 0.6) pool = themed;
    if (!pool.length) return;
    const r = pool[Math.floor(Math.random() * pool.length)];
    vibrate(15);
    navigate(`#/ricette/${r.id}`);
  },
  'ingr-toggle': ({ id, el }) => {
    const r = state.data.ricette.find((x) => x.id === id);
    const cur = ui(`ingr.${id}`, null) || (r.ingredients || []).map(() => true);
    const i = Number(el.dataset.i);
    const next = [...cur]; next[i] = !next[i];
    setUi(`ingr.${id}`, next);
  },
  'ingr-all': ({ id }) => {
    const r = state.data.ricette.find((x) => x.id === id);
    const cur = ui(`ingr.${id}`, null) || (r.ingredients || []).map(() => true);
    const all = cur.every(Boolean);
    setUi(`ingr.${id}`, (r.ingredients || []).map(() => !all));
  },
  'ricetta-spesa': ({ id }) => {
    const r = state.data.ricette.find((x) => x.id === id);
    if (!r) return;
    const sel = ui(`ingr.${id}`, null) || (r.ingredients || []).map(() => true);
    let count = 0;
    (r.ingredients || []).forEach((line, i) => {
      if (!sel[i]) return;
      const { qty, name } = parseQty(line);
      if (/^(sale|pepe|acqua)$/i.test(norm(name))) return;
      count += addShopping(name, { recipe: r.title, qty }).length;
    });
    vibrate(15);
    toast(count ? `Aggiunti ${count} ingredienti alla spesa` : 'Erano già tutti in lista');
  },
};
