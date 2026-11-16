# Fam. Comperotto

La casa della famiglia Comperotto, in tasca: Patrick, Serena, Thor e Minù.
Un'app fatta su misura per **iPhone e iPad** (si installa dalla schermata Home e si apre a tutto schermo, come un'app vera) con:

- **Spesa**: divisa per reparto in automatico, "spesso comprati" con un tocco, carrello e "svuota", e voci aggiunte con **Alexa**.
- **Casa**
  - **Faccende** che si ripetono (lettiera, lavatrice, lenzuola, bagno…) con scadenze e chi le ha fatte;
  - **Lavori** da fare (tagliare le tende, sistemare i mobili…) per stanza e priorità;
  - **Rifiuti**: il calendario della raccolta. Ogni sera la Home dice cosa portare fuori.
- **Ricette** per tema (Tutti i giorni, Natale, Capodanno, San Valentino, Pasqua, Estate, Halloween, Compleanni, Parigi e Canarie): si aggiungono e si modificano dall'app (tasto **+ Ricetta**, e **Modifica ricetta** in fondo a ognuna), con foto. Si spuntano gli ingredienti e finiscono nella spesa; c'è il dado "cosa cuciniamo?" e il tasto **Tieni lo schermo acceso** mentre si cucina.
- **Noi**
  - **Film e serie**, a tema e non, con **dove vederli in Italia** aggiornato dal vivo;
  - **Musica** a tema del periodo, con il lettore Spotify integrato;
  - **Desideri**: cose da comprare con prezzo, link e totale;
  - **Thor e Minù**: foto, età, peso, antiparassitari, vaccini e veterinario, con promemoria.
- **Lavagnetta** in Home per lasciarsi biglietti, **conto alla rovescia** per le feste e i compleanni (Serena il 29/04, Patrick il 20/12, Thor e Minù il 04/10): il giorno giusto la Home fa festa.
- **Atmosfere stagionali**: cambiano colori e decorazioni da sole.

| Periodo | Atmosfera |
|---|---|
| Aprile | **Da Parigi alle Canarie**, il mese di Serena: rosa macaron, Tour Eiffel, oceano e palme |
| Luglio e agosto | **Mare**: sabbia, onde e sole |
| Ottobre | **Halloween**: zucca, notte viola e pipistrelli |
| 20 novembre – 6 gennaio | **Natale**: abete, rosso bacca, oro e neve |
| Il resto dell'anno | **Casa**: lino, rovere del parquet e tortora |

Tutto funziona sia in chiaro sia in scuro. In *Impostazioni → Atmosfera* si può anche forzarne una per provarla.

### Su misura per iPhone e iPad

- **iPhone**: barra in basso a portata di pollice, fogli che salgono dal basso e restano sopra la tastiera, rispetto di notch/Dynamic Island e barra Home, vibrazione leggera ai tocchi (iOS 18+), niente zoom involontari sui campi.
- **iPad**: barra laterale, Home e ricette su due colonne (ingredienti a sinistra, passaggi a destra), spesa su due colonne, finestre al centro invece dei fogli, griglie più larghe per ricette e film; funziona in verticale, in orizzontale e in Split View.
- Schermate di avvio per i modelli recenti di iPhone e iPad, icona dedicata, funzionamento offline.

---

## Checklist per renderla "finita"

| | Cosa | Serve? | Dove |
|---|---|---|---|
| 1 | Pubblicarla con **GitHub Pages** | Sì | sezione 1 |
| 2 | **Firebase**: dati condivisi tra iPhone e iPad | Sì (senza, ogni dispositivo ha i suoi dati) | sezione 3 |
| 3 | Installarla su **ogni iPhone/iPad** | Sì | sezione 2 |
| 4 | **Skill Alexa** | Per usare la voce | sezione 4 |
| 5 | Chiave **TMDB** | Per locandine e "dove vederlo" | sezione 5 |
| — | Vercel, Netlify o altri server | **No** | GitHub Pages ospita il sito, Firebase i dati, Amazon la skill |

## 1. Metterla online (5 minuti)

Il sito è fatto solo di file statici: niente server da gestire, niente Vercel.

