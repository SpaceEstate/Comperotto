// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: home;

// ============================================================================
//  Fam. Comperotto — il widget di casa per la schermata Home (app Scriptable)
//  Mostra la spesa da comprare e le faccende di oggi (con i rifiuti di stasera).
//  Toccandolo si apre l'app di casa, quella con l'icona sulla schermata Home.
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
  // cosa si apre toccando il widget: l'app di casa della schermata Home, non Safari.
  // Se toccando il widget resta aperta Scriptable, questa versione di iOS non lo permette:
  // mettete 'https://comperotto.vercel.app/' (si apre in Safari).
  apri: 'webapp://comperotto.vercel.app/',
};
// ============================================================================

const CHIAVE = 'comperotto.codice';
const ARCHIVIO = 'comperotto-widget.json';

// i colori dell'app (chiaro e scuro, come la casa a pastello)
const C = (chiaro, scuro) => Color.dynamic(new Color(chiaro), new Color(scuro));
const COLORI = {
  sfondo: C('#FBF6F1', '#1B1815'),
  testo: C('#3D3430', '#F2EBE2'),
  testo2: C('#776A60', '#C2B6A8'),
  testo3: C('#8F8277', '#8C8074'),
  albicocca: C('#9A5E31', '#F2C9A3'),
  albicoccaTenue: C('#FDEBDB', '#3A2C22'),
  salvia: C('#5E8A5B', '#9DB088'),
  salviaTenue: C('#E4F2E0', '#2B3226'),
  rosa: C('#C2614F', '#E08D78'),
};
const F = {
  forte: (n) => Font.boldRoundedSystemFont(n),
  semi: (n) => Font.semiboldRoundedSystemFont(n),
  medio: (n) => Font.mediumRoundedSystemFont(n),
  normale: (n) => Font.regularRoundedSystemFont(n),
};

// ----------------------------------------------------------------------------
// Dati: dal sito, con una copia sul telefono per quando la rete non c'è
// ----------------------------------------------------------------------------
const fm = FileManager.local();
const percorso = fm.joinPath(fm.documentsDirectory(), ARCHIVIO);

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

function pallino(st, colore, lato = 7) {
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
  testo(r, titolo, F.semi(dim), COLORI.testo);
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
  pallino(r, v.ritardo ? COLORI.rosa : COLORI.albicocca);
  testo(r, v.nome, F.normale(dim), COLORI.testo);
  // in ritardo: corto, in rosa ("da ieri", "da 3 gg"), così il nome resta leggibile
  if (v.ritardo) testo(r, String(v.quando).replace(/^in ritardo di (\d+) gg$/, 'da $1 gg'), F.medio(dim - 2), COLORI.rosa);
  r.addSpacer();
}

