// Viaggi: le liste per la valigia (ciabatte, pantaloni…). Una lista per tipo di viaggio (Mare, Montagna,
// Weekend…): si spunta mentre si prepara la valigia e, al viaggio dopo, «Ricomincia» toglie le spunte.
// Liste nella raccolta "viaggi", le cose da portare in "valigia" (una per riga: si spuntano in due insieme).
// Dentro la lista le cose sono divise in sezioni (Giacche e felpe, Bagno…): vedi SEZIONI qui sotto.
import { html, raw, cap, norm, vibrate, uid } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { state, store, openSheet, closeSheet, toast, val, pageHead, emptyState, swipe, sheetError, confirmSheet, navigate } from '../core.js';

/** Da dove partire con una lista nuova. */
export const MODELLI = {
  vuota: { label: 'Vuota', icon: 'suitcase', voci: [] },
  weekend: { label: 'Weekend', icon: 'calendar', voci: ['Pigiama', 'Intimo', 'Calze', 'Magliette', 'Pantaloni', 'Felpa', 'Ciabatte', 'Spazzolino', 'Dentifricio', 'Deodorante', 'Caricabatterie', 'Documenti'] },
  mare: { label: 'Mare', icon: 'wave', voci: ['Costume', 'Ciabatte', 'Telo mare', 'Crema solare', 'Occhiali da sole', 'Cappello', 'Pantaloncini', 'Magliette', 'Intimo', 'Pigiama', 'Spazzolino', 'Dentifricio', 'Caricabatterie', 'Documenti'] },
  montagna: { label: 'Montagna', icon: 'leaf', voci: ['Scarponi', 'Giacca', 'Pile', 'Pantaloni lunghi', 'Calze pesanti', 'Berretto', 'Guanti', 'Borraccia', 'Zaino', 'Crema solare', 'Intimo', 'Pigiama', 'Spazzolino', 'Caricabatterie', 'Documenti'] },
};

const perData = (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id));
const liste = () => [...state.data.viaggi].filter((l) => l && l.nome).sort(perData);
const lista = (id) => state.data.viaggi.find((l) => l.id === id) || null;
const voci = (id) => state.data.valigia.filter((v) => v.lista === id).sort(perData);
const chiave = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Sezioni della valigia
// ---------------------------------------------------------------------------
// Nell'ordine in cui si prepara: i vestiti, le scarpe, il bagno, l'elettronica, i documenti. Ogni cosa va da sola
// nella sua sezione dal nome (come i reparti della spesa). Dal foglio «Modifica» la si sposta in un'altra o in una
// sezione nuova (es. «Sci»), e da lì in poi la stessa cosa, aggiunta in qualsiasi lista, va già lì.
// In "valigia" la sezione si salva solo se scelta a mano: `sezione` = l'id di una di queste o il nome di una nuova.
export const SEZIONI = [
  { id: 'giacche', emoji: '🧥', label: 'Giacche e felpe', color: '#9FC3D9' },
  { id: 'magliette', emoji: '👕', label: 'Magliette e camicie', color: '#A9C9A0' },
  { id: 'pantaloni', emoji: '👖', label: 'Pantaloni e gonne', color: '#8FB9D8' },
  { id: 'intimo', emoji: '🧦', label: 'Intimo e pigiama', color: '#D9A7B5' },
  { id: 'scarpe', emoji: '👟', label: 'Scarpe', color: '#CFA57A' },
  { id: 'accessori', emoji: '🧢', label: 'Accessori', color: '#E9C38A' },
  { id: 'mare', emoji: '🏖️', label: 'Mare', color: '#9CC9E6' },
  { id: 'bagno', emoji: '🧴', label: 'Bagno', color: '#E5AFC4' },
  { id: 'tech', emoji: '🔌', label: 'Elettronica', color: '#C5B3DE' },
  { id: 'documenti', emoji: '🪪', label: 'Documenti', color: '#B7C99A' },
  { id: 'altro', emoji: '🧳', label: 'Altro', color: '#C9C0B6' },
];
const COLORI_MIE = ['#E3B49B', '#B7C99A', '#D7C08F', '#C5B3DE', '#9FC3D9', '#D9A7B5', '#A9C9A0', '#E9C38A'];

