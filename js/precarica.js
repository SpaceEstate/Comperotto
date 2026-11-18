// All'apertura dell'app, subito dopo il primo disegno e in sottofondo: musica (di tutti e due), copertine,
// locandine, foto e mappa si preparano prima di entrare nelle pagine, così aprendole è già tutto lì.
// Niente con l'app in secondo piano, senza rete o con "Risparmio dati".
import { isSynced } from './core.js';
import { scaldaImmagini, preparaFoto } from './utils.js';
import * as musica from './views/spotify.js';
import * as film from './views/film.js';
import * as desideri from './views/desideri.js';
import * as ricette from './views/ricette.js';
import * as dove from './views/dove.js';

let fatto = false;
// un momento in cui il telefono non ha altro da fare (senza aspettare troppo)
const libero = () => new Promise((ok) => (window.requestIdleCallback ? requestIdleCallback(() => ok(), { timeout: 1500 }) : setTimeout(ok, 300)));

// due file insieme (una non aspetta l'altra): la musica di tutti e due; locandine, foto dei desideri e delle
// ricette. Alla fine la mappa, che pesa di più.
const FILE = [
  [() => musica.precarica()],
  [() => scaldaImmagini(film.locandine(), { insieme: 6 }), () => scaldaImmagini(desideri.foto(), { referrer: false, insieme: 6 }), () => preparaFoto(ricette.foto())],
];

export async function precaricaTutto() {
  if (fatto || !isSynced()) return;
  if (navigator.connection && navigator.connection.saveData) return;
  if (document.hidden || navigator.onLine === false) {
    // riprovo quando l'app torna davanti (o torna la rete)
    const ancora = () => { if (!document.hidden && navigator.onLine !== false) { document.removeEventListener('visibilitychange', ancora); window.removeEventListener('online', ancora); setTimeout(precaricaTutto, 1500); } };
    document.addEventListener('visibilitychange', ancora);
    window.addEventListener('online', ancora);
    return;
  }
  fatto = true;
  const vai = async (passi) => {
    for (const passo of passi) {
      if (document.hidden) return; // l'app è andata in secondo piano: il resto lo carica la pagina quando serve
      try { await passo(); } catch { /* se uno non va gli altri continuano */ }
    }
  };
  await Promise.all(FILE.map(vai));
  await libero();
  if (!document.hidden) { try { await dove.preparaMappa(); } catch { /* la prepara Dov'è */ } }
}
