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

Alle Aufrufe einer Verbindung laufen **nacheinander** (`serialize.ts`, für beide Treiber). Eine
Verbindung hat nur einen Transaktionsbereich: Ohne Warteschlange würde eine Anweisung, die
während einer offenen Transaktion eintrifft (z. B. Speichern beim Verlassen eines Eingabefelds,
während ein Button-Klick eine Transaktion startet), Teil dieser Transaktion und ggf. mit ihr
zurückgerollt; ein zweites `BEGIN` schlägt fehl. Innerhalb von `work` ausschließlich den
übergebenen `tx` verwenden – ein Aufruf des Treibers selbst würde auf das Ende der eigenen
Transaktion warten.

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

## Aktuelles Schema (Version 10)

Basistabellen (Migrationen 1–2); Gewicht und Training folgen in eigenen Abschnitten.

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
Gerät verschieden sein). Schlüssel: `theme`, `language`, `weightUnit`, `waterQuickAmountsMl`
(Wasser-Schnellmengen in ml, ab Phase 4.2.1; keine Schemaänderung). Werte werden beim Laden validiert; ungültige Werte fallen auf
Standardwerte zurück.

## `weight_entries` (Migration 3)

Erste Gesundheitstabelle: Körpergewicht, **ein primärer Wert pro Profil und Kalendertag**.

```sql
CREATE TABLE weight_entries (
  id          TEXT PRIMARY KEY NOT NULL,                 -- UUID
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,                             -- lokaler Kalendertag YYYY-MM-DD
  value       REAL NOT NULL CHECK (value >= 20 AND value <= 400),
  unit        TEXT NOT NULL DEFAULT 'kg' CHECK (unit = 'kg'),
  created_at  TEXT NOT NULL,                             -- ISO-8601 UTC
  updated_at  TEXT NOT NULL,
  sync_state  TEXT NOT NULL DEFAULT 'local'
);
CREATE UNIQUE INDEX weight_entries_profile_date ON weight_entries (profile_id, date);
```

| Thema            | Entscheidung                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beziehung        | n:1 zu `profiles`; Löschen des Profils löscht die Einträge (`ON DELETE CASCADE`).                                                                                                                                                                                                                                                                                |
| Einheit          | Intern immer **Kilogramm** (`unit` ist fest `kg`, dokumentiert die Basiseinheit). Anzeige/Eingabe in kg oder lb laut Einstellung `weightUnit`. Umrechnung genau einmal beim Speichern (1 lb = 0,45359237 kg, exakt), keine Rundung in der Datenbank; Anzeige rundet auf eine Nachkommastelle. Ein unverändert gespeicherter lb-Wert bleibt dadurch exakt gleich. |
| Wertebereich     | 20–400 kg (≈ 44,1–881,8 lb), höchstens eine Nachkommastelle in der Eingabeeinheit. Deckt Kinder ab ca. 6 Jahren bis sehr schwere Erwachsene ab und fängt Tippfehler wie „8240“ ab. Geprüft in Domain (`parseWeightInput`), Service (`WeightService`) **und** Datenbank (`CHECK`).                                                                                |
| Ein Wert pro Tag | Eindeutiger Index `(profile_id, date)`. Erneutes Eintragen für denselben Tag ersetzt den Wert (`INSERT … ON CONFLICT DO UPDATE`), `id` und `created_at` bleiben erhalten.                                                                                                                                                                                        |
| Datum            | Lokaler Kalendertag statt Zeitstempel, damit Zeitzonenwechsel keine Tage verschieben. Zukünftige Tage lehnt der Service ab.                                                                                                                                                                                                                                      |
| Index            | `weight_entries_profile_date` bedient alle Abfragen: Tageswert, Verlauf (`ORDER BY date DESC LIMIT/OFFSET`), Zeitraum fürs Diagramm, Zählung. Per Test über `EXPLAIN QUERY PLAN` abgesichert.                                                                                                                                                                    |
| Löschen          | **Physisch** (kein Tombstone), weil es noch keine Cloud-Kopie gibt. Mit Einführung der Synchronisierung folgt eine Migration auf Tombstones (`deleted_at`).                                                                                                                                                                                                      |
| Datenschutz      | Datenkatalog: Kategorie `health`, Sensibilität `health`, exportierbar, wird mit dem Profil gelöscht, später synchronisierbar. Nur in der verschlüsselten Datenbank zulässig (per Test erzwungen).                                                                                                                                                                |

Zugriff ausschließlich über `WeightRepository` → `WeightService` (`src/core/health/`).

