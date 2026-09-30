# Traininsapp

Modulare Fitness- und Gesundheits-App für Android und iOS – Training, Ernährung, Gesundheit,
Aktivität und Regeneration in einer App, lokal nutzbar ohne Konto.

**Status:** Phase 1 – technisches Fundament und Grundoberfläche. Fachfunktionen folgen ab Phase 2
(siehe [ROADMAP.md](ROADMAP.md)).

| Dokument                             | Inhalt                                                       |
| ------------------------------------ | ------------------------------------------------------------ |
| [ARCHITECTURE.md](ARCHITECTURE.md)   | Schichten, Module, Schnittstellen, Architekturentscheidungen |
| [DATABASE.md](DATABASE.md)           | Datenbankkonzept, Migrationen, Sync-Vorbereitung             |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Tokens, Komponenten, Gestaltungsregeln                       |
| [ROADMAP.md](ROADMAP.md)             | Phasenplan, bekannte Einschränkungen                         |

## Technologien

| Bereich      | Technologie                                                         |
| ------------ | ------------------------------------------------------------------- |
| UI           | React 19, TypeScript 6 (strict), CSS Modules + CSS-Variablen        |
| Build        | Vite 8                                                              |
| Navigation   | React Router 8                                                      |
| Native Hülle | Capacitor 8 (Android, iOS)                                          |
| Datenbank    | SQLite über `@capacitor-community/sqlite` (Web: `jeep-sqlite`)      |
| Tests        | Vitest, Testing Library, jsdom, sql.js (echtes SQLite im Test)      |
| Codequalität | ESLint (typescript-eslint strict, React Hooks), Prettier            |
| CI           | GitHub Actions (Checks, Web-Build, Android-Debug-APK, optional iOS) |

Bewusst **nicht** verwendet: UI-Bibliotheken, CSS-Frameworks, Icon-Pakete, State-Management-
und i18n-Bibliotheken. Begründung in [ARCHITECTURE.md](ARCHITECTURE.md#adr-übersicht).

## Voraussetzungen

- Node.js 22 (siehe `.nvmrc`) und npm
- Android: Android Studio (aktuelles SDK, API 36), JDK 21
- iOS: macOS mit Xcode 16 oder neuer (Swift Package Manager, kein CocoaPods nötig)

## Schnellstart

```bash
npm install
npm run dev          # Entwicklungsserver im Browser (http://localhost:5173)
```

Im Browser läuft SQLite als WebAssembly und speichert in IndexedDB. Das ist nur für die
Entwicklung gedacht – das Produkt sind die nativen Apps.

## Befehle

| Befehl                | Zweck                                                           |
| --------------------- | --------------------------------------------------------------- |
| `npm run dev`         | Entwicklungsserver                                              |
| `npm run build`       | Typecheck + Produktionsbuild nach `dist/`                       |
| `npm run check`       | Typecheck, Lint, Formatprüfung und Tests (vor jedem Commit)     |
| `npm test`            | Tests einmalig; `npm run test:watch` im Watch-Modus             |
| `npm run lint`        | ESLint (null Warnungen erlaubt)                                 |
| `npm run format`      | Prettier schreibt Formatierung                                  |
| `npm run cap:sync`    | Build + Web-Assets und Plugins in die nativen Projekte kopieren |
| `npm run cap:android` | Sync + Android Studio öffnen                                    |
| `npm run cap:ios`     | Sync + Xcode öffnen                                             |

## Auf Geräten testen

**Android**

1. `npm run cap:android` – öffnet `android/` in Android Studio.
2. Gerät per USB (Entwickleroptionen, USB-Debugging) oder Emulator wählen, _Run_ drücken.
3. Alternativ lädt die CI bei jedem Push ein Debug-APK als Artefakt hoch (`android-debug-apk`).

**iOS**

1. `npm run cap:ios` – öffnet `ios/App/App.xcodeproj` in Xcode.
2. Unter _Signing & Capabilities_ ein Team auswählen (für echte Geräte ist ein Apple-Developer-
   Konto nötig; der Simulator funktioniert ohne).
3. Gerät oder Simulator wählen, _Run_ drücken.

Nach jeder Änderung am Web-Code vor dem nativen Start `npm run cap:sync` ausführen.

## Projektstruktur

```
src/
  app/        App-Shell: Start, Provider, Router, Tab-Navigation, Modul-Registry
  core/       Infrastruktur ohne UI: database, i18n, settings, user, sync, theme, platform
  modules/    Fachmodule: dashboard, training, nutrition, health, profile
  ui/         Designsystem: Tokens, Basis-Styles, Icons, gemeinsame Komponenten
  shared/     Reine Hilfsfunktionen (Datum, IDs, Formatierung)
  test/       Test-Setup und Helfer
android/, ios/  Native Projekte (von Capacitor erzeugt, versioniert)
scripts/        Build-Hilfsskripte
```

Details und Abhängigkeitsregeln: [ARCHITECTURE.md](ARCHITECTURE.md).

## Mehrsprachigkeit

Deutsch und Englisch. Die Sprache folgt beim ersten Start der Gerätesprache und kann unter
_Profil → Sprache_ geändert werden. Alle Texte liegen in `src/core/i18n/locales/`. Eine neue
Sprache: Datei in `locales/` anlegen und in `src/core/i18n/config.ts` registrieren – TypeScript
und Tests erzwingen Vollständigkeit. Fest codierte Texte in JSX werden von ESLint abgelehnt.

## Beitrag leisten

- Vor jedem Commit `npm run check`.
- Neue Datenbanktabellen nur per Migration (siehe [DATABASE.md](DATABASE.md)).
- Keine neuen Abhängigkeiten ohne Begründung im Pull Request.
