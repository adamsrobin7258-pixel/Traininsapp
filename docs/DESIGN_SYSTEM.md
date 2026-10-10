# Designsystem

Leitbild (seit Phase 4.5): **modern · ruhig · hochwertig · menschlich · unkompliziert.** Kalethra
soll wie ein bewusst gestaltetes Produkt wirken – nicht wie eine Fitness-App, nicht wie ein
Dashboard-Template. Inhalte tragen die Gestaltung; Farbe, Illustration und Form ergänzen sie
sparsam.

Seit Phase 20 (Version 0.31.0) **„Natürlich & ruhig“**: warme Cremetöne statt kaltem Weiß,
Salbei- und Waldgrün als Markenfarbe, klar abgesetzte Karten mit feiner Linie und sehr leichtem
Schatten; im Dunkelmodus ein tiefes Graugrün mit deutlich helleren Ebenen statt Schwarz.

Festgelegte Richtung: **A1** Salbeigrün, warm und natürlich · **B2** kleine, erkennbare
Lebensmittel-Illustrationen · **C1** organische Formen sehr dezent · **D1** die Mainpage
(seit 7.1 „Fortschritt“) ruhig und minimal, aber visuell angereichert.

## Prinzipien

1. **Typografie vor Dekoration.** Hierarchie entsteht durch Schriftgröße, Gewicht und Abstand,
   nicht durch Rahmen, Schatten oder Verläufe.
2. **Eine Akzentfarbe, sparsam eingesetzt.** Sie markiert „aktiv/heute/wichtig“ – nie Flächen
   um ihrer selbst willen.
3. **Ruhige Karten statt lauter Flächen.** Gruppen liegen auf Karten (`--color-surface`) mit
   feiner Kante (`--color-card-border`) und sehr leichtem Schatten (`--shadow-card`, nur hell);
   im Dunkelmodus trennt die hellere Ebene plus Kante. Keine Karten in Karten; innen trennen
   Haarlinien.
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

Ebenen (Hell: Papier → Karte; Dunkel: wird mit jeder Ebene heller):

| Token                            | Hell      | Dunkel    | Verwendung                                                    |
| -------------------------------- | --------- | --------- | ------------------------------------------------------------- |
| `--color-bg`                     | `#f3efe6` | `#101612` | Seitenhintergrund (warme Creme / tiefes Graugrün)             |
| `--color-surface-dialog`         | `#f8f5ee` | `#19211b` | Sheets und Dialoge (Karten darin bleiben abgesetzt)           |
| `--color-surface`                | `#fffdf9` | `#222b24` | Karten, Listen, Eingabefelder                                 |
| `--color-surface-elevated`       | `#ffffff` | `#2b352d` | Erhöhte Elemente auf Karten (Popover, schwebende Leisten)     |
| `--color-surface-muted`          | `#e9e4d8` | `#323d35` | Segment-Spur, Fortschrittsspur, Stepper-Tasten                |
| `--color-surface-pressed`        | `#ece7dc` | `#2b352d` | Gedrückter Zustand (auf Hintergrund und auf Karte sichtbar)   |
| `--color-surface-hover`          | 4 %       | 5 %       | Hover (nur Geräte mit Maus/Trackpad)                          |
| `--color-control-selected`       | `#fffdf9` | `#46524a` | Gewähltes Segment                                             |
| `--color-text`                   | `#1c211d` | `#edf0ea` | Primärtext                                                    |
| `--color-text-secondary`         | `#4b534c` | `#b3bab0` | Sekundärtext, Werte                                           |
| `--color-text-tertiary`          | `#5c645d` | `#a0a89d` | Gedämpfter Text, Platzhalter, inaktive Icons                  |
| `--color-disabled`               | `#8a9088` | `#69716a` | Deaktiviert (bewusst unter 4,5 : 1, nie für wichtige Inhalte) |
| `--color-separator`              | 10 %      | 9 %       | Haarlinien innerhalb von Karten                               |
| `--color-border`                 | 16 %      | 16 %      | Feldrahmen, Trennlinien                                       |
| `--color-border-strong`          | 28 %      | 30 %      | Sekundärknopf, Sheet-Griff                                    |
| `--color-card-border`            | 7 %       | 7 %       | Kante von Karten und Sheets                                   |
| `--color-accent` (Salbei)        | `#557a5b` | `#93b597` | Primäraktionen, aktive Zustände, Fortschritt                  |
| `--color-accent-strong`          | `#466a4c` | `#b2d0b5` | Waldgrün: gedrückter/gehoverter Primärknopf                   |
| `--color-accent-text`            | `#43654a` | `#a9c8ac` | Primary als Text/Icon                                         |
| `--color-accent-subtle`          | 12 %      | 15 %      | Icon-Hintergründe, Hinweise                                   |
| `--color-accent-subtle-strong`   | 20 %      | 24 %      | Aktiver Tab (Pille hinter dem Icon)                           |
| `--color-on-accent`              | `#ffffff` | `#102014` | Text auf Primary                                              |
| `--color-positive` (+ `-subtle`) | `#23795a` | `#66c896` | Erfolg: Ziel erreicht, gespeichert                            |
| `--color-warning` (+ `-subtle`)  | `#875a0e` | `#e3b05b` | Hinweise, ungewöhnliche Werte, Datenqualität                  |
| `--color-critical` (+ `-subtle`) | `#ad382c` | `#ff8579` | Nur echte Fehler und Löschen                                  |
| `--color-info` (+ `-subtle`)     | `#2f6489` | `#8dbddc` | Neutrale Information (neu, noch ohne Einsatz)                 |
| `--color-water` (+ `-subtle`)    | `#30709b` | `#80b7dc` | Ausschließlich Wasser                                         |

