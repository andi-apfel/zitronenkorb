'use strict';
/* Zitronenkorb – gemeinsame Einkaufsliste
   Daten liegen lokal (offline nutzbar) und werden über Supabase zwischen den Handys abgeglichen. */

const CFG = window.ZK_CONFIG || {};
const UNITS = window.ZK_UNITS;
const VERSION = '1.1';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = (n = 12) => { const a = 'abcdefghijkmnopqrstuvwxyz23456789'; const b = crypto.getRandomValues(new Uint8Array(n)); return Array.from(b, (x) => a[x % a.length]).join(''); };

// ── Lokaler Speicher ──
const STORE_KEY = 'zitronenkorb.v1';
function loadState() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; } }
let S = Object.assign({ code: null, device: rid(8), records: {}, dirty: {}, cursor: 0, lastOk: null, err: null, lastM: 0 }, loadState() || {});
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* Speicher voll oder gesperrt */ } }

const UI = { tab: 'liste', q: '', view: null };

// ── Datensätze ──
const key = (kind, id) => kind + '|' + id;
function nextM() { S.lastM = Math.max(Date.now(), (S.lastM || 0) + 1); return S.lastM; }
function get(kind, id) { const r = S.records[key(kind, id)]; return r && !r.deleted ? r.data : null; }
function all(kind) { const out = []; for (const k in S.records) { const r = S.records[k]; if (r.kind === kind && !r.deleted && r.data) out.push(r.data); } return out; }

let txDepth = 0, txSnap = null;
function write(kind, id, data) {
  const k = key(kind, id);
  if (txSnap && !(k in txSnap)) txSnap[k] = S.records[k] ? JSON.parse(JSON.stringify(S.records[k])) : null;
  const m = nextM();
  S.records[k] = data ? { kind, id, data, mtime: m, deleted: false } : { kind, id, data: null, mtime: m, deleted: true };
  S.dirty[k] = m;
}
const put = (kind, data) => write(kind, data.id, data);
const del = (kind, id) => write(kind, id, null);

// Mehrere Änderungen bündeln: einmal speichern, zeichnen und abgleichen. Gibt eine Rückgängig-Funktion zurück.
function tx(fn) {
  const outer = txDepth === 0;
  if (outer) txSnap = {};
  txDepth++;
  try { fn(); } finally { txDepth--; }
  if (!outer) return null;
  const snap = txSnap; txSnap = null;
  save(); render(); Sync.schedule();
  return () => tx(() => {
    for (const k in snap) {
      const r = snap[k];
      const [kind, id] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)];
      write(kind, id, r && !r.deleted ? r.data : null);
    }
  });
}

function applySeeds() {
  window.ZK_SEED_CATS.forEach(([id, name], i) => {
    const k = key('cat', id);
    if (!S.records[k]) S.records[k] = { kind: 'cat', id, data: { id, name, order: (i + 1) * 10 }, mtime: 0, deleted: false };
  });
  window.ZK_SEED_ITEMS.forEach(([name, cat, qty, unit]) => {
    const id = 'i-' + slug(name), k = key('item', id);
    if (!S.records[k]) S.records[k] = { kind: 'item', id, data: { id, name, cat, qty, unit, uses: 0 }, mtime: 0, deleted: false };
  });
}

// ── Text-Helfer ──
function fold(s) {
  return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}
const norm = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/ /g, '-');
const stem = (s) => norm(s).replace(/(en|n|e|s)$/, '');
function fmtQty(q) {
  if (q == null || isNaN(q)) return '';
  const r = Math.round(q * 100) / 100;
  return String(r).replace('.', ',');
}
const fmtAmt = (q, u) => fmtQty(q) + ' ' + u;
function parseNum(s) { const n = parseFloat(String(s).replace(',', '.')); return isFinite(n) ? n : NaN; }

const UNIT_ALIASES = {
  stk: 'Stk', stueck: 'Stk', st: 'Stk', x: 'Stk', g: 'g', gr: 'g', gramm: 'g', kg: 'kg', kilo: 'kg', ml: 'ml', l: 'l', liter: 'l',
  pck: 'Pck', pkg: 'Pck', pack: 'Pck', packung: 'Pck', packungen: 'Pck', paeckchen: 'Pck', bund: 'Bund', dose: 'Dose', dosen: 'Dose',
  glas: 'Glas', glaeser: 'Glas', flasche: 'Flasche', flaschen: 'Flasche', fl: 'Flasche', tube: 'Tube', tuben: 'Tube', becher: 'Becher',
  schale: 'Schale', schalen: 'Schale', topf: 'Topf', toepfe: 'Topf', rolle: 'Rolle', rollen: 'Rolle',
};
function unitOf(tok) { return UNIT_ALIASES[fold(tok).replace(/\.$/, '')] || null; }
// „2 l Milch“, „500g Mehl“, „Milch 2 l“, „3 Zitronen“ → { name, qty, unit }
function parseEntry(raw) {
  let s = String(raw || '').trim().replace(/\s+/g, ' ');
  let qty = null, unit = null;
  const num = '(\\d+(?:[.,]\\d+)?)';
  let m = s.match(new RegExp('^' + num + '\\s*([a-zA-ZäöüÄÖÜß.]+)?\\s+(.+)$'));
  if (m) {
    const u = m[2] ? unitOf(m[2]) : null;
    if (m[2] && !u) { qty = parseNum(m[1]); s = (m[2] + ' ' + m[3]).trim(); }
    else { qty = parseNum(m[1]); unit = u; s = m[3]; }
  } else if ((m = s.match(new RegExp('^(.+?)\\s+' + num + '\\s*([a-zA-ZäöüÄÖÜß.]+)?$')))) {
    const u = m[3] ? unitOf(m[3]) : null;
    if (!m[3] || u) { qty = parseNum(m[2]); unit = u; s = m[1]; }
  }
  return { name: s.trim(), qty: qty > 0 ? qty : null, unit };
}

// ── Fachlogik ──
const cats = () => all('cat').sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'de'));
const items = () => all('item');
const entries = () => all('list').filter((e) => get('item', e.id));
function catName(id) { const c = get('cat', id); return c ? c.name : 'Besorgungen & Sonstiges'; }
function catOf(item) { return get('cat', item.cat) ? item.cat : 'c-sonst'; }