## Training (Migration 4)

Sportartunabhängiges Trainingssystem. Grundprinzip: **Plan = was trainiert werden soll,
Workout = was tatsächlich trainiert wurde.** Workouts sind historische Momentaufnahmen und
dürfen sich nicht verändern, wenn Pläne oder Übungen später bearbeitet oder gelöscht werden.

```
exercises ──< exercise_muscles
    │
    ├──< planned_exercises >── training_plan_days >── training_plans
    │                                                     ▲ (SET NULL)
    └──< workout_exercises (SET NULL) >── workouts ───────┘
                 │
                 └──< workout_sets
```

| Tabelle              | Inhalt                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `exercises`          | System-Katalog (`source='system'`, `profile_id` NULL, stabile IDs wie `sys.bench-press`) und eigene Übungen (`source='user'`) |
| `exercise_muscles`   | Primäre/sekundäre Muskelgruppen je Übung                                                                                      |
| `exercise_favorites` | Favorisierte Übungen je Profil (Migration 9)                                                                                  |
| `training_plans`     | Plan mit Name und Trainingsart                                                                                                |
| `training_plan_days` | Trainingstage eines Plans, sortiert über `position`                                                                           |
| `planned_exercises`  | Übung eines Tages mit optionalen Vorgaben (`target_sets` 1–20, `target_reps` 1–100)                                           |
| `workouts`           | Eine Einheit: Trainingsart, Status, Start/Ende, Dauer, Kalendertag, Titel, Notizen, Plan-Bezug plus Namens-Snapshots          |
| `workout_exercises`  | Übung im Workout, sortiert, mit **Snapshot** von `name_de`, `name_en`, `exercise_type`                                        |
| `workout_sets`       | Satz: `weight_kg`, `reps`, `duration_s`, `distance_m`, `rpe` (alle optional), `completed`, `position`                         |

### Satztypen (Migration 5)

Rein additive Spalten; bestehende Zeilen bleiben unverändert und gelten als Arbeitssätze.

```sql
ALTER TABLE workout_sets ADD COLUMN set_type TEXT NOT NULL DEFAULT 'working'
  CHECK (set_type IN ('warmup', 'working', 'drop'));
ALTER TABLE workout_sets ADD COLUMN drop_of TEXT
  REFERENCES workout_sets(id) ON DELETE CASCADE
  CHECK ((set_type = 'drop') = (drop_of IS NOT NULL));
CREATE INDEX workout_sets_drop_of ON workout_sets (drop_of);
ALTER TABLE planned_exercises ADD COLUMN warmup_sets INTEGER CHECK (warmup_sets BETWEEN 1 AND 10);
ALTER TABLE planned_exercises ADD COLUMN drop_sets INTEGER CHECK (drop_sets BETWEEN 1 AND 5);
```

| Thema          | Entscheidung                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Aufwärmsatz    | `set_type = 'warmup'`, vollständig gespeichert, steht vor den Arbeitssätzen. Zählt weder als Satz noch zum Volumen, Rekorde und „Letztes Mal“ ignorieren ihn.                  |
| Dropsatz       | `set_type = 'drop'` mit `drop_of` = Arbeitssatz. Die Kette ist über `position` geordnet und folgt direkt ihrem Arbeitssatz. Löschen des Arbeitssatzes löscht seine Drops.      |
| Auswertung     | Volumen = Arbeitssätze + Drops; Satzanzahl, schwerster Satz und e1RM nur Arbeitssätze (`metrics.ts`, `groupSets` in `sets.ts`).                                                |
| Plan           | `warmup_sets` (Aufwärmsätze) und `drop_sets` (Drops nach dem letzten Arbeitssatz); `NULL` = keine. Beim Start aus dem Plan werden sie mit Werten der letzten Einheit angelegt. |
| Datenbankregel | Ein Drop ohne Arbeitssatz oder ein Arbeitssatz mit `drop_of` wird per `CHECK` abgelehnt.                                                                                       |
| RPE            | Spalte `rpe` bleibt unverändert bestehen; die App erfasst und zeigt RPE nicht mehr, vorhandene Werte bleiben beim Speichern erhalten.                                          |

### Integrität der Historie

