# Architektur

Dieses Dokument beschreibt Aufbau, Schnittstellen und die wesentlichen Architekturentscheidungen
(ADRs). Ziel: neue Fachfunktionen hinzufügen, ohne bestehende Module umbauen zu müssen – und
dabei nichts vorwegnehmen, was heute keinen Nutzen hat.

## Überblick

```
┌──────────────────────────────────────────────────────────────┐
│ app/      App-Shell: Start, Provider, Router, Tab-Leiste     │
│           kennt alle Module nur über die Modul-Registry      │
├──────────────────────────────────────────────────────────────┤
│ modules/  dashboard · training · nutrition · health · profile│
│           Screens, modulspezifische Komponenten und Logik    │
├───────────────────────────────┬──────────────────────────────┤
│ core/     Infrastruktur       │ ui/      Designsystem        │
│  database  i18n  settings     │  Tokens, Komponenten, Icons  │
│  user  sync  theme  platform  │                              │
├───────────────────────────────┴──────────────────────────────┤
│ shared/   reine Funktionen (Datum, IDs, Formatierung)        │
└──────────────────────────────────────────────────────────────┘
          │                                   │
  Capacitor-Plugins (SQLite, SystemBars)   Browser-APIs
```

## Abhängigkeitsregeln

Die Regeln werden von ESLint erzwungen (`eslint.config.js`), nicht nur dokumentiert.

| Schicht     | darf importieren                                        | darf nicht importieren             |
| ----------- | ------------------------------------------------------- | ---------------------------------- |
| `app/`      | alles                                                   | –                                  |
| `modules/*` | `core`, `ui`, `shared`, `app/routes`, `app/moduleTypes` | andere Module, restliche App-Shell |
| `core/`     | `shared`, externe Pakete                                | `app`, `modules`, `ui`             |
| `ui/`       | `shared`, React, React Router                           | `app`, `modules`, `core`           |
| `shared/`   | nichts Projektinternes                                  | alles andere                       |

Zusätzlich:

- **Nur** `src/core/database/drivers/` darf SQLite-Pakete importieren. Alle anderen greifen über
  Repositories auf Daten zu.
- **Capacitor** (`@capacitor/*`) nur in Plattform-Adaptern (`src/core/platform/`) und
  Datenbanktreibern.
- **Reine Domain-Logik** – `modules/**/domain`, `shared/`, Services, Repositories, Migrationen,
  `core/privacy`, `core/platform/location`, `core/health/*.ts` – darf weder React noch UI noch
  Capacitor importieren.
- In JSX sind keine festen Texte erlaubt; sichtbarer Text kommt aus `t()`.

## Schichten im Detail

### `app/` – App-Shell

| Datei              | Aufgabe                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `AppRoot.tsx`      | Start: Datenbank öffnen und migrieren, Anfangszustand laden, Fehlerbild     |
| `services.ts`      | Composition Root: verbindet Repositories und Services mit der Datenbank     |
| `AppProviders.tsx` | Einstellungen → wirksames Theme und wirksame Sprache; Kontext-Provider      |
| `modules.ts`       | Registry aller Module in Tab-Reihenfolge                                    |
| `router.tsx`       | Routenbaum aus der Registry (von App und Tests gemeinsam genutzt)           |
| `routes.ts`        | Pfadkonstanten ohne Imports, damit Module sich gegenseitig verlinken können |

Startablauf: `main.tsx` → `AppRoot` → `openAppDatabase()` (Treiber + Migrationen) →
`createServices()` → `loadInitialState()` (Einstellungen, lokales Profil) → Provider → Router.
Schlägt der Start fehl oder hängt er länger als 20 s, erscheint ein Fehlerbildschirm mit
„Erneut versuchen“.

### `modules/` – Fachmodule

Jedes Modul exportiert über `index.ts` genau eine Definition:

```ts
export interface AppModule {
  id: ModuleId; // 'training'
  path: string; // ROUTES.training
  Screen: ComponentType;
  tab?: { labelKey: TranslationKey; icon: IconName }; // nur für Tabs der unteren Leiste
}
```

Interne Struktur eines Moduls (Ordner nur anlegen, wenn benötigt):

```
modules/<name>/
  index.ts        öffentliche Schnittstelle (Moduldefinition, später weitere Exporte)
  screens/        Bildschirme (dünn: Daten holen, Komponenten zusammensetzen)
  components/     modulspezifische UI
  domain/         Geschäftslogik als reine Funktionen/Klassen – ohne React, testbar
  hooks/          React-Anbindung der Logik
  data/           (ab Phase 2) Repositories und Migrationen des Moduls
```

