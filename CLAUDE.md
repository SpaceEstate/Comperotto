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
- **Dov'è, freschezza:** fino a 2 ore si dice "A casa"; oltre, "Era a casa · 5 h fa" in grigio (mai una posizione vecchia al presente).
  Il server (`api/posizione.js`) decide il posto con precisione del punto, zone ed entrate/uscite di OwnTracks e salva la chiave dei
  posti usati (`posti`): l'app si fida di quella decisione finché i posti non cambiano. Con "Remote Commands" attivo, nella risposta
  a OwnTracks si mandano i nostri posti come zone (`setWaypoints`, una volta, o ogni 12 h finché non funzionano). Il codice di famiglia
  non si accetta mai nell'indirizzo (finirebbe nei log). Dall'app la posizione parte solo con l'interruttore acceso (e permesso già dato)
  o con un tocco; "Chiedi a…" manda una notifica all'altro (`#/dove/condividi`).
- **Musica:** un solo lettore, `js/player.js`, montato una volta fuori da `#view` (mai iframe dentro le pagine: i ridisegni li
  ricreerebbero). Stato unico in `S`; i motori (Spotify con la iFrame API ufficiale, `<audio>` per file e radio) mandano solo eventi,
  filtrati per "giro". Regole provate sul riquadro Spotify: `play()` prima del pronto va in coda; `seek()` prima dell'avvio è ignorato;
  `pause()` prima dell'avvio dà errore; subito dopo un seek arriva ancora la posizione vecchia (va scartata). Senza accesso a Spotify
  sono anteprime di 30 s. Volume e uscita audio solo per `<audio>` e solo se il dispositivo li permette. Mentre suona l'app non si
  ricarica da sola per gli aggiornamenti.
- **Ricette online:** `api/ricette.js` (Wikibooks "Libro di cucina" via REST, TheMealDB, importazione da link con i dati schema.org;
  controlli contro indirizzi interni). Le miniature Wikimedia esistono solo in larghezze standard (120, 250, 330, 500…).
- **Desideri e Amazon:** Amazon non ha un'API per leggere le liste dei desideri: si collegano (`settings.listeAmazon`) e i link dei
  prodotti si ripuliscono; `api/link.js` segue i link brevi (spotify.link, amzn.eu) solo verso Spotify/Amazon.
- **Sicurezza:** ogni funzione protetta inizia con `respingi(req, res)` (`api/_lib.js`): 10 codici diversi sbagliati in 15 minuti
  dallo stesso indirizzo → bloccato per 15 minuti (lo stesso codice vecchio ripetuto da un telefono non blocca).
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
