'use strict';
/* Zitronenkorb – Rezepte und Wochenplan
   Baut auf app.js auf (Datensätze, Lager, Liste, Dialoge). */

// ── Zutatenzeilen verstehen ──
const RECIPE_UNITS = Object.assign({}, UNIT_ALIASES, {
  el: 'EL', essl: 'EL', essloeffel: 'EL', tl: 'TL', teel: 'TL', teeloeffel: 'TL', prise: 'Prise', prisen: 'Prise',
  msp: 'Msp', messerspitze: 'Msp', zehe: 'Zehe', zehen: 'Zehe', scheibe: 'Scheibe', scheiben: 'Scheibe',
  handvoll: 'Handvoll', tasse: 'Tasse', tassen: 'Tasse', pkt: 'Pck', zweig: 'Zweig', zweige: 'Zweig',
  blatt: 'Blatt', blaetter: 'Blatt', kopf: 'Kopf', koepfe: 'Kopf', knolle: 'Stk', knollen: 'Stk',
  schuss: 'Schuss', spritzer: 'Spritzer', stange: 'Stange', stangen: 'Stange', wuerfel: 'Würfel',
});
const PURCHASE = new Set(window.ZK_UNITS);
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const ING_ALIAS = { ei: 'Eier', knoblauchzehe: 'Knoblauch', knoblauchzehen: 'Knoblauch', zwiebel: 'Zwiebeln', karotte: 'Karotten', moehre: 'Karotten', moehren: 'Karotten', kartoffel: 'Kartoffeln', tomate: 'Tomaten', zitrone: 'Zitronen', banane: 'Bananen', apfel: 'Äpfel', oel: 'Olivenöl' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function parseIngredient(raw) {
  let s = String(raw || '').trim().replace(/^[-•*·–]\s*/, '').replace(/\s+/g, ' ');
  if (!s) return [];
  s = s.replace(/(\d+)\s*([½¼¾⅓⅔⅛])/g, (m, a, b) => String(+a + FRAC[b])).replace(/[½¼¾⅓⅔⅛]/g, (c) => String(FRAC[c]));
  s = s.replace(/(\d+)\s+(\d+)\/(\d+)/g, (m, a, b, c) => String(+a + b / c)).replace(/(\d+)\/(\d+)/g, (m, a, b) => String(a / b));
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*(?:-|–|bis)\s*(\d+(?:[.,]\d+)?)/g, (m, a, b) => b); // Spanne → obere Grenze
  s = s.replace(/\((?:n|e|s|en|er|nen|ns)\)/gi, '').replace(/\s+/g, ' ').trim(); // Chefkoch-Plural: Zwiebel(n)
  let note = '';
  const par = s.match(/\(([^)]*)\)/);
  if (par) { note = par[1].trim(); s = s.replace(par[0], ' ').replace(/\s+/g, ' ').trim(); }
  let qty = null, unit = null, rest = s, m;
  if ((m = rest.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/))) { qty = parseNum(m[1]); rest = m[2]; }
  if ((m = rest.match(/^([A-Za-zÄÖÜäöüß]+\.?)\s+(.+)$/))) {
    const u = RECIPE_UNITS[fold(m[1]).replace(/\.$/, '')];
    if (u) { unit = u; rest = m[2]; }
  }
  rest = rest.replace(/^(etwas|ein wenig|eine? prise|einige|frische[rsn]?|evtl\.?)\s+/i, (x) => (/prise/i.test(x) && !unit ? (unit = 'Prise', qty = qty || 1, '') : ''));
  const ci = rest.indexOf(',');
  if (ci > 0) { note = [rest.slice(ci + 1).trim(), note].filter(Boolean).join(', '); rest = rest.slice(0, ci).trim(); }
  const extra = rest.match(/\s(n\.?\s?B\.?|nach Bedarf|nach Geschmack|zum \w+|für \w+)$/i);
  if (extra) { note = [extra[1], note].filter(Boolean).join(', '); rest = rest.slice(0, extra.index).trim(); }
  rest = rest.replace(/^(von|vom|der|die|das)\s+/i, '').trim();
  if (!rest) return [];
  if (qty == null && unit) qty = 1;
  if (qty == null && / und /i.test(rest)) return rest.split(/ und /i).map((x) => ({ name: x.trim(), qty: null, unit: null, note }));
  return [{ name: rest, qty: qty > 0 ? qty : null, unit: qty > 0 ? (unit || 'Stk') : unit, note }];
}

