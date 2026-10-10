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
- Details: [PROGRESS.md](PROGRESS.md) (seit 7.1 ohne Tagesteil)

## Phase 7.1 – Fortschritt als Mainpage ✅ (Version 0.11.1)

- „Heute“ vollständig entfernt; der erste Tab heißt „Fortschritt“ (eigenes Symbol) und zeigt nur
  Woche/Monat mit Training, Ernährung, Gewicht und Aktivitäten
- Tagesinhalte (Ernährungskarte, Trainingsstatus, Gesundheit und Aktivitäten von heute) entfernt
  – sie stehen in ihren Bereichen
- Details: [PROGRESS.md](PROGRESS.md)

## Phase 8 – Manuelle Sportarten und Aktivitäten ✅ (Version 0.12.0)

- „Aktivität erfassen“ unter Training → Aktivitäten: 60 Sportarten in 11 Kategorien (de/en,
  durchsuchbar), je Sportart nur die passenden Felder (Dauer, optional Startzeit, Distanz,
  Intensität oder Variante)
- Energieverbrauch netto aus MET-Werten des Compendium of Physical Activities mit Quelle je Wert;
  Körpergewicht eigener Eintrag oder neuerer Health-Connect-Wert; eigener Wert überschreibbar
  (berechneter Wert bleibt gespeichert)
- Eigene Tabelle `manual_activities` (Migration 12), getrennt von Kalethra-Trainings und
  Health Connect; bearbeiten und löschen mit Rückfrage
- Health Connect hat Vorrang: vorsichtige Duplikaterkennung (Startzeit, passender Typ, ≥ 50 %
  Überschneidung, ähnliche Dauer)
- „Aktivitätskalorien anrechnen“ und Fortschrittskarte „Aktivitäten“ zählen beide Quellen
- Details: [ACTIVITIES.md](ACTIVITIES.md)
- Offen: MET-Werte und Codes vollständig gegen das Original-Compendium prüfen (Quelle war aus der
  Entwicklungsumgebung nicht abrufbar, siehe ACTIVITIES.md)

## Phase 9 – Kalethra-Score ✅ (Version 0.13.0)

- Score 0–100 ganz oben auf Fortschritt, mit Wortlaut, Tendenz und vier Teilwerten (Ernährung,
  Training, Aktivitäten, Regeneration); Details mit Gewichtung und Erklärung je Bereich
- Gewichtung nach Hauptziel; neues Hauptziel „Allgemeine Fitness“ (rechnet wie „Gewicht halten“)
- Zeitraum „Heute“ zusätzlich zu 7 und 30 Tagen; Tendenz gegen den Vorzeitraum
- Regeneration unter Gesundheit (schlecht/mittelmäßig/gut, Ruhetag), Migration 13
- Wochenziele „Trainings pro Woche“ und „Aktive Minuten pro Woche“ im Profil
- Fehlende Daten neutral, „Vorläufig“ bei dünner Datenbasis; nichts gespeichert, alles offline
- Details: [SCORE.md](SCORE.md)

## Phase 10 – Zentrale Einstellungen, Profil & Ziele ✅ (Version 0.14.0)

- Tab „Profil“ heißt „Einstellungen“: Profil, Ziele, Meine Inhalte (Platzhalter), App
- Ziele an einer Stelle: Hauptziel, Ernährung (Logik unverändert), Aktivitätskalorien, Trainings
  pro Woche, aktive Minuten pro Woche, neues Schrittziel (Schritte nur aus Health Connect)
- Wochen- und Schrittziele versioniert (`goal_targets`, Migration 14): vergangene Zeiträume
  behalten ihr damaliges Ziel
- Gewicht nur noch unter Gesundheit erfassbar; drei Gewichtsregeln zentral dokumentiert
- Alte Adressen `/profile` und `/nutrition/profile` leiten weiter
- Details: [SETTINGS.md](SETTINGS.md)

## Phase 11 – Meine Inhalte zentralisieren ✅ (Version 0.15.0)

