// L'avviso "versione vecchia": appena si apre l'app (e quando torna in primo piano) chiedo al server qual è
// l'ultima versione pubblicata (/api/stato, la stessa VERSIONE di js/config.js). Se questa è più vecchia compare
// in alto «App da aggiornare · C'è una versione nuova» con «Aggiorna», e intanto l'aggiornamento si scarica in sottofondo
// (se arriva prima del tocco, l'app si ricarica da sola come sempre, ma non mentre si scrive o suona la musica).
import { VERSIONE } from './config.js';
import { html, lsGet, lsSet } from './utils.js';
import { icon } from './icons.js';
import { toast } from './core.js';

const numeri = (v) => String(v || '').split('.').map((x) => parseInt(x, 10) || 0);
/** true se la versione a è più nuova della b ("1.18.0" > "1.17.2") */
export function piuNuova(a, b) {
  const x = numeri(a), y = numeri(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

let ultima = null;        // l'ultima versione pubblicata, se è più nuova di questa
let chiusoFino = 0;       // "×": l'avviso torna dopo mezz'ora (o all'apertura successiva dell'app)
let aggiornando = false;
let controllato = 0;
let scaricata = null;     // per quale versione ho già chiesto al service worker di scaricare l'aggiornamento
let el = null;

function disegna() {
  const visibile = Boolean(ultima) && (aggiornando || Date.now() > chiusoFino);
  if (!visibile) { if (el) { el.remove(); el = null; } return; }
  if (!el) {
    el = document.createElement('div');
    el.className = 'nuova-versione';
    el.setAttribute('role', 'status');
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('.nv-agg')) aggiorna();
      else if (ev.target.closest('.nv-x')) { chiusoFino = Date.now() + 30 * 60000; disegna(); }
    });
    document.body.appendChild(el);
  }
  el.innerHTML = html`
    <span class="nv-ico">${icon('refresh', 'sm')}</span>
    <span class="nv-testo"><b>App da aggiornare</b><span>${aggiornando ? 'Un attimo…' : 'C’è una versione nuova'}</span></span>
    <button class="nv-agg" type="button" ${aggiornando ? 'disabled' : ''}>${aggiornando ? html`${icon('refresh', 'xs spin')} Aggiorno` : 'Aggiorna'}</button>
    ${aggiornando ? '' : html`<button class="nv-x" type="button" aria-label="Più tardi">${icon('x', 'sm')}</button>`}`.s;
}

/** Il service worker scarica subito la versione nuova (così «Aggiorna» è svelto, o l'app si aggiorna da sola). */
function scarica(v) {
  if (scaricata === v || !('serviceWorker' in navigator)) return;
  scaricata = v;
  navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
}

/** La versione pubblicata (da /api/stato): se è più nuova di questa, l'avviso. */
export function segnala(pubblicata) {
  if (!pubblicata) return;
  if (piuNuova(pubblicata, VERSIONE)) {
    if (ultima !== pubblicata) chiusoFino = 0; // una versione ancora più nuova: l'avviso torna anche se era stato chiuso
    ultima = pubblicata;
    scarica(pubblicata);
  } else ultima = null;
  disegna();
}

/** Chiede al server l'ultima versione (al massimo ogni 15 secondi; senza rete non dice niente). */
export async function controlla(forza = false) {
  if (!forza && Date.now() - controllato < 15000) return;
  controllato = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch('api/stato', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    if (j && j.app === 'comperotto') segnala(j.versione);
  } catch {}
}

/** Toglie la vecchia copia dei file dell'app (solo quella: dati e altro restano) e riapre la pagina. */
async function svuotaERicarica() {
  try { const ks = await caches.keys(); await Promise.all(ks.filter((k) => k.startsWith('casa-v')).map((k) => caches.delete(k))); } catch {}
  location.reload();
}

/** «Aggiorna»: arriva il service worker nuovo e la pagina si ricarica; se non arriva, la riapro dalla rete. */
async function aggiorna() {
  if (aggiornando) return;
  aggiornando = true;
  disegna();
  try {
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
    const reg = sw && await sw.getRegistration();
    if (reg) {
      sw.addEventListener('controllerchange', () => location.reload(), { once: true });
      await reg.update().catch(() => {});
      // la versione nuova si sta installando: aspetto che prenda il posto della vecchia (al massimo 8 secondi)
      if (reg.installing || reg.waiting) { setTimeout(svuotaERicarica, 8000); return; }
    }
  } catch {}
  svuotaERicarica();
}

// Dopo un aggiornamento: un piccolo «App aggiornata» (una volta sola per versione).
const prima = lsGet('casa.versione');
if (prima !== VERSIONE) {
  lsSet('casa.versione', VERSIONE);
  if (prima && piuNuova(VERSIONE, prima)) setTimeout(() => toast('App aggiornata ✓'), 1500);
}

// all'apertura ci pensa app.js (la stessa risposta di /api/stato che usa per partire); poi al ritorno in primo piano
// e ogni 10 minuti mentre è aperta (l'app sulla schermata Home può restare aperta per giorni)
document.addEventListener('visibilitychange', () => { if (!document.hidden) controlla(); });
setInterval(() => { if (!document.hidden) controlla(); }, 10 * 60000);