// Parole che fanno capire la sezione (separate da virgola; vanno bene anche più parole: vincono le più lunghe)
const KW = {
  giacche: `giacca, giacche, giacchetta, giacchetto, giacca a vento, giubbotto, giubbotti, giubbino, giubbini, piumino, piumini,
    cappotto, cappotti, impermeabile, k way, kway, antipioggia, mantella, cerata, softshell, blazer, felpa, felpe, felpina, pile,
    maglione, maglioni, maglioncino, cardigan, gilet, smanicato, golf, golfino, dolcevita`,
  magliette: `maglietta, magliette, maglia, maglie, t shirt, tshirt, canottiera, canottiere, canotta, canotte, camicia, camicie,
    camicetta, camicette, polo, top, body, maglia termica, maglie termiche, maglietta termica`,
  pantaloni: `pantaloni, pantalone, pantaloncini, pantaloncino, jeans, shorts, short, bermuda, gonna, gonne, gonnellina, leggings,
    leggins, tuta, tute, salopette, fuseaux, vestito, vestitino, vestiti eleganti, abito, abiti, completo`,
  intimo: `intimo, intimo termico, mutande, mutandine, boxer, slip, perizoma, reggiseno, reggiseni, calze, calzini, calzettoni,
    calze pesanti, collant, calzamaglia, pigiama, pigiami, camicia da notte, vestaglia`,
  scarpe: `scarpe, scarpa, scarpette, scarpe da ginnastica, scarponi, scarponcini, scarponcino, sneakers, ciabatte, ciabatta,
    ciabattine, infradito, sandali, sandalo, stivali, stivaletti, stivale, mocassini, decollete, tacchi, pantofole, crocs,
    doposci, espadrillas, ballerine, anfibi, scarpette da scoglio`,
  accessori: `cappello, cappelli, cappellino, berretto, berretta, cuffia, sciarpa, sciarpe, scaldacollo, guanti, guanto, cintura,
    cinture, occhiali, occhiali da sole, borsa, borse, borsetta, zaino, zaini, zainetto, marsupio, ombrello, orologio, gioielli,
    orecchini, collana, bracciale, anelli, borraccia, foulard, bandana, pochette, maschera da sci, maschera sci, casco`,
  mare: `costume, costumi, costume da bagno, bikini, telo mare, teli mare, telo, teli, telo da spiaggia, asciugamano da spiaggia,
    asciugamano mare, maschera, boccaglio, pinne, cuffia piscina, cuffia da piscina, occhialini, borsa mare, borsa frigo,
    ombrellone, sdraio, materassino, braccioli, secchiello, racchettoni, pareo, parei, copricostume`,
  bagno: `spazzolino, spazzolini, spazzolino elettrico, dentifricio, filo interdentale, collutorio, deodorante, shampoo, balsamo,
    bagnoschiuma, docciaschiuma, sapone, saponetta, crema, creme, crema viso, crema corpo, crema mani, crema solare, solare,
    doposole, protezione solare, rasoio, rasoi, lamette, schiuma da barba, dopobarba, pettine, spazzola, phon, fon,
    asciugacapelli, piastra, arricciacapelli, elastici, mollette, forcine, trucchi, trucco, make up, mascara, rossetto,
    fondotinta, struccante, dischetti, cotton fioc, profumo, lenti a contatto, liquido lenti, assorbenti, salvaslip, tamponi,
    pinzetta, forbicine, tagliaunghie, smalto, salviette, salviettine, beauty, beauty case, necessaire, trousse, accappatoio,
    asciugamano, asciugamani, medicine, medicinali, farmaci, pastiglie, tachipirina, oki, moment, aspirina, antistaminico,
    cerotti, termometro, disinfettante, repellente, antizanzare, autan, gel, gel capelli, lacca, burrocacao, balsamo labbra,
    igienizzante, mascherine, maschera viso, carta igienica, fazzoletti`,
  tech: `caricabatterie, caricabatteria, caricatore, caricatori, cavo, cavi, cavetto, cavo usb, power bank, powerbank,
    batteria esterna, cuffie, cuffiette, auricolari, airpods, telefono, cellulare, iphone, ipad, tablet, computer, pc,
    portatile, mac, macbook, kindle, ebook, e reader, macchina fotografica, fotocamera, gopro, adattatore, adattatore presa,
    presa, prese, ciabatta elettrica, multipresa, apple watch, smartwatch, console, playstation, chiavetta, hard disk, mouse`,
  documenti: `documenti, documento, carta d identita, carta di identita, carta identita, passaporto, passaporti, patente, tessera,
    tessera sanitaria, codice fiscale, biglietti, biglietto, carta d imbarco, carte d imbarco, boarding pass, prenotazione,
    prenotazioni, voucher, portafoglio, portafogli, soldi, contanti, bancomat, carta di credito, carte, chiavi, chiave,
    chiavi di casa, chiavi della macchina, assicurazione, libretto`,
  altro: `carte da gioco, libro, libri, giochi, cuscino, sacco a pelo`,
};

