import { shuffle } from './rng.js';

// Zieht n Karten: eine aus dem oberen Drittel, eine aus dem unteren, der Rest aus der Mitte.
export function ziehKarten(spieler, position, gewaehltIds, rng, n = 5) {
  const kandidaten = spieler
    .filter((s) => s.pos === position && !gewaehltIds.includes(s.id))
    .sort((a, b) => b.staerke - a.staerke);
  if (kandidaten.length <= n) return shuffle(rng, kandidaten);

  const drittel = Math.ceil(kandidaten.length / 3);
  const oben = kandidaten.slice(0, drittel);
  const mitte = kandidaten.slice(drittel, kandidaten.length - drittel);
  const unten = kandidaten.slice(kandidaten.length - drittel);

  const karten = [];
  const nimm = (gruppe, anzahl) => {
    for (const s of shuffle(rng, gruppe)) {
      if (anzahl <= 0) break;
      if (!karten.includes(s)) {
        karten.push(s);
        anzahl--;
      }
    }
  };
  nimm(oben, 1);
  nimm(unten, 1);
  nimm(mitte, n - 2);
  nimm(kandidaten, n - karten.length); // Auffüllen, falls ein Bereich zu klein war
  return shuffle(rng, karten);
}
