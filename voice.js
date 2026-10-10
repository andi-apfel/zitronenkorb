'use strict';
/* Zitronenkorb – Erfassen per Sprache
   Frei gesprochener Text („Im Lager haben wir zwei Liter Milch, wir brauchen Butter“) wird in Artikel zerlegt.
   Diktiert wird über das Mikrofon der iPhone-Tastatur oder, wo verfügbar, über die Spracherkennung des Browsers. */

// zusätzliche gesprochene Einheiten
Object.assign(UNIT_ALIASES, { milliliter: 'ml', kilogramm: 'kg', stuecke: 'Stk', stueckchen: 'Stk', packerl: 'Pck', packungen: 'Pck', netz: 'Pck', kisten: 'Pck', kiste: 'Pck', beutel: 'Pck', tueten: 'Pck', tuete: 'Pck' });
const VOICE_ALIAS = { klopapier: 'Toilettenpapier', spueli: 'Spülmittel', haferdrink: 'Hafermilch', spuelmaschinentabs: 'Spülmaschinentabs', tabs: 'Spülmaschinentabs', kartoffel: 'Kartoffeln', zwiebel: 'Zwiebeln', zitrone: 'Zitronen', ei: 'Eier', toast: 'Toastbrot' };

// ── Zahlwörter ──
const NUM_ONES = { null: 0, ein: 1, eins: 1, eine: 1, einen: 1, einem: 1, einer: 1, eines: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwoelf: 12, dreizehn: 13, vierzehn: 14, fuenfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, dutzend: 12 };
const NUM_TENS = { zwanzig: 20, dreissig: 30, vierzig: 40, fuenfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90 };
function germanNum(w) {
  if (!w) return null;
  if (w in NUM_ONES) return NUM_ONES[w];
  if (w in NUM_TENS) return NUM_TENS[w];
  let m;
  if ((m = w.match(/^(.*)einhalb$/)) && m[1]) { const a = germanNum(m[1]); return a != null ? a + 0.5 : null; }
  if ((m = w.match(/^(.*)tausend(.*)$/))) { const a = m[1] ? germanNum(m[1]) : 1, b = m[2] ? germanNum(m[2]) : 0; return a != null && b != null ? a * 1000 + b : null; }
  if ((m = w.match(/^(.*)hundert(.*)$/))) { const a = m[1] ? germanNum(m[1]) : 1, b = m[2] ? germanNum(m[2]) : 0; return a != null && b != null && a < 10 ? a * 100 + b : null; }
  if ((m = w.match(/^(.+?)und(.+)$/))) { const a = germanNum(m[1]), b = NUM_TENS[m[2]]; if (a != null && a < 10 && b) return a + b; }
  return null;
}
// Zahlwörter in einer Wortfolge durch Ziffern ersetzen
function numberize(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i], n = tokens[i + 1] || '';
    if (/^(anderthalb|eineinhalb)$/.test(t)) { out.push('1.5'); continue; }
    if (/^(ein|eine|einen|einem|einer|eines)$/.test(t) && /^halbe?[nrs]?$/.test(n)) { out.push('0.5'); i++; continue; }
    if (/^halbe?[nrs]?$/.test(t)) { out.push('0.5'); continue; }
    if (/^(ein|eine|einen)$/.test(t) && /^viertel$/.test(n)) { out.push('0.25'); i++; continue; }
    if (t === 'dreiviertel') { out.push('0.75'); continue; }
    if (/^(ein|eine|einen)$/.test(t) && /^(paar|bisschen|wenig|wenige)$/.test(n)) { i++; continue; }
    if (/^(paar|bisschen|etwas)$/.test(t)) continue;
    if (/^\d+([.,]\d+)?$/.test(t)) { out.push(t.replace(',', '.')); continue; }
    const v = germanNum(t);
    out.push(v != null ? String(v) : t);
  }
  return out;
}

