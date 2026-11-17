// Dati di partenza: qualche esempio per non trovare la casa vuota.
// Si possono modificare o cancellare tutti dall'app.
import { todayIso, addDays } from './utils.js';
import { DEFAULT_SETTINGS } from './data.js';

export function seedData() {
  const t = todayIso();
  return {
    settings: [{ id: 'main', ...DEFAULT_SETTINGS, seeded: true }],

    gatti: [
      { id: 'thor', name: 'Thor', birth: '2025-10-04', breed: '', color: 'a', photo: '', note: '', food: '', chip: '' },
      { id: 'minu', name: 'Minù', birth: '2025-10-04', breed: '', color: 'b', photo: '', note: '', food: '', chip: '' },
    ],

    routine: [
      { title: 'Pulire la lettiera', icon: 'paw', freq: { type: 'days', every: 1 }, lastDone: addDays(t, -1), who: '' },
      { title: 'Spazzolare Thor e Minù', icon: 'cat', freq: { type: 'days', every: 3 }, lastDone: addDays(t, -2), who: '' },
      { title: 'Lavatrice', icon: 'shirt', freq: { type: 'days', every: 3 }, lastDone: addDays(t, -3), who: '' },
      { title: 'Aspirapolvere (peli di gatto!)', icon: 'vacuum', freq: { type: 'days', every: 4 }, lastDone: addDays(t, -2), who: '' },
      { title: 'Lavare i pavimenti', icon: 'drop', freq: { type: 'days', every: 7 }, lastDone: addDays(t, -5), who: '' },
      { title: 'Pulire il bagno', icon: 'bath', freq: { type: 'days', every: 7 }, lastDone: addDays(t, -6), who: '' },
      { title: 'Cambiare le lenzuola', icon: 'bed', freq: { type: 'days', every: 14 }, lastDone: addDays(t, -9), who: '' },
      { title: 'Pulire la fontanella dei gatti', icon: 'paw', freq: { type: 'days', every: 7 }, lastDone: addDays(t, -4), who: '' },
      { title: 'Cambiare tutta la sabbia', icon: 'paw', freq: { type: 'days', every: 14 }, lastDone: addDays(t, -10), who: '' },
      { title: 'Annaffiare la yucca', icon: 'plant', freq: { type: 'days', every: 10 }, lastDone: addDays(t, -8), who: '' },
    ],

    lavori: [
      { title: 'Tagliare le tende', room: 'Sala', prio: 2, who: 'both', note: 'Misurare prima l’altezza dal bastone a terra', done: false },
      { title: 'Sistemare i mobili', room: 'Sala', prio: 2, who: 'both', note: '', done: false },
      { title: 'Trovare un posto agli scatoloni', room: 'Camera', prio: 1, who: '', note: '', done: false },
      { title: 'Fissare il tiragraffi al muro', room: 'Ingresso', prio: 3, who: '', note: 'È alto: meglio un tassello anti-ribaltamento', done: false },
    ],

    desideri: [
      { title: 'Armadio per i vestiti degli stender', price: null, link: '', cat: 'casa', for: 'both', prio: 3, note: '', bought: false },
      { title: 'Mensole per gatti a parete', price: null, link: '', cat: 'gatti', for: 'both', prio: 2, note: 'Tanto sui pensili della cucina ci salgono comunque…', bought: false },
    ],

    bacheca: [
      { text: 'Benvenuti nella nostra casa digitale! Toccate un biglietto per staccarlo.', by: 'p1', color: 'oak' },
    ],

    // "spesso comprati": i primi suggerimenti rapidi nella lista della spesa
    freq: ['Latte', 'Pane', 'Uova', 'Acqua', 'Pasta', 'Banane', 'Yogurt', 'Caffè', 'Croccantini', 'Lettiera', 'Carta igienica', 'Detersivo piatti']
      .map((name, i) => ({ id: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-'), name, count: 12 - i })),

    ricette: RICETTE,
    musica: MUSICA,
    film: FILM,
  };
}

const RICETTE = [
  {
    title: 'Rigatoni al ragù della domenica', themes: ['sempre'], time: 120, servings: 4, fav: true,
    ingredients: ['320 g rigatoni', '300 g macinato misto', '1 cipolla', '1 carota', '1 costa di sedano', '700 g passata di pomodoro', '1/2 bicchiere vino rosso', '3 cucchiai olio extravergine', 'Parmigiano q.b.', 'Sale q.b.'],
    steps: [
      'Trita cipolla, carota e sedano e falli appassire nell’olio a fuoco dolce per 10 minuti.',
      'Aggiungi il macinato e rosolalo bene a fiamma vivace, sgranandolo con un cucchiaio di legno.',
      'Sfuma con il vino rosso e lascia evaporare.',
      'Unisci la passata, sala e cuoci coperto a fuoco bassissimo per almeno 1 ora e mezza, mescolando ogni tanto.',
      'Cuoci i rigatoni al dente, condiscili con il ragù e servi con tanto parmigiano.',
    ],
    note: 'Il ragù è ancora più buono il giorno dopo.',
  },
  {
    title: 'Risotto alla zucca', themes: ['halloween', 'sempre'], time: 40, servings: 2,
    ingredients: ['160 g riso Carnaroli', '300 g zucca', '1/2 cipolla', '750 ml brodo vegetale', '30 g burro', '40 g parmigiano', '1/2 bicchiere vino bianco', '2 cucchiai olio extravergine', 'Sale q.b.', 'Pepe q.b.'],
    steps: [
      'Taglia la zucca a cubetti e cuocila in padella con metà della cipolla tritata e un filo d’olio finché diventa morbida; schiacciane metà a crema.',
      'In una casseruola tosta il riso a secco per 2 minuti, poi sfuma con il vino bianco.',
      'Aggiungi il brodo caldo un mestolo alla volta, mescolando, per circa 16–18 minuti.',
      'A metà cottura unisci la zucca (crema e cubetti).',
      'Spegni, manteca con burro e parmigiano, copri e lascia riposare 2 minuti prima di servire.',
    ],
    note: 'Servilo dentro una zucca svuotata per l’effetto Halloween.',
  },
  {
    title: 'Biscotti speziati di Natale', themes: ['natale'], time: 60, servings: 30, fav: true,
    ingredients: ['350 g farina 00', '120 g burro morbido', '100 g zucchero di canna', '1 uovo', '80 g miele', '2 cucchiaini zenzero in polvere', '1 cucchiaino cannella', '1 pizzico noce moscata', '1/2 cucchiaino bicarbonato', '1 pizzico sale'],
    steps: [
      'Lavora burro, zucchero e miele fino ad avere una crema, poi aggiungi l’uovo.',
      'Unisci farina, spezie, bicarbonato e sale e impasta fino a ottenere un panetto liscio.',
      'Avvolgi nella pellicola e lascia riposare in frigo almeno 1 ora.',
      'Stendi a 4–5 mm e ritaglia con le formine (stelle, alberelli, omini… e gatti!).',
      'Cuoci in forno statico a 180 °C per 8–10 minuti: devono restare morbidi al centro.',
    ],
    note: 'Con un foro in alto prima di infornare diventano decorazioni per l’albero.',
  },
  {
    title: 'Cotechino con lenticchie', themes: ['capodanno'], time: 60, servings: 4,
    ingredients: ['1 cotechino precotto', '300 g lenticchie secche', '1 cipolla', '1 carota', '1 costa di sedano', '2 cucchiai concentrato di pomodoro', '1 l brodo vegetale', '3 cucchiai olio extravergine', 'Sale q.b.'],
    steps: [
      'Sciacqua le lenticchie (se non sono decorticate lasciale in ammollo qualche ora).',
      'Fai un soffritto con cipolla, carota e sedano tritati, poi aggiungi il concentrato.',
      'Unisci le lenticchie e coprile di brodo; cuoci 35–40 minuti aggiungendo brodo se serve.',
      'Intanto cuoci il cotechino nella sua busta in acqua bollente per il tempo indicato sulla confezione.',
      'Servi il cotechino a fette sopra le lenticchie. Portano soldi, dicono.',
    ],
  },
  {
    title: 'Tiramisù', themes: ['sanvalentino', 'compleanni'], time: 30, servings: 6, fav: true,
    ingredients: ['500 g mascarpone', '4 uova freschissime', '100 g zucchero', '300 g savoiardi', '300 ml caffè', 'Cacao amaro q.b.'],
    steps: [
      'Prepara il caffè e lascialo raffreddare.',
      'Monta i tuorli con lo zucchero finché sono chiari e spumosi, poi incorpora il mascarpone.',
      'Monta gli albumi a neve ferma e uniscili delicatamente alla crema, dal basso verso l’alto.',
      'Inzuppa velocemente i savoiardi nel caffè e fai uno strato sul fondo della pirofila; copri con la crema. Ripeti.',
      'Riposo in frigo almeno 4 ore, poi una spolverata di cacao amaro prima di servire.',
    ],
    note: 'Per San Valentino: in due bicchieri con un cuore di cacao fatto con uno stencil di carta.',
  },
  {
    title: 'Torta pasqualina', themes: ['pasqua'], time: 75, servings: 6,
    ingredients: ['2 rotoli pasta sfoglia', '500 g spinaci', '250 g ricotta', '50 g parmigiano', '5 uova', '1 spicchio aglio', '2 cucchiai olio extravergine', 'Noce moscata q.b.', 'Sale q.b.'],
    steps: [
      'Salta gli spinaci in padella con olio e aglio, poi strizzali bene e tritali.',
      'Mescola ricotta, parmigiano, 1 uovo, un pizzico di noce moscata, sale e gli spinaci.',
      'Fodera una teglia con un rotolo di sfoglia e versa il ripieno.',
      'Fai 4 incavi e rompi un uovo intero in ciascuno.',
      'Copri con l’altra sfoglia, sigilla i bordi, bucherella e cuoci a 180 °C per 45 minuti.',
    ],
  },
  {
    title: 'Insalata di riso da spiaggia', themes: ['estate'], time: 30, servings: 4,
    ingredients: ['320 g riso parboiled', '160 g tonno sott’olio', '150 g pomodorini', '100 g mais', '1 vasetto giardiniera', '100 g olive', '100 g emmental', '2 uova sode', 'Olio extravergine q.b.'],
    steps: [
      'Cuoci il riso in abbondante acqua salata, scolalo al dente e raffreddalo sotto l’acqua fredda.',
      'Taglia a cubetti pomodorini, emmental e uova sode; scola tonno, mais, olive e giardiniera.',
      'Unisci tutto al riso, condisci con un filo d’olio e mescola.',
      'Riposo in frigo almeno 1 ora. Perfetta nella borsa frigo per il mare.',
    ],
  },
  {
    title: 'Mummie di würstel', themes: ['halloween'], time: 25, servings: 4,
    ingredients: ['1 rotolo pasta sfoglia', '8 würstel', '1 tuorlo', 'Senape q.b.'],
    steps: [
      'Taglia la sfoglia in strisce sottili (circa 1 cm).',
      'Avvolgi ogni würstel con le strisce lasciando uno spazio libero per la “faccia”.',
      'Spennella con il tuorlo e cuoci a 200 °C per 15 minuti, finché sono dorate.',
      'Disegna gli occhi con due puntini di senape. Paura!',
    ],
  },
  {
    title: 'Crêpes come a Parigi', themes: ['aprile', 'sempre'], time: 45, servings: 8, fav: true,
    ingredients: ['125 g farina 00', '250 ml latte', '2 uova', '20 g burro fuso', '1 cucchiaio zucchero', '1 pizzico sale', 'Nutella q.b.', 'Fragole q.b.'],
    steps: [
      'Sbatti le uova con lo zucchero e il sale, poi aggiungi il latte.',
      'Versa la farina a pioggia mescolando con la frusta per non formare grumi, poi unisci il burro fuso.',
      'Lascia riposare la pastella almeno 30 minuti (anche in frigo).',
      'Scalda una padella antiaderente unta di burro, versa un mestolino di pastella e ruota la padella per stenderla sottile.',
      'Cuoci circa 1 minuto per lato e farcisci: Nutella e fragole, oppure burro e zucchero come nelle crêperie parigine.',
    ],
    note: 'Per il compleanno: torre di crêpes alternate a crema e fragole, con le candeline sopra.',
  },
  {
    title: 'Papas arrugadas con mojo rojo', themes: ['aprile', 'estate'], time: 40, servings: 4,
    ingredients: ['1 kg patate piccole novelle', '150 g sale grosso', '3 spicchi aglio', '1 cucchiaino cumino', '2 cucchiaini paprika dolce', '1 peperoncino secco', '100 ml olio extravergine', '2 cucchiai aceto di vino'],
    steps: [
      'Lava bene le patate senza sbucciarle e mettile in una pentola con acqua appena a filo e il sale grosso.',
      'Cuoci 20–25 minuti, finché sono tenere.',
      'Scola l’acqua, rimetti la pentola sul fuoco basso e scuotila: la buccia si asciuga, si raggrinzisce e si copre di un velo di sale.',
      'Per il mojo pesta aglio, cumino, peperoncino e un pizzico di sale; aggiungi paprika e aceto, poi l’olio a filo emulsionando (o frulla tutto).',
      'Servi le patate intere con il mojo a parte, come alle Canarie.',
    ],
  },
];

const MUSICA = [
  { title: 'All I Want for Christmas Is You', artist: 'Mariah Carey', type: 'brano', themes: ['natale'], link: '' },
  { title: 'Last Christmas', artist: 'Wham!', type: 'brano', themes: ['natale'], link: '' },
  { title: 'Jingle Bell Rock', artist: 'Bobby Helms', type: 'brano', themes: ['natale'], link: '' },
  { title: 'This Is Halloween', artist: 'Danny Elfman', type: 'brano', themes: ['halloween'], link: '' },
  { title: 'Thriller', artist: 'Michael Jackson', type: 'brano', themes: ['halloween'], link: '' },
  { title: 'Ghostbusters', artist: 'Ray Parker Jr.', type: 'brano', themes: ['halloween'], link: '' },
  { title: 'Azzurro', artist: 'Adriano Celentano', type: 'brano', themes: ['estate'], link: '' },
  { title: 'Sapore di sale', artist: 'Gino Paoli', type: 'brano', themes: ['estate'], link: '' },
  { title: 'Una vita in vacanza', artist: 'Lo Stato Sociale', type: 'brano', themes: ['estate'], link: '' },
  { title: 'La Vie en rose', artist: 'Édith Piaf', type: 'brano', themes: ['aprile'], link: '' },
  { title: 'Les Champs-Élysées', artist: 'Joe Dassin', type: 'brano', themes: ['aprile'], link: '' },
  { title: 'Bailando', artist: 'Enrique Iglesias', type: 'brano', themes: ['aprile', 'estate'], link: '' },
  { title: 'Vivir mi vida', artist: 'Marc Anthony', type: 'brano', themes: ['aprile'], link: '' },
];

const FILM = [
  { title: 'Mamma, ho perso l’aereo', year: 1990, kind: 'movie', themes: ['natale', 'famiglia'], watched: false },
  { title: 'Love Actually - L’amore davvero', year: 2003, kind: 'movie', themes: ['natale'], watched: false },
  { title: 'Il Grinch', year: 2000, kind: 'movie', themes: ['natale', 'famiglia'], watched: false },
  { title: 'Nightmare Before Christmas', year: 1993, kind: 'movie', themes: ['halloween', 'natale'], watched: false },
  { title: 'Hocus Pocus', year: 1993, kind: 'movie', themes: ['halloween', 'famiglia'], watched: false },
  { title: 'La famiglia Addams', year: 1991, kind: 'movie', themes: ['halloween'], watched: false },
  { title: 'Luca', year: 2021, kind: 'movie', themes: ['famiglia'], watched: false },
  { title: 'Mamma Mia!', year: 2008, kind: 'movie', themes: ['sempre'], watched: false },
  { title: 'Il favoloso mondo di Amélie', year: 2001, kind: 'movie', themes: ['sempre'], watched: false },
  { title: 'Midnight in Paris', year: 2011, kind: 'movie', themes: ['sempre'], watched: false },
  { title: 'Ratatouille', year: 2007, kind: 'movie', themes: ['famiglia'], watched: false },
  { title: 'Gli Aristogatti', year: 1970, kind: 'movie', themes: ['famiglia'], watched: false },
];
