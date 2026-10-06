# Kalethra-Figuren – Assets

Zwei Körper in derselben Kalethra-Formensprache: **männlich** und **weiblich**. Gebündelt als
`public/figure/male/kalethra-male.glb` und `public/figure/female/kalethra-female.glb`; der
App-Vertrag steht in [`docs/EXERCISE_VISUALS.md`](../../../docs/EXERCISE_VISUALS.md).

```
assets/figure/
├─ male/shape.json        Formparameter, Höhe, Dreiecke, Größe, Bone-Positionen (generiert)
├─ female/shape.json      dito
├─ animations/clips.json  Clips mit Dauer und Gerätevariante (generiert)
├─ materials/materials.json  Materialien (sRGB) und Normal-Map (generiert)
├─ validation/            Validator-Berichte beider GLBs (aus den Tests, byte-genau geprüft)
└─ docs/README.md         dieses Dokument
public/figure/<variant>/kalethra-<variant>.glb   die Assets, die die App lädt
tools/figures/            die Pipeline, die alles oben erzeugt
```

## Gestaltung (verbindlich)

- Premium, ruhig, leicht skulptural, dezent griechisch-klassisch – keine Statue, nicht
  fotorealistisch, kein Comic, nicht sexualisiert, nicht medizinisch, kein Bodybuilder.
- Haut matt, warm-neutral (`#cdbdae`, Rauheit 0,74), keine Poren. Kopf ohne Gesichtszüge,
  ohne Haare; keine Körperbehaarung. Junge Erwachsene, Mitte/Ende 20.
- Hände mit fünf Fingern (geschlossen, leicht gebeugt), barfuß mit Zehen.
- Eng anliegendes ärmelloses Top und kurze Shorts, sehr dunkles Anthrazit (`#2a2c30`), matt,
  mit abgesetztem Saum.
- Ruhepose: aufrecht, Füße etwa schulterbreit, Arme 12° vom Körper, Ellbogen locker
  (9° gebeugt), Hände neutral (Handflächen zum Oberschenkel), keine Anspannung.

**Männlich:** klassisch-athletisch, etwas breitere Schultern, kein übertriebenes V
(MakeHuman: Muskel 0,75, schlank 0,45, ideale Proportionen 0,7; Größe 1,73 m).
**Weiblich:** eigenes anatomisches Modell (eigene MakeHuman-Geschlechts-Targets, keine skalierte
männliche Figur), natürliches Verhältnis von Schulter und Hüfte, natürliche, nicht betonte
Brust (kleine Cup-Stufe, Brustwarzen-Targets reduziert, Stoff glättet), Muskeln lesbar
(Muskel 0,65, schlank 0,4, ideale Proportionen 0,7; Größe 1,59 m).

## Muskeln

- Geometrische Muskelformen: Grundform aus MakeHumans Muskel-Targets, dazu je Region eine
  leichte Wölbung zur Mitte und weiche Trennfugen an den Grenzen (2–3 mm tief zwischen
  Gruppen, flacher zwischen Teilen einer Gruppe, unter Stoff abgeschwächt).
- Faserstruktur über eine Normal-Map (2048², tangent space): je Muskel ein eigener
  Faserverlauf (Brust fächert zum Oberarm, Deltamuskel zum Ansatz, Latissimus zur Achsel,
  Rectus senkrecht mit Linea alba und Sehnenquerstreifen …), auf der Kleidung feine Rippen,
  sonst glatt. Aus normaler Distanz ruhig, aus der Nähe erkennbar.
- Hervorhebung färbt nur die Grundfarbe (primär > sekundär > neutral); Form, Fugen und Fasern
  bleiben sichtbar.
- 22 Muskel-Knoten + 7 neutrale Haut-Knoten (`body_head`, `body_neck`, `body_hands`,
  `body_feet`, `body_knees`, `body_shins`, `body_pelvis`); Liste in `*/shape.json`.

## Rig

Pflicht-Bones des Vertrags, alle mit Ruhe-Rotation Identität (nur Translation), dazu
`forearmTwist_L/R`. Gewichte aus MakeHumans Standard-Skelett (163 Bones) zusammengeführt,
höchstens 4 Einflüsse pro Punkt, in 8 Bit quantisiert (Summe exakt 1).

