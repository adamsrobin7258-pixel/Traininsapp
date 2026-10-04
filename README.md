# Kalethra

Modulare Fitness- und Gesundheits-App für Android und iOS – Training, Ernährung, Gesundheit,
Aktivität und Regeneration in einer App, lokal nutzbar ohne Konto.

|                                    |                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Produktname                        | **Kalethra**                                                                         |
| Android Package ID / iOS Bundle ID | `com.kalethra.app`                                                                   |
| Version                            | aus `package.json` (Android `versionCode` wird daraus abgeleitet, z. B. 0.1.1 → 101) |

**Status:** Phase 3 (Version 0.2.0) – verschlüsselte lokale Datenbank, Körpergewicht und
Krafttraining mit Übungsdatenbank, Plänen und Verlauf; weitere Sportarten sind architektonisch
vorbereitet (siehe [docs/ROADMAP.md](docs/ROADMAP.md)).

| Dokument                                             | Inhalt                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)         | Schichten, Module, Schnittstellen, Architekturentscheidungen |
| [docs/DATABASE.md](docs/DATABASE.md)                 | Datenbankkonzept, Migrationen, Sync-Vorbereitung             |
| [docs/PRIVACY.md](docs/PRIVACY.md)                   | Datenschutz, Datenkatalog, Backup, Verschlüsselung, Löschung |
| [docs/GPS_ARCHITECTURE.md](docs/GPS_ARCHITECTURE.md) | Plattformgrenze und Konzept für GPS-Tracking                 |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)       | Tokens, Komponenten, Gestaltungsregeln                       |
| [docs/ROADMAP.md](docs/ROADMAP.md)                   | Phasenplan, bekannte Einschränkungen                         |

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
und i18n-Bibliotheken. Begründung in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#adr-übersicht).

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

| Befehl                | Zweck                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `npm run dev`         | Entwicklungsserver                                                   |
| `npm run build`       | Typecheck + Produktionsbuild nach `dist/`                            |
| `npm run check`       | Typecheck, Lint, Formatprüfung und Tests (vor jedem Commit)          |
| `npm test`            | Tests einmalig; `npm run test:watch` im Watch-Modus                  |
| `npm run e2e`         | Playwright-End-to-End-Tests gegen den Build (vorher `npm run build`) |
| `npm run lint`        | ESLint (null Warnungen erlaubt)                                      |
| `npm run format`      | Prettier schreibt Formatierung                                       |
| `npm run cap:sync`    | Build + Web-Assets und Plugins in die nativen Projekte kopieren      |
| `npm run cap:android` | Sync + Android Studio öffnen                                         |
| `npm run cap:ios`     | Sync + Xcode öffnen                                                  |

## Auf Geräten testen

**Android**

1. `npm run cap:android` – öffnet `android/` in Android Studio.
2. Gerät per USB (Entwickleroptionen, USB-Debugging) oder Emulator wählen, _Run_ drücken.
3. Alternativ lädt die CI bei jedem Push eine Debug-APK hoch (siehe unten).

**Debug-APK aus der CI installieren (z. B. Xiaomi / HyperOS)**

1. Auf GitHub unter _Actions → CI →_ letzter Lauf das Artefakt `kalethra-debug-apk` laden
   (Anmeldung nötig) und entpacken. Darin liegt `kalethra-<version>-debug.apk`.
2. APK aufs Telefon übertragen und öffnen. Beim ersten Mal die Installation aus dieser Quelle
   erlauben (_Einstellungen → Datenschutz/Sicherheit → Unbekannte Apps installieren_).
   HyperOS zeigt ggf. einen zusätzlichen Sicherheitsscan und eine Wartezeit an.
3. Updates: Neuere CI-APKs lassen sich direkt über die installierte Version installieren –
   Daten bleiben erhalten.

Alle Debug-Builds werden mit dem **absichtlich eingecheckten Debug-Schlüssel**
`android/app/debug.keystore` signiert (Android-Standardzugangsdaten `android`). Nur so haben
lokale und CI-APKs dieselbe Signatur. Der Schlüssel ist öffentlich und **nur für Tests**.
Release-Builds für Google Play bekommen einen eigenen, geheimen Schlüssel (als GitHub-Secret,
nie im Repository).

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

Details und Abhängigkeitsregeln: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Mehrsprachigkeit

Deutsch und Englisch. Die Sprache folgt beim ersten Start der Gerätesprache und kann unter
_Profil → Sprache_ geändert werden. Alle Texte liegen in `src/core/i18n/locales/`. Eine neue
Sprache: Datei in `locales/` anlegen und in `src/core/i18n/config.ts` registrieren – TypeScript
und Tests erzwingen Vollständigkeit. Fest codierte Texte in JSX werden von ESLint abgelehnt.

## Beitrag leisten

- Vor jedem Commit `npm run check`.
- Neue Datenbanktabellen nur per Migration und mit Eintrag im Datenkatalog
  (siehe [docs/DATABASE.md](docs/DATABASE.md), [docs/PRIVACY.md](docs/PRIVACY.md)).
- Keine SDKs mit Netzwerkzugriff, Analytics, Werbung oder KI ohne dokumentierte Entscheidung.
- Keine neuen Abhängigkeiten ohne Begründung im Pull Request.

### Branch-Workflow

Der Standard-Branch `claude/fitness-app-phase-1-dqkef9` ist der **stabile, vollständige
Entwicklungsstand**. Er zeigt immer auf den letzten fertig abgeschlossenen Phasen-Commit.

**Start einer Phase**

1. `git fetch origin`, `git status`, `git branch -a`, `git log --oneline --decorate --graph --all -n 30`.
2. Commit und Version des Standard-Branches bestimmen und im Bericht nennen
   („Phase X startet auf `claude/fitness-app-phase-1-dqkef9` bei Commit `abc1234`, Version 0.y.0“).
3. Den Arbeits-/Feature-Branch auf genau diesem Stand beginnen. Ein anderer Branch mit scheinbar
   neuerem Stand gilt nicht als stabil – der Standard-Branch ist die Basis.

**Während der Phase** bleibt der Standard-Branch unverändert; gearbeitet wird nur auf dem
Feature-Branch.

**Abschluss einer Phase** – erst wenn Implementierung, alle Tests, Build und CI grün sind und
Commit sowie Version feststehen:

1. Feature-Branch pushen.
2. Standard-Branch per Fast-Forward nachziehen und pushen:
   `git checkout claude/fitness-app-phase-1-dqkef9 && git merge --ff-only <feature-branch> &&
git push origin claude/fitness-app-phase-1-dqkef9`
3. Prüfen: `git rev-parse claude/fitness-app-phase-1-dqkef9`, `git rev-parse <feature-branch>`,
   `git status` – beide Branches auf demselben Commit, Working Tree sauber.

Nur Fast-Forward: kein Merge-Commit, kein `reset --hard`, kein Force-Push (auch nicht
`--force-with-lease`). Ist ein Fast-Forward nicht möglich, bleibt der Standard-Branch unverändert;
die Ursache wird analysiert und gemeldet. Unfertige, ungetestete oder experimentelle Stände kommen
nie auf den Standard-Branch.
