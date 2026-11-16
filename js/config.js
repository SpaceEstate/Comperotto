// ============================================================================
//  Configurazione dell’app della Fam. Comperotto
// ============================================================================
//
//  Senza Firebase l'app funziona lo stesso, ma salva i dati SOLO su questo
//  telefono. Per condividere spesa, faccende ecc. tra i vostri due telefoni
//  (e con Alexa) incollate qui sotto la configurazione web del vostro progetto
//  Firebase: vedi README.md → "Sincronizzare i due telefoni".
//
//  Nota: questi valori NON sono segreti (Firebase li prevede pubblici).
//  A proteggere i dati sono il login e le regole in firestore.rules.

export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// Nome della "casa" nel database (cambiatelo solo se sapete cosa fate).
export const HOUSE_ID = 'comperotto';

// Frase per la skill Alexa (deve coincidere con il nome di invocazione della skill).
export const ALEXA_INVOCATION = 'casa comperotto';
