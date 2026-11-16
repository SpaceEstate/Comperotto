// Home: buongiorno, gatti, cosa si butta stasera, faccende di oggi, atmosfera del periodo, lavagnetta
import { html, raw, longDate, todayIso, timeAgo, vibrate, cap, plural, isIOS, isStandalone, lsGet, lsSet } from '../utils.js';
import { icon } from '../icons.js';
import { THEMES, upcomingDates, CAT_EVENTS } from '../data.js';
import { state, store, settings, me, nameOf, myName, openSheet, toast, val, confirmSheet, rerender } from '../core.js';
import { dueChores, choreRow, trashFor, binChips } from './casa.js';
import { cats, catAvatar, upcomingFor, lastWeight } from './gatti.js';
import { seasonInfo, currentTheme, seasonDeco } from '../season.js';
import { badge as shopBadge } from './spesa.js';

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
      <a href="#/noi/musica">${icon('music', 'sm')}<span>${n('musica')}</span>Musica</a>
      <a href="#/noi/film">${icon('film', 'sm')}<span>${n('film')}</span>Film</a>
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

export function render() {
  const s = settings();
  const season = seasonInfo();
  const name = myName();
  const dates = upcomingDates(s, state.data.gatti);
  const bdays = dates.filter((d) => d.days === 0 && d.personal);
  const next = dates.find((d) => d.days > 0 || (d.days === 0 && !d.personal));
  const due = dueChores().filter((c) => c.lastDone !== todayIso());
  const tonight = trashFor();
  const trashDone = s.rifiutiFatto && s.rifiutiFatto.date === todayIso();
  const notes = [...state.data.bacheca].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  const lavori = state.data.lavori.filter((l) => !l.done);
  const wishes = state.data.desideri.filter((w) => !w.bought);
  const films = state.data.film.filter((f) => !f.watched);
  const theme = currentTheme();
  const shop = shopBadge();

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

    ${installHint()}
    ${bdays.map(birthdayCard)}

    <div class="cats-strip">${cats().map((c) => html`
      <a class="cat-chip" href="#/noi/gatti">${catAvatar(c)}<div><b>${c.name}</b><span>${catStatus(c)}</span></div></a>`)}</div>

    <div class="home-grid">
      <div class="home-col">
        ${season ? seasonCard(season) : next ? html`
          <a class="countdown" href="${THEMES[next.theme] && next.theme !== 'compleanni' ? '#/ricette' : '#/'}" ${THEMES[next.theme] && next.theme !== 'compleanni' ? raw(`data-action="ricette-theme" data-theme="${next.theme}"`) : ''}>
            <div class="cd-card">
              <div class="cd-num">${next.days}<small>${next.days === 1 ? 'giorno' : 'giorni'}</small></div>
              <div class="cd-text"><span>${next.days === 1 ? 'Domani è' : next.days <= 10 ? 'Manca poco a' : 'Conto alla rovescia per'}</span><b>${next.label}</b>
                <span>${theme && theme.id === next.theme ? 'Tocca per le ricette a tema' : ''}</span></div>
            </div>
          </a>` : ''}

        ${tonight.length ? html`<div class="card">
          <div class="card-head">
            <h3 class="card-title"><span class="dot-ico tone-taupe">${icon('bin', 'sm')}</span>Stasera si butta</h3>
            <button class="done-btn ${trashDone ? 'fresh' : 'due'}" data-action="trash-done">${icon('check', 'sm')} ${trashDone ? `Fatto${s.rifiutiFatto.by ? ` · ${nameOf(s.rifiutiFatto.by)}` : ''}` : 'Fatto'}</button>
          </div>
          <div class="trash-tonight">${binChips(tonight)}</div>
        </div>` : ''}

        <div class="card" style="padding:6px 0 4px">
          <div class="card-head" style="padding:10px 16px 0">
            <h3 class="card-title"><span class="dot-ico tone-oak">${icon('repeat', 'sm')}</span>Oggi in casa</h3>
            <a class="card-link" href="#/casa/routine">Tutte ${icon('right', 'xs')}</a>
          </div>
          ${due.length ? html`<div>${due.slice(0, 5).map((c) => choreRow(c, { compact: true }))}</div>
            ${due.length > 5 ? html`<p class="muted small" style="margin:4px 16px 10px">e altre ${due.length - 5}…</p>` : ''}`
            : html`<p class="muted small" style="margin:6px 16px 12px">Niente in scadenza oggi. Divano?</p>`}
        </div>
      </div>

      <div class="home-col">
        <div class="hero-tiles">
          <a class="tile tone-oak" href="#/spesa"><div class="tile-top"><span class="tile-ico">${icon('basket')}</span><span class="tile-num">${shop}</span></div><span class="tile-label">${shop === 1 ? 'Cosa da comprare' : 'Cose da comprare'}</span></a>
          <a class="tile tone-sage" href="#/casa/lavori"><div class="tile-top"><span class="tile-ico">${icon('hammer')}</span><span class="tile-num">${lavori.length}</span></div><span class="tile-label">Lavori in sospeso</span></a>
          <a class="tile tone-rose" href="#/noi/desideri"><div class="tile-top"><span class="tile-ico">${icon('gift')}</span><span class="tile-num">${wishes.length}</span></div><span class="tile-label">Desideri</span></a>
          <a class="tile tone-sky" href="#/noi/film"><div class="tile-top"><span class="tile-ico">${icon('film')}</span><span class="tile-num">${films.length}</span></div><span class="tile-label">Film da vedere</span></a>
        </div>

        <div>
          <div class="section-title"><span>Lavagnetta</span></div>
          <div class="notes">
            ${notes.map((n) => html`<button class="note c-${['oak', 'sage', 'sky', 'rose'].includes(n.color) ? n.color : 'oak'}" data-action="note-open" data-id="${n.id}">
              <span>${n.text}</span><small>${nameOf(n.by) || ''}${n.createdAt ? ` · ${timeAgo(n.createdAt)}` : ''}</small></button>`)}
            <button class="note note-add" data-action="note-new">${icon('plus', 'sm')} Scrivi un biglietto</button>
          </div>
        </div>

        ${dates.length ? html`<div><div class="section-title"><span>Prossime ricorrenze</span></div>
          <div class="next-dates">${dates.filter((d) => d.days > 0).slice(0, 6).map((d) => html`<span>${d.label} · ${plural(d.days, 'giorno', 'giorni')}</span>`)}</div></div>` : ''}
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
  'hint-close': () => { lsSet('casa.hint.install', '1'); rerender(); },
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
