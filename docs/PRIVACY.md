# Datenschutz in Kalethra

Stand: Phase 1.1. Dieses Dokument beschreibt Grundsätze und technische Entscheidungen. Es ist
**keine** Datenschutzerklärung für Nutzer – die wird vor der Veröffentlichung auf Basis dieses
Dokuments erstellt und rechtlich geprüft.

Kennzeichnung: ✅ umgesetzt · 🟡 vorbereitet (Struktur vorhanden) · ⏳ geplant

## Grundsätze

| Grundsatz                     | Bedeutung                                                                                                                                                                                                                                                                                                              | Status |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Local-first**               | Alle Nutzerdaten entstehen und liegen in der lokalen SQLite-Datenbank auf dem Gerät.                                                                                                                                                                                                                                   | ✅     |
| **Offline nutzbar**           | Jede Funktion funktioniert ohne Internet und ohne Konto.                                                                                                                                                                                                                                                               | ✅     |
| **Cloud optional**            | Synchronisierung nur nach Registrierung und ausdrücklicher Zustimmung. Aktuell gibt es keine Cloud-Anbindung (`LocalOnlySyncService`).                                                                                                                                                                                 | 🟡     |
| **Datenminimierung**          | Es werden nur Daten erfasst, die eine Funktion tatsächlich braucht.                                                                                                                                                                                                                                                    | ✅     |
| **Keine Weitergabe**          | Die App enthält keine Analytics-, Tracking-, Crash-Reporting- oder Werbe-SDKs und sendet keine persönlichen Daten an Dritte. Einzige Netzwerkverbindung: die Barcode-Abfrage bei Open Food Facts für lokal unbekannte Barcodes (nur der Barcode, siehe unten). Die Lebensmittelsuche ist offline (BLS 4.0 in der App). | ✅     |
| **Keine Werbung**             | Keine Werbung, keine Werbe-IDs.                                                                                                                                                                                                                                                                                        | ✅     |
| **Keine KI**                  | Keine KI-Funktionen, keine Übermittlung an KI-Dienste.                                                                                                                                                                                                                                                                 | ✅     |
| **Kein automatisches Backup** | Android-Auto-Backup und Geräteübertragung sind für alle App-Daten abgeschaltet (siehe unten).                                                                                                                                                                                                                          | ✅     |

Neue Abhängigkeiten, die Netzwerkzugriff haben (SDKs, Plugins), brauchen eine Begründung im
Pull Request und einen Eintrag in diesem Dokument.

## Welche Daten gibt es?

### Aktuell gespeichert (Schema-Version 6)

