# Fam. Comperotto

La casa della famiglia Comperotto, in tasca: Patrick, Serena, Thor e Minù.
Un'app fatta su misura per **iPhone e iPad** (si installa dalla schermata Home e si apre a tutto schermo, come un'app vera) con:

- **Casa**
  - **Spesa**: divisa per reparto in automatico, "spesso comprati" con un tocco, carrello e "svuota", e voci aggiunte con **Alexa**;
  - **Faccende** che si ripetono (lettiera, lavatrice, lenzuola, bagno…) con scadenze e chi le ha fatte;
  - **Lavori** da fare (tagliare le tende, sistemare i mobili…) per stanza e priorità;
  - **Rifiuti**: il calendario della raccolta. Ogni sera la Home dice cosa portare fuori.
- **Ricette** per tema (Tutti i giorni, Natale, Capodanno, San Valentino, Pasqua, Estate, Halloween, Compleanni, Parigi e Canarie): si aggiungono e si modificano dall'app (tasto **+ Ricetta**, e **Modifica ricetta** in fondo a ognuna), con foto. Si spuntano gli ingredienti e finiscono nella spesa; c'è il dado "cosa cuciniamo?" e il tasto **Tieni lo schermo acceso** mentre si cucina.
- **Film e serie**, a tema e non: copertina e **dove vederli in Italia** (abbonamento, noleggio, acquisto) arrivano da soli e si aggiornano ogni giorno; in cima un "Stasera guardiamo…".
- **Desideri**: cose da comprare con prezzo, link e totale.
- **Musica** a tema del periodo, con il lettore Spotify integrato (dalla Home o, su iPad, dalla barra laterale).
- **Thor e Minù**: foto, età, peso, antiparassitari, vaccini e veterinario, con promemoria (dalla Home).
- **Lavagnetta** in Home per lasciarsi biglietti, **conto alla rovescia** per le feste e i compleanni (Serena il 29/04, Patrick il 20/12, Thor e Minù il 04/10, il vostro anniversario il 18/07): il giorno giusto la Home fa festa.
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
| 1 | Progetto su **Vercel** collegato al repository | Sì (già fatto ✓) | sezione 1 |
| 2 | **Database** su Vercel (Neon, piano Free) | Sì: senza, ogni dispositivo ha i suoi dati | sezione 1 |
| 3 | Scegliere il **codice di famiglia** e installarla su **ogni iPhone/iPad** | Sì | sezione 2 |
| 4 | **Skill Alexa** | Per usare la voce | sezione 3 |

Niente Firebase, niente account da creare per l'app: i dati stanno nel database di Vercel e si aprono con il **codice di famiglia**.

## 1. Vercel: sito + database (5 minuti)

Il progetto è già collegato a Vercel, che pubblica da solo ogni modifica del branch **main**.

1. Su <https://vercel.com> apri il progetto **Comperotto** → **Settings → Git**: controlla che il *Production Branch* sia **main**. In *Settings → Build and Deployment* il *Framework Preset* è **Other** e i comandi di build restano vuoti.
2. Scheda **Storage** → **Create Database** → **Neon** (Serverless Postgres) → piano **Free**, regione **Frankfurt** (la più vicina) → **Create**. Poi **Connect Project** → *Comperotto*, tutti gli ambienti → **Connect**.
   Vercel aggiunge da solo le chiavi del database: non c'è niente da copiare, e non serve registrarsi sul sito di Neon (si accettano solo le condizioni dentro Vercel). Le tabelle (`fam_docs`, `fam_ver`, `fam_meta`) le crea l'app al primo avvio.
   - Se avete **già** un database Neon o Upstash nel team, basta **Connect** su quello: l'app usa solo le sue tabelle/chiavi (`fam_…`) e non tocca il resto. Meglio però un database nuovo, solo per casa.
   - Upstash su Vercel oggi è solo a consumo (pochi centesimi al mese per un uso come il vostro): se volete zero costi scegliete Neon.
