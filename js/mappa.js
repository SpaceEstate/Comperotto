// La mappa di Dov'è, ritoccata per somigliare a quella di Dov'è di Apple:
// - base OpenFreeMap "liberty" (gratis, senza chiavi) con i nomi in italiano
// - attività (bar, negozi, farmacie…) con un pallino colorato per categoria: più si ingrandisce, più ne compaiono
// - i nostri posti (Casa, Lavoro…) trattati come le attività: si vedono solo da vicino
// - "Satellite": foto Esri con sopra strade, nomi e attività disegnati, quindi sempre nitidi
import { iconMarkup } from './icons.js';

const STILI = { chiaro: 'https://tiles.openfreemap.org/styles/liberty', scuro: 'https://tiles.openfreemap.org/styles/dark' };
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const FONT = ['Noto Sans Regular'];
const FONT_B = ['Noto Sans Bold'];
export const Z_POSTI = 14; // da qui in poi si vedono Casa, Lavoro e gli altri posti

// categoria → [colore del pallino, colore della scritta]
const CAT = {
  cibo: ['#F08A3E', '#B4570F'],
  negozi: ['#EDB228', '#8F6B06'],
  salute: ['#E85A5A', '#BC3636'],
  verde: ['#4CAA60', '#2B7840'],
  cultura: ['#D66296', '#A63B6F'],
  scuola: ['#A07C5C', '#77573A'],
  servizi: ['#70809C', '#4C5A75'],
  dormire: ['#8E6ED6', '#6646B4'],
  trasporti: ['#4A90E2', '#2A64AB'],
};

// Tipo di attività → [categoria, zoom da cui compare, icona (se diversa dal nome)].
// Le chiavi sono le "class" di OpenMapTiles; in SUB le "subclass" che fanno eccezione.
const CLS = {
  // i riferimenti della città
  railway: ['trasporti', 13], stadium: ['verde', 13], castle: ['cultura', 13], zoo: ['verde', 13],
  hospital: ['salute', 14], museum: ['cultura', 14], park: ['verde', 14], golf: ['verde', 14],
  campsite: ['verde', 14], aerialway: ['trasporti', 14], harbor: ['trasporti', 14],
  // i servizi di quartiere
  grocery: ['negozi', 15], pharmacy: ['salute', 15], school: ['scuola', 15], college: ['scuola', 15], library: ['scuola', 15], lodging: ['dormire', 15],
  cinema: ['cultura', 15], theatre: ['cultura', 15], attraction: ['cultura', 15], monument: ['cultura', 15],
  town_hall: ['servizi', 15], police: ['servizi', 15], fire_station: ['servizi', 15], fuel: ['trasporti', 15],
  place_of_worship: ['scuola', 15], cemetery: ['scuola', 15], sports_centre: ['verde', 15, 'pitch'],
  // bar, ristoranti e negozi
  restaurant: ['cibo', 16], cafe: ['cibo', 16], bar: ['cibo', 16], beer: ['cibo', 16], fast_food: ['cibo', 16],
  bakery: ['cibo', 16], ice_cream: ['cibo', 16],
  shop: ['negozi', 16], clothing_store: ['negozi', 16], alcohol_shop: ['negozi', 16], butcher: ['negozi', 16],
  bank: ['servizi', 16], post: ['servizi', 16], veterinary: ['salute', 16], garden: ['verde', 16],
  swimming_pool: ['verde', 16, 'swimming'], art_gallery: ['cultura', 16], bus: ['trasporti', 16],
  // tutto il resto
  hairdresser: ['negozi', 17], laundry: ['negozi', 17], music: ['negozi', 17], bicycle: ['negozi', 17],
  doctors: ['salute', 17], dentist: ['salute', 17], office: ['servizi', 17, 'building'], car: ['servizi', 17],
  playground: ['verde', 17], dog_park: ['verde', 17], pitch: ['verde', 17], picnic_site: ['verde', 17],
  parking: ['trasporti', 17], bicycle_rental: ['trasporti', 17], toilets: ['servizi', 17],
};
const SUB = {
  university: ['scuola', 15, 'college'], supermarket: ['negozi', 14, 'grocery'], mall: ['negozi', 14, 'shop'],
  bus_station: ['trasporti', 14, 'bus'], department_store: ['negozi', 15, 'shop'], halt: ['trasporti', 15, 'railway'],
  subway: ['trasporti', 15, 'railway_metro'], tram_stop: ['trasporti', 16, 'railway_light'],
  clinic: ['salute', 16, 'hospital'], kindergarten: ['scuola', 16, 'school'], books: ['negozi', 16, 'library'],
  community_centre: ['servizi', 17, 'town_hall'],
};
const TIPI = { ...CLS, ...SUB };
// cose che sulla mappa non interessano (cassette postali, statue, cartelli…)
const NIENTE = ['post_box', 'artwork', 'board', 'guidepost', 'map', 'terminal', 'subway_entrance'];
// bar, ristoranti e negozi sono tantissimi: uno su tre compare già uno zoom prima, gli altri dopo
const TANTI = ['restaurant', 'cafe', 'bar', 'beer', 'fast_food', 'bakery', 'ice_cream', 'shop', 'clothing_store', 'bank'];
const ZOOM = [13, 14, 15, 16, 17];

