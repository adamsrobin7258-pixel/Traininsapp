# Designsystem

Leitbild (seit Phase 4.5): **modern · ruhig · hochwertig · menschlich · unkompliziert.** Kalethra
soll wie ein bewusst gestaltetes Produkt wirken – nicht wie eine Fitness-App, nicht wie ein
Dashboard-Template. Inhalte tragen die Gestaltung; Farbe, Illustration und Form ergänzen sie
sparsam.

Festgelegte Richtung: **A1** Salbeigrün, warm und natürlich · **B2** kleine, erkennbare
Lebensmittel-Illustrationen · **C1** organische Formen sehr dezent · **D1** Heute ruhig und
minimal, aber visuell angereichert.

## Prinzipien

1. **Typografie vor Dekoration.** Hierarchie entsteht durch Schriftgröße, Gewicht und Abstand,
   nicht durch Rahmen, Schatten oder Verläufe.
2. **Eine Akzentfarbe, sparsam eingesetzt.** Sie markiert „aktiv/heute/wichtig“ – nie Flächen
   um ihrer selbst willen.
3. **Flächen statt Karten.** Inhalte liegen auf ruhigen, randlosen Flächen (`--color-surface`)
   ohne Schatten. Trennung über feine Haarlinien.
4. **Leere Zustände sind ehrlich.** Fehlende Werte zeigen einen neutralen Strich („–“), keine
   erfundenen Beispieldaten.
5. **Einhandbedienung.** Navigation unten, Touch-Ziele mindestens 44 pt, wichtige Aktionen in
   der unteren Bildschirmhälfte.
6. **Zurückhaltende Bewegung.** Nur kurze Farb-/Zustandsübergänge (120–200 ms). Bei
   „Bewegung reduzieren“ entfallen sie.

7. **Große Zahl, kleine Beschriftung.** Je Bildschirm höchstens eine Display-Zahl
   (`--font-size-display`), z. B. die Kalorien; Beschriftungen bleiben klein und ruhig.
8. **Karten nur mit Grund.** Ein Container nur, wenn er gruppiert, antippbar ist oder die
   Hierarchie verbessert; Kennzahlen liegen direkt auf dem Hintergrund.

Ausdrücklich vermeiden: aggressive Fitness-Optik, Neonfarben, große Farbverläufe, Gamification,
Emojis als Icons, Stock-Fotos, 3D-Icons, Glassmorphism (außer der dezenten Unschärfe der
Tab-Leiste), Konfetti, dauerhafte oder pulsierende Animationen, Dekoration ohne Zweck.

## Tokens

Einzige Quelle: `src/ui/tokens.css`. Komponenten verwenden **nur** Variablen, keine Rohwerte.

### Farben

| Token                                  | Hell      | Dunkel    | Verwendung                                          |
| -------------------------------------- | --------- | --------- | --------------------------------------------------- |
| `--color-bg`                           | `#f4f3ee` | `#0f1210` | Seitenhintergrund (warmes Papier / grünliche Tinte) |
| `--color-surface`                      | `#ffffff` | `#181c19` | Flächen, Listen                                     |
| `--color-surface-elevated`             | `#fbfaf7` | `#1d211e` | Erhöhte Flächen                                     |
| `--color-surface-muted`                | `#e9e8e1` | `#252a26` | Segment-Spur, Fortschrittsspur, Zweitknöpfe         |
| `--color-surface-pressed`              | `#efeee8` | `#212622` | Gedrückter Zustand                                  |
| `--color-text`                         | `#1b1f1c` | `#eef0eb` | Primärtext                                          |
| `--color-text-secondary`               | `#50574f` | `#a8afa6` | Sekundärtext, Werte                                 |
| `--color-text-tertiary`                | `#676e66` | `#8b9289` | Gedämpfter Text, Platzhalter                        |
| `--color-disabled`                     | `#8e948c` | `#5d635c` | Deaktiviert                                         |
| `--color-separator` / `--color-border` | 10 / 16 % | 9 / 16 %  | Haarlinien, Rahmen                                  |
| `--color-accent` (**Primary**, Salbei) | `#557a5b` | `#93b597` | Primäraktionen, aktive Zustände, Fortschritt        |
| `--color-accent-text`                  | `#45684b` | `#a8c8ab` | Primary als Text/Icon                               |
| `--color-accent-subtle`                | 12 %      | 15 %      | Icon-Hintergründe, Hinweise, organische Fläche      |
| `--color-on-accent`                    | `#ffffff` | `#102014` | Text auf Primary                                    |
| `--color-positive` (+ `-subtle`)       | `#23795a` | `#5fc492` | Erfolg: Ziel erreicht, gespeichert                  |
| `--color-warning` (+ `-subtle`)        | `#8f5d0f` | `#e2ad55` | Hinweise, ungewöhnliche Werte, Datenqualität        |
| `--color-critical` (+ `-subtle`)       | `#b23a2e` | `#ff7b6e` | Nur echte Fehler                                    |
| `--color-water` (+ `-subtle`)          | `#33719c` | `#7fb6dc` | Ausschließlich Wasser                               |

