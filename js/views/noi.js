// "Noi": film, musica, desideri e gatti
import { html } from '../utils.js';
import { icon } from '../icons.js';
import { pageHead } from '../core.js';
import * as film from './film.js';
import * as musica from './musica.js';
import * as desideri from './desideri.js';
import * as gatti from './gatti.js';

const TABS = {
  film: { label: 'Film', icon: 'film', mod: film, eyebrow: 'Da vedere sul divano' },
  musica: { label: 'Musica', icon: 'music', mod: musica, eyebrow: 'La colonna sonora di casa' },
  desideri: { label: 'Desideri', icon: 'gift', mod: desideri, eyebrow: 'Cose da comprare' },
  gatti: { label: 'Gatti', icon: 'cat', mod: gatti, eyebrow: 'Thor e Minù' },
};

export const tabOf = (route) => (TABS[route[1]] ? route[1] : 'film');

export function render(route) {
  const tab = tabOf(route);
  const t = TABS[tab];
  return html`
    ${pageHead(t.label, { eyebrow: t.eyebrow })}
    <nav class="segmented noi-tabs" aria-label="Sezioni">
      ${Object.entries(TABS).map(([k, v]) => html`<a href="#/noi/${k}" class="${k === tab ? 'on' : ''}" aria-label="${v.label}">${icon(v.icon, 'sm')}<span>${v.label}</span></a>`)}
    </nav>
    ${t.mod.render(route)}`;
}

export function after(route) {
  const t = TABS[tabOf(route)];
  if (t.mod.after) t.mod.after(route);
}

export const actions = { ...film.actions, ...musica.actions, ...desideri.actions, ...gatti.actions };
