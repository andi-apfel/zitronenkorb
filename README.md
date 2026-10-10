# Zitronenkorb

Gemeinsame Einkaufsliste von Hanne und Andi. Schwesterprojekt der [Zitronenpresse](https://github.com/andi-apfel/zitronenpresse).

- **App:** https://andi-apfel.github.io/zitronenkorb/ (aufs iPhone per Safari „Teilen → Zum Home-Bildschirm“)
- **Einkaufsliste:** was zu besorgen ist, nach Laufweg sortiert, Mengen Pflicht, Abhaken in den Korb.
  „Einkauf abschließen“ bucht alles Abgehakte ins Zitronenlager.
- **Zitronenlager:** alles in Küche und Vorrat, alphabetisch, Plus/Minus pro Artikel. „Nachkaufen ab“ setzt einen Artikel
  automatisch auf die Liste, sobald der Bestand darauf fällt.
- **Fundus:** alle bekannten Artikel alphabetisch als Schnellauswahl. Antippen → „Wie viel?“ → ins Lager oder auf die Liste.
- Rückgängig, Live-Abgleich zwischen beiden Handys, offline nutzbar.
- **Dateien:** `index.html` (Gerüst), `app.css` (Gestaltung), `app.js` (Logik und Abgleich), `seed.js` (Startkategorien und
  vegetarischer Grundfundus), `config.js` (öffentliche Supabase-Adresse), `sw.js` (Offline-Speicher).
- **Daten:** Supabase, Projekt der Zitronenpresse. Tabelle `zk_records` ist gesperrt; Zugriff nur über die Funktionen
  `zk_pull`/`zk_push` mit dem geheimen Korb-Code (gespeichert wird nur dessen Hash). Einrichtung: `supabase/schema.sql`
  einmal im SQL-Editor ausführen. Live-Hinweise laufen über Supabase Realtime (Broadcast), die Daten selbst immer über die Funktionen.

## Geplant

1. ~~Einkaufsliste mit Fundus, Laufweg und Abgleich~~
2. ~~Zitronenlager mit Übernahme aus dem Einkauf und Mindestmengen~~
   Rezepte mit Übertrag auf die Liste und Abgleich mit dem Lager
3. Barcode-Scan (Open Food Facts)
4. Rezept-Import per Link (strukturierte Rezeptdaten der Seite, Notausgang: Zutatenliste einfügen)
5. Anschaffungen (Möbel und Größeres)