// ── Satzteile, Absicht und Füllwörter ──
const RE_LIST = /\b(brauche|brauchen|braucht|benoetigen|kaufen|einkaufen|besorgen|holen|einkaufsliste|liste|fehlt|fehlen|nachkaufen|mitbringen)\b/;
const RE_STOCK = /\b(lager|haben wir|wir haben|hab ich|habe ich|haben noch|noch da|vorhanden|vorrat|vorraetig|kuehlschrank|schrank|tiefkuehler|gefrierschrank|daheim|zuhause|zu hause|gibt es noch|ist noch|sind noch)\b/;
const RE_EMPTY = /\b(alle|leer|aufgebraucht|ausgegangen|verbraucht)\b|\bkeine?[nrs]?\b.*\bmehr\b/;
const STOP = new Set(('im in auf an der die das dem den des wir ich du ihr sie es man haben hab habe hat hast noch brauche brauchen braucht benoetigen kaufen einkaufen ' +
  'besorgen holen mitbringen muessen muss musst sollten sollen bitte mal auch ausserdem dann und oder also aehm aeh hm so etwa ungefaehr circa ca rund nur mehr alle leer ' +
  'aus fehlt fehlen vorhanden vorraetig zu hause zuhause daheim lager vorrat kuehlschrank tiefkuehler gefrierschrank schrank liste einkaufsliste da gibt gibts ist sind ' +
  'keine kein keinen keiner setz setze schreib schreibe trag trage ein mir uns was folgt folgendes dazu nachkaufen aufgebraucht ausgegangen verbraucht neue neues neuen ' +
  'naechste naechsten mal fuer von vom zum zur').split(' '));

function splitClauses(text) {
  return String(text || '')
    .replace(/[„“"()]/g, ' ')
    .split(/[.;!?\n]+|,|\s+(?:und|sowie|außerdem|ausserdem|plus|dann|danach|noch dazu|zusätzlich)\s+/i)
    .map((s) => s.trim()).filter(Boolean);
}

// Ganzer Text → Einträge { target: 'liste'|'lager', name, qty, unit, empty }
function parseSpeech(text, defaultMode) {
  let mode = defaultMode || 'liste';
  const out = [];
  for (const clause of splitClauses(text)) {
    const f = ' ' + fold(clause).replace(/[^a-z0-9.,\s-]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    let target = mode, empty = false;
    if (RE_EMPTY.test(f)) { target = 'liste'; empty = true; mode = 'liste'; }
    else if (RE_LIST.test(f)) { target = mode = 'liste'; }
    else if (RE_STOCK.test(f)) { target = mode = 'lager'; }
    // Wörter in der Originalschreibweise behalten, aber gefaltet vergleichen
    let toks = numberize(fold(clause).replace(/[^a-z0-9.,\s-]/g, ' ').split(/\s+/).filter(Boolean).map((t) => t.replace(/[.,]+$/, '')));
    while (toks.length && STOP.has(toks[0])) toks.shift();
    while (toks.length && STOP.has(toks[toks.length - 1])) toks.pop();
    if (!toks.length) continue;
    const p = parseEntry(toks.join(' '));
    let name = (p.name || '').replace(/\b(stueck|stuck)\b/g, '').replace(/\s+/g, ' ').trim();
    if (!name || /^\d/.test(name)) continue;
    // Schreibweise aus dem Original zurückholen (Umlaute, ß)
    const orig = {};
    clause.toLowerCase().split(/\s+/).forEach((w) => { const c = w.replace(/^[^a-zäöüß0-9]+|[^a-zäöüß0-9-]+$/g, ''); if (c) orig[fold(c)] = orig[fold(c)] || c; });
    name = name.split(' ').map((w) => orig[w] || w).join(' ');
    out.push({ target, name, qty: p.qty, unit: p.unit, empty });
  }
  return out;
}

// Spracheintrag einem Fundus-Artikel zuordnen
function matchSpoken(name) {
  const n = norm(name);
  if (VOICE_ALIAS[n]) { const f = findItem(VOICE_ALIAS[n]); if (f) return f; }
  return typeof matchIngredient === 'function' ? matchIngredient(name) : findItem(name);
}
const COUNT_UNITS = new Set(['Stk', 'Pck', 'Dose', 'Glas', 'Flasche', 'Bund', 'Becher', 'Tube', 'Schale', 'Topf', 'Rolle']);
// Einträge für die Vorschau aufbereiten (Artikel, Einheit, doppelte zusammenfassen)
function voiceRows(text, defaultMode) {
  const rows = [];
  for (const e of parseSpeech(text, defaultMode)) {
    const it = matchSpoken(e.name);
    let unit = e.unit;
    if (e.qty && !unit) unit = it && COUNT_UNITS.has(it.unit) ? it.unit : 'Stk';
    const row = { target: e.target, itemId: it ? it.id : null, name: it ? it.name : cap(e.name), qty: e.qty, unit: e.qty ? unit : null, empty: e.empty, isNew: !it };
    const dupe = rows.find((r) => r.target === row.target && (row.itemId ? r.itemId === row.itemId : norm(r.name) === norm(row.name)));
    if (dupe) {
      if (row.qty && dupe.qty) { const c = convert(row.qty, row.unit, dupe.unit); if (c != null) dupe.qty = round3(dupe.qty + c); }
      else if (row.qty) { dupe.qty = row.qty; dupe.unit = row.unit; }
      dupe.empty = dupe.empty || row.empty;
      continue;
    }
    rows.push(row);
  }
  return rows;
}
function parseAmount(s) {
  const t = String(s || '').trim();
  if (!t) return { qty: null, unit: null };
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-zÄÖÜäöüß.]*)$/);
  if (!m) return { qty: NaN, unit: null };
  const q = parseNum(m[1]);
  const u = m[2] ? (unitOf(m[2]) || window.ZK_UNITS.find((x) => x.toLowerCase() === m[2].toLowerCase()) || null) : 'Stk';
  return { qty: q > 0 ? q : NaN, unit: u };
}

