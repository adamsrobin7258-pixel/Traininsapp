# Kalethra – Marken-Assets

Eigene Zeichnung, erzeugt aus einer Quelle (`tools/brand/geometry.mjs`). Keine fremden Logos,
Schriften oder Vorlagen; keine Namensnennung Dritter erforderlich. Gestaltung und Regeln:
[docs/BRAND.md](../../docs/BRAND.md).

| Datei                       | Inhalt                                                    |
| --------------------------- | --------------------------------------------------------- |
| `kalethra-symbol.svg`       | Symbol (Hauptlogo), Waldgrün `#466a4c`, transparent       |
| `kalethra-symbol-ivory.svg` | Symbol in Elfenbein `#f3efe6` für dunkle Flächen          |
| `kalethra-wordmark.svg`     | Schriftzug „Kalethra“ allein (ergänzend, nie ohne Symbol) |
| `kalethra-logo.svg`         | Symbol und Schriftzug nebeneinander, Waldgrün             |
| `kalethra-logo-ivory.svg`   | dito in Elfenbein                                         |
| `kalethra-app-icon.svg`     | App-Icon-Vorlage: Symbol auf Waldgrün, 1024 px, randlos   |

Erzeugen (Vektoren, deterministisch; ein Test vergleicht byte-genau):

```
node tools/brand/build.mjs
```

Rasterbilder der Plattformen (Android-Launcher und Splash, iOS-Icon und Startbild) aus denselben
Daten, mit Playwright-Chromium und Python/Pillow:

```
node tools/brand/render.mjs
```
