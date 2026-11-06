import { DATEN } from './spieler-daten.js';
import { createRng } from './rng.js';
import { FORMATIONEN, POSITIONEN, POS_NAMEN, slotsFuer } from './formationen.js';
import { teamStaerke, linienStaerke, vereinsStaerke } from './team.js';
import { freiePlaetze, ziehVerein } from './draft.js';
import { simuliereSpiel, waehleTorschuetzen } from './sim.js';
import { startSaison, naechsterSpieltag, saisonFertig, sortiere, platzVon } from './saison.js';
import { exportiereKader, importiereKader } from './code.js';
import { createSpeicher, duellBilanz } from './speicher.js';

const speicher = createSpeicher(window.localStorage);
const wurzel = document.getElementById('app');

const z = {
  ansicht: 'home',
  draft: null,
  saison: null,
  letzterTag: [],
  saisonGespeichert: false,
  speicherFehler: false,
  loeschenBereit: false,
};

// ---------- Hilfen ----------
function h(tag, attrs = {}, ...kinder) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === false) continue;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kind of kinder.flat()) {
    if (kind === null || kind === undefined || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return el;
}
const knopf = (text, onclick, klasse = '') => h('button', { class: `knopf ${klasse}`.trim(), onclick }, text);
const zeige = (ansicht) => { z.ansicht = ansicht; render(); };

function kaderListe(kader) {
  return h('ul', { class: 'liste' },
    kader.map((s) => h('li', {}, h('span', {}, `${POS_NAMEN[s.pos]}: ${s.name}`), h('strong', {}, s.staerke))));
}

// ---------- Draft ----------
function startDraft(formation) {
  const slots = slotsFuer(formation);
  z.draft = { formation, slots, kader: [], platz: slots.map(() => null), joker: true, auswahl: null, verein: null, vereine: [] };
  naechsterVerein();
}
function naechsterVerein() {
  const d = z.draft;
  d.verein = ziehVerein(DATEN.spieler, d.slots, d.kader, d.vereine, createRng());
  if (d.verein) d.vereine.push(d.verein);
}
function platziere(spieler, index) {
  const d = z.draft;
  if (d.platz[index] || d.slots[index] !== spieler.pos) return false;
  d.platz[index] = spieler;
  d.kader.push(spieler);
  d.auswahl = null;
  if (d.kader.length === d.slots.length) zeige('kader');
  else { naechsterVerein(); render(); }
  return true;
}
function wuerfeln() {
  const d = z.draft;
  if (!d.joker) return;
  d.joker = false;
  d.auswahl = null;
  naechsterVerein();
  render();
}
// Markiert in der Oberfläche, wohin der gewählte Spieler passt (ohne neu zu zeichnen).
function markiere() {
  const d = z.draft;
  document.querySelectorAll('.feld-platz').forEach((el) => {
    const i = Number(el.dataset.slot);
    el.classList.toggle('moeglich', !!d.auswahl && !d.platz[i] && d.slots[i] === d.auswahl.pos);
  });
  document.querySelectorAll('.karte').forEach((el) => el.classList.toggle('gewaehlt', !!d.auswahl && el.dataset.id === String(d.auswahl.id)));
}
function startZiehen(ev, spieler) {
  ev.preventDefault();
  const d = z.draft;
  d.auswahl = spieler;
  markiere();
  const geist = h('div', { class: 'geist' }, spieler.name);
  document.body.append(geist);
  const bewege = (e) => { geist.style.left = `${e.clientX}px`; geist.style.top = `${e.clientY}px`; };
  bewege(ev);
  const ende = (e) => {
    window.removeEventListener('pointermove', bewege);
    window.removeEventListener('pointerup', ende);
    window.removeEventListener('pointercancel', ende);
    geist.remove();
    const ziel = e.type === 'pointerup' ? document.elementFromPoint(e.clientX, e.clientY)?.closest('.feld-platz') : null;
    if (!ziel || !platziere(spieler, Number(ziel.dataset.slot))) markiere();
  };
  window.addEventListener('pointermove', bewege);
  window.addEventListener('pointerup', ende);
  window.addEventListener('pointercancel', ende);
}

// ---------- Saison ----------
function vereinsListe() {
  const namen = [...new Set(DATEN.spieler.map((s) => s.verein))];
  return namen.map((n) => ({ id: `V:${n}`, name: n, staerke: vereinsStaerke(DATEN.spieler, n) }));
}
function starteSaison() {
  const kader = z.draft.kader;
  const dein = { id: 'DU', name: 'Dein Team', staerke: teamStaerke(kader) };
  z.saison = startSaison(vereinsListe(), dein, kader, createRng());
  z.letzterTag = [];
  z.saisonGespeichert = false;
  z.speicherFehler = false;
  zeige('saison');
}
function weiter() {
  const s = z.saison;
  if (saisonFertig(s)) {
    if (!z.saisonGespeichert) {
      const zeile = s.tabelle.find((t) => t.id === 'DU');
      const ok = speicher.speichereSaison({
        datum: new Date().toISOString(),
        formation: z.draft.formation,
        platz: platzVon(s, 'DU'),
        punkte: zeile.pkt,
        staerke: Math.round(teamStaerke(z.draft.kader) * 10) / 10,
        kader: z.draft.kader.map((k) => k.name),
        tore: zeile.tore,
        gegentore: zeile.gegen,
        torschuetze: Object.entries(s.torschuetzen).sort((a, b) => b[1] - a[1])[0] || null,
      });
      // Nur ein ausdrückliches false gilt als Fehler (undefined = alter Stand = Erfolg).
      z.speicherFehler = ok === false;
      z.saisonGespeichert = true;
    }
    return render();
  }
  z.letzterTag = naechsterSpieltag(s, createRng());
  render();
}

function ganzeSaison() {
  const s = z.saison;
  while (!saisonFertig(s)) naechsterSpieltag(s, createRng());
  z.letzterTag = [];
  weiter();
}

// ---------- Ansichten ----------
function kopf() {
  return h('header', {}, h('h1', {}, 'Draft Fußball'),
    z.ansicht === 'home' ? null : knopf('Start', () => zeige('home'), 'klein'));
}

function ansichtHome() {
  return h('main', {},
    h('p', { class: 'hinweis' }, `Bundesliga · ${DATEN.spieler.length} Spieler · unbegrenzt spielen`),
    knopf('Neuer Draft', () => zeige('formation')),
    knopf('Duell gegen Familie', () => zeige('duell'), 'zweit'),
    knopf('Statistik', () => zeige('statistik'), 'zweit'));
}

function ansichtFormation() {
  return h('main', {}, h('h2', {}, 'Formation wählen'),
    Object.keys(FORMATIONEN).map((f) => knopf(f, () => { startDraft(f); zeige('draft'); })));
}

function feldAnsicht() {
  const d = z.draft;
  const zeilen = ['STU', 'MIT', 'ABW', 'TOR'].map((p) => h('div', { class: 'feld-zeile' },
    d.slots.map((pos, i) => (pos !== p ? null : h('div', {
      class: `feld-platz${d.platz[i] ? ' besetzt' : ''}`, 'data-slot': i,
      onclick: () => { if (d.auswahl && platziere(d.auswahl, i)) return; },
    }, d.platz[i]
      ? [h('strong', {}, d.platz[i].name.split(' ').slice(-1)[0]), h('small', {}, d.platz[i].staerke)]
      : h('small', {}, p))))));
  return h('div', { class: 'feld' }, zeilen);
}

function ansichtDraft() {
  const d = z.draft;
  const frei = freiePlaetze(d.slots, d.kader);
  const gewaehlt = new Set(d.kader.map((s) => s.id));
  const spieler = DATEN.spieler.filter((s) => s.verein === d.verein && !gewaehlt.has(s.id));
  return h('main', { class: 'draft' },
    feldAnsicht(),
    h('div', { class: 'verein-zeile' },
      h('h2', {}, d.verein),
      d.joker ? knopf('🎲 Neu würfeln (1× Joker)', wuerfeln, 'klein') : h('small', { class: 'hinweis' }, 'Joker verbraucht')),
    h('p', { class: 'hinweis' }, 'Spieler antippen, dann ein farbiges Feld antippen – oder am ⠿ ins Feld ziehen.'),
    POSITIONEN.map((p) => {
      if (!frei[p]) return null; // volle Positionen ausblenden
      const liste = spieler.filter((s) => s.pos === p).sort((a, b) => b.staerke - a.staerke);
      if (!liste.length) return null;
      return h('div', {}, h('h3', {}, POS_NAMEN[p]),
        h('div', { class: 'karten' }, liste.map((s) => {
          const gesperrt = !frei[p];
          const karte = h('div', { class: `karte${gesperrt ? ' gesperrt' : ''}`, 'data-id': s.id },
            gesperrt ? null : h('span', { class: 'griff', onpointerdown: (e) => startZiehen(e, s) }, '⠿'),
            h('strong', {}, s.name), h('span', {}, gesperrt ? 'Position besetzt' : ''),
            h('span', { class: 'wert' }, s.staerke));
          if (!gesperrt) karte.addEventListener('click', () => { d.auswahl = d.auswahl === s ? null : s; markiere(); });
          return karte;
        })));
    }));
}

function ansichtKader() {
  const k = z.draft.kader;
  const l = linienStaerke(k);
  return h('main', {},
    h('h2', {}, `Dein Team ${z.draft.formation}`),
    h('p', { class: 'gross' }, `Gesamtstärke ${teamStaerke(k).toFixed(1)}`),
    h('p', {}, POSITIONEN.map((p) => `${POS_NAMEN[p]} ${l[p].toFixed(1)}`).join(' · ')),
    kaderListe(k),
    knopf('Saison starten', starteSaison),
    knopf('Kader-Code teilen', () => zeige('teilen'), 'zweit'),
    knopf('Neuer Draft', () => zeige('formation'), 'zweit'));
}

function aktuellerCode() {
  return exportiereKader({ version: DATEN.version, formation: z.draft.formation, ids: z.draft.kader.map((s) => s.id) });
}

function ansichtTeilen() {
  const code = aktuellerCode();
  const meldung = h('p', { class: 'hinweis' }, '');
  const teilen = async () => {
    try {
      if (navigator.share) await navigator.share({ text: code });
      else { await navigator.clipboard.writeText(code); meldung.textContent = 'Code kopiert.'; }
    } catch { meldung.textContent = 'Bitte den Code von Hand kopieren.'; }
  };
  return h('main', {}, h('h2', {}, 'Kader-Code'),
    h('textarea', { rows: '3', readonly: 'readonly' }, code),
    knopf('Teilen oder kopieren', teilen), meldung,
    knopf('Zurück zum Kader', () => zeige('kader'), 'zweit'));
}

function ansichtSaison() {
  const s = z.saison;
  const fertig = saisonFertig(s);
  const sortiert = sortiere(s.tabelle);
  const bester = Object.entries(s.torschuetzen).sort((a, b) => b[1] - a[1])[0];
  return h('main', {},
    h('h2', {}, fertig ? 'Saison beendet' : s.tag === 0 ? 'Saison startet' : `Spieltag ${s.tag} von ${s.plan.length}`),
    knopf(fertig ? 'Saison speichern und beenden' : 'Weiter', fertig ? () => { weiter(); zeige('statistik'); } : weiter),
    fertig ? null : knopf('Ganze Saison simulieren', ganzeSaison, 'zweit'),
    s.tag === 0 ? h('p', { class: 'hinweis' }, `Dein Team ersetzt ${s.ersetzt}.`) : null,
    fertig ? h('p', { class: 'gross' }, `Platz ${platzVon(s, 'DU')}`) : null,
    fertig && bester ? h('p', {}, `Bester Torschütze: ${bester[0]} (${bester[1]} Tore)`) : null,
    fertig && sortiert[0] ? h('p', {}, `Meister: ${sortiert[0].name}`) : null,
    z.letzterTag.length ? h('h3', {}, `Ergebnisse Spieltag ${s.tag}`) : null,
    z.letzterTag.map((e) => h('div', { class: `spiel${e.deins ? ' du' : ''}` },
      h('span', {}, `${e.heim} – ${e.auswaerts}`),
      h('strong', {}, `${e.toreHeim}:${e.toreAuswaerts}`),
      e.schuetzen.length ? h('small', {}, e.schuetzen.join(', ')) : null)),
    h('h3', {}, 'Tabelle'),
    h('table', {},
      h('tr', {}, ['#', 'Team', 'Sp', 'Diff', 'Pkt'].map((t) => h('th', {}, t))),
      sortiert.map((t, i) => h('tr', { class: t.id === 'DU' ? 'du' : '' },
        h('td', {}, i + 1), h('td', {}, t.name), h('td', {}, t.sp), h('td', {}, t.tore - t.gegen), h('td', {}, t.pkt)))),
    fertig ? knopf('Neuer Draft', () => zeige('formation'), 'zweit') : null);
}

function ansichtDuell() {
  const feld = h('textarea', { rows: '3', placeholder: 'Kader-Code einfügen' });
  const name = h('input', { placeholder: 'Name des Gegners' });
  const ausgabe = h('div', {});
  const los = () => {
    ausgabe.replaceChildren();
    if (!z.draft || z.draft.kader.length < z.draft.slots.length) {
      return ausgabe.append(h('p', { class: 'fehler' }, 'Zuerst einen Draft abschließen.'));
    }
    try {
      const gegner = importiereKader(feld.value, DATEN);
      ausgabe.append(duellErgebnis(gegner, name.value.trim() || 'Gegner'));
    } catch (e) {
      ausgabe.append(h('p', { class: 'fehler' }, e.message));
    }
  };
  return h('main', {}, h('h2', {}, 'Duell gegen die Familie'),
    z.draft && z.draft.kader.length === z.draft.slots.length
      ? knopf('Meinen Kader-Code zeigen', () => zeige('teilen'), 'zweit')
      : h('p', { class: 'hinweis' }, 'Draft zuerst abschließen, dann kannst du spielen.'),
    feld, name, knopf('Spielen', los), ausgabe);
}

function duellErgebnis(gegner, gegnerName) {
  const rng = createRng();
  const meine = z.draft.kader;
  const r = simuliereSpiel(teamStaerke(meine), teamStaerke(gegner.kader), rng, true);
  const meineSchuetzen = waehleTorschuetzen(meine, r.heim, rng);
  const andere = waehleTorschuetzen(gegner.kader, r.auswaerts, rng);
  const ok = speicher.speichereDuell({ datum: new Date().toISOString(), gegner: gegnerName, tore: r.heim, gegentore: r.auswaerts });
  const urteil = r.heim > r.auswaerts ? 'Du gewinnst!' : r.heim < r.auswaerts ? `${gegnerName} gewinnt.` : 'Unentschieden.';
  return h('div', {},
    h('p', { class: 'gross' }, `Du ${r.heim}:${r.auswaerts} ${gegnerName}`),
    h('p', {}, urteil),
    h('p', {}, `Deine Tore: ${meineSchuetzen.join(', ') || 'keine'}`),
    h('p', {}, `Tore von ${gegnerName}: ${andere.join(', ') || 'keine'}`),
    h('p', { class: 'hinweis' }, `Stärke: du ${teamStaerke(meine).toFixed(1)} · ${gegnerName} ${teamStaerke(gegner.kader).toFixed(1)}`),
    ok === false ? h('p', { class: 'fehler' }, 'Das Duell konnte nicht gespeichert werden.') : null);
}

function ansichtStatistik() {
  const d = speicher.lade();
  const b = duellBilanz(d.duelle);
  const hs = Object.entries(d.highscores);
  const bester = d.saisons.filter((s) => s.torschuetze)
    .map((s) => ({ name: s.torschuetze[0], tore: s.torschuetze[1] })).sort((a, b) => b.tore - a.tore)[0];
  const meiste = Math.max(0, ...d.saisons.map((s) => s.tore || 0));
  const meisteTore = meiste ? `${meiste} Tore` : null;
  return h('main', {}, h('h2', {}, 'Statistik'),
    z.speicherFehler ? h('p', { class: 'fehler' }, 'Statistik konnte nicht gespeichert werden.') : null,
    h('h3', {}, 'Highscores'),
    hs.length ? h('ul', { class: 'liste' }, hs.map(([f, w]) =>
      h('li', {}, h('span', {}, f), h('strong', {}, `Beste Stärke ${w.staerke} · bester Platz ${w.platz}`))))
      : h('p', { class: 'hinweis' }, 'Noch keine Saison gespielt.'),
    d.saisons.length ? h('h3', {}, 'Rekorde') : null,
    d.saisons.length ? h('ul', { class: 'liste' },
      h('li', {}, h('span', {}, 'Tore gesamt'), h('strong', {}, d.saisons.reduce((a, s) => a + (s.tore || 0), 0))),
      bester ? h('li', {}, h('span', {}, 'Bester Torschütze (eine Saison)'), h('strong', {}, `${bester.name} · ${bester.tore} Tore`)) : null,
      meisteTore ? h('li', {}, h('span', {}, 'Meiste Tore (eine Saison)'), h('strong', {}, meisteTore)) : null) : null,
    h('h3', {}, 'Letzte Saisons'),
    h('ul', { class: 'liste' }, [...d.saisons].reverse().slice(0, 10).map((s) =>
      h('li', {}, h('span', {}, `${s.datum.slice(0, 10)} · ${s.formation}`, s.torschuetze ? h('small', {}, ` ⚽ ${s.torschuetze[0]} (${s.torschuetze[1]})`) : null),
        h('strong', {}, `Platz ${s.platz} · ${s.punkte} Pkt${Number.isFinite(s.tore) ? ` · ${s.tore}:${s.gegentore}` : ''}`)))),
    h('h3', {}, 'Duelle'),
    h('p', {}, `Bilanz: ${b.s} Siege · ${b.u} Remis · ${b.n} Niederlagen`),
    h('ul', { class: 'liste' }, [...d.duelle].reverse().slice(0, 10).map((x) =>
      h('li', {}, h('span', {}, `${x.datum.slice(0, 10)} · ${x.gegner}`), h('strong', {}, `${x.tore}:${x.gegentore}`)))),
    knopf(z.loeschenBereit ? 'Wirklich alles löschen?' : 'Statistik löschen', () => {
      if (z.loeschenBereit) { speicher.loesche(); z.loeschenBereit = false; } else { z.loeschenBereit = true; }
      render();
    }, 'zweit'));
}

const ANSICHTEN = {
  home: ansichtHome, formation: ansichtFormation, draft: ansichtDraft, kader: ansichtKader,
  teilen: ansichtTeilen, saison: ansichtSaison, duell: ansichtDuell, statistik: ansichtStatistik,
};

function render() {
  wurzel.replaceChildren(kopf(), ANSICHTEN[z.ansicht]());
  window.scrollTo(0, 0);
}

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