function findItem(name) {
  const n = norm(name), st = stem(name);
  if (!n) return null;
  const list = items();
  return list.find((i) => norm(i.name) === n) || list.find((i) => stem(i.name) === st) || null;
}
function search(q) {
  const n = norm(q);
  if (!n) return [];
  const words = n.split(' ');
  return items()
    .map((i) => {
      const nm = norm(i.name);
      if (!words.every((w) => nm.includes(w))) return null;
      const score = (nm === n ? 0 : nm.startsWith(n) ? 1 : nm.split(' ').some((w) => w.startsWith(words[0])) ? 2 : 3);
      return { i, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || (b.i.uses || 0) - (a.i.uses || 0) || a.i.name.localeCompare(b.i.name, 'de'))
    .slice(0, 30)
    .map((x) => x.i);
}
function guessCat(name) {
  const n = ' ' + norm(name) + ' ';
  let best = 'c-sonst', bestLen = 0;
  const hints = window.ZK_CAT_HINTS;
  for (const cat in hints) {
    for (const w of hints[cat].split(' ')) {
      if (w.length > bestLen && n.includes(w) && get('cat', cat)) { best = cat; bestLen = w.length; }
    }
  }
  return best;
}
function stepFor(unit, qty) {
  if (unit === 'g' || unit === 'ml') return qty >= 500 ? 100 : 50;
  if (unit === 'kg' || unit === 'l') return 0.5;
  return 1;
}

// g ↔ kg und ml ↔ l ineinander umrechnen; null, wenn die Einheiten nicht zusammenpassen
function convert(q, from, to) {
  if (from === to) return q;
  const f = { g: ['kg', 1 / 1000], kg: ['g', 1000], ml: ['l', 1 / 1000], l: ['ml', 1000] }[from];
  return f && f[0] === to ? q * f[1] : null;
}
const round3 = (q) => Math.round(q * 1000) / 1000;
// Menge zu einem vorhandenen Stand addieren (mit Umrechnung g/kg, ml/l). Passen die Einheiten nicht, gilt die neue Angabe.
function sumInto(cur, q, u) {
  if (!cur || !(cur.qty > 0)) return { qty: round3(q), unit: u };
  const c = convert(q, u, cur.unit);
  return c != null ? { qty: round3(cur.qty + c), unit: cur.unit } : { qty: round3(q), unit: u };
}
const listOpen = (id) => { const e = get('list', id); return e && !e.checked ? e : null; };

// Auf die Liste: Steht der Artikel schon drauf, wird die Menge dazugezählt.
function addToList(itemId, qty, unit, opts = {}) {
  const item = get('item', itemId);
  if (!item || !(qty > 0)) return;
  const open = listOpen(itemId);
  const next = sumInto(open, qty, unit || item.unit);
  const undo = tx(() => {
    put('list', { id: itemId, qty: next.qty, unit: next.unit, checked: false, at: Date.now() });
    if (!open) put('item', Object.assign({}, item, { uses: (item.uses || 0) + 1, last: Date.now() }));
  });
  if (!opts.silent) toast(open ? item.name + ': jetzt ' + fmtAmt(next.qty, next.unit) + ' auf der Liste' : item.name + ' (' + fmtAmt(next.qty, next.unit) + ') steht auf der Liste', undo);
}

// Ins Zitronenlager: zum vorhandenen Bestand dazuzählen.
function addToStock(itemId, qty, unit) {
  const item = get('item', itemId);
  if (!item || !(qty > 0)) return;
  const cur = get('stock', itemId);
  const next = sumInto(cur, qty, unit || item.unit);
  const undo = tx(() => put('stock', Object.assign({ min: null }, cur || {}, { id: itemId, qty: next.qty, unit: next.unit, at: Date.now() })));
  toast(item.name + ': ' + fmtAmt(next.qty, next.unit) + ' im Zitronenlager', undo);
}

// Bestand ändern. Fällt er auf die Mindestmenge oder darunter, kommt der Artikel automatisch auf die Liste.
function setStock(itemId, qty, unit, min) {
  const item = get('item', itemId), cur = get('stock', itemId);
  if (!item) return;
  const s = Object.assign({ min: null }, cur || {}, { id: itemId, qty: Math.max(0, round3(qty)), unit: unit || (cur && cur.unit) || item.unit, at: Date.now() });
  if (min !== undefined) s.min = min > 0 ? round3(min) : null;
  const wasLow = cur ? isLow(cur) : false;
  let auto = false;
  const undo = tx(() => {
    put('stock', s);
    if (isLow(s) && !wasLow && !listOpen(itemId)) {
      auto = true;
      put('list', { id: itemId, qty: item.qty, unit: item.unit, checked: false, at: Date.now(), auto: true });
    }
  });
  if (auto) toast(item.name + ' wird knapp und steht jetzt auf der Liste', undo);
}
const isLow = (s) => !!(s && s.min > 0 && s.qty <= s.min);
function stepStock(itemId, dir) {
  const s = get('stock', itemId);
  if (!s) return;
  const st = stepFor(s.unit, dir < 0 ? Math.max(0, s.qty - 0.0001) : s.qty);
  let q = dir < 0 ? s.qty - st : s.qty + st;
  q = q < st / 2 ? 0 : Math.round(q / st) * st;
  setStock(itemId, q);
}
function removeFromStock(id) {
  const item = get('item', id);
  const undo = tx(() => del('stock', id));
  toast((item ? item.name : 'Artikel') + ' ist aus dem Lager entfernt', undo);
}

function toggleCheck(id) {
  const e = get('list', id);
  if (!e) return;
  tx(() => put('list', Object.assign({}, e, { checked: !e.checked, checkedAt: e.checked ? null : Date.now() })));
}
function removeFromList(id) {
  const item = get('item', id);
  const undo = tx(() => del('list', id));
  toast((item ? item.name : 'Eintrag') + ' ist von der Liste', undo);
}
// Einkauf abschließen: Abgehaktes wandert ins Zitronenlager.
function finishTrip() {
  const done = entries().filter((e) => e.checked);
  if (!done.length) return;
  const undo = tx(() => {
    put('trip', { id: 't-' + rid(10), at: Date.now(), items: done.map((e) => ({ item: e.id, qty: e.qty, unit: e.unit })) });
    done.forEach((e) => {
      const cur = get('stock', e.id);
      const next = sumInto(cur, e.qty, e.unit);
      put('stock', Object.assign({ min: null }, cur || {}, { id: e.id, qty: next.qty, unit: next.unit, at: Date.now() }));
      del('list', e.id);
    });
  });
  toast('Ausgepresst! ' + done.length + (done.length === 1 ? ' Sache ist' : ' Sachen sind') + ' jetzt im Zitronenlager.', undo);
}

// ── Abgleich ──
const Sync = (() => {
  let timer = null, busy = false, again = false, poll = null;
  const on = () => !!(CFG.url && CFG.key && S.code);
  function headers() {
    const h = { 'Content-Type': 'application/json', apikey: CFG.key };
    if (/^eyJ/.test(CFG.key)) h.Authorization = 'Bearer ' + CFG.key;
    return h;
  }
  async function rpc(fn, body) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(CFG.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: ctl.signal });
      if (!r.ok) {
        let msg = 'Server antwortet mit ' + r.status;
        try { const j = await r.json(); if (j && j.code === 'PGRST202') msg = 'Datenbank ist noch nicht eingerichtet'; else if (j && j.message) msg = j.message; } catch (e) { /* kein JSON */ }
        throw new Error(msg);
      }
      const txt = await r.text(); return txt ? JSON.parse(txt) : null;
    } finally { clearTimeout(t); }
  }
  async function push() {
    const snap = Object.assign({}, S.dirty); const keys = Object.keys(snap);
    if (!keys.length) return false;
    for (let i = 0; i < keys.length; i += 400) {
      const rows = keys.slice(i, i + 400).map((k) => { const r = S.records[k]; return { kind: r.kind, id: r.id, data: r.data, mtime: r.mtime, deleted: !!r.deleted }; });
      await rpc('zk_push', { p_code: S.code, p_rows: rows });
    }
    keys.forEach((k) => { if (S.dirty[k] === snap[k]) delete S.dirty[k]; });
    return true;
  }
  function apply(r) {
    const k = key(r.kind, r.id), loc = S.records[k], m = Number(r.mtime);
    if (loc && loc.mtime > m) return false; // eigener Stand ist neuer
    const data = r.deleted ? null : r.data;
    if (loc && loc.mtime === m && !!loc.deleted === !!r.deleted && JSON.stringify(loc.data) === JSON.stringify(data)) return false;
    S.records[k] = { kind: r.kind, id: r.id, data, mtime: m, deleted: !!r.deleted };
    if (S.dirty[k] && S.dirty[k] <= m) delete S.dirty[k];
    return true;
  }
  async function pull() {
    // etwas Überlappung, damit gleichzeitig geschriebene Datensätze nicht verloren gehen
    let since = Math.max(0, (S.cursor || 0) - 200), max = S.cursor || 0, changed = false;
    for (let guard = 0; guard < 50; guard++) {
      const rows = (await rpc('zk_pull', { p_code: S.code, p_since: since })) || [];
      rows.forEach((r) => { changed = apply(r) || changed; since = Math.max(since, Number(r.rev)); max = Math.max(max, Number(r.rev)); });
      if (rows.length < 2000) break;
    }
    S.cursor = max;
    return changed;
  }
  async function run() {
    if (!on()) { renderStatus(); return; }
    if (busy) { again = true; return; }
    busy = true; renderStatus();
    try {
      const pushed = await push();
      const changed = await pull();
      S.lastOk = Date.now(); S.err = null;
      if (pushed) RT.ping();
      if (changed) { save(); render(); }
    } catch (e) {
      S.err = navigator.onLine === false ? 'offline' : String((e && e.name === 'AbortError') ? 'Zeitüberschreitung' : (e && e.message) || e);
    } finally {
      busy = false; save(); renderStatus();
      if (again) { again = false; schedule(300); }
    }
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(run, ms == null ? 400 : ms); }
  function start() {
    clearInterval(poll);
    if (!on()) { renderStatus(); return; }
    run();
    poll = setInterval(() => { if (!document.hidden) run(); }, 20000);
  }
  return { on, run, schedule, start, get busy() { return busy; } };
})();

