// Ricette, divise per tema (Natale, Halloween, Pasqua, …)
import { html, raw, norm, cap, parseQty, resizeImage, safeImg, safeUrl, hostOf, vibrate } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { RICETTE_CATS, ricetteCats, temiVecchi } from '../data.js';
import { state, store, openSheet, closeSheet, toast, val, lines, pageHead, emptyState, ui, setUi, navigate, themeChoices, confirmSheet, rerender, isSynced, sheetError, cancella, settings, saveSettings } from '../core.js';
import { addShopping } from './spesa.js';
import { currentTheme, seasonInfo } from '../season.js';

const mainTheme = (r) => ricetteCats(r)[0];
const catLabel = (c) => (RICETTE_CATS[c] || RICETTE_CATS.sempre).label;

export function placeholder(theme, cls = '') {
  const c = RICETTE_CATS[theme] ? theme : 'sempre';
  return html`<div class="r-ph th-${c} ${cls}">${icon(RICETTE_CATS[c].icon)}</div>`;
}

function card(r) {
  const img = safeImg(r.photo);
  return html`<a class="recipe-card fade-in" href="#/ricette/${r.id}">
    <div class="r-img">${img ? html`<div class="r-ph r-ph-cover" style="background-image:url('${img}')"></div>` : placeholder(mainTheme(r))}
      ${r.fav ? html`<span class="r-fav">${icon('heart')}</span>` : ''}</div>
    <div class="r-body"><h3 class="r-title">${r.title}</h3>
      <div class="r-meta">${r.time ? html`${icon('clock', 'xs')} ${r.time} min · ` : ''}${catLabel(mainTheme(r))}</div></div>
  </a>`;
}

/** Il titolo della zona Ricette: quante ricette e il dado "cosa cuciniamo?". */
export function testa() {
  const n = state.data.ricette.length;
  return { eyebrow: `${n} nel ricettario`, actions: n ? html`<button class="icon-btn" data-action="ricetta-random" aria-label="Cosa cuciniamo?">${icon('dice')}</button>` : '' };
}

/** #/ricette/<id>: la ricetta; l'elenco sta nella pagina Cibo (corpo()). */
export function render(route) {
  if (route[1]) return detail(route[1]);
  return html`${pageHead('Ricette', testa())}${corpo()}`;
}

export function corpo() {
  const t0 = ui('ricette.theme', 'tutte');
  const theme = t0 === 'preferite' || RICETTE_CATS[t0] ? t0 : 'tutte';
  const q = norm(ui('ricette.q', ''));
  const all = [...state.data.ricette].sort((a, b) => a.title.localeCompare(b.title, 'it'));
  const filtered = all.filter((r) =>
    (theme === 'tutte' || (theme === 'preferite' ? r.fav : ricetteCats(r).includes(theme))) &&
    (!q || norm(r.title).includes(q) || (r.ingredients || []).some((i) => norm(i).includes(q))));
  const season = seasonInfo();
  // il periodo dell'anno, se è una delle categorie (Natale, Halloween, Estate)
  const sTheme = currentTheme() && RICETTE_CATS[currentTheme().id] ? currentTheme() : null;
  const seasonCount = sTheme ? all.filter((r) => ricetteCats(r).includes(sTheme.id)).length : 0;

  return html`
    ${sTheme && theme === 'tutte' && !q ? html`<a class="season-banner" href="#/cibo/ricette" data-action="ricette-theme" data-theme="${sTheme.id}">
      <span class="s-ico tone-oak dot-ico">${icon(RICETTE_CATS[sTheme.id].icon, 'lg')}</span>
      <div><b>${season ? season.title : sTheme.label}</b><span>${seasonCount ? `${seasonCount} ${seasonCount === 1 ? 'ricetta' : 'ricette'} di ${catLabel(sTheme.id)}` : `Aggiungi le vostre ricette di ${catLabel(sTheme.id)}`}${sTheme.days != null ? ` · mancano ${sTheme.days} giorni` : ''}</span></div>
    </a>` : ''}

    <div class="search">${icon('search', 'sm')}<input id="ricette-q" type="search" placeholder="Cerca per nome o ingrediente" value="${ui('ricette.q', '')}" data-input="ricette-q" aria-label="Cerca ricette">${cancella('ricette-q')}</div>

    <div class="chips" style="margin-top:0">
      <button class="chip ${theme === 'tutte' ? 'on' : ''}" data-action="ricette-theme" data-theme="tutte">Tutte</button>
      <button class="chip ${theme === 'preferite' ? 'on' : ''}" data-action="ricette-theme" data-theme="preferite">${icon('heart', 'xs')} Preferite</button>
      ${Object.entries(RICETTE_CATS).map(([id, t]) => html`<button class="chip ${theme === id ? 'on' : ''}" data-action="ricette-theme" data-theme="${id}">${icon(t.icon, 'xs')} ${t.label}</button>`)}
    </div>

    ${q && filtered.length ? html`<div class="section-title"><span>Nel nostro ricettario · ${filtered.length}</span></div>` : ''}
    ${filtered.length ? html`<div class="recipes" style="margin-top:8px">${filtered.map(card)}</div>`
      : q ? html`<p class="muted small web-none">Nel nostro ricettario non c’è niente con «${ui('ricette.q', '')}».</p>`
      : RICETTE_CATS[theme] && all.length ? emptyState(`Nessuna ricetta di ${catLabel(theme)}`, 'Aggiungila con + Ricetta, scegliendo la categoria.', catFace('b'))
      : theme === 'preferite' && all.length ? emptyState('Nessuna preferita', 'Tocca il cuore in una ricetta per ritrovarla qui.', catFace('b'))
      : emptyState('Ricettario vuoto', 'Aggiungi la prima ricetta di casa.', catFace('b'))}

    ${q ? online(q, all) : ''}

    <button class="fab" data-action="ricetta-new">${icon('plus')} Ricetta</button>`;
}

