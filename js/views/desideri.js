// Desideri: le nostre liste e quelle di Amazon.
//  • "Desideri di casa" è la lista di sempre (i desideri senza lista sono suoi); se ne possono creare
//    altre (es. «Compleanno di Serena», «Casa nuova») e spostare i desideri dall'una all'altra.
//  • Le liste dei desideri di Amazon si collegano con il loro link: l'app legge la pagina pubblica della
//    lista (api/link.js) e mostra ogni prodotto con foto, nome e prezzo; un tocco apre il prodotto su Amazon.
//    Amazon non ha un'API per le liste: se un giorno non apre la pagina, resta l'ultima versione letta
//    (con la data) e si riprova più tardi, senza insistere.
import { html, raw, cap, safeUrl, hostOf, money, vibrate, timeAgo, uid, lsGet, lsSet } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { WISH_CATS } from '../data.js';
import { state, store, me, whoBadge, whoChoices, openSheet, closeSheet, toast, val, emptyState, ui, setUi, pageHead, swipe, settings, saveSettings, nameOf, sheetError, isSynced, confirmSheet, rerender } from '../core.js';

// ---------------------------------------------------------------------------
// Link di Amazon
// ---------------------------------------------------------------------------
const AMAZON = /^(?:www\.|m\.|smile\.)?amazon\.(it|com|de|fr|es|co\.uk|nl|com\.be|se|pl|ie)$/i;
const BREVI = /^(amzn\.eu|amzn\.to|a\.co)$/i;