const stemWord = (w) => w.replace(/(en|n|e|s)$/, '');
function matchIngredient(name) {
  const n = norm(name);
  if (!n) return null;
  if (ING_ALIAS[n]) { const f = findItem(ING_ALIAS[n]); if (f) return f; }
  const exact = findItem(name);
  if (exact) return exact;
  const words = new Set(n.split(' ').map(stemWord));
  let best = null, bestLen = 0;
  for (const it of items()) {
    const nn = norm(it.name), iw = nn.split(' ').map(stemWord);
    if (iw.every((w) => words.has(w)) && nn.length > bestLen) { best = it; bestLen = nn.length; }
  }
  if (best) return best;
  for (const w of n.split(' ')) { if (ING_ALIAS[w]) { const f = findItem(ING_ALIAS[w]); if (f) return f; } }
  // Zusammengesetzte Wörter: „Cherrytomate“ → Tomaten, „Weizenmehl“ → Mehl, „Schlagsahne“ → Sahne
  const last = stemWord(n.split(' ').pop() || '');
  for (const it of items()) {
    const nn = norm(it.name);
    if (nn.includes(' ')) continue;
    const st = stemWord(nn);
    if (st.length >= 4 && last.length > st.length && last.endsWith(st) && nn.length > bestLen) { best = it; bestLen = nn.length; }
  }
  return best;
}

const MEAT = 'fleisch speck schinken wurst salami chorizo huhn haehnchen huehner pute truthahn rind schwein lamm kalb ente gans wild reh hirsch fisch lachs thunfisch forelle kabeljau garnele shrimp krabbe scampi sardelle anchovis sardine muschel tintenfisch gelatine aspik bacon pancetta prosciutto mortadella leberkaese hackfleisch'.split(' ');
const VEG_OK = ['veggie', 'vegan', 'vegetar', 'soja', 'tofu', 'pflanz', 'seitan', 'fleischlos', 'ohne fleisch', 'agar'];
function vegFlags(names) {
  return names.filter((x) => { const f = fold(x); return MEAT.some((w) => f.includes(w)) && !VEG_OK.some((w) => f.includes(w)); });
}

// ── Bedarf gegen Lager und Liste ──
function roundUp(q, unit) {
  if (unit === 'g' || unit === 'ml') return Math.ceil(q / 10) * 10;
  if (unit === 'kg' || unit === 'l') return Math.ceil(q * 10) / 10;
  return Math.ceil(q - 1e-9);
}
// Zutaten mehrerer Rezepte pro Artikel zusammenfassen
function collectNeeds(entries) {
  const by = new Map();
  for (const e of entries) {
    if (!get('item', e.item)) continue;
    const cur = by.get(e.item);
    if (!cur) { by.set(e.item, { item: e.item, qty: e.qty, unit: e.unit, mixed: false }); continue; }
    if (e.qty == null) continue;
    if (cur.qty == null) { cur.qty = e.qty; cur.unit = e.unit; continue; }
    const c = convert(e.qty, e.unit, cur.unit);
    if (c != null) cur.qty = round3(cur.qty + c); else cur.mixed = true;
  }
  return [...by.values()];
}
function needStatus(n) {
  const item = get('item', n.item), s = get('stock', n.item), e = listOpen(n.item);
  const r = Object.assign({}, n, { name: item.name, have: s && s.qty > 0 ? s : null, onList: e, missing: null });
  if (r.have) {
    if (n.qty == null || n.mixed) r.state = 'have';
    else {
      const h = convert(r.have.qty, r.have.unit, n.unit);
      if (h == null) r.state = 'check';
      else if (h >= n.qty - 1e-9) r.state = 'have';
      else { r.state = 'partial'; r.missing = round3(n.qty - h); }
    }
  } else { r.state = 'missing'; r.missing = n.qty; }
  // Einkaufsmenge: fehlende Menge, wenn sie sich kaufen lässt, sonst die übliche Einkaufsmenge
  const m = r.missing;
  if (m != null && !n.mixed && PURCHASE.has(n.unit)) { r.buyQty = roundUp(m, n.unit); r.buyUnit = n.unit; }
  else { r.buyQty = item.qty; r.buyUnit = item.unit; }
  if (e) { const c = convert(r.buyQty, r.buyUnit, e.unit); r.covered = c == null || e.qty >= c - 1e-9; }
  r.pick = (r.state === 'missing' || r.state === 'partial') && !r.covered;
  return r;
}
function recipeEntries(r, serv) {
  const f = serv / (r.servings || 1);
  return (r.ings || []).map((i) => ({ item: i.item, qty: i.qty > 0 ? round3(i.qty * f) : null, unit: i.unit }));
}
function recipeSummary(r) {
  const st = collectNeeds(recipeEntries(r, r.servings)).map(needStatus);
  const miss = st.filter((x) => x.state === 'missing' || x.state === 'partial').length;
  return { miss, total: st.length };
}

