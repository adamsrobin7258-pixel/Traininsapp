# QA Phase 18.5 – vorher (0.29.0) / nachher (0.29.1)

Desktop-Renderings mit dem App-Code und -Licht (headless Chromium, Software-WebGL/SwiftShader),
kein Gerätetest. Links jeweils 0.29.0, rechts 0.29.1. Erzeugt mit
`node tools/figures/qa/shoot.mjs <ordner> tools/figures/qa/shots-phase-18.5.json` (bei laufendem
`npx vite --port 5179`; für 0.29.0 die GLB aus dem Commit `912cd1d` über `glb=` laden).

| Bogen                                        | Inhalt                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| [01_back_pulldown.jpg](01_back_pulldown.jpg) | Latzug, Rücken/Schulter: seitlich, schräg hinten, hinten; oben, Zwischenlagen, unten  |
| [02_back_bench.jpg](02_back_bench.jpg)       | Bankdrücken, Schulter/Rücken von unten-seitlich: oben, Mitte, an der Brust            |
| [03_grip.jpg](03_grip.jpg)                   | Hand an der Stange: Latzug und Bankdrücken, je oben/Mitte/unten, von vorn/hinten/oben |
| [04_hands_rest.jpg](04_hands_rest.jpg)       | Hand in Ruhe: außen, innen, Daumenseite, Kleinfingerseite                             |
| [05_highlights.jpg](05_highlights.jpg)       | Highlights: Brust, Rücken, Bauch, Arme, Beine, Rücken schräg, Latzug, Bankdrücken     |
| [06_views.jpg](06_views.jpg)                 | Ruhepose vorn, ¾, seitlich, ¾ hinten, hinten                                          |

## Messungen (automatisiert, am gezeichneten Netz)

Skinning wie in der App (three.js), je Clip 7 Zeitpunkte (0, 0,4 … 2,2 s; 2,2 s = Umkehrpunkt).

| Messung                                                     | 0.29.0               | 0.29.1     |
| ----------------------------------------------------------- | -------------------- | ---------- |
| Latzug: tiefste lokale Delle Rücken/Schulter/Achsel¹        | 8,2–11,6 mm          | 3,7–7,4 mm |
| Latzug: stärkste lokale Wölbung                             | 18,5 mm              | 11,8 mm    |
| Bankdrücken: tiefste lokale Delle                           | 9,2–11,0 mm          | 3,9–8,3 mm |
| Hand-Vertices in der Stange (max. Tiefe)                    | bis 531 (13,9 mm)    | 0 (0 mm)   |
| Spalt Finger ↔ Stange, schlechtester Finger                 | – (Finger in Stange) | ≤ 1,8 mm   |
| Gefaltete Kanten > 75° im Ruhenetz (Haut, davon Kopf ≈ 290) | 1 365                | ≈ 1 090    |

¹ Jede Umgebung (3,5 cm entlang der Oberfläche) wird starr auf ihre Pose gelegt; der Rest
entlang der Normalen ist die Verformung durch das Skinning. Die Tests
(`kalethraBodies.test.ts`) prüfen Griff und Rücken (< 9 mm) in jeder CI.