**Neues Modul hinzufügen:** Ordner anlegen, `AppModule` exportieren, in `app/modules.ts`
registrieren, Pfad in `app/routes.ts` und Texte in den Sprachdateien ergänzen. Router und
Navigation passen sich automatisch an. Nur Module mit `tab` erscheinen in der Tab-Leiste
(maximal `MAX_TABS` = 5, per Test geprüft). Weitere Module – z. B. Running, Cycling, HYROX,
Mobility, Calisthenics, Statistics, Settings, Cloud Sync – bekommen nur eine Route und werden aus
einem Bildschirm heraus verlinkt (etwa Running aus Training).

**Prüfung der geplanten Bereiche (Phase 1.1):**

| Bereich                                         | Einordnung                                                                                                     | Anbindung                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Dashboard, Training, Nutrition, Health, Profile | Tab-Module (vorhanden)                                                                                         | `tab` gesetzt                  |
| Activity, Running, Cycling                      | Module ohne Tab; GPS über `LocationTracker`                                                                    | Route, Link aus Training/Heute |
| HYROX, Mobility, Calisthenics                   | Trainingsarten innerhalb von Training (`core/training/trainingTypes.ts`); eigenes Modul erst bei eigener Logik | Unterroute von Training        |
| Statistics                                      | eigenes Modul; liest Kennzahlen nur über Abfrage-Schnittstellen anderer Module                                 | Route, Link aus Heute          |
| Settings                                        | bleibt Teil von Profil; bei Wachstum eigenes Modul ohne Tab                                                    | Route                          |
| Cloud Sync                                      | Infrastruktur in `core/sync` (kein Fachmodul), Bedienung im Profil                                             | `SyncService`                  |

Ergebnis: Kein Umbau nötig außer dem optionalen Tab (umgesetzt). Die Regeln unten verhindern
direkte Abhängigkeiten zwischen Modulen.

