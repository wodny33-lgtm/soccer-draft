const SCHLUESSEL = 'draftfussball.v1';
const MAX_SAISONS = 50;
const MAX_DUELLE = 100;

const leer = () => ({ saisons: [], duelle: [], highscores: {} });

export function createSpeicher(storage) {
  const istObjekt = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  function lade() {
    try {
      const roh = storage.getItem(SCHLUESSEL);
      if (!roh) return leer();
      const p = JSON.parse(roh);
      if (!istObjekt(p)) return leer();
      return {
        ...p,
        saisons: Array.isArray(p.saisons) ? p.saisons : [],
        duelle: Array.isArray(p.duelle) ? p.duelle : [],
        highscores: istObjekt(p.highscores) ? p.highscores : {},
      };
    } catch {
      return leer();
    }
  }
  function sichere(daten) {
    try {
      storage.setItem(SCHLUESSEL, JSON.stringify(daten));
      return true;
    } catch {
      return false;
    }
  }
  return {
    lade,
    speichereSaison(saison) {
      const d = lade();
      d.saisons = [...d.saisons, saison].slice(-MAX_SAISONS);
      const alt = d.highscores[saison.formation] || { staerke: 0, platz: 99 };
      d.highscores[saison.formation] = {
        staerke: Number.isFinite(saison.staerke) ? Math.max(alt.staerke, saison.staerke) : alt.staerke,
        platz: Number.isFinite(saison.platz) ? Math.min(alt.platz, saison.platz) : alt.platz,
      };
      return sichere(d);
    },
    speichereDuell(duell) {
      const d = lade();
      d.duelle = [...d.duelle, duell].slice(-MAX_DUELLE);
      return sichere(d);
    },
    loesche() {
      try {
        storage.removeItem(SCHLUESSEL);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function duellBilanz(duelle) {
  const b = { s: 0, u: 0, n: 0 };
  for (const d of duelle) {
    if (d.tore > d.gegentore) b.s++;
    else if (d.tore < d.gegentore) b.n++;
    else b.u++;
  }
  return b;
}
