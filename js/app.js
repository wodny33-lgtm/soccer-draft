import { DATEN } from './spieler-daten.js';
import { createRng } from './rng.js';
import { FORMATIONEN, POSITIONEN, POS_NAMEN, slotsFuer } from './formationen.js';
import { teamStaerke, linienStaerke, vereinsStaerke } from './team.js';
import { ziehKarten } from './draft.js';
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
    if (k === 'onclick') el.addEventListener('click', v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
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
  z.draft = { formation, slots, kader: [], karten: [] };
  z.draft.karten = neueKarten();
}
function neueKarten() {
  const d = z.draft;
  return ziehKarten(DATEN.spieler, d.slots[d.kader.length], d.kader.map((s) => s.id), createRng(), 5);
}
function waehle(spieler) {
  const d = z.draft;
  d.kader.push(spieler);
  if (d.kader.length === d.slots.length) return zeige('kader');
  d.karten = neueKarten();
  render();
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

function ansichtDraft() {
  const d = z.draft;
  const pos = d.slots[d.kader.length];
  return h('main', {},
    h('h2', {}, `Pick ${d.kader.length + 1} von ${d.slots.length}: ${POS_NAMEN[pos]}`),
    h('div', { class: 'karten' }, d.karten.map((s) =>
      h('button', { class: 'karte', onclick: () => waehle(s) },
        h('strong', {}, s.name), h('span', {}, s.verein), h('span', { class: 'wert' }, s.staerke)))),
    d.kader.length ? h('h3', {}, 'Dein Kader bisher') : null,
    d.kader.length ? kaderListe(d.kader) : null);
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
  return h('main', {}, h('h2', {}, 'Statistik'),
    z.speicherFehler ? h('p', { class: 'fehler' }, 'Statistik konnte nicht gespeichert werden.') : null,
    h('h3', {}, 'Highscores'),
    hs.length ? h('ul', { class: 'liste' }, hs.map(([f, w]) =>
      h('li', {}, h('span', {}, f), h('strong', {}, `Beste Stärke ${w.staerke} · bester Platz ${w.platz}`))))
      : h('p', { class: 'hinweis' }, 'Noch keine Saison gespielt.'),
    h('h3', {}, 'Letzte Saisons'),
    h('ul', { class: 'liste' }, [...d.saisons].reverse().slice(0, 10).map((s) =>
      h('li', {}, h('span', {}, `${s.datum.slice(0, 10)} · ${s.formation}`), h('strong', {}, `Platz ${s.platz} · ${s.punkte} Pkt`)))),
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
