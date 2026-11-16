// Atmosfera stagionale: ottobre → Halloween, 20 nov–6 gen → Natale, luglio–agosto → mare.
import { SEASONS, THEMES, seasonFor, upcomingDates } from './data.js';
import { lsGet, lsSet, html } from './utils.js';
import { state, settings } from './core.js';

export const seasonOverride = () => lsGet('casa.season', 'auto');
export const setSeasonOverride = (v) => { lsSet('casa.season', v === 'auto' ? null : v); applySeason(); };

export const currentSeason = () => seasonFor(new Date(), seasonOverride());
export const seasonInfo = () => {
  const s = currentSeason();
  if (!s) return null;
  const n = settings().names;
  return { id: s, ...SEASONS[s], sub: SEASONS[s].sub.replace('{p2}', n.p2) };
};

/** Il tema "del periodo": quello della stagione attiva, altrimenti la prossima festa entro 30 giorni. */
export function currentTheme() {
  const s = seasonInfo();
  if (s) return { id: s.theme, label: THEMES[s.theme].label, days: null };
  const next = upcomingDates(settings(), state.data.gatti).find((d) => !d.personal && d.days <= 30 && THEMES[d.theme]);
  return next ? { id: next.theme, label: THEMES[next.theme].label, days: next.days } : null;
}

export function applySeason() {
  const s = currentSeason();
  const root = document.documentElement;
  if (s) root.dataset.season = s; else delete root.dataset.season;
  const meta = document.querySelectorAll('meta[name="theme-color"]');
  const bg = getComputedStyle(document.body).backgroundColor;
  meta.forEach((m) => {
    const dark = m.media.includes('dark');
    const forced = root.dataset.theme;
    if (!forced || (forced === 'dark') === dark) m.content = bg;
  });
}

/** Decorazioni animate in cima alla home. */
export function seasonDeco() {
  const s = currentSeason();
  if (s === 'natale') {
    return html`<div class="season-deco snow" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => html`<i style="left:${(i * 37) % 100}%;animation-delay:-${(i * 1.7) % 9}s;animation-duration:${7 + (i % 5)}s;transform:scale(${0.5 + (i % 4) * 0.2})"></i>`)}</div>`;
  }
  if (s === 'halloween') {
    return html`<div class="season-deco bats" aria-hidden="true">
      ${[0, 1, 2].map((i) => html`<svg viewBox="0 0 64 28" style="left:${12 + i * 31}%;top:${14 + (i % 2) * 26}px;animation-delay:-${i * 1.3}s"><path d="M32 10c-2-4-5-5-8-4 1 2 0 4-2 4-3-6-11-8-20-4 5 1 8 5 8 10 3-2 7-2 9 1 2-2 5-2 7 0 1-3 3-4 6-4s5 1 6 4c2-2 5-2 7 0 2-3 6-3 9-1 0-5 3-9 8-10-9-4-17-2-20 4-2 0-3-2-2-4-3-1-6 0-8 4z" fill="currentColor"/></svg>`)}
    </div>`;
  }
  if (s === 'mare') {
    return html`<div class="season-deco sea" aria-hidden="true">
      <svg class="sun" viewBox="0 0 40 40"><circle cx="20" cy="20" r="9" fill="currentColor"/><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => html`<path d="M20 4v4" transform="rotate(${a} 20 20)"/>`)}</g></svg>
      <svg class="waves" viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0 22c25 0 25-10 50-10s25 10 50 10 25-10 50-10 25 10 50 10 25-10 50-10 25 10 50 10 25-10 50-10 25 10 50 10v18H0z" fill="currentColor" opacity=".35"/><path d="M0 30c25 0 25-8 50-8s25 8 50 8 25-8 50-8 25 8 50 8 25-8 50-8 25 8 50 8 25-8 50-8 25 8 50 8v10H0z" fill="currentColor" opacity=".55"/></svg>
    </div>`;
  }
  if (s === 'aprile') {
    return html`<div class="season-deco paris" aria-hidden="true">
      <svg class="eiffel" viewBox="0 0 60 120"><path d="M30 2v8M27 10h6l3 22H24zM22 32h16l2 8H20zM21 40h18M24 40 12 116h10c2-14 5-22 8-22s6 8 8 22h10L36 40z" fill="currentColor"/></svg>
      <svg class="palm" viewBox="0 0 80 110"><path d="M38 108c1-22 4-46 12-66" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 42C44 28 28 24 14 30c14 0 24 4 30 14zM50 42c4-15 19-22 30-17-13 1-22 8-26 18zM50 42c13 0 23 9 25 21-6-9-15-13-25-13zM50 42c-12-3-25 1-31 13 8-6 19-8 29-5z" fill="currentColor"/></svg>
      <svg class="sun" viewBox="0 0 40 40"><circle cx="20" cy="20" r="9" fill="currentColor"/></svg>
    </div>`;
  }
  return '';
}
