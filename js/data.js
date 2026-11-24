// Costanti e logica "di casa": categorie della spesa, temi, stagioni, rifiuti, faccende.
import { norm, cap, todayIso, addDays, daysBetween, parseIso, iso, easter, nextYearly } from './utils.js';

// ---------------------------------------------------------------------------
// Temi (ricette, musica, film)
// ---------------------------------------------------------------------------
export const THEMES = {
  sempre: { label: 'Tutti i giorni', short: 'Sempre', icon: 'bowl' },
  natale: { label: 'Natale', icon: 'tree' },
  capodanno: { label: 'Capodanno', icon: 'sparkles' },
  sanvalentino: { label: 'San Valentino', icon: 'heart' },
  pasqua: { label: 'Pasqua', icon: 'egg' },
  estate: { label: 'Estate e mare', short: 'Estate', icon: 'wave' },
  halloween: { label: 'Halloween', icon: 'pumpkin' },
  compleanni: { label: 'Compleanni', icon: 'cake' },
  carnevale: { label: 'Carnevale', icon: 'mask' },
  donna: { label: 'Festa della donna', short: '8 marzo', icon: 'mimosa' },
  aprile: { label: 'Parigi e Canarie', short: 'Parigi e Canarie', icon: 'eiffel' },
};
export const THEME_IDS = Object.keys(THEMES);

// Categorie (i filtri delle pagine): quelle di casa più quelle che aggiungete voi, meno quelle che togliete
// (Impostazioni → Filtri e categorie). Oggetti senza prototipo: un tema salvato come "constructor" non è una categoria.
const senzaProto = (o) => Object.assign(Object.create(null), o);

// Categorie delle ricette (i filtri della pagina Ricette), nell'ordine in cui compaiono
const RICETTE_BASE = senzaProto({
  natale: { label: 'Natale', icon: 'tree' },
  halloween: { label: 'Halloween', icon: 'pumpkin' },
  sempre: { label: 'Sempre', icon: 'bowl' },
  estate: { label: 'Estate', icon: 'wave' },
  colazione: { label: 'Colazione', icon: 'cup' },
  dolci: { label: 'Dolci', icon: 'cake' },
});
/** Le categorie delle ricette in uso (si aggiornano da sole con le impostazioni: vedi usaCategorie). */
export const RICETTE_CATS = senzaProto(RICETTE_BASE);
// temi di prima che finiscono in una categoria (Capodanno è nelle feste di Natale, se non è una categoria sua)
const RICETTE_ALIAS = { capodanno: 'natale' };
const comeCategoria = (t) => (RICETTE_CATS[t] ? t : Object.hasOwn(RICETTE_ALIAS, t) ? RICETTE_ALIAS[t] : t);
/** Le categorie di una ricetta. I temi di prima che non sono categorie (es. Pasqua, "Parigi e Canarie") e le
 *  categorie tolte restano salvati ma non si mostrano: se non resta niente, la ricetta è in "Sempre". */
export const ricetteCats = (r) => {
  const c = [...new Set(((r && r.themes) || []).map(comeCategoria).filter((t) => RICETTE_CATS[t]))];
  return c.length ? c : ['sempre'];
};
/** I temi salvati che ora non si vedono (vecchi o di categorie tolte): si tengono quando si modifica la ricetta. */
export const temiVecchi = (r) => ((r && r.themes) || []).filter((t) => !RICETTE_CATS[comeCategoria(t)]);

// Categorie dei film (diverse dai temi di ricette e musica), nell'ordine in cui compaiono
const FILM_BASE = senzaProto({
  famiglia: { label: 'Famiglia', icon: 'users' },
  natale: { label: 'Natale', icon: 'tree' },
  halloween: { label: 'Halloween', icon: 'pumpkin' },
  sempre: { label: 'Sempre', icon: 'film' },
  thriller: { label: 'Thriller', icon: 'eye' },
  azione: { label: 'Azione', icon: 'bolt' },
  horror: { label: 'Horror', icon: 'ghost' },
  cartoni: { label: 'Cartoni', icon: 'balloon' },
});
/** Le categorie dei film in uso (si aggiornano da sole con le impostazioni: vedi usaCategorie). */
export const FILM_CATS = senzaProto(FILM_BASE);
/** Le categorie di un film. I temi di prima che non sono più categorie (es. "Parigi e Canarie", "Estate") e le
 *  categorie tolte restano salvati ma non si mostrano: se non resta niente, il film è in "Sempre". */
export const filmCats = (f) => {
  const c = ((f && f.themes) || []).filter((t) => FILM_CATS[t]);
  return c.length ? c : ['sempre'];
};
/** Quanti film o ricette hanno quella categoria (contando anche quelli in cui ora non si vede perché è tolta). */
export const conCategoria = (tipo, lista, id) => (lista || []).filter((x) => ((x && x.themes) || [])
  .some((t) => t === id || (tipo === 'ricette' && Object.hasOwn(RICETTE_ALIAS, t) && RICETTE_ALIAS[t] === id && !RICETTE_CATS[t]))).length;
/** I temi da salvare modificando un film o una ricetta: quelli scelti più quelli che ora non si vedono. Se si vedeva
 *  solo «Sempre» perché le sue categorie sono tolte (o di prima) e lo si è lasciato così, non si aggiunge «Sempre»:
 *  riaccendendo le categorie torna tutto com'era. */
export function temiDaSalvare(scelti, prima, nascosti) {
  const soloSempre = !scelti.length || (scelti.length === 1 && scelti[0] === 'sempre' && !(prima || []).includes('sempre'));
  if (soloSempre && nascosti.length) return [...nascosti];
  return [...new Set([...(scelti.length ? scelti : ['sempre']), ...nascosti])];
}
/** I temi di un film che ora non si vedono (vecchi o di categorie tolte): si tengono quando lo si modifica. */
export const filmTemiNascosti = (f) => ((f && f.themes) || []).filter((t) => !FILM_CATS[t]);
export const themeLabel = (id, short = false) => (THEMES[id] ? (short && THEMES[id].short) || THEMES[id].label : id);

