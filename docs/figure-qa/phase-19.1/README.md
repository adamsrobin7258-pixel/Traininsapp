# QA Phase 19.1 – vorher (0.30.0) / nachher (0.30.1)

Desktop-Renderings mit dem App-Code und -Licht (headless Chromium, **Software-WebGL/SwiftShader**),
**kein Gerätetest**. Je Paar links 0.30.0, rechts 0.30.1, gleiche Kamera und Beleuchtung. Erzeugt mit
`node tools/figures/qa/shoot.mjs <ordner> tools/figures/qa/shots-phase-19.1.json` (bei laufendem
`npx vite --port 5179`; für 0.30.0 die GLB aus dem Commit `e7eede1` über `glb=` laden).

| Bogen                                            | Inhalt                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| [01_male_neck.jpg](01_male_neck.jpg)             | Nacken/Trapez hinten, schräg hinten, seitlich; Vorderseite als Kontrolle |
| [02_male_views.jpg](02_male_views.jpg)           | Ruhepose hinten, ¾ hinten, seitlich, vorn                                |
| [03_male_pulldown.jpg](03_male_pulldown.jpg)     | Latzug hinten und schräg hinten, oben / Mitte / unten                    |
| [04_male_bench.jpg](04_male_bench.jpg)           | Bankdrücken von unten-seitlich, oben / Mitte / an der Brust              |
| [05_female_neck.jpg](05_female_neck.jpg)         | Kopf-Hals-Übergang hinten, schräg, seitlich; Vorderseite als Kontrolle   |
| [06_female_views.jpg](06_female_views.jpg)       | Ruhepose hinten, ¾ hinten, seitlich, vorn                                |
| [07_female_pulldown.jpg](07_female_pulldown.jpg) | Latzug hinten und schräg hinten                                          |
| [08_female_bench.jpg](08_female_bench.jpg)       | Bankdrücken                                                              |

## Ursachen (bestätigt) und Korrektur

| #   | Befund                                                  | Ursache                                                                                                                                                                                                                                 | Korrektur (`tools/figures/lib/repair.mjs`)                                           |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| R1  | männlich: Knitter an Nacken und oberem Trapez hinten    | Geometrie (bleibt ohne Normal-Map) **und** Sculpt-Relief der Detail-Normal-Map: die Übertragung auf den Sculpt (`transfer.mjs`) hinterlässt Wellen < 70°, die `relaxFolds` nicht erfasst; das Sculpt-Relief ist dort selbst zerknittert | Glättung entlang der Normalen (Taubin, ≤ 6 mm), Relief dort auf 20 %                 |
| R2  | männlich: Delle/Furchen an hinterer Schulter und Achsel | überwiegend Sculpt-Relief (ohne Normal-Map fast glatt), dazu gefaltete Dreiecke an der Achsel                                                                                                                                           | Glättung, Entfalten der Achsel, Relief an der hinteren Schulter auf 20 %             |
| R3  | weiblich: zackiger Übergang Hinterkopf–Hals             | `smoothHead` (`pose.mjs`) zieht Hals-Vertices mit anteiligem Kopf-Gewicht radial auf das Kopfprofil; hinten verläuft diese Richtung fast entlang der Haut, Dreiecke schieben sich übereinander                                          | gefaltete Dreiecke im Band hinten/seitlich entfalten (nicht im Gesicht)              |
| R3  | weiblich: kleine Spitzen an der hinteren Achsel         | gefaltete Hautdreiecke am Armausschnitt                                                                                                                                                                                                 | Entfalten im Bereich um das Schultergelenk                                           |
| R4  | gezackter Halsausschnitt des Tops                       | Stoffgrenze folgt dem Polygonraster; der 5-mm-Saum wiederholt den Zickzack                                                                                                                                                              | Nahtkette entlang ihres Verlaufs geglättet, Saum folgt; männlich bleiben zwei Stufen |

Korrigiert aus der Analyse vor Phase 19.1: Die „offenen Hautkanten“ am Hals (R1) waren **kein
Fehler** – unter dem Top ist die Haut ausgespart, der Saum schließt das Netz. Über Haut und Stoff
gemessen sind beide Körper geschlossen (Test). Die Beleuchtung wurde nicht verändert.

## Messungen (Ruhepose, Regionen aus den Gelenken, `bodySurface.test.ts`)

| Messung                                                       | 0.30.0   | 0.30.1 |
| ------------------------------------------------------------- | -------- | ------ |
| männlich, Nacken hinten: Knicke > 30° zwischen Hautdreiecken  | 83       | 49     |
| männlich, hintere Schulter: gefaltete Dreiecke / Knicke > 30° | 25 / 173 | 0 / 80 |
| männlich, Achsel: gefaltete Dreiecke                          | 58       | 0      |
| weiblich, Kopf–Hals hinten: gefaltete Dreiecke / Knicke > 30° | 30 / 66  | 0 / 1  |
| weiblich, Nacken hinten: Knicke > 30°                         | 54       | 9      |
| weiblich, hintere Schulter / Achsel: gefaltete Dreiecke       | 97 / 219 | 0 / 0  |
| weiblich, Kopf–Hals in Latzug/Bankdrücken: Knicke > 60°       | 51       | 0      |
| Kontrolle männlich, Brust vorn: Knicke > 30°                  | 8        | 8      |
| Offene Kanten über Haut + Stoff (beide)                       | 0        | 0      |

Unverändert grün: Griff (keine Hand in der Stange), Rücken in Bewegung (< 9 mm), weiche
Hervorhebung, Validator und Budgets.

## Offen

- männlich: zwei kleine Stufen unten am hinteren Halsausschnitt (Topologie der Stoffgrenze; nur
  im Neubau der Segmentierung sauber lösbar).
- weiblich: der Armausschnitt des Tops franst bei hoch gehobenem Arm aus (Latzug); vorher wie
  nachher, nicht Teil dieser Phase.
- Gesamtbuild aus den MakeHuman-Quellen in dieser Umgebung nicht ausgeführt (Download nicht
  erlaubt); der Reparaturschritt ist als letzter Build-Schritt eingebunden und wurde auf die
  ausgelieferten Dateien angewendet (`node tools/figures/repair.mjs`).
