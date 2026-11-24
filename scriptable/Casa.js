// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: home;

// ============================================================================
//  Fam. Comperotto — il widget di casa per la schermata Home (app Scriptable)
//  Mostra la spesa da comprare e le faccende di oggi (con i rifiuti di stasera),
//  con i colori dell'app: nelle feste quelli della festa, come tutto il sito.
//  Toccandolo parte il comando rapido «Apri Casa», che apre l'app di casa.
//
//  Come si mette: istruzioni nel README del progetto, «Widget sulla schermata Home».
//  Il codice di famiglia non serve scriverlo qui: la prima volta che avviate lo
//  script dentro Scriptable ve lo chiede, e resta nel portachiavi dell'iPhone.
//
//  Nel widget, alla voce «Parameter» si può scrivere:
//    spesa     → solo la lista della spesa
//    faccende  → solo le faccende di oggi (con i rifiuti)
//    (niente)  → tutte e due
// ============================================================================
const CONFIG = {
  indirizzo: 'https://comperotto.vercel.app',
  // se preferite scriverlo qui invece che nel portachiavi (mai in un file che condividete)
  codice: '',
  // toccando il widget parte questo comando rapido (app Comandi), che apre l'app di casa
  comando: 'Apri Casa',
  // senza comando (comando: ''), il tocco apre questo indirizzo: 'webapp://comperotto.vercel.app/' apre l'app
  // solo su alcune versioni di iOS; 'https://comperotto.vercel.app/' apre Safari
  apri: 'webapp://comperotto.vercel.app/',
};
// ============================================================================

// iPhone piccoli (SE e simili, schermo alto meno di 700 punti): i widget sono più bassi, una riga in meno
const PICCOLO = (() => { try { return !Device.isPad() && Device.screenSize().height < 700; } catch (e) { return false; } })();

const CHIAVE = 'comperotto.codice';
const ARCHIVIO = 'comperotto-widget.json';
const LOGO = 'comperotto-icona.png';
const TOCCO = CONFIG.comando.trim() ? `shortcuts://run-shortcut?name=${encodeURIComponent(CONFIG.comando.trim())}` : CONFIG.apri;

// I colori arrivano dal sito (api/_widget.js: quelli dell'app, o della festa di oggi). Questi sono quelli di casa,
// per quando il sito non risponde.
const TEMA_CASA = {
  chiaro: { sfondo: '#FBF6F1', scheda: '#FFFDFB', testo: '#3D3430', testo2: '#776A60', testo3: '#8F8277', accento: '#9A5E31', accentoTenue: '#FDEBDB', verde: '#5E8A5B', verdeTenue: '#E4F2E0', rosso: '#C2614F' },
  scuro: { sfondo: '#1B1815', scheda: '#262220', testo: '#F2EBE2', testo2: '#C2B6A8', testo3: '#8C8074', accento: '#F2C9A3', accentoTenue: '#3A2C22', verde: '#9DB088', verdeTenue: '#2B3226', rosso: '#E08D78' },
  testata: null,
  bordo: null,
};
const C = (chiaro, scuro) => Color.dynamic(new Color(chiaro), new Color(scuro || chiaro));
function colori(t) {
  const out = {};
  Object.keys(TEMA_CASA.chiaro).forEach((k) => { out[k] = C((t.chiaro || {})[k] || TEMA_CASA.chiaro[k], (t.scuro || {})[k] || TEMA_CASA.scuro[k]); });
  return out;
}
let TEMA = TEMA_CASA;
let COLORI = colori(TEMA);

// i caratteri dell'app (Manrope) sono un bastoni moderno: qui il carattere di sistema, che gli somiglia
const F = {
  marchio: (n) => Font.heavySystemFont(n),
  forte: (n) => Font.boldSystemFont(n),
  semi: (n) => Font.semiboldSystemFont(n),
  medio: (n) => Font.mediumSystemFont(n),
  normale: (n) => Font.regularSystemFont(n),
};