const parole = (s) => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const KW_LIST = Object.entries(KW)
  .flatMap(([id, s]) => s.split(',').map(parole).filter(Boolean).map((w) => [w, id]))
  .sort((a, b) => b[0].length - a[0].length);

/** Indovina la sezione dal nome: conta di più la prima parola ("crema solare" → bagno, "borsa mare" → mare). */
export function indovinaSezione(nome) {
  const t = parole(nome);
  const words = t.split(' ');
  let best = null;
  for (const [kw, id] of KW_LIST) {
    let pos = -1;
    if (kw.includes(' ')) {
      const i = (' ' + t + ' ').indexOf(' ' + kw + ' ');
      if (i >= 0) pos = t.slice(0, i).split(' ').filter(Boolean).length;
    } else {
      pos = words.findIndex((w) => (kw.length <= 3 ? w === kw : w === kw || (w.startsWith(kw) && w.length - kw.length <= 2)));
    }
    if (pos < 0) continue;
    if (!best || pos < best.pos || (pos === best.pos && kw.length > best.len)) best = { pos, len: kw.length, id };
  }
  return best ? best.id : 'altro';
}

// Un nome scritto a mano che è una delle nostre sezioni ("bagno", "Giacche/felpe") porta lì, non a una sezione nuova
const corto = (s) => parole(s).split(' ').filter((w) => !['e', 'ed', 'di', 'da', 'per', 'il', 'la', 'le', 'i', 'gli', 'lo'].includes(w)).join(' ');
const BASE = new Map(SEZIONI.map((s) => [s.id, s]));
const PER_NOME = new Map(SEZIONI.flatMap((s) => [[corto(s.id), s.id], [corto(s.label), s.id]]));
PER_NOME.set('elettronica', 'tech').set('tecnologia', 'tech').set('beauty', 'bagno').set('beauty case', 'bagno').set('necessaire', 'bagno');

/** La chiave di una sezione salvata: l'id di una delle nostre, oppure "c:nome" per una sezione nuova. */
function chiaveSezione(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (BASE.has(t)) return t;
  const c = corto(t);
  return PER_NOME.get(c) || `c:${c || parole(t) || chiave(t)}`;
}

/** In che sezione sta una cosa (chiave). */
const sezioneDi = (v) => (v.sezione && chiaveSezione(v.sezione)) || indovinaSezione(v.nome);

/** Le sezioni nuove (fatte da voi), da tutte le liste: chiave → nome come è stato scritto la prima volta. */
function sezioniMie() {
  const mie = new Map();
  [...state.data.valigia].sort(perData).forEach((v) => {
    const k = v.sezione ? chiaveSezione(v.sezione) : '';
    if (k.startsWith('c:') && !mie.has(k)) mie.set(k, cap(String(v.sezione).trim()));
  });
  return mie;
}

/** Nome, faccina e colore di una sezione (anche di una nuova). */
function infoSezione(k, mie = sezioniMie()) {
  if (BASE.has(k)) return BASE.get(k);
  const i = [...mie.keys()].indexOf(k);
  return { id: k, emoji: '🏷️', label: mie.get(k) || cap(k.slice(2)), color: COLORI_MIE[Math.max(0, i) % COLORI_MIE.length] };
}