| Kalethra-Bone    | Elternteil       | MakeHuman-Bones (zusammengeführt)  |
| ---------------- | ---------------- | ---------------------------------- |
| `root`           | –                | – (Ursprung)                       |
| `pelvis`         | `root`           | `root`, `pelvis.L/R`               |
| `spine`          | `pelvis`         | `spine05`, `spine04`, `spine03`    |
| `chest`          | `spine`          | `spine02`, `spine01`, `breast.L/R` |
| `neck`           | `chest`          | `neck01–03`                        |
| `head`           | `neck`           | `head` und alle Gesichts-Bones     |
| `shoulder_*`     | `chest`          | `clavicle`, `shoulder01`           |
| `upperArm_*`     | `shoulder_*`     | `upperarm01`, `upperarm02`         |
| `forearm_*`      | `upperArm_*`     | `lowerarm01`                       |
| `forearmTwist_*` | `forearm_*`      | `lowerarm02`                       |
| `hand_*`         | `forearmTwist_*` | `wrist`, Mittelhand, alle Finger   |
| `thigh_*`        | `pelvis`         | `upperleg01`, `upperleg02`         |
| `shin_*`         | `thigh_*`        | `lowerleg01`, `lowerleg02`         |
| `foot_*`         | `shin_*`         | `foot`, alle Zehen                 |

Bone-Positionen aus MakeHumans Gelenk-Hilfspunkten auf der jeweiligen Körperform.

## Animationen

Clips per IK erzeugt (Hände und Füße folgen Zielen, Ellbogen und Knie über Pole, Handflächen
drehen in den Griff, verteilt auf Unterarm, Twist-Bone und Hand), mit 10 Hz abgetastet,
nahtlos geloopt, 4,4 s je Wiederholung:

| Clip                   | Haltung und Bewegung                                                  | Geräte (`prop_*`)                    |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| `rest`                 | Ruhepose, ein Schlüsselbild                                           | –                                    |
| `horizontalPush_bench` | Rückenlage auf der Flachbank, Stange von gestreckten Armen zur Brust  | `prop_bench_frame`, `prop_bench_bar` |
| `verticalPull_cable`   | sitzend unter dem Polster, Stange von oben zur oberen Brust, Rücklage | `prop_cable_frame/bar/wire`          |

## Erzeugen

```
git clone https://github.com/makehumancommunity/makehuman
git -C makehuman checkout a8bc2d54ff0ac92e78ff71431b1023eda42bf482
MAKEHUMAN_DATA=$PWD/makehuman/makehuman/data node tools/figures/build.mjs
npx vitest run -u src/modules/training/figure/kalethraBodies.test.ts   # Validator-Berichte
```

Der Build ist deterministisch (gleiche Eingaben → byte-gleiche GLBs). Schritte: Form aus
Targets → Ruhepose (Linear Blend Skinning) → entspannte Hände, glatter Kopf ohne
Gesichtszüge → eine Catmull-Clark-Stufe für Rumpf und Gliedmaßen → Muskel- und
Kleidungs-Segmentierung nach anatomischen Landmarken, geglättete Grenzen → Trennfugen,
Wölbungen, Stofflage mit Saum, gemeinsame Normalen → Normal-Map (analytisch in 3D gebacken)
→ Skin, Clips, Geräte → GLB mit Metadaten (`asset.extras.kalethra`).

## Herkunft und Lizenz

MakeHuman 1.x, Repository `makehumancommunity/makehuman`, Commit
`a8bc2d54ff0ac92e78ff71431b1023eda42bf482`: Basisnetz (`3dobjs/base.obj`), Targets
(`targets/macrodetails`, `breast`), Skelett und Gewichte (`rigs/default.*`). Diese Assets stehen
seit September 2020 unter **CC0 1.0** (`LICENSE.ASSETS.md`) – frei auch kommerziell, ohne
Namensnennungspflicht. MakeHuman-Programmcode (AGPL) wird nicht verwendet; die Pipeline ist
eigener Code.

## Ehrlicher Stand und Grenzen

Die Körper erfüllen Vertrag, Budgets und die Gestaltungsregeln in den Grundzügen und laufen in
der App. Sie sind aber prozedural erzeugt, nicht von einer 3D-Künstlerin oder einem
3D-Künstler gestaltet. Bekannt:

- Muskeldefinition bewusst dezent; Muskelgrenzen folgen Regeln, nicht einer
  Handmodellierung (an Übergängen teils vereinfacht, z. B. Schulterblatt-Bereich).
- Linear Blend Skinning: bei starker Beugung (Ellbogen im Bankdrücken unten) etwas
  Volumenverlust; die Hände umschließen die Stange nur angedeutet.
- Kleidung ist eine versetzte Lage der Haut, keine Stoffsimulation.
- Nur drei Clips; die übrigen Movement-Types fallen auf `rest` zurück.
- Kein Test auf einem realen Gerät (auch nicht auf dem Xiaomi 15 Ultra); geprüft wurde in
  Chromium mit Software-WebGL.