// ----------------------------------------------------------------------------
// Dati: dal sito, con una copia sul telefono per quando la rete non c'è
// ----------------------------------------------------------------------------
const fm = FileManager.local();
const percorso = fm.joinPath(fm.documentsDirectory(), ARCHIVIO);
const percorsoLogo = fm.joinPath(fm.documentsDirectory(), LOGO);

function codiceSalvato() {
  if (CONFIG.codice.trim()) return CONFIG.codice.trim();
  return Keychain.contains(CHIAVE) ? Keychain.get(CHIAVE) : '';
}

async function chiediCodice(messaggio) {
  const a = new Alert();
  a.title = 'Codice di famiglia';
  a.message = messaggio || 'Lo stesso che usate per entrare nell’app di casa. Resta solo su questo iPhone.';
  a.addSecureTextField('Codice', '');
  a.addAction('Salva');
  a.addCancelAction('Annulla');
  if ((await a.presentAlert()) === -1) return '';
  const c = a.textFieldValue(0).trim();
  if (c) Keychain.set(CHIAVE, c);
  return c;
}

async function scarica(codice) {
  const r = new Request(`${CONFIG.indirizzo}/api/dati?widget=1`);
  r.headers = { 'x-famiglia': codice, Accept: 'application/json' };
  r.timeoutInterval = 12;
  let json = null;
  try { json = await r.loadJSON(); } catch (e) { json = null; }
  const stato = r.response ? r.response.statusCode : 0;
  if (stato === 401) throw Object.assign(new Error('Codice di famiglia sbagliato'), { codice: true });
  if (stato === 429) throw new Error('Troppi tentativi: riprova tra un quarto d’ora');
  if (!stato) throw new Error('Niente rete');
  if (stato >= 400 || !json || !json.spesa) throw new Error((json && json.error) || 'Il sito non risponde');
  return json;
}

function copia() {
  try { return fm.fileExists(percorso) ? JSON.parse(fm.readString(percorso)) : null; } catch (e) { return null; }
}

/** L'icona dell'app (scaricata una volta e tenuta sul telefono). */
async function logo() {
  try { if (fm.fileExists(percorsoLogo)) return fm.readImage(percorsoLogo); } catch (e) { /* la riscarico */ }
  try {
    const r = new Request(`${CONFIG.indirizzo}/assets/icons/icon-192.png`);
    r.timeoutInterval = 8;
    const img = await r.loadImage();
    fm.writeImage(percorsoLogo, img);
    return img;
  } catch (e) { return null; }
}

// ----------------------------------------------------------------------------
// Pezzi del widget
// ----------------------------------------------------------------------------
function testo(st, t, font, colore, righe = 1) {
  const x = st.addText(String(t));
  x.font = font;
  x.textColor = colore;
  x.lineLimit = righe;
  x.minimumScaleFactor = 0.75;
  return x;
}

function simbolo(st, nome, colore, lato) {
  const s = SFSymbol.named(nome);
  if (!s) return null;
  s.applyFont(Font.semiboldSystemFont(lato));
  const img = st.addImage(s.image);
  img.imageSize = new Size(lato + 2, lato + 2);
  img.tintColor = colore;
  return img;
}

function riga(st, spazio = 5) {
  const r = st.addStack();
  r.layoutHorizontally();
  r.centerAlignContent();
  r.spacing = spazio;
  return r;
}

/** Un testo da solo, allineato a sinistra (nelle pile verticali il testo da solo andrebbe al centro). */
function rigaTesto(st, t, font, colore, righe = 1) {
  const r = riga(st);
  testo(r, t, font, colore, righe);
  r.addSpacer();
  return r;
}

function pallino(st, colore, lato = 8) {
  const p = st.addStack();
  p.size = new Size(lato, lato);
  p.cornerRadius = lato / 2;
  p.backgroundColor = colore;
  return p;
}

