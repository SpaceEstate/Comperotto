// POST /api/setup { codice } → la prima volta sceglie il codice di famiglia.
import { hasStorage, redis, K, hashCode, normCode, body, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non permesso' });
  if (!hasStorage()) return send(res, 503, { error: 'Database non collegato' });
  if (process.env.FAMILY_CODE) return send(res, 409, { error: 'Il codice è già impostato' });
  const codice = normCode(body(req).codice);
  if (codice.length < 6) return send(res, 400, { error: 'Almeno 6 caratteri' });
  const [ok] = await redis([['SET', K.code, hashCode(codice), 'NX']]);
  if (!ok) return send(res, 409, { error: 'Il codice è già stato scelto' });
  send(res, 200, { ok: true });
}
