// Notifiche push (Web Push standard: Apple, Google…), senza servizi esterni né chiavi da configurare:
// la coppia di chiavi del server si crea da sola la prima volta e resta nel database.
//
//   avvisa({ per: 'tutti' | 'p1' | 'p2', tipo, title, body, tag, url }, origine)
//
// "tipo" è la preferenza che ogni dispositivo può spegnere: arrivi, rifiuti, biglietti, scadenze.
import crypto from 'node:crypto';
import { backend } from './_lib.js';

const b64u = (b) => Buffer.from(b).toString('base64url');
const da64 = (s) => Buffer.from(String(s || ''), 'base64url');
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

// si spedisce solo ai servizi push conosciuti (Apple, Google, Mozilla, Microsoft)
const SERVIZI = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
export function endpointOk(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && SERVIZI.some((h) => h.test(x.hostname)); } catch { return false; }
}
export const TIPI = ['arrivi', 'rifiuti', 'biglietti', 'scadenze'];

// ---------------------------------------------------------------------------
// Chiavi del server (VAPID) e dispositivi iscritti
// ---------------------------------------------------------------------------
let vapid = null;
export async function chiavi() {
  if (vapid) return vapid;
  const db = backend();
  let k = parse(await db.metaGet('push:vapid'));
  if (!k || !k.jwk) {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    await db.metaSetNX('push:vapid', JSON.stringify({ jwk: privateKey.export({ format: 'jwk' }) }));
    k = parse(await db.metaGet('push:vapid')); // se due richieste arrivano insieme vale la prima
  }
  vapid = {
    pub: b64u(Buffer.concat([Buffer.from([4]), da64(k.jwk.x), da64(k.jwk.y)])),
    key: crypto.createPrivateKey({ key: k.jwk, format: 'jwk' }),
  };
  return vapid;
}

export const iscritti = async () => parse(await backend().metaGet('push:iscritti')) || [];
/** Impronta corta di un'iscrizione (per ricordare com'è andata l'ultima notifica senza ripetere l'indirizzo). */
export const cortoPush = (endpoint) => crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 16);
export const esitiPush = async () => parse(await backend().metaGet('push:esiti')) || {};
/** Ricorda l'esito dell'ultima notifica di ogni dispositivo (201 = consegnata al servizio push). */
export async function registraEsiti(list, esiti) {
  try {
    const tutti = await esitiPush();
    list.forEach((s, i) => { tutti[cortoPush(s.endpoint)] = { at: Date.now(), stato: esiti[i] || 0 }; });
    // tengo solo i dispositivi ancora iscritti
    const vivi = new Set((await iscritti()).map((s) => cortoPush(s.endpoint)));
    Object.keys(tutti).forEach((k) => { if (!vivi.has(k)) delete tutti[k]; });
    await backend().metaSet('push:esiti', JSON.stringify(tutti));
  } catch {}
}
const salva = (list) => backend().metaSet('push:iscritti', JSON.stringify(list));

export async function iscrivi({ endpoint, keys }, chi, prefs = {}) {
  const pulite = {};
  TIPI.forEach((t) => { pulite[t] = prefs[t] !== false; });
  const list = (await iscritti()).filter((s) => s.endpoint !== endpoint);
  list.push({ endpoint, keys: { p256dh: String(keys.p256dh), auth: String(keys.auth) }, chi, prefs: pulite, at: Date.now() });
  await salva(list.slice(-12)); // una famiglia ha pochi dispositivi: tengo gli ultimi
}
export async function disiscrivi(endpoint) {
  const list = await iscritti();
  const resto = list.filter((s) => s.endpoint !== endpoint);
  if (resto.length !== list.length) await salva(resto);
}

// ---------------------------------------------------------------------------
// Il messaggio cifrato (RFC 8291, "aes128gcm") e la firma del server (RFC 8292)
// ---------------------------------------------------------------------------
export function cifra(testo, p256dh, auth) {
  const loro = da64(p256dh), segreto = da64(auth);
  const ecdh = crypto.createECDH('prime256v1');
  const mia = ecdh.generateKeys();
  const comune = ecdh.computeSecret(loro);
  const hk = (ikm, salt, info, n) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, n));
  const ikm = hk(comune, segreto, Buffer.concat([Buffer.from('WebPush: info\0'), loro, mia]), 32);
  const salt = crypto.randomBytes(16);
  const chiave = hk(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hk(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', chiave, nonce);
  const corpo = Buffer.concat([c.update(Buffer.concat([Buffer.from(testo), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([mia.length]), mia, corpo]);
}

export function firma(endpoint, origine, v) {
  const testa = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const dati = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: origine }));
  const sig = crypto.sign('sha256', Buffer.from(`${testa}.${dati}`), { key: v.key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${testa}.${dati}.${b64u(sig)}, k=${v.pub}`;
}

/** Spedisce a un dispositivo. Ritorna lo stato HTTP (201 = consegnato al servizio; 404/410 = iscrizione scaduta). */
export async function spedisci(sub, msg, origine) {
  if (!endpointOk(sub.endpoint)) return 400;
  const v = await chiavi();
  const corpo = cifra(JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, url: msg.url }), sub.keys.p256dh, sub.keys.auth);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: firma(sub.endpoint, origine, v),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(msg.ttl || 3600),
        Urgency: msg.urgente ? 'high' : 'normal',
      },
      body: corpo,
      signal: ctrl.signal,
    });
    return r.status;
  } catch { return 0; } finally { clearTimeout(t); }
}

/** L'indirizzo del sito, che i servizi push vogliono sapere (da chi arriva la notifica). */
export const origineDi = (req) => `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || (req && req.headers && req.headers.host) || 'comperotto.vercel.app'}`;

/** Avvisa tutti i dispositivi di una persona (o di tutti) che non hanno spento quel tipo di notifica. */
export async function avvisa(msg, origine) {
  let list;
  try { list = await iscritti(); } catch { return { inviati: 0 }; }
  const dest = list.filter((s) => (msg.per === 'tutti' || s.chi === msg.per) && (!msg.tipo || !s.prefs || s.prefs[msg.tipo] !== false));
  if (!dest.length) return { inviati: 0 };
  const esiti = await Promise.all(dest.map((s) => spedisci(s, msg, origine)));
  const scadute = dest.filter((s, i) => esiti[i] === 404 || esiti[i] === 410).map((s) => s.endpoint);
  if (scadute.length) await salva((await iscritti()).filter((s) => !scadute.includes(s.endpoint))).catch(() => {});
  await registraEsiti(dest, esiti);
  return { inviati: esiti.filter((x) => x >= 200 && x < 300).length, esiti };
}
