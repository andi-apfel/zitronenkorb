'use strict';
/* Zitronenkorb – eingebaute Rezeptideen (vegetarisch, je 2 Portionen) und Vorschläge aus dem Lager.
   Die Ideen sind auf beiden Handys gleich (feste IDs). Erst „In unsere Rezepte übernehmen“ macht sie zu eigenen Rezepten;
   Kochen und Einplanen geht auch direkt. */

const CATALOG = [
  ['Spaghetti al limone', ['Pasta', 'schnell'], ['200 g Spaghetti', '1 Zitrone, Saft und Abrieb', '40 g Parmesan', '30 g Butter', '100 ml Sahne', 'Salz und Pfeffer'],
    ['Spaghetti in Salzwasser bissfest kochen, eine Tasse Nudelwasser aufheben.', 'Butter schmelzen, Zitronenabrieb, Saft und Sahne kurz aufkochen.', 'Nudeln mit etwas Nudelwasser und Parmesan in der Sauce schwenken, pfeffern.']],
  ['Shakshuka', ['Pfanne', 'Eier'], ['4 Eier', '1 Dose Gehackte Tomaten', '1 Paprika', '1 Zwiebel', '1 Zehe Knoblauch', '1 TL Paprikapulver', '2 EL Olivenöl', '1 Brot', 'Salz und Pfeffer'],
    ['Zwiebel, Paprika und Knoblauch würfeln und im Öl weich dünsten.', 'Paprikapulver und Tomaten dazugeben, 10 Minuten einköcheln, würzen.', 'Mulden formen, Eier hineingleiten lassen und zugedeckt stocken lassen.', 'Mit Brot servieren.']],
  ['Rotes Linsencurry', ['Curry', 'günstig'], ['150 g Rote Linsen', '1 Dose Kokosmilch', '1 Dose Gehackte Tomaten', '1 Zwiebel', '1 Zehe Knoblauch', '1 Stk Ingwer', '2 TL Currypulver', '150 g Reis'],
    ['Reis kochen.', 'Zwiebel, Knoblauch und Ingwer fein hacken und anschwitzen, Currypulver kurz mitrösten.', 'Linsen, Tomaten und Kokosmilch dazugeben und 15 Minuten köcheln, bis die Linsen zerfallen.', 'Abschmecken und mit Reis servieren.']],
  ['Kichererbsen-Spinat-Curry', ['Curry', 'schnell'], ['1 Dose Kichererbsen', '200 g Spinat', '1 Dose Kokosmilch', '1 Zwiebel', '1 Zehe Knoblauch', '2 TL Currypulver', '150 g Reis'],
    ['Reis kochen.', 'Zwiebel und Knoblauch anschwitzen, Curry mitrösten.', 'Abgetropfte Kichererbsen und Kokosmilch 10 Minuten köcheln.', 'Spinat unterheben, bis er zusammenfällt.']],
  ['Gemüsepfanne mit Tofu', ['Pfanne', 'Asiatisch'], ['200 g Tofu', '1 Paprika', '1 Brokkoli', '2 Karotten', '3 EL Sojasauce', '1 Stk Ingwer', '150 g Reis', '2 EL Rapsöl'],
    ['Reis kochen. Tofu würfeln und im Öl knusprig braten, herausnehmen.', 'Gemüse in mundgerechte Stücke schneiden und mit Ingwer scharf anbraten.', 'Tofu zurück in die Pfanne, mit Sojasauce ablöschen.']],
  ['Ofengemüse mit Feta', ['Ofen', 'Blech'], ['400 g Süßkartoffeln', '1 Zucchini', '1 Paprika', '1 Zwiebel', '200 g Feta', '3 EL Olivenöl', 'Salz und Pfeffer'],
    ['Ofen auf 200 °C vorheizen.', 'Gemüse in Stücke schneiden, mit Öl, Salz und Pfeffer mischen und aufs Blech geben.', 'Feta darüberbröseln und 30 Minuten backen.']],
  ['Kartoffelsuppe', ['Suppe'], ['500 g Kartoffeln', '2 Karotten', '1 Zwiebel', '600 ml Gemüsebrühe', '100 ml Sahne', '1 Bund Petersilie'],
    ['Kartoffeln, Karotten und Zwiebel würfeln und kurz anschwitzen.', 'Mit Brühe aufgießen und 20 Minuten weich kochen.', 'Teilweise pürieren, Sahne einrühren, mit Petersilie bestreuen.']],
  ['Pfannkuchen', ['süß', 'schnell'], ['200 g Mehl', '300 ml Milch', '2 Eier', '20 g Butter', '1 Prise Salz', '1 EL Zucker'],
    ['Mehl, Milch, Eier, Salz und Zucker glatt rühren, 10 Minuten ruhen lassen.', 'Portionsweise in Butter dünn ausbacken.']],
  ['Kaiserschmarrn', ['süß', 'österreichisch'], ['150 g Mehl', '250 ml Milch', '3 Eier', '30 g Butter', '2 EL Zucker', '1 Prise Salz'],
    ['Eier trennen. Mehl, Milch, Eigelb und Salz verrühren, Eiweiß mit Zucker steif schlagen und unterheben.', 'Teig in Butter backen, wenden und mit zwei Gabeln in Stücke reißen.', 'Mit etwas Zucker karamellisieren lassen.']],
  ['Tomatensuppe', ['Suppe', 'schnell'], ['500 g Passierte Tomaten', '1 Zwiebel', '1 Zehe Knoblauch', '300 ml Gemüsebrühe', '50 ml Sahne', '1 Topf Basilikum'],
    ['Zwiebel und Knoblauch anschwitzen.', 'Tomaten und Brühe 15 Minuten köcheln, pürieren.', 'Mit Sahne verfeinern, Basilikum darüber.']],
  ['Pasta mit Tomatensauce', ['Pasta', 'Klassiker'], ['200 g Penne', '500 g Passierte Tomaten', '1 Zwiebel', '1 Zehe Knoblauch', '2 EL Olivenöl', '1 Topf Basilikum', '30 g Parmesan'],
    ['Nudeln kochen.', 'Zwiebel und Knoblauch im Öl anschwitzen, Tomaten 15 Minuten köcheln.', 'Mit Nudeln mischen, Basilikum und Parmesan dazu.']],
  ['Penne mit Brokkoli und Frischkäse', ['Pasta', 'schnell'], ['200 g Penne', '1 Brokkoli', '150 g Frischkäse', '1 Zehe Knoblauch', '30 g Parmesan'],
    ['Brokkoliröschen die letzten 4 Minuten mit den Nudeln kochen.', 'Knoblauch anschwitzen, Frischkäse mit etwas Nudelwasser schmelzen.', 'Alles mischen, Parmesan darüber.']],
  ['Gnocchi-Pfanne mit Spinat', ['Pfanne', 'schnell'], ['1 Pck Gnocchi', '200 g Spinat', '100 g Frischkäse', '250 g Tomaten', '1 Zehe Knoblauch', '20 g Parmesan'],
    ['Gnocchi in der Pfanne goldbraun braten.', 'Knoblauch und halbierte Tomaten kurz mitbraten, Spinat zusammenfallen lassen.', 'Frischkäse unterrühren, Parmesan darüber.']],
  ['Chili sin Carne', ['Eintopf', 'Vorrat'], ['1 Pck Veggie-Hack', '1 Dose Kidneybohnen', '1 Dose Mais', '1 Dose Gehackte Tomaten', '1 Zwiebel', '1 Paprika', '2 TL Paprikapulver', '150 g Reis'],
    ['Reis kochen.', 'Veggie-Hack mit Zwiebel und Paprika anbraten, Paprikapulver dazu.', 'Bohnen, Mais und Tomaten 15 Minuten köcheln, kräftig würzen.']],
  ['Halloumi-Wraps', ['schnell', 'Abendbrot'], ['1 Pck Wraps', '1 Pck Halloumi', '1 Salat', '2 Tomaten', '0.5 Gurke', '150 g Joghurt'],
    ['Halloumi in Scheiben schneiden und von beiden Seiten braten.', 'Gemüse schneiden, Joghurt mit Salz verrühren.', 'Wraps kurz erwärmen und füllen.']],
  ['Couscous-Salat', ['Salat', 'kalt'], ['150 g Couscous', '1 Gurke', '2 Tomaten', '1 Paprika', '100 g Feta', '1 Zitrone', '3 EL Olivenöl', '1 Bund Petersilie'],
    ['Couscous mit kochendem Wasser übergießen und 5 Minuten quellen lassen.', 'Gemüse würfeln, Petersilie hacken.', 'Alles mit Zitronensaft und Öl mischen, Feta darüberbröseln.']],
  ['Rührei mit Frühlingszwiebeln', ['Frühstück', 'schnell'], ['4 Eier', '50 ml Milch', '10 g Butter', '1 Bund Frühlingszwiebeln', '2 Brötchen'],
    ['Eier mit Milch verquirlen.', 'Frühlingszwiebeln in Butter kurz anschwitzen, Eier dazu und langsam stocken lassen.', 'Mit Brötchen servieren.']],
  ['Champignon-Rahm-Nudeln', ['Pasta'], ['200 g Spaghetti', '250 g Champignons', '1 Zwiebel', '150 ml Sahne', '1 Bund Petersilie'],
    ['Nudeln kochen.', 'Pilze in Scheiben scharf anbraten, Zwiebel dazu.', 'Mit Sahne ablöschen, einköcheln, Petersilie unterrühren.']],
  ['Gefüllte Paprika mit Couscous', ['Ofen'], ['2 Paprika', '100 g Couscous', '100 g Feta', '1 Dose Gehackte Tomaten', '1 Zwiebel'],
    ['Couscous quellen lassen, mit gewürfelter Zwiebel und Feta mischen.', 'Paprika halbieren, füllen und in eine Form mit den Tomaten setzen.', 'Bei 200 °C 25 Minuten backen.']],
  ['Bratkartoffeln mit Spiegelei', ['Klassiker', 'Pfanne'], ['600 g Kartoffeln', '1 Zwiebel', '4 Eier', '3 EL Rapsöl', 'Salz und Pfeffer'],
    ['Kartoffeln kochen, abkühlen lassen und in Scheiben schneiden.', 'Im Öl knusprig braten, Zwiebel zum Schluss dazu.', 'Spiegeleier daneben braten.']],
  ['Pellkartoffeln mit Kräuterquark', ['günstig', 'Klassiker'], ['600 g Kartoffeln', '250 g Quark', '1 Bund Frühlingszwiebeln', '1 Bund Petersilie', '1 EL Olivenöl'],
    ['Kartoffeln mit Schale garen.', 'Quark mit gehackten Kräutern, Öl, Salz und Pfeffer cremig rühren.']],
  ['Overnight Oats', ['Frühstück', 'süß'], ['100 g Haferflocken', '250 ml Hafermilch', '150 g Joghurt', '1 Schale Beeren', '1 EL Honig'],
    ['Haferflocken, Hafermilch und Joghurt verrühren und über Nacht kühlen.', 'Morgens mit Beeren und Honig servieren.']],
  ['Bulgur-Pfanne mit Zucchini', ['Pfanne'], ['150 g Bulgur', '1 Zucchini', '1 EL Tomatenmark', '1 Zwiebel', '400 ml Gemüsebrühe', '100 g Feta'],
    ['Zwiebel und Zucchini anbraten, Tomatenmark kurz mitrösten.', 'Bulgur und Brühe dazu, 12 Minuten zugedeckt quellen lassen.', 'Feta darüberbröseln.']],
  ['Tofu-Bowl mit Erdnusssauce', ['Bowl', 'Asiatisch'], ['200 g Tofu', '150 g Reis', '1 Gurke', '2 Karotten', '2 EL Erdnussbutter', '2 EL Sojasauce', '1 Zitrone'],
    ['Reis kochen, Tofu würfeln und knusprig braten.', 'Gurke und Karotten in Streifen schneiden.', 'Erdnussbutter mit Sojasauce, Zitronensaft und etwas Wasser glatt rühren, über die Bowl geben.']],
  ['Pizza-Toast', ['schnell', 'Ofen'], ['4 Scheiben Toastbrot', '100 g Passierte Tomaten', '1 Mozzarella', '1 Topf Basilikum'],
    ['Toast mit Tomaten bestreichen und mit Mozzarella belegen.', 'Bei 220 °C etwa 8 Minuten backen, Basilikum darüber.']],
  ['Tomate-Mozzarella mit Brot', ['kalt', 'Abendbrot'], ['3 Tomaten', '2 Mozzarella', '1 Topf Basilikum', '2 EL Olivenöl', '1 EL Balsamico', '1 Brot'],
    ['Tomaten und Mozzarella in Scheiben schneiden und abwechselnd anrichten.', 'Mit Basilikum, Öl, Balsamico, Salz und Pfeffer beträufeln, Brot dazu.']],
  ['Gemüse-Frittata', ['Eier', 'Pfanne'], ['5 Eier', '1 Zucchini', '1 Paprika', '1 Zwiebel', '100 g Feta'],
    ['Gemüse klein schneiden und in einer ofenfesten Pfanne anbraten.', 'Verquirlte Eier darübergießen, Feta darauf.', 'Bei 180 °C etwa 15 Minuten im Ofen stocken lassen.']],
  ['Pesto-Pasta mit Tomaten', ['Pasta', 'schnell'], ['200 g Penne', '1 Glas Pesto', '250 g Tomaten', '30 g Parmesan'],
    ['Nudeln kochen.', 'Tomaten halbieren und mit Pesto und den Nudeln mischen, Parmesan darüber.']],
  ['Linsen-Bolognese', ['Pasta', 'Vorrat'], ['200 g Spaghetti', '100 g Rote Linsen', '500 g Passierte Tomaten', '2 Karotten', '1 Zwiebel', '1 EL Tomatenmark'],
    ['Zwiebel und Karotten fein würfeln und anschwitzen, Tomatenmark mitrösten.', 'Linsen und Tomaten mit etwas Wasser 20 Minuten köcheln.', 'Mit den Spaghetti servieren.']],
  ['Bananen-Pfannkuchen', ['Frühstück', 'süß'], ['2 Bananen', '3 Eier', '60 g Haferflocken', '10 g Butter'],
    ['Bananen zerdrücken, mit Eiern und Haferflocken verrühren.', 'Kleine Pfannkuchen in Butter von beiden Seiten backen.']],
];

