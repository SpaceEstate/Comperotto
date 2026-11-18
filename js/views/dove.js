// Dov'è: chi è a casa, al lavoro o fuori, con la mappa.
// Le posizioni arrivano da OwnTracks (in automatico, anche ad app chiusa) e, se lo si sceglie,
// dall'app stessa mentre è aperta. Regola d'oro: una posizione vecchia non si mostra mai come se fosse
// di adesso. Oltre le 2 ore si dice "era a casa · 5 h fa", in grigio.
// C'è anche l'auto: la segna il comando rapido «Ho parcheggiato» dell'iPhone; qui si vede e basta.
import { html, raw, timeAgo, vibrate, uid, cap, isIPad, lsGet, lsSet } from '../utils.js';
import { icon } from '../icons.js';
import { state, store, settings, saveSettings, me, nameOf, toast, pageHead, isSynced, openSheet, closeSheet, sheetError, val, confirmSheet, ui, setUi, rerender } from '../core.js';
import { stile, icone, mettiIcone, iconaPosto } from '../mappa.js';

const PEOPLE = ['p1', 'p2'];
const pos = (k) => state.data.posizioni.find((p) => p.id === k && Number.isFinite(p.lat));
const initialOf = (k) => (nameOf(k) || '?')[0].toUpperCase();
const hasXY = (l) => l && Number.isFinite(l.lat) && Number.isFinite(l.lon);
const MIN = 60000;

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const distanza = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** I nostri posti; la casa "segnata qui" ha la precedenza sull'indirizzo. */
export function luoghi() {
  const s = settings();
  return (s.luoghi || []).map((l) => (l.id === 'casa' && s.casaPos && hasXY(s.casaPos) ? { ...l, lat: s.casaPos.lat, lon: s.casaPos.lon, r: s.casaPos.r || l.r } : l));
}
const luogoById = (id) => luoghi().find((l) => l.id === id);
const ownerOf = (l) => (l.chi === 'p1' || l.chi === 'p2' ? nameOf(l.chi) : '');
const postiDi = (k) => luoghi().filter((l) => hasXY(l) && (l.id === 'casa' || l.chi === 'both' || l.chi === k || !l.chi))
  .map((l) => ({ ...l, r: Number(l.r) || (l.id === 'casa' ? 150 : 200) }));
// la stessa chiave che salva il server (api/posizione.js): se coincide, la sua decisione vale ancora
const chiavePosti = (posti) => posti.map((l) => `${l.id}:${Number(l.lat).toFixed(5)}:${Number(l.lon).toFixed(5)}:${Math.round(l.r)}`).join('|');

/** Dove si trova rispetto ai nostri posti. */
function where(k, p) {
  const posti = postiDi(k);
  if (!posti.length) return { home: p.home ?? null, luogo: p.luogo || null };
  // il server ha deciso con più informazioni (zone di OwnTracks, entrate/uscite, precisione): se i posti
  // sono gli stessi mi fido di lui; altrimenti ricalcolo qui, così vale subito un posto nuovo o spostato
  if (p.posti === chiavePosti(posti)) return { home: p.home ?? null, luogo: p.luogo ?? null };
  const acc = Number(p.acc) || 0;
  const dentro = (l) => { const d = distanza(p, l); return acc <= l.r ? d <= l.r : d - acc > l.r ? false : d + acc <= l.r * 1.5 ? true : null; };
  const casa = posti.find((l) => l.id === 'casa');
  if (casa && dentro(casa) === true) return { home: true, luogo: 'casa' };
  const l = posti.filter((x) => x.id !== 'casa').find((x) => dentro(x) === true);
  return { home: casa ? false : p.home ?? null, luogo: l ? l.id : null };
}