3. **Deployments** → sull'ultimo deployment **⋯ → Redeploy**, così le funzioni vedono il database appena collegato.
4. Apri l'indirizzo del progetto (in alto nella pagina del progetto, es. `https://comperotto.vercel.app`): l'app chiede di **scegliere il codice di famiglia**. Fatto!

> Il repository è **pubblico**: il codice si vede, i vostri dati no (stanno nel database, protetti dal codice di famiglia). Per questo **non mettete foto della casa nel repository**: le foto dei gatti e delle ricette si caricano dall'app e finiscono nel database.
>
> GitHub Pages non serve più: aperta da lì l'app salverebbe i dati solo sul dispositivo. Usate sempre l'indirizzo Vercel.

Consumi: con i vostri due-tre dispositivi l'app resta ampiamente dentro il piano gratuito di Neon (aggiorna i dati ogni 6 secondi solo mentre è aperta e in primo piano; quando nessuno la usa il database si addormenta da solo e il primo accesso dopo una pausa impiega mezzo secondo in più). Le funzioni girano a Francoforte, vicino a voi e al database.

## 2. Codice di famiglia e installazione su iPhone e iPad

- **Primo dispositivo**: alla prima apertura scegliete il codice (almeno 6 caratteri, es. `thorminu2025`). Maiuscole e spazi non contano.
- **Gli altri**: in *Impostazioni → Invia il link* mandate l'indirizzo all'altro telefono; lì si apre, si scrive lo stesso codice e si sceglie "chi sei".
- **Installarla**: apri l'indirizzo con **Safari** → tasto **Condividi** → **Aggiungi alla schermata Home** → *Aggiungi*.

Si apre a schermo intero, con la sua icona (la casetta-gatto) e il nome **Comperotto** (nella finestra di installazione potete cambiarlo in "Fam. Comperotto": i nomi lunghi su iPhone vengono accorciati).

Le modifiche arrivano sugli altri dispositivi in pochi secondi. Senza rete l'app funziona lo stesso: le modifiche restano in attesa e partono appena torna la connessione.

> Su iPhone/iPad l'app installata ha una memoria separata da Safari: dopo averla aggiunta alla schermata Home apritela dall'icona e scrivete lì il codice.

## 3. Alexa

**Perché serve una skill**: dal **luglio 2024 Amazon non permette più** alle app esterne (AnyList, Todoist, Bring… e anche noi) di leggere o scrivere la lista della spesa *interna* di Alexa. L'unica strada ufficiale è una **skill personale**, che scrive direttamente nella vostra lista. Le frasi sono:

- «Alexa, chiedi a **casa mia** di aggiungere il latte e le uova»
- «Alexa, chiedi a casa mia cosa c'è da comprare»
- «Alexa, chiedi a casa mia di togliere il latte»
- «Alexa, chiedi a casa mia cosa si butta stasera» (o «domani»)
- «Alexa, chiedi a casa mia cosa c'è da fare oggi»

Le cose aggiunte a voce compaiono nell'app con il bollino **Alexa**.

**Come attivarla** (serve prima la sezione 1: Vercel con il database):

1. Vai su <https://developer.amazon.com/alexa/console/ask> ed entra con **lo stesso account Amazon dei vostri Echo**.
2. **Create Skill** → nome "Fam. Comperotto", lingua **Italian (IT)**, tipo **Other → Custom**, hosting **Alexa-hosted (Node.js)**, template *Start from scratch*.
3. Scheda **Build → Interaction Model → JSON Editor**: incolla il contenuto di [`alexa-skill/skill-package/interactionModels/custom/it-IT.json`](alexa-skill/skill-package/interactionModels/custom/it-IT.json) → **Save** → **Build skill**.
4. Scheda **Code**: apri `lambda/index.js`, cancella tutto e incolla il contenuto di [`alexa-skill/lambda/index.js`](alexa-skill/lambda/index.js). In alto cambia solo le due righe di `CONFIG`:
   - `apiUrl`: l'indirizzo Vercel dell'app seguito da `/api` (es. `https://comperotto.vercel.app/api`). Usate l'indirizzo di **produzione**, non quello di un'anteprima;
   - `codice`: il vostro codice di famiglia.

   Poi **Save** → **Deploy**. Il codice resta solo nella console Amazon: non scrivetelo mai nel file del repository pubblico.