| Änderung                       | Wirkung auf bestehende Workouts                                                                                                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan oder Trainingstag löschen | `workouts.plan_id`/`plan_day_id` → `NULL` (`ON DELETE SET NULL`); `plan_name`/`plan_day_name` bleiben als Snapshot sichtbar.                                                                                                                       |
| Plan umbenennen                | Keine – alte Workouts zeigen den Namen zum Trainingszeitpunkt.                                                                                                                                                                                     |
| Übung umbenennen / Typ ändern  | Keine – `workout_exercises` tragen Name und Typ als Snapshot.                                                                                                                                                                                      |
| Übung „löschen“                | Übungen werden **nie gelöscht, nur deaktiviert** (`active = 0`). Sie verschwinden aus der Auswahl, Verlauf und „Letztes Mal“ bleiben erhalten. `planned_exercises` verweisen weiter darauf (ohne `ON DELETE`, eine Löschung würde also scheitern). |
| System-Katalog-Update          | `EXERCISE_CATALOG_VERSION` in `exerciseCatalog.ts`; beim Start per Upsert abgeglichen (Version in `app_settings` unter `system.exerciseCatalogVersion`). Entfernte Systemübungen werden deaktiviert, nicht gelöscht.                               |
| Workout löschen                | Einzige Aktion, die Übungen und Sätze eines Workouts entfernt (`ON DELETE CASCADE`).                                                                                                                                                               |
| Profil löschen                 | Löscht eigene Übungen, Pläne und Workouts (`ON DELETE CASCADE`).                                                                                                                                                                                   |

### Weitere Entscheidungen

| Thema                | Entscheidung                                                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trainingsart         | `training_type` ist freier Text ohne `CHECK`-Liste. Neue Sportarten sind ein Eintrag in `trainingTypes.ts`, keine Migration. Unbekannte Werte (z. B. von einer neueren App-Version) werden als „Sonstiges“ gelesen.                                          |
| Kein JSON-Speicher   | Alle Werte liegen in typisierten Spalten mit `CHECK`-Grenzen; keine generische JSON-Spalte.                                                                                                                                                                  |
| Einheiten            | Last immer in **kg** (`weight_kg`), Dauer in s, Distanz in m. Anzeige/Eingabe in kg oder lb nach Profileinstellung über dieselbe Logik wie beim Körpergewicht (`src/shared/lib/units.ts`). Eingabe bis 2 Nachkommastellen (Hantelscheiben 1,25 kg / 2,5 lb). |
| Satzgrenzen          | Gewicht 0–1000 kg, Wdh. 1–500 (ganzzahlig), Dauer 1 s–24 h, Distanz 1 m–100 km, RPE 1–10 in 0,5-Schritten. Geprüft in Domain (`validateSet`), Service und Datenbank (`CHECK`).                                                                               |
| Pflichtfelder je Typ | `weighted`: Gewicht + Wdh.; `bodyweight`: Wdh.; `timed`: Dauer; `distance`: Distanz. Erst beim **Abschließen** eines Satzes erzwungen, damit Zwischenstände gespeichert werden können.                                                                       |
| Aktives Workout      | Status `active`, höchstens eines pro Profil (eindeutiger Teilindex `workouts_one_active`). Jede Änderung wird sofort gespeichert – ein App-Abbruch verliert nichts.                                                                                          |
| Abschluss            | `ended_at`, `duration_s` werden gesetzt; leere Sätze werden entfernt. `CHECK` koppelt `status='completed'` an `ended_at`.                                                                                                                                    |
| Kalendertag          | `local_date` (YYYY-MM-DD) für Tagesauswertungen (Dashboard „Training (Min.)“).                                                                                                                                                                               |
| Kennzahlen           | Nicht gespeichert, sondern berechnet (`metrics.ts`): Volumen = Σ Gewicht × Wdh. abgeschlossener Sätze, geschätztes 1RM (Epley, 1–12 Wdh.), bester Satz. PRs lassen sich daraus ohne Schemaänderung ableiten.                                                 |
| Löschen              | Physisch (wie beim Gewicht), Tombstones folgen mit der Synchronisierung.                                                                                                                                                                                     |

### Indizes

| Index                                                                        | Abfrage                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `workouts_history`                                                           | Verlauf (`profile_id`, `status`, neueste zuerst, `LIMIT/OFFSET`) |
| `workouts_type`                                                              | Verlauf gefiltert nach Trainingsart                              |
| `workouts_plan_day`                                                          | Nächster Trainingstag eines Plans                                |
| `workouts_one_active`                                                        | Laufendes Workout (eindeutig)                                    |
| `workout_exercises_workout`                                                  | Workout-Details                                                  |
| `workout_exercises_exercise`                                                 | „Letztes Mal“ je Übung                                           |
| `workout_sets_exercise`                                                      | Sätze einer Übung                                                |
| `exercises_profile`                                                          | Übungsauswahl                                                    |
| `training_plans_profile`, `training_plan_days_plan`, `planned_exercises_day` | Pläne                                                            |

