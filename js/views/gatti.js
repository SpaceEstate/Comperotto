// Thor e Minù: profili, peso, antiparassitari, vaccini, veterinario
import { html, raw, cap, todayIso, addDays, daysBetween, shortDate, relDay, ageFrom, resizeImage, safeImg, vibrate } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { CAT_EVENTS } from '../data.js';
import { state, store, openSheet, closeSheet, sheetError, toast, val, emptyState, me } from '../core.js';

export const cats = () => [...state.data.gatti].sort((a, b) => (a.id === 'thor' ? -1 : b.id === 'thor' ? 1 : a.name.localeCompare(b.name)));

export function catAvatar(c, cls = '') {
  const img = safeImg(c.photo);
  return html`<span class="avatar ${cls}">${img ? html`<img src="${img}" alt="${c.name}">` : catFace(c.color || 'a')}</span>`;
}

const eventsOf = (id) => state.data.eventiGatti.filter((e) => e.catId === id || e.catId === 'both');

/** Prossime scadenze (antiparassitario, vaccino…) per un gatto, o per entrambi. */
export function upcomingFor(id = null) {
  // per ogni tipo di evento conta solo l'ultimo registrato (con la sua prossima scadenza)
  const out = [];
  const list = cats().filter((c) => !id || c.id === id);
  list.forEach((c) => {
    const byType = {};
    eventsOf(c.id).forEach((e) => { if (e.next && (!byType[e.type] || e.date > byType[e.type].date)) byType[e.type] = e; });
    Object.values(byType).forEach((e) => out.push({ ...e, cat: c, days: daysBetween(todayIso(), e.next) }));
  });
  return out.sort((a, b) => a.days - b.days);
}

export function lastWeight(id) {
  const w = eventsOf(id).filter((e) => e.type === 'peso' && e.value).sort((a, b) => (a.date < b.date ? 1 : -1));
  return w[0] || null;
}