// ---------------------------------------------------------------------------
// Atmosfere delle feste: cambiano colori, testata e decorazioni di tutto il sito
// (in ordine di calendario; vince la più "stretta": Capodanno dentro Natale, Pasqua dentro aprile…)
// ---------------------------------------------------------------------------
export const SEASONS = {
  capodanno: { label: 'Capodanno', theme: 'capodanno', icon: 'sparkles', title: 'Si brinda all’anno nuovo', sub: 'Bollicine, lenticchie e fuochi d’artificio', range: '30 dicembre – 1 gennaio' },
  sanvalentino: { label: 'San Valentino', theme: 'sanvalentino', icon: 'heart', title: 'Settimana dell’amore', sub: 'Cena a lume di candela e film romantici', range: '10 – 14 febbraio' },
  carnevale: { label: 'Carnevale', theme: 'carnevale', icon: 'mask', title: 'A Carnevale ogni scherzo vale', sub: 'Chiacchiere, coriandoli e stelle filanti', range: 'le due settimane fino a martedì grasso' },
  donna: { label: '8 marzo', theme: 'donna', icon: 'mimosa', title: 'Festa della donna', sub: 'Un rametto di mimosa per {p2}', range: '8 marzo' },
  pasqua: { label: 'Pasqua', theme: 'pasqua', icon: 'egg', title: 'Buona Pasqua', sub: 'Uova, colomba e la gita di Pasquetta', range: 'dalle Palme a Pasquetta' },
  aprile: { label: 'Parigi e Canarie', theme: 'aprile', icon: 'eiffel', title: 'Da Parigi alle Canarie', sub: 'Aprile è il mese di {p2}', range: 'tutto aprile' },
  mare: { label: 'Mare', theme: 'estate', icon: 'wave', title: 'Sole, sale e sabbia', sub: 'Playlist da spiaggia e cene leggere', range: 'luglio e agosto' },
  anniversario: { label: 'Anniversario', theme: 'sanvalentino', icon: 'rings', title: 'Il nostro anniversario', sub: 'Una cena speciale per noi due', range: 'il giorno dell’anniversario (18 luglio)' },
  halloween: { label: 'Halloween', theme: 'halloween', icon: 'pumpkin', title: 'Ottobre stregato', sub: 'Zucche, dolcetti e film da brivido', range: 'tutto ottobre' },
  natale: { label: 'Natale', theme: 'natale', icon: 'tree', title: 'Aria di Natale', sub: 'Lucine, biscotti e film sotto la coperta', range: '20 novembre – 6 gennaio' },
  compleanno: { label: 'Compleanno', theme: 'compleanni', icon: 'cake', title: 'Oggi si festeggia', sub: 'Torta, candeline e musica a tutto volume', range: 'il giorno dei compleanni di casa' },
};

/** Atmosfera del calendario per una data (o quella scelta su questo dispositivo). I compleanni li aggiunge season.js. */
export function seasonFor(date = new Date(), override = 'auto') {
  if (override && override !== 'auto') return override === 'casa' ? null : (SEASONS[override] ? override : null);
  const m = date.getMonth() + 1, d = date.getDate();
  const e = daysBetween(easter(date.getFullYear()), iso(date)); // giorni da Pasqua (negativi prima)
  if ((m === 12 && d >= 30) || (m === 1 && d === 1)) return 'capodanno';
  if ((m === 11 && d >= 20) || m === 12 || (m === 1 && d <= 6)) return 'natale';
  if (m === 2 && d >= 10 && d <= 14) return 'sanvalentino';
  if (m === 3 && d === 8) return 'donna';
  if (e >= -59 && e <= -47) return 'carnevale'; // martedì grasso è 47 giorni prima di Pasqua
  if (e >= -7 && e <= 1) return 'pasqua';
  if (m === 4) return 'aprile';
  if (m === 7 || m === 8) return 'mare';
  if (m === 10) return 'halloween';
  return null;
}

