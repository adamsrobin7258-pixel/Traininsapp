# 3D-Übungsdarstellung

Ziel: **Kalethra-Übung → hochwertiger humanoider Körper → erkennbare anatomische Muskelgruppen →
dezente Muskelfaserstruktur → Kalethra-Hervorhebung → passende Bewegungsanimation.**

> **Stand (Version 0.27.0): technisch fertig, visuell nicht.** Gezeigt wird ein im Code gebauter
> **Fallback-Körper** (Gliederpuppe). Er ist ein Platzhalter und **nicht** die angestrebte
> visuelle Qualität. Die modellierten Körper (männlich, weiblich) fehlen noch; die App ist so
> vorbereitet, dass sie ohne Änderung an Übungsdetails oder Trainings-Zusammenfassung eingesetzt
> werden können.

## Datenfluss (Quelle der Wahrheit)

```
Exercise (Bibliothek)
  ├─ primaryMuscles / secondaryMuscles ──► muscleMap ──► Hervorhebung pro Muskelgruppe
  └─ movementPattern (+ Eintrag in EXERCISE_VISUALS) ──► Movement-Type ──► Animation-Clip
Profil.sex ──► Körpervariante (male | female, sonst Standard) ──► Asset oder Fallback
```

- Muskeln kommen ausschließlich aus der Übung (`core/training/muscleMap.ts`). Der Körper
  visualisiert sie nur; die Übungsdaten sind für alle Varianten identisch.
- `fullBody` steht für alle 13 Regionen; primär gewinnt vor sekundär.
- Workout-Zusammenfassung: Vereinigung der Muskeln aller Übungen mit mindestens einem
  abgeschlossenen Satz – keine Gewichtung, kein Score, keine Statistik.

## Architektur (`src/modules/training/figure/`)

| Datei               | Aufgabe                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `contract.ts`       | Asset-Vertrag als Code: Varianten, Asset-Registry, Knoten-/Bone-/Clip-Namen, Validator, Budgets |
| `body.ts`           | Schnittstelle `FigureBody`, die jeder Körper erfüllt                                            |
| `gltfBody.ts`       | Modellierter Körper aus einem gebündelten GLB (eigener Lazy-Chunk)                              |
| `fallbackBody.ts`   | **Fallback**: im Code gebauter Platzhalter-Körper, gleiche Schnittstelle                        |
| `rig.ts`            | Skelett, Zwei-Knochen-IK und Bewegungen des Fallback-Körpers                                    |
| `figureRenderer.ts` | Szene, Kamera, Licht, Render-Schleife; wählt Asset oder Fallback (`createBody`)                 |
| `FigureCanvas.tsx`  | React-Hülle: lädt three.js erst bei Bedarf, Profil-Variante, Theme, Kontextverlust              |
| `MuscleFigure.tsx`  | Kleine Figur (Details, Zusammenfassung) und große Ansicht (Sheet)                               |

`ExerciseDetailSheet` und `WorkoutSummarySheet` kennen nur `MuscleFigurePreview` /
`MuscleFigureSheet` mit einem Clip-Namen und der Hervorhebung – nie einen konkreten Körper.

### Transform-Hierarchie (Rotationsfehler behoben)

```
scene
├─ Lichter, Kamera (fest)
└─ stage            ← der einzige Knoten, den die Ansicht dreht (Ziehen, Vorder-/Rückseite)
   └─ slot(s)       ← feste Platzierung (Paar: links/rechts, die zweite Figur einmal um 180°)
      └─ body.root  ← Koordinatensystem des Körpers; nur der Körper schreibt darunter
         ├─ skeleton / Mesh-Hierarchie (Haltung, Animation)
         └─ prop_*  (Gerät, Stange, Kabel, Kontaktschatten)
```

Regeln: Die Ansicht schreibt nur `stage.rotation.y`. Ein Körper schreibt nur lokale
Transformationen unterhalb seines `root` und liest **nie** Weltmatrizen.

Ursache des Fehlers in 0.26.0: Die Stange (und das Kabel) wurden über `matrixWorld` des Körpers
positioniert – also inklusive der Ansichtsdrehung –, hingen aber selbst unter `root`. Bei
gedrehter Figur und laufender Bewegung wirkte die Drehung doppelt; die Stange verließ die Hände.
Zusätzlich hing die Verdrehung der Gliedmaßen am rohen Richtungshinweis der Bewegung, der fast
parallel zum Knochen liegen konnte. Jetzt kommt sie aus der Biegeebene der IK, die immer in
deutlichem Winkel zum Knochen steht (getestet über die ganze Schleife).

## Asset-Vertrag (GLB / glTF 2.0)

