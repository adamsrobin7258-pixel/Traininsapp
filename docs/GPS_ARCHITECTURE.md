# GPS-Architektur

Stand: Phase 1.1. **Es ist kein GPS-Tracking implementiert.** Vorhanden ist nur der Vertrag
(`src/core/platform/location/types.ts`). Dieses Dokument beschreibt, wie Laufen, Radfahren,
Walking und Outdoor-Training später darauf aufbauen.

## Ziele (⏳ geplant)

Distanz, Geschwindigkeit, Pace, Route, Höhenmeter, Dauer und GPS-Track. Die Aufzeichnung soll
auch bei gesperrtem Bildschirm und im Hintergrund zuverlässig weiterlaufen.

## Schichten

```
modules/activity (später: running, cycling, walking)
  UI: Live-Anzeige, Start/Pause/Stopp
      │
      ▼
Domain (reines TypeScript, ohne React/Capacitor)
  - TrackRecorder: Zustandsautomat idle → running ⇄ paused → finished
  - Filter: Genauigkeit, Ausreißer, Stillstand
  - Metriken: Distanz (Haversine), Pace, Höhenmeter mit Glättung
      │ nutzt nur
      ▼
LocationTracker  (src/core/platform/location/types.ts)   ← Plattformgrenze
      │ implementiert von
      ├── Android-Adapter: FusedLocationProviderClient + Foreground Service (Kotlin-Plugin)
      ├── iOS-Adapter: CLLocationManager + Background Mode "location" (Swift-Plugin)
      └── Fake-Adapter: spielt aufgezeichnete Tracks ab (Tests, Browser-Entwicklung)
      │
      ▼
Persistenz: Repository → SQLite (Tabellen mit sensitivity 'location')
```

ESLint erzwingt, dass `src/core/platform/location/` weder React noch Capacitor importiert.
Domain-Code in `modules/**/domain` darf ebenfalls weder React noch Capacitor verwenden. Die
nativen Adapter werden in `src/core/platform/` angebunden. Nur dort sind Capacitor-Importe
erlaubt.

## Vertrag

| Element                                             | Zweck                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `checkPermission(mode)` / `requestPermission(mode)` | Berechtigungsstatus je Modus (`foreground` oder `background`)                   |
| `start(options, onSample, onError)`                 | Startet die Aufzeichnung und liefert eine `TrackingSession`                     |
| `TrackingSession.stop()`                            | Beendet die Aufzeichnung und gibt Foreground-Service bzw. Hintergrundmodus frei |
| `LocationSample`                                    | Position, Höhe, Genauigkeit, Geschwindigkeit, Kurs, Zeitpunkt (UTC)             |
| `TrackingOptions`                                   | Modus, Distanzfilter, Aktivitätsart (steuert Plattform-Voreinstellungen)        |
| `TrackingError`                                     | `permission`, `unavailable` oder `interrupted`                                  |

Einheiten: Meter, Meter pro Sekunde, Grad; Zeit als ISO-8601 in UTC.

## Vordergrund und Hintergrund

