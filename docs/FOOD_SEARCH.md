# Lebensmittelsuche: gemeinsames Ranking und automatische Online-Suche (Phase 27/28)

Ziel: **suchen → passenden Treffer sofort erkennen → Menge eingeben → fertig.** Seit Phase 28
gilt: **Nicht die Datenquelle entscheidet über die Position eines Ergebnisses, sondern die
Übereinstimmung mit der Suchanfrage und die Qualität des Produkts.**

```
Suchfeld (useFoodPicker)
  → sofort, offline: FoodLookupService.search
      eigene Lebensmittel, gespeicherte Produkte, BLS          → eine gemeinsame Liste
  → nach 700 ms Tipppause (ab 3 Zeichen): FoodLookupService.onlineProducts
      Sitzungs-Speicher → Drossel → FoodDataProvider.searchProducts (nur der Suchtext)
      → Qualitätsklassen (productQuality.ts): C ausgeblendet → Duplikate zusammengefasst
  → FoodLookupService.search(…, { online })                    → dieselbe Liste, neu gerankt
      → foodRanking.ts: Bedeutung des Namens, Produktart, Marke, Häufigkeit, kleiner Quellen-/Qualitätsfaktor
  → Produkt antippen → bestehende Prüfung (FoodFormSheet) → gespeichertes Produkt
Barcode (useBarcodeFlow)               unverändert, eigener Weg
```

## 0. Phase 28 im Überblick

| Thema               | Umsetzung                                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemeinsames Ranking | Alle Quellen (eigene, gespeicherte, BLS, Open Food Facts) laufen durch `relevance()` und **eine** Sortierung. Kein Quellen-Block mehr, kein „Online gefunden“-Abschnitt.                                                                           |
| Quelle              | nur kleiner Bonus: eigenes Lebensmittel +8, gespeichertes Produkt +6, BLS 0, Online-Produkt 0 (`SOURCE_BONUS`) – kleiner als eine Trefferstufe.                                                                                                    |
| Produktart          | bekannte Vertreter einer Art zählen (`foodVocabulary.ts`, z. B. Gouda/Edamer → Käse, 78 Punkte); bei Open Food Facts zählt die Kategorie (`categories_tags`, 70 Punkte). „Leberkäse“ ist kein Käse.                                                |
| Marke + Produktart  | Marke im Markenfeld +40, andere Marke −40 (vorher −30), Marke nur am Namensanfang (ohne Markenfeld) +20, **beides erfüllt** zusätzlich +20. Ein Name, der nur das Lebensmittelwort ist, bekommt bei einer Markensuche keinen „exakter Name“-Bonus. |
| Qualität            | Klassen A/B/C (Abschnitt 5a); B −12 Punkte, C ausgeblendet.                                                                                                                                                                                        |
| Duplikate           | gleicher Barcode → besserer Datensatz; sonst nur Marke + Name + Packungsgröße + gleiche Energie (Abschnitt 5b).                                                                                                                                    |
| Online automatisch  | Debounce 700 ms, ab 3 Zeichen, abgebrochen bei neuer Eingabe, Speicher 30 min, höchstens 6 Anfragen/Minute.                                                                                                                                        |
| Ergebnisliste       | höchstens 50 Einträge (`SEARCH_RESULTS_LIMIT`), BLS höchstens 50 Kandidaten, Online höchstens 24.                                                                                                                                                  |

## 1. Ausgangslage (Stand 0.39.1)

**Datenquellen:** eigene Lebensmittel (`source = custom`), gespeicherte Produkte aus Open Food
Facts (`external`, mit Marke und Barcode), BLS 4.0 in der App (7.137 generische Lebensmittel,
ohne Marken, Händler, Barcodes, Zutaten; der BLS-Code nennt die Hauptgruppe, X/Y = Gerichte).
Open Food Facts war nur Barcode-Fallback (die Online-Suche wurde in Phase 4.4 entfernt).