- Einstellungen → Meine Inhalte verwaltet Lebensmittel, Mahlzeiten des Tages, Vorlagen,
  Trainingspläne und Übungen (bestehende Seiten, Formulare und Services; keine Migration)
- Ernährung und Training nur noch Tracking mit Schnellzugriffen (neues Lebensmittel, Barcode,
  Vorlage speichern/anwenden, eigene Übung in der Auswahl)
- Training wird nur noch im Trainingsbereich gestartet; die Planseite hat keinen Start-Knopf
- Alte Adressen leiten weiter (Plan-ID bleibt erhalten)
- Details: [SETTINGS.md](SETTINGS.md)

## Phase 11B – Rezepte und Vorlagen bearbeiten ✅ (Version 0.16.0)

- Rezeptverwaltung unter Meine Inhalte → Rezepte: anlegen, bearbeiten (Zutaten, Mengen,
  Portionen), löschen; Nährwerte gesamt und pro Portion aus der bestehenden Kernberechnung
- Rezepte im Hinzufügen-Fenster eintragen (Portionen frei wählbar), „Neues Rezept anlegen“ als
  Schnellzugriff mit demselben Formular
- Vorlagen inhaltlich bearbeiten (`/settings/content/templates/:templateId`)
- Eine gemeinsame Lebensmittelauswahl für Eintragen, Rezepte und Vorlagen
- Behoben: Löschen von Rezepten, Vorlagen, Plänen, Trainingstagen und Trainings mit abhängigen
  Daten meldete auf Android und im Browser fälschlich einen Fehler (das Plugin zählt
  mitgelöschte Zeilen mit)
- Keine Migration; eingetragene Tage und der Score bleiben unverändert
- Details: [SETTINGS.md](SETTINGS.md)

## Phase 12 – Regression & Datenfluss-Härtung ✅ (Version 0.17.0)

Keine neuen Funktionen. Gefunden und behoben:

- „Aktivitätskalorien anrechnen“ war unversioniert: Umschalten änderte das Tagesziel aller
  vergangenen Tage (Tagebuch, Fortschritt, Score). Jetzt versioniert in `goal_targets`
  (Migration 15); ein bisheriges „an“ gilt ab `1970-01-01`, vergangene Tage bleiben identisch
- Fortschrittskarte „Aktivitäten“ zählte eine Health-Connect-Einheit, die dasselbe wie ein
  Kalethra-Training ist, zusätzlich – jetzt dieselben Regeln wie Tagesbudget und Score
- Doppelte Implementierungen zusammengeführt: Anrechenbarkeit von Aktivitäten, Laden der
  Aktivitätsquellen, Gewichtsregel 2 (`mergeWeightDays`/`dayWeight`); `mergeWeightDays` gibt nur
  noch Datum, Gewicht und Quelle zurück
- Kein Rückwärts-Schreibpfad für Ziele mehr: das ungenutzte `GoalService.setManual` (überschrieb
  die gültige Version eines vergangenen Tages) ist entfernt, `GoalService.save` legt eine Version
  nur noch ab heute an, `TargetRepository` wird nicht mehr exportiert. Jede Zieländerung gilt
  ab dem Tag, an dem sie gemacht wird
- Kettentests A–H über alle Module, Regressions-E2E (alle Seiten bei 320/390 px, hell/dunkel,
  große Schrift, keine Tastatur, Tippflächen)
- Details: [SETTINGS.md](SETTINGS.md), [ARCHITECTURE.md](ARCHITECTURE.md)

## Phase 13 – Trainingserlebnis & Progression ✅ (Version 0.18.0)

- Nächstes Training je Plan aus der eigenen Historie, ohne „aktiven Plan“; freie Wahl jedes Tages
- Letzte Werte je Satz beim Training (tatsächliche Leistung, Drops mit ↓)
- Optionale Gewichtssteigerungs-Vorschläge (Aus/Vorsichtig/Normal/Progressiv, Einstellungen →
  Ziele → Training): erst nach mehreren erfolgreichen Einheiten in Folge, mehr Gewicht → weniger
  Wiederholungen, nie automatisch
