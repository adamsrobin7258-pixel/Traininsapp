# 3D-Übungsdarstellung

Ziel: **Kalethra-Übung → hochwertiger humanoider Körper → erkennbare anatomische Muskelgruppen →
dezente Muskelfaserstruktur → Kalethra-Hervorhebung → passende Bewegungsanimation.**

> **Stand (Version 0.29.0):** Zwei Kalethra-Körper (männlich, weiblich) sind gebündelt und
> werden in Übungsdetails, großer Ansicht und Trainings-Zusammenfassung gezeigt. Beide entstehen
> reproduzierbar mit der Pipeline in `tools/figures/` auf MakeHuman-Daten (CC0). **Der männliche
> Körper trägt seit 0.29.0 eine modellierte Anatomie** (Phase 18.3, aus „Proxy Human base Mesh“
> von sphere_joe, CC BY 4.0, bearbeitet – Namensnennung in der App unter _Datenquellen_ und in
> der GLB, siehe [`assets/figure/male/source/ATTRIBUTION.md`](../assets/figure/male/source/ATTRIBUTION.md)),
> mit Finger-Griff und Schulterrhythmus in den Clips. Der weibliche ist unverändert (0.28.0). Gestaltung, Herkunft und
> bekannte Grenzen: [`assets/figure/docs/README.md`](../assets/figure/docs/README.md).
>
> **Die aktuelle Fallback-Figur ist ausschließlich technischer Fallback und nicht die finale
> visuelle Kalethra-Figur.** Sie erscheint nur, wenn ein Asset fehlt oder nicht geladen werden
> kann, und in Tests.

## Datenfluss (Quelle der Wahrheit)

```
Exercise (Bibliothek)
  ├─ primaryMuscles / secondaryMuscles ──► muscleMap ──► Hervorhebung pro Muskelgruppe
  └─ movementPattern / ISOLATION_CLIPS ──► Movement-Type ──► Clip (<movement>[_<variante>])
Profil.sex ──► Körpervariante (male | female, sonst Standard male) ──► loadBody(variant)
```

- Muskeln kommen ausschließlich aus der Übung (`core/training/muscleMap.ts`). Der Körper
  visualisiert sie nur; die Übungsdaten sind für beide Varianten identisch.
- Jede Übung der Bibliothek hat einen Movement-Type und einen Clip-Namen (`exerciseClip`):
  aus dem `movementPattern`, für `isolation`/`other` aus `ISOLATION_CLIPS` – z. B.
  Trizepsdrücken `extension_triceps`, Seitheben `raise_lateral`, Wadenheben `raise_calf`;
  Schulterdrücken `verticalPush`, Rudern `horizontalPull`. Ein Clip, den ein Körper (noch) nicht
  hat, fällt auf den Movement-Type und dann auf `rest` zurück.
- Gezeigt wird die Figur bisher bei Langhantel-Bankdrücken und Latzug (`EXERCISE_VISUALS`) und
  in der Trainings-Zusammenfassung (Ruhepose). Weitere Übungen kommen dazu, sobald ihr Clip
  modelliert ist – vorher würden sie nur die Ruhepose zeigen.
- Workout-Zusammenfassung: Vereinigung der Muskeln aller Übungen mit mindestens einem
  abgeschlossenen Satz – keine Gewichtung, kein Score, keine Statistik.

## Architektur (`src/modules/training/figure/`)

| Datei               | Aufgabe                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `contract.ts`       | Asset-Vertrag als Code: Varianten, Asset-Registry, Knoten-/Bone-/Prop-/Clip-Namen, Budgets  |
| `assetValidator.ts` | Datei-Validator für GLB-Assets (Container, Referenzen, Vertrag, Budgets, Koordinatensystem) |
| `body.ts`           | Schnittstelle `FigureBody`, die jeder Körper erfüllt                                        |
| `gltfBody.ts`       | Modellierter Körper aus dem gebündelten GLB (eigener Lazy-Chunk), Cache mit Referenzzählung |
| `figureRenderer.ts` | `loadBody(variant)`, Szene, Kamera, Licht, Render-Schleife                                  |
| `fallbackBody.ts`   | **Technischer Fallback**: im Code gebaute Gliederpuppe, gleiche Schnittstelle               |
| `rig.ts`            | Skelett, Zwei-Knochen-IK und Bewegungen des Fallback-Körpers                                |
| `FigureCanvas.tsx`  | React-Hülle: lädt three.js erst bei Bedarf, Profil-Variante, Theme, Kontextverlust          |
| `MuscleFigure.tsx`  | Kleine Figur (Details, Zusammenfassung) und große Ansicht (Sheet)                           |

