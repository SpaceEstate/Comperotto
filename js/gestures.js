// Gesti come nelle app dell'iPhone:
// - trascina giù un foglio per chiuderlo (anche su iPad)
// - scorri dal bordo sinistro per tornare indietro (app installata: in Safari lo fa già il sistema)
// - in cima alla pagina tira giù per aggiornare
// - scorri una riga: verso destra per spuntarla, verso sinistra per eliminarla
// - tocca la scheda già aperta in basso (o il titolo in alto) per tornare in cima
import { closeSheet, sheetOpen, holdRender } from './core.js';
import { vibrate, isStandalone } from './utils.js';
import { icon } from './icons.js';

const wideMq = matchMedia('(min-width: 700px) and (min-height: 560px)');
const EDGE = 26; // px dal bordo sinistro in cui parte il "torna indietro"
const SLOP = 8; // px prima di decidere la direzione
const PULL_MAX = 120;
const PULL_GO = 66;

let g = null; // gesto in corso
let opts = {};
let noClickUntil = 0;
let ptr = null;
let ptrBusy = false;

export function initGestures(o = {}) {
  opts = o;
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { passive: true });
  document.addEventListener('touchcancel', onEnd, { passive: true });
  // dopo uno scorrimento il dito si alza su un pulsante: quel tocco non conta
  document.addEventListener('click', (ev) => {
    if (Date.now() < noClickUntil) { ev.preventDefault(); ev.stopPropagation(); return; }
    toTop(ev);
  }, true);
  ptr = document.createElement('div');
  ptr.className = 'ptr';
  ptr.setAttribute('aria-hidden', 'true');
  ptr.innerHTML = icon('refresh').s;
  document.body.appendChild(ptr);
}

// ---------------------------------------------------------------------------
function onStart(ev) {
  if (g && g.kind) return; // un secondo dito durante un gesto: lo ignoro
  g = null;
  if (ev.touches.length !== 1) return;
  const t = ev.touches[0];
  const target = ev.target instanceof Element ? ev.target : ev.target.parentElement;
  if (!target) return;
  const c = {};
  if (sheetOpen()) {
    const sheet = target.closest('.sheet');
    if (sheet && !target.closest('input[type=range], .no-drag')) c.sheet = sheet;
  } else if (!target.closest('.sheet-layer, .map-card, .embed, iframe, .no-gesture')) {
    if (t.clientX <= EDGE && isStandalone()) { const b = backLink(); if (b) c.back = b; }
    const row = target.closest('[data-swipe-id]');
    if (row && !row.classList.contains('checking')) c.row = row;
    if (opts.refresh && !ptrBusy && window.scrollY <= 0) c.pull = true;
  }
  if (!c.sheet && !c.back && !c.row && !c.pull) return;
  g = { c, target, x0: t.clientX, y0: t.clientY, dx: 0, dy: 0, kind: null, hist: [[ev.timeStamp, t.clientX, t.clientY]] };
}

function onMove(ev) {
  if (!g) return;
  const t = ev.touches[0];
  if (!t) return;
  const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
  g.hist.push([ev.timeStamp, t.clientX, t.clientY]);
  if (g.hist.length > 6) g.hist.shift();
  if (!g.kind) {
    const { c } = g;
    // in cima e verso il basso non c'è niente da scorrere: blocco subito il rimbalzo
    const downAtTop = dy >= 0 && ((c.sheet && atTop(c.sheet, g.target)) || (c.pull && window.scrollY <= 0));
    if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) { if (downAtTop && ev.cancelable) ev.preventDefault(); return; }
    let kind = null;
    if (Math.abs(dx) > Math.abs(dy)) kind = c.back && dx > 0 ? 'back' : c.row ? 'row' : null;
    else if (dy > 0 && downAtTop) kind = c.sheet ? 'sheet' : 'pull';
    if (!kind) { g = null; return; }
    g.kind = kind;
    G[kind].start();
  }
  if (ev.cancelable) ev.preventDefault();
  G[g.kind].move(dx, dy);
}

