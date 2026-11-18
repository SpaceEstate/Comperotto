// Impostazioni: chi sei, aspetto, famiglia (nomi, compleanni, ricorrenze), copia dei dati
import { html, raw, cap, norm, lsGet, lsSet, uid, parseDMY, fmtDMY, timeAgo, isIPad } from '../utils.js';
import { icon } from '../icons.js';
import { SEASONS, CATEGORIE, ICONE_CATEGORIE, EMOJI_REPARTI, elencoCategorie, confCategorie, idCategoria, coloreReparto, conCategoria } from '../data.js';
import { state, store, isSynced, settings, saveSettings, me, setMe, nameOf, openSheet, closeSheet, sheetError, toast, val, pageHead, rerender, confirmSheet } from '../core.js';
import { seasonOverride, setSeasonOverride } from '../season.js';
import { seedData } from '../seed.js';
import * as notifiche from '../notifiche.js';
import { renderRifiuti } from './casa.js';
import { ui, setUi } from '../core.js';
import { VERSIONE } from '../config.js';
import { tipoDispositivo } from '../store.js';
import { batteria } from './dove.js';

export const VERSION = VERSIONE;

const themeMode = () => lsGet('casa.theme', 'auto');
export function applyTheme() {
  const t = themeMode();
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

export function render(route = []) {
  if (route[1] === 'categorie') return categoriePage(route[2]);
  if (route[1] === 'rifiuti') {
    return html`<a class="back-link" href="#/impostazioni">${icon('left', 'sm')} Impostazioni</a>
      ${pageHead('Rifiuti', { eyebrow: 'Il calendario della raccolta' })}
      ${renderRifiuti()}`;
  }
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

    ${collegamentoCard()}

    <div class="section-title"><span>Famiglia</span></div>
    <div class="list">
      <button class="set-row" data-action="set-names">${icon('users')}<div class="row-main"><b>${n.p1} e ${n.p2}</b><span>${[s.compleanni && s.compleanni.p1 ? `${n.p1} ${fmtDMY(s.compleanni.p1)}` : '', s.compleanni && s.compleanni.p2 ? `${n.p2} ${fmtDMY(s.compleanni.p2)}` : '', s.anniversario ? `insieme dal ${fmtDMY(s.anniversario)}` : ''].filter(Boolean).join(' · ') || 'Nomi e compleanni'}</span></div>${icon('right', 'sm')}</button>
      <button class="set-row" data-action="set-dates">${icon('calendar')}<div class="row-main"><b>Ricorrenze</b><span>${ric.length ? ric.map((r) => `${r.label} (${fmtDMY(r.date)})`).join(', ') : 'Compleanni di amici e parenti…'}</span></div>${icon('right', 'sm')}</button>
      <a class="set-row" href="#/gatti">${icon('cat')}<div class="row-main"><b>Thor e Minù</b><span>Foto, peso, vaccini</span></div>${icon('right', 'sm')}</a>
      <a class="set-row" href="#/impostazioni/rifiuti">${icon('bin')}<div class="row-main"><b>Calendario rifiuti</b><span>I giorni della raccolta</span></div>${icon('right', 'sm')}</a>
      <a class="set-row" href="#/impostazioni/categorie">${icon('filtri')}<div class="row-main"><b>Filtri e categorie</b><span>Film, ricette e reparti della spesa</span></div>${icon('right', 'sm')}</a>
      ${isSynced() ? html`<button class="set-row" data-action="share-app">${icon('share')}<div class="row-main"><b>Invia l’app a ${other}</b><span>Il link per installarla sul suo telefono</span></div>${icon('right', 'sm')}</button>` : ''}
      <button class="set-row" data-action="export">${icon('download')}<div class="row-main"><b>Scarica una copia</b><span>Tutti i dati di casa in un file</span></div></button>
    </div>

    <p class="muted small" style="text-align:center;margin-top:28px">Fatta con amore per ${n.p1}, ${n.p2}, Thor e Minù</p>
    ${isSynced() ? html`<button class="card-link" data-action="logout" style="margin:6px auto 0;display:block;color:var(--text-3);font-weight:500">Esci da questo dispositivo</button>` : ''}`;
}

// ---------------------------------------------------------------------------
// Filtri e categorie (per tutta la casa): film, ricette e reparti della spesa. Si tolgono quelle che non servono
// e se ne aggiungono di nuove. Togliere = nascondere: film, ricette e prodotti tengono le loro categorie
// e riaccendendole tornano al loro posto. "Sempre" e "Altro" restano: è lì che va tutto il resto.
// ---------------------------------------------------------------------------
const TIPI_CAT = {
  film: { titolo: 'Film', nuova: 'Nuova categoria', uno: 'film', tanti: 'film', da: ['#/svago/film', 'Film'] },
  ricette: { titolo: 'Ricette', nuova: 'Nuova categoria', uno: 'ricetta', tanti: 'ricette', da: ['#/cibo/ricette', 'Ricette'] },
  spesa: { titolo: 'Reparti della spesa', nuova: 'Nuovo reparto', da: ['#/cibo/spesa', 'Spesa'] },
};
const salvaCategorie = (tipo, conf) => saveSettings({ [CATEGORIE[tipo].chiave]: { spente: conf.spente, mie: conf.mie } });

function categoriePage(solo) {
  const s = settings();
  const uno = Object.hasOwn(TIPI_CAT, solo || '') ? solo : '';
  const [href, nome] = uno ? TIPI_CAT[uno].da : ['#/impostazioni', 'Impostazioni'];
  return html`<a class="back-link" href="${href}">${icon('left', 'sm')} ${nome}</a>
    ${pageHead('Filtri e categorie', { eyebrow: 'Per tutta la casa' })}
    ${Object.keys(TIPI_CAT).filter((t) => !uno || t === uno).map((t) => sezioneCategorie(s, t))}
    ${uno ? html`<a class="card-link cat-altre" href="#/impostazioni/categorie">Tutti i filtri e i reparti ${icon('right', 'xs')}</a>` : ''}`;
}

function sezioneCategorie(s, tipo) {
  const t = TIPI_CAT[tipo];
  const tutti = tipo === 'spesa' ? [] : state.data[tipo];
  const sotto = (c) => {
    if (c.fissa) return tipo === 'spesa' ? 'Non si toglie: qui va ciò che non ha un reparto' : `Non si toglie: qui va ${tipo === 'film' ? 'ogni film' : 'ogni ricetta'} senza altre categorie`;
    if (tipo === 'spesa') return c.spenta ? 'Tolto: i suoi prodotti vanno in «Altro»' : '';
    const n = conCategoria(tipo, tutti, c.id);
    return `${n ? `${n} ${n === 1 ? t.uno : t.tanti}` : `Nessun${tipo === 'ricette' ? 'a ricetta' : ' film'}`}${c.spenta ? ' · tolta: non si vede' : ''}`;
  };
  return html`<div class="section-title"><span>${t.titolo}</span></div>
    <div class="list cat-list">
      ${elencoCategorie(s, tipo).map((c) => html`<div class="set-row cat-row ${c.spenta ? 'spenta' : ''}">
        <span class="cat-ico" ${tipo === 'spesa' ? raw(`style="--c:${c.color}"`) : ''}>${tipo === 'spesa' ? html`<span aria-hidden="true">${c.emoji}</span>` : icon(c.icon)}</span>
        <div class="row-main"><b>${c.label}</b>${sotto(c) ? html`<span>${sotto(c)}</span>` : ''}</div>
        ${c.mia ? html`<button class="icon-btn ghost cat-mod" type="button" data-action="cat-modifica" data-tipo="${tipo}" data-id="${c.id}" aria-label="Modifica ${c.label}">${icon('pencil', 'sm')}</button>` : ''}
        ${c.fissa ? '' : html`<input class="sw" type="checkbox" data-change="cat-accesa" data-tipo="${tipo}" data-id="${c.id}" ${c.spenta ? '' : raw('checked')} aria-label="${c.label}: ${c.spenta ? 'tolta' : 'si vede'}">`}
      </div>`)}
      <button class="set-row cat-add" type="button" data-action="cat-nuova" data-tipo="${tipo}">${icon('plus')}<div class="row-main"><b>${t.nuova}</b></div></button>
    </div>`;
}

function categoriaSheet(tipo, c = null) {
  const spesa = tipo === 'spesa';
  const tutte = elencoCategorie(settings(), tipo);
  // dove va un reparto nuovo nel giro: di base alla fine (prima di "Altro")
  const prima = tutte.filter((x) => !x.fissa && (!c || x.id !== c.id));
  const dopo = c ? c.dopo : (prima.filter((x) => !x.spenta).pop() || {}).id;
  openSheet({
    title: c ? (spesa ? 'Modifica il reparto' : 'Modifica la categoria') : TIPI_CAT[tipo].nuova,
    body: html`
      <label class="field"><span>Nome</span><input name="label" value="${c ? c.label : ''}" maxlength="30" required placeholder="${spesa ? 'es. Farmacia' : tipo === 'film' ? 'es. Commedia' : 'es. Primi piatti'}" ${c ? '' : raw('autofocus')}></label>
      ${spesa ? html`
        <div class="field"><span>Faccina</span><div class="radio-chips emo-pick">${EMOJI_REPARTI.map((e, i) => html`<label><input type="radio" name="emoji" value="${e}" ${(c ? c.emoji === e : i === 0) ? raw('checked') : ''}><span>${e}</span></label>`)}</div></div>
        <label class="field"><span>Nel giro della spesa, dopo</span><select name="dopo">
          ${prima.map((x) => html`<option value="${x.id}" ${x.id === dopo ? raw('selected') : ''}>${x.emoji} ${x.label}${x.spenta ? ' (tolto)' : ''}</option>`)}
        </select></label>`
      : html`<div class="field"><span>Icona</span><div class="radio-chips icon-pick">${ICONE_CATEGORIE.map((ic, i) => html`<label><input type="radio" name="icon" value="${ic}" aria-label="Icona ${i + 1}" ${(c ? c.icon === ic : i === 0) ? raw('checked') : ''}><span>${icon(ic)}</span></label>`)}</div></div>`}`,
    submit: c ? 'Salva' : 'Aggiungi',
    extra: c ? html`<button class="btn danger" type="button" aria-label="Elimina" data-action="cat-elimina" data-tipo="${tipo}" data-id="${c.id}">${icon('trash', 'sm')}</button>` : '',
    onSubmit: (fd) => {
      const label = cap(val(fd, 'label')).slice(0, 30);
      if (!label) return false;
      const st = settings();
      const conf = confCategorie(st, tipo);
      const ora = elencoCategorie(st, tipo);
      const stesso = ora.find((x) => norm(x.label) === norm(label) && (!c || x.id !== c.id));
      const scelte = spesa ? { emoji: val(fd, 'emoji') || '🛒', dopo: val(fd, 'dopo') || '' } : { icon: val(fd, 'icon') || CATEGORIE[tipo].icona };
      if (c) {
        if (stesso) { sheetError(`C’è già «${stesso.label}»`); return false; }
        salvaCategorie(tipo, { ...conf, mie: conf.mie.map((m) => (m.id === c.id ? { ...m, label, ...scelte } : m)) });
        return;
      }
      // stesso nome di una categoria che c'è già: se è tolta torna, altrimenti c'è già
      const id = idCategoria(tipo, label);
      const gia = ora.find((x) => x.id === id) || stesso;
      if (gia && gia.spenta) {
        salvaCategorie(tipo, { ...conf, spente: conf.spente.filter((x) => x !== gia.id) });
        toast(`«${gia.label}» è tornat${spesa ? 'o' : 'a'}`);
        return;
      }
      if (gia) { sheetError(`C’è già «${gia.label}»`); return false; }
      const nuova = spesa ? { id, label, ...scelte, color: coloreReparto(ora.filter((x) => x.mia).map((x) => x.color)) } : { id, label, ...scelte };
      salvaCategorie(tipo, { ...conf, mie: [...conf.mie, nuova] });
      toast(`Aggiunt${spesa ? 'o' : 'a'}: ${label}`);
    },
  });
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
            ? `Su questo dispositivo sono bloccate. Per riaccenderle: Impostazioni dell’${isIPad() ? 'iPad' : 'iPhone'} → Notifiche → Comperotto.`
            : 'Un avviso quando l’altro arriva a casa o esce dal lavoro, la sera per la spazzatura e per compleanni e richiami dei gatti.'}</p>
        ${st === 'spente' ? html`<button class="btn primary block" data-action="push-on" ${ui('push.busy', false) ? raw('disabled') : ''}>${icon('bell', 'sm')} Attiva le notifiche</button>` : ''}
      </div>`;
  return html`<div class="section-title"><span>Notifiche</span></div>${corpo}`;
}

// ---------------------------------------------------------------------------
// Collegamento: per ognuno di voi, quando i suoi dispositivi hanno usato l'app, da dove arriva la posizione
// e se le notifiche arrivano davvero. Serve a capire al volo se un telefono "non sente" la casa.
// ---------------------------------------------------------------------------
const NOI = ['p1', 'p2'];
const PERCHE = {
  senza: 'non manda la password: in OwnTracks accendi «Authentication» e come password scrivi il codice di famiglia',
  codice: 'la password non è il codice di famiglia: riscrivila in OwnTracks',
  caratteri: 'la password ha un carattere che OwnTracks non sa mandare (lettere accentate o apostrofi «curvi»): riscrivila',
  bloccato: 'troppi codici sbagliati di fila: aspetta un quarto d’ora e riprova',
};
const recente = (at, ms) => Boolean(at) && Date.now() - at < ms;
const pallino = (at) => html`<span class="coll-dot ${recente(at, 15 * 60000) ? 'on' : recente(at, 2 * 86400000) ? 'mezzo' : ''}" aria-hidden="true"></span>`;

function collegamentoCard() {
  if (!isSynced()) return '';
  const c = ui('collegamento', null);
  return html`<div class="section-title"><span>Collegamento</span><button class="card-link" data-action="coll-aggiorna">${icon('refresh', 'xs')} Aggiorna</button></div>
    <div class="list coll">${NOI.map((k) => persona(k, c))}</div>`;
}

function persona(k, c) {
  const io = me() === k;
  const tipo = tipoDispositivo();
  const q = (store.queue || []).length;
  const righe = [];
  if (io) {
    righe.push(html`<div class="coll-line">${pallino(store.lastSync)}<span><b>Questo ${tipo}</b> · ${store.lastSync ? `aggiornato ${timeAgo(store.lastSync)}` : 'non ancora collegato'}${q ? html` · <em class="coll-warn">${q === 1 ? '1 modifica' : `${q} modifiche`} ancora da mandare${store.erroreInvio ? ' (riprovo da solo)' : ''}</em>` : ''}</span></div>`);
  }
  const altri = (c && c.visti ? c.visti : []).filter((v) => v.chi === k && !(io && v.disp === tipo)).sort((a, b) => b.at - a.at);
  altri.forEach((v) => righe.push(html`<div class="coll-line">${pallino(v.at)}<span><b>${v.disp}</b> · app aperta ${timeAgo(v.at)}${v.v && v.v !== VERSIONE ? ' · versione vecchia' : ''}${(v.disp === 'iPhone' || v.disp === 'iPad') && !v.home ? ' · da Safari, non dalla schermata Home' : ''}</span></div>`));
  if (!righe.length) righe.push(html`<div class="coll-line">${pallino(0)}<span>${c ? 'Ancora nessuna notizia: si vede appena apre l’app' : 'Guardo…'}</span></div>`);
  // posizione: chi la manda (OwnTracks o l'app) e la batteria
  const p = state.data.posizioni.find((x) => x.id === k);
  const ot = p && (p.ot || (p.src === 'owntracks' ? p.at : 0));
  const batt = batteria(p);
  const posizione = ot
    ? `Posizione da OwnTracks ${timeAgo(ot)}${batt != null ? ` · batteria ${batt}%` : ''}`
    : p && p.at ? `Posizione solo dall’app (${timeAgo(p.at)}): OwnTracks non la manda` : 'OwnTracks non ha mai mandato la posizione';
  // OwnTracks ci prova ma il codice non passa (dopo l'ultima posizione arrivata)
  const rif = c && c.owntracks ? c.owntracks[k] : null;
  const rifiutato = rif && rif.at > (ot || 0) && Date.now() - rif.at < 7 * 86400000 ? rif : null;
  // notifiche: su quanti dispositivi sono accese e com'è andata l'ultima
  const subs = c && c.notifiche ? c.notifiche.filter((n) => n.chi === k) : null;
  const ultima = subs ? subs.map((n) => n.esito).filter(Boolean).sort((a, b) => b.at - a.at)[0] : null;
  const notifiche = !subs ? '' : subs.length
    ? `Notifiche accese${subs.length > 1 ? ` su ${subs.length} dispositivi` : ''}${ultima ? ` · l’ultima ${ultima.stato >= 200 && ultima.stato < 300 ? 'è arrivata' : 'non è arrivata'} ${timeAgo(ultima.at)}` : ''}`
    : 'Notifiche spente su tutti i suoi dispositivi';
  return html`<div class="set-row coll-row"><div class="row-main"><b>${nameOf(k)}</b>
    ${righe}
    <div class="coll-line">${icon('pin', 'xs')}<span>${posizione}</span></div>
    ${rifiutato ? html`<div class="coll-line">${icon('info', 'xs')}<span><em class="coll-warn">OwnTracks ci prova (${timeAgo(rifiutato.at)}) ma ${PERCHE[rifiutato.motivo] || PERCHE.codice}</em></span></div>` : ''}
    ${notifiche ? html`<div class="coll-line">${icon('bell', 'xs')}<span>${notifiche}</span></div>` : ''}
  </div></div>`;
}

let collAt = 0;
async function caricaCollegamento(forza = false) {
  if (!isSynced() || (!forza && Date.now() - collAt < 30000)) return;
  collAt = Date.now();
  try { setUi('collegamento', await store.call('dati?visti=1')); } catch { /* resta quello di prima */ }
}

let chiesto = false;
/** Dopo il disegno della pagina: com'è il collegamento e com'è messo questo dispositivo con le notifiche (una volta). */
export function after() {
  caricaCollegamento();
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
  'coll-aggiorna': async () => { await store.sync(); await caricaCollegamento(true); rerender(); },
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
  'cat-accesa': ({ el }) => {
    const { tipo, id } = el.dataset;
    if (!Object.hasOwn(TIPI_CAT, tipo || '')) return;
    const conf = confCategorie(settings(), tipo);
    salvaCategorie(tipo, { ...conf, spente: el.checked ? conf.spente.filter((x) => x !== id) : [...new Set([...conf.spente, id])] });
  },
  'cat-nuova': ({ el }) => { if (Object.hasOwn(TIPI_CAT, el.dataset.tipo || '')) categoriaSheet(el.dataset.tipo); },
  'cat-modifica': ({ el }) => {
    const { tipo, id } = el.dataset;
    const c = Object.hasOwn(TIPI_CAT, tipo || '') && elencoCategorie(settings(), tipo).find((x) => x.id === id && x.mia);
    if (c) categoriaSheet(tipo, c);
  },
  'cat-elimina': ({ el }) => {
    const { tipo, id } = el.dataset;
    const c = Object.hasOwn(TIPI_CAT, tipo || '') && elencoCategorie(settings(), tipo).find((x) => x.id === id && x.mia);
    if (!c) return;
    confirmSheet({
      title: `Eliminare «${c.label}»?`,
      text: tipo === 'spesa' ? 'I suoi prodotti vanno in «Altro».' : `${tipo === 'film' ? 'I film' : 'Le ricette'} che l’avevano restano come sono: rifacendo una categoria con lo stesso nome ci tornano.`,
      onYes: () => {
        const conf = confCategorie(settings(), tipo);
        salvaCategorie(tipo, { spente: conf.spente.filter((x) => x !== id), mie: conf.mie.filter((m) => m.id !== id) });
        toast(`Eliminat${tipo === 'spesa' ? 'o' : 'a'}: ${c.label}`);
      },
    });
  },
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
