import { DATEN } from './spieler-daten.js';
import { createRng } from './rng.js';
import { FORMATIONEN, POSITIONEN, POS_NAMEN, ROLLEN, ROLLEN_NAMEN, slotDefs, passtAufSlot, rollenVon } from './formationen.js';
import { teamStaerke, linienStaerke, vereinsStaerke } from './team.js';
import { moeglicheFelder, ziehVerein } from './draft.js';
import { simuliereSpiel, waehleTorschuetzen } from './sim.js';
import { startSaison, naechsterSpieltag, saisonFertig, sortiere, platzVon } from './saison.js';
import { exportiereKader, importiereKader } from './code.js';
import { createSpeicher, duellBilanz } from './speicher.js';
import { spielStand, liveErgebnis, neuerRaumCode, normalisiereCode, zuegeListe, einladungsLink, codeAusLink } from './live.js';
import { createVerbindung } from './liveverbindung.js';
import { DB_URL } from './firebase-config.js';

const speicher = createSpeicher(window.localStorage);
const wurzel = document.getElementById('app');

const z = {
  ansicht: 'home',
  draft: null,
  modus: 'saison',
  saison: null,
  letzterTag: [],
  saisonGespeichert: false,
  speicherFehler: false,
  loeschenBereit: false,
  einladung: codeAusLink(window.location.search),
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
  const sortiert = [...kader].sort((a, b) => POSITIONEN.indexOf(a.pos) - POSITIONEN.indexOf(b.pos));
  return h('ul', { class: 'liste' },
    sortiert.map((s) => h('li', {}, h('span', {}, `${s.rolle || POS_NAMEN[s.pos]}: ${s.name}`), h('strong', {}, s.staerke))));
}

// ---------- Draft ----------
function startDraft(formation) {
  const slots = slotDefs(formation);
  z.draft = { formation, slots, kader: [], platz: slots.map(() => null), joker: true, auswahl: null, verein: null, vereine: [] };
  naechsterVerein();
}
function naechsterVerein() {
  const d = z.draft;
  d.verein = ziehVerein(DATEN.spieler, d.slots, d.platz, d.vereine, createRng());
  if (d.verein) d.vereine.push(d.verein);
}
function platziere(spieler, index) {
  const d = z.draft;
  if (d.platz[index] || !passtAufSlot(d.slots[index], spieler)) return false;
  const imTeam = { ...spieler, pos: d.slots[index].zeile }; // zählt in der Linie des Felds
  d.platz[index] = imTeam;
  d.kader.push(imTeam);
  d.auswahl = null;
  if (d.kader.length === d.slots.length) zeige(z.modus === 'duell' ? 'duell' : 'kader');
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
function markiere(d = z.draft) {
  document.querySelectorAll('.feld-platz').forEach((el) => {
    const i = Number(el.dataset.slot);
    el.classList.toggle('moeglich', !!d.auswahl && !d.platz[i] && passtAufSlot(d.slots[i], d.auswahl));
  });
  document.querySelectorAll('.karte').forEach((el) => el.classList.toggle('gewaehlt', !!d.auswahl && el.dataset.id === String(d.auswahl.id)));
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
  return h('header', {}, h('h1', {}, 'Soccer Draft'),
    z.ansicht === 'home' ? null : knopf('Start', () => zeige('home'), 'klein'));
}

// Installation als App: Android/Chrome über beforeinstallprompt, iPhone nur per Hinweis.
let installEreignis = null;
const istInstalliert = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const istIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEreignis = e; if (z.ansicht === 'home') render(); });
window.addEventListener('appinstalled', () => { installEreignis = null; if (z.ansicht === 'home') render(); });

function installBanner() {
  if (istInstalliert()) return null;
  if (installEreignis) {
    return knopf('📲 Als App installieren', async () => {
      const e = installEreignis; installEreignis = null;
      e.prompt(); await e.userChoice; render();
    }, 'zweit');
  }
  if (istIos()) return h('p', { class: 'hinweis' }, '📲 Als App: unten auf Teilen tippen, dann „Zum Home-Bildschirm“.');
  return null;
}

