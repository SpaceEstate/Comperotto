// Piccolo client per Firebase (login + Firestore via REST), senza dipendenze esterne.
// La skill entra con un account dedicato (es. alexa@…) come fareste voi dal sito,
// quindi valgono le stesse regole di sicurezza di firestore.rules.
'use strict';

const https = require('https');

function defaultTransport(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...headers },
      timeout: 6000,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : {}; } catch (e) { json = { raw }; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ---- conversione dei valori Firestore <-> JavaScript ----
function decode(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return null;
}
function decodeFields(fields) {
  const o = {};
  Object.entries(fields || {}).forEach(([k, v]) => { o[k] = decode(v); });
  return o;
}
function encode(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'string') return { stringValue: x };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isSafeInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(encode) } };
  if (typeof x === 'object') return { mapValue: { fields: encodeFields(x) } };
  return { stringValue: String(x) };
}
function encodeFields(o) {
  const f = {};
  Object.entries(o).forEach(([k, v]) => { f[k] = encode(v); });
  return f;
}

function createClient({ apiKey, projectId, email, password, houseId, transport = defaultTransport }) {
  let token = null;
  let expires = 0;
  const root = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/case/${houseId}`;

  async function auth() {
    if (token && Date.now() < expires - 60000) return token;
    const r = await transport('POST', `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      { email, password, returnSecureToken: true });
    if (r.status !== 200 || !r.json.idToken) throw new Error('Login Firebase non riuscito: ' + JSON.stringify(r.json && r.json.error && r.json.error.message));
    token = r.json.idToken;
    expires = Date.now() + Number(r.json.expiresIn || 3600) * 1000;
    return token;
  }

  async function call(method, url, body) {
    const t = await auth();
    const r = await transport(method, url, body, { Authorization: `Bearer ${t}` });
    if (r.status === 404) return null;
    if (r.status >= 300) throw new Error(`Firestore ${r.status}: ${JSON.stringify(r.json && r.json.error && r.json.error.message)}`);
    return r.json;
  }

  return {
    async list(col) {
      const out = [];
      let pageToken = '';
      do {
        const j = await call('GET', `${root}/${col}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
        ((j && j.documents) || []).forEach((d) => out.push({ ...decodeFields(d.fields), id: d.name.split('/').pop(), _name: d.name }));
        pageToken = j && j.nextPageToken;
      } while (pageToken);
      return out;
    },
    async get(col, id) {
      const d = await call('GET', `${root}/${col}/${encodeURIComponent(id)}`);
      return d ? { ...decodeFields(d.fields), id } : null;
    },
    async add(col, data) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await call('POST', `${root}/${col}?documentId=${id}`, { fields: encodeFields(data) });
      return id;
    },
    async remove(col, id) {
      await call('DELETE', `${root}/${col}/${encodeURIComponent(id)}`);
    },
  };
}

module.exports = { createClient, encode, decode, encodeFields, decodeFields };