const copia = (o) => JSON.parse(JSON.stringify(o));
const raster = (path) => ({ type: 'raster', tiles: [`${ESRI}/${path}/MapServer/tile/{z}/{y}/{x}`], tileSize: 128, maxzoom: 19 });
// tileSize 128: chiede foto di un livello più dettagliato, così sull'iPhone non sono sgranate

// ---------------------------------------------------------------------------
// Lo stile di base (scaricato una volta sola)
// ---------------------------------------------------------------------------
const basi = {};
function base(nome = 'chiaro') {
  if (!basi[nome]) {
    basi[nome] = fetch(STILI[nome]).then((r) => { if (!r.ok) throw new Error('stile'); return r.json(); })
      .catch((e) => { delete basi[nome]; throw e; });
  }
  return basi[nome];
}

// Di sera: la mappa scura di OpenFreeMap è quasi nera, la scaldo con i colori dell'app in modalità scura
const NOTTE = {
  background: { 'background-color': '#1D1A17' },
  water: { 'fill-color': '#16252F' },
  waterway: { 'line-color': '#16252F' },
  landuse_residential: { 'fill-color': '#211E1A', 'fill-opacity': 1 },
  landcover_wood: { 'fill-color': '#1C2A1F' },
  landuse_park: { 'fill-color': '#1F2E22' },
  building: { 'fill-color': '#2A2521', 'fill-outline-color': '#342E29' },
  highway_path: { 'line-color': '#3A342E' },
  highway_minor: { 'line-color': '#3D3731' },
  highway_major_casing: { 'line-color': '#191613' },
  highway_major_inner: { 'line-color': '#4C443B' },
  highway_major_subtle: { 'line-color': '#4C443B' },
  highway_motorway_casing: { 'line-color': '#191613' },
  highway_motorway_inner: { 'line-color': '#6B553C' },
  highway_motorway_subtle: { 'line-color': '#6B553C' },
  railway: { 'line-color': '#3A3530' }, railway_minor: { 'line-color': '#3A3530' }, railway_transit: { 'line-color': '#3A3530' },
  railway_dashline: { 'line-color': '#24201C' }, railway_minor_dashline: { 'line-color': '#24201C' }, railway_transit_dashline: { 'line-color': '#24201C' },
  boundary_state: { 'line-color': '#4A433B' }, 'boundary_country_z0-4': { 'line-color': '#5A5148' }, 'boundary_country_z5-': { 'line-color': '#5A5148' },
};
const SCRITTE_NOTTE = { place: '#DDD3C7', transportation_name: '#A69A8C', water_name: '#6E93AD' };

