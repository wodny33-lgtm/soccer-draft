import { slotDefs, passtAufSlot } from './formationen.js';
import { moeglicheFelder, ziehVerein } from './draft.js';
import { createRng } from './rng.js';
import { simuliereSpiel, waehleTorschuetzen } from './sim.js';
import { teamStaerke } from './team.js';

// Ohne I, O, 0, 1, damit sich der Raum-Code am Telefon leicht vorlesen lässt.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function neuerRaumCode(rng = Math.random) {
  let code = '';
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return code;
}

export function normalisiereCode(text) {
  return String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

// Firebase liefert eine Liste je nach Lücken als Array oder als Objekt. Wir lesen lückenlos ab Index 0.
export function zuegeListe(roh) {
  if (!roh) return [];
  const liste = [];
  for (let i = 0; roh[i] !== undefined && roh[i] !== null; i++) liste.push(roh[i]);
  return liste;
}

const seedFuer = (seed, zug, variante) =>
  (seed ^ Math.imul(zug + 1, 0x9e3779b1) ^ Math.imul(variante + 1, 0x85ebca6b)) >>> 0;

// Spielt alle Züge des Raums der Reihe nach nach. Beide Handys kommen so zum gleichen Stand,
// auch der Verein, der als Nächstes dran ist, ergibt sich nur aus Seed und bisherigen Zügen.
// Zugform: { s: 0|1, id, slot } für eine Wahl, { s: 0|1, joker: true } für das Neuwürfeln.
export function spielStand(raum, alleSpieler) {
  const slots = slotDefs(raum.formation);
  const seiten = [0, 1].map(() => ({ platz: slots.map(() => null), kader: [], vereine: [], joker: true }));
  const vergeben = new Set();
  const nachId = new Map(alleSpieler.map((s) => [s.id, s]));
  const zuege = zuegeListe(raum.zuege);
  const ziel = slots.length * 2;
  let gewaehlt = 0;
  let variante = 0;
  let aktiv = 0;
  let verein = null;
  let fehler = null;

  const ziehe = () => {
    const pool = alleSpieler.filter((s) => !vergeben.has(s.id));
    return ziehVerein(pool, slots, seiten[aktiv].platz, seiten[aktiv].vereine, createRng(seedFuer(raum.seed, gewaehlt, variante)));
  };
  verein = ziehe();

  for (const zug of zuege) {
    if (gewaehlt >= ziel) break;
    if (zug.s !== aktiv) { fehler = 'Zug von der falschen Seite'; break; }
    const seite = seiten[aktiv];
    if (zug.joker) {
      if (!seite.joker) { fehler = 'Joker schon verbraucht'; break; }
      seite.joker = false;
      variante++;
      verein = ziehe();
      continue;
    }
    const spieler = nachId.get(zug.id);
    const slot = slots[zug.slot];
    if (!spieler || !slot || vergeben.has(spieler.id) || spieler.verein !== verein
      || seite.platz[zug.slot] || !passtAufSlot(slot, spieler)) {
      fehler = 'Ungültiger Zug';
      break;
    }
    const imTeam = { ...spieler, pos: slot.zeile };
    seite.platz[zug.slot] = imTeam;
    seite.kader.push(imTeam);
    seite.vereine.push(verein);
    vergeben.add(spieler.id);
    gewaehlt++;
    variante = 0;
    aktiv = gewaehlt % 2;
    if (gewaehlt < ziel) verein = ziehe();
  }

  const fertig = gewaehlt >= ziel;
  if (!fertig && !verein && !fehler) fehler = 'Kein passender Spieler mehr';
  return { slots, seiten, vergeben, aktiv, verein: fertig ? null : verein, fertig, fehler, zuege: zuege.length };
}

// Gleicher Seed, gleiches Ergebnis: beide Handys zeigen dasselbe Spiel. Seite 0 (Gastgeber) steht links.
export function liveErgebnis(raum, stand) {
  const rng = createRng((raum.seed ^ 0x5eed5eed) >>> 0);
  const [a, b] = stand.seiten.map((s) => s.kader);
  const r = simuliereSpiel(teamStaerke(a), teamStaerke(b), rng, true);
  return {
    tore: [r.heim, r.auswaerts],
    schuetzen: [waehleTorschuetzen(a, r.heim, rng), waehleTorschuetzen(b, r.auswaerts, rng)],
    staerke: [teamStaerke(a), teamStaerke(b)],
  };
}