function applyCatalog() {
  CATALOG.forEach(([title, tags, lines, steps]) => {
    const id = 'k-' + slug(title), k = key('recipe', id);
    if (S.records[k]) return;
    const ings = lines.flatMap(parseIngredient).map((p) => {
      const it = matchIngredient(p.name);
      const ing = { item: it ? it.id : null, qty: p.qty, unit: p.unit };
      if (!it || norm(p.name) !== norm(it.name)) ing.label = cap(p.name);
      if (p.note) ing.note = p.note;
      return ing;
    });
    S.records[k] = { kind: 'recipe', id, data: { id, title, servings: 2, ings, steps, tags, url: '', notes: '', catalog: true }, mtime: 0, deleted: false };
  });
}
// Beim Wechsel des Korbs werden die Startdaten neu gesetzt, die Ideen gehören dazu
const _applySeedsBase = applySeeds;
applySeeds = function () { _applySeedsBase(); applyCatalog(); };

// ── Vorschläge aus dem Lager ──
const FRESH_CATS = new Set(['c-obst', 'c-kuehl', 'c-veggie', 'c-brot']);
const BASIC = new Set(['i-salz', 'i-pfeffer', 'i-zucker', 'i-olivenoel', 'i-rapsoel']);
const isBasic = (it) => BASIC.has(it.id) || catOf(it) === 'c-gewuerze';
const isOwn = (r) => !r.catalog || r.saved;

