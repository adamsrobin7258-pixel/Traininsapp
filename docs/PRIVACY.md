# Datenschutz in Kalethra

Stand: Phase 1.1. Dieses Dokument beschreibt Grundsätze und technische Entscheidungen. Es ist
**keine** Datenschutzerklärung für Nutzer – die wird vor der Veröffentlichung auf Basis dieses
Dokuments erstellt und rechtlich geprüft.

Kennzeichnung: ✅ umgesetzt · 🟡 vorbereitet (Struktur vorhanden) · ⏳ geplant

## Grundsätze

| Grundsatz                     | Bedeutung                                                                                                                                                              | Status |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Local-first**               | Alle Nutzerdaten entstehen und liegen in der lokalen SQLite-Datenbank auf dem Gerät.                                                                                   | ✅     |
| **Offline nutzbar**           | Jede Funktion funktioniert ohne Internet und ohne Konto.                                                                                                               | ✅     |
| **Cloud optional**            | Synchronisierung nur nach Registrierung und ausdrücklicher Zustimmung. Aktuell gibt es keine Cloud-Anbindung (`LocalOnlySyncService`).                                 | 🟡     |
| **Datenminimierung**          | Es werden nur Daten erfasst, die eine Funktion tatsächlich braucht.                                                                                                    | ✅     |
| **Keine Weitergabe**          | Die App enthält keine Analytics-, Tracking-, Crash-Reporting- oder Werbe-SDKs und sendet keine Daten an Dritte. Die App baut derzeit **keine** Netzwerkverbindung auf. | ✅     |
| **Keine Werbung**             | Keine Werbung, keine Werbe-IDs.                                                                                                                                        | ✅     |
| **Keine KI**                  | Keine KI-Funktionen, keine Übermittlung an KI-Dienste.                                                                                                                 | ✅     |
| **Kein automatisches Backup** | Android-Auto-Backup und Geräteübertragung sind für alle App-Daten abgeschaltet (siehe unten).                                                                          | ✅     |

Neue Abhängigkeiten, die Netzwerkzugriff haben (SDKs, Plugins), brauchen eine Begründung im
Pull Request und einen Eintrag in diesem Dokument.

## Welche Daten gibt es?

### Aktuell gespeichert (Schema-Version 1)

| Tabelle             | Inhalt                                      | Sensibilität    |
| ------------------- | ------------------------------------------- | --------------- |
| `schema_migrations` | Technischer Stand der Datenbank             | technisch       |
| `app_settings`      | Erscheinungsbild, Sprache                   | technisch       |
| `profiles`          | Lokale Profil-ID (UUID), optionaler Vorname | personenbezogen |

Es werden **noch keine Gesundheits-, Trainings-, Ernährungs- oder Standortdaten** gespeichert.

### Künftig (⏳ geplant, noch nicht implementiert)

| Daten                                  | Kategorie        | Sensibilität                                                       |
| -------------------------------------- | ---------------- | ------------------------------------------------------------------ |
| Gewicht, Körperfett, Muskelmasse       | Gesundheit       | Gesundheitsdaten (Art. 9 DSGVO)                                    |
| Herzfrequenz, Ruhepuls                 | Gesundheit       | Gesundheitsdaten                                                   |
| Schlaf, Regeneration                   | Gesundheit       | Gesundheitsdaten                                                   |
| Schritte, aktive Energie               | Aktivität        | Gesundheitsdaten                                                   |
| Trainingseinheiten, Leistungswerte     | Training         | Gesundheitsdaten (Rückschlüsse auf körperliche Verfassung)         |
| Mahlzeiten, Nährwerte                  | Ernährung        | Gesundheitsdaten (Rückschlüsse auf Ernährung/Erkrankungen möglich) |
| GPS-Tracks, Routen                     | Standort         | Standortdaten – verraten Wohnort, Arbeitsplatz und Gewohnheiten    |
| Importe aus HealthKit / Health Connect | je nach Datenart | Gesundheitsdaten                                                   |

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

**Status: nicht aktiv – bewusst.** Aktuell liegen nur Einstellungen und ein optionaler Vorname
in der Datenbank.

### Prüfergebnis

| Frage                                              | Ergebnis                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unterstützt die verwendete Lösung Verschlüsselung? | Ja. `@capacitor-community/sqlite` bringt SQLCipher mit: Android `net.zetetic:sqlcipher-android` (im CI-Build bereits als `libsqlcipher.so` enthalten), iOS `SQLCipher.swift` per Swift Package Manager. |
| Schlüsselablage                                    | Das Plugin speichert die Passphrase selbst: iOS im **Keychain**, Android in **EncryptedSharedPreferences** (Schlüssel im Android Keystore).                                                             |
| Unterstützt unsere Architektur das?                | Ja. Nur `src/core/database/drivers/capacitorSqlite.ts` müsste sich ändern (Verbindung mit `encrypted = true`, Modus `secret`/`encryption`). Repositories und Module bleiben unverändert.                |
| Browser (Entwicklung)                              | `jeep-sqlite` unterstützt keine Verschlüsselung. Unkritisch, weil der Browser kein Produktziel ist; muss aber in der Treiberlogik berücksichtigt werden.                                                |

