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
- **Pagine e barra:** Home · Cibo · Casa · Svago · Desideri (su iPad la barra laterale aggiunge Dov'è, Thor e Minù, Viaggi, Impostazioni).
  Barra in basso bassa: `--tabbar-h: 50px` più 3+2 px (gli scostamenti di FAB, avvisi e mini lettore ne tengono conto).
  Cibo = Spesa | Ricette (`#/cibo/spesa`, `#/cibo/ricette`), Svago = Film | Musica (`#/svago/film`, `#/svago/musica`): pagine a due
  zone (`js/views/zone.js`), schede in cima e una zona per volta anche su iPad; ogni dispositivo ricorda l'ultima (`casa.cibo`,
  `casa.svago`). Casa = Faccende, Lavori; il calendario dei rifiuti è in Impostazioni (`#/impostazioni/rifiuti`, `renderRifiuti()`
  di `casa.js`). Pagine interne: `#/ricette/<id>`, `#/musica/<…>` (accendono la loro scheda).
  I vecchi indirizzi (`#/casa/spesa`, `#/casa/rifiuti`, `#/ricette`, `#/film`, `#/musica`, `#/noi/…`) si correggono da soli (`canonico()` in `app.js`).
- **Home:** Dov'è, Oggi in casa (faccende e rifiuti di stasera), Lavori (i primi tre), Viaggi, Thor e Minù, atmosfera del periodo,
  conto alla rovescia. Niente riquadri colorati e niente lavagnetta (i biglietti restano nella raccolta `bacheca`).
- **Viaggi** (`js/views/viaggi.js`, `#/viaggi`, `#/viaggi/<id>`): liste per la valigia (raccolta `viaggi`) e le cose da portare, una per
  documento (`valigia`, così si spunta in due insieme). Modelli Mare, Montagna, Weekend o copia di un'altra lista; aggiunta veloce
  anche a virgole (le doppie si saltano); «Ricomincia» toglie le spunte per il viaggio dopo.
