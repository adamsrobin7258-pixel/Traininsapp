# Open Food Facts, Barcode, Favoriten, zuletzt verwendet (Phase 4.3, angepasst in 4.4)

## Überblick

> **Seit Phase 4.4 ist Open Food Facts nur noch Barcode-Fallback.** Die normale Suche ist offline
> (eigene Lebensmittel, gespeicherte Produkte, BLS 4.0 – siehe [BLS.md](BLS.md)). Die frühere
> Online-Suche wurde vollständig entfernt (Provider-Methode, Endpunkt, Oberfläche).

Kalethra findet Produkte per Barcode bei [Open Food Facts](https://world.openfoodfacts.org), wenn
der Barcode auf dem Gerät unbekannt ist. Ein gefundenes Produkt wird **erst nach Prüfung durch
den Nutzer** lokal gespeichert (Quelle Open Food Facts). Danach ist es ein normales lokales
Lebensmittel, offline nutzbar und in der normalen Suche auffindbar.

```
UI (AddSheet, Barcode-Dialoge, Food-Editor)
  → FoodLookupService / FoodService          (core/nutrition)
  → FoodDataProvider                          (Vertrag, austauschbar)
  → OpenFoodFactsProvider                     (core/nutrition/providers)
  → JsonHttpClient → httpGetJson              (core/platform: nativ CapacitorHttp, Web fetch)
  → Open Food Facts
```

Die UI ruft nie selbst HTTP auf. Ein weiterer Anbieter braucht nur eine neue
`FoodDataProvider`-Implementierung und eine Zeile im Composition Root (`src/app/services.ts`).

## API-Stand und Endpunkte

Grundlage ist die offizielle Dokumentation (openfoodfacts.github.io/openfoodfacts-server/api,
Stand Oktober 2026).

> Hinweis zur Prüfung: Die Entwicklungsumgebung hatte keinen Netzzugriff auf openfoodfacts.org.
> Endpunkte, Parameter, Rate Limits und Antwortformat wurden deshalb über die Websuche aus der
> offiziellen Dokumentation entnommen, nicht live abgefragt. Der Parser ist bewusst tolerant
> (z. B. `brands` als Text oder Liste, `hits` oder `products`, Zahlen als Text).

| Zweck            | Endpunkt                                                       | Parameter |
| ---------------- | -------------------------------------------------------------- | --------- |
| Produkt per Code | `GET https://world.openfoodfacts.org/api/v2/product/{barcode}` | `fields`  |

- **API v2** für Produkte. Antwort: `status` (1 = gefunden, 0 = unbekannt; bei unbekannten
  Codes teils mit HTTP 404) und `product`.
- Eine Volltextsuche wird seit Phase 4.4 nicht mehr verwendet (`FoodDataProvider` hat keine
  `search`-Methode mehr; ein Test stellt das sicher).
- `fields` beschränkt die Antwort auf die genutzten Felder: `code`, `product_name`,
  `product_name_de`, `product_name_en`, `generic_name`, `brands`, `quantity`,
  `product_quantity_unit`, `serving_size`, `serving_quantity`, `serving_quantity_unit`,
  `nutriments`. Das hält die Antworten auf mobilen Verbindungen klein.
- Genutzte Nährwerte (je 100 g bzw. 100 ml):

  | Wert                  | Feld                                                     |
  | --------------------- | -------------------------------------------------------- |
  | Energie               | `energy-kcal_100g`, ersatzweise `energy-kj_100g` ÷ 4,184 |
  | Protein               | `proteins_100g`                                          |
  | Kohlenhydrate         | `carbohydrates_100g`                                     |
  | Fett                  | `fat_100g`                                               |
  | Ballaststoffe         | `fiber_100g`                                             |
  | Zucker                | `sugars_100g`                                            |
  | Gesättigte Fettsäuren | `saturated-fat_100g`                                     |

## Rate Limits und User-Agent

- **Limits laut Open Food Facts:** 15 Produktabfragen pro Minute und Nutzer bzw. IP-Adresse.
  Wird ein Limit überschritten, antwortet der Dienst mit HTTP 503.
- **Kalethra:**
  - fragt nur nach einem Scan oder einer Barcode-Eingabe, nie beim Tippen in der Suche
  - wiederholt keine Anfrage automatisch
  - fragt einen bereits lokal bekannten Barcode gar nicht erst ab
  - zeigt bei 503 oder 429 „Zu viele Anfragen“ an
- **User-Agent:** `Kalethra/<Version> (<android|ios|web>)`. Er enthält nur App, Version und
  Plattform, nie Nutzerdaten. Er wird auf dem Gerät über den nativen HTTP-Client gesetzt; im
  Web-Build (nur Entwicklung) lässt der Browser keinen eigenen User-Agent zu.
- **Vor einem Store-Release:** Open Food Facts bittet um eine Kontaktmöglichkeit im User-Agent,
  z. B. eine Projekt-E-Mail. Sie fehlt bewusst, weil noch keine öffentliche Projektadresse
  existiert.

## Lizenz und Quellenangabe

- Die Datenbank steht unter der **Open Database License (ODbL)**, einzelne Inhalte unter der
  Database Contents License.
- Kalethra zeigt die Quelle sichtbar an:
  - in der Importprüfung
  - in der Mengenansicht und im Editor importierter Lebensmittel

  Der Hinweis lautet: „Daten: Open Food Facts (openfoodfacts.org), Lizenz ODbL“.

- Produktbilder werden nicht übernommen. Das vermeidet zusätzliche Bildlizenzen.
- Lokal korrigierte Werte sind eine eigene Bearbeitung des Nutzers auf seinem Gerät. Sie werden
  nicht an Open Food Facts zurückgeschrieben.

## Fehlende Nährwerte

- Ein nicht angegebener Wert bleibt `null` und wird **nie als 0 gewertet**.
- Unplausible Werte gelten ebenfalls als fehlend:
  - negative Werte
  - mehr als 950 kcal pro 100 g
  - mehr als 100 g eines Nährstoffs pro 100 g
- In der Importprüfung bleiben fehlende Felder leer und sind markiert. Gespeichert werden kann
  erst, wenn alle Hauptwerte (kcal, Protein, Kohlenhydrate, Fett) eingetragen sind. Detailwerte
  wie Zucker dürfen weiter unbekannt bleiben.

## Barcode

- **Scanner:** `@capacitor/barcode-scanner`, das offizielle Capacitor-Plugin, gekapselt in
  `core/platform/barcodeScanner.ts`.
  - Android erkennt mit **ZXing**, komplett auf dem Gerät und ohne Google-Dienste.
  - iOS erkennt mit Apple Vision.
  - Erkannt werden EAN-13, EAN-8, UPC-A und UPC-E.
  - Die native Oberfläche zeigt das Kamerabild, einen Scanbereich, eine Anweisung und
    „Abbrechen“.
- **Kamera-Berechtigung:**
  - Sie wird erst beim Öffnen des Scanners angefragt.
  - Bei Ablehnung erklärt Kalethra, wo man den Zugriff erlaubt, und bietet „Erneut versuchen“
    und „Barcode eingeben“ an.
  - Die Ernährung bleibt dabei voll nutzbar.
  - Ein Knopf, der direkt die Systemeinstellungen öffnet, ist bewusst nicht eingebaut. Er hätte
    ein zusätzliches Plugin erfordert.
- **Ablauf:**
  1. Der Code wird normalisiert: nur Ziffern, 8–14 Stellen. Es gibt keine Prüfziffernprüfung,
     damit kein echtes Produkt blockiert wird.
  2. **Zuerst lokal:** Ein bekannter Barcode wird sofort lokal beantwortet, ohne Anfrage und
     auch offline. UPC-A mit 12 Ziffern findet dabei auch die 13-stellige EAN-Schreibweise.
     Ein ausgeblendetes Lebensmittel mit diesem Code wird wieder eingeblendet.
  3. Ist der Code lokal unbekannt, wird Open Food Facts gefragt:
     - gefunden → Importprüfung
     - nicht gefunden → „Produkt nicht gefunden.“ mit „Eigenes Lebensmittel anlegen“
       (Barcode vorausgefüllt) und „Nach Namen suchen“ (offline, inkl. BLS)
- **Manuelle Eingabe:** „Barcode eingeben“ funktioniert ohne Kamera, bei verweigerter
  Berechtigung und bei beschädigten Codes.
- **Test-Hook:** Im Web-Build ersetzt `window.__kalethraScanBarcode` den Scanner, nur für
  Playwright. Auf Geräten wird er nie verwendet.

## Lokale Speicherung, Duplikate, Aktualisierung

- **Speichern:** `FoodService.saveImported` legt ein Lebensmittel an mit:
  - `source = 'external'`, `provider = 'openfoodfacts'`, `external_id` = Barcode
  - den geprüften Nährwerten, Referenzmenge und Portionen
  - `created_at` / `updated_at`

  Es ist danach ein normales lokales Lebensmittel und offline nutzbar.

- **Duplikate:**
  - Erkannt werden sie über den lokalen Barcode und die Kombination Provider + externe ID,
    gesichert durch den eindeutigen Index `foods_external`.
  - Ist ein Produkt schon gespeichert, wird es verwendet.
  - Name + Marke werden bewusst nicht als Erkennungsmerkmal genutzt, weil das zu unsicher ist.
- **Keine automatische Aktualisierung:** Gespeicherte Werte werden nie ungefragt mit neuen Daten
  von Open Food Facts überschrieben. Eine manuelle Funktion „Daten aktualisieren“ mit Vorschau
  der Änderungen ist für eine spätere Phase vorgesehen.
- **Historie:** Tagebucheinträge speichern weiterhin eine Nährwert-Momentaufnahme. Spätere
  Korrekturen am Lebensmittel ändern vergangene Tage nicht.

## Favoriten und zuletzt verwendet

- **Favoriten:**
  - Gespeichert im Feld `foods.favorite`, das es seit Migration 6 gibt.
  - Setzen und Entfernen geht über den Stern in der Mengenansicht und im Lebensmittel-Editor.
  - Angezeigt werden sie im Hinzufügen-Dialog und unter Einstellungen → Meine Inhalte → Lebensmittel.
  - Sie funktionieren offline.
- **Zuletzt verwendet:**
  - Abgeleitet aus dem Tagebuch: der späteste Eintragszeitpunkt (`food_entries.created_at`) je
    Lebensmittel, neueste Verwendung zuerst. Einträge aus Vorlagen zählen mit.
  - Wird ein Lebensmittel erneut eingetragen, rückt es nach oben.
  - Ausgeblendete Lebensmittel erscheinen nicht.
  - Die Obergrenze steht zentral in `RECENT_FOODS_LIMIT` (30). Der Hinzufügen-Dialog zeigt die
    8 neuesten.
  - Es wird nichts zusätzlich gespeichert, deshalb ist keine Migration nötig.

## Fehlerverhalten

| Fall                   | Anzeige (am Ort des Geschehens)                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Kein Internet          | „Keine Verbindung zu Open Food Facts. Deine gespeicherten Lebensmittel sind weiterhin verfügbar.“ |
| Timeout (10 s)         | „Open Food Facts antwortet gerade nicht. …“                                                       |
| Rate Limit (503/429)   | „Gerade wurden zu viele Anfragen … Bitte warte eine Minute …“                                     |
| Serverfehler           | „Open Food Facts ist gerade nicht erreichbar. …“                                                  |
| Ungültige Antwort      | „Die Antwort von Open Food Facts konnte nicht gelesen werden. …“                                  |
| Produkt nicht gefunden | „Produkt nicht gefunden.“ mit „Eigenes Lebensmittel anlegen“ / „Nach Namen suchen“                |
| Fehlende Nährwerte     | „Nährwerte unvollständig“, leere markierte Felder in der Prüfung                                  |

- Lokale Suche, Favoriten, zuletzt verwendet und „Neues Lebensmittel anlegen“ bleiben in jedem
  Fall nutzbar.
- Laufende Barcode-Abfragen lassen sich abbrechen.
- Android-Zurück führt aus Mengenansicht, Importprüfung, Barcode-Dialogen und Scanner zurück zur
  Suche, danach schließt es den Dialog.
