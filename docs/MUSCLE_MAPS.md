# Muskelkarten (2D)

Seit Version 0.34.0 zeigen die Trainingsansichten die beanspruchten Muskeln als **2D-Muskelkarte**
im Stil eines Anatomieatlas: Vorder- und Rückansicht nebeneinander, primäre Muskeln in warmem
Korallrot, sekundäre heller mit Korallkontur, alle übrigen Muskeln ruhig in Elfenbein mit
waldgrüner Kontur. Die Karten ersetzen dort die 3D-Figur
([EXERCISE_VISUALS.md](EXERCISE_VISUALS.md)); deren Code und Assets bleiben unverändert im
Repository, werden aber nicht mehr angezeigt.

## Wo

| Ansicht                    | Darstellung                                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| Übungsdetails              | Abschnitt „Beanspruchte Muskeln“ unter den Fakten – **für jede Übung**     |
| Trainings-Zusammenfassung  | Abschnitt „Beanspruchte Muskeln“: Karte, darunter Primär/Sekundär als Text |
| Große Ansicht (beide Wege) | Antippen der Karte: groß, Körper aus dem Profil, Legende mit den Gruppen   |

Kein neuer Navigationspunkt, keine Einstellung. Seit Phase 23 bestimmt allein das Profil den
Körper – in der kleinen wie der großen Ansicht (`figureVariantFor(profile.sex)`); der frühere
Umschalter Männlich/Weiblich in der großen Ansicht ist entfernt:

| Profil „Geschlecht“          | Körper                         |
| ---------------------------- | ------------------------------ |
| Männlich                     | männlich                       |
| Weiblich                     | weiblich                       |
| Divers / keine Angabe        | männlich (festgelegter Ersatz) |
| kein Wert / unbekannter Wert | männlich (gleicher Ersatz)     |

## Datenfluss (Quelle der Wahrheit)

```
Exercise (Bibliothek oder eigene Übung)
  └─ primaryMuscles / secondaryMuscles ──► muscleHighlight / aggregateMuscleHighlight
                                            (core/training/muscleMap.ts, unverändert)
                                        ──► Gruppe → Regionen (muscleMap/regions.ts)
                                        ──► data-level="primary|secondary" im SVG
```

- Muskeln kommen ausschließlich aus der Übung; die Karte legt keine eigenen Zuordnungen an.
  Die Unterscheidung primär/sekundär bestand bereits (`MuscleHighlight`) – keine Datenänderung.
- `fullBody` bedeutet wie bisher: alle Gruppen.
- Zusammenfassung: Vereinigung der Übungen mit mindestens einem abgeschlossenen Satz (eine Übung
  ohne abgeschlossenen Satz gilt als nicht gemacht); primär schlägt sekundär, jede Region wird
  pro Ansicht einmal markiert. Eine Übung ohne Muskelzuordnung trägt nichts bei und blockiert
  nichts. Die Karte liest nur – der Abschluss speichert genau einmal (getestet). Kein Score.
- Ungültige oder fehlende Zuordnungen markieren nichts: eine unbekannte Gruppe, eine unbekannte
  Region oder eine leere Liste lassen die Karte neutral (getestet).
- Katalogprüfung (201 Übungen): keine belegbaren Fehlzuordnungen gefunden, daher keine
  Korrekturen.

## Muskel-IDs

Gemeinsam für beide Körper; jede Region liegt als `<path data-region="<id>" data-side="left|right">`
im SVG. Die IDs sind dauerhaft (nie umbenennen oder wiederverwenden). Zuordnung zur Gruppe in
`src/modules/training/muscleMap/regions.ts`, abgeleitet aus den Teilen der Gruppen im bisherigen
Vertrag (`MUSCLE_PARTS`).

