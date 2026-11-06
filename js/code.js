import { FORMATIONEN, weiseZu } from './formationen.js';

const PRAEFIX = 'GD1';

// FNV-1a, 32 Bit. Schützt vor Tippfehlern, nicht vor gezieltem Fälschen.
function pruefsumme(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function exportiereKader({ version, formation, ids }) {
  const kurz = formation.replace(/-/g, '');
  const rumpf = [PRAEFIX, String(version), kurz, ids.map((i) => i.toString(36)).join('.')].join('-');
  return `${rumpf}-${pruefsumme(rumpf)}`;
}

export function importiereKader(text, daten) {
  const code = String(text ?? '')
    .replace(/[\s​-‍﻿]+/g, '')
    .replace(/[‐-―−]/g, '-')
    .replace(/^["'`<“”„‚‘’«»]+|["'`>“”„‚‘’«»]+$/g, '')
    .toLowerCase();
  const teile = code.split('-');
  if (teile.length !== 5 || teile[0] !== PRAEFIX.toLowerCase()) {
    throw new Error('Das ist kein gültiger Kader-Code.');
  }
  const [, version, kurz, idText, summe] = teile;
  const rumpf = [PRAEFIX, ...teile.slice(1, 4)].join('-');
  if (pruefsumme(rumpf) !== summe) {
    throw new Error('Die Prüfsumme stimmt nicht. Bitte den Code noch einmal genau kopieren.');
  }
  if (!/^[0-9a-z]+(\.[0-9a-z]+)*$/.test(idText)) {
    throw new Error('Der Kader-Code ist unvollständig oder beschädigt.');
  }
  if (String(daten.version) !== version) {
    throw new Error(`Die Daten-Version passt nicht (Code: ${version}, App: ${daten.version}). Beide brauchen die gleiche App-Version.`);
  }
  const formation = Object.keys(FORMATIONEN).find((f) => f.replace(/-/g, '') === kurz);
  if (!formation) throw new Error('Die Formation im Code ist unbekannt.');

  const kader = idText.split('.').map((teil) => {
    const id = parseInt(teil, 36);
    const spieler = daten.spieler.find((s) => s.id === id);
    if (!spieler) throw new Error(`Spieler ${id} wurde nicht gefunden.`);
    return spieler;
  });

  const zugewiesen = new Set(kader.map((s) => s.id)).size === kader.length ? weiseZu(formation, kader) : null;
  if (!zugewiesen) throw new Error('Der Kader passt nicht zur Formation.');

  return { formation, kader: zugewiesen };
}
