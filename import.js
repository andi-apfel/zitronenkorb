'use strict';
/* Zitronenkorb – Rezept aus Link importieren
   Die Supabase-Funktion „zk-recipe“ lädt die Seite und liefert Titel, Portionen, Zutaten und Schritte.
   Danach öffnet sich der Rezept-Editor vorbefüllt: prüfen, Zutaten-Zuordnung ansehen, speichern. */

const isUrl = (s) => /^https?:\/\/\S+\.\S+/i.test(String(s || '').trim());
const hostOf = (s) => { try { return new URL(s).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

function openImport(prefill) {
  openSheet(`<h2>Rezept aus Link importieren</h2>
    <p class="sub">Link zu einem Rezept, zum Beispiel von Chefkoch oder gutekueche.at. Die App liest Zutaten und Zubereitung aus, du prüfst alles vor dem Speichern.</p>
    <label class="field"><span>Link</span><input id="fLink" class="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…" value="${esc(prefill || '')}"></label>
    <div class="btnrow"><button class="btn" type="button" data-act="pastelink">Link einfügen</button></div>
    <div id="impMsg"></div>
    <p class="err" id="fErr" hidden></p>
    <div class="actions"><button class="btn primary" type="button" data-act="doimport" id="impGo">Rezept laden</button>
      <button class="btn quiet" type="button" data-act="close">Abbrechen</button></div>`, 'import');
  if (!prefill) { const i = $('#fLink'); if (i) i.focus(); }
}

const IMPORT_ERRORS = {
  blocked: 'Diese Seite lässt den automatischen Abruf nicht zu.',
  no_recipe: 'Auf der Seite wurden keine Rezeptdaten gefunden.',
  timeout: 'Die Seite hat zu lange gebraucht.',
  bad_url: 'Dieser Link lässt sich nicht verwenden.',
  not_deployed: 'Die Import-Funktion ist in Supabase noch nicht eingerichtet.',
  needs_jwt: 'Die Import-Funktion verlangt noch eine Anmeldung. In Supabase bei der Funktion „zk-recipe“ die Einstellung „Verify JWT“ ausschalten.',
  offline: 'Keine Verbindung. Bitte später nochmal versuchen.',
};

async function fetchRecipe(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(CFG.url.replace(/\/+$/, '') + '/functions/v1/zk-recipe', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', apikey: CFG.key },
      body: JSON.stringify({ url }),
    });
    let body = null; try { body = await res.json(); } catch (e) { /* kein JSON */ }
    if (res.ok && body && Array.isArray(body.ingredients)) return body;
    if (res.status === 404 && !(body && body.error)) throw Object.assign(new Error(), { code: 'not_deployed' });
    if (res.status === 401) throw Object.assign(new Error(), { code: 'needs_jwt' });
    throw Object.assign(new Error((body && body.message) || 'Fehler ' + res.status), { code: (body && body.error) || 'failed' });
  } catch (e) {
    if (e && e.name === 'AbortError') throw Object.assign(new Error(), { code: 'timeout' });
    if (e && e.code) throw e;
    throw Object.assign(new Error(String(e && e.message || e)), { code: navigator.onLine === false ? 'offline' : 'failed' });
  } finally { clearTimeout(t); }
}

function showImportFallback(url, code, message) {
  const host = hostOf(url);
  const msg = IMPORT_ERRORS[code] || (message ? 'Das hat nicht geklappt: ' + message : 'Das hat nicht geklappt.');
  const box = $('#impMsg');
  if (!box) return;
  box.innerHTML = `<div class="importfail"><p><b>${esc(msg)}</b></p>
    ${code === 'not_deployed' || code === 'needs_jwt' ? '' : `<p>So geht es trotzdem: Öffne die Seite${host ? ' auf ' + esc(host) : ''}, markiere die Zutatenliste, kopiere sie und füge sie im nächsten Schritt ein.</p>`}
    <button class="btn" type="button" data-act="manualimport">Zutaten selbst einfügen</button></div>`;
}

Object.assign(actions, {
  importrecipe: () => openImport(isUrl(UI.q) ? UI.q.trim() : ''),
  pastelink: async () => {
    try { const t = await navigator.clipboard.readText(); const m = String(t).match(/https?:\/\/\S+/i); if (m) $('#fLink').value = m[0]; else $('#fLink').focus(); }
    catch (e) { $('#fLink').focus(); }
  },
  doimport: async () => {
    const url = ($('#fLink').value || '').trim();
    if (!isUrl(url)) return showErr('Bitte einen vollständigen Link einfügen, er beginnt mit https://');
    $('#fErr').hidden = true;
    const go = $('#impGo'); go.disabled = true; go.textContent = 'Rezept wird geladen …';
    $('#impMsg').innerHTML = '';
    try {
      const r = await fetchRecipe(url);
      if (UI.q) { UI.q = ''; $('#q').value = ''; render(); }
      openRecipeEditor(null, {
        title: r.title || '', servings: r.servings || 2, ingsText: r.ingredients.join('\n'), steps: r.steps || [],
        url: r.url || url, tags: (r.tags || []).slice(0, 4),
        banner: 'Importiert von ' + (r.host || hostOf(url)) + '. Bitte kurz prüfen, vor allem die Zuordnung der Zutaten, dann speichern.',
      });
    } catch (e) {
      if (!$('#impGo')) return; // Dialog inzwischen geschlossen
      go.disabled = false; go.textContent = 'Nochmal versuchen';
      showImportFallback(url, e.code, e.message);
    }
  },
  manualimport: () => {
    const url = ($('#fLink') && $('#fLink').value || '').trim();
    openRecipeEditor(null, { url: isUrl(url) ? url : '', focusIngs: true, banner: 'Zutatenliste von der Webseite hier einfügen, eine Zutat pro Zeile. Die App ordnet sie dem Fundus zu.' });
  },
});

// Link ins Suchfeld der Rezepte eingefügt → direkt zum Import anbieten
const _renderRecipeSearchImport = renderRecipeSearch;
renderRecipeSearch = function () {
  if (isUrl(UI.q)) return `<button class="create" type="button" data-act="importrecipe"><b>Rezept von ${esc(hostOf(UI.q.trim()))} importieren</b><span>Zutaten und Zubereitung werden ausgelesen, du prüfst vor dem Speichern.</span></button>`;
  return _renderRecipeSearchImport();
};
const _quickAddImport = quickAdd;
quickAdd = function () { if (UI.tab === 'rezepte' && isUrl(UI.q)) { openImport(UI.q.trim()); return; } _quickAddImport(); };
render();
