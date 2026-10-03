# Einstellungen, Profil, Ziele und eigene Inhalte (Phase 10 und 11)

Seit Phase 10 heißt der fünfte Tab **Einstellungen** (vorher „Profil“). Alles, was der Nutzer
über sich und seine Ziele festlegt, liegt dort – jeweils an genau einer Stelle. Seit Phase 11 werden
dort auch die eigenen Inhalte verwaltet (**Meine Inhalte**). Die übrigen Tabs erfassen, was
tatsächlich passiert ist, werten aus oder verlinken hierher.

**Leitlinie:** Einstellungen verwalten die Inhalte. Ernährung und Training verwenden sie für das
tägliche Tracking.

## Aufbau

| Route               | Seite         | Inhalt                                                                                                                                          |
| ------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/settings`         | Einstellungen | Profilkopf, Liste der vier Bereiche                                                                                                             |
| `/settings/profile` | Profil        | Name, Geschlecht, Geburtsdatum, Körpergröße; Gewicht nur zur Ansicht mit Link zu Gesundheit                                                     |
| `/settings/goals`   | Ziele         | Hauptziel (+ Wunschgewicht), Ernährung, Aktivitätskalorien, Training, Aktivitäten, Gesundheit (Schrittziel)                                     |
| `/settings/content` | Meine Inhalte | Übersicht der eigenen Inhalte, getrennt nach Ernährung und Training (siehe unten)                                                               |
| `/settings/app`     | App           | Darstellung, Gewichtseinheit, Sprache, Wasser-Schnellmengen, Health Connect, Datenschutz/Speicherprüfung, Über Kalethra (Version, Datenquellen) |

Zurück: jede Unterseite → `/settings`, `/settings` → Fortschritt (`/`), wie bei allen Tabs
(`backTarget`). Android-Zurück und Browser-Verlauf folgen derselben Regel. Die Seiten von Meine
Inhalte liegen eine Ebene tiefer, die Plan-Detailseite zwei (bewusst so entschieden, Phase 11).

## Meine Inhalte (Phase 11 und 11B)

| Route                                     | Seite                | Inhalt                                                                                                                                       |
| ----------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/settings/content`                       | Meine Inhalte        | Ernährung: Lebensmittel, Mahlzeiten des Tages, Vorlagen, Rezepte · Training: Trainingspläne, Übungen – je mit kurzer Beschreibung und Anzahl |
| `/settings/content/foods`                 | Lebensmittel         | Suche, Favoriten, eigene und ausgeblendete Lebensmittel; bearbeiten, löschen/ausblenden, BLS als eigene Kopie (`FoodFormSheet`)              |
| `/settings/content/meals`                 | Mahlzeiten des Tages | Abschnitte des Tagebuchs (Frühstück …): hinzufügen, umbenennen, verschieben, ein-/ausblenden; mindestens einer bleibt sichtbar               |
| `/settings/content/templates`             | Vorlagen             | Liste; jede Vorlage öffnet ihre Bearbeitung                                                                                                  |
| `/settings/content/templates/:templateId` | Vorlage              | Name, Mahlzeit (oder keine), Lebensmittel und Mengen ändern, entfernen, hinzufügen; speichern; löschen (Phase 11B)                           |
| `/settings/content/recipes`               | Rezepte              | Suche, Liste mit Portionen, Zutaten und kcal pro Portion; Rezept anlegen, öffnen/bearbeiten, löschen (Phase 11B)                             |
| `/settings/content/plans`                 | Trainingspläne       | Liste, neuer Plan                                                                                                                            |
| `/settings/content/plans/:planId`         | Plan                 | Tage und Übungen hinzufügen, umbenennen, verschieben, löschen; Satz-/Wiederholungsziele, Aufwärm- und Drop-Sätze; Plan umbenennen/löschen    |
| `/settings/content/exercises`             | Übungen              | Bibliothek (schreibgeschützt) mit Suche, Filtern, Details und Favoriten; eigene Übungen anlegen, bearbeiten, (de)aktivieren                  |

Zurück: Inhaltsseite → Meine Inhalte → Einstellungen → Fortschritt; Plan → Trainingspläne;
Vorlage → Vorlagen. Nach dem Löschen eines Plans oder einer Vorlage geht es (ohne Verlaufseintrag)
zur Liste.