- **Spesa:** sopra solo la linea di avanzamento (i conti sono sulla scheda Cibo e in alto); niente aggiunte rapide (`freq` resta).
- **Dov'è, mappa:** più alta; un tocco (o il pulsante) la apre a tutto schermo (`ui('dove.grande')`, `.map-card.grande`), X o Esc la chiudono.
- **Auto ("Ho parcheggiato"):** il pulsante è un comando rapido sulla schermata Home dell'iPhone (istruzioni nel README), non un tasto
  dell'app: si preme e basta. Manda `POST /api/posizione?auto` con JSON `{ codice, chi, lat, lon }` (il codice nel corpo, mai nell'indirizzo;
  vanno bene anche x-famiglia o Basic; numeri anche "45,07" con la virgola) e riceve in testo semplice «Posizione inviata», che il comando
  mostra come notifica (gli errori sono frasi brevi). Si salva in `posizioni/auto` (`{ lat, lon, acc, at, chi, place, nota, src }`: non è una
  persona, niente avvisi né zone); indirizzo con civico e nome del parcheggio da `api/_luogo.js` (se non arriva in 1,5 s lo cerca l'app con
  `/api/geocodifica?lat&lon`). Nell'app si vede e basta: riga Auto nel riquadro Dov'è della Home (→ `#/dove/auto`, la mappa parte
  dall'auto), sezione Auto in Dov'è con la scheda (Portami all'auto a piedi, nota, togli con Annulla), segnaposto azzurro sempre visibile
  sotto le persone (toccandolo si apre la scheda, non la mappa grande). Nessuna funzione nuova in `api/`.
- **Ricette online:** `api/ricette.js` cerca su GialloZafferano (pagina pubblica dei risultati: ordine dall'`ItemList` schema.org,
  foto/voto/difficoltà/tempo dalle schede, solo `ricette.giallozafferano.it`) e importa da link con i dati schema.org (controlli contro
  indirizzi interni; nei passaggi di GZ si tolgono i rimandi alle foto). Fatto in casa da Benedetta è stato tolto: il sito blocca
  i programmi (verifica Cloudflare) e non va aggirato; un link di un sito così all'importazione dà un messaggio chiaro.
- **Ricette, categorie:** `RICETTE_CATS` (`js/data.js`): Natale, Halloween, Sempre, Estate, Colazione, Dolci (i filtri della pagina e il
  campo "Categoria"). `ricetteCats(r)`: Capodanno conta come Natale; i temi di prima che non sono categorie (Pasqua, San Valentino,
  "Parigi e Canarie"…) restano salvati ma non si mostrano (`temiVecchi()` si conservano salvando) e la ricetta va in Sempre.
  Esempi aggiornati una volta (`settings.ricetteCats`: 1 crêpes in Colazione, 2 crêpes/tiramisù/biscotti anche in Dolci).
- **Filtri e categorie** (`#/impostazioni/categorie[/film|/ricette|/spesa]`, matita in fondo ai filtri di Film e Ricette): per tutta la
  casa si tolgono categorie e reparti e se ne aggiungono di nuovi. In settings `categorieFilm` / `categorieRicette` / `categorieSpesa` =
  `{ spente, mie }` (`mie`: `{ id, label, icon }`, per i reparti `{ id, label, emoji, color, dopo }` = nel giro dopo quel reparto).
  `FILM_CATS`, `RICETTE_CATS` e `SHOP_CATS` restano gli stessi oggetti ma li rifà `usaCategorie(settings())` prima di ogni disegno
  (`elencoCategorie()` dà anche quelle tolte). Togliere = nascondere, mai cancellare: film e ricette tengono i loro temi
  (`filmTemiNascosti()`, `temiVecchi()`, `temiDaSalvare()`: salvando senza toccare non si aggiunge «Sempre»), i prodotti il loro reparto
  (si vedono in «Altro»; nel foglio il reparto si scrive solo se lo si cambia). «Sempre» e «Altro» non si tolgono. L'id viene dal nome
  (`idCategoria()`): rifacendo «Pasqua» tornano le ricette che l'avevano; riaggiungendo una tolta, si riaccende. Le vostre categorie dei
  film si propongono da sole dai generi della ricerca (`generi` da `api/film.js`, `categorieDaGeneri()`: es. Commedia ← `cmy`).
  "Parigi e Canarie" resta solo come atmosfera e musica di aprile. Nel tema scuro si attenuano solo i segnaposto colorati,
  mai le foto vere (`.r-ph:not(.r-ph-cover)`).
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
  (seek), niente volume. In "Dove ascoltare?" ogni dispositivo si può nascondere (nomi in `settings.spotifyNascosti`, per tutta la casa;
  quello che suona si vede sempre). La Web API elenca solo i dispositivi "attivi e comandabili": gli Echo a riposo spesso mancano (l'app
  Spotify li vede anche sul Wi-Fi). Con il foglio aperto la lista si aggiorna da sola ogni 4 s per 2 minuti (`seguiDispositivi()`), così un
  Echo svegliato con «Alexa, Spotify Connect» compare da solo; in fondo "Manca un Echo di casa?" (chiuso) lo spiega, e ricorda che gli
  Echo compaiono solo per l'account Spotify collegato nell'app Alexa (Altro → Impostazioni → Musica e podcast). Suggerimenti: musica a tema del periodo (`MUSICA_TEMA` in `js/data.js`, periodo da `periodoMusica()` in
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
  Limiti 2026 verificati: album di un artista **max 10 per richiesta** (`artists/{id}/albums`, prima chiedevamo 30 e Spotify
  rifiutava: la discografia non si vedeva), ricerca max 10; niente `top-tracks`, artisti simili, novità, categorie, letture a gruppi.
  Musica come l'app Spotify: in cima "Ascoltati di recente" (`me/player/recently-played`, contesti senza doppioni; nomi e foto di
  playlist e artisti letti a parte) e "I tuoi artisti" (`me/top/artists`, ultime settimane): permessi `user-read-recently-played`
  e `user-top-read`, facoltativi (`extra: false` → invito a ricollegare, il resto va). Libreria a schede Playlist · Album (`me/albums`)
  · Artisti (`me/following`), scelta ricordata (`casa.spotify.lib`). Ricerca "Tutto": risultato migliore (`migliore()`: l'artista,
  brano, album o playlist col nome più vicino), 4 brani (partono con dopo gli altri trovati), artisti, album, playlist.
  Artista (`#/musica/artista/<id>`): Segui (`me/library` con l'URI dell'artista), brani (dalla ricerca `artist:"Nome"`, solo i suoi,
  senza doppioni: Spotify non dà più i "popolari"), ultima uscita, discografia a schede (album, singoli ed EP, compilation; gruppi
  letti a parte, 10 per volta) e "Appare in". Discografia completa: `#/musica/artista/<id>/discografia/<gruppo>` ("Altri" 10 per volta;
  i bottoni dei gruppi non riempiono la storia). Album: copertina grande, artisti toccabili, dischi, "E" sui brani espliciti, data,
  durata, diritti (℗ ©), "Altro di…". Comandi delle pagine come su Spotify (`azioni()`: ♥/Segui e ⋯ a sinistra, casuale e il grande
  play a destra). ⋯ di album e artisti: vai all'artista, discografia, condividi, apri in Spotify; ⋯ del brano: anche ogni artista e
  condividi. "Indietro" torna alla pagina di Musica di prima (pila in `segnaStoria()`). Lettore: "Ripeti" (spento → tutto → solo
  il brano, con l'1; `me/player/repeat`, stato confermato come "casuale") al posto dell'icona dei dispositivi (che resta sotto).
  La musica non si ferma: il lettore dentro l'app chiede un token fresco (`token(k, true)` → `azione=token&min=1200`; la durata si
  conta da `resta` del server, mai con l'orologio del telefono) e su `authentication_error` a metà ascolto si ricollega (una volta al
  minuto al massimo); l'app non si ricarica per una versione nuova mentre suona qui (`quiInUso()`, anche nei 15 s tra due brani);
  schermata di blocco con titolo, copertina e comandi (Media Session). iPhone e iPad fermano l'audio delle app web a schermo spento o
  in secondo piano (regola di Apple, non aggirabile): uscendo dall'app mentre suona qui la musica passa all'app Spotify dello stesso
  dispositivo se è tra i dispositivi (`passaAllApp()`, `fetch` con `keepalive`; mai su un Echo), e i dispositivi si rileggono ogni
  minuto mentre suona qui. "Scelti per te" è per account (`caricaSuggerimenti(k)`, `chiaveDi(k, …)`; cambiando libreria si
  caricano quelli dell'altro) e, con pochi preferiti, guarda anche le playlist e gli ascolti recenti; le novità leggono singoli e
  album a parte. Quando non suona niente, in cima "Da ascoltare oggi" (`consiglioCard()`: da "Scelti per te", altrimenti dalla
  musica del periodo; una al giorno, il dado ne propone un'altra) che parte solo toccando «Ascolta», con dopo le altre.
  La scheda in cima (consigliata o in riproduzione) è fatta come «Stasera guardiamo…» dei film: copertina sfocata dietro
  (`--copertina` sulla scheda, `.sp-now-bg`), testo chiaro, tasti tondi (dado o cuore) e le casse (`casse()`, icona `casse`) che
  aprono «Dove ascoltare?»: accese e con il nome accanto quando si ascolta su un altro dispositivo. Niente più linguetta del dispositivo.
- **Film:** categorie in `FILM_CATS` (`js/data.js`): Famiglia, Natale, Halloween, Sempre, Thriller, Azione, Horror, Cartoni; dai generi
  di JustWatch (`ani` → cartoni) e di Apple si propongono da sole. Gli esempi si aggiornano una volta (`settings.filmCats`, ora 2).
  «Stasera guardiamo…» (`stasera()`) è sempre in cima: con una categoria scelta propone un film di quella, altrimenti uno da vedere.
  Accanto a Da vedere · Visti · Tutti ci sono «Film» e «Serie TV» (`TIPI`, `ui('film.tipo')`: solo film o solo serie, toccando di nuovo
  si torna a tutti e due): si sommano alle categorie e valgono anche per «Stasera guardiamo…»; dalla Home si riparte da tutti e due.
- **Caselle di ricerca:** la X per cancellare è `cancella(id, poi)` di `core.js` (si vede solo con del testo, via `:placeholder-shown`).
- **Spesa:** reparti in `SHOP_CATS` (`js/data.js`) nell'ordine del giro; gli id vecchi passano da `LEGACY_CATS` (il vecchio `freschi` ora è `frigo`).
  Stesso prodotto solo se il nome è uguale o cambia per parole "di riempimento" (`stessoProdotto()`/`nucleo()` in `spesa.js`: medie,
  grandi, freschissime, q.b., a temperatura ambiente…): zucchero, zucchero a velo e zucchero di canna sono tre cose diverse (come farina
  e farina 00). Dalle ricette le parole di riempimento si tolgono anche dal nome ("Burro"). La stessa regola è nella lambda di Alexa
  ("togli…"): va reincollata nella console per averla.
- **Avvio e aggiornamenti:** un dispositivo già collegato parte subito dai dati salvati (non aspetta `/api/stato`). A ogni pubblicazione
  cambiare `CACHE` in `sw.js` e `VERSIONE` in `js/config.js`: l'app aperta si ricarica da sola (non mentre si scrive). I caratteri sono in `assets/fonts/`.
- **Copia dei dati sul dispositivo:** IndexedDB (database `comperotto`, archivio `raccolte`, una voce per raccolta), caricata prima del
  primo disegno (`SyncStore.carica()`, `await` in `startSync`); la prima volta vi passa da sola la copia di localStorage (poi tolta).
  Coda (`casa.sync.q`) e versioni (`casa.sync.v`) restano in localStorage; la versione di una raccolta si salva solo quando la sua copia
  è salvata (altrimenti al prossimo avvio si riscarica). Se IndexedDB non si apre si usa localStorage (`casa.sync.ls`).
- **Sincronizzazione mai bloccata:** se le mie modifiche non partono, quelle dell'altro arrivano lo stesso (pull anche se il flush fallisce).
  Una modifica rifiutata per sempre si toglie solo lei: 400 con `indice` dal server, 413 (troppo grande per Vercel, 4,5 MB) → pacchetti
  più piccoli fino a quella sola; avviso con `onScarto`. Raccolte grandi a pagine: `GET /api/dati?col=…&pagine=1[&da=<id>]`
  (al massimo 2,5 milioni di caratteri per risposta, `prossimo`). Postgres non accetta il carattere nullo: si toglie dai testi.
- **Sincronizzazione a pezzi** (Postgres, cioè Neon): ogni documento ha la versione della raccolta in cui è cambiato (`fam_docs.v`),
  i tolti lasciano un segno (`fam_tolti`, al massimo 500 per raccolta) e `fam_ver.base` dice da quale versione bastano i pezzi.
  Lo schema si aggiorna da solo una volta (`fam_meta` `schema` = 2, sotto `pg_advisory_xact_lock`; al primo giro base = versione).
  `GET /api/dati?col=…&pagine=1&dal=<v>` → `{ v, items, tolti, pezzi: true }` con solo i cambiati; se `dal` < base o > v (database
  ripristinato) arriva tutto. L'app chiede i pezzi solo se ha la copia intera (`copia`: caricata da IndexedDB o appena scaricata),
  li unisce alla sua copia e riapplica la coda solo sui documenti arrivati (così un "+1" non si conta due volte). Redis: sempre tutto.
  Letture: prima la versione, poi i documenti (mai versione nuova con documenti vecchi). Scritture: la versione si prende all'inizio
  della transazione (riga bloccata fino alla fine), raccolte in ordine alfabetico (niente blocchi reciproci).
- **Collegamento** (Impostazioni): per Patrick e Serena, quando ogni dispositivo ha usato l'app, versione, se è installata sulla schermata
  Home, posizione (OwnTracks o app, batteria) e notifiche (accese, ultima arrivata o no). L'app manda `x-chi` e
  `x-app: versione;home|web;iPhone|iPad|…` (l'iPad si presenta come Mac: il tipo lo dice l'app); il server salva in `fam_meta` `visti`
  (al massimo una volta al minuto per dispositivo) e gli esiti delle notifiche in `push:esiti` (impronta dell'iscrizione, mai l'indirizzo).
  `GET /api/dati?visti=1`. La batteria ha `battAt`: si mostra solo se è di meno di 3 ore (la posizione dall'app non la porta).
  OwnTracks rifiutato (401/429): `api/posizione.js` ricorda quando e perché in `fam_meta` `ot:rifiuto:<p1|p2>` (mai il codice;
  utente da Basic, `X-Limit-U` o `topic`) e Collegamento lo dice finché non arriva una posizione buona. OwnTracks per iPhone manda
  la password solo con "Authentication" acceso e in ASCII: con lettere accentate o apostrofi "curvi" manda `Basic (null)`.
- **Precaricamento** (`js/precarica.js`, 0,7 s dopo l'avvio, due file in parallelo, non in secondo piano né con "Risparmio dati"):
  Spotify di TUTTI E DUE gli account (prima chi usa il telefono: playlist, suggerimenti, recenti, i tuoi artisti, copertine con
  `scaldaCopertine()`) e il lettore dentro l'app pronto; tutte le locandine (anche dei già visti, max 160) e i loghi, tutte le foto di
  Amazon (senza referrer, max 200), le foto delle ricette decodificate prima (`preparaFoto()`, data URL, max 60). Alla fine la mappa
  di Dov'è preparata fuori dallo schermo (`.mappa-pronta`) e tenuta in memoria come dopo una visita (`preparaMappa()`; se si entra in
  Dov'è a metà si aspetta quella, mai due mappe).
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