function weightSpark(id) {
  const pts = eventsOf(id).filter((e) => e.type === 'peso' && Number(e.value)).sort((a, b) => (a.date > b.date ? 1 : -1)).slice(-10);
  if (pts.length < 2) return '';
  const vals = pts.map((p) => Number(p.value));
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const W = 120, H = 32;
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${(i / (vals.length - 1)) * W},${H - 4 - ((v - min) / span) * (H - 8)}`).join(' ');
  return html`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="Andamento del peso" style="color:var(--oak)"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function dueLabel(days) {
  if (days < 0) return html`<span class="pill late">scaduto da ${-days} gg</span>`;
  if (days === 0) return html`<span class="pill today">oggi</span>`;
  if (days <= 7) return html`<span class="pill soon">tra ${days} gg</span>`;
  return html`<span class="pill">${relDay(addDays(todayIso(), days))}</span>`;
}

export function render() {
  const list = cats();
  const up = upcomingFor().filter((e) => e.days <= 45);
  const log = [...state.data.eventiGatti].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0))).slice(0, 25);
  return html`
    <div class="cat-cards">${list.map((c) => {
      const w = lastWeight(c.id);
      return html`<div class="card cat-card">
        <label class="cat-photo" aria-label="Cambia foto di ${c.name}">
          ${catAvatar(c, 'lg')}
          <span class="cam">${icon('camera')}</span>
          <input type="file" accept="image/*" hidden data-change="cat-photo" data-id="${c.id}">
        </label>
        <div style="flex:1;min-width:0">
          <h2>${c.name}</h2>
          <div class="cat-meta">
            ${c.birth ? html`<span class="pill">${icon('cake', 'xs')} ${ageFrom(c.birth)}</span>` : ''}
            ${w ? html`<span class="pill">${icon('scale', 'xs')} ${String(w.value).replace('.', ',')} kg</span>` : ''}
            ${c.breed ? html`<span class="pill">${c.breed}</span>` : ''}
          </div>
          ${weightSpark(c.id)}
        </div>
        <button class="icon-btn ghost" data-action="cat-edit" data-id="${c.id}" aria-label="Modifica ${c.name}">${icon('pencil', 'sm')}</button>
      </div>`;
    })}</div>

    <div class="section-title"><span>Prossime scadenze</span></div>
    ${up.length ? html`<div class="list">${up.map((e) => html`
      <div class="row">
        ${catAvatar(e.cat)}
        <div class="row-main"><div class="row-title">${CAT_EVENTS[e.type] ? CAT_EVENTS[e.type].label : e.type}</div><div class="row-sub">${e.cat.name} · ${shortDate(e.next)}</div></div>
        ${dueLabel(e.days)}
        <button class="done-btn ${e.days <= 0 ? 'due' : ''}" data-action="cat-repeat" data-id="${e.id}" data-cat="${e.cat.id}" aria-label="Fatto oggi">${icon('check', 'sm')}</button>
      </div>`)}</div>`
      : html`<div class="card"><p class="muted small" style="margin:0">Nessuna scadenza nelle prossime settimane. Registra antiparassitario e vaccini qui sotto: vi ricordo io quando rifarli.</p></div>`}

    <div class="section-title"><span>Diario</span></div>
    ${log.length ? html`<div class="list">${log.map((e) => {
      const ev = CAT_EVENTS[e.type] || CAT_EVENTS.altro;
      const c = e.catId === 'both' ? null : list.find((x) => x.id === e.catId);
      return html`<button class="row" data-action="cat-event-edit" data-id="${e.id}">
        <span class="chore-ico dot-ico tone-plum">${icon(ev.icon)}</span>
        <span class="row-main"><span class="row-title">${ev.label}${e.type === 'peso' && e.value ? ` · ${String(e.value).replace('.', ',')} kg` : ''}</span>
        <span class="row-sub">${c ? c.name : 'Thor e Minù'} · ${shortDate(e.date)}${e.note ? ` · ${e.note}` : ''}</span></span>
      </button>`;
    })}</div>` : emptyState('Diario vuoto', 'Pesate, vaccini, visite… tutto in un posto.', catFace('a'))}

    <button class="fab" data-action="cat-event-new">${icon('paw')} Registra</button>`;
}

function catSheet(c) {
  openSheet({
    title: c.name,
    body: html`
      <label class="field"><span>Nome</span><input name="name" value="${c.name}" required></label>
      <div class="field-row">
        <label class="field"><span>Nato il</span><input name="birth" type="date" value="${c.birth || ''}"></label>
        <label class="field"><span>Razza</span><input name="breed" value="${c.breed || ''}" placeholder="es. Neva Masquerade"></label>
      </div>
      <label class="field"><span>Cibo preferito / dosi</span><input name="food" value="${c.food || ''}"></label>
      <label class="field"><span>Microchip</span><input name="chip" value="${c.chip || ''}" inputmode="numeric"></label>
      <label class="field"><span>Note (veterinario, allergie, manie…)</span><textarea name="note" style="min-height:80px">${c.note || ''}</textarea></label>
      ${c.photo ? html`<button class="btn danger block" type="button" data-action="cat-photo-del" data-id="${c.id}" style="margin-bottom:10px">${icon('trash', 'sm')} Togli la foto</button>` : ''}`,
    onSubmit: (fd) => {
      const name = cap(val(fd, 'name'));
      if (!name) return false;
      store.update('gatti', c.id, { name, birth: val(fd, 'birth'), breed: val(fd, 'breed'), food: val(fd, 'food'), chip: val(fd, 'chip'), note: val(fd, 'note') });
    },
  });
}

