# QA Phase 20.1 – Fortschritt (vorher 0.31.0 / nachher 0.32.0)

Je Bild links 0.31.0, rechts 0.32.0. Produktions-Build in headless Chromium (Playwright, mobile
Emulation, `reducedMotion: reduce`, frische Datenbank) – **kein Gerätetest**. Breiten 390 px und
320 px, hell und dunkel.

| Datei         | Zustand                                                            |
| ------------- | ------------------------------------------------------------------ |
| `*-empty.jpg` | Ohne Daten: Score leer, kompakte Bereichskarten (ganze Seite)      |
| `*-data.jpg`  | Ein Gewicht und eine Mahlzeit, Kalorienziel 2.200: Score vorläufig |
| `*-week.jpg`  | Zeitraum „7 Tage“ gewählt (Auswahlzustand)                         |
| `*-sheet.jpg` | Erklär-Sheet des Kalethra-Scores                                   |

Hinweis: In den Ganzseiten-Aufnahmen (`empty`, `data`) erscheint die fest positionierte
Tab-Leiste mitten im Bild – ein Effekt der Ganzseiten-Aufnahme, nicht der App. Dass die letzte
Karte vollständig über der Tab-Leiste erreichbar ist, prüft `e2e/progress.spec.ts`.