| Tabelle                                                                               | Inhalt                                                                                                            | Sensibilität         |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| `schema_migrations`                                                                   | Technischer Stand der Datenbank                                                                                   | technisch            |
| `app_settings`                                                                        | Erscheinungsbild, Sprache, Gewichtseinheit, Wasser-Schnellmengen                                                  | technisch            |
| `diagnostics`                                                                         | Prüfwerte des Speicher-Selbsttests                                                                                | technisch            |
| `weight_entries`                                                                      | Körpergewicht je Tag (in kg), Einheiteneinstellung in `app_settings`                                              | **Gesundheitsdaten** |
| `profiles`                                                                            | Lokale Profil-ID (UUID), optionaler Vorname; Geschlecht, Geburtsdatum, Körpergröße (für die Ernährungsberechnung) | **Gesundheitsdaten** |
| `exercises`                                                                           | Übungskatalog und eigene Übungen (Name, Typ, Ausrüstung)                                                          | personenbezogen      |
| `imported_weights`                                                                    | Aus Health Connect importiertes Tagesgewicht (früheste Messung des Tages), nur Anzeige                            | **Gesundheitsdaten** |
| `daily_activity`                                                                      | Aus Health Connect importierte Tageswerte: Schritte, aktive Kalorien, nur Anzeige                                 | **Gesundheitsdaten** |
| `external_workouts`                                                                   | Aus Health Connect importierte Aktivitäten: Typ, Zeit, Dauer, aktive Kalorien, Distanz, Quelle                    | **Gesundheitsdaten** |
| `exercise_muscles`                                                                    | Muskelgruppen je Übung                                                                                            | technisch            |
| `exercise_favorites`                                                                  | Favorisierte Übungen je Profil                                                                                    | personenbezogen      |
| `training_plans`, `training_plan_days`, `planned_exercises`                           | Trainingspläne, Tage, Übungen mit Vorgaben                                                                        | **Gesundheitsdaten** |
| `workouts`                                                                            | Trainingseinheiten: Art, Zeitpunkt, Dauer, Titel, Notizen                                                         | **Gesundheitsdaten** |
| `workout_exercises`, `workout_sets`                                                   | Übungen und Sätze (Gewicht, Wdh., Dauer, Distanz, RPE)                                                            | **Gesundheitsdaten** |
| `foods`, `food_servings`, `meal_slots`, `recipes`, `recipe_ingredients`               | Lebensmittel, Portionsgrößen, Mahlzeiten-Einstellung, Rezepte                                                     | personenbezogen      |
| `food_entries`, `saved_meals`, `saved_meal_items`, `nutrition_goals`, `water_entries` | Ernährungstagebuch, Vorlagen, Ziele, Wasser                                                                       | **Gesundheitsdaten** |

Seit Phase 2 wird **Körpergewicht**, seit Phase 3 werden **Trainingsdaten** gespeichert – ausschließlich in der verschlüsselten Datenbank (per Test erzwungen). Die Trainingsfunktion nutzt kein Netzwerk, keine Analyse- und keine Tracking-Dienste. Seit Phase 4.1 existiert das Datenmodell für **Ernährung** (verschlüsselt, lokal). Die externe Lebensmitteldatenbank (seit Phase 4.3 Open Food Facts, seit Phase 4.4 nur noch für Barcodes) erhält ausschließlich Barcode bzw. Produkt-ID – niemals Suchtext, Tagebuch, Ziele, Gewicht oder Profildaten. Der Bundeslebensmittelschlüssel (BLS) ist Teil der App und wird ohne Netzwerk durchsucht. Standortdaten werden noch nicht gespeichert.

Seit Phase 6.2 kann der Nutzer **Health Connect** (Android) ausdrücklich einschalten. Kalethra liest dann Gewicht, Schritte und aktive Kalorien der letzten 30 Tage – nur lesend, nur im Vordergrund, ohne Netzwerk – und speichert sie getrennt von den eigenen Daten verschlüsselt auf dem Gerät (`imported_weights`, `daily_activity`). Importierte Werte werden nur angezeigt und beeinflussen weder eigene Gewichtseinträge noch Ernährungsziele. Beim Trennen lassen sie sich löschen (voreingestellt). Die für Health Connect nötige Datenschutzerklärung liegt offline in der App (`public/privacypolicy.html`). Details: [HEALTH_CONNECT.md](HEALTH_CONNECT.md).

Seit Phase 6.3 liest Kalethra zusätzlich die **Aktivitäten** (Trainingseinheiten anderer Apps oder Uhren) mit Dauer, aktiven Kalorien und Distanz (`external_workouts`, Leserechte `READ_EXERCISE` und `READ_DISTANCE`). Sie werden getrennt von den eigenen Trainings angezeigt. Nur wenn der Nutzer „Aktivitätskalorien anrechnen“ einschaltet (standardmäßig aus), werden ihre aktiven Kalorien dem Kalorienziel des Tages hinzugerechnet – lokal, ohne das gespeicherte Ziel zu verändern. Beim Trennen werden auch die Aktivitäten gelöscht (voreingestellt).

### Künftig (⏳ geplant, noch nicht implementiert)

