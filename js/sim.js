export const BASIS_TORE = 1.35;
// SKALA geeicht an den 18 echten Vereinsstärken (70,7 bis 86,3, EA-Werte), je 300 Saisons:
// SKALA 25: Meister 71,9 Pkt, Letzter 26,4, Tordifferenz Meister +37, 1,02 % der Spiele mit >= 6 Toren eines Teams.
// Gewählt: 25 (Entscheidung des Nutzers). Zum Vergleich 32: 68,3 / 27,8 / +30 / 0,88 %.
export const SKALA = 25;
export const HEIMVORTEIL = 1.12;
const TOR_GEWICHT = { TOR: 0.01, ABW: 0.1, MIT: 0.35, STU: 0.55 };

// Knuth-Verfahren, genügt für kleine Erwartungswerte.
export function poisson(lambda, rng) {
  const grenze = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > grenze);
  return k - 1;
}

// ort: 'heim' | 'auswaerts' | 'neutral'
export function erwarteteTore(eigene, gegner, ort = 'neutral') {
  const faktor = ort === 'heim' ? HEIMVORTEIL : ort === 'auswaerts' ? 1 / HEIMVORTEIL : 1;
  return BASIS_TORE * Math.exp((eigene - gegner) / SKALA) * faktor;
}

export function simuliereSpiel(heimStaerke, auswaertsStaerke, rng, neutral = false) {
  const ortHeim = neutral ? 'neutral' : 'heim';
  const ortAus = neutral ? 'neutral' : 'auswaerts';
  return {
    heim: poisson(erwarteteTore(heimStaerke, auswaertsStaerke, ortHeim), rng),
    auswaerts: poisson(erwarteteTore(auswaertsStaerke, heimStaerke, ortAus), rng),
  };
}

// Liefert eine Liste von Spielernamen, einen je Tor.
export function waehleTorschuetzen(kader, anzahl, rng) {
  const gewichte = kader.map((s) => TOR_GEWICHT[s.pos] * s.staerke);
  const gesamt = gewichte.reduce((a, b) => a + b, 0);
  const namen = [];
  for (let t = 0; t < anzahl; t++) {
    let x = rng() * gesamt;
    let index = 0;
    while (index < kader.length - 1 && x >= gewichte[index]) {
      x -= gewichte[index];
      index++;
    }
    namen.push(kader[index].name);
  }
  return namen;
}
