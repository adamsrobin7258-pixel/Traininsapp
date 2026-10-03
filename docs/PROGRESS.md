# Fortschritt – die Mainpage (Phase 7 / 7.1, Zielerreichung seit Phase 14)

Seit Phase 7.1 ist **„Fortschritt“** die Startseite und der erste Tab (Route `/`, Modul
`modules/progress`). Die frühere Tagesübersicht „Heute“ ist vollständig entfernt: keine
Tages-Ernährung, kein Trainingsstatus, keine Mahlzeitenliste, keine Tages-Gesundheitswerte.
Tageswerte stehen in ihren Bereichen (Ernährungstagebuch, Training, Gesundheit, Training →
Aktivitäten). Die Seite speichert nichts und hat keine Eingaben – einzige Bedienung ist der
Zeitraum. Über dem Titel steht klein die Begrüßung (mit dem Namen aus dem Profil).

## Zeitraum

**Heute** = der aktuelle Tag (seit Phase 9), **7 Tage** (Standard) = die letzten 7 Tage
einschließlich heute, **30 Tage** = die letzten 30 Tage. Ganz oben steht der Kalethra-Score des
gewählten Zeitraums ([SCORE.md](SCORE.md)); er ist neben der Zeitraumwahl das einzige
Bedienelement (öffnet die Erklärung).
Bewusst gleitend statt Kalenderwoche/-monat, damit Montag oder der Monatserste nicht fast leer
sind. Der Zeitraum steht sichtbar unter der Auswahl („27.09. – 03.10.“).

## Die fünf Bereiche (feste Reihenfolge)

