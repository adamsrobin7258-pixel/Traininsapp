# Heute (Phase 7)

„Heute“ ist die zentrale tägliche Übersicht. Sie beantwortet zuerst **„Was ist heute für mich
relevant?“** und zeigt darunter kompakt **„Dein Fortschritt“**. Die Detailbereiche (Training,
Ernährung, Gesundheit, Aktivitäten) bleiben unverändert bestehen; „Heute“ fasst nur zusammen,
speichert nichts und hat keine Eingaben (einzige Bedienung: der Zeitraum „Woche / Monat“).

## Bereich „Heute“ (Reihenfolge = Priorität)

| Teil              | Inhalt                                                                                                                                                                                                          | Wann sichtbar                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Ernährung         | Gegessene kcal (große Zahl), Tagesziel und Rest, Aktivitätskalorien (angerechnet: „Basisziel … · Aktivitätskalorien +…“, sonst „… · Nicht auf das Tagesziel angerechnet“), Protein/Kohlenhydrate/Fett, Wasser   | immer                                   |
| Training          | Laufendes Training mit „x von y Übungen abgeschlossen“ und „Training fortsetzen“; sonst heute abgeschlossene Trainings; sonst „Heute noch kein Training“ + nächster Plan-Tag bzw. „Heute kein Training geplant“ | immer (kompakt)                         |
| Aktivitäten heute | Health-Connect-Aktivitäten des Tages: „Laufen · 42 min“ bzw. „3 Aktivitäten · 1 h 24 min“, aktive kcal                                                                                                          | nur wenn heute Aktivitäten vorliegen    |
| Gesundheit heute  | Schritte, aktive kcal, Gewicht des Tages (eigener Eintrag vor importiertem)                                                                                                                                     | nur mit Health-Connect-Werten von heute |

Jede Karte öffnet ihren Bereich; ein laufendes Training öffnet direkt das Training.

## „Dein Fortschritt“

Zeitraum: **Woche** (Standard) = die letzten 7 Tage einschließlich heute, **Monat** = die
letzten 30 Tage. Bewusst gleitend statt Kalenderwoche/-monat, damit Montag oder der Monatserste
nicht fast leer sind. Der Zeitraum steht sichtbar daneben („27.09. – 03.10.“).

| Bereich     | Werte                                                                                          | Diagramm (nur mit genug Daten)                         | Quelle                                                              |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Training    | abgeschlossene **Kalethra**-Einheiten, Ø pro Woche, Volumen (kg)                               | Trainingstage als Balken                               | `WorkoutService.dailyStatsBetween` (SQL-Aggregation)                |
| Ernährung   | Ø kcal und Ø Protein pro erfasstem Tag, Ø Tagesziel derselben Tage, „an x von y Tagen erfasst“ | kcal pro Tag, gestrichelte Linie = Ø Ziel (ab 2 Tagen) | `DiaryService.dailyTotalsBetween`, `GoalService.dayGoalsBetween`    |
| Gewicht     | aktueller Wert, Veränderung im Zeitraum                                                        | Linie (ab 2 Werten im Zeitraum)                        | eigene Einträge + Health-Connect-Werte, eigener Eintrag hat Vorrang |
| Aktivitäten | Anzahl, Gesamtdauer, aktive kcal (Health Connect)                                              | aktive Minuten pro Tag (ab 3 Tagen)                    | `HealthSyncService.workoutsBetween`                                 |

Regeln:

- **Keine erfundenen Nullen.** Tage ohne Ernährungseintrag zählen nicht in Durchschnitte und
  erscheinen im Diagramm als Lücke; ohne Werte zeigt jeder Bereich einen kleinen Hinweis
  („Noch keine Trainingsdaten.“ usw.). Ohne Health Connect entfällt die Aktivitätenzeile.
- **Getrennt:** Health-Connect-Aktivitäten zählen nie als Kalethra-Training, nie zum
  Trainingsvolumen oder zur Häufigkeit.
- **Aktivitätskalorien** fließen in das Ø Tagesziel nur ein, wenn „Aktivitätskalorien anrechnen“
  an ist – genau wie in der Tagesansicht (`withActivityCalories`). Das gespeicherte Basisziel und
  Protein bleiben unverändert.
- **Gewicht:** Importierte Werte erscheinen hier nur zur Ansicht (mit Hinweis „Wert aus Health
  Connect“, wenn der aktuelle Wert importiert ist). Ernährungsziele lesen weiterhin nur die
  eigenen Gewichtseinträge.
- **Keine Wertung:** keine Ampelfarben, keine Erfolgs- oder Tadelsätze. Diagramme sind
  einfarbig (Akzentfarbe), haben eine Textbeschreibung (`role="img"`, `aria-label`) und
  Start-/Enddatum; nichts wird nur über Farbe vermittelt; keine Animationen.

## Daten und Leistung

Keine neuen Tabellen, nichts wird doppelt gespeichert. Pro Zeitraum laufen wenige aggregierte
Abfragen (Training und Ernährung per `GROUP BY local_date`, Ziele einmal für den Zeitraum,
Aktivitätskalorien in einer Bereichsabfrage). Die Auswertung ist rein und getestet:
`core/training/progress.ts`, `core/nutrition/progress.ts`, `core/health/progress.ts`,
`modules/dashboard/domain/period.ts`.

## Entfernte Doppelungen (Phase 7)

- Liste der Mahlzeiten des Tages – steht vollständig im Ernährungstagebuch.
- Letztes Training und Zähler „Letzte 7/30 Tage“ – Verlauf im Training, Häufigkeit in „Dein
  Fortschritt“.
- Gewichtskarte mit 3-Monats-Verlauf – ersetzt durch die Gewichtszeile in „Dein Fortschritt“
  (Woche/Monat); der volle Verlauf bleibt unter „Gesundheit“.
