// Film: ricerca titoli e "dove vederlo" in Italia tramite TMDB (dati piattaforme JustWatch).
// Serve una chiave API gratuita di TMDB, da incollare in Impostazioni (resta nel vostro database,
// non nel codice pubblico). Senza chiave l'app usa un link di ricerca a JustWatch.

const BASE = 'https://api.themoviedb.org/3';
const cache = new Map(); // `${kind}:${id}` → { at, data }
const TTL = 6 * 3600 * 1000;

async function req(path, params, key) {
  const url = new URL(BASE + path);
  Object.entries(params || {}).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v));
  const bearer = key.startsWith('eyJ');
  if (!bearer) url.searchParams.set('api_key', key);
  const r = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${key}`, accept: 'application/json' } : { accept: 'application/json' } });
  if (r.status === 401) throw new Error('Chiave TMDB non valida');
  if (!r.ok) throw new Error(`TMDB ${r.status}`);
  return r.json();
}

const safePath = (p) => (typeof p === 'string' && /^\/[\w.-]+$/.test(p) ? p : '');
export const img = (p, size = 'w342') => (safePath(p) ? `https://image.tmdb.org/t/p/${size}${safePath(p)}` : '');

export async function search(q, key) {
  const data = await req('/search/multi', { query: q, language: 'it-IT', include_adult: 'false', region: 'IT' }, key);
  return (data.results || [])
    .filter((x) => x.media_type === 'movie' || x.media_type === 'tv')
    .slice(0, 12)
    .map((x) => ({
      tmdbId: x.id,
      kind: x.media_type,
      title: x.title || x.name || '',
      year: Number(String(x.release_date || x.first_air_date || '').slice(0, 4)) || null,
      poster: safePath(x.poster_path),
    }));
}

/** Trova l'id TMDB di un titolo inserito a mano. */
export async function resolve(film, key) {
  const kind = film.kind === 'tv' ? 'tv' : 'movie';
  const params = { query: film.title, language: 'it-IT', include_adult: 'false' };
  if (film.year) params[kind === 'tv' ? 'first_air_date_year' : 'year'] = film.year;
  const data = await req(`/search/${kind}`, params, key);
  const x = (data.results || [])[0];
  return x ? { tmdbId: x.id, kind, poster: safePath(x.poster_path), year: film.year || Number(String(x.release_date || x.first_air_date || '').slice(0, 4)) || null } : null;
}

/** Piattaforme italiane: { link, flatrate:[], rent:[], buy:[], free:[] } — aggiornate dal vivo. */
export async function providers(kind, id, key, { force = false } = {}) {
  const k = `${kind}:${id}`;
  const hit = cache.get(k);
  if (hit && !force && Date.now() - hit.at < TTL) return hit.data;
  const data = await req(`/${kind === 'tv' ? 'tv' : 'movie'}/${id}/watch/providers`, {}, key);
  const it = (data.results || {}).IT || {};
  const map = (arr) => (arr || []).map((p) => ({ name: p.provider_name, logo: img(p.logo_path, 'w92') })).filter((p) => p.name);
  const out = {
    link: typeof it.link === 'string' && it.link.startsWith('https://') ? it.link : '',
    flatrate: map(it.flatrate),
    free: map([...(it.free || []), ...(it.ads || [])]),
    rent: map(it.rent),
    buy: map(it.buy),
  };
  cache.set(k, { at: Date.now(), data: out });
  return out;
}
export const cachedProviders = (kind, id) => { const h = cache.get(`${kind}:${id}`); return h ? h.data : null; };

export const justWatchUrl = (title) => `https://www.justwatch.com/it/cerca?q=${encodeURIComponent(title)}`;
