// Impostazioni: chi sei, aspetto, famiglia (nomi, compleanni, ricorrenze), copia dei dati
import { html, raw, cap, lsGet, lsSet, uid, parseDMY, fmtDMY, timeAgo } from '../utils.js';
import { icon } from '../icons.js';
import { SEASONS } from '../data.js';
import { state, store, isSynced, settings, saveSettings, me, setMe, nameOf, openSheet, closeSheet, sheetError, toast, val, pageHead, rerender, confirmSheet } from '../core.js';
import { seasonOverride, setSeasonOverride } from '../season.js';
import { seedData } from '../seed.js';
import * as notifiche from '../notifiche.js';
import { ui, setUi } from '../core.js';

export const VERSION = '2.0.0';

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
  const other = n[me() === 'p1' ? 'p2' : 'p1'];
  return html`
    <a class="back-link phone-only" href="#/">${icon('left', 'sm')} Home</a>
    ${pageHead('Impostazioni')}

    <div class="section-title"><span>Tu</span></div>
    <div class="card">
      <div class="field" style="margin-bottom:0"><span>Chi usa questo telefono?</span>
        <div class="radio-chips">${['p1', 'p2'].map((k) => html`<label><input type="radio" name="me" value="${k}" data-change="set-me" ${me() === k ? raw('checked') : ''}><span>${n[k]}</span></label>`)}</div>
      </div>
    </div>

    <div class="section-title"><span>Aspetto</span></div>
    <div class="card">
      <div class="field"><span>Chiaro o scuro</span><div class="radio-chips">
        ${[['auto', 'auto', 'Automatico'], ['light', 'sun', 'Chiaro'], ['dark', 'moon', 'Scuro']].map(([v, ic, l]) => html`<label><input type="radio" name="theme" value="${v}" data-change="set-theme" ${tm === v ? raw('checked') : ''}><span>${icon(ic, 'xs')} ${l}</span></label>`)}
      </div></div>
      <div class="field" style="margin-bottom:0"><span>Atmosfera</span><div class="radio-chips">
        <label><input type="radio" name="season" value="auto" data-change="set-season" ${ov === 'auto' ? raw('checked') : ''}><span>${icon('calendar', 'xs')} Segue il calendario</span></label>
        <label><input type="radio" name="season" value="casa" data-change="set-season" ${ov === 'casa' ? raw('checked') : ''}><span>${icon('home', 'xs')} Casa</span></label>
        ${Object.entries(SEASONS).map(([k, v]) => html`<label><input type="radio" name="season" value="${k}" data-change="set-season" ${ov === k ? raw('checked') : ''}><span>${icon(v.icon, 'xs')} ${v.label}</span></label>`)}
      </div></div>
    </div>

    ${notificheCard()}

    <div class="section-title"><span>Famiglia</span></div>
    <div class="list">
      <button class="set-row" data-action="set-names">${icon('users')}<div class="row-main"><b>${n.p1} e ${n.p2}</b><span>${[s.compleanni && s.compleanni.p1 ? `${n.p1} ${fmtDMY(s.compleanni.p1)}` : '', s.compleanni && s.compleanni.p2 ? `${n.p2} ${fmtDMY(s.compleanni.p2)}` : '', s.anniversario ? `insieme dal ${fmtDMY(s.anniversario)}` : ''].filter(Boolean).join(' · ') || 'Nomi e compleanni'}</span></div>${icon('right', 'sm')}</button>
      <button class="set-row" data-action="set-dates">${icon('calendar')}<div class="row-main"><b>Ricorrenze</b><span>${ric.length ? ric.map((r) => `${r.label} (${fmtDMY(r.date)})`).join(', ') : 'Compleanni di amici e parenti…'}</span></div>${icon('right', 'sm')}</button>
      <a class="set-row" href="#/gatti">${icon('cat')}<div class="row-main"><b>Thor e Minù</b><span>Foto, peso, vaccini</span></div>${icon('right', 'sm')}</a>
      <a class="set-row" href="#/casa/rifiuti">${icon('bin')}<div class="row-main"><b>Calendario rifiuti</b><span>I giorni della raccolta</span></div>${icon('right', 'sm')}</a>
      ${isSynced() ? html`<button class="set-row" data-action="share-app">${icon('share')}<div class="row-main"><b>Invia l’app a ${other}</b><span>Il link per installarla sul suo telefono</span></div>${icon('right', 'sm')}</button>` : ''}
      <button class="set-row" data-action="export">${icon('download')}<div class="row-main"><b>Scarica una copia</b><span>Tutti i dati di casa in un file</span></div></button>
    </div>

    <p class="muted small" style="text-align:center;margin-top:28px">Fatta con amore per ${n.p1}, ${n.p2}, Thor e Minù</p>
    ${isSynced() ? html`<button class="card-link" data-action="logout" style="margin:6px auto 0;display:block;color:var(--text-3);font-weight:500">Esci da questo dispositivo</button>` : ''}`;
}