|                                     | Android                                                                                                                                                                                                                                                                                                                                                                                           | iOS                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vordergrund                         | `ACCESS_FINE_LOCATION` (+ `COARSE`) zur Laufzeit                                                                                                                                                                                                                                                                                                                                                  | `NSLocationWhenInUseUsageDescription`                                                                                                                                                                                |
| Hintergrund / gesperrter Bildschirm | **Foreground Service** vom Typ `location` mit dauerhafter Benachrichtigung (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`). Damit reicht in der Regel die Berechtigung „während der Nutzung“, weil die Aufzeichnung sichtbar vom Nutzer gestartet wird. `ACCESS_BACKGROUND_LOCATION` wird nur angefragt, wenn es wirklich nötig ist; Google Play verlangt dafür eine gesonderte Begründung. | Background Mode `location` in `Info.plist`, `allowsBackgroundLocationUpdates = true`, `showsBackgroundLocationIndicator = true`. „Während der Nutzung“ genügt, wenn die Aufzeichnung im Vordergrund gestartet wurde. |
| Benachrichtigungen                  | Android 13+: `POST_NOTIFICATIONS` für die Service-Benachrichtigung                                                                                                                                                                                                                                                                                                                                | –                                                                                                                                                                                                                    |

## Berechtigungsablauf

1. Nutzer tippt „Lauf starten“ – nie beim App-Start fragen.
2. Eigene Erklärung vorab: wofür, dass Daten lokal bleiben, wie man stoppt.
3. Systemdialog für Standort „während der Nutzung“.
4. Android 13+: Benachrichtigungsberechtigung für die laufende Aufzeichnung.
5. Abgelehnt: Aufzeichnung ohne GPS anbieten (nur Zeit), Link zu den Einstellungen.
6. „Ungefährer Standort“ (Android `COARSE`, iOS „Genauer Standort aus“): Nutzer darauf
   hinweisen, dass Distanz und Pace ungenau werden.

## Lebenszyklus und gesperrter Bildschirm

- Die Aufzeichnung läuft **nativ** (Service bzw. CLLocationManager), nicht im WebView-JavaScript.
  Der WebView kann im Hintergrund pausiert werden. Punkte werden deshalb im Adapter gepuffert
  und beim nächsten Aufwachen bzw. in festen Abständen an die Domain übergeben.
- Wird die App vom System beendet, bleiben die nativ gepufferten Punkte erhalten. Beim nächsten
  Start erkennt die Domain eine unterbrochene Aufzeichnung und bietet an, sie fortzusetzen oder
  zu speichern.
- iOS-Keychain und Datenbank: Der Schlüssel einer später verschlüsselten Datenbank ist bei
  gesperrtem Bildschirm nicht lesbar (siehe [PRIVACY.md](PRIVACY.md)). Die Datenbank muss daher
  vor Aufzeichnungsbeginn geöffnet sein, oder der Adapter puffert Punkte in einer
  gerätegeschützten Datei, bis entsperrt wird.
- Hersteller mit aggressivem Energiesparen (Xiaomi HyperOS, Samsung, Huawei) beenden
  Hintergrunddienste teilweise trotz Foreground Service. Nutzer werden bei Bedarf auf die
  Akku-Einstellung „Keine Einschränkungen“ hingewiesen. Auf dem Xiaomi 15 Ultra gezielt testen.

## Akku

- Genauigkeit nach Aktivität: Laufen/Radfahren hohe Genauigkeit, Walking ausgewogen.
- Distanzfilter (z. B. 5 m Laufen, 10 m Radfahren) statt fester Zeitintervalle.
- iOS `activityType` (`fitness`, `otherNavigation`) und `pausesLocationUpdatesAutomatically`
  bewusst setzen. Android `Priority.PRIORITY_HIGH_ACCURACY` nur während aktiver Aufzeichnung.
- Bei Pause: Updates reduzieren oder stoppen. Keine Standortabfragen außerhalb einer
  Aufzeichnung.

## Datenschutz

- Standortdaten sind hochsensibel. Tabellen erhalten im Datenkatalog `sensitivity: 'location'`
  und sind erst nach aktivierter Datenbankverschlüsselung erlaubt (per Test erzwungen).
- Standort nur während einer vom Nutzer gestarteten Aufzeichnung, nie im Leerlauf.
- ⏳ Privatzonen: Start und Ende einer Route in einem Radius um Zuhause bzw. Arbeitsplatz beim
  Teilen oder Exportieren ausblenden.
- Einzelne Tracks löschbar; „Alle Standortdaten löschen“ über die Kategorie `location`.

## Speicherung (⏳ Entwurf)

```
activity_sessions   id, profile_id, activity_type, started_at, ended_at, duration_s,
                    distance_m, elevation_gain_m, avg_speed_mps, …, Sync-Spalten
track_points        session_id, seq, recorded_at, lat, lon, altitude_m,
                    h_accuracy_m, speed_mps
                    PRIMARY KEY (session_id, seq)
```

- Punkte in Stapeln per Transaktion schreiben (z. B. alle 10 Punkte oder 15 s), um den Akku zu
  schonen.
- Zusammenfassung in `activity_sessions` zusätzlich speichern, damit Listen und Statistiken
  keine Punkte lesen müssen.
- Sync und Export: Punkte als GPX/GeoJSON exportierbar; Cloud-Sync der Punkte optional und
  getrennt von der Zusammenfassung zustimmbar.

## Umsetzungsreihenfolge (Vorschlag)

1. Domain mit Fake-Adapter und aufgezeichneten Test-Tracks: Metriken, Filter, Zustandsautomat.
2. Android-Adapter mit Foreground Service – Prototyp auf dem Xiaomi 15 Ultra mit gesperrtem
   Bildschirm über 60 Minuten.
3. iOS-Adapter.
4. Persistenz, UI, Export.

Bewertet wird dabei, ob ein bestehendes Plugin (z. B. `@capacitor-community/background-geolocation`)
die Anforderungen erfüllt oder ob eigene native Adapter nötig sind. Die Domain bleibt in beiden
Fällen gleich.
