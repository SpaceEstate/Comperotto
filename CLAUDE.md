# Fam. Comperotto — note per chi lavora sul progetto

App di casa (PWA per iPhone e iPad) di Patrick e Serena, con i gatti Thor e Minù. Tutto in italiano.

- **Indirizzo di produzione:** https://comperotto.vercel.app (API: https://comperotto.vercel.app/api).
  Vercel pubblica da solo ogni push su `main`. Database: Neon (Postgres) collegato da Vercel → Storage.
- **Codice di famiglia:** non va mai scritto nel repository (è pubblico). Istruzioni e file vanno dati
  già compilati con l'indirizzo, lasciando da compilare solo il codice.
- **Alexa:** skill personale con nome di invocazione **"casa mia"** ("Comperotto" Alexa non lo capiva).
  Il file da incollare nella console è `alexa-skill/lambda/index.js` (in `CONFIG` va cambiato solo `codice`);
  il modello è `alexa-skill/skill-package/interactionModels/custom/it-IT.json`. Gli Echo usano Alexa+:
  le routine non aprono le skill di prova; funziona "Alexa, chiedi a casa mia latte e uova".
- **Dov'è:** posizioni da OwnTracks → `POST /api/posizione` (Basic auth: nome + codice di famiglia).
  "I nostri posti" (casa, lavoro…) si compilano dall'app; **mai indirizzi o dati personali nei file del repository**.
  Solo gli iPhone mandano la posizione (OwnTracks installato solo lì; su iPad "Aggiorna la mia" è nascosto).
  Mappa vettoriale MapLibre inclusa in `js/vendor/maplibre/`; lo stile sta in `js/mappa.js`: base OpenFreeMap ("liberty", di sera "dark"
  riscaldata), nomi in italiano, attività con pallino colorato per categoria che compaiono per gradi con lo zoom, i nostri posti
  (Casa, Lavoro…) come le attività (da zoom 14), Satellite = foto Esri (tileSize 128) con scritte vettoriali sopra. Patrick e Serena sono
  segnaposti sempre visibili. Niente crediti sulla mappa; coordinate dagli indirizzi con `/api/geocodifica`.
- **Notifiche** (Web Push, senza servizi esterni): `api/_push.js` (chiavi VAPID create da sole e tenute nel database, cifratura
  aes128gcm fatta a mano e verificata contro la libreria `web-push`), `api/push.js` (iscrizioni), `api/promemoria.js` (cron serale in
  `vercel.json`: rifiuti, compleanni, gatti), avvisi di arrivo/partenza in `api/posizione.js`, biglietti in `api/dati.js`.
  Lato app: `js/notifiche.js`, interruttori in Impostazioni, gestione in `sw.js`. Su iPhone servono l'app sulla schermata Home e iOS 16.4+.
- **Avvio e aggiornamenti:** un dispositivo già collegato parte subito dai dati salvati (non aspetta `/api/stato`). A ogni pubblicazione
  cambiare `CACHE` in `sw.js`: l'app aperta si ricarica da sola (non mentre si scrive). I caratteri sono in `assets/fonts/`.
- **Controllo delle pagine:** prima di pubblicare modifiche di aspetto, provarle su iPhone piccolo (320 px), iPhone, iPad verticale
  (colonna unica tra 700 e 999 px) e orizzontale, in chiaro e scuro e con le atmosfere delle feste.
- **Sito pulito:** è un'app interna di famiglia: niente spiegazioni tecniche, crediti o link "obbligatori" nelle pagine (es. sulla mappa); le spiegazioni vanno date in chat.
- **Stile:** pastello in tinta con la casa; le feste con i loro colori pieni (Natale verde/rosso/bianco,
  Halloween nero/arancione). Pensata per iPhone e iPad.
- **Gesti iPhone** (`js/gestures.js`): fogli da trascinare giù, indietro dal bordo sinistro (solo app installata),
  tira giù per aggiornare, righe da scorrere (`swipe()` in `core.js`: destra = spunta, sinistra = elimina con Annulla).
- Niente build: HTML/CSS/JS moderni (`index.html`, `css/`, `js/`), funzioni Vercel in `api/`.
