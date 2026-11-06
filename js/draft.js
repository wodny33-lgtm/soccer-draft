// Verbleibende freie Plätze je Position: { TOR: 1, ABW: 2, ... } (nur Positionen mit Rest > 0).
export function freiePlaetze(slots, kader) {
  const frei = {};
  for (const p of slots) frei[p] = (frei[p] || 0) + 1;
  for (const s of kader) if (frei[s.pos]) frei[s.pos]--;
  for (const p of Object.keys(frei)) if (frei[p] <= 0) delete frei[p];
  return frei;
}

// Zieht zufällig einen Verein, bei dem mindestens ein Spieler auf einer noch freien Position spielt.
// Bereits gezogene Vereine kommen nur wieder, wenn kein anderer mehr passt. Gibt null zurück, wenn nichts passt.
export function ziehVerein(spieler, slots, kader, bisherigeVereine, rng) {
  const frei = freiePlaetze(slots, kader);
  const gewaehlt = new Set(kader.map((s) => s.id));
  const passend = [...new Set(spieler.filter((s) => frei[s.pos] && !gewaehlt.has(s.id)).map((s) => s.verein))];
  if (!passend.length) return null;
  const neu = passend.filter((v) => !bisherigeVereine.includes(v));
  const quelle = neu.length ? neu : passend;
  return quelle[Math.floor(rng() * quelle.length)];
}