**Technik.** Die Seiten gehören weiter ihren Fachmodulen (`modules/nutrition`,
`modules/training`) und werden dort über `AppModule.contentRoutes` unter `/settings/content/…`
angemeldet; die App setzt daraus die Routen und die Zurück-Hierarchie zusammen. Einstellungen
importieren keine Seiten anderer Module (Isolationstest `src/app/moduleIsolation.test.ts`). Die
Übersicht liest nur die Anzahlen über die bestehenden Services. Es gibt keine neue Tabelle und keine
Migration; alle Schreibwege bleiben dieselben Services (Lebensmittel, Mahlzeiten, Plan, Übungen).

**Tracking und Schnellzugriffe.** Ernährung und Training haben keine eigene Verwaltung mehr
(kein „Verwalten“-Abschnitt in Ernährung, keine Links zu Plänen und Übungen im Training). Erlaubt
bleiben Schnellzugriffe, die dieselben Formulare und Services nutzen:

- Ernährung, Hinzufügen-Fenster: „Neues Lebensmittel anlegen“, Barcode scannen/eingeben (inkl.
  „unbekannt → anlegen“), Vorlagen anwenden, Rezepte eintragen, „Neues Rezept anlegen“ (dasselbe
  Rezeptformular, danach direkt eintragen); im Tagebuch „Als Vorlage speichern“.
- Training, Übungsauswahl (Plan bearbeiten, laufendes und abgeschlossenes Training): „Eigene Übung
  anlegen“.
- Training, Start-Fenster ohne Plan: „Zu Plänen“ führt zu Meine Inhalte → Trainingspläne.

**Training starten** geht nur im Trainingsbereich (Karte „Nächstes Training“, Start-Fenster mit
„Freies Training“ und „Aus Plan starten“ mit allen Tagen aller Pläne). Die Planseite hat keinen
Start-Knopf mehr.

### Rezepte (Phase 11B)

- **Ein Formular:** `RecipeFormSheet` (in `modules/nutrition`) für neue und bestehende Rezepte –
  in Meine Inhalte → Rezepte und als Schnellzugriff im Hinzufügen-Fenster. Felder: Name, Portionen
  (über 0 bis 100), Zubereitung in Minuten (optional, ganze Zahl bis 1440), Zutaten (Lebensmittel,
  Menge, Einheit, Hinweis), Beschreibung und Notizen (optional). Ein Rezept ohne Zutaten ist
  erlaubt (wie im Service) und hat keine Nährwerte.
- **Nährwerte:** gesamt und pro Portion aus `recipeNutrition` (Summe der Zutaten nach Menge ÷
  Portionen) – dieselbe Funktion, die der `RecipeService` und das Eintragen nutzen; die Oberfläche
  rechnet nichts selbst.
- **Speichern/Löschen:** `RecipeService.create/update/delete` (Tabellen `recipes`,
  `recipe_ingredients`). Löschen fragt nach; eingetragene Tage behalten ihren Eintrag (die
  Rezept-Referenz wird geleert, `ON DELETE SET NULL`).
- **Eintragen:** Hinzufügen-Fenster → Reiter „Rezepte“ (Suche, Liste, „Neues Rezept anlegen“) →
  Portionen (z. B. 0,5 oder 2) und Mahlzeit → `DiaryService.addRecipe`. Der Eintrag speichert die
  Nährwerte als Momentaufnahme; spätere Änderungen am Rezept oder an Lebensmitteln ändern
  vergangene Tage (und damit den Score) nicht.
- **Ausgeblendete Zutaten** bleiben im Rezept und werden als „Ausgeblendet – bleibt erhalten“
  markiert, nie ersetzt.

### Vorlagen bearbeiten (Phase 11B)

- Seite `/settings/content/templates/:templateId`: Name, Mahlzeit (auch „Keine feste Mahlzeit“),
  Lebensmittel mit Menge und Einheit ändern, entfernen und hinzufügen; speichern über
  `MealService.updateSavedMeal`, löschen über `deleteSavedMeal`. Mindestens ein Lebensmittel bleibt
  Pflicht (Regel des Service).
