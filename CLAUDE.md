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
- **Pagine e barra:** Home · Cibo · Casa · Svago · Desideri (su iPad la barra laterale aggiunge Dov'è, Thor e Minù, Impostazioni).
  Cibo = Spesa | Ricette (`#/cibo/spesa`, `#/cibo/ricette`), Svago = Film | Musica (`#/svago/film`, `#/svago/musica`): pagine a due
  zone (`js/views/zone.js`), schede in cima e una zona per volta anche su iPad; ogni dispositivo ricorda l'ultima (`casa.cibo`,
  `casa.svago`). Casa = Faccende, Lavori, Rifiuti. Pagine interne: `#/ricette/<id>`, `#/musica/<…>` (accendono la loro scheda).
  I vecchi indirizzi (`#/casa/spesa`, `#/ricette`, `#/film`, `#/musica`, `#/noi/…`) si correggono da soli (`canonico()` in `app.js`).
- **Ricette online:** `api/ricette.js` cerca su GialloZafferano (pagina pubblica dei risultati: ordine dall'`ItemList` schema.org,
  foto/voto/difficoltà/tempo dalle schede, solo `ricette.giallozafferano.it`) e importa da link con i dati schema.org (controlli contro
  indirizzi interni; nei passaggi di GZ si tolgono i rimandi alle foto). Fatto in casa da Benedetta è stato tolto: il sito blocca
  i programmi (verifica Cloudflare) e non va aggirato; un link di un sito così all'importazione dà un messaggio chiaro.
- **Ricette, categorie:** `RICETTE_CATS` (`js/data.js`): Natale, Halloween, Sempre, Estate, Colazione (i filtri della pagina e il
  campo "Categoria"). `ricetteCats(r)`: Capodanno conta come Natale; i temi di prima che non sono categorie (Pasqua, San Valentino,
  "Parigi e Canarie"…) restano salvati ma non si mostrano (`temiVecchi()` si conservano salvando) e la ricetta va in Sempre.
  Esempi aggiornati una volta (`settings.ricetteCats`). "Parigi e Canarie" resta solo come atmosfera e musica di aprile.
- **Desideri e liste:** raccolta `liste` (`tipo: 'nostra' | 'amazon'`); "Desideri di casa" è la lista di sempre (desideri senza
  `lista`). Eliminare una lista riporta i suoi desideri a casa. Le liste Amazon: `GET /api/link?lista=` legge la pagina pubblica della
  lista (Amazon non ha un'API; pagine successive da `showMoreUrl` fino a `endOfListMarker`, una al secondo, niente insistenze se
  Amazon rifiuta) e l'app salva l'ultima lettura nella lista (`articoli`, `aggiornata`; si rilegge dopo 6 h o con "Aggiorna";
  dopo un rifiuto non riprova da sola per 30 min). Foto solo da `m.media-amazon.com`, link solo `amazon.xx/dp/ASIN`.
  Le vecchie `settings.listeAmazon` sono passate una volta a `liste` (`settings.listeV2`). `api/link.js` segue anche i link brevi
  (spotify.link, amzn.eu) solo verso Spotify/Amazon. Siamo a 11 funzioni in `api/` (il piano Hobby di Vercel ne permette 12).
- **Sicurezza:** ogni funzione protetta inizia con `respingi(req, res)` (`api/_lib.js`): 10 codici diversi sbagliati in 15 minuti
  dallo stesso indirizzo → bloccato per 15 minuti (lo stesso codice vecchio ripetuto da un telefono non blocca).
- **Notifiche** (Web Push, senza servizi esterni): `api/_push.js` (chiavi VAPID create da sole e tenute nel database, cifratura
  aes128gcm fatta a mano e verificata contro la libreria `web-push`), `api/push.js` (iscrizioni), `api/promemoria.js` (cron serale in
  `vercel.json`: rifiuti, compleanni, gatti), avvisi di arrivo/partenza in `api/posizione.js`, biglietti in `api/dati.js`.
  Lato app: `js/notifiche.js`, interruttori in Impostazioni, gestione in `sw.js`. Su iPhone servono l'app sulla schermata Home e iOS 16.4+.
