# Bundeslebensmittelschlüssel (BLS) 4.0 – primäre Lebensmitteldatenbank (Phase 4.4)

## Überblick

Die normale Lebensmittelsuche in Kalethra ist **vollständig offline**. Sie durchsucht in dieser
Reihenfolge:

1. eigene Lebensmittel (`custom`, auch eigene Kopien)
2. gespeicherte Produkte aus Open Food Facts (`external`)
3. den Bundeslebensmittelschlüssel (BLS) 4.0 des Max Rubner-Instituts, der in der App enthalten ist

Open Food Facts ist **nur noch Barcode-Fallback** (siehe [OPEN_FOOD_FACTS.md](OPEN_FOOD_FACTS.md)).
Es gibt keine Online-Suche und keine Anbieterauswahl in der Oberfläche.

```
AddSheet ── FoodLookupService.search ──┬── FoodService.list   (SQLite, eigene + gespeicherte)
                                       └── BlsCatalog.search  (gebündelte Daten, im Speicher)
Auswahl BLS ─ FoodLookupService.useReference ─ FoodService.ensureReference (legt Zeile einmalig an)
```

## Quelle und Lizenz

| Angabe      | Wert                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------- |
| Datensatz   | Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank                 |
| Herausgeber | Max Rubner-Institut (MRI), Bundesforschungsinstitut für Ernährung und Lebensmittel           |
| Bezug       | <https://blsdb.de> → Download (offizielle Seite des MRI)                                     |
| Datei       | `BLS_4_0_Daten_2025_DE.xlsx` (Tabellenblatt mit einer Kopfzeile, eine Zeile je Lebensmittel) |
| Lizenz      | Creative Commons Namensnennung 4.0 International (CC BY 4.0)                                 |
| Bezugsgröße | alle Werte je 100 g essbarer Anteil                                                          |

**Pflicht-Namensnennung** (in der App unter Profil → Über Kalethra → Datenquellen, in der
Mengenansicht und beim Kopieren eines BLS-Lebensmittels):

> Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche
> Nährstoffdatenbank. Lizenz: CC BY 4.0. Für Kalethra auf die Hauptnährwerte reduziert; die
> übernommenen Werte sind unverändert.

Die Reduktion auf wenige Nährwerte und das Weglassen unvollständiger Datensätze sind
Bearbeitungen im Sinne von CC BY 4.0 und werden deshalb genannt.

## Import (reproduzierbar)

Die XLSX-Datei wird **nie zur Laufzeit** gelesen. Ein Skript erzeugt einmalig kompakte Daten, die
mit der App ausgeliefert werden.

```bash
# 1. Offizielle Datei von https://blsdb.de/download herunterladen und ablegen unter:
#    data/bls/source/BLS_4_0_Daten_2025_DE.xlsx   (nicht im Repository, siehe .gitignore)
# 2. Import ausführen (Node 22, keine zusätzlichen Pakete):
node scripts/nutrition/import-bls.ts
#    oder mit anderem Pfad:
node scripts/nutrition/import-bls.ts pfad/zur/datei.xlsx
```

| Datei                                  | Inhalt                                                                |
| -------------------------------------- | --------------------------------------------------------------------- |
| `scripts/nutrition/xlsx.ts`            | minimaler XLSX-Leser (ZIP + XML, nur `node:zlib`, keine Abhängigkeit) |
| `scripts/nutrition/bls-mapping.ts`     | reine Zuordnung BLS → Kalethra inkl. Plausibilitätsprüfung            |
| `scripts/nutrition/import-bls.ts`      | Kommandozeile: liest die Datei, schreibt Daten und Bericht            |
| `src/core/nutrition/bls/data/bls.json` | **erzeugt** – kompakte Laufzeitdaten (`meta`, `fields`, `foods`)      |
| `data/bls/IMPORT_REPORT.md`            | **erzeugt** – Prüfsumme, Anzahl, übersprungene Datensätze mit Grund   |
| `tests/fixtures/bls-synthetic.xlsx`    | synthetische Testdatei im BLS-Tabellenformat (keine echten Werte)     |

- `meta` enthält Datensatz, Version, Herausgeber, Lizenz, Namensnennung, Dateiname,
  **SHA-256** der Quelldatei, Importdatum und Anzahl.
- Dieselbe Quelldatei erzeugt immer dieselben Daten (sortiert nach BLS-Code); nur das
  Importdatum ändert sich.
- Ein unerwarteter Tabellenaufbau (fehlende Pflichtspalte, unbekannte Einheit) bricht den Import
  mit einer klaren Meldung ab, statt still falsche Werte zu erzeugen.

### Zuordnung

