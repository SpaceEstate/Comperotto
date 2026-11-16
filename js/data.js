// Costanti e logica "di casa": categorie della spesa, temi, stagioni, rifiuti, faccende.
import { norm, todayIso, addDays, daysBetween, parseIso, easter, nextYearly } from './utils.js';

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
  aprile: { label: 'Parigi e Canarie', short: 'Parigi e Canarie', icon: 'eiffel' },
};
export const THEME_IDS = Object.keys(THEMES);
export const themeLabel = (id, short = false) => (THEMES[id] ? (short && THEMES[id].short) || THEMES[id].label : id);

// ---------------------------------------------------------------------------
// Stagioni: cambiano colori e atmosfera di tutto il sito
// ---------------------------------------------------------------------------
export const SEASONS = {
  halloween: { label: 'Halloween', theme: 'halloween', icon: 'pumpkin', title: 'Ottobre stregato', sub: 'Zucche, dolcetti e film da brivido', range: 'tutto ottobre' },
  natale: { label: 'Natale', theme: 'natale', icon: 'tree', title: 'Aria di Natale', sub: 'Lucine, biscotti e film sotto la coperta', range: '20 novembre – 6 gennaio' },
  mare: { label: 'Mare', theme: 'estate', icon: 'wave', title: 'Sole, sale e sabbia', sub: 'Playlist da spiaggia e cene leggere', range: 'luglio e agosto' },
  aprile: { label: 'Parigi e Canarie', theme: 'aprile', icon: 'eiffel', title: 'Da Parigi alle Canarie', sub: 'Aprile è il mese di {p2}', range: 'tutto aprile' },
};

