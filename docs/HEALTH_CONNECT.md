# Health Connect (Phase 6.2 / 6.3 / 30)

Kalethra liest auf Android ausgewählte Gesundheitsdaten aus Health Connect: Gewicht, Schritte,
aktive Kalorien (Phase 6.2) und Aktivitäten mit Dauer, aktiven Kalorien und Distanz (Phase 6.3).
Seit Phase 30 kann es – optional, standardmäßig aus – eigene Trainings und Aktivitäten als
Trainingseinheiten **nach** Health Connect übertragen ([Übertragen](#übertragen-kalethra--health-connect-phase-30-erweitert-in-phase-31)).
Apple Health folgt in einer eigenen Phase.

## Grundsätze

| Regel                          | Umsetzung                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standardmäßig aus              | Erst „Profil → Gesundheitsdaten → Mit Health Connect verbinden“ öffnet – nach Kalethras eigener Erklärung – den Berechtigungsdialog.                                       |
| Nur lesen                      | Fünf Leserechte: `READ_WEIGHT`, `READ_STEPS`, `READ_ACTIVE_CALORIES_BURNED`, `READ_EXERCISE`, `READ_DISTANCE`. Keine Schreib-, Verlaufs- oder Hintergrundrechte.           |
| Nur lokal                      | Importierte Werte liegen in der verschlüsselten Datenbank (`imported_weights`, `daily_activity`, `external_workouts`). Keine Netzwerkverbindung, kein Server, keine Cloud. |
| Getrennt von eigenen Daten     | `weight_entries` wird durch einen Import nie verändert. Die Ernährungsziele folgen weiter nur den eigenen Gewichtseinträgen (per Test geprüft).                            |
| Eigene Werte haben Vorrang     | Gibt es für einen Tag ein eigenes Gewicht und einen Import, gilt das eigene (`dayWeight`, Regel 2 in `weightRules.ts`). Ein Import überschreibt nie einen manuellen Wert.  |
| Mehrere Messungen an einem Tag | Die zeitlich früheste gültige Messung des lokalen Tages wird gespeichert (08:02 92,4 kg, 12:30 92,8 kg → 92,4 kg).                                                         |
| Schritte und aktive Kalorien   | Tageswerte über die Health-Connect-Aggregation (`queryAggregated`, Tages-Buckets in Gerätezeit). Health Connect entfernt dabei Doppelungen mehrerer Quellen. Nur Anzeige.  |

## Aktivitäten (Phase 6.3)

- Gelesen werden alle Trainingseinheiten (`ExerciseSessionRecord`) der letzten 30 Tage über
  `queryWorkouts` – jeder Typ, auch unbekannte. Gespeichert in `external_workouts`
  (Migration 11), eindeutig je Profil, Plattform und Health-Connect-Record-ID.
- Pro Aktivität: Typ (wie geliefert), Kategorie (Kraft, Ausdauer, Hybrid, Beweglichkeit, Sport,
  Sonstige), Start, Ende, lokaler Tag, Dauer, aktive Kalorien, Distanz, Quelle. Fehlende Werte
  bleiben `NULL` – nie eine erfundene 0. Schritte je Aktivität liefert das Plugin nicht; die Spalte
  bleibt leer.
- Warum `READ_DISTANCE`: Das Plugin fragt aktive Kalorien und Distanz einer Einheit in **einer**
  Health-Connect-Aggregation ab. Fehlt eine der beiden Berechtigungen, liefert sie keins von
  beiden. Ohne `READ_DISTANCE` gäbe es also auch keine Kalorien pro Aktivität.
- Plausibilität: Ende nach Start, höchstens 24 h, nicht in der Zukunft, Start im 30-Tage-Fenster;
  Kalorien 0–10 000, Distanz 0–1 000 km (sonst wird nur der Wert verworfen, nicht die Einheit).
  Eigene Einträge von Kalethra (`com.kalethra.app`) werden übersprungen.
- Anzeige: „Training → Aktivitäten“, chronologisch (neueste zuerst), z. B. „Laufen / Heute · 18:20
  / 42 min · 5,8 km · 386 kcal“; Details mit Aktivität, Datum, Start, Dauer, aktiven Kalorien,
  Distanz, Quelle („Health Connect · Gerät oder App“). Bekannte Typen sind übersetzt (de/en),
  unbekannte werden mit ihrem eigenen Namen lesbar gezeigt („frisbeeDisc“ → „Frisbee disc“) und
  nie einer anderen Sportart zugeordnet.
- Strikt getrennt: Aktivitäten sind keine Kalethra-Trainings, erscheinen nicht im Verlauf, in
  Plänen oder bei „Nächstes Training“.
- Seit Phase 8 stehen in derselben Liste auch **manuell erfasste** Aktivitäten (Quelle „Manuell
  erfasst“). Health-Connect-Aktivitäten bleiben dort schreibgeschützt. Erfasst der Nutzer eine
  Einheit, die auch Health Connect kennt, hat **Health Connect Vorrang** – Regel in
  [ACTIVITIES.md](ACTIVITIES.md#health-connect-hat-vorrang-duplikate).

## Aktivitätskalorien anrechnen

Einstellung unter „Einstellungen → Ziele → Aktivitätskalorien“ (bis Phase 9 unter Profil →
Gesundheitsdaten), **standardmäßig aus**. Seit Phase 12 versioniert in `goal_targets` (Art
`activityCalories`, Migration 15): Umschalten gilt ab heute, vergangene Tage behalten die
Einstellung, die damals galt ([SETTINGS.md](SETTINGS.md)).

- Aus: Das Tagesziel bleibt unverändert; die Aktivitätskalorien werden nur als Information gezeigt
  („Aktivitätskalorien 500 kcal / Nicht auf das Tagesziel angerechnet“).
- Texte: „Aktivitätskalorien werden nicht zum Tagesziel addiert.“ (aus) bzw. „100 % der
  anrechenbaren Aktivitätskalorien werden zum Tagesziel addiert.“ (an).
- Ein: 100 % der anrechenbaren aktiven Kalorien des Tages – importierte und seit Phase 8 auch
  manuell erfasste Aktivitäten, Duplikate einmal – kommen zum Kalorienziel dieses Tages hinzu („Basisziel 2.300 kcal / Aktivitätskalorien +500 kcal“ → 2.800 kcal).
- Das gespeicherte Basisziel wird nie verändert; der Zuschlag wird bei jeder Anzeige berechnet
  (`GoalService.dayGoal`). Protein (auch ein individuelles Ziel), Fett, Kohlenhydrate und Wasser
  bleiben unverändert. Ohne Kalorienziel wird nichts angerechnet.
- Grundlage sind die Kalorien **der Aktivitäten**, nicht die Tagessumme „aktive Kalorien“ (die
  enthält auch Alltagsbewegung, die im Aktivitätsfaktor des Basisziels schon steckt).
- Keine Doppelzählung: Eine Aktivität, die sich zu mindestens 50 % (der kürzeren Einheit) mit einem
  abgeschlossenen Kalethra-Training überschneidet, gilt als dieselbe Einheit (z. B. die Uhr hat das
  Krafttraining mitgeschrieben) und wird nicht angerechnet; die Oberfläche weist darauf hin.

## Synchronisierung

- Zeitfenster: die letzten 30 lokalen Tage einschließlich heute. Kein Verlaufszugriff.
- Auslöser: Verbinden, App-Start, Rückkehr in den Vordergrund (`appStateChange`), Öffnen von
  „Fortschritt“ und „Gesundheit“, „Jetzt synchronisieren“.
- Automatische Auslöser höchstens alle 15 Minuten (gemessen ab dem letzten Versuch); manuell
  jederzeit. Immer nur eine Synchronisierung gleichzeitig. Keine Hintergrundarbeit.
- Aktivitäten werden über ihre Record-ID abgeglichen: neue hinzugefügt, geänderte aktualisiert,
  im Fenster nicht mehr gelieferte entfernt (gleiche Regel wie unten).
- Fehlende Berechtigungen (auch nachträglich hinzugekommene wie Distanz) zeigt der Dialog je
  Datentyp; „Fehlende Berechtigungen erteilen“ öffnet den Systemdialog erneut.
- Abgleich: Jede Synchronisierung liest das ganze Fenster neu. Neue und geänderte Werte werden
  gespeichert. Werte im Fenster, die Health Connect nicht mehr liefert, werden entfernt – **nur
  wenn jeder berechtigte Datentyp vollständig und fehlerfrei gelesen wurde**. Bei Fehlern,
  fehlender Verfügbarkeit oder entzogener Berechtigung wird nichts gelöscht. Daten außerhalb des
  Fensters bleiben unverändert. Schreiben passiert in einer Transaktion.
- Status (in `app_settings`, Schlüssel `healthConnect`, gerätebezogen): aktiviert, letzter
  Versuch, letzte erfolgreiche Synchronisierung, Ergebnis (`ok`, `partial`, `failed`,
  `permission`, `unavailable`), fehlende Berechtigungen.

## Trennen

Bestätigungsdialog mit der vorausgewählten Option „Importierte Daten aus Health Connect löschen“.
Gelöscht werden ausschließlich `imported_weights`, `daily_activity` und `external_workouts` des
Profils. Eigene
Gewichte, Trainings und Ernährungsdaten bleiben. Die Freigabe selbst entzieht der Nutzer in
Health Connect („Berechtigungen in Health Connect verwalten“).

## Architektur

```
core/platform/health/   HealthPlatform-Vertrag (types.ts), Android-Adapter über
                        @capgo/capacitor-health (healthConnect.ts), „nicht verfügbar“ +
                        E2E-Hook window.__kalethraHealth (unavailable.ts)
core/platform/appLifecycle.ts   onAppForeground
core/health/            importedHealth.ts, externalWorkouts.ts (Regeln, rein),
                        importedHealthRepository.ts,
                        healthConnectionRepository.ts, healthSyncService.ts,
                        HealthSyncProvider.tsx (Hooks)
app/HealthSyncTrigger.tsx       App-Start und Vordergrund
modules/settings/       Bereich „Gesundheitsdaten“, Verbinden- und Trennen-Dialog
modules/health/         „Schritte & Aktivität“ (Schritte mit Schrittziel, aktive Kalorien; Quelle
                        und letzte Aktualisierung im Fußtext). Das importierte Gewicht wird seit
                        Phase 17.5 hier nicht mehr wiederholt (Import und Speicherung unverändert)
modules/training/       „Aktivitäten“ (Liste, Details)
modules/nutrition/      Basisziel + Aktivitätskalorien im Ernährungstagebuch
modules/progress/       Mainpage „Fortschritt“: Aktivitäten und Gewicht über 7/30 Tage
                        (PROGRESS.md)
```

Das Plugin ist nur in `core/platform` erlaubt (ESLint). Auf iOS ist es per
`ios.includePlugins` ausgeschlossen, bis Apple Health umgesetzt wird.

### Datenfluss (Phase 16 geprüft)

Health Connect → `HealthSyncService` (Import, Normalisierung, Abgleich des 30-Tage-Fensters) →
eigene verschlüsselte Tabellen (`imported_weights`, `daily_activity`, `external_workouts`) →
zentrale Core-Funktionen → Gesundheit, Fortschritt und Score. Kein Fachmodul fragt Health Connect
selbst ab; alle lesen über `HealthSyncService`.

- **Schritte:** eine Auswertung (`summarizeStepGoal`, Tagesquote `stepDayRatio`, gedeckelt bei
  100 %, heute anteilig) für Gesundheit, Fortschritt und Score.
- **Aktivitäten:** eine Anrechenbarkeit (`countableActivities`) für Aktivitätskalorien, Summen der
  Fortschrittskarte, aktive Minuten des Scores und Schritte außerhalb von Aktivitäten.
- **Gewicht:** drei bewusst getrennte Regeln, je an einer Stelle (`weightRules.ts`,
  `weightTrend`).
- **Sync:** App-Start, Rückkehr in den Vordergrund und Öffnen einer Gesundheitsansicht, höchstens
  alle 15 Minuten; manuell jederzeit. Upsert nach Health-Connect-ID (keine Duplikate, auch nach
  erneutem Verbinden); Entfernen nur nach vollständig erfolgreichem Lesen.

## Übertragen: Kalethra → Health Connect (Phase 30, erweitert in Phase 31)

Einstellung **Einstellungen → App → Health Connect** – „Trainings und Aktivitäten aus Kalethra
mit Health Connect synchronisieren.“ Standard: **aus**. Nur auf Android sichtbar (Health Connect
vorhanden); auf iOS und im Web nie.

### Was übertragen wird

Pro Kalethra-Eintrag bis zu drei Health-Connect-Datensätze – jeder mit eigener `clientRecordId`
und eigener Buchungszeile in `health_connect_exports`:

| Datensatz                    | Client-ID                           | Wann                                                                                                                                                                           |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ExerciseSessionRecord`      | `kalethra:<workout\|activity>:<id>` | Immer, wenn Art und Zeitraum passen: Art, Beginn, Ende. Die ID ist dieselbe wie in Phase 30 (kein Suffix) – bereits übertragene Sitzungen werden aktualisiert, nie verdoppelt. |
| `ActiveCaloriesBurnedRecord` | `…:<id>:calories`                   | Nur mit einem echten Wert, über denselben Zeitraum wie die Sitzung, in kcal (`Energy.kilocalories`).                                                                           |
| `DistanceRecord`             | `…:<id>:distance`                   | Nur manuelle Aktivitäten mit erfasster Distanz, in Metern (`Length.meters`).                                                                                                   |

**Kalorien – woher der Wert kommt**

- **Manuelle Aktivitäten:** der Wert, den Kalethra anzeigt und verrechnet (`manual_activities.kcal`):
  die Netto-MET-Berechnung `(MET − 1) × 3,5 × kg ÷ 200 × min` (ohne Grundumsatz, also aktive
  Energie) oder der eigene Wert des Nutzers. Ohne Körpergewicht und ohne eigenen Wert: kein Wert.
- **Kalethra-Trainings:** dieselbe Formel, mit der Kalethra Trainings im Kalorienziel berücksichtigt
  (`sessionEnergyKcal`: `(MET der Trainingskategorie − 1) × kg × Stunden`, höchstens 3 h), pro
  Einheit, mit dem Körpergewicht **des Trainingstags** (Gewichtsregel 3, wie bei Aktivitäten),
  auf ganze kcal gerundet. Ohne Gewicht oder Dauer: kein Wert.
- Nie: Gesamtkalorien inklusive Grundumsatz, Schätzungen ohne vorhandene Kalethra-Berechnung,
  Werte aus Health Connect.
- Abgelehnt (= kein Datensatz): fehlend, 0, negativ, nicht endlich, über 10 000 kcal.

**Distanz**

- Nur die erfasste Distanz manueller Aktivitäten (`manual_activities.distance_m`), wo die
  Sportart sie abfragt; 0 < Distanz ≤ 1 000 km. Nie geschätzt, nie aus Tempo oder Dauer, keine
  GPS-Routen (Kalethra zeichnet keine auf).
- Kalethra-Trainings: keine Distanz. Satz-Distanzen (Intervalle, Farmer's Walk, Schlitten) sind
  keine Strecke der Einheit und bleiben lokal.

**Nicht übertragen:** Titel, Notizen, Sätze, Wiederholungen, Gewichte, Routen, Herzfrequenz,
importierte Health-Connect-Aktivitäten samt ihrer Kalorien und Distanzen (sie liegen in
`external_workouts`, die der Export nie liest). Einen Trainingstitel setzt der Export bewusst
nicht: bereits übertragene Sitzungen bekämen ihn nicht, und freier Text gehört nicht dazu.

### Ablauf und Regeln

| Thema           | Umsetzung                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Berechtigungen  | `WRITE_EXERCISE`, `WRITE_ACTIVE_CALORIES_BURNED`, `WRITE_DISTANCE`. Beim Einschalten werden die fehlenden angefragt. Der Schalter gilt als an, sobald `WRITE_EXERCISE` erteilt ist. Ohne Kalorien/Distanz: „Verbunden – ohne Kalorien oder Distanz“ und „Kalorien und Distanz erlauben“; Sitzungen laufen weiter. Entzogen → „Berechtigung erforderlich“.      |
| Krafttraining   | Kraft, Hypertrophie, Powerlifting → `STRENGTH_TRAINING`; Gewichtheben → `WEIGHTLIFTING`; Calisthenics, Laufen, Gehen, Rad, Mobilität/Dehnen (`STRETCHING`), Sonstiges (`OTHER_WORKOUT`). Hyrox: kein passender Typ → nicht übertragen.                                                                                                                         |
| Aktivitäten     | Nur **manuell erfasste** (Kalethra). 47 Sportarten mit passendem Typ (`ACTIVITY_EXPORT_TYPES`); ohne passenden Typ oder ohne Startzeit nicht – dann auch keine Kalorien und keine Distanz.                                                                                                                                                                     |
| Zeitpunkt       | Direkt nach „Training beenden“ bzw. Speichern einer Aktivität. Beim Einschalten einmal die **ganze Historie** (siehe unten). Beim App-Start und bei Rückkehr in den Vordergrund: unfertige Historie fortsetzen, dann wartende Datensätze (Abbruch beim ersten, der weiter fehlschlägt).                                                                        |
| Duplikate       | Stabile Client-IDs je Datentyp: Health Connect aktualisiert statt neu anzulegen (`insertRecords` mit `Metadata.manualEntry(clientRecordId, clientRecordVersion)`). Zusätzlich je Datensatz Version und Wert in `health_connect_exports` – Unverändertes wird nicht erneut gesendet (Neustart, erneutes Öffnen, Aus/An, Historie).                              |
| Änderungen      | Neuer Zeitraum oder neuer Wert → gleiche ID, höhere Version ersetzt den Datensatz. Die Version ist `updated_at` des Eintrags, mindestens aber die zuletzt geschriebene + 1 – so greift auch ein geänderter Wert ohne Änderung des Eintrags (z. B. nachgetragenes Gewicht).                                                                                     |
| Entfernte Werte | Fällt ein bereits übertragener Kalorien- oder Distanzwert weg oder wird ungültig, löscht Kalethra **nur seinen eigenen** Datensatz über dessen Client-ID (`deleteRecords` mit `clientRecordIdsList`; das Plugin akzeptiert nur IDs mit `kalethra:`) → Status `removed`. Nie Daten anderer Apps. Ein nie gesendeter Wert wird nur aus der Buchhaltung entfernt. |
| Fehler          | Training/Aktivität ist **vorher** gespeichert; der Export läuft danach eigenständig und wirft nie. Jeder Datentyp für sich: scheitert Kalorien, gehen Sitzung und Distanz trotzdem; der fehlgeschlagene wird später wiederholt. Ungültig → `skipped`.                                                                                                          |
| Aus             | Nichts wird geschrieben, nichts gelöscht – weder in Kalethra noch in Health Connect. Gelöschte Kalethra-Einträge bleiben in Health Connect (Sitzung und Werte).                                                                                                                                                                                                |
| Kein Rückfluss  | Der Aktivitäten-Import überspringt Sitzungen von `com.kalethra.app`. Kalethras Kalorien zählen in Health Connect zur Tagessumme „aktive Kalorien“; Kalethra zeigt diese Summe nur an und rechnet sie nie aufs Kalorienziel an (Grundlage sind die Aktivitäten, Doppelte einmal).                                                                               |

### Einmalige Synchronisation der Historie

1. Einschalten → Berechtigungen prüfen/anfragen → Einstellung `healthConnectExport` mit
   `historyDoneAt: null` speichern.
2. Im Hintergrund: IDs **aller** abgeschlossenen Trainings und manuellen Aktivitäten über die
   bestehenden Services (`completedIds`, `ids`) – keine eigene SQL.
3. In Paketen zu 25 (`HISTORY_BATCH`) durch die serielle Export-Warteschlange; dazwischen laufen
   neue Exporte (z. B. ein gerade beendetes Training), die UI wird nie blockiert.
4. Je Eintrag dieselbe Logik wie beim Einzelexport: Unverändertes wird nur nachgeschlagen,
   Fehlendes geschrieben, Fehler je Datensatz als `failed` vermerkt (später wiederholt).
5. Erst wenn alle Pakete bei eingeschaltetem Export gelaufen sind: `historyDoneAt` setzen. Geht
   Health Connect weg, wird die Berechtigung entzogen oder die App beendet, setzt der nächste
   Start fort – Erledigtes wird nicht erneut gesendet.
6. Aus- und Einschalten startet den Durchlauf erneut; dank Client-IDs und Buchhaltung entsteht
   nichts doppelt (geändert Gebliebenes wird aktualisiert). Ebenso „Kalorien und Distanz
   erlauben“: die Werte der Historie folgen.

Nach dem Update von 0.43.0 fehlt `historyDoneAt` in der gespeicherten Einstellung: beim ersten
Start läuft der Durchlauf einmal – vorhandene Sitzungen bleiben unverändert, Kalorien und
Distanzen kommen hinzu. In der Einstellung steht währenddessen „Bisherige Trainings und
Aktivitäten werden im Hintergrund übertragen.“

### Bekannte Grenzen

- Zeichnet eine Uhr dieselbe Einheit ebenfalls auf, stehen in Health Connect zwei Sitzungen
  (wie schon in Phase 30). Für Tagessummen wählt Health Connect bei überlappenden Kalorien die
  Quelle nach der App-Priorität in den Health-Connect-Einstellungen.
- Trainingskalorien sind die Kalethra-Formel (MET je Trainingskategorie), keine Messung.
- Wird ein bereits übertragener Eintrag nachträglich unpassend (z. B. Startzeit entfernt), bleiben
  Sitzung und Werte in Health Connect unverändert.

### Architektur

```
modules/settings/HealthExportSection   Schalter, Status, Berechtigungen verwalten
modules/training                       nach finish / Dauer-Korrektur / Aktivität speichern → exportWorkout/-Activity (fire-and-forget)
app/HealthSyncTrigger                  retryWaiting bei Start und Vordergrund
core/health/healthExport.ts            Regeln (rein): Typzuordnung, Session, Kalorien, Distanz, Client-IDs
core/health/healthExportService.ts     Ablauf je Datentyp, Historie in Paketen, idempotent, seriell
core/health/healthExportRepository.ts  SQL (health_connect_exports, app_settings)
core/platform/health/export.ts         HealthExportPlatform; Android: registerPlugin('KalethraHealthExport')
android/app/…/HealthExportPlugin.kt    natives Schreiben (connect-client 1.1.0)
```

Das Lesen bleibt bei `@capgo/capacitor-health`; dessen `saveSample` kann keine
Trainingseinheiten schreiben und setzt keine `clientRecordId` – deshalb das eigene, kleine
Plugin. Es nutzt dieselbe `connect-client`-Version, es kommt keine neue Bibliothek in die APK.
Eine spätere Lesefunktion (z. B. Schlaf, Herzfrequenz) erweitert `HealthPlatform`, nicht den
Export.

## Android-Konfiguration

- Das Plugin deklariert über 40 Health-Berechtigungen. Das App-Manifest entfernt alle außer den
  fünf Leserechten und den drei Schreibrechten des Exports (`WRITE_EXERCISE`,
  `WRITE_ACTIVE_CALORIES_BURNED`, `WRITE_DISTANCE`; Rest per `tools:node="remove"`).
  `tests/nativeConfig.test.ts` prüft das Manifest, die
  CI prüft die fertige APK (`aapt2 dump permissions`).
- `<queries>` für `com.google.android.apps.healthdata`, die Begründungs-Activity
  (`ACTION_SHOW_PERMISSIONS_RATIONALE`) und der Android-14-Alias (`VIEW_PERMISSION_USAGE`) kommen
  aus dem Plugin-Manifest. Die Activity zeigt `public/privacypolicy.html` (offline).
- minSdk 26, compile/target 36 – passend zum Plugin (minSdk 26, compileSdk 36,
  `connect-client` 1.1.0).
- Phase 30: Kotlin im App-Modul (`kotlin-gradle-plugin` 2.4.20, wie das Health-Plugin),
  `HealthExportPlugin` wird in `MainActivity` registriert. iOS bleibt unberührt (kein Plugin,
  keine Abhängigkeit im Xcode-Projekt).

## Vor einer Play-Store-Veröffentlichung

- Health-Apps-Erklärung in der Play Console mit Begründung je Datentyp.
- Dieselbe Datenschutzerklärung im Store-Eintrag (gehostete URL) wie in der App; Angaben zum
  Verantwortlichen ergänzen.
- Begründung je Berechtigung: Gewicht (Übersicht), Schritte und aktive Kalorien (Tageswerte),
  Trainings (Aktivitätenliste, optionale Kalorienanrechnung), Distanz (Strecke der Aktivitäten;
  technisch nötig für Kalorien pro Aktivität), `WRITE_EXERCISE` (eigene Trainings auf Wunsch in
  Health Connect speichern), `WRITE_ACTIVE_CALORIES_BURNED` und `WRITE_DISTANCE` (die aktiven
  Kalorien und die erfasste Distanz dieser Trainings und Aktivitäten).