/** "da 10 min", "da 4 h", "da 2 giorni" */
export function durata(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / MIN));
  if (m < 2) return 'da poco';
  if (m < 60) return `da ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `da ${h} h`;
  const g = Math.floor(h / 24);
  return g === 1 ? 'da 1 giorno' : `da ${g} giorni`;
}

/** Quanto è fresca una posizione: live ≤ 15 min, recente ≤ 2 h, vecchia ≤ 24 h, poi scaduta. */
export function freschezza(at) {
  const age = Date.now() - at;
  if (age <= 15 * MIN) return 'live';
  if (age <= 120 * MIN) return 'recente';
  if (age <= 24 * 60 * MIN) return 'vecchia';
  return 'scaduta';
}

/** "alle 14:32", "ieri alle 21:10", "lunedì alle 9:05", "12 nov" */
export function quando(t) {
  const d = new Date(t), oggi = new Date();
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const giorni = Math.round((new Date(oggi.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (giorni === 0) return `alle ${ora}`;
  if (giorni === 1) return `ieri alle ${ora}`;
  if (giorni < 7) return `${d.toLocaleDateString('it-IT', { weekday: 'long' })} alle ${ora}`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

const metri = (m) => (m >= 1000 ? `${String(Math.round(m / 100) / 10).replace('.', ',')} km` : `${Math.round(m)} m`);

/**
 * Lo stato di una persona, sempre con la sua età:
 *  { cls: home|work|out|'', label, since, place, fresh, old, agg, p }
 *  - fresca (≤ 2 h): "A casa da 2 h", "Al lavoro", "Fuori da 10 min"
 *  - vecchia: "Era a casa", "Era al lavoro", "Era fuori" + "5 h fa" (mai al presente)
 */
export function statusOf(k) {
  const raw0 = pos(k);
  if (!raw0) return { cls: '', label: 'Posizione non ancora condivisa', since: '', place: '', stale: true, old: true, fresh: 'nessuna' };
  const w = where(k, raw0);
  const p = { ...raw0, home: w.home, luogo: w.luogo };
  const fresh = freschezza(p.at);
  const old = fresh === 'vecchia' || fresh === 'scaduta';
  const agg = `${timeAgo(p.at)}${Date.now() - p.at > 50 * MIN ? ` (${quando(p.at)})` : ''}`;
  const base = { p, fresh, old, stale: old, agg, quando: quando(p.at), place: '' };
  const l = p.luogo && p.luogo !== 'casa' ? luogoById(p.luogo) : null;
  if (p.home === true) return { ...base, cls: 'home', label: old ? 'Era a casa' : 'A casa', since: old ? '' : durata(raw0.home === true ? raw0.homeSince || raw0.at : raw0.at) };
  if (l) {
    const lav = /lavoro|ufficio/i.test(l.nome);
    return { ...base, cls: 'work', label: old ? (lav ? 'Era al lavoro' : `Era qui: ${l.nome}`) : lav ? 'Al lavoro' : l.nome, since: old ? '' : durata(raw0.luogo === l.id ? raw0.luogoSince || raw0.at : raw0.at) };
  }
  const place = raw0.luogo && raw0.place && /^(casa|lavoro)$/i.test(raw0.place) ? '' : p.place;
  if (p.home === false) return { ...base, cls: 'out', label: old ? 'Era fuori' : 'Fuori', since: old ? '' : durata(!raw0.luogo && raw0.home === false ? raw0.luogoSince || raw0.homeSince || raw0.at : raw0.at), place };
  return { ...base, cls: '', label: old ? 'Ultima posizione' : place || 'Posizione', since: '', place: old ? place : '' };
}
export const pillOf = (st) => (st.old ? 'stale' : st.cls === 'home' ? 'ok' : st.cls === 'work' ? 'today' : st.cls === 'out' ? 'soon' : '');
export const iconOf = (st) => (st.cls === 'home' ? 'home' : st.cls === 'work' ? 'briefcase' : 'pin');

export function personBadge(k) {
  return html`<span class="who-pin ${k}">${initialOf(k)}</span>`;
}

const mapsUrl = (p, name) => `https://maps.apple.com/?ll=${p.lat},${p.lon}&q=${encodeURIComponent(name)}`;
// solo gli iPhone mandano la posizione (sull'iPad non ha senso: resta a casa)
const possoMandare = () => isSynced() && Boolean(me()) && !isIPad() && 'geolocation' in navigator;

// ---------------------------------------------------------------------------
// L'auto: dove l'abbiamo lasciata (posizioni/auto). La manda il comando rapido «Ho parcheggiato» sulla
// schermata Home dell'iPhone (POST /api/posizione?auto): nell'app non c'è niente da premere, si vede e basta.
// ---------------------------------------------------------------------------
/** { lat, lon, acc, at, chi, place, nota, src } oppure undefined */
export const macchina = () => state.data.posizioni.find((p) => p.id === 'auto' && hasXY(p));
/** A piedi fino all'auto, con Mappe */
const percorso = (a) => `https://maps.apple.com/?daddr=${a.lat},${a.lon}&dirflg=w`;
const chiAuto = (a) => (a.chi === 'p1' || a.chi === 'p2' ? nameOf(a.chi) : '');
/** "alle 14:32", "ieri alle 9:05", "il 12 nov" */
const quandoAuto = (a) => { const q = quando(a.at); return /^\d/.test(q) ? `il ${q}` : q; };
/** "Parcheggiata da Serena alle 14:32 · posizione approssimativa (±60 m)" */
function parcheggiata(a) {
  const chi = chiAuto(a);
  return `Parcheggiata${chi ? ` da ${chi}` : ''} ${quandoAuto(a)}${a.acc > 30 ? ` · posizione approssimativa (±${metri(a.acc)})` : ''}`;
}
export function autoBadge(cls = '') {
  return html`<span class="auto-pin ${cls}">${icon('car', cls === 'sm' ? 'sm' : '')}</span>`;
}

function autoCard() {
  const a = macchina();
  if (!a) return '';
  return html`
    <div class="section-title"><span>Auto</span></div>
    <section class="card dove-card auto-card">
      <div class="dove-row">
        <button class="dove-hit" data-action="auto-info" aria-label="L’auto: ${a.place || 'sulla mappa'}">
          ${autoBadge()}
          <span class="dove-main">
            <b>Auto</b>
            <span class="dove-status"><span class="pill soon">${icon('parking', 'xs')} <span class="auto-parola">Parcheggiata</span> ${durata(a.at)}</span></span>
            ${a.place ? html`<span class="dove-place">${a.place}</span>` : ''}
            ${a.nota ? html`<span class="dove-place auto-nota">${icon('note', 'xs')} ${a.nota}</span>` : ''}
            <span class="dove-sub">${[chiAuto(a), quandoAuto(a), a.acc > 30 ? `±${metri(a.acc)}` : ''].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
        <a class="icon-btn" href="${percorso(a)}" target="_blank" rel="noopener" aria-label="Portami all’auto">${icon('nav', 'sm')}</a>
      </div>
    </section>`;
}

/** Rimette l'auto com'era (per "Annulla") */
function rimetti(prima) {
  if (!prima) { store.remove('posizioni', 'auto'); return; }
  const { id, ...resto } = prima;
  store.set('posizioni', 'auto', resto);
}

/** L'indirizzo dell'auto, se al comando rapido non è arrivato in tempo: lo cerco io (una volta al minuto al massimo). */
const cercati = new Map();
export async function trovaIndirizzo() {
  const a = macchina();
  if (!a || a.place || !isSynced() || Date.now() - (cercati.get(a.at) || 0) < MIN) return;
  cercati.set(a.at, Date.now());
  try {
    const r = await store.call(`geocodifica?lat=${a.lat}&lon=${a.lon}`);
    const ora = macchina();
    if (r.nome && ora && ora.at === a.at && !ora.place) store.update('posizioni', 'auto', { place: r.nome });
  } catch (e) {
    if (e instanceof TypeError) cercati.delete(a.at); // senza rete: riprovo appena torna
    else if (/non trovato/i.test((e && e.message) || '')) cercati.set(a.at, Infinity); // lì non c'è un indirizzo: non insisto
  }
}

