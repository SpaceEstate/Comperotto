// Notifiche di questo dispositivo (serve il codice di famiglia, intestazione "x-famiglia").
//   GET    /api/push                          → { key } la chiave pubblica con cui iscriversi
//   POST   /api/push { sub, chi, prefs }       → iscrive (o aggiorna) questo dispositivo
//   POST   /api/push { prova: true, endpoint } → manda una notifica di prova a questo dispositivo
//   DELETE /api/push { endpoint }              → toglie l'iscrizione
import { backend, checkAuth, body, send, sleep } from './_lib.js';
import { chiavi, iscritti, iscrivi, disiscrivi, spedisci, endpointOk, origineDi } from './_push.js';

export default async function handler(req, res) {
  try {
    if (!backend()) return send(res, 503, { error: 'Database non collegato' });
    if (!(await checkAuth(req))) { await sleep(400); return send(res, 401, { error: 'Codice di famiglia sbagliato' }); }
    if (req.method === 'GET') return send(res, 200, { key: (await chiavi()).pub });
    const b = body(req);
    if (req.method === 'DELETE') {
      if (b.endpoint) await disiscrivi(String(b.endpoint));
      return send(res, 200, { ok: true });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non permesso' });
    if (b.prova) {
      const s = (await iscritti()).find((x) => x.endpoint === b.endpoint);
      if (!s) return send(res, 404, { error: 'Dispositivo non iscritto' });
      const stato = await spedisci(s, { title: 'Fam. Comperotto', body: 'Le notifiche funzionano ✓', tag: 'prova', url: '#/impostazioni' }, origineDi(req));
      return send(res, 200, { ok: stato >= 200 && stato < 300, stato });
    }
    const sub = b.sub || {};
    if (!endpointOk(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return send(res, 400, { error: 'Iscrizione non valida' });
    if (!['p1', 'p2'].includes(b.chi)) return send(res, 400, { error: 'Di chi è questo dispositivo?' });
    await iscrivi(sub, b.chi, b.prefs || {});
    send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Database non raggiungibile' });
  }
}
