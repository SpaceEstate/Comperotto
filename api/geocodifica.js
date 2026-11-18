// GET /api/geocodifica?q=Via Roma 12[&lat=..&lon=..] → { lat, lon, nome }
// Trova le coordinate di un indirizzo (OpenStreetMap). Se si passa una posizione vicina,
// cerca prima nei dintorni (in Italia ci sono mille "Via Roma").
//
// GET /api/geocodifica?lat=..&lon=.. (senza q) → { lat, lon, nome } al contrario: l'indirizzo
// di quel punto, con il civico (serve all'auto: "Via Roma 12, Torino").
import { checkAuth, send, sleep } from './_lib.js';
import { luogo } from './_luogo.js';

const UA = { 'User-Agent': 'FamComperotto/1.0 (app di casa per uso familiare)', Accept: 'application/json' };

async function cerca(q, extra = '') {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=it&accept-language=it&q=${encodeURIComponent(q)}${extra}`, { headers: UA, signal: ctrl.signal });
    if (!r.ok) return null;
    const [x] = await r.json();
    if (!x) return null;
    const a = x.address || {};
    const nome = [[a.road, a.house_number].filter(Boolean).join(' '), a.city || a.town || a.village || a.municipality].filter(Boolean).join(', ');
    return { lat: Number(x.lat), lon: Number(x.lon), nome: nome || x.display_name };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  if (!(await checkAuth(req))) { await sleep(400); return send(res, 401, { error: 'Codice di famiglia sbagliato' }); }
  const p = new URL(req.url, 'http://x').searchParams;
  const q = String(p.get('q') || '').trim().slice(0, 160);
  const lat = Number(p.get('lat')), lon = Number(p.get('lon'));
  const punto = p.has('lat') && p.has('lon') && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  if (!q) {
    if (!punto) return send(res, 400, { error: 'Manca l’indirizzo' });
    const nome = await luogo(lat, lon, { preciso: true, attesa: 4000 });
    return nome ? send(res, 200, { lat, lon, nome }) : send(res, 404, { error: 'Indirizzo non trovato' });
  }
  let hit = null;
  if (punto && (lat || lon)) {
    const d = 0.35; // circa 35 km intorno
    hit = await cerca(q, `&viewbox=${lon - d},${lat + d},${lon + d},${lat - d}&bounded=1`);
  }
  if (!hit) hit = await cerca(q);
  if (!hit) return send(res, 404, { error: 'Indirizzo non trovato' });
  send(res, 200, hit);
}