/** Il titolo di una parte: icona, nome e il numero in una pillola. */
function testa(st, icona, titolo, numero, colore, tenue, dim) {
  const r = riga(st, 5);
  simbolo(r, icona, colore, dim - 1);
  testo(r, titolo, F.forte(dim), COLORI.testo);
  r.addSpacer();
  if (numero !== null && numero !== undefined) {
    const chip = r.addStack();
    chip.setPadding(1, 7, 1, 7);
    chip.cornerRadius = 9;
    chip.backgroundColor = tenue;
    testo(chip, String(numero), F.forte(dim - 2), colore);
  }
  return r;
}

function rigaSpesa(st, v, dim) {
  const r = riga(st, 5);
  testo(r, v.emoji || '•', Font.systemFont(dim - 2), COLORI.testo);
  testo(r, v.nome, F.normale(dim), COLORI.testo);
  if (v.qta) testo(r, v.qta, F.medio(dim - 2), COLORI.testo3);
  r.addSpacer();
}

function rigaFaccenda(st, v, dim) {
  const r = riga(st, 6);
  pallino(r, v.ritardo ? COLORI.rosso : COLORI.accento);
  testo(r, v.nome, F.normale(dim), COLORI.testo);
  // in ritardo: corto, in rosso ("da ieri", "da 3 gg"), così il nome resta leggibile
  if (v.ritardo) testo(r, String(v.quando).replace(/^in ritardo di (\d+) gg$/, 'da $1 gg'), F.medio(dim - 2), COLORI.rosso);
  r.addSpacer();
}

function rigaRifiuti(st, rif, dim) {
  if (!rif || !rif.stasera || !rif.stasera.length) return false;
  const r = riga(st, 5);
  if (rif.fatto) {
    simbolo(r, 'checkmark.circle.fill', COLORI.verde, dim - 1);
    testo(r, `Rifiuti fuori${rif.da ? ` · ${rif.da}` : ''}`, F.medio(dim - 1), COLORI.verde);
  } else {
    simbolo(r, 'trash', COLORI.testo2, dim - 1);
    testo(r, `Stasera: ${rif.stasera.join(', ')}`, F.medio(dim - 1), COLORI.testo2);
  }
  r.addSpacer();
  return true;
}

function altre(st, n, parola, dim) {
  if (n > 0) rigaTesto(st, `e ${parola} ${n}`, F.medio(dim - 2), COLORI.testo3);
}

/** La spesa: fino a `righe` prodotti, in una o più colonne. */
function parteSpesa(st, d, righe, dim, colonne = 1) {
  const s = d.spesa;
  testa(st, 'cart.fill', 'Spesa', s.n, COLORI.accento, COLORI.accentoTenue, dim + 1);
  st.addSpacer(4);
  if (!s.n) { rigaTesto(st, 'Lista vuota', F.normale(dim), COLORI.testo3); return; }
  const posto = righe * colonne;
  const quante = s.n > posto ? Math.max(posto - 1, 1) : s.n; // l'ultima riga dice quante ne restano
  const voci = s.voci.slice(0, quante);
  if (colonne === 1) {
    const col = st.addStack(); col.layoutVertically(); col.spacing = 2;
    voci.forEach((v) => rigaSpesa(col, v, dim));
    if (posto > quante) altre(col, s.n - voci.length, 'altre', dim); // con una riga sola basta la pillola
    return;
  }
  const insieme = st.addStack(); insieme.layoutHorizontally(); insieme.spacing = 10; insieme.topAlignContent();
  for (let c = 0; c < colonne; c++) {
    const col = insieme.addStack(); col.layoutVertically(); col.spacing = 2;
    voci.slice(c * righe, (c + 1) * righe).forEach((v) => rigaSpesa(col, v, dim));
    if (c === colonne - 1) altre(col, s.n - voci.length, 'altre', dim);
  }
}

