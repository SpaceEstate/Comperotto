// POST /api/posizione — riceve la posizione da OwnTracks (o dall'app stessa) e aggiorna "Dov'è".
//
// OwnTracks (iPhone): Impostazioni → Mode: HTTP, URL: https://…/api/posizione,
// Authentication: UserID = il proprio nome (es. "serena"), Password = codice di famiglia.
// L'app invece manda l'intestazione x-famiglia e { chi: "p1" | "p2", lat, lon, … }.
//
// Cosa si salva (solo l'ultima posizione di ciascuno, niente storico):
//   at    = quando è stato preso il punto (dal telefono)     seen = ultimo messaggio arrivato dal telefono
//   acc   = precisione in metri                               home/luogo = dove si trova rispetto ai nostri posti
// Se "Remote Commands" è attivo in OwnTracks, nella risposta gli mando i nostri posti come zone
// (setWaypoints): così l'iPhone avvisa da solo appena si entra o si esce da casa, anche in modalità Significant.
//
// POST /api/posizione?auto — l'auto: «Ho parcheggiato», il comando rapido sulla schermata Home dell'iPhone (più sotto).
import crypto from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { autorizza, backend, body, respingi, send, sleep } from './_lib.js';
import { avvisa, origineDi } from './_push.js';
import { indirizzo } from './_luogo.js';

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
export function distanza(a, b) {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const tid = (name) => (norm(name).replace(/[^a-z]/g, '').slice(0, 2) || 'xx').toUpperCase();
const num = (x) => (x === null || x === undefined || x === '' ? NaN : Number(x));
const H = 3600000;

/** I posti che valgono per una persona: casa per tutti, gli altri se sono suoi o di entrambi. */
export function postiDi(s, who) {
  const out = [];
  (Array.isArray(s.luoghi) ? s.luoghi : []).forEach((l) => {
    if (!l || !(l.id === 'casa' || l.chi === 'both' || l.chi === who || !l.chi)) return;
    let p = { ...l, lat: num(l.lat), lon: num(l.lon) };
    // la casa "segnata qui" ha la precedenza sull'indirizzo
    if (l.id === 'casa' && s.casaPos && Number.isFinite(num(s.casaPos.lat))) p = { ...p, lat: num(s.casaPos.lat), lon: num(s.casaPos.lon), r: s.casaPos.r || l.r };
    if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) out.push({ ...p, r: Number(p.r) || (p.id === 'casa' ? 150 : 200), nome: p.nome || (p.id === 'casa' ? 'Casa' : 'Posto') });
  });
  if (!out.some((l) => l.id === 'casa') && s.casaPos && Number.isFinite(num(s.casaPos.lat))) {
    out.unshift({ id: 'casa', nome: 'Casa', lat: num(s.casaPos.lat), lon: num(s.casaPos.lon), r: Number(s.casaPos.r) || 150 });
  }
  return out;
}

/**
 * Dentro (true), fuori (false) o "non si sa" (null), tenendo conto della precisione del punto:
 * un punto preso dalle celle telefoniche può sbagliare di uno o due chilometri.
 */
export function dentro(d, r, acc) {
  const a = Math.max(0, Number(acc) || 0);
  if (a <= r) return d <= r;
  if (d - a > r) return false;          // anche nel caso migliore è fuori
  if (d + a <= r * 1.5) return true;    // il cerchio dell'incertezza sta (quasi) tutto dentro
  return null;
}

/** Il nostro posto che corrisponde al nome di una zona di OwnTracks ("Casa", "Lavoro"…). */
const postoDaZona = (posti, nome) => {
  const n = norm(nome);
  return posti.find((l) => norm(l.nome) === n) || (/^(home|casa)$/.test(n) ? posti.find((l) => l.id === 'casa') : null) || null;
};

/**
 * Dove si trova adesso: il posto (id) oppure null; incerto = punto troppo impreciso per cambiare idea.
 *   appena   = il posto da cui il telefono ha detto da poco di essere uscito: per la sola distanza non torna
 *              (un punto preso sul confine darebbe un falso «è tornato»); ci si rientra con un'entrata o con le zone
 *   soloZone = il messaggio non porta un punto nuovo (un "ping" di OwnTracks, con le zone attive): il posto cambia
 *              solo con le zone
 */
