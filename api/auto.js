// POST /api/auto — "Ho parcheggiato": segna dove è rimasta l'auto. Lo usa il Comando Rapido dell'iPhone
// (tasto Azione, icona sulla schermata Home, Siri, oppure da solo quando ci si scollega da CarPlay).
//
//   Intestazione  x-famiglia: il codice di famiglia   (oppure Basic: nome + codice, come OwnTracks)
//   Corpo JSON    { "chi": "patrick", "lat": 45.0703, "lon": 7.6869 }   ("chi" si può anche non mettere)
//
// Risponde con una frase da mostrare nella notifica del comando ("Auto segnata: Via Roma 12, Torino").
// L'app invece salva l'auto da sola, nella raccolta "posizioni" con id "auto": così funziona anche senza rete.
import { backend, verifyCode, basic, body, sleep } from './_lib.js';
import { luogo } from './_luogo.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
// l'iPhone in italiano può mandare i numeri come testo con la virgola: "45,0703"; vuoto = mancante
const numero = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(',', '.');
  return s ? Number(s) : NaN;
};

function testo(res, status, msg) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(msg);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return testo(res, 405, 'Il comando deve usare il metodo POST');
  const db = backend();
  if (!db) return testo(res, 503, 'Database non collegato');

  const b = body(req);
  const auth = basic(req);
  if (!(await verifyCode(req.headers['x-famiglia'] || auth.pass))) { await sleep(400); return testo(res, 401, 'Codice di famiglia sbagliato'); }

  const lat = numero(b.lat ?? b.latitudine), lon = numero(b.lon ?? b.longitudine);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (!lat && !lon)) {
    return testo(res, 400, 'Posizione mancante: nel comando servono Latitudine e Longitudine');
  }

  try {
    // chi ha parcheggiato: "p1"/"p2" oppure il nome (es. "serena"); se manca o non torna, pazienza
    const raw = String(b.chi || auth.user || '').trim();
    let chi = ['p1', 'p2'].includes(raw) ? raw : null;
    if (!chi && raw) {
      const { items } = await db.collection('settings');
      const names = { p1: 'Patrick', p2: 'Serena', ...((items.main || {}).names || {}) };
      chi = ['p1', 'p2'].find((k) => norm(names[k]) === norm(raw)) || null;
    }
    const acc = numero(b.acc ?? b.precisione);
    const place = await luogo(lat, lon, { preciso: true });
    const doc = { lat, lon, acc: acc > 0 ? Math.round(acc) : null, at: Date.now(), chi, place, nota: '', src: 'comando' };
    await db.apply([{ op: 'set', col: 'posizioni', id: 'auto', data: doc }]);
    testo(res, 200, place ? `Auto segnata: ${place}` : 'Auto segnata sulla mappa');
  } catch (e) {
    console.error(e);
    testo(res, 500, 'Database non raggiungibile: riprova tra poco');
  }
}
