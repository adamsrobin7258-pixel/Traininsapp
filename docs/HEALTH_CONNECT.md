# Health Connect (Phase 6.2 / 6.3)

Kalethra liest auf Android ausgewählte Gesundheitsdaten aus Health Connect: Gewicht, Schritte,
aktive Kalorien (Phase 6.2) und Aktivitäten mit Dauer, aktiven Kalorien und Distanz (Phase 6.3).
Apple Health folgt in einer eigenen Phase.

## Grundsätze

| Regel                          | Umsetzung                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standardmäßig aus              | Erst „Profil → Gesundheitsdaten → Mit Health Connect verbinden“ öffnet – nach Kalethras eigener Erklärung – den Berechtigungsdialog.                                       |
| Nur lesen                      | Fünf Leserechte: `READ_WEIGHT`, `READ_STEPS`, `READ_ACTIVE_CALORIES_BURNED`, `READ_EXERCISE`, `READ_DISTANCE`. Keine Schreib-, Verlaufs- oder Hintergrundrechte.           |
| Nur lokal                      | Importierte Werte liegen in der verschlüsselten Datenbank (`imported_weights`, `daily_activity`, `external_workouts`). Keine Netzwerkverbindung, kein Server, keine Cloud. |
| Getrennt von eigenen Daten     | `weight_entries` wird durch einen Import nie verändert. Die Ernährungsziele folgen weiter nur den eigenen Gewichtseinträgen (per Test geprüft).                            |
| Eigene Werte haben Vorrang     | Gibt es für einen Tag ein eigenes Gewicht und einen Import, gilt das eigene (`dayWeight`). Ein Import überschreibt nie einen manuellen Wert.                               |
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
  Plänen, im Fortschritt oder bei „Nächstes Training“.

## Aktivitätskalorien anrechnen

Einstellung unter „Profil → Gesundheitsdaten“, gespeichert in `app_settings`
(`countActivityCalories`), **standardmäßig aus**.

- Aus: Das Tagesziel bleibt unverändert; die Aktivitätskalorien werden nur als Information gezeigt
  („Aktivitätskalorien 500 kcal / Nicht auf das Tagesziel angerechnet“).
- Ein: 100 % der aktiven Kalorien der importierten Aktivitäten des Tages kommen zum Kalorienziel
  dieses Tages hinzu („Basisziel 2.300 kcal / Aktivitätskalorien +500 kcal“ → 2.800 kcal).
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
  „Heute“ und „Gesundheit“, „Jetzt synchronisieren“.
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
modules/profile/        Bereich „Gesundheitsdaten“, Verbinden- und Trennen-Dialog
modules/health/         „Aus Health Connect“ (Schritte, aktive Kalorien, Gewicht)
modules/training/       „Aktivitäten“ (Liste, Details)
modules/nutrition/, modules/dashboard/   Basisziel + Aktivitätskalorien; „Heute“ fasst
                        Aktivitäten, Schritte und Gewicht zusammen (TODAY.md)
```

Das Plugin ist nur in `core/platform` erlaubt (ESLint). Auf iOS ist es per
`ios.includePlugins` ausgeschlossen, bis Apple Health umgesetzt wird.

## Android-Konfiguration

- Das Plugin deklariert über 40 Health-Berechtigungen. Das App-Manifest entfernt alle außer den
  fünf Leserechten (`tools:node="remove"`). `tests/nativeConfig.test.ts` prüft das Manifest, die
  CI prüft die fertige APK (`aapt2 dump permissions`).
- `<queries>` für `com.google.android.apps.healthdata`, die Begründungs-Activity
  (`ACTION_SHOW_PERMISSIONS_RATIONALE`) und der Android-14-Alias (`VIEW_PERMISSION_USAGE`) kommen
  aus dem Plugin-Manifest. Die Activity zeigt `public/privacypolicy.html` (offline).
- minSdk 26, compile/target 36 – passend zum Plugin (minSdk 26, compileSdk 36,
  `connect-client` 1.1.0).

## Vor einer Play-Store-Veröffentlichung

- Health-Apps-Erklärung in der Play Console mit Begründung je Datentyp.
- Dieselbe Datenschutzerklärung im Store-Eintrag (gehostete URL) wie in der App; Angaben zum
  Verantwortlichen ergänzen.
- Begründung je Berechtigung: Gewicht (Übersicht), Schritte und aktive Kalorien (Tageswerte),
  Trainings (Aktivitätenliste, optionale Kalorienanrechnung), Distanz (Strecke der Aktivitäten;
  technisch nötig für Kalorien pro Aktivität).