function onEnd() {
  if (!g) return;
  const cur = g;
  g = null;
  if (!cur.kind) return;
  noClickUntil = Date.now() + 350;
  // velocità degli ultimi istanti (px/ms)
  const h = cur.hist, a = h[0], b = h[h.length - 1];
  const dt = Math.max(1, b[0] - a[0]);
  G[cur.kind].end(cur, (b[1] - a[1]) / dt, (b[2] - a[2]) / dt);
}

function atTop(sheet, target) {
  if (sheet.scrollTop > 0) return false;
  const ta = target.closest('textarea');
  return !(ta && ta.scrollTop > 0);
}

function backLink() {
  const a = document.querySelector('#view a.back-link, #view a[aria-label="Indietro"]');
  return a && a.offsetParent !== null ? a : null;
}

function bgOf(el) {
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return 'var(--bg)';
}

// ---------------------------------------------------------------------------
const G = {
  // ---- foglio: trascina giù per chiudere ----
  sheet: {
    start() {
      g.el = g.c.sheet;
      g.h = g.el.offsetHeight;
      g.wide = wideMq.matches;
      g.bd = document.querySelector('.sheet-backdrop');
      g.el.style.transition = 'none';
      g.bd.style.transition = 'none';
    },
    move(dx, dy) {
      const y = Math.max(0, dy);
      g.dy = y;
      g.el.style.transform = sheetAt(g.wide, y);
      g.bd.style.opacity = String(Math.max(0.15, 1 - y / (g.h * 1.2)));
    },
    end(s, vx, vy) {
      const el = s.el, bd = s.bd, y = s.dy || 0;
      bd.style.transition = '';
      bd.style.opacity = '';
      if (y > Math.min(150, s.h * 0.33) || (vy > 0.45 && y > 24)) {
        el.style.transition = `transform .26s cubic-bezier(.2,.8,.2,1)${s.wide ? ', opacity .2s ease' : ''}`;
        el.style.transform = sheetAt(s.wide, s.wide ? y + 140 : s.h + 40);
        if (s.wide) el.style.opacity = '0';
        if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
        closeSheet();
      } else {
        el.style.transition = '';
        el.style.transform = '';
      }
    },
  },

  // ---- bordo sinistro: torna indietro ----
  back: {
    start() {
      g.el = document.getElementById('view');
      g.w = window.innerWidth;
      g.href = g.c.back.getAttribute('href');
      g.el.style.transition = 'none';
      document.body.classList.add('swiping-back');
    },
    move(dx) {
      g.dx = Math.max(0, dx);
      g.el.style.transform = `translateX(${g.dx}px)`;
    },
    end(s, vx) {
      const el = s.el, x = s.dx || 0;
      const done = () => { el.style.transition = el.style.transform = el.style.opacity = ''; document.body.classList.remove('swiping-back'); };
      el.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
      if (x > s.w * 0.32 || (vx > 0.35 && x > 30)) {
        el.style.transform = `translateX(${s.w}px)`;
        vibrate(6);
        setTimeout(() => {
          // la pagina precedente arriva da sinistra, come nelle app di sistema
          el.style.transition = 'none';
          el.style.transform = 'translateX(-24%)';
          el.style.opacity = '.4';
          window.addEventListener('hashchange', () => requestAnimationFrame(() => requestAnimationFrame(() => {
            el.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1), opacity .22s ease';
            el.style.transform = '';
            el.style.opacity = '';
            setTimeout(done, 300);
          })), { once: true });
          document.documentElement.dataset.gesto = '1'; // niente dissolvenza: c'è già lo scorrimento
          location.hash = s.href;
        }, 210);
      } else {
        el.style.transform = '';
        setTimeout(done, 240);
      }
    },
  },

  // ---- in cima: tira giù per aggiornare ----
  pull: {
    start() {
      g.armed = false;
      ptr.style.transition = 'none';
      ptr.classList.remove('armed', 'busy');
    },
    move(dx, dy) {
      const p = Math.min(PULL_MAX, Math.max(0, dy) * 0.5);
      g.p = p;
      ptr.style.opacity = String(Math.min(1, p / 36));
      ptr.style.transform = `translateY(${p - 54}px) rotate(${p * 4}deg)`;
      const armed = p >= PULL_GO;
      if (armed !== g.armed) { g.armed = armed; ptr.classList.toggle('armed', armed); if (armed) vibrate(8); }
    },
    async end(s) {
      ptr.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1), opacity .2s ease';
      if (!s.armed) { hidePtr(); return; }
      ptrBusy = true;
      ptr.classList.add('busy');
      ptr.style.transform = 'translateY(14px)';
      const t0 = Date.now();
      try { await opts.refresh(); } catch {}
      setTimeout(() => { hidePtr(); ptrBusy = false; }, Math.max(0, 650 - (Date.now() - t0)));
    },
  },

  // ---- riga: destra = spunta, sinistra = elimina ----
  row: {
    start() {
      const row = g.c.row;
      g.el = row;
      g.r = row.dataset.swipeR || '';
      g.l = row.dataset.swipeL || '';
      g.w = row.offsetWidth;
      holdRender(true); // niente ridisegni a metà gesto
      const parent = row.parentElement;
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      const under = document.createElement('div');
      under.className = 'swipe-under';
      under.style.top = `${row.offsetTop}px`;
      under.style.height = `${row.offsetHeight}px`;
      under.innerHTML = `${g.r ? `<span class="sw-r">${icon('check').s}${esc(row.dataset.swipeRl || '')}</span>` : ''}${g.l ? `<span class="sw-l">${esc(row.dataset.swipeLl || '')}${icon(/-del$/.test(g.l) ? 'trash' : 'check').s}</span>` : ''}`;
      if (/-del$/.test(g.l)) under.classList.add('l-del');
      parent.insertBefore(under, row);
      g.under = under;
      row.classList.add('swiping');
      row.style.background = bgOf(parent);
      row.style.transition = 'none';
    },
    move(dx) {
      let x = dx;
      if ((x > 0 && !g.r) || (x < 0 && !g.l)) x *= 0.12; // da quel lato non c'è niente
      g.dx = x;
      g.el.style.transform = `translateX(${x}px)`;
      const side = x >= 0 ? 'r' : 'l';
      g.under.dataset.side = side;
      const armed = Boolean(g[side]) && Math.abs(x) > rowGo(g.w);
      if (armed !== g.armed) { g.armed = armed; g.under.classList.toggle('armed', armed); if (armed) vibrate(8); }
    },
    end(s, vx) {
      const row = s.el, x = s.dx || 0;
      const side = x >= 0 ? 'r' : 'l';
      const act = s[side];
      const fling = Math.abs(vx) > 0.6 && Math.abs(x) > 44 && Math.sign(vx) === Math.sign(x);
      const go = act && (Math.abs(x) > rowGo(s.w) || fling);
      const finish = () => {
        s.under.remove();
        row.classList.remove('swiping');
        row.style.transition = row.style.transform = row.style.background = '';
        holdRender(false);
      };
      if (go && /-del$/.test(act)) {
        // elimina: la riga esce di lato
        row.style.transition = 'transform .2s ease-in';
        row.style.transform = `translateX(${-s.w - 20}px)`;
        setTimeout(() => {
          finish();
          row.style.visibility = 'hidden';
          opts.run(act, { el: row, id: row.dataset.swipeId });
        }, 190);
        return;
      }
      row.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1)';
      row.style.transform = '';
      setTimeout(() => {
        finish();
        if (go) opts.run(act, { el: row.querySelector(`[data-action="${act}"]`) || row, id: row.dataset.swipeId });
      }, go ? 200 : 240);
    },
  },
};

const sheetAt = (wide, y) => (wide ? `translate(-50%, calc(-50% + ${y}px))` : `translateY(${y}px)`);
const rowGo = (w) => Math.min(110, w * 0.3);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function hidePtr() {
  ptr.classList.remove('armed', 'busy');
  ptr.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1), opacity .2s ease';
  ptr.style.transform = '';
  ptr.style.opacity = '';
}

// tocco sulla scheda già aperta (o sul titolo in alto): torna in cima
function toTop(ev) {
  const el = ev.target instanceof Element && ev.target.closest('a.tab.on, #topbar.show');
  if (!el || window.scrollY <= 0) return;
  if (el.matches('a.tab')) {
    const href = el.getAttribute('href') || '';
    const here = location.hash || '#/';
    if (!(here === href || (href !== '#/' && here.startsWith(`${href}/`)))) return;
  }
  ev.preventDefault();
  ev.stopPropagation();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}