// ---------------------------------------------------------------------------
// Gli strati delle attività
// ---------------------------------------------------------------------------
const TIPO = ['match', ['get', 'subclass'], Object.keys(SUB), ['get', 'subclass'], ['get', 'class']];
const coppie = (fn) => Object.entries(TIPI).flatMap(([k, v]) => { const x = fn(k, v); return x == null ? [] : [k, x]; });
const perCat = (i) => Object.keys(CAT).flatMap((c) => [Object.keys(TIPI).filter((k) => TIPI[k][0] === c), CAT[c][i]]);
const Z_TIPO = ['match', TIPO, ...coppie((k, v) => v[1]), 99];
// zoom effettivo: uno su tre dei "tanti" anticipa di un livello
const Z_VERO = ['case', ['all', ['match', TIPO, TANTI, true, false], ['==', ['%', ['get', 'rank'], 3], 0]], ['-', Z_TIPO, 1], Z_TIPO];
const ICONA = ['match', TIPO, ...coppie((k, v) => v[2] || null), TIPO];

function stratiAttivita(sat, scuro = false) {
  const strato = (z) => ({
    id: `att-${z}`,
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'poi',
    minzoom: z,
    filter: ['all',
      ['!=', ['coalesce', ['get', 'name'], ''], ''],
      ['match', ['get', 'subclass'], NIENTE, false, true],
      ['==', Z_VERO, z]],
    layout: {
      'icon-image': ['coalesce', ['image', ['concat', 'p-', TIPO]], ['image', ICONA]],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.72, 16, 0.86, 18, 1],
      'icon-padding': ['interpolate', ['linear'], ['zoom'], 14, 10, 17, 3, 19, 1],
      'text-field': ['get', 'name'],
      'text-font': FONT,
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10.5, 17, 11.5, 19, 12.5],
      'text-max-width': 7.5,
      'text-line-height': 1.1,
      'text-variable-anchor': ['top', 'left', 'right', 'bottom'],
      'text-radial-offset': 1.15,
      'text-justify': 'auto',
      'text-padding': ['interpolate', ['linear'], ['zoom'], 14, 8, 17, 3, 19, 1],
      'text-optional': true,
      'symbol-sort-key': ['get', 'rank'],
    },
    paint: sat
      ? { 'text-color': '#fff', 'text-halo-color': 'rgba(15, 15, 15, .8)', 'text-halo-width': 1.3, 'text-halo-blur': 0.4 }
      : scuro
        ? { 'text-color': ['match', TIPO, ...perCat(0), '#aaa'], 'text-halo-color': 'rgba(18, 15, 12, .9)', 'text-halo-width': 1.4, 'text-halo-blur': 0.3 }
        : { 'text-color': ['match', TIPO, ...perCat(1), '#666'], 'text-halo-color': '#fff', 'text-halo-width': 1.4, 'text-halo-blur': 0.3 },
  });
  // in ordine inverso: gli strati più in alto (i posti più importanti) vengono sistemati per primi
  return [
    {
      id: 'civici',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'housenumber',
      minzoom: 17.5,
      layout: { 'text-field': ['get', 'housenumber'], 'text-font': FONT, 'text-size': 10.5, 'text-padding': 4 },
      paint: sat
        ? { 'text-color': '#fff', 'text-halo-color': 'rgba(15, 15, 15, .7)', 'text-halo-width': 1 }
        : scuro
          ? { 'text-color': '#8E857B', 'text-halo-color': 'rgba(18, 15, 12, .9)', 'text-halo-width': 1 }
          : { 'text-color': '#8C857D', 'text-halo-color': '#fff', 'text-halo-width': 1 },
    },
    ...[...ZOOM].reverse().map(strato),
  ];
}

