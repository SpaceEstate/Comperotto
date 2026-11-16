// Impostazioni: chi sei, nomi, compleanni, atmosfera, sincronizzazione, Alexa, film, backup
import { html, raw, cap, lsGet, lsSet, uid, parseDMY, fmtDMY } from '../utils.js';
import { icon } from '../icons.js';
import { SEASONS } from '../data.js';
import { ALEXA_INVOCATION, HOUSE_ID } from '../config.js';
import { COLLECTIONS } from '../store.js';
import { state, store, isCloud, settings, saveSettings, me, setMe, nameOf, openSheet, closeSheet, sheetError, toast, val, pageHead, rerender, confirmSheet } from '../core.js';
import { seasonOverride, setSeasonOverride } from '../season.js';
import { seedData } from '../seed.js';

export const VERSION = '1.1.0';

const themeMode = () => lsGet('casa.theme', 'auto');
export function applyTheme() {
  const t = themeMode();
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

export function render() {
  const s = settings();
  const n = s.names;
  const ov = seasonOverride();
  const tm = themeMode();
  const ric = s.ricorrenze || [];
  return html`
    <a class="back-link" href="#/">${icon('left', 'sm')} Home</a>
    ${pageHead('Impostazioni')}

    <div class="section-title"><span>Su questo telefono</span></div>
    <div class="card">
      <div class="field" style="margin-bottom:4px"><span>Chi sei?</span>
        <div class="radio-chips">${['p1', 'p2'].map((k) => html`<label><input type="radio" name="me" value="${k}" data-change="set-me" ${me() === k ? raw('checked') : ''}><span>${n[k]}</span></label>`)}</div>
        <p class="help">Serve per firmare biglietti, faccende fatte e cose aggiunte alla spesa.</p>
      </div>
    </div>
    <div class="card">
      <div class="field"><span>Chiaro o scuro</span><div class="radio-chips">
        ${[['auto', 'auto', 'Automatico'], ['light', 'sun', 'Chiaro'], ['dark', 'moon', 'Scuro']].map(([v, ic, l]) => html`<label><input type="radio" name="theme" value="${v}" data-change="set-theme" ${tm === v ? raw('checked') : ''}><span>${icon(ic, 'xs')} ${l}</span></label>`)}
      </div></div>
      <div class="field" style="margin-bottom:4px"><span>Atmosfera</span><div class="radio-chips">
        <label><input type="radio" name="season" value="auto" data-change="set-season" ${ov === 'auto' ? raw('checked') : ''}><span>Segue il calendario</span></label>
        <label><input type="radio" name="season" value="casa" data-change="set-season" ${ov === 'casa' ? raw('checked') : ''}><span>${icon('home', 'xs')} Casa</span></label>
        ${Object.entries(SEASONS).map(([k, v]) => html`<label><input type="radio" name="season" value="${k}" data-change="set-season" ${ov === k ? raw('checked') : ''}><span>${icon(v.icon, 'xs')} ${v.label}</span></label>`)}
      </div>
      <p class="help">In automatico: ottobre Halloween, aprile Parigi e Canarie (il mese di ${n.p2}), dal 20 novembre al 6 gennaio Natale, luglio e agosto mare.</p></div>
    </div>

    <div class="section-title"><span>Casa</span></div>
    <div class="list">
      <button class="set-row" data-action="set-names">${icon('users')}<div class="row-main"><b>${n.p1} e ${n.p2}</b><span>${s.compleanni && (s.compleanni.p1 || s.compleanni.p2) ? `Compleanni: ${[['p1', n.p1], ['p2', n.p2]].filter(([k]) => s.compleanni[k]).map(([k, x]) => `${x} ${fmtDMY(s.compleanni[k])}`).join(' · ')}` : 'Nomi e compleanni'}</span></div>${icon('right', 'sm')}</button>
      <button class="set-row" data-action="set-dates">${icon('calendar')}<div class="row-main"><b>Ricorrenze</b><span>${ric.length ? ric.map((r) => `${r.label} (${fmtDMY(r.date)})`).join(', ') : 'Anniversario, compleanni di amici e parenti…'}</span></div>${icon('right', 'sm')}</button>
      <a class="set-row" href="#/casa/rifiuti">${icon('bin')}<div class="row-main"><b>Calendario rifiuti</b><span>I giorni della raccolta</span></div>${icon('right', 'sm')}</a>
    </div>

    <div class="section-title"><span>Sincronizzazione</span></div>
    <div class="card">
      ${isCloud ? html`
        <p style="margin:0 0 4px;display:flex;align-items:center;gap:8px"><span class="status-dot on"></span><b>Condivisa tra i vostri telefoni</b></p>
        <p class="muted small" style="margin:0 0 12px">Accesso come ${state.user ? state.user.email : '…'} · casa “${HOUSE_ID}”</p>
        <button class="btn block" data-action="logout">${icon('logout', 'sm')} Esci</button>`
      : html`
        <p style="margin:0 0 4px;display:flex;align-items:center;gap:8px"><span class="status-dot"></span><b>Solo su questo telefono</b></p>
        <div class="prose small"><p>Per vedere le stesse liste sui vostri due telefoni (e aggiungere cose con Alexa) collegate un database Firebase gratuito: le istruzioni passo passo sono nel file <b>README.md</b> del progetto, sezione “Sincronizzare i due telefoni”. Ci vogliono circa 10 minuti.</p></div>`}
    </div>

    <div class="section-title"><span>Alexa</span></div>
    <div class="card prose">
      <p>Dal 2024 Amazon non permette più alle app esterne di leggere la lista della spesa di Alexa. Per questo la casa ha una sua <b>skill Alexa</b> (istruzioni nel README, cartella <span class="code">alexa-skill</span>). Una volta attiva:</p>
      <p>«Alexa, chiedi a ${ALEXA_INVOCATION} di aggiungere il latte»<br>«Alexa, chiedi a ${ALEXA_INVOCATION} cosa c’è da comprare»<br>«Alexa, chiedi a ${ALEXA_INVOCATION} cosa si butta stasera»<br>«Alexa, chiedi a ${ALEXA_INVOCATION} cosa c’è da fare oggi»</p>
      <p class="small muted" style="margin:0">Trucco: se Alexa mette la cosa nella sua lista invece che nella vostra, dite prima «Alexa, apri ${ALEXA_INVOCATION}» e poi «aggiungi il latte».</p>
    </div>

    <div class="section-title"><span>Film</span></div>
    <div class="card">
      <form data-form="tmdb-save">
        <label class="field"><span>Chiave API di TMDB</span><input name="key" value="${s.tmdbKey || ''}" placeholder="Incolla qui la chiave" autocomplete="off" spellcheck="false"></label>
        <p class="help" style="margin-top:-8px">Gratuita su themoviedb.org → Impostazioni → API. Serve per locandine e per sapere <b>dove vedere</b> ogni film (Netflix, Prime, Disney+…), sempre aggiornato.</p>
        <button class="btn block" type="submit">${icon('check', 'sm')} Salva chiave</button>
      </form>
    </div>

    <div class="section-title"><span>Backup</span></div>
    <div class="list">
      <button class="set-row" data-action="export">${icon('download')}<div class="row-main"><b>Scarica un backup</b><span>Un file con tutti i dati di casa</span></div></button>
      <label class="set-row" style="cursor:pointer">${icon('upload')}<div class="row-main"><b>Ripristina da backup</b><span>Aggiunge i dati del file a quelli attuali</span></div><input type="file" accept="application/json,.json" hidden data-change="import"></label>
      <button class="set-row" data-action="reseed">${icon('sparkles')}<div class="row-main"><b>Ricarica gli esempi</b><span>Ricette, film, musica e faccende di partenza</span></div></button>
      <button class="set-row" data-action="wipe" style="color:var(--rose)">${icon('trash')}<div class="row-main"><b>Cancella tutto</b><span>Svuota la casa (per entrambi)</span></div></button>
    </div>

    <p class="muted small" style="text-align:center;margin-top:26px">Fam. Comperotto · v${VERSION}<br>Fatta con amore per ${n.p1}, ${n.p2}, Thor e Minù</p>`;
}

function namesSheet() {
  const s = settings();
  const c = s.compleanni || {};
  openSheet({
    title: 'Noi due',
    body: html`
      <div class="field-row">
        <label class="field"><span>Nome</span><input name="p1" value="${s.names.p1}" required></label>
        <label class="field"><span>Compleanno</span><input name="b1" inputmode="numeric" placeholder="gg/mm/aaaa" value="${fmtDMY(c.p1)}"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>Nome</span><input name="p2" value="${s.names.p2}" required></label>
        <label class="field"><span>Compleanno</span><input name="b2" inputmode="numeric" placeholder="gg/mm/aaaa" value="${fmtDMY(c.p2)}"></label>
      </div>
      <p class="help" style="margin-top:-6px">Basta giorno e mese (es. 29/04); con l’anno il giorno del compleanno la Home dice anche quanti anni. Le date restano nel vostro database, non nel codice pubblico.</p>`,
    onSubmit: (fd) => {
      const p1 = cap(val(fd, 'p1')), p2 = cap(val(fd, 'p2'));
      const b1 = parseDMY(val(fd, 'b1')), b2 = parseDMY(val(fd, 'b2'));
      if (!p1 || !p2) { sheetError('Servono entrambi i nomi'); return false; }
      if (b1 === null || b2 === null) { sheetError('Scrivi le date come 29/04 oppure 29/04/1997'); return false; }
      saveSettings({ names: { p1, p2 }, compleanni: { p1: b1, p2: b2 } });
    },
  });
}

function datesSheet() {
  const s = settings();
  const ric = s.ricorrenze || [];
  openSheet({
    title: 'Ricorrenze',
    body: html`
      ${ric.length ? html`<div class="list" style="margin-bottom:14px">${ric.map((r) => html`
        <div class="row"><span class="row-main"><span class="row-title">${r.label}</span><span class="row-sub">${fmtDMY(r.date)}</span></span>
          <button class="icon-btn ghost" type="button" data-action="date-del" data-id="${r.id}" aria-label="Elimina ${r.label}">${icon('trash', 'sm')}</button></div>`)}</div>` : ''}
      <label class="field"><span>Cosa</span><input name="label" placeholder="es. Il nostro anniversario"></label>
      <label class="field"><span>Quando</span><input name="date" inputmode="numeric" placeholder="gg/mm"></label>`,
    submit: 'Aggiungi',
    onSubmit: (fd) => {
      const label = cap(val(fd, 'label')), date = parseDMY(val(fd, 'date'));
      if (!label || !date) { sheetError('Scrivi cosa e quando (es. 14/02)'); return false; }
      saveSettings({ ricorrenze: [...ric, { id: uid(), label, date: date.slice(-5) }] });
    },
  });
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function seedAll() {
  const data = seedData();
  Object.entries(data).forEach(([col, items]) => {
    items.forEach((it) => {
      if (it.id) { const { id, ...rest } = it; store.set(col, id, rest); }
      else store.add(col, it);
    });
  });
}

export const actions = {
  'set-me': ({ el }) => { setMe(el.value); rerender(); toast(`Ciao ${nameOf(el.value)}!`); },
  'set-theme': ({ el }) => {
    lsSet('casa.theme', el.value === 'auto' ? null : el.value);
    applyTheme();
    setSeasonOverride(seasonOverride());
    rerender();
  },
  'set-season': ({ el }) => { setSeasonOverride(el.value); rerender(); },
  'set-names': () => namesSheet(),
  'set-dates': () => datesSheet(),
  'date-del': ({ id }) => {
    const ric = (settings().ricorrenze || []).filter((r) => r.id !== id);
    saveSettings({ ricorrenze: ric });
    closeSheet();
  },
  'tmdb-save': ({ form }) => {
    saveSettings({ tmdbKey: form.key.value.trim() });
    toast(form.key.value.trim() ? 'Chiave salvata: ora i film si aggiornano da soli' : 'Chiave rimossa');
  },
  logout: async () => { await store.logout(); location.hash = '#/'; },
  export: () => {
    const dump = { app: 'casa-comperotto', version: VERSION, at: new Date().toISOString(), data: state.data };
    download(`casa-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dump, null, 2));
  },
  import: async ({ el }) => {
    const f = el.files && el.files[0];
    if (!f) return;
    try {
      const dump = JSON.parse(await f.text());
      if (!dump || !dump.data) throw new Error();
      let count = 0;
      COLLECTIONS.forEach((c) => (dump.data[c] || []).forEach((it) => {
        if (!it || typeof it !== 'object' || !it.id) return;
        const { id, ...rest } = it;
        store.set(c, String(id), rest);
        count++;
      }));
      toast(`Ripristinati ${count} elementi`);
    } catch { toast('File di backup non valido'); }
    el.value = '';
  },
  reseed: () => confirmSheet({
    title: 'Ricaricare gli esempi?', text: 'Aggiunge di nuovo ricette, film, musica, faccende e lavori di esempio (i vostri dati restano).', yes: 'Ricarica',
    onYes: () => {
      const data = seedData();
      ['ricette', 'musica', 'film', 'routine', 'lavori', 'desideri'].forEach((col) => data[col].forEach((it) => store.add(col, it)));
      toast('Esempi aggiunti');
    },
  }),
  wipe: () => confirmSheet({
    title: 'Cancellare tutto?', text: 'Spariscono spesa, ricette, faccende, film… per entrambi. Conviene scaricare prima un backup.', yes: 'Cancella tutto',
    onYes: async () => {
      const { id: _, ...keep } = settings();
      await store.wipe();
      store.set('settings', 'main', { ...keep, ricorrenze: [], seeded: true });
      toast('Casa svuotata');
    },
  }),
};