// Live-Signal über Supabase Realtime (nur ein „es gibt Neues“-Ping, die Daten kommen über zk_pull)
const RT = (() => {
  let ws = null, ref = 0, joinRef = null, hb = null, topic = null, retry = 0, alive = false, wanted = false, retryTimer = null;
  async function topicFor(code) {
    if (!(window.crypto && crypto.subtle)) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('zitronenkorb-live|' + code));
    return 'realtime:zk-' + Array.from(new Uint8Array(buf)).slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  async function connect() {
    wanted = true;
    if (!Sync.on() || !('WebSocket' in window) || (ws && ws.readyState <= 1)) return;
    topic = await topicFor(S.code);
    if (!topic) return;
    const url = CFG.url.replace(/^http/, 'ws').replace(/\/+$/, '') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(CFG.key) + '&vsn=1.0.0';
    try { ws = new WebSocket(url); } catch (e) { later(); return; }
    const me = ws;
    ws.onopen = () => {
      joinRef = String(++ref);
      send({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false } }, ref: joinRef, join_ref: joinRef });
      clearInterval(hb);
      hb = setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }), 25000);
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.topic !== topic) return;
      if (m.event === 'phx_reply' && m.ref === joinRef) {
        alive = !!(m.payload && m.payload.status === 'ok');
        if (alive) { retry = 0; Sync.schedule(100); }
        renderStatus();
      } else if (m.event === 'broadcast' && m.payload && m.payload.event === 'changed') {
        if (!m.payload.payload || m.payload.payload.from !== S.device) Sync.schedule(120);
      } else if (m.event === 'phx_error' || m.event === 'phx_close') {
        alive = false; try { me.close(); } catch (e) { /* schon zu */ }
      }
    };
    ws.onclose = () => { if (me !== ws) return; clearInterval(hb); alive = false; ws = null; renderStatus(); later(); };
    ws.onerror = () => { /* onclose folgt */ };
  }
  function later() {
    clearTimeout(retryTimer);
    if (!wanted) return;
    retry = Math.min(retry + 1, 6);
    retryTimer = setTimeout(() => { if (!document.hidden) connect(); }, 1000 * Math.pow(2, retry));
  }
  function ping() { if (alive) send({ topic, event: 'broadcast', payload: { type: 'broadcast', event: 'changed', payload: { from: S.device } }, ref: String(++ref), join_ref: joinRef }); }
  function stop() { wanted = false; clearTimeout(retryTimer); clearInterval(hb); alive = false; const w = ws; ws = null; if (w) try { w.close(); } catch (e) { /* egal */ } }
  function restart() { stop(); connect(); }
  return { connect, ping, stop, restart, get alive() { return alive; } };
})();

// ── Darstellung ──
const SLICE = '<svg class="slice" viewBox="0 0 28 28" aria-hidden="true"><circle class="rind" cx="14" cy="14" r="12"/><circle class="flesh" cx="14" cy="14" r="9.5"/>' +
  [0, 45, 90, 135].map((a) => { const r = (a * Math.PI) / 180, x = 8.6 * Math.cos(r), y = 8.6 * Math.sin(r); return `<line class="seg" x1="${(14 - x).toFixed(2)}" y1="${(14 - y).toFixed(2)}" x2="${(14 + x).toFixed(2)}" y2="${(14 + y).toFixed(2)}"/>`; }).join('') + '</svg>';
const PENCIL = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>';

const TAB_PH = { liste: 'Was fehlt? z. B. 2 l Milch', lager: 'Im Lager suchen oder ergänzen', fundus: 'Im Fundus suchen' };
const VIEWS = { liste: () => renderList(), lager: () => renderLager(), fundus: () => renderFundus() };
function render() {
  if (!VIEWS[UI.tab]) UI.tab = 'liste';
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === UI.tab ? 'page' : 'false'));
  const open = entries().filter((e) => !e.checked).length;
  $('#badge').textContent = open ? String(open) : '';
  $('#q').placeholder = TAB_PH[UI.tab];
  $('#qClear').hidden = !UI.q;
  $('#main').innerHTML = UI.q.trim() ? renderSearch() : VIEWS[UI.tab]();
  renderJump();
  renderStatus();
  if (UI.view === 'settings' && !$('#sheet').hidden) renderSettings();
}

