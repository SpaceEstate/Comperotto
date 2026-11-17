// Codice di famiglia: si scrive una volta su ogni iPhone/iPad e i dati si condividono da soli.
import { html, raw } from '../utils.js';
import { icon } from '../icons.js';
import { api, AuthError } from '../store.js';

export function render(backend) {
  const first = backend && !backend.claimed;
  return html`<section class="login fade-in">
    <div class="brand"><div class="logo"></div><h1>Fam. Comperotto</h1>
      <p>${first ? 'Prima volta qui: scegliete il vostro codice di famiglia' : 'Bentornati a casa'}</p></div>
    <form class="card" data-form="codice" novalidate data-first="${first ? '1' : ''}">
      <label class="field"><span>${first ? 'Scegli il codice di famiglia' : 'Codice di famiglia'}</span>
        <input name="codice" type="password" autocomplete="${first ? 'new-password' : 'current-password'}" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="${first ? 'es. thorminu2025' : ''}" required ${raw('autofocus')}>
      </label>
      <p class="help" style="margin:-6px 2px 14px">${first
        ? 'Almeno 6 caratteri. Lo scriverete una volta su ogni iPhone e iPad, poi tutto si aggiorna da solo.'
        : 'Lo stesso che avete scelto sul primo dispositivo.'}</p>
      <div class="form-error" id="login-error" hidden></div>
      <button class="btn primary block" type="submit">${icon('door', 'sm')} ${first ? 'Crea la casa' : 'Entra'}</button>
    </form>
  </section>`;
}

export const actions = {
  codice: async ({ form }) => {
    const err = form.querySelector('#login-error');
    const btn = form.querySelector('button[type=submit]');
    const code = form.codice.value.trim().toLowerCase();
    err.hidden = true;
    if (code.length < 6) { err.textContent = 'Almeno 6 caratteri'; err.hidden = false; return; }
    btn.disabled = true;
    try {
      if (form.dataset.first) await api('setup', { method: 'POST', body: { codice: code } });
      else await api('dati', { code });
      const { startSync } = await import('../app.js');
      await startSync(code);
    } catch (e) {
      err.textContent = e instanceof AuthError ? 'Codice sbagliato' : (e.message || 'Non riesco a collegarmi');
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  },
};
