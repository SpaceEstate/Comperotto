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
// Reparti nell'ordine del giro al supermercato (i surgelati alla fine, così restano freddi)
export const SHOP_CATS = [
  { id: 'frutta', label: 'Frutta e verdura', color: '#8DBF7E' },
  { id: 'forno', label: 'Pane e forno', color: '#E2B47E' },
  { id: 'freschi', label: 'Freschi: latte, formaggi, salumi', color: '#F2CF72' },
  { id: 'carne', label: 'Carne e pesce', color: '#E59A8C' },
  { id: 'dispensa', label: 'Dispensa', color: '#CFA57A' },
  { id: 'bevande', label: 'Bevande', color: '#8FB9D8' },
  { id: 'casa', label: 'Casa e igiene', color: '#B6A79A' },
  { id: 'gatti', label: 'Per Thor e Minù', color: '#C3A5D6' },
  { id: 'surgelati', label: 'Surgelati', color: '#9CC9E6' },
  { id: 'altro', label: 'Altro', color: '#C9C0B6' },
];
const LEGACY_CATS = { latticini: 'freschi' };
export const shopCat = (id) => SHOP_CATS.find((c) => c.id === (LEGACY_CATS[id] || id)) || SHOP_CATS[SHOP_CATS.length - 1];
export const normCat = (id) => (SHOP_CATS.some((c) => c.id === (LEGACY_CATS[id] || id)) ? LEGACY_CATS[id] || id : 'altro');

