// Spotify di casa: ognuno collega il suo account e dall'app si vedono le playlist, cosa suona e dove
// (iPhone, iPad, Echo…), e si fa partire la musica sul dispositivo scelto.
// Collegamento "Authorization Code + PKCE": nessun segreto da configurare, serve solo il Client ID
// dell'app creata su developer.spotify.com (si scrive una volta dall'app e resta nel database).
// I permessi (refresh token) restano qui sul server: ai dispositivi va solo un token che dura un'ora.
//
//   GET  /api/spotify?azione=stato             → { pronta, account: { p1: { nome, id, completo } | null, p2: … } }
//   POST /api/spotify { azione: 'collega', chi, clientId? } → { url } la pagina di Spotify dove dare il permesso
//   GET  /api/spotify?azione=token&chi=p1      → { token, scade }
//   POST /api/spotify { azione: 'scollega', chi }
//   GET  /api/spotify?code=…&state=…           → ritorno da Spotify (senza codice di famiglia): salva e torna all'app
import crypto from 'node:crypto';
import { backend, body, send, respingi } from './_lib.js';
import { origineDi } from './_push.js';

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
// lettore e dispositivi, playlist (leggere e creare/modificare), preferiti, lettore dentro l'app (streaming)
const SCOPE = [
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
  'playlist-read-private', 'playlist-read-collaborative', 'playlist-modify-private', 'playlist-modify-public',
  'user-library-read', 'user-library-modify', 'user-follow-read', 'user-follow-modify',
  // il lettore dentro l'app (Web Playback SDK) rifiuta il token senza questi tre: "Invalid token scopes"
  'streaming', 'user-read-private', 'user-read-email',
].join(' ');
// senza questi va ricollegato (collegamenti fatti prima che l'app sapesse salvare brani e creare playlist)
const NECESSARI = ['user-library-modify', 'playlist-modify-private', 'streaming', 'user-read-email', 'user-read-private'];
const completo = (a) => Boolean(a && a.scope && NECESSARI.every((x) => a.scope.split(' ').includes(x)));
const CHI = ['p1', 'p2'];
const CLIENT_ID = /^[0-9a-f]{32}$/i;

const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const leggi = async (k) => parse(await backend().metaGet(k));
const scrivi = (k, v) => backend().metaSet(k, v == null ? '' : JSON.stringify(v));
const appId = async () => process.env.SPOTIFY_CLIENT_ID || (await backend().metaGet('spotify:app')) || '';
const redirectUri = (req) => process.env.SPOTIFY_REDIRECT_URI || `${origineDi(req)}/api/spotify`;

async function chiediToken(params) {
  const r = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error_description || j.error || `Spotify ${r.status}`); e.codice = j.error || ''; throw e; }
  return j;
}

/** Token valido per un account: quello salvato se dura ancora, altrimenti rinnovato. */
async function token(chi) {
  const a = await leggi(`spotify:${chi}`);
  if (!a || !a.refresh) return null;
  if (a.access && a.scade - Date.now() > 120000) return a;
  try {
    const j = await chiediToken({ grant_type: 'refresh_token', refresh_token: a.refresh, client_id: a.clientId });
    const nuovo = { ...a, access: j.access_token, scade: Date.now() + (Number(j.expires_in) || 3600) * 1000, refresh: j.refresh_token || a.refresh, scope: j.scope || a.scope };
    await scrivi(`spotify:${chi}`, nuovo);
    return nuovo;
  } catch (e) {
    // due dispositivi insieme: se l'altro l'ha appena rinnovato, uso il suo
    const ora = await leggi(`spotify:${chi}`);
    if (ora && ora.access && ora.scade - Date.now() > 120000) return ora;
    if (e.codice === 'invalid_grant') { await scrivi(`spotify:${chi}`, null); return null; } // permesso tolto da Spotify
    throw e;
  }
}