Ein Körper pro Variante: `male`, `female`. Beide erfüllen denselben Vertrag. Eintrag in
`FIGURE_ASSETS` (`contract.ts`), Datei unter `public/figure/` (wird gebündelt, offline).
Ohne Eintrag oder bei einem Fehler zeigt die App den Fallback – nie einen Fehler.

### Namen

**Nur Buchstaben, Ziffern und `_`** (`SAFE_NAME`). Der glTF-Loader von three.js entfernt
`[ ] . : /` aus Knotennamen (`PropertyBinding.sanitizeNodeName`), und Animationsspuren
adressieren Knoten als `<knoten>.<eigenschaft>` – `muscle:chest` käme als `musclechest` an.
Nie auf Mesh-Indizes verlassen (`mesh_17`).

| Element        | Name                                              | Beispiel                                             |
| -------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Muskelgruppe   | `muscle_<gruppe>`                                 | `muscle_chest`, `muscle_lats`                        |
| Muskel-Teil    | `muscle_<gruppe>_<teil>`                          | `muscle_shoulders_front`, `muscle_back_erectors`     |
| Übriger Körper | frei, ohne `muscle_`-Präfix                       | `body_skin`, `cloth_shirt`, `cloth_shorts`           |
| Bones          | siehe unten, Seiten `_L` / `_R`                   | `upperArm_L`, `thigh_R`                              |
| Clips          | `<movementType>` oder `<movementType>_<variante>` | `rest`, `horizontalPush_bench`, `verticalPull_cable` |

Muskelgruppen = Gruppen der Übungsbibliothek (13): `chest`, `back`, `lats`, `shoulders`,
`biceps`, `triceps`, `forearms`, `core`, `glutes`, `quadriceps`, `hamstrings`, `adductors`,
`calves`. Teile (optional, empfohlen): `chest_upper/lower`, `shoulders_front/middle/rear`,
`back_trapezius/rhomboids/erectors`, `core_rectus/obliques`, `forearms_flexors/extensors`,
`glutes_maximus/medius`, `calves_gastrocnemius/soleus`. Hervorgehoben wird immer die ganze
Gruppe; die Teile machen die Anatomie lesbar.

### Skelett

Pflicht-Bones: `pelvis`, `spine`, `chest`, `neck`, `head` und je Seite `shoulder`, `upperArm`,
`forearm`, `hand`, `thigh`, `shin`, `foot` (`_L`, `_R`). Ruhepose: stehend, Arme leicht vom
Körper. Gleiche Bone-Namen in beiden Varianten, damit dieselben Clips auf beiden laufen.

### Koordinaten, Maßstab, Ausrichtung

- Meter, **+Y oben, +Z = Vorderseite des Körpers** (glTF-Konvention), rechtshändig.
- Ursprung auf dem Boden mittig unter dem Körper; Boden bei y = 0.
- Körpergröße ca. 1,75 m (männlich) bzw. 1,68 m (weiblich), neutral-athletisch.
- Die App dreht nur die `stage`; der Körper darf keine eigene Wurzel-Rotation in Clips haben,
  außer sie gehört zur Bewegung (z. B. Liegen auf der Bank).

### Animation

Ein gemeinsamer Körper, viele Clips – nicht ein Modell pro Übung. Movement-Types:
`rest`, `horizontalPush`, `verticalPush`, `horizontalPull`, `verticalPull`, `squat`, `hinge`,
`lunge`, `curl`, `extension`, `raise`, `carry`, `core`. Die Zuordnung Übung → Movement-Type
kommt aus `movementPattern` der Bibliothek; nur `isolation`/`other` nennen ihn in
`EXERCISE_VISUALS` ausdrücklich (z. B. `curl`). Varianten für Geräte: `horizontalPush_bench`.
Auflösung: exakter Clip → Movement-Type → `rest`.

- Pflicht: `rest`. Clips nahtlos loopend, ruhig (3,5–5 s je Wiederholung), kein Root-Motion.
- Geräte (Bank, Kabelturm, Stange …) als eigene Knoten `prop_<name>` im selben GLB oder als
  separate kleine GLBs; sie bewegen sich über eigene Spuren mit.

### Material und Faserstruktur (Variante A)

Anatomie → Muskelstruktur → Kalethra-Hervorhebung:

- Form: Muskeln modelliert (Volumen, Übergänge), nicht als farbige Flächen.
- Struktur: Faserverlauf dezent über eine **Normal-Map** (und Rauheit), aus normaler Distanz
  elegant, aus der Nähe erkennbar; keine Linienzeichnung, keine Lehrbuch-Optik.
