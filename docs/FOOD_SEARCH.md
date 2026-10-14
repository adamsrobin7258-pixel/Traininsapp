# Lebensmittelsuche: Ranking und Hybrid-Suche (Phase 27)

Ziel: **suchen → passenden Treffer sofort erkennen → Menge eingeben → fertig.** Die Suche bleibt
local-first; eine Online-Erweiterung gibt es nur auf ausdrücklichen Wunsch.

```
Suchfeld (useFoodPicker)
  → FoodLookupService.search           offline: eigene Lebensmittel, gespeicherte Produkte, BLS
      → foodRanking.ts                 Bedeutung des Namens, Marke/Händler, Bonus für Nutzung
      → FoodService.usageCounts        Häufigkeit aus dem Tagebuch (lokal, nichts Zusätzliches gespeichert)
      → ReferenceCatalog.rank (BLS)    dieselbe Bewertung über 7.137 BLS-Einträge
  → „Weitere Produkte online suchen“   nur auf Tippen
      → FoodLookupService.searchOnline Drossel, Sitzungs-Speicher, gleiche Bewertung
      → FoodDataProvider.searchProducts → Open Food Facts Search-a-licious (nur der Suchtext)
  → Online-Treffer antippen            → bestehende Prüfung (FoodFormSheet) → gespeichertes Produkt
Barcode (useBarcodeFlow)               unverändert, eigener Weg
```

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
Quellen werden **gemeinsam** sortiert – die Quelle entscheidet nicht mehr vor der Bedeutung.

| Signal                                                                                                          | Punkte                 | Beispiel                                    |
| --------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------- |
| exakter Name (auch ohne Leerzeichen)                                                                            | +60 auf die Wortpunkte | „Haferflocken“ → „Hafer Flocken“            |
| Wort exakt                                                                                                      | 100                    | „Lachs roh“                                 |
| Synonym (kleine, sichere Liste)                                                                                 | 88                     | „Eier“ → „Hühnerei“                         |
| Ende eines zusammengesetzten Wortes                                                                             | 85                     | „Hühner\|ei“, „Mager\|quark“, „Brat\|äpfel“ |
| erstes Wort beginnt mit ≥ 4 Buchstaben                                                                          | 65                     | „hafer“ → „Haferflocken“ (beim Tippen)      |
| Wortanfang                                                                                                      | 45                     | „Ei“ → „Eierlikör“                          |
| Tippfehler (1 Zeichen, ab 5 Buchstaben)                                                                         | 40                     | „Bananne“ → „Banane roh“                    |
| irgendwo im Wort                                                                                                | 12                     | „Ei“ in „Reis“                              |
| **Ort im Namen**: erstes Wort ×1,1 · Kopf ×1 · nach Komma ×0,8 · nach „mit/aus/und …“ ×0,35 · nach „ohne“ ×0,05 |                        | „Kalbshirn gebraten **mit** Ei“ → schwach   |
| Gericht/Rezept (BLS-Hauptgruppe X/Y)                                                                            | −40                    | „Quark … mit Konfitüre“ nach „Speisequark“  |
| „roh“                                                                                                           | +4                     | Grundform bei Gleichstand                   |
| Marke/Händler aus der Anfrage passt                                                                             | +40 (sonst −30)        | „Quark Lidl“ → Milbona-Produkte             |
| eigenes Lebensmittel / gespeichertes Produkt                                                                    | +8 / +6                |                                             |
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
- **Darstellung:** ab 60 Punkten „Passende Lebensmittel“, darunter „Weitere Treffer“. Der BLS
  liefert höchstens 50 Treffer – jetzt die 50 _relevantesten_.

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

## 5. Online-Erweiterung

- Schaltfläche „Weitere Produkte online suchen“ unter den passenden Treffern, mit Hinweis
  „Gesendet wird nur dein Suchbegriff“. **Keine** Anfrage beim Tippen.
- Gesendet wird: `q` (Suchtext), `langs=de,en`, `page_size`, `fields` – sonst nichts (Tests
  prüfen die URL). Kein Tagebuch, keine Ziele, kein Gewicht, keine Gesundheits- oder
  Profildaten, keine Nutzungsdaten, keine IDs.
- Drossel: höchstens **6 Suchen pro Minute** (Open Food Facts erlaubt 10); darüber meldet die
  App „zu viele Anfragen“, ohne zu senden. Keine automatischen Wiederholungen.
- Ohne Internet: klare Meldung, lokale Ergebnisse und die weitere Suche funktionieren normal.
- Online-Treffer werden genauso bewertet (Händler über `stores`, z. B. „Lidl“).
- Bereits gespeicherte Produkte erscheinen als das gespeicherte Lebensmittel (kein Duplikat).

## 6. Speicherung – drei getrennte Dinge

| Art                             | Wo                                                      | Lebensdauer                                           |
| ------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Datenbankeinträge der App (BLS) | in der App; in `foods` erst beim ersten Gebrauch        | dauerhaft, nicht editierbar                           |
| persönliche Produkte            | `foods` (`source = external`), nach Prüfung im Formular | dauerhaft, offline auffindbar                         |
| gecachte Online-Suchergebnisse  | nur im Arbeitsspeicher (`FoodLookupService`)            | 30 Minuten, höchstens 20 Suchen, nie in der Datenbank |

Ein Online-Treffer wird erst gespeichert, wenn der Nutzer ihn antippt und im bekannten
Prüfformular („Produkt prüfen“) speichert – genau wie nach einem Barcode-Scan. So wächst die
Datenbank nur um bewusst gewählte Produkte.

## 7. Barcode – geschützt

`useBarcodeFlow` und `lookupBarcode` sind unverändert. Die Barcode-Anfrage hat dieselben
Parameter wie vorher (nur `fields`, ohne `stores`), ein bekannter Barcode wird ohne Anfrage
lokal beantwortet, ein Scan löst nie eine Textsuche aus. Tests: `foodSearch.test.ts`
(„barcode guard“), `openFoodFacts.test.ts`, `lookupFlow.test.tsx`, E2E `foodLookup.spec.ts`.

## 8. Grenzen und nächste Schritte

- Die Online-Suche ist gegen Fixtures getestet; ein **Live-Test** gegen Open Food Facts war
  aus der Build-Umgebung nicht möglich (gesperrt) – bitte auf dem Gerät prüfen.
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