| Daten                            | Kategorie        | Sensibilität                                                    |
| -------------------------------- | ---------------- | --------------------------------------------------------------- |
| Gewicht, Körperfett, Muskelmasse | Gesundheit       | Gesundheitsdaten (Art. 9 DSGVO)                                 |
| Herzfrequenz, Ruhepuls           | Gesundheit       | Gesundheitsdaten                                                |
| Schlaf, Regeneration             | Gesundheit       | Gesundheitsdaten                                                |
| Schritte, aktive Energie         | Aktivität        | Gesundheitsdaten                                                |
| GPS-Tracks, Routen               | Standort         | Standortdaten – verraten Wohnort, Arbeitsplatz und Gewohnheiten |
| Importe aus HealthKit (iOS)      | je nach Datenart | Gesundheitsdaten                                                |

## Datenkatalog (🟡 vorbereitet, ✅ erzwungen)

`src/core/privacy/dataCatalog.ts` klassifiziert **jede** Tabelle:

| Feld                 | Bedeutung                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `category`           | Fachbereich (`profile`, `training`, `nutrition`, `health`, `activity`, `location`, `app`) |
| `sensitivity`        | `technical` · `personal` · `health` · `location`                                          |
| `exportable`         | gehört zum Datenexport                                                                    |
| `deletedWithProfile` | wird beim Löschen des Profils entfernt                                                    |
| `syncable`           | darf später synchronisiert werden                                                         |

Automatische Tests (`dataCatalog.test.ts`) erzwingen:

1. Jede per Migration angelegte Tabelle muss im Katalog stehen – sonst schlägt der Test fehl.
2. **Tabellen mit `health`- oder `location`-Daten sind gesperrt, solange die Datenbank nicht
   verschlüsselt ist** (`LOCAL_DATABASE_ENCRYPTED`). Gesundheitsdaten können also nicht
   versehentlich unverschlüsselt gespeichert werden.
3. Alle nicht-technischen Daten werden beim Löschen des Profils mitgelöscht.
4. Technische Tabellen werden nie synchronisiert.

## Verschlüsselung der lokalen Datenbank

**Status: aktiv und auf dem Gerät validiert** (Xiaomi 15 Ultra, SQLCipher 4.17.0 Community, Phase 2): Upgrade einer unverschlüsselten 0.1.1-Datenbank, App-Neustart, Geräte-Neustart, Flugmodus und Neuinstallation bestanden. Seitdem ist `LOCAL_DATABASE_ENCRYPTED = true`.

### Umsetzung

| Baustein                | Umsetzung                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verschlüsselung         | SQLCipher 4 über `@capacitor-community/sqlite` (Android `net.zetetic:sqlcipher-android`, iOS `SQLCipher.swift`) – AES-256, Schlüsselableitung durch SQLCipher. Keine eigene Kryptografie.                                |
| Schlüssel               | 256 Bit aus `crypto.getRandomValues` (Zufallsquelle des Betriebssystems), als 64 Hex-Zeichen. Wird **einmal** beim ersten Start erzeugt und direkt an das Plugin übergeben.                                              |
| Schlüsselablage Android | Das Plugin speichert den Schlüssel in `EncryptedSharedPreferences` (`sqlite_encrypted_shared_prefs`), verschlüsselt mit einem AES-256-GCM-Hauptschlüssel im **Android Keystore** (hardwaregestützt, nicht exportierbar). |
| Schlüsselablage iOS     | **Keychain** (Präfix `kalethra`), Plugin-Standard `kSecAttrAccessibleWhenUnlocked`.                                                                                                                                      |
| Nicht im Code           | Der Schlüssel steht nirgends im Quellcode, in `localStorage`, Capacitor Preferences, JSON-Dateien, SQLite, Git oder der Build-Konfiguration. Er existiert nur kurz im JS-Speicher beim ersten Start.                     |
| Entscheidungslogik      | `src/core/database/encryption.ts` (`planEncryptedOpen`, `verifyEncrypted`) – rein, mit Fake-Plugin getestet.                                                                                                             |
| Browser                 | Nur Entwicklungsmodus: `jeep-sqlite` kann nicht verschlüsseln. Die App zeigt das im Profil offen an („Nicht aktiv“).                                                                                                     |