- Pausentimer (Einstellungen → App → Training, 0 = aus) mit Anhalten, Überspringen, Vibration
- Übung im Training ersetzen (Plan bleibt), Satztyp ändern und einzelne Sätze löschen
- Zusammenfassung nach dem Abschluss (Dauer, Übungen, Sätze, Volumen, neues Höchstgewicht)
- Abgeschlossene Trainings vollständig bearbeitbar, auch die Dauer
- Keine Migration; Details: [SETTINGS.md](SETTINGS.md#training-phase-13),
  [ARCHITECTURE.md](ARCHITECTURE.md)

## Phase 14 – Fortschritt & Zielerreichung ✅ (Version 0.19.0)

- Alle Fortschrittskarten zeigen Ist gegen Ziel aus den Einstellungen: Training („3 von 4
  Einheiten“), Ernährung (Kalorien je Hauptziel als Obergrenze/Zielgröße/Zielbereich, Protein),
  Aktivitäten (aktive Minuten), neue Karte Schritte; Gewicht nur als Verlauf („93,0 kg → 91,8 kg“)
- Zentral: `core/progress` (`ProgressGoalService`), gemeinsame Soll-Berechnung
  (`weeklyExpectation`) und Schwellen (`goalAttainment.ts`) mit dem Score; Score unverändert
- Fehlende Daten bleiben neutral, historische Zielversionen werden je Tag verwendet
- Keine Migration; Details: [PROGRESS.md](PROGRESS.md#zielerreichung-phase-14)
- Nachtrag: Schritte außerhalb getrackter Aktivitäten als zweites Signal im Score-Bereich
  „Aktivitäten“ (Mittelwert mit den aktiven Minuten, Gewichtung unverändert); Tendenz neutral
  „Gestiegen“ / „Gesunken“ / „Ungefähr gleich“

## Phase 15 – Ernährung konsolidieren ✅ (Version 0.20.0)

- Kalorienpunkte im Score nach Hauptziel des Tages (Abnehmen Obergrenze, Muskelaufbau ab 95 %,
  Halten/Fitness 95–105 %) – eine Funktion für Score und Fortschrittskarte
- Protein unverändert (90 %); Kohlenhydrate und Fett als Zielerreichung auf der Fortschrittskarte,
  ohne Einfluss auf den Score; Gewichte und vier Bereiche unverändert
- Lebensmittelverwaltung mit Barcode und BLS-Suche unter Einstellungen → Meine Inhalte (gemeinsamer
  Barcode-Ablauf mit dem Eintragen); historische Tage bleiben unverändert
- Keine Migration; Details: [SCORE.md](SCORE.md#ernährung), [SETTINGS.md](SETTINGS.md)

## Phase 16 – Gesundheit & Health Connect konsolidiert ✅ (Version 0.21.0)

- Schritte: eine Auswertung für Gesundheit, Fortschritt und Score (Tag anteilig, max. 100 %, heute
  ebenfalls anteilig); eigener Durchschnitt der Gesundheitsansicht entfernt
- Aktive Minuten: Karte und Score mit demselben Ganzminuten-Ziel (keine 77/78-Differenz mehr)
- Aktivitäten: Kalorienbudget, Kartensummen, Minuten und Schritte über eine Anrechenbarkeit
  (`countableActivities`)
- Sync, Berechtigungen, Trennen/Verbinden, Gewichtsregeln, Regeneration geprüft – unverändert
- Keine Migration; Details: [HEALTH_CONNECT.md](HEALTH_CONNECT.md)

## Phase 17.1 – Vorhandene Daten besser nutzen ✅ (Version 0.22.0)

Auf dem vollständigen Stand 0.21.0 (Phasen 14–16) aufgebaut. Eine erste Fassung war versehentlich
auf dem Stand von Phase 13 entstanden (dort als 0.19.0 gebaut, nie Release-Stand); sie ist
inhaltlich hierher übertragen und ersetzt.

- Übungsdetail (Trainingsbibliothek): **Deine Leistung** für Übungen mit Gewicht – Bestwert
  (stärkster Satz nach geschätztem Maximum, Epley, nur abgeschlossene Arbeitssätze mit 1–12
  Wiederholungen), letzte Leistung und Richtung gegenüber den drei Trainings davor
  (`core/training/metrics.ts` → `exerciseProgress`, eine Abfrage); bestehende Bestwert- und
  Progressionslogik unverändert
- **Pace** (min/km) für Aktivitäten zu Fuß, abgeleitet und nicht gespeichert – im
  Aktivitätsdetail und beim Erfassen ([ACTIVITIES.md](ACTIVITIES.md#pace-phase-171))
- **Ballaststoffe** des Tages als ruhige Zeile unter den Makros im Tagebuch: ohne Ziel, Score,
  Balken oder Warnung; „mind. …“, wenn nicht alle Einträge sie kennen, keine Zahl, wenn zu wenige
  (< 80 % der kcal)
- Korrektur: Ein Rezept, bei dem eine Zutat einen Detailwert nicht kennt, speichert diesen Wert
  als unbekannt statt als Teilsumme (bestehende Einträge unverändert)
- Audit ohne Umbau: Fortschritt auf Stand 0.21.0 ([PROGRESS.md](PROGRESS.md#produkt-audit-phase-171-stand-0210)),
  selten genutzte Spalten ([DATABASE.md](DATABASE.md#selten-genutzte-spalten-audit-phase-171))
- Keine Migration, keine neue Berechtigung, keine neue Eingabe

## Phase 17.3 – Fortschritt & Gesundheit bereinigt ✅ (Version 0.23.0)

Gezielte Punkte aus dem UX-Audit 17.2 – nur Darstellung, keine Berechnung, kein Datenmodell:

- Fortschritt öffnet mit **Heute** (7/30 Tage wählbar)
- Gewicht in „Heute“: aktueller Wert mit Tag („heute“ / „vom 28.09.“), kein Scheinvergleich
- Ernährung in „Heute“: ohne „An 1 von 1 Tagen erfasst“
- Training: „Ø pro Woche“ nur über 30 Tage, keine doppelte Anzahl
- Schritte: Ziel nicht doppelt, wenn der Balken es schon zeigt
- Gesundheit: leere Platzhalter (Ruhepuls, Schlaf, Körperfett, Muskelmasse) entfernt; Reihenfolge
  Gewicht → Entwicklung → Verlauf → Regeneration → Schritte & Aktivität → Health Connect
- Trainingsdetail: Übungsname öffnet das Übungsdetail mit „Deine Leistung“ (nicht im laufenden
  Training)
- Details: [PROGRESS.md](PROGRESS.md#tagesansicht-und-redundanzen-phase-173)

## Phase 17.4 – Kernabläufe und visuelle Hierarchie ✅ (Version 0.24.0)

Punkte aus dem UX-Audit von 0.23.0 – nur Darstellung und Bedienung, keine Berechnung, kein
Datenmodell, keine neue Berechtigung:

- Laufendes Training als eigener Modus: „Training beenden“ oben rechts, „Titel und Notizen“ und
  „Training verwerfen“ (weiter mit Bestätigung) im Menü „Mehr“, keine Tab-Leiste; zurück zu
  Training bleibt möglich, das Training läuft weiter
- Pausentimer einzeilig: Zeit, Anhalten/Weiter, Überspringen (Logik, Autostart, Haptik unverändert)
- Zweiter Startknopf neben dem nächsten Training heißt „Anderes Training“
- Hinzufügen: Suche zuerst, Barcode-Scan als Symbol im Suchfeld, „Barcode eingeben“ als ruhige
  Zeile; jedes Lebensmittel nur einmal (Zuletzt verwendet → Favoriten → Weitere Lebensmittel)
- Tagebuch: Mahlzeiten als Gruppen mit kcal im Kopf, ruhiges „+ Hinzufügen“, kein Leertext,
  „Als Vorlage speichern“ im Mahlzeitenmenü
- Wasser: Summe und Ziel vorn, Einträge einklappbar („n Einträge“)
- Vorläufiger Score: Zahl zurückgenommen, eine Metazeile, keine Einstufung (Formel unverändert)
- Fortschrittskarten: eine Hauptaussage je Karte, Kohlenhydrate/Fett als ruhige Zeile

## Phase 17.5 – Gesundheit, Ernährung und laufender Score ✅ (Version 0.25.0)

Oberfläche vereinfacht, laufender Ernährungstag im Score nach Uhrzeit bewertet:

- Gesundheit: Schritte und Schrittziel als eine Aussage („6.200 / 8.000 Schritte“ mit Balken),
  ohne eigene Zielzeile und ohne Wochenzeile; letzte Aktualisierung im Fußtext; das importierte
  Gewicht wird nicht mehr angezeigt (Import, Speicherung und Berechtigungen unverändert); kein
  Hinweis unter „Gewicht eintragen“
- Ernährung: Tagesseite zeigt die Mahlzeiten nur mit Namen und kcal (je ein „+“); Antippen
  öffnet die Details mit Lebensmitteln, Mengen, Nährwerten, Bearbeiten/Löschen, Hinzufügen und
  „Als Vorlage speichern“ – Hinzufügen und Bearbeiten kehren dorthin zurück
- Ernährung: kein Wasser-Hinweis, kein Link „Ernährungsprofil“ (Ziele in Einstellungen → Ziele;
  ohne jedes Ziel bleibt ein Hinweis „Ziele festlegen“), keine Ballaststoffe in der Tagesansicht
  (Daten unverändert)
- Score: der laufende Ernährungstag wird gegen den Tagesanteil ± eine Mahlzeit bewertet
  ([SCORE.md](SCORE.md#ernährung)); abgeschlossene Tage, Gewichte, Komponenten und Trend
  unverändert

## 3D-Übungsdarstellung – Prototyp ✅ (Version 0.26.0)

Eigene, stilisierte 3D-Figur (three.js, lazy geladen) mit Muskel-Hervorhebung aus den
vorhandenen Übungsdaten – Details: [EXERCISE_VISUALS.md](EXERCISE_VISUALS.md):

- Bankdrücken und Latzug: kleine Figur in den Übungsdetails, große Ansicht mit Drehen,
  Vorder-/Rückseite und ruhiger Bewegungsschleife (Play/Pause)
- Trainings-Zusammenfassung: „Beanspruchte Muskeln“ aus den tatsächlich absolvierten Übungen
- Kein externes Modell, keine Datenbankänderung, keine neue Route

## Phase 18.1 – 3D: Hierarchie, Asset-Vertrag, Varianten ✅ (Version 0.27.0)

Technische Qualitäts- und Architekturphase – **visuell noch nicht final** (Details:
[EXERCISE_VISUALS.md](EXERCISE_VISUALS.md)):

- Rotationsfehler an der Quelle behoben: nur die Bühne dreht; die Stange wurde über Weltmatrizen
  doppelt gedreht; Gliedmaßen-Twist aus der IK-Biegeebene statt aus dem rohen Richtungshinweis
- Asset-Vertrag als Code: Varianten male/female nach Profil (sonst Standard), Muskel-Knoten
  `muscle_<gruppe>[_<teil>]`, Pflicht-Bones, Movement-Types → Clips, Validator, Budgets
- GLB-Importpfad (eigener Chunk) mit Fallback bei fehlendem oder fehlerhaftem Asset; die
  Code-Figur ist als Fallback gekapselt und gekennzeichnet
- Neuer Kontext nach WebGL-Kontextverlust (App verlassen/zurückkehren)
- Workout-Zusammenfassung: zusätzlich abgesichert (0, 1, mehrere Übungen; Zurück-Geste)

## Phase 18.2 – 3D: finale Figuren männlich/weiblich ✅ (Version 0.28.0)

Details: [EXERCISE_VISUALS.md](EXERCISE_VISUALS.md), Assets:
[assets/figure/docs/README.md](../assets/figure/docs/README.md):

- Zwei Kalethra-Körper (männlich, weiblich) als gebündelte GLBs, erzeugt mit einer
  reproduzierbaren Pipeline (`tools/figures`) aus MakeHuman-Daten (CC0): Kopf ohne Gesicht,
  matte Haut, Muskel-Knoten mit Trennfugen und Faser-Normal-Map, Top und Shorts in Anthrazit,
  Rig mit Twist-Bones, Clips Bankdrücken und Latzug mit Geräten
- Vertrag erweitert (`root`, `body_*`, `prop_<variante>_*`), Datei-Validator für GLBs als
  CI-Gate, `loadBody(variant)` mit geteiltem Laden und Freigabe, Übung → Movement-Type → Clip
  für die ganze Bibliothek
- Die Code-Figur bleibt ausschließlich technischer Fallback
- Offen: weitere Clips, Gerätetest auf echter Hardware, künstlerische Feinarbeit

## Phase 18.3 – 3D: Experiment modellierte Anatomie ✅ (ohne Versionswechsel)

Isolierter Versuch (`tools/figure-experiment/`, `assets/figure/experimental/sketchfab-base/`):
Anatomie aus „Proxy Human base Mesh“ (sphere_joe, CC BY 4.0) in Blender neu modelliert, als
Kandidat geprüft, nicht in der App.

## Phase 18.4 – 3D: männlicher Körper mit modellierter Anatomie ✅ (Version 0.29.0)

Details: [EXERCISE_VISUALS.md](EXERCISE_VISUALS.md), [Gerätetest](FIGURE_DEVICE_TEST.md):

- Produktiver männlicher Körper übernimmt die Anatomie aus 18.3 (Hybrid: Sculpt-Form auf das
  MakeHuman-Netz übertragen, Detail als Normal-Map); Vertrag, Budgets, Muskelgruppen,
  Highlight-Logik und Architektur unverändert
- Rig mit Finger-/Daumen-Bones (nur männlich), geglättete Schultergewichte; Clips neu aus den
  neuen Gelenken: Finger umschließen die Stange, Schulterrhythmus beim Armheben
- Kleidung mit geometrischem Armausschnitt und eng anliegenden Stofflagen; neues Figurenlicht,
  Highlight primär 80 % Akzent (kein „Diagramm“-Ton)
- CC-BY-4.0-Namensnennung in der App (Datenquellen), in der GLB und in der Doku
- Weiblicher Körper unverändert (byte-gleich zu 0.28.0)
- Offen: Gerätetest auf dem Xiaomi 15 Ultra, weiblicher Körper im neuen Stil, weitere Clips

## Phase 18.5 – 3D: Anatomie, Griff und Muskelhighlights verbessern ✅ (Version 0.29.1)

Nach dem Gerätetest von 0.29.0 (Xiaomi 15 Ultra) gezielte Qualitätskorrektur des männlichen
Körpers, keine neue Funktion. Details: [EXERCISE_VISUALS.md](EXERCISE_VISUALS.md),
[Asset-Doku](../assets/figure/docs/README.md), [Vorher/Nachher](figure-qa/phase-18.5/):

- Rücken/Schulter beim Latzug: Ursache schmales Gewichtsband Brust ↔ Oberarm hinter der Achsel
  (LBS-Kollaps) plus Netzfalten aus Fit und Grenzbegradigung; jetzt Schultergürtel als
  Zwischenstufe in den Gewichten, faltensichere Begradigung, Faltenglättung nach dem Fit,
  Schulterrhythmus mit Retraktion unten im Zug – lokale Dellen 8–12 mm → 4–7 mm
- Griff: Stange führt, explizite Griffreferenz pro Übung, Hand und Arm folgen; Finger per
  Kontakt-Löser – keine Hand mehr in der Stange (vorher bis 14 mm), jeder Finger an der Stange
- Finger: ein Bone je Fingerglied (vorher drei Bones für alle Finger, falsche Drehpunkte),
  Gelenke in der Querschnittsmitte, schlankere Finger und Handfläche
- Highlights: weiche Übergänge über Gewichte pro Vertex (optional im Vertrag, Validator prüft
  sie), Splitter-Regionen bereinigt; Gruppen und Zuordnung unverändert
- Weiblicher Körper byte-gleich zu 0.28.0; Budgets eingehalten (52 090 Dreiecke, 3,35 MiB)
- Offen: Gerätetest von 0.29.1; Rest-Delle hinter der Achsel bei Überkopf-Armen (LBS)

## Phase 19 – Trainings-Tracking: Fokusansicht ✅ (Version 0.30.0)

Das laufende Training ist einfacher und schneller zu bedienen. Details:
[ARCHITECTURE.md](ARCHITECTURE.md#trainingssystem-phase-3):

- Fokusansicht als Standard: eine Übung, „Übung x von y“, freie Navigation ‹ ›, letzte Werte,
  Vorschlag, Sätze in Kurzform (abgeschlossen mit Haken, aktueller Satz hervorgehoben)
- Gewicht und Wdh. mit großen −/+-Tasten (1,25 kg bzw. 2,5 lb, ganze Wdh.) und Direkteingabe
- „Satz N abschließen“: speichert, startet die Pause, bereitet den nächsten offenen Satz vor, nach
  dem letzten Satz einer Übung folgt die nächste Übung; nie ein zusätzlicher Satz, Doppeltipp
  schließt nur einmal ab; abgeschlossene Sätze antippen zum Korrigieren oder Wiederöffnen
- „Alle Übungen“ als umschaltbare Liste mit allen bisherigen Funktionen
- Pause übersteht Zurück und Fortsetzen (nicht den App-Neustart)
- Beenden entfernt alle nicht abgeschlossenen (auch vorbelegten) Sätze
- Keine Migration, keine neue Abhängigkeit
- Offen: Gerätetest (Xiaomi 15 Ultra)

## Phase 19.1 – 3D-Körper: Rücken, Nacken, Achsel ✅ (Version 0.30.1)

Gezielte Qualitätskorrektur beider Körper, keine neue Funktion. Details und Messungen:
[`figure-qa/phase-19.1/`](figure-qa/phase-19.1/):

- Neuer letzter Build-Schritt `tools/figures/lib/repair.mjs` (deterministisch, lokal, Masken aus den
  Gelenken), angewendet mit `node tools/figures/repair.mjs`
- Männlich: Knitter an Nacken/Trapez und Furchen an der hinteren Schulter beseitigt (Glättung
  entlang der Normalen, Sculpt-Relief dort gedämpft); Achsel ohne gefaltete Dreiecke
- Weiblich: zackiger Übergang Hinterkopf–Hals und Spitzen an der hinteren Achsel beseitigt
- Halsausschnitt des Tops geglättet (männlich bleiben zwei kleine Stufen)
- Neue Tests (`bodySurface.test.ts`, Kopf–Hals in Bewegung); Lizenzen, Assets und Ladepfade
  unverändert, kein neues Asset, keine Beleuchtungsänderung
- Offen: Gerätetest; Gesamtbuild aus MakeHuman-Quellen hier nicht ausgeführt

## Phase 20 – Designsystem „Natürlich & ruhig“ (Phase B) ✅ (Version 0.31.0)

Zentrale Tokens und gemeinsame Komponenten modernisiert, keine Bildschirm-Neugestaltung. Details:
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), Vorher/Nachher: [`design-qa/phase-20/`](design-qa/phase-20/):

- Hell: warme Creme (`#f3efe6`) statt Kaltweiß, Karten mit feiner Kante und leichtem Schatten,
  Akzent `#557a5b` unverändert, Waldgrün für gedrückte Primärknöpfe
- Dunkel: tiefes Graugrün mit klaren Ebenen (Hintergrund < Sheet < Karte < erhöht),
  Hintergrund/Karte 1,26 : 1, Kanten statt Schatten, alle Textstufen ≥ 4,5 : 1
- Neue semantische Tokens: Dialogfläche, Hover, starke Kante, Kartenkante, Waldgrün,
  Info-Farbe, Schatten, semantische Radien, Steuerhöhen, Icon-Größen, Fokus- und
  Deaktiviert-Zustand
- `Button`: neue Variante `tertiary` und Größe `compact`; `secondary` als Kontur,
  `destructive` auf zarter Fehlerfläche; bestehende Aufrufe unverändert
- Felder, Segmente, Stepper, Listen, Sheets und Tab-Leiste vereinheitlicht (aktiver Tab mit
  Salbei-Pille); Eyebrow ohne Versalien; Listentitel trennen Wörter nicht mehr mitten im Wort
- Icon-System: neue Icons `sleep`, `steps`, `info`, `warning`, Zuordnung `ICON_FOR`
  (`src/ui/icons/roles.ts`), optionales `label` für bedeutungstragende Icons;
  Regeln für Bilder und Illustrationen dokumentiert
- Tests: WCAG-Kontraste beider Modi, Ebenen, Theme-Farbe, Button-Varianten/-Zustände, Icons
- Offen (Phase C): Modul-Karten mit Kante/Schatten, Versal-Labels in Modulen, Icons in den
  Bildschirmen; Gerätetest

## Phase 20.1 – Fortschritt als Referenzbildschirm (Phase C.1) ✅ (Version 0.32.0)

Erster vollständig umgestellter Bildschirm auf Basis des Designsystems; Score-Berechnung,
Datenquellen und Produktstruktur unverändert. Vorher/Nachher:
[`design-qa/phase-20.1/`](design-qa/phase-20.1/):

- Kalethra-Score als Schwerpunkt: Zahl im Ring (Bogen = derselbe Wert), Bewertung und Tendenz
  daneben, vier Bereiche mit kleinen Balken; vorläufig und leer weiterhin eindeutig gekennzeichnet
- Bereichskarten mit Kante und Schatten, Icon-Kachel, Titel ohne Versalien; leere Bereiche
  kompakt; Inhalt auf kleinen Displays in voller Breite
- Icons nach Rolle (`ICON_FOR`), neues Icon `activity` für Aktivitäten, Schritte mit `steps`
- Diagramme: Nulllinie, benannte Referenzlinie („Ø Ziel“)
- Erklär-Sheet: Überschriften ohne Versalien, Kennzeichnung „Vorläufig“ als Plakette
- Keine Bilder ergänzt: eine Illustration hätte hier nichts erklärt
- Offen: Gerätetest; Training, Ernährung, Gesundheit und Einstellungen folgen nach Freigabe

## Phase 20.2 – Alle Bereiche im neuen Design (Phase C.2) ✅ (Version 0.33.0)

Training, Ernährung, Gesundheit und Einstellungen (mit Profil, Zielen, Meinen Inhalten, App)
nach dem Muster der Fortschritt-Seite; Fortschritt selbst unverändert. Nur Darstellung –
Geschäftslogik, Datenquellen, Abläufe, Navigation und Datenbank unverändert. Vorher/Nachher:
[`design-qa/phase-20.2/`](design-qa/phase-20.2/):

- Karten und Felder einheitlich (Kante, Schatten, Radien, Feldrahmen, Fokusring), keine Versalien
- Training: Hero „Nächstes Training“/laufendes Training auf Salbei-Fläche; aktives Training mit
  „Satz abschließen“ als einziger Hauptaktion, „Training beenden“ sekundär; erhöhte Fokus-Karte
  und Pausenleiste
- Ernährung: Tageskarte erhöht, Mahlzeiten-Kacheln in Lebensmitteltönen, Wasser-Kachel
- Gesundheit: Gewicht mit Kachel (neutral ohne Wert), „Verlauf“ erst mit Einträgen, Schritte mit
  Icon
- Einstellungen: Profilkarte, Icons nach Rolle
- Icons: `flame` nur noch Energie; neue Icons `recipe` und `distance`; Rollen für Mahlzeiten,
  Inhalte, Energie, Distanz
- Tokens: `--color-surface-accent(-border)`, `--color-switch-knob`, `--shadow-knob`
- Keine Bilder ergänzt; 3D-Körper unverändert
- Offen: Gerätetest

## Phase 6.4 – geplant

- Apple Health (HealthKit) auf iOS

## Phase 4.6 – Vorschlag

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