// ── Übernehmen ──
function applyVoice(rows) {
  let nList = 0, nStock = 0, created = 0;
  const undo = tx(() => {
    for (const r of rows) {
      let it = r.itemId ? get('item', r.itemId) : matchSpoken(r.name);
      if (!it) {
        it = { id: 'u-' + rid(10), name: r.name, cat: guessCat(r.name), qty: r.qty && PURCHASE.has(r.unit) ? r.qty : 1, unit: r.qty && PURCHASE.has(r.unit) ? r.unit : 'Stk', uses: 0, created: Date.now() };
        put('item', it); created++;
      }
      const s = get('stock', it.id);
      if (r.target === 'liste') {
        addToList(it.id, r.qty || it.qty, r.qty ? r.unit : it.unit, { silent: true });
        if (r.empty && s && s.qty > 0) put('stock', Object.assign({}, s, { qty: 0, at: Date.now() }));
        nList++;
      } else {
        // Ins Lager: genannte Menge ist der aktuelle Bestand; ohne Menge bleibt ein vorhandener Bestand stehen
        if (!r.qty && s && s.qty > 0) { nStock++; continue; }
        const ns = Object.assign({ min: null }, s || {}, { id: it.id, qty: r.qty || it.qty, unit: r.qty ? r.unit : it.unit, at: Date.now() });
        put('stock', ns);
        if (isLow(ns) && !listOpen(it.id)) put('list', { id: it.id, qty: it.qty, unit: it.unit, checked: false, at: Date.now(), auto: true });
        nStock++;
      }
    }
  });
  const parts = [];
  if (nList) parts.push(nList + ' auf die Liste');
  if (nStock) parts.push(nStock + ' ins Lager');
  toast('Erfasst: ' + parts.join(', ') + (created ? '. ' + created + ' neu im Fundus' : '') + '.', undo);
}

// ── Dialog ──
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const MIC = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18.5 11a6.5 6.5 0 0 1-13 0M12 17.5V21m-3.5 0h7"/></svg>';
let rec = null, listening = false, voiceTimer = null;
UI.voice = null;

