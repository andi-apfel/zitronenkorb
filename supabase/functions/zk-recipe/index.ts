// @ts-nocheck
// Zitronenkorb – Rezept-Import
// Lädt eine Rezeptseite und gibt nur die Rezeptdaten zurück (Titel, Portionen, Zutaten, Schritte).
// Die meisten Rezeptseiten (Chefkoch, gutekueche.at, …) beschreiben ihr Rezept maschinenlesbar nach schema.org.
// Einrichtung: Supabase-Dashboard → Edge Functions → neue Funktion „zk-recipe“, diesen Code einfügen, „Verify JWT“ ausschalten.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_BYTES = 4 * 1024 * 1024;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

function fail(code, status, message) { return Object.assign(new Error(message || code), { code, status }); }

export function checkUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (_) { throw fail('bad_url', 400, 'Das ist kein gültiger Link.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw fail('bad_url', 400, 'Nur http- und https-Links.');
  if (u.port && u.port !== '80' && u.port !== '443') throw fail('bad_url', 400, 'Ungewöhnlicher Port.');
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal|lan)$/.test(h)) throw fail('bad_url', 400, 'Dieser Link ist nicht erlaubt.');
  return u;
}

async function load(u) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(u.href, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5' } });
    if (res.status === 401 || res.status === 403 || res.status === 429) throw fail('blocked', 502, 'Die Seite lässt den Abruf nicht zu.');
    if (!res.ok) throw fail('http_' + res.status, 502, 'Die Seite antwortet mit Fehler ' + res.status + '.');
    checkUrl(res.url || u.href); // auch nach Weiterleitungen nur öffentliche Adressen
    const reader = res.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { try { await reader.cancel(); } catch (_) { /* egal */ } break; }
      chunks.push(value);
    }
    const buf = new Uint8Array(size > MAX_BYTES ? MAX_BYTES : size); let o = 0;
    for (const c of chunks) { const n = Math.min(c.length, buf.length - o); buf.set(c.subarray(0, n), o); o += n; if (o >= buf.length) break; }
    return new TextDecoder('utf-8').decode(buf);
  } catch (e) {
    if (e && e.name === 'AbortError') throw fail('timeout', 504, 'Die Seite hat zu lange gebraucht.');
    throw e;
  } finally { clearTimeout(t); }
}

// ── Aufbereiten ──
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', deg: '°', ndash: '–', mdash: '—', hellip: '…', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' };
export function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+\d*);/gi, (m, n) => (n in ENT ? ENT[n] : m));
}
export function clean(s) {
  return decode(String(s == null ? '' : s).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n').replace(/<\/?(b|i|em|strong|span|a|u|small|sup|sub)\b[^>]*>/gi, '').replace(/<[^>]+>/g, ' '))
    .replace(/\u00ad/g, '').replace(/[ \t\u00a0]+/g, ' ').replace(/ ([.,;:!?])/g, '$1').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}
const typeIs = (n, t) => n && (n['@type'] === t || (Array.isArray(n['@type']) && n['@type'].includes(t)));

function findRecipeNode(node, depth = 0) {
  if (!node || depth > 8) return null;
  if (Array.isArray(node)) { for (const x of node) { const r = findRecipeNode(x, depth + 1); if (r) return r; } return null; }
  if (typeof node !== 'object') return null;
  if (typeIs(node, 'Recipe')) return node;
  for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    if (node[k]) { const r = findRecipeNode(node[k], depth + 1); if (r) return r; }
  }
  return null;
}
function parseJson(txt) {
  const t = decode(txt).trim().replace(/^<!--|-->$/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ');
  try { return JSON.parse(t); } catch (_) { /* weiter */ }
  try { return JSON.parse(t.replace(/\n/g, ' ')); } catch (_) { return null; }
}
function steps(instr) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (typeof x === 'string') { clean(x).split('\n').forEach((s) => { s = s.trim(); if (s) out.push(s); }); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeIs(x, 'HowToSection') || x.itemListElement) { if (x.name && typeIs(x, 'HowToSection')) out.push(clean(x.name) + ':'); walk(x.itemListElement); return; }
    walk(x.text || x.name || '');
  };
  walk(instr);
  return out.filter((s, i) => s && s !== out[i - 1]).slice(0, 60);
}
function servings(y) {
  const vals = Array.isArray(y) ? y : [y];
  for (const v of vals) { const m = String(v == null ? '' : v).match(/\d+/); if (m) { const n = Number(m[0]); if (n > 0 && n < 100) return n; } }
  return null;
}
const list = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const textOf = (x) => (typeof x === 'string' ? x : x && (x.name || x.text) ? (x.name || x.text) : '');

export function extractRecipe(html, pageUrl) {
  let node = null;
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while (!node && (m = re.exec(html))) { const j = parseJson(m[1]); node = findRecipeNode(j); }
  let r = null;
  if (node) {
    r = {
      title: clean(textOf(node.name) || textOf(node.headline)),
      servings: servings(node.recipeYield || node.yield),
      ingredients: list(node.recipeIngredient || node.ingredients).map((s) => clean(textOf(s))).filter(Boolean),
      steps: steps(node.recipeInstructions),
      tags: [...list(node.recipeCategory), ...list(node.recipeCuisine)].map((s) => clean(textOf(s))).filter((s) => s && s.length < 30).slice(0, 4),
      via: 'json-ld',
    };
  } else {
    // Ersatz: Microdata (itemprop="recipeIngredient")
    const ings = [];
    const ire = /<([a-z0-9]+)[^>]*itemprop\s*=\s*["'](?:recipeIngredient|ingredients)["'][^>]*>([\s\S]*?)<\/\1>/gi;
    while ((m = ire.exec(html))) { const s = clean(m[2]); if (s) ings.push(s); }
    if (ings.length) {
      const nm = html.match(/itemprop\s*=\s*["']name["'][^>]*>([\s\S]*?)</i) || html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i) || html.match(/<title>([\s\S]*?)<\/title>/i);
      const st = []; const sre = /<([a-z0-9]+)[^>]*itemprop\s*=\s*["']recipeInstructions["'][^>]*>([\s\S]*?)<\/\1>/gi;
      while ((m = sre.exec(html))) st.push(...steps(m[2]));
      const y = html.match(/itemprop\s*=\s*["']recipeYield["'][^>]*?(?:content=["']([^"']+)["'][^>]*>|>([^<]*)<)/i);
      r = { title: nm ? clean(nm[1]) : '', servings: y ? servings(y[1] || y[2]) : null, ingredients: ings, steps: st, tags: [], via: 'microdata' };
    }
  }
  if (!r || !r.ingredients.length) return null;
  r.ingredients = r.ingredients.slice(0, 80).map((s) => s.replace(/\n+/g, ' '));
  if (/chefkoch\./.test(pageUrl)) r.title = r.title.replace(/\s+von\s+\S+$/, ''); // Chefkoch hängt den Autor an
  r.title = r.title.slice(0, 120);
  r.url = pageUrl;
  r.host = new URL(pageUrl).hostname.replace(/^www\./, '');
  return r;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS) });
}

export async function handle(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const u = checkUrl(body.url);
    const html = await load(u);
    const r = extractRecipe(html, u.href);
    if (!r) return json({ error: 'no_recipe', message: 'Auf der Seite wurden keine Rezeptdaten gefunden.' }, 422);
    return json(r);
  } catch (e) {
    return json({ error: (e && e.code) || 'failed', message: (e && e.message) || 'Unbekannter Fehler' }, (e && e.status) || 500);
  }
}

if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(handle);
