// Home: buongiorno, gatti, cosa si butta stasera, faccende di oggi, atmosfera del periodo, lavagnetta
import { html, raw, longDate, todayIso, timeAgo, vibrate, cap, plural, isIOS, isStandalone, lsGet, lsSet } from '../utils.js';
import { icon } from '../icons.js';
import { THEMES, upcomingDates, CAT_EVENTS } from '../data.js';
import { state, store, settings, me, nameOf, myName, openSheet, toast, val, confirmSheet, rerender, ui, isSynced } from '../core.js';
import { dueChores, choreRow, trashFor, binChips } from './casa.js';
import { cats, catAvatar, upcomingFor, lastWeight } from './gatti.js';
import { seasonInfo, currentTheme, seasonDeco } from '../season.js';
import { badge as shopBadge } from './spesa.js';
import { statusOf, personBadge, pillOf, iconOf } from './dove.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Buonanotte';
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function catStatus(c) {
  const up = upcomingFor(c.id)[0];
  if (up && up.days <= 7) {
    const l = CAT_EVENTS[up.type] ? CAT_EVENTS[up.type].label : up.type;
    return up.days < 0 ? `${l} scaduto` : up.days === 0 ? `${l} oggi` : `${l} tra ${up.days} gg`;
  }
  const w = lastWeight(c.id);
  return w ? `${String(w.value).replace('.', ',')} kg di amore` : 'Tutto tranquillo';
}

function seasonCard(s) {
  const th = s.theme;
  const n = (col) => state.data[col].filter((x) => (x.themes || []).includes(th)).length;
  return html`<section class="season-card">
    <div class="sc-top">
      <span class="sc-ico">${icon(s.icon, 'lg')}</span>
      <div><b>${s.title}</b><span>${s.sub}</span></div>
    </div>
    <div class="sc-links">
      <a href="#/ricette" data-action="ricette-theme" data-theme="${th}">${icon('chef', 'sm')}<span>${n('ricette')}</span>Ricette</a>
      <a href="#/musica" data-action="musica-theme-go" data-v="${th}">${icon('music', 'sm')}<span>${n('musica')}</span>Musica</a>
      <a href="#/film" data-action="film-theme-go" data-v="${th}">${icon('film', 'sm')}<span>${n('film')}</span>Film</a>
    </div>
  </section>`;
}

function birthdayCard(b) {
  const isP2 = b.who === 'p2';
  const title = b.anniversary ? `Buon anniversario, ${b.name}!` : `Buon compleanno, ${b.name}!`;
  const sub = b.anniversary
    ? `${b.age ? `${b.age} ${b.age === 1 ? 'anno' : 'anni'} insieme ♡ ` : ''}Stasera si festeggia: cena romantica?`
    : b.cats
    ? `${b.age ? `${b.age} ${b.age === 1 ? 'anno' : 'anni'} di fusa. ` : ''}Oggi croccantini extra per tutti.`
    : isP2
      ? `${b.age ? `${b.age} anni! ` : ''}Joyeux anniversaire · ¡Feliz cumpleaños! ✦`
      : `${b.age ? `${b.age} anni! ` : ''}Tanti auguri da tutta la famiglia (gatti compresi).`;
  return html`<section class="bday-card">
    <div class="confetti" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => html`<i style="left:${(i * 29) % 100}%;animation-delay:-${(i * 0.7) % 4}s;background:${['#E7A3B5', '#F2C14E', '#5FB3C4', '#B57F45'][i % 4]}"></i>`)}</div>
    <span class="sc-ico">${icon(b.anniversary ? 'heart' : b.cats ? 'cat' : 'cake', 'lg')}</span>
    <div><b>${title}</b><span>${sub}</span></div>
  </section>`;
}

