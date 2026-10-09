# Gerätetest 3D-Körper (Xiaomi 15 Ultra)

**Status: noch nicht auf dem Gerät durchgeführt.** Geprüft wurde in Unit-Tests (jsdom), E2E
(Chromium) und mit QA-Renderings (headless Chromium, Software-WebGL/SwiftShader). Diese
Checkliste ist für den ersten Test auf dem Xiaomi 15 Ultra (Android, HyperOS) gedacht.

## Vorbereitung

1. Debug-APK `kalethra-<version>-debug.apk` aus dem CI-Artefakt `kalethra-debug-apk` des Commits
   laden (GitHub → Actions → CI-Lauf → Artifacts) und installieren
   (`adb install -r kalethra-<version>-debug.apk` oder Datei auf dem Gerät öffnen).
2. Für Messungen optional: USB-Debugging, `chrome://inspect` am Rechner (WebView-Konsole,
   Performance-Profil), `adb shell dumpsys gfxinfo com.kalethra.app` (Paketname laut
   `capacitor.config.ts`).
3. Profil: Geschlecht **männlich** (oder leer – männlich ist der Standard). Für den
   Gegencheck einmal **weiblich** (zeigt den unveränderten Körper aus 0.28.0).

## Wege zur Figur (keine neue Navigation)

- **Übungsdetails:** Training → Übungen → „Langhantel-Bankdrücken“ bzw. „Latzug“; auch aus einem
  abgeschlossenen Training (Training → abgeschlossenes Training öffnen → Übung antippen).
- **Trainings-Zusammenfassung:** Training starten → Freies Training → Übung (z. B. Latzug) →
  einen Satz abschließen → Training beenden → „Beanspruchte Muskeln“.
- Antippen der kleinen Figur („3D-Ansicht öffnen“) vergrößert sie; Zurück (Geste/Taste) oder
  Schließen kehrt zurück.

## Checkliste (25 Punkte)

