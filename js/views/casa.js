// Casa: faccende ricorrenti, lavori da fare, calendario rifiuti
import { render as spesaRender, tidyShopping } from './spesa.js';
import { html, raw, lsGet, lsSet, todayIso, shortDate, parseIso, WEEKDAYS, WEEKDAYS_SHORT, addDays, vibrate, cap, timeAgo } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { ROOMS, CHORE_ICONS, CHORE_TONES, BINS, BIN_IDS, choreStatus, freqLabel } from '../data.js';
import { state, store, me, nameOf, whoBadge, whoChoices, openSheet, closeSheet, toast, val, pageHead, emptyState, settings, saveSettings, ui, setUi, confirmSheet, swipe, sheetError } from '../core.js';

export const sortedChores = () => state.data.routine
  .map((c) => ({ ...c, st: choreStatus(c) }))
  .sort((a, b) => a.st.n - b.st.n || a.title.localeCompare(b.title, 'it'));

export const dueChores = () => sortedChores().filter((c) => c.st.n <= 0);

export function trashFor(dateIso = todayIso()) {
  const day = parseIso(dateIso).getDay();
  return (settings().rifiuti[day] || []).filter((b) => BINS[b]);
}

export function binChips(list) {
  return list.map((b) => html`<span class="bin-chip"><i style="background:${BINS[b].color}"></i>${BINS[b].short || BINS[b].label}</span>`);
}

export function choreRow(c, { compact = false } = {}) {
  const tone = CHORE_TONES[c.icon] || 'oak';
  const fresh = c.lastDone === todayIso();
  return html`
    <div class="chore" id="c-${c.id}"${fresh ? '' : swipe(c.id, ['chore-done', 'Fatto'])}>
      <span class="chore-ico tone-${tone} dot-ico">${icon(c.icon || 'sparkles')}</span>
      <button class="row-edit" data-action="chore-edit" data-id="${c.id}">
        <div class="row-title">${c.title}</div>
        <div class="row-sub">
          ${fresh ? html`<span class="pill ok">fatto oggi${c.lastBy ? ` da ${nameOf(c.lastBy)}` : ''}</span>` : html`<span class="pill ${c.st.cls}">${c.st.label}</span>`}
          ${compact ? '' : html`<span>${freqLabel(c.freq)}</span>`}
          ${c.who ? whoBadge(c.who) : ''}
        </div>
      </button>
      <button class="done-btn ${fresh ? 'fresh' : c.st.n <= 0 ? 'due' : ''}" data-action="chore-done" data-id="${c.id}" aria-label="Segna come fatto: ${c.title}">
        ${icon('check', 'sm')}${fresh ? '' : ' Fatto'}
      </button>
    </div>`;
}

function trashCard() {
  const s = settings();
  const tonight = trashFor();
  const tomorrow = trashFor(addDays(todayIso(), 1));
  const done = s.rifiutiFatto && s.rifiutiFatto.date === todayIso();
  return html`<div class="card">
    <div class="card-head">
      <h3 class="card-title"><span class="dot-ico tone-taupe">${icon('bin', 'sm')}</span>Stasera si butta</h3>
      ${tonight.length ? html`<button class="done-btn ${done ? 'fresh' : 'due'}" data-action="trash-done">${icon('check', 'sm')} ${done ? `Fatto${s.rifiutiFatto.by ? ` · ${nameOf(s.rifiutiFatto.by)}` : ''}` : 'Fatto'}</button>` : ''}
    </div>
    ${tonight.length ? html`<div class="trash-tonight">${binChips(tonight)}</div>` : html`<p class="muted small" style="margin:0">Niente stasera: serata libera.</p>`}
    ${tomorrow.length ? html`<p class="muted small" style="margin:10px 0 0">Domani sera: ${tomorrow.map((b) => BINS[b].short || BINS[b].label).join(', ')}</p>` : ''}
  </div>`;
}