/** La mappa (se c'è) va sull'auto */
function vaiAllAuto(anima = true) {
  const a = macchina(), m = document.getElementById('mappa');
  if (!a || !m || !m._map) return false;
  const zoom = Math.max(m._map.getZoom(), 17);
  if (anima) m._map.flyTo({ center: [a.lon, a.lat], zoom, duration: 900 });
  else m._map.jumpTo({ center: [a.lon, a.lat], zoom });
  return true;
}

/** La scheda dell'auto: portami lì, una nota (piano, posto…), togli. */
function autoSheet() {
  const a = macchina();
  if (!a) return;
  vaiAllAuto();
  openSheet({
    title: 'Auto',
    body: html`
      <div class="auto-head">
        ${autoBadge()}
        <div><b>${a.place || 'Segnata sulla mappa'}</b><span>${parcheggiata(a)}</span></div>
      </div>
      <a class="btn block auto-go" href="${percorso(a)}" target="_blank" rel="noopener">${icon('nav', 'sm')} Portami all’auto</a>
      <label class="field"><span>Nota</span><input name="nota" value="${a.nota || ''}" maxlength="80" placeholder="es. Piano -2, posto 14"></label>`,
    extra: html`<button class="btn danger" type="button" data-action="auto-togli" aria-label="Togli l’auto dalla mappa">${icon('trash', 'sm')}</button>`,
    onSubmit: (fd) => {
      const ora = macchina();
      const nota = cap(val(fd, 'nota'));
      if (ora && nota !== (ora.nota || '')) store.update('posizioni', 'auto', { nota });
    },
  });
}

/** Da dove arrivano le posizioni di questa persona (per capire subito se qualcosa non va). */
/** La batteria (la manda OwnTracks): solo se è di poco fa, mai un numero vecchio accanto a una posizione nuova. */
export const batteria = (p) => (p && p.batt != null && (!p.battAt || Date.now() - p.battAt < 3 * 60 * MIN) ? p.batt : null);

function diagnosi(k, st) {
  const p = st.p;
  if (!p) return '';
  const bits = [];
  const ot = p.ot || (p.src === 'owntracks' ? p.at : 0);
  if (ot) bits.push(`OwnTracks ${Date.now() - ot < 20 * MIN ? 'attivo' : `sentito ${timeAgo(ot)}`}${p.m === 1 ? ' · Significant' : p.m === 2 ? ' · Move' : p.m === 0 ? ' · Manuale' : p.m === -1 ? ' · In pausa' : ''}`);
  if (p.zoneOk && Date.now() - p.zoneOk < 14 * 24 * 60 * MIN) bits.push('zone di casa attive');
  if (p.src === 'app') bits.push('dall’app');
  if (Number(p.acc) > 300) bits.push(`precisione ±${metri(p.acc)}`);
  return bits.join(' · ');
}

function consiglio(k, st) {
  if (!st.old || !st.p) return '';
  const mio = k === me();
  const pausa = st.p.m === -1 || st.p.m === 0;
  const testo = mio
    ? html`Il tuo iPhone non manda la posizione da ${durata(st.p.at).replace('da ', '')}. ${pausa ? 'OwnTracks è in pausa o in modalità manuale: scegli «Significant».' : 'Controlla che OwnTracks abbia la posizione «Sempre» e non sia stato chiuso dal multitasking.'}`
    : html`Nessun aggiornamento da ${durata(st.p.at).replace('da ', '')}: eventuali spostamenti fatti dopo non sono arrivati. Se serve, chiedi la posizione.`;
  return html`<div class="dove-warn">${icon('info', 'sm')}<div>${testo}
    <div class="dove-warn-act">${mio
      ? possoMandare() ? html`<button class="mini-btn primary" data-action="dove-manda">${icon('pin', 'xs')} Manda la mia adesso</button>` : ''
      : isSynced() ? html`<button class="mini-btn primary" data-action="dove-chiedi" ${ui('dove.chiesto', 0) > Date.now() - 3 * MIN ? raw('disabled') : ''}>${icon('bell', 'xs')} Chiedi a ${nameOf(k)}</button>` : ''}</div></div></div>`;
}

