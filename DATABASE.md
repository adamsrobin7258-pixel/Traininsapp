# Datenbank

Lokale SQLite-Datenbank als **primäre Datenquelle** (offline-first). Eine spätere Cloud-
Synchronisierung ist optional und gleicht diese Daten nur ab – die App funktioniert immer ohne
Netz.

## Aufbau

```
Repository (SQL einer Tabelle)
      │ nutzt
SqlExecutor / DatabaseDriver        src/core/database/types.ts
      │ implementiert von
┌─────────────────────────────┬─────────────────────────────┐
│ capacitorSqlite.ts          │ sqlJs.ts                    │
│ Android/iOS: native SQLite  │ Tests: sql.js im Speicher   │
│ Web (Dev): jeep-sqlite +    │                             │
│ IndexedDB                   │                             │
└─────────────────────────────┴─────────────────────────────┘
```

- Datenbankname: `kalethra` (`DATABASE_NAME` in `src/core/database/index.ts`).
- Ablage iOS: `Library/CapacitorDatabase` (nicht im Dokumente-Ordner sichtbar);
  Android: App-interner Speicher.
- `PRAGMA foreign_keys = ON` wird bei jedem Öffnen gesetzt.
- UI-Komponenten greifen **nie** direkt auf die Datenbank zu. ESLint verbietet den Import der
  SQLite-Pakete außerhalb von `src/core/database/drivers/`.

## Treiber-Schnittstelle

| Methode                 | Zweck                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| `execute(sql)`          | Mehrere Anweisungen ohne Parameter (DDL in Migrationen)              |
| `run(sql, params)`      | Eine schreibende Anweisung mit gebundenen Parametern → `{ changes }` |
| `query<T>(sql, params)` | Lesen, Zeilen als Objekte                                            |
| `transaction(work)`     | Commit bei Erfolg, Rollback bei Fehler; nicht verschachtelbar        |

Immer Parameter binden (`?`), nie Werte in SQL-Strings einsetzen.

Hinweis Web: Nach jedem Schreibvorgang bzw. Commit wird die Datenbank in IndexedDB gesichert
(`saveToStore`). Auf nativen Plattformen entfällt das.

## Migrationen

- Liegen in `src/core/database/migrations/NNN_name.ts` und werden in `migrations/index.ts`
  in aufsteigender Reihenfolge registriert.
- Der Migrator (`migrator.ts`) legt `schema_migrations(version, name, applied_at)` an, führt
  jede ausstehende Migration **in einer eigenen Transaktion** aus und protokolliert sie.
- Schlägt eine Migration fehl, wird sie vollständig zurückgerollt (`MigrationError`); die App
  zeigt den Startfehler-Bildschirm.
- Ist die Datenbank neuer als die App (Downgrade), bricht der Start mit einer klaren Meldung ab,
  statt Daten zu beschädigen.
- Regeln:
  1. Eine veröffentlichte Migration wird **nie** geändert – Korrekturen sind neue Migrationen.
  2. Nur additive Änderungen bevorzugen (neue Tabellen/Spalten). Umbauten per
     „neue Tabelle anlegen → Daten kopieren → alte löschen → umbenennen“.
  3. Jede Migration bekommt einen Test, wenn sie Daten verändert.

## Aktuelles Schema (Version 2)

```sql
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY NOT NULL,   -- z. B. 'theme', 'language'
  value      TEXT NOT NULL,               -- JSON-kodierter Wert
  updated_at TEXT NOT NULL
);

CREATE TABLE profiles (
  id           TEXT PRIMARY KEY NOT NULL, -- UUID, lokal erzeugt
  display_name TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,                      -- Tombstone
  sync_state   TEXT NOT NULL DEFAULT 'local'
               CHECK (sync_state IN ('local', 'pending', 'synced'))
);
```