// ---------------------------------------------------------------------------
// Ricorrenze (conto alla rovescia in home)
// ---------------------------------------------------------------------------
export function upcomingDates(settings, cats = [], ref = todayIso()) {
  const y = parseIso(ref).getFullYear();
  const list = [
    { label: 'Natale', date: nextYearly('12-25', ref), theme: 'natale', icon: 'tree' },
    { label: 'Capodanno', date: nextYearly('12-31', ref), theme: 'capodanno', icon: 'sparkles' },
    { label: 'San Valentino', date: nextYearly('02-14', ref), theme: 'sanvalentino', icon: 'heart' },
    { label: 'Halloween', date: nextYearly('10-31', ref), theme: 'halloween', icon: 'pumpkin' },
    { label: 'Ferragosto', date: nextYearly('08-15', ref), theme: 'estate', icon: 'wave' },
  ];
  let e = easter(y);
  if (daysBetween(ref, e) < 0) e = easter(y + 1);
  list.push({ label: 'Pasqua', date: e, theme: 'pasqua', icon: 'egg' });
  let mg = addDays(easter(y), -47); // martedì grasso
  if (daysBetween(ref, mg) < 0) mg = addDays(easter(y + 1), -47);
  list.push({ label: 'Carnevale', date: mg, theme: 'carnevale', icon: 'mask' });
  list.push({ label: 'Festa della donna', date: nextYearly('03-08', ref), theme: 'donna', icon: 'mimosa' });
  (settings.ricorrenze || []).forEach((r) => {
    if (r && r.date && r.label) list.push({ label: r.label, date: nextYearly(r.date, ref), theme: r.theme || 'compleanni', icon: r.icon || 'cake', personal: true });
  });
  const names = { ...DEFAULT_SETTINGS.names, ...(settings.names || {}) };
  const age = (birth, date) => (birth.length === 10 ? Number(date.slice(0, 4)) - Number(birth.slice(0, 4)) : null);
  Object.entries(settings.compleanni || {}).forEach(([k, d]) => {
    if (d && names[k]) {
      const date = nextYearly(d, ref);
      list.push({ label: `Compleanno di ${names[k]}`, name: names[k], date, age: age(d, date), theme: k === 'p2' ? 'aprile' : 'compleanni', icon: 'cake', personal: true, who: k });
    }
  });
  if (settings.anniversario) {
    const date = nextYearly(settings.anniversario, ref);
    list.push({ label: 'Il vostro anniversario', name: `${names.p1} e ${names.p2}`, date, age: age(settings.anniversario, date), theme: 'sanvalentino', icon: 'heart', personal: true, anniversary: true });
  }
  // i gatti nati lo stesso giorno festeggiano insieme
  const byDay = {};
  cats.filter((c) => c.birth).forEach((c) => { (byDay[c.birth.slice(5)] ||= []).push(c); });
  Object.values(byDay).forEach((group) => {
    const n = group.map((c) => c.name);
    const label = n.length > 1 ? `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}` : n[0];
    const date = nextYearly(group[0].birth, ref);
    list.push({ label: `Compleanno di ${label}`, name: label, date, age: age(group[0].birth, date), theme: 'compleanni', icon: 'cat', personal: true, cats: true });
  });
  return list.map((x) => ({ ...x, days: daysBetween(ref, x.date) })).sort((a, b) => a.days - b.days);
}

// ---------------------------------------------------------------------------
// Spesa
// ---------------------------------------------------------------------------
// Reparti nell'ordine del giro al supermercato (surgelati e bevande alla fine: restano freddi e non schiacciano il resto).
// Gli id vecchi restano validi grazie a LEGACY_CATS (es. il vecchio "freschi" era latte e formaggi: ora è "frigo").
const SHOP_BASE = [
  { id: 'fresco', emoji: '🥬', label: 'Freschi', color: '#8DBF7E' },
  { id: 'frigo', emoji: '🧀', label: 'Frigo', color: '#F2CF72' },
  { id: 'forno', emoji: '🥖', label: 'Forno', color: '#E2B47E' },
  { id: 'dispensa', emoji: '🍝', label: 'Dispensa', color: '#CFA57A' },
  { id: 'sfizi', emoji: '🍫', label: 'Sfizi', color: '#D79A8E' },
  { id: 'casa', emoji: '🧹', label: 'Casa', color: '#B6A79A' },
  { id: 'cura', emoji: '🧴', label: 'Cura personale', color: '#E5AFC4' },
  { id: 'animali', emoji: '🐈', label: 'Animali', color: '#C3A5D6' },
  { id: 'surgelati', emoji: '🧊', label: 'Surgelati', color: '#9CC9E6' },
  { id: 'bevande', emoji: '🥤', label: 'Bevande', color: '#8FB9D8' },
  { id: 'altro', emoji: '🛒', label: 'Altro', color: '#C9C0B6' },
];
/** I reparti in uso, nell'ordine del giro (si aggiornano da soli con le impostazioni: vedi usaCategorie). */
export const SHOP_CATS = SHOP_BASE.map((c) => ({ ...c }));
const LEGACY_CATS = { frutta: 'fresco', carne: 'fresco', freschi: 'frigo', latticini: 'frigo', gatti: 'animali' };
const legacy = (id) => (Object.hasOwn(LEGACY_CATS, id) ? LEGACY_CATS[id] : id);
export const shopCat = (id) => SHOP_CATS.find((c) => c.id === legacy(id)) || SHOP_CATS[SHOP_CATS.length - 1];
export const normCat = (id) => (SHOP_CATS.some((c) => c.id === legacy(id)) ? legacy(id) : 'altro');