function scoreRecipe(r) {
  const needs = collectNeeds(recipeEntries(r, r.servings)).map(needStatus);
  let tot = 0, got = 0;
  const missing = [], low = [], uses = [];
  for (const n of needs) {
    const it = get('item', n.item);
    const w = isBasic(it) ? 0.2 : 1;
    tot += w;
    if (n.state === 'have') got += w;
    else if (n.state === 'check' || n.state === 'partial') got += w * 0.6;
    if (w === 1 && n.state === 'missing') missing.push(it.name);
    if (w === 1 && n.state === 'partial') low.push(it.name);
    if (w === 1 && n.have && FRESH_CATS.has(catOf(it))) uses.push(it.name);
  }
  const main = needs.filter((n) => !isBasic(get('item', n.item)));
  const haveMain = main.filter((n) => n.state !== 'missing').length;
  const cover = tot ? got / tot : 0;
  let score = cover * 100 + uses.length * 4 - missing.length * 12 - low.length * 4 + (isOwn(r) ? 3 : 0);
  const recent = r.lastCooked && Date.now() - r.lastCooked < 3 * 864e5;
  if (recent) score -= 25;
  return { r, cover, missing, low, uses, score, haveMain, mainTotal: main.length, recent, ready: !missing.length };
}
function suggestions() {
  const all = window.all('recipe').filter((r) => (r.ings || []).length);
  return all.map(scoreRecipe).sort((a, b) => b.score - a.score || a.r.title.localeCompare(b.r.title, 'de'));
}
const stockCount = () => window.all('stock').filter((s) => s.qty > 0).length;