function installHint() {
  if (!isIOS() || isStandalone() || lsGet('casa.hint.install')) return '';
  return html`<div class="install-hint fade-in">
    <span class="dot-ico tone-oak">${icon('share')}</span>
    <div><b>Mettila nella schermata Home</b><span>Tocca ${icon('share', 'xs')} Condividi e poi «Aggiungi alla schermata Home»: si apre a tutto schermo, come un’app.</span></div>
    <button class="icon-btn ghost" data-action="hint-close" aria-label="Chiudi">${icon('x', 'sm')}</button>
  </div>`;
}

/** Le notifiche si possono accendere ma sono ancora spente: lo propongo una volta, con discrezione. */
function pushHint() {
  if (!isSynced() || ui('push.stato', null) !== 'spente' || lsGet('casa.hint.push')) return '';
  const altro = nameOf(me() === 'p1' ? 'p2' : 'p1');
  return html`<div class="install-hint fade-in">
    <span class="dot-ico tone-sky">${icon('bell')}</span>
    <div><b>Vuoi le notifiche?</b><span>Un avviso quando ${altro} arriva a casa e, la sera, cosa si butta.</span>
      <button class="mini-btn primary" data-action="push-on" style="margin-top:8px">Attiva</button></div>
    <button class="icon-btn ghost" data-action="hint-push-close" aria-label="Non ora">${icon('x', 'sm')}</button>
  </div>`;
}

function doveCard() {
  return html`<a class="card dove-home" href="#/dove">
    <div class="dh-head"><span class="dot-ico tone-sky">${icon('pin', 'sm')}</span><b>Dov’è</b>${icon('right', 'xs')}</div>
    ${['p1', 'p2'].map((k) => {
      const st = statusOf(k);
      return html`<div class="dh-row">${personBadge(k)}<span class="dh-name">${nameOf(k)}</span>
        ${st.p ? html`<span class="pill ${pillOf(st)}">${icon(iconOf(st), 'xs')} ${st.cls ? st.label : 'Posizione'}</span>
          <span class="dh-sub">${[st.since, st.place].filter(Boolean).join(' · ') || timeAgo(st.p.at)}</span>` : html`<span class="dh-sub">non ancora condivisa</span>`}
      </div>`;
    })}
  </a>`;
}

const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MO = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const niceDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d); return `${WD[dt.getDay()]} ${d} ${MO[m - 1]}`; };

/** Conto alla rovescia: più ricorrenze vicine, una accanto all'altra (es. Natale e il compleanno di Patrick). */
function countdowns(dates) {
  const upcoming = dates.filter((d) => d.days > 0 || (d.days === 0 && !d.personal));
  let list = upcoming.filter((d) => d.days <= 75);
  if (list.length < 2) list = upcoming.slice(0, 2);
  list = list.slice(0, 6);
  if (!list.length) return '';
  return html`<section class="cd-section">
    <div class="section-title"><span>Conto alla rovescia</span></div>
    <div class="cd-scroll">${list.map((d) => {
      const kind = d.cats ? 'gatti' : d.anniversary ? 'amore' : d.who ? 'festa' : d.theme;
      const go = !d.personal && THEMES[d.theme];
      return html`<a class="cd-tile cd-${kind}" href="${go ? '#/ricette' : '#/'}" ${go ? raw(`data-action="ricette-theme" data-theme="${d.theme}"`) : raw('data-action="noop"')}>
        <span class="cd-ico">${icon(d.cats ? 'paw' : d.icon || 'calendar')}</span>
        <span class="cd-big">${d.days === 0 ? 'Oggi!' : d.days}</span>
        ${d.days ? html`<span class="cd-unit">${d.days === 1 ? 'giorno' : 'giorni'}</span>` : ''}
        <b>${d.label.replace('Compleanno di ', 'Compleanno di\u00a0')}</b>
        <small>${niceDate(d.date)}${d.age ? ` · ${d.cats ? `${d.age} ${d.age === 1 ? 'anno' : 'anni'}` : d.anniversary ? `${d.age} anni insieme` : `${d.age} anni`}` : ''}</small>
      </a>`;
    })}</div>
  </section>`;
}