export function decidi({ posti, lat, lon, acc, regioni, evento, prev, appena = null, soloZone = false }) {
  // 1) entrata in una zona: lo dice il telefono, vale più di tutto
  if (evento && evento.posto && evento.tipo === 'enter') return { luogo: evento.posto.id, incerto: false };
  // uscita da una zona: quel posto non vale più, il resto si decide come sempre
  const uscito = evento && evento.posto && evento.tipo === 'leave' ? evento.posto.id : null;
  const validi = uscito ? posti.filter((l) => l.id !== uscito) : posti;
  const prima = uscito && prev.luogo === uscito ? null : prev.luogo ?? null;
  // 2) le zone in cui OwnTracks dice di essere
  if (regioni && regioni.length) {
    const dentroZone = regioni.map((z) => postoDaZona(validi, z)).filter(Boolean);
    if (dentroZone.length) return { luogo: (dentroZone.find((l) => l.id === 'casa') || dentroZone[0]).id, incerto: false, uscito };
  }
  if (soloZone) return { luogo: prima, incerto: Boolean(prev.incerto) && !uscito, uscito };
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { luogo: prima, incerto: !uscito, uscito };
  // 3) la distanza dai nostri posti, con la precisione del punto
  const stati = validi.filter((l) => l.id !== appena).map((l) => ({ l, s: dentro(distanza({ lat, lon }, l), l.r, acc) }));
  const casa = stati.find((x) => x.l.id === 'casa' && x.s === true);
  if (casa) return { luogo: 'casa', incerto: false, uscito };
  const altro = stati.find((x) => x.l.id !== 'casa' && x.s === true);
  if (altro) return { luogo: altro.l.id, incerto: false, uscito };
  // punto impreciso e vicino al posto di prima: non cambio idea
  if (prima && stati.find((x) => x.l.id === prima && x.s === null)) return { luogo: prima, incerto: true, uscito };
  return { luogo: null, incerto: stati.some((x) => x.s === null), uscito };
}

function basic(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return {};
  try {
    const [user, ...rest] = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':');
    return { user, pass: rest.join(':') };
  } catch {
    return {};
  }
}

// OwnTracks ci prova ma il codice non passa: ricordo quando e perché (mai il codice), per "Collegamento" in
// Impostazioni. OwnTracks per iPhone manda la password solo con "Authentication" acceso, e solo se è fatta di
// caratteri semplici: con una lettera accentata o un apostrofo "curvo" manda "Basic (null)".
const tentativi = new Map(); // in memoria: utente → ultimo motivo scritto (lo stesso al massimo una volta al minuto)
async function segnaRifiuto(db, req, b, stato) {
  if (req.headers['x-famiglia']) return; // dall'app, non da OwnTracks
  const h = String(req.headers.authorization || '');
  const nulla = /^Basic \(null\)$/.test(h);
  const auth = nulla ? {} : basic(req);
  const dalTopic = typeof b.topic === 'string' ? b.topic.split('/')[1] : '';
  const utente = norm(auth.user || req.headers['x-limit-u'] || dalTopic || '').slice(0, 40);
  if (!utente) return;
  const motivo = stato === 429 ? 'bloccato' : nulla ? 'caratteri' : !auth.pass ? 'senza' : 'codice';
  const adesso = Date.now();
  const prima = tentativi.get(utente);
  if (prima && prima.motivo === motivo && adesso - prima.at < 60000) return; // stesso motivo da poco: già scritto
  tentativi.set(utente, { motivo, at: adesso });
  try {
    const { items } = await db.collection('settings');
    const names = { p1: 'Patrick', p2: 'Serena', ...((items.main || {}).names || {}) };
    const who = ['p1', 'p2'].includes(utente) ? utente : Object.keys(names).find((k) => norm(names[k]) === utente);
    if (who) await db.metaSet(`ot:rifiuto:${who}`, JSON.stringify({ at: adesso, motivo }));
  } catch {}
}