- Änderungen gelten fürs nächste Anwenden; bereits eingetragene Tage bleiben unverändert (das
  Anwenden erzeugt eigene Einträge mit Momentaufnahme).
- Erstellt werden Vorlagen weiter im Tagebuch („Als Vorlage speichern“), angewendet im
  Hinzufügen-Fenster. Rezepte und Vorlagen bleiben getrennte Konzepte und Tabellen; gemeinsam ist
  nur die Bearbeitungszeile für Lebensmittel und Mengen (`QuantityRows`).

### Gemeinsame Lebensmittel-Auswahl

`useFoodPicker` / `FoodPickerSheet` (in `modules/nutrition`) ist die eine Lebensmittelauswahl:
Zuletzt verwendet, Favoriten, alle gespeicherten Lebensmittel, Offline-Suche (eigene, gespeicherte
Produkte, BLS), Barcode scannen/eingeben und „Neues Lebensmittel anlegen“ (`FoodFormSheet`). Sie
wird beim Eintragen, für Rezeptzutaten und für Vorlagen genutzt – ein dort neu angelegtes
Lebensmittel steht überall zur Verfügung. Die Auswahl öffnet ohne Tastatur.

**Noch nicht umgesetzt:** Kein Barcode-Einstieg in der zentralen Lebensmittelverwaltung; der
Scanner bleibt in der Lebensmittelauswahl (Eintragen, Rezept, Vorlage).

### Alte Adressen

`LEGACY_REDIRECTS` in `src/app/routes.ts` leiten mit `replace` weiter (kein Eintrag im Verlauf);
Parameter wie die Plan-ID werden übernommen (`app/layout/LegacyRedirect.tsx`). Die App selbst
verlinkt nur noch die neuen Adressen.

- `/profile` → `/settings`
- `/nutrition/profile` → `/settings/goals`
- `/nutrition/foods` → `/settings/content/foods`
- `/nutrition/meals` → `/settings/content/meals`
- `/nutrition/templates` → `/settings/content/templates`
- `/training/plans` → `/settings/content/plans`
- `/training/plans/:planId` → `/settings/content/plans/:planId`
- `/training/exercises` → `/settings/content/exercises`

## Eine Schreibstelle je Wert

| Wert                                  | Einzige Schreibstelle                      | Speicher                                                      |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| Name, Geschlecht, Geburtsdatum, Größe | Einstellungen → Profil (`updateBodyData`)  | `profiles`                                                    |
| Körpergewicht                         | **Gesundheit → Gewicht**                   | `weight_entries` (im Profil nur Anzeige + Link)               |
| Hauptziel, Wunschgewicht, Ernährung   | Einstellungen → Ziele                      | `nutrition_goals` (versioniert, unverändert seit Phase 4.2.2) |
| Aktivitätskalorien anrechnen          | Einstellungen → Ziele (speichert sofort)   | `app_settings.countActivityCalories`                          |
| Trainings pro Woche                   | Einstellungen → Ziele → Training           | `goal_targets` (versioniert)                                  |
| Aktive Minuten pro Woche              | Einstellungen → Ziele → Aktivitäten        | `goal_targets` (versioniert)                                  |
| Schrittziel pro Tag                   | Einstellungen → Ziele → Gesundheit         | `goal_targets` (versioniert)                                  |
| Wasserziel                            | Einstellungen → Ziele (Teil der Ernährung) | `nutrition_goals`                                             |
| Wasser-Schnellmengen                  | Einstellungen → App                        | `app_settings`                                                |

Die Ernährungslogik (Aktivitätsniveau, Training einbeziehen, automatisch/manuell, Bestätigung,
Schwellen, Protein-Referenz BMI 27,5, Mifflin-St-Jeor) ist unverändert; nur der Ort der
Oberfläche hat sich geändert. Der Abschnitt der Ernährung zum Training heißt jetzt „Training im
Energiebedarf“, damit er nicht mit dem Abschnitt „Training“ (Wochenziel) verwechselt wird.

## Versionierte Ziele (`goal_targets`, Migration 14)