const byName = (a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
function letterOf(name) { const c = fold(name).trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; }

function groupByCat(rows, itemOf) {
  const byCat = {};
  rows.forEach((r) => { const it = itemOf(r); const c = catOf(it); (byCat[c] = byCat[c] || []).push(r); });
  return cats().filter((c) => byCat[c.id]).map((c) => ({ cat: c, rows: byCat[c.id] }));
}

function listRow(e, item) {
  return `<li class="row${e.checked ? ' done' : ''}">
    <button class="check" type="button" data-act="check" data-id="${esc(e.id)}" aria-label="${esc(item.name)} ${e.checked ? 'wieder offen' : 'abhaken'}" aria-pressed="${e.checked}">${SLICE}</button>
    <button class="main" type="button" data-act="amount" data-id="${esc(e.id)}"><span class="name">${esc(item.name)}${e.auto ? ' <span class="tag low">knapp</span>' : ''}</span><span class="amt">${fmtAmt(e.qty, e.unit)}</span></button>
  </li>`;
}

function renderList() {
  const all = entries();
  const open = all.filter((e) => !e.checked), done = all.filter((e) => e.checked);
  let h = '';
  if (!all.length) {
    h += `<div class="empty"><p class="big">Die Liste ist leer.</p><p>Schreib oben, was fehlt, oder tippe im Fundus auf einen Artikel.</p></div>`;
  } else if (!open.length) {
    h += `<div class="empty"><p class="big">Alles im Korb.</p><p>Wenn ihr fertig seid, schließt den Einkauf unten ab. Dann wandert alles ins Zitronenlager.</p></div>`;
  }
  h += renderOften();
  groupByCat(open, (e) => get('item', e.id)).forEach(({ cat, rows }) => {
    rows.sort((a, b) => byName(get('item', a.id), get('item', b.id)));
    h += `<section class="group"><h2 class="ghead">${esc(cat.name)}<small>${rows.length}</small></h2><ul class="rows">${rows.map((e) => listRow(e, get('item', e.id))).join('')}</ul></section>`;
  });
  if (done.length) {
    done.sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0));
    h += `<section class="group basket"><h2 class="ghead">Im Korb<small>${done.length}</small></h2><ul class="rows">${done.map((e) => listRow(e, get('item', e.id))).join('')}</ul>
      <button class="finish" type="button" data-act="finish">Einkauf abschließen</button>
      <p class="hint">Alles im Korb wandert dann ins Zitronenlager.</p></section>`;
  }
  return h;
}

function renderOften() {
  const onList = new Set(entries().filter((e) => !e.checked).map((e) => e.id));
  const often = items().filter((i) => (i.uses || 0) > 0 && !onList.has(i.id))
    .sort((a, b) => (b.uses || 0) - (a.uses || 0) || (b.last || 0) - (a.last || 0)).slice(0, 10);
  if (!often.length) return '';
  return `<section class="often"><h2>Oft gekauft</h2><div class="chips">${often.map((i) =>
    `<button class="chip" type="button" data-act="ask" data-id="${esc(i.id)}">${PLUS}${esc(i.name)}</button>`).join('')}</div></section>`;
}

function itemTags(item) {
  const s = get('stock', item.id), e = listOpen(item.id);
  let t = '';
  if (s && s.qty > 0) t += `<span class="tag stock">${fmtAmt(s.qty, s.unit)} im Lager</span>`;
  if (e) t += `<span class="tag list">${fmtAmt(e.qty, e.unit)} auf der Liste</span>`;
  return t ? `<span class="tags">${t}</span>` : '';
}
function fundusRow(item) {
  return `<li class="row">
    <button class="main" type="button" data-act="ask" data-id="${esc(item.id)}"><span class="stack"><span class="name">${esc(item.name)}</span>${itemTags(item)}</span></button>
    <button class="edit" type="button" data-act="edititem" data-id="${esc(item.id)}" aria-label="${esc(item.name)} bearbeiten">${PENCIL}</button>
  </li>`;
}

function renderFundus() {
  const groups = {};
  items().sort(byName).forEach((i) => { const l = letterOf(i.name); (groups[l] = groups[l] || []).push(i); });
  let h = '<p class="hint lead">Tippe auf einen Artikel und gib an, wie viel ins Lager oder auf die Liste soll.</p>';
  Object.keys(groups).sort().forEach((l) => {
    h += `<section class="group" id="L-${l}"><h2 class="ghead letter">${l}</h2><ul class="rows">${groups[l].map(fundusRow).join('')}</ul></section>`;
  });
  h += `<button class="create" type="button" data-act="newitem"><b>Neuen Artikel anlegen</b><span>Er kommt in den Fundus und kann dann ins Lager oder auf die Liste.</span></button>`;
  return h;
}

function stockRow(s, item) {
  const low = isLow(s);
  return `<li class="row stockrow${s.qty > 0 ? '' : ' gone'}">
    <button class="main" type="button" data-act="stockedit" data-id="${esc(s.id)}"><span class="name">${esc(item.name)}${low ? ' <span class="tag low">knapp</span>' : ''}</span></button>
    <div class="qtyctl">
      <button class="pm" type="button" data-act="stockminus" data-id="${esc(s.id)}" aria-label="${esc(item.name)} weniger" ${s.qty > 0 ? '' : 'disabled'}>−</button>
      <span class="amt">${fmtAmt(s.qty, s.unit)}</span>
      <button class="pm" type="button" data-act="stockplus" data-id="${esc(s.id)}" aria-label="${esc(item.name)} mehr">+</button>
    </div>
  </li>`;
}
function renderLager() {
  const st = all('stock').filter((s) => get('item', s.id));
  if (!st.length) {
    return `<div class="empty"><p class="big">Das Zitronenlager ist leer.</p><p>Tippe im Fundus auf einen Artikel und wähle „Ins Lager“. Nach jedem Einkauf landet das Eingekaufte automatisch hier.</p></div>`;
  }
  const name = (s) => get('item', s.id);
  const have = st.filter((s) => s.qty > 0).sort((a, b) => byName(name(a), name(b)));
  const gone = st.filter((s) => !(s.qty > 0)).sort((a, b) => byName(name(a), name(b)));
  let h = '';
  if (have.length) h += `<section class="group"><h2 class="ghead">Vorhanden<small>${have.length}</small></h2><ul class="rows">${have.map((s) => stockRow(s, name(s))).join('')}</ul></section>`;
  if (gone.length) h += `<section class="group gonegroup"><h2 class="ghead">Aufgebraucht<small>${gone.length}</small></h2><ul class="rows">${gone.map((s) => stockRow(s, name(s))).join('')}</ul></section>`;
  return h;
}

function renderSearch() {
  const p = parseEntry(UI.q);
  const hits = search(p.name || UI.q);
  const exact = findItem(p.name);
  const target = UI.tab === 'lager' ? 'ins Lager' : 'auf die Liste';
  let h = '';
  if (UI.tab !== 'fundus' && exact) {
    h += `<p class="hint lead">${p.qty ? 'Mit „Fertig“ auf der Tastatur kommen ' + esc(fmtAmt(p.qty, p.unit || exact.unit)) + ' ' + esc(exact.name) + ' direkt ' + target + '.' : 'Mit „Fertig“ fragt die App, wie viel ' + esc(exact.name) + ' ' + target + ' soll.'}</p>`;
  }
  if (hits.length) h += `<section class="group"><h2 class="ghead">Im Fundus<small>${hits.length}</small></h2><ul class="rows">${hits.map(fundusRow).join('')}</ul></section>`;
  if (p.name && !exact) {
    const amt = p.qty ? fmtAmt(p.qty, p.unit || 'Stk') : null;
    h += `<button class="create" type="button" data-act="createfromq"><b>„${esc(p.name)}“ neu anlegen</b><span>Vorschlag: ${esc(catName(guessCat(p.name)))}${amt ? ', ' + esc(amt) : ''}. Kommt in den Fundus, danach fragt die App, wohin.</span></button>`;
  }
  return h;
}

function renderJump() {
  const j = $('#jump');
  const show = UI.tab === 'fundus' && !UI.q.trim();
  j.hidden = !show;
  if (!show) return;
  const letters = [...new Set(items().map((i) => letterOf(i.name)))].sort();
  j.innerHTML = letters.map((l) => `<button type="button" data-act="jump" data-id="${l}" aria-label="Zu ${l} springen">${l}</button>`).join('');
}

