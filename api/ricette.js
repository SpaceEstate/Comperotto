// Ricette anche da internet, senza chiavi e senza servizi a pagamento.
//   GET /api/ricette?q=carbonara              → risultati online: Wikibooks "Libro di cucina" (in italiano)
//                                               e TheMealDB (internazionale, in inglese)
//   GET /api/ricette?fonte=wikibooks&id=…      → la ricetta completa, pronta da importare
//   GET /api/ricette?fonte=themealdb&id=…
//   GET /api/ricette?url=https://…             → importa da una pagina di ricetta che pubblica i dati
//                                               standard schema.org (quasi tutti i siti di cucina)
// Protetto dal codice di famiglia: non è un passa-richieste aperto a tutti.
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { respingi, send } from './_lib.js';

const UA = 'FamComperotto/1.0 (https://comperotto.vercel.app; app di casa per uso familiare)';
const UA_BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const WB = 'https://it.wikibooks.org';
const PREF = 'Libro di cucina/Ricette/';
const MDB = 'https://www.themealdb.com/api/json/v1/1';

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

async function getJson(url, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
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
      if (!r.ok) throw Object.assign(new Error(`La pagina risponde ${r.status}`), { status: 502 });
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
// Wikibooks: il "Libro di cucina" in italiano (licenza CC BY-SA: si può importare citando la fonte)
// ---------------------------------------------------------------------------
const pagina = (titolo) => `${WB}/wiki/${titolo.replace(/ /g, '_').split('/').map(encodeURIComponent).join('/')}`;
// Wikimedia dà le miniature solo in larghezze standard (120, 250, 330, 500, 960…)
const miniatura = (u, w = 330) => (u ? `https:${String(u).replace(/^https?:/, '')}`.replace(/\/\d+px-/, `/${w}px-`).replace(/\?.*$/, '') : '');

async function cercaWikibooks(q) {
  const j = await getJson(`${WB}/w/rest.php/v1/search/page?q=${encodeURIComponent(`${q} prefix:${PREF.replace(/ /g, '_')}`)}&limit=12`);
  const nq = norm(q);
  return (j.pages || [])
    .filter((p) => p && typeof p.title === 'string' && p.title.startsWith(PREF) && p.title.length > PREF.length)
    .map((p) => {
      const desc = testo(p.description || '') || testo(p.excerpt || '').replace(/^\W+/, '');
      return {
        fonte: 'wikibooks', id: p.title, titolo: p.title.slice(PREF.length), lingua: 'it',
        immagine: p.thumbnail && p.thumbnail.url ? miniatura(p.thumbnail.url) : '',
        descrizione: desc ? `${desc.slice(0, 120)}${desc.length > 120 ? '…' : ''}` : 'Dal Libro di cucina di Wikibooks',
        link: pagina(p.title),
      };
    })
    .sort((a, b) => Number(norm(b.titolo).includes(nq)) - Number(norm(a.titolo).includes(nq)))
    .slice(0, 8);
}

/** Toglie il "codice" di wiki: collegamenti, modelli, note, grassetti. */
function wiki(s) {
  let x = String(s || '');
  x = x.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  for (let i = 0; i < 4; i++) x = x.replace(/\{\{[^{}]*\}\}/g, '');
  x = x.replace(/\[\[(?:File|Immagine|Image|Categoria|Category):[^\]]*\]\]/gi, '');
  x = x.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1');
  x = x.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1').replace(/\[https?:\/\/[^\]]*\]/g, '');
  x = x.replace(/'{2,}/g, '');
  return testo(x);
}

async function ricettaWikibooks(id) {
  const titolo = String(id || '').replace(/_/g, ' ');
  if (!titolo.startsWith(PREF)) throw Object.assign(new Error('Ricetta sconosciuta'), { status: 400 });
  const j = await getJson(`${WB}/w/rest.php/v1/page/${encodeURIComponent(titolo.replace(/ /g, '_'))}`, 6000);
  const src = String(j.source || '');
  const sezioni = {};
  let nome = '_';
  src.split(/\r?\n/).forEach((riga) => {
    const h = riga.match(/^\s*={2,}\s*(.*?)\s*={2,}\s*$/);
    if (h) { nome = norm(h[1]); sezioni[nome] = []; return; }
    (sezioni[nome] ||= []).push(riga);
  });
  const trova = (re) => Object.keys(sezioni).find((k) => re.test(k));
  const kIngr = trova(/ingredient/);
  const kPrep = trova(/preparazion|procediment|esecuzion|istruzion|realizzazion|cottura/);
  const elenco = (righe) => (righe || []).filter((r) => /^\s*[*#]/.test(r)).map((r) => wiki(r.replace(/^\s*[*#:]+\s*/, ''))).filter(Boolean);
  const ingredienti = elenco(sezioni[kIngr]);
  let passi = elenco(sezioni[kPrep]);
  if (!passi.length && sezioni[kPrep]) passi = sezioni[kPrep].join('\n').split(/\n\s*\n/).map(wiki).filter((p) => p.length > 3);
  // "per '''2''' persone", "Dosi per 4 persone"
  const per = (sezioni[kIngr] || []).join(' ').match(/per\s*'*\s*(\d+)\s*'*\s*(?:persone|porzioni|pezzi)/i);
  const tempo = minuti((src.match(/tempo[^=|\n]*=\s*([^|\n}]+)/i) || [])[1]);
  const file = (src.match(/\[\[(?:File|Immagine|Image):([^|\]]+\.(?:jpe?g|png|webp))/i) || [])[1];
  let immagine = '';
  if (file) {
    // il percorso standard di Wikimedia Commons: /thumb/a/ab/Nome.jpg/500px-Nome.jpg (o l'originale, se è più piccolo)
    const nome = file.trim().replace(/ /g, '_');
    const h = crypto.createHash('md5').update(nome).digest('hex');
    const base = `https://upload.wikimedia.org/wikipedia/commons`;
    const enc = encodeURIComponent(nome);
    immagine = (await fotoDati(`${base}/thumb/${h[0]}/${h.slice(0, 2)}/${enc}/500px-${enc}`)) || (await fotoDati(`${base}/${h[0]}/${h.slice(0, 2)}/${enc}`));
  }
  return {
    titolo: titolo.slice(PREF.length), ingredienti, passi, porzioni: per ? Number(per[1]) : null, tempo, immagine,
    fonte: { nome: 'Wikibooks · Libro di cucina', url: pagina(titolo), licenza: 'CC BY-SA 4.0' },
  };
}

// ---------------------------------------------------------------------------
// TheMealDB: ricette di tutto il mondo (in inglese)
// ---------------------------------------------------------------------------
const AREA = { Italian: 'Italiana', British: 'Inglese', American: 'Americana', French: 'Francese', Mexican: 'Messicana', Chinese: 'Cinese', Japanese: 'Giapponese', Indian: 'Indiana', Spanish: 'Spagnola', Greek: 'Greca', Thai: 'Thailandese', Moroccan: 'Marocchina', Turkish: 'Turca', Irish: 'Irlandese', Canadian: 'Canadese', Jamaican: 'Giamaicana', Vietnamese: 'Vietnamita', Croatian: 'Croata', Dutch: 'Olandese', Egyptian: 'Egiziana', Filipino: 'Filippina', Kenyan: 'Keniota', Malaysian: 'Malese', Polish: 'Polacca', Portuguese: 'Portoghese', Russian: 'Russa', Tunisian: 'Tunisina', Ukrainian: 'Ucraina' };
const CATEG = { Dessert: 'Dolce', Pasta: 'Pasta', Beef: 'Manzo', Chicken: 'Pollo', Seafood: 'Pesce', Vegetarian: 'Vegetariana', Vegan: 'Vegana', Side: 'Contorno', Starter: 'Antipasto', Breakfast: 'Colazione', Lamb: 'Agnello', Pork: 'Maiale', Goat: 'Capra', Miscellaneous: 'Varie' };
const thumb = (u, size) => (/^https:\/\/www\.themealdb\.com\/images\//.test(String(u || '')) ? `${u}/${size}` : '');

async function cercaMealDb(q) {
  const j = await getJson(`${MDB}/search.php?s=${encodeURIComponent(q)}`);
  return (j.meals || []).slice(0, 8).map((m) => ({
    fonte: 'themealdb', id: String(m.idMeal), titolo: m.strMeal, lingua: 'en',
    immagine: thumb(m.strMealThumb, 'medium'),
    descrizione: ['Ricetta in inglese', AREA[m.strArea] ? `cucina ${AREA[m.strArea].toLowerCase()}` : '', CATEG[m.strCategory] || ''].filter(Boolean).join(' · '),
    link: /^https?:\/\//.test(m.strSource || '') ? m.strSource : `https://www.themealdb.com/meal/${m.idMeal}`,
  }));
}

async function ricettaMealDb(id) {
  if (!/^\d{1,10}$/.test(String(id))) throw Object.assign(new Error('Ricetta sconosciuta'), { status: 400 });
  const j = await getJson(`${MDB}/lookup.php?i=${id}`);
  const m = (j.meals || [])[0];
  if (!m) throw Object.assign(new Error('Ricetta non trovata'), { status: 404 });
  const ingredienti = [];
  for (let i = 1; i <= 20; i++) {
    const ing = String(m[`strIngredient${i}`] || '').trim(), dose = String(m[`strMeasure${i}`] || '').trim();
    if (ing) ingredienti.push(`${dose} ${ing}`.trim());
  }
  const passi = String(m.strInstructions || '').split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !/^step\s*\d+[.:]?$/i.test(x) && !/^\d+\.?$/.test(x)).map((x) => x.replace(/^step\s*\d+[.:]?\s*/i, ''));
  return {
    titolo: m.strMeal, ingredienti, passi, porzioni: null, tempo: null, immagine: await fotoDati(thumb(m.strMealThumb, 'large') || m.strMealThumb),
    fonte: { nome: 'TheMealDB', url: /^https?:\/\//.test(m.strSource || '') ? m.strSource : `https://www.themealdb.com/meal/${m.idMeal}`, licenza: '' },
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
  const host = new URL(url).hostname.replace(/^www\./, '');
  const img = immagineDi(ricetta.image);
  return {
    titolo: testo(ricetta.name) || 'Ricetta',
    ingredienti: (Array.isArray(ricetta.recipeIngredient) ? ricetta.recipeIngredient : ricetta.ingredients || []).map(testo).filter(Boolean).slice(0, 60),
    passi: istruzioni(ricetta.recipeInstructions).filter((p) => p.length > 1).slice(0, 60),
    porzioni: porzioni(ricetta.recipeYield),
    tempo: minuti(ricetta.totalTime) || ((minuti(ricetta.prepTime) || 0) + (minuti(ricetta.cookTime) || 0)) || null,
    immagine: img ? await fotoDati(new URL(img, url).href) : '',
    fonte: { nome: host, url, licenza: '' },
  };
}

// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (await respingi(req, res)) return;
  const p = new URL(req.url, 'http://x').searchParams;
  try {
    if (p.get('url')) return send(res, 200, await ricorda(`u:${p.get('url')}`, 30 * 60000, () => daPagina(p.get('url'))));
    if (p.get('fonte') === 'wikibooks') return send(res, 200, await ricorda(`w:${p.get('id')}`, 60 * 60000, () => ricettaWikibooks(p.get('id'))));
    if (p.get('fonte') === 'themealdb') return send(res, 200, await ricorda(`m:${p.get('id')}`, 60 * 60000, () => ricettaMealDb(p.get('id'))));
    const q = String(p.get('q') || '').trim().slice(0, 80);
    if (q.length < 3) return send(res, 400, { error: 'Scrivi almeno 3 lettere' });
    const out = await ricorda(`q:${norm(q)}`, 10 * 60000, async () => {
      const [wb, mdb] = await Promise.allSettled([cercaWikibooks(q), cercaMealDb(q)]);
      const visti = new Set();
      const risultati = [...(wb.value || []), ...(mdb.value || [])].filter((r) => { const k = norm(r.titolo); if (visti.has(k)) return false; visti.add(k); return true; });
      const errori = [wb.status === 'rejected' ? 'wikibooks' : '', mdb.status === 'rejected' ? 'themealdb' : ''].filter(Boolean);
      if (errori.length === 2) throw Object.assign(new Error('Le fonti online non rispondono adesso'), { status: 502 });
      return { q, risultati, errori };
    });
    send(res, 200, out);
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 502, { error: e.status ? e.message : 'Fonte non raggiungibile, riprova tra poco' });
  }
}