const stratoPosti = (chiara) => ({
  id: 'posti',
  type: 'symbol',
  source: 'posti',
  minzoom: Z_POSTI,
  layout: {
    'icon-image': ['get', 'icona'],
    'icon-allow-overlap': true,
    'text-field': ['get', 'nome'],
    'text-font': FONT_B,
    'text-size': 12.5,
    'text-max-width': 8,
    'text-variable-anchor': ['top', 'right', 'left', 'bottom'],
    'text-radial-offset': 1.5,
    'text-justify': 'auto',
    'text-optional': true,
  },
  paint: chiara
    ? { 'text-color': '#3D3430', 'text-halo-color': '#fff', 'text-halo-width': 1.6 }
    : { 'text-color': '#fff', 'text-halo-color': 'rgba(15, 15, 15, .85)', 'text-halo-width': 1.5 },
});

// nomi in italiano dove esistono ("Monaco di Baviera", non "Munich")
function italiano(x) {
  if (!Array.isArray(x)) return x;
  if (x.length === 2 && x[0] === 'get' && x[1] === 'name_en') return ['get', 'name:it'];
  return x.map(italiano);
}

function stileMappa(b, posti, scuro) {
  const s = copia(b);
  // le attività prendono il posto di quelle originali (o stanno appena sotto i nomi dei paesi)
  let i = s.layers.findIndex((l) => l['source-layer'] === 'poi');
  if (i < 0) i = s.layers.findIndex((l) => l.type === 'symbol' && l['source-layer'] === 'place');
  s.layers = s.layers.filter((l) => l['source-layer'] !== 'poi');
  s.layers.splice(i < 0 ? s.layers.length : i, 0, ...stratiAttivita(false, scuro));
  s.layers.forEach((l) => {
    if (scuro) {
      if (NOTTE[l.id]) l.paint = { ...l.paint, ...NOTTE[l.id] };
      const c = l.type === 'symbol' && SCRITTE_NOTTE[l['source-layer']];
      if (c) l.paint = { ...l.paint, 'text-color': c, 'text-halo-color': 'rgba(18, 15, 12, .85)', 'text-halo-width': 1.2, 'text-halo-blur': 0.4 };
    }
    if (l.layout && l.layout['text-field']) l.layout['text-field'] = italiano(l.layout['text-field']);
    // palazzi in rilievo: da vicino i muri diventerebbero enormi, quindi li abbasso man mano
    if (l.type === 'fill-extrusion') {
      const h = (k) => ['interpolate', ['exponential', 0.5], ['zoom'], 16, ['get', k], 19.5, ['*', 0.09, ['get', k]]];
      l.paint = { ...l.paint, 'fill-extrusion-height': h('render_height'), 'fill-extrusion-base': h('render_min_height') };
    }
  });
  s.sources.posti = { type: 'geojson', data: posti };
  s.layers.push(stratoPosti(!scuro));
  return s;
}

function stileSatellite(b, posti) {
  const grandi = ['motorway', 'trunk', 'primary'];
  const medie = ['secondary', 'tertiary'];
  const largo = (a, m, p) => ['match', ['get', 'class'], grandi, a, medie, m, p];
  // le scritte della mappa disegnata, in bianco per leggersi sulle foto
  const scritte = b.layers
    .filter((l) => l.type === 'symbol' && l['source-layer'] !== 'poi' && !/one_way/.test(l.id))
    .map((l) => {
      const c = copia(l);
      c.layout['text-field'] = italiano(c.layout['text-field']);
      if (!/shield/.test(c.id)) c.paint = { ...c.paint, 'text-color': '#fff', 'text-halo-color': 'rgba(15, 15, 15, .8)', 'text-halo-width': 1.3, 'text-halo-blur': 0.4 };
      return c;
    });
  return {
    version: 8,
    glyphs: b.glyphs,
    sprite: b.sprite,
    sources: { sat: raster('World_Imagery'), openmaptiles: b.sources.openmaptiles, posti: { type: 'geojson', data: posti } },
    layers: [
      { id: 'sat', type: 'raster', source: 'sat' },
      {
        id: 'sat-strade',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 11,
        filter: ['all',
          ['match', ['get', 'class'], [...grandi, ...medie, 'minor', 'service'], true, false],
          ['!=', ['get', 'brunnel'], 'tunnel']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#fff',
          'line-opacity': largo(0.4, 0.32, 0.2),
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, largo(1.2, 0.6, 0.2), 15, largo(4, 3, 1.4), 19, largo(22, 18, 12)],
        },
      },
      ...scritte,
      ...stratiAttivita(true),
      stratoPosti(false),
    ],
  };
}

