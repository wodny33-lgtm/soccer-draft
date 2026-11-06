import { passtAufSlot } from './formationen.js';

// Indizes der noch freien Felder.
export function freieFelder(platz) {
  return platz.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
}

// Felder (Indizes), auf die der Spieler passt und die noch frei sind.
export function moeglicheFelder(slots, platz, spieler) {
  return freieFelder(platz).filter((i) => passtAufSlot(slots[i], spieler));
}

// Zieht zufällig einen Verein, bei dem mindestens ein Spieler auf ein noch freies Feld passt.
// Bereits gezogene Vereine kommen nur wieder, wenn kein anderer mehr passt. Gibt null zurück, wenn nichts passt.
export function ziehVerein(spieler, slots, platz, bisherigeVereine, rng) {
  const gewaehlt = new Set(platz.filter(Boolean).map((s) => s.id));
  const passend = [...new Set(
    spieler.filter((s) => !gewaehlt.has(s.id) && moeglicheFelder(slots, platz, s).length).map((s) => s.verein),
  )];
  if (!passend.length) return null;
  const neu = passend.filter((v) => !bisherigeVereine.includes(v));
  const quelle = neu.length ? neu : passend;
  return quelle[Math.floor(rng() * quelle.length)];
}
