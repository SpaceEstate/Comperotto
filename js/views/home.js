// Home: buongiorno; dov'è Patrick e Serena; oggi in casa (faccende e rifiuti di stasera); lavori; le liste
// per la valigia; Thor e Minù; l'atmosfera del periodo e il conto alla rovescia.
import { html, raw, longDate, todayIso, timeAgo, isIOS, isStandalone, lsGet, lsSet } from '../utils.js';
import { icon } from '../icons.js';
import { upcomingDates, CAT_EVENTS, MUSICA_TEMA, FILM_CATS, filmCats, RICETTE_CATS, ricetteCats } from '../data.js';
import { state, settings, me, nameOf, myName, rerender, ui, isSynced } from '../core.js';
import { dueChores, choreRow, trashFor, binChips, lavoroRow, lavoriAperti } from './casa.js';
import { cats, catAvatar, upcomingFor, lastWeight } from './gatti.js';
import { seasonInfo, seasonDeco } from '../season.js';
import { statusOf, personBadge, pillOf, iconOf, macchina, autoBadge, durata, trovaIndirizzo } from './dove.js';
import { sezioneHome as viaggiHome } from './viaggi.js';

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
  // ricette e film hanno le loro categorie: nei periodi senza una categoria (es. aprile) conto tutte le ricette
  // e i film da vedere, e il tocco apre la pagina senza filtro
  const nRicette = RICETTE_CATS[th] ? state.data.ricette.filter((r) => ricetteCats(r).includes(th)).length : state.data.ricette.length;
  const nFilm = FILM_CATS[th] ? state.data.film.filter((f) => filmCats(f).includes(th)).length : state.data.film.filter((f) => !f.watched).length;
  return html`<section class="season-card">
    <div class="sc-top">
      <span class="sc-ico">${icon(s.icon, 'lg')}</span>
      <div><b>${s.title}</b><span>${s.sub}</span></div>
    </div>
    <div class="sc-links">
      <a href="#/cibo/ricette" data-action="ricette-theme" data-theme="${RICETTE_CATS[th] ? th : 'tutte'}">${icon('chef', 'sm')}<span>${nRicette}</span>Ricette</a>
      <a href="#/svago/musica">${icon('music', 'sm')}<span>${(MUSICA_TEMA[th] || { brani: [] }).brani.length}</span>Musica</a>
      <a href="#/svago/film" data-action="film-theme-go" data-v="${FILM_CATS[th] ? th : 'tutti'}">${icon('film', 'sm')}<span>${nFilm}</span>Film</a>
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
  // l'auto (se è stata segnata con il comando rapido «Ho parcheggiato»): toccandola, la mappa parte da lei
  const a = macchina();
  return html`<section class="card dove-home ${a ? 'con-auto' : ''}">
    <a class="dh-link" href="#/dove">
      <div class="dh-head"><span class="dot-ico tone-sky">${icon('pin', 'sm')}</span><b>Dov’è</b>${icon('right', 'xs')}</div>
      ${['p1', 'p2'].map((k) => {
        const st = statusOf(k);
        return html`<div class="dh-row">${personBadge(k)}<span class="dh-name">${nameOf(k)}</span>
          ${st.p ? html`<span class="pill ${pillOf(st)}">${icon(st.old ? 'clock' : iconOf(st), 'xs')} ${st.cls || st.old ? st.label : 'Posizione'}</span>
            <span class="dh-sub ${st.old ? 'old' : ''}">${st.old ? timeAgo(st.p.at) : [st.since, st.place].filter(Boolean).join(' · ') || timeAgo(st.p.at)}</span>` : html`<span class="dh-sub">non ancora condivisa</span>`}
        </div>`;
      })}
    </a>
    ${a ? html`<a class="dh-link dh-auto" href="#/dove/auto"><div class="dh-row">${autoBadge('sm')}<span class="dh-name">Auto</span>
      <span class="pill soon">${icon('parking', 'xs')} ${durata(a.at)}</span>
      <span class="dh-sub">${a.place || 'Segnata sulla mappa'}</span></div></a>` : ''}
  </section>`;
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
      const go = !d.personal && RICETTE_CATS[d.theme === 'capodanno' ? 'natale' : d.theme];
      return html`<a class="cd-tile cd-${kind}" href="${go ? '#/cibo/ricette' : '#/'}" ${go ? raw(`data-action="ricette-theme" data-theme="${d.theme === 'capodanno' ? 'natale' : d.theme}"`) : raw('data-action="noop"')}>
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

/** I lavori da fare: i primi tre (con la spunta), il resto in Casa. */
function lavoriCard() {
  const aperti = lavoriAperti();
  return html`<section class="card today-card lavori-home">
    <div class="today-head">
      <span class="dot-ico tone-sage lh-ico">${icon('hammer', 'sm')}</span>
      <div><h3>Lavori</h3><p>${aperti.length ? `${aperti.length} da fare` : 'Niente in sospeso'}</p></div>
      <a class="card-link" href="#/casa/lavori">Tutti ${icon('right', 'xs')}</a>
    </div>
    ${aperti.length ? html`<div class="lh-righe">${aperti.slice(0, 3).map((l) => lavoroRow(l, { compact: true }))}</div>
      ${aperti.length > 3 ? html`<a class="today-more" href="#/casa/lavori">e altri ${aperti.length - 3}</a>` : ''}` : ''}
  </section>`;
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

      ${doveCard()}

      <div class="home-grid">
        <div class="home-col">
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

          ${lavoriCard()}
          ${viaggiHome()}
        </div>

        <div class="home-col">
          <div class="cats-strip">${cats().map((c) => html`
            <a class="cat-chip" href="#/gatti">${catAvatar(c)}<div><b>${c.name}</b><span>${catStatus(c)}</span></div></a>`)}</div>
          ${season ? seasonCard(season) : ''}
          ${countdowns(dates)}
        </div>
      </div>
    </div>
  `;
}

/** Dopo il disegno: se all'auto manca l'indirizzo (non è arrivato in tempo al comando rapido), lo cerco. */
export function after() {
  trovaIndirizzo();
}

export const actions = {
  noop: () => {},
  'film-theme-go': ({ el }) => { state.ui['film.theme'] = FILM_CATS[el.dataset.v] ? el.dataset.v : 'tutti'; state.ui['film.filter'] = FILM_CATS[el.dataset.v] ? 'tutti' : 'davedere'; state.ui['film.tipo'] = ''; location.hash = '#/svago/film'; },
  'hint-close': () => { lsSet('casa.hint.install', '1'); rerender(); },
  'hint-push-close': () => { lsSet('casa.hint.push', '1'); rerender(); },
};
