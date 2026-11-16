// ============================================================================
//  Configurazione dell’app della Fam. Comperotto
// ============================================================================
//
//  Non c'è niente da compilare: quando l'app gira su Vercel con il database
//  collegato (Vercel → Storage → Upstash for Redis) i dati si condividono da soli
//  tra tutti i dispositivi che conoscono il codice di famiglia.

// Frase per la skill Alexa (deve coincidere con il nome di invocazione della skill).
export const ALEXA_INVOCATION = 'casa mia';
