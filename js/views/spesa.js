// Lista della spesa
import { html, raw, norm, cap, parseQty, timeAgo, vibrate, plural } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { SHOP_CATS, shopCat, classify } from '../data.js';
import { ALEXA_INVOCATION } from '../config.js';
import { state, store, me, whoBadge, openSheet, toast, val, pageHead, emptyState, confirmSheet, closeSheet, isCloud } from '../core.js';

const catOf = (it) => it.category || classify(it.name);

export function addShopping(text, extra = {}) {
  const items = state.data.spesa;
  const added = [];
  String(text).split(/\s*[,;\n]\s*/).filter(Boolean).forEach((part) => {
    const { qty, name } = parseQty(part);
    const clean = cap(name);
    if (!clean) return;
    const n = norm(clean);
    // dalle ricette: "uova freschissime" vale come "uova" se è già in lista
    const loose = (x) => extra.recipe && (n.startsWith(x + ' ') || x.startsWith(n + ' '));
    const dup = items.find((i) => !i.done && (norm(i.name) === n || loose(norm(i.name))));
    if (dup) {
      const q = extra.qty || qty;
      if (q && dup.qty !== q) store.update('spesa', dup.id, { qty: q });
      return;
    }
    store.add('spesa', { name: clean, category: classify(clean), done: false, by: me() || '', source: 'app', ...extra, qty: extra.qty || qty });
    store.bump('freq', norm(clean).replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'x', { name: clean, category: classify(clean) });
    added.push(clean);
  });
  return added;
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

  const groups = SHOP_CATS.map((c) => ({ ...c, items: todo.filter((i) => catOf(i) === c.id).sort((a, b) => a.name.localeCompare(b.name, 'it')) })).filter((g) => g.items.length);

  return html`
    ${pageHead('Spesa', { eyebrow: todo.length ? plural(todo.length, 'cosa da prendere', 'cose da prendere') : 'Lista vuota', actions: done.length || todo.length ? html`<button class="icon-btn" data-action="spesa-menu" aria-label="Altre azioni">${icon('sliders')}</button>` : '' })}

    <form class="quick-add" data-form="spesa-add">
      <input id="spesa-input" name="q" placeholder="Aggiungi… (es. 2 latte, uova)" enterkeyhint="done" autocomplete="off" aria-label="Aggiungi alla spesa">
      <button type="submit" aria-label="Aggiungi">${icon('plus')}</button>
    </form>

    ${frequent.length ? html`<div class="chips" aria-label="Spesso comprati">
      ${frequent.map((f) => html`<button class="chip" data-action="spesa-quick" data-name="${f.name}">${icon('plus', 'xs')} ${f.name}</button>`)}
    </div>` : ''}

    ${!todo.length && !done.length ? emptyState('Frigo pieno, lista vuota', 'Scrivi qui sopra oppure chiedilo ad Alexa.', catFace('a')) : ''}

    ${groups.map((g) => html`
      <div class="cat-head"><i style="background:${g.color}"></i>${g.label}<span class="muted" style="margin-left:auto">${g.items.length}</span></div>
      <div class="list">
        ${g.items.map((it) => html`
          <div class="row" id="s-${it.id}">
            <button class="check" data-action="spesa-toggle" data-id="${it.id}" aria-label="Preso ${it.name}">${icon('check')}</button>
            <button class="row-edit" data-action="spesa-edit" data-id="${it.id}">
              <div class="row-title">${it.name} ${it.qty ? html`<span class="muted" style="font-weight:500">· ${it.qty}</span>` : ''}</div>
              ${it.note || it.source === 'alexa' || it.by ? html`<div class="row-sub">
                ${it.source === 'alexa' ? html`<span class="pill alexa">${icon('mic', 'xs')} Alexa</span>` : ''}
                ${it.note ? html`<span>${it.note}</span>` : ''}
                ${it.recipe ? html`<span>per ${it.recipe}</span>` : ''}
              </div>` : ''}
            </button>
            ${whoBadge(it.by)}
          </div>`)}
      </div>`)}

    ${done.length ? html`
      <div class="section-title"><span>Nel carrello · ${done.length}</span>
        <button class="card-link" data-action="spesa-clear">Svuota</button></div>
      <div class="list">
        ${done.slice(0, 30).map((it) => html`
          <div class="row done">
            <button class="check on" data-action="spesa-toggle" data-id="${it.id}" aria-label="Rimetti ${it.name}">${icon('check')}</button>
            <div class="row-main"><div class="row-title">${it.name}</div><div class="row-sub">${timeAgo(it.doneAt)}</div></div>
          </div>`)}
      </div>` : ''}

    <div class="hint">${icon('mic', 'sm')}<div>
      ${isCloud
        ? html`Con Alexa: <b>«Alexa, chiedi a ${ALEXA_INVOCATION} di aggiungere il latte»</b>. Le cose aggiunte a voce hanno il bollino <span class="pill alexa">${icon('mic', 'xs')} Alexa</span>.`
        : html`Per usarla con Alexa e condividerla tra i vostri telefoni collega Firebase (vedi <b>Impostazioni</b>).`}
    </div></div>
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
      const name = cap(val(fd, 'name'));
      if (!name) return false;
      store.update('spesa', it.id, { name, qty: val(fd, 'qty'), category: val(fd, 'category'), note: val(fd, 'note') });
    },
  });
}

export const actions = {
  'spesa-add': ({ form }) => {
    const input = form.querySelector('input');
    const added = addShopping(input.value);
    input.value = '';
    if (added.length) vibrate();
  },
  'spesa-quick': ({ el }) => { addShopping(el.dataset.name); vibrate(); },
  'spesa-toggle': ({ id, el }) => {
    const it = state.data.spesa.find((i) => i.id === id);
    if (!it) return;
    el.classList.add('pop');
    vibrate();
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
  'spesa-menu': () => {
    openSheet({
      title: 'Lista della spesa',
      body: html`<div class="list">
        <button class="set-row" data-action="spesa-copy">${icon('note')}<div class="row-main"><b>Copia la lista</b><span>Da incollare in chat o in un’altra app</span></div></button>
        <button class="set-row" data-action="spesa-clear-all">${icon('trash')}<div class="row-main"><b>Cancella tutta la lista</b><span>Anche le cose ancora da prendere</span></div></button>
      </div>`,
    });
  },
  'spesa-copy': async () => {
    const todo = state.data.spesa.filter((i) => !i.done);
    const text = SHOP_CATS.map((c) => {
      const its = todo.filter((i) => catOf(i) === c.id);
      return its.length ? `${c.label}\n${its.map((i) => `• ${i.name}${i.qty ? ` (${i.qty})` : ''}`).join('\n')}` : '';
    }).filter(Boolean).join('\n\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Lista della spesa', text });
      else { await navigator.clipboard.writeText(text); toast('Lista copiata'); }
    } catch {}
    closeSheet();
  },
  'spesa-clear-all': () => {
    confirmSheet({
      title: 'Cancellare tutta la lista?', text: 'Toglie tutte le voci, anche quelle non ancora prese.', yes: 'Cancella tutto',
      onYes: () => {
        const all = [...state.data.spesa];
        all.forEach((i) => store.remove('spesa', i.id));
        toast('Lista cancellata', { undo: () => all.forEach(({ id, ...rest }) => store.set('spesa', id, rest)) });
      },
    });
  },
};

export const badge = () => state.data.spesa.filter((i) => !i.done).length;
export { catOf };