/** Cosa salvare in `sezione` per quella chiave: l'id, o il nome della sezione nuova. */
const valoreSezione = (k, mie = sezioniMie()) => (BASE.has(k) ? k : mie.get(k) || cap(k.slice(2)));

/** Tutte le sezioni nell'ordine della pagina: le nostre, poi le vostre, «Altro» in fondo. */
function ordineSezioni(mie = sezioniMie()) {
  return [...SEZIONI.filter((s) => s.id !== 'altro').map((s) => s.id), ...mie.keys(), 'altro'];
}

/** Le cose divise per sezione (solo le sezioni con qualcosa dentro). */
function perSezione(cose) {
  const mie = sezioniMie();
  const gruppi = new Map(ordineSezioni(mie).map((k) => [k, []]));
  cose.forEach((v) => {
    const k = sezioneDi(v);
    (gruppi.get(k) || gruppi.get('altro')).push(v);
  });
  return [...gruppi].filter(([, d]) => d.length).map(([k, d]) => ({ ...infoSezione(k, mie), key: k, valore: valoreSezione(k, mie), cose: d }));
}

/** La sezione scelta a mano per la stessa cosa (in qualsiasi lista), la più recente: la volta dopo va già lì. */
function imparata(nome) {
  const k = chiave(nome);
  let best = null;
  state.data.valigia.forEach((v) => {
    if (v.sezione && chiave(v.nome) === k && (!best || (v.sezioneAt || 0) > (best.sezioneAt || 0))) best = v;
  });
  return best ? { sezione: best.sezione, sezioneAt: best.sezioneAt || Date.now() } : {};
}

/** Quante cose ci sono e quante sono già in valigia. */
export function stato(id) {
  const v = voci(id);
  return { tot: v.length, fatte: v.filter((x) => x.fatto).length };
}

/** La scheda di una lista (pagina Viaggi e Home). */
export function card(l) {
  const { tot, fatte } = stato(l.id);
  const pct = tot ? Math.round((fatte / tot) * 100) : 0;
  return html`<a class="vg-card ${tot && fatte === tot ? 'pronta' : ''}" href="#/viaggi/${l.id}">
    <span class="vg-ico">${icon(l.icona || 'suitcase')}</span>
    <span class="vg-t"><b>${l.nome}</b><span>${tot ? (fatte === tot ? 'Valigia pronta!' : `${fatte} di ${tot} in valigia`) : 'Lista vuota'}</span></span>
    <i class="vg-bar" aria-hidden="true"><i style="width:${pct}%"></i></i>
  </a>`;
}

/** La sezione della Home: le liste (o l'invito a crearne una). */
export function sezioneHome() {
  const l = liste();
  return html`<section class="vg-home">
    <div class="section-title"><span>${icon('suitcase', 'xs')} Viaggi</span>${l.length ? html`<a class="card-link" href="#/viaggi">Tutte ${icon('right', 'xs')}</a>` : ''}</div>
    ${l.length ? html`<div class="vg-rail">${l.slice(0, 6).map(card)}
        <button class="vg-card add" type="button" data-action="vg-nuova"><span class="vg-ico">${icon('plus')}</span><span class="vg-t"><b>Nuova lista</b><span>Mare, montagna…</span></span></button></div>`
      : html`<button class="card vg-invito" type="button" data-action="vg-nuova"><span class="vg-ico">${icon('suitcase')}</span>
        <span class="vg-t"><b>Prepara la valigia</b><span>Crea la lista delle cose da portare (ciabatte, pantaloni…) e spunta mentre la prepari.</span></span>${icon('plus', 'sm')}</button>`}
  </section>`;
}

function riga(v) {
  return html`<div class="row ${v.fatto ? 'done' : ''}" id="v-${v.id}"${swipe(v.id, ['vg-toggle', v.fatto ? 'Togli' : 'In valigia'], ['vg-del', 'Elimina'])}>
    <button class="check ${v.fatto ? 'on' : ''}" data-action="vg-toggle" data-id="${v.id}" aria-label="${v.fatto ? 'Togli dalla valigia' : 'In valigia'}: ${v.nome}">${icon('check')}</button>
    <button class="row-edit" data-action="vg-edit" data-id="${v.id}"><div class="row-title">${v.nome}</div>${v.nota ? html`<div class="row-sub">${v.nota}</div>` : ''}</button>
  </div>`;
}

