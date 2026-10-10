# Zitronenkorb

Gemeinsame Einkaufsliste von Hanne und Andi. Schwesterprojekt der [Zitronenpresse](https://github.com/andi-apfel/zitronenpresse).

- **App:** https://andi-apfel.github.io/zitronenkorb/ (aufs iPhone per Safari „Teilen → Zum Home-Bildschirm“)
- **Funktionen (Stufe 1):** Fundus mit wiederkehrenden Artikeln, Einkaufsliste nach Laufweg sortiert, Mengen (Pflicht),
  Abhaken mit „Im Korb“, Einkauf abschließen, Rückgängig, Live-Abgleich zwischen beiden Handys, offline nutzbar.
- **Dateien:** `index.html` (Gerüst), `app.css` (Gestaltung), `app.js` (Logik und Abgleich), `seed.js` (Startkategorien und
  vegetarischer Grundfundus), `config.js` (öffentliche Supabase-Adresse), `sw.js` (Offline-Speicher).
- **Daten:** Supabase, Projekt der Zitronenpresse. Tabelle `zk_records` ist gesperrt; Zugriff nur über die Funktionen
  `zk_pull`/`zk_push` mit dem geheimen Korb-Code (gespeichert wird nur dessen Hash). Einrichtung: `supabase/schema.sql`
  einmal im SQL-Editor ausführen. Live-Hinweise laufen über Supabase Realtime (Broadcast), die Daten selbst immer über die Funktionen.

## Geplant

1. ~~Einkaufsliste mit Fundus, Laufweg und Abgleich~~
2. Vorrat (Abgehaktes wandert automatisch hinein, Mindestmengen setzen Artikel wieder auf die Liste) und Rezepte mit Übertrag
3. Barcode-Scan (Open Food Facts)
4. Rezept-Import per Link (strukturierte Rezeptdaten der Seite, Notausgang: Zutatenliste einfügen)
5. Anschaffungen (Möbel und Größeres)