// ---------------------------------------------------------------------------
// Zone per OwnTracks (setWaypoints). Su iPhone ogni zona si riconosce dal nome.
// ---------------------------------------------------------------------------
const tstStabile = (id) => 1500000000 + (crypto.createHash('sha1').update(String(id)).digest().readUInt32BE(0) % 50000000);
export function zone(posti) {
  return posti.map((l) => ({ _type: 'waypoint', desc: l.nome, lat: Math.round(l.lat * 1e6) / 1e6, lon: Math.round(l.lon * 1e6) / 1e6, rad: Math.max(100, Math.round(l.r)), tst: tstStabile(l.id) }));
}
/** Con quali posti è stato deciso "dove si trova" (l'app ricalcola solo se nel frattempo i posti sono cambiati). */
export const chiavePosti = (posti) => posti.map((l) => `${l.id}:${Number(l.lat).toFixed(5)}:${Number(l.lon).toFixed(5)}:${Math.round(l.r)}`).join('|');
const firmaZone = (z) => crypto.createHash('sha1').update(JSON.stringify(z.map((x) => [x.desc, x.lat, x.lon, x.rad]))).digest('hex').slice(0, 16);

// ---------------------------------------------------------------------------
// Il cuore di Dov'è: dal messaggio del telefono e dalla posizione di prima, la posizione nuova, l'eventuale
// notifica per l'altro e se chiedere a OwnTracks un punto fresco. Pura (l'indirizzo si chiede da fuori): si prova
// senza database.
//
// Le ore. "tst" è quando è stato preso il punto; "created_at" (OwnTracks recenti) quando il telefono ha scritto il
// messaggio. Un'entrata o un'uscita da una zona succede quando il telefono la scrive, ma OwnTracks per iPhone ci
// attacca l'ultima posizione che conosce: dopo ore fermi al lavoro o a casa, un punto di ore prima. Per questo
// un'uscita non si scarta mai perché il suo punto è vecchio (lo stato cambia, il punto più recente resta) e la
// notifica guarda l'ora dell'evento. All'arrivo invece il punto di solito è fresco (si è appena guidato):
// ecco perché prima arrivavano gli arrivi e non le partenze.
// ---------------------------------------------------------------------------
const FRESCO = 2 * 60000;         // un punto più vecchio di così rispetto all'evento è "vecchio"
const CONFINE = 15 * 60000;       // dopo un'uscita, per tanto la sola distanza non fa rientrare nello stesso posto
const NOTIZIA = 30 * 60000;       // un cambio più vecchio di così non si notifica più (sarebbe una notizia vecchia)
const ZONE_VIVE = 14 * 24 * H;    // le zone di OwnTracks "funzionano" se ne ha nominata una in questi giorni

