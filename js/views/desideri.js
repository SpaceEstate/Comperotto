// Lista dei desideri: cose da comprare per casa, per noi, per i gatti
import { html, raw, cap, safeUrl, hostOf, money, vibrate, timeAgo } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { WISH_CATS } from '../data.js';
import { state, store, me, whoBadge, whoChoices, openSheet, closeSheet, toast, val, emptyState, ui, setUi, pageHead } from '../core.js';

function hearts(n) {
  return html`<span class="hearts" title="Quanto lo vogliamo">${[1, 2, 3].map((i) => icon('heart', i <= (n || 1) ? '' : 'off'))}</span>`;
}

function item(w) {
  const link = safeUrl(w.link);
  return html`<div class="wish ${w.bought ? 'done' : ''}" id="w-${w.id}">
    <button class="check ${w.bought ? 'on' : ''}" data-action="wish-toggle" data-id="${w.id}" aria-label="${w.bought ? 'Non ancora comprato' : 'Comprato'}: ${w.title}">${icon('check')}</button>
    <div class="row-main">
      <button class="row-edit" data-action="wish-edit" data-id="${w.id}" style="padding:0;width:100%">
        <div class="row-title" style="justify-content:space-between;flex-wrap:nowrap"><span style="${w.bought ? 'text-decoration:line-through;color:var(--text-3)' : ''}">${w.title}</span>${w.price ? html`<span class="price">${money(w.price)}</span>` : ''}</div>
        <div class="row-sub">${hearts(w.prio)}<span>${WISH_CATS[w.cat] || ''}</span>${w.for ? whoBadge(w.for) : ''}${w.bought && w.boughtAt ? html`<span>· preso ${timeAgo(w.boughtAt)}</span>` : ''}</div>
        ${w.note ? html`<div class="row-sub" style="margin-top:4px">${w.note}</div>` : ''}
      </button>
      ${link ? html`<div class="wish-actions"><a class="mini-btn" href="${link}" target="_blank" rel="noopener">${icon('link', 'xs')} ${hostOf(link) || 'Apri'}</a></div>` : ''}
    </div>
  </div>`;
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
    ${cats.length > 1 ? html`<div class="chips">
      <button class="chip ${cat === 'tutti' ? 'on' : ''}" data-action="wish-cat" data-v="tutti">Tutti</button>
      ${cats.map((c) => html`<button class="chip ${cat === c ? 'on' : ''}" data-action="wish-cat" data-v="${c}">${WISH_CATS[c]}</button>`)}
    </div>` : html`<div style="height:12px"></div>`}
    ${open.length ? html`<div class="list">${open.map(item)}</div>` : emptyState('Nessun desiderio', 'Aggiungi le cose che vorreste comprare per casa o per voi.', catFace('a'))}
    ${bought.length ? html`
      <div class="section-title"><span>Comprati · ${bought.length}</span><button class="card-link" data-action="wish-showbought">${showBought ? 'Nascondi' : 'Mostra'}</button></div>
      ${showBought ? html`<div class="list">${bought.slice(0, 40).map(item)}</div>` : ''}` : ''}
    <button class="fab" data-action="wish-new">${icon('plus')} Desiderio</button>`;
}

function sheet(w = null) {
  openSheet({
    title: w ? 'Modifica desiderio' : 'Nuovo desiderio',
    body: html`
      <label class="field"><span>Cosa</span><input name="title" value="${w ? w.title : ''}" placeholder="es. Lampada per il comodino" required ${w ? '' : raw('autofocus')}></label>
      <div class="field-row">
        <label class="field"><span>Prezzo (€)</span><input name="price" type="text" inputmode="decimal" value="${w && w.price ? w.price : ''}"></label>
        <label class="field"><span>Categoria</span><select name="cat">${Object.entries(WISH_CATS).map(([k, l]) => html`<option value="${k}" ${(w ? w.cat : 'casa') === k ? raw('selected') : ''}>${l}</option>`)}</select></label>
      </div>
      <label class="field"><span>Link</span><input name="link" type="url" inputmode="url" value="${w ? w.link || '' : ''}" placeholder="https://…"></label>
      <div class="field"><span>Quanto lo vogliamo</span><div class="radio-chips">${[[1, 'Un giorno'], [2, 'Mi piacerebbe'], [3, 'Lo voglio!']].map(([v, l]) => html`
        <label><input type="radio" name="prio" value="${v}" ${(w ? w.prio || 1 : 2) === v ? raw('checked') : ''}><span>${hearts(v)} ${l}</span></label>`)}</div></div>
      <div class="field"><span>Per chi</span>${whoChoices('for', w ? w.for : 'both', { allowNone: false })}</div>
      <label class="field"><span>Note</span><input name="note" value="${w ? w.note || '' : ''}" placeholder="Misure, colore, alternativa…"></label>`,
    extra: w ? html`<button class="btn danger" type="button" data-action="wish-del" data-id="${w.id}">${icon('trash', 'sm')}</button>` : '',
    onSubmit: (fd) => {
      const title = cap(val(fd, 'title'));
      if (!title) return false;
      const price = Number(val(fd, 'price').replace(',', '.'));
      const data = { title, price: price > 0 ? price : null, cat: val(fd, 'cat'), link: safeUrl(val(fd, 'link')), prio: Number(val(fd, 'prio')) || 2, for: val(fd, 'for'), note: val(fd, 'note') };
      if (w) store.update('desideri', w.id, data);
      else store.add('desideri', { ...data, bought: false, by: me() || '' });
    },
  });
}

export const actions = {
  'wish-cat': ({ el }) => setUi('wish.cat', el.dataset.v),
  'wish-showbought': () => setUi('wish.showBought', !ui('wish.showBought', false)),
  'wish-new': () => sheet(),
  'wish-edit': ({ id }) => sheet(state.data.desideri.find((w) => w.id === id)),
  'wish-toggle': ({ id }) => {
    const w = state.data.desideri.find((x) => x.id === id);
    if (!w) return;
    vibrate(12);
    store.update('desideri', id, { bought: !w.bought, boughtAt: w.bought ? null : Date.now(), boughtBy: w.bought ? null : me() || '' });
    if (!w.bought) toast(`Preso! ${w.title}`, { undo: () => store.update('desideri', id, { bought: false, boughtAt: null }) });
  },
  'wish-del': ({ id }) => {
    const w = state.data.desideri.find((x) => x.id === id);
    closeSheet();
    if (!w) return;
    store.remove('desideri', id);
    toast('Desiderio eliminato', { undo: () => { const { id: _, ...rest } = w; store.set('desideri', id, rest); } });
  },
};
