// Stato condiviso dell'app + componenti di interfaccia (fogli, avvisi).
import { COLLECTIONS, store } from './store.js';
import { DEFAULT_SETTINGS } from './data.js';
import { html, raw, lsGet, lsSet, initial } from './utils.js';
import { icon } from './icons.js';

export { store };
export const isSynced = () => store.mode === 'sync';

export const state = {
  data: Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
  loaded: new Set(),
  user: null,
  ui: {},
};

export const ui = (key, def) => (key in state.ui ? state.ui[key] : def);
export const setUi = (key, val) => { state.ui[key] = val; rerender(); };

export function settings() {
  const s = state.data.settings.find((d) => d.id === 'main') || {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    names: { ...DEFAULT_SETTINGS.names, ...(s.names || {}) },
    rifiuti: { ...DEFAULT_SETTINGS.rifiuti, ...(s.rifiuti || {}) },
  };
}
export const saveSettings = (patch) => store.update('settings', 'main', patch);

// Chi sta usando questo telefono: 'p1' o 'p2'
export const me = () => lsGet('casa.me');
export const setMe = (v) => lsSet('casa.me', v);
export const nameOf = (k) => {
  const n = settings().names;
  if (k === 'p1' || k === 'p2') return n[k];
  if (k === 'both') return 'Insieme';
  return '';
};
export const myName = () => nameOf(me()) || '';

export function whoBadge(k) {
  if (!k) return '';
  if (k === 'both') return html`<span class="who both" title="Insieme">${icon('heart', 'xs')}</span>`;
  return html`<span class="who ${k}" title="${nameOf(k)}">${initial(nameOf(k))}</span>`;
}

export function whoChoices(name, value, { allowNone = true } = {}) {
  const n = settings().names;
  const opts = [['p1', n.p1], ['p2', n.p2], ['both', 'Insieme']];
  if (allowNone) opts.push(['', 'Chiunque']);
  return html`<div class="radio-chips">${opts.map(([v, l]) => html`<label><input type="radio" name="${name}" value="${v}" ${v === (value || '') ? raw('checked') : ''}><span>${l}</span></label>`)}</div>`;
}

// ---------------------------------------------------------------------------
// Render & navigazione
// ---------------------------------------------------------------------------
let _rerender = () => {};
let scheduled = false;
let held = false, missed = false;
export const setRenderer = (fn) => { _rerender = fn; };
export function rerender() {
  if (held) { missed = true; return; }
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; if (held) missed = true; else _rerender(); });
}
/** Mentre un dito trascina una riga non ridisegno: lo faccio appena finisce il gesto. */
export function holdRender(on) {
  held = on;
  if (!on && missed) { missed = false; rerender(); }
}

/** Riga da scorrere col dito: right/left = [azione, etichetta], es. ['spesa-toggle', 'Preso'] */
export const swipe = (id, right, left) => html` data-swipe-id="${id}"${right ? html` data-swipe-r="${right[0]}" data-swipe-rl="${right[1]}"` : ''}${left ? html` data-swipe-l="${left[0]}" data-swipe-ll="${left[1]}"` : ''}`;
export const navigate = (hash) => { if (location.hash === hash) rerender(); else location.hash = hash; };

// ---------------------------------------------------------------------------
// Foglio dal basso (modale)
// ---------------------------------------------------------------------------
const layer = () => document.getElementById('sheet-layer');
let current = null;

/**
 * openSheet({ title, body, submit, onSubmit(fd, form) → false per tenerlo aperto, extra, onOpen(root) })
 */
let tornaA = null; // chi aveva il focus prima del foglio (ci si torna alla chiusura)
export function openSheet(opts) {
  if (!current) tornaA = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  current = opts;
  const content = document.getElementById('sheet-content');
  const body = html`
    <div class="sheet-head">
      <h2 id="sheet-title">${opts.title || ''}</h2>
      <button class="icon-btn ghost" data-action="sheet-close" aria-label="Chiudi">${icon('x')}</button>
    </div>
    ${opts.onSubmit
      ? html`<form id="sheet-form" novalidate autocomplete="off">
          ${opts.body}
          <div class="form-error" id="sheet-error" hidden></div>
          <div class="btn-row">
            ${opts.extra || ''}
            <button class="btn primary" type="submit">${opts.submit || 'Salva'}</button>
          </div>
        </form>`
      : opts.body}`;
  content.innerHTML = body.s;
  const l = layer();
  // se l'ultimo foglio è stato chiuso trascinandolo, riparte dalla posizione normale
  const sh = l.querySelector('.sheet');
  sh.style.transform = sh.style.transition = sh.style.opacity = '';
  l.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => l.classList.add('open')));
  if (opts.onOpen) opts.onOpen(content);
  const first = content.querySelector('[autofocus]');
  if (first && matchMedia('(hover: hover)').matches) first.focus();
  else if (first) setTimeout(() => first.focus(), 320);
}

