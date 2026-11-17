// Lista dei desideri: cose da comprare per casa, per noi, per i gatti.
// Amazon non permette alle app di leggere le liste dei desideri (nessuna API pubblica): qui le liste
// si collegano per aprirle con un tocco, e i prodotti si aggiungono incollando il loro link
// (nome e codice si ricavano dal link, che viene ripulito dal tracciamento).
import { html, raw, cap, safeUrl, hostOf, money, vibrate, timeAgo, uid } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { WISH_CATS } from '../data.js';
import { state, store, me, whoBadge, whoChoices, openSheet, closeSheet, toast, val, emptyState, ui, setUi, pageHead, swipe, settings, saveSettings, nameOf, sheetError, isSynced, confirmSheet } from '../core.js';

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
function hearts(n) {
  return html`<span class="hearts" title="Quanto lo vogliamo">${[1, 2, 3].map((i) => icon('heart', i <= (n || 1) ? '' : 'off'))}</span>`;
}

function item(w) {
  const link = safeUrl(w.link);
  const amz = link && amazonInfo(link);
  return html`<div class="wish ${w.bought ? 'done' : ''}" id="w-${w.id}"${swipe(w.id, ['wish-toggle', w.bought ? 'Non ancora' : 'Preso'], ['wish-del', 'Elimina'])}>
    <button class="check ${w.bought ? 'on' : ''}" data-action="wish-toggle" data-id="${w.id}" aria-label="${w.bought ? 'Non ancora comprato' : 'Comprato'}: ${w.title}">${icon('check')}</button>
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

function listeAmazon() {
  const liste = (settings().listeAmazon || []).filter((l) => l && safeUrl(l.url));
  if (!liste.length) return '';
  return html`<div class="amz-lists">${liste.map((l) => html`
    <div class="amz-list">
      <a class="amz-open" href="${safeUrl(l.url)}" target="_blank" rel="noopener">
        <span class="dot-ico tone-oak">${icon('gift', 'sm')}</span>
        <span class="row-main"><b>${l.nome || 'Lista Amazon'}</b><span>${l.chi && nameOf(l.chi) && !String(l.nome || '').includes(nameOf(l.chi)) ? `di ${nameOf(l.chi)} · ` : ''}apri su Amazon</span></span>
        ${icon('link', 'sm')}
      </a>
      <button class="icon-btn ghost" data-action="amz-list-edit" data-id="${l.id}" aria-label="Modifica ${l.nome || 'lista'}">${icon('pencil', 'sm')}</button>
    </div>`)}</div>`;
}

export function render() {
  const cat = ui('wish.cat', 'tutti');
  const all = state.data.desideri;
  const open = all.filter((w) => !w.bought && (cat === 'tutti' || w.cat === cat)).sort((a, b) => (b.prio || 1) - (a.prio || 1) || (b.createdAt || 0) - (a.createdAt || 0));
  const bought = all.filter((w) => w.bought).sort((a, b) => (b.boughtAt || 0) - (a.boughtAt || 0));
  const total = open.reduce((s, w) => s + (Number(w.price) || 0), 0);
  const cats = Object.keys(WISH_CATS).filter((c) => all.some((w) => w.cat === c && !w.bought));
  const showBought = ui('wish.showBought', false);

  return html`
    ${pageHead('Desideri', { eyebrow: 'Cose da comprare, prima o poi' })}
    <div class="card wish-sum">
      <div><p class="muted small" style="margin:0">${open.length} ${open.length === 1 ? 'desiderio' : 'desideri'}${cat !== 'tutti' ? ` · ${WISH_CATS[cat]}` : ''}</p><b>${money(total)}</b></div>
      <span class="dot-ico tone-rose" style="width:46px;height:46px;border-radius:14px;display:grid;place-items:center">${icon('gift', 'lg')}</span>
    </div>
    ${listeAmazon()}
    ${cats.length > 1 ? html`<div class="chips">
      <button class="chip ${cat === 'tutti' ? 'on' : ''}" data-action="wish-cat" data-v="tutti">Tutti</button>
      ${cats.map((c) => html`<button class="chip ${cat === c ? 'on' : ''}" data-action="wish-cat" data-v="${c}">${WISH_CATS[c]}</button>`)}
      <button class="chip add" data-action="amz-list-new">${icon('plus', 'xs')} Lista Amazon</button>
    </div>` : html`<div class="chips"><button class="chip add" data-action="amz-list-new">${icon('plus', 'xs')} Collega una lista Amazon</button></div>`}
    ${open.length ? html`<div class="list" style="margin-top:6px">${open.map(item)}</div>` : emptyState('Nessun desiderio', 'Aggiungi le cose che vorreste comprare per casa o per voi.', catFace('a'))}
    ${bought.length ? html`
      <div class="section-title"><span>Comprati · ${bought.length}</span><button class="card-link" data-action="wish-showbought">${showBought ? 'Nascondi' : 'Mostra'}</button></div>
      ${showBought ? html`<div class="list">${bought.slice(0, 40).map(item)}</div>` : ''}` : ''}
    <button class="fab" data-action="wish-new">${icon('plus')} Desiderio</button>`;
}

function sheet(w = null) {
  openSheet({
    title: w ? 'Modifica desiderio' : 'Nuovo desiderio',
    body: html`
      <label class="field"><span>Link <em class="opt">facoltativo</em></span><input name="link" type="url" inputmode="url" autocomplete="off" value="${w ? w.link || '' : ''}" placeholder="https://… (anche da Amazon: Condividi → Copia link)">
        <span class="help" id="wish-link-help"></span></label>
      <label class="field"><span>Cosa</span><input name="title" value="${w ? w.title : ''}" placeholder="es. Lampada per il comodino" required ${w ? '' : raw('autofocus')}></label>
      <div class="field-row">
        <label class="field"><span>Prezzo (€)</span><input name="price" type="text" inputmode="decimal" value="${w && w.price ? String(w.price).replace('.', ',') : ''}"></label>
        <label class="field"><span>Categoria</span><select name="cat">${Object.entries(WISH_CATS).map(([k, l]) => html`<option value="${k}" ${(w ? w.cat : 'casa') === k ? raw('selected') : ''}>${l}</option>`)}</select></label>
      </div>
      <div class="field"><span>Quanto lo vogliamo</span><div class="radio-chips">${[[1, 'Un giorno'], [2, 'Mi piacerebbe'], [3, 'Lo voglio!']].map(([v, l]) => html`
        <label><input type="radio" name="prio" value="${v}" ${(w ? w.prio || 1 : 2) === v ? raw('checked') : ''}><span>${hearts(v)} ${l}</span></label>`)}</div></div>
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
        if (a.tipo === 'lista') { help.textContent = 'Questo è il link di una lista: collegala con «Lista Amazon» nella pagina Desideri.'; return; }
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
      const data = { title, price, cat: val(fd, 'cat'), link, asin: a && a.asin ? a.asin : null, prio: Number(val(fd, 'prio')) || 2, for: val(fd, 'for'), note: val(fd, 'note') };
      if (w) store.update('desideri', w.id, data);
      else store.add('desideri', { ...data, bought: false, by: me() || '' });
    },
  });
}