export async function elabora({ b, prev = {}, posti, adesso = Date.now(), daApp = false, cercaIndirizzo = indirizzo }) {
  const type = b._type || 'location';
  let doc = { ...prev, seen: adesso };
  if (!daApp) doc.ot = adesso; // ultimo contatto da OwnTracks (per capire se sta funzionando)
  if (Number.isFinite(num(b.m))) doc.m = num(b.m);
  if (b._type === 'status' && b.iOS && b.iOS.locationManagerAuthorizationStatus) doc.permesso = String(b.iOS.locationManagerAuthorizationStatus).slice(0, 40);
  if (type !== 'location' && type !== 'transition') return { doc, notifica: null, chiediPunto: false };

  // ore dal telefono (in secondi): un orologio avanti di più di 5 minuti vale l'ora del server
  const ora = (x) => { const t = num(x) * 1000; return !(t > 0) ? null : t > adesso + 5 * 60000 ? adesso : t; };
  const fix = ora(b.tst) ?? adesso;
  const scritto = Math.max(fix, ora(b.created_at) ?? fix);
  const lat = num(b.lat), lon = num(b.lon);
  const conPunto = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const evento = type === 'transition' && b.desc ? { tipo: b.event === 'enter' ? 'enter' : b.event === 'leave' ? 'leave' : '', posto: postoDaZona(posti, b.desc) } : null;
  const conEvento = Boolean(evento && evento.posto && evento.tipo);
  const regioni = Array.isArray(b.inregions) ? b.inregions.map(String) : null;
  // le zone di OwnTracks funzionano: lo so quando nomina uno dei nostri posti
  if ((evento && evento.posto) || (regioni && regioni.some((z) => postoDaZona(posti, z)))) doc.zoneOk = adesso;

  const quando = conEvento ? scritto : fix;          // quando è successo quello che il messaggio dice
  const vecchio = quando - fix > FRESCO;              // il punto attaccato all'evento è di molto prima
  // un messaggio rimasto in coda e arrivato tardi non sostituisce una posizione più recente;
  // un'entrata o un'uscita appena scritta vale anche se il suo punto è più vecchio di quello che ho (che resta)
  const nuovo = !prev.at || fix >= prev.at - 60000;
  const soloEvento = !nuovo && conEvento && quando >= prev.at - 60000;
  if (!nuovo && !soloEvento) return { doc, notifica: null, chiediPunto: false };

  // il punto: quello del messaggio se è nuovo; per un'entrata con un punto vecchio il posto stesso (si sa solo che
  // è lì dentro); per un'uscita con un punto più vecchio di quello che ho, resta il mio
  const acc0 = Number.isFinite(num(b.acc)) ? Math.round(num(b.acc)) : null;
  let lt = num(prev.lat), ln = num(prev.lon), acc = prev.acc ?? null, fresco = false;
  if (conEvento && evento.tipo === 'enter' && (vecchio || !nuovo)) { lt = evento.posto.lat; ln = evento.posto.lon; acc = Math.round(evento.posto.r); }
  else if (conPunto && nuovo) { lt = lat; ln = lon; acc = acc0; fresco = true; }
  const accPunto = fresco ? acc0 : 0;

  // un "ping" di OwnTracks rimanda l'ultima posizione che conosce con l'ora di adesso: tiene viva la posizione ma,
  // se le zone funzionano (entrate e uscite le dicono loro), non sposta nessuno; senza zone conta come sempre.
  // Dopo un'uscita, per un quarto d'ora la sola distanza non fa rientrare nello stesso posto
  const zoneAttive = Boolean(doc.zoneOk && adesso - doc.zoneOk < ZONE_VIVE);
  const ping = b.t === 'p' && !conEvento && zoneAttive;
  const uscita = prev.uscita && prev.uscita.luogo ? prev.uscita : null;
  const appena = uscita && fix - uscita.at < CONFINE ? uscita.luogo : null;
  const d = decidi({ posti, lat: lt, lon: ln, acc: accPunto, regioni, evento, prev, appena, soloZone: ping });
  const luogoId = d.luogo;
  const casa = posti.find((l) => l.id === 'casa');
  const home = casa ? luogoId === 'casa' : null;
  const qui = luogoId && luogoId !== 'casa' ? posti.find((l) => l.id === luogoId) : null;
  // per un'entrata o un'uscita l'ora è quella dell'evento: lo stato è di adesso anche se il punto è vecchio
  const at = conEvento ? Math.max(quando, prev.at || 0) : fix;
  const moved = !Number.isFinite(num(prev.lat)) || (fresco && distanza({ lat: num(prev.lat), lon: num(prev.lon) }, { lat, lon }) > 120);
  // uscito, ma con un punto vecchio: dov'è adesso non si sa ancora (meglio niente indirizzo che quello del posto lasciato)
  const ignoto = conEvento && evento.tipo === 'leave' && (vecchio || !nuovo);
  const place = home ? 'Casa' : qui ? qui.nome : ignoto ? '' : fresco && (moved || !prev.place || prev.luogo) ? (await cercaIndirizzo(lat, lon)) || prev.place || '' : prev.place || '';
  const batt = Number.isFinite(num(b.batt));
  doc = {
    ...doc,
    lat: lt, lon: ln, at,
    src: daApp ? 'app' : 'owntracks',
    acc,
    batt: batt ? num(b.batt) : prev.batt ?? null,
    battAt: batt ? scritto : prev.battAt ?? (prev.batt != null ? prev.at ?? null : null),
    t: typeof b.t === 'string' ? b.t.slice(0, 2) : type === 'transition' ? 'c' : null,
    home,
    homeSince: home !== prev.home ? at : prev.homeSince || at,
    luogo: luogoId,
    luogoSince: luogoId !== (prev.luogo ?? null) ? at : prev.luogoSince || at,
    incerto: Boolean(d.incerto),
    posti: chiavePosti(posti),
    place,
  };
  // l'ultima uscita detta dal telefono (si dimentica entrando, o quando si è di nuovo in quel posto)
  if (conEvento) doc.uscita = evento.tipo === 'leave' ? { luogo: evento.posto.id, at: quando } : null;
  if (doc.uscita && (!doc.uscita.luogo || doc.uscita.luogo === luogoId)) doc.uscita = null;

  // Notifica all'altro quando si arriva o si va via da casa, dal lavoro o da un altro dei nostri posti.
  // Per "andato via" bisogna allontanarsi un po' oltre il raggio (o l'iPhone deve dirlo con la zona):
  // così un GPS ballerino non manda falsi allarmi.
  const detto = prev.avviso ? prev.avviso.luogo ?? null : prev.at ? prev.luogo ?? null : undefined;
  let stato = luogoId;
  if (!luogoId && detto) {
    const era = posti.find((l) => l.id === detto);
    const deciso = (conEvento && evento.tipo === 'leave' && evento.posto.id === detto) || d.uscito === detto;
    if (era && !deciso && Number.isFinite(lt) && distanza({ lat: lt, lon: ln }, era) <= era.r + 120 + Math.min(Number(accPunto) || 0, 300)) stato = detto;
  }
  doc.avviso = { luogo: stato, at: stato === detto && prev.avviso ? prev.avviso.at : at };
  const notifica = detto !== undefined && stato !== detto && adesso - quando < NOTIZIA ? { stato, detto } : null;
  // uscita con un punto vecchio: si chiede a OwnTracks dov'è adesso (così la mappa non resta sul posto lasciato)
  const chiediPunto = !daApp && ignoto;
  return { doc, notifica, chiediPunto };
}