`ExerciseDetailSheet` und `WorkoutSummarySheet` kennen nur `MuscleFigurePreview` /
`MuscleFigureSheet` mit einem Clip-Namen und der Hervorhebung – nie einen konkreten Körper.

### Laden (`loadBody`)

- `loadBody("male" | "female", options)` lädt das Asset der Variante aus den App-Dateien
  (`<BASE_URL>figure/<variant>/kalethra-<variant>.glb`, auch von tiefen Routen aus richtig) –
  **offline**, kein CDN, kein Netz.
- Lazy: three.js und der GLB-Loader sind eigene Chunks, geladen erst, wenn eine Figur sichtbar
  wird. Das GLB selbst wird erst dann geholt.
- Eine Datei, mehrere Körper (Zusammenfassung: Vorder- und Rückseite): einmal geladen, jeder
  Körper ist ein Klon mit eigenem Skelett (`SkeletonUtils.clone`); Geometrie und Textur werden
  geteilt und mit dem letzten Körper freigegeben (`dispose`: Mixer, Materialkopien, dann
  Geometrie, Materialien, Texturen).
- Fallback nur, wenn kein Asset registriert ist oder Laden bzw. Vertrag scheitern – mit
  `console.warn`, nie mit einem Fehler für die Nutzerin oder den Nutzer.
- Höchstens ein WebGL-Kontext (die große Ansicht ersetzt das Sheet), Freigabe beim Schließen.

### Transform-Hierarchie

```
scene
├─ Lichter, Kamera (fest)
└─ stage            ← der einzige Knoten, den die Ansicht dreht (Ziehen, Vorder-/Rückseite)
   └─ slot(s)       ← feste Platzierung (Paar: links/rechts, die zweite Figur einmal um 180°)
      └─ body.root  ← Koordinatensystem des Körpers; nur der Körper schreibt darunter
         ├─ root (Bone) … Skelett, Haut- und Muskel-Meshes (Skinning)
         └─ prop_*  (Bank, Stange, Kabelturm, Kabel – über eigene Clip-Spuren bewegt)
```

Die Ansicht schreibt nur `stage.rotation.y`; ein Körper schreibt nur lokale Transformationen
unterhalb seines `root` und liest nie Weltmatrizen. Damit gibt es keine doppelte Drehung, und
Stange und Hände bleiben bei jeder Drehung beieinander (getestet mit den echten Assets).
Unterarmdrehungen verteilen sich auf Unterarm, Twist-Bone und Hand – kein Umklappen im Ellbogen.

## Asset-Vertrag (GLB / glTF 2.0)

Ein Körper pro Variante: `male`, `female`; gleicher Vertrag, gleiche Bones, gleiche Clips.
Registriert in `FIGURE_ASSETS` (`contract.ts`), Dateien unter `public/figure/<variant>/`.

### Namen

**Nur Buchstaben, Ziffern und `_`** (`SAFE_NAME`): Der glTF-Loader von three.js entfernt
`[ ] . : /` aus Knotennamen, und Animationsspuren adressieren Knoten als
`<knoten>.<eigenschaft>`. Nie auf Mesh-Indizes verlassen.

| Element       | Name                                              | Beispiel                                             |
| ------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Muskelgruppe  | `muscle_<gruppe>`                                 | `muscle_lats`, `muscle_biceps`                       |
| Muskel-Teil   | `muscle_<gruppe>_<teil>`                          | `muscle_shoulders_front`, `muscle_back_erectors`     |
| Neutrale Haut | `body_<teil>`                                     | `body_head`, `body_hands`, `body_feet`               |
| Geräte        | `prop_<variante>_<teil>`                          | `prop_bench_bar`, `prop_cable_wire`                  |
| Bones         | siehe unten, Seiten `_L` / `_R`                   | `upperArm_L`, `thigh_R`                              |
| Clips         | `<movementType>` oder `<movementType>_<variante>` | `rest`, `horizontalPush_bench`, `verticalPull_cable` |

