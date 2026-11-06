import { shuffle } from './rng.js';
import { simuliereSpiel, waehleTorschuetzen } from './sim.js';

// Kreismethode: jedes Team spielt pro Spieltag genau einmal, Rückrunde mit getauschtem Heimrecht.
export function spielplan(teamIds) {
  const n = teamIds.length;
  if (n % 2 !== 0) throw new Error('Die Teamzahl muss gerade sein');
  const reihe = [...teamIds];
  const hinrunde = [];
  for (let r = 0; r < n - 1; r++) {
    const tag = [];
    for (let i = 0; i < n / 2; i++) {
      let heim = reihe[i];
      let auswaerts = reihe[n - 1 - i];
      if (r % 2 === 1) [heim, auswaerts] = [auswaerts, heim];
      tag.push({ heim, auswaerts });
    }
    hinrunde.push(tag);
    reihe.splice(1, 0, reihe.pop());
  }
  const rueckrunde = hinrunde.map((tag) => tag.map((p) => ({ heim: p.auswaerts, auswaerts: p.heim })));
  return [...hinrunde, ...rueckrunde];
}

export function neueTabelle(teams) {
  return teams.map((t) => ({ id: t.id, name: t.name, sp: 0, s: 0, u: 0, n: 0, tore: 0, gegen: 0, pkt: 0 }));
}

export function trageEin(tabelle, heimId, auswaertsId, toreHeim, toreAuswaerts) {
  const heim = tabelle.find((z) => z.id === heimId);
  const aus = tabelle.find((z) => z.id === auswaertsId);
  heim.sp++;
  aus.sp++;
  heim.tore += toreHeim;
  heim.gegen += toreAuswaerts;
  aus.tore += toreAuswaerts;
  aus.gegen += toreHeim;
  if (toreHeim > toreAuswaerts) {
    heim.s++; heim.pkt += 3; aus.n++;
  } else if (toreHeim < toreAuswaerts) {
    aus.s++; aus.pkt += 3; heim.n++;
  } else {
    heim.u++; aus.u++; heim.pkt++; aus.pkt++;
  }
}

export function sortiere(tabelle) {
  return [...tabelle].sort(
    (a, b) =>
      b.pkt - a.pkt ||
      b.tore - b.gegen - (a.tore - a.gegen) ||
      b.tore - a.tore ||
      a.name.localeCompare(b.name, 'de'),
  );
}

// vereine: [{id, name, staerke}], dein: {id, name, staerke}. Dein Team ersetzt zufällig einen Verein.
export function startSaison(vereine, dein, deinKader, rng) {
  const index = Math.floor(rng() * vereine.length);
  const ersetzt = vereine[index].name;
  const teams = [...vereine.slice(0, index), ...vereine.slice(index + 1), { ...dein }];
  const plan = spielplan(shuffle(rng, teams.map((t) => t.id)));
  return {
    teams,
    ersetzt,
    plan,
    tag: 0,
    tabelle: neueTabelle(teams),
    torschuetzen: {},
    deinKader,
  };
}

export function saisonFertig(s) {
  return s.tag >= s.plan.length;
}

// Spielt den nächsten Spieltag. Verändert s und liefert die Ergebnisse des Tages.
export function naechsterSpieltag(s, rng) {
  const staerke = Object.fromEntries(s.teams.map((t) => [t.id, t.staerke]));
  const name = Object.fromEntries(s.teams.map((t) => [t.id, t.name]));
  const ergebnisse = [];
  for (const spiel of s.plan[s.tag]) {
    const r = simuliereSpiel(staerke[spiel.heim], staerke[spiel.auswaerts], rng);
    trageEin(s.tabelle, spiel.heim, spiel.auswaerts, r.heim, r.auswaerts);
    const eintrag = {
      heim: name[spiel.heim],
      auswaerts: name[spiel.auswaerts],
      toreHeim: r.heim,
      toreAuswaerts: r.auswaerts,
      schuetzen: [],
      deins: spiel.heim === 'DU' || spiel.auswaerts === 'DU',
    };
    if (eintrag.deins) {
      const meineTore = spiel.heim === 'DU' ? r.heim : r.auswaerts;
      eintrag.schuetzen = waehleTorschuetzen(s.deinKader, meineTore, rng);
      for (const n of eintrag.schuetzen) s.torschuetzen[n] = (s.torschuetzen[n] || 0) + 1;
    }
    ergebnisse.push(eintrag);
  }
  s.tag++;
  return ergebnisse;
}

export function platzVon(s, id) {
  return sortiere(s.tabelle).findIndex((z) => z.id === id) + 1;
}