| #   | Prüfung                                                                                       | Erwartet                                                                                                     |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | App-Start nach Installation, Version unter Einstellungen → App → „Über Kalethra“              | Version 0.29.0, kein Absturz                                                                                 |
| 2   | Bankdrücken-Details öffnen                                                                    | kleine Figur erscheint in < 2 s (erstes Laden), danach sofort; kein Fallback-Körper (eckig)                  |
| 3   | Anatomie in der kleinen Ansicht                                                               | ruhiger, athletischer Körper; Brust, Schulter, Arme, Bauch als Formen lesbar, nicht verrauscht               |
| 4   | Kleidung                                                                                      | anthrazitfarbenes ärmelloses Top und Shorts, eng anliegend, saubere Kanten an Hals/Armausschnitt             |
| 5   | Highlight Bankdrücken                                                                         | Brust deutlich (primär), Trizeps/Schulter dezenter (sekundär), Rest neutral; kein flächiger „Aufkleber“-Look |
| 6   | Antippen → große Ansicht                                                                      | Vergrößerung ohne Ruckeln, Animation läuft, genau eine Figur                                                 |
| 7   | Bankdrücken: Hände                                                                            | Finger umschließen die Stange, Stange liegt in der Hand (keine Lücke Hand ↔ Stange)                          |
| 8   | Bankdrücken: unterer Umkehrpunkt                                                              | Ellbogen ohne Knick/Durchdringung, Achsel und Brust ohne Falten durch den Stoff                              |
| 9   | Latzug: Arme oben                                                                             | Schulter hebt sich natürlich, Achsel/hintere Achselfalte/Latissimus ohne Kollaps                             |
| 10  | Latzug: Zug zur Brust                                                                         | Handgelenk ohne Verdrehung, Griff bleibt an der Stange, Kabel folgt                                          |
| 11  | Hüfte/Knie im Sitzen (Latzug) und Liegen (Bank)                                               | keine Durchdringung von Oberschenkel/Polster, Knie ohne starken Volumenverlust                               |
| 12  | Drehen per Wischen, Vorder-/Rückseite-Taste                                                   | flüssig, Rücken mit Latissimus/Trapez sichtbar, Figur und Gerät drehen gemeinsam                             |
| 13  | Animation anhalten/abspielen                                                                  | stoppt/läuft ohne Sprung                                                                                     |
| 14  | Flüssigkeit der Animation (große Ansicht, 30 s)                                               | gleichmäßig (Ziel ≥ 50 fps, keine Hänger > 100 ms), Gerät wird nicht spürbar warm                            |
| 15  | Zurück-Geste in der großen Ansicht                                                            | zurück zu den Details, App wird nicht verlassen                                                              |
| 16  | Übungswechsel: Bankdrücken ↔ Latzug ↔ Übung ohne Clip (z. B. Kniebeuge) 10×                   | jeweils passender Clip bzw. Ruhepose ohne Gerät; keine Verzögerung, die mit der Zeit zunimmt                 |
| 17  | Groß ↔ klein 20× öffnen/schließen                                                             | keine Warnung „Too many active WebGL contexts“ (Konsole), kein schwarzes Bild                                |
| 18  | App in den Hintergrund, 1 min, zurück (große Ansicht offen)                                   | Figur erscheint wieder (Kontext neu), kein schwarzer Bereich, kein Absturz                                   |
| 19  | Trainings-Zusammenfassung „Beanspruchte Muskeln“                                              | kleine Figur mit Latissimus primär; Antippen vergrößert, Schließen zurück zur Zusammenfassung                |
| 20  | Dunkles/helles Systemdesign                                                                   | Figur bleibt gut lesbar, Licht und Kontrast stimmig                                                          |
| 21  | System-Einstellung „Animationen entfernen“ (Reduced Motion)                                   | große Ansicht startet angehalten, Abspielen-Taste vorhanden                                                  |
| 22  | Flugmodus, App neu starten, Figur öffnen                                                      | lädt vollständig offline                                                                                     |
| 23  | Profil auf weiblich, Figur öffnen                                                             | weiblicher Körper (wie 0.28.0), keine Fehlermeldung; zurück auf männlich                                     |
| 24  | Einstellungen → App → Datenquellen                                                            | Abschnitt „3D-Körper“ mit CC-BY-4.0-Nennung (sphere_joe, Titel, Lizenz, „bearbeitet“)                        |
| 25  | Speicher: 5 min wechselnd öffnen/schließen, dann `adb shell dumpsys meminfo com.kalethra.app` | Speicher steigt nicht stetig weiter (kein Leck); keine Fehler in der WebView-Konsole                         |

## Bekannte Risiken auf dem Gerät

- **GPU/Treiber:** geprüft nur mit Software-WebGL; Unterschiede bei Normal-Map (Tangenten),
  Gamma und Tone-Mapping auf der Adreno-GPU sind möglich (Punkte 3, 5, 20).
- **Erstes Laden:** 3,1 MB GLB plus Normal-Map-Dekodierung (2048² PNG) – auf dem Gerät schnell
  erwartet, aber nicht gemessen (Punkt 2).
- **Kontextverlust im Hintergrund:** HyperOS beendet WebViews aggressiver; der Wiederaufbau ist
  getestet, aber nicht auf HyperOS (Punkt 18).
- **Hohe Pixeldichte:** Pixelverhältnis ist auf 2 begrenzt; bei 3,2× Displaydichte etwas
  weichere Kanten als nativ (gewollt, Leistung).
- **Nahansicht:** leichte Ausfransungen an Stoffkanten, weiches Gesicht, handschuhartige Hände
  (bekannt, siehe `assets/figure/docs/README.md`).

## Ergebnis eintragen

Datum, App-Version, Commit, HyperOS-/Android-Version, je Punkt ✓/✗ mit kurzer Notiz und bei ✗
ein Bildschirmfoto. Abweichungen als Issue mit dem Punkt-Nummer-Präfix („Gerät #8: …“).
