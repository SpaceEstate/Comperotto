// Dati di casa, protetti dal codice di famiglia (intestazione "x-famiglia").
//   GET  /api/dati            → versioni delle raccolte { v: { spesa: 12, … } }
//   GET  /api/dati?col=spesa  → { v, items: { id: {…} } }
//   POST /api/dati { ops: [{ op: set|update|remove|bump|wipe, col, id, data }] }
import { COLLECTIONS, backend, checkAuth, body, send, sleep } from './_lib.js';

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
      return send(res, 200, { ok: true, changes: await db.apply(ops) });
    }

    send(res, 405, { error: 'Metodo non permesso' });
  } catch (e) {
    console.error(e);
    send(res, e.status || 500, { error: 'Database non raggiungibile' });
  }
}