function ideaCard(s) {
  const pct = s.mainTotal ? Math.round((s.haveMain / s.mainTotal) * 100) : 0;
  const what = s.ready ? (s.low.length ? 'Alles da, knapp: ' + s.low.join(', ') : 'Alles da') : 'Es fehlt: ' + s.missing.join(', ');
  return `<li class="idea"><button type="button" data-act="openrecipe" data-id="${esc(s.r.id)}">
    <span class="ihead"><span class="ititle">${esc(s.r.title)}</span>${isOwn(s.r) ? '' : '<span class="tag plain">Idee</span>'}</span>
    <span class="imeter" role="img" aria-label="${s.haveMain} von ${s.mainTotal} Hauptzutaten da"><span style="width:${pct}%"></span></span>
    <span class="iline"><b>${s.haveMain} von ${s.mainTotal} da.</b> ${esc(what)}</span>
    ${s.uses.length ? `<span class="iline muted">Verbraucht: ${esc(s.uses.slice(0, 4).join(', '))}</span>` : ''}
  </button></li>`;
}
function renderIdeas() {
  if (!stockCount()) {
    return `<section class="group ideas"><h2 class="ghead">Was geht heute?</h2>
      <p class="hint lead">Sobald im Zitronenlager etwas steht, schlägt die App hier passende Rezepte vor. Am schnellsten: im Lager-Bereich aufs Mikrofon tippen und aufzählen, was da ist.</p></section>`;
  }
  const list = suggestions().filter((s) => s.missing.length <= 2 && s.cover >= 0.5 && !s.recent);
  const top = list.slice(0, 3);
  return `<section class="group ideas"><h2 class="ghead">Was geht heute?<small>aus eurem Lager</small></h2>
    ${top.length ? `<ul class="ideas-list">${top.map(ideaCard).join('')}</ul>` : '<p class="hint lead">Mit dem, was gerade im Lager ist, passt kein Rezept gut. Unter „Alle Vorschläge“ seht ihr, was am wenigsten fehlt.</p>'}
    <button class="btn more" type="button" data-act="allideas">Alle Vorschläge${list.length > 3 ? ' (' + list.length + ')' : ''}</button>
  </section>`;
}
UI.ideaFilter = 'fast';
function renderAllIdeas() {
  const all = suggestions();
  const f = UI.ideaFilter;
  const list = all.filter((s) => (f === 'sofort' ? s.ready : f === 'fast' ? s.missing.length <= 2 : true));
  const chip = (v, label, n) => `<button class="chip" type="button" data-act="ideafilter" data-v="${v}" aria-pressed="${f === v}">${label} (${n})</button>`;
  $('.sheet-card').innerHTML = `<h2>Vorschläge aus dem Lager</h2>
    <p class="sub">Sortiert danach, wie viel schon da ist und was frisch verbraucht werden kann.</p>
    <div class="chips">${chip('sofort', 'Alles da', all.filter((s) => s.ready).length)}${chip('fast', 'Höchstens 2 fehlen', all.filter((s) => s.missing.length <= 2).length)}${chip('alle', 'Alle', all.length)}</div>
    ${list.length ? `<ul class="ideas-list">${list.map(ideaCard).join('')}</ul>` : '<p class="hint lead">Hier passt gerade nichts. Probier einen anderen Filter.</p>'}
    <div class="actions"><button class="btn quiet" type="button" data-act="close">Schließen</button></div>`;
}

