// Dov'è: chi è a casa, al lavoro o fuori, con la mappa. Le posizioni arrivano da OwnTracks (in automatico)
// o da "Aggiorna" (solo da iPhone); per la posizione dal vivo c'è il pulsante per "Dov'è" di Apple.
import { html, raw, timeAgo, vibrate, uid, cap, isIPad, lsGet, lsSet } from '../utils.js';
import { icon } from '../icons.js';
import { state, store, settings, saveSettings, me, nameOf, toast, pageHead, isSynced, openSheet, closeSheet, sheetError, val, confirmSheet, ui, setUi } from '../core.js';

const PEOPLE = ['p1', 'p2'];
const pos = (k) => state.data.posizioni.find((p) => p.id === k && Number.isFinite(p.lat));
const initialOf = (k) => (nameOf(k) || '?')[0].toUpperCase();
const hasXY = (l) => l && Number.isFinite(l.lat) && Number.isFinite(l.lon);

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const distanza = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** I nostri posti; la casa "segnata qui" ha la precedenza sull'indirizzo. */
export function luoghi() {
  const s = settings();
  return (s.luoghi || []).map((l) => (l.id === 'casa' && s.casaPos && hasXY(s.casaPos) ? { ...l, lat: s.casaPos.lat, lon: s.casaPos.lon } : l));
}
const luogoById = (id) => luoghi().find((l) => l.id === id);
const ownerOf = (l) => (l.chi === 'p1' || l.chi === 'p2' ? nameOf(l.chi) : '');

/** Dove si trova rispetto ai nostri posti (calcolato anche qui, così vale subito se i posti cambiano) */
function where(k, p) {
  const posti = luoghi().filter((l) => hasXY(l) && (l.id === 'casa' || l.chi === 'both' || l.chi === k || !l.chi));
  if (!posti.length) return { home: p.home, luogo: p.luogo || null };
  const casa = posti.find((l) => l.id === 'casa');
  const home = casa ? distanza(p, casa) <= (casa.r || 150) : p.home;
  if (home) return { home: true, luogo: 'casa' };
  const l = posti.filter((x) => x.id !== 'casa').find((x) => distanza(p, x) <= (x.r || 200));
  return { home: casa ? false : p.home, luogo: l ? l.id : null };
}

/** "A casa da 2 ore", "Al lavoro", "Fuori · Via Roma, Torino" */
/** "da 10 min", "da 4 h", "da 2 giorni" */
export function durata(t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 2) return 'da poco';
  if (m < 60) return `da ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `da ${h} h`;
  const g = Math.floor(h / 24);
  return g === 1 ? 'da 1 giorno' : `da ${g} giorni`;
}

/** "A casa da 4 h", "Al lavoro da 2 h", "Fuori da 10 min · Via Roma, Torino" */
export function statusOf(k) {
  const raw = pos(k);
  if (!raw) return { cls: '', label: 'Posizione non ancora condivisa', since: '', place: '', stale: true };
  const w = where(k, raw);
  const p = { ...raw, home: w.home, luogo: w.luogo };
  const old = Date.now() - p.at > 6 * 3600 * 1000;
  // da quando è in quello stato: lo sa il server se lo stato coincide, altrimenti dall'ultima posizione
  if (p.home === true) return { cls: 'home', label: 'A casa', since: durata(raw.home === true ? raw.homeSince || raw.at : raw.at), place: '', stale: old, p };
  const l = p.luogo && p.luogo !== 'casa' ? luogoById(p.luogo) : null;
  if (l) return { cls: 'work', label: /lavoro/i.test(l.nome) ? 'Al lavoro' : l.nome, since: durata(raw.luogo === l.id ? raw.luogoSince || raw.at : raw.at), place: '', stale: old, p };
  const place = raw.luogo && raw.place && /^(casa|lavoro)$/i.test(raw.place) ? '' : p.place;
  if (p.home === false) return { cls: 'out', label: 'Fuori', since: durata(!raw.luogo && raw.home === false ? raw.luogoSince || raw.homeSince || raw.at : raw.at), place, stale: old, p };
  return { cls: '', label: place || 'Posizione', since: '', place: '', stale: old, p };
}
export const pillOf = (st) => (st.cls === 'home' ? 'ok' : st.cls === 'work' ? 'today' : st.cls === 'out' ? 'soon' : '');
export const iconOf = (st) => (st.cls === 'home' ? 'home' : st.cls === 'work' ? 'briefcase' : 'pin');

export function personBadge(k) {
  return html`<span class="who-pin ${k}">${initialOf(k)}</span>`;
}

const mapsUrl = (p, name) => `https://maps.apple.com/?ll=${p.lat},${p.lon}&q=${encodeURIComponent(name)}`;

