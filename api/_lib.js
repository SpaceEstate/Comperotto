// Funzioni condivise dalle API. I file che iniziano con _ non diventano indirizzi.
//
// Il database si collega da Vercel → Storage, e le chiavi arrivano da sole come variabili:
//   • Neon (Postgres, piano Free)      → DATABASE_URL / POSTGRES_URL
//   • Upstash for Redis (a consumo)    → KV_REST_API_URL + KV_REST_API_TOKEN
// L'app usa quello che trova.
import crypto from 'node:crypto';

export const COLLECTIONS = ['settings', 'spesa', 'freq', 'lavori', 'routine', 'ricette', 'desideri', 'gatti', 'eventiGatti', 'bacheca', 'musica', 'film', 'posizioni', 'liste', 'viaggi', 'valigia'];

const stripId = (o) => { const x = { ...(o && typeof o === 'object' ? o : {}) }; delete x.id; return x; };
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

// ===========================================================================
// Redis (Upstash, via REST)
// ===========================================================================
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

async function redis(cmds) {
  const env = redisEnv();
  const r = await fetch(`${env.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`Redis ${r.status}`);
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}
const pairs = (arr) => { const o = {}; for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = arr[i + 1]; return o; };
const RK = { code: 'fam:codice', ver: 'fam:v', col: (c) => `fam:d:${c}` };

const redisBackend = {
  name: 'redis',
  async getCode() { const [h] = await redis([['GET', RK.code]]); return h || null; },
  async claimCode(h) { const [ok] = await redis([['SET', RK.code, h, 'NX']]); return Boolean(ok); },
  // appunti del server (chiavi delle notifiche, iscrizioni…): non fanno parte dei dati che l'app scarica
  async metaGet(k) { const [v] = await redis([['GET', `fam:m:${k}`]]); return v || null; },
  async metaSet(k, v) { await redis([['SET', `fam:m:${k}`, v]]); },
  async metaSetNX(k, v) { const [ok] = await redis([['SET', `fam:m:${k}`, v, 'NX']]); return Boolean(ok); },
  async versions() {
    const [v] = await redis([['HGETALL', RK.ver]]);
    const out = {};
    Object.entries(pairs(v)).forEach(([k, n]) => { out[k] = Number(n); });
    return out;
  },
  async collection(col) {
    const [all, v] = await redis([['HGETALL', RK.col(col)], ['HGET', RK.ver, col]]);
    const items = {};
    Object.entries(pairs(all)).forEach(([id, json]) => { const o = parse(json); if (o) items[id] = o; });
    return { v: Number(v || 0), items };
  },
  async apply(ops) {
    // leggo prima i documenti da modificare "a pezzi"
    const need = [...new Set(ops.filter((o) => o.op === 'update' || o.op === 'bump').map((o) => `${o.col}\u0000${o.id}`))];
    const cur = {};
    if (need.length) {
      const got = await redis(need.map((k) => { const [c, id] = k.split('\u0000'); return ['HGET', RK.col(c), id]; }));
      need.forEach((k, i) => { cur[k] = got[i] ? parse(got[i]) : null; });
    }
    const writes = [];
    const touched = new Set();
    for (const o of ops) {
      if (o.op === 'wipe') {
        COLLECTIONS.forEach((c) => { writes.push(['DEL', RK.col(c)]); touched.add(c); });
        Object.keys(cur).forEach((k) => { cur[k] = null; });
        continue;
      }
      const k = `${o.col}\u0000${o.id}`;
      const data = stripId(o.data);
      if (o.op === 'remove') { writes.push(['HDEL', RK.col(o.col), o.id]); cur[k] = null; }
      else {
        let doc = data;
        if (o.op === 'update') doc = { ...(cur[k] || {}), ...data };
        if (o.op === 'bump') doc = { ...(cur[k] || {}), ...data, count: ((cur[k] && cur[k].count) || 0) + 1 };
        writes.push(['HSET', RK.col(o.col), o.id, JSON.stringify(doc)]);
        cur[k] = doc;
      }
      touched.add(o.col);
    }
    const cols = [...touched];
    const out = await redis([...writes, ...cols.map((c) => ['HINCRBY', RK.ver, c, 1])]);
    const changes = {};
    cols.forEach((c, i) => { const after = Number(out[writes.length + i]); changes[c] = [after - 1, after]; });
    return changes;
  },
};

// ===========================================================================
// Postgres (Neon, ma va bene qualsiasi Postgres)
// ===========================================================================
function pgUrl() {
  const prefer = ['POSTGRES_URL', 'DATABASE_URL'];
  for (const name of prefer) {
    for (const [k, v] of Object.entries(process.env)) {
      if (v && k.endsWith(name) && /^postgres(ql)?:\/\//.test(v)) return v;
    }
  }
  return null;
}

let pool = null;
let schemaReady = null;
async function pg() {
  if (!pool) {
    const { default: pgmod } = await import('pg');
    const url = new URL(pgUrl());
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    ['sslmode', 'channel_binding'].forEach((p) => url.searchParams.delete(p));
    pool = new pgmod.Pool({
      connectionString: url.toString(),
      // Neon ha certificati pubblici verificabili; altri provider usano CA proprie
      ssl: local ? false : { rejectUnauthorized: /\.neon\.tech$/.test(url.hostname) },
      max: 3,
      idleTimeoutMillis: 10000,
    });
    // Neon chiude le connessioni ferme: la connessione persa si scarta e la prossima richiesta ne apre un'altra
    pool.on('error', () => {});
  }
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS fam_docs (col text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (col, id));
      CREATE TABLE IF NOT EXISTS fam_ver (col text PRIMARY KEY, v bigint NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS fam_meta (k text PRIMARY KEY, v text NOT NULL);
    `).catch((e) => { schemaReady = null; throw e; });
  }
  await schemaReady;
  return pool;
}

