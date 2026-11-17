// Fam. Comperotto — avvio, navigazione, aggiornamento dello schermo
import { html, raw, todayIso, lsGet, lsSet } from './utils.js';
import { icon } from './icons.js';
import { COLLECTIONS, setErrorHandler, detectBackend, savedCode, useSync } from './store.js';
import { state, store, setRenderer, rerender, closeSheet, submitSheet, sheetOpen, sheetError, openSheet, toast, settings, saveSettings, me, setMe, val } from './core.js';
import { applySeason } from './season.js';
import { initGestures } from './gestures.js';
import { rinfresca as rinfrescaNotifiche, stato as statoNotifiche } from './notifiche.js';
import { sp as spotifyStato, eQui, avviaSpotify } from './spotify.js';
import * as home from './views/home.js';
import * as spesa from './views/spesa.js';
import * as casa from './views/casa.js';
import * as ricette from './views/ricette.js';
import * as film from './views/film.js';
import * as musica from './views/musica.js';
import * as desideri from './views/desideri.js';
import * as gatti from './views/gatti.js';
import * as dove from './views/dove.js';
import * as impostazioni from './views/impostazioni.js';
import * as login from './views/login.js';

const VIEWS = { '': home, casa, ricette, film, desideri, musica, gatti, dove, impostazioni };
const actions = {
  ...home.actions, ...spesa.actions, ...casa.actions, ...ricette.actions, ...film.actions,
  ...musica.actions, ...desideri.actions, ...gatti.actions, ...dove.actions, ...impostazioni.actions, ...login.actions,
};

// sul telefono: le 5 schede in basso; su iPad la barra laterale mostra anche Musica e Gatti
const TABS = [
  { key: '', label: 'Home', icon: 'home', href: '#/' },
  { key: 'casa', label: 'Casa', icon: 'basket', href: '#/casa', badge: () => spesa.badge() + casa.badge() },
  { key: 'ricette', label: 'Ricette', icon: 'chef', href: '#/ricette' },
  { key: 'film', label: 'Film', icon: 'film', href: '#/film' },
  { key: 'desideri', label: 'Desideri', icon: 'gift', href: '#/desideri' },
  { key: 'musica', label: 'Musica', icon: 'music', href: '#/musica', side: true },
  { key: 'dove', label: 'Dov’è', icon: 'pin', href: '#/dove', side: true },
  { key: 'gatti', label: 'Thor e Minù', icon: 'cat', href: '#/gatti', side: true },
];

// vecchi indirizzi (link salvati, scorciatoie) → nuovi
function alias(r) {
  if (r[0] === 'spesa') return ['casa', 'spesa'];
  if (r[0] === 'noi') return [r[1] || 'film', ...r.slice(2)];
  if (r[0] === 'casa' && r[1] === 'routine') return ['casa', 'faccende'];
  return r;
}
// iPad: barra laterale stretta (solo icone) o aperta; ogni dispositivo ricorda la sua scelta
const sideOpen = () => document.documentElement.dataset.side === 'aperta';
actions['side-toggle'] = () => {
  const v = sideOpen() ? 'stretta' : 'aperta';
  document.documentElement.dataset.side = v;
  lsSet('casa.side', v);
  rerender();
};

