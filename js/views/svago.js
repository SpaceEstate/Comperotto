// Svago: film e musica nella stessa pagina, in due zone (schede in cima, una zona per volta).
import * as film from './film.js';
import * as musica from './musica.js';
import { paginaAZone } from './zone.js';

const p = paginaAZone({
  base: 'svago',
  titolo: 'Svago',
  sottotitolo: 'Film e musica',
  zone: {
    film: { label: 'Film', icon: 'film', testa: () => film.testa(), corpo: () => film.corpo(), after: () => film.after() },
    musica: { label: 'Musica', icon: 'music', testa: () => musica.testa(), corpo: () => musica.corpo(), after: () => musica.after(['musica']) },
  },
});

export const { render, after, zona, visibile } = p;
