// Atmosfere delle feste: colori, testata della Home, riquadri e decorazioni di tutto il sito cambiano
// con il calendario (Capodanno, San Valentino, Carnevale, 8 marzo, Pasqua, aprile, mare, Halloween, Natale)
// e nei giorni di festa di casa: compleanni di Patrick, Serena, Thor e Minù (l'anniversario ha i colori dell'amore).
import { SEASONS, THEMES, seasonFor, upcomingDates } from './data.js';
import { lsGet, lsSet, html, todayIso, addDays, parseIso } from './utils.js';
import { state, settings } from './core.js';

export const seasonOverride = () => lsGet('casa.season', 'auto');
export const setSeasonOverride = (v) => { lsSet('casa.season', v === 'auto' ? null : v); applySeason(); };

/** Solo le feste di famiglia cambiano il sito (non le ricorrenze di amici e parenti). */
const isFamily = (d) => d.personal && (d.who || d.cats || d.anniversary);
const eventSeason = (d) => (d.anniversary ? 'sanvalentino' : 'compleanno');
const familyDates = () => upcomingDates(settings(), state.data.gatti || []).filter(isFamily);

function current() {
  const ov = seasonOverride();
  if (ov !== 'auto') return { id: seasonFor(new Date(), ov) };
  const ev = familyDates().find((d) => d.days === 0);
  if (ev) return { id: eventSeason(ev), event: ev };
  return { id: seasonFor(new Date()) };
}

export const currentSeason = () => current().id;

/** Titolo e frase per un compleanno o l'anniversario di oggi. */
export function eventText(b) {
  const years = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (!b.name) return { icon: b.icon || 'calendar', title: b.label, sub: 'È oggi: ricordatevi gli auguri!' };
  if (b.anniversary) return { icon: 'heart', title: `Buon anniversario, ${b.name}!`, sub: `${b.age ? `${years(b.age, 'anno', 'anni')} insieme ♡ ` : ''}Stasera si festeggia: cena romantica?` };
  const title = `Buon compleanno, ${b.name}!`;
  if (b.cats) return { icon: 'cat', title, sub: `${b.age ? `${years(b.age, 'anno', 'anni')} di fusa. ` : ''}Oggi croccantini extra per tutti.` };
  if (b.who === 'p2') return { icon: 'cake', title, sub: `${b.age ? `${b.age} anni! ` : ''}Joyeux anniversaire · ¡Feliz cumpleaños! ✦` };
  return { icon: 'cake', title, sub: `${b.age ? `${b.age} anni! ` : ''}Tanti auguri da tutta la famiglia (gatti compresi).` };
}

export function seasonInfo() {
  const { id, event } = current();
  if (!id) return null;
  const info = { id, ...SEASONS[id], sub: SEASONS[id].sub.replace('{p2}', settings().names.p2) };
  if (event) Object.assign(info, eventText(event), { theme: event.anniversary ? 'sanvalentino' : 'compleanni', event });
  return info;
}

/** Il tema "del periodo": quello dell'atmosfera attiva, altrimenti la prossima festa entro 30 giorni. */
export function currentTheme() {
  const s = seasonInfo();
  if (s && THEMES[s.theme]) return { id: s.theme, label: THEMES[s.theme].label, days: null };
  const next = upcomingDates(settings(), state.data.gatti).find((d) => !d.personal && d.days <= 30 && THEMES[d.theme]);
  return next ? { id: next.theme, label: THEMES[next.theme].label, days: next.days } : null;
}

/** Le prossime atmosfere in arrivo (per le Impostazioni). */
export function nextSeasons(n = 4) {
  const today = todayIso();
  const fam = {};
  familyDates().forEach((d) => { fam[d.date] ||= d; });
  const out = [];
  const first = seasonFor(parseIso(today));
  let cal = first;
  for (let i = 1; i <= 400 && out.length < n; i++) {
    const day = addDays(today, i);
    const ev = fam[day];
    if (ev) out.push({ id: eventSeason(ev), date: day, label: ev.anniversary ? 'Anniversario' : ev.label });
    const c = seasonFor(parseIso(day));
    // una festa che "riprende" (Natale dopo Capodanno, aprile dopo Pasqua) non si ripete
    if (c && c !== cal && c !== first && !out.some((x) => x.id === c) && out.length < n) out.push({ id: c, date: day, label: SEASONS[c].label });
    cal = c;
  }
  return out;
}

