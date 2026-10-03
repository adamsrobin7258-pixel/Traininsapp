# Kalethra-Score (Phase 9)

Eine Zahl von 0 bis 100 ganz oben auf „Fortschritt“. Sie zeigt, wie gut die **dokumentierten**
Einträge eines Zeitraums zum persönlichen Hauptziel passen. Sie ist **keine** Bewertung der
Gesundheit und nichts Medizinisches; die Gewichtung ist eine Produktfestlegung, keine
wissenschaftlich validierte Formel.

Der Score wird **nie gespeichert**: Er wird bei jeder Anzeige aus den vorhandenen Daten berechnet –
deterministisch, offline, ohne KI und ohne externen Dienst. Er kann also nicht veralten.

## Wo die Logik liegt

| Datei                                      | Inhalt                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `src/core/score/config.ts`                 | **Alle Stellschrauben**: Gewichte je Ziel, Toleranzen, Punkte, Vorläufig-Regel, Trend-Schwelle, Stufen |
| `src/core/nutrition/goalAttainment.ts`     | Kalorien-Toleranz (5 %) und Protein-Schwelle (90 %) – seit Phase 14 von Score und Fortschritt geteilt  |
| `src/core/targets/targets.ts`              | `weeklyExpectation` (Soll eines Wochenziels im Zeitraum) – seit Phase 14 von Score und Fortschritt     |
| `src/core/score/score.ts`                  | Reine Berechnung: vier Teilwerte, Gesamtscore, Vorläufig, Trend                                        |
| `src/core/score/scoreService.ts`           | Liest die bestehenden Services (`ScoreSources`), rechnet Zeitraum + Vorzeitraum                        |
| `src/app/services.ts`                      | Verdrahtung der Quellen (Tagebuch, Tagesziele, Workouts, Aktivitäten, Regeneration)                    |
| `src/core/score/ScoreProvider.tsx`         | `useScore` – rechnet neu, sobald sich eine Eingabe ändert                                              |
| `src/modules/progress/domain/scoreText.ts` | Erklärungssätze je Bereich, nur aus den tatsächlich genutzten Zahlen                                   |

## Hauptziel und Gewichtung

Das Hauptziel ist das Ziel des Ernährungsprofils (`nutrition_goals.goal_type`), wie bisher mit
manuellen und automatischen Werten. Neu ist **„Allgemeine Fitness“** (`fitness`): Für Kalorien
und Makros wird es exakt wie „Gewicht halten“ berechnet; es ändert nur die Score-Gewichtung.
Maßgeblich ist das Ziel, das am letzten Tag des Zeitraums gilt. Ohne Ernährungsprofil wird wie bei
„Allgemeine Fitness“ gewichtet (Hinweis im Detail).

| Hauptziel          | Ernährung | Training | Aktivitäten | Regeneration |
| ------------------ | --------- | -------- | ----------- | ------------ |
| Abnehmen           | 45 %      | 25 %     | 20 %        | 10 %         |
| Muskelaufbau       | 30 %      | 45 %     | 10 %        | 15 %         |
| Gewicht halten     | 40 %      | 25 %     | 25 %        | 10 %         |
| Allgemeine Fitness | 30 %      | 30 %     | 25 %        | 15 %         |

**Gesamtscore** = gewichteter Mittelwert der **bewerteten** Bereiche, Gewichte über diese
Bereiche neu normiert, gerundet, begrenzt auf 0–100. Die Teilwerte werden vorher gerundet, damit
der Gesamtwert aus den angezeigten Zahlen nachrechenbar ist. Ein Bereich ohne Bewertung (`null`)
zählt nicht mit – er macht den Score weder besser noch schlechter.

Beispiel Abnehmen: Ernährung 100, Training 50, Aktivitäten 50, Regeneration 100 →
100·0,45 + 50·0,25 + 50·0,2 + 100·0,1 = **78**.

## Die vier Bereiche

### Ernährung

Bestehende Daten und Regeln: `DiaryService.dailyTotalsBetween` (Tage mit mindestens einem
Eintrag = Ernährungstage) und `GoalService.dayGoalsBetween` (Tagesziel wie im Tagebuch: manuell
vor automatisch, eigenes Protein-Ziel, BMI-27,5-Regel, Aktivitätskalorien **nur** bei
eingeschalteter Einstellung). Keine eigene Zielberechnung.