Die Nutzung der Verlaufsindizes ist per `EXPLAIN QUERY PLAN` getestet.

### Erweiterung für weitere Sportarten

Das Schema trägt die geplanten Sportarten ohne Umbau; neu hinzu kommen nur Tabellen für Daten,
die es beim Krafttraining nicht gibt:

| Sportart                                 | Nutzung des bestehenden Modells                                                                   | Später zusätzlich                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Laufen, Gehen, Radfahren                 | `workouts` mit `training_type`, Dauer; Distanz/Pace/Tempo werden aus Track oder Eingabe berechnet | `workout_tracks` (1:1 zu `workouts`), `track_points` (lat, lon, Höhe, Zeit, Genauigkeit), ggf. `workout_splits` |
| HYROX                                    | Stationen als `workout_exercises` (Workflow `segments`), Zeit/Distanz in `workout_sets`           | Segmentzeiten (`workout_splits`)                                                                                |
| Calisthenics                             | Übungen vom Typ `bodyweight` (Zusatzlast optional in `weight_kg`)                                 | –                                                                                                               |
| Mobility, Stretching                     | Übungen vom Typ `timed` (`duration_s`)                                                            | –                                                                                                               |
| Hypertrophie, Powerlifting, Gewichtheben | Identisch zu Krafttraining (Workflow `sets`)                                                      | –                                                                                                               |

GPS-Daten werden erst mit der GPS-Phase angelegt ([GPS_ARCHITECTURE.md](GPS_ARCHITECTURE.md));
Standortdaten sind im Datenkatalog nur in der verschlüsselten Datenbank zulässig.

Zugriff: `ExerciseRepository`, `PlanRepository`, `WorkoutRepository` → `ExerciseService`,
`PlanService`, `WorkoutService` (`src/core/training/`). Mehrschrittige Änderungen laufen über
`TrainingStore.atomic` in einer Transaktion.

## Ernährung (Migration 6)

Fundament des Ernährungsmoduls (`src/core/nutrition/`). Nur neue Tabellen, bestehende Daten
bleiben unberührt. Alle Tabellen hängen am Profil (`ON DELETE CASCADE`) und liegen in der
verschlüsselten Datenbank.

