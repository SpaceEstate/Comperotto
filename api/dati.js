// Dati di casa, protetti dal codice di famiglia (intestazione "x-famiglia").
//   GET  /api/dati            → versioni delle raccolte { v: { spesa: 12, … } }
//   GET  /api/dati?col=spesa  → { v, items: { id: {…} } }
//   POST /api/dati { ops: [{ op: set|update|remove|bump|wipe, col, id, data }] }
import { COLLECTIONS, backend, checkAuth, body, send, sleep } from './_lib.js';
import { avvisa, origineDi } from './_push.js';

const ID = /^[\w.-]{1,80}$/;

export default async function handler(req, res) {
  try {
    if (!(await checkAuth(req))) { await sleep(400); return send(res, 401, { error: 'Codice di famiglia sbagliato' }); }
    const db = backend();

    if (req.method === 'GET') {
      const col = (req.query && req.query.col) || new URL(req.url, 'http://x').searchParams.get('col');
      if (!col) return send(res, 200, { v: await db.versions() });
      if (!COLLECTIONS.includes(col)) return send(res, 400, { error: 'Raccolta sconosciuta' });
      const { v, items } = await db.collection(col);
      return send(res, 200, { col, v, items });
    }

    if (req.method === 'POST') {
      const ops = body(req).ops;
      if (!Array.isArray(ops) || !ops.length || ops.length > 200) return send(res, 400, { error: 'Operazioni non valide' });
      for (const o of ops) {
        if (o.op === 'wipe') continue;
        if (!COLLECTIONS.includes(o.col) || !ID.test(String(o.id || ''))) return send(res, 400, { error: 'Operazione non valida' });
        if (!['set', 'update', 'remove', 'bump'].includes(o.op)) return send(res, 400, { error: 'Operazione sconosciuta' });
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