**Neue Trainingsart hinzufügen:** siehe [Trainingssystem](#trainingssystem-phase-3).

**Modulübergreifende Daten:** Das Dashboard liest später Kennzahlen anderer Module
(`TodaySummary`). Dafür exportiert jedes Modul eine kleine Abfrage-Schnittstelle über seine
`index.ts`; das Dashboard greift nie direkt auf fremde Tabellen zu. Die App-Shell verdrahtet die
Anbieter – so bleibt die Regel „Module importieren sich nicht gegenseitig“ erhalten.

### `core/` – Infrastruktur

| Ordner      | Inhalt                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database/` | Treiber-Schnittstelle, Treiber (Capacitor, sql.js), Migrationen, Migrator                                                                         |
| `i18n/`     | Sprachdateien, Übersetzer, Spracherkennung, `I18nProvider`/`useI18n`                                                                              |
| `settings/` | Einstellungen: Typen, Repository, Service (Validierung), Provider, Auflösung                                                                      |
| `user/`     | Lokales Profil: Repository, Service, Provider                                                                                                     |
| `sync/`     | Sync-Vertrag (`SyncService`) und lokale Standardimplementierung                                                                                   |
| `theme/`    | Theme anwenden (DOM + native Systemleisten), Systemmodus beobachten                                                                               |
| `platform/` | Grenze zu Plattform-APIs: Plattform, Gerätesprachen, Systemleisten, GPS-Vertrag (`location/`)                                                     |
| `health/`   | Gemeinsame Gesundheits-Domain: Gewicht (Typen, Einheiten, Validierung), Repository, Service, Provider/Hooks, Diagramm-Geometrie                   |
| `training/` | Trainingssystem: Sportarten-Registry, Übungen und Katalog, Sätze/Validierung, Kennzahlen, Pläne, Workouts; Repositories, Services, Provider/Hooks |
| `privacy/`  | Datenkatalog: Sensibilität, Export, Löschung, Sync je Tabelle ([PRIVACY.md](PRIVACY.md))                                                          |

Muster für Datenzugriff (in Phase 1 für Einstellungen und Profil umgesetzt):

```
Screen ─► Hook/Provider ─► Service (Regeln, Validierung) ─► Repository (SQL) ─► SqlExecutor
```

- **Repository:** einziges Stück Code, das SQL für eine Tabelle kennt; bildet Zeilen auf
  Domänentypen ab (snake_case ↔ camelCase).
- **Service:** Geschäftsregeln (z. B. Namen normalisieren, ungültige Einstellungen verwerfen);
  bekommt Repository und `Clock` injiziert → deterministisch testbar.
- **Provider/Hook:** hält den React-Zustand, ruft Services auf, aktualisiert optimistisch.

### Datenfluss der ersten Gesundheitsfunktion (Körpergewicht)

```
modules/health  (Gesundheit: Übersicht, Diagramm, Verlauf, Eingabe-Sheet)
modules/dashboard (Heute: Tagesauswahl, Gewicht des Tages)
        │  useWeightForDate / useWeightData / useWeightService   (core/health/WeightProvider)
        ▼
WeightService      Regeln: kein Zukunftsdatum, 20–400 kg, ein Wert pro Tag (ersetzen statt duplizieren)
        ▼
WeightRepository   SQL für weight_entries, immer auf profile_id eingeschränkt
        ▼
SqlExecutor → CapacitorSqliteDriver → SQLCipher (verschlüsselt, Android/iOS)
```

- Eingaben werden in der Domain geparst (`parseWeightInput`: Komma/Punkt, eine Nachkommastelle,
  Bereich) und im Service erneut geprüft; die Datenbank hat zusätzlich `CHECK`-Regeln.
- Nach jeder Änderung erhöht der `WeightProvider` eine Revision; alle Ansichten, die Daten über
  die Hooks laden, fragen gezielt neu ab (kein globales Neuladen, kein Laden bei unbeteiligten
  Renders).
- **Warum `core/health` und nicht `modules/health`?** Gewicht wird von „Heute“, „Gesundheit“
  und später von Statistiken genutzt. Module dürfen sich nicht importieren; gemeinsame Domain
  gehört daher in `core`, die Oberflächen bleiben in den Modulen (ADR-013).
- Modulübergreifende Links (Tagesauswahl, „Gewicht für Tag X eintragen“) laufen über
  `ROUTE_PARAMS`/`addWeightLink` in `app/routes.ts`: `/?day=YYYY-MM-DD`, `/health?add=YYYY-MM-DD`.
  Ungültige oder zukünftige Tage in der URL werden ignoriert.

### Trainingssystem (Phase 3)

```
modules/training   Training-Start, Pläne, Verlauf, laufendes Workout, Detail, Übungen
modules/dashboard  „Nächstes Training“ / laufendes Training, Trainingsminuten des Tages
        │  useTraining / useTrainingData                       (core/training/TrainingProvider)
        ▼
ExerciseService · PlanService · WorkoutService    Regeln, Validierung, Eigentümerprüfung
        ▼
TrainingStore (repos + atomic() = Transaktion)
        ▼
ExerciseRepository · PlanRepository · WorkoutRepository   SQL, immer auf profile_id eingeschränkt
```

**Sportarten-Modell.** `trainingTypes.ts` ist die Registry aller Trainingsarten. Jede Art hat eine
Kategorie (Kraft, Ausdauer, Hybrid, Beweglichkeit), einen **Workflow** und die Kennzahlen, die sie
liefern kann:

| Workflow    | Erfassung                                      | Arten                                                                 | Status                                   |
| ----------- | ---------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `sets`      | Übungen mit Sätzen (Gewicht, Wdh., Dauer, RPE) | Krafttraining, Hypertrophie, Powerlifting, Gewichtheben, Calisthenics | umgesetzt (Krafttraining als Oberfläche) |
| `endurance` | Dauer, Distanz, Pace, optional GPS-Track       | Laufen, Gehen, Radfahren                                              | nur Architektur                          |
| `segments`  | Stationen/Abschnitte mit Zwischenzeiten        | HYROX                                                                 | nur Architektur                          |
| `timed`     | Zeitbasierte Übungen                           | Mobility, Stretching                                                  | nur Architektur                          |

`available: false` verhindert den Start noch nicht umgesetzter Arten im Service (nicht nur in der
UI). In der Datenbank steht die Art als Text; unbekannte Werte fallen auf `other` zurück.
**Neue Trainingsart:** Eintrag in `TRAINING_TYPES`, Übersetzung in `training.types`, bei neuem
Workflow eine eigene Erfassungsoberfläche im Trainingsmodul – kein Schemaumbau.

**Navigation.** Training (Start, Verlauf) → „Training starten“ bietet nur „Freies Training“ und
„Aus Plan starten“ (Trainingstag wählen). Pläne werden ausschließlich unter „Pläne“
(`/training/plans`) angelegt und bearbeitet; ohne Plan verweist der Start-Dialog dorthin.

**Heute.** Reine Übersicht ohne Eingaben: Training (`WorkoutService.overview`, nächster Plan-Tag),
Gesundheit (Gewicht mit kleinem Verlauf, aus `core/health`) und Ernährung (noch keine Daten, daher
ehrlicher Leerzustand). „Heute“ speichert nichts und berechnet nichts Eigenes über die Darstellung
hinaus; jede Karte öffnet ihren Bereich.

**Plan vs. Workout.** Ein Plan (`PlanService`) beschreibt, was trainiert werden soll: Tage,
Übungen, optionale Vorgaben (Sätze × Wdh.). Ein Workout (`WorkoutService`) ist das Protokoll einer
tatsächlichen Einheit. Beim Start aus einem Plan werden Übungen kopiert und Sätze vorbelegt
(Anzahl aus Vorgabe oder letzter Einheit, Werte aus „Letztes Mal“ bzw. Ziel-Wdh.). Danach sind
Plan und Workout unabhängig. „Nächstes Training“ ist der Tag nach dem zuletzt trainierten Tag des
zuletzt genutzten Plans (zyklisch).

**Satzmodell.** Ein Satz hat für alle Übungstypen dieselben optionalen Felder (Gewicht in kg,
Wdh., Dauer in s, Distanz in m, RPE). Welche Felder angezeigt und beim Abschließen verlangt
werden, bestimmt der Übungstyp (`weighted`, `bodyweight`, `timed`, `distance`) in `sets.ts`.
Eingaben werden in der Domain geparst (Last in der Profileinheit → kg über `shared/lib/units.ts`,
dieselbe Logik wie beim Körpergewicht), im Service validiert und in der Datenbank per `CHECK`
begrenzt.

**Historie.** Workouts speichern Namens-Snapshots von Plan, Tag und Übungen; Übungen werden nur
deaktiviert. Änderungen an Plänen und Übungen verändern damit nie vergangene Trainings (Details
und Tests: [DATABASE.md](DATABASE.md#training-migration-4)).

**Laufendes Workout.** Jede Eingabe wird beim Verlassen des Feldes bzw. beim Abhaken gespeichert;
das aktive Workout liegt in der Datenbank (höchstens eines pro Profil) und wird nach Neustart
wieder geöffnet. Gleichzeitige Speichervorgänge serialisiert die Datenbankschicht.

**Kennzahlen.** `metrics.ts` berechnet Volumen, geschätztes 1RM (Epley) und besten Satz aus
abgeschlossenen Sätzen – zentral, rein funktional, getestet. Rekorde (PRs) und Statistiken bauen
darauf auf. Ausdauer-Kennzahlen (Pace, Geschwindigkeit, Höhenmeter, Splits) sind in der Registry
deklariert und werden mit ihrem Workflow implementiert.

**GPS.** Nicht umgesetzt. Arten mit `supportsRoute` erhalten später einen Track (1:1 zum
Workout, Trackpunkte in eigener Tabelle) über den `LocationTracker`
([GPS_ARCHITECTURE.md](GPS_ARCHITECTURE.md)).

### Zentrale Schnittstellen

```ts
// core/database/types.ts
interface SqlExecutor {
  execute(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<RunResult>;
  query<T extends object>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
}
interface DatabaseDriver extends SqlExecutor {
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// core/sync/types.ts
interface SyncService {
  getStatus(): SyncStatus; // disabled | idle | syncing | error
  syncNow(): Promise<void>;
}

// core/i18n
type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;
```

`TranslationKey` ist ein aus der deutschen Sprachdatei abgeleiteter Union-Typ aller Pfade
(`'nav.training' | …`). Tippfehler in Schlüsseln sind damit Compilerfehler.

### `ui/` – Designsystem

Tokens (`tokens.css`), Basis-Styles, Icons und gemeinsame Komponenten. Kennt keine Fachlogik und
keinen App-Zustand. Beschreibung: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

**System-Zurück (Android).** `core/platform/backButton.ts` kapselt `@capacitor/app` (einzige
Stelle mit Capacitor). `app/layout/SystemBackHandler` entscheidet zentral:

1. Ist ein Sheet offen, wird es geschlossen (`ui/backStack.ts`: Sheets melden sich beim Öffnen an).
2. Sonst eine Ebene höher: `backTarget()` in `app/backNavigation.ts` leitet die Elternseite aus der
   Modul-Registry ab (`/training/plans/:id` → `/training/plans` → `/training` → `/`).
3. Auf „Heute“ wird die App beendet.

Es gibt keine zweite Navigation und keine Bestätigungsdialoge; ein laufendes Training bleibt beim
Verlassen unverändert gespeichert. Browser und iOS sind nicht betroffen (kein System-Zurück-Ereignis).

**Tastatur und Fokus (`ui/focus.ts`, `Sheet`).** Die Bildschirmtastatur folgt dem Fokus. Regeln:

- Nur echte Texteingaben dürfen den Fokus bekommen. Buttons, Haken und Auswahlzeilen fokussieren
  nie ein Textfeld und halten es nicht fest (kein `preventDefault` auf `mousedown`/`pointerdown`,
  um ein Feld fokussiert zu lassen – auf Android öffnet das die Tastatur erneut).
- Sheets öffnen ohne Tastatur: Der Fokus geht auf das Sheet selbst. Nur ein Feld, für das der
  Dialog existiert (z. B. „Name des Plans“), wird mit `AUTOFOCUS` markiert. Beim Schließen wird
  der Fokus nie an ein Textfeld zurückgegeben.
- Sheets richten ihre Höhe am sichtbaren Bereich (`window.visualViewport`) aus, nicht an
  `100dvh` – bei Android mit Edge-to-Edge und bei iOS liegt die Tastatur über der Seite. Lange
  Listen (Übungsauswahl) nutzen `fill`: Kopf und Suche bleiben stehen, nur die Liste scrollt.
- `dismissKeyboard()` schließt die Tastatur vor Aktionen, die gespeicherte Werte brauchen; das
  Feld speichert dabei per Blur. Trainingsänderungen laufen über `mutate` strikt nacheinander,
  daher ist der Blur-Speichervorgang vor der Aktion des Buttons abgeschlossen.

## Zustandsverwaltung

React Context + Services, keine Store-Bibliothek. Globaler Zustand ist heute klein
(Einstellungen, Profil). Modulzustand bleibt im Modul. Sobald Module umfangreiche,
datenbankgestützte Listen brauchen (Phase 2+), wird eine kleine Abfrageschicht mit
Invalidierung ergänzt (Entscheidung dann: eigene Lösung vs. TanStack Query).

## Plattformintegration

Native Funktionen werden als **Adapter** in `core/platform/` angebunden: eine TypeScript-
Schnittstelle, eine native Implementierung (Capacitor-Plugin) und eine Web-/Test-Implementierung.
Fachmodule kennen nur die Schnittstelle. Nichts davon ist in Phase 1 implementiert; die
folgenden Voraussetzungen und Einschränkungen sind geprüft:

| Integration                  | Umsetzungsweg (geplant)                                                                  | Voraussetzungen / Einschränkungen                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Apple HealthKit**          | Community-Plugin (z. B. `@capgo/capacitor-health`) oder eigenes Swift-Plugin             | HealthKit-Capability in Xcode, `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription` in `Info.plist`, kostenpflichtiges Apple-Developer-Konto, Test nur eingeschränkt im Simulator. Apple verlangt eine Datenschutzerklärung; HealthKit-Daten dürfen nicht für Werbung genutzt werden. Lesezugriff: App erfährt nicht, ob der Nutzer das Lesen verweigert hat. |
| **Android Health Connect**   | Community-Plugin oder eigenes Kotlin-Plugin (`androidx.health.connect`)                  | minSdk 26 (bereits gesetzt). Ab Android 14 Teil des Systems, darunter eigene App aus dem Play Store. Jede Datenart als Berechtigung im Manifest, Aktivität für die Berechtigungsbegründung Pflicht, Health-Formular in der Play Console. Hintergrund-/Verlaufsdaten brauchen zusätzliche Berechtigungen.                                                                  |
| **Kamera / Barcode-Scanner** | `@capacitor-mlkit/barcode-scanning` (ML Kit, offline) bzw. `@capacitor/camera` für Fotos | iOS: `NSCameraUsageDescription`. Android: Kamera-Berechtigung zur Laufzeit. Im Browser nur eingeschränkt; Test auf Gerät nötig.                                                                                                                                                                                                                                           |
| **Benachrichtigungen**       | `@capacitor/local-notifications`; Push später über FCM/APNs                              | Android 13+: Laufzeitberechtigung `POST_NOTIFICATIONS`; exakte Wecker eingeschränkt (Android 12+). iOS: Berechtigungsdialog, Push braucht APNs-Schlüssel.                                                                                                                                                                                                                 |
| **Dateizugriff**             | `@capacitor/filesystem` + Share-Sheet für Export/Backup (CSV/JSON)                       | Scoped Storage auf Android: Export über Share-Sheet/Dokumentauswahl statt freier Pfade.                                                                                                                                                                                                                                                                                   |
| **Systemleisten**            | `SystemBars` aus `@capacitor/core` (**bereits umgesetzt**)                               | Android: Edge-to-Edge, Safe-Area-Variablen werden injiziert (`insetsHandling: 'css'`).                                                                                                                                                                                                                                                                                    |

GPS/Standort: Vertrag `LocationTracker` in `src/core/platform/location/types.ts` (ohne
Implementierung), Konzept in [GPS_ARCHITECTURE.md](GPS_ARCHITECTURE.md).

Bekanntes Risiko von Capacitor (siehe ADR-001): Dauerhafte Hintergrundarbeit (z. B. GPS-Tracking
eines Laufs bei gesperrtem Bildschirm) braucht native Plugins mit Foreground-Service (Android)
bzw. Background Modes (iOS). Das ist machbar, aber aufwendiger als in einer rein nativen App.

## Cloud, Konto und Monetarisierung (vorbereitet, nicht umgesetzt)

- Die App funktioniert vollständig ohne Konto. Beim ersten Start entsteht ein **lokales Profil**
  mit UUID; alle künftigen Datensätze gehören diesem Profil.
- Registriert sich ein Nutzer später, wird das lokale Profil mit dem Cloud-Konto verknüpft und
  vorhandene Daten werden hochgeladen – kein Datenverlust, keine Migration nötig.
- Sync-Vertrag: `SyncService` in `core/sync`. Aktuell `LocalOnlySyncService` (Status
  „deaktiviert“, im Profil sichtbar).
- Datenbank-Konventionen für Sync (UUIDs, Zeitstempel, Tombstones, `sync_state`) sind ab der
  ersten Tabelle umgesetzt – siehe [DATABASE.md](DATABASE.md).

## ADR-Übersicht

Format: Kontext → Entscheidung → Konsequenzen. Status aller ADRs: _angenommen_ (Phase 1).

### ADR-001: React + Vite + Capacitor als App-Plattform

- **Kontext:** Eine Codebasis für Android und iOS, kleines Team, Web-Know-how vorhanden.
  Alternativen: React Native (Expo), Flutter, zwei native Apps.
- **Entscheidung:** React + TypeScript + Vite in Capacitor 8.
- **Begründung:** Formulare, Listen, Statistiken und Einstellungen – der Kern der App – sind im
  WebView sehr gut umsetzbar. Schnelle Iteration im Browser, ein Build für beide Plattformen,
  Zugriff auf native APIs über Plugins und eigene Swift/Kotlin-Plugins.
- **Konsequenzen / Risiken:** Hintergrund-Tracking und sehr aufwendige Animationen sind
  schwieriger als in React Native/Flutter. Gegenmaßnahme: gezielte native Plugins, dezentes
  Motion-Design, Performance-Budget für Listen (Virtualisierung ab Phase 2 bei Bedarf).
  Wenn Live-Workout-Tracking mit GPS zur Kernfunktion wird, ist das vorher per Prototyp auf
  echten Geräten zu validieren.

### ADR-002: SQLite über `@capacitor-community/sqlite` hinter einer Treiberschnittstelle

- **Entscheidung:** Native SQLite auf Android/iOS; im Browser `jeep-sqlite` (sql.js/WASM,
  IndexedDB) nur für die Entwicklung; in Tests sql.js im Speicher. Alles darüber kennt nur
  `DatabaseDriver`.
- **Begründung:** Relationale Daten (Pläne → Einheiten → Sätze, Mahlzeiten → Lebensmittel),
  Offline-Fähigkeit, Migrationen in SQL, echte SQL-Tests ohne Gerät.
- **Konsequenzen:** `jeep-sqlite` bündelt den JS-Teil von sql.js **1.11.0**; die WASM-Datei muss
  exakt dazu passen, daher ist `sql.js` fest auf 1.11.0 gepinnt (geprüft in
  `scripts/copy-sqlite-wasm.mjs`). Verschlüsselung (SQLCipher) unterstützt das Plugin nativ; die
  Entscheidung dazu fällt, bevor Gesundheitsdaten gespeichert werden (Phase 2).

### ADR-003: Eigene, typisierte i18n statt i18next

- **Entscheidung:** ~60 Zeilen eigener Code: verschachtelte Wörterbücher, typsichere Schlüssel,
  `{platzhalter}`-Interpolation, Fallback auf Englisch, `Intl` für Zahlen und Datum.
- **Begründung:** Keine Abhängigkeit, volle Typsicherheit, Tests auf Vollständigkeit.
- **Konsequenzen:** Pluralformen sind noch nicht umgesetzt; bei Bedarf über `Intl.PluralRules`
  ergänzen (Schlüssel mit `one`/`other`). Bei sehr vielen Sprachen oder externer
  Übersetzungsplattform ggf. Wechsel prüfen – die `t()`-Signatur bleibt kompatibel.

### ADR-004: Backend Supabase (EU-Region), Synchronisierung über eigenes Push/Pull-Protokoll

- **Kontext:** Optionales Konto, Mehrgeräte-Sync, Gesundheitsdaten (besondere Kategorie nach
  Art. 9 DSGVO), kleine Betriebskosten, spätere Abos.
- **Bewertete Optionen:**

  | Option                 | Pro                                                                                                                                                                                        | Contra                                                                                                           |
  | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
  | **Supabase**           | Postgres (relational wie SQLite lokal), Auth inkl. Apple/Google, Row Level Security, EU-Region (Frankfurt), Open Source/selbst hostbar, AVV verfügbar, Free- und Pro-Tarif (~25 USD/Monat) | Sync-Logik selbst bauen                                                                                          |
  | Firebase               | Ausgereift, Offline-Cache, Auth                                                                                                                                                            | NoSQL passt schlecht zu relationalen Daten, starker Lock-in, Offline-Cache ersetzt nicht unsere SQLite-Datenbank |
  | PowerSync (+ Supabase) | Fertige SQLite↔Postgres-Synchronisierung, Capacitor-SDK                                                                                                                                    | Zusätzlicher kostenpflichtiger Dienst, würde den SQLite-Treiber ersetzen                                         |
  | Eigenes Backend        | Volle Kontrolle                                                                                                                                                                            | Hoher Betriebs- und Sicherheitsaufwand                                                                           |

- **Entscheidung:** Supabase in der EU-Region als Auth- und Datenbank-Backend. Synchronisierung
  zunächst über ein eigenes, einfaches Protokoll: Änderungen seit dem letzten Sync pushen
  (`sync_state = 'pending'`), Serveränderungen seit Zeitstempel ziehen, Konflikte je Datensatz
  per _last write wins_ auf `updated_at`, Löschungen als Tombstones (`deleted_at`).
- **Wiedervorlage:** Wenn Konflikte auf Feldebene nötig werden oder der Eigenbau zu aufwendig
  wird, auf PowerSync wechseln. Die lokale Schemakonvention ist mit beiden Wegen kompatibel.
- **Datenschutz:** Sync nur mit Konto und ausdrücklicher Einwilligung; Datenminimierung;
  Row Level Security pro Nutzer; Export- und Löschfunktion (Art. 15/17 DSGVO) vor Veröffentlichung.

### ADR-005: Abonnements über die Stores mit RevenueCat (spätere Phase)

- **Entscheidung (vorläufig):** Digitale Abos müssen über Apple/Google In-App-Käufe laufen.
  RevenueCat als Abstraktion (Capacitor-Plugin, Belegprüfung, Webhooks an Supabase). Freischaltungen
  werden in der App über eine `EntitlementService`-Schnittstelle abgefragt; Module fragen nur
  „ist Funktion X freigeschaltet?“.
- **Konsequenz:** Keine Implementierung in Phase 1; kein Code, der heute ungenutzt wäre.

### ADR-006: Styling mit CSS Modules und CSS-Variablen

- **Entscheidung:** Design-Tokens als CSS-Variablen, Komponenten mit CSS Modules. Kein Tailwind,
  keine Komponentenbibliothek.
- **Begründung:** Hell/Dunkel über Variablen ohne Laufzeitkosten, eigenständiges Erscheinungsbild,
  keine Abhängigkeit.

### ADR-007: React Router für die Navigation

- **Entscheidung:** React Router 8 (Data Router). Tabs sind Routen; Unterseiten (z. B.
  Trainingsplan-Detail) werden verschachtelte Routen.
- **Begründung:** Deep Links (Benachrichtigungen, später Widgets) und Zurück-Navigation (Android-
  Zurücktaste) brauchen echtes Routing; eigenes Routing wäre fehleranfällig.

### ADR-008: TypeScript 6.0 statt 7.0

- **Kontext:** TypeScript 7 (nativer Compiler) ist verfügbar, `typescript-eslint` unterstützt
  aktuell jedoch nur `< 6.1`.
- **Entscheidung:** TypeScript 6.0.x; Wechsel auf 7, sobald typescript-eslint ihn unterstützt.

### ADR-009: Lokales Profil vor Konto

- **Entscheidung:** Eine Tabelle `profiles` mit lokaler UUID ab Tag eins, auch ohne Konto.
- **Begründung:** Alle künftigen Daten haben einen Eigentümer; die spätere Kontoverknüpfung
  ändert nur das Profil, nicht die Fachdaten.

### ADR-010: Produktidentität Kalethra, App-ID `com.kalethra.app`

- **Entscheidung:** Produktname Kalethra, Android Package ID und iOS Bundle ID
  `com.kalethra.app`. Die Version kommt nur aus `package.json`; Android leitet `versionCode`
  daraus ab (MAJOR·10000 + MINOR·100 + PATCH), iOS-Werte werden per Test abgeglichen
  (`tests/nativeConfig.test.ts`).
- **Konsequenz:** Wechsel der App-ID vor jeder Veröffentlichung, deshalb ohne
  Datenmigration. Der Datenbankname wurde zu `kalethra` geändert.

### ADR-011: Kein automatisches Android-Backup, Verschlüsselung vor Gesundheitsdaten

- **Entscheidung:** Auto-Backup und Geräteübertragung für alle App-Daten aus. Datenbank-
  verschlüsselung mit SQLCipher (bereits im Plugin enthalten) wird vor der ersten
  Gesundheitstabelle eingeführt und bis dahin per Test erzwungen. Details:
  [PRIVACY.md](PRIVACY.md).

### ADR-012: Gemeinsamer Debug-Signaturschlüssel

- **Entscheidung:** `android/app/debug.keystore` liegt im Repository. So haben alle Debug-APKs
  dieselbe Signatur und lassen sich auf Testgeräten als Update installieren.
- **Konsequenz:** Der Schlüssel ist öffentlich und nur für Tests geeignet. Release-Signierung
  erfolgt später mit einem geheimen Schlüssel aus GitHub-Secrets.

### ADR-013: Gemeinsame Gesundheits-Domain in `core/health`

- **Kontext:** Gewichtsdaten werden in „Heute“ und „Gesundheit“ gebraucht, später in Statistiken.
- **Entscheidung:** Domain, Repository, Service und React-Anbindung liegen in `core/health`; die
  Module enthalten nur Oberflächen. Weitere Messarten (Körperfett, Ruhepuls …) kommen ebenfalls
  hierher – je Messart eine typisierte Tabelle, solange sich die Regeln unterscheiden;
  gleichartige Messwerte können später in einer generischen `measurements`-Tabelle
  zusammengeführt werden.
- **Konsequenz:** Keine direkte Abhängigkeit zwischen Modulen; Diagramm-Geometrie und Validierung
  sind ohne React testbar.

### ADR-014: Sportartunabhängiges Trainingsmodell mit historischen Snapshots

- **Kontext:** Kraft ist die erste Sportart; Laufen, Radfahren, HYROX, Mobility u. a. folgen.
  Pläne und Übungen ändern sich, vergangene Trainings dürfen das nicht.
- **Entscheidung:** Eine gemeinsame Struktur Workout → Übung → Satz mit typisierten, optionalen
  Satzfeldern statt Tabellen je Sportart oder JSON-Spalten; Trainingsart als Text mit Registry im
  Code. Workouts kopieren Namen und Typen (Snapshots), Plan-Bezüge werden beim Löschen auf `NULL`
  gesetzt, Übungen nur deaktiviert.
- **Konsequenz:** Neue Sportarten brauchen nur Tabellen für wirklich neue Daten (GPS-Track,
  Splits). Umbenennungen wirken nicht rückwirkend – gewollt, weil der Verlauf dokumentiert, was
  damals trainiert wurde.
