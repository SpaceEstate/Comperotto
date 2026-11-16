// Lista della spesa
import { html, raw, norm, cap, parseQty, timeAgo, vibrate, plural } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { SHOP_CATS, normCat, classify } from '../data.js';
import { state, store, me, whoBadge, openSheet, toast, val, emptyState, closeSheet, swipe } from '../core.js';

// Reparto: quello scelto a mano (per quel prodotto o ricordato dalle volte prima), altrimenti indovinato dal nome
const learnedCat = (name) => {
  const f = state.data.freq.find((x) => x.id === freqId(cleanName(name)));
  return f && f.catManual ? normCat(f.category) : null;
};
const catOf = (it) => (it.catManual && it.category ? normCat(it.category) : learnedCat(it.name) || classify(cleanName(it.name)));

// "il latte" → "Latte": niente articoli, sempre con la maiuscola
const ART = /^(?:(?:il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle)\s+|(?:l|un|dell|d)['’]\s*)/i;
export const cleanName = (s) => cap(String(s || '').trim().replace(ART, '').trim());
const keyOf = (s) => norm(cleanName(s));
const freqId = (name) => norm(name).replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'x';

/**
 * Aggiunge alla spesa senza doppioni:
 *  - già da comprare → non lo aggiunge (aggiorna solo la quantità se indicata)
 *  - già spuntato in passato → lo toglie dal carrello e lo rimette da comprare
 * Restituisce i nomi aggiunti; in .already quelli che c'erano già.
 */
export function addShopping(text, extra = {}) {
  const items = state.data.spesa;
  const added = [];
  added.already = [];
  const seen = new Set();
  String(text).split(/\s*[,;\n]\s*/).filter(Boolean).forEach((part) => {
    const { qty, name } = parseQty(part);
    const clean = cleanName(name);
    if (!clean) return;
    const n = norm(clean);
    if (seen.has(n)) return;
    seen.add(n);
    const q = extra.qty || qty;
    // dalle ricette: "uova freschissime" vale come "uova" se è già in lista
    const loose = (x) => extra.recipe && (n.startsWith(x + ' ') || x.startsWith(n + ' '));
    const same = items.filter((i) => keyOf(i.name) === n || loose(keyOf(i.name)));
    const open = same.filter((i) => !i.done);
    if (open.length) {
      if (q && open[0].qty !== q) store.update('spesa', open[0].id, { qty: q });
      added.already.push(clean);
      return;
    }
    if (same.length) {
      // era nel carrello: torna da comprare, e nel carrello non resta niente
      const [keep, ...extraDone] = [...same].sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      store.update('spesa', keep.id, { name: clean, done: false, doneAt: null, qty: q || '', by: me() || '', source: extra.source || 'app', ...(extra.recipe ? { recipe: extra.recipe } : {}) });
      extraDone.forEach((i) => store.remove('spesa', i.id));
    } else {
      store.add('spesa', { name: clean, done: false, by: me() || '', source: 'app', ...extra, qty: q });
    }
    store.bump('freq', freqId(clean), { name: clean });
    added.push(clean);
  });
  return added;
}

/** Sistema la lista se ci sono doppioni o nomi senza maiuscola (es. aggiunti prima di questa regola). */
export function tidyShopping() {
  const groups = {};
  state.data.spesa.forEach((i) => { (groups[keyOf(i.name)] ||= []).push(i); });
  Object.values(groups).forEach((g) => {
    let keep = g[0];
    if (g.length > 1) {
      const open = g.filter((i) => !i.done).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id)));
      keep = open[0] || [...g].sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0) || String(a.id).localeCompare(String(b.id)))[0];
      g.forEach((i) => { if (i.id !== keep.id) store.remove('spesa', i.id); });
    }
    const nice = cleanName(keep.name);
    if (nice && nice !== keep.name) store.update('spesa', keep.id, { name: nice });
  });
}

