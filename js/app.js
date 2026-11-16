// Fam. Comperotto — avvio, navigazione, aggiornamento dello schermo
import { html, raw, todayIso } from './utils.js';
import { icon } from './icons.js';
import { COLLECTIONS, setErrorHandler } from './store.js';
import { state, store, isCloud, setRenderer, rerender, closeSheet, submitSheet, sheetOpen, sheetError, openSheet, toast, settings, saveSettings, me, setMe, val } from './core.js';
import { applySeason } from './season.js';
import * as home from './views/home.js';
import * as spesa from './views/spesa.js';
import * as casa from './views/casa.js';
import * as ricette from './views/ricette.js';
import * as noi from './views/noi.js';
import * as impostazioni from './views/impostazioni.js';
import * as login from './views/login.js';

const VIEWS = { '': home, spesa, casa, ricette, noi, impostazioni };
const actions = { ...home.actions, ...spesa.actions, ...casa.actions, ...ricette.actions, ...noi.actions, ...impostazioni.actions, ...login.actions };

const TABS = [
  { key: '', label: 'Home', icon: 'home', href: '#/' },
  { key: 'spesa', label: 'Spesa', icon: 'basket', href: '#/spesa', badge: () => spesa.badge() },
  { key: 'casa', label: 'Casa', icon: 'checks', href: '#/casa', badge: () => casa.badge() },
  { key: 'ricette', label: 'Ricette', icon: 'chef', href: '#/ricette' },
  { key: 'noi', label: 'Noi', icon: 'heart', href: '#/noi' },
];

const route = () => (location.hash.replace(/^#\/?/, '') || '').split('/').map(decodeURIComponent);
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
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  if (from.nodeName === 'IFRAME') return;
  if (from.nodeName === 'INPUT' || from.nodeName === 'TEXTAREA' || from.nodeName === 'SELECT') {
    if (from.type === 'checkbox' || from.type === 'radio') from.checked = to.hasAttribute('checked');
    else if (document.activeElement !== from && from.type !== 'file' && from.nodeName !== 'SELECT') from.value = to.getAttribute('value') ?? to.value ?? '';
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

  if (isCloud && !state.user) {
    tabbar.hidden = true;
    if (state.authReady && !view.querySelector('.login')) view.innerHTML = login.render().s;
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
  } else {
    morphChildren(view, tpl.content);
  }
  if (mod.after) mod.after(r);

  tabbar.hidden = false;
  const tabsTpl = document.createElement('template');
  const cur = VIEWS[r[0]] ? r[0] : '';
  tabsTpl.innerHTML = html`<div class="tabbar-inner">
    <a class="side-brand" href="#/"><span class="mini-logo"></span><span>Fam. Comperotto</span></a>
    ${TABS.map((t) => {
      const n = t.badge ? t.badge() : 0;
      const on = t.key === cur || (t.key === '' && cur === 'impostazioni' && !wide());
      return html`<a class="tab ${on ? 'on' : ''}" href="${t.href}" ${on ? raw('aria-current="page"') : ''}>
        <span class="tab-ico">${icon(t.icon)}</span><span class="tab-label">${t.label}</span>${n ? html`<span class="badge">${n > 99 ? '99+' : n}</span>` : ''}</a>`;
    })}
    <a class="tab side-only ${cur === 'impostazioni' ? 'on' : ''}" href="#/impostazioni"><span class="tab-ico">${icon('sliders')}</span><span class="tab-label">Impostazioni</span></a>
  </div>`.s;
  if (tabbar.firstElementChild) morphChildren(tabbar, tabsTpl.content); else tabbar.replaceChildren(tabsTpl.content);
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

window.addEventListener('hashchange', () => { closeSheet(); ricette.releaseWake(); render(); });

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

// aggiorna "oggi" se l'app resta aperta oltre la mezzanotte o torna in primo piano
let lastDay = todayIso();
document.addEventListener('visibilitychange', () => { if (!document.hidden && todayIso() !== lastDay) { lastDay = todayIso(); rerender(); } });
setInterval(() => { if (todayIso() !== lastDay) { lastDay = todayIso(); rerender(); } }, 60000);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applySeason());

setErrorHandler((e) => {
  console.error(e);
  const msg = e && e.code === 'permission-denied' ? 'Permesso negato: controlla le regole di Firebase' : (e && e.message) || 'Errore';
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

async function boot() {
  impostazioni.applyTheme();
  applySeason();
  if (isCloud) {
    try { await store.init(); }
    catch (e) {
      console.error(e);
      document.getElementById('view').innerHTML = html`<div class="empty"><p><b>Non riesco a collegarmi a Firebase</b></p><p class="small">Controlla la connessione o la configurazione in js/config.js.</p></div>`.s;
      return;
    }
    store.onAuth((user) => {
      state.user = user;
      state.authReady = true;
      if (user) subscribeAll();
      else { unsubs.forEach((u) => u && u()); unsubs = []; lastRoute = null; }
      render();
    });
  } else {
    state.user = { email: 'locale' };
    subscribeAll();
  }
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

boot();