export function render() {
  const any = PEOPLE.some((k) => pos(k)) || luoghi().some(hasXY);
  const posti = luoghi();
  return html`
    <a class="back-link phone-only" href="#/">${icon('left', 'sm')} Home</a>
    ${pageHead('Dov’è', { eyebrow: `${nameOf('p1')} e ${nameOf('p2')}` })}

    ${any ? html`<div class="map-card"><div id="mappa" class="mappa" data-keep></div>
      <div class="map-tools">
        <div class="map-switch">${[['mappa', 'Mappa'], ['satellite', 'Satellite']].map(([v, t]) => html`<button class="${tipoMappa() === v ? 'on' : ''}" data-action="mappa-tipo" data-v="${v}">${t}</button>`)}</div>
        <button class="map-btn" data-action="mappa-centra" aria-label="Mostra tutti">${icon('users', 'sm')}</button>
      </div></div>` : ''}

    <div class="dove-list">${PEOPLE.map((k) => {
      const st = statusOf(k);
      return html`<section class="card dove-card ${st.stale ? 'stale' : ''}">
        ${personBadge(k)}
        <div class="dove-main">
          <b>${nameOf(k)}</b>
          <div class="dove-status">
            ${st.p ? html`<span class="pill ${pillOf(st)}">${icon(iconOf(st), 'xs')} ${st.label}${st.since ? ` ${st.since}` : ''}</span>` : html`<span class="muted small">${st.label}</span>`}
          </div>
          ${st.place ? html`<p class="dove-place">${st.place}</p>` : ''}
          ${st.p ? html`<p class="dove-sub">Aggiornato ${timeAgo(st.p.at)}${st.p.batt != null ? html` · ${icon('battery', 'xs')} ${st.p.batt}%` : ''}</p>` : ''}
        </div>
        ${st.p ? html`<a class="icon-btn" href="${mapsUrl(st.p, nameOf(k))}" target="_blank" rel="noopener" aria-label="Apri ${nameOf(k)} in Mappe">${icon('map', 'sm')}</a>` : ''}
      </section>`;
    })}</div>

    <div class="btn-row dove-actions">
      <button class="btn" data-action="dove-aggiorna" ${ui('dove.busy', false) ? raw('disabled') : ''}>${icon('refresh', ui('dove.busy', false) ? 'sm spin' : 'sm')} ${ui('dove.busy', false) ? 'Aggiorno…' : 'Aggiorna'}</button>
      <a class="btn primary" href="findmy://">${icon('search', 'sm')} Apri Dov’è</a>
    </div>

    <div class="section-title"><span>I nostri posti</span></div>
    <div class="list">${posti.map((l) => html`
      <button class="row" data-action="luogo-edit" data-id="${l.id}">
        <span class="chore-ico dot-ico ${l.id === 'casa' ? 'tone-sage' : 'tone-oak'}">${icon(l.id === 'casa' ? 'home' : /lavoro/i.test(l.nome) ? 'briefcase' : 'pin')}</span>
        <span class="row-main"><span class="row-title">${l.nome}${ownerOf(l) ? html` <span class="muted" style="font-weight:500">· ${ownerOf(l)}</span>` : ''}</span>
          <span class="row-sub">${l.indirizzo || (hasXY(l) ? 'Segnato sulla mappa' : 'Tocca per aggiungere l’indirizzo')}${hasXY(l) || !l.indirizzo ? '' : l.geoFail ? html` · <b style="color:var(--rose)">da sistemare</b>` : ' · cerco sulla mappa…'}</span></span>
        ${icon('right', 'sm')}
      </button>`)}
      <button class="row" data-action="luogo-new"><span class="chore-ico dot-ico tone-sky">${icon('plus')}</span><span class="row-main"><span class="row-title">Aggiungi un posto</span><span class="row-sub">Palestra, genitori, scuola…</span></span></button>
    </div>`;
}