| Kalethra              | BLS-Komponente (Spaltenkopf `CODE Name [Einheit/100g]`) | Umrechnung             |
| --------------------- | ------------------------------------------------------- | ---------------------- |
| BLS-Code              | Spalte „BLS Code“                                       | –                      |
| Name (deutsch)        | „Lebensmittelbezeichnung“                               | –                      |
| Name (englisch)       | „Food name“, falls vorhanden (nur für die Suche)        | –                      |
| Energie (kcal)        | `ENERCC`                                                | kcal                   |
| Protein               | `PROT625`                                               | g, mg ÷ 1000, µg ÷ 10⁶ |
| Kohlenhydrate         | `CHO`                                                   | wie oben               |
| Fett                  | `FAT`                                                   | wie oben               |
| Ballaststoffe         | `FIBT`                                                  | wie oben               |
| Zucker                | `SUGAR`                                                 | wie oben               |
| Gesättigte Fettsäuren | `FASAT`                                                 | wie oben               |

Werte werden auf zwei Nachkommastellen gerundet (wie alle Nährwerte in Kalethra).

### Fehlende Werte, Spurenwerte, Plausibilität

- **Leere Zelle = nicht angegeben → `null`, nie 0.** In der App steht dann „nicht angegeben“.
- **Spuren / unter der Nachweisgrenze** (`TR`, `<LOD`, `<LOQ`) werden als **0** übernommen
  (Entscheidung des Projekts: gemessen, praktisch null).
- Ein Datensatz ohne einen der vier Hauptwerte (kcal, Protein, Kohlenhydrate, Fett) wird **nicht
  importiert**; der Bericht nennt ihn mit Grund.
- Ebenfalls übersprungen: ungültiger oder doppelter Code, fehlender Name, unplausible Werte
  (negativ, über 950 kcal oder über 100 g eines Nährstoffs je 100 g, Makrosumme über 105 g).

## Laufzeit

- **Laden:** `bls.json` ist ein eigener Chunk der App (dynamischer Import). Er ist Teil der
  Installation, wird erst bei der ersten Suche gelesen und nie aus dem Netz geladen.
- **Suche:** Namen werden einmal normalisiert (`core/nutrition/search.ts`), danach vergleicht jede
  Suche nur vorbereitete Zeichenketten – keine Objekte, keine Datenbankabfrage über den BLS.
  - Groß-/Kleinschreibung, Akzente und Umlaute egal: „äpfel“ = „Äpfel“ = „aepfel“ = „apfel“,
    „ß“ = „ss“, Satzzeichen werden ignoriert.
  - Jedes Suchwort muss vorkommen, auch innerhalb eines Wortes („apfel“ findet „Bratäpfel“).
  - Sortierung: exakter Name → Name beginnt mit der Suche → alle Wörter am Wortanfang →
    enthalten; danach kürzerer (allgemeinerer) Name, dann alphabetisch.
  - Höchstens 50 BLS-Treffer je Suche (`REFERENCE_RESULTS_LIMIT`).
  - Dieselbe Normalisierung gilt für eigene Lebensmittel (Liste „Lebensmittel verwalten“).
- **Keine Duplikate:** Ein BLS-Lebensmittel, das schon benutzt wurde, erscheint nur einmal – als
  gespeicherter Eintrag.

## Referenzdaten sind unveränderlich

- Ein BLS-Lebensmittel wird beim **ersten Benutzen** einmalig in `foods` angelegt:
  `source = 'local'`, `profile_id = NULL`, `origin_dataset = 'bls'`, `origin_code` = BLS-Code,
  `origin_version = '4.0'`, Bezug 100 g. Grund: Tagebuch, Favoriten und Vorlagen brauchen eine
  Lebensmittel-ID. Ein eindeutiger Index (`foods_origin`) verhindert Duplikate.
- Benutzen erzeugt nur einen Tagebucheintrag mit Nährwert-Momentaufnahme; die Referenz bleibt
  unverändert.
- Bearbeiten, Ausblenden und Löschen sind für BLS-Lebensmittel gesperrt (Dienst und Oberfläche).
  Die Oberfläche zeigt die Werte schreibgeschützt und bietet **„Als eigene Kopie bearbeiten“**:
  Das erzeugt ein eigenes Lebensmittel (`source = 'custom'`) mit `copied_from_food_id`, angezeigt
  als „Eigene Kopie“.
- Favoriten und „zuletzt verwendet“ funktionieren für BLS-Lebensmittel wie für alle anderen.
- Kommt eine neue BLS-Version, übernimmt die gespeicherte Zeile beim nächsten Benutzen die neuen
  Werte (`origin_version` wird angepasst). Vergangene Tage ändern sich nicht (Momentaufnahmen).

## Grenzen und bekannte Einschränkungen

- Nur sieben Nährwerte werden übernommen; Vitamine, Mineralstoffe usw. sind nicht enthalten.
- Der BLS kennt keine Marken, Barcodes, Stück- oder Portionsgrößen. Mengen werden in g (oder kg)
  eingetragen. Eine Portionsgröße lässt sich über „Als eigene Kopie bearbeiten“ ergänzen.
- Namen werden deutsch angezeigt (BLS-Originalbezeichnung). Englische Namen dienen, falls in der
  Datei vorhanden, nur der Suche.
- Ein Favorit auf ein BLS-Lebensmittel gilt gerätweit (die App hat genau ein lokales Profil).
- Der BLS beschreibt Durchschnittswerte; einzelne Produkte können abweichen.
