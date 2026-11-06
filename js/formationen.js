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

// Liste der 11 Positionen in Draft-Reihenfolge.
export function slotsFuer(formation) {
  const f = FORMATIONEN[formation];
  if (!f) throw new Error(`Unbekannte Formation: ${formation}`);
  const slots = [];
  for (const pos of POSITIONEN) {
    for (let i = 0; i < f[pos]; i++) slots.push(pos);
  }
  return slots;
}