**Verarbeitung eines Suchbegriffs:** Normalisierung (Groß/klein, Umlaute, „ae/oe/ue“, ß,
Satzzeichen) → jedes Wort muss irgendwo im Namen vorkommen (auch mitten im Wort) →
Sortierung **erst nach Quelle** (eigene → gespeicherte → BLS), dann nach sechs Text-Stufen
(0 exakt … 2 ganzes Wort … 5 irgendwo enthalten), dann nach Namenslänge. Der BLS wurde vorher
mit derselben Logik auf 50 Treffer gekürzt.

**Warum „Kalbshirn gebraten mit Ei“ bei „Ei“ oben stand:** „ei“ ist dort ein _ganzes Wort_
(Stufe 2). „Hühnerei roh“ enthält „ei“ nur _im Wort_ (Stufe 5) und stand daher hinter allen
Gerichten „… mit Ei“. „ei“ steckt außerdem in tausenden Wörtern („Reis“, „Brei“, „Fleisch“):
2.546 Treffer. Die Textstufen kannten weder die Bedeutung zusammengesetzter Wörter noch den
Unterschied zwischen Lebensmittel und Gericht.

## 2. Datenquellen – Bewertung

Live-Abrufe der Quellen waren aus der Build-Umgebung nicht möglich (Netzwerkrichtlinie,
HTTP 403 für openfoodfacts.org, unsplash.com u. a.). Bedingungen wurden über die offizielle
Dokumentation per Websuche geprüft (Oktober 2026); was nicht belegt werden konnte, steht als
„nicht geprüft“ da.

| Quelle                                        | Markenprodukte / DE-Handel                                                             | Barcodes           | Qualität / Aktualität                                        | Lizenz, Bedingungen                                                                                                                                                                                                   | Offline                                        | Kosten          | Datenschutz                          | Integration                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------- | ------------------------------------ | ------------------------------------------------- |
| **BLS 4.0** (MRI)                             | keine – generische Lebensmittel und Gerichte                                           | nein               | sehr hoch, wissenschaftlich; Version 4.0 (2025)              | kostenfrei nutzbar mit Quellenangabe ([BLS.md](BLS.md))                                                                                                                                                               | ja, in der App (~0,8 MB)                       | keine           | ideal: kein Netz                     | vorhanden                                         |
| **Open Food Facts**                           | sehr gut, viele deutsche Handelsmarken (z. B. Milbona/Lidl), Felder `brands`, `stores` | ja (EAN)           | gemeinschaftlich gepflegt, teils lückenhaft; laufend aktuell | ODbL (Namensnennung, Share-Alike für die Datenbank); eigener User-Agent Pflicht; **10 Suchanfragen/Minute**, 15 Produktabfragen/Minute je Nutzer; keine Suche „während des Tippens“; für Massendaten Export statt API | per Export möglich (sehr groß), API nur online | keine           | sieht IP-Adresse und gesendeten Text | Barcode vorhanden; Suche über Search-a-licious    |
| USDA FoodData Central                         | US-Markt, kaum deutsche Produkte                                                       | teilweise (US-UPC) | hoch für generische US-Daten                                 | gemeinfrei (US-Behörde), API-Schlüssel – nicht im Detail geprüft                                                                                                                                                      | Export möglich                                 | keine           | API-Schlüssel nötig                  | ungeeignet für DE-Handelsprodukte                 |
| Schweizer Nährwertdatenbank (BLV)             | generisch, Schweizer Markt                                                             | nein               | hoch                                                         | Nutzung mit Quellenangabe, kommerziell erlaubt (laut Datenportal) – nicht im Detail geprüft                                                                                                                           | Export möglich                                 | keine           | –                                    | Mehrwert gering neben BLS                         |
| GS1 Germany / 1WorldSync (Atrify), GDSN-Pools | Herstellerdaten, sehr vollständig                                                      | ja                 | sehr hoch                                                    | Vertrag mit Datenpool nötig, nicht offen; Bedingungen und Preise nicht öffentlich                                                                                                                                     | nein                                           | kostenpflichtig | Vertrag                              | für eine kostenlose App derzeit nicht realistisch |
| fddb, Händler (Lidl, Edeka, …)                | gut                                                                                    | –                  | –                                                            | keine öffentliche, freie Entwickler-API gefunden – nicht nutzbar                                                                                                                                                      | –                                              | –               | –                                    | –                                                 |