// ---------------------------------------------------------------------------
// Ricerca anche online: le ricette di GialloZafferano (foto, voto, difficoltà, tempo; importabili con un
// tocco). Parte solo quando si smette di scrivere, con almeno 3 lettere; le richieste vecchie si annullano
// e i risultati restano in memoria.
// ---------------------------------------------------------------------------
const FONTI = { giallozafferano: 'GialloZafferano' };
const suGz = (t) => `https://www.giallozafferano.it/ricerca-ricette/${encodeURIComponent(t).replace(/%20/g, '+')}/`;
const webCache = new Map();
let webT = 0;
let webCtrl = null;

function programmaWeb(testo) {
  clearTimeout(webT);
  const k = norm(testo);
  if (k.length < 3 || !isSynced()) { if (webCtrl) webCtrl.abort(); webCtrl = null; state.ui['ricette.web'] = null; return; }
  const c = webCache.get(k);
  if (c && Date.now() - c.at < 10 * 60000) { state.ui['ricette.web'] = { k, stato: 'ok', ...c }; return; }
  state.ui['ricette.web'] = { k, stato: 'attesa' };
  webT = setTimeout(() => cercaWeb(k, testo), 600);
}

async function cercaWeb(k, testo) {
  if (webCtrl) webCtrl.abort();
  const ctrl = new AbortController();
  webCtrl = ctrl;
  setUi('ricette.web', { k, stato: 'carico' });
  try {
    const r = await store.call(`ricette?q=${encodeURIComponent(testo.trim())}`, { signal: ctrl.signal });
    if (webCtrl !== ctrl) return; // nel frattempo si è scritto altro
    const res = { risultati: r.risultati || [], errori: r.errori || [], at: Date.now() };
    if (!res.errori.length) webCache.set(k, res);
    setUi('ricette.web', { k, stato: 'ok', ...res });
  } catch (e) {
    if ((e && e.name === 'AbortError') || webCtrl !== ctrl) return;
    setUi('ricette.web', { k, stato: 'errore', msg: e && e.message });
  } finally { if (webCtrl === ctrl) webCtrl = null; }
}