- **Kalorien je Tag (seit Phase 15 nach Hauptziel des Tages)** – eine Regel für Score und
  Fortschrittskarte (`calorieGoalScore`, `core/nutrition/goalAttainment.ts`), jeweils mit Hauptziel
  und Kalorienziel, die an diesem Tag galten:
  - **Abnehmen** – Obergrenze: bis zum Ziel 100; darüber linear bis 0 bei +25 % (+5 % → 80,
    +10 % → 60, +20 % → 20). Darunter weder Bonus noch Abzug.
  - **Muskelaufbau** – ab 95 % 100; darunter linear bis 0 bei 70 % (75 % → 20, 85 % → 60).
    Darüber weder Bonus noch Abzug.
  - **Gewicht halten** und **Allgemeine Fitness** (gleiche Formel): 95–105 % → 100; außerhalb
    stetig linear bis 0 bei 75 % bzw. 125 % (94 % → 95, 90 % → 75, 80 % → 25, 106 % → 95,
    110 % → 75, 120 % → 25). Kein Sprung an der Bereichsgrenze (korrigiert nach Phase 15).
  - Vorher (bis Phase 14.1): für alle Hauptziele ±5 % → 100, danach 2 Punkte je Prozent.
- **Protein je Tag:** ab 90 % des Ziels 100 Punkte, mehr ist nie ein Minus; darunter 2 Punkte je
  fehlendem Prozent (80 % → 80, 50 % → 20).
- **Tageswert:** 70 % Kalorien + 30 % Protein (nur was ein Ziel hat).
- **Zeitraum:** Mittelwert der Ernährungstage. Tage ohne Eintrag sind unbekannt, **nie 0
  Punkte** (4 von 7 Tagen erfasst → Mittel über 4 Tage).
- **Heute** läuft noch: Unter dem Ziel zu liegen wird heute nicht bewertet (sonst wäre jeder
  Vormittag „schlecht“); eine Überschreitung schon.

### Training

Pläne in Kalethra haben keinen Kalender (sie laufen zyklisch A → B → C). Grundlage ist deshalb
das Wochenziel **„Trainings pro Woche“** (Einstellungen → Ziele → Training, 1–7, Standard: kein
Ziel). Seit Phase 10 versioniert: Jeder Tag zählt mit dem Ziel, das an ihm galt.

- Soll im Zeitraum = Summe der Tagesziele ÷ 7 (3/Woche → 3 in 7 Tagen, ≈12,9 in 30 Tagen; Ziel
  4 für drei und 3 für vier Tage → 3,4). Tage ohne gültiges Ziel zählen nicht zum Soll.
- Teilwert = absolvierte Kalethra-Workouts ÷ Soll, **gedeckelt bei 100** – mehr Training bringt
  keinen Bonus.
- Tage ohne Training sind nie für sich ein Minus; ein markierter Ruhetag auch nicht.
- **Weniger als 7 Tage mit Ziel** (Zeitraum Heute oder ein Ziel, das erst seit Kurzem gilt): ein
  Workout an einem dieser Tage → 100, keins → nicht bewertet. So wird ein heute gesetztes Ziel nicht
  gegen eine ganze Woche gemessen.
- **Ohne Wochenziel:** neutral (nicht bewertet).
- Nur abgeschlossene **Kalethra-Workouts** (`WorkoutService.dailyStatsBetween`).
  Health-Connect-Aktivitäten und manuelle Aktivitäten zählen **nie** als Training.

### Aktivitäten

Seit dem Phase-14-Nachtrag bewertet der Bereich **zwei Signale**: aktive Minuten und Schritte
außerhalb getrackter Aktivitäten. Schritte sind **kein eigener Bereich**; das Gewicht von
„Aktivitäten“ (z. B. 20 % bei Abnehmen) ist unverändert.

**Signal 1 – aktive Minuten.** Wochenziel **„Aktive Minuten pro Woche“** (Einstellungen → Ziele → Aktivitäten, 60–300, Standard:
kein Ziel; Hinweis auf die WHO-Orientierung 150–300 Minuten). Versioniert wie das Trainingsziel.

- Minuten aus manuellen und Health-Connect-Aktivitäten mit den bestehenden Regeln aus Phase 8:
  ein manuelles Duplikat einer Health-Connect-Aktivität einmal, eine Einheit, die ein
  Kalethra-Workout ist, nicht noch einmal (`countableActivityMinutes`).
- Teilwert = Minuten ÷ (Summe der Tagesziele ÷ 7), **gedeckelt bei 100** – viel Aktivität allein ergibt
  keinen Höchstwert in den anderen Bereichen und keinen Bonus.