function openVoice() {
  UI.voice = { mode: UI.tab === 'lager' ? 'lager' : 'liste', rows: [] };
  openSheet(`<h2>Sprechen oder diktieren</h2>
    <div class="seg" role="radiogroup" aria-label="Wohin, wenn nichts dazu gesagt wird">
      <button type="button" role="radio" data-act="vmode" data-v="liste">Auf die Liste</button>
      <button type="button" role="radio" data-act="vmode" data-v="lager">Ins Lager</button>
    </div>
    <p class="sub vsub">Gilt für alles, wozu du nichts sagst. „Haben wir“ geht ins Lager, „brauchen wir“ und „ist alle“ auf die Liste.</p>
    <div class="vbox">
      <textarea id="vText" class="text area" rows="4" placeholder="z. B.: Im Lager haben wir zwei Liter Milch, sechs Eier und ein Kilo Mehl. Wir brauchen Butter, Zitronen und Spülmittel."></textarea>
      ${SR ? `<button class="micbig" type="button" data-act="vlisten" id="vMic">${MIC}<span>Zuhören</span></button>` : ''}
    </div>
    <p class="hint" id="vHint">${SR ? 'Tippe auf „Zuhören“ und sprich. Alternativ ins Feld tippen und das Mikrofon der Tastatur nutzen.' : 'Tippe ins Feld und nutze das Mikrofon unten auf der Tastatur zum Diktieren.'}</p>
    <div id="vPrev" aria-live="polite"></div>
    <p class="err" id="fErr" hidden></p>
    <div class="actions"><button class="btn primary" type="button" data-act="vgo" id="vGo" disabled>Nichts erkannt</button>
      <button class="btn quiet" type="button" data-act="vclose">Abbrechen</button></div>`, 'voice');
  setVoiceMode(UI.voice.mode);
  if (!SR) { const t = $('#vText'); if (t) t.focus(); }
}
function setVoiceMode(m) {
  UI.voice.mode = m;
  document.querySelectorAll('#sheet [data-act="vmode"]').forEach((b) => { const on = b.dataset.v === m; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-checked', String(on)); });
  reparseVoice();
}
function reparseVoice() {
  const t = $('#vText');
  if (!t || !UI.voice) return;
  UI.voice.rows = voiceRows(t.value, UI.voice.mode);
  renderVoicePreview();
}
function renderVoicePreview() {
  const box = $('#vPrev'); if (!box) return;
  const rows = UI.voice.rows;
  const group = (target, title) => {
    const idx = rows.map((r, i) => [r, i]).filter(([r]) => r.target === target);
    if (!idx.length) return '';
    return `<section class="group vgroup"><h3 class="ghead">${title}<small>${idx.length}</small></h3><ul class="rows">${idx.map(([r, i]) => {
      const it = r.itemId ? get('item', r.itemId) : null, s = it ? get('stock', it.id) : null;
      const ph = target === 'lager' && s && s.qty > 0 ? fmtQty(s.qty) + ' ' + s.unit : it ? fmtQty(it.qty) + ' ' + it.unit : '1 Stk';
      const tags = (r.isNew ? `<span class="tag list">neu: ${esc(catName(guessCat(r.name)))}</span>` : '') + (r.empty ? '<span class="tag low">ist alle</span>' : '');
      return `<li class="row vrow">
        <span class="stack"><span class="name">${esc(r.name)}</span>${tags ? '<span class="tags">' + tags + '</span>' : ''}</span>
        <input class="vamt" data-i="${i}" value="${r.qty ? esc(fmtQty(r.qty) + ' ' + r.unit) : ''}" placeholder="${esc(ph)}" aria-label="Menge für ${esc(r.name)}" autocomplete="off">
        <button class="vmove" type="button" data-act="vtoggle" data-i="${i}" aria-label="${esc(r.name)} ${target === 'liste' ? 'stattdessen ins Lager' : 'stattdessen auf die Liste'}">${target === 'liste' ? 'Lager' : 'Liste'}</button>
        <button class="vx" type="button" data-act="vdel" data-i="${i}" aria-label="${esc(r.name)} entfernen">×</button>
      </li>`;
    }).join('')}</ul></section>`;
  };
  box.innerHTML = rows.length ? '<p class="hint">Graue Mengen werden genommen, wenn du nichts einträgst: auf der Liste die übliche Menge, im Lager der bisherige Bestand.</p>' + group('liste', 'Auf die Liste') + group('lager', 'Ins Lager') : '';
  const go = $('#vGo');
  if (go) { go.disabled = !rows.length; go.textContent = rows.length ? rows.length + (rows.length === 1 ? ' Eintrag übernehmen' : ' Einträge übernehmen') : 'Nichts erkannt'; }
}
function stopListening() { if (rec) { try { rec.stop(); } catch (e) { /* schon aus */ } } listening = false; updateMic(); }
function updateMic() {
  const b = $('#vMic'); if (!b) return;
  b.classList.toggle('on', listening);
  b.querySelector('span').textContent = listening ? 'Stopp' : 'Zuhören';
}
function startListening() {
  const t = $('#vText'); if (!t || !SR) return;
  try {
    rec = new SR();
    rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true;
    const base = t.value.trim() ? t.value.trim() + '. ' : '';
    rec.onresult = (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript + (e.results[i].isFinal ? '. ' : ' ');
      t.value = base + txt.trim();
      clearTimeout(voiceTimer); voiceTimer = setTimeout(reparseVoice, 150);
    };
    rec.onerror = (e) => {
      const h = $('#vHint');
      if (h) h.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Das Mikrofon ist für diese Seite nicht erlaubt. Tippe ins Feld und nutze das Mikrofon der Tastatur.'
        : e.error === 'no-speech' ? 'Nichts gehört. Tippe nochmal auf „Zuhören“.' : 'Spracherkennung gerade nicht verfügbar. Tippe ins Feld und nutze das Mikrofon der Tastatur.';
    };
    rec.onend = () => { listening = false; updateMic(); reparseVoice(); };
    rec.start(); listening = true; updateMic();
  } catch (e) {
    listening = false; updateMic();
    const h = $('#vHint'); if (h) h.textContent = 'Spracherkennung gerade nicht verfügbar. Tippe ins Feld und nutze das Mikrofon der Tastatur.';
  }
}

document.addEventListener('input', (e) => {
  if (!e.target) return;
  if (e.target.id === 'vText') { clearTimeout(voiceTimer); voiceTimer = setTimeout(reparseVoice, 250); }
  if (e.target.classList && e.target.classList.contains('vamt') && UI.voice) {
    const r = UI.voice.rows[Number(e.target.dataset.i)];
    if (!r) return;
    const a = parseAmount(e.target.value);
    e.target.classList.toggle('bad', Number.isNaN(a.qty));
    if (!Number.isNaN(a.qty)) { r.qty = a.qty; r.unit = a.unit; }
  }
});

Object.assign(actions, {
  voice: () => openVoice(),
  vmode: (b) => setVoiceMode(b.dataset.v),
  vlisten: () => { if (listening) stopListening(); else startListening(); },
  vtoggle: (b) => { const r = UI.voice.rows[Number(b.dataset.i)]; if (r) { r.target = r.target === 'liste' ? 'lager' : 'liste'; renderVoicePreview(); } },
  vdel: (b) => { UI.voice.rows.splice(Number(b.dataset.i), 1); renderVoicePreview(); },
  vclose: () => { stopListening(); closeSheet(); },
  vgo: () => {
    if (document.querySelector('#vPrev .vamt.bad')) return showErr('Eine Menge ist nicht lesbar. Bitte so schreiben: „2 l“ oder „500 g“, oder das Feld leer lassen.');
    const rows = UI.voice.rows.slice();
    if (!rows.length) return;
    stopListening(); closeSheet();
    applyVoice(rows);
  },
});

// Beim Schließen des Dialogs (Hintergrund, Escape) das Zuhören beenden
const _closeSheetBase = closeSheet;
closeSheet = function () { if (listening) stopListening(); _closeSheetBase(); };

// Mikrofon-Knopf im Suchfeld
(function addMicButton() {
  const label = document.querySelector('.search');
  if (!label || document.getElementById('micBtn')) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'micBtn'; b.className = 'qclear micbtn'; b.dataset.act = 'voice';
  b.setAttribute('aria-label', 'Per Sprache erfassen');
  b.innerHTML = MIC;
  label.appendChild(b);
})();
render();