function rigaRifiuti(st, rif, dim) {
  if (!rif || !rif.stasera || !rif.stasera.length) return false;
  const r = riga(st, 5);
  if (rif.fatto) {
    simbolo(r, 'checkmark.circle.fill', COLORI.salvia, dim - 1);
    testo(r, `Rifiuti fuori${rif.da ? ` · ${rif.da}` : ''}`, F.medio(dim - 1), COLORI.salvia);
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
  testa(st, 'cart.fill', 'Spesa', s.n, COLORI.albicocca, COLORI.albicoccaTenue, dim + 1);
  st.addSpacer(4);
  if (!s.n) { rigaTesto(st, 'Lista vuota', F.normale(dim), COLORI.testo3); return; }
  const posto = righe * colonne;
  const quante = s.n > posto ? Math.max(posto - 1, 1) : s.n; // l'ultima riga dice quante ne restano
  const voci = s.voci.slice(0, quante);
  if (colonne === 1) {
    const col = st.addStack(); col.layoutVertically(); col.spacing = 2;
    voci.forEach((v) => rigaSpesa(col, v, dim));
    altre(col, s.n - voci.length, 'altre', dim);
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
  testa(st, 'checklist', titolo, f.n, COLORI.salvia, COLORI.salviaTenue, dim + 1);
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

function piede(st, d, errore) {
  const r = riga(st, 4);
  r.addSpacer();
  if (errore) simbolo(r, 'exclamationmark.circle', COLORI.rosa, 9);
  testo(r, `${errore ? 'non aggiornato · ' : ''}${d && d.at ? quando(d.at) : ''}`, F.medio(9), errore ? COLORI.rosa : COLORI.testo3);
}

// ----------------------------------------------------------------------------
// Il widget, per ogni misura
// ----------------------------------------------------------------------------
function messaggio(w, titolo, sotto) {
  w.setPadding(14, 14, 14, 14);
  const r = riga(w, 6);
  simbolo(r, 'house.fill', COLORI.albicocca, 14);
  testo(r, 'Casa', F.semi(15), COLORI.testo);
  r.addSpacer();
  w.addSpacer(8);
  rigaTesto(w, titolo, F.semi(13), COLORI.testo, 3);
  w.addSpacer(4);
  rigaTesto(w, sotto, F.normale(11), COLORI.testo2, 4);
  w.addSpacer();
}

function disegna(d, misura, parte, errore) {
  const w = new ListWidget();
  w.backgroundColor = COLORI.sfondo;
  w.url = CONFIG.apri;
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

  if (!d) {
    w.url = URLScheme.forRunningScript(); // senza dati: il tocco apre lo script, che chiede il codice
    if (errore && errore.codice) messaggio(w, 'Codice di famiglia sbagliato', 'Tocca qui per scriverlo di nuovo.');
    else if (errore) messaggio(w, 'Non riesco a leggere i dati', `${errore.message}. Riprovo tra poco.`);
    else messaggio(w, 'Manca il codice di famiglia', 'Tocca qui: Scriptable ti chiede il codice, poi il widget si riempie.');
    return w;
  }

  if (misura === 'small') {
    w.setPadding(12, 14, 10, 14);
    if (parte === 'spesa') parteSpesa(w, d, 5, 12);
    else if (parte === 'faccende') parteOggi(w, d, 5, 12, 'Oggi');
    else {
      parteSpesa(w, d, 2, 12);
      w.addSpacer(6);
      parteOggi(w, d, 2, 12, 'Oggi');
    }
    w.addSpacer();
    piede(w, d, errore);
    return w;
  }

  if (misura === 'medium') {
    w.setPadding(14, 16, 10, 16);
    if (parte === 'spesa' || parte === 'faccende') {
      if (parte === 'spesa') parteSpesa(w, d, 5, 12, 2); else parteOggi(w, d, 5, 12);
    } else {
      const due = w.addStack(); due.layoutHorizontally(); due.topAlignContent(); due.spacing = 14;
      const sx = due.addStack(); sx.layoutVertically();
      parteSpesa(sx, d, 5, 12);
      const dx = due.addStack(); dx.layoutVertically();
      parteOggi(dx, d, 5, 12);
    }
    w.addSpacer();
    piede(w, d, errore);
    return w;
  }

  // grande (e quello extra grande dell'iPad)
  const extra = misura === 'extraLarge';
  w.setPadding(16, 16, 12, 16);
  const su = riga(w, 6);
  simbolo(su, 'house.fill', COLORI.albicocca, 12);
  testo(su, 'Fam. Comperotto', F.semi(12), COLORI.testo2);
  su.addSpacer();
  DF.dateFormat = 'EEEE d MMMM';
  testo(su, DF.string(new Date()), F.medio(11), COLORI.testo3);
  w.addSpacer(10);
  if (parte === 'spesa') parteSpesa(w, d, 13, 13, extra ? 3 : 2);
  else if (parte === 'faccende') parteOggi(w, d, 13, 13);
  else {
    parteSpesa(w, d, 7, 13, extra ? 3 : 2);
    w.addSpacer(12);
    parteOggi(w, d, 5, 13);
  }
  w.addSpacer();
  piede(w, d, errore);
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

if (config.runsInWidget || config.runsInAccessoryWidget) {
  Script.setWidget(disegna(dati, config.widgetFamily || 'medium', parte, errore));
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
  if (scelta === 0) await disegna(dati, 'small', parte, errore).presentSmall();
  if (scelta === 1) await disegna(dati, 'medium', parte, errore).presentMedium();
  if (scelta === 2) await disegna(dati, 'large', parte, errore).presentLarge();
  if (scelta === 3) Safari.open(CONFIG.apri);
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