| Tabelle                           | Inhalt                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foods`                           | Lebensmittel: Name, Hersteller, Barcode, Quelle (`custom`/`local`/`external` + `provider`, `external_id`), Bezugsmenge (`reference_amount` + `reference_unit`), Nährwerte, Favorit, aktiv. Wird nie gelöscht, nur deaktiviert.  |
| `food_servings`                   | Lebensmittelspezifische Größe von „Stück“ bzw. „Portion“ (z. B. 1 Stück = 120 g). Einzige Brücke zwischen Zähl- und Gewichts-/Volumeneinheiten.                                                                                 |
| `meal_slots`                      | Konfigurierbare Mahlzeiten (vier Standards mit `default_key`, eigener Name optional, Reihenfolge, aktiv).                                                                                                                       |
| `food_entries`                    | Gegessene Menge je lokalem Kalendertag (`local_date`) und Mahlzeit, mit **Nährwert-Momentaufnahme** sowie Namen von Lebensmittel und Mahlzeit. Bezug auf `foods`/`recipes`/`meal_slots` bleibt optional (`ON DELETE SET NULL`). |
| `saved_meals`, `saved_meal_items` | Vorlagen („Standard-Frühstück“) mit Lebensmitteln und Mengen – kein Tagesprotokoll. Beim Anwenden entstehen neue Einträge mit aktuellen Werten.                                                                                 |
| `recipes`, `recipe_ingredients`   | Rezepte mit Portionen, Beschreibung, Zubereitungszeit, Notizen; Zutaten verweisen auf Lebensmittel (Grundlage einer späteren Einkaufsliste).                                                                                    |
| `nutrition_goals`                 | Tagesziele mit `effective_from` (gilt ab Tag) und Zielart (`lose`/`maintain`/`gain`); je Wert (kcal, Protein, KH, Fett, Wasser) eine automatische und eine manuelle Spalte. Manuell überschreibt automatisch.                   |
| `water_entries`                   | Wasser je lokalem Tag, Menge und Einheit (`ml`/`l`), Uhrzeit optional; unabhängig von Nährwerten.                                                                                                                               |

| Thema            | Entscheidung                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Einheiten        | Feste Kennungen `g`, `kg`, `ml`, `l`, `piece`, `serving` (`CHECK`), Übersetzung erst in der Oberfläche. Umrechnung nur innerhalb einer Dimension (g↔kg, ml↔l); Stück/Portion nur über `food_servings`; Masse↔Volumen nie. |
| Nährwerte        | Zahlen (kcal, g), bezogen auf die Bezugsmenge; Details (Ballaststoffe, Zucker, gesättigte Fettsäuren) optional, `NULL` = unbekannt. Gespeicherte Werte mit zwei Nachkommastellen.                                         |
| Historie         | Einträge speichern die berechneten Nährwerte. Korrekturen an Lebensmitteln oder Rezepten ändern vergangene Tage nicht; Mengenänderungen skalieren die Momentaufnahme.                                                     |
| Kalendertag      | `local_date` nach derselben Regel wie Gewicht und Training (`toLocalDateKey`).                                                                                                                                            |
| Externe Produkte | Eindeutig je Profil über `(profile_id, provider, external_id)`; erneuter Import aktualisiert die lokale Kopie, danach offline nutzbar.                                                                                    |
| Gewicht          | Keine eigene Speicherung: Ernährung liest über `BodyWeightSource` aus `weight_entries`.                                                                                                                                   |
| Indizes          | `food_entries_day`, `water_entries_day` (Tagesabfragen, per Test geprüft), `foods_profile`, `foods_barcode`, `foods_external`, `recipe_ingredients_recipe`, `saved_meal_items_meal`.                                      |

## Ernährungsprofil (Migration 7)

Rein additiv, bestehende Ziele bleiben vollständig erhalten.

| Tabelle / Spalte                   | Inhalt                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profiles.sex`                     | `male` / `female` / `unspecified` (optional)                                                                                                                                                                                                                                   |
| `profiles.birth_date`              | Geburtsdatum `YYYY-MM-DD`; das Alter wird je Berechnung abgeleitet, nie gespeichert                                                                                                                                                                                            |
| `profiles.height_cm`               | Körpergröße in cm                                                                                                                                                                                                                                                              |
| `nutrition_goals.goal_level`       | Tempo: `slow`/`moderate`/`fast` (Abnehmen), `moderate`/`higher` (Muskelaufbau), `NULL` (Halten)                                                                                                                                                                                |
| `nutrition_goals.activity_level`   | Alltagsaktivität ohne Sport (`sedentary` … `veryActive`)                                                                                                                                                                                                                       |
| `nutrition_goals.include_training` | Training in die Kalorienberechnung einbeziehen (Standard 0)                                                                                                                                                                                                                    |
| `nutrition_goals.target_weight_kg` | Wunschgewicht (optional)                                                                                                                                                                                                                                                       |
| `nutrition_goals.auto_enabled`     | 1 = Werte stammen aus der Berechnung; bestehende Ziele lesen sich als 0 (rein manuell)                                                                                                                                                                                         |
| `nutrition_goals.calculation`      | JSON-Momentaufnahme der Berechnung: Formelversion, Eingaben (Trendgewicht und Methode, Alter, Größe, Geschlecht, Aktivität, Training, Ziel, Tempo, Wunschgewicht), Grundumsatz, Erhaltungsbedarf, Zielanpassung samt Grenzen, Protein-/Fett-/Kohlenhydrat-Herleitung, Hinweise |

**Versionen statt Tageszielen.** Jede Zeile in `nutrition_goals` ist eine Version des
Ernährungsprofils, gültig ab `effective_from` bis zum Beginn der nächsten Version (kein
gespeichertes Enddatum, keine Lücken). Eine Änderung – durch den Nutzer oder eine relevante
Gewichtsänderung – legt eine Version ab dem aktuellen Tag an (am selben Tag wird sie ersetzt).
Vergangene Tage behalten so die damals gültigen Werte. Je Wert gibt es weiterhin `*_auto` und
`*_manual`; manuelle Werte bleiben bei Neuberechnungen unverändert. Das Gewicht wird nicht
kopiert: Die Momentaufnahme enthält nur das für die Berechnung verwendete Trendgewicht.
Details zur Berechnung: [NUTRITION_CALCULATION.md](NUTRITION_CALCULATION.md).

## Phase 4.3 – keine Schemaänderung

Open Food Facts, Favoriten und „zuletzt verwendet“ nutzen das bestehende Schema (Version 7):

- Importierte Produkte: `foods.source = 'external'`, `provider = 'openfoodfacts'`,
  `external_id` = Barcode; Duplikate verhindert der eindeutige Index `foods_external`
  (`profile_id, provider, external_id`) sowie die Barcode-Suche über `foods_barcode`.