function pagina(id) {
  const l = lista(id);
  const back = html`<a class="back-link" href="#/viaggi">${icon('left', 'sm')} Viaggi</a>`;
  if (!l) return html`${back}${emptyState('Lista non trovata', 'Forse è stata eliminata.', catFace('b'))}`;
  const tutte = voci(id);
  const da = tutte.filter((v) => !v.fatto);
  const fatte = tutte.filter((v) => v.fatto);
  const pct = tutte.length ? Math.round((fatte.length / tutte.length) * 100) : 0;
  return html`${back}
    ${pageHead(l.nome, { eyebrow: tutte.length ? (da.length ? `${fatte.length} di ${tutte.length} in valigia` : 'Valigia pronta!') : 'Lista per la valigia', actions: html`<button class="icon-btn" data-action="vg-menu" data-id="${id}" aria-label="Modifica la lista">${icon('dots')}</button>` })}
    ${tutte.length ? html`<div class="shop-progress solo" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${fatte.length} di ${tutte.length} in valigia"><i class="bar"><i style="width:${pct}%"></i></i></div>` : ''}
    <form class="quick-add" data-form="vg-add" data-id="${id}">
      <input id="vg-input" name="q" placeholder="Aggiungi… (es. ciabatte, pantaloni)" enterkeyhint="done" autocomplete="off" aria-label="Aggiungi alla lista">
      <button type="submit" aria-label="Aggiungi">${icon('plus')}</button>
    </form>
    ${da.length ? html`<div class="shop-groups vg-sezioni">${perSezione(da).map((g) => html`<section class="shop-group">
        <div class="cat-head" style="--c:${g.color}"><span class="cat-emo" aria-hidden="true">${g.emoji}</span>${g.label}<span class="cat-n">${g.cose.length}</span>
          <button class="cat-add" type="button" data-action="vg-add-sez" data-id="${id}" data-sez="${g.key}" aria-label="Aggiungi in ${g.label}">${icon('plus', 'xs')}</button></div>
        <div class="list">${g.cose.map(riga)}</div>
      </section>`)}</div>`
      : tutte.length ? emptyState('Tutto in valigia!', 'Buon viaggio ♡', catFace('a'))
      : emptyState('Lista vuota', 'Scrivi qui sopra cosa portare, anche più cose separate da virgole: ognuna va da sola nella sua sezione (Giacche e felpe, Bagno…).', catFace('b'))}
    ${fatte.length ? html`<div class="section-title"><span>In valigia · ${fatte.length}</span><button class="card-link" data-action="vg-ricomincia" data-id="${id}">Ricomincia</button></div>
      <div class="list">${fatte.map(riga)}</div>` : ''}`;
}

export function render(r = []) {
  if (r[1]) return pagina(r[1]);
  const l = liste();
  return html`<a class="back-link phone-only" href="#/">${icon('left', 'sm')} Home</a>
    ${pageHead('Viaggi', { eyebrow: 'Le liste per la valigia' })}
    ${l.length ? html`<div class="vg-grid">${l.map(card)}</div>`
      : emptyState('Nessuna lista', 'Crea la lista per la valigia (mare, montagna, weekend…) e spunta le cose mentre la prepari.', catFace('a'))}
    <button class="fab" data-action="vg-nuova">${icon('plus')} Lista</button>`;
}

// ---------------------------------------------------------------------------
// Fogli e azioni
// ---------------------------------------------------------------------------
/** Una cosa nuova nella lista: nella sezione scelta, o in quella scelta a mano le altre volte, o indovinata dal nome. */
function nuovaVoce(lista, nome, i = 0, extra = {}) {
  const sez = extra.sezione ? { sezione: extra.sezione, sezioneAt: extra.sezioneAt || Date.now() } : imparata(nome);
  store.add('valigia', { lista, nome: String(nome).slice(0, 80), nota: extra.nota || '', fatto: false, createdAt: Date.now() + i, ...sez });
}

/**
 * Aggiunge alla lista una o più cose ("ciabatte, pantaloni"); quelle che ci sono già si saltano.
 * Con una sezione (il + di una sezione) vanno lì, e quelle che c'erano già in un'altra sezione ci si spostano.
 */
function aggiungi(id, testo, sezione = '') {
  const prima = new Map(voci(id).map((v) => [chiave(v.nome), v]));
  const visti = new Set();
  const nuove = [];
  const doppie = [];
  const spostate = [];
  const k = sezione ? chiaveSezione(sezione) : '';
  String(testo || '').split(/[,;\n]+/).map((x) => cap(x.trim())).filter(Boolean).forEach((nome, i) => {
    const c = chiave(nome);
    if (visti.has(c)) return;
    visti.add(c);
    const gia = prima.get(c);
    if (gia) {
      if (k && sezioneDi(gia) !== k) { store.update('valigia', gia.id, { sezione, sezioneAt: Date.now() }); spostate.push(gia.nome); }
      else doppie.push(nome);
      return;
    }
    nuovaVoce(id, nome, i, sezione ? { sezione } : {});
    nuove.push(nome);
  });
  return { nuove, doppie, spostate };
}

/** «Aggiungi in Bagno» (il + accanto a una sezione) o «Nuova sezione» (dal menu della lista). */
function aggiungiSheet(id, k = '') {
  const mie = sezioniMie();
  const s = k ? infoSezione(k, mie) : null;
  openSheet({
    title: s ? `Aggiungi in ${s.label}` : 'Nuova sezione',
    body: html`
      ${s ? '' : html`<label class="field"><span>Nome della sezione</span><input name="sez" maxlength="30" placeholder="es. Sci, Palestra, Bimbi" required ${raw('autofocus')}></label>`}
      <label class="field"><span>${s ? 'Cosa' : 'Cosa metterci'}</span><input name="cose" placeholder="Anche più cose, separate da virgole" enterkeyhint="done" ${s ? raw('autofocus') : ''}></label>`,
    submit: 'Aggiungi',
    onSubmit: (fd) => {
      const nome = s ? '' : cap(val(fd, 'sez')).slice(0, 30);
      if (!s && !nome) { sheetError('Dai un nome alla sezione'); return false; }
      if (!val(fd, 'cose')) { sheetError(s ? 'Scrivi cosa aggiungere' : 'Scrivi almeno una cosa da metterci'); return false; }
      // una sezione che c'è già (anche scritta in un altro modo) resta quella
      const kk = s ? k : chiaveSezione(nome);
      const sezione = BASE.has(kk) || mie.has(kk) ? valoreSezione(kk, mie) : nome;
      const { nuove, doppie, spostate } = aggiungi(id, val(fd, 'cose'), sezione);
      if (nuove.length || spostate.length) vibrate();
      const dove = infoSezione(kk, sezioniMie()).label;
      if (spostate.length) toast(`${spostate.join(', ')}: ${spostate.length > 1 ? 'spostati' : 'spostato'} in ${dove}`);
      else if (doppie.length) toast(`${doppie.join(', ')}: ${doppie.length > 1 ? 'ci sono già' : 'c’è già'}`);
    },
  });
}

function nuovaSheet() {
  const altre = liste();
  openSheet({
    title: 'Nuova lista per la valigia',
    body: html`
      <label class="field"><span>Nome</span><input name="nome" placeholder="es. Mare a giugno" required ${raw('autofocus')}></label>
      <div class="field"><span>Parti da</span><div class="radio-chips">
        ${Object.entries(MODELLI).map(([k, m], i) => html`<label><input type="radio" name="da" value="m:${k}" ${i === 0 ? raw('checked') : ''}><span>${icon(m.icon, 'xs')} ${m.label}</span></label>`)}
        ${altre.map((l) => html`<label><input type="radio" name="da" value="l:${l.id}"><span>${icon('suitcase', 'xs')} Copia «${l.nome}»</span></label>`)}
      </div></div>`,
    submit: 'Crea',
    onSubmit: (fd) => {
      const nome = cap(val(fd, 'nome'));
      if (!nome) { sheetError('Dai un nome alla lista'); return false; }
      const [tipo, rif] = String(val(fd, 'da') || 'm:vuota').split(':');
      const m = tipo === 'm' ? MODELLI[rif] || MODELLI.vuota : null;
      const fonte = tipo === 'l' ? lista(rif) : null;
      const id = uid();
      store.set('viaggi', id, { nome, icona: m ? m.icon : (fonte && fonte.icona) || 'suitcase', createdAt: Date.now() });
      // dal modello ogni cosa va nella sua sezione; copiando un'altra lista restano le sue sezioni e le note
      if (m) m.voci.forEach((x, i) => nuovaVoce(id, x, i));
      else if (fonte) voci(fonte.id).forEach((v, i) => nuovaVoce(id, v.nome, i, { nota: v.nota, sezione: v.sezione, sezioneAt: v.sezioneAt }));
      navigate(`#/viaggi/${id}`);
      toast(`Lista «${nome}» pronta`);
    },
  });
}