const isDark = () => {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

let saved = '';
export function applySeason() {
  const s = currentSeason();
  const root = document.documentElement;
  if (s) root.dataset.season = s; else delete root.dataset.season;
  root.dataset.mode = isDark() ? 'dark' : 'light';
  // alla prossima apertura i colori giusti ci sono fin dal primo istante (vedi index.html)
  const mem = `${todayIso()}|${s || ''}`;
  if (mem !== saved) { saved = mem; lsSet('casa.ev', mem); }
  const meta = document.querySelectorAll('meta[name="theme-color"]');
  const bg = getComputedStyle(document.body).backgroundColor;
  meta.forEach((m) => {
    const dark = m.media.includes('dark');
    const forced = root.dataset.theme;
    if (!forced || (forced === 'dark') === dark) m.content = bg;
  });
}

// ---------------------------------------------------------------------------
// Decorazioni animate in cima alla Home
// ---------------------------------------------------------------------------
const pick = (a, i) => a[i % a.length];
const CONFETTI = ['#FFD23F', '#3EC1D3', '#FF5C8A', '#7A5CFA', '#FF8A3D', '#46D39A'];
const HEART = 'M12 20s-7.4-4.4-9.1-9.1C1.8 7.6 3.8 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.2 0 5.2 3.1 4.1 6.4C19.4 15.6 12 20 12 20z';
const STAR4 = 'M0-8 1.8-1.8 8 0 1.8 1.8 0 8-1.8 1.8-8 0-1.8-1.8z';

/** Pezzetti che cadono (neve, coriandoli): sparsi "a caso" ma sempre negli stessi punti. */
const bits = (n, cls, colors) => Array.from({ length: n }, (_, i) => html`<i class="${cls}" style="left:${(i * 37 + 7) % 100}%;animation-delay:-${((i * 1.7) % 9).toFixed(1)}s;animation-duration:${7 + (i % 5)}s;--s:${(0.5 + (i % 4) * 0.2).toFixed(1)}${colors ? `;background:${pick(colors, i)}` : ''}"></i>`);

const DECO = {
  natale: () => html`
    ${bits(18, 'flake')}
    ${[[70, 30, '#D33A3F'], [106, 50, '#E8C15A'], [142, 22, '#DCE6EE']].map(([r, len, c], i) => html`<svg class="bauble" viewBox="0 0 24 ${len + 26}" style="right:${r}px;height:${len + 26}px;animation-delay:-${i * 1.3}s">
      <path d="M12 0V${len + 1}" stroke="rgba(255,255,255,.55)"/><rect x="8.5" y="${len}" width="7" height="5" rx="1.2" fill="#E0B85C"/>
      <circle cx="12" cy="${len + 15}" r="10" fill="${c}"/><path d="M6.6 ${len + 12.5}a6 6 0 0 1 4-4.2" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`)}`,

  capodanno: () => html`
    ${[[72, 4, '#F2CF6E', 0], [88, 70, '#F4F1E6', 0.8], [60, 104, '#F0A5BC', 1.6], [96, 128, '#9FD3F0', 2.2]].map(([x, y, c, d]) => html`<svg class="burst" viewBox="-20 -20 40 40" style="left:${x}%;top:${y}px;color:${c};animation-delay:-${d}s">
      <g stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${Array.from({ length: 12 }, (_, k) => html`<path d="M0-6.5V-13" transform="rotate(${k * 30})"/>`)}</g>
      <g fill="currentColor">${Array.from({ length: 12 }, (_, k) => html`<circle cx="0" cy="-17" r="1.3" transform="rotate(${k * 30 + 15})"/>`)}</g></svg>`)}
    ${[[34, 20], [52, 96], [70, 30], [94, 84], [62, 120], [84, 128], [40, 112], [98, 40]].map(([x, y], i) => html`<svg class="twinkle" viewBox="-8 -8 16 16" style="left:${x}%;top:${y}px;animation-delay:-${(i * 0.45).toFixed(2)}s;--s:${0.6 + (i % 3) * 0.25}"><path d="${STAR4}" fill="#F6E3A1"/></svg>`)}`,

  sanvalentino: () => html`${Array.from({ length: 11 }, (_, i) => html`<svg class="love" viewBox="0 0 24 24" style="left:${55 + ((i * 23) % 42)}%;width:${14 + (i % 4) * 6}px;animation-delay:-${(i * 0.9).toFixed(1)}s;animation-duration:${5 + (i % 4)}s"><path d="${HEART}" fill="${pick(['#FFC2CE', '#FF8FA5', '#FFFFFF', '#FF5C7A'], i)}"/></svg>`)}`,

  carnevale: () => html`
    ${bits(26, 'confetto', CONFETTI)}
    ${[[64, '#FFD23F', 96], [100, '#46D39A', 70], [136, '#FF5C8A', 104], [170, '#3EC1D3', 60]].map(([r, c, h], i) => html`<svg class="streamer" viewBox="0 0 20 ${h}" style="right:${r}px;height:${h}px;animation-delay:-${i * 1.1}s"><path d="M10 0${'c7 4.5 7 9 0 13.5s-7 9 0 13.5'.repeat(Math.ceil(h / 27))}" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`)}`,

  donna: () => html`
    ${bits(10, 'pompom')}
    <svg class="mimosa" viewBox="0 0 150 140">
      <g fill="none" stroke-linecap="round">
        <path d="M150 140C122 108 92 70 56 20" stroke="#6E8F2E" stroke-width="2.6"/>
        <path d="M114 96c-16-6-32-4-46 4M92 66c8-16 22-24 38-26M128 118c-6-14-4-28 6-40" stroke="#6E8F2E" stroke-width="2"/>
        <g stroke="#9DC25A" stroke-width="9" stroke-dasharray="1.5 1.6">
          <path d="M136 124c-14-4-26-2-36 6"/><path d="M104 84c-2-14 2-26 12-34"/><path d="M80 52c-14 0-24 6-30 16"/><path d="M122 104c10-8 22-10 28-8"/>
        </g>
      </g>
      <g class="poms">${[[56, 20], [50, 30], [62, 28], [44, 40], [58, 40], [68, 66], [62, 58], [74, 58], [130, 40], [122, 34], [136, 30], [118, 44], [134, 78], [140, 70], [128, 72], [52, 104], [62, 98], [46, 96], [70, 104]].map(([x, y], i) => html`<circle cx="${x}" cy="${y}" r="${4.2 + (i % 3) * 0.6}" fill="${pick(['#FFD83D', '#FFCB0D', '#FFE36B'], i)}"/>`)}</g>
    </svg>`,

  pasqua: () => html`
    <svg class="butterfly" viewBox="0 0 32 24"><g class="wing"><path d="M16 12C12 2 3 0 2 5s5 7 14 7zM16 12c-8 1-12 6-9 9s7-2 9-9z" fill="#F4A3B5"/><path d="M16 12c4-10 13-12 14-7s-5 7-14 7zM16 12c8 1 12 6 9 9s-7-2-9-9z" fill="#F4A3B5"/></g><path d="M16 7v11" stroke="#5A3E8A" stroke-width="1.6" stroke-linecap="round"/></svg>
    ${[[142, 26, '#F7D74A', 'zig'], [108, 32, '#B79AE3', 'dots'], [76, 26, '#8FD0EE', 'zig']].map(([r, w, c, kind], i) => html`<svg class="egg" viewBox="0 0 28 36" style="right:${r}px;width:${w}px;animation-delay:-${i * 0.8}s">
      <path d="M14 1C6.5 1 1 13 1 22a13 13 0 0 0 26 0C27 13 21.5 1 14 1z" fill="${c}"/>
      ${kind === 'zig' ? html`<path d="M2 18l4-3.5 4 3.5 4-3.5 4 3.5 4-3.5 4 3.5M1.6 26l4 3 4.2-3 4.2 3 4.2-3 4.2 3 4-3" stroke="#fff" stroke-width="2" fill="none" stroke-linejoin="round"/>` : html`<g fill="#fff"><circle cx="9" cy="14" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="14" cy="21" r="2"/><circle cx="7" cy="25" r="2"/><circle cx="21" cy="25" r="2"/></g>`}</svg>`)}
    <svg class="grass" viewBox="0 0 200 24" preserveAspectRatio="none"><path d="M0 24V14l6-10 4 12 6-14 5 14 7-11 3 11 6-13 5 13 6-9 4 9 7-14 4 14 6-10 5 10 6-13 4 13 7-11 5 11 6-14 4 14 6-9 5 9 6-12 4 12 7-10 5 10 6-14 4 14 6-11 5 11 6-9 4 9 6-13 5 13 6-10 4 10 6-12 3 12V24z" fill="#7CC46F"/></svg>
    ${[[30, 6], [56, 12], [88, 4]].map(([x, b]) => html`<svg class="daisy" viewBox="-10 -10 20 20" style="right:${x}%;bottom:${b}px"><g fill="#fff">${Array.from({ length: 8 }, (_, k) => html`<ellipse cx="0" cy="-5.5" rx="2.2" ry="4" transform="rotate(${k * 45})"/>`)}</g><circle r="2.8" fill="#F7C83A"/></svg>`)}`,

  aprile: () => html`
    <svg class="eiffel" viewBox="0 0 60 120"><path d="M30 2v8M27 10h6l3 22H24zM22 32h16l2 8H20zM21 40h18M24 40 12 116h10c2-14 5-22 8-22s6 8 8 22h10L36 40z" fill="currentColor"/></svg>
    <svg class="palm" viewBox="0 0 80 110"><path d="M38 108c1-22 4-46 12-66" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 42C44 28 28 24 14 30c14 0 24 4 30 14zM50 42c4-15 19-22 30-17-13 1-22 8-26 18zM50 42c13 0 23 9 25 21-6-9-15-13-25-13zM50 42c-12-3-25 1-31 13 8-6 19-8 29-5z" fill="currentColor"/></svg>
    <svg class="sun" viewBox="0 0 40 40"><circle cx="20" cy="20" r="9" fill="currentColor"/></svg>
    ${[[46, 30], [58, 104], [90, 120]].map(([x, y], i) => html`<svg class="twinkle" viewBox="-8 -8 16 16" style="left:${x}%;top:${y}px;animation-delay:-${i * 0.7}s;--s:.7"><path d="${STAR4}" fill="#FFE1EA"/></svg>`)}`,

  mare: () => html`
    <svg class="sun" viewBox="0 0 40 40"><circle cx="20" cy="20" r="9" fill="currentColor"/><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => html`<path d="M20 4v4" transform="rotate(${a} 20 20)"/>`)}</g></svg>
    ${[[58, 8, 0], [70, 30, 1.4]].map(([x, y, d]) => html`<svg class="gull" viewBox="0 0 24 10" style="left:${x}%;top:${y}px;animation-delay:-${d}s"><path d="M1 7c3-4 7-5 11-1 4-4 8-3 11 1" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`)}
    <svg class="boat" viewBox="0 0 40 40"><path d="M20 3v24" stroke="#fff" stroke-width="1.6"/><path d="M21 4l13 20H21z" fill="#fff"/><path d="M19 8 9 24h10z" fill="#F26B4F"/><path d="M5 28h30l-5 7H10z" fill="#F2C14E"/></svg>
    <svg class="waves" viewBox="0 0 400 40" preserveAspectRatio="none"><path class="foam" d="M0 20c25 0 25-10 50-10s25 10 50 10 25-10 50-10 25 10 50 10 25-10 50-10 25 10 50 10 25-10 50-10 25 10 50 10v20H0z"/><path class="shore" d="M0 30c25 0 25-8 50-8s25 8 50 8 25-8 50-8 25 8 50 8 25-8 50-8 25 8 50 8 25-8 50-8 25 8 50 8v10H0z"/></svg>`,

  halloween: () => html`
    <span class="moon"></span>
    ${[[50, 6], [66, 38], [82, 104]].map(([x, y], i) => html`<svg class="bat" viewBox="0 0 64 28" style="left:${x}%;top:${y}px;animation-delay:-${i * 1.3}s"><path d="M32 10c-2-4-5-5-8-4 1 2 0 4-2 4-3-6-11-8-20-4 5 1 8 5 8 10 3-2 7-2 9 1 2-2 5-2 7 0 1-3 3-4 6-4s5 1 6 4c2-2 5-2 7 0 2-3 6-3 9-1 0-5 3-9 8-10-9-4-17-2-20 4-2 0-3-2-2-4-3-1-6 0-8 4z" fill="currentColor"/></svg>`)}`,

  compleanno: () => html`
    ${bits(16, 'confetto', CONFETTI)}
    ${[[70, 22, '#FFD23F'], [102, 6, '#3EC1D3'], [134, 30, '#FF5C8A'], [166, 12, '#7A5CFA']].map(([r, t, c], i) => html`<svg class="balloon" viewBox="0 0 30 84" style="right:${r}px;top:${t}px;animation-delay:-${(i * 0.9).toFixed(1)}s;animation-duration:${3.4 + (i % 3) * 0.6}s">
      <path d="M15 1C7 1 1.5 7.5 1.5 15.5c0 9 6.8 17 13.5 19 6.7-2 13.5-10 13.5-19C28.5 7.5 23 1 15 1z" fill="${c}"/><path d="M13 34.5h4l-2 3z" fill="${c}"/>
      <ellipse cx="9.5" cy="11" rx="3" ry="5" fill="#fff" opacity=".35" transform="rotate(20 9.5 11)"/>
      <path d="M15 37.5c-3 7 3 13 0 20s3 13 0 20" stroke="rgba(255,255,255,.7)" stroke-width="1.2" fill="none"/></svg>`)}`,
};

export function seasonDeco() {
  const s = currentSeason();
  return DECO[s] ? html`<div class="season-deco deco-${s}" aria-hidden="true">${DECO[s]()}</div>` : '';
}