- **Spotify** (`api/spotify.js` + `js/spotify.js`, pagina Musica): ognuno collega il suo account con OAuth PKCE (niente segreti:
  il Client ID dell'app di developer.spotify.com si scrive dall'app e sta nel database, `fam_meta` `m:spotify:*`, insieme ai refresh token).
  Redirect URI registrato: `https://comperotto.vercel.app/api/spotify`. I dispositivi chiedono a `/api/spotify?azione=token` un token di un'ora
  e parlano direttamente con api.spotify.com. Pagine in `js/views/spotify.js`: `#/musica` (lettore, cerca, libreria), `#/musica/cerca`,
  `/preferiti`, `/pl/<id>`, `/album/<id>`, `/artista/<id>`, foglio "⋯" del brano (coda, preferiti, playlist). Barra del brano trascinabile
  (seek), niente volume. Suggerimenti: musica a tema del periodo (`MUSICA_TEMA` in `js/data.js`, periodo da `periodoMusica()` in
  `season.js`, trovata con la ricerca e tenuta una settimana) e "Scelti per te" (artisti dei brani salvati → loro brani non salvati e
  uscite dell'ultimo anno: le raccomandazioni di Spotify non ci sono più per le app nuove). "La nostra musica" non c'è più (i dati restano).
  Lettore (`js/spotify.js`): dopo un comando lo schermo cambia subito e le "attese" tengono lo stato chiesto finché Spotify non lo
  conferma (min 2,5 s, max 4,5 s: gli Echo rispondono in ritardo); comandi in fila uno alla volta; richieste con timeout di 10 s e
  pausa automatica sui 429; si ridisegna solo se cambia brano/stato/dispositivo; la barra la muove un orologio locale (250 ms).
  "Questo iPhone/iPad" = Web Playback SDK (`sdk.scdn.co`, caricato e preparato entrando in Musica; `activateElement()` dentro il tocco;
  vuole i permessi `streaming user-read-email user-read-private`, altrimenti "Invalid token scopes").
  Di base la musica parte qui (`doveSuonare()` → `QUI`): un altro dispositivo solo se scelto in "Dove ascoltare?" e ancora collegato
  (è quello attivo o scelto da meno di 30 min; `casa.spotify.dev` = `{ id, at }`). Mini lettore fisso (`miniLettore()`, nel
  `#mini` fuori dalla pagina, su tutte le pagine tranne `#/musica`); un tocco apre la finestra del lettore (`grandeLettore()` nel
  `#np`, fuori dalla pagina: sul telefono sale dal basso e si chiude trascinandola giù, su iPad è al centro; "Dopo" da
  `me/player/queue`, nome delle playlist altrui da `playlists/{id}?fields=name`). Scorrendo di lato sulla copertina della finestra o
  sul banner si cambia brano; un brano di "Dopo" si tocca e parte (`saltaA()`: tanti "avanti" quanti servono; Spotify non ha comandi
  per togliere o spostare brani dalla coda). Titolo e copertina cambiano insieme: copertine dei prossimi brani scaricate prima
  (`precarica()`), brano dopo mostrato subito se noto (`prossimo()`), altrimenti si aspetta la copertina al massimo 1,2 s
  (`insieme()` in `views/spotify.js`). Gli elementi con `data-gesto` tengono lo stile del gesto durante i ridisegni.
  Il giro di aggiornamento continua anche fuori da Musica
  (10 s se suona, 30 s in pausa, 60 s senza niente; mai con l'app in secondo piano) e parte all'avvio (`avviaSpotify()`).
  Regole 2026 (modalità sviluppo, max 5 utenti, proprietario Premium): ricerca max 10 per tipo, `tracks`→`items` nelle playlist,
  preferiti con `PUT/DELETE me/library?uris=`, brani solo delle playlist proprie (`/playlists/{id}/items`, altrimenti 403).
  Collegamenti senza i permessi nuovi → `completo: false` e la pagina chiede "Ricollega".
- **Film:** categorie in `FILM_CATS` (`js/data.js`): Famiglia, Natale, Halloween, Sempre, Thriller, Azione, Horror, Cartoni; dai generi
  di JustWatch (`ani` → cartoni) e di Apple si propongono da sole. Gli esempi si aggiornano una volta (`settings.filmCats`, ora 2).
- **Caselle di ricerca:** la X per cancellare è `cancella(id, poi)` di `core.js` (si vede solo con del testo, via `:placeholder-shown`).
- **Spesa:** reparti in `SHOP_CATS` (`js/data.js`) nell'ordine del giro; gli id vecchi passano da `LEGACY_CATS` (il vecchio `freschi` ora è `frigo`).
- **Avvio e aggiornamenti:** un dispositivo già collegato parte subito dai dati salvati (non aspetta `/api/stato`). A ogni pubblicazione
  cambiare `CACHE` in `sw.js`: l'app aperta si ricarica da sola (non mentre si scrive). I caratteri sono in `assets/fonts/`.
- **Controllo delle pagine:** prima di pubblicare modifiche di aspetto, provarle su iPhone piccolo (320 px), iPhone, iPad verticale
  (colonna unica tra 700 e 999 px) e orizzontale, in chiaro e scuro e con le atmosfere delle feste.
- **Sito pulito:** è un'app interna di famiglia: niente spiegazioni tecniche, crediti o link "obbligatori" nelle pagine (es. sulla mappa); le spiegazioni vanno date in chat.
- **Stile:** pastello in tinta con la casa; le feste con i loro colori pieni (Natale verde/rosso/bianco,
  Halloween nero/arancione). Pensata per iPhone e iPad.
- **iPad, barra laterale:** di base stretta (solo icone, `--side-w: 76px`); il tasto in alto la allarga/stringe e ogni dispositivo
  ricorda la scelta (`localStorage` `casa.side`, applicata subito dallo script in `index.html`).
- **Gesti iPhone** (`js/gestures.js`): fogli da trascinare giù, indietro dal bordo sinistro (solo app installata),
  tira giù per aggiornare, righe da scorrere (`swipe()` in `core.js`: destra = spunta, sinistra = elimina con Annulla).
- Niente build: HTML/CSS/JS moderni (`index.html`, `css/`, `js/`), funzioni Vercel in `api/`.