// "il latte" → "Latte": niente articoli, sempre con la maiuscola
const ART = /^(?:(?:il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle)\s+|(?:l|un|dell|d)['’]\s*)/i;
export const cleanName = (s) => cap(String(s || '').trim().replace(ART, '').trim());
/** La voce di un prodotto nelle "frequenze" (freq): lì si ricorda anche il reparto scelto a mano. */
export const freqId = (name) => norm(name).replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'x';
/**
 * Il reparto di un prodotto della spesa: quello scelto a mano (per quel prodotto o ricordato dalle volte prima),
 * altrimenti indovinato dal nome. Sempre uno dei reparti in uso: quelli tolti in Impostazioni finiscono in "Altro".
 * Lo usano la pagina della spesa e il widget (api/_widget.js).
 */
export function repartoDi(it, freq = []) {
  if (it.catManual && it.category) return normCat(it.category);
  const nome = cleanName(it.name);
  const f = freq.find((x) => x.id === freqId(nome));
  return normCat(f && f.catManual ? f.category : classify(nome));
}

// ---------------------------------------------------------------------------
// Filtri e categorie che si possono togliere o aggiungere (per tutta la casa, in settings):
//   categorieFilm / categorieRicette / categorieSpesa = { spente: [id…], mie: [{ id, label, icon | emoji, color, dopo }] }
// Togliere = nascondere: film, ricette e prodotti tengono le loro categorie (riaccendendola tornano al loro posto).
// "Sempre" (film e ricette) e "Altro" (spesa) restano sempre: è lì che va ciò che non ha una categoria visibile.
// ---------------------------------------------------------------------------
export const CATEGORIE = {
  film: { chiave: 'categorieFilm', base: FILM_BASE, fissa: 'sempre', icona: 'film', riservati: ['tutti', 'davedere', 'visti'] },
  ricette: { chiave: 'categorieRicette', base: RICETTE_BASE, fissa: 'sempre', icona: 'bowl', riservati: ['tutte', 'preferite'] },
  spesa: { chiave: 'categorieSpesa', base: senzaProto(Object.fromEntries(SHOP_BASE.map((c) => [c.id, c]))), fissa: 'altro', riservati: Object.keys(LEGACY_CATS) },
};
/** Le icone tra cui scegliere per una categoria nuova di film o ricette. */
export const ICONE_CATEGORIE = ['star', 'heart', 'sparkles', 'sun', 'moon', 'leaf', 'plant', 'tree', 'pumpkin', 'egg', 'cake', 'cup',
  'bowl', 'chef', 'basket', 'drop', 'wave', 'palm', 'eiffel', 'map', 'film', 'tv', 'music', 'camera', 'eye', 'bolt', 'ghost', 'balloon',
  'users', 'cat', 'paw', 'gift', 'bulb', 'clock'];
/** Le faccine tra cui scegliere per un reparto nuovo. */
export const EMOJI_REPARTI = ['🛒', '🍎', '🥦', '🥩', '🐟', '🍞', '🧀', '🥚', '🥫', '🍝', '🌶️', '🧂', '🍪', '🍬', '☕', '🍷', '🍺', '🧃',
  '🍼', '🧸', '💊', '🧻', '🧽', '🧺', '🌸', '🔋', '🐶', '🎁', '🏠', '📦'];
const COLORI_REPARTI = ['#A9C9A0', '#E9C38A', '#D9A7B5', '#9FC3D9', '#C5B3DE', '#E3B49B', '#B7C99A', '#D7C08F'];
const ID_OK = /^[a-z0-9][a-z0-9-]{0,39}$/;
const mieValide = (conf) => (conf && Array.isArray(conf.mie) ? conf.mie : [])
  .filter((m) => m && typeof m.id === 'string' && ID_OK.test(m.id) && !(m.id in Object.prototype) && typeof m.label === 'string' && m.label.trim());

/** Le impostazioni di un tipo (film, ricette, spesa), sempre nella stessa forma. */
export function confCategorie(s, tipo) {
  const c = (s && s[CATEGORIE[tipo].chiave]) || {};
  return { spente: Array.isArray(c.spente) ? c.spente.filter((x) => typeof x === 'string') : [], mie: mieValide(c) };
}

/** Tutte le categorie di un tipo, anche quelle tolte, nell'ordine in cui compaiono:
 *  { id, label, icon | emoji e color, mia (aggiunta da voi), spenta (tolta), fissa (Sempre / Altro) }. */
export function elencoCategorie(s, tipo) {
  const { base, fissa, icona } = CATEGORIE[tipo];
  const { spente, mie } = confCategorie(s, tipo);
  let lista;
  if (tipo === 'spesa') {
    // i vostri reparti vanno nel giro dopo quello scelto (altrimenti prima di "Altro", che resta l'ultimo)
    lista = SHOP_BASE.map((c) => ({ ...c }));
    mie.forEach((m, i) => {
      if (lista.some((c) => c.id === m.id) || Object.hasOwn(LEGACY_CATS, m.id)) return;
      const r = { id: m.id, emoji: typeof m.emoji === 'string' && m.emoji && m.emoji.length <= 16 ? m.emoji : '🛒', label: m.label.trim().slice(0, 30),
        color: /^#[0-9a-f]{6}$/i.test(m.color || '') ? m.color : COLORI_REPARTI[i % COLORI_REPARTI.length], dopo: m.dopo || '', mia: true };
      const j = lista.findIndex((c) => c.id === m.dopo);
      lista.splice(j >= 0 ? j + 1 : lista.length - 1, 0, r);
    });
    lista = [...lista.filter((c) => c.id !== 'altro'), lista.find((c) => c.id === 'altro')];
  } else {
    lista = Object.entries(base).map(([id, c]) => ({ id, ...c }));
    mie.forEach((m) => { if (!lista.some((c) => c.id === m.id)) lista.push({ id: m.id, label: m.label.trim().slice(0, 30), icon: ICONE_CATEGORIE.includes(m.icon) ? m.icon : icona, mia: true }); });
  }
  return lista.map((c) => ({ ...c, fissa: c.id === fissa, spenta: c.id !== fissa && spente.includes(c.id) }));
}

let firmaCategorie = '';
/** Rifà FILM_CATS, RICETTE_CATS e SHOP_CATS dalle impostazioni (si chiama prima di ogni disegno: costa poco). */
export function usaCategorie(s = {}) {
  const firma = JSON.stringify(['film', 'ricette', 'spesa'].map((t) => confCategorie(s, t)));
  if (firma === firmaCategorie) return;
  firmaCategorie = firma;
  for (const [dest, tipo] of [[FILM_CATS, 'film'], [RICETTE_CATS, 'ricette']]) {
    Object.keys(dest).forEach((k) => delete dest[k]);
    elencoCategorie(s, tipo).filter((c) => !c.spenta).forEach(({ id, label, icon, mia }) => { dest[id] = mia ? { label, icon, mia: true } : { ...CATEGORIE[tipo].base[id] }; });
  }
  SHOP_CATS.length = 0;
  SHOP_CATS.push(...elencoCategorie(s, 'spesa').filter((c) => !c.spenta).map(({ spenta, fissa, dopo, ...c }) => c));
}

/** L'id di una categoria nuova dal suo nome ("Primi piatti" → "primi-piatti"). Stesso nome = stessa categoria:
 *  rifacendo una categoria di prima (es. "Pasqua" nelle ricette) tornano anche le cose che l'avevano. */
export function idCategoria(tipo, label) {
  let base = norm(label).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'categoria';
  const { riservati } = CATEGORIE[tipo];
  let id = base, n = 2;
  while (riservati.includes(id) || id in Object.prototype) id = `${base}-${n++}`;
  return id;
}
/** Un colore per un reparto nuovo (il primo che non c'è già). */
export const coloreReparto = (usati = []) => COLORI_REPARTI.find((c) => !usati.includes(c)) || COLORI_REPARTI[usati.length % COLORI_REPARTI.length];

// Generi di JustWatch (sigle) e di Apple (nomi) → le vostre categorie dei film con un nome che ci somiglia
// (quelle di casa le propone già il server: Famiglia, Azione, Thriller, Horror, Cartoni)
const GENERI_MIE = [
  [/^(cmy|comedy|commedia)$/i, /^(commedi|comic)/],
  [/^(scf|sci-?fi.*|science fiction|fantascienza)$/i, /^(fantascienz|sci-?fi)/],
  [/^(rma|romance|sentimentale|romantic.*)$/i, /^(romant|sentiment|amore|love)/],
  [/^(doc|documentar.*)$/i, /^document/],
  [/^(drm|drama|dramma.*|drammatic.*)$/i, /^dramm/],
  [/^(crm|crime|poliziesc.*|giall.*)$/i, /^(crim|giall|polizies)/],
  [/^(fnt|fantasy)$/i, /^fantasy/],
  [/^(war|guerra)$/i, /^guerr/],
  [/^(hst|history|storic.*)$/i, /^stori/],
  [/^(msc|music.*)$/i, /^music/],
  [/^(spt|sport.*)$/i, /^sport/],
  [/^(wsn|western)$/i, /^western/],
  [/^(rly|reality.*)$/i, /^reality/],
];
/** Le vostre categorie dei film che corrispondono ai generi trovati (per proporle da sole, come quelle di casa). */
export function categorieDaGeneri(generi = []) {
  const g = (Array.isArray(generi) ? generi : []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!g.length) return [];
  return Object.entries(FILM_CATS).filter(([id, c]) => c.mia && GENERI_MIE.some(([gen, nome]) => g.some((x) => gen.test(x)) && (nome.test(id) || nome.test(norm(c.label))))).map(([id]) => id);
}

// Parole che fanno capire il reparto (separate da virgola; vanno bene anche più parole)
const KW = {
  fresco: `frutta, verdura, mela, mele, banana, banane, pera, pere, arancia, arance, limone, limoni, lime, insalata, insalata in busta, lattuga, rucola,
    valeriana, songino, spinaci, pomodoro, pomodori, pomodorini, patata, patate, cipolla, cipolle, cipollotti, scalogno, aglio, carota, carote, zucchina,
    zucchine, zucca, melanzana, melanzane, peperone, peperoni, funghi, champignon, basilico, prezzemolo, rosmarino, salvia, menta, erba cipollina,
    fragole, uva, kiwi, avocado, sedano, broccoli, cavolfiore, cavolo, cavolini, verza, finocchio, finocchi, porro, porri, mandarini, clementine,
    ananas, lamponi, mirtilli, frutti di bosco, pesche, albicocche, ciliegie, anguria, melone, fichi, radicchio, cetriolo, cetrioli, zenzero fresco,
    castagne, melograno, cachi, asparagi, carciofi, fagiolini, piselli freschi, legumi freschi, mango, cocco, datteri, prugne, susine,
    carne, carne macinata, macinato, pollo, petto di pollo, cosce di pollo, alette di pollo, manzo, maiale, vitello, agnello, coniglio, salsiccia, salsicce,
    tacchino, hamburger, bistecca, bistecche, fettine, cotolette, spezzatino, arrosto, fesa, lonza, costine, cotechino, zampone, pesce, salmone,
    tonno fresco, gamberi, gamberetti, merluzzo, orata, branzino, spigola, pesce spada, cozze, vongole, calamari, polpo, seppie, alici, sgombro`,
  frigo: `latte, latte fresco, latte di soia, latte di mandorla, latte di avena, yogurt, yogurt greco, burro, panna, panna da cucina, uova, uovo, mozzarella,
    mozzarelle, burrata, stracciatella, parmigiano, grana, grana padano, pecorino, ricotta, mascarpone, formaggio, formaggi, stracchino, crescenza,
    gorgonzola, scamorza, fontina, provola, provolone, emmental, robiola, philadelphia, sottilette, feta, asiago, taleggio, kefir, besciamella,
    prosciutto, prosciutto cotto, prosciutto crudo, salame, salamino, speck, bresaola, mortadella, pancetta, guanciale, affettati, affettato, wurstel,
    coppa, porchetta, tacchino affettato, salmone affumicato, pasta fresca, tortellini, ravioli, gnocchi, pasta sfoglia, pasta brise, pasta frolla,
    impasto pizza, lievito di birra, hummus, tofu, budino, budini, panna cotta, tiramisu`,
  forno: `pane, panini, pancarre, pan carre, pane in cassetta, pane integrale, grissini, piadina, piadine, focaccia, cornetti, croissant, brioche,
    fette biscottate, cracker, crackers, gallette, friselle, bruschette`,
  dispensa: `pasta, spaghetti, rigatoni, penne, fusilli, tagliatelle, lasagne, linguine, farfalle, mezze maniche, orecchiette, paccheri, riso, farina, zucchero,
    sale, sale grosso, olio, olio extravergine, olio di semi, aceto, aceto balsamico, tonno, tonno in scatola, sgombro in scatola, passata,
    passata di pomodoro, pelati, polpa di pomodoro, concentrato, ceci, lenticchie, fagioli, piselli in scatola, mais, biscotti, cereali, muesli,
    fiocchi di avena, marmellata, confettura, miele, nutella, crema spalmabile, cacao, lievito, brodo, dado, spezie, pepe, cannella, noce moscata,
    chiodi di garofano, origano, paprika, curcuma, zenzero, sugo, pesto, olive, capperi, savoiardi, frutta secca, mandorle, noci, nocciole, pinoli,
    uvetta, amido, maizena, vanillina, zucchero a velo, maionese, ketchup, senape, salsa, legumi, polenta, cous cous, latte a lunga conservazione,
    risotto, zuppa, minestra, burro di arachidi, pangrattato, pan grattato, conserve, sottoli, sottaceti`,
  sfizi: `cioccolato, cioccolata, cioccolatini, tavoletta, ovetti, caramelle, gomme, chewing gum, liquirizia, merendine, merendina, wafer, barrette,
    patatine, popcorn, snack, salatini, taralli, tarallini, arachidi, noccioline, pistacchi, anacardi, panettone, pandoro, colomba, torta, crostata,
    ciambella, dolci, dolcetti, dolce, pasticcini, pasticceria, krapfen, aperitivo, aperitivi, crodino, sanbitter, aperol, campari, spritz`,
  casa: `detersivo, detersivi, detersivo piatti, detersivo per i piatti, detersivo lavatrice, detersivo per la lavatrice, sapone piatti, sapone per i piatti, sapone lavatrice, sapone per la lavatrice,
    carta igienica, scottex, carta assorbente, rotoloni, spugne, spugna, sacchetti, sacchi, sacchetti spazzatura, sacchetti della spazzatura,
    sacchi immondizia, ammorbidente, candeggina, pellicola, alluminio, carta forno, carta da forno, lampadina, lampadine, pile, batterie, tovaglioli,
    fazzoletti, anticalcare, sgrassatore, pastiglie lavastoviglie, brillantante, sale lavastoviglie, guanti, profumatore, igienizzante, panni, panno,
    mocio, scopa, varechina, smacchiatore, stuzzicadenti, piatti di carta, bicchieri di plastica, accendino, fiammiferi, candela, candele`,
  cura: `sapone, saponi, sapone mani, sapone liquido, saponetta, shampoo, balsamo, bagnoschiuma, docciaschiuma, dentifricio, spazzolino, spazzolini,
    collutorio, filo interdentale, deodorante, cotton fioc, dischetti, dischetti struccanti, struccante, assorbenti, salvaslip, rasoi, rasoio, lamette,
    schiuma da barba, dopobarba, crema mani, crema corpo, crema viso, crema solare, profumo, gel, lacca, balsamo labbra, burrocacao, mascara,
    trucco, smalto, acetone, salviette, salviettine, cerotti, lenti a contatto, liquido lenti, tamponi`,
  animali: `croccantini, crocchette, scatolette, scatolette per i gatti, bustine, umido gatti, cibo gatti, cibo per gatti, cibo per i gatti, lettiera, sabbia,
    sabbia gatti, sabbia per i gatti, snack gatti, snack per i gatti, erba gatta, catnip, antiparassitario, tiragraffi, giochini gatti, gatti, gatto,
    animali, cibo animali`,
  surgelati: `surgelati, surgelato, surgelata, gelato, gelati, ghiacciolo, ghiaccioli, piselli, piselli surgelati, spinaci surgelati, verdure surgelate,
    pesce surgelato, bastoncini, bastoncini di pesce, minestrone surgelato, ghiaccio, pizza surgelata, pizze surgelate, patatine surgelate, sofficini,
    cordon bleu, frutti di bosco surgelati`,
  bevande: `acqua, acqua frizzante, acqua naturale, vino, vino rosso, vino bianco, birra, birre, succo, succhi, succo di frutta, coca cola, aranciata,
    spumante, prosecco, bibita, bibite, acqua tonica, tonica, gin, vodka, rum, whisky, amaro, limoncello, limonata, te freddo, energy drink, sciroppo,
    caffe, caffe macinato, caffe in grani, caffe d orzo, cialde, capsule, te, the, tisana, tisane, camomilla, infuso`,
};

// le parole più lunghe vincono ("pasta fresca" prima di "pasta", "sale lavastoviglie" prima di "sale")
const KW_LIST = Object.entries(KW)
  .flatMap(([cat, s]) => s.split(',').map((w) => norm(w)).filter(Boolean).map((w) => [w, cat]))
  .sort((a, b) => b[0].length - a[0].length);

/** Indovina il reparto di un prodotto dal nome: conta di più la prima parola ("gelato al cioccolato" → surgelati). */
export function classify(name) {
  const t = norm(name).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = t.split(' ');
  // "gamberi surgelati", "spinaci congelati": comanda il freezer
  if (words.some((w) => /^(surgelat|congelat)/.test(w))) return 'surgelati';
  let best = null;
  for (const [kw, cat] of KW_LIST) {
    let pos = -1;
    if (kw.includes(' ')) {
      const i = (' ' + t + ' ').indexOf(' ' + kw + ' ');
      if (i >= 0) pos = t.slice(0, i).split(' ').filter(Boolean).length;
    } else {
      pos = words.findIndex((w) => (kw.length <= 3 ? w === kw : w === kw || (w.startsWith(kw) && w.length - kw.length <= 2)));
    }
    if (pos < 0) continue;
    if (!best || pos < best.pos || (pos === best.pos && kw.length > best.len)) best = { pos, len: kw.length, cat };
  }
  return best ? best.cat : 'altro';
}

// ---------------------------------------------------------------------------
// Rifiuti
// ---------------------------------------------------------------------------
export const BINS = {
  umido: { label: 'Umido', color: '#8B6B4A' },
  plastica: { label: 'Plastica e metalli', short: 'Plastica', color: '#E2B93B' },
  carta: { label: 'Carta e cartone', short: 'Carta', color: '#4F86B0' },
  vetro: { label: 'Vetro', color: '#5E9A62' },
  secco: { label: 'Indifferenziato', short: 'Secco', color: '#8F8A85' },
};
export const BIN_IDS = Object.keys(BINS);

// ---------------------------------------------------------------------------
// Lavori, faccende
// ---------------------------------------------------------------------------
export const ROOMS = ['Camera', 'Sala', 'Cucina', 'Bagno', 'Ingresso', 'Studio', 'Balcone', 'Ovunque'];

export const CHORE_ICONS = {
  bin: 'Spazzatura', shirt: 'Bucato', vacuum: 'Aspirapolvere', drop: 'Pavimenti', bed: 'Letto', bath: 'Bagno',
  paw: 'Gatti', cat: 'Spazzola', plant: 'Piante', sparkles: 'Pulizie', basket: 'Spesa', chef: 'Cucina',
};

export const CHORE_TONES = { bin: 'taupe', shirt: 'sky', vacuum: 'oak', drop: 'sky', bed: 'plum', bath: 'sky', paw: 'plum', cat: 'plum', plant: 'sage', sparkles: 'oak', basket: 'oak', chef: 'rose' };

/** Prossima scadenza di una faccenda. */
export function nextDue(ch, ref = todayIso()) {
  const f = ch.freq || { type: 'days', every: 7 };
  if (f.type === 'weekdays' && Array.isArray(f.days) && f.days.length) {
    let start = ch.lastDone ? addDays(ch.lastDone, 1) : ref;
    // se l'ultima volta è stata molto tempo fa, la scadenza è comunque "in ritardo" dal primo giorno utile
    for (let i = 0; i < 8; i++) {
      const d = addDays(start, i);
      if (f.days.includes(parseIso(d).getDay())) return d;
    }
    return ref;
  }
  const every = Math.max(1, Number(f.every) || 7);
  return ch.lastDone ? addDays(ch.lastDone, every) : ref;
}

export function choreStatus(ch, ref = todayIso()) {
  const due = nextDue(ch, ref);
  const n = daysBetween(ref, due);
  if (n < 0) return { due, n, cls: 'late', label: n === -1 ? 'da ieri' : `in ritardo di ${-n} gg` };
  if (n === 0) return { due, n, cls: 'today', label: 'oggi' };
  if (n === 1) return { due, n, cls: 'soon', label: 'domani' };
  return { due, n, cls: '', label: `tra ${n} giorni` };
}

export function freqLabel(f) {
  if (!f) return '';
  if (f.type === 'weekdays') {
    const names = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
    return 'ogni ' + [...(f.days || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => names[d]).join(', ');
  }
  const n = Number(f.every) || 1;
  if (n === 1) return 'ogni giorno';
  if (n === 7) return 'ogni settimana';
  if (n === 14) return 'ogni 2 settimane';
  if (n === 30 || n === 31) return 'ogni mese';
  return `ogni ${n} giorni`;
}

// ---------------------------------------------------------------------------
// Desideri, gatti
// ---------------------------------------------------------------------------
export const WISH_CATS = { casa: 'Casa', cucina: 'Cucina', gatti: 'Gatti', regali: 'Regali', viaggi: 'Viaggi', tech: 'Tech', altro: 'Altro' };

export const CAT_EVENTS = {
  antiparassitario: { label: 'Antiparassitario', icon: 'drop', every: 30 },
  vermifugo: { label: 'Vermifugo', icon: 'pill', every: 90 },
  vaccino: { label: 'Vaccino', icon: 'syringe', every: 365 },
  veterinario: { label: 'Veterinario', icon: 'paw', every: 0 },
  peso: { label: 'Peso', icon: 'scale', every: 0 },
  toelettatura: { label: 'Toelettatura', icon: 'cat', every: 0 },
  altro: { label: 'Altro', icon: 'note', every: 0 },
};

export const MUSIC_TYPES = { brano: 'Brano', album: 'Album', playlist: 'Playlist' };

// Musica a tema del periodo: titolo e artista, l'app li trova da sola su Spotify (pagina Musica, "Da ascoltare adesso")
export const MUSICA_TEMA = {
  natale: { label: 'Natale', tile: 'Musica di Natale', icon: 'tree', brani: [
    ['All I Want for Christmas Is You', 'Mariah Carey'], ['Last Christmas', 'Wham!'], ['Jingle Bell Rock', 'Bobby Helms'],
    ['Rockin\u2019 Around the Christmas Tree', 'Brenda Lee'], ['It\u2019s Beginning to Look a Lot Like Christmas', 'Michael Bublé'],
    ['Let It Snow! Let It Snow! Let It Snow!', 'Dean Martin'], ['Feliz Navidad', 'José Feliciano'], ['Santa Tell Me', 'Ariana Grande'],
    ['Underneath the Tree', 'Kelly Clarkson'], ['Happy Xmas (War Is Over)', 'John Lennon'], ['White Christmas', 'Bing Crosby'],
    ['Do They Know It\u2019s Christmas?', 'Band Aid'], ['Christmas (Baby Please Come Home)', 'Michael Bublé'], ['Natale', 'Francesco De Gregori'],
  ] },
  halloween: { label: 'Halloween', tile: 'Musica di Halloween', icon: 'pumpkin', brani: [
    ['This Is Halloween', 'The Citizens of Halloween'], ['Thriller', 'Michael Jackson'], ['Ghostbusters', 'Ray Parker Jr.'], ['Monster Mash', 'Bobby Pickett'],
    ['Somebody\u2019s Watching Me', 'Rockwell'], ['Time Warp', 'The Rocky Horror Picture Show'], ['Bad Moon Rising', 'Creedence Clearwater Revival'],
    ['Superstition', 'Stevie Wonder'], ['Disturbia', 'Rihanna'], ['Zombie', 'The Cranberries'], ['Spooky Scary Skeletons', 'Andrew Gold'], ['Highway to Hell', 'AC/DC'],
  ] },
  estate: { label: 'Estate', tile: 'Musica d\u2019estate', icon: 'wave', brani: [
    ['Azzurro', 'Adriano Celentano'], ['Sapore di sale', 'Gino Paoli'], ['Una vita in vacanza', 'Lo Stato Sociale'], ['Vamos a la playa', 'Righeira'],
    ['L\u2019estate addosso', 'Jovanotti'], ['Abbronzatissima', 'Edoardo Vianello'], ['Tropicana', 'Gruppo Italiano'], ['Estate', 'Negramaro'],
    ['Despacito', 'Luis Fonsi'], ['Walking on Sunshine', 'Katrina and the Waves'], ['Summer of \u201969', 'Bryan Adams'], ['Andiamo a comandare', 'Fabio Rovazzi'],
  ] },
  aprile: { label: 'Parigi e Canarie', tile: 'Parigi e Canarie', icon: 'eiffel', brani: [
    ['La Vie en rose', 'Édith Piaf'], ['Les Champs-Élysées', 'Joe Dassin'], ['Non, je ne regrette rien', 'Édith Piaf'], ['Je veux', 'Zaz'],
    ['Dernière danse', 'Indila'], ['Formidable', 'Stromae'], ['Bailando', 'Enrique Iglesias'], ['Vivir mi vida', 'Marc Anthony'],
    ['La Bicicleta', 'Carlos Vives'], ['Volare', 'Gipsy Kings'], ['Danza Kuduro', 'Don Omar'], ['Despacito', 'Luis Fonsi'],
  ] },
  sanvalentino: { label: 'San Valentino', tile: 'Musica per San Valentino', icon: 'heart', brani: [
    ['Perfect', 'Ed Sheeran'], ['La cura', 'Franco Battiato'], ['Can\u2019t Help Falling in Love', 'Elvis Presley'], ['Vivo per lei', 'Andrea Bocelli'],
    ['Thinking Out Loud', 'Ed Sheeran'], ['L\u2019emozione non ha voce', 'Adriano Celentano'], ['All of Me', 'John Legend'], ['Sei nell\u2019anima', 'Gianna Nannini'],
    ['Your Song', 'Elton John'], ['Grande amore', 'Il Volo'], ['La donna cannone', 'Francesco De Gregori'], ['A te', 'Jovanotti'],
  ] },
  autunno: { label: 'Autunno', tile: 'Musica d\u2019autunno', icon: 'leaf', brani: [
    ['Autumn Leaves', 'Nat King Cole'], ['Harvest Moon', 'Neil Young'], ['La canzone dell\u2019amore perduto', 'Fabrizio De André'], ['Il cielo in una stanza', 'Mina'],
    ['Wake Me Up When September Ends', 'Green Day'], ['Settembre', 'Peppino Gagliardi'], ['Albachiara', 'Vasco Rossi'], ['Fix You', 'Coldplay'],
    ['Banana Pancakes', 'Jack Johnson'], ['Riptide', 'Vance Joy'], ['Hallelujah', 'Jeff Buckley'], ['Novembre', 'Giusy Ferreri'],
  ] },
  inverno: { label: 'Inverno', tile: 'Musica d\u2019inverno', icon: 'moon', brani: [
    ['Make You Feel My Love', 'Adele'], ['Yellow', 'Coldplay'], ['Il mondo', 'Jimmy Fontana'], ['La notte', 'Arisa'], ['Someone Like You', 'Adele'],
    ['Vivere', 'Vasco Rossi'], ['Shallow', 'Lady Gaga'], ['Halo', 'Beyoncé'], ['Una carezza in un pugno', 'Adriano Celentano'],
    ['The Scientist', 'Coldplay'], ['Sally', 'Vasco Rossi'], ['Viva la vida', 'Coldplay'],
  ] },
  primavera: { label: 'Primavera', tile: 'Musica di primavera', icon: 'plant', brani: [
    ['Here Comes the Sun', 'The Beatles'], ['Happy', 'Pharrell Williams'], ['Mr. Blue Sky', 'Electric Light Orchestra'], ['Felicità', 'Al Bano'],
    ['Margherita', 'Riccardo Cocciante'], ['Don\u2019t Stop Me Now', 'Queen'], ['Lovely Day', 'Bill Withers'], ['50 Special', 'Lùnapop'],
    ['L\u2019ombelico del mondo', 'Jovanotti'], ['Good Vibrations', 'The Beach Boys'], ['Primavera', 'Marina Rei'], ['Lemon Tree', 'Fools Garden'],
  ] },
};

export const DEFAULT_SETTINGS = {
  names: { p1: 'Patrick', p2: 'Serena' },
  // solo giorno e mese: il repository è pubblico (l'anno si può aggiungere dall'app)
  compleanni: { p1: '12-20', p2: '04-29' },
  // il giorno in cui vi siete messi insieme
  anniversario: '2020-07-18',
  // i nostri posti per "Dov'è": gli indirizzi si scrivono dall'app (restano nel database, non nel codice pubblico)
  luoghi: [
    { id: 'casa', nome: 'Casa', indirizzo: '', chi: 'both', r: 150 },
    { id: 'lavoro-p1', nome: 'Lavoro', indirizzo: '', chi: 'p1', r: 200 },
    { id: 'lavoro-p2', nome: 'Lavoro', indirizzo: '', chi: 'p2', r: 200 },
  ],
  rifiuti: { 0: [], 1: ['umido'], 2: ['plastica'], 3: ['umido', 'carta'], 4: ['secco'], 5: ['umido', 'vetro'], 6: [] },
  rifiutiFatto: null,
  ricorrenze: [],
};
