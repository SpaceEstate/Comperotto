// POST /api/posizione — riceve la posizione da OwnTracks (o dall'app stessa) e aggiorna "Dov'è".
//
// OwnTracks (iPhone): Impostazioni → Mode: HTTP, URL: https://…/api/posizione,
// Authentication: UserID = il proprio nome (es. "serena"), Password = codice di famiglia.
// L'app invece manda l'intestazione x-famiglia e { chi: "p1" | "p2", lat, lon, … }.
//
// Si tiene solo l'ultima posizione di ciascuno (niente storico).
import { backend, verifyCode, body, send, sleep } from './_lib.js';

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
export function distanza(a, b) {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const tid = (name) => (norm(name).replace(/[^a-z]/g, '').slice(0, 2) || 'xx').toUpperCase();

/** "Via Roma, Torino" dalle coordinate (OpenStreetMap), con un limite di tempo. */
async function luogo(lat, lon) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=17&accept-language=it&lat=${lat}&lon=${lon}`, {
      headers: { 'User-Agent': 'FamComperotto/1.0 (app di casa per uso familiare)', Accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return '';
    const j = await r.json();
    const a = j.address || {};
    const via = a.road || a.pedestrian || a.square || a.neighbourhood || a.suburb || '';
    const citta = a.city || a.town || a.village || a.municipality || a.county || '';
    return [via, citta].filter(Boolean).join(', ') || (j.display_name || '').split(',').slice(0, 2).join(',').trim();
  } catch {
    return '';
  }
}

function basic(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return {};
  try {
    const [user, ...rest] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':');
    return { user, pass: rest.join(':') };
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non permesso' });
  const db = backend();
  if (!db) return send(res, 503, { error: 'Database non collegato' });

  const b = body(req);
  const auth = basic(req);
  const q = new URL(req.url, 'http://x').searchParams;
  const code = req.headers['x-famiglia'] || auth.pass || q.get('codice');
  if (!(await verifyCode(code))) { await sleep(400); return send(res, 401, { error: 'Codice di famiglia sbagliato' }); }

  try {
    const [{ items: sett }, { items: pos }] = await Promise.all([db.collection('settings'), db.collection('posizioni')]);
    const s = sett.main || {};
    const names = { p1: 'Patrick', p2: 'Serena', ...(s.names || {}) };
    // chi è? "p1"/"p2" oppure il nome (es. "serena")
    const raw = b.chi || auth.user || q.get('chi') || req.headers['x-limit-u'] || '';
    const who = ['p1', 'p2'].includes(raw) ? raw : Object.keys(names).find((k) => norm(names[k]) === norm(raw));
    if (!who) return send(res, 400, { error: 'Utente sconosciuto: usa il tuo nome' });

    const type = b._type || 'location';
    const prev = pos[who] || {};
    if (['location', 'transition'].includes(type) && Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lon))) {
      const lat = Number(b.lat), lon = Number(b.lon);
      const at = b.tst ? Number(b.tst) * 1000 : Date.now();
      if (!prev.at || at >= prev.at - 60000) {
        // i nostri posti (casa, lavoro…) segnati nell'app; la casa "segnata qui" ha la precedenza
        const posti = (Array.isArray(s.luoghi) ? s.luoghi : []).filter((l) => l && Number.isFinite(l.lat) && (l.chi === 'both' || l.chi === who || !l.chi));
        const casa = s.casaPos && Number.isFinite(s.casaPos.lat) ? { ...s.casaPos, id: 'casa' } : posti.find((l) => l.id === 'casa');
        let home = casa ? distanza({ lat, lon }, casa) <= (Number(casa.r) || 150) : null;
        const regions = (b.inregions || []).map(norm);
        if (regions.some((r) => r.includes('casa') || r.includes('home'))) home = true;
        if (type === 'transition' && /casa|home/i.test(b.desc || '')) home = b.event === 'enter';
        const qui = home ? null : posti.filter((l) => l.id !== 'casa').find((l) => distanza({ lat, lon }, l) <= (Number(l.r) || 200));
        const luogoId = home ? 'casa' : qui ? qui.id : null;
        const moved = !prev.lat || distanza(prev, { lat, lon }) > 120;
        const place = home ? 'Casa' : qui ? qui.nome : moved || !prev.place || prev.luogo ? (await luogo(lat, lon)) || prev.place || '' : prev.place;
        const doc = {
          lat, lon, at,
          acc: Number(b.acc) || null,
          batt: Number.isFinite(Number(b.batt)) ? Number(b.batt) : prev.batt ?? null,
          home,
          homeSince: home !== prev.home ? at : prev.homeSince || at,
          luogo: luogoId,
          luogoSince: luogoId !== (prev.luogo ?? null) ? at : prev.luogoSince || at,
          place,
          src: b.chi ? 'app' : 'owntracks',
        };
        await db.apply([{ op: 'set', col: 'posizioni', id: who, data: doc }]);
        pos[who] = doc;
      }
    }

    // a OwnTracks rimando la posizione dell'altro, così vi vedete anche lì
    const other = who === 'p1' ? 'p2' : 'p1';
    const o = pos[other];
    const out = [{ _type: 'card', tid: tid(names[other]), name: names[other] }];
    if (o && o.lat) out.push({ _type: 'location', tid: tid(names[other]), lat: o.lat, lon: o.lon, tst: Math.round(o.at / 1000), acc: o.acc || 50, ...(o.batt != null ? { batt: o.batt } : {}) });
    send(res, 200, out);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Database non raggiungibile' });
  }
}
