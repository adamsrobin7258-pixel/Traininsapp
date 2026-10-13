# QA Phase 25 – Natürliches Premium-Design (0.38.0)

Produktions-Build in headless Chromium (Playwright), frische Datenbank – **kein Gerätetest**.

- Xiaomi-15-Ultra-Format 412 × 915 mit Statusleiste 40 px und Gestenleiste 24 px, hell und dunkel
- Kleines Display 320 × 640 mit Systemschrift 130 % (`320-130pct-*`)

| Datei                     | Inhalt                                                                |
| ------------------------- | --------------------------------------------------------------------- |
| `412-*-progress.jpg`      | Fortschritt: Score-Karte, Kalender, Logo-Plakette, warmes Seitenlicht |
| `412-*-training.jpg`      | Training ohne Plan: Berg-Szene, „Training starten“                    |
| `412-*-training-next.jpg` | Training mit Plan: „Nächstes Training“ auf der Szene                  |
| `412-*-active.jpg`        | Laufendes Training: keine Szene, Steuerung unverändert                |
| `412-*-summary.jpg`       | Trainingsabschluss mit Erfolgs-Plakette, Muskelkarte unverändert      |
| `412-*-nutrition.jpg`     | Ernährung: Szene „harvest“ (Schale), Tagesübersicht                   |
| `412-*-health.jpg`        | Gesundheit: ruhig, ohne Bild                                          |
| `412-*-settings.jpg`      | Einstellungen: Profilkarte, Liste                                     |
| `412-*-app.jpg`           | Einstellungen → App (ganze Seite): „Über Kalethra“ mit Wiesen-Szene   |
| `320-130pct-light-*.jpg`  | 320 px, Schrift 130 %: Logo ausgeblendet, fünf Tabs passen            |

## Bilder und Lizenzen

Es ist **kein Foto** eingebunden. Unsplash und Pexels (`images.unsplash.com`, `unsplash.com`,
`images.pexels.com`, `www.pexels.com`) waren aus der Build-Umgebung nicht erreichbar
(Netzwerkrichtlinie, HTTP 403); Lizenzen ließen sich daher weder prüfen noch Dateien laden.
Stattdessen zeichnen drei eigene Vektor-Szenen (`src/ui/illustrations/SceneArt.tsx`:
`mountains`, `harvest`, `meadow`) die Atmosphäre – eigene Arbeit im Rahmen dieses Projekts, keine
fremde Vorlage, keine Namensnennung nötig. Sie liegen als Code im Bundle (keine Bilddatei, keine
Bildanfrage) und funktionieren offline; der E2E-Test `e2e/design.spec.ts` prüft, dass die Seiten
keine Anfrage außerhalb der App stellen.

Sollen später Fotos folgen: Regeln in [DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md#bilder-und-illustrationen)
(lokal unter `public/visuals/<bereich>/`, `ATTRIBUTION.md` je Ordner, nie zur Laufzeit aus dem Netz).