function syncState() {
  if (!S.code) return ['off', 'Kein Abgleich'];
  if (!Sync.on()) return ['off', 'Kein Abgleich'];
  if (S.err === 'offline') return ['off', 'Offline'];
  if (S.err) return ['err', 'Störung'];
  if (Object.keys(S.dirty).length) return ['pending', 'Wird gesendet'];
  if (!S.lastOk) return ['pending', 'Verbinde'];
  return [RT.alive ? 'live' : 'ok', RT.alive ? 'Live' : 'Abgeglichen'];
}
function renderStatus() {
  const b = $('#syncBtn'); if (!b) return;
  const [s, txt] = syncState();
  b.dataset.s = s; $('.synctxt', b).textContent = txt;
  if (UI.view === 'settings' && !$('#sheet').hidden) { const el = $('#syncInfo'); if (el) el.textContent = syncLine(); }
}
function syncLine() {
  const [, txt] = syncState();
  const t = S.lastOk ? new Date(S.lastOk).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  if (S.err && S.err !== 'offline') return 'Abgleich gestört: ' + S.err + '. Die App funktioniert trotzdem, Änderungen werden später gesendet.';
  if (S.err === 'offline') return 'Gerade offline. Änderungen werden gesendet, sobald wieder Netz da ist.';
  return txt + (t ? ', zuletzt um ' + t + ' Uhr' : '') + (RT.alive ? '. Änderungen vom anderen Handy kommen sofort.' : '.');
}

// ── Unteres Blatt ──
function openSheet(html, view) {
  UI.view = view || null;
  $('#toast').hidden = true; toastUndo = null;
  const sh = $('#sheet');
  $('.sheet-card', sh).innerHTML = html;
  sh.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheet').hidden = true; UI.view = null; document.body.style.overflow = '';
}

function unitChips(sel, name = 'unit') {
  return `<div class="chips" role="radiogroup">${UNITS.map((u) => `<button class="chip" type="button" role="radio" data-act="pick" data-group="${name}" data-v="${esc(u)}" aria-pressed="${u === sel}" aria-checked="${u === sel}">${esc(u)}</button>`).join('')}</div>`;
}
function catChips(sel) {
  return `<div class="chips" role="radiogroup">${cats().map((c) => `<button class="chip" type="button" role="radio" data-act="pick" data-group="cat" data-v="${esc(c.id)}" aria-pressed="${c.id === sel}" aria-checked="${c.id === sel}">${esc(c.name)}</button>`).join('')}</div>`;
}
function stepper(qty, allowZero) {
  return `<div class="stepper"><button type="button" data-act="step" data-d="-1" aria-label="weniger">−</button>
    <input id="fQty" inputmode="decimal" value="${esc(qty == null ? '' : fmtQty(qty))}" aria-label="Menge" autocomplete="off" data-zero="${allowZero ? 1 : 0}"><button type="button" data-act="step" data-d="1" aria-label="mehr">+</button></div>`;
}
const picked = (group) => { const b = document.querySelector(`#sheet [data-group="${group}"][aria-pressed="true"]`); return b ? b.dataset.v : null; };

function openAmount(id) {
  const e = get('list', id), item = get('item', id);
  if (!item) return;
  const q = e ? e.qty : item.qty, u = e ? e.unit : item.unit;
  openSheet(`<h2>${esc(item.name)}</h2><p class="sub">${esc(catName(catOf(item)))}</p>
    <div class="field"><span>Menge</span>${stepper(q)}</div>
    <div class="field"><span>Einheit</span>${unitChips(u)}</div>
    <p class="err" id="fErr" hidden></p>
    <div class="actions">
      <button class="btn primary" type="button" data-act="saveamount" data-id="${esc(id)}">${e && !e.checked ? 'Menge übernehmen' : 'Auf die Liste'}</button>
      ${e ? `<button class="btn" type="button" data-act="unlist" data-id="${esc(id)}">Von der Liste nehmen</button>` : ''}
      <button class="btn quiet" type="button" data-act="edititem" data-id="${esc(id)}">Artikel bearbeiten</button>
    </div>`, 'amount');
}

// „Wie viel?“ – aus Fundus, Suche oder „Oft gekauft“: Menge eingeben, dann ins Lager oder auf die Liste
function openAsk(id, preset = {}) {
  const item = get('item', id);
  if (!item) return;
  const s = get('stock', id), e = listOpen(id);
  const ctx = preset.forceList ? 'liste' : UI.tab;
  const unit = preset.unit || (ctx === 'lager' && s ? s.unit : e ? e.unit : item.unit);
  const status = [s && s.qty > 0 ? 'Im Lager: ' + fmtAmt(s.qty, s.unit) + '.' : 'Nicht im Lager.', e ? 'Auf der Liste: ' + fmtAmt(e.qty, e.unit) + '.' : ''].join(' ');
  const toList = `<button class="btn ${ctx === 'lager' ? '' : 'primary'}" type="button" data-act="asklist" data-id="${esc(id)}">Auf die Liste</button>`;
  const toStock = `<button class="btn ${ctx === 'lager' ? 'primary' : ''}" type="button" data-act="askstock" data-id="${esc(id)}">Ins Lager</button>`;
  openSheet(`<h2>${esc(item.name)}</h2><p class="sub">${esc(status)}</p>
    <div class="field"><span>Wie viel?</span>${stepper(preset.qty > 0 ? preset.qty : null)}</div>
    <div class="field"><span>Einheit</span>${unitChips(unit)}</div>
    <p class="err" id="fErr" hidden></p>
    <div class="actions two">${ctx === 'lager' ? toStock + toList : toList + toStock}</div>
    <div class="actions"><button class="btn quiet" type="button" data-act="edititem" data-id="${esc(id)}">Artikel bearbeiten</button></div>`, 'ask');
  const inp = $('#fQty'); if (inp) inp.focus();
}

// Lager-Eintrag: Bestand genau setzen, Mindestmenge, entfernen
function openStock(id) {
  const item = get('item', id), s = get('stock', id);
  if (!item || !s) return;
  openSheet(`<h2>${esc(item.name)}</h2><p class="sub">Im Zitronenlager</p>
    <div class="field"><span>Bestand</span>${stepper(s.qty, true)}</div>
    <div class="field"><span>Einheit</span>${unitChips(s.unit)}</div>
    <label class="field"><span>Nachkaufen ab</span>
      <input id="fMin" class="text short" inputmode="decimal" value="${esc(s.min > 0 ? fmtQty(s.min) : '')}" placeholder="aus" autocomplete="off"></label>
    <p class="hint">Fällt der Bestand auf diese Menge oder darunter, kommt ${esc(item.name)} automatisch auf die Liste (${esc(fmtAmt(item.qty, item.unit))}). Leer lassen, wenn nicht gewünscht.</p>
    <p class="err" id="fErr" hidden></p>
    <div class="actions">
      <button class="btn primary" type="button" data-act="savestock" data-id="${esc(id)}">Speichern</button>
      <button class="btn" type="button" data-act="asktolist" data-id="${esc(id)}">Auf die Liste setzen</button>
      <button class="btn danger" type="button" data-act="unstock" data-id="${esc(id)}">Aus dem Lager entfernen</button>
      <button class="btn quiet" type="button" data-act="edititem" data-id="${esc(id)}">Artikel bearbeiten</button>
    </div>`, 'stock');
}