- **Ohne Ziel** oder **ohne jede Aktivität im Zeitraum** (nicht erfasst ≠ nicht aktiv): neutral.
- Unabhängig von „Aktivitätskalorien anrechnen“ – die Einstellung wirkt nur auf das Tagesziel
  der Ernährung, wie in der App überall. Seit Phase 12 ist sie versioniert: Der Ernährungsteil
  bewertet jeden Tag mit der Einstellung, die an diesem Tag galt; Umschalten ändert keinen
  vergangenen Score-Tag (`ScoreOptions` enthält nur noch `today`).
- Heute wird – unverändert seit Phase 9 – mit dem Tagesanteil des Wochenziels verglichen.

**Signal 2 – Schritte (Alltagsbewegung).** Schrittziel pro Tag (Einstellungen → Ziele →
Gesundheit, versioniert, keine neue Einstellung). Schritte kommen nur aus Health Connect.

- Je Tag mit Schrittziel **und** Schrittdaten: anrechenbare Schritte ÷ Tagesziel, gedeckelt bei
  100; Zeitraum = Mittelwert dieser Tage. Tage ohne Ziel oder ohne Daten sind neutral (nie 0
  Schritte).
- **Heute** läuft noch (dieselbe Regel wie bei Kalorien und Protein): unter dem Ziel wird heute
  nicht bewertet, erreicht = 100. 2.000 von 10.000 um 10 Uhr sind kein schlechter Tag.
- **Doppelzählung:** Schritte innerhalb getrackter Aktivitäten zählen über die Aktivität, nicht
  noch einmal als Alltagsbewegung (`countableStepsPerDay`, `core/activity/combined.ts`). Grundlage
  sind genau die anrechenbaren Aktivitäten der aktiven Minuten (`countableActivities` – eine
  Eligibility für beides). Überlappende Aktivitäten werden zu einem Intervall zusammengeführt
  (10:00–10:45 und 10:30–11:15 → 10:00–11:15, `mergeIntervals`). Ein Schritt-Datensatz fällt nur
  heraus, wenn er **vollständig** in einem solchen Intervall liegt; teilweise Überlappung bleibt
  (wie sich Schritte darin verteilen, ist unbekannt – es wird nichts geschätzt).
- **Datenqualität (Stand jetzt):** Health Connect wird in Tages-Buckets gelesen
  (`queryAggregated`, `bucket: 'day'`); gespeichert ist eine Tagessumme ohne Uhrzeit
  (`daily_activity.steps`). Importierte Einheiten tragen keine eigenen Schritte. Eine Tagessumme
  liegt nie vollständig in einer Aktivität – sie bleibt daher **voll anrechenbar**; es wird nie
  der ganze Tag oder ein geschätzter Anteil abgezogen. Aktivitäten ohne Uhrzeit (manuell ohne
  Startzeit) schließen ebenfalls nichts aus. Die Ausschlusslogik greift automatisch, sobald
  feinere Schritt-Intervalle vorliegen (siehe Grenzen).

**Kombination.** Beide Signale bewertet → Mittelwert (Minuten 80, Schritte 60 → 70, keine
Summe); nur eines → nur dieses; keines → Bereich neutral. Ohne Schrittziel oder Schrittdaten ist
das Ergebnis exakt wie vor dem Nachtrag.

### Regeneration

Eigene, subjektive Angabe des Nutzers unter **Gesundheit → Regeneration** („Wie erholt fühlst du
dich heute?“): Schlecht / Mittelmäßig / Gut erholt, dazu „Ruhetag“. Keine medizinische
Interpretation, kein Schlaf, keine HRV.

- Gut 100, Mittelmäßig 60, Schlecht 20; Zeitraum = Mittelwert der Tage mit Angabe.
- Ein Ruhetag ist nie ein Minus: Er zählt nur über die angegebene Erholung (Ruhetag + gut erholt
  = 100, Ruhetag + schlecht erholt = 20). Ein Ruhetag ohne Angabe wird nicht bewertet.
- Keine Angabe = nicht bewertet, nicht „schlecht erholt“.

## Fehlende Daten und „Vorläufig“

Fehlende Daten sind neutral: Ein Bereich ohne Daten oder ohne Ziel zählt nicht mit. Der Score
wird trotzdem angezeigt, sobald mindestens ein Bereich bewertet ist. Ganz ohne bewertbare Daten
steht „–“ mit „Noch keine Daten für diesen Zeitraum.“

**Vorläufig** (zentrale Regel `PRELIMINARY`), wenn