function menuSheet(l) {
  openSheet({
    title: l.nome,
    body: html`
      <label class="field"><span>Nome</span><input name="nome" value="${l.nome}" required></label>
      <div class="list" style="margin-top:4px">
        <button class="set-row" type="button" data-action="vg-nuova-sez" data-id="${l.id}">${icon('plus')}<div class="row-main"><b>Nuova sezione</b><span>Oltre a Giacche e felpe, Bagno… (es. Sci, Palestra)</span></div></button>
        <button class="set-row" type="button" data-action="vg-ricomincia" data-id="${l.id}">${icon('repeat')}<div class="row-main"><b>Ricomincia</b><span>Toglie tutte le spunte, per il prossimo viaggio</span></div></button>
        <button class="set-row" type="button" data-action="vg-duplica" data-id="${l.id}">${icon('plus')}<div class="row-main"><b>Duplica</b><span>Una copia della lista, senza spunte</span></div></button>
      </div>`,
    extra: html`<button class="btn danger" type="button" data-action="vg-elimina" data-id="${l.id}" aria-label="Elimina la lista">${icon('trash', 'sm')}</button>`,
    submit: 'Salva',
    onSubmit: (fd) => {
      const nome = cap(val(fd, 'nome'));
      if (!nome) { sheetError('Dai un nome alla lista'); return false; }
      store.update('viaggi', l.id, { nome });
    },
  });
}

