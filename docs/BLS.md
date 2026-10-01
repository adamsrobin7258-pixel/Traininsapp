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

| Angabe      | Wert                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Datensatz   | Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank                    |
| Herausgeber | Max Rubner-Institut (MRI), Bundesforschungsinstitut für Ernährung und Lebensmittel              |
| Bezug       | <https://blsdb.de> → Download (offizielle Seite des MRI)                                        |
| Paket       | `BLS_4_0_2025_DE.zip` mit Hauptdatei, Komponentenliste und Dokumentation                        |
| Datei       | `BLS_4_0_Daten_2025_DE.xlsx`: 7.140 Lebensmittel, 138 Nährstoffe, 418 Spalten                   |
| Nutzung     | laut Dokumentation (Kap. 9.3) kostenfrei und ohne Lizenzbarrieren, auch für Apps; Quellenangabe |
| Bezugsgröße | alle Werte je 100 g essbarer Anteil                                                             |

**Quellenangabe** in der vom MRI empfohlenen Zitierweise (Dokumentation Kap. 9.2) – in der App
unter Profil → Über Kalethra → Datenquellen, in den Suchergebnissen, in der Mengenansicht und
beim Kopieren eines BLS-Lebensmittels:

> Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0. Karlsruhe.

Unter „Datenquellen“ steht zusätzlich, dass Kalethra nur die Hauptnährwerte übernimmt und die
übernommenen Werte nicht verändert.

> Hinweis: Eine frühere Projektvorgabe nannte „CC BY 4.0“. Die offizielle Dokumentation im
> Datenpaket nennt keine CC-Lizenz, sondern freie Nutzung mit Quellenangabe. Kalethra zeigt
> deshalb den offiziellen Wortlaut (Entscheidung vom 01.10.2026).

**Importierte Fassung:** Paket `BLS_4_0_2025_DE.zip`, Hauptdatei SHA-256
`524bbefe25b691f5cb3de7a9f3e27fa2967aebfeabf217d99414ba7806e78c60`, importiert am 01.10.2026,
7.137 von 7.140 Lebensmitteln übernommen (Details in
[data/bls/IMPORT_REPORT.md](../data/bls/IMPORT_REPORT.md)).

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
| Name (englisch)       | „Food name“ (nur für die Suche, nachrangig)             | –                      |
| Energie (kcal)        | `ENERCC`                                                | kcal                   |
| Protein               | `PROT625`                                               | g, mg ÷ 1000, µg ÷ 10⁶ |
| Kohlenhydrate         | `CHO` (Kohlenhydrate, verfügbar)                        | wie oben               |
| Fett                  | `FAT`                                                   | wie oben               |
| Ballaststoffe         | `FIBT`                                                  | wie oben               |
| Zucker                | `SUGAR`                                                 | wie oben               |
| Gesättigte Fettsäuren | `FASAT`                                                 | wie oben               |

Werte werden auf zwei Nachkommastellen gerundet (wie alle Nährwerte in Kalethra).

### Fehlende Werte, Spurenwerte, Plausibilität

Kennzeichnung laut Dokumentation (Kap. 4.3/4.4) und Behandlung in Kalethra:

| Zelle                          | Bedeutung (MRI)                                 | Kalethra                          |
| ------------------------------ | ----------------------------------------------- | --------------------------------- |
| Zahl                           | Gehalt je 100 g                                 | übernommen                        |
| `-` oder leer                  | fehlender Wert, „nicht als Null interpretieren“ | `null` → „nicht angegeben“        |
| `TR`                           | Spuren, nachgewiesen, Menge unbekannt           | **0** (Entscheidung des Projekts) |
| `<LOD`, `<LOQ`, `<LOD or <LOQ` | unter Nachweis- bzw. Bestimmungsgrenze          | **0** (Entscheidung des Projekts) |

In der importierten Fassung betrifft das bei den sieben genutzten Nährwerten: Protein 23× `TR`;
Fett 7× `TR`, 18× `<LOD`/`<LOQ`, 3× `-`; Ballaststoffe 13× `TR`, 26× `<LOD`/`<LOQ`, 14× `-`;
gesättigte Fettsäuren 23× `-`. Energie, Kohlenhydrate und Zucker sind vollständig.

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
  - Ohne Leerzeichen gilt als gleich („haferflocken“ findet „Hafer Flocken“); Bindestrich-Wörter
    zählen als zusammengesetzt („Joghurt-Dip“).
  - Sortierung: exakter Name → Name beginnt mit den Suchwörtern als ganze Wörter („Apfel roh“)
    → alle Suchwörter als ganze Wörter → Name beginnt mit der Suche („Apfelmus“) → Wortanfänge
    → enthalten; Treffer nur im englischen Namen danach. Innerhalb gleicher Stufe kürzerer
    (allgemeinerer) Name zuerst, dann alphabetisch. So steht bei „milch“ „Milch fettarm …“ vor
    „Milchschokolade“.
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

- Drei Lebensmittel ohne Fettangabe sind nicht enthalten: Glutamat, Kutterhilfsmittel (E 450),
  Pottasche (E 501).
- Drei BLS-Namen sind länger als 120 Zeichen. Sie werden vollständig angezeigt; für eine eigene
  Kopie muss der Name gekürzt werden.
- Die Daten werden beim ersten Öffnen des Hinzufügen-Dialogs vorbereitet (rund 840 KB); danach
  dauert eine Suche wenige Millisekunden.

- Nur sieben Nährwerte werden übernommen; Vitamine, Mineralstoffe usw. sind nicht enthalten.
- Der BLS kennt keine Marken, Barcodes, Stück- oder Portionsgrößen. Mengen werden in g (oder kg)
  eingetragen. Eine Portionsgröße lässt sich über „Als eigene Kopie bearbeiten“ ergänzen.
- Namen werden deutsch angezeigt (BLS-Originalbezeichnung). Englische Namen dienen, falls in der
  Datei vorhanden, nur der Suche.
- Ein Favorit auf ein BLS-Lebensmittel gilt gerätweit (die App hat genau ein lokales Profil).
- Der BLS beschreibt Durchschnittswerte; einzelne Produkte können abweichen.
