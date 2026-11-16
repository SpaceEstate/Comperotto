// GET /api/stato → dice all'app che gira su Vercel e se il database è pronto.
import { hasStorage, storedHash, send } from './_lib.js';

export default async function handler(req, res) {
  const storage = hasStorage();
  let claimed = Boolean(process.env.FAMILY_CODE);
  if (storage && !claimed) {
    try { claimed = Boolean(await storedHash()); } catch { return send(res, 200, { app: 'comperotto', storage: false, error: 'database non raggiungibile' }); }
  }
  send(res, 200, { app: 'comperotto', storage, claimed });
}
