// GET /api/film?q=titolo[&anno=2007][&tipo=movie|tv]
// Cerca un film o una serie e restituisce copertina e dove vederlo in Italia,
// senza chiavi da configurare: dati pubblici di JustWatch (con le copertine di
// Apple TV come riserva). Protetto dal codice di famiglia.
import { respingi, send } from './_lib.js';

const JW = 'https://apis.justwatch.com/graphql';
const IMG = 'https://images.justwatch.com';

const QUERY = `query CercaTitoli($filter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!, $offerFilter: OfferFilter!) {
  popularTitles(country: $country, filter: $filter, first: $first, sortBy: POPULAR, sortRandomSeed: 0) {
    edges {
      node {
        id
        objectType
        content(country: $country, language: $language) {
          title
          fullPath
          originalReleaseYear
          posterUrl(profile: S718, format: JPG)
          genres { shortName }
        }
        offers(country: $country, platform: WEB, filter: $offerFilter) {
          monetizationType
          presentationType
          standardWebURL
          retailPrice(language: $language)
          package { clearName technicalName icon(profile: S100, format: PNG) }
        }
      }
    }
  }
}`;

const TYPES = { FLATRATE: 'flatrate', FREE: 'free', ADS: 'free', FAST: 'free', RENT: 'rent', BUY: 'buy' };

// Generi di JustWatch → categorie dei film dell'app (Natale e Halloween non sono generi: li sceglie la famiglia)
const GENERI = { fml: 'famiglia', act: 'azione', trl: 'thriller', hrr: 'horror', ani: 'cartoni' };
const categorie = (gs) => [...new Set((gs || []).map((g) => g && GENERI[g.shortName]).filter(Boolean))];
// lo stesso per i generi di Apple (in inglese o in italiano)
const daGenere = (g) => { const x = String(g || ''); return [/horror|orrore/i.test(x) && 'horror', /thriller/i.test(x) && 'thriller', /action|azione/i.test(x) && 'azione', /family|kids|famiglia|bambini/i.test(x) && 'famiglia', /anima|cartoni/i.test(x) && 'cartoni'].filter(Boolean); };
const QUALITY = { _4K: 3, HD: 2, SD: 1 };

function offersFrom(list) {
  const out = new Map();
  (list || []).forEach((o) => {
    const t = TYPES[o.monetizationType];
    if (!t || !o.package) return;
    const key = `${t}:${o.package.clearName}`;
    const prev = out.get(key);
    const q = QUALITY[o.presentationType] || 0;
    if (prev && prev.q >= q) return;
    out.set(key, {
      t,
      name: o.package.clearName,
      icon: o.package.icon ? IMG + o.package.icon : '',
      url: typeof o.standardWebURL === 'string' && o.standardWebURL.startsWith('https://') ? o.standardWebURL : '',
      price: o.retailPrice || '',
      q,
    });
  });
  return [...out.values()].map(({ q, ...o }) => o);
}

async function justwatch(q) {
  const r = await fetch(JW, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (FamComperotto)', Accept: 'application/json' },
    body: JSON.stringify({
      operationName: 'CercaTitoli',
      query: QUERY,
      variables: { filter: { searchQuery: q }, country: 'IT', language: 'it', first: 8, offerFilter: { bestOnly: true } },
    }),
  });
  if (!r.ok) throw new Error(`JustWatch ${r.status}`);
  const j = await r.json();
  if (j.errors && !j.data) throw new Error('JustWatch: ' + (j.errors[0] && j.errors[0].message));
  const edges = (j.data && j.data.popularTitles && j.data.popularTitles.edges) || [];
  return edges.map(({ node: n }) => ({
    jw: n.id,
    kind: n.objectType === 'SHOW' ? 'tv' : 'movie',
    title: n.content && n.content.title,
    year: n.content && n.content.originalReleaseYear,
    poster: n.content && n.content.posterUrl ? IMG + n.content.posterUrl : '',
    link: n.content && n.content.fullPath ? `https://www.justwatch.com${n.content.fullPath}` : '',
    offers: offersFrom(n.offers),
    categorie: categorie(n.content && n.content.genres),
  })).filter((x) => x.title);
}

async function itunes(q, kind) {
  const tv = kind === 'tv';
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&country=IT&lang=it_it&limit=8&media=${tv ? 'tvShow' : 'movie'}&entity=${tv ? 'tvSeason' : 'movie'}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`iTunes ${r.status}`);
  const j = await r.json();
  return (j.results || []).map((x) => ({
    jw: null,
    kind: tv ? 'tv' : 'movie',
    title: tv ? (x.collectionName || '').replace(/,?\s*(stagione|season)\s*\d+.*$/i, '') : x.trackName,
    year: Number(String(x.releaseDate || '').slice(0, 4)) || null,
    poster: (x.artworkUrl100 || '').replace(/\/\d+x\d+bb\./, '/600x900bb.'),
    link: '',
    offers: null,
    categorie: daGenere(x.primaryGenreName),
  })).filter((x) => x.title);
}

export default async function handler(req, res) {
  if (await respingi(req, res)) return;
  const p = new URL(req.url, 'http://x').searchParams;
  const q = String(p.get('q') || '').trim().slice(0, 120);
  if (!q) return send(res, 400, { error: 'Manca il titolo' });
  const kind = p.get('tipo') === 'tv' ? 'tv' : null;

  let results = [];
  let source = 'justwatch';
  try { results = await justwatch(q); } catch (e) { console.error(e.message); }
  if (!results.length) {
    source = 'itunes';
    try { results = await itunes(q, kind); } catch (e) { console.error(e.message); }
  } else if (results.some((x) => !x.poster)) {
    // copertine mancanti: provo con Apple
    try {
      const alt = await itunes(q, kind);
      results.forEach((x) => {
        if (x.poster) return;
        const m = alt.find((a) => a.title.toLowerCase() === x.title.toLowerCase() && (!x.year || !a.year || Math.abs(a.year - x.year) <= 1));
        if (m) x.poster = m.poster;
      });
    } catch {}
  }
  send(res, 200, { source, results });
}