const route = () => alias((location.hash.replace(/^#\/?/, '') || '').split('/').map(decodeURIComponent));
const wideMq = matchMedia('(min-width: 700px) and (min-height: 560px)');
const wide = () => wideMq.matches;
wideMq.addEventListener?.('change', () => rerender());

// ---------------------------------------------------------------------------
// Aggiornamento del DOM "a differenza": cambia solo ciò che serve, così
// restano focus, animazioni e i lettori musicali già aperti.
// ---------------------------------------------------------------------------
function sameNode(a, b) {
  return a.nodeType === b.nodeType && a.nodeName === b.nodeName && (a.nodeType !== 1 || (a.id || '') === (b.id || ''));
}
function patch(from, to) {
  if (from.nodeType === 3 || from.nodeType === 8) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
  if (from.nodeType === 1 && from.hasAttribute('data-keep')) return; // la mappa gestisce da sola il suo riquadro
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  if (from.nodeName === 'IFRAME' || from.hasAttribute('data-keep')) return; // lettori e mappe restano come sono
  if (from.nodeName === 'INPUT' || from.nodeName === 'TEXTAREA' || from.nodeName === 'SELECT') {
    if (from.type === 'checkbox' || from.type === 'radio') from.checked = to.hasAttribute('checked');
    else if (document.activeElement !== from && !from._busy && from.type !== 'file' && from.nodeName !== 'SELECT') from.value = to.getAttribute('value') ?? to.value ?? '';
    if (from.nodeName === 'TEXTAREA') return;
  }
  morphChildren(from, to);
}
function morphChildren(fromParent, toParent) {
  let cur = fromParent.firstChild;
  for (const next of [...toParent.childNodes]) {
    if (cur && sameNode(cur, next)) { patch(cur, next); cur = cur.nextSibling; continue; }
    if (next.nodeType === 1 && next.id) {
      const match = [...fromParent.children].find((c) => c.id === next.id && c.nodeName === next.nodeName);
      if (match) { fromParent.insertBefore(match, cur); patch(match, next); continue; }
    }
    fromParent.insertBefore(next, cur);
  }
  while (cur) { const n = cur.nextSibling; fromParent.removeChild(cur); cur = n; }
}

let lastRoute = null;
function render() {
  const view = document.getElementById('view');
  const tabbar = document.getElementById('tabbar');
  const r = route();
  applySeason();

  if (state.needCode) {
    tabbar.hidden = true;
    disegnaMini('');
    if (!view.querySelector('.login')) { view.innerHTML = login.render(state.backend).s; lastRoute = null; }
    return;
  }
  if (!state.loaded.has('settings')) return;

  const mod = VIEWS[r[0]] || home;
  const key = r.join('/');
  const tpl = document.createElement('template');
  tpl.innerHTML = mod.render(r).s;
  if (key !== lastRoute) {
    view.replaceChildren(tpl.content);
    window.scrollTo(0, 0);
    lastRoute = key;
    const h = view.querySelector('h1');
    topbar.querySelector('span').textContent = r[0] && h ? h.textContent.replace(/\s+/g, ' ').trim() : 'Fam. Comperotto';
  } else {
    morphChildren(view, tpl.content);
  }
  if (mod.after) mod.after(r);

  tabbar.hidden = false;
  const tabsTpl = document.createElement('template');
  const cur = VIEWS[r[0]] ? r[0] : '';
  tabsTpl.innerHTML = html`<div class="tabbar-inner">
    <div class="side-head">
      <a class="side-brand" href="#/" aria-label="Fam. Comperotto"><span class="mini-logo"></span><span class="side-name">Fam. Comperotto</span></a>
      <button class="side-toggle" data-action="side-toggle" aria-label="${sideOpen() ? 'Stringi il menu' : 'Allarga il menu'}" aria-expanded="${sideOpen() ? 'true' : 'false'}">${icon('sidebar')}</button>
    </div>
    ${TABS.map((t) => {
      const n = t.badge ? t.badge() : 0;
      const on = t.key === cur || (t.key === '' && ['impostazioni', 'musica', 'gatti', 'dove'].includes(cur) && !wide());
      return html`<a class="tab ${on ? 'on' : ''} ${t.side ? 'side-only side-mid' : ''}" href="${t.href}" ${on ? raw('aria-current="page"') : ''}>
        <span class="tab-ico">${icon(t.icon)}</span><span class="tab-label">${t.label}</span>${n ? html`<span class="badge">${n > 99 ? '99+' : n}</span>` : ''}</a>`;
    })}
    <a class="tab side-only side-end ${cur === 'impostazioni' ? 'on' : ''}" href="#/impostazioni"><span class="tab-ico">${icon('sliders')}</span><span class="tab-label">Impostazioni</span></a>
  </div>`.s;
  if (tabbar.firstElementChild) morphChildren(tabbar, tabsTpl.content); else tabbar.replaceChildren(tabsTpl.content);
  disegnaMini(musica.mini(r));
}

// il mini lettore di Spotify, fuori dalla pagina: resta in basso cambiando pagina
const miniBox = document.getElementById('mini');
function disegnaMini(h) {
  const tpl = document.createElement('template');
  tpl.innerHTML = (h && h.s) || '';
  morphChildren(miniBox, tpl.content);
  document.documentElement.classList.toggle('con-mini', Boolean(miniBox.firstElementChild));
}
setRenderer(render);

// ---------------------------------------------------------------------------
// Eventi: un solo ascoltatore per tipo, smistato con data-action / data-form
// ---------------------------------------------------------------------------
function run(name, ctx) {
  const fn = actions[name];
  if (!fn) { console.warn('Azione sconosciuta', name); return; }
  try {
    const res = fn(ctx);
    if (res && res.catch) res.catch((e) => { console.error(e); toast('Qualcosa è andato storto'); });
  } catch (e) { console.error(e); toast('Qualcosa è andato storto'); }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'sheet-close') { ev.preventDefault(); closeSheet(); return; }
  ev.preventDefault();
  run(el.dataset.action, { el, ev, id: el.dataset.id });
});

document.addEventListener('submit', (ev) => {
  const form = ev.target;
  ev.preventDefault();
  if (form.id === 'sheet-form') { submitSheet(form); return; }
  if (form.dataset.form) run(form.dataset.form, { form, ev, el: form });
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change]');
  if (el) run(el.dataset.change, { el, ev, id: el.dataset.id });
});

