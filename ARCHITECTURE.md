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
  navLabelKey: TranslationKey; // 'nav.training'
  icon: IconName;
  Screen: ComponentType;
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
Navigation passen sich automatisch an. Nicht jedes Modul braucht einen Tab – sobald es mehr als
fünf Bereiche gibt, bekommt `AppModule` ein Feld für die Platzierung (Tab, Unterseite).

**Neue Trainingsart hinzufügen:** Die Trainingsarten sind in
`modules/training/domain/disciplines.ts` zentral definiert. In Phase 2 bekommt jede Art eine
Beschreibung ihrer Metriken (z. B. Kraft: Sätze × Wiederholungen × Gewicht; HYROX: Stationen und
Laufabschnitte; Mobility: Dauer). Die gemeinsame Trainingseinheit speichert artspezifische Werte
über diese Beschreibung, sodass neue Arten ohne Schemaumbau hinzukommen.

**Modulübergreifende Daten:** Das Dashboard liest später Kennzahlen anderer Module
(`TodaySummary`). Dafür exportiert jedes Modul eine kleine Abfrage-Schnittstelle über seine
`index.ts`; das Dashboard greift nie direkt auf fremde Tabellen zu. Die App-Shell verdrahtet die
Anbieter – so bleibt die Regel „Module importieren sich nicht gegenseitig“ erhalten.

### `core/` – Infrastruktur

| Ordner      | Inhalt                                                                            |
| ----------- | --------------------------------------------------------------------------------- |
| `database/` | Treiber-Schnittstelle, Treiber (Capacitor, sql.js), Migrationen, Migrator         |
| `i18n/`     | Sprachdateien, Übersetzer, Spracherkennung, `I18nProvider`/`useI18n`              |
| `settings/` | Einstellungen: Typen, Repository, Service (Validierung), Provider, Auflösung      |
| `user/`     | Lokales Profil: Repository, Service, Provider                                     |
| `sync/`     | Sync-Vertrag (`SyncService`) und lokale Standardimplementierung                   |
| `theme/`    | Theme anwenden (DOM + native Systemleisten), Systemmodus beobachten               |
| `platform/` | Grenze zu Plattform-APIs (Plattform, Gerätesprachen, später native Integrationen) |

Muster für Datenzugriff (in Phase 1 für Einstellungen und Profil umgesetzt):

```
Screen ─► Hook/Provider ─► Service (Regeln, Validierung) ─► Repository (SQL) ─► SqlExecutor
```

- **Repository:** einziges Stück Code, das SQL für eine Tabelle kennt; bildet Zeilen auf
  Domänentypen ab (snake_case ↔ camelCase).
- **Service:** Geschäftsregeln (z. B. Namen normalisieren, ungültige Einstellungen verwerfen);
  bekommt Repository und `Clock` injiziert → deterministisch testbar.
- **Provider/Hook:** hält den React-Zustand, ruft Services auf, aktualisiert optimistisch.

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