// ── Kochen: Zutaten aus dem Lager abziehen ──
function cook(recipeId, serv, date, idx) {
  const r = get('recipe', recipeId);
  if (!r) return;
  const f = serv / (r.servings || 1);
  let used = 0, skipped = 0; const auto = [];
  const undo = tx(() => {
    for (const ing of r.ings || []) {
      if (!(ing.qty > 0) || !get('item', ing.item)) { skipped++; continue; }
      const s = get('stock', ing.item);
      if (!s || !(s.qty > 0)) { skipped++; continue; }
      const c = convert(ing.qty * f, ing.unit, s.unit);
      if (c == null) { skipped++; continue; }
      const ns = Object.assign({}, s, { qty: Math.max(0, round3(s.qty - c)), at: Date.now() });
      put('stock', ns); used++;
      if (isLow(ns) && !isLow(s) && !listOpen(ing.item)) {
        const it = get('item', ing.item);
        put('list', { id: ing.item, qty: it.qty, unit: it.unit, checked: false, at: Date.now(), auto: true });
        auto.push(it.name);
      }
    }
    if (date != null) {
      const p = get('plan', date);
      if (p && p.meals[idx]) { const meals = p.meals.slice(); meals[idx] = Object.assign({}, meals[idx], { done: true }); put('plan', Object.assign({}, p, { meals })); }
    }
    put('recipe', Object.assign({}, r, { cooked: (r.cooked || 0) + 1, lastCooked: Date.now() }));
  });
  let msg = 'Guten Appetit! ' + (used ? used + (used === 1 ? ' Zutat' : ' Zutaten') + ' aus dem Lager abgezogen.' : 'Im Lager war nichts abzuziehen.');
  if (auto.length) msg += ' Knapp und auf der Liste: ' + auto.join(', ') + '.';
  toast(msg, undo);
}