export function render() {
  const items = state.data.spesa;
  const todo = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const inList = new Set(todo.map((i) => norm(i.name)));
  const frequent = [...state.data.freq]
    .filter((f) => f.name && !inList.has(norm(f.name)))
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 14);

  const groups = SHOP_CATS.map((c) => ({ ...c, items: todo.filter((i) => catOf(i) === c.id).sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name), 'it', { sensitivity: 'base' })) })).filter((g) => g.items.length);

  const total = todo.length + done.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  return html`
    ${total ? html`<div class="shop-progress">
      <div><b>${todo.length ? plural(todo.length, 'cosa da prendere', 'cose da prendere') : 'Tutto nel carrello!'}</b>
        <span>${done.length ? `${done.length} già nel carrello` : 'Buona spesa'}</span></div>
      <i class="bar"><i style="width:${pct}%"></i></i>
    </div>` : ''}

    <form class="quick-add" data-form="spesa-add">
      <input id="spesa-input" name="q" placeholder="Aggiungi… (es. 2 latte, uova)" enterkeyhint="done" autocomplete="off" aria-label="Aggiungi alla spesa">
      <button type="submit" aria-label="Aggiungi">${icon('plus')}</button>
    </form>

    ${frequent.length ? html`<div class="chips" aria-label="Spesso comprati">
      ${frequent.map((f) => html`<button class="chip" data-action="spesa-quick" data-name="${f.name}">${icon('plus', 'xs')} ${f.name}</button>`)}
    </div>` : ''}

    ${!todo.length && !done.length ? emptyState('Frigo pieno, lista vuota', 'Scrivi qui sopra cosa serve.', catFace('a')) : ''}

    <div class="shop-groups">${groups.map((g) => html`<section class="shop-group">
      <div class="cat-head" style="--c:${g.color}"><i></i>${g.label}<span class="cat-n">${g.items.length}</span></div>
      <div class="list">
        ${g.items.map((it) => html`
          <div class="row" id="s-${it.id}"${swipe(it.id, ['spesa-toggle', 'Preso'], ['spesa-del', 'Elimina'])}>
            <button class="check" data-action="spesa-toggle" data-id="${it.id}" aria-label="Preso ${it.name}">${icon('check')}</button>
            <button class="row-edit" data-action="spesa-edit" data-id="${it.id}">
              <div class="row-title">${cleanName(it.name)} ${it.qty ? html`<span class="muted" style="font-weight:500">· ${it.qty}</span>` : ''}</div>
              ${it.note || it.recipe ? html`<div class="row-sub">
                ${it.note ? html`<span>${it.note}</span>` : ''}
                ${it.recipe ? html`<span>per ${it.recipe}</span>` : ''}
              </div>` : ''}
            </button>
            ${whoBadge(it.by)}
          </div>`)}
      </div></section>`)}</div>

    ${done.length ? html`
      <div class="section-title"><span>Nel carrello · ${done.length}</span>
        <button class="card-link" data-action="spesa-clear">Svuota</button></div>
      <div class="list">
        ${done.slice(0, 30).map((it) => html`
          <div class="row done" id="sd-${it.id}"${swipe(it.id, ['spesa-toggle', 'Rimetti'], ['spesa-del', 'Elimina'])}>
            <button class="check on" data-action="spesa-toggle" data-id="${it.id}" aria-label="Rimetti ${it.name}">${icon('check')}</button>
            <div class="row-main"><div class="row-title">${cleanName(it.name)}</div><div class="row-sub">${timeAgo(it.doneAt)}</div></div>
          </div>`)}
      </div>` : ''}
  `;
}

function editSheet(it) {
  openSheet({
    title: 'Modifica',
    body: html`
      <label class="field"><span>Cosa</span><input name="name" value="${it.name}" required></label>
      <div class="field-row">
        <label class="field"><span>Quantità</span><input name="qty" value="${it.qty || ''}" placeholder="es. 2, 500 g"></label>
        <label class="field"><span>Reparto</span><select name="category">
          ${SHOP_CATS.map((c) => html`<option value="${c.id}" ${c.id === catOf(it) ? raw('selected') : ''}>${c.label}</option>`)}
        </select></label>
      </div>
      <label class="field"><span>Nota</span><input name="note" value="${it.note || ''}" placeholder="es. quello senza lattosio"></label>`,
    extra: html`<button class="btn danger" type="button" data-action="spesa-del" data-id="${it.id}">${icon('trash', 'sm')}</button>`,
    onSubmit: (fd) => {
      const name = cleanName(val(fd, 'name'));
      if (!name) return false;
      const cat = val(fd, 'category');
      const manual = cat !== classify(name);
      store.update('spesa', it.id, { name, qty: val(fd, 'qty'), category: cat, catManual: manual, note: val(fd, 'note') });
      // la prossima volta che si aggiunge questo prodotto va già nel reparto giusto
      if (cat !== catOf(it) || manual) store.update('freq', freqId(name), { name, category: cat, catManual: manual });
    },
  });
}

export const actions = {
  'spesa-add': ({ form }) => {
    const input = form.querySelector('input');
    const added = addShopping(input.value);
    input.value = '';
    if (added.length) vibrate();
    if (added.already.length) toast(`${added.already.join(', ')}: ${added.already.length > 1 ? 'ci sono già' : 'c’è già'} in lista`);
  },
  'spesa-quick': ({ el }) => { addShopping(el.dataset.name); vibrate(); },
  'spesa-toggle': ({ id, el }) => {
    const it = state.data.spesa.find((i) => i.id === id);
    if (!it) return;
    vibrate();
    const row = el.closest('.row');
    if (!it.done && row) {
      // un attimo di soddisfazione: spunta, barra, poi va nel carrello
      el.classList.add('on', 'pop');
      row.classList.add('checking');
      setTimeout(() => store.update('spesa', id, { done: true, doneAt: Date.now() }), 380);
      return;
    }
    store.update('spesa', id, { done: !it.done, doneAt: !it.done ? Date.now() : null });
  },
  'spesa-edit': ({ id }) => { const it = state.data.spesa.find((i) => i.id === id); if (it) editSheet(it); },
  'spesa-del': ({ id }) => {
    const it = state.data.spesa.find((i) => i.id === id);
    closeSheet();
    if (!it) return;
    store.remove('spesa', id);
    toast(`Tolto: ${it.name}`, { undo: () => { const { id: _, ...rest } = it; store.set('spesa', id, rest); } });
  },
  'spesa-clear': () => {
    const done = state.data.spesa.filter((i) => i.done);
    done.forEach((i) => store.remove('spesa', i.id));
    toast(`Carrello svuotato (${done.length})`, { undo: () => done.forEach(({ id, ...rest }) => store.set('spesa', id, rest)) });
  },
};

export const badge = () => state.data.spesa.filter((i) => !i.done).length;
export { catOf };