function ring(pct) {
  const r = 21, c = 2 * Math.PI * r;
  return html`<svg class="ring" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="${r}" class="ring-bg"/><circle cx="26" cy="26" r="${r}" class="ring-fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/></svg>`;
}

export function render() {
  const s = settings();
  const season = seasonInfo();
  const name = myName();
  const dates = upcomingDates(s, state.data.gatti);
  const bdays = dates.filter((d) => d.days === 0 && d.personal);
  const t = todayIso();
  const due = dueChores().filter((c) => c.lastDone !== t);
  const doneToday = state.data.routine.filter((c) => c.lastDone === t).length;
  const tonight = trashFor();
  const trashDone = s.rifiutiFatto && s.rifiutiFatto.date === t;
  const todayTotal = due.length + doneToday + (tonight.length ? 1 : 0);
  const todayDone = doneToday + (tonight.length && trashDone ? 1 : 0);
  const notes = [...state.data.bacheca].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  const lavori = state.data.lavori.filter((l) => !l.done);
  const wishes = state.data.desideri.filter((w) => !w.bought);
  const films = state.data.film.filter((f) => !f.watched);
  const shop = shopBadge();
  const theme = currentTheme();
  const songs = theme ? state.data.musica.filter((m) => (m.themes || []).includes(theme.id)).length : 0;

  return html`
    <div class="home-top">
      ${seasonDeco()}
      <header class="hello">
        <div>
          <p class="brand-line"><span class="mini-logo"></span>Fam. Comperotto</p>
          <p class="eyebrow">${longDate()}</p>
          <h1>${greeting()}${name ? html`,<br><em>${name}</em>` : ''}</h1>
        </div>
        <a class="icon-btn" href="#/impostazioni" aria-label="Impostazioni">${icon('sliders')}</a>
      </header>
    </div>

    <div class="stagger">
      ${installHint()}
      ${pushHint()}
      ${bdays.map(birthdayCard)}

      <div class="cats-strip">${cats().map((c) => html`
        <a class="cat-chip" href="#/gatti">${catAvatar(c)}<div><b>${c.name}</b><span>${catStatus(c)}</span></div></a>`)}</div>

      ${doveCard()}

      <div class="home-grid">
        <div class="home-col">
          ${season ? seasonCard(season) : ''}

          <section class="card today-card">
            <div class="today-head">
              <div class="ring-wrap">${ring(todayTotal ? todayDone / todayTotal : 1)}<span>${todayTotal ? `${todayDone}/${todayTotal}` : icon('check', 'sm')}</span></div>
              <div><h3>Oggi in casa</h3><p>${due.length ? `${due.length} ${due.length === 1 ? 'cosa da fare' : 'cose da fare'}` : 'Tutto fatto, bravissimi!'}</p></div>
              <a class="card-link" href="#/casa/faccende">Tutte ${icon('right', 'xs')}</a>
            </div>
            ${tonight.length ? html`<div class="today-trash">
              <span class="tt-label">${icon('bin', 'sm')} Stasera</span>
              <div class="trash-tonight">${binChips(tonight)}</div>
              <button class="done-btn ${trashDone ? 'fresh' : 'due'}" data-action="trash-done" aria-label="Spazzatura portata fuori">${icon('check', 'sm')}${trashDone ? '' : ' Fatto'}</button>
            </div>` : ''}
            ${due.length ? html`<div>${due.slice(0, 4).map((c) => choreRow(c, { compact: true }))}</div>
              ${due.length > 4 ? html`<a class="today-more" href="#/casa/faccende">e altre ${due.length - 4}</a>` : ''}` : ''}
          </section>

          ${countdowns(dates)}
        </div>

        <div class="home-col">
          <div class="hero-tiles">
            <a class="tile t-oak" href="#/casa/spesa"><span class="tile-ico">${icon('basket')}</span><span class="tile-num">${shop}</span><span class="tile-label">${shop === 1 ? 'Cosa da comprare' : 'Da comprare'}</span><span class="tile-mark">${icon('basket')}</span></a>
            <a class="tile t-sage" href="#/casa/lavori"><span class="tile-ico">${icon('hammer')}</span><span class="tile-num">${lavori.length}</span><span class="tile-label">Lavori</span><span class="tile-mark">${icon('hammer')}</span></a>
            <a class="tile t-sky" href="#/film"><span class="tile-ico">${icon('film')}</span><span class="tile-num">${films.length}</span><span class="tile-label">Film da vedere</span><span class="tile-mark">${icon('film')}</span></a>
            <a class="tile t-rose" href="#/desideri"><span class="tile-ico">${icon('gift')}</span><span class="tile-num">${wishes.length}</span><span class="tile-label">Desideri</span><span class="tile-mark">${icon('gift')}</span></a>
            <a class="tile t-plum" href="#/musica"><span class="tile-ico">${icon('music')}</span><span class="tile-num">${songs || state.data.musica.length}</span><span class="tile-label">${songs ? `Musica di ${theme.label}` : 'Musica'}</span><span class="tile-mark">${icon('music')}</span></a>
            <button class="tile t-gold" data-action="ricetta-random"><span class="tile-ico">${icon('dice')}</span><span class="tile-num tile-q">?</span><span class="tile-label">Cosa cuciniamo?</span><span class="tile-mark">${icon('chef')}</span></button>
          </div>

          <div>
            <div class="section-title"><span>Lavagnetta</span></div>
            <div class="notes">
              ${notes.map((n) => html`<button class="note c-${['oak', 'sage', 'sky', 'rose'].includes(n.color) ? n.color : 'oak'}" data-action="note-open" data-id="${n.id}">
                <span>${n.text}</span><small>${nameOf(n.by) || ''}${n.createdAt ? ` · ${timeAgo(n.createdAt)}` : ''}</small></button>`)}
              <button class="note note-add" data-action="note-new">${icon('plus', 'sm')} Scrivi un biglietto</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function noteSheet() {
  openSheet({
    title: 'Un biglietto per casa',
    body: html`
      <label class="field"><span>Messaggio</span><textarea name="text" maxlength="200" placeholder="es. Ho comprato il gelato, è nel freezer ♡" required autofocus style="min-height:90px"></textarea></label>
      <div class="field"><span>Colore</span><div class="radio-chips">${[['oak', 'Miele'], ['sage', 'Salvia'], ['sky', 'Cielo'], ['rose', 'Rosa']].map(([v, l], i) => html`
        <label><input type="radio" name="color" value="${v}" ${i === 0 ? raw('checked') : ''}><span><i class="note c-${v}" style="width:14px;height:14px;min-height:0;padding:0;border-radius:4px;transform:none"></i>${l}</span></label>`)}</div></div>`,
    submit: 'Attacca',
    onSubmit: (fd) => {
      const text = cap(val(fd, 'text'));
      if (!text) return false;
      store.add('bacheca', { text, color: val(fd, 'color') || 'oak', by: me() || '' });
      vibrate(10);
    },
  });
}

export const actions = {
  noop: () => {},
  'musica-theme-go': ({ el }) => { state.ui['musica.theme'] = el.dataset.v; location.hash = '#/musica'; },
  'film-theme-go': ({ el }) => { state.ui['film.theme'] = el.dataset.v; state.ui['film.filter'] = 'tutti'; location.hash = '#/film'; },
  'hint-close': () => { lsSet('casa.hint.install', '1'); rerender(); },
  'hint-push-close': () => { lsSet('casa.hint.push', '1'); rerender(); },
  'note-new': () => noteSheet(),
  'note-open': ({ id }) => {
    const n = state.data.bacheca.find((x) => x.id === id);
    if (!n) return;
    confirmSheet({
      title: 'Staccare il biglietto?', text: `“${n.text}”`, yes: 'Stacca',
      onYes: () => { store.remove('bacheca', id); toast('Biglietto staccato', { undo: () => { const { id: _, ...rest } = n; store.set('bacheca', id, rest); } }); },
    });
  },
};