Code: `src/core/targets/` (rein: `targets.ts`; Speicher: `targetRepository.ts`,
`targetService.ts`; Oberfläche: `TargetsProvider.tsx`).

- Eine Zeile je Profil, Art und erstem Gültigkeitstag (`effective_from`). Eine Änderung legt eine
  neue Version **ab heute** an; ältere Versionen werden nie verändert. Eine zweite Änderung am
  selben Tag ersetzt die heutige Version; ein unveränderter Wert legt nichts an.
- `value = NULL` heißt „kein Ziel ab diesem Tag“.
- `targetOn(versions, tag)` liefert den an einem Tag gültigen Wert (letzte Version mit
  `effective_from ≤ tag`).
- Grenzen (auch als `CHECK`): Trainings 1–14, aktive Minuten 10–2000, Schritte 1000–50000.
  Angeboten werden Listen (kein Tastaturfeld): Trainings 1–7; Minuten 60–300; Schritte
  4.000–15.000.

Beispiel: Ziel A bis 9. September, Ziel B ab 10. September. Der Score für 1.–7. September nutzt
A, für 10.–16. September B, ein Zeitraum über die Grenze nutzt je Tag den damals gültigen Wert.
Eine Änderung heute ändert keinen vergangenen Score.

### Migration 14

- Legt `goal_targets` an (eindeutiger Index `profile_id, kind, effective_from`).
- Übernimmt `trainingsPerWeek` und `activeMinutesPerWeek` aus `app_settings` für jedes Profil als
  Version ab `1970-01-01` – vorher galt der Wert für jeden Tag, deshalb bleiben alle bisherigen
  Scores identisch. Nur gültige ganze Zahlen im erlaubten Bereich werden übernommen.
- Löscht die beiden Schlüssel danach aus `app_settings` (eine Quelle).
- Wiederholbar (`INSERT OR IGNORE` auf dem eindeutigen Index). Getestet mit und ohne Altwerte,
  mit ungültigen Werten, mit mehreren Profilen und mit identischem Score vorher/nachher.

## Schrittziel

- Schritte kommen **nur** aus Health Connect (`daily_activity.steps`). Keine manuelle Eingabe,
  kein zweiter Speicher.
- Standard: **kein Ziel**.
- Anzeige unter Gesundheit (Health-Connect-Übersicht): „6.543 von 8.000“ bzw. „Erreicht · …“,
  dazu „Ziel an x von y Tagen mit Daten erreicht (7 Tage)“. Tage ohne Schrittdaten zählen nicht
  (neutral, nie „nicht erreicht“). Ohne Ziel: Link „Schrittziel festlegen“.
- Reine Auswertung: `summarizeStepGoal` (`src/core/health/steps.ts`).
- **Nicht** Teil des Kalethra-Scores.

## Drei Gewichtsregeln

Bewusst getrennt, zentral beschrieben in `src/core/health/weightRules.ts`:

1. **Ernährungsziele:** nur eigene Einträge, Median der letzten 7 Tage (`trendWeight`);
   Protein-Referenz bei BMI 27,5 gedeckelt. Importierte Werte ändern nie ein Ernährungsziel.
2. **Fortschritt (Gewichtskarte):** eigene und Health-Connect-Werte, einer je Tag, der eigene
   gewinnt am selben Tag (`mergeWeightDays`). Nur Anzeige.
3. **Aktivitätskalorien** (MET-Schätzung einer manuellen Aktivität): neuester Wert bis zum Tag –
   eigener oder importierter, wenn neuer (eigener gewinnt am selben Tag); importierte Werte
   höchstens `ACTIVITY_WEIGHT_WINDOW_DAYS` = 60 Tage alt (`pickActivityWeight`).

Phase 10 hat an den Regeln fachlich nichts geändert, nur Namen und Ort vereinheitlicht.

## Fortschritt und Score

Fortschritt bleibt reine Auswertung. Die Links „Ziele anpassen“ im Score-Detail und „Wasserziel
festlegen“ bzw. die Ziel-Links in Ernährung führen nach Einstellungen → Ziele. Die Score-Formel ist unverändert,
außer dass Trainings- und Minutenziel je Tag aus der gültigen Version kommen
([SCORE.md](SCORE.md)).