Schatten (`--shadow-card`, `--shadow-raised`, `--shadow-sheet`): hell warm getönt und sehr
leicht; dunkel ist `--shadow-card` = `none` – dort trennen Ebene und Kante.

Salbeigrün ist gedämpft und natürlich – kein Neon-, kein „Fitness-Grün“. Es färbt nie ganze Karten
oder Hintergründe. Semantische Farben stehen nur für ihre Bedeutung und konkurrieren nicht mit
dem Primary; Fortschritt über einem Ziel bleibt neutral (nie rot). Der Akzent `#557a5b` bleibt
unverändert (Wiedererkennung; Kontrast auf Weiß 4,9 : 1).

Gemessene Kontraste (WCAG 2.x; automatisch geprüft in `tests/designTokens.test.ts`):

| Paar                                                | Hell                      | Dunkel                   |
| --------------------------------------------------- | ------------------------- | ------------------------ |
| Hintergrund / Karte                                 | 1,13 (+ Kante, Schatten)  | 1,26 (Ziel ≥ 1,25)       |
| Text auf Hintergrund / Karte / Sheet / Spur         | 14,3 / 16,1 / 15,0 / 12,9 | 15,9 / 12,7 / 14,3 / 9,8 |
| Sekundärtext, ebenso                                | 6,9 / 7,8 / 7,3 / 6,3     | 9,2 / 7,3 / 8,3 / 5,7    |
| Tertiärtext, ebenso                                 | 5,3 / 6,0 / 5,6 / 4,8     | 7,5 / 6,0 / 6,7 / 4,6    |
| Primary-Text auf Hintergrund / Karte                | 5,7 / 6,5                 | 10,1 / 8,0               |
| Primary als Icon/Balken auf Spur (Ziel ≥ 3)         | 3,8                       | 5,0                      |
| Text auf Primary / auf gedrücktem Primary           | 4,9 / 6,1                 | 7,5 / ≥ 7,5              |
| Erfolg / Warnung / Fehler / Info / Wasser auf Karte | ≥ 5,2                     | ≥ 6,2                    |

