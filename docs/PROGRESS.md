# Fortschritt – die Mainpage (Phase 7 / 7.1)

Seit Phase 7.1 ist **„Fortschritt“** die Startseite und der erste Tab (Route `/`, Modul
`modules/progress`). Die frühere Tagesübersicht „Heute“ ist vollständig entfernt: keine
Tages-Ernährung, kein Trainingsstatus, keine Mahlzeitenliste, keine Tages-Gesundheitswerte.
Tageswerte stehen in ihren Bereichen (Ernährungstagebuch, Training, Gesundheit, Training →
Aktivitäten). Die Seite speichert nichts und hat keine Eingaben – einzige Bedienung ist der
Zeitraum. Über dem Titel steht klein die Begrüßung (mit dem Namen aus dem Profil).

## Zeitraum

**Woche** (Standard) = die letzten 7 Tage einschließlich heute, **Monat** = die letzten 30 Tage.
Bewusst gleitend statt Kalenderwoche/-monat, damit Montag oder der Monatserste nicht fast leer
sind. Der Zeitraum steht sichtbar unter der Auswahl („27.09. – 03.10.“).

## Die vier Bereiche (feste Reihenfolge)

Jeder Bereich ist eine eigene Karte; die ganze Karte ist ein Link (mindestens 44 px hoch).

| Bereich     | Werte                                                                                          | Diagramm (nur mit genug Daten)                         | Öffnet                 | Quelle                                                              |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------- |
| Training    | abgeschlossene **Kalethra**-Einheiten, Ø pro Woche, Volumen (kg)                               | Trainingstage als Balken                               | Training               | `WorkoutService.dailyStatsBetween` (SQL-Aggregation)                |
| Ernährung   | Ø kcal und Ø Protein pro erfasstem Tag, Ø Tagesziel derselben Tage, „an x von y Tagen erfasst“ | kcal pro Tag, gestrichelte Linie = Ø Ziel (ab 2 Tagen) | Ernährung              | `DiaryService.dailyTotalsBetween`, `GoalService.dayGoalsBetween`    |
| Gewicht     | aktueller Wert, Veränderung im Zeitraum                                                        | Linie (ab 2 Werten im Zeitraum)                        | Gesundheit             | eigene Einträge + Health-Connect-Werte, eigener Eintrag hat Vorrang |
| Aktivitäten | Anzahl, Gesamtdauer, aktive kcal (Health Connect)                                              | aktive Minuten pro Tag (ab 3 Tagen)                    | Training → Aktivitäten | `HealthSyncService.workoutsBetween`                                 |

Regeln:

- **Keine erfundenen Nullen.** Tage ohne Ernährungseintrag zählen nicht in Durchschnitte und
  erscheinen im Diagramm als Lücke; ohne Werte zeigt jeder Bereich einen kleinen Hinweis
  („Noch keine Trainingsdaten.“ usw.).
- **Aktivitäten** erscheinen nur, wenn Health Connect verbunden ist oder importierte Aktivitäten
  vorhanden sind; sonst entfällt die Karte.
- **Getrennt:** Health-Connect-Aktivitäten zählen nie als Kalethra-Training, nie zum
  Trainingsvolumen oder zur Häufigkeit.
- **Aktivitätskalorien** fließen in das Ø Tagesziel nur ein, wenn „Aktivitätskalorien anrechnen“
  an ist – genau wie im Ernährungstagebuch (`withActivityCalories`). Gespeichertes Basisziel und
  Protein (auch ein individuelles Protein-Ziel) bleiben unverändert.
- **Gewicht:** Importierte Werte erscheinen nur zur Ansicht („Wert aus Health Connect“, wenn der
  aktuelle Wert importiert ist). Ernährungsziele lesen weiterhin nur die eigenen Einträge.
- **Keine Wertung:** keine Ampelfarben, keine Erfolgs- oder Tadelsätze. Diagramme sind
  einfarbig (Akzentfarbe), haben eine Textbeschreibung (`role="img"`, `aria-label`) und
  Start-/Enddatum; nichts wird nur über Farbe vermittelt; keine Animationen.

## Daten und Leistung

Keine eigenen Tabellen, nichts wird doppelt gespeichert. Pro Zeitraum laufen wenige aggregierte
Abfragen (Training und Ernährung per `GROUP BY local_date`, Ziele einmal für den Zeitraum,
Aktivitätskalorien in einer Bereichsabfrage). Die Auswertung ist rein und getestet:
`core/training/progress.ts`, `core/nutrition/progress.ts`, `core/health/progress.ts`,
`modules/progress/domain/period.ts`.

## Verlauf

- Phase 7: „Heute“ mit Tagesteil oben und „Dein Fortschritt“ darunter.
- Phase 7.1: Tagesteil entfernt (doppelt zu den Bereichen); „Fortschritt“ ist die Mainpage mit
  eigenem Tab-Symbol. Dabei entfallen: Tages-Ernährungskarte (inkl. Aufschlüsselung der
  Aktivitätskalorien – sie steht im Ernährungstagebuch), Tagestraining mit „Training
  fortsetzen“ (läuft ein Training, zeigt es der Trainingsbereich), Aktivitäten und Gesundheit
  von heute, Datumszeile über dem Titel.