Salbeigrün ist gedämpft und natürlich – kein Neon-, kein „Fitness-Grün“. Es färbt nie ganze Karten
oder Hintergründe. Semantische Farben stehen nur für ihre Bedeutung und konkurrieren nicht mit
dem Primary; Fortschritt über einem Ziel bleibt neutral (nie rot).

Gemessene Kontraste (WCAG 2.x, Ziel ≥ 4,5 : 1 für Text):

| Paar                                  | Hell      | Dunkel     |
| ------------------------------------- | --------- | ---------- |
| Sekundärtext auf Hintergrund / Fläche | 6,7 / 7,5 | 8,4 / 7,7  |
| Tertiärtext auf Hintergrund / Fläche  | 4,7 / 5,3 | 5,9 / 5,4  |
| Primary-Text auf Hintergrund / Fläche | 5,7 / 6,3 | 10,3 / 9,5 |
| Text auf Primary (`on-accent`)        | 4,9       | 7,5        |
| Erfolg / Warnung / Fehler / Wasser    | ≥ 4,7     | ≥ 7,5      |

**Illustrations-Töne** (`--tint-<familie>-bg/-ink`): rose, leaf, olive, wheat, earth, sun, clay,
sea, milk, sage – je ein zarter Hintergrund und eine Linienfarbe, im Dunkelmodus als
transparente Fläche mit aufgehellter Linie.

### Typografie

Systemschrift (SF Pro auf iOS, Roboto auf Android): wirkt nativ, ist sofort offline verfügbar
und kostet keine Ladezeit. Zahlen in Kennzahlen immer mit `tabular-nums`.

| Token                     | Größe | Einsatz                                 |
| ------------------------- | ----- | --------------------------------------- |
| `--font-size-display`     | 48 px | Die eine große Zahl (z. B. Kalorien)    |
| `--font-size-large-title` | 32 px | Bildschirmtitel (fett, enge Laufweite)  |
| `--font-size-metric`      | 28 px | Kennzahlen                              |
| `--font-size-title`       | 22 px | Profilname, spätere Detailtitel         |
| `--font-size-headline`    | 17 px | Abschnittstitel (halbfett)              |
| `--font-size-body`        | 16 px | Fließtext, Listenzeilen, Eingaben¹      |
| `--font-size-subhead`     | 15 px | Beschreibungen, Segmente                |
| `--font-size-footnote`    | 13 px | Untertitel, Abschnittsfußnoten, Eyebrow |
| `--font-size-caption`     | 12 px | Wochentage                              |

¹ Eingaben nie unter 16 px, sonst zoomt iOS beim Fokussieren.

Schriftgrößen sind in `rem` angegeben und skalieren mit der Systemschriftgröße des WebViews.

### Abstände, Radien, Größen

- **Abstände:** 4-pt-Raster, `--space-1` (4) bis `--space-12` (48). Seitenrand `--layout-gutter`
  = 20 px, Abstand zwischen Abschnitten 32 px.
- **Radien:** `--radius-sm` 8, `--radius-md` 12 (Icons, Segmente), `--radius-lg` 16 (Flächen),
  `--radius-full` (Kreise, Pillen).
- **Größen:** `--size-tap-target` 44 px, `--size-tab-bar` 56 px, `--layout-max-width` 576 px
  (auf Tablets bleibt der Inhalt als Spalte zentriert).
- **Safe Areas:** `--safe-top/right/bottom/left` kombinieren die von Capacitor auf Android
  injizierten Variablen mit `env(safe-area-inset-*)` (iOS).

### Bewegung

`--duration-fast` 120 ms, `--duration-base` 200 ms, `--duration-slow` 480 ms (Fortschritt und
Wasserstand, `--ease-soft`). Bei `prefers-reduced-motion: reduce` werden alle Dauern 0.

Eingesetzt: Fortschrittslinien wachsen weich beim Öffnen und bei Änderungen (auch der Wasserstand
nach „+ 250 ml“), Sheets gleiten herein, leere Zustände blenden sanft ein, Schnellmengen geben
beim Tippen kurz nach. Keine Dauer-, Puls- oder Bounce-Animationen.

## Hell- und Dunkelmodus

- Einstellung _System / Hell / Dunkel_ unter Profil → Darstellung (Standard: System).
- `applyTheme()` setzt `data-theme` auf `<html>`, `color-scheme`, die Browser-`theme-color` und
  auf Android/iOS den Stil der Systemleisten (`SystemBars`).
- Ein kleines Inline-Skript in `index.html` setzt den Systemmodus schon vor dem Laden von
  React, damit es kein helles Aufblitzen gibt.
- Dunkelmodus ist kein invertierter Hellmodus: Flächen werden heller statt Schatten zu nutzen,
  der Akzent ist leicht aufgehellt.

## Komponenten (`src/ui`)