// ── Wochenplan ──
const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
function fromIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function weekDays(offset) {
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}
const dayLabel = (s) => { const d = fromIso(s); return DAYS_LONG[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS[d.getMonth()]; };
const mealsOf = (date) => ((get('plan', date) || {}).meals || []);
function addMeal(date, recipeId, serv) {
  const p = get('plan', date) || { id: date, meals: [] };
  const undo = tx(() => put('plan', Object.assign({}, p, { meals: p.meals.concat([{ r: recipeId, s: serv, done: false }]) })));
  const r = get('recipe', recipeId);
  toast((r ? r.title : 'Rezept') + ' für ' + dayLabel(date) + ' eingeplant', undo);
}
function removeMeal(date, idx) {
  const p = get('plan', date);
  if (!p) return;
  const undo = tx(() => put('plan', Object.assign({}, p, { meals: p.meals.filter((_, i) => i !== idx) })));
  toast('Aus dem Wochenplan genommen', undo);
}

// ── Darstellung: Bereich Rezepte ──
UI.week = 0;
UI.rv = null;
function renderRezepte() { return renderWeek() + renderRecipeList(all('recipe')); }

function renderWeek() {
  const days = weekDays(UI.week);
  const first = days[0], last = days[6], today = isoDay(new Date());
  const range = first.getDate() + '.' + (first.getMonth() !== last.getMonth() ? ' ' + MONTHS[first.getMonth()] : '') + '–' + last.getDate() + '. ' + MONTHS[last.getMonth()];
  const label = UI.week === 0 ? 'Diese Woche' : UI.week === 1 ? 'Nächste Woche' : UI.week === -1 ? 'Letzte Woche' : range;
  let open = 0;
  const rows = days.map((d) => {
    const iso = isoDay(d);
    const meals = mealsOf(iso).map((m, i) => ({ m, i, r: get('recipe', m.r) })).filter((x) => x.r);
    open += meals.filter((x) => !x.m.done).length;
    return `<li class="day${iso === today ? ' today' : ''}">
      <span class="dname">${DAYS[d.getDay()]}<small>${d.getDate()}.${d.getMonth() + 1}.</small></span>
      <span class="meals">${meals.map((x) => `<button class="meal${x.m.done ? ' done' : ''}" type="button" data-act="openmeal" data-date="${iso}" data-i="${x.i}">${esc(x.r.title)}</button>`).join('') || '<span class="none"></span>'}</span>
      <button class="pm" type="button" data-act="addmeal" data-date="${iso}" aria-label="Rezept für ${esc(dayLabel(iso))} einplanen">+</button>
    </li>`;
  }).join('');
  return `<section class="group week">
    <h2 class="ghead">Wochenplan<small>${esc(range)}</small></h2>
    <div class="weeknav">
      <button class="pm" type="button" data-act="wk" data-d="-1" aria-label="Vorherige Woche">‹</button>
      <span>${esc(label)}</span>
      <button class="pm" type="button" data-act="wk" data-d="1" aria-label="Nächste Woche">›</button>
    </div>
    <ul class="days">${rows}</ul>
    ${open ? `<button class="finish" type="button" data-act="weekshop">Fehlendes für ${UI.week === 0 ? 'diese' : 'die'} Woche auf die Liste</button>` : ''}
  </section>`;
}

function recipeRow(r) {
  const s = recipeSummary(r);
  const status = !s.total ? '' : s.miss ? `<span class="tag list">${s.miss} ${s.miss === 1 ? 'Zutat fehlt' : 'Zutaten fehlen'}</span>` : '<span class="tag stock">alles im Lager</span>';
  const tags = (r.tags || []).slice(0, 3).map((t) => `<span class="tag plain">${esc(t)}</span>`).join('');
  return `<li class="row"><button class="main" type="button" data-act="openrecipe" data-id="${esc(r.id)}">
    <span class="stack"><span class="name">${esc(r.title)}</span><span class="tags">${status}${tags}</span></span>
    <span class="amt">${r.servings} P.</span></button></li>`;
}
function renderRecipeList(list) {
  const rs = list.slice().sort((a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }));
  let h = `<section class="group"><h2 class="ghead">Rezepte<small>${rs.length || ''}</small></h2>`;
  if (!rs.length) h += `<div class="empty"><p>Noch keine Rezepte. Leg euer erstes an: Zutaten einfach Zeile für Zeile eintippen oder hineinkopieren, die App ordnet sie dem Fundus zu.</p></div>`;
  else h += `<ul class="rows">${rs.map(recipeRow).join('')}</ul>`;
  h += `</section><button class="create" type="button" data-act="importrecipe"><b>Rezept aus Link importieren</b><span>Chefkoch, gutekueche.at und viele andere Rezeptseiten.</span></button><button class="create" type="button" data-act="newrecipe"><b>Neues Rezept anlegen</b><span>Titel, Portionen, Zutaten und Zubereitung.</span></button>`;
  return h;
}
function renderRecipeSearch() {
  const q = norm(UI.q);
  const hits = all('recipe').filter((r) => {
    const hay = norm([r.title, (r.tags || []).join(' '), (r.ings || []).map((i) => (get('item', i.item) || {}).name || i.label).join(' ')].join(' '));
    return q.split(' ').every((w) => hay.includes(w));
  });
  let h = hits.length ? renderRecipeList(hits).replace(/<button class="create"[\s\S]*$/, '') : '';
  h += `<button class="create" type="button" data-act="newrecipe" data-title="${esc(UI.q.trim())}"><b>„${esc(UI.q.trim())}“ als neues Rezept anlegen</b><span>Danach Zutaten und Zubereitung eintragen.</span></button>`;
  return h;
}