function ansichtHome() {
  return h('main', {},
    h('p', { class: 'hinweis' }, `Bundesliga · ${DATEN.spieler.length} Spieler · unbegrenzt spielen`),
    installBanner(),
    knopf('Neuer Draft', () => { z.modus = 'saison'; zeige('formation'); }),
    knopf('Live-Duell (online)', () => zeige('liveStart')),
    knopf('Duell gegen Familie (mit Code)', () => { z.modus = 'duell'; zeige('formation'); }, 'zweit'),
    knopf('Statistik', () => zeige('statistik'), 'zweit'));
}

function ansichtFormation() {
  return h('main', {}, h('h2', {}, 'Formation wählen'),
    Object.keys(FORMATIONEN).map((f) => knopf(f, () => { startDraft(f); zeige('draft'); })));
}

function feldAnsicht(d = z.draft, beiPlatz = platziere) {
  const reihen = [...new Set(d.slots.map((s) => s.reihe))].sort((a, b) => b - a); // vorn oben, Tor unten
  const zeilen = reihen.map((p) => h('div', { class: 'feld-zeile' },
    d.slots.map((slot, i) => (slot.reihe !== p ? null : h('div', {
      class: `feld-platz${d.platz[i] ? ' besetzt' : ''}`, 'data-slot': i,
      onclick: () => { if (d.auswahl) beiPlatz(d.auswahl, i); },
    }, d.platz[i]
      ? [h('strong', {}, d.platz[i].name.split(' ').slice(-1)[0]), h('small', {}, `${slot.rolle} · ${d.platz[i].staerke}`)]
      : h('small', {}, slot.rolle))))));
  return h('div', { class: 'feld' }, zeilen);
}

// Spielerkarten des gezogenen Vereins, nach Rolle gruppiert. Nur Spieler, die auf ein freies Feld passen.
function spielerListe(d, vergeben) {
  const spieler = DATEN.spieler.filter((s) => s.verein === d.verein && !vergeben.has(s.id) && moeglicheFelder(d.slots, d.platz, s).length);
  return ROLLEN.map((r) => {
    const liste = spieler.filter((s) => s.rolle === r).sort((a, b) => b.staerke - a.staerke);
    if (!liste.length) return null;
    return h('div', {}, h('h3', {}, ROLLEN_NAMEN[r]),
      h('div', { class: 'karten' }, liste.map((s) => {
        const karte = h('div', { class: 'karte', 'data-id': s.id },
          h('strong', {}, s.name), h('span', {}, rollenVon(s).join(' · ')),
          h('span', { class: 'wert' }, s.staerke));
        karte.addEventListener('click', () => { d.auswahl = d.auswahl === s ? null : s; markiere(d); });
        return karte;
      })));
  });
}

