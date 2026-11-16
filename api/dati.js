// Dati di casa, protetti dal codice di famiglia (intestazione "x-famiglia").
//   GET  /api/dati            → versioni delle raccolte { v: { spesa: 12, … } }
//   GET  /api/dati?col=spesa  → { v, items: { id: {…} } }
//   POST /api/dati { ops: [{ op: set|update|remove|bump|wipe, col, id, data }] }
import { COLLECTIONS, K, redis, pairs, checkAuth, body, send, sleep } from './_lib.js';

const ID = /^[\w.-]{1,80}$/;
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

export default async function handler(req, res) {
  try {
    if (!(await checkAuth(req))) { await sleep(400); return send(res, 401, { error: 'Codice di famiglia sbagliato' }); }

    if (req.method === 'GET') {
      const col = (req.query && req.query.col) || new URL(req.url, 'http://x').searchParams.get('col');
      if (!col) {
        const [v] = await redis([['HGETALL', K.ver]]);
        const out = {};
        Object.entries(pairs(v)).forEach(([k, n]) => { out[k] = Number(n); });
        return send(res, 200, { v: out });
      }
      if (!COLLECTIONS.includes(col)) return send(res, 400, { error: 'Raccolta sconosciuta' });
      const [all, v] = await redis([['HGETALL', K.col(col)], ['HGET', K.ver, col]]);
      const items = {};
      Object.entries(pairs(all)).forEach(([id, json]) => { const o = parse(json); if (o) items[id] = o; });
      return send(res, 200, { col, v: Number(v || 0), items });
    }

    if (req.method === 'POST') {
      const ops = body(req).ops;
      if (!Array.isArray(ops) || !ops.length || ops.length > 200) return send(res, 400, { error: 'Operazioni non valide' });
      for (const o of ops) {
        if (o.op === 'wipe') continue;
        if (!COLLECTIONS.includes(o.col) || !ID.test(String(o.id || ''))) return send(res, 400, { error: 'Operazione non valida' });
        if (!['set', 'update', 'remove', 'bump'].includes(o.op)) return send(res, 400, { error: 'Operazione sconosciuta' });
      }
      // 1) leggo i documenti da modificare "a pezzi"
      const need = [...new Set(ops.filter((o) => o.op === 'update' || o.op === 'bump').map((o) => `${o.col}\u0000${o.id}`))];
      const cur = {};
      if (need.length) {
        const got = await redis(need.map((k) => { const [c, id] = k.split('\u0000'); return ['HGET', K.col(c), id]; }));
        need.forEach((k, i) => { cur[k] = got[i] ? parse(got[i]) : null; });
      }
      // 2) applico in ordine
      const writes = [];
      const touched = new Set();
      for (const o of ops) {
        if (o.op === 'wipe') {
          COLLECTIONS.forEach((c) => { writes.push(['DEL', K.col(c)]); touched.add(c); });
          Object.keys(cur).forEach((k) => { cur[k] = null; });
          continue;
        }
        const k = `${o.col}\u0000${o.id}`;
        const data = o.data && typeof o.data === 'object' ? o.data : {};
        let doc = null;
        if (o.op === 'set') doc = data;
        if (o.op === 'update') doc = { ...(cur[k] || {}), ...data };
        if (o.op === 'bump') doc = { ...(cur[k] || {}), ...data, count: ((cur[k] && cur[k].count) || 0) + 1 };
        if (o.op === 'remove') { writes.push(['HDEL', K.col(o.col), o.id]); cur[k] = null; }
        else { delete doc.id; writes.push(['HSET', K.col(o.col), o.id, JSON.stringify(doc)]); cur[k] = doc; }
        touched.add(o.col);
      }
      const cols = [...touched];
      const out = await redis([...writes, ...cols.map((c) => ['HINCRBY', K.ver, c, 1])]);
      const changes = {};
      cols.forEach((c, i) => { const after = Number(out[writes.length + i]); changes[c] = [after - 1, after]; });
      return send(res, 200, { ok: true, changes });
    }

    send(res, 405, { error: 'Metodo non permesso' });
  } catch (e) {
    console.error(e);
    send(res, e.status || 500, { error: e.message || 'Errore' });
  }
}