**Illustrations-Töne** (`--tint-<familie>-bg/-ink`): rose, leaf, olive, wheat, earth, sun, clay,
sea, milk, sage – je ein zarter Hintergrund und eine Linienfarbe, im Dunkelmodus als
transparente Fläche mit aufgehellter Linie.

### Typografie

Systemschrift (SF Pro auf iOS, Roboto auf Android): wirkt nativ, ist sofort offline verfügbar
und kostet keine Ladezeit. Zahlen in Kennzahlen immer mit `tabular-nums`.

| Token                     | Größe | Einsatz                                |
| ------------------------- | ----- | -------------------------------------- |
| `--font-size-display`     | 48 px | Die eine große Zahl (z. B. Kalorien)   |
| `--font-size-large-title` | 32 px | Bildschirmtitel (fett, enge Laufweite) |
| `--font-size-metric`      | 28 px | Kennzahlen                             |
| `--font-size-title`       | 22 px | Profilname, spätere Detailtitel        |
| `--font-size-headline`    | 17 px | Abschnittstitel (halbfett)             |
| `--font-size-body`        | 16 px | Fließtext, Listenzeilen, Eingaben¹     |
| `--font-size-subhead`     | 15 px | Beschreibungen, Segmente               |
| `--font-size-footnote`    | 13 px | Untertitel, Abschnittsfußnoten         |
| `--font-size-caption`     | 12 px | Wochentage                             |
| `--font-size-tab-label`   | 11 px | Nur Beschriftung der Tab-Leiste        |

¹ Eingaben nie unter 16 px, sonst zoomt iOS beim Fokussieren.

Regeln: Gewichte 400 (Text), 500 (Beschriftungen, Segmente), 600 (Abschnittstitel, Knöpfe,
Kennzahlen), 700 (nur Bildschirmtitel). Zeilenhöhen `tight` (Zahlen, Titel), `snug` (Zeilen,
Überschriften), `body` (Fließtext). **Keine Versalien als Gestaltungsmittel**: Beschriftungen in
Satzschreibweise (die Eyebrow-Zeile des `Screen` seit 0.31.0 ohne Großbuchstaben); einzelne
Versal-Labels in Modulen werden in Phase C umgestellt. Alle Zahlen, die sich ändern oder
untereinander stehen, mit `font-variant-numeric: tabular-nums` (Stat, Stepper, Listenwerte,
Zahlenfelder). Kleinste Lesegröße 12 px; 11 px nur für die Tab-Beschriftung.

Schriftgrößen sind in `rem` angegeben und skalieren mit der Systemschriftgröße des WebViews.

### Abstände, Radien, Größen

- **Abstände:** 4-pt-Raster, `--space-1` (4) bis `--space-12` (48). Seitenrand `--layout-gutter`
  = 20 px, Abstand zwischen Abschnitten 32 px.
- **Radien (semantisch):** `--radius-control` 12 (Knöpfe, Felder, Segment-Spuren),
  `--radius-card` 16 (Karten, Listen), `--radius-sheet` 24 (obere Ecken von Sheets),
  `--radius-full` (Kreise, Pillen). Die Rohstufen `--radius-sm/md/lg/xl` bleiben für Sonderfälle.
- **Größen:** `--size-tap-target` 44 px (Mindest-Tippfläche), `--size-control` 48 px
  (Standardhöhe von Knöpfen und Feldern), `--size-control-compact` 36 px (kompakte Knöpfe –
  die unsichtbare Tippfläche bleibt 44 px), `--size-tab-bar` 56 px, `--layout-max-width`
  576 px (auf Tablets bleibt der Inhalt als Spalte zentriert).
- **Icons:** `--size-icon` 24, `--size-icon-sm` 20, `--size-icon-xs` 16; Strich
  `--size-icon-stroke` 1,75.
