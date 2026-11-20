// Pagine con due zone (Cibo: Spesa | Ricette; Svago: Film | Musica): le schede in cima e sotto una zona
// per volta, su iPhone e su iPad. Ogni dispositivo ricorda l'ultima zona aperta.
import { html, lsGet, lsSet } from '../utils.js';
import { pageHead, schede } from '../core.js';

/**
 * zone: { chiave: { label, icon, testa() → { eyebrow, actions }, corpo(), conto?(), after?() } }
 */
export function paginaAZone({ base, titolo, sottotitolo, zone }) {
  const chiavi = Object.keys(zone);
  const zona = () => (zone[lsGet(`casa.${base}`)] ? lsGet(`casa.${base}`) : chiavi[0]);
  const scelta = (r) => (zone[r[1]] ? r[1] : zona());

  function render(r = []) {
    const z = scelta(r);
    lsSet(`casa.${base}`, z);
    const v = zone[z];
    const t = v.testa() || {};
    const conti = Object.fromEntries(chiavi.map((k) => [k, zone[k].conto ? zone[k].conto() : 0]));
    return html`${pageHead(titolo, { eyebrow: t.eyebrow || sottotitolo, actions: t.actions || '' })}
      ${schede(base, zone, z, { conti, etichetta: `Zone di ${titolo}` })}
      ${v.corpo()}`;
  }

  function after(r = []) {
    const v = zone[scelta(r)];
    if (v.after) v.after();
  }

  /** La zona che si vede adesso. */
  const visibile = (r, k) => r[0] === base && scelta(r) === k;

  return { render, after, zona, visibile };
}