// ── Rezeptansicht ──
function statusTag(x) {
  if (x.state === 'have') return `<span class="tag stock">im Lager${x.have ? ': ' + esc(fmtAmt(x.have.qty, x.have.unit)) : ''}</span>`;
  if (x.state === 'check') return `<span class="tag stock">im Lager: ${esc(fmtAmt(x.have.qty, x.have.unit))}, Menge prüfen</span>`;
  if (x.covered) return `<span class="tag list">steht auf der Liste</span>`;
  if (x.state === 'partial') return `<span class="tag list">im Lager: ${esc(fmtAmt(x.have.qty, x.have.unit))}, es fehlen ${esc(fmtAmt(x.missing, x.unit))}</span>`;
  return '<span class="tag list">fehlt</span>';
}
function openRecipe(id, opts = {}) {
  const r = get('recipe', id);
  if (!r) return;
  const serv = opts.serv || (UI.rv && UI.rv.id === id ? UI.rv.serv : r.servings);
  UI.rv = { id, serv, date: opts.date != null ? opts.date : null, idx: opts.idx != null ? opts.idx : null };
  const f = serv / (r.servings || 1);
  const flags = vegFlags((r.ings || []).map((i) => i.label || (get('item', i.item) || {}).name || ''));
  const st = new Map(collectNeeds(recipeEntries(r, serv)).map(needStatus).map((x) => [x.item, x]));
  const miss = [...st.values()].filter((x) => x.pick).length;
  const ingRows = (r.ings || []).map((i) => {
    const it = get('item', i.item);
    const name = i.label || (it ? it.name : '?');
    const amount = i.qty > 0 ? fmtAmt(round3(i.qty * f), i.unit) : '';
    const x = st.get(i.item);
    return `<li class="row ing"><span class="amt lead">${esc(amount)}</span><span class="stack"><span class="name">${esc(name)}${i.note ? ' <small class="note">' + esc(i.note) + '</small>' : ''}</span>${x ? '<span class="tags">' + statusTag(x) + '</span>' : ''}</span></li>`;
  }).join('');
  const steps = (r.steps || []).map((s) => `<li>${esc(s)}</li>`).join('');
  const planned = UI.rv.date != null ? mealsOf(UI.rv.date)[UI.rv.idx] : null;
  openSheet(`<div class="recipe">
    <h2>${esc(r.title)}</h2>
    <p class="sub">${(r.tags || []).map(esc).join(', ')}${r.cooked ? (r.tags && r.tags.length ? '. ' : '') + r.cooked + '× gekocht' : ''}</p>
    ${planned ? `<p class="plannote">Eingeplant für ${esc(dayLabel(UI.rv.date))}${planned.done ? ', schon gekocht' : ''}.</p>` : ''}
    ${flags.length ? `<p class="vegwarn">Achtung, vermutlich nicht vegetarisch: ${flags.map(esc).join(', ')}</p>` : ''}
    <div class="servrow"><span>Portionen</span>
      <div class="stepper small"><button type="button" data-act="rserv" data-d="-1" aria-label="weniger Portionen">−</button>
      <output>${fmtQty(serv)}</output><button type="button" data-act="rserv" data-d="1" aria-label="mehr Portionen">+</button></div></div>
    <h3>Zutaten</h3>
    <ul class="rows ings">${ingRows}</ul>
    <div class="actions two">
      <button class="btn primary" type="button" data-act="recipeshop">${miss ? 'Fehlendes auf die Liste' : 'Zutaten auf die Liste'}</button>
      <button class="btn" type="button" data-act="${planned ? 'unplan' : 'planrecipe'}">${planned ? 'Aus dem Plan nehmen' : 'Einplanen'}</button>
    </div>
    <div class="actions"><button class="btn lemon" type="button" data-act="cook">Gekocht: Zutaten aus dem Lager abziehen</button></div>
    ${steps ? `<h3>Zubereitung</h3><ol class="steps">${steps}</ol>` : ''}
    ${r.notes ? `<h3>Notizen</h3><p class="notes">${esc(r.notes)}</p>` : ''}
    ${r.url ? `<p class="source"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Originalrezept öffnen</a></p>` : ''}
    <div class="actions"><button class="btn quiet" type="button" data-act="editrecipe" data-id="${esc(id)}">Rezept bearbeiten</button></div>
  </div>`, 'recipe');
}

