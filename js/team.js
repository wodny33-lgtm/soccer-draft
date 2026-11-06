import { POSITIONEN, slotDefs, passtAufSlot } from './formationen.js';

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

// Beste Elf aus einer Spielerliste, passend zu den Feldern der Formation. Fehlende Plätze werden mit LUECKEN_STAERKE aufgefüllt.
export function besteElf(spieler, formation = '4-3-3') {
  const defs = slotDefs(formation);
  const frei = [...spieler].sort((a, b) => b.staerke - a.staerke);
  const elf = [];
  // Seltene Rollen zuerst belegen, damit sie nicht von Allgemeinen weggenommen werden.
  const reihenfolge = defs.map((d, i) => i).sort((a, b) => frei.filter((s) => passtAufSlot(defs[a], s)).length - frei.filter((s) => passtAufSlot(defs[b], s)).length);
  const platz = new Array(defs.length);
  for (const i of reihenfolge) {
    const k = frei.findIndex((s) => passtAufSlot(defs[i], s));
    if (k >= 0) {
      platz[i] = { ...frei[k], pos: defs[i].zeile };
      frei.splice(k, 1);
    } else {
      platz[i] = { id: -1, name: 'Lücke', verein: '', pos: defs[i].zeile, staerke: LUECKEN_STAERKE };
    }
  }
  elf.push(...platz);
  return elf;
}

export function vereinsStaerke(alleSpieler, verein) {
  return teamStaerke(besteElf(alleSpieler.filter((s) => s.verein === verein)));
}
