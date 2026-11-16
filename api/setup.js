// POST /api/setup { codice } → la prima volta sceglie il codice di famiglia.
import { backend, hashCode, normCode, body, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non permesso' });
  const db = backend();
  if (!db) return send(res, 503, { error: 'Database non collegato' });
  if (process.env.FAMILY_CODE) return send(res, 409, { error: 'Il codice è già impostato' });
  const codice = normCode(body(req).codice);
  if (codice.length < 6) return send(res, 400, { error: 'Almeno 6 caratteri' });
  try {
    if (!(await db.claimCode(hashCode(codice)))) return send(res, 409, { error: 'Il codice è già stato scelto: ricarica la pagina' });
    send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Database non raggiungibile' });
  }
}
