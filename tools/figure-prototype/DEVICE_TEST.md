# Gerätetest Prototyp 1A – Xiaomi 15 Ultra

Branch `claude/figure-prototype-device-test`. Der Prototyp ist **nicht** in der App und nicht in
der APK: Er läuft als eigene Seite im Browser des Handys, ausgeliefert vom Entwicklungsserver auf
deinem Rechner. Die App und ihre Figuren bleiben unverändert.

## 1. Auf dem Rechner starten (einmalig ca. 5 Minuten)

Voraussetzung: Node 22 (wie `.nvmrc`), Git, Rechner und Handy im **selben WLAN**.

```
git fetch origin
git checkout claude/figure-prototype-device-test
npm ci
npx vite --host
```

Vite zeigt zwei Adressen, z. B.

```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.178.23:5173/
```

Die **Network**-Adresse ist die richtige fürs Handy. Windows fragt beim ersten Start nach der
Firewall – „Private Netzwerke“ erlauben, sonst erreicht das Handy den Rechner nicht.

## 2. Auf dem Xiaomi öffnen

In **Chrome** (nicht im Mi-Browser – der verhält sich bei WebGL anders):

```
http://<Network-Adresse>:5173/tools/figure-prototype/viewer/
```

Die Figur-Datei hat 23 MiB; das erste Laden dauert im WLAN ein paar Sekunden.

## 3. Was prüfen

Bitte jeden Punkt mit **ok / Problem + Screenshot** zurückmelden.

| #   | Aktion                                                                | Worauf achten                                                                                                                                                      |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Seite öffnen                                                          | Figur erscheint in Hautansicht (Standard), Bankdrücken läuft                                                                                                       |
| 2   | Unter der Figur den Messblock ablesen                                 | „GPU:“ zeigt Adreno (nicht SwiftShader); „Fehler: keine“                                                                                                           |
| 3   | **Rückseite zeigen** / **Vorderseite zeigen**                         | Drehung sauber, Ansicht (Haut/Muskeln) bleibt erhalten                                                                                                             |
| 4   | Mit dem Finger über die Figur ziehen                                  | dreht flüssig                                                                                                                                                      |
| 5   | **Muskeln zeigen**                                                    | Haare und Tuch verschwinden, Muskeln mit Fugen und Faserstruktur; keine Löcher, kein Flimmern                                                                      |
| 6   | **Haut zeigen**                                                       | zurück, gleiche Pose, kein Springen                                                                                                                                |
| 7   | Übung **Ruhe (keine Hervorhebung)** + Muskelansicht, vorne und hinten | alle 13 Gruppen in eigener Farbe: Brust, Schultern, Bizeps, Trizeps, Unterarme, oberer Rücken, Latissimus, Bauch, Gesäß, Quadrizeps, Beinbeuger, Adduktoren, Waden |
| 8   | Übung **Bankdrücken**                                                 | Hervorhebung: Brust kräftig, Trizeps/Schultern mittel, Rest gedämpft – in beiden Ansichten                                                                         |
| 9   | Übung **Latzug**                                                      | Latissimus kräftig, Bizeps/oberer Rücken mittel; Achsel beim Hochziehen ansehen                                                                                    |
| 10  | **Pause / Abspielen**                                                 | Clip stoppt und läuft weiter; Ellbogen unten im Bankdrücken ansehen                                                                                                |
| 11  | Nah heranhalten (Zoom mit zwei Fingern in Chrome)                     | Gesicht, Haare, Tuch, Steinoptik: Wirkung, Kanten, Glanz                                                                                                           |
| 12  | 1 Minute laufen lassen, Messblock erneut ablesen                      | Bildrate, langsamstes Bild; wird das Handy warm?                                                                                                                   |

## 4. Messwerte im Messblock

| Wert                                    | Art                                                                 |
| --------------------------------------- | ------------------------------------------------------------------- |
| GPU                                     | vom Browser gemeldet                                                |
| Laden gesamt / Download                 | **gemessen** (Download inkl. WLAN)                                  |
| Bildrate, langsamstes Bild (letzte 5 s) | **gemessen**                                                        |
| Dreiecke/Bild, Geometrien, Texturen     | von three.js gezählt                                                |
| JS-Speicher                             | **gemessen** (Chrome meldet ihn auf Android)                        |
| Grafikspeicher ca. 117 MiB              | **Schätzung** aus der Datei – Browser melden den GPU-Speicher nicht |

## 5. Bekannt, bitte trotzdem melden

- Grafikspeicher und Dateigröße weit über dem Produktionsbudget (Prototyp ohne Optimierung).
- Achsel beim Latzug und Ellbogen unten beim Bankdrücken verformen sich noch sichtbar.
- Haare wirken kappenartig; an der unteren Brustfuge kann ein kleiner Rest sichtbar sein.
- In der Muskelansicht ist der Intimbereich glatt (keine Anatomie, kein Tuch) – bewusst so.
