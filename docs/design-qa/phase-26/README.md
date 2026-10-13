# QA Phase 26 – Premium Visual Polish (0.39.0)

Produktions-Build in headless Chromium (Playwright) – **kein Gerätetest**. Daten je Lauf frisch:
Kalorienziel 2.000 kcal und Protein 120 g, dazu heute 0, 1.620 oder 2.600 kcal, vier
Gewichtseinträge und „Gut erholt“ (Dateiname `<Breite>-<Thema>-<kcal>-<Seite>.jpg`).

- 412 × 915 (Xiaomi-15-Ultra-Format, Statusleiste 40 px, Gestenleiste 24 px), hell und dunkel
- 390 × 844 hell
- 320 × 640 hell mit Systemschrift 130 %

| Datei                  | Inhalt                                                               |
| ---------------------- | -------------------------------------------------------------------- |
| `*-progress.jpg`       | Score-Ring (Verlauf, Lichtkante, gewölbte Mitte), Bereiche, Kalender |
| `*-1620-nutrition.jpg` | Kalorienziel-Ring bei 81 %, Ziel und Übrig daneben                   |
| `*-2600-nutrition.jpg` | über dem Ziel: voller Ring und schmalere zweite Runde, nie Rot       |
| `*-0-nutrition.jpg`    | ohne Daten: nur die Spur, nichts erfunden                            |
| `*-health.jpg`         | Gewichtsdiagramm mit weicher Fläche                                  |
| `*-training.jpg`       | Startaktion mit kräftigerem Verlauf und Glanz                        |

Zusätzlich behoben: In der Score-Karte brach „Regeneration“ bei 390 px neben dem Wert mitten im
Wort; der Wert steht jetzt am Ende des Balkens, der Name hat die ganze Zellbreite.

## Fotos

Kein Foto eingebunden. Am 13.10.2026 lieferte der Proxy der Build-Umgebung für alle geprüften
Bildquellen HTTP 403 (Netzwerkrichtlinie): `images.unsplash.com`, `unsplash.com`,
`images.pexels.com`, `www.pexels.com`, `commons.wikimedia.org`, `upload.wikimedia.org`,
`api.openverse.org`, `www.flickr.com`. Die Sperre wurde nicht umgangen; ohne Zugriff lassen sich
weder Bild noch Lizenz prüfen. Training, Ernährung und „Über Kalethra“ behalten die eigenen
Vektor-Szenen aus Phase 25. Für echte Fotos müssen mindestens `unsplash.com` und
`images.unsplash.com` (bzw. `www.pexels.com` und `images.pexels.com`) in den Netzwerkeinstellungen
der Umgebung freigegeben werden.