// se la mappa disegnata non si scarica: almeno le foto, con strade e nomi "stampati"
const SAT_SEMPLICE = {
  version: 8,
  sources: { sat: raster('World_Imagery'), strade: raster('Reference/World_Transportation'), nomi: raster('Reference/World_Boundaries_and_Places') },
  layers: [
    { id: 'sat', type: 'raster', source: 'sat' },
    { id: 'strade', type: 'raster', source: 'strade', paint: { 'raster-opacity': 0.85 } },
    { id: 'nomi', type: 'raster', source: 'nomi' },
  ],
};

/** Lo stile da dare alla mappa: tipo = 'mappa' | 'satellite'; posti = GeoJSON dei nostri posti; scuro = app in modalità scura. */
export async function stile(tipo, posti, scuro = false) {
  try {
    if (tipo === 'satellite') return stileSatellite(await base(), posti);
    return stileMappa(await base(scuro ? 'scuro' : 'chiaro'), posti, scuro);
  } catch { return SAT_SEMPLICE; } // la mappa disegnata non risponde: almeno le foto
}

// ---------------------------------------------------------------------------
// Le icone: pallini colorati per le attività, segnaposti per i nostri posti
// ---------------------------------------------------------------------------
const carica = (src) => new Promise((ok, ko) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => ok(img);
  img.onerror = () => ko(new Error('immagine'));
  img.src = src;
});

/**
 * Dall'icona originale (glifo colorato su tondo bianco, oppure glifo bianco su quadrato blu)
 * ricava un pallino pieno del colore della categoria con il glifo bianco.
 */
function pallino(src, m, colore) {
  const W = 42; // 21 px sullo schermo
  const d = src.getImageData(m.x, m.y, m.width, m.height).data;
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 1, 0, 7); c.fill();
  c.fillStyle = colore;
  c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2.6, 0, 7); c.fill();
  const out = c.getImageData(0, 0, W, W);
  const o = out.data;
  const w = m.width, h = m.height, ox = (W - w) >> 1, oy = (W - h) >> 1;
  const lo = (i) => Math.min(d[i], d[i + 1], d[i + 2]);
  const i0 = (Math.floor(h / 2) * w + 1) * 4;
  const quadrata = d[i0 + 3] > 200 && Math.max(d[i0], d[i0 + 1], d[i0 + 2]) - lo(i0) > 60;
  const fondo = quadrata ? lo(i0) : 0;
  const forza = new Float32Array(w * h);
  let max = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2) > 17.2) continue; // fuori resta l'anello grigio
      const i = (y * w + x) * 4;
      const v = (quadrata ? Math.max(0, lo(i) - fondo) : 255 - lo(i)) * (d[i + 3] / 255);
      forza[y * w + x] = v;
      if (v > max) max = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = Math.min(1, forza[y * w + x] / max);
      const X = x + ox, Y = y + oy;
      if (t <= 0 || X < 0 || Y < 0 || X >= W || Y >= W) continue;
      const j = (Y * W + X) * 4;
      o[j] += (255 - o[j]) * t; o[j + 1] += (255 - o[j + 1]) * t; o[j + 2] += (255 - o[j + 2]) * t;
    }
  }
  return out;
}

