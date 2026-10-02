# Roadmap

Die App entsteht in Phasen. Jede Phase endet mit lauffähiger App, grünen Tests und
aktualisierter Dokumentation.

## Phase 1 – Fundament ✅

- React + TypeScript + Vite + Capacitor 8, Android- und iOS-Projekt
- Modulare Architektur mit Modul-Registry und per ESLint erzwungenen Schichtgrenzen
- SQLite-Infrastruktur: Treiberschnittstelle, Migrationen, Repositories für Einstellungen und
  lokales Profil
- Eigene typisierte i18n (Deutsch, Englisch), Sprache nach Gerät, manuell umschaltbar
- Designsystem mit Tokens, Hell-/Dunkelmodus, gemeinsamen Komponenten
- Fünf Bereiche mit Tab-Navigation: Heute, Training, Ernährung, Gesundheit, Profil
- Einstellungen: Name, Erscheinungsbild, Sprache
- Sync-Schnittstelle und Architekturentscheidung für Backend (Supabase), noch ohne Umsetzung
- Tests (Vitest), Lint, Formatierung, CI mit Android-Debug-Build

## Phase 1.1 – Stabilisierung ✅

- Produktname **Kalethra**, App-ID `com.kalethra.app` auf allen Plattformen, Version 0.1.1
  als einzige Quelle in `package.json`
- CI: Actions auf Node-24-Versionen, Gradle-Cache, geprüfte und sprechend benannte APK
  (`kalethra-debug-apk`), fester Debug-Signaturschlüssel für Updates auf Testgeräten
- Datenschutz: Android-Backup und Geräteübertragung aus, Datenkatalog mit Test-Sperre für
  unverschlüsselte Gesundheits- und Standortdaten ([PRIVACY.md](PRIVACY.md))
- GPS-Plattformgrenze (`LocationTracker`) und Konzept ([GPS_ARCHITECTURE.md](GPS_ARCHITECTURE.md))
- Erweiterbarkeit: Module ohne Tab möglich, strengere Architekturregeln (Capacitor nur in
  Adaptern, Domain-Logik ohne React)

## Phase 2, Schritt 1 – Datenbankverschlüsselung ✅

- SQLCipher-Verschlüsselung auf Android und iOS, Schlüssel im Keystore/Keychain
- Kein Fallback auf unverschlüsselte Daten, eigene Fehlerbildschirme bei Schlüssel- und
  Migrationsproblemen
- Speicher-Selbsttest im Profil („Datenschutz & Sicherheit“)
- Auf dem Xiaomi 15 Ultra validiert (SQLCipher 4.17.0 Community)

## Phase 2, Schritt 2 – Körpergewicht ✅

- Gewicht eintragen, bearbeiten, löschen (mit Bestätigung), ein Wert pro Tag
- Einheit kg/lb (Einstellung), intern immer kg, Bereich 20–400 kg
- Verlauf mit Nachladen, SVG-Diagramm mit Zeitraum (1 M, 3 M, 1 J, Alle)
- Heute: auswählbare Tage, Wochenblättern, Gewicht des Tages mit Direktsprung zur Eingabe

## Phase 3 – Trainingssystem ✅ (Version 0.2.0)

- Sportartunabhängiges Modell: Trainingsarten-Registry mit Workflows (Sätze, Ausdauer,
  Segmente, zeitbasiert); Krafttraining vollständig, übrige Arten nur als Architektur
- Workout → Übung → Satz; Sätze mit Gewicht, Wdh., Dauer, Distanz, RPE, Abschluss, Reihenfolge
- Übungsdatenbank: 21 Systemübungen (de/en, versioniert; ab Phase 5: 201), eigene Übungen anlegen, bearbeiten,
  deaktivieren
- Trainingspläne mit Trainingstagen, Übungen, Vorgaben und Reihenfolge
- Training frei oder aus Plan starten, laufendes Training wird gespeichert und wiederhergestellt,
  „Letztes Mal“-Werte, Verlauf, Detailansicht mit Bearbeiten und Löschen