/** Stagione attiva per una data (o forzata da impostazione del dispositivo). */
export function seasonFor(date = new Date(), override = 'auto') {
  if (override && override !== 'auto') return override === 'casa' ? null : (SEASONS[override] ? override : null);
  const m = date.getMonth() + 1, d = date.getDate();
  if (m === 10) return 'halloween';
  if (m === 4) return 'aprile';
  if ((m === 11 && d >= 20) || m === 12 || (m === 1 && d <= 6)) return 'natale';
  if (m === 7 || m === 8) return 'mare';
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
export const SHOP_CATS = [
  { id: 'frutta', label: 'Frutta e verdura', color: '#7E9B5A' },
  { id: 'forno', label: 'Pane e forno', color: '#C99A63' },
  { id: 'latticini', label: 'Latte, uova e formaggi', color: '#E1C16E' },
  { id: 'carne', label: 'Carne e pesce', color: '#C27464' },
  { id: 'dispensa', label: 'Dispensa', color: '#B58A5A' },
  { id: 'surgelati', label: 'Surgelati', color: '#7FA8C4' },
  { id: 'bevande', label: 'Bevande', color: '#6E91A6' },
  { id: 'casa', label: 'Casa e pulizia', color: '#9A8D80' },
  { id: 'gatti', label: 'Per Thor e Minù', color: '#A88BB0' },
  { id: 'altro', label: 'Altro', color: '#B9B0A6' },
];
export const shopCat = (id) => SHOP_CATS.find((c) => c.id === id) || SHOP_CATS[SHOP_CATS.length - 1];

const KW = {
  frutta: 'frutta verdura mela mele banana banane pera pere arance arancia limone limoni lime insalata lattuga rucola valeriana pomodori pomodoro pomodorini patate patata cipolla cipolle cipollotti aglio carote carota zucchine zucchina zucca melanzane melanzana peperoni peperone spinaci funghi basilico prezzemolo rosmarino salvia menta fragole uva kiwi avocado sedano broccoli cavolfiore cavolo cavolini finocchi finocchio porri porro mandarini clementine ananas lamponi mirtilli pesche albicocche ciliegie anguria melone fichi radicchio cetrioli cetriolo zenzero fresco legumi freschi piselli freschi castagne melograno cachi',
  forno: 'pane panini pancarre pan carre grissini piadine piadina focaccia cornetti brioche fette biscottate taralli panettone pandoro pangrattato',
  latticini: 'latte yogurt burro panna uova uovo mozzarella mozzarelle parmigiano grana pecorino ricotta mascarpone formaggio formaggi stracchino gorgonzola scamorza fontina provola emmental robiola kefir besciamella',
  carne: 'pollo petto di pollo manzo maiale macinato salsiccia salsicce prosciutto cotto crudo salame speck bresaola mortadella pancetta guanciale tacchino wurstel cotechino zampone vitello hamburger bistecca bistecche carne pesce salmone gamberi gamberetti merluzzo orata branzino spada cozze vongole calamari polpo arrosto fesa',
  dispensa: 'pasta spaghetti rigatoni penne fusilli tagliatelle lasagne gnocchi riso farina zucchero sale olio aceto tonno passata pelati polpa concentrato ceci lenticchie fagioli caffe cialde capsule the tisana camomilla biscotti cereali muesli marmellata confettura miele nutella cioccolato cacao lievito brodo dado spezie pepe cannella noce moscata chiodi di garofano sugo pesto cracker crackers mais olive capperi savoiardi frutta secca mandorle noci nocciole pinoli uvetta amido vanillina zucchero a velo maionese ketchup senape legumi patatine popcorn zenzero curcuma paprika origano',
  surgelati: 'surgelati surgelato gelato gelati piselli bastoncini spinaci surgelati minestrone ghiaccio pizza surgelata',
  bevande: 'acqua vino birra succo succhi coca cola aranciata spumante prosecco bibite bibita tonica gin aperol limonata',
  casa: 'detersivo detersivi sapone carta igienica scottex carta assorbente spugne spugna sacchetti sacchi ammorbidente candeggina pellicola alluminio carta forno lampadina lampadine pile batterie tovaglioli shampoo balsamo bagnoschiuma dentifricio spazzolino deodorante cotton fioc dischetti assorbenti rasoi anticalcare sgrassatore pastiglie lavastoviglie brillantante fazzoletti',
  gatti: 'croccantini scatolette bustine gatti umido gatti cibo gatti lettiera sabbia gatti sabbia snack gatti erba gatta catnip antiparassitario tiragraffi giochini gatti gatto gatti',
};

const KW_LIST = Object.entries(KW)
  .flatMap(([cat, s]) => {
    // le parole singole sono separate da spazio; le combinazioni note di più parole sono riconosciute sotto
    const multi = ['petto di pollo', 'prosciutto cotto', 'prosciutto crudo', 'pan carre', 'fette biscottate', 'carta igienica', 'carta assorbente', 'carta forno', 'cotton fioc', 'umido gatti', 'cibo gatti', 'sabbia gatti', 'snack gatti', 'erba gatta', 'giochini gatti', 'noce moscata', 'chiodi di garofano', 'frutta secca', 'zucchero a velo', 'coca cola', 'pizza surgelata', 'spinaci surgelati', 'piselli freschi', 'legumi freschi', 'zenzero fresco', 'pastiglie lavastoviglie'];
    const words = [];
    let rest = ' ' + s + ' ';
    multi.forEach((m) => { if (rest.includes(' ' + m + ' ')) { words.push(m); rest = rest.replace(' ' + m + ' ', ' '); } });
    return [...words, ...rest.trim().split(/\s+/)].filter(Boolean).map((w) => [norm(w), cat]);
  })
  .sort((a, b) => b[0].length - a[0].length);

/** Indovina il reparto di un prodotto dal nome. */
export function classify(name) {
  const t = ' ' + norm(name).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const words = t.trim().split(' ');
  for (const [kw, cat] of KW_LIST) {
    if (kw.includes(' ')) { if (t.includes(' ' + kw + ' ')) return cat; continue; }
    for (const w of words) {
      if (kw.length <= 3 ? w === kw : (w === kw || (w.startsWith(kw) && w.length - kw.length <= 2))) return cat;
    }
  }
  return 'altro';
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

export const DEFAULT_SETTINGS = {
  names: { p1: 'Patrick', p2: 'Serena' },
  // solo giorno e mese: il repository è pubblico (l'anno si può aggiungere dall'app)
  compleanni: { p1: '12-20', p2: '04-29' },
  rifiuti: { 0: [], 1: ['umido'], 2: ['plastica'], 3: ['umido', 'carta'], 4: ['secco'], 5: ['umido', 'vetro'], 6: [] },
  rifiutiFatto: null,
  ricorrenze: [],
  tmdbKey: '',
};