- **Zustände:** `--opacity-disabled` 0,45; Fokus `--focus-ring-width` 2 px mit
  `--focus-ring-offset` 2 px in `--color-focus` (= Akzent); Feldrahmen `--border-control` 1 px.
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
- Dunkelmodus ist kein invertierter Hellmodus: Ebenen werden heller statt Schatten zu nutzen
  (Hintergrund < Sheet < Karte < erhöht), Karten tragen eine feine helle Kante, der Akzent ist
  aufgehellt. Kein Schwarz, keine verschmelzenden Flächen.
- Browser-`theme-color` (`applyTheme.ts`, `index.html`) und die Farben der Datenschutzseite
  (`public/privacypolicy.html`) folgen `--color-bg`; der Token-Test prüft die Übereinstimmung.

## Komponenten (`src/ui`)

| Komponente         | Zweck                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `Screen`           | Rahmen jedes Tabs: großer Titel, optionale Eyebrow-Zeile, Safe Areas                           |
| `Section`          | Abschnitt mit Titel (`h2`) und optionaler Fußnote                                              |
| `List` / `ListRow` | Gruppierte Liste; Zeile mit Icon, Titel, Untertitel, Wert oder Link                            |
| `SegmentedControl` | Einfachauswahl (Radiogruppe) mit Pfeiltasten-Bedienung                                         |
| `Stepper`          | Zahl mit großen −/+-Tasten; Antippen der Zahl öffnet die Zifferntastatur (Satzeingabe)         |
| `TextField`        | Inline-Eingabe; übernimmt bei Enter/Verlassen, verwirft bei Escape                             |
| `Stat`             | Kennzahl: große tabellarische Zahl + Beschriftung                                              |
| `EmptyState`       | Leerer Zustand: kleines Bild (Icon oder Illustration), Titel, ein Satz, optional eine Aktion   |
| `Meter`            | Dünne Fortschrittslinie zu einem Ziel (`primary` oder `water`), barrierefrei als `progressbar` |
| `FoodArt`          | Lebensmittel-Illustration einer Familie auf zarter organischer Fläche                          |
| `EmptyValue`       | „–“ für fehlende Werte, für Screenreader als „Kein Wert“ ausgegeben                            |
| `Icon`             | Eigenes 24-px-Liniensymbolset (1,75 px Strich)                                                 |

Die Tab-Leiste (`app/layout/TabBar`) gehört zur App-Shell, nutzt aber dieselben Tokens: inaktiv
Sekundärtext, aktiv Salbei-Text mit dezenter Pille (`--color-accent-subtle-strong`) hinter dem
Icon und halbfetter Beschriftung; `aria-current="page"` bleibt.

### Knöpfe (`Button`)

| Variante      | Aussehen                                  | Einsatz                                           |
| ------------- | ----------------------------------------- | ------------------------------------------------- |
| `primary`     | Salbei gefüllt, Text `on-accent`          | Die eine Hauptaktion eines Bildschirms/Sheets     |
| `secondary`   | Kontur (`--color-border-strong`), Text    | Weitere Aktionen, „Abbrechen“                     |
| `tertiary`    | Ohne Fläche, Salbei-Text (Ghost)          | Leise Zusatzaktion, Links innerhalb von Bereichen |
| `destructive` | Fehlerfarbe auf `--color-critical-subtle` | Löschen, Verwerfen                                |

Größen: `standard` (48 px) und `compact` (36 px sichtbar, 44 px Tippfläche). Zustände: gedrückt
(Primary → Waldgrün, sonst `pressed`/`subtle`), Hover nur auf Geräten mit Maus, Fokusring über
`:focus-visible`, deaktiviert mit `--opacity-disabled`. Standard bleibt `primary`/`standard`,
`type="button"`; bestehende Aufrufe ändern sich nicht.

### Formulare und Auswahl

Eingabefelder (`Form.field`, Dialogfelder) einheitlich 48 px hoch, Kartenfläche, 1-px-Rahmen
`--color-border`, Fokus: Rahmen und Ring in Akzentfarbe, Fehler: Rahmen `--color-critical` plus
Text. `TextField` ist eine Listenzeile (Höhe wie `ListRow`). Segmente: gedämpfte Spur, gewähltes
Segment hebt sich mit `--color-control-selected` und leichtem Schatten ab. Stepper-Tasten 56 px
rund. Chips/Optionskarten: gewählter Zustand in Salbei.