// ── Rezept-Editor ──
function ingLine(i) {
  const it = get('item', i.item);
  const name = i.label || (it ? it.name : '');
  return [i.qty > 0 ? fmtQty(i.qty) + ' ' + (i.unit || '') : '', name].join(' ').trim() + (i.note ? ', ' + i.note : '');
}
function openRecipeEditor(id, preset = {}) {
  const r = id ? get('recipe', id) : null;
  const d = r || { title: preset.title || '', servings: preset.servings || 2, ings: [], steps: preset.steps || [], url: preset.url || '', tags: preset.tags || [], notes: '' };
  openSheet(`<h2>${r ? 'Rezept bearbeiten' : 'Neues Rezept'}</h2>
    ${preset.banner ? `<p class="importnote">${esc(preset.banner)}</p>` : ''}
    <label class="field"><span>Titel</span><input id="fTitle" class="text" value="${esc(d.title)}" maxlength="80" autocomplete="off"></label>
    <div class="field"><span>Portionen</span>${stepper(d.servings)}</div>
    <label class="field"><span>Zutaten, eine pro Zeile</span>
      <textarea id="fIngs" class="text area" rows="8" placeholder="500 g Spaghetti&#10;2 Zwiebeln&#10;3 EL Olivenöl&#10;1 Bio-Zitrone, Abrieb&#10;Salz und Pfeffer">${esc(r ? (d.ings || []).map(ingLine).join('\n') : (preset.ingsText || ''))}</textarea></label>
    <div id="ingPrev" class="ingprev" aria-live="polite"></div>
    <label class="field"><span>Zubereitung, ein Schritt pro Zeile</span>
      <textarea id="fSteps" class="text area" rows="6">${esc((d.steps || []).join('\n'))}</textarea></label>
    <label class="field"><span>Link zum Original (optional)</span><input id="fUrl" class="text" inputmode="url" value="${esc(d.url || '')}" placeholder="https://…" autocomplete="off"></label>
    <label class="field"><span>Schlagwörter, mit Komma getrennt (optional)</span><input id="fTags" class="text" value="${esc((d.tags || []).join(', '))}" placeholder="schnell, Pasta, Sommer" autocomplete="off"></label>
    <label class="field"><span>Notizen (optional)</span><textarea id="fNotes" class="text area" rows="3">${esc(d.notes || '')}</textarea></label>
    <p class="err" id="fErr" hidden></p>
    <div class="actions">
      <button class="btn primary" type="button" data-act="saverecipe" data-id="${esc(id || '')}">Speichern</button>
      ${r ? `<button class="btn danger" type="button" data-act="delrecipe" data-id="${esc(id)}">Rezept löschen</button>` : ''}
    </div>`, 'recipeedit');
  updateIngPreview();
  if (preset.focusIngs) { const t = $('#fIngs'); if (t) t.focus(); }
  else if (!r && !d.title) { const t = $('#fTitle'); if (t) t.focus(); }
}
function parsedIngs() {
  const el = $('#fIngs');
  return el ? el.value.split('\n').flatMap(parseIngredient) : [];
}
function updateIngPreview() {
  const box = $('#ingPrev');
  if (!box) return;
  const ps = parsedIngs();
  if (!ps.length) { box.innerHTML = ''; return; }
  const flags = vegFlags(ps.map((p) => p.name));
  box.innerHTML = `<p class="prevhead">So versteht die App die Zutaten:</p><ul>${ps.map((p) => {
    const it = matchIngredient(p.name);
    const tag = it ? (norm(it.name) === norm(p.name) ? '<span class="tag stock">im Fundus</span>' : `<span class="tag stock">als ${esc(it.name)}</span>`) : `<span class="tag list">neu: ${esc(catName(guessCat(p.name)))}</span>`;
    return `<li><span class="amt">${p.qty ? esc(fmtAmt(p.qty, p.unit)) : 'ohne Menge'}</span><span>${esc(p.name)}${p.note ? ' <small class="note">' + esc(p.note) + '</small>' : ''} ${tag}</span></li>`;
  }).join('')}</ul>${flags.length ? `<p class="vegwarn">Achtung, vermutlich nicht vegetarisch: ${flags.map(esc).join(', ')}</p>` : ''}`;
}
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'fIngs') updateIngPreview(); });