| Gruppe           | Regionen (Vorderansicht · Rückansicht)                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chest`          | `pectoralis-major`                                                                                                                               |
| `shoulders`      | `deltoid-anterior`, `deltoid-lateral` · `deltoid-posterior`, `deltoid-lateral`                                                                   |
| `biceps`         | `biceps-brachii`                                                                                                                                 |
| `triceps`        | `triceps-brachii` (vorne schmal innen, hinten voll)                                                                                              |
| `forearms`       | `brachioradialis`, `forearm-flexors` · `forearm-extensors`, `forearm-flexors`                                                                    |
| `core`           | `rectus-abdominis`, `external-oblique` · `external-oblique`                                                                                      |
| `back`           | `trapezius` (vorne oberer Anteil) · `trapezius`, `erector-spinae`                                                                                |
| `lats`           | `latissimus-dorsi` (vorne seitlicher Rand) · `latissimus-dorsi`                                                                                  |
| `glutes`         | · `gluteus-maximus`, `gluteus-medius`                                                                                                            |
| `quadriceps`     | `rectus-femoris`, `vastus-lateralis`, `vastus-medialis`                                                                                          |
| `hamstrings`     | · `biceps-femoris`, `medial-hamstrings` (Semitendinosus/-membranosus)                                                                            |
| `adductors`      | `adductors` · `adductors`                                                                                                                        |
| `calves`         | `gastrocnemius-medial`, `soleus` · `gastrocnemius-medial`, `gastrocnemius-lateral`, `soleus`                                                     |
| – (Orientierung) | `serratus-anterior`, `brachialis`, `tensor-fasciae-latae`, `sartorius`, `tibialis-anterior`, `fibularis-longus` · `infraspinatus`, `teres-major` |

Orientierungsmuskeln werden gezeichnet, aber nie hervorgehoben: Keine Übung der Bibliothek nennt
sie als Gruppe (z. B. ist der Serratus keine eigene Gruppe; der Brachialis wird bewusst nicht dem
„Bizeps“ zugeschlagen).

## Assets und Lizenz

- Vier SVGs unter `src/modules/training/muscleMap/svg/` (je ca. 30 KB, zusammen ca. 32 KB gzip),
  als Text gebündelt und inline eingesetzt – offline, keine externen Verweise, keine Skripte.
- **Eigene Zeichnung**, erzeugt mit `node tools/muscle-maps/build.mjs` (deterministisch; ein Test
  vergleicht die Dateien byte-genau). Keine fremden Bilder, Atlanten oder SVG-Sets – Herkunft:
  [`svg/ATTRIBUTION.md`](../src/modules/training/muscleMap/svg/ATTRIBUTION.md).
- Die weibliche Karte ist dieselbe Zeichnung mit weiblichen Proportionen (Schulter, Taille,
  Hüfte, Oberschenkel als glatte Breitenfunktion) und eigenen Details (Brustkontur, Haar, weniger
  Bauch-Zeichnung). Dadurch tragen beide Körper garantiert dieselben IDs.
- Die Dateien enthalten Ersatzfarben, nur damit sie allein betrachtet lesbar sind; in der App
  kommen alle Farben aus den Tokens `--color-anatomy-*` und `--color-muscle-*`
  ([DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)).

## Darstellung und Barrierefreiheit

- Kontrast (Flächen, WCAG 1.4.11): Primär zu neutral 3,8 : 1 (hell) bzw. 3,6 : 1 (dunkel);
  Sekundär liegt dazwischen und hat zusätzlich eine Korallkontur. Die Information hängt nie an
  der Farbe allein: Primär/Sekundär stehen immer als Text daneben.
- Die Karte ist ein Bild mit Beschreibung („Muskelkarte, Vorder- und Rückansicht. Primär: …“);
  die SVGs selbst sind `aria-hidden`. In der kleinen Karte benennt der Knopf die Aktion.
- Linien skalieren nicht mit (`vector-effect: non-scaling-stroke`): klare Konturen in der kleinen
  wie der großen Ansicht. Ganze Karte als Touch-Ziel; Umschalter mit 44-pt-Segmenten.
- Kein WebGL, keine Animation; Farbwechsel 200 ms, bei „Bewegung reduzieren“ ohne Übergang.

## Grenzen

- **Schematische Atlas-Zeichnung**, kein medizinisch exaktes Abbild: oberflächliche Muskeln in
  vereinfachten Umrissen; tiefe Muskeln (z. B. Rhomboideen) sind nicht gezeichnet. Hände, Füße
  und Kopf sind bewusst schlicht (kein Gesicht).
- Hervorhebung **pro Gruppe**: Die Übungsdaten kennen nur Gruppen. „Rücken“ markiert Trapezius
  und Rückenstrecker gemeinsam, auch bei Shrugs; „Schultern“ alle drei Deltaanteile, auch beim
  Seitheben. Feinere Zuordnungen bräuchten ein erweitertes Übungsmodell.
- Kein Gerätetest bisher (nur Chromium/Playwright, 320 und 390 px, hell und dunkel).

## Dateien

| Datei                                             | Aufgabe                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| `tools/muscle-maps/build.mjs`                     | Generator der vier SVGs                                   |
| `src/modules/training/muscleMap/regions.ts`       | Muskel-IDs → Gruppe, `highlightSvg` (rein, ohne React)    |
| `src/modules/training/muscleMap/svgs.ts`          | gebündelte SVG-Texte                                      |
| `src/modules/training/muscleMap/MuscleMap.tsx`    | Karte, kleine Karte (Knopf), große Ansicht (Profilkörper) |
| `src/modules/training/muscleMap/regions.test.ts`  | IDs, Gleichheit beider Körper, Hervorhebung, Generator    |
| `src/modules/training/exerciseMuscleMap.test.tsx` | Einbindung in Details und Zusammenfassung                 |
| `e2e/muscleMap.spec.ts`                           | Produktions-Build in Chromium (390/320 px, hell/dunkel)   |