let inputTimer;
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-input]');
  if (!el) return;
  clearTimeout(inputTimer);
  inputTimer = setTimeout(() => run(el.dataset.input, { el, ev }), 150);
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && sheetOpen()) closeSheet(); });

// la X delle caselle di ricerca: svuota, aggiorna subito i risultati e lascia il cursore lì per scrivere altro
actions['search-x'] = ({ el }) => {
  const input = document.getElementById(el.dataset.for);
  if (!input) return;
  clearTimeout(inputTimer);
  input.value = '';
  input.focus();
  if (input.dataset.input) run(input.dataset.input, { el: input });
  if (el.dataset.poi) run(el.dataset.poi, { el });
};

// gesti dell'iPhone: fogli da trascinare giù, indietro dal bordo, tira giù per aggiornare, righe da scorrere
initGestures({
  run,
  refresh: async () => {
    if (route()[0] === 'dove') { await dove.actions['dove-aggiorna'](); return; }
    if (route()[0] === 'musica') await musica.refresh();
    if (route()[0] === 'desideri') await desideri.refresh();
    if (store.mode === 'sync') await store.sync();
    rerender();
  },
});

// cambio pagina con una dissolvenza leggera (View Transitions, Safari 18+)
window.addEventListener('hashchange', () => {
  closeSheet();
  ricette.releaseWake();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gesto = document.documentElement.dataset.gesto;
  delete document.documentElement.dataset.gesto;
  if (document.startViewTransition && !reduce && !gesto && state.loaded.has('settings')) {
    const vt = document.startViewTransition(() => render());
    // se la dissolvenza viene interrotta (es. ruotando l'iPad) la pagina è comunque già quella nuova
    [vt.ready, vt.finished, vt.updateCallbackDone].forEach((x) => x && x.catch(() => {}));
  } else render();
});

// iPhone: titolo piccolo in alto quando si scorre (come le app di sistema)
const topbar = document.getElementById('topbar');
let topShown = false;
window.addEventListener('scroll', () => {
  const show = window.scrollY > 64 && !state.needCode;
  if (show !== topShown) { topShown = show; topbar.classList.toggle('show', show); }
}, { passive: true });

// iPhone/iPad: quando si apre la tastiera i fogli dal basso salgono sopra di lei
if (window.visualViewport) {
  const vv = window.visualViewport;
  const upd = () => {
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    document.documentElement.style.setProperty('--kb', `${kb > 60 ? kb : 0}px`);
  };
  vv.addEventListener('resize', upd);
  vv.addEventListener('scroll', upd);
}

// le scritte "da 5 min", "2 h fa" restano giuste anche se nel frattempo non cambia nulla
setInterval(() => { if (!document.hidden && !sheetOpen()) rerender(); }, 60000);

// aggiorna "oggi" se l'app resta aperta oltre la mezzanotte o torna in primo piano
let lastDay = todayIso();
document.addEventListener('visibilitychange', () => { if (!document.hidden && todayIso() !== lastDay) { lastDay = todayIso(); rerender(); } });
setInterval(() => { if (todayIso() !== lastDay) { lastDay = todayIso(); rerender(); } }, 60000);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applySeason());

setErrorHandler((e) => {
  console.error(e);
  const msg = (e && e.message) || 'Errore';
  toast(msg);
});

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------
let unsubs = [];
let seeding = false;

function subscribeAll() {
  unsubs.forEach((u) => u && u());
  state.loaded = new Set();
  unsubs = COLLECTIONS.map((c) => store.subscribe(c, (items, meta) => {
    state.data[c] = items;
    state.loaded.add(c);
    if (c === 'settings' && !meta.fromCache) maybeSeed(items);
    if (c === 'settings') maybeWelcome();
    rerender();
  }));
}

function maybeSeed(items) {
  if (seeding || items.some((d) => d.id === 'main')) return;
  seeding = true;
  impostazioni.seedAll();
}