- Volumen und geschätztes 1RM zentral berechnet (Basis für Rekorde)
- Historie bleibt bei Plan- und Übungsänderungen erhalten (Snapshots, siehe
  [DATABASE.md](DATABASE.md#training-migration-4))
- Heute: „Nächstes Training“ bzw. laufendes Training (nur wenn vorhanden), Trainingsminuten
- Datenbankzugriffe pro Verbindung serialisiert
- Playwright-End-to-End-Tests in der CI

## Phase 3.1 – Training-Bedienung stabilisiert ✅

- Satz-Haken öffnet keine Tastatur mehr und hält kein Eingabefeld fokussiert
- Übungsauswahl öffnet ohne Tastatur, passt sich dem sichtbaren Bereich (auch über der
  Tastatur) an und scrollt als eigene Liste bis zum letzten Eintrag
- Trainingsstart: nur „Freies Training“ und „Aus Plan starten“; Planverwaltung als eigener
  Bereich „Pläne“ mit leerem Zustand und Sprung aus dem Start-Dialog
- Trainingsänderungen laufen nacheinander (Blur-Speichern vor Button-Aktion)
- E2E-Tests bei 390 px (hell/dunkel) und 320 × 568 px

## Phase 3.2 – Heute, Satztypen, Android-Zurück ✅

- Android-System-Zurück folgt der App-Navigation (Sheet schließen → eine Ebene höher → Heute →
  App beenden), laufendes Training bleibt erhalten
- „Heute“ als reine Übersicht: Training (letztes, nächstes, 7/30 Tage), Gewicht mit kleinem
  Verlauf, Ernährung als Leerzustand bis zur Ernährungserfassung; Wochenleiste entfernt
- Aufwärm- und Dropsätze als echte Satztypen (Migration 5), im Plan konfigurierbar
  (Aufwärmsätze, Drops am letzten Arbeitssatz) und beim Start übernommen
- RPE aus der Oberfläche entfernt (gespeicherte Werte bleiben erhalten)

## Phase 4.1 – Ernährungsfundament ✅ (Version 0.3.0)

- Datenmodell (Migration 6): Lebensmittel mit Quelle, Bezugsmenge, Portionsgrößen, Favoriten;
  konfigurierbare Mahlzeiten; Tagebuch mit Nährwert-Momentaufnahme; gespeicherte Mahlzeiten;
  Rezepte; datierte Ziele (automatisch/manuell); Wasser
- Rechenlogik: Einheiten (g/kg, ml/l, Stück/Portion über Portionsgröße), Nährwerte je Menge,
  Rezepte gesamt/pro Portion, Tagessummen
- `FoodDataProvider`-Schnittstelle (ohne Anbieter), Gewicht über bestehende Gesundheitsdaten
- Heute zeigt die Tageswerte aus dem Ernährungstagebuch
- Noch ohne Ernährungs-Oberfläche

## Phase 4.2.1 – Ernährungsoberfläche ✅

- Tagesansicht (Standard heute, Tagesnavigation und Datumsauswahl bis heute, vergangene Tage
  bearbeitbar): kcal gegessen/Ziel/übrig, Makros mit Fortschritt, neutrale Überschreitung
- Mahlzeiten in konfigurierter Reihenfolge; Verwaltung (anlegen, umbenennen, sortieren,
  ausblenden, mindestens eine bleibt sichtbar)
- Lokale Lebensmittelsuche (Name/Marke), eigene Lebensmittel anlegen/bearbeiten; Löschen
  entfernt unbenutzte Lebensmittel, benutzte werden ausgeblendet
- Hinzufügen mit Menge, Einheit und Live-Nährwerten; Einträge bearbeiten (Menge, g↔kg/ml↔l,
  Mahlzeit) und löschen
- Vorlagen: aus Mahlzeit speichern, eintragen (vorher anpassbar), umbenennen, löschen
- Wasser: Schnellmengen (vom Nutzer einstellbar), eigene Menge, bearbeiten, löschen, Ziel
- Ziele manuell festlegen (gelten ab heute); Heute-Karte mit kcal- und Protein-Fortschritt

## Phase 4.2.2 – Adaptives Ernährungsprofil ✅ (Version 0.4.0)

- Ernährungsprofil: Geschlecht, Geburtsdatum, Größe (im Profil), Wunschgewicht,
  Alltagsaktivität, Training einbeziehen (Standard aus), Ziel mit Tempo
- Berechnungskern (Mifflin-St Jeor, Aktivität, Training aus echten Workouts, Zielanpassung mit
  Sicherheitsgrenzen, Protein/Fett/Kohlenhydrate), dokumentiert in
  [NUTRITION_CALCULATION.md](NUTRITION_CALCULATION.md)
- Trendgewicht (Median 7 Tage), automatische Neuberechnung bei relevanter Änderung
- Einzeln überschreibbare Werte, versionierte Zielprofile mit gespeicherter Herleitung
  (Migration 7), Zieländerung mit Zusammenfassung

## Phase 4.3 – Open Food Facts, Barcode, Favoriten ✅ (Version 0.5.0)

- Online-Suche bei Open Food Facts (nur auf Tipp), Barcode-Abfrage (lokal zuerst), Importprüfung
  im Lebensmittel-Editor, lokale Speicherung (offline nutzbar), Duplikaterkennung
- Barcode-Scanner (offizielles Capacitor-Plugin, Android ZXing, iOS Vision) und manuelle Eingabe
- Favoriten und zuletzt verwendete Lebensmittel im Hinzufügen-Dialog
- Fehlende Nährwerte bleiben fehlend (nie 0), klare Fehlermeldungen, ODbL-Quellenangabe
- Details: [OPEN_FOOD_FACTS.md](OPEN_FOOD_FACTS.md)

## Phase 4.4 – BLS 4.0 als primäre Lebensmitteldatenbank ✅ (Version 0.6.0)

- Bundeslebensmittelschlüssel 4.0 (Max Rubner-Institut) in der App, reproduzierbarer
  Import (`scripts/nutrition/import-bls.ts`), fehlende Werte bleiben fehlend
- Offline-Suche: eigene → gespeicherte Produkte → BLS; Umlaute, Teilwörter, sinnvolle Sortierung
- Open Food Facts nur noch als Barcode-Fallback (Online-Suche entfernt)
- BLS-Lebensmittel unveränderlich, „Als eigene Kopie bearbeiten“, Herkunft in Migration 8
- Datenquellen unter Profil → Über Kalethra
- Details: [BLS.md](BLS.md)

## Phase 4.5 – Visuelle Identität ✅ (Version 0.7.0)

- Salbeigrüne Farbwelt mit vollständigem Hell-/Dunkel-Satz, semantische Farben inkl. Wasser
- Heute: Kalorien als große Zahl, Makros, Wasser, Mahlzeiten; Training und Gewicht ruhiger
- Eigene Icons (Kalorien, Wasser, Mahlzeiten, Gewicht), Lebensmittel-Illustrationen je BLS-Gruppe
- Dünne Fortschrittslinien, weiche Übergänge (mit „Bewegung reduzieren“ aus), leere Zustände
- Datenschutztext präzisiert (Barcode an Open Food Facts, sonst nichts)
- Details: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)

## Phase 5 – Übungsbibliothek für das Gym ✅ (Version 0.8.0)

- 201 Systemübungen (Katalogversion 2) für Brust, Rücken, Schultern, Bizeps, Trizeps, Beine,
  Gesäß, Waden, Bauch/Core, Unterarme und Ganzkörper; je Übung deutscher und englischer Name,
  Haupt- und Hilfsmuskeln, Ausrüstung, Bewegungsmuster, Erfassungsart und Kurzbeschreibung
  (de/en)
- Ausrüstung neu: SZ-Stange, Multipresse (Smith), Schlingentrainer (TRX); Muskel neu: Adduktoren
- Bestehende Systemübungen eindeutiger benannt (z. B. „Langhantel-Bankdrücken“), IDs unverändert;
  alte Namen bleiben als Suchbegriffe (Aliase) auffindbar, frühere Workouts behalten ihren Namen
- Suche über beide Sprachen und Aliase, unabhängig von Groß-/Kleinschreibung, Umlauten und
  Bindestrichen, mit Teilbegriffen und Rangfolge
- Filter nach Muskelgruppe (grob, 11 Gruppen) und Ausrüstung, kombinierbar mit der Suche
- Favoriten je Profil (Migration 9), „Zuletzt genutzt“ aus der Trainingshistorie berechnet
- Detailansicht mit Muskeln, Ausrüstung, Beschreibung und Favorit; keine Bilder oder Videos
- Keine vorgefertigten Trainingspläne

## Phase 6.2 – Health Connect (Android) ✅ (Version 0.9.0)

- Optional, standardmäßig aus; eigene Erklärung vor dem Berechtigungsdialog
- Nur Leserechte (Gewicht, Schritte, aktive Kalorien; Trainings vorbereitet), Manifest auf vier
  Rechte bereinigt (CI prüft die APK; seit 6.3 fünf Rechte)
- Import der letzten 30 Tage in eigene Tabellen (Migration 10), früheste Tagesmessung beim Gewicht,
  Schritte/Kalorien über die Health-Connect-Aggregation
- Abgleich mit Löschungen nur nach vollständig erfolgreichem Lesen
- Synchronisierung bei Verbinden, App-Start, Rückkehr, Öffnen von Heute/Gesundheit und manuell;
  automatisch höchstens alle 15 Minuten; keine Hintergrundarbeit
- Anzeige „Aus Health Connect“ in Gesundheit; Ernährungsziele unverändert
- Trennen mit vorausgewähltem Löschen der importierten Daten
- Details: [HEALTH_CONNECT.md](HEALTH_CONNECT.md)

## Phase 6.3 – Aktivitäten aus Health Connect ✅ (Version 0.10.0)

- Import aller Aktivitätstypen der letzten 30 Tage in `external_workouts` (Migration 11),
  Abgleich über die Record-ID; zusätzliches Leserecht `READ_DISTANCE`
- Bereich „Training → Aktivitäten“ mit Liste und Details, getrennt von Kalethra-Trainings, Plänen
  und Fortschritt; Typen übersetzt (de/en), unbekannte mit eigenem Namen
- Einstellung „Aktivitätskalorien anrechnen“ (Standard aus): aktive Kalorien der Aktivitäten
  zusätzlich zum Basisziel des Tages; keine Doppelzählung mit Kalethra-Trainings
- Aufschlüsselung „Basisziel / Aktivitätskalorien“ in Ernährung und Heute
- Details: [HEALTH_CONNECT.md](HEALTH_CONNECT.md)

## Phase 7 – Heute als Tages- und Fortschrittsübersicht ✅ (Version 0.11.0)

- Heute: Ernährung, Training (laufend mit Übungsfortschritt und „Training fortsetzen“),
  Aktivitäten und Gesundheitswerte des Tages – nur was es heute gibt
- „Dein Fortschritt“ mit Woche/Monat: Training (Kalethra-Einheiten, Ø pro Woche, Volumen),
  Ernährung (Ø kcal/Protein der erfassten Tage, Ø Tagesziel), Gewicht (eigene Einträge vor
  importierten), Aktivitäten (Health Connect); kleine, ruhige Diagramme
- Doppelungen entfernt: Mahlzeitenliste, letztes Training/7-30-Tage-Zähler, 3-Monats-Gewichtskarte
- Details: [TODAY.md](TODAY.md)

## Phase 6.4 – geplant

- Apple Health (HealthKit) auf iOS

## Phase 4.6 – Vorschlag

- Rezepte in der Oberfläche (Erstellen, Anzeigen, Eintragen) im neuen Design
- Such-Synonyme für den BLS (z. B. „Brokkoli“ → „Broccoli“)
- Manuelle „Daten aktualisieren“-Funktion für importierte Produkte (mit Änderungsvorschau)

## Phase 4 – Weitere Vorschläge

Reihenfolge noch offen; Vorschläge:

- **Rekorde und Fortschritt:** PRs je Übung (schwerster Satz, bestes 1RM, Volumen),
  Verlauf je Übung als Diagramm – nutzt die vorhandenen Kennzahlen ohne Schemaänderung
- **Laufen/Gehen/Radfahren ohne GPS** (manuelle Distanz/Dauer), danach GPS-Tracking mit
  Hintergrundbetrieb ([GPS_ARCHITECTURE.md](GPS_ARCHITECTURE.md))
- **HYROX, Mobility, Stretching** als eigene Erfassungsoberflächen
- Pausentimer zwischen Sätzen, Erinnerungen per lokaler Benachrichtigung
- Ernährung: Mahlzeiten manuell, eigene Lebensmittel; später Lebensmitteldatenbank und
  Barcode-Scanner
- Schritte und aktive Energie aus Apple HealthKit / Android Health Connect

## Phase 6 – Konto, Synchronisierung, Monetarisierung

- Supabase-Auth (E-Mail, Sign in with Apple, Google), Kontoverknüpfung des lokalen Profils
- Synchronisierung nach ADR-004
- Datenexport und Kontolöschung
- Abonnements über RevenueCat, Freischaltungen über `EntitlementService`

## Später

Statistiken und Fortschrittsanalysen mit Diagrammen, Schlaf und Regeneration, Widgets,
Smartwatch-Anbindung, KI-gestützte Empfehlungen (nur mit klarem Nutzen und Datenschutzkonzept).

## Bekannte Einschränkungen (Stand Phase 3)

| Thema                      | Beschreibung                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web nur für Entwicklung    | Im Browser speichert SQLite (WASM) unverschlüsselt in IndexedDB (auch Trainingsdaten); die App weist im Profil darauf hin. Nicht als Produkt gedacht.                                                                                 |
| sql.js gepinnt             | `sql.js` ist auf 1.11.0 fixiert, weil `jeep-sqlite` 2.8.0 genau diese Version bündelt. `jeep-sqlite` ist seit 2024 nicht aktualisiert – betrifft nur den Web-Entwicklungsmodus, bei Problemen durch eigenen sql.js-Treiber ersetzbar. |
| WASM im nativen Paket      | Die `sql-wasm.wasm` (~650 KB) landet auch in den nativen Paketen, obwohl sie dort ungenutzt ist. Kann später beim `cap sync` ausgeschlossen werden.                                                                                   |
| Build-Warnung              | Vite meldet beim Build, dass `jeep-sqlite` das Node-Modul `crypto` importiert; es wird im Browser nicht benötigt. Harmlos.                                                                                                            |
| npm audit                  | 3 mittlere Meldungen in `@capacitor/cli` (Abhängigkeit `xcode` → `uuid`). Nur Build-Werkzeug, nicht in der App enthalten. Der von npm vorgeschlagene Fix wäre ein Downgrade; wir warten auf ein Update von Capacitor.                 |
| Standard-Icons             | App-Icon und Splash-Screen sind noch die Capacitor-Vorgaben.                                                                                                                                                                          |
| Wochenbeginn               | Die Wochenansicht beginnt immer am Montag (ISO 8601), unabhängig von der Region.                                                                                                                                                      |
| Gerätetests                | Android wird auf dem Xiaomi 15 Ultra getestet (durch den Nutzer). iOS ist bisher nur in der CI baubar und nicht auf einem Gerät geprüft.                                                                                              |
| Eigene Übungen einsprachig | Eigene Übungen haben einen Namen für beide Sprachen; Systemübungen sind übersetzt.                                                                                                                                                    |
| Übungen im Workout         | Übungen innerhalb eines Workouts werden per Pfeiltasten statt Drag & Drop sortiert (zuverlässiger auf kleinen Bildschirmen und mit Screenreadern).                                                                                    |