- Favoriten: `foods.favorite`.
- Zuletzt verwendet: abgeleitet aus `food_entries` (`MAX(created_at)` je `food_id`, Index
  `food_entries_food`), begrenzt auf `RECENT_FOODS_LIMIT` – keine zusätzliche Speicherung.
- Barcodes werden beim Speichern normalisiert (nur Ziffern, 8–14 Stellen).

## Herkunft von Lebensmitteln (Migration 8, Phase 4.4)

Rein additiv – keine bestehende Zeile wird verändert, kein Tabellenumbau.

| Spalte                      | Inhalt                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `foods.origin_dataset`      | Referenzdatensatz eines mitgelieferten Lebensmittels, z. B. `bls`; sonst `NULL`          |
| `foods.origin_code`         | Kennung im Datensatz (BLS-Code)                                                          |
| `foods.origin_version`      | Datensatzversion, z. B. `4.0`                                                            |
| `foods.copied_from_food_id` | Bei einer eigenen Kopie: das Original (`REFERENCES foods(id) ON DELETE SET NULL`)        |
| Index `foods_origin`        | eindeutig auf `(origin_dataset, origin_code)` für Zeilen mit Datensatz – keine Duplikate |

Zuordnung der Herkunftsbegriffe auf das bestehende Schema (die CHECK-Regeln aus Migration 6
bleiben unverändert):

| Herkunft        | Speicherung                                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| BLS             | `source = 'local'`, `profile_id = NULL`, `origin_dataset = 'bls'`, Code, Version |
| OPEN_FOOD_FACTS | `source = 'external'`, `provider = 'openfoodfacts'`, `external_id` = Barcode     |
| CUSTOM          | `source = 'custom'`                                                              |
| Eigene Kopie    | `source = 'custom'` mit `copied_from_food_id`                                    |

Ein BLS-Lebensmittel wird erst beim ersten Benutzen angelegt (die übrigen der 7.137 bleiben in
den gebündelten Daten). Tagebuch, Favoriten, Vorlagen, Rezepte, eigene und Open-Food-Facts-
Lebensmittel bleiben unberührt (per Test geprüft, `bls.test.ts` → „migration 8“).

## Übungsbibliothek und Favoriten (Migration 9, Phase 5)

```sql
CREATE TABLE exercise_favorites (
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (profile_id, exercise_id)
);
```

- **Rein additiv:** keine bestehende Zeile ändert sich.
- **Eigene Tabelle statt Spalte:** Systemübungen gehören keinem Profil (`profile_id` NULL); ein
  Favoriten-Flag an der Übung könnte daher nicht persönlich sein.
- **„Zuletzt genutzt“ ohne Tabelle:** berechnet aus `workout_exercises` ⨝ `workouts`
  (`MAX(started_at)` je Übung, nutzt `workouts_history`/`workout_exercises_exercise`).
- **Katalog ohne Migration:** Die 201 Systemübungen kommen gebündelt aus
  `src/core/training/catalog/` (`EXERCISE_CATALOG_VERSION = 2`) und werden beim Start per Upsert
  abgeglichen – einmal pro Version, danach No-op. Beschreibungen landen in
  `instructions_de`/`instructions_en`. Eigene Übungen werden dabei nie berührt.
- **Aliase** (z. B. „Bankdrücken“, „RDL“, frühere Namen) sind reine Suchbegriffe im gebündelten
  Katalog, nicht in der Datenbank, und erzeugen keine zusätzlichen Übungen.
- **Umbenennungen:** Bestehende IDs bleiben; Pläne zeigen den neuen Namen, Workouts behalten ihren
  Namens-Snapshot.
- Datenkatalog: Kategorie `training`, Sensibilität `personal`, exportierbar, wird mit dem Profil
  gelöscht, später synchronisierbar.

## Importierte Gesundheitsdaten (Migration 10, Phase 6.2)

```sql
CREATE TABLE imported_weights (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('healthConnect')),
  date TEXT NOT NULL,                 -- lokaler Tag
  value REAL NOT NULL CHECK (value >= 20 AND value <= 400), unit TEXT NOT NULL DEFAULT 'kg',
  measured_at TEXT NOT NULL,          -- früheste Messung des Tages, UTC
  external_id TEXT, source TEXT,      -- Health-Connect-ID, aufzeichnende App/Gerät
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX imported_weights_day ON imported_weights (profile_id, platform, date);
CREATE INDEX imported_weights_profile_date ON imported_weights (profile_id, date);
CREATE INDEX imported_weights_platform ON imported_weights (platform);

CREATE TABLE daily_activity (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('healthConnect')),
  date TEXT NOT NULL,
  steps INTEGER,                      -- NULL = keine Daten
  active_kcal REAL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, platform, date)
);
CREATE INDEX daily_activity_profile_date ON daily_activity (profile_id, date);
CREATE INDEX daily_activity_platform ON daily_activity (platform);
```