### Ablauf beim Start (Android/iOS)

```
Datenbank vorhanden?  Schlüssel gespeichert?   → Aktion
nein                  nein                     → Schlüssel erzeugen, neue verschlüsselte DB ("created")
nein                  ja                       → neue verschlüsselte DB mit vorhandenem Schlüssel
ja, unverschlüsselt   nein/ja                  → ggf. Schlüssel erzeugen, DB in-place verschlüsseln
                                                  ("encrypted-existing", Upgrade von 0.1.1)
ja, verschlüsselt     ja                       → mit gespeichertem Schlüssel öffnen ("opened")
ja, verschlüsselt     nein                     → STOPP: DatabaseKeyError('missing-key')
ja, nicht lesbar      –                        → STOPP: DatabaseKeyError('unreadable')
danach                                         → Prüfen, dass die Datei verschlüsselt ist,
                                                  sonst STOPP: DatabaseKeyError('not-encrypted')
```

Es gibt **keinen** Pfad, der auf eine unverschlüsselte oder neue leere Datenbank ausweicht. Bei
einem Schlüsselproblem zeigt die App einen eigenen Fehlerbildschirm; die Datei bleibt unverändert.

Geprüftes Plugin-Verhalten (Quellcode 8.1.1):

- Modus `secret` ohne gespeicherten Schlüssel → Fehler „No Passphrase stored“, kein Fallback.
- Falscher Schlüssel → SQLCipher kann die Datei nicht lesen → Fehler.
- **Achtung:** Das Plugin enthält einen veralteten, fest eingebauten Schlüssel (`"sqlite secret"`,
  `GlobalSQLite.java`). `isDatabaseEncrypted()` meldet auch eine damit verschlüsselte Datei als
  verschlüsselt. Kalethra verwendet ihn nie: Geöffnet wird ausschließlich im Modus
  `secret`/`encryption` mit dem eigenen Schlüssel – ein erfolgreiches Öffnen beweist also,
  dass unser Schlüssel passt.
- `setEncryptionSecret` lässt sich nur einmal aufrufen; ein bestehender Schlüssel wird nie
  überschrieben.

### Verhalten in Situationen

| Situation             | Android                                                                      | iOS                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| App-Neustart          | Schlüssel aus Keystore, DB öffnet                                            | Schlüssel aus Keychain, DB öffnet                                                                                                          |
| Geräte-Neustart       | wie App-Neustart (Keystore-Schlüssel bleibt)                                 | Keychain erst nach Entsperren lesbar                                                                                                       |
| Gesperrter Bildschirm | Schlüssel verfügbar (keine Bindung an Entsperrung) → Hintergrund-GPS möglich | Schlüssel **nicht** lesbar (`WhenUnlocked`). Eine bereits geöffnete DB bleibt nutzbar → für GPS DB vor dem Sperren öffnen und offen halten |
| Deinstallation        | DB, verschlüsselte Prefs und Keystore-Schlüssel werden gelöscht              | App-Daten werden gelöscht; der Keychain-Eintrag kann iOS-bedingt bestehen bleiben                                                          |
| Neuinstallation       | neue DB mit neuem Schlüssel                                                  | neue DB; ein noch vorhandener Keychain-Schlüssel wird wiederverwendet (unkritisch, alte Daten existieren nicht mehr)                       |
| Backup                | ausgeschlossen (DB und Prefs), siehe unten                                   | Keychain `WhenUnlocked` wird mit **verschlüsselten** Backups übertragen, DB ebenfalls – siehe offene Punkte                                |

### Selbsttest auf dem Gerät

