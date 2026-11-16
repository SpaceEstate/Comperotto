// Funzioni condivise dalle API: database Redis (Upstash, collegato da Vercel → Storage)
// e controllo del "codice di famiglia". I file che iniziano con _ non diventano indirizzi.
import crypto from 'node:crypto';

export const COLLECTIONS = ['settings', 'spesa', 'freq', 'lavori', 'routine', 'ricette', 'desideri', 'gatti', 'eventiGatti', 'bacheca', 'musica', 'film'];
const P = 'fam:';
export const K = { code: `${P}codice`, ver: `${P}v`, col: (c) => `${P}d:${c}` };

// Vercel aggiunge da solo le variabili quando colleghi il database (anche con un prefisso personalizzato).
function redisEnv() {
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    for (const [u, t] of [['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'], ['KV_REST_API_URL', 'KV_REST_API_TOKEN']]) {
      if (k.endsWith(u)) {
        const token = process.env[k.slice(0, -u.length) + t];
        if (token) return { url: v.replace(/\/+$/, ''), token };
      }
    }
  }
  return null;
}
export const hasStorage = () => Boolean(redisEnv());

/** Esegue più comandi Redis in una sola chiamata. */
export async function redis(cmds) {
  const env = redisEnv();
  if (!env) throw Object.assign(new Error('Database non collegato'), { status: 503 });
  const r = await fetch(`${env.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`Redis ${r.status}`);
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}

export const pairs = (arr) => {
  const o = {};
  for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
};

// ---- codice di famiglia ----
export const normCode = (c) => String(c || '').trim().toLowerCase();
export const hashCode = (c) => crypto.createHash('sha256').update(`comperotto:${normCode(c)}`).digest('hex');

// tenuto in memoria per un minuto: ogni controllo costa un comando Redis in meno
let cached = { h: null, at: 0 };
export async function storedHash() {
  if (process.env.FAMILY_CODE) return hashCode(process.env.FAMILY_CODE);
  if (cached.h && Date.now() - cached.at < 60000) return cached.h;
  const [h] = await redis([['GET', K.code]]);
  cached = { h: h || null, at: Date.now() };
  return h || null;
}

export async function checkAuth(req) {
  const code = req.headers['x-famiglia'];
  const expected = await storedHash();
  if (!code || !expected) return false;
  const a = Buffer.from(hashCode(code)), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