function openItemEditor(id, preset) {
  const item = id ? get('item', id) : null;
  const d = item || Object.assign({ name: '', cat: 'c-sonst', qty: 1, unit: 'Stk' }, preset || {});
  const ask = (!item && preset) || {};
  openSheet(`<h2>${item ? 'Artikel bearbeiten' : 'Neuer Artikel'}</h2>
    <label class="field"><span>Name</span><input id="fName" class="text" value="${esc(d.name)}" autocomplete="off" maxlength="60"></label>
    <div class="field"><span>Kategorie (bestimmt den Platz auf der Einkaufsliste)</span>${catChips(d.cat)}</div>
    <div class="field"><span>Übliche Einkaufsmenge</span>${stepper(d.qty)}</div>
    <div class="field"><span>Einheit</span>${unitChips(d.unit)}</div>
    <p class="hint">Die übliche Menge kommt auf die Liste, wenn der Artikel im Lager knapp wird.</p>
    <p class="err" id="fErr" hidden></p>
    <div class="actions">
      <button class="btn primary" type="button" data-act="saveitem" data-id="${esc(id || '')}" data-askq="${esc(ask.askQty || '')}" data-asku="${esc(ask.askUnit || '')}">${item ? 'Speichern' : 'Anlegen'}</button>
      ${item ? `<button class="btn danger" type="button" data-act="delitem" data-id="${esc(id)}">Aus dem Fundus löschen</button>` : ''}
    </div>`, 'item');
  if (!item && !d.name) { const n = $('#fName'); if (n) n.focus(); }
}

function readQty() {
  const v = parseNum($('#fQty').value);
  return v > 0 ? Math.round(v * 1000) / 1000 : NaN;
}
function showErr(msg) { const e = $('#fErr'); e.textContent = msg; e.hidden = false; }

