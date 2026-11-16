// Accesso (solo quando Firebase è configurato)
import { html } from '../utils.js';
import { icon } from '../icons.js';
import { store, toast } from '../core.js';

export function render() {
  return html`<section class="login fade-in">
    <div class="brand"><div class="logo"></div><h1>Fam. Comperotto</h1><p>Bentornati a casa</p></div>
    <form class="card" data-form="login" novalidate>
      <label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" inputmode="email" required></label>
      <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
      <div class="form-error" id="login-error" hidden></div>
      <button class="btn primary block" type="submit">${icon('door', 'sm')} Entra</button>
      <button class="card-link" type="button" data-action="login-reset" style="margin:14px auto 0;display:block">Password dimenticata?</button>
    </form>
  </section>`;
}

const MSG = {
  'auth/invalid-credential': 'Email o password sbagliate',
  'auth/wrong-password': 'Password sbagliata',
  'auth/user-not-found': 'Nessun account con questa email',
  'auth/invalid-email': 'Email non valida',
  'auth/too-many-requests': 'Troppi tentativi: riprova tra qualche minuto',
  'auth/network-request-failed': 'Niente connessione',
};

export const actions = {
  login: async ({ form }) => {
    const err = form.querySelector('#login-error');
    err.hidden = true;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try { await store.login(form.email.value.trim(), form.password.value); }
    catch (e) { err.textContent = MSG[e.code] || 'Accesso non riuscito'; err.hidden = false; }
    finally { btn.disabled = false; }
  },
  'login-reset': async ({ el }) => {
    const email = el.closest('form').email.value.trim();
    if (!email) { toast('Scrivi prima la tua email'); return; }
    try { await store.resetPassword(email); toast('Ti ho mandato una mail per reimpostarla'); }
    catch (e) { toast(MSG[e.code] || 'Non sono riuscito a mandare la mail'); }
  },
};