let welcomed = false;
function maybeWelcome() {
  if (welcomed || me() || !state.data.settings.some((d) => d.id === 'main')) return;
  welcomed = true;
  const n = settings().names;
  const named = n.p1 && n.p1 !== 'Lui';
  const cap1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  setTimeout(() => {
    if (named) {
      // i nomi ci sono già (dall'altro telefono): basta sapere chi sei
      openSheet({
        title: 'Ciao! Chi sei?',
        body: html`<p class="prose" style="margin-top:-4px">Così biglietti, faccende e spesa portano la tua firma.</p>
          <div class="btn-row">${['p1', 'p2'].map((k) => html`<button class="btn ${k === 'p2' ? 'primary' : 'dark'}" type="button" data-action="welcome-me" data-v="${k}">${n[k]}</button>`)}</div>`,
      });
      return;
    }
    openSheet({
      title: 'Benvenuti a casa!',
      body: html`
        <p class="prose" style="margin-top:-4px">Due nomi e la casa è pronta (si cambiano quando volete in Impostazioni).</p>
        <label class="field"><span>Il tuo nome</span><input name="p1" placeholder="Come ti chiami?" required autofocus></label>
        <label class="field"><span>La tua dolce metà</span><input name="p2" value="${n.p2}" required></label>
        <p class="help" style="margin-top:-6px">Questo telefono sarà il tuo. Sul suo, al primo accesso, le chiederò solo chi è.</p>`,
      submit: 'Entriamo',
      onSubmit: (fd) => {
        const p1 = val(fd, 'p1'), p2 = val(fd, 'p2');
        if (!p1 || !p2) { sheetError('Scrivete entrambi i nomi'); return false; }
        saveSettings({ names: { p1: cap1(p1), p2: cap1(p2) } });
        setMe('p1');
        rerender();
      },
    });
  }, 400);
}
actions['welcome-me'] = ({ el }) => { setMe(el.dataset.v); closeSheet(); rerender(); toast(`Ciao ${settings().names[el.dataset.v]}!`); };

/** Avvia la sincronizzazione con il codice di famiglia (chiamata anche dalla schermata del codice). */
export function startSync(code) {
  const s = useSync(code);
  state.needCode = false;
  s.onAuthLost = () => {
    s.forget(true);
    unsubs.forEach((u) => u && u());
    unsubs = [];
    state.backend = { ...(state.backend || {}), claimed: true };
    state.needCode = true;
    closeSheet();
    render();
    toast('Il codice di famiglia è cambiato: inseriscilo di nuovo');
  };
  s.onChange = () => rerender();
  subscribeAll();
  s.start();
  render();
  setTimeout(rinfrescaNotifiche, 4000);
  // Spotify collegato: cosa suona adesso, per il mini lettore in basso
  setTimeout(avviaSpotify, 1500);
  // la Home propone le notifiche solo dove si possono davvero accendere
  setTimeout(() => statoNotifiche().then((s) => { state.ui['push.stato'] = s; rerender(); }).catch(() => {}), 1200);
}

async function boot() {
  impostazioni.applyTheme();
  applySeason();
  // Dispositivo già collegato: si parte subito dai dati salvati qui, senza aspettare la rete.
  // Il server lo sento in sottofondo (se il codice non va più bene se ne accorge il primo aggiornamento).
  const code = savedCode();
  if (code && lsGet('casa.sync.seen')) {
    state.backend = { app: 'comperotto', storage: true, claimed: true };
    startSync(code);
    detectBackend().then((info) => { if (info && info.storage) state.backend = info; });
    return;
  }
  const info = await detectBackend();
  state.backend = info;
  if (info && info.storage) {
    const code = savedCode();
    if (code) startSync(code);
    else { state.needCode = true; render(); }
    return;
  }
  // nessun database condiviso: i dati restano su questo dispositivo
  subscribeAll();
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || (location.hostname === '127.0.0.1' && location.search === '?sw'))) {
  const sw = navigator.serviceWorker;
  // Quando arriva una versione nuova dell'app la pagina si ricarica da sola (se non stai scrivendo qualcosa).
  const aveva = Boolean(sw.controller);
  let inAttesa = false;
  // non si ricarica mentre si scrive, con un foglio aperto o mentre Spotify suona dentro l'app (si fermerebbe la musica)
  const suonaQui = () => { const p = spotifyStato.player; return Boolean(p && p.is_playing && p.device && eQui(p.device.id)); };
  const occupato = () => sheetOpen() || suonaQui() || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
  const ricarica = () => { if (occupato()) inAttesa = true; else location.reload(); };
  sw.addEventListener('controllerchange', () => { if (aveva) ricarica(); });
  // tocco su una notifica con l'app già aperta: vado alla pagina giusta
  sw.addEventListener('message', (ev) => { if (ev.data && typeof ev.data.vai === 'string' && ev.data.vai.startsWith('#/')) location.hash = ev.data.vai; });
  let visto = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (inAttesa && !occupato()) { location.reload(); return; }
    // l'app sulla schermata Home resta aperta per giorni: ogni tanto chiedo se c'è una versione nuova
    if (Date.now() - visto > 30 * 60000) { visto = Date.now(); sw.getRegistration().then((r) => r && r.update()).catch(() => {}); }
  });
  window.addEventListener('load', () => sw.register('sw.js').catch(() => {}));
}

boot();