```sql
-- Migration 2: technische Prüfwerte des Speicher-Selbsttests
CREATE TABLE diagnostics (
  key        TEXT PRIMARY KEY NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`app_settings` ist gerätebezogen und wird nicht synchronisiert (Theme und Sprache können je
Gerät verschieden sein). Werte werden beim Laden validiert; ungültige Werte fallen auf
Standardwerte zurück.

## Konventionen für Nutzerdaten-Tabellen

Gelten für jede Tabelle, deren Inhalte synchronisiert werden sollen:

| Spalte       | Typ  | Bedeutung                                                              |
| ------------ | ---- | ---------------------------------------------------------------------- |
| `id`         | TEXT | UUID (`crypto.randomUUID()`), offline erzeugbar, kollisionsfrei        |
| `profile_id` | TEXT | Eigentümer, `REFERENCES profiles(id)` (ab den ersten Fachtabellen)     |
| `created_at` | TEXT | ISO-8601 in UTC                                                        |
| `updated_at` | TEXT | ISO-8601 in UTC, bei jeder Änderung setzen                             |
| `deleted_at` | TEXT | Soft Delete (Tombstone), damit Löschungen synchronisiert werden        |
| `sync_state` | TEXT | `local` (nie synchronisiert), `pending` (geändert seit Sync), `synced` |

Weitere Regeln:

- Tabellennamen im Plural, `snake_case`; im TypeScript-Code `camelCase` (Mapping im Repository).
- Zeitpunkte als UTC-ISO-Strings. **Kalendertage** (z. B. Tagessummen, Mahlzeiten eines Tages)
  zusätzlich als lokales Datum `YYYY-MM-DD` (`toLocalDateKey`) speichern, damit Zeitzonenwechsel
  Tage nicht verschieben.
- Physikalische Werte in SI-nahen Basiseinheiten speichern (kg, m, s, kcal) und erst in der UI
  umrechnen (metrisch/imperial).
- Lesende Abfragen filtern `deleted_at IS NULL`.
- Geändert wird ein bereits synchronisierter Datensatz → `sync_state = 'pending'`
  (Beispiel: `ProfileRepository.updateDisplayName`).
- Fremdschlüssel und Indizes für häufige Abfragen (z. B. `(profile_id, date)`) direkt in der
  Migration anlegen.

## Geplante Datenmodelle (nicht implementiert)

Skizze zur Orientierung; die Tabellen entstehen mit dem jeweiligen Modul als eigene Migrationen.

| Bereich      | Tabellen (vorläufig)                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| Benutzer     | `profiles` (vorhanden), `goals` (Zielart, Zielwert, Zeitraum)                            |
| Training     | `exercises`, `training_plans`, `plan_sessions`, `workouts`, `workout_sets`               |
| Ernährung    | `foods`, `meals`, `meal_items`                                                           |
| Gesundheit   | `measurements` (Typ, Wert, Einheit, Zeitpunkt, Quelle: manuell/HealthKit/Health Connect) |
| Aktivität    | `daily_activity` (Datum, Schritte, aktive Energie, Quelle)                               |
| Regeneration | `sleep_sessions`                                                                         |

Leitidee: Messwerte generisch über `measurements(type, value, unit, measured_at, source)` statt
einer Tabelle pro Messart – neue Messarten brauchen dann keinen Schemaumbau. Importierte Werte
tragen ihre Quelle und eine externe ID, um Doppelimporte zu vermeiden.

## Synchronisierung (vorbereitet)

Siehe ADR-004 in [ARCHITECTURE.md](ARCHITECTURE.md#adr-004-backend-supabase-eu-region-synchronisierung-über-eigenes-pushpull-protokoll).
Kurzfassung des geplanten Ablaufs:

1. **Push:** alle Zeilen mit `sync_state IN ('local','pending')` des angemeldeten Profils an den
   Server senden (inkl. Tombstones).
2. **Pull:** Serveränderungen mit `updated_at > letzter_sync` holen und lokal einspielen.
3. **Konflikt:** pro Datensatz gewinnt der jüngere `updated_at` (_last write wins_).
4. Erfolgreich übertragene Zeilen → `sync_state = 'synced'`; Zeitpunkt in `app_settings`.

Offene Punkte für die Sync-Phase: Serverzeit statt Gerätezeit für Konfliktauflösung,
Aufräumen alter Tombstones, Verhalten bei Abmeldung (Daten lokal behalten oder löschen).

## Datenschutz

Details: [docs/PRIVACY.md](docs/PRIVACY.md). Kurzfassung für Entwickler:

- Jede neue Tabelle braucht einen Eintrag im Datenkatalog `src/core/privacy/dataCatalog.ts`
  (Kategorie, Sensibilität, Export, Löschung, Sync) – sonst schlägt ein Test fehl.
- Die native Datenbank ist mit SQLCipher verschlüsselt (Schlüssel im Keystore/Keychain, siehe
  [docs/PRIVACY.md](docs/PRIVACY.md)). Tabellen mit `health`- oder `location`-Daten bleiben per
  Test gesperrt, bis die Verschlüsselung auf dem Gerät validiert ist.
- Android-Backup und Geräteübertragung sind für alle App-Daten abgeschaltet.
