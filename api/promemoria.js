// GET /api/promemoria — il promemoria della sera, chiamato da Vercel una volta al giorno (vedi vercel.json).
// Manda le notifiche a chi le ha accese:
//   • "Stasera si butta: …" (se non è già stato segnato come fatto)
//   • domani c'è un compleanno, l'anniversario o una ricorrenza
//   • domani scade un richiamo di Thor o Minù (vaccino, antiparassitario…)
// Si può chiamare quante volte si vuole: nello stesso giorno parte una volta sola, e solo tra le 16 e le 22.
import { backend, send } from './_lib.js';
import { avvisa, origineDi } from './_push.js';
import { BINS, CAT_EVENTS, DEFAULT_SETTINGS, upcomingDates } from '../js/data.js';
import { addDays } from '../js/utils.js';

/** Data e ora in Italia (il server ragiona in UTC). */
function inItalia(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { oggi: `${p.year}-${p.month}-${p.day}`, ora: Number(p.hour) };
}

/** I messaggi da mandare stasera (funzione pura: si può provare senza database). */
export function messaggi(s0, gatti, eventi, oggi) {
  const s = { ...DEFAULT_SETTINGS, ...s0, names: { ...DEFAULT_SETTINGS.names, ...(s0.names || {}) }, rifiuti: { ...DEFAULT_SETTINGS.rifiuti, ...(s0.rifiuti || {}) } };
  const out = [];
  // 1) stasera si butta
  const giorno = new Date(`${oggi}T12:00:00Z`).getUTCDay();
  const bidoni = (s.rifiuti[giorno] || []).filter((x) => BINS[x]);
  if (bidoni.length && !(s.rifiutiFatto && s.rifiutiFatto.date === oggi)) {
    out.push({ per: 'tutti', tipo: 'rifiuti', ttl: 4 * 3600, title: 'Stasera si butta', body: bidoni.map((x) => BINS[x].label).join(', '), tag: 'rifiuti', url: '#/' });
  }
  // 2) domani è un giorno speciale
  for (const d of upcomingDates(s, gatti, oggi).filter((x) => x.personal && x.days === 1)) {
    const anni = d.age ? ` (${d.age} ${d.age === 1 ? 'anno' : 'anni'})` : '';
    if (d.who) out.push({ per: d.who === 'p1' ? 'p2' : 'p1', tipo: 'scadenze', ttl: 12 * 3600, title: 'Domani è un giorno speciale', body: `${d.label}${anni}: pronto il regalo?`, tag: `data-${d.who}`, url: '#/' });
    else out.push({ per: 'tutti', tipo: 'scadenze', ttl: 12 * 3600, title: 'Domani è un giorno speciale', body: d.anniversary ? `Il vostro anniversario${d.age ? `: ${d.age} anni insieme` : ''}` : `${d.label}${anni}`, tag: `data-${d.label}`.slice(0, 40), url: '#/' });
  }
  // 3) Thor e Minù: richiami che scadono domani (per ogni tipo conta l'ultimo registrato)
  const domani = addDays(oggi, 1);
  const righe = [];
  gatti.forEach((g) => {
    const ultimo = {};
    eventi.filter((e) => e.catId === g.id || e.catId === 'both').forEach((e) => { if (e.next && (!ultimo[e.type] || e.date > ultimo[e.type].date)) ultimo[e.type] = e; });
    Object.values(ultimo).filter((e) => e.next === domani).forEach((e) => righe.push(`${(CAT_EVENTS[e.type] || {}).label || e.type} di ${g.name}`));
  });
  if (righe.length) out.push({ per: 'tutti', tipo: 'scadenze', ttl: 12 * 3600, title: 'Domani per i gatti', body: [...new Set(righe)].join(' · '), tag: 'gatti', url: '#/gatti' });
  return out;
}

export default async function handler(req, res) {
  try {
    const db = backend();
    if (!db) return send(res, 503, { error: 'Database non collegato' });
    const { oggi, ora } = inItalia();
    if (ora < 16 || ora > 22) return send(res, 200, { ok: true, saltato: 'fuori orario' });
    if ((await db.metaGet('push:giorno')) === oggi) return send(res, 200, { ok: true, saltato: 'già mandato oggi' });
    await db.metaSet('push:giorno', oggi);
    const [sett, gatti, eventi] = await Promise.all(['settings', 'gatti', 'eventiGatti'].map((c) => db.collection(c)));
    const lista = (x) => Object.entries(x.items).map(([id, v]) => ({ id, ...v }));
    const msgs = messaggi(sett.items.main || {}, lista(gatti), lista(eventi), oggi);
    let inviati = 0;
    for (const m of msgs) inviati += (await avvisa(m, origineDi(req))).inviati;
    send(res, 200, { ok: true, messaggi: msgs.length, inviati });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Promemoria non riuscito' });
  }
}