// Parole che fanno capire il reparto (separate da virgola; vanno bene anche più parole)
const KW = {
  frutta: `frutta, verdura, mela, mele, banana, banane, pera, pere, arancia, arance, limone, limoni, lime, insalata, insalata in busta, lattuga, rucola,
    valeriana, songino, spinaci, pomodoro, pomodori, pomodorini, patata, patate, cipolla, cipolle, cipollotti, scalogno, aglio, carota, carote, zucchina,
    zucchine, zucca, melanzana, melanzane, peperone, peperoni, funghi, champignon, basilico, prezzemolo, rosmarino, salvia, menta, erba cipollina,
    fragole, uva, kiwi, avocado, sedano, broccoli, cavolfiore, cavolo, cavolini, verza, finocchio, finocchi, porro, porri, mandarini, clementine,
    ananas, lamponi, mirtilli, frutti di bosco, pesche, albicocche, ciliegie, anguria, melone, fichi, radicchio, cetriolo, cetrioli, zenzero fresco,
    castagne, melograno, cachi, asparagi, carciofi, fagiolini, piselli freschi, legumi freschi, mango, cocco, datteri, prugne, susine`,
  forno: `pane, panini, pancarre, pan carre, pane in cassetta, pane integrale, grissini, piadina, piadine, focaccia, cornetti, croissant, brioche,
    fette biscottate, taralli, cracker, crackers, gallette, panettone, pandoro, colomba, pangrattato, pan grattato, torta, crostata, ciambella`,
  freschi: `latte, latte fresco, latte di soia, latte di mandorla, latte di avena, yogurt, yogurt greco, burro, panna, panna da cucina, uova, uovo, mozzarella,
    mozzarelle, burrata, stracciatella, parmigiano, grana, grana padano, pecorino, ricotta, mascarpone, formaggio, formaggi, stracchino, crescenza,
    gorgonzola, scamorza, fontina, provola, provolone, emmental, robiola, philadelphia, sottilette, feta, asiago, taleggio, kefir, besciamella,
    prosciutto, prosciutto cotto, prosciutto crudo, salame, salamino, speck, bresaola, mortadella, pancetta, guanciale, affettati, affettato, wurstel,
    coppa, porchetta, tacchino affettato, pasta fresca, tortellini, ravioli, gnocchi, pasta sfoglia, pasta brise, pasta frolla, impasto pizza,
    lievito di birra, hummus, tofu, budino, budini, panna cotta, tiramisu`,
  carne: `carne, carne macinata, macinato, pollo, petto di pollo, cosce di pollo, alette di pollo, manzo, maiale, vitello, agnello, coniglio, salsiccia, salsicce,
    tacchino, hamburger, bistecca, bistecche, fettine, cotolette, spezzatino, arrosto, fesa, lonza, costine, cotechino, zampone, pesce, salmone,
    tonno fresco, gamberi, gamberetti, merluzzo, orata, branzino, spigola, pesce spada, cozze, vongole, calamari, polpo, seppie, alici, sgombro`,
  dispensa: `pasta, spaghetti, rigatoni, penne, fusilli, tagliatelle, lasagne, linguine, farfalle, mezze maniche, orecchiette, paccheri, riso, farina, zucchero,
    sale, sale grosso, olio, olio extravergine, olio di semi, aceto, aceto balsamico, tonno, tonno in scatola, sgombro in scatola, passata,
    passata di pomodoro, pelati, polpa di pomodoro, concentrato, ceci, lenticchie, fagioli, piselli in scatola, mais, caffe, cialde, capsule,
    te, the, tisana, camomilla, biscotti, cereali, muesli, fiocchi di avena, marmellata, confettura, miele, nutella, crema spalmabile, cioccolato,
    cioccolata, cacao, lievito, brodo, dado, spezie, pepe, cannella, noce moscata, chiodi di garofano, origano, paprika, curcuma, zenzero, sugo, pesto,
    olive, capperi, savoiardi, frutta secca, mandorle, noci, nocciole, pinoli, uvetta, pistacchi, arachidi, amido, maizena, vanillina,
    zucchero a velo, maionese, ketchup, senape, salsa, patatine, popcorn, snack, merendine, legumi, polenta, cous cous, latte a lunga conservazione, risotto, zuppa, minestra, burro di arachidi`,
  bevande: `acqua, acqua frizzante, acqua naturale, vino, vino rosso, vino bianco, birra, birre, succo, succhi, succo di frutta, coca cola, aranciata,
    spumante, prosecco, bibita, bibite, acqua tonica, tonica, gin, vodka, rum, aperol, campari, limonata, te freddo, energy drink, sciroppo`,
  casa: `detersivo, detersivi, detersivo piatti, detersivo per i piatti, detersivo lavatrice, detersivo per la lavatrice, sapone, sapone mani, carta igienica,
    scottex, carta assorbente, rotoloni, spugne, spugna, sacchetti, sacchi, sacchetti spazzatura, sacchetti della spazzatura, sacchi immondizia,
    ammorbidente, candeggina, pellicola, alluminio, carta forno, carta da forno, lampadina, lampadine, pile, batterie, tovaglioli, fazzoletti, shampoo,
    balsamo, bagnoschiuma, docciaschiuma, dentifricio, spazzolino, collutorio, deodorante, cotton fioc, dischetti, assorbenti, rasoi, crema mani,
    crema corpo, crema viso, anticalcare, sgrassatore, pastiglie lavastoviglie, brillantante, sale lavastoviglie, guanti, profumatore, igienizzante`,
  gatti: `croccantini, crocchette, scatolette, scatolette per i gatti, bustine, umido gatti, cibo gatti, cibo per gatti, cibo per i gatti, lettiera, sabbia,
    sabbia gatti, sabbia per i gatti, snack gatti, snack per i gatti, erba gatta, catnip, antiparassitario, tiragraffi, giochini gatti, gatti, gatto`,
  surgelati: `surgelati, surgelato, surgelata, gelato, gelati, piselli, piselli surgelati, spinaci surgelati, verdure surgelate, bastoncini, bastoncini di pesce,
    minestrone surgelato, ghiaccio, pizza surgelata, pizze surgelate, patatine surgelate, sofficini, cordon bleu`,
};

// le parole più lunghe vincono ("pasta fresca" prima di "pasta", "sale lavastoviglie" prima di "sale")
const KW_LIST = Object.entries(KW)
  .flatMap(([cat, s]) => s.split(',').map((w) => norm(w)).filter(Boolean).map((w) => [w, cat]))
  .sort((a, b) => b[0].length - a[0].length);

/** Indovina il reparto di un prodotto dal nome: conta di più la prima parola ("gelato al cioccolato" → surgelati). */
export function classify(name) {
  const t = norm(name).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = t.split(' ');
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

export const DEFAULT_SETTINGS = {
  names: { p1: 'Patrick', p2: 'Serena' },
  // solo giorno e mese: il repository è pubblico (l'anno si può aggiungere dall'app)
  compleanni: { p1: '12-20', p2: '04-29' },
  // il giorno in cui vi siete messi insieme
  anniversario: '2020-07-18',
  rifiuti: { 0: [], 1: ['umido'], 2: ['plastica'], 3: ['umido', 'carta'], 4: ['secco'], 5: ['umido', 'vetro'], 6: [] },
  rifiutiFatto: null,
  ricorrenze: [],
};
