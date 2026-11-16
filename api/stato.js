// GET /api/stato → dice all'app che gira su Vercel e se il database è pronto.
import { backend, storedHash, send } from './_lib.js';

export default async function handler(req, res) {
  const db = backend();
  if (!db) return send(res, 200, { app: 'comperotto', storage: false, claimed: false });
  try {
    const claimed = Boolean(await storedHash());
    send(res, 200, { app: 'comperotto', storage: true, db: db.name, claimed });
  } catch (e) {
    console.error(e);
    send(res, 200, { app: 'comperotto', storage: false, claimed: false, error: 'Database non raggiungibile' });
  }
}
