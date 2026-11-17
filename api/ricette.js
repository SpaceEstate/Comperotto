// Ricette anche da internet, senza chiavi e senza servizi a pagamento.
//   GET /api/ricette?q=carbonara      → le ricette di GialloZafferano che trova la sua ricerca (titolo, foto,
//                                       voto, difficoltà, tempo): la pagina dei risultati è pubblica
//   GET /api/ricette?url=https://…     → importa da una pagina di ricetta che pubblica i dati standard
//                                       schema.org (GialloZafferano e quasi tutti i siti di cucina)
// Fatto in casa da Benedetta non si lascia leggere dai programmi (verifica anti-robot di Cloudflare):
// l'app apre la sua ricerca nel browser, dove passa la persona.
// Protetto dal codice di famiglia: non è un passa-richieste aperto a tutti.
import dns from 'node:dns/promises';
import net from 'node:net';
import { respingi, send } from './_lib.js';

const UA_BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const GZ = 'https://www.giallozafferano.it';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', egrave: 'è', eacute: 'é', agrave: 'à', igrave: 'ì', ograve: 'ò', ugrave: 'ù', deg: '°', frac12: '½', frac14: '¼', frac34: '¾' };
const entita = (s) => String(s || '').replace(/&(#x?[0-9a-f]+|[a-z]+\d*);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENT[e.toLowerCase()] ?? m;
});
const testo = (s) => entita(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Un po' di memoria (le funzioni restano "calde" per qualche minuto): niente richieste ripetute
// ---------------------------------------------------------------------------
const memo = new Map();
async function ricorda(chiave, ms, fn) {
  const x = memo.get(chiave);
  if (x && Date.now() - x.at < ms) return x.v;
  const v = await fn();
  if (v && v.errori && v.errori.length) return v; // una fonte non ha risposto: la prossima volta riprovo
  memo.set(chiave, { v, at: Date.now() });
  if (memo.size > 300) memo.delete(memo.keys().next().value);
  return v;
}

// ---------------------------------------------------------------------------
// Sicurezza per le pagine scelte dall'utente: solo siti pubblici (niente indirizzi interni)
// ---------------------------------------------------------------------------
function privato(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (x.startsWith('::ffff:')) return privato(x.slice(7));
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb');
}
async function hostSicuro(h) {
  if (!h || net.isIP(h) || /(^|\.)(localhost|local|internal|lan|home|arpa)$/i.test(h) || !h.includes('.')) return false;
  try { const all = await dns.lookup(h, { all: true }); return all.length > 0 && all.every((a) => !privato(a.address)); } catch { return false; }
}

/** Scarica (al massimo `max` byte) seguendo pochi rinvii e controllando ogni volta dove portano. */
async function scarica(url, { max = 3_000_000, ms = 8000, accept = 'text/html,application/xhtml+xml' } = {}) {
  let u = new URL(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    for (let i = 0; i < 5; i++) {
      if (u.protocol !== 'https:' || !(await hostSicuro(u.hostname))) throw Object.assign(new Error('Indirizzo non permesso'), { status: 400 });
      const r = await fetch(u.href, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': UA_BROWSER, Accept: accept, 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.6' } });
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc) { if (r.body) await r.body.cancel().catch(() => {}); u = new URL(loc, u); continue; }
      if (!r.ok) {
        if (r.body) await r.body.cancel().catch(() => {});
        // verifica anti-robot (Cloudflare & co.): la pagina si apre solo in un browser, con una persona davanti
        if (r.headers.get('cf-mitigated') || ((r.status === 403 || r.status === 503) && /cloudflare/i.test(r.headers.get('server') || ''))) {
          throw Object.assign(new Error('Questo sito non lascia leggere le sue pagine alle app: aprila e copia ingredienti e preparazione'), { status: 422 });
        }
        throw Object.assign(new Error(`La pagina risponde ${r.status}`), { status: 502 });
      }
      const reader = r.body.getReader();
      const parti = [];
      let n = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        n += value.length;
        if (n > max) { await reader.cancel().catch(() => {}); if (accept.startsWith('image')) throw new Error('immagine troppo grande'); break; }
        parti.push(value);
      }
      return { buf: Buffer.concat(parti), tipo: r.headers.get('content-type') || '', url: u.href };
    }
    throw Object.assign(new Error('Troppi rinvii'), { status: 502 });
  } finally { clearTimeout(t); }
}

/** Una foto come "data URL" (l'app salva le foto nel database, non link esterni). */
async function fotoDati(url) {
  try {
    if (!url) return '';
    const { buf, tipo } = await scarica(url, { max: 1_500_000, ms: 6000, accept: 'image/webp,image/jpeg,image/png,image/*' });
    const t = (tipo.match(/image\/(jpeg|jpg|png|webp)/i) || [])[1];
    if (!t || buf.length < 500) return '';
    return `data:image/${t.toLowerCase() === 'jpg' ? 'jpeg' : t.toLowerCase()};base64,${buf.toString('base64')}`;
  } catch { return ''; }
}

