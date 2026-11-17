// Viaggi: le liste per la valigia (ciabatte, pantaloni…). Una lista per tipo di viaggio (Mare, Montagna,
// Weekend…): si spunta mentre si prepara la valigia e, al viaggio dopo, «Ricomincia» toglie le spunte.
// Liste nella raccolta "viaggi", le cose da portare in "valigia" (una per riga: si spuntano in due insieme).
import { html, raw, cap, vibrate, uid } from '../utils.js';
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
    ${da.length ? html`<div class="list" style="margin-top:12px">${da.map(riga)}</div>`
      : tutte.length ? emptyState('Tutto in valigia!', 'Buon viaggio ♡', catFace('a'))
      : emptyState('Lista vuota', 'Scrivi qui sopra cosa portare: anche più cose insieme, separate da virgole.', catFace('b'))}
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
/** Aggiunge alla lista una o più cose ("ciabatte, pantaloni"); quelle che ci sono già si saltano. */
function aggiungi(id, testo) {
  const gia = new Set(voci(id).map((v) => chiave(v.nome)));
  const nuove = [];
  const doppie = [];
  String(testo || '').split(/[,;\n]+/).map((x) => cap(x.trim())).filter(Boolean).forEach((nome, i) => {
    if (gia.has(chiave(nome))) { doppie.push(nome); return; }
    gia.add(chiave(nome));
    store.add('valigia', { lista: id, nome: nome.slice(0, 80), fatto: false, createdAt: Date.now() + i });
    nuove.push(nome);
  });
  return { nuove, doppie };
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
      const cose = m ? m.voci : fonte ? voci(fonte.id).map((v) => v.nome) : [];
      cose.forEach((x, i) => store.add('valigia', { lista: id, nome: x, fatto: false, createdAt: Date.now() + i }));
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

function vocaSheet(v) {
  openSheet({
    title: 'Modifica',
    body: html`
      <label class="field"><span>Cosa</span><input name="nome" value="${v.nome}" required></label>
      <label class="field"><span>Nota</span><input name="nota" value="${v.nota || ''}" placeholder="es. quelle blu, per Serena"></label>`,
    extra: html`<button class="btn danger" type="button" data-action="vg-del" data-id="${v.id}" aria-label="Elimina">${icon('trash', 'sm')}</button>`,
    onSubmit: (fd) => {
      const nome = cap(val(fd, 'nome'));
      if (!nome) return false;
      store.update('valigia', v.id, { nome: nome.slice(0, 80), nota: val(fd, 'nota') });
    },
  });
}

export const actions = {
  'vg-nuova': () => nuovaSheet(),
  'vg-menu': ({ id }) => { const l = lista(id); if (l) menuSheet(l); },
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
    voci(id).forEach((v, i) => store.add('valigia', { lista: nid, nome: v.nome, nota: v.nota || '', fatto: false, createdAt: Date.now() + i }));
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