Profil → „Datenschutz & Sicherheit“ → „Speicher prüfen“ (`src/core/database/selfTest.ts`) prüft
auf dem echten Gerät: verschlüsselte DB inkl. SQLCipher-Version, Schreiben/Lesen, Erhalt nach
App-Neustart (zweiter Lauf nach Neustart), Rollback einer Transaktion und die Schema-Version.
Er nutzt nur die technische Tabelle `diagnostics`.

## Android-Backup

**Entscheidung: Keine App-Daten verlassen das Gerät über automatische Android-Mechanismen.**

Umsetzung in `android/app/src/main/AndroidManifest.xml`:

```xml
android:allowBackup="false"
android:dataExtractionRules="@xml/data_extraction_rules"
```

| Mechanismus                                                                  | Android-Version | Verhalten                                            |
| ---------------------------------------------------------------------------- | --------------- | ---------------------------------------------------- |
| Auto Backup in die Google-Cloud                                              | bis Android 11  | aus (`allowBackup="false"`)                          |
| Auto Backup in die Google-Cloud                                              | ab Android 12   | aus (`<cloud-backup>` schließt alle Bereiche aus)    |
| Gerät-zu-Gerät-Übertragung (Kabel/WLAN beim Einrichten eines neuen Telefons) | ab Android 12   | aus (`<device-transfer>` schließt alle Bereiche aus) |

Wichtig: Ab Android 12 schaltet `allowBackup="false"` allein nur das Cloud-Backup ab, **nicht**
die Übertragung von Gerät zu Gerät. Deshalb schließen die `data_extraction_rules` zusätzlich
ausdrücklich alle Speicherbereiche aus: Datenbanken, Dateien, SharedPreferences, WebView-Daten
und den geräteverschlüsselten Speicher.

Begründung:

- Gesundheitsdaten sollen nicht unkontrolliert in einem Google-Backup landen, das der Nutzer
  nicht bewusst für diese App angelegt hat.
- Eine später verschlüsselte Datenbank ließe sich ohnehin nicht wiederherstellen: Der
  Schlüssel im Android Keystore wird nicht mitgesichert. Ein wiederhergestelltes Backup wäre
  also unlesbar und könnte den App-Start verhindern.
- Die kontrollierte Alternative ist der Datenexport und später die optionale Cloud-Sync.

Konsequenz für Nutzer: Beim Gerätewechsel werden Daten **nicht** automatisch übernommen, bis es
Export/Import oder Cloud-Sync gibt. Das wird in der App und in der Datenschutzerklärung
kommuniziert.

Hinweis: Hersteller-eigene Backup-Apps (z. B. Xiaomi-Backup) können eigene Wege nutzen, die
sich nicht vollständig über das Manifest steuern lassen. Ab der Verschlüsselung sind solche
Kopien ohne den Keystore-Schlüssel nicht lesbar.

Eine automatische Prüfung (`tests/nativeConfig.test.ts`) stellt sicher, dass diese
Konfiguration nicht versehentlich entfernt wird. Sie prüft außerdem, dass noch keine
Standort- oder Gesundheitsberechtigungen im Manifest stehen.

iOS: Daten liegen in `Library/CapacitorDatabase`. Dieser Ordner wird von iCloud- und
Computer-Backups erfasst. Das ist derzeit unkritisch (keine Gesundheitsdaten), muss aber vor der
Verschlüsselung entschieden werden. ⏳ Geprüfter Stand des Plugins:

- Die Passphrase wird im Keychain **ohne** eigenes Zugriffsattribut gespeichert, also mit dem
  iOS-Standard `kSecAttrAccessibleWhenUnlocked`. Solche Einträge werden mit **verschlüsselten**
  Backups auf ein neues Gerät übertragen. Das ermöglicht Wiederherstellung, heißt aber auch, dass
  Datenbank und Schlüssel gemeinsam im Backup liegen.
