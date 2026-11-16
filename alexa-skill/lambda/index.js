// Skill Alexa della Fam. Comperotto (nome di invocazione: "casa mia")
//   «Alexa, chiedi a casa mia di aggiungere il latte»
//   «Alexa, chiedi a casa mia cosa c'è da comprare»
//   «Alexa, chiedi a casa mia di togliere il latte»
//   «Alexa, chiedi a casa mia cosa si butta stasera»
//   «Alexa, chiedi a casa mia cosa c'è da fare oggi»
'use strict';

// ============================================================================
//  L'UNICA COSA DA CAMBIARE: l'indirizzo della vostra app + /api e il codice di famiglia
// ============================================================================
const CONFIG = {
  apiUrl: 'https://VOSTRO-PROGETTO.vercel.app/api',
  codice: 'il-vostro-codice',
};
// ============================================================================

const Alexa = require('ask-sdk-core');
const http = require('http');
const https = require('https');

function defaultTransport(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.request(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...headers },
      timeout: 6000,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = {};
        try { json = raw ? JSON.parse(raw) : {}; } catch (e) { json = { raw }; }
        resolve({ status: res.statusCode, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** apiUrl: es. "https://comperotto.vercel.app/api" — codice: il codice di famiglia. */
function createClient({ apiUrl, codice, transport = defaultTransport }) {
  const base = String(apiUrl || '').replace(/\/+$/, '');
  async function call(method, path, body) {
    const r = await transport(method, `${base}/${path}`, body, { 'x-famiglia': String(codice || '').trim().toLowerCase() });
    if (r.status === 401) throw new Error('Codice di famiglia sbagliato');
    if (r.status >= 300) throw new Error(`API ${r.status}: ${r.json && r.json.error}`);
    return r.json;
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return {
    async list(col) {
      const j = await call('GET', `dati?col=${encodeURIComponent(col)}`);
      return Object.entries(j.items || {}).map(([id, v]) => ({ ...v, id }));
    },
    async get(col, id) {
      const j = await call('GET', `dati?col=${encodeURIComponent(col)}`);
      const v = (j.items || {})[id];
      return v ? { ...v, id } : null;
    },
    async add(col, data, extraOps = []) {
      const id = newId();
      await call('POST', 'dati', { ops: [{ op: 'set', col, id, data }, ...extraOps] });
      return id;
    },
    async remove(col, id) {
      await call('POST', 'dati', { ops: [{ op: 'remove', col, id }] });
    },
  };
}


let client = null;
function db() {
  if (!client) client = createClient(CONFIG);
  return client;
}
// per i test
const setClient = (c) => { client = c; };

// ---------------------------------------------------------------------------
// Testo
// ---------------------------------------------------------------------------
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const ARTICLES = /^(?:(?:il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle|di|da|anche|ancora|poi|per favore)\s+|(?:l|un|dell|d)['’]\s*)/i;

function cleanItem(s) {
  let x = String(s || '').trim().replace(/[.!?]+$/, '');
  for (let i = 0; i < 3; i++) x = x.replace(ARTICLES, '');
  x = x.replace(/\s+(alla|nella)\s+(lista|spesa).*$/i, '');
  return cap(x.trim());
}
/** "latte, uova e pane" → ["Latte", "Uova", "Pane"] */
function splitItems(s) {
  return String(s || '')
    .split(/\s*,\s*|\s+e\s+|\s+ed\s+/i)
    .map(cleanItem)
    .filter(Boolean);
}
function joinIt(list) {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;
}
const esc = (s) => String(s).replace(/&/g, 'e').replace(/[<>]/g, '');

// ---------------------------------------------------------------------------
// Date (fuso orario italiano)
// ---------------------------------------------------------------------------
function todayRome(offset = 0) {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offset));
  return dt.toISOString().slice(0, 10);
}
const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);

// stessa logica di js/data.js → nextDue
function nextDue(ch, ref) {
  const f = ch.freq || { type: 'days', every: 7 };
  if (f.type === 'weekdays' && Array.isArray(f.days) && f.days.length) {
    const start = ch.lastDone ? addDays(ch.lastDone, 1) : ref;
    for (let i = 0; i < 8; i++) { const d = addDays(start, i); if (f.days.includes(weekday(d))) return d; }
    return ref;
  }
  const every = Math.max(1, Number(f.every) || 7);
  return ch.lastDone ? addDays(ch.lastDone, every) : ref;
}

const BINS = { umido: "l'umido", plastica: 'la plastica', carta: 'la carta', vetro: 'il vetro', secco: "l'indifferenziato" };

// ---------------------------------------------------------------------------
// Risposte
// ---------------------------------------------------------------------------
// Se la skill è stata aperta ("Alexa, apri casa mia" o la Routine "Alexa, spesa")
// resta in ascolto: si può continuare a dire "latte", "uova"… e chiudere con "no" o "basta".
function reply(h, text, { keepOpen = false } = {}) {
  const inSession = h.requestEnvelope.session && !h.requestEnvelope.session.new;
  if (keepOpen || inSession) {
    return h.responseBuilder.speak(`${text} Altro?`).reprompt('Ti serve altro? Dimmi pure, oppure di\' no.').withShouldEndSession(false).getResponse();
  }
  return h.responseBuilder.speak(text).withShouldEndSession(true).getResponse();
}
const slot = (h, name) => {
  const s = Alexa.getSlot(h.requestEnvelope, name);
  return s && s.value ? s.value : '';
};
const slotId = (h, name) => {
  const s = Alexa.getSlot(h.requestEnvelope, name);
  const r = s && s.resolutions && s.resolutions.resolutionsPerAuthority && s.resolutions.resolutionsPerAuthority[0];
  return r && r.status && r.status.code === 'ER_SUCCESS_MATCH' ? r.values[0].value.id : '';
};

const LaunchRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle: (h) => h.responseBuilder
    .speak('Cosa ti serve?')
    .reprompt('Dimmi cosa aggiungere alla spesa, per esempio: latte e uova. Oppure chiedimi cosa si butta stasera.')
    .withShouldEndSession(false)
    .getResponse(),
};

const AggiungiIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AggiungiIntent',
  async handle(h) {
    const items = splitItems(slot(h, 'prodotto'));
    if (!items.length) {
      return h.responseBuilder.speak('Cosa aggiungo alla spesa?').reprompt('Dimmi cosa aggiungere, per esempio: il latte.')
        .addElicitSlotDirective('prodotto').getResponse();
    }
    const list = await db().list('spesa');
    const open = new Set(list.filter((i) => !i.done).map((i) => norm(i.name)));
    const added = [];
    const already = [];
    for (const name of items) {
      if (open.has(norm(name))) { already.push(name); continue; }
      const key = norm(name).replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'x';
      // anche Alexa alimenta i "spesso comprati" dell'app
      await db().add('spesa', { name, qty: '', category: '', done: false, by: '', source: 'alexa', createdAt: Date.now() },
        [{ op: 'bump', col: 'freq', id: key, data: { name } }]);
      open.add(norm(name));
      added.push(name);
    }
    let text = '';
    if (added.length) text += `Fatto: ho aggiunto ${joinIt(added.map((x) => x.toLowerCase()))} alla spesa.`;
    if (already.length) text += ` C'era già: ${joinIt(already.map((x) => x.toLowerCase()))}.`;
    return reply(h, esc(text.trim()));
  },
};

const LeggiListaIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'LeggiListaIntent',
  async handle(h) {
    const open = (await db().list('spesa')).filter((i) => !i.done).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!open.length) return reply(h, 'La lista della spesa è vuota. Frigo pieno!');
    const names = open.map((i) => `${i.qty ? `${i.qty} ` : ''}${i.name}`.toLowerCase());
    const shown = names.slice(0, 15);
    const more = names.length - shown.length;
    const text = `${open.length === 1 ? 'C\'è una cosa' : `Ci sono ${open.length} cose`}: ${joinIt(shown)}${more > 0 ? `, e altre ${more}` : ''}.`;
    return reply(h, esc(text));
  },
};

const RimuoviIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'RimuoviIntent',
  async handle(h) {
    const items = splitItems(slot(h, 'prodotto'));
    if (!items.length) return reply(h, 'Cosa tolgo dalla lista?', { keepOpen: true });
    const open = (await db().list('spesa')).filter((i) => !i.done);
    const removed = [];
    const missing = [];
    for (const name of items) {
      const n = norm(name);
      const hit = open.find((i) => norm(i.name) === n) || open.find((i) => norm(i.name).startsWith(n) || n.startsWith(norm(i.name)));
      if (hit) { await db().remove('spesa', hit.id); removed.push(hit.name); } else missing.push(name);
    }
    let text = '';
    if (removed.length) text += `Ho tolto ${joinIt(removed.map((x) => x.toLowerCase()))} dalla lista.`;
    if (missing.length) text += ` Non ho trovato in lista: ${joinIt(missing.map((x) => x.toLowerCase()))}.`;
    return reply(h, esc(text.trim()));
  },
};

const RifiutiIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'RifiutiIntent',
  async handle(h) {
    const tomorrow = slotId(h, 'giorno') === 'domani' || /domani/i.test(slot(h, 'giorno'));
    const day = todayRome(tomorrow ? 1 : 0);
    const s = (await db().get('settings', 'main')) || {};
    const r = s.rifiuti || {};
    const bins = (r[String(weekday(day))] || []).filter((b) => BINS[b]);
    const when = tomorrow ? 'Domani sera' : 'Stasera';
    if (!bins.length) return reply(h, `${when} non si butta niente. Serata libera!`);
    const done = !tomorrow && s.rifiutiFatto && s.rifiutiFatto.date === day;
    return reply(h, `${when} si porta fuori ${joinIt(bins.map((b) => BINS[b]))}.${done ? ' Ma risulta già fatto, bravi!' : ''}`);
  },
};

const FaccendeIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'FaccendeIntent',
  async handle(h) {
    const today = todayRome();
    const chores = (await db().list('routine'))
      .filter((c) => c.lastDone !== today)
      .map((c) => ({ ...c, late: daysBetween(nextDue(c, today), today) }))
      .filter((c) => c.late >= 0)
      .sort((a, b) => b.late - a.late);
    if (!chores.length) return reply(h, 'Oggi niente faccende in scadenza. Divano!');
    const names = chores.slice(0, 8).map((c) => c.title.toLowerCase());
    return reply(h, esc(`Oggi c'è da fare: ${joinIt(names)}${chores.length > 8 ? `, e altre ${chores.length - 8}` : ''}.`));
  },
};

const YesIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.YesIntent',
  handle: (h) => h.responseBuilder.speak('Dimmi pure.').reprompt('Cosa aggiungo alla spesa?').withShouldEndSession(false).getResponse(),
};

const NoIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.NoIntent',
  handle: (h) => h.responseBuilder.speak('Perfetto, a dopo!').withShouldEndSession(true).getResponse(),
};

const HelpIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent',
  handle: (h) => h.responseBuilder
    .speak('Puoi dirmi: aggiungi il latte, togli le uova, cosa c\'è da comprare, cosa si butta stasera, oppure cosa c\'è da fare oggi.')
    .reprompt('Cosa ti serve?')
    .getResponse(),
};

const CancelAndStopIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
    && ['AMAZON.CancelIntent', 'AMAZON.StopIntent', 'AMAZON.NavigateHomeIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: (h) => h.responseBuilder.speak('A dopo!').withShouldEndSession(true).getResponse(),
};

const FallbackIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.FallbackIntent',
  handle: (h) => h.responseBuilder.speak('Non ho capito. Dimmi cosa aggiungere, per esempio: latte.').reprompt('Cosa ti serve?').getResponse(),
};

const SessionEndedRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
  handle: (h) => h.responseBuilder.getResponse(),
};

const ErrorHandler = {
  canHandle: () => true,
  handle(h, error) {
    console.error('Errore skill:', error && error.message);
    return h.responseBuilder.speak('Ops, non riesco a raggiungere la casa in questo momento. Riprova tra poco.').withShouldEndSession(true).getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AggiungiIntentHandler,
    LeggiListaIntentHandler,
    RimuoviIntentHandler,
    RifiutiIntentHandler,
    FaccendeIntentHandler,
    YesIntentHandler,
    NoIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('casa-comperotto/1.0')
  .lambda();

exports._test = { setClient, createClient, splitItems, cleanItem, nextDue, todayRome };