function online(q, all) {
  const testo = ui('ricette.q', '').trim();
  const altrove = html`<p class="web-more">${icon('search', 'xs')} Tutti i risultati su
    <a href="${suGz(testo)}" target="_blank" rel="noopener">GialloZafferano</a></p>`;
  if (!isSynced()) return altrove;
  const w = ui('ricette.web', null);
  if (q.length < 3) return html`<p class="muted small web-none">Con almeno 3 lettere cerco anche online.</p>`;
  if (!w || w.k !== q) return '';
  const nostre = new Map(all.map((r) => [norm(r.title), r]));
  let corpo;
  if (w.stato === 'attesa' || w.stato === 'carico') {
    corpo = html`<div class="web-results" aria-busy="true">${[1, 2].map(() => html`<div class="web-card sk"><div class="wc-img"></div><div class="wc-body"><i></i><i></i><i></i></div></div>`)}</div>`;
  } else if (w.stato === 'errore') {
    corpo = html`<div class="card web-msg">${icon('info', 'sm')}<div><b>GialloZafferano non risponde adesso.</b><span>${w.msg && !/^Errore \d/.test(w.msg) ? w.msg : 'Controlla la connessione e riprova.'}</span>
      <button class="mini-btn" data-action="ricette-web-riprova" style="margin-top:8px">${icon('refresh', 'xs')} Riprova</button></div></div>`;
  } else if (!w.risultati.length) {
    corpo = html`<p class="muted small web-none">Su GialloZafferano non ho trovato ricette per «${testo}». Prova con un nome più semplice (es. «lasagne»).</p>`;
  } else {
    corpo = html`<div class="web-results">${w.risultati.map((r) => {
      const gia = nostre.get(norm(r.titolo));
      return html`<article class="web-card">
        <div class="wc-img">${/^https:\/\//.test(r.immagine || '') ? html`<img src="${r.immagine}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : placeholder('sempre')}</div>
        <div class="wc-body">
          <b>${r.titolo}</b>
          <span class="wc-src">${FONTI[r.fonte] || r.fonte}</span>
          ${r.descrizione ? html`<p>${r.descrizione}</p>` : ''}
          <div class="wc-act">
            ${gia ? html`<a class="mini-btn primary" href="#/ricette/${gia.id}">${icon('check', 'xs')} Già nel ricettario</a>`
              : html`<button class="mini-btn primary" data-action="ricetta-importa" data-url="${safeUrl(r.link)}">${icon('download', 'xs')} Importa</button>`}
            <a class="mini-btn" href="${safeUrl(r.link)}" target="_blank" rel="noopener">${icon('link', 'xs')} Originale</a>
          </div>
        </div>
      </article>`;
    })}</div>
    ${w.errori && w.errori.length ? html`<p class="muted small web-none">${w.errori.map((x) => FONTI[x] || x).join(', ')} non ha risposto: i risultati potrebbero essere incompleti.</p>` : ''}`;
  }
  return html`<div class="section-title"><span>${icon('search', 'xs')} Anche online</span>${w.stato === 'carico' ? html`<span class="web-spin" aria-label="Cerco"></span>` : ''}</div>${corpo}${altrove}`;
}

/** Una foto arrivata come data URL dal server: la riduco come quelle scattate (meno spazio nel database). */
async function ridimensiona(dataUrl) {
  if (!safeImg(dataUrl)) return '';
  try { return await resizeImage(await (await fetch(dataUrl)).blob(), 800, 0.72); } catch { return ''; }
}

function detail(id) {
  const r = state.data.ricette.find((x) => x.id === id);
  if (!r) return emptyState('Ricetta non trovata', html`<a href="#/cibo/ricette">Torna alle ricette</a>`);
  const img = safeImg(r.photo);
  const picked = ui(`ingr.${id}`, null);
  const ingr = r.ingredients || [];
  const sel = picked || ingr.map(() => true);
  const n = sel.filter(Boolean).length;
  return html`
    <div class="recipe-hero">
      ${img ? html`<img src="${img}" alt="">` : placeholder(mainTheme(r))}
      <div class="hero-bar">
        <a class="icon-btn" href="#/cibo/ricette" aria-label="Indietro">${icon('left')}</a>
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
        ${ricetteCats(r).map((t) => html`<span class="fact">${icon(RICETTE_CATS[t].icon, 'sm')} ${RICETTE_CATS[t].label}</span>`)}
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
      ${r.fonte && safeUrl(r.fonte.url) ? html`<p class="recipe-src">Fonte: <a href="${safeUrl(r.fonte.url)}" target="_blank" rel="noopener">${r.fonte.nome || hostOf(r.fonte.url)}</a>${r.fonte.licenza ? ` · ${r.fonte.licenza}` : ''}</p>` : ''}
      <button class="btn block" style="margin-top:22px" data-action="ricetta-edit" data-id="${r.id}">${icon('pencil', 'sm')} Modifica ricetta</button>
      </div></div>
    </article>`;
}

function recipeSheet(r = null, preset = null) {
  const d = r || preset || {};
  let photo = d.photo || '';
  let fonte = d.fonte || null;
  openSheet({
    title: r ? 'Modifica ricetta' : preset ? 'Importa ricetta' : 'Nuova ricetta',
    body: html`
      ${!r && isSynced() ? html`<div class="field import-link"><span>Da un sito di ricette <em class="opt">facoltativo</em></span>
        <div class="il-row"><input name="url" type="url" inputmode="url" autocomplete="off" placeholder="Incolla il link della ricetta"><button class="btn" type="button" id="r-import">${icon('download', 'sm')} Importa</button></div>
        <p class="help" id="r-import-help">${preset ? html`Controlla e salva: fonte ${fonte && fonte.nome ? fonte.nome : ''}.` : 'Funziona con quasi tutti i siti di cucina (GialloZafferano, Misya, Cucchiaio d’argento…).'}</p></div>` : ''}
      <label class="field"><span>Nome</span><input name="title" value="${d.title || ''}" placeholder="es. Lasagne della nonna" required ${r || preset ? '' : raw('autofocus')}></label>
      <div class="field"><span>Categoria</span>${themeChoices('themes', d.themes ? ricetteCats(d) : ['sempre'], RICETTE_CATS)}</div>
      <div class="field-row">
        <label class="field"><span>Tempo (min)</span><input name="time" type="number" inputmode="numeric" min="0" value="${d.time || ''}"></label>
        <label class="field"><span>Porzioni</span><input name="servings" type="number" inputmode="numeric" min="0" value="${d.servings || ''}"></label>
      </div>
      <label class="field"><span>Ingredienti</span><textarea name="ingredients" placeholder="Uno per riga&#10;200 g farina&#10;2 uova">${(d.ingredients || []).join('\n')}</textarea></label>
      <label class="field"><span>Preparazione</span><textarea name="steps" placeholder="Un passaggio per riga" style="min-height:150px">${(d.steps || []).join('\n')}</textarea></label>
      <label class="field"><span>Nota / segreto</span><input name="note" value="${d.note || ''}"></label>
      <div class="field"><span>Foto</span><div class="photo-pick">
        <span class="thumb" id="r-thumb" style="${safeImg(photo) ? `background-image:url('${safeImg(photo)}')` : ''}">${safeImg(photo) ? '' : icon('camera')}</span>
        <label class="btn" style="height:42px">${icon('upload', 'sm')} Scegli<input type="file" accept="image/*" id="r-photo" hidden></label>
        ${photo ? html`<button class="btn danger" aria-label="Elimina" type="button" id="r-photo-del" style="height:42px">${icon('trash', 'sm')}</button>` : ''}
      </div></div>`,
    extra: r ? html`<button class="btn danger" aria-label="Elimina" type="button" data-action="ricetta-del" data-id="${r.id}">${icon('trash', 'sm')}</button>` : '',
    onOpen: (root) => {
      const thumb = root.querySelector('#r-thumb');
      const form = root.querySelector('#sheet-form');
      const imp = root.querySelector('#r-import');
      if (imp) imp.addEventListener('click', async () => {
        const link = safeUrl(form.url.value);
        const help = root.querySelector('#r-import-help');
        if (!link) { sheetError('Incolla il link di una ricetta (https://…)'); return; }
        imp.disabled = true;
        help.textContent = 'Leggo la ricetta…';
        sheetError('');
        try {
          const x = await store.call(`ricette?url=${encodeURIComponent(link)}`);
          if (x.titolo) form.title.value = x.titolo;
          if (x.tempo) form.time.value = x.tempo;
          if (x.porzioni) form.servings.value = x.porzioni;
          if (x.ingredienti && x.ingredienti.length) form.ingredients.value = x.ingredienti.join('\n');
          if (x.passi && x.passi.length) form.steps.value = x.passi.join('\n');
          fonte = x.fonte || null;
          const foto = x.immagine ? await ridimensiona(x.immagine) : '';
          if (foto) { photo = foto; thumb.style.backgroundImage = `url('${foto}')`; thumb.innerHTML = ''; }
          help.textContent = `Fatto: controlla e salva. Fonte: ${fonte ? fonte.nome : hostOf(link)}.`;
        } catch (e) {
          help.textContent = '';
          sheetError(e && e.message ? e.message : 'Non riesco a leggere questa pagina');
        } finally { imp.disabled = false; }
      });
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
        // i temi di prima che non sono categorie restano salvati (niente dati persi)
        title, themes: [...(fd.getAll('themes').length ? fd.getAll('themes') : ['sempre']), ...temiVecchi(r)],
        time: Number(val(fd, 'time')) || null, servings: Number(val(fd, 'servings')) || null,
        ingredients: lines(val(fd, 'ingredients')), steps: lines(val(fd, 'steps')), note: val(fd, 'note'), photo,
      };
      if (fonte && safeUrl(fonte.url)) data.fonte = { nome: String(fonte.nome || hostOf(fonte.url)).slice(0, 80), url: safeUrl(fonte.url), licenza: String(fonte.licenza || '').slice(0, 40) };
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

// Una volta sola: gli esempi iniziali entrano nelle categorie nuove (solo se non li avete cambiati).
// 1: le crêpes in Colazione; 2: i dolci anche in Dolci (i temi di prima restano salvati)
const ESEMPI = { 'Crêpes come a Parigi': [['aprile', 'sempre'], ['colazione', 'sempre', 'aprile']] };
const DOLCI = {
  'Crêpes come a Parigi': [['colazione', 'sempre', 'aprile'], ['colazione', 'dolci', 'sempre', 'aprile']],
  Tiramisù: [['sanvalentino', 'compleanni'], ['dolci', 'sanvalentino', 'compleanni']],
  'Biscotti speziati di Natale': [['natale'], ['natale', 'dolci']],
};
const uguali = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
function aggiornaEsempi() {
  const fatto = Number(settings().ricetteCats) || 0;
  if (fatto >= 2 || !state.loaded.has('ricette') || !state.loaded.has('settings')) return;
  // con il database condiviso aspetto i dati veri del server
  if (store.mode === 'sync' && !(store.synced && store.synced.has('ricette') && store.synced.has('settings'))) return;
  state.data.ricette.forEach((r) => {
    let th = r.themes || [];
    const e = ESEMPI[r.title];
    if (fatto < 1 && e && uguali(th, e[0])) th = e[1];
    const d = DOLCI[r.title];
    if (d && uguali(th, d[0])) th = d[1];
    if (!uguali(th, r.themes)) store.update('ricette', r.id, { themes: th });
  });
  saveSettings({ ricetteCats: 2 });
}
export function after() { aggiornaEsempi(); }

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
  'ricette-theme': ({ el, ev }) => {
    ev.preventDefault();
    const t = el.dataset.theme;
    // Home e conto alla rovescia: solo i periodi che sono anche categorie aprono il filtro
    setUi('ricette.theme', t === 'preferite' || RICETTE_CATS[t] ? (ui('ricette.theme') === t && location.hash === '#/cibo/ricette' ? 'tutte' : t) : 'tutte');
    if (location.hash !== '#/cibo/ricette') navigate('#/cibo/ricette');
  },
  'ricette-q': ({ el }) => { programmaWeb(el.value); setUi('ricette.q', el.value); },
  'ricette-web-riprova': () => { const t = ui('ricette.q', ''); webCache.delete(norm(t)); programmaWeb(t); rerender(); },
  'ricetta-importa': async ({ el }) => {
    if (el.disabled) return;
    el.disabled = true;
    const prima = el.innerHTML;
    el.innerHTML = html`<span class="web-spin sm"></span> Preparo…`.s;
    try {
      const x = await store.call(`ricette?url=${encodeURIComponent(el.dataset.url)}`);
      const photo = x.immagine ? await ridimensiona(x.immagine) : '';
      recipeSheet(null, { title: x.titolo, ingredients: x.ingredienti || [], steps: x.passi || [], time: x.tempo, servings: x.porzioni, photo, fonte: x.fonte, themes: ['sempre'] });
    } catch (e) {
      toast(e && e.message ? e.message : 'Non riesco a importarla adesso');
    } finally { if (el.isConnected) { el.disabled = false; el.innerHTML = prima; } }
  },
  'ricetta-new': () => recipeSheet(),
  'ricetta-edit': ({ id }) => recipeSheet(state.data.ricette.find((r) => r.id === id)),
  'ricetta-fav': ({ id }) => { const r = state.data.ricette.find((x) => x.id === id); if (r) { vibrate(); store.update('ricette', id, { fav: !r.fav }); } },
  'ricetta-del': ({ id }) => {
    const r = state.data.ricette.find((x) => x.id === id);
    closeSheet();
    if (!r) return;
    confirmSheet({ title: `Eliminare “${r.title}”?`, text: 'La ricetta verrà tolta dal ricettario di casa.', onYes: () => { store.remove('ricette', id); navigate('#/cibo/ricette'); } });
  },
  'ricetta-random': () => {
    const theme = currentTheme();
    let pool = state.data.ricette;
    const themed = theme && RICETTE_CATS[theme.id] ? pool.filter((r) => ricetteCats(r).includes(theme.id)) : [];
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