- `WhenUnlocked` bedeutet außerdem: Bei gesperrtem Bildschirm ist der Schlüssel nicht lesbar. Für
  GPS-Aufzeichnung im Hintergrund muss die Datenbank deshalb vor dem Sperren geöffnet bleiben
  oder Trackpunkte zwischengespeichert werden (siehe [GPS_ARCHITECTURE.md](GPS_ARCHITECTURE.md)).
- Entscheidung in Phase 2: entweder Datenbank per `isExcludedFromBackup` vom Backup ausschließen
  (konsequent wie Android) oder bewusst verschlüsselte iOS-Backups zulassen. Für ein anderes
  Keychain-Attribut (z. B. `…AfterFirstUnlockThisDeviceOnly`) müsste das Plugin angepasst
  werden.

## Datenlöschung (🟡 vorbereitet)

Die Architektur ermöglicht folgende Löschwege. Grundlage sind der Datenkatalog (Kategorie und
`deletedWithProfile`) und die Tombstone-Spalte `deleted_at` (siehe [DATABASE.md](DATABASE.md)).

| Löschweg                                                | Umsetzung                                                                                                          | Status     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| Einzelnen Eintrag löschen (z. B. eine Messung)          | Gewicht: nach Bestätigung physisch gelöscht (`WeightService.delete`); mit Sync kommen Tombstones                   | ✅ Gewicht |
| Alle Trainings / Ernährungs- / Gesundheitsdaten löschen | Alle Tabellen einer `category` aus dem Datenkatalog (`tablesInCategory`) in einer Transaktion leeren               | ⏳         |
| Komplettes lokales Profil löschen                       | Alle Tabellen mit `deletedWithProfile` leeren, danach neues leeres Profil anlegen                                  | ⏳         |
| Cloud-Konto und Cloud-Daten löschen                     | Serverseitige Löschung aller Zeilen des Kontos plus Auth-Konto (Supabase), danach lokales Profil wieder rein lokal | ⏳         |
| App deinstallieren                                      | Android und iOS löschen alle App-Daten; durch das deaktivierte Backup bleibt keine Kopie zurück                    | ✅         |

Endgültig löschen statt nur markieren: Lokal werden Tombstones gelöscht, sobald sie
synchronisiert sind – ohne Konto sofort.

## Datenexport (🟡 vorbereitet)

- Grundlage: Datenkatalog (`exportable`) → der Export weiß, welche Tabellen dazugehören, auch
  wenn neue Module hinzukommen.
- Geplantes Format: eine JSON-Datei mit einem Abschnitt je Tabelle, dazu ein Schema-Stand und
  eine Versionsangabe; zusätzlich CSV für Tabellenkalkulationen.
- Ausgabe über das System-Teilen-Menü (`@capacitor/filesystem` + Share). So entscheidet der
  Nutzer, wohin die Datei geht; es gibt keinen freien Dateizugriff.
- Import derselben Datei ermöglicht den Gerätewechsel ohne Cloud. ⏳

## Hinweis in der App (Phase 4.5)

Profil → Datenschutz & Sicherheit sagt seit Phase 4.5 statt „sendet keine Daten an Dritte“:
„Deine Daten werden verschlüsselt und nur auf diesem Gerät gespeichert. Die Lebensmittelsuche
läuft offline. Nur bei einem unbekannten Barcode wird dieser Barcode an Open Food Facts gesendet –
Tagebuch, Gewicht und Ziele nie.“ Das deckt sich mit Profil → Über Kalethra → Datenquellen.

## Lebensmittelsuche (Phase 4.4): offline

Die Suche nach Lebensmitteln läuft vollständig auf dem Gerät: eigene Lebensmittel, gespeicherte
Produkte und der in der App enthaltene Bundeslebensmittelschlüssel (BLS 4.0, Details in
[BLS.md](BLS.md)). Suchbegriffe verlassen das Gerät nie; ein Test prüft, dass dabei keine Anfrage
an Open Food Facts gestellt wird.