// i nostri posti: tondo (casa) o quadrotto (lavoro, altri) pastello con l'icona dell'app
const TINTE = { casa: ['#A5D3A1', '#2D4A2B'], p1: ['#FDE6CF', '#8A4E22'], p2: ['#F0E5FA', '#6A4683'], both: ['#DCECF8', '#3F6C8C'] };
function segnaposto(icona, [fondo, tratto], tondo) {
  const K = 3, S = 38 * K, B = 28 * K; // 38 px con l'ombra, 28 px il segnaposto
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const forma = (lato, r) => {
    const a = (S - lato) / 2;
    c.beginPath();
    if (tondo) c.arc(S / 2, S / 2, lato / 2, 0, 7);
    else { c.moveTo(a + r, a); c.arcTo(a + lato, a, a + lato, a + lato, r); c.arcTo(a + lato, a + lato, a, a + lato, r); c.arcTo(a, a + lato, a, a, r); c.arcTo(a, a, a + lato, a, r); c.closePath(); }
  };
  c.save();
  c.shadowColor = 'rgba(40, 28, 16, .3)'; c.shadowBlur = 3 * K; c.shadowOffsetY = 1.5 * K;
  c.fillStyle = '#fff'; forma(B, 9 * K); c.fill();
  c.restore();
  c.fillStyle = fondo; forma(B - 5 * K, 7 * K); c.fill();
  // l'icona dell'app (24×24, a tratto) al centro
  const lato = 15 * K, k = lato / 24;
  c.translate((S - lato) / 2, (S - lato) / 2); c.scale(k, k);
  c.strokeStyle = tratto; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
  const num = (s, a) => Number((s.match(new RegExp(`\\b${a}="([^"]+)"`)) || [])[1] || 0);
  for (const el of iconMarkup(icona).match(/<(path|circle|rect)[^>]*>/g) || []) {
    if (el.startsWith('<path')) c.stroke(new Path2D((el.match(/\bd="([^"]+)"/) || [])[1] || ''));
    else if (el.startsWith('<circle')) { c.beginPath(); c.arc(num(el, 'cx'), num(el, 'cy'), num(el, 'r'), 0, 7); c.stroke(); }
    else {
      const x = num(el, 'x'), y = num(el, 'y'), w = num(el, 'width'), h = num(el, 'height'), r = num(el, 'rx');
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.stroke();
    }
  }
  return c.getImageData(0, 0, S, S);
}

/** L'icona da usare per un posto: 'casa', oppure lavoro/altro di p1, p2 o di tutti e due. */
export const iconaPosto = (l) => {
  if (l.id === 'casa') return 'posto-casa';
  const chi = l.chi === 'p1' || l.chi === 'p2' ? l.chi : 'both';
  return `posto-${/lavoro/i.test(l.nome) ? 'briefcase' : 'pin'}-${chi}`;
};

let iconeP = null;
/** Tutte le immagini da aggiungere alla mappa: Map id → { data, pixelRatio } (preparate una volta sola). */
export function icone() {
  if (!iconeP) {
    iconeP = (async () => {
      const out = new Map();
      try {
        out.set('posto-casa', { data: segnaposto('home', TINTE.casa, true), pixelRatio: 3 });
        for (const ic of ['briefcase', 'pin']) for (const chi of ['p1', 'p2', 'both']) out.set(`posto-${ic}-${chi}`, { data: segnaposto(ic, TINTE[chi], false), pixelRatio: 3 });
      } catch {}
      try {
        const b = await base();
        const [meta, img] = await Promise.all([fetch(`${b.sprite}@2x.json`).then((r) => r.json()), carica(`${b.sprite}@2x.png`)]);
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        const c = cv.getContext('2d', { willReadFrequently: true });
        c.drawImage(img, 0, 0);
        for (const [k, [cat, , icona]] of Object.entries(TIPI)) {
          const m = meta[icona || k];
          if (m) out.set(`p-${k}`, { data: pallino(c, m, CAT[cat][0]), pixelRatio: 2 });
        }
      } catch {} // senza pallini la mappa usa le icone originali
      return out;
    })();
  }
  return iconeP;
}

/** Aggiunge alla mappa le immagini che mancano (da richiamare a ogni cambio di stile). */
export function mettiIcone(map, imgs) {
  imgs.forEach((im, id) => { try { if (!map.hasImage(id)) map.addImage(id, im.data, { pixelRatio: im.pixelRatio }); } catch {} });
}