### Sheets und Dialoge

Fläche `--color-surface-dialog`, obere Ecken `--radius-sheet`, feine Kante, `--shadow-sheet`,
Griff in `--color-border-strong`. Aktionen unten nebeneinander (`Dialogs.actions`): rechts die
Hauptaktion (`primary` oder `destructive`), links `secondary`. Auf kleinen Displays scrollt das
Sheet als Ganzes; die Höhe ist auf den sichtbaren Bereich über der Tastatur begrenzt.

### Icons

Eigene SVG-Icons in `src/ui/icons/paths.tsx` (Darstellung `Icon.tsx`): 24 × 24, Strich 1,75 px,
runde Enden und Ecken, ohne Füllung, Farbe über `currentColor` – damit kommen alle Farben aus
den Tokens. Keine Icon-Bibliothek, keine Emojis, keine 3D-Icons.

- **Zustände:** aktiv `--color-accent-text`, inaktiv `--color-text-secondary` bzw.
  `--color-text-tertiary`, deaktiviert `--color-disabled`; Hinweise in der jeweiligen
  semantischen Farbe (`warning`, `info`, `critical`).
- **Größen:** 24 (Standard, Tab-Leiste), 20 (in Listen-/Abschnittstiteln), 16 (inline im Text).
- **Barrierefreiheit:** Standard dekorativ (`aria-hidden`), die Bedeutung trägt der Text. Steht
  ein Icon allein (Icon-Knopf), braucht der Knopf ein `aria-label` oder das Icon `label`.

Zuordnung nach Bedeutung (`src/ui/icons/roles.ts`, `ICON_FOR`) – ein Thema, ein Symbol:

| Thema                | Icon                     | Thema          | Icon                           |
| -------------------- | ------------------------ | -------------- | ------------------------------ |
| Training             | `training`               | Ziele          | `target`                       |
| Ernährung            | `nutrition`              | Einstellungen  | `settings`                     |
| Gesundheit           | `health`                 | Profil         | `profile`                      |
| Gewicht              | `scale`                  | Pause/Timer    | `timer`                        |
| Wasser               | `drop`                   | Plan           | `plan`                         |
| Schlaf               | `sleep` (neu)            | Information    | `info` (neu)                   |
| Schritte             | `steps` (neu)            | Warnung        | `warning` (neu)                |
| Fortschritt          | `progress`               | Weiter/Zurück  | `chevronRight` / `chevronLeft` |
| Aktivitäten          | `activity` (neu, 0.32.0) | Energie (kcal) | `flame`                        |
| Rezepte              | `recipe` (neu, 0.33.0)   | Distanz        | `distance` (neu, 0.33.0)       |
| Lebensmittel         | `apple`                  | Vorlagen       | `plate`                        |
| Mahlzeiten des Tages | `nutrition`              | Meine Inhalte  | `plan`                         |

Mahlzeiten: `cup` / `plate` / `moon` / `apple` (Frühstück, Mittag, Abend, Snacks); `moon` bleibt
dem Abendessen vorbehalten, Schlaf hat ein eigenes Symbol. **Nicht selbsterklärend** und deshalb
nie ohne sichtbare Beschriftung: Gesundheit, Fortschritt, Ziele, Plan, Schritte, Aktivitäten,
Schlaf, Barcode, „Mehr“ (`ICON_NEEDS_LABEL`). Phase B stellt das System bereit; die Bildschirme
übernehmen die Zuordnung über `ICON_FOR` (alle Bereiche seit 0.33.0).