/** Torna all'app dopo la pagina di Spotify. */
function torna(res, esito) {
  res.statusCode = 302;
  res.setHeader('Location', `/?spotify=${esito}#/musica`);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

async function ritorno(req, res, p) {
  const [chi] = String(p.get('state') || '').split('~');
  if (!CHI.includes(chi)) return torna(res, 'errore');
  const attesa = await leggi(`spotify:attesa:${chi}`);
  if (!attesa || attesa.state !== p.get('state') || Date.now() - attesa.at > 20 * 60000) return torna(res, 'errore');
  await scrivi(`spotify:attesa:${chi}`, null);
  if (p.get('error') || !p.get('code')) return torna(res, 'annullato');
  try {
    const j = await chiediToken({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(req), client_id: attesa.clientId, code_verifier: attesa.verifier });
    const me = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${j.access_token}` } });
    // app Spotify "in sviluppo": chi non è nella lista degli utenti dell'app riceve 403
    if (me.status === 403) return torna(res, 'utente');
    const io = me.ok ? await me.json() : {};
    await scrivi(`spotify:${chi}`, {
      clientId: attesa.clientId,
      refresh: j.refresh_token,
      access: j.access_token,
      scade: Date.now() + (Number(j.expires_in) || 3600) * 1000,
      nome: String(io.display_name || io.id || '').slice(0, 60),
      id: String(io.id || '').slice(0, 80),
      scope: j.scope || '',
      at: Date.now(),
    });
    torna(res, 'ok');
  } catch (e) {
    console.error('Spotify', e.message);
    torna(res, 'errore');
  }
}

export default async function handler(req, res) {
  try {
    if (!backend()) return send(res, 503, { error: 'Database non collegato' });
    const p = new URL(req.url, 'http://x').searchParams;
    if (req.method === 'GET' && p.get('state')) return await ritorno(req, res, p);

    if (await respingi(req, res)) return; // codice di famiglia, con il limite ai tentativi sbagliati
    const b = req.method === 'POST' ? body(req) : {};
    const azione = b.azione || p.get('azione') || 'stato';
    const chi = b.chi || p.get('chi');

    if (azione === 'stato') {
      const account = {};
      for (const k of CHI) { const a = await leggi(`spotify:${k}`); account[k] = a && a.refresh ? { nome: a.nome || '', id: a.id || '', completo: completo(a) } : null; }
      return send(res, 200, { pronta: Boolean(await appId()), account });
    }

    if (!CHI.includes(chi)) return send(res, 400, { error: 'Di chi è l’account?' });

    if (azione === 'token') {
      const t = await token(chi);
      if (!t) return send(res, 409, { error: 'Spotify non è collegato', scollegato: true });
      return send(res, 200, { token: t.access, scade: t.scade });
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non permesso' });

    if (azione === 'collega') {
      if (b.clientId) {
        const id = String(b.clientId).trim();
        if (!CLIENT_ID.test(id)) return send(res, 400, { error: 'Il Client ID è fatto di 32 lettere e numeri' });
        await backend().metaSet('spotify:app', id);
      }
      const clientId = await appId();
      if (!clientId) return send(res, 400, { error: 'Manca il Client ID', serveId: true });
      const verifier = crypto.randomBytes(48).toString('base64url');
      const state = `${chi}~${crypto.randomBytes(18).toString('base64url')}`;
      await scrivi(`spotify:attesa:${chi}`, { state, verifier, clientId, at: Date.now() });
      const q = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri(req),
        scope: SCOPE,
        state,
        code_challenge_method: 'S256',
        code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
        // sempre la pagina con l'account e «Non sei tu?»: così si può collegare anche quello dell'altro
        show_dialog: 'true',
      });
      return send(res, 200, { url: `${ACCOUNTS}/authorize?${q}` });
    }

    if (azione === 'scollega') {
      await scrivi(`spotify:${chi}`, null);
      return send(res, 200, { ok: true });
    }

    send(res, 400, { error: 'Azione sconosciuta' });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: 'Spotify non risponde, riprova tra poco' });
  }
}
