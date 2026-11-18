# Fam. Comperotto

La casa della famiglia Comperotto, in tasca: Patrick, Serena, Thor e Minù.
Un'app fatta su misura per **iPhone e iPad** (si installa dalla schermata Home e si apre a tutto schermo, come un'app vera) con:

- **Le pagine** (barra in basso): **Home · Cibo · Casa · Svago · Desideri**. *Cibo* ha due schede, **Spesa** e **Ricette**; *Svago* ha **Film** e **Musica**; *Casa* ha **Faccende** e **Lavori**. Su iPad la barra laterale ha anche *Dov'è*, *Thor e Minù*, *Viaggi* e *Impostazioni*.
- **Home**: dov'è Patrick e Serena, *Oggi in casa* (faccende e cosa si butta stasera), i lavori più urgenti, i **Viaggi**, Thor e Minù, l'atmosfera del periodo e il conto alla rovescia.
- **Viaggi**: le liste per la valigia (ciabatte, pantaloni…): si parte da un modello (Mare, Montagna, Weekend) o da un'altra lista, si spunta mentre si prepara la valigia e *Ricomincia* la rimette a posto per il viaggio dopo.
- **Cibo e Casa**
  - **Spesa**: divisa per reparto in automatico, nell'ordine del giro al supermercato (🥬 Freschi, 🧀 Frigo, 🥖 Forno, 🍝 Dispensa, 🍫 Sfizi, 🧹 Casa, 🧴 Cura personale, 🐈 Animali, 🧊 Surgelati, 🥤 Bevande, 🛒 Altro: si vedono solo i reparti con qualcosa dentro), "spesso comprati" con un tocco, carrello e "svuota", e voci aggiunte con **Alexa**. Niente doppioni: ogni cosa ha la maiuscola, se è già da comprare non si ripete e se era nel carrello torna da comprare;
  - **Faccende** che si ripetono (lettiera, lavatrice, lenzuola, bagno…) con scadenze e chi le ha fatte;
  - **Lavori** da fare (tagliare le tende, sistemare i mobili…) per stanza e priorità;
  - **Rifiuti**: il calendario della raccolta si imposta in *Impostazioni → Calendario rifiuti*. Ogni sera la Home dice cosa portare fuori.
- **Filtri e categorie**: in *Impostazioni → Filtri e categorie* (o con la matita in fondo ai filtri di Film e Ricette) si tolgono le categorie dei film e delle ricette e i reparti della spesa che non servono, e se ne aggiungono di nuovi (con la loro icona o faccina; un reparto nuovo si mette nel giro dopo quello che volete). Vale per tutta la casa. Togliere non cancella niente: film, ricette e prodotti restano e, riaccendendo la categoria, tornano al loro posto (intanto i prodotti di un reparto tolto si vedono in *Altro*).
- **Ricette** per categoria (**Natale, Halloween, Sempre, Estate, Colazione, Dolci**): si aggiungono e si modificano dall'app (tasto **+ Ricetta**, e **Modifica ricetta** in fondo a ognuna), con foto. Si spuntano gli ingredienti e finiscono nella spesa; c'è il dado "cosa cuciniamo?" e il tasto **Tieni lo schermo acceso** mentre si cucina. La ricerca guarda prima nel vostro ricettario e poi **anche online** (vedi sezione 8), e una ricetta si può **importare da un link**.
- **Film e serie** per categoria (**Famiglia, Natale, Halloween, Sempre, Thriller, Azione, Horror, Cartoni**): copertina e **dove vederli in Italia** (abbonamento, noleggio, acquisto) arrivano da soli e si aggiornano ogni giorno, e cercando un titolo la categoria si propone dal genere; in cima, sempre, un "Stasera guardiamo…" (con una categoria scelta, un film di quella). Accanto a *Da vedere · Visti · Tutti* ci sono **Film** e **Serie TV**: si sommano alle categorie (es. *Serie TV* + *Horror*) e valgono anche per "Stasera guardiamo…".
- **Desideri**: più **liste** (quella di casa e quelle che create voi) con prezzo, link e totale, e le **liste dei desideri di Amazon** con foto, nome e prezzo di ogni prodotto: un tocco apre il prodotto su Amazon (sezione 9).
- **Musica** con **Spotify**: di base suona sul dispositivo che state usando, oppure su iPad, **Echo**…; mini lettore sempre in basso, ricerca, preferiti, playlist, musica a tema del periodo e suggerimenti "Scelti per te". Dalla Home o, su iPad, dalla barra laterale.
- **Thor e Minù**: foto, età, peso, antiparassitari, vaccini e veterinario, con promemoria (dalla Home).
- **Conto alla rovescia** per le feste e i compleanni (Serena il 29/04, Patrick il 20/12, Thor e Minù il 04/10, il vostro anniversario il 18/07): il giorno giusto la Home fa festa.
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
- **iPad**: barra laterale che si stringe a sole icone (tasto in alto, ogni iPad ricorda la scelta), Home e ricette su due colonne (ingredienti a sinistra, passaggi a destra), spesa su due colonne, finestre al centro invece dei fogli, griglie più larghe per ricette e film; funziona in verticale, in orizzontale e in Split View.
- Schermate di avvio per i modelli recenti di iPhone e iPad, icona dedicata, funzionamento offline.

