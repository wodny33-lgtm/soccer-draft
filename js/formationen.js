export const POSITIONEN = ['TOR', 'ABW', 'MIT', 'STU'];

export const POS_NAMEN = {
  TOR: 'Torwart',
  ABW: 'Abwehr',
  MIT: 'Mittelfeld',
  STU: 'Sturm',
};

export const FORMATIONEN = {
  '4-3-3': { TOR: 1, ABW: 4, MIT: 3, STU: 3 },
  '4-4-2': { TOR: 1, ABW: 4, MIT: 4, STU: 2 },
  '3-5-2': { TOR: 1, ABW: 3, MIT: 5, STU: 2 },
};

// Genaue Aufstellung je Formation, von links nach rechts, nach Linien geordnet (Tor, Abwehr, Mittelfeld, Sturm).
const AUFSTELLUNG = {
  '4-3-3': ['TW', 'LV', 'IV', 'IV', 'RV', 'ZDM', 'ZM', 'ZOM', 'LF', 'ST', 'RF'],
  '4-4-2': ['TW', 'LV', 'IV', 'IV', 'RV', 'LM', 'ZM', 'ZM', 'RM', 'ST', 'ST'],
  '3-5-2': ['TW', 'IV', 'IV', 'IV', 'LM', 'ZDM', 'ZM', 'ZOM', 'RM', 'ST', 'ST'],
};

export const ROLLEN_NAMEN = {
  TW: 'Torwart', IV: 'Innenverteidiger', LV: 'Linker Verteidiger', RV: 'Rechter Verteidiger',
  ZDM: 'Defensives Mittelfeld', ZM: 'Zentrales Mittelfeld', ZOM: 'Offensives Mittelfeld',
  LM: 'Linkes Mittelfeld', RM: 'Rechtes Mittelfeld', LF: 'Linker Flügel', RF: 'Rechter Flügel', ST: 'Stürmer',
};
export const ROLLEN = Object.keys(ROLLEN_NAMEN);

const ZEILE = { TW: 'TOR', IV: 'ABW', LV: 'ABW', RV: 'ABW', ZDM: 'MIT', ZM: 'MIT', ZOM: 'MIT', LM: 'MIT', RM: 'MIT', LF: 'STU', RF: 'STU', ST: 'STU' };
// Welche Spieler-Rollen ein Feld nehmen darf: Flügel im Sturm nehmen auch die Außenspieler des Mittelfelds.
const AKZEPTIERT = { LF: ['LF', 'LM'], RF: ['RF', 'RM'] };

// Felder einer Formation: [{ rolle, zeile, akzeptiert }]
export function slotDefs(formation) {
  const auf = AUFSTELLUNG[formation];
  if (!auf) throw new Error(`Unbekannte Formation: ${formation}`);
  return auf.map((rolle) => ({ rolle, zeile: ZEILE[rolle], akzeptiert: AKZEPTIERT[rolle] || [rolle] }));
}

// Alle Rollen, die der Spieler spielen kann (Hauptrolle zuerst, dann Nebenpositionen).
export function rollenVon(spieler) {
  return spieler.rolle ? [spieler.rolle, ...(spieler.alt || [])] : [];
}

// Passt der Spieler auf das Feld? Haupt- oder Nebenposition reicht. Ohne genaue Rolle (alte Daten) zählt die grobe Linie.
export function passtAufSlot(slot, spieler) {
  if (!spieler.rolle) return spieler.pos === slot.zeile;
  return rollenVon(spieler).some((r) => slot.akzeptiert.includes(r));
}

// Ordnet 11 Spieler den Feldern der Formation zu. Gibt Kopien mit pos = Linie des Felds zurück (oder null).
export function weiseZu(formation, spieler) {
  const defs = slotDefs(formation);
  if (spieler.length !== defs.length) return null;
  const belegt = new Array(defs.length).fill(null);
  const versuche = (i) => {
    if (i === spieler.length) return true;
    for (let j = 0; j < defs.length; j++) {
      if (belegt[j] === null && passtAufSlot(defs[j], spieler[i])) {
        belegt[j] = { ...spieler[i], pos: defs[j].zeile };
        if (versuche(i + 1)) return true;
        belegt[j] = null;
      }
    }
    return false;
  };
  return versuche(0) ? belegt : null;
}

// Liste der 11 Linien (Tor, Abwehr, Mittelfeld, Sturm) in Draft-Reihenfolge.
export function slotsFuer(formation) {
  return slotDefs(formation).map((s) => s.zeile);
}
