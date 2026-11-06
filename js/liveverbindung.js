// Spricht per REST mit der Firebase Realtime Database. Kein SDK nötig, nur fetch.
// Pfad: <DB_URL>/raeume/<CODE>.json
export function createVerbindung(dbUrl, fetchFn = (...a) => fetch(...a)) {
  const basis = String(dbUrl || '').replace(/\/+$/, '');

  async function anfrage(pfad, methode = 'GET', body) {
    let antwort;
    try {
      antwort = await fetchFn(`${basis}/raeume/${pfad}.json`, {
        method: methode,
        cache: 'no-store',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('Keine Verbindung. Bitte Internet prüfen.');
    }
    if (antwort.status === 401 || antwort.status === 403) {
      throw new Error('Firebase lehnt den Zugriff ab. Bitte die Regeln der Datenbank prüfen.');
    }
    if (!antwort.ok) throw new Error(`Server-Fehler (${antwort.status}).`);
    return antwort.json();
  }

  return {
    aktiv: basis !== '',
    lade: (code) => anfrage(code),
    async erstelle(code, raum) {
      if (await anfrage(code)) throw new Error('Dieser Code ist schon vergeben. Bitte nochmal versuchen.');
      await anfrage(code, 'PUT', raum);
    },
    async tritBei(code, name, version) {
      const raum = await anfrage(code);
      if (!raum) throw new Error('Raum nicht gefunden. Code prüfen.');
      if (String(raum.version) !== String(version)) {
        throw new Error('Die Spiel-Version passt nicht. Beide brauchen die gleiche App-Version (App neu öffnen).');
      }
      if (raum.gast) throw new Error('In diesem Raum sitzen schon zwei Spieler.');
      await anfrage(`${code}/gast`, 'PUT', name);
      return { ...raum, gast: name };
    },
    sendeZug: (code, index, zug) => anfrage(`${code}/zuege/${index}`, 'PUT', zug),
  };
}