## Open Food Facts (Phase 4.3, seit 4.4 nur Barcode)

Barcode-Abfrage bei [Open Food Facts](https://world.openfoodfacts.org), nur wenn der Barcode auf
dem Gerät unbekannt ist. Details in [OPEN_FOOD_FACTS.md](OPEN_FOOD_FACTS.md).

| Wird gesendet                                        | Wird **nie** gesendet                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| Barcode (nur wenn er lokal unbekannt ist)            | Suchtext der Lebensmittelsuche                                      |
| Produkt-ID (= Barcode)                               | Körpergewicht, Größe, Alter/Geburtsdatum, Geschlecht, Wunschgewicht |
| technisch: App-Name/Version/Plattform als User-Agent | Kalorien-, Protein- und Makroziele, Wasserziel                      |
|                                                      | Ernährungstagebuch, gegessene Lebensmittel, Mahlzeiten, Vorlagen    |
|                                                      | Trainingsdaten, Profil-ID, Nutzer- oder Tracking-ID, Name           |

- Die Provider-Schnittstelle nimmt nur Barcode bzw. Produkt-ID entgegen – andere Daten können
  technisch nicht übergeben werden. Tests prüfen die tatsächlich gesendeten
  Anfragen (`openFoodFacts.test.ts`, `lookup.test.ts`, E2E).
- Keine Cookies (`credentials: omit`), kein HTTP-Cache, keine Analytics für Suchen, keine
  automatischen Wiederholungen.
- Open Food Facts sieht technisch die IP-Adresse des Geräts (wie bei jedem Webaufruf).
- Bereits gespeicherte Produkte werden lokal gefunden – ohne Anfrage.
- Automatisierte Tests senden nie echte Anfragen (Test-Setup blockiert externe Requests).

## Berechtigungen

| Berechtigung                  | Status                                                                                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internet (Android `INTERNET`) | Nur für die Barcode-Abfrage bei Open Food Facts (lokal unbekannter Barcode). Die Lebensmittelsuche braucht kein Internet. Sonst keine Verbindungen.                                                                               |
| Standort                      | nicht angefragt ⏳ (siehe [GPS_ARCHITECTURE.md](GPS_ARCHITECTURE.md))                                                                                                                                                             |
| Health Connect (Android)      | Nur nach Einschalten durch den Nutzer: Leserechte für Gewicht, Schritte, aktive Kalorien, Trainings (Aktivitäten) und Distanz. Keine Schreib-, Verlaufs- oder Hintergrundrechte. Details: [HEALTH_CONNECT.md](HEALTH_CONNECT.md). |
| HealthKit (iOS)               | nicht angefragt ⏳                                                                                                                                                                                                                |
| Kamera                        | Nur für den Barcode-Scanner; angefragt erst beim Öffnen des Scanners. Das Bild wird auf dem Gerät ausgewertet (Android ZXing, iOS Apple Vision), nicht gespeichert und nicht gesendet.                                            |
| Benachrichtigungen            | nicht angefragt ⏳                                                                                                                                                                                                                |

## Offene Punkte

1. iOS: Entscheidung Backup-Ausschluss bzw. Keychain-Attribut `…ThisDeviceOnly` (Plugin-Anpassung
   nötig) und iOS-Gerätetest.
2. Wiederherstellungsweg bei verlorenem Schlüssel (z. B. „Lokale Daten zurücksetzen“ mit
   ausdrücklicher Bestätigung) – aktuell nur Fehlerbildschirm.
3. Export/Import und Löschfunktionen vor Veröffentlichung.
4. Datenschutzerklärung, Einwilligungstexte, Store-Angaben (Google Play Data Safety, Apple
   Privacy Nutrition Label).
5. Für die spätere Cloud: Auftragsverarbeitungsvertrag, EU-Region, Löschkonzept für Tombstones.