1. Su GitHub apri il repository → **Settings → Pages**.
2. In *Build and deployment* scegli **Deploy from a branch** → branch **main**, cartella **/ (root)** → **Save**.
3. Dopo un paio di minuti il sito è su <https://spaceestate.github.io/Comperotto/>.
4. (Consigliato) **Settings → General → Default branch**: imposta **main**.

> Il repository è **pubblico**: il codice si vede, i vostri dati no (stanno nel vostro database, protetti da password). Per questo **non mettete foto della casa nel repository**: le foto dei gatti e delle ricette si caricano dall'app e finiscono nel database.

## 2. Installarla su iPhone e iPad

Apri il sito con **Safari** → tasto **Condividi** → **Aggiungi alla schermata Home** → *Aggiungi*.

Si apre a schermo intero, con la sua icona (la casetta-gatto) e il nome **Comperotto** (nella finestra di installazione potete cambiarlo in "Fam. Comperotto": i nomi lunghi su iPhone vengono accorciati). Funziona anche senza rete.

> Su iPhone/iPad l'app installata ha una memoria separata da Safari: fate l'accesso (o l'installazione) direttamente dall'icona. Con Firebase non è un problema, i dati arrivano dal database.

## 3. Sincronizzare i due telefoni (Firebase, gratis, ~10 minuti)

Senza questo passaggio l'app funziona, ma ogni telefono ha i suoi dati. Con Firebase spesa, faccende e il resto si aggiornano in tempo reale su entrambi i telefoni (e Alexa può scriverci).

1. Vai su <https://console.firebase.google.com> → **Aggiungi progetto** (es. "fam-comperotto"). Google Analytics non serve.
2. **Authentication** → *Inizia* → abilita **Email/password**.
   Poi in *Users* → **Aggiungi utente** e crea:
   - il tuo account (la tua email + una password);
   - quello di Serena;
   - un account per Alexa, ad esempio `alexa@tuodominio.it` con una password lunga (l'email non deve esistere davvero).
3. **Firestore Database** → *Crea database* → scegli la località `eur3 (europe-west)` → modalità **produzione**.
4. In Firestore → **Regole**, incolla il contenuto del file [`firestore.rules`](firestore.rules) **mettendo le vostre tre email** al posto di quelle di esempio, poi **Pubblica**.
5. Impostazioni progetto (rotellina) → *Le tue app* → icona **Web `</>`** → registra l'app (Hosting non serve). Copia i valori di `firebaseConfig`.
6. Incollali in [`js/config.js`](js/config.js) dentro `FIREBASE_CONFIG` (si può fare anche dal sito di GitHub con la matita ✏️ → *Commit changes* su `main`). In alternativa mandateli a Claude e li inserisce lui.
7. Riapri l'app: chiede email e password. Al primo accesso carica ricette, faccende, film e musica di esempio, poi chiede "chi sei?".

I valori di `firebaseConfig` non sono segreti (Google li prevede pubblici): a proteggere i dati sono il login e le regole del passaggio 4, che accettano solo le vostre email.

## 4. Alexa

**Perché serve una skill**: dal **luglio 2024 Amazon non permette più** alle app esterne (AnyList, Todoist, Bring… e anche noi) di leggere o scrivere la lista della spesa *interna* di Alexa. L'unica strada ufficiale è una **skill personale**, che scrive direttamente nella vostra lista. Le frasi sono:

- «Alexa, chiedi a **casa comperotto** di aggiungere il latte e le uova»
- «Alexa, chiedi a casa comperotto cosa c'è da comprare»
- «Alexa, chiedi a casa comperotto di togliere il latte»
- «Alexa, chiedi a casa comperotto cosa si butta stasera» (o «domani»)
- «Alexa, chiedi a casa comperotto cosa c'è da fare oggi»

Le cose aggiunte a voce compaiono nell'app con il bollino **Alexa**.

**Come attivarla** (serve prima il passo 3, Firebase):

1. Vai su <https://developer.amazon.com/alexa/console/ask> ed entra con **lo stesso account Amazon dei vostri Echo**.
2. **Create Skill** → nome "Fam. Comperotto", lingua **Italian (IT)**, tipo **Other → Custom**, hosting **Alexa-hosted (Node.js)**, template *Start from scratch*.
3. Scheda **Build → Interaction Model → JSON Editor**: incolla il contenuto di [`alexa-skill/skill-package/interactionModels/custom/it-IT.json`](alexa-skill/skill-package/interactionModels/custom/it-IT.json) → **Save** → **Build skill**.
4. Scheda **Code**: sostituisci `index.js` e `package.json` con quelli di [`alexa-skill/lambda/`](alexa-skill/lambda/), aggiungi il file `firestore.js` e crea un file **`config.js`** copiando [`config.example.js`](alexa-skill/lambda/config.example.js) con:
   - `apiKey` e `projectId` di Firebase (gli stessi di `js/config.js`);
   - email e password dell'account Alexa creato al passo 3.2.

   Poi **Save** → **Deploy**. `config.js` resta solo nella console Amazon e non va mai nel repository (è già escluso in `.gitignore`).
5. Scheda **Test**: imposta *Skill testing is enabled in: Development* e prova a scrivere «chiedi a casa comperotto di aggiungere il latte».

Una skill "in sviluppo" funziona già su **tutti gli Echo collegati al vostro account**, senza pubblicarla nello store.

**Consiglio**: se a volte Alexa mette la cosa nella *sua* lista invece che nella vostra, dite prima «Alexa, apri casa comperotto» e poi «aggiungi il latte». Per non dire la frase lunga potete creare una **Routine** nell'app Alexa (es. «Alexa, spesa» → *Personalizzato*: «apri casa comperotto»).

## 5. Film: dove vederli (opzionale, gratis)

Il catalogo di Netflix, Prime Video, Disney+ e degli altri cambia di continuo, quindi l'app lo chiede **dal vivo** a TMDB (che usa i dati JustWatch per l'Italia):

1. Crea un account su <https://www.themoviedb.org> → Impostazioni → **API** → richiedi una chiave (uso personale).
2. Nell'app: **Impostazioni → Film** → incolla la chiave (va bene sia la "API Key" sia il "Read Access Token").

Da quel momento la ricerca dei film mostra le locandine, e su ogni film compaiono le piattaforme (abbonamento, noleggio, acquisto), aggiornate ogni volta che lo aprite. La chiave sta nel vostro database, non nel codice pubblico. Senza chiave c'è comunque il tasto "Cerca su JustWatch".

## 6. Musica

Aggiungete brani, album o playlist con un tema (Natale, Halloween, Estate, Parigi e Canarie…). Se incollate un **link Spotify** (Condividi → Copia link) si ascolta direttamente nell'app. Nel periodo giusto la sezione mette in cima la musica a tema.

---

## Com'è fatto

```
index.html              guscio dell'app
manifest.webmanifest    installazione come app (icona, colori)
sw.js                   funzionamento offline
css/style.css           stile: palette di casa e atmosfere stagionali
js/config.js            configurazione Firebase (da compilare)
js/store.js             dati: Firebase oppure solo sul telefono
js/core.js              stato, fogli dal basso, avvisi
js/data.js              reparti, temi, stagioni, rifiuti, faccende
js/season.js            atmosfere stagionali e decorazioni
js/seed.js              esempi iniziali (ricette, film, musica, faccende)
js/tmdb.js              film e "dove vederlo"
js/views/*.js           le schermate
alexa-skill/            skill Alexa (modello italiano + codice)
firestore.rules         regole di sicurezza del database
```

Niente framework e niente build: HTML, CSS e JavaScript moderni. Per modificarla basta cambiare i file e fare push; il telefono prende la nuova versione alla riapertura successiva.

Per provarla sul computer:

```bash
python3 -m http.server 8000
```

e apri <http://localhost:8000>.

### Personalizzare

- **Colori**: le variabili all'inizio di `css/style.css` (ogni stagione ha il suo blocco in fondo).
- **Date delle atmosfere**: `seasonFor()` in `js/data.js`.
- **Compleanni e anniversari**: dall'app, *Impostazioni → Noi due* e *Ricorrenze* (formato gg/mm o gg/mm/aaaa). Nel codice pubblico ci sono solo giorno e mese; l'anno, se lo aggiungete dall'app, resta nel vostro database. Il giorno del compleanno la Home fa festa.
- **Calendario rifiuti**: dall'app, *Casa → Rifiuti* (impostatelo con i giorni del vostro comune).
- **Backup**: *Impostazioni → Scarica un backup* salva tutto in un file JSON.