// Rezepte-Bereich: Vorschläge oben, eigene Rezepte unten; Ideen nur in Vorschlägen und Suche
const _renderRecipeListBase = renderRecipeList;
renderRecipeList = function (list) { return _renderRecipeListBase(list.filter(isOwn)); };
renderRezepte = function () { return renderIdeas() + renderWeek() + renderRecipeList(window.all('recipe')); };
VIEWS.rezepte = () => renderRezepte();
const _renderRecipeSearchBase = renderRecipeSearch;
renderRecipeSearch = function () {
  const q = norm(UI.q);
  const ideas = window.all('recipe').filter((r) => !isOwn(r) && q.split(' ').every((w) => norm(r.title + ' ' + (r.tags || []).join(' ') + ' ' + (r.ings || []).map((i) => (get('item', i.item) || {}).name || i.label).join(' ')).includes(w)));
  const own = _renderRecipeSearchBase();
  if (!ideas.length) return own;
  const sc = ideas.map(scoreRecipe).sort((a, b) => b.score - a.score);
  return `<section class="group ideas"><h2 class="ghead">Rezeptideen<small>${ideas.length}</small></h2><ul class="ideas-list">${sc.map(ideaCard).join('')}</ul></section>` + own;
};

// Rezeptansicht: Ideen kennzeichnen und übernehmen können
const _openRecipeBase = openRecipe;
openRecipe = function (id, opts) {
  _openRecipeBase(id, opts);
  const r = get('recipe', id);
  if (!r || isOwn(r)) return;
  const sub = document.querySelector('#sheet .recipe .sub');
  if (sub) sub.insertAdjacentHTML('afterend', `<div class="ideabar"><span>Rezeptidee aus dem Zitronenkorb</span>
    <button class="btn" type="button" data-act="saveidea" data-id="${esc(id)}">In unsere Rezepte</button></div>`);
};

Object.assign(actions, {
  allideas: () => { openSheet('', 'ideas'); renderAllIdeas(); },
  ideafilter: (b) => { UI.ideaFilter = b.dataset.v; renderAllIdeas(); },
  saveidea: (b) => {
    const r = get('recipe', b.dataset.id);
    if (!r) return;
    const undo = tx(() => put('recipe', Object.assign({}, r, { saved: true })));
    openRecipe(r.id, UI.rv && UI.rv.id === r.id ? { serv: UI.rv.serv, date: UI.rv.date, idx: UI.rv.idx } : {});
    toast(r.title + ' steht jetzt bei euren Rezepten', undo);
  },
});

applyCatalog();
save();
render();