export function render(route) {
  const any = PEOPLE.some((k) => pos(k)) || luoghi().some(hasXY) || Boolean(macchina());
  const posti = luoghi();
  if (route && route[1] === 'condividi') setTimeout(() => chiestaCondivisione(), 350);
  const auto = lsGet('casa.dove.app') === '1';
  const grande = Boolean(ui('dove.grande', false));
  return html`
    <a class="back-link phone-only" href="#/">${icon('left', 'sm')} Home</a>
    ${pageHead('Dov’è', { eyebrow: `${nameOf('p1')} e ${nameOf('p2')}` })}

    ${any ? html`<div class="map-card ${grande ? 'grande' : ''}" ${grande ? raw('role="dialog" aria-modal="true" aria-label="Mappa"') : ''}><div id="mappa" class="mappa" data-keep></div>
      ${grande ? html`<button class="map-btn map-chiudi" data-action="mappa-piccola" aria-label="Chiudi la mappa grande">${icon('x', 'sm')}</button>` : ''}
      <div class="map-tools">
        <div class="map-switch">${[['mappa', 'Mappa'], ['satellite', 'Satellite']].map(([v, t]) => html`<button class="${tipoMappa() === v ? 'on' : ''}" data-action="mappa-tipo" data-v="${v}">${t}</button>`)}</div>
        <button class="map-btn" data-action="mappa-centra" aria-label="Mostra tutti">${icon('users', 'sm')}</button>
        ${grande ? '' : html`<button class="map-btn" data-action="mappa-grande" aria-label="Mappa a tutto schermo">${icon('expand', 'sm')}</button>`}
      </div></div>` : ''}

    <div class="dove-list">${PEOPLE.map((k) => {
      const st = statusOf(k);
      const dg = diagnosi(k, st);
      const dentro = html`
        ${personBadge(k)}
        <span class="dove-main">
          <b>${nameOf(k)}${st.p && st.fresh === 'live' ? html`<i class="live-dot" title="Aggiornata adesso"></i>` : ''}</b>
          <span class="dove-status">
            ${st.p ? html`<span class="pill ${pillOf(st)}">${icon(iconOf(st), 'xs')} ${st.label}${st.since ? ` ${st.since}` : ''}</span>` : html`<span class="muted small">${st.label}</span>`}
          </span>
          ${st.place ? html`<span class="dove-place">${st.place}</span>` : ''}
          ${st.p ? html`<span class="dove-sub ${st.old ? 'old' : ''}">${st.old ? icon('clock', 'xs') : ''} Aggiornata ${st.agg}${batteria(st.p) != null ? html` · ${icon('battery', 'xs')} ${batteria(st.p)}%` : ''}</span>` : ''}
          ${dg ? html`<span class="dove-diag">${dg}</span>` : ''}
        </span>`;
      return html`<section class="card dove-card ${st.old ? 'stale' : ''}">
        <div class="dove-row">
          ${st.p ? html`<button class="dove-hit" data-action="dove-vai" data-k="${k}" aria-label="Mostra ${nameOf(k)} sulla mappa">${dentro}</button>` : html`<div class="dove-hit">${dentro}</div>`}
          ${st.p ? html`<a class="icon-btn" href="${mapsUrl(st.p, nameOf(k))}" target="_blank" rel="noopener" aria-label="Apri ${nameOf(k)} in Mappe">${icon('map', 'sm')}</a>` : ''}
        </div>
        ${consiglio(k, st)}
      </section>`;
    })}</div>

    <div class="btn-row dove-actions">
      <button class="btn" data-action="dove-aggiorna" ${ui('dove.busy', false) ? raw('disabled') : ''}>${icon('refresh', ui('dove.busy', false) ? 'sm spin' : 'sm')} ${ui('dove.busy', false) ? 'Aggiorno…' : 'Aggiorna'}</button>
      <a class="btn primary" href="findmy://">${icon('search', 'sm')} Apri Dov’è</a>
    </div>

    ${autoCard()}

    ${possoMandare() ? html`<div class="section-title"><span>Questo iPhone</span></div>
      <div class="list">
        <label class="set-row"><div class="row-main"><b>Manda la mia posizione quando apro l’app</b>
          <span>${auto ? 'Attivo: mentre l’app è aperta la tua posizione resta aggiornata (ogni pochi minuti). Ad app chiusa ci pensa OwnTracks.' : 'Si aggiunge a OwnTracks: utile se OwnTracks si ferma. Solo mentre l’app è aperta, e lo puoi spegnere quando vuoi.'}</span></div>
          <input class="sw" type="checkbox" data-change="dove-auto" ${auto ? raw('checked') : ''} aria-label="Manda la mia posizione quando apro l’app"></label>
      </div>` : ''}

    <div class="section-title"><span>I nostri posti</span></div>
    <div class="list">${posti.map((l) => html`
      <button class="row" data-action="luogo-edit" data-id="${l.id}">
        <span class="chore-ico dot-ico ${l.id === 'casa' ? 'tone-sage' : 'tone-oak'}">${icon(l.id === 'casa' ? 'home' : /lavoro|ufficio/i.test(l.nome) ? 'briefcase' : 'pin')}</span>
        <span class="row-main"><span class="row-title">${l.nome}${ownerOf(l) ? html` <span class="muted" style="font-weight:500">· ${ownerOf(l)}</span>` : ''}</span>
          <span class="row-sub">${l.indirizzo || (hasXY(l) ? 'Segnato sulla mappa' : 'Tocca per aggiungere l’indirizzo')}${hasXY(l) || !l.indirizzo ? '' : l.geoFail ? html` · <b style="color:var(--rose)">da sistemare</b>` : ' · cerco sulla mappa…'}</span></span>
        ${icon('right', 'sm')}
      </button>`)}
      <button class="row" data-action="luogo-new"><span class="chore-ico dot-ico tone-sky">${icon('plus')}</span><span class="row-main"><span class="row-title">Aggiungi un posto</span><span class="row-sub">Palestra, genitori, scuola…</span></span></button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Mappa (MapLibre, dentro l'app; lo stile sta in js/mappa.js).
// Patrick e Serena si vedono sempre; Casa, Lavoro e le attività compaiono ingrandendo, come su Dov'è.
// ---------------------------------------------------------------------------
const tipoMappa = () => (lsGet('casa.mappa') === 'satellite' ? 'satellite' : 'mappa');

let mlgl = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!mlgl) {
    mlgl = new Promise((ok, ko) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'js/vendor/maplibre/maplibre-gl.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'js/vendor/maplibre/maplibre-gl.js';
      js.onload = () => ok(window.maplibregl);
      js.onerror = () => { mlgl = null; js.remove(); ko(new Error('mappa non disponibile')); };
      document.head.appendChild(js);
    });
  }
  return mlgl;
}

/**
 * Segnaposti sempre visibili: l'auto (sotto, così Patrick e Serena le stanno sopra quando sono lì) e poi
 * Patrick e Serena (grigi se la posizione è vecchia; l'auto invece resta dov'è finché non si riparcheggia).
 */
const persone = () => {
  const a = macchina();
  const auto = a ? [{ k: 'auto', ll: [a.lon, a.lat] }] : [];
  return [...auto, ...PEOPLE.flatMap((k) => { const p = pos(k); if (!p) return []; const f = freschezza(p.at); return [{ k, ll: [p.lon, p.lat], old: f === 'vecchia' || f === 'scaduta', age: timeAgo(p.at) }]; })];
};
/** I nostri posti, nel formato che vuole la mappa */
const postiGeo = () => ({
  type: 'FeatureCollection',
  features: luoghi().filter(hasXY).map((l) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [l.lon, l.lat] },
    properties: { nome: l.nome, icona: iconaPosto(l) },
  })),
});

/** Inquadra le persone e l'auto; se non c'è ancora nessuna posizione, casa (o il primo posto) */
function inquadra(map, animate = true) {
  const pts = persone().map((x) => x.ll);
  if (!pts.length) {
    const l = luoghi().find((x) => x.id === 'casa' && hasXY(x)) || luoghi().find(hasXY);
    if (l) map.jumpTo({ center: [l.lon, l.lat], zoom: 15 });
    return;
  }
  const lons = pts.map((x) => x[0]), lats = pts.map((x) => x[1]);
  const sw = [Math.min(...lons), Math.min(...lats)], ne = [Math.max(...lons), Math.max(...lats)];
  // tutti nello stesso punto (o quasi): niente riquadro, solo un po' di zoom
  if (distanza({ lon: sw[0], lat: sw[1] }, { lon: ne[0], lat: ne[1] }) < 60) {
    map[animate ? 'easeTo' : 'jumpTo']({ center: [(sw[0] + ne[0]) / 2, (sw[1] + ne[1]) / 2], zoom: 15.5 });
    return;
  }
  map.fitBounds([sw, ne], { padding: { top: 76, bottom: 44, left: 56, right: 56 }, maxZoom: 16, animate });
}

function markerEl(x) {
  const el = document.createElement('div');
  if (x.k === 'auto') {
    el.className = 'pin-wrap';
    el.innerHTML = `<span class="pin-auto">${icon('car').s}</span>`;
    el.title = 'Auto';
    // toccando l'auto si apre la sua scheda (e non la mappa a tutto schermo)
    el.addEventListener('click', (e) => { e.stopPropagation(); autoSheet(); });
    return el;
  }
  el.className = `pin-wrap${x.old ? ' old' : ''}`;
  el.innerHTML = `<span class="pin-person ${x.k}">${initialOf(x.k)}</span>${x.old ? `<span class="pin-age">${x.age}</span>` : ''}`;
  el.title = x.old ? `${nameOf(x.k)} · ultima posizione ${x.age}` : nameOf(x.k);
  return el;
}

/** L'app è in modalità scura? (scelta nelle impostazioni, altrimenti quella dell'iPhone) */
const scuro = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
const chiaveStile = () => `${tipoMappa()}|${scuro() ? 'scuro' : 'chiaro'}`;

// La mappa a tutto schermo: si apre con un tocco sulla mappa (o col pulsante), si chiude con la X o Esc.
function apriGrande() { setUi('dove.grande', true); }
function chiudiGrande() { if (ui('dove.grande', false)) setUi('dove.grande', false); }
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/dove')) { state.ui['dove.grande'] = false; document.documentElement.classList.remove('mappa-grande'); } });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && location.hash.startsWith('#/dove')) chiudiGrande(); });

// La mappa resta viva quando si cambia pagina: tornando su Dov'è è già lì, senza ricaricare nulla.
let viva = null;
// la mappa che si sta preparando fuori dallo schermo (all'apertura dell'app)
let inPreparazione = null;

/** Crea la mappa nel suo riquadro (una volta sola: poi resta viva). */
async function creaMappa(el) {
  const chiave = chiaveStile();
  const [ml, st, imgs] = await Promise.all([loadMapLibre(), stile(tipoMappa(), postiGeo(), scuro()), icone()]);
  if (!el.isConnected || (viva && viva !== el)) return null;
  const map = new ml.Map({
    container: el,
    style: st,
    center: [12.5, 42.5],
    zoom: 5,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxZoom: 19.5,
  });
  map.touchZoomRotate.disableRotation();
  // a ogni cambio di stile (Mappa/Satellite, chiaro/scuro) le nostre icone vanno rimesse
  map.on('style.load', () => mettiIcone(map, imgs));
  map.on('styleimagemissing', (e) => { const im = imgs.get(e.id); if (im && !map.hasImage(e.id)) map.addImage(e.id, im.data, { pixelRatio: im.pixelRatio }); });
  map.on('click', () => { if (!ui('dove.grande', false)) apriGrande(); });
  el._ml = ml;
  el._map = map;
  el._markers = [];
  el._stile = chiave;
  el._posti = JSON.stringify(postiGeo());
  viva = el;
  inquadra(map, false);
  return map;
}

/**
 * All'apertura dell'app: la mappa si prepara fuori dallo schermo, grande come quella di Dov'è, e scarica
 * la zona dove siete. Poi resta da parte (come dopo una visita a Dov'è): entrando è già pronta.
 */
export function preparaMappa() {
  if (viva || inPreparazione || !isSynced() || document.getElementById('mappa')) return Promise.resolve();
  if (!persone().length && !luoghi().some(hasXY)) return Promise.resolve(); // niente da mostrare
  const view = document.getElementById('view');
  const cs = view && getComputedStyle(view);
  const largo = view ? view.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : innerWidth - 32;
  const box = document.createElement('div');
  box.className = 'map-card mappa-pronta';
  box.setAttribute('aria-hidden', 'true');
  box.style.width = `${Math.max(280, Math.round(largo))}px`;
  const el = document.createElement('div');
  el.className = 'mappa';
  el.setAttribute('data-keep', '');
  box.appendChild(el);
  document.body.appendChild(box);
  inPreparazione = creaMappa(el).catch(() => null).finally(() => { inPreparazione = null; });
  return inPreparazione.then((map) => {
    if (!map) { box.remove(); return; }
    // quando la zona è scaricata (o dopo un po') la tolgo dalla pagina: resta pronta in memoria
    return new Promise((ok) => { const t = setTimeout(ok, 20000); map.once('idle', () => { clearTimeout(t); ok(); }); })
      .then(() => box.remove());
  });
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (document.getElementById('mappa')) after(); });

// Da "Auto" in Home (#/dove/auto) la mappa parte dall'auto: appena ci sono sia la mappa sia l'auto.
let sullAuto = false;

/** r = la rotta (es. ['dove', 'auto']), nuova = appena arrivati su questa pagina */
export async function after(r = [], nuova = false) {
  if (nuova) sullAuto = r[1] === 'auto';
  ensureCoords();
  trovaIndirizzo();
  // mentre si guarda Dov'è il controllo del server resta veloce (ogni 6 secondi)
  if (isSynced() && !document.hidden) store.attivo = Date.now();
  automatica();
  // la mappa si sta preparando fuori dallo schermo: uso quella
  if (inPreparazione) await inPreparazione;
  let el = document.getElementById('mappa');
  if (!el) return;
  if (viva && viva !== el) { viva.id = el.id; el.replaceWith(viva); el = viva; el._map.resize(); inquadra(el._map, false); }
  if (!el._map) {
    if (el._inCorso) return; // la sto già preparando
    el._inCorso = true;
    try {
      if (!(await creaMappa(el))) return;
    } catch { el.classList.add('no-map'); return; } finally { el._inCorso = false; }
  }
  const map = el._map;
  // mappa grande o piccola: la mappa si adatta al riquadro nuovo
  const grande = Boolean(ui('dove.grande', false));
  document.documentElement.classList.toggle('mappa-grande', grande);
  if (el._grande !== grande) {
    el._grande = grande;
    requestAnimationFrame(() => { map.resize(); inquadra(map, false); });
  }
  // dopo l'inquadratura qui sopra (stesso fotogramma, in ordine): la mappa va sull'auto
  if (sullAuto && macchina()) { sullAuto = false; requestAnimationFrame(() => vaiAllAuto(false)); }
  const posti = postiGeo(), pk = JSON.stringify(posti);
  // Mappa/Satellite o chiaro/scuro sono cambiati
  const chiave = chiaveStile();
  if (chiave !== el._stile) {
    el._stile = chiave;
    el._posti = pk;
    const st = await stile(tipoMappa(), posti, scuro());
    if (el._stile === chiave) map.setStyle(st, { diff: false });
  }
  // segnaposti delle persone (grigi con l'età se la posizione è vecchia) e dell'auto
  const pp = persone();
  const key = JSON.stringify(pp);
  if (key !== el._key) {
    el._markers.forEach((m) => m.remove());
    el._markers = pp.map((x) => new el._ml.Marker({ element: markerEl(x), anchor: 'bottom' }).setLngLat(x.ll).addTo(map));
    el._key = key;
  }
  // i nostri posti (se sono cambiati)
  if (pk !== el._posti) {
    el._posti = pk;
    const src = map.getSource('posti');
    if (src) src.setData(posti);
  }
}

// ---------------------------------------------------------------------------
// Coordinate dei posti dall'indirizzo (cercando vicino a dove siete)
// ---------------------------------------------------------------------------
let geocoding = false;
function nearHint() {
  const s = settings();
  if (s.casaPos && hasXY(s.casaPos)) return s.casaPos;
  return pos(me()) || PEOPLE.map(pos).find(Boolean) || null;
}
async function geocode(indirizzo) {
  const near = nearHint();
  const q = `geocodifica?q=${encodeURIComponent(indirizzo)}${near ? `&lat=${near.lat}&lon=${near.lon}` : ''}`;
  return store.call(q);
}
async function ensureCoords() {
  if (!isSynced() || geocoding) return;
  const s = settings();
  const todo = (s.luoghi || []).filter((l) => l.indirizzo && !hasXY(l) && !l.geoFail);
  if (!todo.length || !nearHint()) return;
  geocoding = true;
  try {
    const list = (s.luoghi || []).map((l) => ({ ...l }));
    for (const l of list) {
      if (!l.indirizzo || hasXY(l) || l.geoFail) continue;
      try { const r = await geocode(l.indirizzo); l.lat = r.lat; l.lon = r.lon; } catch { l.geoFail = true; }
    }
    saveSettings({ luoghi: list });
  } finally { geocoding = false; }
}

// ---------------------------------------------------------------------------
// La mia posizione dall'app (solo iPhone, solo con il consenso, solo ad app aperta)
// ---------------------------------------------------------------------------
/** Un punto dal GPS: prima preciso; se non arriva in tempo (es. in casa) va bene anche meno preciso, ma recente. */
function here() {
  const get = (opts) => new Promise((ok, ko) => navigator.geolocation.getCurrentPosition(ok, ko, opts));
  if (!navigator.geolocation) return Promise.reject(Object.assign(new Error('no'), { code: 2 }));
  return get({ enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 })
    .catch((e) => (e && e.code === 1 ? Promise.reject(e) : get({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })));
}

/** Manda la mia posizione al server con l'ora vera del punto (non "adesso"). */
async function inviaPosizione() {
  const pt = await here();
  const { coords } = pt;
  const data = { chi: me(), lat: coords.latitude, lon: coords.longitude, acc: Math.round(coords.accuracy), tst: Math.round((pt.timestamp || Date.now()) / 1000) };
  if (isSynced()) await store.call('posizione', { method: 'POST', body: data });
  else await localSet(data);
  lsSet('casa.dove.inviata', String(Date.now()));
  return data;
}

async function permessoPosizione() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return 'sconosciuto';
    return (await navigator.permissions.query({ name: 'geolocation' })).state; // granted | prompt | denied
  } catch { return 'sconosciuto'; }
}

let invioAuto = null;
/** Con l'interruttore acceso: a ogni apertura (e ogni pochi minuti mentre l'app è aperta) mando la mia posizione. */
export async function automatica() {
  if (invioAuto || lsGet('casa.dove.app') !== '1' || !possoMandare() || document.hidden) return;
  const ultima = Number(lsGet('casa.dove.inviata')) || 0;
  const ogni = location.hash.startsWith('#/dove') ? 2 * MIN : 4 * MIN;
  if (Date.now() - ultima < ogni) return;
  // mai una richiesta di permesso a sorpresa: in automatico solo se il permesso c'è già
  const perm = await permessoPosizione();
  if (perm !== 'granted') return;
  invioAuto = inviaPosizione().catch(() => {}).finally(() => { invioAuto = null; });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(automatica, 1500); });
setInterval(() => automatica(), 60000);

function erroreGps(e) {
  return e && e.code === 1
    ? 'Per mandare la posizione consenti la localizzazione: Impostazioni → Privacy → Localizzazione → Siti web di Safari'
    : e && (e.code === 2 || e.code === 3) ? 'Non trovo la tua posizione adesso: riprova all’aperto o tra poco' : 'Non riesco a salvarla, controlla la connessione';
}

/** Arrivo dalla notifica "X chiede dove sei": chiedo il consenso e solo allora mando la posizione. */
let chiestaAperta = false;
function chiestaCondivisione() {
  if (chiestaAperta || !location.hash.startsWith('#/dove/condividi')) return;
  chiestaAperta = true;
  history.replaceState(null, '', '#/dove');
  const altro = nameOf(me() === 'p1' ? 'p2' : 'p1');
  if (!possoMandare()) { chiestaAperta = false; toast('Da questo dispositivo non si manda la posizione: usa l’iPhone'); return; }
  openSheet({
    title: `${altro} chiede dove sei`,
    body: html`<p class="prose" style="margin-top:-4px">Mando la tua posizione di adesso, una volta sola. Puoi anche non farlo.</p>
      <div class="btn-row"><button class="btn" type="button" data-action="sheet-close">No, grazie</button>
      <button class="btn primary" type="button" id="dove-si">${icon('pin', 'sm')} Condividi</button></div>`,
    onOpen: (root) => root.querySelector('#dove-si').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try { await inviaPosizione(); closeSheet(); vibrate(10); toast('Posizione condivisa'); if (isSynced()) store.sync(); }
      catch (er) { closeSheet(); toast(erroreGps(er), { ms: 6000 }); }
    }),
  });
  setTimeout(() => { chiestaAperta = false; }, 1000);
}

async function localSet(data) {
  const casa = luogoById('casa');
  const home = hasXY(casa) ? distanza(data, casa) <= (casa.r || 150) : null;
  const prev = pos(me()) || {};
  store.set('posizioni', me(), { lat: data.lat, lon: data.lon, acc: data.acc, at: data.tst * 1000, seen: Date.now(), home, homeSince: home !== prev.home ? Date.now() : prev.homeSince || Date.now(), place: home ? 'Casa' : prev.place || '', src: 'app' });
}

function luogoSheet(l = null) {
  const n = settings().names;
  let qui = null;
  openSheet({
    title: l ? l.nome : 'Nuovo posto',
    body: html`
      <label class="field"><span>Nome</span><input name="nome" value="${l ? l.nome : ''}" placeholder="es. Palestra" required ${l ? '' : raw('autofocus')}></label>
      <label class="field"><span>Indirizzo</span><input name="indirizzo" value="${l ? l.indirizzo || '' : ''}" placeholder="es. Via Roma 12, Trento" autocomplete="street-address"></label>
      <div class="field"><span>Di chi</span><div class="radio-chips">
        ${[['both', 'Di tutti e due'], ['p1', n.p1], ['p2', n.p2]].map(([v, t]) => html`<label><input type="radio" name="chi" value="${v}" ${(l ? l.chi || 'both' : 'both') === v ? raw('checked') : ''} ${l && l.id === 'casa' && v !== 'both' ? raw('disabled') : ''}><span>${t}</span></label>`)}
      </div></div>
      <button class="btn block" type="button" id="luogo-qui">${icon('pin', 'sm')} Sono qui adesso: usa questa posizione</button>
      <p class="help" id="luogo-qui-ok" hidden>Posizione presa ✓</p>`,
    extra: l && l.id !== 'casa' ? html`<button class="btn danger" type="button" data-action="luogo-del" data-id="${l.id}" aria-label="Elimina">${icon('trash', 'sm')}</button>` : '',
    onOpen: (root) => {
      const btn = root.querySelector('#luogo-qui');
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const { coords } = await here();
          qui = { lat: coords.latitude, lon: coords.longitude };
          root.querySelector('#luogo-qui-ok').hidden = false;
          root.querySelector('#luogo-qui-ok').textContent = `Posizione presa ✓ (precisione ±${metri(coords.accuracy)})`;
          sheetError('');
          vibrate(10);
        } catch { sheetError('Per farlo serve il permesso alla posizione'); }
        btn.disabled = false;
      });
    },
    onSubmit: async (fd) => {
      const nome = cap(val(fd, 'nome'));
      if (!nome) { sheetError('Dai un nome al posto'); return false; }
      const indirizzo = val(fd, 'indirizzo');
      const data = { id: l ? l.id : uid(), nome, indirizzo, chi: val(fd, 'chi') || 'both', r: l ? l.r || 200 : 200 };
      if (qui) Object.assign(data, qui);
      else if (indirizzo && (!l || indirizzo !== l.indirizzo || !hasXY(l))) {
        if (isSynced()) {
          try { const g = await geocode(indirizzo); Object.assign(data, { lat: g.lat, lon: g.lon }); } catch { sheetError('Non trovo questo indirizzo: aggiungi la città, oppure vai sul posto e tocca “Sono qui adesso”'); return false; }
        }
      } else if (l && hasXY(l)) Object.assign(data, { lat: l.lat, lon: l.lon });
      const list = (settings().luoghi || []).filter((x) => x.id !== data.id);
      const patch = { luoghi: l ? (settings().luoghi || []).map((x) => (x.id === data.id ? data : x)) : [...list, data] };
      if (data.id === 'casa' && hasXY(data)) patch.casaPos = { lat: data.lat, lon: data.lon, r: data.r || 150 };
      saveSettings(patch);
      toast(`${nome} salvato`);
    },
  });
}

export const actions = {
  // Aggiorna: manda la mia posizione (solo da iPhone) e scarica subito quella dell'altro
  'dove-aggiorna': async () => {
    if (ui('dove.busy', false)) return;
    setUi('dove.busy', true);
    const t0 = Date.now();
    let msg = 'Aggiornato';
    try {
      if (possoMandare() || (!isSynced() && me() && !isIPad())) {
        try { await inviaPosizione(); } catch (e) { msg = erroreGps(e); }
      }
      if (isSynced()) await store.sync();
      // l'altro ha una posizione vecchia: lo dico subito, invece di far credere che sia aggiornata
      const altro = me() === 'p1' ? 'p2' : me() === 'p2' ? 'p1' : null;
      if (altro && msg === 'Aggiornato') { const st = statusOf(altro); if (st.p && st.old) msg = `Aggiornato. ${nameOf(altro)}: ultima posizione ${timeAgo(st.p.at)}`; }
    } finally {
      // la rotellina si vede almeno un attimo, così si capisce che ha aggiornato
      await new Promise((ok) => setTimeout(ok, Math.max(0, 700 - (Date.now() - t0))));
      setUi('dove.busy', false);
      const m = document.getElementById('mappa');
      if (m && m._map) setTimeout(() => inquadra(m._map), 60); // dopo che i segnaposti si sono spostati
      vibrate(10);
      toast(msg, { ms: msg.length > 40 ? 6000 : 2500 });
    }
  },
  'dove-manda': async () => {
    try { await inviaPosizione(); vibrate(10); toast('Posizione mandata'); if (isSynced()) await store.sync(); } catch (e) { toast(erroreGps(e), { ms: 6000 }); }
  },
  'dove-chiedi': async () => {
    const altro = nameOf(me() === 'p1' ? 'p2' : 'p1');
    if (!me()) { toast('Prima scegli chi sei in Impostazioni'); return; }
    setUi('dove.chiesto', Date.now());
    try {
      const r = await store.call('posizione', { method: 'POST', body: { chi: me(), chiedi: true } });
      toast(r.inviati ? `Richiesta mandata a ${altro}: deciderà se condividere la posizione` : `${altro} non ha le notifiche attive: meglio scrivere o chiamare`, { ms: 5000 });
    } catch (e) { toast(e && e.message ? e.message : 'Non sono riuscito a mandarla'); }
  },
  'dove-auto': async ({ el }) => {
    if (!el.checked) { lsSet('casa.dove.app', null); toast('Spento: la posizione arriva solo da OwnTracks'); rerender(); return; }
    // il permesso si chiede adesso, con il dito sull'interruttore (mai a sorpresa)
    try {
      await inviaPosizione();
      lsSet('casa.dove.app', '1');
      vibrate(10);
      toast('Attivo: mentre l’app è aperta la tua posizione resta aggiornata');
      if (isSynced()) store.sync();
    } catch (e) {
      el.checked = false;
      toast(erroreGps(e), { ms: 6000 });
    }
    rerender();
  },
  'mappa-tipo': ({ el }) => {
    const v = el.dataset.v === 'satellite' ? 'satellite' : 'mappa';
    if (v === tipoMappa()) return;
    lsSet('casa.mappa', v === 'satellite' ? 'satellite' : null);
    setUi('mappa.tipo', v); // ridisegna: after() si accorge del cambio e aggiorna lo stile
  },
  'mappa-grande': () => apriGrande(),
  'mappa-piccola': () => chiudiGrande(),
  'mappa-centra': () => { const m = document.getElementById('mappa'); if (m && m._map) inquadra(m._map); },
  // tocco sulla scheda di una persona: la mappa vola da lei
  'dove-vai': ({ el }) => {
    const p = pos(el.dataset.k), m = document.getElementById('mappa');
    if (!p || !m || !m._map) return;
    m._map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(m._map.getZoom(), 16.5), duration: 900 });
    m.closest('.map-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
  // l'auto: la sua scheda (dalla riga Auto o toccando l'auto sulla mappa), e "togli" con Annulla
  'auto-info': () => autoSheet(),
  'auto-togli': () => {
    const prima = macchina();
    closeSheet();
    if (!prima) return;
    store.remove('posizioni', 'auto');
    toast('Auto tolta dalla mappa', { undo: () => rimetti(prima) });
  },
  'luogo-new': () => luogoSheet(),
  'luogo-edit': ({ id }) => { const l = (settings().luoghi || []).find((x) => x.id === id); if (l) luogoSheet(luoghi().find((x) => x.id === id)); },
  'luogo-del': ({ id }) => {
    const l = (settings().luoghi || []).find((x) => x.id === id);
    closeSheet();
    if (!l) return;
    confirmSheet({ title: `Togliere “${l.nome}”?`, text: 'Il posto sparisce dalla mappa.', yes: 'Togli', onYes: () => saveSettings({ luoghi: (settings().luoghi || []).filter((x) => x.id !== id) }) });
  },
};