// ---------------------------------------------------------------------------
// Notifiche di questo dispositivo
// ---------------------------------------------------------------------------
function notificheCard() {
  const st = ui('push.stato', null);
  if (!isSynced() || !st || st === 'no') return '';
  const p = notifiche.prefs();
  const corpo = st === 'accese'
    ? html`<div class="list">
        ${notifiche.TIPI.map(([k, titolo, cosa]) => html`<label class="set-row"><div class="row-main"><b>${titolo}</b><span>${cosa}</span></div>
          <input class="sw" type="checkbox" data-change="push-tipo" data-tipo="${k}" ${p[k] ? raw('checked') : ''} aria-label="${titolo}"></label>`)}
      </div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn" data-action="push-prova">${icon('bell', 'sm')} Prova</button>
        <button class="btn" data-action="push-off">Disattiva</button>
      </div>`
    : html`<div class="card">
        <p class="prose" style="margin:0 0 ${st === 'spente' ? '12px' : '0'}">${st === 'installa'
          ? html`Per riceverle apri l’app dalla schermata Home: in Safari tocca ${icon('share', 'xs')} Condividi e poi «Aggiungi alla schermata Home».`
          : st === 'bloccate'
            ? 'Su questo dispositivo sono bloccate. Per riaccenderle: Impostazioni dell’iPhone → Notifiche → Comperotto.'
            : 'Un avviso quando l’altro arriva a casa o esce dal lavoro, la sera per la spazzatura, per i biglietti nuovi e per compleanni e richiami dei gatti.'}</p>
        ${st === 'spente' ? html`<button class="btn primary block" data-action="push-on" ${ui('push.busy', false) ? raw('disabled') : ''}>${icon('bell', 'sm')} Attiva le notifiche</button>` : ''}
      </div>`;
  return html`<div class="section-title"><span>Notifiche</span></div>${corpo}`;
}

let chiesto = false;
/** Dopo il disegno della pagina: guardo com'è messo questo dispositivo con le notifiche (una volta). */
export function after() {
  if (chiesto || !isSynced()) return;
  chiesto = true;
  notifiche.stato().then((s) => setUi('push.stato', s));
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
      <label class="field"><span>Insieme dal</span><input name="ann" inputmode="numeric" placeholder="gg/mm/aaaa" value="${fmtDMY(s.anniversario)}"></label>
      <p class="help" style="margin-top:-6px">Basta giorno e mese (es. 29/04); con l’anno la Home dice anche quanti anni fate (o da quanti anni state insieme).</p>`,
    onSubmit: (fd) => {
      const p1 = cap(val(fd, 'p1')), p2 = cap(val(fd, 'p2'));
      const b1 = parseDMY(val(fd, 'b1')), b2 = parseDMY(val(fd, 'b2')), ann = parseDMY(val(fd, 'ann'));
      if (!p1 || !p2) { sheetError('Servono entrambi i nomi'); return false; }
      if (b1 === null || b2 === null || ann === null) { sheetError('Scrivi le date come 29/04 oppure 29/04/1997'); return false; }
      saveSettings({ names: { p1, p2 }, compleanni: { p1: b1, p2: b2 }, anniversario: ann });
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
      <label class="field"><span>Cosa</span><input name="label" placeholder="es. Compleanno della mamma"></label>
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
  'set-me': ({ el }) => { setMe(el.value); rerender(); toast(`Ciao ${nameOf(el.value)}!`); notifiche.rinfresca(true); },
  'push-on': async () => {
    if (ui('push.busy', false)) return;
    setUi('push.busy', true);
    try {
      const s = await notifiche.accendi();
      setUi('push.stato', s);
      if (s === 'accese') toast('Notifiche attive su questo dispositivo');
    } catch (e) {
      toast(e && /scegli chi/.test(e.message) ? e.message : 'Non sono riuscito ad attivarle: riprova tra poco', { ms: 5000 });
    } finally { setUi('push.busy', false); }
  },
  'push-off': async () => {
    try { await notifiche.spegni(); } catch {}
    setUi('push.stato', await notifiche.stato());
    toast('Notifiche disattivate su questo dispositivo');
  },
  'push-tipo': async ({ el }) => {
    try { await notifiche.scegli(el.dataset.tipo, el.checked); } catch { toast('Non riesco a salvarlo adesso, riprova'); }
  },
  'push-prova': async () => {
    try { toast((await notifiche.prova()) ? 'Mandata: arriva tra qualche secondo' : 'Non è partita: disattiva e riattiva le notifiche', { ms: 4500 }); } catch { toast('Non è partita: controlla la connessione'); }
  },
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
  logout: () => confirmSheet({
    title: 'Uscire da questo dispositivo?', text: 'Tutto resta salvato per gli altri. Per rientrare servirà il codice di famiglia.', yes: 'Esci',
    onYes: () => { store.forget(); location.hash = '#/'; location.reload(); },
  }),
  'share-app': async () => {
    const url = location.origin + location.pathname;
    const text = 'La nostra app di casa ♡ Aprila con Safari, poi Condividi → Aggiungi alla schermata Home. Il codice di famiglia te lo dico io.';
    try {
      if (navigator.share) await navigator.share({ title: 'Fam. Comperotto', text, url });
      else { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link copiato'); }
    } catch {}
  },
  export: () => {
    const dump = { app: 'fam-comperotto', version: VERSION, at: new Date().toISOString(), data: state.data };
    download(`fam-comperotto-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dump, null, 2));
  },
};