- **Rein additiv;** keine bestehende Tabelle ändert sich.
- **Getrennt von `weight_entries`:** Ein Import verändert nie eigene Gewichte; Ernährungsziele
  lesen nur `weight_entries` (per Test geprüft).
- **Ein Wert pro Profil, Plattform und Tag;** beim Gewicht die früheste Messung.
- **Abgleich** der letzten 30 Tage nur nach vollständig erfolgreichem Lesen; außerhalb des
  Fensters bleibt alles unverändert (siehe [HEALTH_CONNECT.md](HEALTH_CONNECT.md)).
- **Kein Tombstone, kein `sync_state`:** Die Daten sind jederzeit neu importierbar und werden
  nicht in eine Cloud synchronisiert (Datenkatalog: `syncable: false`).
- Datenkatalog: `imported_weights` Kategorie `health`, `daily_activity` Kategorie `activity`,
  beide Sensibilität `health`, exportierbar, mit dem Profil gelöscht.
- Verbindungsstatus: `app_settings`, Schlüssel `healthConnect` (gerätebezogen).

## Importierte Aktivitäten (Migration 11, Phase 6.3)

```sql
CREATE TABLE external_workouts (
  id             TEXT PRIMARY KEY NOT NULL,
  profile_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform       TEXT NOT NULL CHECK (platform IN ('healthConnect')),
  external_id    TEXT NOT NULL,          -- Record-ID in Health Connect
  activity_type  TEXT NOT NULL,          -- Typ wie geliefert, z. B. 'running'
  category       TEXT NOT NULL,          -- strength | endurance | hybrid | flexibility | sport | other
  started_at     TEXT NOT NULL,
  ended_at       TEXT NOT NULL,
  local_date     TEXT NOT NULL,          -- lokaler Tag des Starts
  duration_s     INTEGER NOT NULL,       -- 1 … 86 400
  active_kcal    REAL,                   -- NULL = nicht geliefert, 0 … 10 000
  distance_m     REAL,                   -- NULL = nicht geliefert, 0 … 1 000 000
  steps          INTEGER,                -- NULL (vom Plugin nicht geliefert)
  source         TEXT,                   -- Gerät oder App laut Health Connect
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX external_workouts_record ON external_workouts (profile_id, platform, external_id);
CREATE INDEX external_workouts_profile_start ON external_workouts (profile_id, started_at);
CREATE INDEX external_workouts_profile_date ON external_workouts (profile_id, local_date);
CREATE INDEX external_workouts_profile_type ON external_workouts (profile_id, activity_type);
```

- **Rein additiv;** strikt getrennt von `workouts` (keine Fremdschlüssel, keine gemeinsame Sicht).
- **Eindeutig je Record-ID:** Wiederholtes Lesen aktualisiert die Zeile statt sie zu verdoppeln.
- **Abgleich** wie bei Migration 10, über `local_date` im 30-Tage-Fenster.
- Datenkatalog: Kategorie `activity`, Sensibilität `health`, exportierbar, mit dem Profil
  gelöscht, `syncable: false`. Wird beim Trennen mit „Importierte Daten löschen“ entfernt.
- Einstellung „Aktivitätskalorien anrechnen“: `app_settings`, Schlüssel `countActivityCalories`
  (Boolean, Standard `false`). Das Kalorienziel in `nutrition_goals` wird dadurch nie verändert.

## Manuelle Aktivitäten (Migration 12, Phase 8)

Tabelle `manual_activities` – selbst erfasste Sportarten mit Dauer, optional Startzeit und Distanz,
Intensität/Variante, dem verwendeten Körpergewicht, MET-Wert mit Compendium-Quelle, berechneten
und verwendeten kcal sowie `kcal_overridden`. Vollständiges Schema, Berechnung und Duplikatregel:
[ACTIVITIES.md](ACTIVITIES.md).

- **Rein additiv;** strikt getrennt von `workouts` und `external_workouts` (keine Fremdschlüssel,
  nichts wird kopiert). `CHECK`-Grenzen für Dauer, Distanz, MET, Gewicht und kcal.