// ── Einkaufsdialog: Fehlendes auf die Liste ──
function openShop(title, entries) {
  const rows = collectNeeds(entries).map(needStatus).sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
  UI.shop = rows;
  if (!rows.length) { toast('Keine Zutaten mit Fundus-Artikeln gefunden'); return; }
  openSheet(`<h2>${esc(title)}</h2>
    <p class="sub">Vorausgewählt ist, was im Zitronenlager fehlt. Tippe auf die Zitrone, um etwas dazu- oder abzuwählen.</p>
    <ul class="rows shop">${rows.map((x, i) => `<li class="row">
      <button class="check" type="button" data-act="shoptoggle" data-i="${i}" aria-pressed="${x.pick}" aria-label="${esc(x.name)} ${x.pick ? 'abwählen' : 'auswählen'}">${SLICE.replace('class="slice"', 'class="slice' + (x.pick ? ' on' : '') + '"')}</button>
      <span class="main static"><span class="stack"><span class="name">${esc(x.name)}</span><span class="tags">${statusTag(x)}</span></span>
      <span class="amt">${esc(fmtAmt(x.buyQty, x.buyUnit))}</span></span></li>`).join('')}</ul>
    <div class="actions"><button class="btn primary" type="button" data-act="shopgo" id="shopGo"></button>
      <button class="btn quiet" type="button" data-act="${UI.rv ? 'backrecipe' : 'close'}">Zurück</button></div>`, 'shop');
  updateShopButton();
}
function updateShopButton() {
  const n = (UI.shop || []).filter((x) => x.pick).length;
  const b = $('#shopGo');
  if (b) { b.textContent = n ? n + (n === 1 ? ' Zutat' : ' Zutaten') + ' auf die Liste' : 'Nichts ausgewählt'; b.disabled = !n; }
}