// ---------------------------------------------------------------------------
// L'auto: «Ho parcheggiato», il comando rapido sulla schermata Home dell'iPhone. Si preme e basta:
//   POST /api/posizione?auto   corpo JSON { codice, chi, lat, lon }   (il codice va bene anche come x-famiglia o Basic,
//   mai nell'indirizzo). Risponde con una frase sola, che il comando mostra come notifica: «Posizione inviata».
// Si salva in "posizioni" con id "auto" (non è una persona: niente avvisi né zone); la nota vecchia si cancella.
// ---------------------------------------------------------------------------
function testo(res, status, msg) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(msg);
}
// Latitudine e longitudine come arrivano dal comando rapido, in qualsiasi forma: numero, testo con la virgola
// ("45,0703", l'iPhone in italiano), con i gradi ("45,0703° N", "45° 4′ 13″ N"), dentro una lista o un dizionario.
const INVISIBILI = /[  -‏‪- ⁠﻿]/g;
export function coordinata(x, giro = 0) {
  if (x === null || x === undefined || typeof x === 'boolean' || giro > 3) return NaN;
  if (typeof x === 'number') return x;
  if (Array.isArray(x)) return x.length ? coordinata(x[0], giro + 1) : NaN;
  if (typeof x === 'object') {
    for (const v of Object.values(x)) { const n = coordinata(v, giro + 1); if (Number.isFinite(n)) return n; }
    return NaN;
  }
  const s = String(x).normalize('NFKC').replace(INVISIBILI, ' ').replace(/[−–—]/g, '-').trim();
  const dec = (v) => (v ? Number(v.replace(',', '.')) : 0);
  let n;
  // gradi, primi e secondi: 45° 4′ 13,2″ N
  const g = s.match(/(-?\d+(?:[.,]\d+)?)\s*°\s*(\d+(?:[.,]\d+)?)\s*['′’]\s*(?:(\d+(?:[.,]\d+)?)\s*(?:["″”]|''|′′))?/);
  if (g) n = (/^-/.test(g[1]) ? -1 : 1) * (Math.abs(dec(g[1])) + dec(g[2]) / 60 + dec(g[3]) / 3600);
  else { const m = s.match(/-?\d+(?:[.,]\d+)?/); n = m ? dec(m[0]) : NaN; }
  // sud e ovest (anche "O") sono negativi
  if (n > 0 && /\b(?:[SWO]|Sud|Ovest|South|West)\b/.test(s)) n = -n;
  return n;
}
/** Il primo campo che c'è tra quei nomi (maiuscole, accenti e spazi non contano; anche dentro un dizionario). */
function campo(b, nomi, giro = 0) {
  if (!b || typeof b !== 'object' || giro > 2) return undefined;
  const chiavi = Object.keys(b);
  for (const nome of nomi) {
    const k = chiavi.find((x) => norm(x).replace(/\s+/g, '') === nome);
    if (k !== undefined) return b[k];
  }
  for (const k of chiavi) { const v = campo(b[k], nomi, giro + 1); if (v !== undefined) return v; }
  return undefined;
}
const visto = (v) => (v === undefined ? 'manca' : v === null || v === '' ? 'vuota' : `«${(typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 40)}»`);

/**
 * La virgola persa. L'iPhone in italiano scrive Latitudine come "46,0677…" e il campo Numero del comando lo rilegge
 * senza la virgola: arriva 460677…. Le cifre sono giuste: qui provo tutte le posizioni possibili della virgola
 * (0,4…  4,6…  46,…  460,…) e tengo solo quelle che hanno senso (latitudine fino a 90, longitudine fino a 180).
 */
export function possibili(v, max) {
  if (!Number.isFinite(v)) return [];
  if (Math.abs(v) <= max) return [v];
  const a = Math.abs(v);
  const cifre = (a >= 1e21 ? BigInt(Math.round(a)).toString() : String(a)).replace(/\D/g, '');
  const out = [];
  for (let k = 0; k <= 3 && k < cifre.length; k++) {
    const c = (v < 0 ? -1 : 1) * Number(`${cifre.slice(0, k) || '0'}.${cifre.slice(k)}`);
    if (Math.abs(c) <= max) out.push(c);
  }
  return out;
}
/** Tra i punti possibili quello più vicino a dove siamo di solito (le scelte sono lontane migliaia di km tra loro). */
export function piuVicino(lats, lons, riferimenti) {
  let meglio = null;
  for (const lat of lats) {
    for (const lon of lons) {
      const d = Math.min(...riferimenti.map((r) => distanza({ lat, lon }, r)));
      if (!meglio || d < meglio.d) meglio = { lat, lon, d };
    }
  }
  return meglio;
}
/** Dove siamo di solito: le ultime posizioni (prima chi ha parcheggiato), casa, i nostri posti, l'auto di prima. */
async function riferimenti(db, s, chi) {
  const { items: pos } = await db.collection('posizioni');
  const out = [];
  const metti = (p) => {
    const a = num(p && p.lat), o = num(p && p.lon);
    if (Number.isFinite(a) && Number.isFinite(o) && Math.abs(a) <= 90 && Math.abs(o) <= 180 && (a || o)) out.push({ lat: a, lon: o });
  };
  [chi && pos[chi], pos.p1, pos.p2, s.casaPos, ...(Array.isArray(s.luoghi) ? s.luoghi : []), pos.auto].forEach(metti);
  return out.length ? out : [{ lat: 42.5, lon: 12.5 }]; // niente di noto: l'Italia
}

async function parcheggio(req, res) {
  if (req.method !== 'POST') return testo(res, 405, 'Nel comando il metodo deve essere POST');
  const db = backend();
  if (!db) return testo(res, 503, 'Database non collegato');
  const b = body(req);
  const auth = basic(req);
  const esito = await autorizza(req, req.headers['x-famiglia'] || campo(b, ['codice']) || auth.pass);
  if (esito !== 'ok') {
    await sleep(400);
    return esito === 'bloccato' ? testo(res, 429, 'Troppi tentativi con un codice sbagliato: riprova tra un quarto d’ora') : testo(res, 401, 'Codice di famiglia sbagliato');
  }
  const latV = campo(b, ['lat', 'latitudine', 'latitude']), lonV = campo(b, ['lon', 'lng', 'long', 'longitudine', 'longitude']);
  let lat = coordinata(latV), lon = coordinata(lonV);
  // la risposta dice cosa è arrivato (mai il codice): così dalla notifica si capisce cosa sistemare
  const nonLetta = () => testo(res, 400, `Posizione non letta: lat ${visto(latV)}, lon ${visto(lonV)}`);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (!lat && !lon)) {
    if (latV === undefined && lonV === undefined) return testo(res, 400, `Nel comando mancano i campi lat e lon (arrivati: ${Object.keys(b).join(', ').slice(0, 80) || 'nessuno'})`);
    return nonLetta();
  }
  try {
    let sett = null;
    const impostazioni = async () => (sett ||= (await db.collection('settings')).items.main || {});
    // chi ha parcheggiato: "p1"/"p2" oppure il nome (es. "serena"); se manca o non torna, pazienza.
    // I nomi di sempre si riconoscono senza leggere le impostazioni (una lettura in meno: risposta più svelta)
    const raw = String(campo(b, ['chi']) || auth.user || '').trim();
    let chi = ['p1', 'p2'].includes(raw) ? raw : ({ patrick: 'p1', serena: 'p2' })[norm(raw)] || null;
    if (!chi && raw) {
      const names = { p1: 'Patrick', p2: 'Serena', ...((await impostazioni()).names || {}) };
      chi = ['p1', 'p2'].find((k) => norm(names[k]) === norm(raw)) || null;
    }
    // numeri troppo grandi: è la virgola persa dall'iPhone (46,0677… → 460677…), la rimetto al posto giusto
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      const p = piuVicino(possibili(lat, 90), possibili(lon, 180), await riferimenti(db, await impostazioni(), chi));
      if (!p) return nonLetta();
      lat = p.lat; lon = p.lon;
    }
    const acc = coordinata(campo(b, ['acc', 'precisione']));
    const at = Date.now();
    await db.apply([{ op: 'set', col: 'posizioni', id: 'auto', data: { lat, lon, acc: acc > 0 ? Math.round(acc) : null, at, chi, place: '', nota: '', src: 'comando' } }]);
    // si risponde subito: il comando rapido non aspetta l'indirizzo. Quello lo cerco dopo la risposta
    // (se non arriva lo cerca l'app, come prima) e lo scrivo solo se nel frattempo l'auto non si è spostata
    testo(res, 200, 'Posizione inviata');
    waitUntil((async () => {
      try {
        const place = await indirizzo(lat, lon, { preciso: true, attesa: 6000 });
        if (!place) return;
        const ora = (await db.collection('posizioni')).items.auto;
        if (ora && ora.at === at && !ora.place) await db.apply([{ op: 'update', col: 'posizioni', id: 'auto', data: { place } }]);
      } catch (e) { console.error(e); }
    })());
  } catch (e) {
    console.error(e);
    testo(res, 500, 'Database non raggiungibile: riprova tra poco');
  }
}