/** Oggi in casa: le faccende da fare (prima quelle in ritardo) e i rifiuti di stasera. */
function parteOggi(st, d, righe, dim, titolo = 'Oggi in casa') {
  const f = d.faccende;
  testa(st, 'checklist', titolo, f.n, COLORI.verde, COLORI.verdeTenue, dim + 1);
  st.addSpacer(4);
  const col = st.addStack(); col.layoutVertically(); col.spacing = 2;
  const conRifiuti = Boolean(d.rifiuti && d.rifiuti.stasera && d.rifiuti.stasera.length);
  const posto = Math.max(righe - (conRifiuti ? 1 : 0), 1);
  if (!f.n) {
    rigaTesto(col, 'Tutto fatto, bravissimi!', F.normale(dim), COLORI.testo3);
  } else {
    // se non c'è posto per tutte, l'ultima riga dice quante ne restano (il numero totale è nella pillola)
    const quante = f.n > posto ? Math.max(posto - 1, 1) : f.n;
    f.voci.slice(0, quante).forEach((v) => rigaFaccenda(col, v, dim));
    if (posto > quante) altre(col, f.n - quante, 'altre', dim);
  }
  rigaRifiuti(col, d.rifiuti, dim);
}

const DF = new DateFormatter();
DF.locale = 'it_IT';
function quando(t) {
  const d = new Date(t);
  DF.dateFormat = new Date().toDateString() === d.toDateString() ? 'HH:mm' : 'd MMM, HH:mm';
  return DF.string(d);
}

// ----------------------------------------------------------------------------
// La testata, come in cima alla Home dell'app: logo e «FAM. COMPEROTTO»; nelle feste a colori pieni,
// con il bordo della festa (strisce o sfumatura) e la sua faccina. A destra l'ora dell'aggiornamento.
// ----------------------------------------------------------------------------
function sfumatura(colori, angolo = 180) {
  const g = new LinearGradient();
  g.colors = colori.map(([c]) => new Color(c));
  g.locations = colori.map(([, p]) => p);
  const r = (angolo * Math.PI) / 180, dx = Math.sin(r), dy = -Math.cos(r);
  g.startPoint = new Point(0.5 - dx / 2, 0.5 - dy / 2);
  g.endPoint = new Point(0.5 + dx / 2, 0.5 + dy / 2);
  return g;
}

/** Il bordo sotto la testata: strisce dei colori della festa, o una sfumatura (Capodanno, anniversario). */
function bordo(w, b, alto) {
  if (!b) return;
  const e = w.addStack();
  e.size = new Size(0, alto);
  e.addSpacer();
  let colori;
  if (b.strisce) {
    const n = 26;
    colori = [];
    for (let k = 0; k < n; k++) {
      const c = b.strisce[k % b.strisce.length];
      colori.push([c, k / n], [c, (k + 1) / n]);
    }
  } else {
    colori = b.sfumatura.map((c, k, a) => [c, k / (a.length - 1)]);
  }
  e.backgroundGradient = sfumatura(colori, 90);
}

function testata(w, d, misura, errore, img) {
  const t = TEMA.testata;
  const piccolo = misura === 'small';
  const lato = misura === 'large' || misura === 'extraLarge' ? 21 : 18;
  const r = w.addStack();
  r.layoutHorizontally();
  r.centerAlignContent();
  r.spacing = 6;
  r.setPadding(t ? 7 : 11, 14, t ? 7 : 1, 14);
  if (t) r.backgroundGradient = sfumatura(t.colori, t.angolo);
  const marchio = t ? new Color(t.marchio) : COLORI.accento;
  if (img) {
    const i = r.addImage(img);
    i.imageSize = new Size(lato, lato);
    i.cornerRadius = lato * 0.3;
  } else {
    simbolo(r, 'house.fill', marchio, lato - 3);
  }
  testo(r, piccolo ? 'CASA' : 'FAM. COMPEROTTO', F.marchio(piccolo ? 12 : 12.5), marchio);
  if (d && d.tema && d.tema.emoji) testo(r, d.tema.emoji, Font.systemFont(piccolo ? 12 : 13), marchio);
  r.addSpacer();
  if (d && d.at) {
    const colore = errore ? (t ? new Color(t.evidenza) : COLORI.rosso) : t ? new Color(t.testo, 0.8) : COLORI.testo3;
    testo(r, `${errore ? '⚠︎ ' : ''}${quando(d.at)}`, F.medio(11), colore);
  }
  bordo(w, TEMA.bordo, misura === 'large' || misura === 'extraLarge' ? 4 : 3);
}

