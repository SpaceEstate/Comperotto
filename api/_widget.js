// Il riassunto per il widget della schermata Home (Scriptable, file scriptable/Casa.js): la spesa da comprare,
// le faccende di oggi, i rifiuti di stasera e i colori (quelli dell'app, o della festa di oggi). Lo chiede
// GET /api/dati?widget=1. Funzione pura (si prova senza database), con le stesse regole delle pagine dell'app:
//   • spesa: le cose da comprare nell'ordine del giro al supermercato (reparti come nella pagina Spesa)
//   • faccende: quelle di oggi o in ritardo non ancora fatte oggi, prima le più in ritardo (come "Oggi in casa")
//   • rifiuti: cosa si porta fuori stasera e se è già stato fatto
//   • tema: la festa come la sceglie l'app (compleanni e anniversario, poi il calendario), con i suoi colori
import { BINS, DEFAULT_SETTINGS, SHOP_CATS, SEASONS, choreStatus, cleanName, repartoDi, seasonFor, upcomingDates, usaCategorie } from '../js/data.js';
import { parseIso } from '../js/utils.js';

/** La data di oggi in Italia (il server ragiona in UTC): "2026-11-24". */
export function oggiInItalia(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

// ---------------------------------------------------------------------------
// Il tema del widget: i colori dell'app, e in ogni festa quelli della festa (come tutto il sito).
// I valori vengono da css/style.css: :root e "Atmosfere delle feste" (bg, surface, text, oak-deep, oak-soft, i 4 toni
// --tA…--tD, la testata --hdr con --hdr-ink / --hdr-brand e il bordo --hdr-edge). Se cambiano lì, vanno cambiati qui.
// ---------------------------------------------------------------------------
const CASA = {
  chiaro: { sfondo: '#FBF6F1', scheda: '#FFFDFB', testo: '#3D3430', testo2: '#776A60', testo3: '#8F8277', accento: '#9A5E31', accentoTenue: '#FDEBDB', verde: '#5E8A5B', verdeTenue: '#E4F2E0', rosso: '#C2614F' },
  scuro: { sfondo: '#1B1815', scheda: '#262220', testo: '#F2EBE2', testo2: '#C2B6A8', testo3: '#8C8074', accento: '#F2C9A3', accentoTenue: '#3A2C22', verde: '#9DB088', verdeTenue: '#2B3226', rosso: '#E08D78' },
};
const FESTE = {
  natale: {
    emoji: '🎄', toni: ['#1F6B43', '#2E7D4F', '#C42F37', '#A8761C'],
    chiaro: { sfondo: '#F7F4EC', scheda: '#FFFEFA', testo: '#26302A', testo2: '#5C665D', testo3: '#7D857B', accento: '#1B5E3B', accentoTenue: '#E1EEE3' },
    scuro: { sfondo: '#0F1813', scheda: '#19261E', testo: '#F1ECE0', testo2: '#C4C9BC', testo3: '#8E978A', accento: '#EBCB7E', accentoTenue: '#2F2F1E' },
    testata: { angolo: 180, colori: [['#13442A', 0], ['#1A5636', 0.7], ['#1F6440', 1]], testo: '#FFFFFF', marchio: '#F6D58A', evidenza: '#FFB3A8' },
    bordo: { strisce: ['#C42F37', '#FFFFFF'] },
  },
  capodanno: {
    emoji: '🥂', toni: ['#3D3D5C', '#8F6B1F', '#A04050', '#6E6E85'],
    chiaro: { sfondo: '#F8F6F0', scheda: '#FFFFFD', testo: '#22202A', testo2: '#5D5A66', testo3: '#7E7A86', accento: '#8F6B1F', accentoTenue: '#F3EAD3' },
    scuro: { sfondo: '#0E0E13', scheda: '#1A1A22', testo: '#F4EFE2', testo2: '#C7C1B2', testo3: '#8F8A80', accento: '#EBCB7E', accentoTenue: '#2E2A1E' },
    testata: { angolo: 180, colori: [['#0D0D12', 0], ['#17172A', 0.65], ['#222240', 1]], testo: '#FFF4D8', marchio: '#EBC765', evidenza: '#EBC765' },
    bordo: { sfumatura: ['#A97E2C', '#F7E6A8', '#C9A24A', '#F7E6A8', '#A97E2C', '#F7E6A8', '#C9A24A'] },
  },
  sanvalentino: {
    emoji: '❤️', toni: ['#8E1630', '#D04A6A', '#C8243F', '#B0477A'],
    chiaro: { sfondo: '#FDF5F5', scheda: '#FFFCFC', testo: '#3A2328', testo2: '#7A5A60', testo3: '#957379', accento: '#A51F38', accentoTenue: '#FCE1E5' },
    scuro: { sfondo: '#190E11', scheda: '#26161B', testo: '#F8E9EC', testo2: '#D1B3BA', testo3: '#9C7E85', accento: '#F79AAD', accentoTenue: '#3D1C25' },
    testata: { angolo: 180, colori: [['#86122C', 0], ['#A81B39', 0.7], ['#C2243F', 1]], testo: '#FFFFFF', marchio: '#FFD9E0', evidenza: '#FFC2CE' },
    bordo: { strisce: ['#FFFFFF', '#F49AAE'] },
  },
  carnevale: {
    emoji: '🎭', toni: ['#2D6FD9', '#179258', '#D62E6E', '#7B2FBE'],
    chiaro: { sfondo: '#FAF7FD', scheda: '#FFFFFF', testo: '#2C2236', testo2: '#685A75', testo3: '#8A7D96', accento: '#6A22A8', accentoTenue: '#EFE3FA' },
    scuro: { sfondo: '#130D1B', scheda: '#1F162B', testo: '#F3ECFA', testo2: '#CBBEDB', testo3: '#958AA5', accento: '#D3B4FA', accentoTenue: '#33224A' },
    testata: { angolo: 160, colori: [['#42177A', 0], ['#6E28B4', 0.55], ['#A32D92', 1]], testo: '#FFFFFF', marchio: '#FFD23F', evidenza: '#FFD23F' },
    bordo: { strisce: ['#FFD23F', '#19B36B', '#2D7FF9', '#E63B7A', '#FF8A1A'] },
  },
  donna: {
    emoji: '🌼', toni: ['#6B8C30', '#5E7D2A', '#C97500', '#8F7A00'],
    chiaro: { sfondo: '#FCFAEF', scheda: '#FFFEF8', testo: '#33301C', testo2: '#6B6750', testo3: '#8A8568', accento: '#7F6500', accentoTenue: '#FCF0BE' },
    scuro: { sfondo: '#15160C', scheda: '#212213', testo: '#F7F2D9', testo2: '#D0C9A6', testo3: '#99926F', accento: '#F7DA7A', accentoTenue: '#38331A' },
    testata: { angolo: 180, colori: [['#3F5A16', 0], ['#4F6B1C', 0.65], ['#5E7D24', 1]], testo: '#FFFBE0', marchio: '#FFD83D', evidenza: '#FFD83D' },
    bordo: { strisce: ['#F7C600', '#FFF6C9'] },
  },
  pasqua: {
    emoji: '🐣', toni: ['#3F8FC0', '#4E9A44', '#D0607E', '#8A63C7'],
    chiaro: { sfondo: '#FBF8F2', scheda: '#FFFEFB', testo: '#352B44', testo2: '#6D6180', testo3: '#8C8199', accento: '#6D48AA', accentoTenue: '#EFE6FA' },
    scuro: { sfondo: '#15121B', scheda: '#211C2A', testo: '#F3EEF9', testo2: '#CDC3DA', testo3: '#958CA3', accento: '#CDB6F2', accentoTenue: '#322747' },
    testata: { angolo: 170, colori: [['#7452B8', 0], ['#9473D2', 0.55], ['#799AD6', 1]], testo: '#FFFFFF', marchio: '#FFF1A8', evidenza: '#FFF1A8' },
    bordo: { strisce: ['#F7D74A', '#8CCB7E', '#F4A3B5', '#7EC3E6'] },
  },
  aprile: {
    emoji: '🗼', toni: ['#2F8FA0', '#3B8F86', '#C2607A', '#2E3A5C'],
    chiaro: { sfondo: '#FBF4F2', scheda: '#FFFCFB', testo: '#3A2C33', testo2: '#76616A', testo3: '#927C84', accento: '#9E4660', accentoTenue: '#F8E1E7' },
    scuro: { sfondo: '#1C1520', scheda: '#271E2C', testo: '#F7EEF2', testo2: '#D2C0C9', testo3: '#9D8A94', accento: '#F2B8C8', accentoTenue: '#3D2632' },
    testata: { angolo: 180, colori: [['#24304F', 0], ['#3B3C63', 0.45], ['#8E4562', 0.88], ['#A55366', 1]], testo: '#FFF6F3', marchio: '#FFD7A8', evidenza: '#FFC6D3' },
    bordo: { strisce: ['#F3C9D3', '#2F8FA0', '#F2B84B'] },
  },
  mare: {
    emoji: '🌊', toni: ['#1580AC', '#23897E', '#E0553E', '#0E5F86'],
    chiaro: { sfondo: '#F7F1E6', scheda: '#FFFDF8', testo: '#33302B', testo2: '#6F685E', testo3: '#8D8578', accento: '#126A90', accentoTenue: '#DCEEF5' },
    scuro: { sfondo: '#0E1B23', scheda: '#162A35', testo: '#EEF5F7', testo2: '#BFD0D6', testo3: '#85A0AA', accento: '#8FD2EA', accentoTenue: '#173847' },
    testata: { angolo: 180, colori: [['#0B5F86', 0], ['#1580AC', 0.55], ['#34A1C8', 1]], testo: '#FFFFFF', marchio: '#FFE08A', evidenza: '#FFE08A', coloriScuro: [['#08344A', 0], ['#0C4A68', 0.6], ['#11607F', 1]] },
    bordo: null,
  },
  halloween: {
    emoji: '🎃', toni: ['#5B3A75', '#5E7D2A', '#D9661F', '#6B3F8F'],
    chiaro: { sfondo: '#FAF3EA', scheda: '#FFFCF7', testo: '#2B2320', testo2: '#6E5F55', testo3: '#8C7B6E', accento: '#B4520E', accentoTenue: '#FDE4CF' },
    scuro: { sfondo: '#100E0D', scheda: '#1C1816', testo: '#F5EBE0', testo2: '#C9B9A8', testo3: '#8F8073', accento: '#F7A764', accentoTenue: '#3A2414' },
    testata: { angolo: 180, colori: [['#0E0C0B', 0], ['#23170E', 0.75], ['#34200F', 1]], testo: '#FFE6CC', marchio: '#F59440', evidenza: '#F59440' },
    bordo: { strisce: ['#EE7A1F', '#111111'] },
  },
  anniversario: {
    emoji: '💍', toni: ['#9A4A62', '#B07A4E', '#C9677D', '#7A3A55'],
    chiaro: { sfondo: '#FCF6F3', scheda: '#FFFDFC', testo: '#3B2A2E', testo2: '#77605F', testo3: '#937B7A', accento: '#8A3A50', accentoTenue: '#F7E3E7' },
    scuro: { sfondo: '#1A1215', scheda: '#271B20', testo: '#FAEFEF', testo2: '#D6C0C0', testo3: '#A08888', accento: '#F2BEC8', accentoTenue: '#40252E' },
    testata: { angolo: 170, colori: [['#4A2436', 0], ['#7A3A55', 0.45], ['#B06A78', 0.88], ['#BF7F7E', 1]], testo: '#FFF6EE', marchio: '#F6D7A7', evidenza: '#F6D7A7' },
    bordo: { sfumatura: ['#B76E79', '#F3D1C2', '#D9A08E', '#F7E3D3', '#B76E79', '#F3D1C2', '#D9A08E'] },
  },
  compleanno: {
    emoji: '🎂', toni: ['#1F9DB0', '#2FA477', '#E0457B', '#6A4CE0'],
    chiaro: { sfondo: '#FFF7F5', scheda: '#FFFFFF', testo: '#3A2430', testo2: '#7A5866', testo3: '#977685', accento: '#BF2E63', accentoTenue: '#FDE3EC' },
    scuro: { sfondo: '#190F15', scheda: '#26171F', testo: '#FBEFF4', testo2: '#D7BFCB', testo3: '#A08594', accento: '#FF9FC0', accentoTenue: '#43202F' },
    testata: { angolo: 165, colori: [['#5B34C4', 0], ['#B93D9B', 0.55], ['#EE6E6C', 1]], testo: '#FFFFFF', marchio: '#FFE066', evidenza: '#FFE066' },
    bordo: { strisce: ['#FFD23F', '#3EC1D3', '#FF5C8A', '#7A5CFA', '#46D39A'] },
  },
};

// color-mix(in srgb, a p%, b), come nel foglio di stile
const misto = (a, p, b) => {
  const c = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [c(a), c(b)];
  return `#${x.map((v, i) => Math.round(v * p + y[i] * (1 - p)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};
/** La festa di oggi, come la sceglie l'app (season.js): prima i compleanni di casa e l'anniversario, poi il calendario. */
export function festaDi(s, gatti, oggi) {
  const ev = upcomingDates(s, gatti, oggi).find((d) => d.days === 0 && d.personal && (d.who || d.cats || d.anniversary));
  if (ev) return ev.anniversary ? 'anniversario' : 'compleanno';
  return seasonFor(parseIso(oggi));
}
/** I colori per il widget: chiaro e scuro (come i secondari dell'app: --sage = tono B, --rose = tono C), testata e bordo. */
export function temaWidget(id) {
  const f = id && FESTE[id];
  if (!f) return { id: null, nome: '', emoji: '', ...CASA, testata: null, bordo: null };
  const [, tB, tC] = f.toni;
  return {
    id, nome: (SEASONS[id] || {}).label || '', emoji: f.emoji,
    chiaro: { ...f.chiaro, verde: tB, verdeTenue: misto(tB, 0.14, '#FFFFFF'), rosso: tC },
    scuro: { ...f.scuro, verde: misto(tB, 0.62, '#FFFFFF'), verdeTenue: misto(tB, 0.26, f.scuro.scheda), rosso: misto(tC, 0.62, '#FFFFFF') },
    testata: f.testata,
    bordo: f.bordo,
  };
}

const lista = (items) => Object.entries(items && typeof items === 'object' ? items : {}).map(([id, v]) => ({ ...(v && typeof v === 'object' ? v : {}), id }));
const corto = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function riassunto({ settings = {}, spesa = {}, freq = {}, routine = {}, gatti = {} } = {}, oggi = oggiInItalia()) {
  const s = {
    ...DEFAULT_SETTINGS, ...settings,
    names: { ...DEFAULT_SETTINGS.names, ...(settings.names || {}) },
    rifiuti: { ...DEFAULT_SETTINGS.rifiuti, ...(settings.rifiuti || {}) },
  };
  usaCategorie(s); // i reparti in uso (quelli tolti in Impostazioni finiscono in "Altro", i vostri nel giro)
  const nomeDi = (k) => (k === 'p1' || k === 'p2' ? s.names[k] : k === 'both' ? 'Insieme' : '');

  // la spesa: da comprare, nell'ordine del giro; dentro un reparto in ordine di nome (come la pagina)
  const fr = lista(freq);
  const prodotti = lista(spesa).filter((i) => typeof i.name === 'string' && i.name.trim());
  const giro = new Map(SHOP_CATS.map((c, i) => [c.id, i]));
  const voci = prodotti.filter((i) => !i.done)
    .map((i) => {
      const rep = repartoDi(i, fr);
      const c = SHOP_CATS.find((x) => x.id === rep) || SHOP_CATS[SHOP_CATS.length - 1];
      return { nome: corto(cleanName(i.name), 60), qta: corto(i.qty, 20), reparto: c.label, emoji: c.emoji, ordine: giro.get(rep) ?? giro.size };
    })
    .sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' }))
    .map(({ ordine, ...v }) => v);

  // le faccende di oggi (anche quelle in ritardo) non ancora fatte oggi
  const faccende = lista(routine).filter((c) => typeof c.title === 'string' && c.title.trim()).map((c) => ({ c, st: choreStatus(c, oggi) }));
  const daFare = faccende.filter((x) => x.st.n <= 0 && x.c.lastDone !== oggi)
    .sort((a, b) => a.st.n - b.st.n || a.c.title.localeCompare(b.c.title, 'it'));

  // i rifiuti di stasera
  const giorno = new Date(`${oggi}T12:00:00Z`).getUTCDay();
  const bidoni = (Array.isArray(s.rifiuti[giorno]) ? s.rifiuti[giorno] : []).filter((b) => BINS[b]);
  const fatto = Boolean(s.rifiutiFatto && s.rifiutiFatto.date === oggi);

  return {
    oggi,
    tema: temaWidget(festaDi(s, lista(gatti), oggi)),
    spesa: { n: voci.length, carrello: prodotti.filter((i) => i.done).length, voci: voci.slice(0, 40) },
    faccende: {
      n: daFare.length,
      fatte: faccende.filter((x) => x.c.lastDone === oggi).length,
      voci: daFare.slice(0, 20).map(({ c, st }) => ({ nome: corto(c.title, 60), quando: st.label, ritardo: st.n < 0, chi: nomeDi(c.who) })),
    },
    rifiuti: {
      stasera: bidoni.map((b) => BINS[b].short || BINS[b].label),
      colori: bidoni.map((b) => BINS[b].color),
      fatto,
      da: fatto ? nomeDi(s.rifiutiFatto.by) : '',
    },
  };
}
