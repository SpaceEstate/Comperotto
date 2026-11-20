// Cibo: la spesa e le ricette nella stessa pagina, in due zone (schede in cima, una zona per volta).
import * as spesa from './spesa.js';
import * as ricette from './ricette.js';
import { paginaAZone } from './zone.js';

const p = paginaAZone({
  base: 'cibo',
  titolo: 'Cibo',
  sottotitolo: 'Spesa e ricette',
  zone: {
    spesa: { label: 'Spesa', icon: 'basket', testa: () => ({ eyebrow: 'La lista della spesa' }), corpo: () => spesa.render(), conto: () => spesa.badge(), after: () => spesa.tidyShopping() },
    ricette: { label: 'Ricette', icon: 'chef', testa: () => ricette.testa(), corpo: () => ricette.corpo(), after: () => ricette.after() },
  },
});

export const { render, after, zona, visibile } = p;
