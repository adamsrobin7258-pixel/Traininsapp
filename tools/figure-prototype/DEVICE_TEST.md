# Gerätetest Prototyp 1A – Xiaomi 15 Ultra

Branch `claude/figure-prototype-device-test`. Der Prototyp ist **nicht** in der App und nicht in
der APK: Er läuft als eigene Seite im Browser des Handys, ausgeliefert vom Entwicklungsserver auf
deinem Rechner. Die App und ihre Figuren bleiben unverändert.

Zwei Wege: **A – ohne PC** über die Test-App (empfohlen) oder **B – mit PC** über den
Entwicklungsserver (Abschnitte 1 und 2). Die Prüfpunkte ab Abschnitt 3 gelten für beide.

## A. Ohne PC: Test-App „Kalethra Figur-Test“

Eigene Android-App nur für diesen Test: Paket-ID `com.kalethra.figureprototype`, Name „Kalethra
Figur-Test“. Sie enthält den Viewer und die Prototyp-Figur lokal, läuft im Flugmodus und
installiert sich **neben** Kalethra – deine Kalethra-App und ihre Daten bleiben unberührt (eigene
App, eigener Speicher). Berechtigungen: nur Internet (technisch für die Capacitor-Hülle; der
Viewer lädt nichts aus dem Netz), keine Kamera, kein Health Connect.

Gebaut wird sie von GitHub Actions (Workflow „Figure prototype APK“, nur Branch
`claude/figure-prototype-apk`). Der Workflow bricht ab, wenn Paket-ID, Name, Berechtigungen,
eingebettete Figur oder Offline-Prüfung nicht stimmen.

**Herunterladen (im Chrome auf dem Xiaomi):**

1. github.com öffnen und **anmelden** (Artefakte gibt es nur angemeldet).
2. Repository → **Actions** → links **„Figure prototype APK“** → obersten grünen Lauf öffnen.
3. Ganz unten unter **Artifacts** auf **`kalethra-FIGUR-TEST-1db10ca`** tippen. Es kommt eine
   ZIP-Datei (ca. 16 MB). Tipp: Wenn die Seite die Artefakte nicht zeigt, „Desktop-Website“ im
   Chrome-Menü einschalten.

**Achtung, nicht verwechseln:** Im normalen Workflow „CI“ desselben Branches gibt es auch eine
`kalethra-debug-apk` – das ist die **normale Kalethra-App** und würde deine installierte App
überschreiben. Nur die Datei mit **FIGUR-TEST** im Namen installieren.

**Installieren:**

1. App **„Dateien“** (Xiaomi) → Downloads → ZIP antippen → **Entpacken**.
2. `kalethra-FIGUR-TEST-1db10ca.apk` antippen.
3. Beim ersten Mal fragt Android, ob „Dateien“ **unbekannte Apps installieren** darf → für diese
   App erlauben (Einstellungen → Apps → Spezielle App-Berechtigungen → Unbekannte Apps
   installieren). Danach zurück und erneut antippen.
4. HyperOS-Sicherheitsprüfung bzw. Google Play Protect warnen, weil die App nicht aus dem Play
   Store kommt und mit dem Debug-Schlüssel signiert ist → **„Trotzdem installieren“**. Fragt
   HyperOS nach einer Wartezeit oder einem Mi-Konto, ist das normal.
5. Auf dem Startbildschirm erscheint **„Kalethra Figur-Test“** (gleiches Symbol wie Kalethra,
   anderer Name). Öffnen – das erste Laden dauert ein paar Sekunden.
6. Optional: Flugmodus einschalten und die App neu starten – sie muss genauso funktionieren.

Danach mit Abschnitt 3 weitermachen. Hinweis: In der Test-App ist die Seite nicht im Chrome,
sondern in der Android-WebView (gleiche Chromium-Technik). Falls „Zoom mit zwei Fingern“ (Punkt 11)
dort nicht geht: Screenshot machen und im Foto hineinzoomen.

**Entfernen:** „Kalethra Figur-Test“ lange drücken → Deinstallieren. Kalethra bleibt.

## B. Mit PC

### 1. Auf dem Rechner starten (einmalig ca. 5 Minuten)

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

### 2. Auf dem Xiaomi öffnen

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