const pgBackend = {
  name: 'postgres',
  async getCode() { const r = await (await pg()).query("SELECT v FROM fam_meta WHERE k = 'codice'"); return r.rows[0] ? r.rows[0].v : null; },
  async claimCode(h) {
    const r = await (await pg()).query("INSERT INTO fam_meta (k, v) VALUES ('codice', $1) ON CONFLICT (k) DO NOTHING RETURNING k", [h]);
    return r.rowCount > 0;
  },
  // appunti del server (chiavi delle notifiche, iscrizioni…): non fanno parte dei dati che l'app scarica
  async metaGet(k) { const r = await (await pg()).query('SELECT v FROM fam_meta WHERE k = $1', [`m:${k}`]); return r.rows[0] ? r.rows[0].v : null; },
  async metaSet(k, v) { await (await pg()).query('INSERT INTO fam_meta (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v', [`m:${k}`, v]); },
  async metaSetNX(k, v) {
    const r = await (await pg()).query('INSERT INTO fam_meta (k, v) VALUES ($1, $2) ON CONFLICT (k) DO NOTHING RETURNING k', [`m:${k}`, v]);
    return r.rowCount > 0;
  },
  async versions() {
    const r = await (await pg()).query('SELECT col, v FROM fam_ver');
    const out = {};
    r.rows.forEach((x) => { out[x.col] = Number(x.v); });
    return out;
  },
  async collection(col) {
    const p = await pg();
    const [docs, ver] = await Promise.all([
      p.query('SELECT id, data FROM fam_docs WHERE col = $1', [col]),
      p.query('SELECT v FROM fam_ver WHERE col = $1', [col]),
    ]);
    const items = {};
    docs.rows.forEach((x) => { items[x.id] = x.data; });
    return { v: ver.rows[0] ? Number(ver.rows[0].v) : 0, items };
  },
  async apply(ops) {
    const c = await (await pg()).connect();
    const touched = new Set();
    try {
      await c.query('BEGIN');
      for (const o of ops) {
        if (o.op === 'wipe') { await c.query('DELETE FROM fam_docs'); COLLECTIONS.forEach((x) => touched.add(x)); continue; }
        const data = JSON.stringify(stripId(o.data), (k, v) => (typeof v === 'string' ? v.replace(/\u0000/g, '') : v));
        if (o.op === 'set') {
          await c.query('INSERT INTO fam_docs (col, id, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (col, id) DO UPDATE SET data = EXCLUDED.data', [o.col, o.id, data]);
        } else if (o.op === 'update') {
          await c.query('INSERT INTO fam_docs (col, id, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (col, id) DO UPDATE SET data = fam_docs.data || EXCLUDED.data', [o.col, o.id, data]);
        } else if (o.op === 'bump') {
          await c.query(`INSERT INTO fam_docs (col, id, data) VALUES ($1, $2, $3::jsonb || jsonb_build_object('count', 1))
            ON CONFLICT (col, id) DO UPDATE SET data = fam_docs.data || $3::jsonb || jsonb_build_object('count', COALESCE((fam_docs.data->>'count')::int, 0) + 1)`, [o.col, o.id, data]);
        } else if (o.op === 'remove') {
          await c.query('DELETE FROM fam_docs WHERE col = $1 AND id = $2', [o.col, o.id]);
        }
        touched.add(o.col);
      }
      const changes = {};
      for (const col of touched) {
        const r = await c.query('INSERT INTO fam_ver (col, v) VALUES ($1, 1) ON CONFLICT (col) DO UPDATE SET v = fam_ver.v + 1 RETURNING v', [col]);
        const after = Number(r.rows[0].v);
        changes[col] = [after - 1, after];
      }
      await c.query('COMMIT');
      return changes;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  },
};

// ===========================================================================
export function backend() {
  if (redisEnv()) return redisBackend;
  if (pgUrl()) return pgBackend;
  return null;
}
export const hasStorage = () => Boolean(backend());

// ---- codice di famiglia ----
export const normCode = (c) => String(c || '').trim().toLowerCase();
export const hashCode = (c) => crypto.createHash('sha256').update(`comperotto:${normCode(c)}`).digest('hex');

// tenuto in memoria per un minuto: ogni controllo costa una lettura in meno al database
let cached = { h: null, at: 0 };
export async function storedHash() {
  if (process.env.FAMILY_CODE) return hashCode(process.env.FAMILY_CODE);
  if (cached.h && Date.now() - cached.at < 60000) return cached.h;
  const h = await backend().getCode();
  cached = { h: h || null, at: Date.now() };
  return h || null;
}

export async function verifyCode(code) {
  if (!code || !hasStorage()) return false;
  const expected = await storedHash();
  if (!expected) return false;
  const a = Buffer.from(hashCode(code)), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const checkAuth = (req) => verifyCode(req.headers['x-famiglia']);

// ---- troppi tentativi: chi prova tanti codici DIVERSI sbagliati viene fermato per un quarto d'ora ----
// (si contano i codici diversi: un telefono rimasto con il codice vecchio, che riprova sempre lo stesso,
//  non blocca la casa; chi tira a indovinare sì)
const FINESTRA = 15 * 60000;
const MAX_CODICI = 10;
const bloccati = new Map(); // in memoria di questa istanza: ip → fino a quando
const corto = (x) => crypto.createHash('sha256').update(`comperotto:${x}`).digest('hex').slice(0, 12);
export const ipDi = (req) => String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '?';

/** 'ok' | 'no' (codice sbagliato) | 'bloccato' (troppi tentativi da questo indirizzo) */
export async function autorizza(req, code) {
  const ip = ipDi(req);
  const fino = bloccati.get(ip);
  if (fino && fino > Date.now()) return 'bloccato';
  if (fino) bloccati.delete(ip);
  if (await verifyCode(code)) return 'ok';
  const db = backend();
  if (!db || !code) return 'no';
  const k = `auth:ko:${corto(ip)}`;
  const adesso = Date.now();
  let rec = null;
  try { rec = JSON.parse((await db.metaGet(k)) || 'null'); } catch {}
  if (!rec || adesso - rec.at > FINESTRA) rec = { at: adesso, c: [] };
  const h = corto(normCode(code));
  if (!rec.c.includes(h)) rec.c = [...rec.c, h].slice(-MAX_CODICI * 2);
  try { await db.metaSet(k, JSON.stringify(rec)); } catch {}
  if (rec.c.length >= MAX_CODICI) { bloccati.set(ip, rec.at + FINESTRA); return 'bloccato'; }
  return 'no';
}

/** Da usare all'inizio di ogni funzione protetta: true se ha già risposto lei (401 o 429). */
export async function respingi(req, res, code = req.headers['x-famiglia']) {
  const esito = await autorizza(req, code);
  if (esito === 'ok') return false;
  await sleep(400);
  if (esito === 'bloccato') send(res, 429, { error: 'Troppi tentativi con un codice sbagliato: riprova tra un quarto d’ora' });
  else send(res, 401, { error: 'Codice di famiglia sbagliato' });
  return true;
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