// ---------------------------------------------------------------------------
// Mappa vettoriale (MapLibre, dentro l'app): nitida a ogni zoom, come quella di Dov'è.
// "Mappa" = OpenFreeMap (gratis, senza chiavi); "Satellite" = foto Esri con strade e nomi.
// ---------------------------------------------------------------------------
const STYLE_MAPPA = 'https://tiles.openfreemap.org/styles/liberty';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const raster = (path) => ({ type: 'raster', tiles: [`${ESRI}/${path}/MapServer/tile/{z}/{y}/{x}`], tileSize: 128, maxzoom: 19 });
// tileSize 128: chiede foto di un livello più dettagliato, così sull'iPhone non sono sgranate
const STYLE_SAT = {
  version: 8,
  sources: { sat: raster('World_Imagery'), strade: raster('Reference/World_Transportation'), nomi: raster('Reference/World_Boundaries_and_Places') },
  layers: [
    { id: 'sat', type: 'raster', source: 'sat' },
    { id: 'strade', type: 'raster', source: 'strade', paint: { 'raster-opacity': 0.85 } },
    { id: 'nomi', type: 'raster', source: 'nomi' },
  ],
};
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
      js.onerror = () => { mlgl = null; ko(new Error('mappa non disponibile')); };
      document.head.appendChild(js);
    });
  }
  return mlgl;
}

function punti() {
  const pts = [];
  luoghi().filter(hasXY).forEach((l) => pts.push({ kind: 'luogo', l, ll: [l.lon, l.lat] }));
  PEOPLE.forEach((k) => { const p = pos(k); if (p) pts.push({ kind: 'persona', k, ll: [p.lon, p.lat] }); });
  return pts;
}

function inquadra(map, pts, animate = true) {
  if (!pts.length) return;
  if (pts.length === 1) { map.jumpTo({ center: pts[0].ll, zoom: 15 }); return; }
  const lons = pts.map((x) => x.ll[0]), lats = pts.map((x) => x.ll[1]);
  map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 56, maxZoom: 16, animate });
}

function markerEl(x) {
  const el = document.createElement('div');
  if (x.kind === 'persona') {
    el.innerHTML = `<span class="pin-person ${x.k}">${initialOf(x.k)}</span>`;
    el.title = nameOf(x.k);
  } else {
    const l = x.l;
    const cls = l.id === 'casa' ? 'pin-home' : `pin-place ${l.chi === 'p1' || l.chi === 'p2' ? l.chi : ''}`;
    const ic = l.id === 'casa' ? 'home' : /lavoro/i.test(l.nome) ? 'briefcase' : 'pin';
    el.innerHTML = `<span class="${cls}">${icon(ic, 'sm').s}</span>`;
    el.title = `${l.nome}${ownerOf(l) ? ` · ${ownerOf(l)}` : ''}`;
  }
  return el;
}