/** Cosa c'è in un link di Amazon: un prodotto (asin, nome dal link) o una lista dei desideri. */
export function amazonInfo(link) {
  let u;
  try { u = new URL(String(link || '').trim()); } catch { return null; }
  if (!AMAZON.test(u.hostname)) return BREVI.test(u.hostname) ? { tipo: 'breve' } : null;
  const host = `www.amazon.${u.hostname.match(AMAZON)[1]}`;
  const lista = u.pathname.match(/\/(?:hz\/wishlist\/ls|registry\/wishlist|wishlist)\/([A-Z0-9]{8,16})/i);
  if (lista) return { tipo: 'lista', url: `https://${host}/hz/wishlist/ls/${lista[1].toUpperCase()}` };
  const asin = (u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?=[/?]|$)/i) || [])[1];
  if (!asin) return null;
  // il nome del prodotto, se c'è nel link: /Philips-Friggitrice-Essential-HD9252/dp/B0…
  const slug = (u.pathname.match(/^\/([^/]+)\/(?:dp|gp\/product)\//i) || [])[1];
  let titolo = '';
  if (slug && !/^(dp|gp|-)$/i.test(slug)) {
    try { titolo = decodeURIComponent(slug); } catch { titolo = slug; }
    titolo = titolo.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return { tipo: 'prodotto', asin: asin.toUpperCase(), url: `https://${host}/dp/${asin.toUpperCase()}`, titolo: titolo.length > 3 ? cap(titolo).slice(0, 120) : '' };
}

/** I link brevi (amzn.eu/…): il server segue il rinvio e restituisce l'indirizzo vero. */
async function linkVero(link) {
  const info = amazonInfo(link);
  if (!info || info.tipo !== 'breve' || !isSynced()) return link;
  try { const r = await store.call(`link?url=${encodeURIComponent(link)}`); return r && r.url ? r.url : link; } catch { return link; }
}

/** "12,50" · "12.50" · "1.299" · "1.299,00" · "€ 35" → numero (o null) */
export function prezzo(s) {
  let t = String(s || '').replace(/[^\d.,]/g, '');
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  else if (/\.\d{3}$/.test(t)) t = t.replace(/\./g, ''); // 1.299 = milleduecentonovantanove
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ---------------------------------------------------------------------------
// Le liste
// ---------------------------------------------------------------------------
const CASA = 'casa';
const per = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
const tutte = () => (state.data.liste || []).filter((l) => l && (l.tipo === 'amazon' ? safeUrl(l.url) : l.nome));
const nostre = () => tutte().filter((l) => l.tipo !== 'amazon').sort(per);
const diAmazon = () => tutte().filter((l) => l.tipo === 'amazon').sort(per);
const listaDi = (w) => (w.lista && nostre().some((l) => l.id === w.lista) ? w.lista : CASA);
const nomeLista = (l) => (!l || l.id === CASA ? 'Desideri di casa' : l.nome || l.nomeAmazon || 'Lista Amazon');
const trova = (id) => tutte().find((l) => l.id === id) || null;

/** La lista aperta: l'ultima scelta su questo dispositivo, se c'è ancora. */
function aperta() {
  const id = ui('wish.lista', null) || lsGet('casa.desideri.lista') || CASA;
  return id === CASA || trova(id) ? id : CASA;
}
const apri = (id) => { lsSet('casa.desideri.lista', id); setUi('wish.lista', id); };

// foto e link dei prodotti di Amazon: solo dai loro indirizzi
const FOTO_AMZ = /^https:\/\/m\.media-amazon\.com\/images\/I\/[\w%+.-]+\.(?:jpe?g|png|webp)$/i;
const fotoAmz = (u) => (FOTO_AMZ.test(String(u || '')) ? u : '');
const linkAmz = (u) => { const a = amazonInfo(u); return a && a.tipo === 'prodotto' ? a.url : ''; };
const totale = (prezzi) => prezzi.reduce((s, x) => s + (Number(x) || 0), 0);

// ---------------------------------------------------------------------------
// Le liste di Amazon: lettura (dal server) e ultima versione salvata nella lista
// ---------------------------------------------------------------------------
const SEI_ORE = 6 * 3600000;
const leggendo = new Map(); // id → richiesta in corso
const rifiuti = new Map(); // id → { msg, at }: Amazon ha detto di no, per un po' non si riprova da soli

async function leggiAmazon(l, { forza = false } = {}) {
  if (!isSynced() || !l || leggendo.has(l.id)) return leggendo.get(l && l.id);
  const no = rifiuti.get(l.id);
  if (!forza && no && Date.now() - no.at < 30 * 60000) return false;
  const pr = (async () => {
    try {
      const r = await store.call(`link?lista=${encodeURIComponent(l.url)}`);
      rifiuti.delete(l.id);
      const articoli = (r.articoli || []).slice(0, 300).map((a) => ({
        id: String(a.id || a.asin), asin: a.asin, titolo: String(a.titolo || '').slice(0, 200), di: String(a.di || '').slice(0, 80),
        foto: fotoAmz(a.foto), prezzo: Number(a.prezzo) > 0 ? Number(a.prezzo) : null, link: linkAmz(a.link), voluti: a.voluti || 0, presi: a.presi || 0,
      })).filter((a) => a.titolo && a.link);
      store.update('liste', l.id, { articoli, completa: r.completa !== false, valuta: r.valuta || 'EUR', nomeAmazon: r.nome || l.nomeAmazon || '', aggiornata: Date.now() });
      return true;
    } catch (e) {
      rifiuti.set(l.id, { msg: (e && e.message) || 'Amazon adesso non risponde', at: Date.now() });
      return false;
    } finally { leggendo.delete(l.id); rerender(); }
  })();
  leggendo.set(l.id, pr);
  rerender();
  return pr;
}

// Una volta sola: le liste Amazon collegate prima (nelle impostazioni) diventano liste vere
function migra() {
  const s = settings();
  if (s.listeV2 || !state.loaded.has('liste') || !state.loaded.has('settings')) return;
  if (store.mode === 'sync' && !(store.synced && store.synced.has('liste') && store.synced.has('settings'))) return;
  (s.listeAmazon || []).forEach((l, i) => {
    if (!l || !l.id || !safeUrl(l.url) || state.data.liste.some((x) => x.id === l.id)) return;
    store.set('liste', l.id, { nome: l.nome || '', tipo: 'amazon', url: l.url, chi: l.chi || 'both', createdAt: Date.now() + i });
  });
  saveSettings({ listeV2: 1 });
}

// ---------------------------------------------------------------------------
// Disegno
// ---------------------------------------------------------------------------
function hearts(n) {
  return html`<span class="hearts" title="Quanto lo vogliamo">${[1, 2, 3].map((i) => icon('heart', i <= (n || 1) ? '' : 'off'))}</span>`;
}

function item(w) {
  const link = safeUrl(w.link);
  const amz = link && amazonInfo(link);
  const foto = fotoAmz(w.foto);
  return html`<div class="wish ${w.bought ? 'done' : ''} ${foto ? 'with-img' : ''}" id="w-${w.id}"${swipe(w.id, ['wish-toggle', w.bought ? 'Non ancora' : 'Preso'], ['wish-del', 'Elimina'])}>
    <button class="check ${w.bought ? 'on' : ''}" data-action="wish-toggle" data-id="${w.id}" aria-label="${w.bought ? 'Non ancora comprato' : 'Comprato'}: ${w.title}">${icon('check')}</button>
    ${foto ? html`<span class="wish-img"><img src="${foto}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>` : ''}
    <div class="row-main">
      <button class="row-edit" data-action="wish-edit" data-id="${w.id}" style="padding:0;width:100%">
        <div class="row-title" style="justify-content:space-between;flex-wrap:nowrap"><span style="${w.bought ? 'text-decoration:line-through;color:var(--text-3)' : ''}">${w.title}</span>${w.price ? html`<span class="price">${money(w.price)}</span>` : ''}</div>
        <div class="row-sub">${hearts(w.prio)}<span>${WISH_CATS[w.cat] || ''}</span>${w.for ? whoBadge(w.for) : ''}${w.bought && w.boughtAt ? html`<span>· preso ${timeAgo(w.boughtAt)}</span>` : ''}</div>
        ${w.note ? html`<div class="row-sub" style="margin-top:4px">${w.note}</div>` : ''}
      </button>
      ${link ? html`<div class="wish-actions"><a class="mini-btn ${amz ? 'amz' : ''}" href="${link}" target="_blank" rel="noopener">${icon(amz ? 'basket' : 'link', 'xs')} ${amz ? 'Apri su Amazon' : hostOf(link) || 'Apri'}</a></div>` : ''}
    </div>
  </div>`;
}

/** Le liste in fila (su iPad a griglia): la lista di casa, le nostre, quelle di Amazon, "Nuova lista". */
function fila(cur) {
  const desideri = state.data.desideri;
  const aperti = (id) => desideri.filter((w) => !w.bought && listaDi(w) === id).length;
  const tessera = (id, nome, sub, copertina, extra = '') => html`
    <button class="wl-tile ${cur === id ? 'on' : ''} ${extra}" data-action="wl-apri" data-id="${id}" aria-pressed="${cur === id ? 'true' : 'false'}">
      <span class="wl-cover">${copertina}</span><b>${nome}</b><span>${sub}</span></button>`;
  const plur = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const collage = (l) => {
    const foto = (l.articoli || []).map((a) => fotoAmz(a.foto)).filter(Boolean).slice(0, 4);
    return foto.length ? html`<span class="wl-collage n${foto.length}">${foto.map((f) => html`<img src="${f}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`)}</span>` : icon('basket');
  };
  return html`<div class="wl-rail" role="tablist" aria-label="Liste">
    ${tessera(CASA, 'Desideri di casa', plur(aperti(CASA), 'desiderio', 'desideri'), icon('gift'), 'casa')}
    ${nostre().map((l) => tessera(l.id, l.nome, plur(aperti(l.id), 'desiderio', 'desideri'), icon('gift'), 'nostra'))}
    ${diAmazon().map((l) => tessera(l.id, nomeLista(l), l.articoli ? `Amazon · ${(l.articoli || []).length}` : 'Amazon', collage(l), 'amazon'))}
    <button class="wl-tile add" data-action="wl-nuova"><span class="wl-cover">${icon('plus')}</span><b>Nuova lista</b><span>Nostra o da Amazon</span></button>
  </div>`;
}

function nostraLista(id) {
  const cat = ui('wish.cat', 'tutti');
  const mie = state.data.desideri.filter((w) => listaDi(w) === id);
  const open = mie.filter((w) => !w.bought && (cat === 'tutti' || w.cat === cat)).sort((a, b) => (b.prio || 1) - (a.prio || 1) || (b.createdAt || 0) - (a.createdAt || 0));
  const bought = mie.filter((w) => w.bought).sort((a, b) => (b.boughtAt || 0) - (a.boughtAt || 0));
  const cats = Object.keys(WISH_CATS).filter((c) => mie.some((w) => w.cat === c && !w.bought));
  const showBought = ui('wish.showBought', false);
  const l = trova(id);
  return html`
    <div class="card wish-sum">
      <div><p class="muted small" style="margin:0">${nomeLista(l || { id })} · ${open.length} ${open.length === 1 ? 'desiderio' : 'desideri'}${cat !== 'tutti' ? ` · ${WISH_CATS[cat]}` : ''}</p><b>${money(totale(open.map((w) => w.price)))}</b></div>
      ${l ? html`<button class="icon-btn ghost" data-action="wl-menu" data-id="${l.id}" aria-label="Modifica la lista ${l.nome}">${icon('dots')}</button>`
        : html`<span class="dot-ico tone-rose" style="width:46px;height:46px;border-radius:14px;display:grid;place-items:center">${icon('gift', 'lg')}</span>`}
    </div>
    ${cats.length > 1 ? html`<div class="chips">
      <button class="chip ${cat === 'tutti' ? 'on' : ''}" data-action="wish-cat" data-v="tutti">Tutti</button>
      ${cats.map((c) => html`<button class="chip ${cat === c ? 'on' : ''}" data-action="wish-cat" data-v="${c}">${WISH_CATS[c]}</button>`)}
    </div>` : ''}
    ${open.length ? html`<div class="list" style="margin-top:6px">${open.map(item)}</div>` : emptyState(l ? 'Lista vuota' : 'Nessun desiderio', l ? `Aggiungi le cose per «${l.nome}».` : 'Aggiungi le cose che vorreste comprare per casa o per voi.', catFace('a'))}
    ${bought.length ? html`
      <div class="section-title"><span>Comprati · ${bought.length}</span><button class="card-link" data-action="wish-showbought">${showBought ? 'Nascondi' : 'Mostra'}</button></div>
      ${showBought ? html`<div class="list">${bought.slice(0, 40).map(item)}</div>` : ''}` : ''}
    <button class="fab" data-action="wish-new">${icon('plus')} Desiderio</button>`;
}

function prodotto(a, valuta) {
  const foto = fotoAmz(a.foto);
  const preso = a.voluti > 0 && a.presi >= a.voluti;
  const prezzoTxt = a.prezzo == null ? 'Prezzo non disponibile' : valuta && valuta !== 'EUR' ? `${a.prezzo.toLocaleString('it-IT')} ${valuta}` : money(a.prezzo);
  return html`<a class="amz-item ${preso ? 'preso' : ''}" href="${a.link}" target="_blank" rel="noopener" aria-label="${a.titolo} su Amazon">
    <span class="amz-img">${icon('gift')}${foto ? html`<img src="${foto}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}${preso ? html`<span class="amz-preso">${icon('check', 'xs')} Preso</span>` : ''}</span>
    <b>${a.titolo}</b>
    <span class="amz-price ${a.prezzo == null ? 'na' : ''}">${prezzoTxt}</span>
  </a>`;
}

function listaAmazon(l) {
  const articoli = (l.articoli || []).filter((a) => a && a.titolo && a.link);
  const carico = leggendo.has(l.id);
  const no = rifiuti.get(l.id);
  const url = safeUrl(l.url);
  const conPrezzo = articoli.filter((a) => a.prezzo != null);
  const testa = html`<div class="card amz-head">
    <span class="amz-logo" aria-hidden="true">${icon('basket')}</span>
    <div class="row-main"><b>${nomeLista(l)}</b>
      <span>${l.aggiornata ? html`${articoli.length} ${articoli.length === 1 ? 'articolo' : 'articoli'}${conPrezzo.length && (!l.valuta || l.valuta === 'EUR') ? ` · ${money(totale(conPrezzo.map((a) => a.prezzo)))}` : ''} · ${carico ? 'aggiorno…' : `letta ${timeAgo(l.aggiornata)}`}` : carico ? 'Leggo la lista da Amazon…' : 'Lista Amazon'}${l.chi && l.chi !== 'both' ? ` · di ${nameOf(l.chi)}` : ''}</span></div>
    <button class="icon-btn ghost" data-action="amz-aggiorna" data-id="${l.id}" aria-label="Aggiorna da Amazon" ${carico ? raw('disabled') : ''}>${icon('refresh', carico ? 'spin' : '')}</button>
    <button class="icon-btn ghost" data-action="amz-list-edit" data-id="${l.id}" aria-label="Modifica la lista">${icon('dots')}</button>
  </div>`;
  let corpo;
  if (!articoli.length && carico) {
    corpo = html`<div class="amz-grid" aria-busy="true">${[1, 2, 3, 4].map(() => html`<span class="amz-item sk"><span class="amz-img"></span><i></i><i></i></span>`)}</div>`;
  } else if (!articoli.length && l.aggiornata) {
    corpo = emptyState('Lista vuota', 'Su Amazon questa lista non ha ancora prodotti.', catFace('a'));
  } else if (!articoli.length) {
    corpo = html`<div class="card web-msg">${icon('info', 'sm')}<div><b>Non riesco a leggere la lista adesso.</b><span>${no ? no.msg : 'Serve la connessione: riprova tra poco.'}</span>
      <button class="mini-btn" data-action="amz-aggiorna" data-id="${l.id}" style="margin-top:8px">${icon('refresh', 'xs')} Riprova</button></div></div>`;
  } else {
    corpo = html`${no && !carico ? html`<p class="muted small amz-note">${icon('info', 'xs')} ${no.msg}. Questi sono gli articoli letti ${timeAgo(l.aggiornata)}.</p>` : ''}
      ${l.completa === false ? html`<p class="muted small amz-note">${icon('info', 'xs')} Amazon ha mostrato solo una parte della lista: il resto alla prossima lettura.</p>` : ''}
      <div class="amz-grid">${articoli.map((a) => prodotto(a, l.valuta))}</div>`;
  }
  return html`${testa}${corpo}
    ${url ? html`<a class="btn amz-open-all" href="${url}" target="_blank" rel="noopener">${icon('link', 'sm')} Apri la lista su Amazon</a>` : ''}`;
}

export function render() {
  const cur = aperta();
  const l = cur === CASA ? null : trova(cur);
  return html`
    ${pageHead('Desideri', { eyebrow: 'Cose da comprare, prima o poi' })}
    ${fila(cur)}
    ${l && l.tipo === 'amazon' ? listaAmazon(l) : nostraLista(cur)}`;
}

export function after() {
  migra();
  // la lista Amazon aperta: se non è mai stata letta o è vecchia di qualche ora, la rileggo
  const l = trova(aperta());
  if (l && l.tipo === 'amazon' && (!l.aggiornata || Date.now() - l.aggiornata > SEI_ORE)) leggiAmazon(l);
}

/** Tira giù per aggiornare: rilegge la lista Amazon aperta. */
export async function refresh() {
  const l = trova(aperta());
  if (l && l.tipo === 'amazon') await leggiAmazon(l, { forza: true });
}

// ---------------------------------------------------------------------------
// Fogli
// ---------------------------------------------------------------------------
function sheet(w = null) {
  const liste = nostre();
  const dove = w ? listaDi(w) : (trova(aperta()) || {}).tipo === 'amazon' ? CASA : aperta();
  openSheet({
    title: w ? 'Modifica desiderio' : 'Nuovo desiderio',
    body: html`
      <label class="field"><span>Link <em class="opt">facoltativo</em></span><input name="link" type="url" inputmode="url" autocomplete="off" value="${w ? w.link || '' : ''}" placeholder="https://… (anche da Amazon: Condividi → Copia link)">
        <span class="help" id="wish-link-help"></span></label>
      <label class="field"><span>Cosa</span><input name="title" value="${w ? w.title : ''}" placeholder="es. Lampada per il comodino" required ${w ? '' : raw('autofocus')}></label>
      <div class="field-row">
        <label class="field"><span>Prezzo (€)</span><input name="price" type="text" inputmode="decimal" value="${w && w.price ? String(w.price).replace('.', ',') : ''}"></label>
        <label class="field"><span>Categoria</span><select name="cat">${Object.entries(WISH_CATS).map(([k, lab]) => html`<option value="${k}" ${(w ? w.cat : 'casa') === k ? raw('selected') : ''}>${lab}</option>`)}</select></label>
      </div>
      ${liste.length ? html`<label class="field"><span>Lista</span><select name="lista">
        <option value="${CASA}" ${dove === CASA ? raw('selected') : ''}>Desideri di casa</option>
        ${liste.map((x) => html`<option value="${x.id}" ${dove === x.id ? raw('selected') : ''}>${x.nome}</option>`)}</select></label>` : ''}
      <div class="field"><span>Quanto lo vogliamo</span><div class="radio-chips">${[[1, 'Un giorno'], [2, 'Mi piacerebbe'], [3, 'Lo voglio!']].map(([v, lab]) => html`
        <label><input type="radio" name="prio" value="${v}" ${(w ? w.prio || 1 : 2) === v ? raw('checked') : ''}><span>${hearts(v)} ${lab}</span></label>`)}</div></div>
      <div class="field"><span>Per chi</span>${whoChoices('for', w ? w.for : 'both', { allowNone: false })}</div>
      <label class="field"><span>Note</span><input name="note" value="${w ? w.note || '' : ''}" placeholder="Misure, colore, alternativa…"></label>`,
    extra: w ? html`<button class="btn danger" type="button" data-action="wish-del" data-id="${w.id}" aria-label="Elimina">${icon('trash', 'sm')}</button>` : '',
    onOpen: (root) => {
      // incollando un link di Amazon: link pulito e, se c'è, il nome del prodotto
      const form = root.querySelector('#sheet-form');
      const help = root.querySelector('#wish-link-help');
      let ultimo = '';
      const guarda = async () => {
        const raw0 = form.link.value.trim();
        if (!raw0 || raw0 === ultimo) return;
        ultimo = raw0;
        const link = await linkVero(raw0);
        if (form.link.value.trim() !== raw0) return;
        const a = amazonInfo(link);
        if (!a || a.tipo === 'breve') { help.textContent = ''; return; }
        if (a.tipo === 'lista') { help.textContent = 'Questo è il link di una lista: aggiungila con «Nuova lista» → «Da Amazon».'; return; }
        form.link.value = a.url;
        ultimo = a.url;
        if (a.titolo && !form.title.value.trim()) form.title.value = a.titolo;
        help.textContent = `Prodotto Amazon ✓${a.titolo ? '' : ' (scrivi tu il nome: nel link non c’era)'}`;
      };
      form.link.addEventListener('change', guarda);
      form.link.addEventListener('paste', () => setTimeout(guarda, 30));
    },
    onSubmit: async (fd) => {
      const title = cap(val(fd, 'title'));
      if (!title) { sheetError('Scrivi cosa desiderate'); return false; }
      const price = prezzo(val(fd, 'price'));
      let link = safeUrl(await linkVero(val(fd, 'link')));
      const a = link && amazonInfo(link);
      if (a && a.tipo === 'prodotto') link = a.url; // senza tracciamento
      const lista = val(fd, 'lista');
      const data = { title, price, cat: val(fd, 'cat'), link, asin: a && a.asin ? a.asin : null, prio: Number(val(fd, 'prio')) || 2, for: val(fd, 'for'), note: val(fd, 'note') };
      if (liste.length) data.lista = lista && lista !== CASA ? lista : null;
      if (w) store.update('desideri', w.id, data);
      else store.add('desideri', { ...data, bought: false, by: me() || '' });
    },
  });
}

/** Nuova lista: nostra (solo il nome) o da Amazon (il link della lista). */
function nuovaListaSheet() {
  const n = settings().names;
  openSheet({
    title: 'Nuova lista',
    body: html`
      <div class="field"><span>Che lista?</span><div class="radio-chips wl-tipo">
        <label><input type="radio" name="tipo" value="nostra" checked><span>${icon('gift', 'xs')} Nostra</span></label>
        <label><input type="radio" name="tipo" value="amazon"><span>${icon('basket', 'xs')} Da Amazon</span></label>
      </div></div>
      <div class="wl-solo-nostra"><label class="field"><span>Nome</span><input name="nome" placeholder="es. Compleanno di ${n[me() === 'p1' ? 'p2' : 'p1']}" ${raw('autofocus')}></label></div>
      <div class="wl-solo-amazon" hidden>
        <label class="field"><span>Link della lista</span><input name="url" type="url" inputmode="url" autocomplete="off" placeholder="Amazon → La lista → Condividi → Copia link"></label>
        <p class="help" style="margin-top:-6px">La lista deve essere pubblica o condivisa: qui compaiono i suoi prodotti con foto, nome e prezzo.</p>
        <label class="field"><span>Nome <em class="opt">facoltativo</em></span><input name="nomeAmz" placeholder="Se lo lasci vuoto uso quello di Amazon"></label>
      </div>
      <div class="field"><span>Di chi</span>${whoChoices('chi', me() || 'both', { allowNone: false })}</div>`,
    submit: 'Crea',
    onOpen: (root) => {
      const form = root.querySelector('#sheet-form');
      const cambia = () => {
        const amz = form.querySelector('input[name=tipo]:checked').value === 'amazon';
        root.querySelector('.wl-solo-nostra').hidden = amz;
        root.querySelector('.wl-solo-amazon').hidden = !amz;
      };
      form.querySelectorAll('input[name=tipo]').forEach((r) => r.addEventListener('change', cambia));
    },
    onSubmit: async (fd) => {
      const chi = val(fd, 'chi') || 'both';
      const id = uid();
      if (val(fd, 'tipo') === 'amazon') {
        const link = safeUrl(await linkVero(val(fd, 'url')));
        const a = link && amazonInfo(link);
        if (!a || a.tipo !== 'lista') { sheetError('Questo non sembra il link di una lista Amazon: aprila su Amazon, tocca Condividi e copia il link'); return false; }
        if (diAmazon().some((x) => x.url === a.url)) { sheetError('Questa lista c’è già'); return false; }
        const l = { nome: cap(val(fd, 'nomeAmz')), tipo: 'amazon', url: a.url, chi, createdAt: Date.now() };
        store.set('liste', id, l);
        apri(id);
        leggiAmazon({ id, ...l }, { forza: true });
        toast('Lista collegata: leggo i prodotti da Amazon');
        return;
      }
      const nome = cap(val(fd, 'nome'));
      if (!nome) { sheetError('Dai un nome alla lista'); return false; }
      store.set('liste', id, { nome, tipo: 'nostra', chi, createdAt: Date.now() });
      apri(id);
      toast(`Lista «${nome}» creata`);
    },
  });
}

/** Una nostra lista: rinominarla o eliminarla (i desideri tornano nella lista di casa). */
function menuLista(l) {
  openSheet({
    title: l.nome,
    body: html`
      <label class="field"><span>Nome</span><input name="nome" value="${l.nome}" required></label>
      <div class="field"><span>Di chi</span>${whoChoices('chi', l.chi || 'both', { allowNone: false })}</div>`,
    extra: html`<button class="btn danger" type="button" data-action="wl-elimina" data-id="${l.id}" aria-label="Elimina la lista">${icon('trash', 'sm')}</button>`,
    submit: 'Salva',
    onSubmit: (fd) => {
      const nome = cap(val(fd, 'nome'));
      if (!nome) { sheetError('Dai un nome alla lista'); return false; }
      store.update('liste', l.id, { nome, chi: val(fd, 'chi') || 'both' });
    },
  });
}

/** Una lista di Amazon: link, nome, di chi; si può scollegare (su Amazon resta). */
function listaAmazonSheet(l) {
  openSheet({
    title: 'Lista Amazon',
    body: html`
      <label class="field"><span>Link della lista</span><input name="url" type="url" inputmode="url" autocomplete="off" value="${l.url}" required></label>
      <label class="field"><span>Nome</span><input name="nome" value="${l.nome || ''}" placeholder="${l.nomeAmazon || 'Lista Amazon'}"></label>
      <div class="field"><span>Di chi</span>${whoChoices('chi', l.chi || 'both', { allowNone: false })}</div>`,
    extra: html`<button class="btn danger" type="button" data-action="amz-list-del" data-id="${l.id}" aria-label="Scollega">${icon('trash', 'sm')}</button>`,
    submit: 'Salva',
    onSubmit: async (fd) => {
      const link = safeUrl(await linkVero(val(fd, 'url')));
      const a = link && amazonInfo(link);
      if (!a || a.tipo !== 'lista') { sheetError('Questo non sembra il link di una lista Amazon: aprila su Amazon, tocca Condividi e copia il link'); return false; }
      const cambiata = a.url !== l.url;
      store.update('liste', l.id, { url: a.url, nome: cap(val(fd, 'nome')), chi: val(fd, 'chi') || 'both', ...(cambiata ? { articoli: null, aggiornata: null, nomeAmazon: '' } : {}) });
      if (cambiata) { rifiuti.delete(l.id); leggiAmazon({ ...l, url: a.url }, { forza: true }); }
      toast('Lista aggiornata');
    },
  });
}

export const actions = {
  'wl-apri': ({ id }) => { vibrate(8); setUi('wish.cat', 'tutti'); apri(id); },
  'wl-nuova': () => nuovaListaSheet(),
  'wl-menu': ({ id }) => { const l = trova(id); if (l) menuLista(l); },
  'wl-elimina': ({ id }) => {
    const l = trova(id);
    closeSheet();
    if (!l) return;
    const dentro = state.data.desideri.filter((w) => w.lista === id);
    confirmSheet({
      title: `Eliminare «${l.nome}»?`,
      text: dentro.length ? `${dentro.length === 1 ? 'Il desiderio torna' : `I ${dentro.length} desideri tornano`} in «Desideri di casa».` : 'La lista è vuota.',
      onYes: () => {
        dentro.forEach((w) => store.update('desideri', w.id, { lista: null }));
        store.remove('liste', id);
        apri(CASA);
      },
    });
  },
  'wish-cat': ({ el }) => setUi('wish.cat', el.dataset.v),
  'wish-showbought': () => setUi('wish.showBought', !ui('wish.showBought', false)),
  'wish-new': () => sheet(),
  'wish-edit': ({ id }) => { const w = state.data.desideri.find((x) => x.id === id); if (w) sheet(w); },
  'wish-toggle': ({ id }) => {
    const w = state.data.desideri.find((x) => x.id === id);
    if (!w) return;
    vibrate(12);
    store.update('desideri', id, { bought: !w.bought, boughtAt: w.bought ? null : Date.now(), boughtBy: w.bought ? null : me() || '' });
    if (!w.bought) toast(`Preso! ${w.title}`, { undo: () => store.update('desideri', id, { bought: false, boughtAt: null, boughtBy: null }) });
  },
  'wish-del': ({ id }) => {
    const w = state.data.desideri.find((x) => x.id === id);
    closeSheet();
    if (!w) return;
    store.remove('desideri', id);
    toast('Desiderio eliminato', { undo: () => { const { id: _, ...rest } = w; store.set('desideri', id, rest); } });
  },
  // liste di Amazon
  'amz-list-new': () => nuovaListaSheet(),
  'amz-aggiorna': async ({ id }) => {
    const l = trova(id);
    if (!l) return;
    if (!isSynced()) { toast('Serve la connessione con la casa'); return; }
    const ok = await leggiAmazon(l, { forza: true });
    if (ok === false) toast((rifiuti.get(id) || {}).msg || 'Amazon adesso non risponde');
    else if (ok) toast('Lista aggiornata');
  },
  'amz-list-edit': ({ id }) => { const l = trova(id); if (l) listaAmazonSheet(l); },
  'amz-list-del': ({ id }) => {
    const l = trova(id);
    closeSheet();
    if (!l) return;
    confirmSheet({
      title: `Scollegare «${nomeLista(l)}»?`, text: 'La lista resta su Amazon: qui sparisce solo il collegamento.', yes: 'Scollega',
      onYes: () => { store.remove('liste', id); apri(CASA); },
    });
  },
};
