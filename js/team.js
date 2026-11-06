import { POSITIONEN, FORMATIONEN } from './formationen.js';

// Stärke eines Platzhalters, wenn für eine Position kein Spieler vorhanden ist.
export const LUECKEN_STAERKE = 40;

// Gewichtung der Linien in der Gesamtstärke (Summe = 1).
export const GEWICHTE = { TOR: 0.12, ABW: 0.28, MIT: 0.3, STU: 0.3 };

export function linienStaerke(kader) {
  const ergebnis = {};
  for (const pos of POSITIONEN) {
    const gruppe = kader.filter((s) => s.pos === pos);
    ergebnis[pos] = gruppe.length ? gruppe.reduce((summe, s) => summe + s.staerke, 0) / gruppe.length : 0;
  }
  return ergebnis;
}

export function teamStaerke(kader) {
  const l = linienStaerke(kader);
  return POSITIONEN.reduce((summe, pos) => summe + GEWICHTE[pos] * l[pos], 0);
}

// Beste Elf aus einer Spielerliste. Fehlende Plätze werden mit LUECKEN_STAERKE aufgefüllt.
export function besteElf(spieler, formation = '4-3-3') {
  const f = FORMATIONEN[formation];
  if (!f) throw new Error(`Unbekannte Formation: ${formation}`);
  const elf = [];
  for (const pos of POSITIONEN) {
    const beste = spieler
      .filter((s) => s.pos === pos)
      .sort((a, b) => b.staerke - a.staerke)
      .slice(0, f[pos]);
    elf.push(...beste);
    for (let i = beste.length; i < f[pos]; i++) {
      elf.push({ id: -1, name: 'Lücke', verein: '', pos, staerke: LUECKEN_STAERKE });
    }
  }
  return elf;
}

export function vereinsStaerke(alleSpieler, verein) {
  return teamStaerke(besteElf(alleSpieler.filter((s) => s.verein === verein)));
}