export default async function handler(req, res) {
  // l'auto ha la sua strada, con risposte in testo semplice per il comando rapido
  if (new URL(req.url, 'http://x').searchParams.has('auto')) return parcheggio(req, res);
  if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non permesso' });
  const db = backend();
  if (!db) return send(res, 503, { error: 'Database non collegato' });

  const b = body(req);
  const auth = basic(req);
  const q = new URL(req.url, 'http://x').searchParams;
  // il codice arriva solo nell'intestazione (app) o nell'autenticazione di OwnTracks: mai nell'indirizzo, che finisce nei log
  const code = req.headers['x-famiglia'] || auth.pass;
  if (await respingi(req, res, code)) { await segnaRifiuto(db, req, b, res.statusCode); return; }

  try {
    const [{ items: sett }, { items: pos }] = await Promise.all([db.collection('settings'), db.collection('posizioni')]);
    const s = sett.main || {};
    const names = { p1: 'Patrick', p2: 'Serena', ...(s.names || {}) };
    // chi è? "p1"/"p2" oppure il nome (es. "serena")
    const raw = b.chi || auth.user || q.get('chi') || q.get('u') || req.headers['x-limit-u'] || '';
    const who = ['p1', 'p2'].includes(raw) ? raw : Object.keys(names).find((k) => norm(names[k]) === norm(raw));
    if (!who) return send(res, 400, { error: 'Utente sconosciuto: usa il tuo nome' });
    const other = who === 'p1' ? 'p2' : 'p1';
    const daApp = Boolean(req.headers['x-famiglia']);

    // l'app chiede all'altro di condividere la posizione (con una notifica: decide lui se farlo)
    if (daApp && b.chiedi) {
      const ultima = Number(await db.metaGet(`dove:chiesto:${who}`)) || 0;
      if (Date.now() - ultima < 3 * 60000) return send(res, 429, { error: 'Richiesta già mandata, aspetta qualche minuto' });
      await db.metaSet(`dove:chiesto:${who}`, String(Date.now()));
      const esito = await avvisa({
        per: other, tipo: 'arrivi', urgente: true, ttl: 900,
        title: `${names[who]} chiede dove sei`, body: 'Tocca qui se vuoi condividere la tua posizione adesso', tag: 'dove-chiedi', url: '#/dove/condividi',
      }, origineDi(req));
      return send(res, 200, { ok: true, inviati: esito.inviati || 0 });
    }

    const prev = pos[who] || {};
    const posti = postiDi(s, who);
    const adesso = Date.now();
    const { doc, notifica, chiediPunto } = await elabora({ b, prev, posti, adesso, daApp });

    // zone da mandare a OwnTracks (solo se cambiate, o ogni ora finché non vedo che funzionano: così, appena si accende
    // l'impostazione giusta in OwnTracks, le zone arrivano presto)
    const out = [];
    if (!daApp && posti.length) {
      const z = zone(posti);
      const firma = firmaZone(z);
      const funzionano = doc.zoneOk && adesso - doc.zoneOk < ZONE_VIVE;
      if (prev.zoneFirma !== firma || (!funzionano && adesso - (prev.zoneAt || 0) > H)) {
        // le zone mandate prima con un nome che non c'è più si tolgono (su iPhone: coordinate non valide = elimina)
        const via = (prev.zoneNomi || []).filter((n) => !z.some((x) => x.desc === n)).map((n) => ({ _type: 'waypoint', desc: n, lat: 1000, lon: 1000, rad: 0, tst: tstStabile(`via:${n}`) }));
        out.push({ _type: 'cmd', action: 'setWaypoints', waypoints: { _type: 'waypoints', waypoints: [...z, ...via] } });
        doc.zoneFirma = firma;
        doc.zoneAt = adesso;
        doc.zoneNomi = z.map((x) => x.desc);
      }
    }
    // uscita arrivata con l'ultima posizione che il telefono conosceva (vecchia): chiedo a OwnTracks dov'è adesso
    // (lo fa se "Remote Commands" è attivo; altrimenti ignora la richiesta e resta tutto come prima)
    if (chiediPunto) out.push({ _type: 'cmd', action: 'reportLocation' });

    await db.apply([{ op: 'set', col: 'posizioni', id: who, data: doc }]);
    pos[who] = doc;

    if (notifica) {
      const nomeDi = (id) => (id === 'casa' ? 'casa' : (posti.find((l) => l.id === id) || {}).nome || '');
      const dove = (id, arrivo) => {
        const n = nomeDi(id);
        if (id === 'casa') return arrivo ? 'è a casa' : 'ha lasciato casa';
        if (/lavoro/i.test(n)) return arrivo ? 'è al lavoro' : 'ha lasciato il lavoro';
        return arrivo ? `è qui: ${n}` : `ha lasciato ${n}`;
      };
      await avvisa({
        per: other, tipo: 'arrivi', urgente: true, ttl: 1800,
        title: names[who], body: `${names[who]} ${notifica.stato ? dove(notifica.stato, true) : dove(notifica.detto, false)}`, tag: `dove-${who}`, url: '#/dove',
      }, origineDi(req)).catch(() => {});
    }

    if (daApp) return send(res, 200, { ok: true, at: doc.at, luogo: doc.luogo ?? null });
    // a OwnTracks rimando la posizione dell'altro, così vi vedete anche lì
    const o = pos[other];
    out.unshift({ _type: 'card', tid: tid(names[other]), name: names[other] });
    if (o && Number.isFinite(num(o.lat))) out.splice(1, 0, { _type: 'location', tid: tid(names[other]), lat: o.lat, lon: o.lon, tst: Math.round(o.at / 1000), acc: o.acc || 50, ...(o.batt != null ? { batt: o.batt } : {}) });
    send(res, 200, out);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Database non raggiungibile' });
  }
}