1. weniger als die Hälfte der Tage des Zeitraums einen eigenen Eintrag hat (Heute: 1 von 1,
   7 Tage: 4, 30 Tage: 15) – Eintrag = Essen, Workout, Aktivität oder Regeneration/Ruhetag, oder
2. weniger als zwei der vier Bereiche bewertet sind.

Anzeige: „Vorläufig“ als Textlabel + „Noch nicht alle Daten für diesen Zeitraum sind
vorhanden.“; im Detail steht die Regel mit „Bisher: x von y Tagen“.

## Zeiträume und Tendenz

Dieselben rollierenden Zeiträume wie die Fortschrittskarten (`periodRange`), neu mit **Heute**:
Heute (1 Tag), 7 Tage, 30 Tage. Der Umschalter gilt für Score und Karten.

Tendenz = Score des Zeitraums gegen den unmittelbar vorhergehenden gleich langen Zeitraum
(`previousPeriodRange`: gestern / die 7 Tage davor / die 30 Tage davor):

- |Differenz| < **3 Punkte** → „Ungefähr gleich“ (keine hektischen Richtungswechsel),
- sonst „Gestiegen“ / „Gesunken“ mit Punktzahl (seit dem Phase-14-Nachtrag neutral formuliert,
  vorher „Verbessert“ / „Verschlechtert“; Berechnung unverändert; Englisch „Increased“ /
  „Decreased“ / „About the same“),
- „Noch keine ausreichenden Vergleichsdaten“, wenn der Vorzeitraum keinen Score hat oder weniger
  dokumentierte Tage als ein nicht vorläufiger Score bräuchte.

Richtung immer als Pfeil **und** Text, nie nur über Farbe.

## Stufen (Wortlaut)

≥ 85 „Sehr gut unterwegs“ · ≥ 70 „Auf gutem Weg“ · ≥ 50 „Teilweise auf Kurs“ · darunter „Noch
Luft nach oben“. Keine Ampelfarben, keine Wertung der Person.

## Daten

- `recovery_entries` (Migration 13): `id`, `profile_id`, `local_date` (eindeutig je Profil),
  `state` (`poor` | `moderate` | `good` | NULL), `rest_day`, `created_at`, `updated_at`; ein
  leerer Eintrag ist per `CHECK` unmöglich (beides leer → Eintrag wird gelöscht). Lokal,
  verschlüsselt, Kategorie Gesundheit, mit dem Profil gelöscht, nicht synchronisiert.
- `nutrition_goals.goal_type` erlaubt zusätzlich `fitness` (Migration 13 baut die Tabelle neu, weil
  SQLite `CHECK`-Bedingungen nicht ändern kann; alle Zeilen werden unverändert kopiert).
- Wochenziele in `goal_targets` (Migration 14, versioniert mit `effective_from`, `NULL` = kein
  Ziel); bis Phase 9 unversioniert in `app_settings`, bei der Migration ab `1970-01-01` übernommen.
  Das Schrittziel liegt in derselben Tabelle und fließt seit dem Phase-14-Nachtrag als zweites
  Signal in den Bereich **Aktivitäten** ein (kein eigener Bereich)
  ([SETTINGS.md](SETTINGS.md)).

## Fortschrittskarten (Phase 14)

Die Karten auf „Fortschritt“ zeigen Ist gegen Ziel ([PROGRESS.md](PROGRESS.md#zielerreichung-phase-14))
mit denselben Quellen, derselben Soll-Berechnung und denselben Schwellen wie der Score. Der Score
selbst ist dadurch **nicht** verändert: keine neuen Bereiche, keine neue Gewichtung. (Die Karte
zeigt die tatsächlichen Schritte; der Score nutzt seit dem Nachtrag die Schritte außerhalb
getrackter Aktivitäten innerhalb von „Aktivitäten“.)

## Grenzen

- Schritte gibt es nur als Tagessumme: Die Herausnahme von Schritten innerhalb getrackter
  Aktivitäten wirkt erst mit feineren Daten (Health Connect könnte stündliche Buckets liefern;
  das bräuchte eine Import- und Schemaänderung und ist nicht umgesetzt).
- Schritte zählen nicht als „eigener Eintrag“ für die Vorläufig-Regel (importiert, wie bisher).

- Regeneration nur für heute eintragbar (kein Nachtragen vergangener Tage in dieser Phase).
- Kein Schlaf, keine HRV, keine Wearable-Recovery-Werte (Health Connect später möglich).
