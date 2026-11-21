// Piccoli strumenti condivisi: template HTML sicuri, date, testo, immagini.

export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function fmt(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(fmt).join('');
  if (v instanceof Raw) return v.s;
  return esc(String(v));
}

/** Template tag: i valori interpolati vengono sempre escapati, tranne raw()/html annidati. */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += fmt(vals[i]); });
  return raw(out);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------- testo ----------
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
export const cap = (s) => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
export const initial = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Accetta solo link http(s): niente javascript: & co. */
export const safeUrl = (u) => {
  u = String(u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; }
};
export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

const UNITS = 'kg|g|gr|hg|mg|l|lt|dl|cl|ml|cucchiai|cucchiaio|cucchiaini|cucchiaino|bicchieri|bicchiere|tazze|tazza|pz|pezzi|pezzo|spicchi|spicchio|bustine|bustina|vasetti|vasetto|confezioni|confezione|pacchi|pacco|fette|fetta|rametti|rametto|foglie|foglia|scatolette|scatoletta|lattine|lattina|bottiglie|bottiglia|mazzetto|mazzo|pizzico|pizzichi|rotoli|rotolo|coste|costa|mestoli|mestolo|barattoli|barattolo|buste|busta';

/**
 * "200 g di farina" → { qty: '200 g', name: 'farina' }
 * "Sale q.b."       → { qty: '', name: 'Sale' }
 * "2 latte"         → { qty: '2', name: 'latte' }
 */
export function parseQty(line) {
  let s = String(line || '').trim().replace(/\s+/g, ' ');
  s = s.replace(/\s*[,(]?\s*q\.?\s?b\.?\)?\s*$/i, '');
  const re = new RegExp(`^((?:\\d+[.,]?\\d*|[½¼¾]|\\d+\\/\\d+)(?:\\s*-\\s*\\d+)?\\s*(?:(?:${UNITS})\\b\\.?)?)\\s*(?:x\\s+)?(?:di\\s+|d')?(.+)$`, 'i');
  const m = s.match(re);
  if (m && m[2]) return { qty: m[1].trim(), name: m[2].trim() };
  const m2 = s.match(/^(.+?)\s+x\s?(\d+)$/i);
  if (m2) return { qty: m2[2], name: m2[1].trim() };
  return { qty: '', name: s };
}

// ---------- date ----------
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => iso(new Date());
export const parseIso = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 86400000);

// ---------- a caso ----------
/** Un numero "a caso" ma sempre uguale per lo stesso testo. */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
/** Un elemento della lista a caso, uguale per tutto il giorno; con il dado (giro 1, 2, …) i successivi,
 *  tutti diversi finché non sono usciti tutti. Ognuno ha la stessa probabilità.
 *  Restituisce anche l'ordine, per chi vuole "quello e poi gli altri". */