/** Il corpo del widget, sotto la testata, con i suoi margini. */
function corpo(w, sopra, lati = 14, sotto = 10) {
  const b = w.addStack();
  b.layoutVertically();
  b.setPadding(sopra, lati, sotto, lati);
  return b;
}

// ----------------------------------------------------------------------------
// Il widget, per ogni misura
// ----------------------------------------------------------------------------
function messaggio(w, titolo, sotto) {
  const b = corpo(w, 10);
  rigaTesto(b, titolo, F.semi(13), COLORI.testo, 3);
  b.addSpacer(4);
  rigaTesto(b, sotto, F.normale(11), COLORI.testo2, 4);
  w.addSpacer();
}

function disegna(d, misura, parte, errore, img) {
  const w = new ListWidget();
  w.backgroundColor = COLORI.sfondo;
  w.url = TOCCO;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60000);

  // schermata di blocco (widget piccoli, in tinta con il sistema)
  if (misura === 'accessoryInline') {
    testo(w, d ? `Spesa ${d.spesa.n} · Oggi ${d.faccende.n}` : 'Casa', F.medio(12), COLORI.testo);
    return w;
  }
  if (misura === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    const r = riga(w);
    r.addSpacer();
    const col = r.addStack(); col.layoutVertically(); col.centerAlignContent();
    simbolo(col, parte === 'faccende' ? 'checklist' : 'cart.fill', COLORI.testo, 11);
    testo(col, d ? String(parte === 'faccende' ? d.faccende.n : d.spesa.n) : '–', F.forte(18), COLORI.testo);
    r.addSpacer();
    return w;
  }
  if (misura === 'accessoryRectangular') {
    if (!d) { rigaTesto(w, 'Casa: apri Scriptable', F.medio(12), COLORI.testo, 2); return w; }
    const r1 = riga(w, 4);
    simbolo(r1, 'cart.fill', COLORI.testo, 11);
    testo(r1, `Spesa ${d.spesa.n}`, F.semi(13), COLORI.testo);
    r1.addSpacer();
    rigaTesto(w, d.spesa.voci.slice(0, 4).map((v) => v.nome).join(', ') || 'Lista vuota', F.normale(12), COLORI.testo);
    const r2 = riga(w, 4);
    simbolo(r2, 'checklist', COLORI.testo, 11);
    testo(r2, d.faccende.n ? `Oggi ${d.faccende.n}: ${d.faccende.voci.map((v) => v.nome).join(', ')}` : 'Oggi: tutto fatto', F.normale(12), COLORI.testo);
    r2.addSpacer();
    return w;
  }

  w.setPadding(0, 0, 0, 0);
  testata(w, d, misura, errore, img);

  if (!d) {
    w.url = URLScheme.forRunningScript(); // senza dati: il tocco apre lo script, che chiede il codice
    if (errore && errore.codice) messaggio(w, 'Codice di famiglia sbagliato', 'Tocca qui per scriverlo di nuovo.');
    else if (errore) messaggio(w, 'Non riesco a leggere i dati', `${errore.message}. Riprovo tra poco.`);
    else messaggio(w, 'Manca il codice di famiglia', 'Tocca qui: Scriptable ti chiede il codice, poi il widget si riempie.');
    return w;
  }

  // quante righe ci stanno: caratteri grandi (14 punti, 15 nel grande) e, sugli iPhone piccoli, una riga in meno
  const meno = PICCOLO ? 1 : 0;
  if (misura === 'small') {
    const b = corpo(w, 7, 14, 6);
    if (parte === 'spesa') parteSpesa(b, d, 4 - meno, 14);
    else if (parte === 'faccende') parteOggi(b, d, 4 - meno, 14, 'Oggi');
    else {
      // poco posto: della spesa il primo prodotto (quanti sono lo dice la pillola), delle faccende fino a due righe
      parteSpesa(b, d, 1, 14);
      b.addSpacer(5);
      parteOggi(b, d, 2 - meno, 14, 'Oggi');
    }
    w.addSpacer();
    return w;
  }

  if (misura === 'medium') {
    const b = corpo(w, 7, 16, 6);
    const righe = 4 - meno;
    if (parte === 'spesa') parteSpesa(b, d, righe, 14, 2);
    else if (parte === 'faccende') parteOggi(b, d, righe, 14);
    else {
      const due = b.addStack(); due.layoutHorizontally(); due.topAlignContent(); due.spacing = 14;
      const sx = due.addStack(); sx.layoutVertically();
      parteSpesa(sx, d, righe, 14);
      const dx = due.addStack(); dx.layoutVertically();
      parteOggi(dx, d, righe, 14);
    }
    w.addSpacer();
    return w;
  }

  // grande (e quello extra grande dell'iPad)
  const extra = misura === 'extraLarge';
  const b = corpo(w, 11, 16, 10);
  if (parte === 'spesa') parteSpesa(b, d, 11 - meno, 15, extra ? 3 : 2);
  else if (parte === 'faccende') parteOggi(b, d, 11 - meno, 15);
  else {
    parteSpesa(b, d, 6 - meno, 15, extra ? 3 : 2);
    b.addSpacer(11);
    parteOggi(b, d, 6 - meno, 15);
  }
  w.addSpacer();
  return w;
}