function listaSheet(l = null) {
  const n = settings().names;
  openSheet({
    title: l ? 'Lista Amazon' : 'Collega una lista Amazon',
    body: html`
      <label class="field"><span>Link della lista</span><input name="url" type="url" inputmode="url" autocomplete="off" value="${l ? l.url : ''}" placeholder="Amazon → La tua lista → Condividi → Copia link" required ${l ? '' : raw('autofocus')}></label>
      <label class="field"><span>Nome</span><input name="nome" value="${l ? l.nome || '' : ''}" placeholder="es. Idee regalo di ${n[me() === 'p2' ? 'p2' : 'p1']}"></label>
      <div class="field"><span>Di chi</span>${whoChoices('chi', l ? l.chi : me() || 'both', { allowNone: false })}</div>`,
    extra: l ? html`<button class="btn danger" type="button" data-action="amz-list-del" data-id="${l.id}" aria-label="Scollega">${icon('trash', 'sm')}</button>` : '',
    submit: l ? 'Salva' : 'Collega',
    onSubmit: async (fd) => {
      const link = safeUrl(await linkVero(val(fd, 'url')));
      const a = link && amazonInfo(link);
      if (!a || a.tipo !== 'lista') { sheetError('Questo non sembra il link di una lista Amazon: aprila su Amazon, tocca Condividi e copia il link'); return false; }
      const chi = val(fd, 'chi') || 'both';
      const nome = cap(val(fd, 'nome')) || `Lista Amazon${chi !== 'both' ? ` di ${nameOf(chi)}` : ''}`;
      const liste = (settings().listeAmazon || []).filter((x) => x.id !== (l && l.id));
      saveSettings({ listeAmazon: [...liste, { id: l ? l.id : uid(), nome, url: a.url, chi }] });
      toast(l ? 'Lista aggiornata' : 'Lista collegata');
    },
  });
}

export const actions = {
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
  'amz-list-new': () => listaSheet(),
  'amz-list-edit': ({ id }) => { const l = (settings().listeAmazon || []).find((x) => x.id === id); if (l) listaSheet(l); },
  'amz-list-del': ({ id }) => {
    const l = (settings().listeAmazon || []).find((x) => x.id === id);
    closeSheet();
    if (!l) return;
    confirmSheet({ title: `Scollegare “${l.nome}”?`, text: 'La lista resta su Amazon: qui sparisce solo il collegamento.', yes: 'Scollega', onYes: () => saveSettings({ listeAmazon: (settings().listeAmazon || []).filter((x) => x.id !== id) }) });
  },
};
