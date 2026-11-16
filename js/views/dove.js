// Dov'è: chi è a casa e chi è fuori, con la mappa. Le posizioni arrivano da OwnTracks (in automatico)
// o da "Aggiorna la mia posizione"; per la posizione dal vivo c'è il pulsante per "Dov'è" di Apple.
import { html, timeAgo, vibrate } from '../utils.js';
import { icon } from '../icons.js';
import { state, store, settings, saveSettings, me, nameOf, toast, pageHead, isSynced } from '../core.js';

const PEOPLE = ['p1', 'p2'];
const pos = (k) => state.data.posizioni.find((p) => p.id === k && Number.isFinite(p.lat));
const initialOf = (k) => (nameOf(k) || '?')[0].toUpperCase();

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const distanza = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** "A casa da 2 ore", "Fuori · Via Roma, Torino", con l'ora dell'ultimo aggiornamento */
export function statusOf(k) {
  const p = pos(k);
  if (!p) return { cls: '', label: 'Posizione non ancora condivisa', sub: '', stale: true };
  const old = Date.now() - p.at > 6 * 3600 * 1000;
  if (p.home === true) return { cls: 'home', label: 'A casa', sub: `da ${timeAgo(p.homeSince || p.at).replace(' fa', '')}`, stale: old, p };
  return { cls: p.home === false ? 'out' : '', label: p.home === false ? 'Fuori' : (p.place || 'Posizione'), sub: p.home === false && p.place ? p.place : '', stale: old, p };
}

export function personBadge(k) {
  return html`<span class="who-pin ${k}">${initialOf(k)}</span>`;
}

const mapsUrl = (p, name) => `https://maps.apple.com/?ll=${p.lat},${p.lon}&q=${encodeURIComponent(name)}`;

export function render() {
  const s = settings();
  const any = PEOPLE.some((k) => pos(k));
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
            ${st.p ? html`<span class="pill ${st.cls === 'home' ? 'ok' : st.cls === 'out' ? 'soon' : ''}">${icon(st.cls === 'home' ? 'home' : 'pin', 'xs')} ${st.label}</span>` : html`<span class="muted small">${st.label}</span>`}
            ${st.sub ? html`<span class="small">${st.sub}</span>` : ''}
          </div>
          ${st.p ? html`<p class="dove-sub">Aggiornato ${timeAgo(st.p.at)}${st.p.batt != null ? html` · ${icon('battery', 'xs')} ${st.p.batt}%` : ''}</p>` : ''}
        </div>
        ${st.p ? html`<a class="icon-btn" href="${mapsUrl(st.p, nameOf(k))}" target="_blank" rel="noopener" aria-label="Apri ${nameOf(k)} in Mappe">${icon('map', 'sm')}</a>` : ''}
      </section>`;
    })}</div>

    <div class="btn-row dove-actions">
      <button class="btn" data-action="dove-io">${icon('pin', 'sm')} Aggiorna la mia</button>
      <a class="btn primary" href="findmy://">${icon('search', 'sm')} Apri Dov’è</a>
    </div>
    <p class="muted small" style="text-align:center;margin:14px 0 0">${s.casaPos
      ? html`Casa impostata · <button class="card-link" data-action="dove-casa" style="font-size:inherit">cambia</button>`
      : html`<button class="card-link" data-action="dove-casa">${icon('home', 'xs')} Sei a casa? Tocca qui per segnarla sulla mappa</button>`}</p>`;
}

// ---------------------------------------------------------------------------
// Mappa (Leaflet + OpenStreetMap), caricata solo quando serve
// ---------------------------------------------------------------------------
let leaflet = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leaflet) {
    leaflet = new Promise((ok, ko) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      js.onload = () => ok(window.L);
      js.onerror = () => { leaflet = null; ko(new Error('mappa non disponibile')); };
      document.head.appendChild(js);
    });
  }
  return leaflet;
}

const dark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);

export async function after() {
  const el = document.getElementById('mappa');
  if (!el) return;
  let L;
  try { L = await loadLeaflet(); } catch { el.classList.add('no-map'); return; }
  if (!el.isConnected) return;
  if (!el._map) {
    const map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/${dark() ? 'dark_all' : 'voyager'}/{z}/{x}/{y}{r}.png`, {
      maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO',
    }).addTo(map);
    map.attributionControl.setPrefix('');
    el._map = map;
    el._layer = L.layerGroup().addTo(map);
  }
  const map = el._map;
  const layer = el._layer;
  layer.clearLayers();
  const pts = [];
  const s = settings();
  if (s.casaPos && Number.isFinite(s.casaPos.lat)) {
    L.marker([s.casaPos.lat, s.casaPos.lon], { icon: L.divIcon({ className: 'pin-wrap', html: `<span class="pin-home">${icon('home', 'sm').s}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] }), keyboard: false }).addTo(layer);
    pts.push([s.casaPos.lat, s.casaPos.lon]);
  }
  PEOPLE.forEach((k) => {
    const p = pos(k);
    if (!p) return;
    L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'pin-wrap', html: `<span class="pin-person ${k}">${initialOf(k)}</span>`, iconSize: [42, 50], iconAnchor: [21, 48] }), title: nameOf(k) }).addTo(layer);
    pts.push([p.lat, p.lon]);
  });
  const key = JSON.stringify(pts);
  if (key !== el._fit) {
    el._fit = key;
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length) map.fitBounds(pts, { padding: [46, 46], maxZoom: 16 });
  }
  setTimeout(() => map.invalidateSize(), 50);
}

// ---------------------------------------------------------------------------
function here() {
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) { ko(new Error('no')); return; }
    navigator.geolocation.getCurrentPosition(ok, ko, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}

export const actions = {
  'dove-io': async ({ el }) => {
    if (!me()) return;
    el.disabled = true;
    try {
      const { coords } = await here();
      const data = { chi: me(), lat: coords.latitude, lon: coords.longitude, acc: Math.round(coords.accuracy), tst: Math.round(Date.now() / 1000) };
      if (isSynced()) {
        await store.call('posizione', { method: 'POST', body: data });
        await store.sync();
      } else {
        const s = settings();
        const home = s.casaPos ? distanza(data, s.casaPos) <= (s.casaPos.r || 150) : null;
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
  'dove-casa': async () => {
    try {
      const { coords } = await here();
      saveSettings({ casaPos: { lat: coords.latitude, lon: coords.longitude, r: 150 } });
      vibrate(12);
      toast('Casa segnata sulla mappa');
    } catch {
      toast('Per farlo serve il permesso alla posizione');
    }
  },
};