const NUOVA = '__nuova';

function vocaSheet(v) {
  const mie = sezioniMie();
  const ora = sezioneDi(v);
  openSheet({
    title: 'Modifica',
    body: html`
      <label class="field"><span>Cosa</span><input name="nome" value="${v.nome}" required></label>
      <label class="field"><span>Sezione</span><select name="sezione">
        ${ordineSezioni(mie).map((k) => { const s = infoSezione(k, mie); return html`<option value="${k}" ${k === ora ? raw('selected') : ''}>${s.emoji} ${s.label}</option>`; })}
        <option value="${NUOVA}">＋ Nuova sezione…</option>
      </select></label>
      <label class="field" data-nuova-sez hidden><span>Nome della sezione nuova</span><input name="nuova" maxlength="30" placeholder="es. Sci, Palestra, Bimbi"></label>
      <label class="field"><span>Nota</span><input name="nota" value="${v.nota || ''}" placeholder="es. quelle blu, per Serena"></label>`,
    extra: html`<button class="btn danger" type="button" data-action="vg-del" data-id="${v.id}" aria-label="Elimina">${icon('trash', 'sm')}</button>`,
    onOpen: (root) => {
      const sel = root.querySelector('select[name=sezione]');
      const campo = root.querySelector('[data-nuova-sez]');
      sel.addEventListener('change', () => {
        campo.hidden = sel.value !== NUOVA;
        if (!campo.hidden) campo.querySelector('input').focus();
      });
    },
    onSubmit: (fd) => {
      const nome = cap(val(fd, 'nome'));
      if (!nome) return false;
      const patch = { nome: nome.slice(0, 80), nota: val(fd, 'nota') };
      let k = val(fd, 'sezione');
      let sezione = '';
      if (k === NUOVA) {
        const nuova = cap(val(fd, 'nuova')).slice(0, 30);
        if (!nuova) { sheetError('Scrivi il nome della sezione nuova'); return false; }
        k = chiaveSezione(nuova);
        // se c'è già (anche scritta in un altro modo) resta quella
        sezione = BASE.has(k) || mie.has(k) ? valoreSezione(k, mie) : nuova;
      } else if (k && k !== ora) sezione = valoreSezione(k, mie);
      // la sezione si salva solo se la si sceglie: così rinominando una cosa la sezione si indovina di nuovo
      if (sezione && k !== ora) Object.assign(patch, { sezione, sezioneAt: Date.now() });
      store.update('valigia', v.id, patch);
    },
  });
}

