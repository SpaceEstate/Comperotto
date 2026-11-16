// Notifiche su questo dispositivo. Su iPhone e iPad funzionano con l'app messa sulla schermata Home (iOS 16.4 o più recente).
// Le manda il server: quando l'altro arriva o va via (Dov'è), la sera per i rifiuti, per i biglietti e per le scadenze.
import { store, me } from './core.js';
import { isIOS, isStandalone, lsGet, lsSet } from './utils.js';

/** I tipi di notifica che si possono accendere e spegnere: [chiave, titolo, spiegazione] */
export const TIPI = [
  ['arrivi', 'Arrivi e partenze', 'Quando l’altro arriva o va via da casa o dal lavoro'],
  ['rifiuti', 'Stasera si butta', 'Verso sera, se c’è qualcosa da portare fuori'],
  ['biglietti', 'Biglietti sulla lavagnetta', 'Quando l’altro ne attacca uno nuovo'],
  ['scadenze', 'Compleanni e gatti', 'Il giorno prima di compleanni, anniversario e richiami di Thor e Minù'],
];

const supporto = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pronto = () => Promise.race([navigator.serviceWorker.ready, new Promise((_, ko) => setTimeout(() => ko(new Error('non pronto')), 4000))]);
const iscrizione = async () => (await pronto()).pushManager.getSubscription();
const bytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function prefs() {
  let salvate = {};
  try { salvate = JSON.parse(lsGet('casa.push') || '{}') || {}; } catch {}
  return Object.fromEntries(TIPI.map(([k]) => [k, salvate[k] !== false]));
}

/** 'no' (questo dispositivo non le prevede) · 'installa' (iPhone: prima va messa sulla schermata Home) · 'bloccate' · 'spente' · 'accese' */
export async function stato() {
  if (!supporto()) return isIOS() && !isStandalone() ? 'installa' : 'no';
  if (Notification.permission === 'denied') return 'bloccate';
  try { return (await iscrizione()) && Notification.permission === 'granted' ? 'accese' : 'spente'; } catch { return 'no'; }
}

async function registra(sub, p) {
  await store.call('push', { method: 'POST', body: { sub: sub.toJSON(), chi: me(), prefs: p } });
  lsSet('casa.push', JSON.stringify(p));
  lsSet('casa.push.ok', `${me()}|${new Date().toDateString()}`);
}

export async function accendi() {
  if (!me()) throw new Error('Prima scegli chi usa questo dispositivo');
  if ((await Notification.requestPermission()) !== 'granted') return 'bloccate';
  const reg = await pronto();
  const { key } = await store.call('push');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) });
  await registra(sub, prefs());
  return 'accese';
}

export async function spegni() {
  const sub = await iscrizione();
  if (!sub) return;
  await store.call('push', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
  lsSet('casa.push.ok', null);
}

export async function scegli(tipo, acceso) {
  const p = { ...prefs(), [tipo]: Boolean(acceso) };
  lsSet('casa.push', JSON.stringify(p));
  const sub = await iscrizione();
  if (sub) await registra(sub, p);
}

/** Chiede al server una notifica di prova per questo dispositivo. */
export async function prova() {
  const sub = await iscrizione();
  if (!sub) return false;
  const r = await store.call('push', { method: 'POST', body: { prova: true, endpoint: sub.endpoint } });
  return Boolean(r.ok);
}

/** All'avvio (una volta al giorno, o se è cambiato chi usa il dispositivo): il server deve sapere di chi sono le notifiche. */
export async function rinfresca(subito = false) {
  try {
    if (!supporto() || Notification.permission !== 'granted' || !me() || store.mode !== 'sync') return;
    if (!subito && lsGet('casa.push.ok') === `${me()}|${new Date().toDateString()}`) return;
    const sub = await iscrizione();
    if (sub) await registra(sub, prefs());
  } catch {}
}