function ansichtDraft() {
  const d = z.draft;
  return h('main', { class: 'draft' },
    feldAnsicht(),
    h('div', { class: 'verein-zeile' },
      h('h2', {}, d.verein),
      d.joker ? knopf('🎲 Neu würfeln (1× Joker)', wuerfeln, 'klein') : h('small', { class: 'hinweis' }, 'Joker verbraucht')),
    h('p', { class: 'hinweis' }, 'Spieler antippen, dann ein farbiges Feld antippen.'),
    spielerListe(d, new Set(d.kader.map((s) => s.id))));
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

function codeBlock() {
  const code = aktuellerCode();
  const meldung = h('p', { class: 'hinweis' }, '');
  const teilen = async () => {
    try {
      if (navigator.share) await navigator.share({ text: code });
      else { await navigator.clipboard.writeText(code); meldung.textContent = 'Code kopiert.'; }
    } catch { meldung.textContent = 'Bitte den Code von Hand kopieren.'; }
  };
  return h('div', {}, h('textarea', { rows: '3', readonly: 'readonly' }, code),
    knopf('Teilen oder kopieren', teilen), meldung);
}

function ansichtTeilen() {
  return h('main', {}, h('h2', {}, 'Kader-Code'), codeBlock(),
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
  if (!z.draft || z.draft.kader.length < z.draft.slots.length) { z.modus = 'duell'; return ansichtFormation(); }
  const k = z.draft.kader;
  const feld = h('textarea', { rows: '3', placeholder: 'Kader-Code des Gegners einfügen' });
  const name = h('input', { placeholder: 'Name des Gegners' });
  const ausgabe = h('div', {});
  const los = () => {
    ausgabe.replaceChildren();
    try {
      const gegner = importiereKader(feld.value, DATEN);
      ausgabe.append(duellErgebnis(gegner, name.value.trim() || 'Gegner'));
    } catch (e) {
      ausgabe.append(h('p', { class: 'fehler' }, e.message));
    }
  };
  return h('main', {}, h('h2', {}, 'Duell gegen die Familie'),
    h('p', { class: 'gross' }, `Dein Team ${z.draft.formation} · Stärke ${teamStaerke(k).toFixed(1)}`),
    kaderListe(k),
    h('h3', {}, '1. Deinen Code verschicken'), codeBlock(),
    h('h3', {}, '2. Gegen einen Code spielen'), feld, name, knopf('Spielen', los), ausgabe,
    knopf('Neues Duell mit neuem Draft', () => { z.modus = 'duell'; zeige('formation'); }, 'zweit'));
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

// ---------- Live-Duell (online, Firebase) ----------
const verbindung = createVerbindung(DB_URL);
const LIVE_KEY = 'soccer-draft-live';
const NAME_KEY = 'soccer-draft-name';
const lokal = {
  lies(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  schreib(k, v) { try { window.localStorage.setItem(k, v); } catch { /* Speicher gesperrt, egal */ } },
  weg(k) { try { window.localStorage.removeItem(k); } catch { /* egal */ } },
};
let live = null; // { code, ich, raum, stand, fehler, timer, prueft, gespeichert }

function stoppeLive() {
  if (live) clearInterval(live.timer);
  live = null;
}
function verlasseLive() {
  stoppeLive();
  lokal.weg(LIVE_KEY);
  zeige('home');
}
function berechneLive() {
  live.stand = spielStand(live.raum, DATEN.spieler);
}
function betreteLive(code, ich, raum) {
  stoppeLive();
  live = { code, ich, raum, stand: null, fehler: '', timer: null, prueft: false, gespeichert: false };
  berechneLive();
  lokal.schreib(LIVE_KEY, JSON.stringify({ code, ich }));
  live.timer = setInterval(pruefeLive, 1500);
  zeige('live');
}

async function pruefeLive() {
  const l = live;
  if (!l) return;
  if (z.ansicht !== 'live') { clearInterval(l.timer); if (live === l) live = null; return; }
  if (l.prueft || (l.stand && l.stand.fertig)) return;
  l.prueft = true;
  try {
    const raum = await verbindung.lade(l.code);
    if (live !== l) return;
    if (!raum) { l.fehler = 'Der Raum existiert nicht mehr.'; clearInterval(l.timer); render(); return; }
    const neu = zuegeListe(raum.zuege).length;
    const lokalAnzahl = zuegeListe(l.raum.zuege).length;
    // Ältere Antworten (weniger Züge als lokal bekannt) werden ignoriert.
    const geaendert = neu > lokalAnzahl || (raum.gast || '') !== (l.raum.gast || '');
    if (geaendert) { l.raum = raum; l.fehler = ''; berechneLive(); render(); }
    else if (l.fehler) { l.fehler = ''; render(); }
  } catch (e) {
    if (live === l && l.fehler !== e.message) { l.fehler = e.message; render(); }
  } finally {
    l.prueft = false;
  }
}

async function sendeLiveZug(zug) {
  const l = live;
  const bisher = zuegeListe(l.raum.zuege);
  const neuerRaum = { ...l.raum, zuege: [...bisher, zug] };
  const neuerStand = spielStand(neuerRaum, DATEN.spieler);
  if (neuerStand.fehler) { l.fehler = neuerStand.fehler; render(); return; }
  const alterRaum = l.raum;
  l.raum = neuerRaum; l.stand = neuerStand; l.fehler = '';
  render();
  try {
    await verbindung.sendeZug(l.code, bisher.length, zug);
  } catch (e) {
    if (live !== l) return;
    l.raum = alterRaum; berechneLive(); l.fehler = `${e.message} Zug nochmal versuchen.`;
    render();
  }
}

function eigenerName(feld) {
  const name = feld.value.trim().slice(0, 20) || 'Spieler';
  lokal.schreib(NAME_KEY, name);
  return name;
}

function ansichtLiveStart() {
  if (!verbindung.aktiv) {
    return h('main', {}, h('h2', {}, 'Live-Duell'),
      h('p', {}, 'Das Live-Duell ist noch nicht eingerichtet. Dafür fehlt die Firebase-Adresse in js/firebase-config.js (Anleitung: README, Abschnitt „Live-Duell“).'));
  }
  const meldung = h('p', { class: 'fehler' }, '');
  const name = h('input', { placeholder: 'Dein Name', maxlength: '20', value: lokal.lies(NAME_KEY) || '' });
  const code = h('input', { placeholder: 'Raum-Code, z. B. K7QF', maxlength: '5', autocapitalize: 'characters', autocomplete: 'off', value: z.einladung || '' });
  const fuehre = async (aufgabe) => {
    meldung.textContent = '';
    try { await aufgabe(); } catch (e) { meldung.textContent = e.message; }
  };
  const gespeichert = (() => { try { return JSON.parse(lokal.lies(LIVE_KEY)); } catch { return null; } })();
  return h('main', {}, h('h2', {}, 'Live-Duell'),
    z.einladung ? h('p', { class: 'gross' }, `Einladung zu Raum ${z.einladung}`) : null,
    h('p', { class: 'hinweis' }, 'Ihr draftet abwechselnd aus demselben Spielerpool. Jeden Spieler gibt es nur einmal.'),
    name,
    gespeichert && gespeichert.code ? knopf(`Zurück zu Raum ${gespeichert.code}`, () => fuehre(async () => {
      const raum = await verbindung.lade(gespeichert.code);
      if (!raum) { lokal.weg(LIVE_KEY); throw new Error('Dieser Raum existiert nicht mehr.'); }
      betreteLive(gespeichert.code, gespeichert.ich, raum);
    })) : null,
    h('h3', {}, 'Raum erstellen: Formation wählen'),
    Object.keys(FORMATIONEN).map((f) => knopf(f, () => fuehre(async () => {
      const neuerCode = neuerRaumCode();
      const raum = { version: DATEN.version, formation: f, seed: (Math.random() * 2 ** 32) >>> 0, host: eigenerName(name), erstellt: Date.now() };
      await verbindung.erstelle(neuerCode, raum);
      betreteLive(neuerCode, 0, { ...raum, zuege: [] });
    }), 'zweit')),
    h('h3', {}, 'Einem Raum beitreten'),
    code,
    knopf('Beitreten', () => fuehre(async () => {
      const eingabe = normalisiereCode(code.value);
      if (eingabe.length !== 4) throw new Error('Der Raum-Code hat 4 Zeichen.');
      const raum = await verbindung.tritBei(eingabe, eigenerName(name), DATEN.version);
      z.einladung = null;
      window.history.replaceState(null, '', window.location.pathname);
      betreteLive(eingabe, 1, raum);
    })),
    meldung);
}

function ansichtLive() {
  const l = live;
  if (!l) return ansichtLiveStart();
  const { raum, stand, ich } = l;
  const meinName = ich === 0 ? raum.host : raum.gast;
  const gegnerName = (ich === 0 ? raum.gast : raum.host) || 'Mitspieler';
  const fehler = l.fehler ? h('p', { class: 'fehler' }, l.fehler) : null;

  if (!raum.gast) {
    const link = einladungsLink(window.location.href, l.code);
    const teilen = async () => {
      const text = `Soccer Draft Live-Duell: Tippe auf den Link, gib deinen Namen ein und tritt Raum ${l.code} bei.\n${link}`;
      try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); } catch { /* abgebrochen */ }
    };
    return h('main', {}, h('h2', {}, 'Warte auf Mitspieler'),
      h('p', { class: 'gross' }, `Raum-Code ${l.code}`),
      h('p', { class: 'hinweis' }, `Formation ${raum.formation}. Schick den Link an den Mitspieler: Er tippt ihn an, gibt seinen Namen ein und ist drin.`),
      knopf('Code teilen', teilen), fehler,
      knopf('Raum verlassen', verlasseLive, 'zweit'));
  }

  const d = { slots: stand.slots, platz: stand.seiten[ich].platz, auswahl: null, verein: stand.verein };
  const anzahl = stand.slots.length;
  const status = h('p', { class: 'hinweis' },
    `Raum ${l.code} · ${meinName} gegen ${gegnerName} · Dein Team ${stand.seiten[ich].kader.length}/${anzahl} · ${gegnerName} ${stand.seiten[1 - ich].kader.length}/${anzahl}`);

  if (stand.fehler) {
    return h('main', {}, h('h2', {}, 'Live-Duell'), status, h('p', { class: 'fehler' }, `Der Spielstand ist nicht stimmig: ${stand.fehler}.`),
      knopf('Raum verlassen', verlasseLive, 'zweit'));
  }

  if (stand.fertig) {
    const e = liveErgebnis(raum, stand);
    if (!l.gespeichert) {
      l.gespeichert = true;
      lokal.weg(LIVE_KEY);
      clearInterval(l.timer);
      speicher.speichereDuell({ datum: new Date().toISOString(), gegner: gegnerName, tore: e.tore[ich], gegentore: e.tore[1 - ich] });
    }
    const urteil = e.tore[ich] > e.tore[1 - ich] ? 'Du gewinnst!' : e.tore[ich] < e.tore[1 - ich] ? `${gegnerName} gewinnt.` : 'Unentschieden.';
    return h('main', {}, h('h2', {}, 'Live-Duell beendet'),
      h('p', { class: 'gross' }, `${meinName} ${e.tore[ich]}:${e.tore[1 - ich]} ${gegnerName}`),
      h('p', {}, urteil),
      h('p', {}, `Deine Tore: ${e.schuetzen[ich].join(', ') || 'keine'}`),
      h('p', {}, `Tore von ${gegnerName}: ${e.schuetzen[1 - ich].join(', ') || 'keine'}`),
      h('p', { class: 'hinweis' }, `Stärke: du ${e.staerke[ich].toFixed(1)} · ${gegnerName} ${e.staerke[1 - ich].toFixed(1)}`),
      h('h3', {}, 'Dein Team'), kaderListe(stand.seiten[ich].kader),
      h('h3', {}, `Team von ${gegnerName}`), kaderListe(stand.seiten[1 - ich].kader),
      knopf('Neues Live-Duell', () => { stoppeLive(); zeige('liveStart'); }),
      knopf('Start', () => { stoppeLive(); zeige('home'); }, 'zweit'));
  }

  const meinZug = stand.aktiv === ich;
  const beiPlatz = (spieler, i) => {
    if (meinZug && !d.platz[i] && passtAufSlot(d.slots[i], spieler)) sendeLiveZug({ s: ich, id: spieler.id, slot: i });
  };
  const gegnerTeam = stand.seiten[1 - ich].kader;
  return h('main', { class: 'draft' },
    status, fehler,
    feldAnsicht(d, beiPlatz),
    meinZug
      ? [h('div', { class: 'verein-zeile' },
        h('h2', {}, `Du bist dran: ${stand.verein}`),
        stand.seiten[ich].joker
          ? knopf('🎲 Neu würfeln (1× Joker)', () => sendeLiveZug({ s: ich, joker: true }), 'klein')
          : h('small', { class: 'hinweis' }, 'Joker verbraucht')),
      h('p', { class: 'hinweis' }, 'Spieler antippen, dann ein farbiges Feld antippen.'),
      spielerListe(d, stand.vergeben)]
      : [h('h2', {}, `${gegnerName} ist dran: ${stand.verein}`),
        h('p', { class: 'hinweis' }, 'Warte auf den Zug. Die Seite aktualisiert sich selbst.'),
        gegnerTeam.length ? h('h3', {}, `Team von ${gegnerName}`) : null,
        gegnerTeam.length ? kaderListe(gegnerTeam) : null]);
}

const ANSICHTEN = {
  home: ansichtHome, formation: ansichtFormation, draft: ansichtDraft, kader: ansichtKader,
  teilen: ansichtTeilen, saison: ansichtSaison, duell: ansichtDuell, statistik: ansichtStatistik,
  liveStart: ansichtLiveStart, live: ansichtLive,
};

function render() {
  wurzel.replaceChildren(kopf(), ANSICHTEN[z.ansicht]());
  window.scrollTo(0, 0);
}

if (z.einladung) z.ansicht = 'liveStart';
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