Muskelgruppen = Gruppen der Bibliothek (13): `chest`, `back`, `lats`, `shoulders`, `biceps`,
`triceps`, `forearms`, `core`, `glutes`, `quadriceps`, `hamstrings`, `adductors`, `calves`.
Teile: `chest_upper/lower`, `shoulders_front/middle/rear`, `back_trapezius/rhomboids/erectors`,
`core_rectus/obliques`, `forearms_flexors/extensors`, `glutes_maximus/medius`,
`calves_gastrocnemius/soleus`. Es gibt keine parallelen IDs (`traps`, `abs`, `quads` …): Diese
Begriffe heißen im Vertrag `back_trapezius`, `core_rectus`, `core_obliques`, `quadriceps`,
`shoulders_middle`. Hervorgehoben wird immer die ganze Gruppe – auf der Haut und auf der
Kleidung darüber. Ein Mesh mit Haut- und Stoffteil wird vom Loader zu einer Gruppe mit Kindern
`<name>_1`, `<name>_2`; die Endung gehört dem Loader und wird toleriert.

Geräte (`prop_<variante>_*`) sind nur sichtbar, solange ein Clip dieser Variante läuft
(`horizontalPush_bench` → `prop_bench_*`), und nehmen die Theme-Farben für Gerät und Metall an.

### Skelett

Pflicht-Bones: `root`, `pelvis`, `spine`, `chest`, `neck`, `head` und je Seite `shoulder`
(Schlüsselbein), `upperArm`, `forearm` (Unterarm), `hand`, `thigh` (Oberschenkel), `shin`
(Unterschenkel), `foot` (`_L`, `_R`). Zusätzliche Bones sind erlaubt (die Körper haben
`forearmTwist_L/R`, der männliche außerdem `fingers_*`, `fingerTips_*`, `thumb_*` für den Griff). Ruhe-Rotationen aller Bones sind die Identität; die Ruhepose ist
aufrecht, Füße etwa schulterbreit, Arme 10–15° vom Körper, Ellbogen locker, Hände neutral.

### Koordinaten, Maßstab, Ursprung

- Meter, **+Y oben, +Z = Vorderseite des Körpers** (glTF), rechtshändig.
- Boden bei y = 0, Ursprung auf dem Boden zwischen den Hüftgelenken.
- Die Szenen-Wurzel und der Bone `root` sind untransformiert; Haltungen (Liegen, Sitzen)
  kommen aus den Clips (Spuren auf `pelvis`), nie aus der Wurzel.

### Animation

Ein Körper, viele Clips – nicht ein Modell pro Übung. Movement-Types: `rest`,
`horizontalPush`, `verticalPush`, `horizontalPull`, `verticalPull`, `squat`, `hinge`, `lunge`,
`curl`, `extension`, `raise`, `carry`, `core`; Varianten nach Gerät oder Ausführung
(`horizontalPush_bench`, `extension_triceps`, `raise_lateral`, `raise_calf` …). Auflösung:
exakter Clip → Movement-Type → `rest`. Clips loopen nahtlos, ruhig (4,4 s je Wiederholung).
Steht die Figur still (kleine Ansicht, Reduced Motion), zeigt sie den Clip bei 30 % seiner
Schleife – einen Moment, der die Übung erklärt.

Vorhanden: `rest`, `horizontalPush_bench` (Langhantel-Bankdrücken auf der Flachbank),
`verticalPull_cable` (Latzug sitzend). Spezifikation: `assets/figure/animations/clips.json`.

### Budgets und Validator

| Größe       | Grenze pro Variante | männlich / weiblich (0.29.0) |
| ----------- | ------------------- | ---------------------------- |
| GLB         | ≤ 4 MB              | 3,06 / 3,53 MB               |
| Dreiecke    | ≤ 60 000            | 52 090 / 52 014              |
| Texturen    | ≤ 2048²             | 1 Normal-Map 2048² (PNG)     |
| Materialien | ≤ 8                 | 4                            |