- Hervorhebung: Die App kopiert pro Muskel-Knoten das Material und färbt nur die Grundfarbe
  Richtung Kalethra-Akzent (primär voll, sekundär halb). Normal-Map, Rauheit und Struktur
  bleiben darunter sichtbar. Muskel-Materialien: `MeshStandardMaterial`-kompatibel (glTF PBR
  Metallic-Roughness), Metallic 0, Rauheit 0,6–0,9, matte Optik.
- Kleidung: eng anliegendes Shirt bzw. minimalistisches Oberteil, kurze Hose, matt, ohne Logos
  und Muster; darf Muskelgruppen nicht verdecken (Shirt dünn modelliert, Muskeln darunter
  sichtbar, oder ärmellos).

### Gestaltung

Neutral-athletisch, harmonische klassische Proportionen, leicht skulptural – dezent an der
griechischen Darstellung eines athletischen Körpers orientiert. **Nicht**: Statue 1:1, Toga,
Rüstung, Marmor- oder Rissoptik, Bodybuilder-Proportionen, Sexualisierung. Kein ausgearbeitetes
Gesicht, keine Frisur, keine individuellen Merkmale.

### Budgets (Android/iOS, Mittelklasse und Xiaomi 15 Ultra)

| Größe           | Grenze pro Variante                                               |
| --------------- | ----------------------------------------------------------------- |
| GLB komprimiert | ≤ 4 MB (Geometrie + Texturen + Clips)                             |
| Dreiecke        | ≤ 60 000                                                          |
| Texturen        | ≤ 2048², empfohlen: 1 Normal-Map 2048², 1 ORM 1024², KTX2 (Basis) |
| Materialien     | ≤ 8                                                               |
| Kompression     | Meshopt oder Draco; Decoder **lokal** gebündelt (kein CDN)        |

Grundfarben brauchen keine Textur (Faktoren reichen); die Faserstruktur steckt in der
Normal-Map. Zwei Varianten = höchstens ca. 8 MB im APK.

### Prüfung

`validateFigureAsset()` prüft Muskelgruppen, unbekannte `muscle_`-Knoten (Tippfehler),
Pflicht-Bones, Clip-Namen und den `rest`-Clip. `gltfBody` verwendet ein Asset nur, wenn es den
Vertrag erfüllt; sonst Fallback. Tests decken Vertrag, Namen nach dem Loader, Auswahl
male/female, Fallback bei fehlendem oder fehlerhaftem Asset und die Clip-Auflösung ab.

## Fallback-Körper

Klar gekapselt in `fallbackBody.ts`, erfüllt dieselbe Schnittstelle und dieselben Namen. Er
bleibt als technischer Fallback (kein WebGL-Asset vorhanden, Asset defekt) und für Tests. Er hat
nur die Clips `rest`, `horizontalPush_bench`, `verticalPull_cable`.

## Performance

- three.js als eigener Chunk (lazy), GLB-Loader als weiterer Chunk nur bei registriertem Asset.
- Höchstens ein aktiver WebGL-Kontext (große Ansicht ersetzt das Sheet), Freigabe beim
  Schließen (`forceContextLoss`); bei Kontextverlust (App im Hintergrund) neue Leinwand.
- Rendern nur bei Bedarf, keine Echtzeit-Schatten, Pixelverhältnis ≤ 2.
- Reduced Motion: keine automatische Schleife, Drehen ohne Übergang.

## Lizenz

| Teil                          | Quelle                   | Lizenz                                                | Kommerziell | Bearbeitung |
| ----------------------------- | ------------------------ | ----------------------------------------------------- | ----------- | ----------- |
| Fallback-Körper, Bewegungen   | eigener Code             | Eigentum des Projekts                                 | ja          | ja          |
| three.js 0.186 (+ GLTFLoader) | npm `three`              | MIT                                                   | ja          | ja          |
| Modellierte Körper            | **noch nicht vorhanden** | eigenes oder eindeutig kommerziell lizenziertes Asset | –           | –           |

Keine Modelle mit unklarer Lizenz.

## Was für die finalen Körper noch fehlt

1. Zwei modellierte Körper (male, female) nach diesem Vertrag: Topologie mit getrennten
   Muskel-Knoten, Normal-Map für die Faserstruktur, Kleidung, Rig mit den Pflicht-Bones.
2. Clips mindestens `rest`, `horizontalPush_bench`, `verticalPull_cable`; danach weitere
   Movement-Types.
3. Optional Meshopt/KTX2-Kompression und die lokalen Decoder.
4. Eintrag in `FIGURE_ASSETS`, Gerätetest auf dem Xiaomi 15 Ultra.