---

## Checklist per renderla "finita"

| | Cosa | Serve? | Dove |
|---|---|---|---|
| 1 | Progetto su **Vercel** collegato al repository | Sì (già fatto ✓) | sezione 1 |
| 2 | **Database** su Vercel (Neon, piano Free) | Sì: senza, ogni dispositivo ha i suoi dati | sezione 1 |
| 3 | Scegliere il **codice di famiglia** e installarla su **ogni iPhone/iPad** | Sì | sezione 2 |
| 4 | **Skill Alexa** | Per usare la voce | sezione 3 |
| 5 | **App Spotify** (Client ID) | Per le playlist e la musica sugli Echo | sezione 7 |

Niente Firebase, niente account da creare per l'app: i dati stanno nel database di Vercel e si aprono con il **codice di famiglia**.

## 1. Vercel: sito + database (5 minuti)

Il progetto è già collegato a Vercel, che pubblica da solo ogni modifica del branch **main**.

1. Su <https://vercel.com> apri il progetto **Comperotto** → **Settings → Git**: controlla che il *Production Branch* sia **main**. In *Settings → Build and Deployment* il *Framework Preset* è **Other** e i comandi di build restano vuoti.
2. Scheda **Storage** → **Create Database** → **Neon** (Serverless Postgres) → piano **Free**, regione **Frankfurt** (la più vicina) → **Create**. Poi **Connect Project** → *Comperotto*, tutti gli ambienti → **Connect**.
   Vercel aggiunge da solo le chiavi del database: non c'è niente da copiare, e non serve registrarsi sul sito di Neon (si accettano solo le condizioni dentro Vercel). Le tabelle (`fam_docs`, `fam_ver`, `fam_meta`) le crea l'app al primo avvio.
   - Se avete **già** un database Neon o Upstash nel team, basta **Connect** su quello: l'app usa solo le sue tabelle/chiavi (`fam_…`) e non tocca il resto. Meglio però un database nuovo, solo per casa.
   - Upstash su Vercel oggi è solo a consumo (pochi centesimi al mese per un uso come il vostro): se volete zero costi scegliete Neon.
3. **Deployments** → sull'ultimo deployment **⋯ → Redeploy**, così le funzioni vedono il database appena collegato.
4. Apri **<https://comperotto.vercel.app>**: l'app chiede di **scegliere il codice di famiglia**. Fatto!

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
4. Scheda **Code**: apri `lambda/index.js`, cancella tutto e incolla il contenuto di [`alexa-skill/lambda/index.js`](alexa-skill/lambda/index.js). In alto, in `CONFIG`, cambia solo il codice:
   - `apiUrl`: è già `https://comperotto.vercel.app/api`, non va toccato;
   - `codice`: il vostro codice di famiglia.

   Poi **Save** → **Deploy**. Il codice resta solo nella console Amazon: non scrivetelo mai nel file del repository pubblico.
5. Scheda **Test**: imposta *Skill testing is enabled in: Development* e prova a scrivere «chiedi a casa mia di aggiungere il latte».

Una skill "in sviluppo" funziona già su **tutti gli Echo collegati al vostro account**, senza pubblicarla nello store.

