# Herkunft – Kalethra-Muskelkarten

| Feld     | Angabe                                                                   |
| -------- | ------------------------------------------------------------------------ |
| Dateien  | `male-front.svg`, `male-back.svg`, `female-front.svg`, `female-back.svg` |
| Urheber  | Kalethra (eigene Zeichnung, erstellt in Phase 21 / Version 0.34.0)       |
| Quelle   | `tools/muscle-maps/build.mjs` – Stützpunkte, Spline-Glättung, Spiegelung |
| Vorlagen | keine: keine fremden Bilder, Atlanten, Modelle oder SVG-Sets übernommen  |
| Lizenz   | Teil des Kalethra-Quellcodes; keine Namensnennung Dritter erforderlich   |
| Laufzeit | gebündelt, offline; keine externen Verweise (von den Tests geprüft)      |

Die Dateien werden nicht von Hand bearbeitet, sondern mit
`node tools/muscle-maps/build.mjs` erzeugt; ein Test vergleicht sie byte-genau mit der Ausgabe
des Generators. Die männliche Zeichnung ist ein eigener, schematischer Entwurf nach allgemeinem
anatomischem Wissen (Lage und Umriss der oberflächlichen Muskeln); die weibliche entsteht daraus
mit weiblichen Proportionen und eigenen Details (Brustkontur, Haar, weniger Bauch-Zeichnung).
