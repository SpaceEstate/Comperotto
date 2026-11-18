// L'indirizzo dalle coordinate (OpenStreetMap), con un limite di tempo. Usato da Dov'è e dall'auto.
const UA = { 'User-Agent': 'FamComperotto/1.0 (app di casa per uso familiare)', Accept: 'application/json' };

// OpenStreetMap a volte dà alle aree pedonali nomi di servizio (es. "1_33051"): quelli non si mostrano
const nome = (s) => (typeof s === 'string' && /\p{L}/u.test(s) && !/^\d+_\d+$/.test(s) ? s.trim() : '');

/**
 * "Via Roma, Torino". Con { preciso: true } (per l'auto) anche il civico e, se c'è,
 * il nome del parcheggio: "Parcheggio Porta Nuova, Corso Vittorio Emanuele II, Torino".
 * Se OpenStreetMap non risponde in tempo: stringa vuota.
 */
export async function luogo(lat, lon, { preciso = false, attesa = 2500 } = {}) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), attesa);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=${preciso ? 18 : 17}&accept-language=it&lat=${lat}&lon=${lon}`, {
      headers: UA,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return '';
    const j = await r.json();
    const a = j.address || {};
    const strada = nome(a.road) || nome(a.pedestrian) || nome(a.square);
    let via = strada || a.neighbourhood || a.suburb || '';
    if (preciso && strada && a.house_number) via = `${strada} ${a.house_number}`;
    const citta = a.city || a.town || a.village || a.municipality || a.county || '';
    const parcheggio = preciso && j.category === 'amenity' && /^parking/.test(j.type || '') ? nome(j.name) : '';
    return [parcheggio, via, citta].filter(Boolean).join(', ') || (j.display_name || '').split(',').slice(0, 2).join(',').trim();
  } catch {
    return '';
  }
}