**Ergebnis:** Die beste Kombination ist **BLS (offline, generisch) + Open Food Facts (Marken,
Barcodes) + lokal gespeicherte Produkte**. Keine Quelle wurde ersetzt oder neu angebunden; Open
Food Facts – bereits für Barcodes integriert – bekommt die optionale Suche dazu. Kommerzielle
Herstellerdaten (GS1) wären die Qualitäts-Option, falls Kalethra später ein Budget dafür hat.

Belege: [Open Food Facts API-Dokumentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/),
[Bedingungen der API-Nutzung (Support)](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api),
[Schweizer Nährwertdatenbank (opendata.swiss)](https://ckan.opendata.swiss/de/dataset/naehrwerte_lebensmittel/resource/b6304b89-e1f6-444b-8c79-cafdbae8af52),
[GS1 Germany verkauft Atrify](https://www.meininger.de/handel/lebensmitteleinzelhandel-leh/gs1-verkauft-atrify).

## 3. Ranking (`src/core/nutrition/foodRanking.ts`)

Eine Zahl je Treffer (höher = besser), nachvollziehbar und getestet. Alle Lebensmittel aller
Quellen – seit Phase 28 auch die Produkte der Online-Suche – werden **gemeinsam** sortiert; die
Quelle entscheidet nicht vor der Bedeutung.

| Signal                                                                                                          | Punkte                 | Beispiel                                    |
| --------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------- |
| exakter Name (auch ohne Leerzeichen)                                                                            | +60 auf die Wortpunkte | „Haferflocken“ → „Hafer Flocken“            |
| Wort exakt                                                                                                      | 100                    | „Lachs roh“                                 |
| Synonym (kleine, sichere Liste)                                                                                 | 88                     | „Eier“ → „Hühnerei“                         |
| Ende eines zusammengesetzten Wortes                                                                             | 85                     | „Hühner\|ei“, „Mager\|quark“, „Brat\|äpfel“ |
| erstes Wort beginnt mit ≥ 4 Buchstaben                                                                          | 65                     | „hafer“ → „Haferflocken“ (beim Tippen)      |
| Wortanfang                                                                                                      | 45                     | „Ei“ → „Eierlikör“                          |
| bekannter Vertreter der gesuchten Art (Phase 28)                                                                | 78                     | „Käse“ → „Milbona Gouda“                    |
| Kategorie eines Online-Produkts nennt die Art (Phase 28)                                                        | 70                     | „Käse“ → Kategorie „fresh cheeses“          |
| Tippfehler (1 Zeichen, ab 5 Buchstaben)                                                                         | 40                     | „Bananne“ → „Banane roh“                    |
| irgendwo im Wort                                                                                                | 12                     | „Ei“ in „Reis“                              |
| **Ort im Namen**: erstes Wort ×1,1 · Kopf ×1 · nach Komma ×0,8 · nach „mit/aus/und …“ ×0,35 · nach „ohne“ ×0,05 |                        | „Kalbshirn gebraten **mit** Ei“ → schwach   |
| Gericht/Rezept (BLS-Hauptgruppe X/Y)                                                                            | −40                    | „Quark … mit Konfitüre“ nach „Speisequark“  |
| „roh“                                                                                                           | +4                     | Grundform bei Gleichstand                   |
| Marke/Händler aus der Anfrage passt (Markenfeld oder Händler)                                                   | +40 (sonst −40)        | „Quark Lidl“ → Milbona-Produkte             |
| Marke nur am Namensanfang, Produkt ohne Markenfeld                                                              | +20                    | „Milbona Gouda“ ohne `brands`               |
| Marke **und** Produktart erfüllt (Wortpunkte ≥ 60)                                                              | +20                    | „Milbona Käse“ → „Milbona Gouda“            |
| eigenes Lebensmittel / gespeichertes Produkt / BLS / Online                                                     | +8 / +6 / 0 / 0        | Quelle nur als kleiner Faktor               |
| Datenqualität Online-Produkt B                                                                                  | −12                    | fehlender Makro, keine Marke …              |
| persönliche Nutzung                                                                                             | bis +30 (siehe unten)  |                                             |
| zweiter Name (Englisch in deutscher App)                                                                        | ×0,6                   |                                             |

- **Zusammengesetzte Wörter:** Deutsch trägt die Bedeutung am Wortende. Für kurze Suchwörter
  („ei“) prüft eine Regel, ob davor ein Wortteil enden kann – „Kartoffelbr|ei“ und
  „Allerl|ei“ sind keine Eier, „Rühr|ei“ und „Spiegel|ei“ schon.
- **Englische Namen:** Der Kern steht am Ende („chicken egg“), „egg noodles“ sind Nudeln. Bei
  englischer App-Sprache zählt der englische BLS-Name als Hauptname.
- **Marke und Händler:** `foodVocabulary.ts` kennt Händler und ihre Eigenmarken (z. B. Lidl →
  Milbona, Pilos …; Aldi → Milsani …). Marken gespeicherter Produkte werden automatisch erkannt.
  Ein Marken-/Händlerwort hebt passende Produkte, versteckt aber nie andere Lebensmittel; nur
  „Milbona“ allein zeigt ausschließlich Produkte dieser Marke.
- **Marke im Namen:** Nur das Markenfeld (und beim Händler die Läden) zählt voll. Fehlt das
  Markenfeld, zählt die Marke am _Anfang_ des Namens halb. Steht sie weiter hinten („Quarkspeise
  mit Milbona Quark“), ist sie Beschreibung oder Zutat – kein Markentreffer.
- **Mehrwortsuche:** Jedes Lebensmittelwort muss passen (Name oder Kategorie); Marken-/Händler-
  wörter werden getrennt erkannt und gemeinsam mit der Produktart bewertet („Milbona Käse“ ist
  _eine_ Anfrage, nicht zwei).
- **Falsche Komposita:** „Leberkäse“, „Fleischkäse“ u. Ä. sind bei „Käse“ nur ein schwacher
  Treffer (`isFalseCompound`).
- **Darstellung:** ab 60 Punkten „Passende Lebensmittel“, darunter „Weitere Treffer“. Der BLS
  liefert höchstens 50 Kandidaten – die 50 _relevantesten_; die gemeinsame Liste zeigt höchstens
  50 Einträge.

Beispiel „Milbona Käse“ (Tests in `foodSearch.test.ts`):

| Kandidat                            | Rechnung           | Punkte |
| ----------------------------------- | ------------------ | -----: |
| Online: „Gouda jung“, Marke Milbona | 78 (Art) + 40 + 20 |    138 |
| eigenes „Käse“, sehr oft genutzt    | 110 − 40 + 8 + 30  |    108 |
| BLS „Gouda 48 % Fett i. Tr.“        | 78 − 40            |     38 |
| „Nudeln mit Käse“                   | 35 (Zusatz) − 40   |     −5 |

Ergebnisse mit echten BLS-Daten (Tests in `foodSearch.test.ts`, E2E in `foodLookup.spec.ts`):

| Suche        | vorher an erster Stelle                | jetzt                                  |
| ------------ | -------------------------------------- | -------------------------------------- |
| Ei           | Bratkartoffeln mit Ei                  | Hühnerei roh (die ersten 15: nur Eier) |
| Eier         | Eier gekocht (Gericht)                 | Hühnerei roh                           |
| Quark        | Quark (Magerstufe) mit Konfitüre       | Speisequark (alle Fettstufen)          |
| Magerquark   | Kräuterquark (aus Magerquark)          | Speisequark Magerstufe, Magerquark     |
| Haferflocken | Haferflocken … mit Sojadrink (Gericht) | Hafer Flocken                          |
| Bananne      | – (kein Treffer)                       | Banane roh (als schwächerer Treffer)   |

## 4. Persönliche Häufigkeit

- Quelle: Einträge im Ernährungstagebuch der letzten **180 Tage** je Lebensmittel
  (`FoodRepository.usageCounts`, eine Abfrage über den vorhandenen Index). Nichts wird
  zusätzlich gespeichert, nichts verlässt das Gerät.
- Bonus `usageBonus(n) = min(30, round(12 · log2(1 + n)))`: 1 Nutzung ≈ 12, 3 ≈ 24, ab 5 = 30.
- Die Obergrenze ist kleiner als der Abstand zwischen zwei Trefferstufen: Ein häufig genutzter
  Magerquark steigt bei „Quark“ an die Spitze seiner Stufe und vor Gerichte, schlägt aber nie
  einen exakten Namen. Alle anderen passenden Produkte bleiben sichtbar.

## 5. Automatische Online-Suche (Phase 28)

**Auslösung (Debounce):** Lokale Ergebnisse erscheinen sofort. Erst wenn der Suchtext
mindestens **3 Zeichen** hat und **700 ms** nicht mehr geändert wurde, fragt die App Open Food
Facts. Jede neue Eingabe bricht die wartende bzw. laufende Anfrage ab (`AbortController`); es
gibt **keine Anfrage pro Tastendruck** (Unit- und E2E-Test: „Milbona Käse“ getippt → genau
eine Anfrage). Ein Suchtext, der in den letzten 30 Minuten schon beantwortet wurde, kommt sofort
aus dem Sitzungs-Speicher (auch offline). Kürzere Texte („Ei“) bleiben lokal – der BLS deckt sie
gut ab, und Open Food Facts liefert dafür vor allem Rauschen.

**Einfügen ohne Springen:** Die Online-Produkte werden mit den lokalen Treffern _neu gerankt_
(ein Aufruf von `search(…, { online })`). Die bisherige Liste bleibt stehen, bis die neue fertig
ist (kein Leerzustand, kein Flackern); das Eingabefeld behält Fokus und Text. Der Status
(„Suche auch bei Open Food Facts …“, Offline-Hinweis) steht in einer Zeile **unter** der Liste
mit fester Mindesthöhe – ein Statuswechsel verschiebt keinen Treffer.

**Gesendet wird:** `q` (Suchtext), `langs=de,en`, `page_size`, `fields` – sonst nichts (Tests
prüfen die URL). Kein Tagebuch, keine Ziele, kein Gewicht, keine Gesundheits- oder Profildaten,
keine Häufigkeiten, keine eigenen Lebensmittel, kein Suchverlauf, keine IDs. Die Felder fragen
zusätzlich `stores`, `categories_tags`, `completeness`, `data_quality_errors_tags`,
`data_quality_warnings_tags` und `states_tags` ab – das sind _angefragte_ Produktfelder, keine
gesendeten Daten.

**Grenzen der API:** höchstens **6 Suchen pro Minute** (Open Food Facts erlaubt 10); darüber
wird lokal nicht gesendet. Keine automatischen Wiederholungen.

**Offline / Fehler:** BLS, eigene und gespeicherte Lebensmittel funktionieren unverändert, ein
gemerkter Suchtext liefert seine Produkte weiter. Statt einer Fehlermeldung erscheint nur ein
ruhiger Hinweis („Offline – du siehst die Ergebnisse auf deinem Gerät.“ bzw. „… gerade nicht
erreichbar …“ bei Zeitüberschreitung, Serverfehler oder Drossel). Nichts blockiert die Eingabe.

**Anzeige:** Produkte stehen in derselben Liste wie alle anderen Treffer, mit Marke, „Open Food
Facts“ als leiser Quellenangabe (wie „BLS 4.0“) und kcal; darunter die ODbL-Quellenangabe, sobald
ein Produkt angezeigt wird. Bereits gespeicherte Produkte (gleiche ID oder gleicher Barcode)
erscheinen nur einmal – als gespeichertes Lebensmittel. Online-Produkte ohne erkennbaren Bezug
zur Anfrage (kein Wort im Namen oder in der Kategorie) werden nicht gezeigt.

### 5a. Open-Food-Facts-Qualitätsklassen (`productQuality.ts`, ausgewogener Modus)

| Klasse | Bedeutung                     | Kriterien                                                                                                                                                                                                                     | Wirkung                            |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **A**  | gute Datenqualität            | Name, Marke, kcal, Eiweiß, Kohlenhydrate, Fett vorhanden und stimmig; keine Nährwert-Warnung; Nährwerte laut OFF vollständig (falls angegeben); Vollständigkeit ≥ 0,4 (falls angegeben)                                       | normal                             |
| **B**  | eingeschränkt, aber brauchbar | ein Makro fehlt · keine Marke · OFF meldet „nutrition facts to be completed“ · Vollständigkeit < 0,4 · OFF-Warnung zu Nährwerten (`data_quality_warnings_tags` mit nutri/energy/fat/…)                                        | −12 Punkte, also hinter A          |
| **C**  | für die Erfassung unbrauchbar | kein Name · keine kcal · kein einziger Makro · Widerspruch (Makros > 105 g/100 g, oder 4·E + 4·KH + 9·F weicht grob von kcal ab: > 1,5·kcal + 40 oder < 0,5·kcal − 40) · OFF meldet einen Fehler (`data_quality_errors_tags`) | in der normalen Suche ausgeblendet |

- **Vollständig heißt nicht korrekt:** `completeness` ist nur _ein_ Hinweis unter mehreren und
  entscheidet nie allein; ein vollständiger Datensatz mit OFF-Fehler bleibt C.
- **Keine falsche Verifizierung:** Die App nennt kein Produkt „verifiziert“ oder „geprüft“; sie
  spricht nur von Datenqualität. Vor dem Speichern prüft der Nutzer jedes Produkt im Formular.
- Physikalisch unmögliche Einzelwerte (> 950 kcal oder > 100 g je 100 g) gelten wie bisher als
  „nicht angegeben“ (Mapping, unverändert).
- Fehlen die OFF-Indikatoren in einer Antwort, entscheidet die App allein aus den Werten – es
  wird nichts erfunden.
- Der **Barcode-Scan** filtert nicht: Ein gescanntes Produkt wird immer zur Prüfung gezeigt.

### 5b. Duplikate (`dedupeProducts`)

1. **Gleicher Barcode** = dasselbe Produkt. Es bleibt der bessere Datensatz (Qualitätsklasse,
   dann weniger fehlende Werte), an der Stelle des ersten.
2. **Ohne gemeinsamen Barcode** werden Datensätze nur zusammengefasst, wenn **Marke, Name und
   Packungsgröße** (normalisiert, „500 g“ = „500g“) alle bekannt und gleich sind **und** die
   Energie höchstens 5 % (bzw. 5 kcal) abweicht.
3. Im Zweifel bleiben beide: „Milbona Magerquark 250 g“ und „500 g“ sind zwei Produkte; ohne
   Packungsgröße oder Marke wird nie zusammengefasst.
4. Gegen lokale Daten: Ein Online-Produkt, dessen ID oder Barcode schon gespeichert ist,
   erscheint nur als das gespeicherte Lebensmittel.

## 6. Speicherung – drei getrennte Dinge

| Art                             | Wo                                                      | Lebensdauer                                           |
| ------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Datenbankeinträge der App (BLS) | in der App; in `foods` erst beim ersten Gebrauch        | dauerhaft, nicht editierbar                           |
| persönliche Produkte            | `foods` (`source = external`), nach Prüfung im Formular | dauerhaft, offline auffindbar                         |
| gecachte Online-Suchergebnisse  | nur im Arbeitsspeicher (`FoodLookupService`)            | 30 Minuten, höchstens 20 Suchen, nie in der Datenbank |

Suchfelder, die nur dem Ranking dienen (`stores`, `categories`, `packageSize`,
`qualitySignals`), werden nie gespeichert – das Prüfformular übernimmt nur die Produktdaten.

Ein Online-Treffer wird erst gespeichert, wenn der Nutzer ihn antippt und im bekannten
Prüfformular („Produkt prüfen“) speichert – genau wie nach einem Barcode-Scan. So wächst die
Datenbank nur um bewusst gewählte Produkte.

## 7. Barcode – geschützt

`useBarcodeFlow` und `lookupBarcode` sind unverändert (auch in Phase 28). Die Barcode-Anfrage
hat dieselben Parameter wie vorher (nur `fields`, ohne `stores`, Kategorien oder
Qualitätsfelder), ein bekannter Barcode wird ohne Anfrage lokal beantwortet, ein Scan löst nie
eine Textsuche aus, und die Textsuche löst nie einen Barcode-Abruf aus. Qualitätsfilter und
Duplikatlogik gelten nur für die Textsuche. Tests: `foodSearch.test.ts`
(„barcode guard“), `openFoodFacts.test.ts`, `lookupFlow.test.tsx`, E2E `foodLookup.spec.ts`.

## 8. Grenzen und nächste Schritte

- Die Online-Suche ist gegen Fixtures getestet; ein **Live-Test** gegen Open Food Facts war
  aus der Build-Umgebung nicht möglich (gesperrt) – bitte auf dem Gerät prüfen. Ob
  Search-a-licious alle neu angefragten Qualitätsfelder (`completeness`,
  `data_quality_*_tags`, `states_tags`, `categories_tags`) liefert, ist nicht live geprüft;
  fehlende Felder werden ignoriert, die eigenen Prüfungen greifen immer.
- Der Online-Speicher lebt nur in der laufenden App-Sitzung (Arbeitsspeicher). Ein dauerhafter
  Offline-Cache für Online-Suchen bräuchte eine neue Tabelle – bewusst nicht in Phase 28.
- Spirituosen (viel kcal, kaum Makros) gelten als widersprüchlich (C) und erscheinen nicht in
  der Online-Suche; per Barcode bleiben sie erfassbar.
- Eine Einstellung zum Abschalten der automatischen Online-Suche gibt es nicht; sie wäre ein
  sinnvoller nächster Schritt für Nutzer, die gar keine Anfragen wünschen.
- „Quark Lidl“ findet Lidl-Produkte lokal nur, wenn sie schon gespeichert sind; sonst über die
  Online-Suche. Ob Search-a-licious Händlernamen im Suchtext berücksichtigt, ist nicht live
  geprüft; die App bewertet die Treffer zusätzlich selbst über `stores` und Eigenmarken.
- Der BLS kennt keine Zutatenlisten; „Zutaten“ als schwaches Signal gibt es erst mit Produkten,
  die sie liefern.
- Bei Gleichstand gilt der kürzere Name – bei „Hähnchen“ stehen deshalb kurze Innereien-Namen
  neben dem Brustfilet. Eine Feinsortierung nach Beliebtheit bräuchte Daten, die es offline
  nicht gibt; die persönliche Nutzung gleicht das nach wenigen Einträgen aus.
- Nächste Phase: Online-Suche auf dem Gerät prüfen, Händler-/Synonymliste nach echten Suchen
  ergänzen, optional Open-Food-Facts-Ausschnitt für deutsche Produkte als Offline-Paket prüfen
  (Größe, ODbL-Share-Alike).
