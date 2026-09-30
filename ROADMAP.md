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
  unverschlüsselte Gesundheits- und Standortdaten ([docs/PRIVACY.md](docs/PRIVACY.md))
- GPS-Plattformgrenze (`LocationTracker`) und Konzept ([docs/GPS_ARCHITECTURE.md](docs/GPS_ARCHITECTURE.md))
- Erweiterbarkeit: Module ohne Tab möglich, strengere Architekturregeln (Capacitor nur in
  Adaptern, Domain-Logik ohne React)

## Phase 2, Schritt 1 – Datenbankverschlüsselung 🟡

- SQLCipher-Verschlüsselung auf Android und iOS, Schlüssel im Keystore/Keychain
- Kein Fallback auf unverschlüsselte Daten, eigene Fehlerbildschirme bei Schlüssel- und
  Migrationsproblemen
- Speicher-Selbsttest im Profil („Datenschutz & Sicherheit“)
- **Ausstehend:** Validierung auf dem Xiaomi 15 Ultra → danach Schritt 2 (Körpergewicht)

## Phase 2 – Erste Fachfunktionen (Vorschlag)

Empfohlene Reihenfolge – jeweils vollständig und nutzbar statt alles gleichzeitig:

1. **Gesundheit: Körpergewicht manuell erfassen** – kleinster vollständiger Durchstich durch alle
   Schichten (Migration `measurements`, Repository, Service, Liste, Eingabe, Verlauf als einfache
   Liste). Validiert die Datenmuster, bevor größere Module folgen. Vorher: Datenbank-
   verschlüsselung umsetzen und auf Geräten testen (siehe docs/PRIVACY.md).
2. **Einheiten-Einstellung** (metrisch/imperial) – wird mit dem ersten Messwert gebraucht.
3. **Training: Übungskatalog + freies Workout protokollieren** (Krafttraining: Übungen, Sätze,
   Wiederholungen, Gewicht). Datenmodell mit Beschreibung je Trainingsart (siehe ARCHITECTURE.md).
4. **Dashboard** liest echte Kennzahlen über Modulschnittstellen.
5. **Ziele** (Zielgewicht, Trainingstage pro Woche).

Querschnitt in Phase 2: Unterseiten-Navigation mit Zurück-Geste und Android-Zurücktaste,
Pluralformen in i18n, App-Icon und Splash-Screen, erste Tests auf echten Geräten.

## Phase 3 – Ernährung und Aktivität

- Mahlzeiten und Lebensmittel manuell, eigene Lebensmittel, Favoriten
- Lebensmitteldatenbank (Bewertung: Open Food Facts – offen, aber Datenqualität prüfen)
- Barcode-Scanner (`@capacitor-mlkit/barcode-scanning`)
- Schritte und aktive Energie aus Apple HealthKit / Android Health Connect

## Phase 4 – Trainingspläne und weitere Disziplinen

- Trainingspläne, Wochenplanung, Fortschreibung (Progression)
- Ausdauer/Cardio, HYROX, Calisthenics, Mobility
- Erinnerungen per lokaler Benachrichtigung

## Phase 5 – Konto, Synchronisierung, Monetarisierung

- Supabase-Auth (E-Mail, Sign in with Apple, Google), Kontoverknüpfung des lokalen Profils
- Synchronisierung nach ADR-004
- Datenexport und Kontolöschung
- Abonnements über RevenueCat, Freischaltungen über `EntitlementService`

## Später

Statistiken und Fortschrittsanalysen mit Diagrammen, Schlaf und Regeneration, Widgets,
Smartwatch-Anbindung, KI-gestützte Empfehlungen (nur mit klarem Nutzen und Datenschutzkonzept).

## Bekannte Einschränkungen (Stand Phase 1)

| Thema                     | Beschreibung                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keine Gerätetests         | Android und iOS wurden **nicht** auf echten Geräten oder Emulatoren getestet. In der Entwicklungsumgebung war kein Android SDK und kein Xcode verfügbar. Der Android-Debug-Build läuft in der CI (GitHub Actions) und liefert eine installierbare APK; der iOS-Build ist dort manuell startbar und wurde noch nicht ausgeführt. |
| Web nur für Entwicklung   | Im Browser speichert SQLite (WASM) in IndexedDB. Das ist nicht als Produkt gedacht.                                                                                                                                                                                                                                             |
| sql.js gepinnt            | `sql.js` ist auf 1.11.0 fixiert, weil `jeep-sqlite` 2.8.0 genau diese Version bündelt. `jeep-sqlite` ist seit 2024 nicht aktualisiert – betrifft nur den Web-Entwicklungsmodus, bei Problemen durch eigenen sql.js-Treiber ersetzbar.                                                                                           |
| WASM im nativen Paket     | Die `sql-wasm.wasm` (~650 KB) landet auch in den nativen Paketen, obwohl sie dort ungenutzt ist. Kann später beim `cap sync` ausgeschlossen werden.                                                                                                                                                                             |
| Build-Warnung             | Vite meldet beim Build, dass `jeep-sqlite` das Node-Modul `crypto` importiert; es wird im Browser nicht benötigt. Harmlos.                                                                                                                                                                                                      |
| npm audit                 | 3 mittlere Meldungen in `@capacitor/cli` (Abhängigkeit `xcode` → `uuid`). Nur Build-Werkzeug, nicht in der App enthalten. Der von npm vorgeschlagene Fix wäre ein Downgrade; wir warten auf ein Update von Capacitor.                                                                                                           |
| Kein paralleles Schreiben | Der Capacitor-Treiber serialisiert Transaktionen nicht über mehrere gleichzeitige asynchrone Abläufe. Solange Schreibzugriffe über Services laufen, unkritisch; bei Hintergrundimporten (Phase 3) ist eine Schreibwarteschlange vorzusehen.                                                                                     |
| Standard-Icons            | App-Icon und Splash-Screen sind noch die Capacitor-Vorgaben.                                                                                                                                                                                                                                                                    |
| Wochenbeginn              | Die Wochenansicht beginnt immer am Montag (ISO 8601), unabhängig von der Region.                                                                                                                                                                                                                                                |