export function closeSheet() {
  const l = layer();
  if (!current && l.hidden) return;
  current = null;
  l.classList.remove('open');
  document.body.style.overflow = '';
  const prima = tornaA;
  tornaA = null;
  setTimeout(() => {
    if (current) return;
    l.hidden = true;
    document.getElementById('sheet-content').innerHTML = '';
    // con tastiera e lettori di schermo il focus torna al pulsante che aveva aperto il foglio
    if (prima && prima.isConnected && matchMedia('(hover: hover)').matches) { try { prima.focus({ preventScroll: true }); } catch {} }
  }, 300);
}

export const sheetOpen = () => Boolean(current);

export function sheetError(msg) {
  const el = document.getElementById('sheet-error');
  if (!el) return;
  el.textContent = msg;
  el.hidden = !msg;
}

export async function submitSheet(form) {
  if (!current || !current.onSubmit) return;
  const res = await current.onSubmit(new FormData(form), form);
  if (res !== false) closeSheet();
}

export function confirmSheet({ title = 'Sei sicuro?', text = '', yes = 'Elimina', onYes }) {
  openSheet({
    title,
    body: html`<p class="prose">${text}</p>
      <div class="btn-row">
        <button class="btn" type="button" data-action="sheet-close">Annulla</button>
        <button class="btn primary" type="button" id="confirm-yes">${yes}</button>
      </div>`,
    onOpen: (root) => root.querySelector('#confirm-yes').addEventListener('click', () => { closeSheet(); onYes(); }),
  });
}

// ---------------------------------------------------------------------------
// Avvisi (toast) con "Annulla"
// ---------------------------------------------------------------------------
export function toast(msg, { undo, ms = 3200 } = {}) {
  const host = document.getElementById('toast-layer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html`<span>${msg}</span>${undo ? html`<button type="button">Annulla</button>` : ''}`.s;
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  if (undo) el.querySelector('button').addEventListener('click', () => { undo(); kill(); });
  host.appendChild(el);
  while (host.children.length > 2) host.firstChild.remove();
  setTimeout(kill, ms);
}

// ---------------------------------------------------------------------------
// Utilità per i form
// ---------------------------------------------------------------------------
export const val = (fd, k) => String(fd.get(k) ?? '').trim();
export const lines = (s) => String(s || '').split(/\r?\n/).map((x) => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim()).filter(Boolean);

export function themeChoices(name, selected = [], themes) {
  return html`<div class="radio-chips">${Object.entries(themes).map(([id, t]) => html`
    <label><input type="checkbox" name="${name}" value="${id}" ${selected.includes(id) ? raw('checked') : ''}><span>${icon(t.icon, 'xs')} ${t.short || t.label}</span></label>`)}</div>`;
}

export function pageHead(title, { eyebrow = '', actions = '' } = {}) {
  return html`<header class="page-head">
    <div>${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${title}</h1></div>
    ${actions ? html`<div class="head-actions">${actions}</div>` : ''}
  </header>`;
}

/**
 * La X in fondo a una casella di ricerca: cancella tutto con un tocco e rimette il cursore lì.
 * Si vede solo quando c'è scritto qualcosa (CSS); "poi" = azione da fare dopo (es. chiudere i risultati).
 */
export function cancella(id, poi = '') {
  return html`<button type="button" class="search-x" data-action="search-x" data-for="${id}" ${poi ? raw(`data-poi="${poi}"`) : ''} aria-label="Cancella la ricerca">${icon('x', 'sm')}</button>`;
}

export function emptyState(title, text, art = '') {
  return html`<div class="empty fade-in">${art}<p><b>${title}</b></p>${text ? html`<p class="small">${text}</p>` : ''}</div>`;
}