function eventSheet(e = null, preset = {}) {
  const d = e || preset;
  const list = cats();
  openSheet({
    title: e ? 'Modifica' : 'Registra',
    body: html`
      <div class="field"><span>Per chi</span><div class="radio-chips">
        ${list.map((c) => html`<label><input type="radio" name="catId" value="${c.id}" ${(d.catId || list[0]?.id) === c.id ? raw('checked') : ''}><span>${c.name}</span></label>`)}
        <label><input type="radio" name="catId" value="both" ${d.catId === 'both' ? raw('checked') : ''}><span>Entrambi</span></label>
      </div></div>
      <div class="field"><span>Cosa</span><div class="radio-chips">${Object.entries(CAT_EVENTS).map(([k, v]) => html`
        <label><input type="radio" name="type" value="${k}" ${(d.type || 'peso') === k ? raw('checked') : ''}><span>${icon(v.icon, 'xs')} ${v.label}</span></label>`)}</div></div>
      <div class="field-row">
        <label class="field"><span>Quando</span><input name="date" type="date" value="${d.date || todayIso()}"></label>
        <label class="field"><span>Peso (kg)</span><input name="value" type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" value="${d.value || ''}" placeholder="solo per il peso"></label>
      </div>
      <label class="field"><span>Da rifare il</span><input name="next" type="date" value="${d.next || ''}">
        <p class="help">Lascia vuoto per calcolarlo da solo (antiparassitario 30 gg, vermifugo 90, vaccino 1 anno).</p></label>
      <label class="field"><span>Nota</span><input name="note" value="${d.note || ''}" placeholder="es. prodotto usato, cosa ha detto il veterinario"></label>`,
    extra: e ? html`<button class="btn danger" type="button" data-action="cat-event-del" data-id="${e.id}">${icon('trash', 'sm')}</button>` : '',
    onSubmit: (fd) => {
      const type = val(fd, 'type') || 'altro';
      const date = val(fd, 'date') || todayIso();
      let next = val(fd, 'next');
      const every = (CAT_EVENTS[type] || {}).every;
      if (!next && every && (!e || !e.next)) next = addDays(date, every);
      const value = Number(val(fd, 'value').replace(',', '.')) || null;
      if (type === 'peso' && !value) { sheetError('Scrivi il peso in kg'); return false; }
      const data = { catId: val(fd, 'catId') || 'thor', type, date, next: next || null, value: type === 'peso' ? value : null, note: val(fd, 'note') };
      if (e) store.update('eventiGatti', e.id, data);
      else { store.add('eventiGatti', { ...data, by: me() || '' }); vibrate(12); }
    },
  });
}

export const actions = {
  'cat-edit': ({ id }) => { const c = state.data.gatti.find((x) => x.id === id); if (c) catSheet(c); },
  'cat-photo': async ({ el }) => {
    const f = el.files && el.files[0];
    if (!f) return;
    try { store.update('gatti', el.dataset.id, { photo: await resizeImage(f, 480, 0.8) }); toast('Che bella foto!'); }
    catch { toast('Foto non valida'); }
  },
  'cat-photo-del': ({ id }) => { store.update('gatti', id, { photo: '' }); closeSheet(); },
  'cat-event-new': () => eventSheet(),
  'cat-event-edit': ({ id }) => { const e = state.data.eventiGatti.find((x) => x.id === id); if (e) eventSheet(e); },
  'cat-repeat': ({ id, el }) => {
    const e = state.data.eventiGatti.find((x) => x.id === id);
    if (!e) return;
    const every = (CAT_EVENTS[e.type] || {}).every || (e.next && e.date ? daysBetween(e.date, e.next) : 0);
    const t = todayIso();
    store.add('eventiGatti', { catId: e.catId === 'both' ? 'both' : el.dataset.cat || e.catId, type: e.type, date: t, next: every > 0 ? addDays(t, every) : null, value: null, note: '', by: me() || '' });
    vibrate(12);
    toast(`${CAT_EVENTS[e.type] ? CAT_EVENTS[e.type].label : 'Fatto'} registrato`);
  },
  'cat-event-del': ({ id }) => {
    const e = state.data.eventiGatti.find((x) => x.id === id);
    closeSheet();
    if (!e) return;
    store.remove('eventiGatti', id);
    toast('Eliminato', { undo: () => { const { id: _, ...rest } = e; store.set('eventiGatti', id, rest); } });
  },
};