**Più corto: la Routine «Alexa, spesa».** «Alexa, aggiungi latte» da solo finisce sempre nella lista interna di Amazon (non si può cambiare). Con una Routine basta dire «Alexa, spesa»: risponde «Cosa ti serve?», dite «latte e uova», lei chiede «Altro?» e chiudete con «no».
App Alexa → **Altro → Routine → +** → *Quando succede questo*: **Voce** → «spesa» → *Aggiungi azione*: **Personalizzata** → «apri casa mia» → **Salva**.
Per le cose che comprate più spesso potete fare anche Routine dirette, es. «Alexa, manca il latte» → *Personalizzata*: «chiedi a casa mia di aggiungere il latte».

## 4. Film: copertine e dove vederli

Non c'è niente da configurare: quando aggiungete un film o una serie l'app cerca da sola la copertina e su quali piattaforme si trova in Italia (Netflix, Prime Video, Disney+… in abbonamento, a noleggio o da comprare), usando i dati pubblici di JustWatch, e li ricontrolla una volta al giorno perché il catalogo cambia spesso. Toccando una piattaforma si apre direttamente il film.

## 5. Dov'è (posizione di Patrick e Serena)

In Home c'è il riquadro **Dov'è** (a casa / fuori, indirizzo, da quanto) e toccandolo la mappa. Le posizioni arrivano in automatico dall'app gratuita **OwnTracks** (App Store), che le manda al sito in sottofondo; il pulsante "Apri Dov'è" apre invece la posizione dal vivo di Apple.

Su ogni iPhone, una volta:
1. Installa **OwnTracks** e consenti la posizione **"Sempre"** (e "Movimento e fitness").
2. In OwnTracks → **ⓘ / Impostazioni**: *Mode* **HTTP**, *URL* `https://comperotto.vercel.app/api/posizione`, *Authentication* attiva, *UserID* il tuo nome (`patrick` o `serena`), *Password* il codice di famiglia.
3. Sulla mappa di OwnTracks scegli il modo **Significant** (consuma pochissimo) e tocca la freccia ↑ per mandare subito la posizione.
4. Sempre nelle impostazioni di OwnTracks attiva **Remote Commands** (in alcune versioni si chiama `cmd`, tra le impostazioni avanzate): così l'app gli manda da sola **Casa e i vostri posti come zone**, e l'iPhone avvisa appena si entra o si esce, anche in modalità Significant. Ve ne accorgete in Dov'è dalla scritta "zone di casa attive".
5. Nell'app, in **Dov'è → I nostri posti**, tocca Casa e i due Lavoro e scrivi gli indirizzi: l'app trova da sola le coordinate e mostra "A casa", "Al lavoro" o "Fuori". In alternativa, quando sei sul posto, tocca "Sono qui adesso". Si possono aggiungere altri posti. Gli indirizzi restano nel database, non nel codice (che è pubblico).

Si salva solo l'ultima posizione di ciascuno, protetta dal codice di famiglia.

**Quanto è fresca una posizione.** Ogni persona mostra sempre quando è arrivata l'ultima posizione ("aggiornata 3 min fa", "alle 14:32"). Fino a 2 ore si dice "A casa", "Al lavoro", "Fuori"; dopo, la scheda diventa grigia e dice **"Era a casa · 5 h fa"**: una posizione vecchia non viene mai presentata come attuale. In quel caso compare **"Chiedi a …"**, che manda all'altro una notifica: toccandola sceglie se condividere la posizione in quel momento.

**Perché a volte non si aggiorna.** Una pagina web non può seguire la posizione ad app chiusa (iOS lo impedisce): in sottofondo ci pensa solo OwnTracks. Se OwnTracks viene chiuso dal multitasking, perde il permesso "Sempre" o resta in pausa/manuale, smette di mandare: Dov'è lo segnala con l'avviso arancione e la riga "OwnTracks sentito 6 h fa". Come rinforzo, in **Dov'è → Questo iPhone** c'è l'interruttore **"Manda la mia posizione quando apro l'app"** (spento finché non lo accendete voi): mentre l'app è aperta manda la posizione ogni pochi minuti, senza chiedere permessi a sorpresa.