Seit 0.33.0 steht `flame` nur noch für **Energie in kcal** – gegessen (Ernährung) oder verbraucht
(aktive Energie): eine Bedeutung, ein Symbol. Rezepte haben ein eigenes Symbol (`recipe`, Topf),
Aktivitäten `activity`, Schritte `steps`, Distanz `distance`; ein Test stellt sicher, dass `flame`
in den Modulen nicht mehr anders verwendet wird. Die Mahlzeit-Symbole (`cup`, `plate`, `moon`,
`apple`) erscheinen nur im Zusammenhang einer Mahlzeit; `plate` (Mittag) und `apple` (Snack)
teilen sich das Symbol mit Vorlagen bzw. Lebensmitteln unter „Meine Inhalte“.

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

Sehr dezent: die leicht unregelmäßige Fläche hinter Illustrationen und Leer-Icons (die frühere
Fläche hinter der Kalorienzahl auf „Heute“ ist mit Phase 7.1 entfallen). Weitere nur, wenn sie nichts unruhiger
machen.

## Referenzbildschirm: Fortschritt (Phase C.1)

Die Fortschritt-Seite (`modules/progress`) zeigt die Muster, nach denen die übrigen Module in
Phase C umgestellt werden:

- **Eine Schwerpunkt-Karte.** Der Kalethra-Score trägt `--shadow-raised` und etwas mehr Raum;
  alle anderen Karten `--shadow-card`. Nicht jede Karte bekommt dasselbe Gewicht.
- **Kennzahl als Ring.** Die Zahl steht im Ring, der Bogen zeigt denselben Wert (Score / 100) –
  keine zusätzliche Information, nur schnellere Erfassung. Vorläufig: Bogen und Zahl in
  gedämpften Tönen plus Text; ohne Wert: nur die Spur und „–“. Der Ring ist dekorativ
  (`aria-hidden`), die Karte trägt den vollständigen zugänglichen Namen.
- **Bereichskarte.** Kopf aus Icon-Kachel (32 px, `--color-accent-subtle`), Titel in
  Satzschreibweise (17 px halbfett) und Chevron; Inhalt bündig unter dem Titel (unter 360 px
  volle Breite). Die ganze Karte ist ein Link.
- **Leere Bereiche kompakt.** Ohne Werte (`data-empty`) schrumpft die Karte auf Titel und eine
  kurze Zeile, ohne Schatten, Icon-Kachel neutral – Karten mit Werten tragen die Seite. Keine
  erfundenen Nullen.
- **Kleine Balken.** Bereichswerte bekommen eine 4-px-Spur mit Salbei-Füllung; ohne Bewertung
  keine Spur (sie würde wie 0 wirken).
- **Diagramme.** Balken stehen auf einer Haarlinie (Nulllinie), keine Gitter und Verläufe.
  Referenzlinien sind gestrichelt und unter dem Diagramm benannt („Ø Ziel“). Tage ohne Daten
  bleiben leer, Tage mit 0 zeigen einen kurzen Strich.
- **Keine Versalien.** Karten- und Abschnittstitel in Satzschreibweise, auch im Erklär-Sheet.

## Muster der Bereiche (Phase C.2)

Alle Bereiche nutzen dieselben Bausteine (Karte mit Kante und `--shadow-card`, eine erhöhte
Schwerpunkt-Karte mit `--shadow-raised`, Icon-Kacheln, Felder mit Rahmen, keine Versalien), aber
jeder Bereich setzt seinen Akzent anders:

| Bereich       | Schwerpunkt                                                                                                                   | Eigenes Merkmal                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Fortschritt   | Score-Ring                                                                                                                    | Bereichskarten mit Kachel, kompakte leere Bereiche                                                                                           |
| Training      | „Nächstes Training“ bzw. das laufende Training auf der Salbei-Fläche (`--color-surface-accent`), Icon-Kachel in vollem Salbei | Im aktiven Training ist „Satz abschließen“ die einzige Hauptaktion; „Training beenden“ sekundär und kompakt; Pausenleiste schwebt erhöht     |
| Ernährung     | Tageskarte: gegessene Kalorien groß, Ziel/Übrig, Makros                                                                       | Mahlzeiten-Kacheln in den natürlichen Lebensmitteltönen (`--tint-*`): Frühstück Sonne, Mittag Blatt, Abend Meer, Snacks Rose; Wasser in Blau |
| Gesundheit    | Messwert mit Kachel (Salbei mit Wert, neutral ohne Wert)                                                                      | Kein Abschnitt ohne Inhalt („Verlauf“ erst ab dem ersten Eintrag); fehlende Werte in Worten                                                  |
| Einstellungen | Profilkarte                                                                                                                   | Ruhige gruppierte Listen, keine Farbflächen                                                                                                  |

Neue Tokens dafür: `--color-surface-accent` (+ `-border`) für die eine führende Karte eines
Bereichs (nur Training nutzt sie bisher), `--color-switch-knob` und `--shadow-knob` für die
Schalter (vorher Rohwerte in vier Dateien).

## Bilder und Illustrationen

Regeln für künftige Bilder (Phase B legt nur die Regeln fest; es wurden keine Bilder ergänzt).

**Stile – nur diese drei:**

1. **Liniensymbole** (`Icon`) für Navigation, Aktionen, Themen.
2. **Kategorie-Illustrationen** (`FoodArt`) – Linie auf zarter organischer Fläche in den
   `--tint-*`-Tönen.
3. **3D-Körper** (`public/figure/`) für Übungen; Pfade und Modelle bleiben unverändert.

Keine Stock-Fotos, keine Personenfotos, keine Verläufe, keine dekorativen Bilder ohne Inhalt.

**Bild oder Icon?** Ein Icon, wenn es eine Aktion oder ein Thema kennzeichnet (klein, neben
Text). Eine Illustration nur, wenn sie Inhalt unterscheidbar macht (Lebensmittelkategorie) oder
einen leeren Zustand freundlicher macht – höchstens eine je Bildschirmbereich. 3D nur dort, wo
Bewegung oder Körperhaltung die Information ist.

**Größen, Radien, Hintergründe:** Illustrationen in Listen 40 px, in Detailansichten 64 px,
in leeren Zuständen 48 px; Fläche dahinter organisch (`EmptyState`) oder `--radius-control`.
Vorschaubilder/3D-Flächen mit `--radius-card` und Kartenfläche. Bilder liegen nie direkt auf dem
Akzent.

**Hell und dunkel:** Bilder müssen in beiden Modi funktionieren: Linienfarben aus Tokens
(`currentColor`, `--tint-*-ink`), Flächen als transparente Töne im Dunkelmodus; Rastergrafiken
mit transparentem Hintergrund oder auf `--color-surface` freigestellt, nie weiße Kästen im
Dunkelmodus. Bei Bedarf zwei Varianten (`-light`/`-dark`) statt Filtern.

**Ablage und Einbindung:** SVG-Motive als Komponenten unter `src/ui/illustrations/`;
Bilddateien lokal unter `public/visuals/<bereich>/<name>.<webp|svg>` (z. B.
`public/visuals/training/…`), referenziert über relative Pfade – nie aus dem Netz zur Laufzeit.
Je Ordner eine `ATTRIBUTION.md` mit Quelle, Urheber, Lizenz und Änderungen; 3D-Körper bleiben bei
`public/figure/` mit ihrer Dokumentation in `assets/figure/docs/README.md`.

**Lizenzen:** nur eigene Werke oder Quellen mit eindeutiger Lizenz, die kommerzielle Nutzung und
Veränderung erlaubt (z. B. CC0, CC BY mit Namensnennung, MIT/Apache für SVG-Sets). Keine Quellen
mit „nur privat“, ohne Lizenzangabe oder mit KI-Bildern ungeklärter Herkunft. Namensnennungen
werden in der App unter Profil → Datenquellen (`DataSourcesSheet`) und in der `ATTRIBUTION.md`
geführt.

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
