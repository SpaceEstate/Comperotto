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
import crypto from 'node:crypto';
import { backend, body, respingi, send } from './_lib.js';
import { avvisa, origineDi } from './_push.js';

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

/** Dove si trova adesso: il posto (id) oppure null; incerto = punto troppo impreciso per cambiare idea. */
export function decidi({ posti, lat, lon, acc, regioni, evento, prev }) {
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
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { luogo: prima, incerto: !uscito, uscito };
  // 3) la distanza dai nostri posti, con la precisione del punto
  const stati = validi.map((l) => ({ l, s: dentro(distanza({ lat, lon }, l), l.r, acc) }));
  const casa = stati.find((x) => x.l.id === 'casa' && x.s === true);
  if (casa) return { luogo: 'casa', incerto: false, uscito };
  const altro = stati.find((x) => x.l.id !== 'casa' && x.s === true);
  if (altro) return { luogo: altro.l.id, incerto: false, uscito };
  // punto impreciso e vicino al posto di prima: non cambio idea
  if (prima && stati.find((x) => x.l.id === prima && x.s === null)) return { luogo: prima, incerto: true, uscito };
  return { luogo: null, incerto: stati.some((x) => x.s === null), uscito };
}

/** "Via Roma, Torino" dalle coordinate (OpenStreetMap), con un limite di tempo. */
async function indirizzo(lat, lon) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=17&accept-language=it&lat=${lat}&lon=${lon}`, {
      headers: { 'User-Agent': 'FamComperotto/1.0 (app di casa per uso familiare)', Accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return '';
    const j = await r.json();
    const a = j.address || {};
    const via = a.road || a.pedestrian || a.square || a.neighbourhood || a.suburb || '';
    const citta = a.city || a.town || a.village || a.municipality || a.county || '';
    return [via, citta].filter(Boolean).join(', ') || (j.display_name || '').split(',').slice(0, 2).join(',').trim();
  } catch {
    return '';
  }
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Metodo non permesso' });
  const db = backend();
  if (!db) return send(res, 503, { error: 'Database non collegato' });

  const b = body(req);
  const auth = basic(req);
  const q = new URL(req.url, 'http://x').searchParams;
  // il codice arriva solo nell'intestazione (app) o nell'autenticazione di OwnTracks: mai nell'indirizzo, che finisce nei log
  const code = req.headers['x-famiglia'] || auth.pass;
  if (await respingi(req, res, code)) return;

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

    const type = b._type || 'location';
    const prev = pos[who] || {};
    const posti = postiDi(s, who);
    const casa = posti.find((l) => l.id === 'casa');
    const adesso = Date.now();
    let doc = { ...prev, seen: adesso };
    if (!daApp) doc.ot = adesso; // ultimo contatto da OwnTracks (per capire se sta funzionando)
    if (Number.isFinite(num(b.m))) doc.m = num(b.m);
    if (b._type === 'status' && b.iOS && b.iOS.locationManagerAuthorizationStatus) doc.permesso = String(b.iOS.locationManagerAuthorizationStatus).slice(0, 40);
    let notifica = null;

    const lat = num(b.lat), lon = num(b.lon);
    const conPunto = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    if (type === 'location' || type === 'transition') {
      let at = Number.isFinite(num(b.tst)) ? num(b.tst) * 1000 : adesso;
      if (at > adesso + 5 * 60000) at = adesso; // orologio del telefono avanti: vale l'ora del server
      const evento = type === 'transition' && b.desc ? { tipo: b.event === 'enter' ? 'enter' : b.event === 'leave' ? 'leave' : '', posto: postoDaZona(posti, b.desc) } : null;
      const regioni = Array.isArray(b.inregions) ? b.inregions.map(String) : null;
      // un messaggio rimasto in coda e arrivato tardi non sostituisce una posizione più recente
      if (!prev.at || at >= prev.at - 60000) {
        const acc = Number.isFinite(num(b.acc)) ? Math.round(num(b.acc)) : null;
        const lt = conPunto ? lat : num(prev.lat), ln = conPunto ? lon : num(prev.lon);
        const d = decidi({ posti, lat: lt, lon: ln, acc: conPunto ? acc : 0, regioni, evento, prev });
        const luogoId = d.luogo;
        const home = casa ? luogoId === 'casa' : null;
        // le zone di OwnTracks funzionano: lo so quando nomina uno dei nostri posti
        if ((evento && evento.posto) || (regioni && regioni.some((z) => postoDaZona(posti, z)))) doc.zoneOk = adesso;
        const qui = luogoId && luogoId !== 'casa' ? posti.find((l) => l.id === luogoId) : null;
        const moved = !Number.isFinite(num(prev.lat)) || (conPunto && distanza({ lat: num(prev.lat), lon: num(prev.lon) }, { lat, lon }) > 120);
        const place = home ? 'Casa' : qui ? qui.nome : conPunto && (moved || !prev.place || prev.luogo) ? (await indirizzo(lat, lon)) || prev.place || '' : prev.place || '';
        doc = {
          ...doc,
          lat: lt, lon: ln, at,
          src: daApp ? 'app' : 'owntracks',
          acc: conPunto ? acc : prev.acc ?? null,
          batt: Number.isFinite(num(b.batt)) ? num(b.batt) : prev.batt ?? null,
          t: typeof b.t === 'string' ? b.t.slice(0, 2) : type === 'transition' ? 'c' : null,
          home,
          homeSince: home !== prev.home ? at : prev.homeSince || at,
          luogo: luogoId,
          luogoSince: luogoId !== (prev.luogo ?? null) ? at : prev.luogoSince || at,
          incerto: Boolean(d.incerto),
          posti: chiavePosti(posti),
          place,
        };
        // Notifica all'altro quando si arriva o si va via da casa, dal lavoro o da un altro dei nostri posti.
        // Per "andato via" bisogna allontanarsi un po' oltre il raggio (o l'iPhone deve dirlo con la zona):
        // così un GPS ballerino non manda falsi allarmi.
        const detto = prev.avviso ? prev.avviso.luogo ?? null : prev.at ? prev.luogo ?? null : undefined;
        let stato = luogoId;
        if (!luogoId && detto) {
          const era = posti.find((l) => l.id === detto);
          const deciso = (evento && evento.tipo === 'leave' && evento.posto && evento.posto.id === detto) || d.uscito === detto;
          if (era && !deciso && Number.isFinite(lt) && distanza({ lat: lt, lon: ln }, era) <= era.r + 120 + Math.min(Number(acc) || 0, 300)) stato = detto;
        }
        doc.avviso = { luogo: stato, at: stato === detto && prev.avviso ? prev.avviso.at : at };
        if (detto !== undefined && stato !== detto && adesso - at < 30 * 60000) notifica = { stato, detto };
      }
    }

    // zone da mandare a OwnTracks (solo se cambiate, o ogni 12 ore finché non vedo che funzionano)
    const out = [];
    if (!daApp && posti.length) {
      const z = zone(posti);
      const firma = firmaZone(z);
      const funzionano = doc.zoneOk && adesso - doc.zoneOk < 14 * 24 * H;
      if (prev.zoneFirma !== firma || (!funzionano && adesso - (prev.zoneAt || 0) > 12 * H)) {
        // le zone mandate prima con un nome che non c'è più si tolgono (su iPhone: coordinate non valide = elimina)
        const via = (prev.zoneNomi || []).filter((n) => !z.some((x) => x.desc === n)).map((n) => ({ _type: 'waypoint', desc: n, lat: 1000, lon: 1000, rad: 0, tst: tstStabile(`via:${n}`) }));
        out.push({ _type: 'cmd', action: 'setWaypoints', waypoints: { _type: 'waypoints', waypoints: [...z, ...via] } });
        doc.zoneFirma = firma;
        doc.zoneAt = adesso;
        doc.zoneNomi = z.map((x) => x.desc);
      }
    }

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
