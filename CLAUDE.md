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
  Mappa con Leaflet incluso in `js/vendor/leaflet/`; coordinate dagli indirizzi con `/api/geocodifica`.
- **Sito pulito:** niente spiegazioni tecniche nelle pagine dell'app; vanno date in chat.
- **Stile:** pastello in tinta con la casa; le feste con i loro colori pieni (Natale verde/rosso/bianco,
  Halloween nero/arancione). Pensata per iPhone e iPad.
- Niente build: HTML/CSS/JS moderni (`index.html`, `css/`, `js/`), funzioni Vercel in `api/`.