const minuti = (iso) => {
  // "PT1H30M" → 90; "45 minuti" → 45; "1 ora" → 60
  const s = String(iso || '');
  const m = s.match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (m && (m[1] || m[2])) return (Number(m[1] || 0) * 60) + Number(m[2] || 0);
  const h = s.match(/(\d+)\s*(?:ore|ora|h)\b/i), mi = s.match(/(\d+)\s*(?:min|minuti|')/i);
  const v = (h ? Number(h[1]) * 60 : 0) + (mi ? Number(mi[1]) : 0);
  return v || null;
};
const porzioni = (y) => { const m = String(Array.isArray(y) ? y[0] : y || '').match(/\d+/); return m ? Math.min(99, Number(m[0])) : null; };

// ---------------------------------------------------------------------------
// GialloZafferano: la pagina pubblica dei risultati di ricerca. L'ordine viene dall'elenco strutturato
// (schema.org ItemList) che la pagina prepara per i motori di ricerca; foto, voto, difficoltà e tempo
// dalle schede. Solo le ricette della redazione (ricette.giallozafferano.it), non i blog ospitati.
// ---------------------------------------------------------------------------
const RICETTA_GZ = /^https:\/\/ricette\.giallozafferano\.it\/[A-Za-z0-9-]+\.html$/;
const FOTO_GZ = /^https:\/\/www\.giallozafferano\.it\/images\/[\w./-]+\.(?:jpe?g|png|webp)$/i;
const daSlug = (u) => { const x = decodeURIComponent(u.split('/').pop().replace(/\.html$/, '')).replace(/-/g, ' ').trim(); return x.charAt(0).toUpperCase() + x.slice(1); };

function schedeGz(html) {
  const out = new Map();
  for (const m of html.matchAll(/<article[^>]*class="[^"]*gz-card[^"]*"[^>]*>([\s\S]*?)<\/article>/g)) {
    const a = m[1];
    const link = (a.match(/href="(https:\/\/ricette\.giallozafferano\.it\/[A-Za-z0-9-]+\.html)"/) || [])[1];
    if (!link || !RICETTA_GZ.test(link)) continue;
    const titolo = testo((a.match(/<h[2-4][^>]*class="[^"]*gz-title[^"]*"[^>]*>([\s\S]*?)<\/h[2-4]>/) || [])[1]) || entita((a.match(/title="([^"]+)"/) || [])[1] || '');
    const img = ((a.match(/<img[^>]+(?:data-src|src)="([^"]+)"/) || [])[1] || '').replace(/^\/\//, 'https://');
    const dato = (nome) => testo((a.match(new RegExp(`#${nome}[^"]*"[\\s\\S]*?<\\/span>([^<]*)`)) || [])[1]);
    const prima = out.get(link) || {};
    const scheda = {
      link,
      titolo: titolo || prima.titolo || daSlug(link),
      immagine: FOTO_GZ.test(img) ? img : prima.immagine || '',
      voto: dato('voto') || prima.voto || '',
      difficolta: dato('difficolta') || prima.difficolta || '',
      tempo: dato('tempo') || prima.tempo || '',
      categoria: testo((a.match(/<div class="gz-category">([\s\S]*?)<\/div>/) || [])[1]) || prima.categoria || '',
    };
    out.set(link, { ...prima, ...Object.fromEntries(Object.entries(scheda).filter(([, v]) => v)) });
  }
  return out;
}

async function cercaGz(q) {
  const { buf, url } = await scarica(`${GZ}/ricerca-ricette/${encodeURIComponent(q).replace(/%20/g, '+')}/`, { max: 2_500_000, ms: 8000 });
  const html = buf.toString('utf8');
  if (!/giallozafferano/i.test(html) || html.length < 5000) throw Object.assign(new Error('GialloZafferano non risponde come al solito'), { status: 502 });
  // l'ordine dei risultati: l'elenco strutturato, se c'è; altrimenti quello delle schede
  let ordine = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim());
      if (j && j['@type'] === 'ItemList') ordine = (j.itemListElement || []).map((x) => x && x.url).filter((u) => RICETTA_GZ.test(u || ''));
    } catch {}
    if (ordine.length) break;
  }
  const schede = schedeGz(html);
  const links = [...new Set([...ordine, ...schede.keys()])].slice(0, 12);
  return {
    vuota: /\/ricerca\//.test(new URL(url).pathname) && !links.length,
    risultati: links.map((link) => {
      const s = schede.get(link) || { link, titolo: daSlug(link) };
      return {
        fonte: 'giallozafferano', id: link, link, titolo: s.titolo, immagine: s.immagine || '',
        descrizione: [s.difficolta, s.tempo, s.voto ? `★ ${s.voto}` : ''].filter(Boolean).join(' · ') || s.categoria || '',
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Da una pagina qualsiasi: i dati strutturati schema.org "Recipe" (quelli che i siti preparano per Google)
// ---------------------------------------------------------------------------
function trovaRicetta(x, prof = 0) {
  if (!x || typeof x !== 'object' || prof > 6) return null;
  if (Array.isArray(x)) { for (const y of x) { const r = trovaRicetta(y, prof + 1); if (r) return r; } return null; }
  const t = x['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return x;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) { const r = trovaRicetta(x[k], prof + 1); if (r) return r; }
  return null;
}
function istruzioni(x, out = []) {
  if (!x) return out;
  if (typeof x === 'string') {
    // un testo unico: un passaggio per riga (o per paragrafo)
    entita(x.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n').replace(/<[^>]*>/g, ' '))
      .split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).forEach((s) => out.push(s));
    return out;
  }
  if (Array.isArray(x)) { x.forEach((y) => istruzioni(y, out)); return out; }
  if (x.itemListElement) return istruzioni(x.itemListElement, out); // HowToSection
  if (x.text) out.push(testo(x.text));
  else if (x.name) out.push(testo(x.name));
  return out;
}
const immagineDi = (img) => {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return immagineDi(img[img.length > 1 ? 1 : 0]) || immagineDi(img[0]);
  return img.url || img.contentUrl || '';
};

// i siti più usati con il loro nome (gli altri con l'indirizzo)
const NOMI = { 'giallozafferano.it': 'GialloZafferano', 'fattoincasadabenedetta.it': 'Fatto in casa da Benedetta', 'misya.info': 'Misya', 'cucchiaio.it': 'Il Cucchiaio d’Argento', 'cookist.it': 'Cookist', 'lacucinaitaliana.it': 'La Cucina Italiana', 'salepepe.it': 'Sale&Pepe', 'ricetteperbimby.it': 'Ricette per Bimby' };
const nomeSito = (host) => { const h = host.replace(/^www\./, ''); const k = Object.keys(NOMI).find((d) => h === d || h.endsWith(`.${d}`)); return k ? NOMI[k] : h; };
// GialloZafferano nei passaggi richiama le sue foto con i numeri ("…la crema 5 ; tenetela", "(16)"): qui le foto non ci sono
const senzaRimandi = (p) => p.replace(/\s*\(\s*\d{1,2}\s*\)(?=\s*[.,;:!?]|\s|$)/g, '').replace(/(?:\s\d{1,2})+\s+(?=[.,;:!?])/g, '').replace(/\s+([.,;:!?])/g, '$1').trim();

async function daPagina(indirizzo) {
  let u;
  try { u = new URL(String(indirizzo || '').trim()); } catch { throw Object.assign(new Error('Link non valido'), { status: 400 }); }
  const { buf, url } = await scarica(u.href);
  const html = buf.toString('utf8');
  let ricetta = null;
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { ricetta = trovaRicetta(JSON.parse(m[1].trim().replace(/[\u0000-\u001f]+/g, ' '))); } catch {}
    if (ricetta) break;
  }
  if (!ricetta) throw Object.assign(new Error('In questa pagina non trovo una ricetta da importare'), { status: 422 });
  const host = new URL(url).hostname;
  const gz = /(^|\.)giallozafferano\.it$/.test(host);
  const img = immagineDi(ricetta.image);
  return {
    titolo: testo(ricetta.name) || 'Ricetta',
    ingredienti: (Array.isArray(ricetta.recipeIngredient) ? ricetta.recipeIngredient : ricetta.ingredients || []).map(testo).filter(Boolean).slice(0, 60),
    passi: istruzioni(ricetta.recipeInstructions).map((p) => (gz ? senzaRimandi(p) : p)).filter((p) => p.length > 1).slice(0, 60),
    porzioni: porzioni(ricetta.recipeYield),
    tempo: minuti(ricetta.totalTime) || ((minuti(ricetta.prepTime) || 0) + (minuti(ricetta.cookTime) || 0)) || null,
    immagine: img ? await fotoDati(new URL(img, url).href) : '',
    fonte: { nome: nomeSito(host), url, licenza: '' },
  };
}

// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (await respingi(req, res)) return;
  const p = new URL(req.url, 'http://x').searchParams;
  try {
    if (p.get('url')) return send(res, 200, await ricorda(`u:${p.get('url')}`, 30 * 60000, () => daPagina(p.get('url'))));
    const q = String(p.get('q') || '').trim().slice(0, 80);
    if (q.length < 3) return send(res, 400, { error: 'Scrivi almeno 3 lettere' });
    const out = await ricorda(`q:${norm(q)}`, 10 * 60000, async () => {
      const gz = await cercaGz(q);
      return { q, risultati: gz.risultati, errori: [] };
    });
    send(res, 200, out);
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 502, { error: e.status ? e.message : 'GialloZafferano non risponde, riprova tra poco' });
  }
}