// ----------------------------------------------------------------------------
// Avvio: nel widget si disegna e basta; dentro Scriptable si sceglie cosa fare
// ----------------------------------------------------------------------------
const parte = String(args.widgetParameter || '').trim().toLowerCase();
let codice = codiceSalvato();
if (!codice && config.runsInApp) codice = await chiediCodice();

let dati = null, errore = null;
if (codice) {
  try {
    dati = await scarica(codice);
    fm.writeString(percorso, JSON.stringify(dati));
  } catch (e) {
    errore = e;
    if (e.codice && config.runsInApp) {
      codice = await chiediCodice('Codice sbagliato: riprova.');
      if (codice) {
        try { dati = await scarica(codice); errore = null; fm.writeString(percorso, JSON.stringify(dati)); } catch (e2) { errore = e2; }
      }
    }
    if (!dati && !(errore && errore.codice)) dati = copia(); // senza rete: l'ultima copia, con l'avviso
  }
}
// i colori: quelli che manda il sito (dell'app o della festa di oggi)
if (dati && dati.tema && dati.tema.chiaro) { TEMA = dati.tema; COLORI = colori(TEMA); }
const icona = config.runsInAccessoryWidget ? null : await logo();

if (config.runsInWidget || config.runsInAccessoryWidget) {
  Script.setWidget(disegna(dati, config.widgetFamily || 'medium', parte, errore, icona));
} else {
  const a = new Alert();
  a.title = 'Il widget di casa';
  a.message = dati
    ? `Spesa: ${dati.spesa.n} da comprare · Oggi: ${dati.faccende.n} da fare${errore ? `\n(${errore.message}: è l’ultima copia)` : ''}`
    : errore ? errore.message : 'Manca il codice di famiglia';
  ['Anteprima piccolo', 'Anteprima medio', 'Anteprima grande'].forEach((t) => a.addAction(t));
  a.addAction('Prova ad aprire l’app di casa');
  a.addDestructiveAction('Cambia il codice di famiglia');
  a.addCancelAction('Chiudi');
  const scelta = await a.presentSheet();
  if (scelta === 0) await disegna(dati, 'small', parte, errore, icona).presentSmall();
  if (scelta === 1) await disegna(dati, 'medium', parte, errore, icona).presentMedium();
  if (scelta === 2) await disegna(dati, 'large', parte, errore, icona).presentLarge();
  if (scelta === 3) Safari.open(TOCCO);
  if (scelta === 4) {
    // quello vecchio resta finché non se ne scrive uno nuovo (Annulla non lo cancella)
    if (await chiediCodice()) {
      const ok = new Alert();
      ok.title = 'Fatto';
      ok.message = 'Il widget userà il codice nuovo al prossimo aggiornamento.';
      ok.addAction('OK');
      await ok.presentAlert();
    }
  }
}
Script.complete();