function renderSettings() {
  const scroll = $('.sheet-card').scrollTop;
  const cs = cats();
  $('.sheet-card').innerHTML = `<div class="settings">
    <h2>Einstellungen</h2>
    <section>
      <h3>Abgleich</h3>
      <p id="syncInfo">${esc(syncLine())}</p>
      ${S.code ? `<p>Euer Korb-Code. Wer ihn hat, sieht und ändert eure Liste, also nur untereinander teilen.</p>
      <span class="code">${esc(S.code)}</span>
      <div class="btnrow">
        <button class="btn" type="button" data-act="share">Link teilen</button>
        <button class="btn" type="button" data-act="copycode">Code kopieren</button>
      </div>` : ''}
      <div class="btnrow">
        <button class="btn quiet" type="button" data-act="syncnow">Jetzt abgleichen</button>
        <button class="btn quiet" type="button" data-act="switchcode">Anderen Korb verwenden</button>
      </div>
    </section>
    <section>
      <h3>Laufweg</h3>
      <p>In dieser Reihenfolge sortiert sich die Einkaufsliste, so wie ihr durch den Laden geht. Tippe auf einen Namen, um ihn zu ändern.</p>
      <ol class="order">${cs.map((c, i) => `<li><span class="pos">${i + 1}</span>
        <button class="nm" type="button" data-act="editcat" data-id="${esc(c.id)}">${esc(c.name)}</button>
        <button class="mv" type="button" data-act="mvcat" data-id="${esc(c.id)}" data-d="-1" aria-label="${esc(c.name)} früher" ${i === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 15 6-6 6 6"/></svg></button>
        <button class="mv" type="button" data-act="mvcat" data-id="${esc(c.id)}" data-d="1" aria-label="${esc(c.name)} später" ${i === cs.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg></button>
      </li>`).join('')}</ol>
      <div class="btnrow"><button class="btn" type="button" data-act="newcat">Kategorie hinzufügen</button></div>
    </section>
    <section><p>Zitronenkorb ${VERSION}</p></section>
    <div class="actions"><button class="btn primary" type="button" data-act="close">Fertig</button></div>
  </div>`;
  $('.sheet-card').scrollTop = scroll;
}
function openSettings() { openSheet('', 'settings'); renderSettings(); }

function openCatEditor(id) {
  const c = id ? get('cat', id) : null;
  const n = c ? items().filter((i) => catOf(i) === c.id).length : 0;
  openSheet(`<h2>${c ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2>
    <label class="field"><span>Name</span><input id="fName" class="text" value="${esc(c ? c.name : '')}" maxlength="40" autocomplete="off"></label>
    <p class="err" id="fErr" hidden></p>
    <div class="actions">
      <button class="btn primary" type="button" data-act="savecat" data-id="${esc(id || '')}">${c ? 'Speichern' : 'Hinzufügen'}</button>
      ${c && c.id !== 'c-sonst' ? `<button class="btn danger" type="button" data-act="delcat" data-id="${esc(id)}">Kategorie löschen${n ? ' (' + n + ' Artikel wandern zu „' + esc(catName('c-sonst')) + '“)' : ''}</button>` : ''}
      <button class="btn quiet" type="button" data-act="settings">Zurück</button>
    </div>`, 'cat');
  setTimeout(() => $('#fName') && $('#fName').focus(), 50);
}

function shareLink() { return S.code ? location.origin + location.pathname + '#k=' + S.code : ''; }

function openCodeSheet(first) {
  openSheet(`<h2>${first ? 'Euer Korb ist angelegt' : 'Korb-Code'}</h2>
    <p class="sub">Schick Hanne den Link. Öffnet sie ihn, ist ihr Handy mit diesem Korb verbunden. Hat sie die App schon auf dem Home-Bildschirm, gibt sie dort den Code ein.</p>
    <span class="code">${esc(S.code)}</span>
    <div class="actions">
      <button class="btn lemon" type="button" data-act="share">Link teilen</button>
      <button class="btn" type="button" data-act="copycode">Code kopieren</button>
      <button class="btn quiet" type="button" data-act="close">Später</button>
    </div>`, 'code');
}

// ── Begrüßung und Korb-Code ──
function newCode() { return 'zk-' + [rid(5), rid(5), rid(5), rid(5)].join('-'); }
function cleanCode(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ''); }
function codeFromHash() { const m = location.hash.match(/[#&]k=([a-z0-9-]{20,100})/i); return m ? cleanCode(m[1]) : null; }

function renderWelcome(prefill) {
  const w = $('#welcome');
  w.innerHTML = `<div class="inner">
    <svg class="mark" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="13" fill="#f9e46a" stroke="#d9a800" stroke-width="1.5"/><circle cx="14" cy="14" r="10.2" fill="#f6d31b"/>${[0, 45, 90, 135].map((a) => { const r = (a * Math.PI) / 180, x = 9.4 * Math.cos(r), y = 9.4 * Math.sin(r); return `<line x1="${(14 - x).toFixed(2)}" y1="${(14 - y).toFixed(2)}" x2="${(14 + x).toFixed(2)}" y2="${(14 + y).toFixed(2)}" stroke="#fff8d0" stroke-width="1.3" stroke-linecap="round"/>`; }).join('')}</svg>
    <h1>Zitronen&shy;korb</h1>
    <p>Eure gemeinsame Einkaufsliste. Was einer abhakt, sieht der andere sofort.</p>
    ${prefill ? `<button class="btn lemon" type="button" data-act="join" style="width:100%">Diesem Korb beitreten</button>
      <p class="small" style="margin-top:10px">Code aus dem Link: ${esc(prefill)}</p>
      ${S.code ? `<p class="or">Dieses Handy ist schon mit einem anderen Korb verbunden.</p>
      <button class="btn" type="button" data-act="stay" style="width:100%">Beim bisherigen Korb bleiben</button>`
      : `<p class="or">Oder einen neuen Korb anlegen</p>
      <button class="btn" type="button" data-act="create" style="width:100%">Neuen Korb anlegen</button>`}`
    : `<button class="btn primary" type="button" data-act="create" style="width:100%">Neuen Korb anlegen</button>
      <p class="or">Oder mit Code beitreten</p>
      <div class="joinrow"><input id="joinCode" class="text" placeholder="zk-…" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="btn" type="button" data-act="paste">Einfügen</button></div>
      <p class="err" id="joinErr" hidden></p>
      <button class="btn lemon" type="button" data-act="join" style="width:100%;margin-top:10px">Beitreten</button>`}
    <p class="small">Auf dem iPhone: in Safari „Teilen → Zum Home-Bildschirm“ wählen und die App dann von dort öffnen. Der Home-Bildschirm hat einen eigenen Speicher, deshalb dort einmal den Code eingeben.</p>
  </div>`;
  w.dataset.prefill = prefill || '';
  w.hidden = false;
}

function useCode(code, isNew) {
  const changed = S.code && S.code !== code;
  if (changed) { S.records = {}; S.dirty = {}; S.cursor = 0; S.lastOk = null; S.err = null; applySeeds(); }
  S.code = code; save();
  try { history.replaceState(null, '', location.pathname + '#k=' + code); } catch (e) { /* egal */ }
  $('#welcome').hidden = true;
  render();
  RT.restart();
  Sync.start();
  if (isNew) openCodeSheet(true);
}

async function shareCode() {
  const url = shareLink();
  const text = 'Unser Zitronenkorb. Öffne den Link, dann sind wir verbunden.';
  if (navigator.share) { try { await navigator.share({ title: 'Zitronenkorb', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  await copy(url, 'Link kopiert');
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { toast('Kopieren ging nicht. Bitte den Code markieren und kopieren.'); }
}

// ── Hinweis unten ──
let toastTimer = null, toastUndo = null;
function toast(msg, undo) {
  const t = $('#toast');
  toastUndo = undo || null;
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" data-act="undo">Rückgängig</button>' : ''}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; toastUndo = null; }, undo ? 5000 : 2600);
}

// ── Eingaben ──
function quickAdd() {
  const p = parseEntry(UI.q);
  if (!p.name) return;
  const exact = findItem(p.name);
  if (exact) {
    const u = p.unit || exact.unit;
    if (p.qty && UI.tab === 'liste') { addToList(exact.id, p.qty, u); clearQuery(true); }
    else if (p.qty && UI.tab === 'lager') { addToStock(exact.id, p.qty, u); clearQuery(true); }
    else openAsk(exact.id, p.qty ? { qty: p.qty, unit: u } : {});
    return;
  }
  createFromQuery();
}
function createFromQuery() {
  const p = parseEntry(UI.q);
  if (!p.name) return;
  const name = p.name.charAt(0).toUpperCase() + p.name.slice(1);
  openItemEditor(null, { name, cat: guessCat(name), qty: p.qty || 1, unit: p.unit || 'Stk', askQty: p.qty || null, askUnit: p.qty ? (p.unit || 'Stk') : null });
}
function clearQuery(keepFocus) {
  UI.q = ''; $('#q').value = ''; render();
  if (keepFocus) $('#q').focus(); else $('#q').blur();
}

function askDone(b, where) {
  const q = readQty(), u = picked('unit');
  if (!(q > 0)) { showErr('Bitte eingeben, wie viel. Die Menge muss größer als null sein.'); const i = $('#fQty'); if (i) i.focus(); return; }
  if (!u) return showErr('Bitte eine Einheit wählen.');
  const fromSearch = !!UI.q;
  closeSheet();
  if (where === 'liste') addToList(b.dataset.id, q, u); else addToStock(b.dataset.id, q, u);
  if (fromSearch) clearQuery(true);
}

const actions = {
  check: (b) => {
    const row = b.closest('.row');
    if (row) { row.classList.toggle('done'); }
    setTimeout(() => toggleCheck(b.dataset.id), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
  },
  amount: (b) => openAmount(b.dataset.id),
  ask: (b) => openAsk(b.dataset.id),
  asklist: (b) => askDone(b, 'liste'),
  askstock: (b) => askDone(b, 'lager'),
  asktolist: (b) => openAsk(b.dataset.id, { forceList: true }),
  stockplus: (b) => stepStock(b.dataset.id, 1),
  stockminus: (b) => stepStock(b.dataset.id, -1),
  stockedit: (b) => openStock(b.dataset.id),
  savestock: (b) => {
    const raw = $('#fQty').value.trim();
    const q = raw === '' ? 0 : parseNum(raw), u = picked('unit');
    const mraw = $('#fMin').value.trim(), m = mraw === '' ? null : parseNum(mraw);
    if (!(q >= 0)) return showErr('Bitte einen Bestand von null oder mehr eingeben.');
    if (m !== null && !(m >= 0)) return showErr('„Nachkaufen ab“ bitte als Zahl eingeben oder leer lassen.');
    if (!u) return showErr('Bitte eine Einheit wählen.');
    closeSheet();
    setStock(b.dataset.id, q, u, m);
  },
  unstock: (b) => { closeSheet(); removeFromStock(b.dataset.id); },
  edititem: (b) => openItemEditor(b.dataset.id),
  newitem: () => openItemEditor(null, { cat: 'c-sonst' }),
  createfromq: () => createFromQuery(),
  finish: () => finishTrip(),
  jump: (b) => { const g = document.getElementById('L-' + b.dataset.id); if (g) g.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); },
  close: () => closeSheet(),
  undo: () => { const u = toastUndo; $('#toast').hidden = true; toastUndo = null; if (u) u(); },
  pick: (b) => {
    document.querySelectorAll(`#sheet [data-group="${b.dataset.group}"]`).forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); x.setAttribute('aria-checked', String(x === b)); });
  },
  step: (b) => {
    const u = picked('unit') || 'Stk';
    const inp = $('#fQty'), zero = inp.dataset.zero === '1', d = Number(b.dataset.d);
    let q = parseNum(inp.value); if (!(q > 0)) q = 0;
    const st = stepFor(u, d < 0 ? Math.max(0, q - 0.0001) : q);
    q = Math.round((q + st * d) / st) * st;
    q = Math.max(zero ? 0 : st, q);
    $('#fQty').value = fmtQty(Math.round(q * 1000) / 1000);
  },
  saveamount: (b) => {
    const q = readQty(), u = picked('unit');
    if (!(q > 0)) return showErr('Bitte eine Menge größer als null eingeben.');
    if (!u) return showErr('Bitte eine Einheit wählen.');
    closeSheet();
    const e = get('list', b.dataset.id);
    if (e && !e.checked) tx(() => put('list', Object.assign({}, e, { qty: q, unit: u })));
    else addToList(b.dataset.id, q, u);
  },
  unlist: (b) => { closeSheet(); removeFromList(b.dataset.id); },
  saveitem: (b) => {
    const name = $('#fName').value.trim().replace(/\s+/g, ' ');
    const q = readQty(), u = picked('unit'), cat = picked('cat') || 'c-sonst';
    if (!name) return showErr('Bitte einen Namen eingeben.');
    if (!(q > 0)) return showErr('Bitte eine übliche Menge größer als null eingeben.');
    if (!u) return showErr('Bitte eine Einheit wählen.');
    const id = b.dataset.id;
    const dupe = findItem(name);
    if (dupe && dupe.id !== id && norm(dupe.name) === norm(name)) return showErr('„' + dupe.name + '“ gibt es schon im Fundus.');
    closeSheet();
    if (id) {
      const it = get('item', id);
      tx(() => put('item', Object.assign({}, it, { name, cat, qty: q, unit: u })));
      toast(name + ' gespeichert');
    } else {
      const nid = 'u-' + rid(10);
      tx(() => put('item', { id: nid, name, cat, qty: q, unit: u, uses: 0, created: Date.now() }));
      if (UI.q) { UI.q = ''; $('#q').value = ''; render(); }
      // gleich weiter: wie viel und wohin?
      openAsk(nid, { qty: parseNum(b.dataset.askq) || null, unit: b.dataset.asku || u });
    }
  },
  delitem: (b) => {
    const it = get('item', b.dataset.id);
    closeSheet();
    const undo = tx(() => { del('item', b.dataset.id); if (get('list', b.dataset.id)) del('list', b.dataset.id); });
    toast((it ? it.name : 'Artikel') + ' ist gelöscht', undo);
  },
  settings: () => openSettings(),
  syncnow: () => { RT.connect(); Sync.run(); },
  share: () => shareCode(),
  copycode: () => copy(S.code, 'Code kopiert'),
  switchcode: () => {
    openSheet(`<h2>Anderen Korb verwenden</h2>
      <p class="sub">Gib den Code des anderen Korbs ein. Die Liste auf diesem Handy wird dann durch dessen Liste ersetzt.</p>
      <label class="field"><span>Korb-Code</span><input id="fCode" class="text" placeholder="zk-…" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <p class="err" id="fErr" hidden></p>
      <div class="actions"><button class="btn primary" type="button" data-act="dojoin">Wechseln</button>
      <button class="btn quiet" type="button" data-act="settings">Zurück</button></div>`, 'switch');
  },
  dojoin: () => {
    const c = cleanCode($('#fCode').value);
    if (!/^[a-z0-9-]{20,100}$/.test(c)) return showErr('Der Code ist zu kurz oder enthält ungültige Zeichen.');
    closeSheet(); useCode(c, false); toast('Verbunden mit dem anderen Korb');
  },
  mvcat: (b) => {
    const cs = cats(); const i = cs.findIndex((c) => c.id === b.dataset.id); const j = i + Number(b.dataset.d);
    if (i < 0 || j < 0 || j >= cs.length) return;
    // Reihenfolge neu durchnummerieren, damit gleiche Werte nie hängen bleiben
    const order = cs.slice(); const [x] = order.splice(i, 1); order.splice(j, 0, x);
    tx(() => order.forEach((c, k) => { if (c.order !== (k + 1) * 10) put('cat', Object.assign({}, c, { order: (k + 1) * 10 })); }));
  },
  editcat: (b) => openCatEditor(b.dataset.id),
  newcat: () => openCatEditor(null),
  savecat: (b) => {
    const name = $('#fName').value.trim().replace(/\s+/g, ' ');
    if (!name) return showErr('Bitte einen Namen eingeben.');
    const id = b.dataset.id;
    if (cats().some((c) => c.id !== id && norm(c.name) === norm(name))) return showErr('Diese Kategorie gibt es schon.');
    if (id) tx(() => put('cat', Object.assign({}, get('cat', id), { name })));
    else {
      const sonst = get('cat', 'c-sonst'); const cs = cats();
      // neue Kategorie vor „Besorgungen & Sonstiges“ einsortieren
      const before = sonst ? sonst.order : (cs.length + 1) * 10;
      const prev = cs.filter((c) => c.order < before).pop();
      tx(() => put('cat', { id: 'c-' + rid(8), name, order: prev ? (prev.order + before) / 2 : before - 5 }));
    }
    openSettings();
  },
  delcat: (b) => {
    const id = b.dataset.id; const c = get('cat', id);
    const undo = tx(() => {
      items().filter((i) => i.cat === id).forEach((i) => put('item', Object.assign({}, i, { cat: 'c-sonst' })));
      del('cat', id);
    });
    openSettings();
    toast('Kategorie ' + (c ? c.name : '') + ' gelöscht', undo);
  },
  create: () => useCode(newCode(), true),
  stay: () => { $('#welcome').hidden = true; history.replaceState(null, '', location.pathname + '#k=' + S.code); },
  join: () => {
    const w = $('#welcome');
    const c = w.dataset.prefill || cleanCode(($('#joinCode') || {}).value);
    if (!/^[a-z0-9-]{20,100}$/.test(c)) { const e = $('#joinErr'); if (e) { e.textContent = 'Bitte den ganzen Code eingeben, er beginnt mit „zk-“.'; e.hidden = false; } return; }
    useCode(c, false);
    toast('Verbunden. Die Liste wird geladen.');
  },
  paste: async () => {
    try { const t = await navigator.clipboard.readText(); const m = String(t).match(/zk-[a-z0-9-]{17,97}/i); $('#joinCode').value = m ? m[0].toLowerCase() : cleanCode(t); } catch (e) { $('#joinCode').focus(); }
  },
};

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]');
  if (b && actions[b.dataset.act]) { ev.preventDefault(); actions[b.dataset.act](b); return; }
  const tab = ev.target.closest('.tabs button');
  if (tab) {
    UI.tab = tab.dataset.tab;
    if (UI.q) { UI.q = ''; $('#q').value = ''; }
    render(); window.scrollTo(0, 0);
  }
});
$('#q').addEventListener('input', (e) => { UI.q = e.target.value; render(); });
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); quickAdd(); } if (e.key === 'Escape') clearQuery(false); });
$('#qClear').addEventListener('click', () => clearQuery(true));
$('#syncBtn').addEventListener('click', openSettings);
$('#setBtn').addEventListener('click', openSettings);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  if (e.key === 'Enter' && !$('#sheet').hidden && e.target.matches('#sheet input')) {
    e.preventDefault();
    const p = $('#sheet .btn.primary'); if (p) p.click();
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { RT.connect(); Sync.schedule(50); } });
window.addEventListener('online', () => { RT.connect(); Sync.schedule(50); });
window.addEventListener('offline', () => { S.err = 'offline'; renderStatus(); });
window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) { const n = loadState(); if (n) { S = Object.assign(S, n); render(); } } });

// ── Start ──
applySeeds();
save();
// Der Code bleibt bewusst in der Adresse: So übernimmt „Zum Home-Bildschirm“ auf dem iPhone ihn gleich mit.
const hashCode = codeFromHash();
if (!S.code || (hashCode && hashCode !== S.code)) renderWelcome(hashCode);
render();
if (S.code) { RT.connect(); Sync.start(); }
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