function renderRoutine() {
  const list = sortedChores();
  return html`
    ${trashCard()}
    <div class="section-title"><span>Faccende</span><span>${list.filter((c) => c.st.n <= 0 && c.lastDone !== todayIso()).length} da fare oggi</span></div>
    ${list.length ? html`<div class="list">${list.map((c) => choreRow(c))}</div>` : emptyState('Nessuna faccenda', 'Aggiungi le cose da fare regolarmente: lavatrice, lettiera, lenzuola…', catFace('b'))}
    <button class="fab" data-action="chore-new">${icon('plus')} Faccenda</button>`;
}

function renderLavori() {
  const room = ui('lavori.room', 'Tutte');
  const all = state.data.lavori;
  const rooms = ['Tutte', ...ROOMS.filter((r) => all.some((l) => l.room === r && !l.done))];
  const open = all.filter((l) => !l.done && (room === 'Tutte' || l.room === room)).sort((a, b) => (b.prio || 1) - (a.prio || 1) || (a.createdAt || 0) - (b.createdAt || 0));
  const done = all.filter((l) => l.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const showDone = ui('lavori.showDone', false);
  return html`
    ${rooms.length > 2 ? html`<div class="chips" style="margin-top:0">${rooms.map((r) => html`<button class="chip ${r === room ? 'on' : ''}" data-action="lavori-room" data-room="${r}">${r}</button>`)}</div>` : ''}
    ${open.length ? html`<div class="list" style="margin-top:8px">${open.map((l) => html`
      <div class="row" id="l-${l.id}"${swipe(l.id, ['lavoro-toggle', 'Fatto'], ['lavoro-del', 'Elimina'])}>
        <button class="check sq" data-action="lavoro-toggle" data-id="${l.id}" aria-label="Completa ${l.title}">${icon('check')}</button>
        <button class="row-edit" data-action="lavoro-edit" data-id="${l.id}">
          <div class="row-title"><span class="prio p${l.prio || 1}"></span>${l.title}</div>
          ${l.room ? html`<div class="row-sub"><span>${icon('door', 'xs')} ${l.room}</span></div>` : ''}
          ${l.note ? html`<div class="row-sub">${l.note}</div>` : ''}
        </button>
        ${whoBadge(l.who)}
      </div>`)}</div>`
      : emptyState('Tutto sistemato!', 'Nessun lavoro in sospeso. Goditi il divano.', catFace('a'))}
    ${done.length ? html`
      <div class="section-title"><span>Completati · ${done.length}</span><button class="card-link" data-action="lavori-showdone">${showDone ? 'Nascondi' : 'Mostra'}</button></div>
      ${showDone ? html`<div class="list">${done.slice(0, 40).map((l) => html`
        <div class="row done" id="ld-${l.id}"${swipe(l.id, ['lavoro-toggle', 'Riapri'], ['lavoro-del', 'Elimina'])}>
          <button class="check sq on" data-action="lavoro-toggle" data-id="${l.id}" aria-label="Riapri ${l.title}">${icon('check')}</button>
          <button class="row-edit" data-action="lavoro-edit" data-id="${l.id}"><div class="row-title">${l.title}</div><div class="row-sub">${l.doneAt ? timeAgo(l.doneAt) : ''}${l.doneBy ? ` · ${nameOf(l.doneBy)}` : ''}</div></button>
        </div>`)}</div>` : ''}` : ''}
    <button class="fab" data-action="lavoro-new">${icon('plus')} Lavoro</button>`;
}

function renderRifiuti() {
  const s = settings();
  const today = parseIso(todayIso()).getDay();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const sel = ui('rifiuti.day', today);
  return html`
    <p class="muted small" style="margin:0 2px 12px">Le sere in cui si porta fuori il sacchetto. Tocca un giorno per cambiarlo.</p>
    <div class="week">${order.map((d) => html`
      <button class="day ${d === today ? 'today' : ''}" data-action="rifiuti-day" data-day="${d}" style="${d === sel ? 'border-color:var(--text)' : ''}">
        <b>${WEEKDAYS_SHORT[d]}</b>
        <div class="bins">${(s.rifiuti[d] || []).filter((b) => BINS[b]).map((b) => html`<i style="background:${BINS[b].color}" title="${BINS[b].label}"></i>`)}</div>
      </button>`)}</div>
    <div class="card" style="margin-top:14px">
      <h3 class="card-title">${cap(WEEKDAYS[sel])} sera</h3>
      <div class="bin-legend">${BIN_IDS.map((b) => html`
        <button class="bin-toggle ${(s.rifiuti[sel] || []).includes(b) ? 'on' : ''}" data-action="rifiuti-toggle" data-day="${sel}" data-bin="${b}">
          <i style="background:${BINS[b].color}"></i>${BINS[b].label}
        </button>`)}</div>
    </div>
    <p class="muted small" style="margin:14px 4px 0">Ogni sera la Home vi ricorda cosa portare fuori.</p>`;
}

const SECTIONS = {
  spesa: { label: 'Spesa', icon: 'basket', eyebrow: 'La lista della spesa' },
  faccende: { label: 'Faccende', icon: 'repeat', eyebrow: 'Le cose di tutti i giorni' },
  lavori: { label: 'Lavori', icon: 'hammer', eyebrow: 'Da sistemare in casa' },
  rifiuti: { label: 'Rifiuti', icon: 'bin', eyebrow: 'Il calendario della raccolta' },
};

export function render(route) {
  let tab = route[1];
  if (SECTIONS[tab]) lsSet('casa.tab', tab);
  else tab = SECTIONS[lsGet('casa.tab')] ? lsGet('casa.tab') : 'spesa';
  const due = dueChores().filter((c) => c.lastDone !== todayIso()).length;
  const shop = state.data.spesa.filter((i) => !i.done).length;
  const counts = { spesa: shop, faccende: due };
  return html`
    ${pageHead('Casa', { eyebrow: SECTIONS[tab].eyebrow })}
    <nav class="segmented seg-icons" aria-label="Sezioni casa">
      ${Object.entries(SECTIONS).map(([k, v]) => html`<a href="#/casa/${k}" class="${tab === k ? 'on' : ''}">
        <span class="seg-ico">${icon(v.icon, 'sm')}${counts[k] ? html`<span class="count ${k === 'spesa' ? 'soft' : ''}">${counts[k]}</span>` : ''}</span><span>${v.label}</span></a>`)}
    </nav>
    ${tab === 'spesa' ? spesaRender() : tab === 'lavori' ? renderLavori() : tab === 'rifiuti' ? renderRifiuti() : renderRoutine()}`;
}

// ---------------------------------------------------------------------------
function choreSheet(c = null) {
  const f = (c && c.freq) || { type: 'days', every: 7 };
  const days = f.type === 'weekdays' ? f.days || [] : [];
  openSheet({
    title: c ? 'Modifica faccenda' : 'Nuova faccenda',
    body: html`
      <label class="field"><span>Cosa</span><input name="title" value="${c ? c.title : ''}" placeholder="es. Lavatrice" required ${c ? '' : raw('autofocus')}></label>
      <div class="field"><span>Icona</span><div class="radio-chips">${Object.entries(CHORE_ICONS).map(([k, l]) => html`
        <label title="${l}"><input type="radio" name="icon" value="${k}" ${(c ? c.icon : 'sparkles') === k ? raw('checked') : ''}><span aria-label="${l}">${icon(k, 'sm')}</span></label>`)}</div></div>
      <div class="field"><span>Quanto spesso</span>
        <div class="radio-chips" style="margin-bottom:10px">
          <label><input type="radio" name="ftype" value="days" ${f.type !== 'weekdays' ? raw('checked') : ''}><span>Ogni N giorni</span></label>
          <label><input type="radio" name="ftype" value="weekdays" ${f.type === 'weekdays' ? raw('checked') : ''}><span>Giorni fissi</span></label>
        </div>
        <div class="field-row" id="ch-ogni" ${f.type === 'weekdays' ? raw('hidden') : ''}>
          <label class="field" style="margin:0"><span>Ogni quanti giorni</span><input name="every" type="number" inputmode="numeric" min="1" max="365" value="${f.every || 7}"></label>
          <div></div>
        </div>
        <div class="radio-chips" id="ch-giorni" ${f.type === 'weekdays' ? '' : raw('hidden')}>${[1, 2, 3, 4, 5, 6, 0].map((d) => html`
          <label><input type="checkbox" name="days" value="${d}" ${days.includes(d) ? raw('checked') : ''}><span>${WEEKDAYS_SHORT[d]}</span></label>`)}</div>
      </div>
      <div class="field"><span>Di solito chi la fa</span>${whoChoices('who', c ? c.who : '')}</div>
      ${c && c.history && c.history.length ? html`<div class="field"><span>Ultime volte</span><p class="small muted" style="margin:0">${c.history.slice(-6).reverse().map((h) => `${shortDate(h.date)}${h.by ? ` (${nameOf(h.by)})` : ''}`).join(' · ')}</p></div>` : ''}`,
    extra: c ? html`<button class="btn danger" aria-label="Elimina" type="button" data-action="chore-del" data-id="${c.id}">${icon('trash', 'sm')}</button>` : '',
    // "Ogni N giorni" mostra il numero, "Giorni fissi" mostra i giorni della settimana
    onOpen: (root) => root.querySelectorAll('input[name=ftype]').forEach((r) => r.addEventListener('change', () => {
      const fissi = root.querySelector('input[name=ftype]:checked').value === 'weekdays';
      root.querySelector('#ch-ogni').hidden = fissi;
      root.querySelector('#ch-giorni').hidden = !fissi;
    })),
    onSubmit: (fd) => {
      const title = cap(val(fd, 'title'));
      if (!title) return false;
      const ftype = val(fd, 'ftype');
      const sel = fd.getAll('days').map(Number);
      if (ftype === 'weekdays' && !sel.length) { sheetError('Scegli almeno un giorno della settimana'); return false; }
      const freq = ftype === 'weekdays' && sel.length ? { type: 'weekdays', days: sel } : { type: 'days', every: Math.max(1, Number(val(fd, 'every')) || 7) };
      const data = { title, icon: val(fd, 'icon') || 'sparkles', freq, who: val(fd, 'who') };
      if (c) store.update('routine', c.id, data);
      else store.add('routine', { ...data, lastDone: null, history: [] });
    },
  });
}

function lavoroSheet(l = null) {
  openSheet({
    title: l ? 'Modifica lavoro' : 'Nuovo lavoro',
    body: html`
      <label class="field"><span>Cosa c’è da fare</span><input name="title" value="${l ? l.title : ''}" placeholder="es. Montare le mensole" required ${l ? '' : raw('autofocus')}></label>
      <div class="field"><span>Stanza</span><div class="radio-chips">${ROOMS.map((r) => html`<label><input type="radio" name="room" value="${r}" ${(l ? l.room : '') === r ? raw('checked') : ''}><span>${r}</span></label>`)}</div></div>
      <div class="field"><span>Priorità</span><div class="radio-chips">
        ${[[3, 'Urgente'], [2, 'Normale'], [1, 'Con calma']].map(([v, t]) => html`<label><input type="radio" name="prio" value="${v}" ${(l ? l.prio || 1 : 2) === v ? raw('checked') : ''}><span><span class="prio p${v}"></span>${t}</span></label>`)}
      </div></div>
      <div class="field"><span>Chi</span>${whoChoices('who', l ? l.who : '')}</div>
      <label class="field"><span>Note</span><textarea name="note" placeholder="Misure, cosa serve, link…" style="min-height:80px">${l ? l.note || '' : ''}</textarea></label>`,
    extra: l ? html`<button class="btn danger" aria-label="Elimina" type="button" data-action="lavoro-del" data-id="${l.id}">${icon('trash', 'sm')}</button>` : '',
    onSubmit: (fd) => {
      const title = cap(val(fd, 'title'));
      if (!title) return false;
      const data = { title, room: val(fd, 'room'), prio: Number(val(fd, 'prio')) || 2, who: val(fd, 'who'), note: val(fd, 'note') };
      if (l) store.update('lavori', l.id, data);
      else store.add('lavori', { ...data, done: false });
    },
  });
}

export function markChoreDone(id) {
  const c = state.data.routine.find((x) => x.id === id);
  if (!c) return;
  const t = todayIso();
  vibrate(12);
  if (c.lastDone === t) {
    // annulla il "fatto oggi"
    const hist = (c.history || []).filter((h) => h.date !== t);
    store.update('routine', id, { lastDone: hist.length ? hist[hist.length - 1].date : c.prevDone || null, lastBy: null, history: hist });
    return;
  }
  const prev = { lastDone: c.lastDone || null, lastBy: c.lastBy || null, history: c.history || [] };
  const history = [...(c.history || []), { date: t, by: me() || '' }].slice(-12);
  store.update('routine', id, { lastDone: t, lastBy: me() || '', prevDone: c.lastDone || null, history });
  toast(`${c.title}: fatto!`, { undo: () => store.update('routine', id, prev) });
}

export const actions = {
  'chore-new': () => choreSheet(),
  'chore-edit': ({ id }) => choreSheet(state.data.routine.find((c) => c.id === id)),
  'chore-done': ({ id, el }) => { el.classList.add('pop'); markChoreDone(id); },
  'chore-del': ({ id }) => {
    const c = state.data.routine.find((x) => x.id === id);
    closeSheet();
    if (!c) return;
    confirmSheet({ title: `Eliminare “${c.title}”?`, text: 'La faccenda sparirà dalla lista per entrambi.', onYes: () => store.remove('routine', id) });
  },
  'trash-done': () => {
    const s = settings();
    const done = s.rifiutiFatto && s.rifiutiFatto.date === todayIso();
    vibrate(12);
    saveSettings({ rifiutiFatto: done ? null : { date: todayIso(), by: me() || '' } });
    if (!done) toast('Spazzatura fuori. Grazie!');
  },
  'lavori-room': ({ el }) => setUi('lavori.room', el.dataset.room),
  'lavori-showdone': () => setUi('lavori.showDone', !ui('lavori.showDone', false)),
  'lavoro-new': () => lavoroSheet(),
  'lavoro-edit': ({ id }) => lavoroSheet(state.data.lavori.find((l) => l.id === id)),
  'lavoro-toggle': ({ id, el }) => {
    const l = state.data.lavori.find((x) => x.id === id);
    if (!l) return;
    el.classList.add('pop');
    vibrate(12);
    store.update('lavori', id, { done: !l.done, doneAt: l.done ? null : Date.now(), doneBy: l.done ? null : me() || '' });
    if (!l.done) toast('Lavoro completato!', { undo: () => store.update('lavori', id, { done: false, doneAt: null, doneBy: null }) });
  },
  'lavoro-del': ({ id }) => {
    const l = state.data.lavori.find((x) => x.id === id);
    closeSheet();
    if (!l) return;
    store.remove('lavori', id);
    toast('Lavoro eliminato', { undo: () => { const { id: _, ...rest } = l; store.set('lavori', id, rest); } });
  },
  'rifiuti-day': ({ el }) => setUi('rifiuti.day', Number(el.dataset.day)),
  'rifiuti-toggle': ({ el }) => {
    const d = Number(el.dataset.day), b = el.dataset.bin;
    const r = { ...settings().rifiuti };
    const cur = new Set(r[d] || []);
    cur.has(b) ? cur.delete(b) : cur.add(b);
    r[d] = BIN_IDS.filter((x) => cur.has(x));
    saveSettings({ rifiuti: r });
  },
};

export const badge = () => dueChores().filter((c) => c.lastDone !== todayIso()).length;

// in Spesa: unisce eventuali doppioni e sistema le maiuscole
export function after(route) {
  const tab = route[1] || lsGet('casa.tab') || 'spesa';
  if (tab === 'spesa') tidyShopping();
}
