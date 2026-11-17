// GET /api/link?url=https://spotify.link/…   → { url: "https://open.spotify.com/track/…" }
// GET /api/link?lista=https://www.amazon.it/hz/wishlist/ls/…  → { nome, articoli: [{ titolo, foto, prezzo, link… }] }
//
// I link brevi che le app mettono nel "Condividi" (Spotify, Amazon) rimandano all'indirizzo vero: qui seguo
// solo quei rinvii, e solo verso Spotify o Amazon.
// Le liste dei desideri di Amazon: Amazon non ha un'API per leggerle, ma una lista pubblica (o condivisa
// con il link) si apre senza account. Qui leggo quella pagina come un browser: nome, foto, prezzo e link di
// ogni prodotto. Niente account, niente password. Se Amazon chiede una verifica o la lista è privata lo dico.
// Protetto dal codice di famiglia.
import { respingi, send } from './_lib.js';

const BREVI = /^(spotify\.link|spotify\.app\.link|amzn\.eu|amzn\.to|a\.co)$/i;
const AMAZON = /^(www\.|m\.|smile\.)?amazon\.(it|com|de|fr|es|co\.uk|nl|com\.be|se|pl|ie|com\.tr|ae|sa|in|ca|com\.mx|com\.br|co\.jp|com\.au|sg|eg)$/i;
const FINALE = (h) => h === 'open.spotify.com' || AMAZON.test(h);
// pagina intermedia di spotify.link: dentro c'è l'indirizzo di open.spotify.com
const SPOTIFY_IN_PAGINA = /https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:track|album|playlist|artist|episode|show)\/[A-Za-z0-9]{10,40}/;

