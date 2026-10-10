# Zitronenkorb

Gemeinsame Einkaufsliste von Hanne und Andi. Schwesterprojekt der [Zitronenpresse](https://github.com/andi-apfel/zitronenpresse).

- **App:** https://andi-apfel.github.io/zitronenkorb/ (aufs iPhone per Safari „Teilen → Zum Home-Bildschirm“)
- **Einkaufsliste:** was zu besorgen ist, nach Laufweg sortiert, Mengen Pflicht, Abhaken in den Korb.
  „Einkauf abschließen“ bucht alles Abgehakte ins Zitronenlager.
- **Zitronenlager:** alles in Küche und Vorrat, alphabetisch, Plus/Minus pro Artikel. „Nachkaufen ab“ setzt einen Artikel
  automatisch auf die Liste, sobald der Bestand darauf fällt.
- **Fundus:** alle bekannten Artikel alphabetisch als Schnellauswahl. Antippen → „Wie viel?“ → ins Lager oder auf die Liste.
- **Rezepte:** Zutaten Zeile für Zeile eintippen oder einfügen („500 g Spaghetti“, „½ TL Salz“, „2 Zehen Knoblauch“),
  die App ordnet sie dem Fundus zu und warnt bei vermutlich nicht vegetarischen Zutaten. Portionen umrechnen,
  Abgleich mit dem Lager, „Fehlendes auf die Liste“ mit Vorauswahl, „Gekocht“ zieht die Zutaten vom Lager ab.
- **Rezept-Import per Link:** „Rezept aus Link importieren“ (oder Link ins Suchfeld der Rezepte einfügen). Die Supabase-Funktion
  `zk-recipe` liest die schema.org-Rezeptdaten der Seite (Chefkoch, gutekueche.at u. v. m.), der Editor öffnet sich vorbefüllt zum Prüfen.
  Sperrt eine Seite den Abruf: „Zutaten selbst einfügen“.
- **Was geht heute?** Vorschläge oben im Rezepte-Bereich, abgeleitet aus dem Lager: eigene Rezepte und 30 eingebaute
  vegetarische Rezeptideen, bewertet nach Abdeckung (Grundzutaten wie Salz/Öl/Gewürze zählen wenig), fehlenden Hauptzutaten
  und frischen Zutaten, die verbraucht werden; kürzlich Gekochtes rückt nach hinten. Ideen lassen sich übernehmen.
- **Wochenplan:** Rezepte auf Tage legen, „Fehlendes für die Woche auf die Liste“ fasst alles zusammen.
- **Sprache:** Mikrofon im Suchfeld. Frei sprechen oder diktieren („Im Lager haben wir zwei Liter Milch, wir brauchen
  Butter, die Haferflocken sind alle“); Vorschau mit Ziel je Eintrag, Mengen änderbar. Ins Lager gilt die genannte Menge als Bestand.
- Rückgängig, Live-Abgleich zwischen beiden Handys, offline nutzbar.
- **Dateien:** `index.html` (Gerüst), `app.css` (Gestaltung), `app.js` (Logik und Abgleich), `recipes.js` (Rezepte und Wochenplan), `catalog.js` (Rezeptideen und Vorschläge), `import.js` (Rezept-Import), `voice.js` (Spracherfassung), `seed.js` (Startkategorien und
  vegetarischer Grundfundus), `config.js` (öffentliche Supabase-Adresse), `sw.js` (Offline-Speicher).
- **Daten:** Supabase, Projekt der Zitronenpresse. Tabelle `zk_records` ist gesperrt; Zugriff nur über die Funktionen
  `zk_pull`/`zk_push` mit dem geheimen Korb-Code (gespeichert wird nur dessen Hash). Einrichtung: `supabase/schema.sql`
  einmal im SQL-Editor ausführen. Rezept-Import: `supabase/functions/zk-recipe/index.ts` als Edge Function „zk-recipe“
  anlegen, „Verify JWT“ aus. Live-Hinweise laufen über Supabase Realtime (Broadcast), die Daten selbst immer über die Funktionen.

## Geplant

Fokus: Lebensmittel und Haushaltsbedarf.


1. ~~Einkaufsliste mit Fundus, Laufweg und Abgleich~~
2. ~~Zitronenlager mit Übernahme aus dem Einkauf und Mindestmengen~~, ~~Rezepte und Wochenplan~~
3. Barcode-Scan (Open Food Facts)
4. ~~Rezept-Import per Link~~