export const actions = {
  'vg-nuova': () => nuovaSheet(),
  'vg-menu': ({ id }) => { const l = lista(id); if (l) menuSheet(l); },
  'vg-add-sez': ({ id, el }) => { if (lista(id)) aggiungiSheet(id, el.dataset.sez); },
  'vg-nuova-sez': ({ id }) => { if (lista(id)) aggiungiSheet(id); },
  'vg-add': ({ form }) => {
    const input = form.querySelector('input');
    const { nuove, doppie } = aggiungi(form.dataset.id, input.value);
    input.value = '';
    if (nuove.length) vibrate();
    if (doppie.length) toast(`${doppie.join(', ')}: ${doppie.length > 1 ? 'ci sono già' : 'c’è già'}`);
  },
  'vg-toggle': ({ id }) => {
    const v = state.data.valigia.find((x) => x.id === id);
    if (!v) return;
    vibrate(10);
    store.update('valigia', id, { fatto: !v.fatto });
    if (!v.fatto) {
      const { tot, fatte } = stato(v.lista);
      if (tot && fatte + 1 >= tot) toast('Valigia pronta! Buon viaggio ♡');
    }
  },
  'vg-edit': ({ id }) => { const v = state.data.valigia.find((x) => x.id === id); if (v) vocaSheet(v); },
  'vg-del': ({ id }) => {
    const v = state.data.valigia.find((x) => x.id === id);
    closeSheet();
    if (!v) return;
    store.remove('valigia', id);
    toast(`Tolto: ${v.nome}`, { undo: () => { const { id: _, ...resto } = v; store.set('valigia', id, resto); } });
  },
  'vg-ricomincia': ({ id }) => {
    closeSheet();
    const l = lista(id);
    const fatte = voci(id).filter((v) => v.fatto);
    if (!l || !fatte.length) { toast('Non c’è niente da togliere'); return; }
    confirmSheet({
      title: 'Ricominciare?', text: `Le ${fatte.length} spunte di «${l.nome}» spariscono: la lista resta, pronta per il prossimo viaggio.`, yes: 'Ricomincia',
      onYes: () => { fatte.forEach((v) => store.update('valigia', v.id, { fatto: false })); toast('Lista pronta per il prossimo viaggio'); },
    });
  },
  'vg-duplica': ({ id }) => {
    closeSheet();
    const l = lista(id);
    if (!l) return;
    const nid = uid();
    store.set('viaggi', nid, { nome: `${l.nome} (copia)`, icona: l.icona || 'suitcase', createdAt: Date.now() });
    voci(id).forEach((v, i) => nuovaVoce(nid, v.nome, i, { nota: v.nota, sezione: v.sezione, sezioneAt: v.sezioneAt }));
    navigate(`#/viaggi/${nid}`);
  },
  'vg-elimina': ({ id }) => {
    closeSheet();
    const l = lista(id);
    if (!l) return;
    const dentro = voci(id);
    confirmSheet({
      title: `Eliminare «${l.nome}»?`, text: dentro.length ? `Spariscono anche le ${dentro.length} cose della lista.` : 'La lista è vuota.',
      onYes: () => { dentro.forEach((v) => store.remove('valigia', v.id)); store.remove('viaggi', id); navigate('#/viaggi'); },
    });
  },
};