/** Toglie i parametri di tracciamento; Amazon diventa amazon.xx/dp/ASIN (con il nome se c'era). */
export function pulisci(u) {
  if (u.hostname === 'open.spotify.com') return `https://open.spotify.com${u.pathname}`;
  const asin = (u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?=[/?]|$)/i) || [])[1];
  const host = u.hostname.replace(/^(m|smile)\./, 'www.').replace(/^amazon\./, 'www.amazon.');
  if (!asin) return `https://${host}${u.pathname}`;
  const slug = (u.pathname.match(/^\/([^/]+)\/(?:dp|gp\/product)\//i) || [])[1];
  return `https://${host}/${slug && !/^(dp|gp)$/i.test(slug) ? `${slug}/` : ''}dp/${asin.toUpperCase()}`;
}

async function passo(href) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(href, { method: 'GET', redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', Accept: 'text/html' } });
    const loc = r.headers.get('location');
    // la pagina intermedia di spotify.link la guardo solo per trovare l'indirizzo di Spotify (al massimo 200 KB)
    let testo = '';
    if (!loc && r.ok && /spotify/i.test(href)) testo = (await r.text()).slice(0, 200000);
    else if (r.body) { try { await r.body.cancel(); } catch {} }
    return { status: r.status, loc, testo };
  } finally { clearTimeout(t); }
}

// ---------------------------------------------------------------------------
// Liste dei desideri di Amazon
// ---------------------------------------------------------------------------
const UA_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const LISTA = /\/(?:hz\/wishlist\/ls|registry\/wishlist|wishlist)\/([A-Z0-9]{8,16})(?=[/?]|$)/i;
const VALUTA = { it: 'EUR', de: 'EUR', fr: 'EUR', es: 'EUR', nl: 'EUR', 'com.be': 'EUR', ie: 'EUR', 'co.uk': 'GBP', com: 'USD', ca: 'CAD', se: 'SEK', pl: 'PLN' };
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const entita = (x) => String(x || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENT[e.toLowerCase()] ?? m;
});
const testo = (x) => entita(String(x || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const errore = (msg, status) => Object.assign(new Error(msg), { status });

/** Una pagina di Amazon (solo amazon.xx, al massimo 3 rinvii, mai la pagina di accesso). */
async function pagAmazon(href) {
  let u = new URL(href);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    for (let i = 0; i < 4; i++) {
      if (u.protocol !== 'https:' || !AMAZON.test(u.hostname)) throw errore('Link non supportato', 400);
      if (/\/ap\/signin/.test(u.pathname)) throw errore('Questa lista è privata: su Amazon aprila, tocca «Gestisci lista» e rendila pubblica o condivisa', 403);
      const r = await fetch(u.href, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': UA_DESKTOP, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'it-IT,it;q=0.9' } });
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc) { if (r.body) await r.body.cancel().catch(() => {}); u = new URL(loc, u); continue; }
      if (r.status === 404) throw errore('Questa lista non esiste più su Amazon', 404);
      if (!r.ok) throw errore('Amazon adesso non apre la lista: riprova più tardi (e controlla che sia pubblica o condivisa)', 503);
      const html = (await r.text()).slice(0, 3_000_000);
      if (/validateCaptcha|api-services-support@amazon\.com|Inserisci i caratteri/i.test(html)) throw errore('Amazon chiede una verifica: riprova più tardi', 503);
      return html;
    }
    throw errore('Amazon non risponde adesso', 503);
  } catch (e) {
    if (e.status) throw e;
    throw errore('Amazon non risponde adesso', 503);
  } finally { clearTimeout(t); }
}

/** I prodotti di una pagina della lista. */
function prodotti(html, host) {
  const out = [];
  const attr = (tag, nome) => entita((tag.match(new RegExp(`\\b${nome}="([^"]*)"`, 'i')) || [])[1] || '');
  for (const pezzo of html.split(/<li\b(?=[^>]*\bdata-itemId=")/i).slice(1)) {
    const li = pezzo.slice(0, pezzo.indexOf('>'));
    const asin = (attr(li, 'data-reposition-action-params').match(/ASIN:([A-Z0-9]{10})/) || [])[1] || (pezzo.match(/href="\/dp\/([A-Z0-9]{10})/) || [])[1];
    const titolo = testo((pezzo.match(/id="itemName_[^"]*"[^>]*title="([^"]*)"/) || [])[1] || (pezzo.match(/<img[^>]+alt="([^"]*)"/) || [])[1]);
    if (!asin || !titolo) continue;
    const img = (pezzo.match(/<img[^>]+src="(https:\/\/m\.media-amazon\.com\/images\/I\/[\w%+.-]+\.(?:jpe?g|png|webp))"/i) || [])[1] || '';
    const prezzo = Number(attr(li, 'data-price'));
    const conta = (id) => Number(testo((pezzo.match(new RegExp(`id="${id}_[^"]*"[^>]*>([^<]*)<`)) || [])[1])) || 0;
    out.push({
      id: attr(li, 'data-itemId') || asin,
      asin,
      titolo: titolo.slice(0, 200),
      di: testo((pezzo.match(/id="item-byline-[^"]*"[^>]*>([^<]*)</) || [])[1]).replace(/^di\s+/i, '').slice(0, 80),
      // la foto un po' più grande (quella della pagina è 135 px)
      foto: img.replace(/\._[^/]*_\.(jpe?g|png|webp)$/i, '._SS400_.$1'),
      prezzo: Number.isFinite(prezzo) && prezzo > 0 ? Math.round(prezzo * 100) / 100 : null,
      voluti: conta('itemRequested'),
      presi: conta('itemPurchased'),
      link: `https://${host}/dp/${asin}`,
    });
  }
  return out;
}

const liste = new Map(); // un po' di memoria: la stessa lista non si rilegge per 10 minuti
async function leggiLista(indirizzo) {
  let u;
  try { u = new URL(String(indirizzo || '').trim()); } catch { throw errore('Link non valido', 400); }
  if (u.protocol !== 'https:' || !AMAZON.test(u.hostname)) throw errore('Non è un link di Amazon', 400);
  const id = (u.pathname.match(LISTA) || [])[1];
  if (!id) throw errore('Non è il link di una lista dei desideri', 400);
  const host = u.hostname.replace(/^(m|smile)\./, 'www.').replace(/^amazon\./, 'www.amazon.');
  const chiave = `${host}/${id.toUpperCase()}`;
  const c = liste.get(chiave);
  if (c && Date.now() - c.at < 10 * 60000) return c.v;
  const prima = await pagAmazon(`https://${host}/hz/wishlist/ls/${id.toUpperCase()}`);
  const nome = testo((prima.match(/id="profile-list-name"[^>]*>([\s\S]*?)<\/span>/) || [])[1]);
  if (!nome && !/data-itemId=/i.test(prima)) throw errore('Non riesco a leggere questa lista: controlla che sia pubblica o condivisa', 422);
  const articoli = prodotti(prima, host);
  // le pagine successive (10 prodotti per volta) finché Amazon non dice "Fine della lista", con calma (una
  // ogni secondo circa); se Amazon dice di no ci si ferma lì (niente insistenze): la lista resta a metà
  let html = prima;
  let completa = true;
  for (let i = 0; i < 30 && !/id="endOfListMarker"/.test(html); i++) {
    const altra = entita((html.match(/name="showMoreUrl"\s+value="([^"]+)"/) || [])[1] || '');
    if (!altra || !altra.startsWith('/')) break;
    await new Promise((ok) => setTimeout(ok, 900));
    try { html = await pagAmazon(`https://${host}${altra}`); } catch { completa = false; break; }
    const nuovi = prodotti(html, host).filter((x) => !articoli.some((y) => y.id === x.id));
    if (!nuovi.length) break;
    articoli.push(...nuovi);
    if (articoli.length >= 300) break;
  }
  const tld = host.replace(/^www\.amazon\./, '');
  const v = { nome, articoli, completa, valuta: VALUTA[tld] || '', url: `https://${host}/hz/wishlist/ls/${id.toUpperCase()}`, at: Date.now() };
  liste.set(chiave, { v, at: Date.now() });
  if (liste.size > 50) liste.delete(liste.keys().next().value);
  return v;
}

export default async function handler(req, res) {
  if (await respingi(req, res)) return;
  const q = new URL(req.url, 'http://x').searchParams;
  if (q.get('lista')) {
    try {
      // un link breve (amzn.eu/…) prima porta alla lista vera
      let l = String(q.get('lista')).trim();
      try { const b = new URL(l); if (BREVI.test(b.hostname)) l = (await vero(b)) || l; } catch {}
      return send(res, 200, await leggiLista(l));
    } catch (e) {
      if (!e.status) console.error(e);
      return send(res, e.status || 502, { error: e.status ? e.message : 'Amazon non risponde adesso' });
    }
  }
  let u;
  try { u = new URL(String(q.get('url') || '').trim()); } catch { return send(res, 400, { error: 'Link non valido' }); }
  if (u.protocol !== 'https:') return send(res, 400, { error: 'Link non valido' });
  if (FINALE(u.hostname)) return send(res, 200, { url: pulisci(u) });
  if (!BREVI.test(u.hostname)) return send(res, 400, { error: 'Link non supportato' });
  let dove;
  try { dove = await vero(u); } catch { return send(res, 502, { error: 'Il link non risponde' }); }
  if (dove) return send(res, 200, { url: dove });
  send(res, 404, { error: 'Non trovo dove porta questo link' });
}

/** Segue i rinvii di un link breve fino a Spotify o Amazon (o null). */
async function vero(u) {
  for (let i = 0; i < 5; i++) {
    const r = await passo(u.href);
    if (r.loc && r.status >= 300 && r.status < 400) {
      const next = new URL(r.loc, u);
      if (next.protocol !== 'https:') return null;
      if (FINALE(next.hostname)) return pulisci(next);
      if (!BREVI.test(next.hostname)) return null;
      u = next;
      continue;
    }
    const m = r.testo && r.testo.match(SPOTIFY_IN_PAGINA);
    return m ? pulisci(new URL(m[0])) : null;
  }
  return null;
}