export async function after() {
  ensureCoords();
  const el = document.getElementById('mappa');
  if (!el) return;
  let ml;
  try { ml = await loadMapLibre(); } catch { el.classList.add('no-map'); return; }
  if (!el.isConnected) return;
  const pts = punti();
  if (!el._map) {
    const tipo = tipoMappa();
    const map = new ml.Map({
      container: el,
      style: tipo === 'satellite' ? STYLE_SAT : STYLE_MAPPA,
      center: pts.length ? pts[pts.length - 1].ll : [12.5, 42.5],
      zoom: pts.length ? 14 : 5,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxZoom: 19.5,
    });
    map.touchZoomRotate.disableRotation();
    // se la mappa disegnata non arriva, passo al satellite
    let loaded = false;
    map.on('load', () => { loaded = true; });
    map.on('error', () => { if (!loaded && tipoMappa() === 'mappa' && !el._fallback) { el._fallback = true; map.setStyle(STYLE_SAT); } });
    el._map = map;
    el._markers = [];
    inquadra(map, pts, false);
  }
  // segnaposti (restano anche cambiando mappa/satellite)
  const key = JSON.stringify(pts.map((x) => [x.kind, x.k || x.l.id, x.ll]));
  if (key !== el._key) {
    el._markers.forEach((m) => m.remove());
    el._markers = pts.map((x) => new ml.Marker({ element: markerEl(x), anchor: x.kind === 'persona' ? 'bottom' : 'center' }).setLngLat(x.ll).addTo(el._map));
    if (el._key === undefined || el._refit) { inquadra(el._map, pts); el._refit = false; }
    el._key = key;
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

function here() {
  const get = (opts) => new Promise((ok, ko) => navigator.geolocation.getCurrentPosition(ok, ko, opts));
  if (!navigator.geolocation) return Promise.reject(Object.assign(new Error('no'), { code: 2 }));
  // prima precisa; se non arriva in tempo (es. in casa), va bene anche meno precisa
  return get({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
    .catch((e) => (e && e.code === 1 ? Promise.reject(e) : get({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })));
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
    extra: l && l.id !== 'casa' ? html`<button class="btn danger" type="button" data-action="luogo-del" data-id="${l.id}">${icon('trash', 'sm')}</button>` : '',
    onOpen: (root) => {
      root.querySelector('#luogo-qui').addEventListener('click', async (ev) => {
        ev.currentTarget.disabled = true;
        try {
          const { coords } = await here();
          qui = { lat: coords.latitude, lon: coords.longitude };
          root.querySelector('#luogo-qui-ok').hidden = false;
          vibrate(10);
        } catch { sheetError('Per farlo serve il permesso alla posizione'); }
        ev.currentTarget.disabled = false;
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
      if (!isIPad() && me()) {
        try {
          const { coords } = await here();
          const data = { chi: me(), lat: coords.latitude, lon: coords.longitude, acc: Math.round(coords.accuracy), tst: Math.round(Date.now() / 1000) };
          if (isSynced()) await store.call('posizione', { method: 'POST', body: data });
          else await actions['dove-io-local'](data);
        } catch (e) {
          msg = e && e.code === 1
            ? 'Per mandare la tua posizione consenti la localizzazione: Impostazioni → Privacy → Localizzazione → Siti web di Safari'
            : e && (e.code === 2 || e.code === 3) ? 'Non trovo la tua posizione adesso: ho aggiornato solo quella degli altri' : 'Non riesco a salvarla, riprova tra poco';
        }
      }
      if (isSynced()) await store.sync();
      const m = document.getElementById('mappa');
      if (m) m._refit = true;
    } finally {
      // la rotellina si vede almeno un attimo, così si capisce che ha aggiornato
      await new Promise((ok) => setTimeout(ok, Math.max(0, 700 - (Date.now() - t0))));
      setUi('dove.busy', false);
      vibrate(10);
      toast(msg, { ms: msg.length > 40 ? 6000 : 2500 });
    }
  },
  'mappa-tipo': ({ el }) => {
    const v = el.dataset.v === 'satellite' ? 'satellite' : 'mappa';
    lsSet('casa.mappa', v === 'satellite' ? 'satellite' : null);
    const m = document.getElementById('mappa');
    if (m && m._map) m._map.setStyle(v === 'satellite' ? STYLE_SAT : STYLE_MAPPA);
    setUi('mappa.tipo', v);
  },
  'mappa-centra': () => { const m = document.getElementById('mappa'); if (m && m._map) inquadra(m._map, punti()); },
  'dove-io-local': async (data) => {
    const casa = luogoById('casa');
    const home = hasXY(casa) ? distanza(data, casa) <= (casa.r || 150) : null;
    const prev = pos(me()) || {};
    store.set('posizioni', me(), { lat: data.lat, lon: data.lon, acc: data.acc, at: Date.now(), home, homeSince: home !== prev.home ? Date.now() : prev.homeSince || Date.now(), place: home ? 'Casa' : prev.place || '', src: 'app' });
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
