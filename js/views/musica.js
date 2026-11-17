// Musica: tutto da Spotify (vedi views/spotify.js): cosa suona e dove, ricerca, musica a tema del periodo,
// suggerimenti per te e la libreria (preferiti e playlist).
import { html } from '../utils.js';
import { icon, catFace } from '../icons.js';
import { pageHead, isSynced, emptyState } from '../core.js';
import * as SPV from './spotify.js';

export function render(r = []) {
  if (SPV.SOTTO.includes(r[1])) return SPV.render(r);
  const spot = SPV.blocco();
  return html`
    <a class="back-link phone-only" href="#/">${icon('left', 'sm')} Home</a>
    ${pageHead('Musica', { eyebrow: 'La colonna sonora di casa' })}
    ${!isSynced() ? emptyState('Musica da Spotify', 'Si collega quando l’app usa il codice di famiglia.', catFace('b')) : spot || html`<p class="muted small sp-wait">Un attimo…</p>`}`;
}

export const after = (r = []) => SPV.after(r);
/** Il mini lettore in basso (su tutte le pagine tranne Musica). */
export const mini = (r = []) => SPV.miniLettore(r);
export const refresh = () => SPV.refresh();
export const actions = { ...SPV.actions };
