# Einstellungen, Profil und Ziele (Phase 10)

Seit Phase 10 heißt der fünfte Tab **Einstellungen** (vorher „Profil“). Alles, was der Nutzer
über sich und seine Ziele festlegt, liegt dort – jeweils an genau einer Stelle. Die übrigen Tabs
werten nur aus oder verlinken hierher.

## Aufbau (höchstens zwei Ebenen)

| Route               | Seite         | Inhalt                                                                                                                                          |
| ------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/settings`         | Einstellungen | Profilkopf, Liste der vier Bereiche                                                                                                             |
| `/settings/profile` | Profil        | Name, Geschlecht, Geburtsdatum, Körpergröße; Gewicht nur zur Ansicht mit Link zu Gesundheit                                                     |
| `/settings/goals`   | Ziele         | Hauptziel (+ Wunschgewicht), Ernährung, Aktivitätskalorien, Training, Aktivitäten, Gesundheit (Schrittziel)                                     |
| `/settings/content` | Meine Inhalte | Platzhalter: Verweise auf die bestehenden Orte (Lebensmittel, Mahlzeiten, Vorlagen, Pläne, Übungen) – noch keine eigene Verwaltung              |
| `/settings/app`     | App           | Darstellung, Gewichtseinheit, Sprache, Wasser-Schnellmengen, Health Connect, Datenschutz/Speicherprüfung, Über Kalethra (Version, Datenquellen) |

Zurück: jede Unterseite → `/settings`, `/settings` → Fortschritt (`/`), wie bei allen Tabs
(`backTarget`). Android-Zurück und Browser-Verlauf folgen derselben Regel.

### Alte Adressen

`LEGACY_REDIRECTS` in `src/app/routes.ts` leiten mit `replace` weiter (kein Eintrag im Verlauf):

- `/profile` → `/settings`
- `/nutrition/profile` → `/settings/goals`

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