export function aCasoDelGiorno(list, idOf, giro = 0, chiave = '') {
  if (!list.length) return { scelto: null, ordine: [] };
  const day = todayIso();
  const ordine = list.map((x, i) => [hash(`${chiave}|${day}|${idOf(x)}`), i, x]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((p) => p[2]);
  const n = ordine.length;
  const i = ((Math.floor(Number(giro) || 0) % n) + n) % n;
  return { scelto: ordine[i], ordine: [...ordine.slice(i), ...ordine.slice(0, i)] };
}

export const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
export const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export const longDate = (d = new Date()) => cap(`${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`);
export const shortDate = (s) => { if (!s) return ''; const d = parseIso(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };

/** "oggi", "domani", "tra 3 giorni", "ieri", "5 giorni fa" */
export function relDay(s, ref = todayIso()) {
  const n = daysBetween(ref, s);
  if (n === 0) return 'oggi';
  if (n === 1) return 'domani';
  if (n === -1) return 'ieri';
  if (n > 1 && n < 14) return `tra ${n} giorni`;
  if (n < -1 && n > -14) return `${-n} giorni fa`;
  return shortDate(s);
}

export function timeAgo(ts) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'adesso';
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h fa`;
  const g = Math.round(h / 24);
  return g === 1 ? 'ieri' : `${g} giorni fa`;
}

export function ageFrom(birth) {
  if (!birth) return '';
  const b = parseIso(birth), now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) return '';
  if (months < 12) return months <= 1 ? `${Math.max(months, 0)} mese` : `${months} mesi`;
  const y = Math.floor(months / 12), r = months % 12;
  return `${y} ${y === 1 ? 'anno' : 'anni'}${r ? ` e ${r} ${r === 1 ? 'mese' : 'mesi'}` : ''}`;
}

/** Pasqua (algoritmo anonimo gregoriano). */
export function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(new Date(year, month - 1, day));
}

/** Prossima occorrenza (oggi incluso) di una data ricorrente "MM-DD" o "YYYY-MM-DD". */
export function nextYearly(mmdd, ref = todayIso()) {
  const md = mmdd.length > 5 ? mmdd.slice(5) : mmdd;
  const y = parseIso(ref).getFullYear();
  let d = `${y}-${md}`;
  if (daysBetween(ref, d) < 0) d = `${y + 1}-${md}`;
  return d;
}

// ---------- immagini ----------
/** Ridimensiona una foto scelta dall'utente in un JPEG leggero (data URL) da salvare nel database. */
export function resizeImage(file, max = 720, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * r), h = Math.round(img.height * r);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non valida')); };
    img.src = url;
  });
}

const scaldate = new Set();
/**
 * Scarica in anticipo delle immagini (poche alla volta, senza toccare la pagina): quando la pagina le mostra
 * arrivano dalla memoria del browser. "ogni" è chiamata per ognuna appena è pronta (anche se non è arrivata).
 */
export function scaldaImmagini(urls, { insieme = 4, ogni = null, referrer = true } = {}) {
  const lista = [...new Set(urls)].filter((u) => typeof u === 'string' && /^https:\/\//.test(u) && !scaldate.has(u));
  lista.forEach((u) => scaldate.add(u));
  return new Promise((fine) => {
    let i = 0, attive = 0;
    const prossima = () => {
      if (i >= lista.length) { if (!attive) fine(lista.length); return; }
      const u = lista[i++];
      attive++;
      const im = new Image();
      im.decoding = 'async';
      if (!referrer) im.referrerPolicy = 'no-referrer'; // come nella pagina (es. le foto di Amazon)
      const fatto = () => { attive--; if (ogni) ogni(u); prossima(); };
      im.onload = fatto;
      im.onerror = fatto;
      im.src = u;
    };
    if (!lista.length) fine(0);
    else for (let k = 0; k < insieme; k++) prossima();
  });
}

/** Prepara (decodifica) delle foto salvate nei dati (data:image…), una alla volta: aprendo la pagina sono pronte. */
export async function preparaFoto(urls) {
  for (const u of [...new Set(urls)].filter((x) => typeof x === 'string' && x.startsWith('data:image/'))) {
    if (document.hidden) return;
    const im = new Image();
    im.decoding = 'async';
    im.src = u;
    try { await (im.decode ? im.decode() : new Promise((ok, ko) => { im.onload = ok; im.onerror = ko; })); } catch { /* foto rovinata: pazienza */ }
  }
}

// Solo foto vere in base64 (finiscono anche dentro style="background-image:url(…)"). Il controllo scorre
// tutta la stringa: lo ricordo, così ridisegnare la pagina non lo ripete per ogni foto.
const fotoOk = new Map();
export const safeImg = (s) => {
  if (typeof s !== 'string' || !s.startsWith('data:image/')) return '';
  let ok = fotoOk.get(s);
  if (ok === undefined) {
    ok = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
    if (fotoOk.size > 400) fotoOk.clear();
    fotoOk.set(s, ok);
  }
  return ok ? s : '';
};

export const money = (n) => (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: (Number(n) % 1) ? 2 : 0 });

// ---------- iPhone / iPad ----------
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** iPad (anche quando Safari si presenta come Mac): la posizione la mandano solo gli iPhone */
export const isIPad = () => /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

/**
 * Piccolo "tap" tattile. Su iPhone (iOS 18+) Safari non supporta navigator.vibrate,
 * ma dà un feedback aptico quando si attiva un interruttore <input switch>: lo usiamo di nascosto.
 */
export function vibrate(ms = 8) {
  try {
    if (navigator.vibrate) { navigator.vibrate(ms); return; }
    if (!isIOS()) return;
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {}
}

/** "29/04/1997" → "1997-04-29", "29/04" → "04-29"; date non valide → null. Vuoto → "". */
export function parseDMY(s) {
  s = String(s || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})[/.\- ](\d{1,2})(?:[/.\- ](\d{2}|\d{4}))?$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]);
  let y = m[3] ? Number(m[3]) : null;
  if (y != null && y < 100) y += y > 40 ? 1900 : 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(y || 2000, mo, 0).getDate()) return null;
  return `${y ? `${y}-` : ''}${pad(mo)}-${pad(d)}`;
}
/** "1997-04-29" → "29/04/1997", "04-29" → "29/04" */
export function fmtDMY(s) {
  s = String(s || '');
  if (s.length === 10) return `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  if (s.length === 5) return `${s.slice(3)}/${s.slice(0, 2)}`;
  return '';
}

export const lsGet = (k, def = null) => { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch { return def; } };
export const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };
