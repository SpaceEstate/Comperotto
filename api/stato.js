// GET /api/stato → dice all'app che gira su Vercel, se il database è pronto e qual è la versione pubblicata
// (la stessa VERSIONE di js/config.js): se l'app aperta è più vecchia, lo dice con un avviso (js/aggiorna.js).
import { backend, storedHash, send } from './_lib.js';
import { VERSIONE } from '../js/config.js';

export default async function handler(req, res) {
  const db = backend();
  if (!db) return send(res, 200, { app: 'comperotto', versione: VERSIONE, storage: false, claimed: false });
  try {
    const claimed = Boolean(await storedHash());
    send(res, 200, { app: 'comperotto', versione: VERSIONE, storage: true, db: db.name, claimed });
  } catch (e) {
    console.error(e);
    send(res, 200, { app: 'comperotto', versione: VERSIONE, storage: false, claimed: false, error: 'Database non raggiungibile' });
  }
}