- Index `manual_activities_profile_date (profile_id, local_date)` für Zeiträume.
- Datenkatalog: Kategorie `activity`, Sensibilität `health`, exportierbar, mit dem Profil
  gelöscht (`ON DELETE CASCADE`), `syncable: false`.

## Regeneration und Hauptziel „Allgemeine Fitness“ (Migration 13, Phase 9)

```sql
CREATE TABLE recovery_entries (
  id          TEXT PRIMARY KEY NOT NULL,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  local_date  TEXT NOT NULL,              -- ein Eintrag je Profil und Tag
  state       TEXT,                       -- poor | moderate | good | NULL
  rest_day    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  CHECK (state IS NOT NULL OR rest_day = 1)
);
CREATE UNIQUE INDEX recovery_entries_day ON recovery_entries (profile_id, local_date);
```

- Subjektive Tagesangabe für den Kalethra-Score ([SCORE.md](SCORE.md)); Kategorie `health`,
  Sensibilität `health`, exportierbar, mit dem Profil gelöscht, `syncable: false`.
- `nutrition_goals.goal_type` erlaubt zusätzlich `fitness`. Weil SQLite `CHECK`-Bedingungen nicht
  ändern kann, wird die Tabelle mit identischen Spalten neu angelegt, jede Zeile unverändert
  kopiert und der Index `nutrition_goals_day` neu erstellt (getestet: Zeilen vorher = nachher).
- Der Score selbst wird **nicht** gespeichert. Die Wochenziele lagen bis Phase 9 in
  `app_settings`; seit Migration 14 in `goal_targets` (unten).

## Versionierte Ziele (Migration 14, Phase 10)

```sql
CREATE TABLE goal_targets (
  id             TEXT PRIMARY KEY NOT NULL,
  profile_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,   -- trainingsPerWeek | activeMinutesPerWeek | stepsPerDay
  effective_from TEXT NOT NULL,   -- YYYY-MM-DD, gilt bis zur nächsten Version
  value          INTEGER,         -- NULL = kein Ziel ab diesem Tag; Grenzen per CHECK
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX goal_targets_version ON goal_targets (profile_id, kind, effective_from);
```

- Versioniert wie `nutrition_goals`: Eine Änderung legt eine Version ab heute an, ältere werden
  nie verändert; eine zweite Änderung am selben Tag ersetzt die heutige.
- **Übernahme:** `trainingsPerWeek` und `activeMinutesPerWeek` aus `app_settings` werden für jedes
  Profil als Version ab `1970-01-01` übernommen (nur gültige ganze Zahlen im Bereich) und danach
  aus `app_settings` gelöscht – eine Quelle, kein Datenverlust, bisherige Scores identisch.
  `INSERT OR IGNORE` macht die Übernahme wiederholbar.
- Datenkatalog: Kategorie `profile`, Sensibilität `personal`, exportierbar, mit dem Profil
  gelöscht, `syncable: false`. Details: [SETTINGS.md](SETTINGS.md).

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

Training (Migration 4) und das Ernährungsfundament (Migration 6) sind umgesetzt (siehe oben).

Skizze zur Orientierung; die Tabellen entstehen mit dem jeweiligen Modul als eigene Migrationen.

| Bereich      | Tabellen (vorläufig)                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Benutzer     | `profiles` (vorhanden), `goals` (Zielart, Zielwert, Zeitraum)                                                                                                                                                 |
| Gesundheit   | `measurements` (Typ, Wert, Einheit, Zeitpunkt, Quelle); Health-Connect-Gewicht und `daily_activity` seit Migration 10, `external_workouts` seit Migration 11, `manual_activities` seit Migration 12 umgesetzt |
| Regeneration | `sleep_sessions`                                                                                                                                                                                              |

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

Details: [PRIVACY.md](PRIVACY.md). Kurzfassung für Entwickler:

- Jede neue Tabelle braucht einen Eintrag im Datenkatalog `src/core/privacy/dataCatalog.ts`
  (Kategorie, Sensibilität, Export, Löschung, Sync) – sonst schlägt ein Test fehl.
- Die native Datenbank ist mit SQLCipher verschlüsselt (Schlüssel im Keystore/Keychain, siehe
  [PRIVACY.md](PRIVACY.md)); auf dem Xiaomi 15 Ultra validiert (SQLCipher 4.17.0
  Community). Erst danach wurde `LOCAL_DATABASE_ENCRYPTED` aktiviert und `weight_entries` angelegt.
- Android-Backup und Geräteübertragung sind für alle App-Daten abgeschaltet.