Jeder Bereich ist eine eigene Karte; die ganze Karte ist ein Link (mindestens 44 px hoch). Seit
Phase 14 zeigt jede Karte neben dem erfassten Wert das Ziel aus den Einstellungen (siehe
[Zielerreichung](#zielerreichung-phase-14)). Reihenfolge: Training, Ernährung, Gewicht,
Aktivitäten, Schritte (die Schrittkarte ist neu und steht am Ende, damit die bisherige
Reihenfolge bleibt).

| Bereich     | Werte                                                                                          | Diagramm (nur mit genug Daten)                         | Öffnet                 | Quelle                                                              |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------- |
| Training    | abgeschlossene **Kalethra**-Einheiten, Ø pro Woche, Volumen (kg)                               | Trainingstage als Balken                               | Training               | `WorkoutService.dailyStatsBetween` (SQL-Aggregation)                |
| Ernährung   | Ø kcal und Ø Protein pro erfasstem Tag, Ø Tagesziel derselben Tage, „an x von y Tagen erfasst“ | kcal pro Tag, gestrichelte Linie = Ø Ziel (ab 2 Tagen) | Ernährung              | `DiaryService.dailyTotalsBetween`, `GoalService.dayGoalsBetween`    |
| Gewicht     | aktueller Wert, Veränderung im Zeitraum                                                        | Linie (ab 2 Werten im Zeitraum)                        | Gesundheit             | eigene Einträge + Health-Connect-Werte, eigener Eintrag hat Vorrang |
| Aktivitäten | Anzahl, Gesamtdauer, aktive kcal (Health Connect + manuell)                                    | aktive Minuten pro Tag (ab 3 Tagen)                    | Training → Aktivitäten | `workoutsBetween` + `ManualActivityService.listBetween`             |
| Schritte    | Schritte gegen Schrittziel, Ø über Tage mit Daten, „an x von y Tagen mit Daten“                | –                                                      | Gesundheit             | `HealthSyncService.activityBetween` (nur Health Connect)            |

Regeln:

- **Keine erfundenen Nullen.** Tage ohne Ernährungseintrag zählen nicht in Durchschnitte und
  erscheinen im Diagramm als Lücke; ohne Werte zeigt jeder Bereich einen kleinen Hinweis
  („Noch keine Trainingsdaten.“ usw.).
- **Aktivitäten** erscheinen nur, wenn Health Connect verbunden ist, Aktivitäten (importiert
  oder manuell) im Zeitraum vorhanden sind oder ein Aktivitätsziel gilt (seit Phase 14); sonst
  entfällt die Karte.
- **Schritte** erscheinen nur, wenn Health Connect verbunden ist oder importierte Schritte im
  Zeitraum vorhanden sind (iOS und Browser haben keine Schrittquelle). Eine manuelle Aktivität,
  die dieselbe Einheit wie eine Health-Connect-Aktivität ist, zählt einmal; eine Einheit, die ein
  Kalethra-Training ist, zählt dort nicht (seit Phase 12, wie im Score)
  ([ACTIVITIES.md](ACTIVITIES.md)).
- **Getrennt:** Health-Connect- und manuelle Aktivitäten zählen nie als Kalethra-Training, nie zum
  Trainingsvolumen oder zur Häufigkeit.
- **Aktivitätskalorien** fließen in das Ø Tagesziel nur an Tagen ein, an denen „Aktivitätskalorien
  anrechnen“ an war (seit Phase 12 versioniert) – genau wie im Ernährungstagebuch
  (`withActivityCalories`). Gespeichertes Basisziel und
  Protein (auch ein individuelles Protein-Ziel) bleiben unverändert.
- **Gewicht:** Importierte Werte erscheinen nur zur Ansicht („Wert aus Health Connect“, wenn der
  aktuelle Wert importiert ist). Ernährungsziele lesen weiterhin nur die eigenen Einträge.
- **Keine Wertung:** keine Ampelfarben, keine Erfolgs- oder Tadelsätze. Diagramme sind
  einfarbig (Akzentfarbe), haben eine Textbeschreibung (`role="img"`, `aria-label`) und
  Start-/Enddatum; nichts wird nur über Farbe vermittelt; keine Animationen.

## Zielerreichung (Phase 14)

Produktprinzip: **Einstellungen definieren Ziele. Tracking-Bereiche erfassen tatsächliche Werte.
Fortschritt vergleicht beides.** Es gibt keine zweite Ziel- oder Berechnungslogik: Fortschritt und
Score lesen dieselben Funktionen derselben Services (gemeinsames Objekt `shared` in
`app/services.ts`).

### Welche Ziele, welche Quellen

| Karte       | Ziel (Einstellungen → Ziele)                                                                                                                   | Ist-Wert                                                                                                                                                           | Anzeige (Beispiel)                                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Training    | Trainings pro Woche (`goal_targets`, versioniert)                                                                                              | nur abgeschlossene **Kalethra**-Workouts (`dailyStatsBetween`); Health Connect und manuelle Aktivitäten zählen nie                                                 | „3 von 4 Einheiten · 75 %“, „Ziel: 4 pro Woche“                                                                                             |
| Ernährung   | Tagesziel aus `GoalService.dayGoalsBetween` (manuell vor automatisch, eigenes Protein-Ziel, Aktivitätskalorien nur an Tagen mit Schalter „an“) | Tage mit mindestens einem Eintrag (`dailyTotalsBetween`)                                                                                                           | „Ø 2.140 von 2.200 kcal“, „Kalorienlimit eingehalten an 4 von 5 Tagen“, „Ø 142 von 160 g Protein · 89 %“                                    |
| Gewicht     | **kein Ziel** (kein Zielgewicht, keine Prozentzahl)                                                                                            | Gewichtsregel 2: eigener Eintrag vor Health Connect                                                                                                                | „91,8 kg · −1,2 kg in 30 Tagen“, „93,0 kg → 91,8 kg“                                                                                        |
| Aktivitäten | Aktive Minuten pro Woche (versioniert)                                                                                                         | `countableActivityMinutes` – dieselbe Funktion wie der Score: manuell + Health Connect, ein manuelles Duplikat einmal, keine Einheit, die ein Kalethra-Workout ist | „135 von 180 aktiven Min. · 75 %“                                                                                                           |
| Schritte    | Schrittziel pro Tag (versioniert)                                                                                                              | nur Health Connect (`daily_activity.steps`), keine manuelle Quelle                                                                                                 | Heute „7.842 von 10.000 Schritten“; 7/30 Tage „Ø 8.420 von 10.000 Schritten“, „An 5 von 7 Tagen mit Daten · Ziel an 3 von 5 Tagen erreicht“ |

### Zentrale Berechnungen

| Datei                                  | Inhalt                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/targets/targets.ts`              | `weeklyExpectation` – Wochenziel über den Zeitraum verteilt (Σ Tagesziele ÷ 7), vorher privat im Score, jetzt von beiden genutzt               |
| `core/nutrition/goalAttainment.ts`     | `calorieGoalStatus`, `proteinGoalStatus`, `KCAL_GOAL_TOLERANCE` (5 %), `PROTEIN_GOAL_REACHED` (90 %) – die Score-Konfiguration verweist darauf |
| `core/health/steps.ts`                 | `summarizeStepGoal` (erweitert um Ø Schritte, Tage mit Daten, Ø Ziel)                                                                          |
| `core/progress/goalProgress.ts`        | rein: `attainment` (Ist/Ziel, Balken max. 100 %), Training, Aktivitäten, Ernährung, Schritte                                                   |
| `core/progress/progressGoalService.ts` | `ProgressGoalService` liest `ProgressSources` und liefert der Seite fertige Werte; `useProgressGoals` rechnet bei jeder Änderung neu           |

Die Oberfläche (`modules/progress`) rechnet nichts: kein `Ist ÷ Ziel` in Komponenten, keine
eigenen Datenbankzugriffe mehr pro Karte – nur noch ein Hook (`useProgressGoals`).

### Kalorien je Hauptziel

Nicht überall „Ist ÷ Ziel“ – das Hauptziel des jeweiligen Tages entscheidet:

- **Abnehmen:** Das Kalorienziel ist eine **Obergrenze**. Bis einschließlich Ziel = eingehalten,
  darüber = über dem Limit (2.100 und 2.200 von 2.200 → eingehalten, 2.500 → darüber).
- **Muskelaufbau:** Zielgröße, die erreicht werden soll: ab 95 % erreicht, mehr ist kein Minus.
- **Gewicht halten** und **Allgemeine Fitness** (wird exakt wie „Halten“ berechnet): Zielbereich
  ±5 %.

Seit Phase 15 vergibt der Score die Kalorienpunkte nach genau diesen Grenzen
(`calorieGoalScore` neben `calorieGoalStatus` in `core/nutrition/goalAttainment.ts`; ein Test prüft,
dass „im Ziel“ auf der Karte und 100 Punkte im Score an jeder Grenze übereinstimmen) – Details und
Punktverläufe in [SCORE.md](SCORE.md#ernährung). Protein gilt wie im Score ab 90 % als erreicht.
Für Kalorien gibt es bewusst keinen Balken (bei einer Obergrenze wäre „voll“ missverständlich), nur
Wert und Status.

### Protein, Kohlenhydrate und Fett (Phase 15)

„Ø 142 von 160 g Protein · 89 %“, „Ø 180 von 250 g Kohlenhydraten · 72 %“, „Ø 65 von 80 g Fett ·
81 %“: Ø der erfassten Tage, die ein Ziel haben, gegen das Ø Ziel derselben Tage, je Tag die
damals gültige Zielversion. Eine Funktion für alle drei (`nutrientAttainment`, baut auf
`goalProgress` des Tagebuchs auf): Prozent und Balken höchstens 100 %, der echte Wert bleibt
sichtbar. Ohne Ziel oder ohne erfassten Tag erscheint die Zeile nicht (nie „0 g“). Kohlenhydrate
und Fett sind reine Information – kein Score-Bereich, kein Einfluss auf Kalorienpunkte oder
Gewichtung. (Bis Phase 14.1 zeigte die Protein-Zeile auch Werte über 100 %.)

### Fehlende Daten

- **Ernährung:** Nur erfasste Tage zählen (Ø und „an x von y Tagen“); ein Tag ohne Eintrag ist nie
  0 kcal. **Heute** läuft noch: unter dem Ziel ist heute „noch offen“, nicht verfehlt (wie im
  Score); eine Überschreitung zählt schon.
- **Schritte:** Ein Tag ohne Schrittdaten ist weder 0 Schritte noch verfehlt. Ø und Zielvergleich
  nur über Tage mit Daten (und für den Vergleich: Tage, an denen ein Ziel galt); die Karte sagt,
  auf wie vielen Tagen das beruht. Ohne Daten: „Noch keine Schrittdaten (für heute).“
- **Aktivitäten:** Ein Ziel ohne jede Aktivität im Zeitraum ist neutral (nicht erfasst ≠ nicht
  aktiv) – kein „0 von 180“, wie im Score.
- **Training:** Workouts werden immer in Kalethra erfasst; „0 von 4“ über eine volle Woche ist
  deshalb eine Tatsache. **Heute** (oder wenn ein Ziel erst seit weniger als 7 Tagen gilt) gibt es
  wie im Score keinen fairen Wochenvergleich: kein Prozentwert, kein Balken, nur Anzahl und
  „Ziel: 4 pro Woche“ – kein künstliches „0 %“.

### Historische Zielversionen

Alle Ziele sind versioniert (`goal_targets` bzw. `nutrition_goals`, Phase 10/12): Jeder Tag wird
mit der Version bewertet, die an ihm galt. Beispiel: Montag „3 pro Woche“, ab Donnerstag „4 pro
Woche“ → Soll der Woche = 4 × 3/7 + 3 × 4/7 = 3,4, nicht 4. Gilt ein Ziel erst seit einigen Tagen,
zählen nur diese Tage, und die Karte zeigt „gilt seit TT.MM.“. Ernährung: Tagesziel und Hauptziel
je Tag (ein Wechsel von Abnehmen zu Muskelaufbau bewertet frühere Tage weiter als Obergrenze).
Die Wortwahl der Kalorienzeile richtet sich nach dem Hauptziel am letzten Tag des Zeitraums.

### Abgrenzung

- **Score unverändert:** keine neuen Bereiche, keine neue Gewichtung, keine geänderte Formel.
  Beide nutzen dieselben Basisdaten und dieselbe Soll-Berechnung, deshalb stimmen „3 von 4“ auf
  der Karte und „3 von 4 geplanten Einheiten“ in der Score-Erklärung immer überein.
- **Schritte im Score:** seit dem Phase-14-Nachtrag ein zweites Signal **innerhalb** von
  „Aktivitäten“ (Schritte außerhalb getrackter Aktivitäten, kein eigener Bereich, Gewicht
  unverändert, [SCORE.md](SCORE.md#aktivitäten)). Die Schrittkarte zeigt weiter die
  tatsächlichen Schritte.
- **Gewicht hat keine Zielgewichtsberechnung**; das Wunschgewicht aus dem Ernährungsprofil wird
  hier nicht verwendet. Die drei Gewichtsregeln bleiben getrennt (`weightRules.ts`).
- **Keine Wertung:** keine Medaillen, Streaks, Vergleiche oder Wörter wie „gut/schlecht“; der
  Balken ist dezent, einfarbig, maximal 100 % breit („5 von 4 Einheiten · 125 %“), rein dekorativ
  (`aria-hidden`), alle Informationen stehen im Text. Keine Animation.

### Mögliche spätere Erweiterungen (nicht umgesetzt)

- Schrittkarte mit Tagesbalken wie bei den Aktivitäten (erst bei konkretem Bedarf).
- Hinweis auf der Karte, wenn sich das Hauptziel innerhalb des Zeitraums geändert hat.
- Direkter Sprung von „Kein …ziel festgelegt“ zu Einstellungen → Ziele (die Karte führt bewusst
  weiter in ihren Bereich).

## Daten und Leistung

Keine eigenen Tabellen, nichts wird doppelt gespeichert. Pro Zeitraum laufen wenige aggregierte
Abfragen (Training und Ernährung per `GROUP BY local_date`, Ziele einmal für den Zeitraum,
Aktivitätskalorien in einer Bereichsabfrage). Seit Phase 14 lädt ein einziger Aufruf
(`ProgressGoalService.calculate`) alle Karten parallel. Die Auswertung ist rein und getestet:
`core/training/progress.ts`, `core/nutrition/progress.ts`, `core/health/progress.ts`,
`core/progress/goalProgress.ts`, `modules/progress/domain/period.ts`.

## Verlauf

- Phase 7: „Heute“ mit Tagesteil oben und „Dein Fortschritt“ darunter.
- Phase 7.1: Tagesteil entfernt (doppelt zu den Bereichen); „Fortschritt“ ist die Mainpage mit
  eigenem Tab-Symbol. Dabei entfallen: Tages-Ernährungskarte (inkl. Aufschlüsselung der
  Aktivitätskalorien – sie steht im Ernährungstagebuch), Tagestraining mit „Training
  fortsetzen“ (läuft ein Training, zeigt es der Trainingsbereich), Aktivitäten und Gesundheit
  von heute, Datumszeile über dem Titel.
- Phase 14: Zielerreichung (Ist gegen Ziel) auf allen Karten, neue Schrittkarte, zentraler
  `ProgressGoalService`; die Zeiträume Heute / 7 / 30 Tage bleiben unverändert.
