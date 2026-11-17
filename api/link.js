// GET /api/link?url=https://spotify.link/… → { url: "https://open.spotify.com/track/…" }
//
// I link brevi che le app mettono nel "Condividi" (Spotify, Amazon) rimandano all'indirizzo vero.
// Qui seguo solo quei rinvii, e solo verso Spotify o Amazon: niente pagine scaricate, niente dati letti.
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

export default async function handler(req, res) {
  if (await respingi(req, res)) return;
  let u;
  try { u = new URL(String(new URL(req.url, 'http://x').searchParams.get('url') || '').trim()); } catch { return send(res, 400, { error: 'Link non valido' }); }
  if (u.protocol !== 'https:') return send(res, 400, { error: 'Link non valido' });
  if (FINALE(u.hostname)) return send(res, 200, { url: pulisci(u) });
  if (!BREVI.test(u.hostname)) return send(res, 400, { error: 'Link non supportato' });
  try {
    for (let i = 0; i < 5; i++) {
      const r = await passo(u.href);
      if (r.loc && r.status >= 300 && r.status < 400) {
        const next = new URL(r.loc, u);
        if (next.protocol !== 'https:') break;
        if (FINALE(next.hostname)) return send(res, 200, { url: pulisci(next) });
        if (!BREVI.test(next.hostname)) break;
        u = next;
        continue;
      }
      const m = r.testo && r.testo.match(SPOTIFY_IN_PAGINA);
      if (m) return send(res, 200, { url: pulisci(new URL(m[0])) });
      break;
    }
  } catch {
    return send(res, 502, { error: 'Il link non risponde' });
  }
  send(res, 404, { error: 'Non trovo dove porta questo link' });
}
