# Designsystem

Leitbild: **ruhig, präzise, sportlich.** Die App soll wie ein hochwertiges Werkzeug wirken, nicht
wie ein Dashboard-Template. Inhalte tragen die Gestaltung – nicht Dekoration.

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

Ausdrücklich vermeiden: Farbverläufe, Schlagschatten, Glassmorphism-Effekte (außer der dezenten
Unschärfe der Tab-Leiste), bunte Kartenraster, Emojis als Icons, Diagramme ohne Daten.

## Tokens

Einzige Quelle: `src/ui/tokens.css`. Komponenten verwenden **nur** Variablen, keine Rohwerte.

### Farben

| Token                      | Hell        | Dunkel      | Verwendung                                |
| -------------------------- | ----------- | ----------- | ----------------------------------------- |
| `--color-bg`               | `#f5f4f1`   | `#0e0f11`   | Seitenhintergrund (warmes Papier / Tinte) |
| `--color-surface`          | `#ffffff`   | `#18191c`   | Flächen, Listen                           |
| `--color-surface-muted`    | `#ebe9e4`   | `#232428`   | Spur des Segment-Schalters                |
| `--color-surface-pressed`  | `#f0eeea`   | `#202125`   | Gedrückter Zustand                        |
| `--color-control-selected` | `#ffffff`   | `#37383d`   | Gewähltes Segment                         |
| `--color-text`             | `#15161a`   | `#f2f1ee`   | Primärtext                                |
| `--color-text-secondary`   | `#53555c`   | `#a3a4aa`   | Sekundärtext, Werte                       |
| `--color-text-tertiary`    | `#6e7077`   | `#888a91`   | Inaktive Tabs, Platzhalter, Zukunft       |
| `--color-separator`        | 10 % Tinte  | 9 % Papier  | Haarlinien                                |
| `--color-accent`           | `#cc431c`   | `#ff6a3d`   | Akzentflächen (Heute-Markierung)          |
| `--color-accent-text`      | `#b93d18`   | `#ff8c66`   | Akzent als Text/Icon (kontraststärker)    |
| `--color-accent-subtle`    | 10 % Akzent | 14 % Akzent | Icon-Hintergründe                         |
| `--color-on-accent`        | `#ffffff`   | `#16100d`   | Text auf Akzentfläche                     |
| `--color-positive`         | `#1d7f55`   | `#3fc68a`   | Erfolg, Zielerreichung (ab Phase 2)       |
| `--color-critical`         | `#c0332b`   | `#ff6b61`   | Fehler, Warnungen (ab Phase 2)            |

Akzent „Glut“ (Zinnoberrot): energiegeladen, aber nicht grell; hebt sich von den verbreiteten
Neon-Grün- und Blau-Tönen der Kategorie ab. Für Akzent als Text/Icon immer `--color-accent-text`
verwenden.

Gemessene Kontraste (WCAG 2.x, Ziel ≥ 4,5 : 1 für Text):

| Paar                                 | Hell      | Dunkel    |
| ------------------------------------ | --------- | --------- |
| Sekundärtext auf Fläche              | 7,4       | 7,1       |
| Tertiärtext auf Hintergrund / Fläche | 4,5 / 4,9 | 5,6 / 5,1 |
| Akzenttext auf Hintergrund / Fläche  | 5,1 / 5,6 | 8,4 / 7,7 |
| Text auf Akzentfläche (`on-accent`)  | 4,8       | 6,6       |

Fachbereichsfarben (z. B. für Diagramme je Modul) werden erst mit den ersten Diagrammen
definiert und auf Farbsehschwäche geprüft.

### Typografie

Systemschrift (SF Pro auf iOS, Roboto auf Android): wirkt nativ, ist sofort offline verfügbar
und kostet keine Ladezeit. Zahlen in Kennzahlen immer mit `tabular-nums`.

| Token                     | Größe | Einsatz                                 |
| ------------------------- | ----- | --------------------------------------- |
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

`--duration-fast` 120 ms, `--duration-base` 200 ms, `--ease-standard`. Bei
`prefers-reduced-motion: reduce` werden beide Dauern 0.

## Hell- und Dunkelmodus

- Einstellung _System / Hell / Dunkel_ unter Profil → Darstellung (Standard: System).
- `applyTheme()` setzt `data-theme` auf `<html>`, `color-scheme`, die Browser-`theme-color` und
  auf Android/iOS den Stil der Systemleisten (`SystemBars`).
- Ein kleines Inline-Skript in `index.html` setzt den Systemmodus schon vor dem Laden von
  React, damit es kein helles Aufblitzen gibt.
- Dunkelmodus ist kein invertierter Hellmodus: Flächen werden heller statt Schatten zu nutzen,
  der Akzent ist leicht aufgehellt.

## Komponenten (`src/ui`)

| Komponente         | Zweck                                                                |
| ------------------ | -------------------------------------------------------------------- |
| `Screen`           | Rahmen jedes Tabs: großer Titel, optionale Eyebrow-Zeile, Safe Areas |
| `Section`          | Abschnitt mit Titel (`h2`) und optionaler Fußnote                    |
| `List` / `ListRow` | Gruppierte Liste; Zeile mit Icon, Titel, Untertitel, Wert oder Link  |
| `SegmentedControl` | Einfachauswahl (Radiogruppe) mit Pfeiltasten-Bedienung               |
| `TextField`        | Inline-Eingabe; übernimmt bei Enter/Verlassen, verwirft bei Escape   |
| `Stat`             | Kennzahl: große tabellarische Zahl + Beschriftung                    |
| `EmptyState`       | Erklärt, was in einem Bereich erscheinen wird                        |
| `EmptyValue`       | „–“ für fehlende Werte, für Screenreader als „Kein Wert“ ausgegeben  |
| `Icon`             | Eigenes 24-px-Liniensymbolset (1,75 px Strich)                       |

Die Tab-Leiste (`app/layout/TabBar`) gehört zur App-Shell, nutzt aber dieselben Tokens.

### Icons

Eigene SVG-Icons in `src/ui/icons/Icon.tsx`: 24 × 24, Strich 1,75 px, runde Enden,
`currentColor`. Neue Icons im selben Stil ergänzen; keine Icon-Bibliothek einbinden.

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
- [ ] Leere Zustände ohne erfundene Daten