La mappa mostra sempre Patrick e Serena; **Casa, Lavoro e le attività** (bar, negozi, farmacie…) compaiono ingrandendo, come in Dov'è di Apple. C'è l'interruttore **Mappa / Satellite** e, con l'app in modalità scura, la mappa diventa scura.

### L'auto: il pulsante «Ho parcheggiato»

Il pulsante è un **comando rapido sulla schermata Home dell'iPhone**: quando lasciate la macchina lo premete e basta. Senza aprire l'app manda la posizione e risponde con una notifica: **«Posizione inviata»**. Nell'app l'auto compare sulla mappa di Dov'è (il segnaposto azzurro con l'auto) e in Home, nel riquadro Dov'è, con l'indirizzo e da quanto è lì: toccandola, la mappa si apre sull'auto. Dalla sua scheda: **Portami all'auto** (Mappe, a piedi), una **nota** («Piano -2, posto 14») e il cestino. A ogni pressione l'auto si sposta lì (e la nota vecchia si cancella).

Da fare una volta su ogni iPhone, nell'app **Comandi** → **+**:

1. Aggiungi l'azione **Ottieni posizione attuale**.
2. Aggiungi **Ottieni contenuti dell'URL**, con l'URL `https://comperotto.vercel.app/api/posizione?auto`, e apri le opzioni (la freccia):
   - **Metodo**: `POST`;
   - **Corpo della richiesta**: **JSON**, con quattro campi (*Aggiungi nuovo campo*):
     - *Testo* `codice` → il vostro codice di famiglia;
     - *Testo* `chi` → il tuo nome (`patrick` o `serena`);
     - *Numero* `lat` → la variabile **Posizione attuale**, poi toccala e scegli **Latitudine**;
     - *Numero* `lon` → **Posizione attuale** → **Longitudine**.
3. Aggiungi **Mostra notifica** e al posto del testo metti **Contenuti dell'URL**: dirà «Posizione inviata» (oppure cosa non va, es. «Codice di famiglia sbagliato»).
4. Chiamalo **Ho parcheggiato**, scegli l'icona dell'auto e poi **Aggiungi alla schermata Home**.

La prima volta l'iPhone chiede i permessi (posizione, invio a comperotto.vercel.app, notifiche): rispondete **Consenti sempre**, così dalle volte dopo basta un tocco. Se il segnaposto risulta lontano: Impostazioni → Privacy e sicurezza → Localizzazione → **Comandi** → *Posizione esatta* attiva. Lo stesso comando si può mettere anche sul tasto Azione o nel Centro di Controllo. Il codice resta solo sul telefono, mai nel repository.

## 6. Notifiche

Su ogni iPhone/iPad con l'app **installata sulla schermata Home**: **Impostazioni → Notifiche → Attiva le notifiche** (c'è anche un invito in Home). Non serve configurare niente: le chiavi si creano da sole e restano nel database.

- **Arrivi e partenze**: "Serena è a casa", "Patrick ha lasciato il lavoro" (dalle posizioni di OwnTracks, con un margine contro i falsi allarmi).
- **Stasera si butta**: una volta al giorno verso le 18–19, se quella sera c'è qualcosa da portare fuori e non è già stato segnato.
- **Compleanni e gatti**: il giorno prima di compleanni, anniversario, ricorrenze e richiami di Thor e Minù.

Ogni tipo si può spegnere dal singolo dispositivo; "Prova" manda una notifica di prova. In *Impostazioni → Collegamento* si vede per ognuno se le notifiche sono accese e se l'ultima è arrivata davvero.

## 6b. Collegamento

