// Collegamento della skill ai dati di casa (le API su Vercel), senza dipendenze esterne.
'use strict';

const http = require('http');
const https = require('https');

function defaultTransport(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.request(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...headers },
      timeout: 6000,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = {};
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

/** apiUrl: es. "https://comperotto.vercel.app/api" — codice: il codice di famiglia. */
function createClient({ apiUrl, codice, transport = defaultTransport }) {
  const base = String(apiUrl || '').replace(/\/+$/, '');
  async function call(method, path, body) {
    const r = await transport(method, `${base}/${path}`, body, { 'x-famiglia': String(codice || '').trim().toLowerCase() });
    if (r.status === 401) throw new Error('Codice di famiglia sbagliato');
    if (r.status >= 300) throw new Error(`API ${r.status}: ${r.json && r.json.error}`);
    return r.json;
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return {
    async list(col) {
      const j = await call('GET', `dati?col=${encodeURIComponent(col)}`);
      return Object.entries(j.items || {}).map(([id, v]) => ({ ...v, id }));
    },
    async get(col, id) {
      const j = await call('GET', `dati?col=${encodeURIComponent(col)}`);
      const v = (j.items || {})[id];
      return v ? { ...v, id } : null;
    },
    async add(col, data, extraOps = []) {
      const id = newId();
      await call('POST', 'dati', { ops: [{ op: 'set', col, id, data }, ...extraOps] });
      return id;
    },
    async remove(col, id) {
      await call('POST', 'dati', { ops: [{ op: 'remove', col, id }] });
    },
  };
}

module.exports = { createClient };