`validateGlb()` (`assetValidator.ts`) prüft eine GLB-Datei ohne three.js: Laden (Magic,
Version, Chunks, JSON), alle Referenzen (Accessoren, Buffer-Views innerhalb des Binär-Chunks,
Meshes, Materialien, Texturen, Bilder, Skins, Animationen), keine externen Dateien, sichere
Namen, Vertrag (`validateFigureAsset`: Muskelgruppen, Pflicht-Bones, Clips, `rest`), Prop-Namen,
Variante (`asset.extras.kalethra.variant`), Einheit Meter, Materialanzahl, Texturgröße aus dem
Bild-Header, Dreiecke, Dateigröße sowie Koordinatensystem aus den Bindepose-Grenzen:
Körpergröße 1,45–2,05 m (fängt cm/mm-Exporte), Boden bei y = 0, zentriert über dem Ursprung,
Kopf über den Füßen (+Y), Brust vor dem Rücken (+Z), Wurzel ohne Transformation.

Die Tests prüfen beide gebündelten Dateien damit in jeder CI; die Berichte liegen unter
`assets/figure/validation/` und werden byte-genau verglichen (`vitest -u` nach einem Neubau).

## Technischer Fallback

**Die aktuelle Fallback-Figur ist ausschließlich technischer Fallback und nicht die finale
visuelle Kalethra-Figur.** Gekapselt in `fallbackBody.ts`, gleiche Schnittstelle und Namen.
Einsatz nur: Asset nicht registriert, Datei fehlt oder ist defekt, Vertrag verletzt – sowie in
Tests und Entwicklung. Sie hat nur die Clips `rest`, `horizontalPush_bench`,
`verticalPull_cable`. Ein produktiver Build zeigt sie nicht, solange die Assets vorhanden sind;
die E2E-Tests prüfen `data-figure-source="asset"`.

## Performance

- three.js und GLB-Loader als eigene Lazy-Chunks; GLB erst bei sichtbarer Figur.
- Rendern nur bei Bedarf, keine Echtzeit-Schatten, Pixelverhältnis ≤ 2.
- Bei Kontextverlust (App im Hintergrund) eine neue Leinwand.
- Reduced Motion: keine automatische Schleife, Drehen ohne Übergang.
- Genau ein WebGL-Kontext je sichtbarer Figur; Schließen, Übungswechsel und Wechsel klein ↔ groß
  geben Renderer, Geometrien, Materialien und Texturen frei (Tests und E2E prüfen das).
- Gerätetest (Xiaomi 15 Ultra) noch offen – Checkliste: [`FIGURE_DEVICE_TEST.md`](FIGURE_DEVICE_TEST.md).

## Lizenz

| Teil                            | Quelle                                    | Lizenz                                | Kommerziell | Bearbeitung  |
| ------------------------------- | ----------------------------------------- | ------------------------------------- | ----------- | ------------ |
| Kalethra-Körper weiblich (GLB)  | erzeugt mit `tools/figures` aus MakeHuman | CC0 1.0 (Basisdaten)                  | ja          | ja           |
| Kalethra-Körper männlich (GLB)  | `tools/figures` + modellierte Anatomie    | CC BY 4.0 (abgeleitet), Namensnennung | ja          | ja (Hinweis) |
| „Proxy Human base Mesh“         | Sketchfab, sphere_joe                     | CC BY 4.0                             | ja          | ja (Hinweis) |
| MakeHuman-Basisnetz, Targets, … | makehumancommunity/makehuman, `a8bc2d5…`  | CC0 1.0 (Assets)                      | ja          | ja           |
| Pipeline, Fallback, Bewegungen  | eigener Code                              | Eigentum des Projekts                 | ja          | ja           |
| three.js 0.186 (+ GLTFLoader)   | npm `three`                               | MIT                                   | ja          | ja           |

Aus MakeHuman werden nur Daten (Assets, CC0) verwendet, kein MakeHuman-Programmcode (AGPL).