*Impostazioni → Collegamento* dice, per Patrick e per Serena: quando ogni loro iPhone/iPad ha usato l'app l'ultima volta (e se è aperta da Safari invece che dalla schermata Home, o se ha una versione vecchia), da dove arriva la posizione (OwnTracks, con la batteria, oppure solo dall'app) e com'è andata l'ultima notifica. Su questo telefono segnala anche le modifiche che non sono ancora partite (l'app riprova da sola; intanto quelle dell'altro arrivano lo stesso).

## 7. Musica e Spotify

La musica arriva da **Spotify** (serve Premium), come nell'app di Spotify:
- in cima a *Musica* cosa sta suonando e dove, con la barra del brano da trascinare (avanti e indietro), casuale, indietro, play/pausa, avanti e ♥ (il volume si regola dal dispositivo);
- **musica a tema del periodo** (Natale, Halloween, estate, Parigi e Canarie, San Valentino, autunno, inverno, primavera: le liste sono in `js/data.js`, `MUSICA_TEMA`) e **Scelti per te** (brani dei vostri artisti preferiti non ancora salvati) con le **novità** dei vostri artisti;
- in cima **Ascoltati di recente** e **I tuoi artisti** (quelli che ascoltate di più nelle ultime settimane);
- **Cerca** brani, artisti, album e playlist, con il **risultato migliore** in cima, come su Spotify;
- **artisti** con *Segui*, i loro brani, l'ultima uscita, la **discografia** (album, singoli ed EP, compilation, e dove appaiono) e la discografia completa; **album** con dischi, data, durata e «Altro di…»; ogni pagina ha casuale e il grande play, e *Indietro* torna alla pagina di prima;
- **Brani che ti piacciono** (il ♥ accanto a ogni brano) e la **libreria** a schede: playlist, album salvati, artisti seguiti;
- **playlist vostre**: crearle, rinominarle, eliminarle, aggiungere e togliere brani (⋯ accanto al brano → *Aggiungi a una playlist*), e *Aggiungi in coda*;
- **Dove ascoltare?**: di base la musica parte **sul dispositivo che state usando** (toccando un brano sull'iPhone suona subito lì, dentro l'app); si può scegliere un altro dispositivo con Spotify aperto o un **Echo**, e finché resta collegato i brani partono lì;
- nel lettore anche **Ripeti** (tutto, oppure solo il brano);
- in cima a Musica la scheda è come *Stasera guardiamo…* dei film: copertina sfocata dietro, *Ascolta* (o i comandi, se suona già), il dado per un'altra canzone e le **casse** per scegliere dove ascoltare (accese, con il nome accanto, quando la musica va su un altro dispositivo);
- il **mini lettore** resta in basso su tutte le pagine (copertina, titolo, dove suona, play/pausa e avanti): un tocco apre la **finestra del lettore** senza lasciare la pagina (copertina grande, barra del brano, comandi, ♥, dove suona e i prossimi brani); si chiude con la freccia, la X o trascinandola giù;
- per cambiare brano si può anche **scorrere di lato** sulla copertina o sul mini lettore (verso sinistra il prossimo, verso destra il precedente), come su Spotify; un brano della coda *Dopo* si tocca e parte (Spotify non permette alle app di togliere o spostare i brani in coda).

Una volta sola, da un computer:

1. Su <https://developer.spotify.com/dashboard> entra con l'account Spotify **Premium** → **Create app**: nome "Comperotto", descrizione a piacere, **Redirect URI** `https://comperotto.vercel.app/api/spotify` (esatto, con **Add**), spunta **Web API** → **Save**.
2. Nell'app appena creata: **Settings** → copia il **Client ID**. Se anche l'altro vuole collegare il suo account Spotify: **User Management** → aggiungi nome ed email del suo account Spotify (massimo 5 persone).
3. Sull'iPhone: *Musica* → **Collega** → incolla il Client ID (solo la prima volta) → accedi a Spotify e **Accetta**. Si torna da soli nell'app.
4. L'account dell'altro si può collegare anche dallo stesso telefono: *Musica → Spotify →* **Collega** accanto al suo nome → nella pagina di Spotify **Non sei tu?** → si entra con i suoi dati → **Accetta**. Ognuno poi vede di base il proprio Spotify (con tutti e due collegati c'è la scelta *Patrick / Serena* sopra le playlist).

Gli Echo compaiono in *Dove ascoltare?* solo per l'account Spotify collegato nell'app Alexa che li gestisce (*Altro → Impostazioni → Musica e podcast → Spotify*): se mancano quelli di casa, nell'app Alexa di casa va collegato lo Spotify di chi ascolta; per un attimo basta anche dire all'Echo «Alexa, Spotify Connect» e sceglierlo dall'app Spotify (in fondo alla lista c'è *Manca un Echo di casa?*). Un dispositivo che non volete vedere (es. l'Echo di qualcun altro collegato allo stesso account) si nasconde col tasto accanto al suo nome, per tutti e due; in fondo alla lista *Mostrali* lo riporta. Il permesso resta sul server (nel database), non sui telefoni; si toglie da *Musica → Spotify → Scollega*.

## 8. Ricette anche da internet

Scrivendo nella ricerca delle Ricette (almeno 3 lettere), dopo un attimo compaiono a parte anche le ricette di **GialloZafferano**, con foto, voto, difficoltà e tempo. **Importa** apre la ricetta già compilata (ingredienti, passaggi, foto) da controllare e salvare; in fondo alla ricetta resta la fonte.

In **+ Ricetta** c'è anche **"Da un sito di ricette"**: si incolla il link di una ricetta (GialloZafferano, Misya, Cucchiaio d'argento e quasi tutti gli altri) e l'app legge i dati che quei siti pubblicano apposta in formato standard. Niente chiavi né abbonamenti.

## 9. Desideri e liste

- **Desideri di casa** è la lista di sempre; con **Nuova lista → Nostra** se ne creano altre (es. *Compleanno di Serena*) e nel desiderio si sceglie in che lista va. Eliminando una lista i suoi desideri tornano in *Desideri di casa*.
- **Nuova lista → Da Amazon** (Amazon → la lista → Condividi → Copia link; la lista deve essere *pubblica* o *condivisa*): l'app mostra i prodotti della lista con **foto, nome e prezzo**, e un tocco apre il prodotto su Amazon. La lista si rilegge da sola ogni qualche ora, o con *Aggiorna*.
- Amazon **non ha un'API** per le liste dei desideri: l'app legge la pagina pubblica della lista, come farebbe il browser. Se un giorno Amazon non la apre (succede, ogni tanto rifiuta le richieste automatiche), restano i prodotti dell'ultima lettura con la data, e si riprova più tardi.
- Per un prodotto singolo si **incolla il suo link** nel nuovo desiderio (va bene anche il link breve `amzn.eu/…`): il link viene ripulito dal tracciamento e, se c'è, il nome del prodotto si compila da solo.

---

## Com'è fatto

```
index.html              guscio dell'app
manifest.webmanifest    installazione come app (icona, colori)
sw.js                   funzionamento offline
css/style.css           stile: palette di casa e atmosfere stagionali
js/config.js            versione dell'app e frase della skill Alexa
js/store.js             dati: condivisi via Vercel (con coda offline; copia sul dispositivo in IndexedDB; scarica solo ciò che cambia) o solo sul dispositivo
js/precarica.js         all'apertura prepara musica, copertine, locandine, foto e mappa
js/core.js              stato, fogli dal basso, avvisi
js/data.js              reparti, temi, stagioni, rifiuti, faccende
js/season.js            atmosfere stagionali e decorazioni
js/seed.js              esempi iniziali (ricette, film, musica, faccende)
js/gestures.js          gesti dell'iPhone (fogli da trascinare, indietro dal bordo, righe da scorrere)
js/mappa.js             stile della mappa di Dov'è (attività, i nostri posti, satellite, scuro)
js/notifiche.js         notifiche di questo dispositivo
js/spotify.js           Spotify: lettore, dispositivi, playlist (parla con Spotify con un token di un'ora)
js/views/*.js           le schermate
assets/fonts/           i caratteri (dentro l'app: niente richieste esterne)
api/                    funzioni Vercel: stato, setup del codice, dati (Neon/Postgres o Upstash Redis), film,
                        posizione (anche l'auto: «Ho parcheggiato» dal comando rapido), notifiche (push, promemoria della sera), spotify (collegamento e token),
                        ricette online, link brevi (Amazon, Spotify)
alexa-skill/            skill Alexa (modello italiano + codice)
```

Niente framework e niente build: HTML, CSS e JavaScript moderni, più alcune piccole funzioni in `api/`. Per modificarla basta cambiare i file e fare push su `main`: Vercel la ripubblica da solo e l'app, alla prima apertura, si ricarica da sola con la versione nuova (a ogni pubblicazione va cambiato il numero di `CACHE` in `sw.js` e `VERSIONE` in `js/config.js`).

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