5. Scheda **Test**: imposta *Skill testing is enabled in: Development* e prova a scrivere «chiedi a casa mia di aggiungere il latte».

Una skill "in sviluppo" funziona già su **tutti gli Echo collegati al vostro account**, senza pubblicarla nello store.

**Più corto: la Routine «Alexa, spesa».** «Alexa, aggiungi latte» da solo finisce sempre nella lista interna di Amazon (non si può cambiare). Con una Routine basta dire «Alexa, spesa»: risponde «Cosa ti serve?», dite «latte e uova», lei chiede «Altro?» e chiudete con «no».
App Alexa → **Altro → Routine → +** → *Quando succede questo*: **Voce** → «spesa» → *Aggiungi azione*: **Personalizzata** → «apri casa mia» → **Salva**.
Per le cose che comprate più spesso potete fare anche Routine dirette, es. «Alexa, manca il latte» → *Personalizzata*: «chiedi a casa mia di aggiungere il latte».

## 4. Film: copertine e dove vederli

Non c'è niente da configurare: quando aggiungete un film o una serie l'app cerca da sola la copertina e su quali piattaforme si trova in Italia (Netflix, Prime Video, Disney+… in abbonamento, a noleggio o da comprare), usando i dati pubblici di JustWatch, e li ricontrolla una volta al giorno perché il catalogo cambia spesso. Toccando una piattaforma si apre direttamente il film.

## 5. Musica

Aggiungete brani, album o playlist con un tema (Natale, Halloween, Estate, Parigi e Canarie…). Se incollate un **link Spotify** (Condividi → Copia link) si ascolta direttamente nell'app. Nel periodo giusto la sezione mette in cima la musica a tema.

---

## Com'è fatto

```
index.html              guscio dell'app
manifest.webmanifest    installazione come app (icona, colori)
sw.js                   funzionamento offline
css/style.css           stile: palette di casa e atmosfere stagionali
js/config.js            frase della skill Alexa
js/store.js             dati: condivisi via Vercel (con coda offline) o solo sul dispositivo
js/core.js              stato, fogli dal basso, avvisi
js/data.js              reparti, temi, stagioni, rifiuti, faccende
js/season.js            atmosfere stagionali e decorazioni
js/seed.js              esempi iniziali (ricette, film, musica, faccende)
js/views/*.js           le schermate
api/                    funzioni Vercel: stato, setup del codice, dati (Neon/Postgres o Upstash Redis), film
alexa-skill/            skill Alexa (modello italiano + codice)
```

Niente framework e niente build: HTML, CSS e JavaScript moderni, più tre piccole funzioni in `api/`. Per modificarla basta cambiare i file e fare push su `main`: Vercel la ripubblica da solo e il telefono prende la nuova versione alla riapertura successiva.

Per provarla sul computer con le funzioni e il database:

```bash
npx vercel dev
```

(oppure `python3 -m http.server 8000`: in quel caso salva i dati solo nel browser).

### Personalizzare

- **Colori**: le variabili all'inizio di `css/style.css` (ogni stagione ha il suo blocco in fondo).
- **Date delle atmosfere**: `seasonFor()` in `js/data.js`.
- **Compleanni e anniversari**: dall'app, *Impostazioni → Famiglia* (compleanni e "insieme dal", già impostato al 18/07/2020) e *Ricorrenze* (formato gg/mm o gg/mm/aaaa). Nel codice pubblico ci sono solo giorno e mese; l'anno, se lo aggiungete dall'app, resta nel vostro database. Il giorno del compleanno la Home fa festa.
- **Calendario rifiuti**: dall'app, *Casa → Rifiuti* (impostatelo con i giorni del vostro comune).
- **Backup**: *Impostazioni → Scarica un backup* salva tutto in un file JSON.
