// Dov'è: chi è a casa, al lavoro o fuori, con la mappa. Le posizioni arrivano da OwnTracks (in automatico)
// o da "Aggiorna la mia"; per la posizione dal vivo c'è il pulsante per "Dov'è" di Apple.
import { html, raw, timeAgo, vibrate, uid, cap, isIPad } from '../utils.js';
import { icon } from '../icons.js';
import { state, store, settings, saveSettings, me, nameOf, toast, pageHead, isSynced, openSheet, closeSheet, sheetError, val, confirmSheet } from '../core.js';

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

    ${any ? html`<div class="map-card"><div id="mappa" class="mappa" data-keep></div></div>` : ''}

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
      ${isIPad() ? '' : html`<button class="btn" data-action="dove-io">${icon('pin', 'sm')} Aggiorna la mia</button>`}
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
// Mappa (Leaflet, dentro l'app) con le mappe di OpenStreetMap
// ---------------------------------------------------------------------------
let leaflet = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leaflet) {
    leaflet = new Promise((ok, ko) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'js/vendor/leaflet/leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'js/vendor/leaflet/leaflet.js';
      js.onload = () => ok(window.L);
      js.onerror = () => { leaflet = null; ko(new Error('mappa non disponibile')); };
      document.head.appendChild(js);
    });
  }
  return leaflet;
}

const dark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);

function tiles(L, map) {
  const carto = L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/${dark() ? 'dark_all' : 'voyager'}/{z}/{x}/{y}{r}.png`, {
    maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO',
  }).addTo(map);
  // se le mappe colorate non arrivano, passo a quelle classiche di OpenStreetMap
  let errors = 0;
  carto.on('tileerror', () => {
    if (++errors !== 4) return;
    map.removeLayer(carto);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  });
}

export async function after() {
  ensureCoords();
  const el = document.getElementById('mappa');
  if (!el) return;
  let L;
  try { L = await loadLeaflet(); } catch { el.classList.add('no-map'); return; }
  if (!el.isConnected) return;
  if (!el._map) {
    const map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    map.attributionControl.setPrefix('');
    tiles(L, map);
    el._map = map;
    el._layer = L.layerGroup().addTo(map);
  }
  const map = el._map;
  const layer = el._layer;
  layer.clearLayers();
  const pts = [];
  luoghi().filter(hasXY).forEach((l) => {
    const cls = l.id === 'casa' ? 'pin-home' : `pin-place ${l.chi === 'p1' || l.chi === 'p2' ? l.chi : ''}`;
    const ic = l.id === 'casa' ? 'home' : /lavoro/i.test(l.nome) ? 'briefcase' : 'pin';
    L.marker([l.lat, l.lon], {
      icon: L.divIcon({ className: 'pin-wrap', html: `<span class="${cls}">${icon(ic, 'sm').s}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
      title: `${l.nome}${ownerOf(l) ? ` · ${ownerOf(l)}` : ''}`, keyboard: false,
    }).addTo(layer);
    pts.push([l.lat, l.lon]);
  });
  PEOPLE.forEach((k) => {
    const p = pos(k);
    if (!p) return;
    L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'pin-wrap', html: `<span class="pin-person ${k}">${initialOf(k)}</span>`, iconSize: [42, 50], iconAnchor: [21, 48] }), title: nameOf(k), zIndexOffset: 500 }).addTo(layer);
    pts.push([p.lat, p.lon]);
  });
  const key = JSON.stringify(pts);
  if (key !== el._fit) {
    el._fit = key;
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length) map.fitBounds(pts, { padding: [46, 46], maxZoom: 16 });
  }
  setTimeout(() => map.invalidateSize(), 60);
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
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) { ko(new Error('no')); return; }
    navigator.geolocation.getCurrentPosition(ok, ko, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
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
  'dove-io': async ({ el }) => {
    if (!me() || isIPad()) return; // solo gli iPhone dicono dove siete
    el.disabled = true;
    try {
      const { coords } = await here();
      const data = { chi: me(), lat: coords.latitude, lon: coords.longitude, acc: Math.round(coords.accuracy), tst: Math.round(Date.now() / 1000) };
      if (isSynced()) {
        await store.call('posizione', { method: 'POST', body: data });
        await store.sync();
      } else {
        const casa = luogoById('casa');
        const home = hasXY(casa) ? distanza(data, casa) <= (casa.r || 150) : null;
        const prev = pos(me()) || {};
        store.set('posizioni', me(), { lat: data.lat, lon: data.lon, acc: data.acc, at: Date.now(), home, homeSince: home !== prev.home ? Date.now() : prev.homeSince || Date.now(), place: home ? 'Casa' : prev.place || '', src: 'app' });
      }
      vibrate(12);
      toast('Posizione aggiornata');
    } catch {
      toast('Per farlo serve il permesso alla posizione');
    } finally {
      el.disabled = false;
    }
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