// ── Aktionen ──
Object.assign(actions, {
  wk: (b) => { UI.week += Number(b.dataset.d); render(); },
  newrecipe: (b) => { const t = b.dataset.title || ''; if (UI.q) { UI.q = ''; $('#q').value = ''; render(); } openRecipeEditor(null, { title: t ? cap(t) : '' }); },
  openrecipe: (b) => { UI.rv = null; openRecipe(b.dataset.id); },
  backrecipe: () => { if (UI.rv) openRecipe(UI.rv.id, { serv: UI.rv.serv, date: UI.rv.date, idx: UI.rv.idx }); else closeSheet(); },
  editrecipe: (b) => openRecipeEditor(b.dataset.id),
  openmeal: (b) => {
    const m = mealsOf(b.dataset.date)[Number(b.dataset.i)];
    if (m) { UI.rv = null; openRecipe(m.r, { serv: m.s, date: b.dataset.date, idx: Number(b.dataset.i) }); }
  },
  rserv: (b) => {
    const v = UI.rv; if (!v) return;
    const card = $('.sheet-card'), top = card.scrollTop;
    openRecipe(v.id, { serv: Math.max(1, v.serv + Number(b.dataset.d)), date: v.date, idx: v.idx });
    $('.sheet-card').scrollTop = top;
  },
  recipeshop: () => {
    const v = UI.rv, r = v && get('recipe', v.id);
    if (r) openShop('Zutaten für ' + r.title, recipeEntries(r, v.serv));
  },
  weekshop: () => {
    UI.rv = null;
    const entries = [];
    weekDays(UI.week).forEach((d) => mealsOf(isoDay(d)).forEach((m) => {
      const r = get('recipe', m.r);
      if (r && !m.done) entries.push(...recipeEntries(r, m.s));
    }));
    openShop('Einkauf für die Woche', entries);
  },
  shoptoggle: (b) => {
    const x = UI.shop && UI.shop[Number(b.dataset.i)];
    if (!x) return;
    x.pick = !x.pick;
    b.setAttribute('aria-pressed', String(x.pick));
    b.setAttribute('aria-label', x.name + (x.pick ? ' abwählen' : ' auswählen'));
    const sv = b.querySelector('.slice'); if (sv) sv.classList.toggle('on', x.pick);
    updateShopButton();
  },
  shopgo: () => {
    const picked = (UI.shop || []).filter((x) => x.pick);
    if (!picked.length) return;
    closeSheet();
    const undo = tx(() => picked.forEach((x) => addToList(x.item, x.buyQty, x.buyUnit, { silent: true })));
    toast(picked.length + (picked.length === 1 ? ' Zutat steht' : ' Zutaten stehen') + ' jetzt auf der Liste', undo);
  },
  cook: () => { const v = UI.rv; if (!v) return; closeSheet(); cook(v.id, v.serv, v.date, v.idx); },
  planrecipe: () => {
    const v = UI.rv; if (!v) return;
    const r = get('recipe', v.id);
    const days = weekDays(UI.week).concat(weekDays(UI.week + 1)).filter((d) => isoDay(d) >= isoDay(new Date()));
    openSheet(`<h2>${esc(r.title)} einplanen</h2><p class="sub">Für ${fmtQty(v.serv)} Portionen. An welchem Tag?</p>
      <div class="chips daychips">${days.map((d) => `<button class="chip" type="button" data-act="plando" data-date="${isoDay(d)}">${DAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.</button>`).join('')}</div>
      <div class="actions"><button class="btn quiet" type="button" data-act="backrecipe">Zurück</button></div>`, 'plan');
  },
  plando: (b) => { const v = UI.rv; if (!v) return; closeSheet(); addMeal(b.dataset.date, v.id, v.serv); },
  unplan: () => { const v = UI.rv; if (!v || v.date == null) return; closeSheet(); removeMeal(v.date, v.idx); },
  addmeal: (b) => {
    const date = b.dataset.date;
    const own = (x) => typeof isOwn !== 'function' || isOwn(x);
    const rs = all('recipe').sort((a, c) => (own(c) - own(a)) || a.title.localeCompare(c.title, 'de', { sensitivity: 'base' }));
    UI.rv = null;
    openSheet(`<h2>${esc(dayLabel(date))}</h2><p class="sub">Welches Rezept?</p>
      ${rs.length ? `<ul class="rows">${rs.map((r) => `<li class="row"><button class="main" type="button" data-act="pickmeal" data-date="${date}" data-id="${esc(r.id)}"><span class="name">${esc(r.title)}${own(r) ? '' : ' <span class="tag plain">Idee</span>'}</span><span class="amt">${r.servings} P.</span></button></li>`).join('')}</ul>`
      : '<p>Noch keine Rezepte vorhanden.</p>'}
      <div class="actions"><button class="btn" type="button" data-act="newrecipe">Neues Rezept anlegen</button><button class="btn quiet" type="button" data-act="close">Abbrechen</button></div>`, 'pickmeal');
  },
  pickmeal: (b) => { const r = get('recipe', b.dataset.id); closeSheet(); if (r) addMeal(b.dataset.date, r.id, r.servings); },
  saverecipe: (b) => {
    const title = $('#fTitle').value.trim().replace(/\s+/g, ' ');
    const serv = readQty();
    const ps = parsedIngs();
    const url = $('#fUrl').value.trim();
    if (!title) return showErr('Bitte einen Titel eingeben.');
    if (!(serv > 0)) return showErr('Bitte die Portionen angeben.');
    if (!ps.length) return showErr('Bitte mindestens eine Zutat eintragen.');
    if (url && !/^https?:\/\/\S+$/i.test(url)) return showErr('Der Link muss mit https:// beginnen.');
    const steps = $('#fSteps').value.split('\n').map((s) => s.trim()).filter(Boolean);
    const tags = $('#fTags').value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8);
    const notes = $('#fNotes').value.trim();
    const id = b.dataset.id || 'r-' + rid(10);
    const old = get('recipe', id) || {};
    let created = 0;
    tx(() => {
      const ings = ps.map((p) => {
        let it = matchIngredient(p.name);
        if (!it) {
          const buy = p.qty && PURCHASE.has(p.unit);
          it = { id: 'u-' + rid(10), name: cap(p.name), cat: guessCat(p.name), qty: buy ? p.qty : 1, unit: buy ? p.unit : 'Stk', uses: 0, created: Date.now() };
          put('item', it); created++;
        }
        const ing = { item: it.id, qty: p.qty, unit: p.unit };
        if (norm(p.name) !== norm(it.name)) ing.label = cap(p.name);
        if (p.note) ing.note = p.note;
        return ing;
      });
      put('recipe', Object.assign({}, old, { id, title, servings: serv, ings, steps, url, tags, notes, created: old.created || Date.now() }, old.catalog ? { saved: true } : {}));
    });
    UI.rv = null;
    openRecipe(id);
    toast('Rezept gespeichert' + (created ? ', ' + created + (created === 1 ? ' neuer Artikel' : ' neue Artikel') + ' im Fundus' : ''));
  },
  delrecipe: (b) => {
    const r = get('recipe', b.dataset.id);
    closeSheet();
    const undo = tx(() => del('recipe', b.dataset.id));
    toast((r ? r.title : 'Rezept') + ' gelöscht', undo);
  },
});

VIEWS.rezepte = () => renderRezepte();
TAB_PH.rezepte = 'Rezepte suchen oder anlegen';
render();