### Warum nicht schon jetzt?

1. **Nicht auf Geräten testbar in dieser Phase.** Ein Fehler in der Schlüsselverwaltung macht
   die Datenbank unlesbar – die App startet dann nicht mehr. Das darf nicht ungetestet
   ausgeliefert werden, besonders nicht auf Geräten mit angepasstem Android (z. B. Xiaomi
   HyperOS), bei denen Keystore-Probleme bekannt sind.
2. **Es gibt noch keine schützenswerten Gesundheitsdaten.**
3. **Offene Fragen, die vorher entschieden werden müssen:** Die Android-Seite des Plugins nutzt
   `androidx.security:security-crypto` (EncryptedSharedPreferences). Google hat diese Bibliothek
   als veraltet markiert. Sie funktioniert, ist aber langfristig ein Wartungsrisiko.
   Außerdem braucht es eine Wiederherstellungsstrategie, falls der Schlüssel verloren geht
   (z. B. nach Zurücksetzen des Keystores durch das System).

Eine halbfertige Verschlüsselung wäre schlechter als keine, weil sie Sicherheit vortäuscht.

### Plan (⏳ Phase 2, **vor** der ersten Gesundheitstabelle)

1. Zufällige Passphrase mit `crypto.getRandomValues` (256 Bit) erzeugen – **keine** eigene
   Kryptografie, nur Zufallserzeugung der Plattform.
2. Einmalig per `setEncryptionSecret` an das Plugin übergeben. Ab dann verwaltet das Plugin sie
   im Keychain bzw. Keystore.
3. Die bestehende unverschlüsselte Datenbank mit dem Plugin-Modus `encryption` verschlüsseln
   (Migration vorhandener Daten).
4. Verhalten bei fehlendem Schlüssel festlegen und im Startfehler-Bildschirm abbilden.
5. Auf echten Geräten testen, auch auf dem Xiaomi 15 Ultra, und zwar: Neuinstallation,
   Update und Neustart des Geräts.
6. Danach `LOCAL_DATABASE_ENCRYPTED = true` setzen. Erst dann lassen die Tests
   Gesundheitstabellen zu.

Falls sich die Plugin-Lösung auf Android als instabil erweist, wird Alternativen der Vorzug
gegeben, die den Schlüssel direkt im Android Keystore halten. Selbst entwickelte
Kryptografie ist ausgeschlossen.

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
`deletedWithProfile`) und die Tombstone-Spalte `deleted_at` (siehe [DATABASE.md](../DATABASE.md)).

| Löschweg                                                | Umsetzung                                                                                                          | Status |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| Einzelnen Eintrag löschen (z. B. eine Messung)          | Repository setzt `deleted_at`; wird bei Sync an den Server weitergegeben und später endgültig entfernt             | ⏳     |
| Alle Trainings / Ernährungs- / Gesundheitsdaten löschen | Alle Tabellen einer `category` aus dem Datenkatalog (`tablesInCategory`) in einer Transaktion leeren               | ⏳     |
| Komplettes lokales Profil löschen                       | Alle Tabellen mit `deletedWithProfile` leeren, danach neues leeres Profil anlegen                                  | ⏳     |
| Cloud-Konto und Cloud-Daten löschen                     | Serverseitige Löschung aller Zeilen des Kontos plus Auth-Konto (Supabase), danach lokales Profil wieder rein lokal | ⏳     |
| App deinstallieren                                      | Android und iOS löschen alle App-Daten; durch das deaktivierte Backup bleibt keine Kopie zurück                    | ✅     |

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

## Berechtigungen

| Berechtigung                  | Status                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Internet (Android `INTERNET`) | Von Capacitor standardmäßig deklariert, damit der WebView funktioniert. Die App baut aktuell selbst keine Verbindungen auf. |
| Standort                      | nicht angefragt ⏳ (siehe [GPS_ARCHITECTURE.md](GPS_ARCHITECTURE.md))                                                       |
| Health Connect / HealthKit    | nicht angefragt ⏳                                                                                                          |
| Kamera, Benachrichtigungen    | nicht angefragt ⏳                                                                                                          |

## Offene Punkte

1. Datenbankverschlüsselung umsetzen und auf Geräten testen (Pflicht vor Gesundheitsdaten).
2. iOS: Backup-Ausschluss der Datenbank entscheiden.
3. Export/Import und Löschfunktionen umsetzen, bevor die App veröffentlicht wird.
4. Datenschutzerklärung, Einwilligungstexte und Store-Angaben (Google Play Data Safety,
   Apple Privacy Nutrition Label) erstellen.
5. Für die spätere Cloud: Auftragsverarbeitungsvertrag, EU-Region, Löschkonzept für Tombstones.
