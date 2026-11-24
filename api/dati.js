// Dati di casa, protetti dal codice di famiglia (intestazione "x-famiglia").
//   GET  /api/dati            → versioni delle raccolte { v: { spesa: 12, … } }
//   GET  /api/dati?col=spesa  → { v, items: { id: {…} } }
//        &pagine=1[&da=<id>]  → a pagine di qualche MB al massimo (Vercel non manda risposte oltre 4,5 MB):
//                               { v, items, prossimo } finché c'è "prossimo"
//        &dal=<versione>      → solo i documenti cambiati dopo quella versione: { v, items, tolti, pezzi: true }
//                               (se è troppo vecchia, o il database non lo sa fare, arriva tutto come prima)
//   GET  /api/dati?visti=1    → { visti, notifiche } chi ha usato l'app e quando, notifiche di ogni dispositivo
//   GET  /api/dati?widget=1   → il riassunto per il widget della schermata Home (spesa, faccende di oggi, rifiuti):
//                               vedi api/_widget.js e scriptable/Comperotto.js
//   POST /api/dati { ops: [{ op: set|update|remove|bump|wipe, col, id, data }] }
//        una modifica non valida → 400 { error, indice } (l'app toglie solo quella)
import { COLLECTIONS, backend, body, respingi, send } from './_lib.js';
import { avvisa, origineDi, iscritti, esitiPush, cortoPush } from './_push.js';
import { riassunto, oggiInItalia } from './_widget.js';

const ID = /^[\w.-]{1,80}$/;
const PAGINA = 2500000; // caratteri per risposta: ben sotto il limite di Vercel

// Chi ha usato l'app e quando (per "Collegamento" in Impostazioni): una scrittura al minuto al massimo
// per persona e tipo di dispositivo. Solo il tipo (iPhone, iPad…) che dice l'app, mai altro del dispositivo.
const scritti = new Map();
const TIPI_DISP = ['iPhone', 'iPad', 'Android', 'computer'];
async function segnaVisto(db, req) {
  const chi = req.headers['x-chi'];
  if (chi !== 'p1' && chi !== 'p2') return;
  const [v, dove, tipo] = String(req.headers['x-app'] || '').split(';');
  const disp = TIPI_DISP.includes(tipo) ? tipo : 'computer';
  const k = `${chi}|${disp}`;
  const adesso = Date.now();
  if (adesso - (scritti.get(k) || 0) < 60000) return;
  scritti.set(k, adesso);
  try {
    const tutti = JSON.parse((await db.metaGet('visti')) || '{}') || {};
    tutti[k] = { chi, disp, at: adesso, v: String(v || '').replace(/[^\w.-]/g, '').slice(0, 16), home: dove === 'home' };
    await db.metaSet('visti', JSON.stringify(tutti));
  } catch {}
}

async function collegamento(db) {
  const visti = Object.values(JSON.parse((await db.metaGet('visti')) || '{}') || {});
  const [subs, esiti] = await Promise.all([iscritti().catch(() => []), esitiPush().catch(() => ({}))]);
  const notifiche = subs.map((s) => ({ chi: s.chi, at: s.at || 0, apple: /\.push\.apple\.com$/.test(new URL(s.endpoint).hostname), esito: esiti[cortoPush(s.endpoint)] || null }));
  // OwnTracks che ci prova ma il codice non passa (quando e perché)
  const owntracks = {};
  for (const k of ['p1', 'p2']) { try { owntracks[k] = JSON.parse((await db.metaGet(`ot:rifiuto:${k}`)) || 'null'); } catch { owntracks[k] = null; } }
  return { visti, notifiche, owntracks };
}
const prendi = (req, k) => (req.query && req.query[k]) || new URL(req.url, 'http://x').searchParams.get(k);

export default async function handler(req, res) {
  try {
    if (await respingi(req, res)) return;
    const db = backend();

    if (req.method === 'GET') {
      const col = prendi(req, 'col');
      if (!col) {
        // il widget (Scriptable): poche cose già pronte da mostrare, in una richiesta sola
        if (prendi(req, 'widget')) {
          const [sett, spesa, freq, routine, gatti] = await Promise.all(['settings', 'spesa', 'freq', 'routine', 'gatti'].map((c) => db.collection(c)));
          return send(res, 200, { ...riassunto({ settings: sett.items.main || {}, spesa: spesa.items, freq: freq.items, routine: routine.items, gatti: gatti.items }, oggiInItalia()), at: Date.now() });
        }
        await segnaVisto(db, req);
        if (prendi(req, 'visti')) return send(res, 200, await collegamento(db));
        return send(res, 200, { v: await db.versions() });
      }
      if (!COLLECTIONS.includes(col)) return send(res, 400, { error: 'Raccolta sconosciuta' });
      if (!prendi(req, 'pagine')) { const { v, items } = await db.collection(col); return send(res, 200, { col, v, items }); }
      const dal = Number(prendi(req, 'dal')) || 0;
      const pezzi = dal > 0 && db.cambiati ? await db.cambiati(col, dal) : null;
      const { v, items } = pezzi || (await db.collection(col));
      const da = String(prendi(req, 'da') || '');
      const out = {};
      let peso = 0, ultimo = null, prossimo = null;
      for (const id of Object.keys(items).sort()) {
        if (da && id <= da) continue;
        const n = id.length + JSON.stringify(items[id]).length + 8;
        if (ultimo !== null && peso + n > PAGINA) { prossimo = ultimo; break; }
        out[id] = items[id];
        peso += n;
        ultimo = id;
      }
      return send(res, 200, { col, v, items: out, ...(pezzi ? { pezzi: true, tolti: da ? [] : pezzi.tolti } : {}), ...(prossimo ? { prossimo } : {}) });
    }

    if (req.method === 'POST') {
      const ops = body(req).ops;
      if (!Array.isArray(ops) || !ops.length || ops.length > 200) return send(res, 400, { error: 'Operazioni non valide' });
      for (let i = 0; i < ops.length; i++) {
        const o = ops[i] || {};
        if (o.op === 'wipe') continue;
        if (!COLLECTIONS.includes(o.col) || !ID.test(String(o.id || ''))) return send(res, 400, { error: 'Operazione non valida', indice: i });
        if (!['set', 'update', 'remove', 'bump'].includes(o.op)) return send(res, 400, { error: 'Operazione sconosciuta', indice: i });
      }
      const changes = await db.apply(ops);
      // un biglietto nuovo sulla lavagnetta: avviso l'altro (se ha le notifiche accese)
      const biglietto = ops.find((o) => o.col === 'bacheca' && o.op === 'set' && o.data && o.data.text && ['p1', 'p2'].includes(o.data.by) && Date.now() - Number(o.data.createdAt || 0) < 120000);
      if (biglietto) {
        try {
          const { items } = await db.collection('settings');
          const nomi = { p1: 'Patrick', p2: 'Serena', ...((items.main || {}).names || {}) };
          const da = biglietto.data.by;
          await avvisa({ per: da === 'p1' ? 'p2' : 'p1', tipo: 'biglietti', ttl: 86400, title: `Un biglietto da ${nomi[da]}`, body: String(biglietto.data.text).slice(0, 180), tag: 'biglietto', url: '#/' }, origineDi(req));
        } catch {}
      }
      return send(res, 200, { ok: true, changes });
    }

    send(res, 405, { error: 'Metodo non permesso' });
  } catch (e) {
    console.error(e);
    send(res, e.status || 500, { error: 'Database non raggiungibile' });
  }
}