| Komponente         | Zweck                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `Screen`           | Rahmen jedes Tabs: großer Titel, optionale Eyebrow-Zeile, Safe Areas                           |
| `Section`          | Abschnitt mit Titel (`h2`) und optionaler Fußnote                                              |
| `List` / `ListRow` | Gruppierte Liste; Zeile mit Icon, Titel, Untertitel, Wert oder Link                            |
| `SegmentedControl` | Einfachauswahl (Radiogruppe) mit Pfeiltasten-Bedienung                                         |
| `TextField`        | Inline-Eingabe; übernimmt bei Enter/Verlassen, verwirft bei Escape                             |
| `Stat`             | Kennzahl: große tabellarische Zahl + Beschriftung                                              |
| `EmptyState`       | Leerer Zustand: kleines Bild (Icon oder Illustration), Titel, ein Satz, optional eine Aktion   |
| `Meter`            | Dünne Fortschrittslinie zu einem Ziel (`primary` oder `water`), barrierefrei als `progressbar` |
| `FoodArt`          | Lebensmittel-Illustration einer Familie auf zarter organischer Fläche                          |
| `EmptyValue`       | „–“ für fehlende Werte, für Screenreader als „Kein Wert“ ausgegeben                            |
| `Icon`             | Eigenes 24-px-Liniensymbolset (1,75 px Strich)                                                 |

Die Tab-Leiste (`app/layout/TabBar`) gehört zur App-Shell, nutzt aber dieselben Tokens.

### Icons

Eigene SVG-Icons in `src/ui/icons/Icon.tsx`: 24 × 24, Strich 1,75 px, runde Enden,
`currentColor`. Neue Icons im selben Stil ergänzen; keine Icon-Bibliothek einbinden. Seit
Phase 4.5: `flame` (Kalorien), `drop` (Wasser), `cup` / `plate` / `moon` / `apple` (Frühstück,
Mittag, Abend, Snacks), `scale` (Gewicht). Icons sind dekorativ (`aria-hidden`); die Bedeutung
trägt immer der Text.

### Lebensmittel-Illustrationen

`src/ui/illustrations/FoodArt.tsx`: eine Familie aus 16 Motiven plus neutralem Symbol – 24er
Raster, Linie 1,6 px, runde Enden, auf einer leicht organischen Fläche im Ton der Familie (SVG,
keine Bilddateien). Kategorie-basiert, nicht je Lebensmittel:

| Motiv            | BLS-Hauptgruppe (Anfangsbuchstabe des Codes)              |
| ---------------- | --------------------------------------------------------- |
| Brot             | B Brot & Brötchen                                         |
| Ähre             | C Getreide                                                |
| Kuchenstück      | D Backwaren & Gebäck                                      |
| Ei               | E Eier                                                    |
| Apfel            | F Obst                                                    |
| Karotte          | G Gemüse & Kräuter                                        |
| Bohnenschote     | H Hülsenfrüchte, Nüsse & Samen                            |
| Kartoffel        | K Kartoffeln                                              |
| Milchkarton      | M Milch & Milchprodukte                                   |
| Glas mit Halm    | N, P Getränke                                             |
| Ölflasche        | Q Fette & Öle                                             |
| Bonbon           | S Zucker & Süßwaren                                       |
| Fisch            | T Fisch & Meeresfrüchte                                   |
| Steak            | U Fleisch, V Geflügel, Wild & Innereien                   |
| Würstchen        | W Wurst & Fleischwaren                                    |
| Teller           | X, Y Gerichte & Zubereitungen                             |
| Schale (neutral) | R Gewürze/Saucen, eigene und Open-Food-Facts-Lebensmittel |

Die Zuordnung (`core/nutrition/category.ts`) liest nur den Code; wo die Daten keine Familie
nennen, erscheint das neutrale Symbol – nie eine geratene Kategorie. Einsatz: Suchergebnisse,
Lebensmittelliste, Favoriten, Detail- und Mengenansicht, leere Zustände – nicht im Tagebuch.

### Organische Formen

Genau zwei, sehr dezent: die blasse Fläche hinter der Kalorienzahl auf Heute und die leicht
unregelmäßige Fläche hinter Illustrationen und Leer-Icons. Weitere nur, wenn sie nichts unruhiger
machen.

## Barrierefreiheit

- Semantische Elemente (`main`, `nav`, `section` mit Überschrift, Listen).
- Aktiver Tab mit `aria-current="page"`, heutiger Tag mit `aria-current="date"`.
- Sichtbarer Fokusrahmen (`:focus-visible`) in Akzentfarbe.
- Kontraste nach WCAG AA für Text; Akzenttext separat abgestimmt.
- Fehlende Werte werden vorgelesen statt als Strich ausgegeben.

## Checkliste für neue Bildschirme

- [ ] Nur Tokens, keine Rohfarben oder -größen
- [ ] Alle Texte über `t()`, Deutsch und Englisch gepflegt
- [ ] Hell und Dunkel geprüft, 320 px bis 430 px Breite geprüft
- [ ] Touch-Ziele ≥ 44 px, primäre Aktionen daumenerreichbar
- [ ] Leere Zustände ohne erfundene Daten, kurz und menschlich („Nichts gefunden“)
- [ ] Höchstens eine Display-Zahl; Karten nur mit Grund
- [ ] Salbei nur für Aktives/Primäres/Fortschritt; Wasser nur blau; Fehlerfarbe nur für Fehler
- [ ] Animationen respektieren „Bewegung reduzieren“
