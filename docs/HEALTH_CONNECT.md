# Health Connect (Phase 6.2)

Kalethra liest auf Android ausgewählte Gesundheitsdaten aus Health Connect. Apple Health folgt in
einer eigenen Phase; Trainings aus Health Connect werden erst ab Phase 6.3 importiert.

## Grundsätze

| Regel                          | Umsetzung                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standardmäßig aus              | Erst „Profil → Gesundheitsdaten → Mit Health Connect verbinden“ öffnet – nach Kalethras eigener Erklärung – den Berechtigungsdialog.                                          |
| Nur lesen                      | Vier Leserechte: `READ_WEIGHT`, `READ_STEPS`, `READ_ACTIVE_CALORIES_BURNED`, `READ_EXERCISE` (vorbereitet, noch ungenutzt). Keine Schreib-, Verlaufs- oder Hintergrundrechte. |
| Nur lokal                      | Importierte Werte liegen in der verschlüsselten Datenbank (`imported_weights`, `daily_activity`). Keine Netzwerkverbindung, kein Server, keine Cloud.                         |
| Getrennt von eigenen Daten     | `weight_entries` wird durch einen Import nie verändert. Die Ernährungsziele folgen weiter nur den eigenen Gewichtseinträgen (per Test geprüft).                               |
| Eigene Werte haben Vorrang     | Gibt es für einen Tag ein eigenes Gewicht und einen Import, gilt das eigene (`dayWeight`). Ein Import überschreibt nie einen manuellen Wert.                                  |
| Mehrere Messungen an einem Tag | Die zeitlich früheste gültige Messung des lokalen Tages wird gespeichert (08:02 92,4 kg, 12:30 92,8 kg → 92,4 kg).                                                            |
| Schritte und aktive Kalorien   | Tageswerte über die Health-Connect-Aggregation (`queryAggregated`, Tages-Buckets in Gerätezeit). Health Connect entfernt dabei Doppelungen mehrerer Quellen. Nur Anzeige.     |

## Synchronisierung

- Zeitfenster: die letzten 30 lokalen Tage einschließlich heute. Kein Verlaufszugriff.
- Auslöser: Verbinden, App-Start, Rückkehr in den Vordergrund (`appStateChange`), Öffnen von
  „Heute“ und „Gesundheit“, „Jetzt synchronisieren“.
- Automatische Auslöser höchstens alle 15 Minuten (gemessen ab dem letzten Versuch); manuell
  jederzeit. Immer nur eine Synchronisierung gleichzeitig. Keine Hintergrundarbeit.
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
Gelöscht werden ausschließlich `imported_weights` und `daily_activity` des Profils. Eigene
Gewichte, Trainings und Ernährungsdaten bleiben. Die Freigabe selbst entzieht der Nutzer in
Health Connect („Berechtigungen in Health Connect verwalten“).

## Architektur

```
core/platform/health/   HealthPlatform-Vertrag (types.ts), Android-Adapter über
                        @capgo/capacitor-health (healthConnect.ts), „nicht verfügbar“ +
                        E2E-Hook window.__kalethraHealth (unavailable.ts)
core/platform/appLifecycle.ts   onAppForeground
core/health/            importedHealth.ts (Regeln, rein), importedHealthRepository.ts,
                        healthConnectionRepository.ts, healthSyncService.ts,
                        HealthSyncProvider.tsx (Hooks)
app/HealthSyncTrigger.tsx       App-Start und Vordergrund
modules/profile/        Bereich „Gesundheitsdaten“, Verbinden- und Trennen-Dialog
modules/health/         „Aus Health Connect“ (Schritte, aktive Kalorien, Gewicht)
```

Das Plugin ist nur in `core/platform` erlaubt (ESLint). Auf iOS ist es per
`ios.includePlugins` ausgeschlossen, bis Apple Health umgesetzt wird.

## Android-Konfiguration

- Das Plugin deklariert über 40 Health-Berechtigungen. Das App-Manifest entfernt alle außer den
  vier Leserechten (`tools:node="remove"`). `tests/nativeConfig.test.ts` prüft das Manifest, die
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
- `READ_EXERCISE` erst deklarieren, wenn Phase 6.3 sie nutzt – oder bis dahin entfernen, falls die
  Veröffentlichung vorher erfolgt (Google verlangt eine Begründung je Berechtigung).
