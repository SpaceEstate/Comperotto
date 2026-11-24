// Il riassunto per il widget della schermata Home (Scriptable, file scriptable/Comperotto.js):
// la spesa da comprare, le faccende di oggi e i rifiuti di stasera. Lo chiede GET /api/dati?widget=1.
// Funzione pura (si prova senza database), con le stesse regole delle pagine dell'app:
//   • spesa: le cose da comprare nell'ordine del giro al supermercato (reparti come nella pagina Spesa)
//   • faccende: quelle di oggi o in ritardo non ancora fatte oggi, prima le più in ritardo (come "Oggi in casa")
//   • rifiuti: cosa si porta fuori stasera e se è già stato fatto
import { BINS, DEFAULT_SETTINGS, SHOP_CATS, choreStatus, cleanName, repartoDi, usaCategorie } from '../js/data.js';

/** La data di oggi in Italia (il server ragiona in UTC): "2026-11-24". */
export function oggiInItalia(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

const lista = (items) => Object.entries(items && typeof items === 'object' ? items : {}).map(([id, v]) => ({ ...(v && typeof v === 'object' ? v : {}), id }));
const corto = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function riassunto({ settings = {}, spesa = {}, freq = {}, routine = {} } = {}, oggi = oggiInItalia()) {
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
