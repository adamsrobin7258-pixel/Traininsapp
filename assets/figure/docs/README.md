# Kalethra-Figuren – Assets

Zwei Körper in derselben Kalethra-Formensprache: **männlich** und **weiblich**. Gebündelt als
`public/figure/male/kalethra-male.glb` und `public/figure/female/kalethra-female.glb`; der
App-Vertrag steht in [`docs/EXERCISE_VISUALS.md`](../../../docs/EXERCISE_VISUALS.md).

```
assets/figure/
├─ male/shape.json        Formparameter, Höhe, Dreiecke, Größe, Bone-Positionen (generiert)
├─ male/source/           modellierte Anatomie (Sculpt, CC BY 4.0, bearbeitet) + ATTRIBUTION.md
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
- Hände mit fünf Fingern (locker, leicht gebeugt; männlich leicht gefächert), barfuß mit Zehen.
- Eng anliegendes ärmelloses Top und kurze Shorts, sehr dunkles Anthrazit (`#2a2c30`), matt,
  mit abgesetztem Saum.
- Ruhepose: aufrecht, Füße etwa schulterbreit, Arme 12° vom Körper, Ellbogen locker
  (9° gebeugt), Hände neutral (Handflächen zum Oberschenkel), keine Anspannung.

**Männlich (seit 0.29.0):** klassisch-athletisch, etwas breitere Schultern, kein übertriebenes V.
Die Anatomie ist **modelliert** (Phase 18.3, `tools/figure-experiment/`, aus „Proxy Human base
Mesh“, CC BY 4.0, bearbeitet – [Attribution](../male/source/ATTRIBUTION.md)) und wird im Build
auf das MakeHuman-Netz übertragen (Hybrid, siehe _Erzeugen_); Größe 1,75 m. Kopf mit
reduziertem, weichem Gesicht (keine Augen/Mund-Details), Hände und Füße in MakeHuman-Form.
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
- **Männlich:** Volumen, Übergänge und Fugen kommen aus der modellierten Form; die Normal-Map
  trägt die Differenz zwischen Sculpt- und Formnormale (Faserrelief, feine Fugen) statt der
  analytischen Fasern (nicht auf Kopf, Händen, Füßen). Muskelgrenzen an Rumpf, Schulter und
  Oberarm folgen den modellierten Muskeln (Sculpt-Labels), sonst den Regeln unten.
- Hervorhebung färbt nur die Grundfarbe (primär > sekundär > neutral); Form, Fugen und Fasern
  bleiben sichtbar. Primär ist zu 80 % Akzent (`PRIMARY_MIX`), damit Haut/Stoff und Schattierung
  durchscheinen – kein flächiger „Diagramm“-Ton.
- **Männlich, weiche Übergänge (seit 0.29.1, `lib/highlight.mjs`):** jeder Vertex trägt bis zu
  vier Muskelgruppen mit Gewichten (`_MUSCLE_GROUPS`, `_MUSCLE_WEIGHTS`, Gruppenliste in
  `extras.muscleGroups` des Körperknotens). Sie entstehen aus den Regionen durch 30
  Glättungsschritte über die Oberfläche derselben Lage (Haut, Top, Shorts – am Saum bleibt die
  Stoffkante die Grenze) und eine Kontrastkurve (Exponent 3,2): Die Grenze verläuft ruhig statt
  im Polygonraster, der Übergang bleibt schmal (etwa 1–2 cm), das Innere einer Region behält
  ihre volle Stufe. Die App mischt den Ton pro Vertex im Shader. Kleine Splitter einer Region
  (< 30 cm², z. B. „Rückenstrecker“ auf der Bauchvorderseite) gehen in der Segmentierung an ihre
  Umgebung (`mergeIslands`, `lib/segment.mjs`).
- 22 Muskel-Knoten + 7 neutrale Haut-Knoten (`body_head`, `body_neck`, `body_hands`,
  `body_feet`, `body_knees`, `body_shins`, `body_pelvis`); Liste in `*/shape.json`.

## Rig

Pflicht-Bones des Vertrags, alle mit Ruhe-Rotation Identität (nur Translation), dazu
`forearmTwist_L/R`; **nur männlich** zusätzlich drei Glieder je Finger und Daumen für den Griff
(seit 0.29.1, siehe Tabelle; 52 Bones). Gewichte aus MakeHumans Standard-Skelett (163 Bones)
zusammengeführt, höchstens 4 Einflüsse pro Punkt, in 8 Bit quantisiert (Summe exakt 1).

**Schultergürtel (männlich, seit 0.29.1):** MakeHuman übergibt die Haut hinter und vor der Achsel
(Latissimus, Teres, Brustfalte) auf etwa 2 cm direkt von `chest` an `upperArm`; der Schultergürtel
trug nur wenige Prozent. Beim Heben um ~150° faltete Linear Blend Skinning dieses schmale Band
nach innen (Gerätetest 0.29.0: „Rücken knickt beim Latzug ein“). Jetzt geht dort, wo Rumpf und
Oberarm überlappen, deren gemeinsamer Anteil an `shoulder_*` (Rumpf → Schulterblatt → Oberarm in
kleineren Winkelschritten), und die Gewichte werden im Umkreis von 6–20 cm um das Schultergelenk
über das Netz geglättet (`girdleWeights`, `lib/transfer.mjs`).

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
| `hand_*`         | `forearmTwist_*` | `wrist`, Mittelhand, alle Finger¹  |
| `thumb1–3_*`¹    | `hand_*` / Glied | `finger1-1`, `-2`, `-3` (je eins)  |
| `index1–3_*`¹    | `hand_*` / Glied | `finger2-1`, `-2`, `-3`            |
| `middle1–3_*`¹   | `hand_*` / Glied | `finger3-1`, `-2`, `-3`            |
| `ring1–3_*`¹     | `hand_*` / Glied | `finger4-1`, `-2`, `-3`            |
| `pinky1–3_*`¹    | `hand_*` / Glied | `finger5-1`, `-2`, `-3`            |
| `thigh_*`        | `pelvis`         | `upperleg01`, `upperleg02`         |
| `shin_*`         | `thigh_*`        | `lowerleg01`, `lowerleg02`         |
| `foot_*`         | `shin_*`         | `foot`, alle Zehen                 |

¹ Nur männlich (Glied 1 hängt an `hand_*`, Glied 2 an 1, Glied 3 an 2); weiblich bleiben die
Finger in `hand_*`. Bis 0.29.0 hatte die männliche Hand nur `fingers_*` (alle Grundglieder),
`fingerTips_*` (alle Mittel- und Endglieder, Drehpunkt am Mittelfinger) und `thumb_*` – Zeige-,
Ring- und kleiner Finger drehten sich um die Gelenke des Mittelfingers und zerrissen im Griff.

Bone-Positionen aus MakeHumans Gelenk-Hilfspunkten auf der jeweiligen Körperform; männlich aus den
Mittellinien der Gliedmaßen der modellierten Form gemessen.

## Animationen

Clips per IK erzeugt (Hände und Füße folgen Zielen, Ellbogen und Knie über Pole, Handflächen
drehen in den Griff, verteilt auf Unterarm, Twist-Bone und Hand), mit 10 Hz abgetastet,
nahtlos geloopt, 4,4 s je Wiederholung.

**Männlich (seit 0.29.1, `lib/grip.mjs`):** Die Stange führt. Jede Übung bewegt die Stange, jede
Hand hält sie an einer expliziten Griffreferenz (Lage der Stangenachse im Ruheraum der Hand:
Bankdrücken bei 75 % der Handflächenlänge, Latzug bei 90 % – an der Fingerbasis, 6° schräg).
Daraus Handposition und -drehung (die Hand rollt auf der Stange in die Lage, in der das
Handgelenk dem Unterarm am geradesten folgt), dann die Arm-IK. Finger: Grund- und Mittelgelenk
gemeinsam gesucht, das Endgelenk schließt per Kontakt, bewertet nach „kein Glied in der Stange,
Mittel- und Endglied an der Stange, Fingerspitze nicht in der Handfläche, Mittelgelenk ≥
Grundgelenk, Endgelenk ≈ ⅔ Mittelgelenk“; Daumen per Suche über das Sattelgelenk, Glieder per
Kontakt. Gemessen an der fertigen Hand (Gelenke, Gliedlängen, palmare Dicke). Die obere Endlage
wird so gesucht, dass die Ellbogen auf 168° (Bank) bzw. 165° (Latzug) strecken – nie außer
Reichweite. Der Schultergürtel hebt sich ab 30° Armhebung mit 30 % davon (bis 24°) und folgt dem
Oberarm nach vorn (Ellbogen vor dem Körper) oder hinten (Ellbogen hinter dem Rumpf, unten im
Latzug) – skapulohumeraler Rhythmus:

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

`VARIANTS=male` baut nur eine Variante, `OUT=<dir>` schreibt woandershin (ohne die
Spezifikationen unter `assets/figure/` zu ändern).

Der Build ist deterministisch (gleiche Eingaben → byte-gleiche GLBs). Schritte: Form aus
Targets → Ruhepose (Linear Blend Skinning) → entspannte Hände, glatter Kopf ohne
Gesichtszüge → eine Catmull-Clark-Stufe für Rumpf und Gliedmaßen → Muskel- und
Kleidungs-Segmentierung nach anatomischen Landmarken, geglättete Grenzen → Trennfugen,
Wölbungen, Stofflage mit Saum, gemeinsame Normalen → Normal-Map (analytisch in 3D gebacken)
→ Skin, Clips, Geräte → GLB mit Metadaten (`asset.extras.kalethra`).

**Männlich (Hybrid, `lib/transfer.mjs`):** nach der MakeHuman-Form wird die modellierte Form
(`male/source/kalethra-male-sculpt.bin.gz`) übertragen: Gelenke aus dem Sculpt messen → Netz
per Bone-Warp auf die neuen Gelenke → in vier Runden an die nächste Sculpt-Oberfläche gleicher
Normale und gleichen Körperteils ziehen (geglättet) → Kopf radial über die Profil-Differenz,
Naht zum Hals geglättet → Falten, die das Ziehen in konkaven Stellen (hinter/unter der Achsel,
am Schulterblatt) hinterlässt, werden geglättet (`relaxFolds`) → Schultergürtel-Gewichte (siehe
_Rig_) → Hände/Füße behalten die MakeHuman-Form; die Hände werden danach verfeinert
(`lib/handform.mjs`, seit 0.29.1): Fingergelenke in die Mitte des Gliedquerschnitts (bei
MakeHuman lagen sie dicht unter dem Fingerrücken, ein gebeugter Finger quetschte seine
Beugeseite), Finger schlanker (Tiefe 84 %, Breite 90 %), Handfläche zu den Knöcheln hin flacher
(80 %), Finger in Ruhe leicht gefächert. Danach wie oben, mit eng anliegenden Stofflagen (Top 5 mm, Shorts 3 mm), Muskel-Labels aus dem Sculpt, faltensicherer
Begradigung der Regions- und Stoffgrenzen (ein Schritt, der eine Fläche um mehr als 40° kippt,
wird zurückgenommen – vorher entstanden dort die meisten Falten an Schulter und Achsel) und der
Detail-Normal-Map. Clips per IK aus den neuen Gelenken – neu erzeugt,
nicht skaliert. Die Sculpt-Datei erzeugt `tools/figure-experiment/blender/stage6_export_sculpt.py`.

**Oberflächenreparatur (seit 0.30.1, Phase 19.1, `lib/repair.mjs`):** letzter Build-Schritt auf der
fertigen GLB, nur lokal und deterministisch – Glättung entlang der Normalen an Nacken/Trapez hinten
und hinterer Schulter (männlich, ≤ 6 mm, Muskelform bleibt), Entfalten gefalteter Hautdreiecke
an der Achsel (beide) und am Übergang Hinterkopf–Hals (weiblich, nicht im Gesicht), Begradigen der
Naht am Halsausschnitt mit dem Saum, und Dämpfen des Sculpt-Reliefs der Detail-Normal-Map auf 20 %
an Nacken und hinterer Schulter (männlich; dort war das Relief selbst zerknittert). Masken aus den
Gelenkpositionen, Saumvertices bleiben (außer am Halsausschnitt), Normalen und Tangenten werden mit
der Fläche gedreht; alles andere bleibt byte-gleich. Eine Datei trägt
`asset.extras.kalethra.repair` und wird nicht zweimal repariert. `node tools/figures/repair.mjs`
wendet den Schritt ohne Gesamtbuild auf die gebündelten Dateien an (so entstand 0.30.1).
Messungen und Vorher/Nachher: [`docs/figure-qa/phase-19.1/`](../../../docs/figure-qa/phase-19.1/).

**Prüfen ohne Gerät:** `tools/figures/qa/` rendert eine GLB mit dem App-Code und -Licht in
headless Chromium (`npx vite --port 5179`, dann `node tools/figures/qa/shoot.mjs <ordner> <liste.json>`;
die Liste der Phase 18.5: `tools/figures/qa/shots-phase-18.5.json`, Ergebnisse vorher/nachher:
[`docs/figure-qa/phase-18.5/`](../../../docs/figure-qa/phase-18.5/)); Blender eignet sich dafür
nicht (ignoriert die GLB-Tangenten).

## Herkunft und Lizenz

**Männliche Anatomie:** „Proxy Human base Mesh“ von sphere_joe (https://sketchfab.com/mundane_x),
**CC BY 4.0**, für Kalethra bearbeitet – Namensnennungspflicht. Wortlaut, Änderungen und Orte
der Nennung (App, GLB `asset.copyright`): [`male/source/ATTRIBUTION.md`](../male/source/ATTRIBUTION.md).

MakeHuman 1.x, Repository `makehumancommunity/makehuman`, Commit
`a8bc2d54ff0ac92e78ff71431b1023eda42bf482`: Basisnetz (`3dobjs/base.obj`), Targets
(`targets/macrodetails`, `breast`), Skelett und Gewichte (`rigs/default.*`). Diese Assets stehen
seit September 2020 unter **CC0 1.0** (`LICENSE.ASSETS.md`) – frei auch kommerziell, ohne
Namensnennungspflicht. MakeHuman-Programmcode (AGPL) wird nicht verwendet; die Pipeline ist
eigener Code.

## Ehrlicher Stand und Grenzen

Die Körper erfüllen Vertrag, Budgets und die Gestaltungsregeln in den Grundzügen und laufen in
der App. Der weibliche ist prozedural erzeugt; der männliche hat eine modellierte Anatomie, die
aber automatisch auf das MakeHuman-Netz übertragen wird – keiner ist von einer 3D-Künstlerin oder
einem 3D-Künstler fertig gestaltet. Bekannt:

- Muskeldefinition bewusst dezent; Muskelgrenzen folgen Regeln, nicht einer
  Handmodellierung (an Übergängen teils vereinfacht, z. B. Schulterblatt-Bereich).
- Linear Blend Skinning: bei starker Beugung (Ellbogen im Bankdrücken unten, Knie) etwas
  Volumenverlust. Männlich bleibt hinter der Achsel bei Überkopf-Armen eine lokale Delle von
  wenigen Millimetern (0.29.0: 8–12 mm; Ruhepose seit 0.30.1 ohne Faltung) und eine leichte
  Wölbung der hinteren Schulter unten im Latzug –
  ohne Korrektur-Shapes oder Dual-Quaternion-Skinning nicht ganz zu vermeiden. Weiblich
  umschließen die Hände die Stange nur angedeutet (keine Finger-Bones).
- Männlich: Gesicht reduziert und weich; am hinteren Halsausschnitt bleiben zwei kleine Stufen
  der Stoffgrenze (Topologie, 0.30.1 glättet nur die Lage der Naht). Weiblich franst der
  Armausschnitt bei hoch gehobenem Arm (Latzug) aus. Stoffkanten am Armausschnitt fransen in starker
  Nahansicht leicht (an der vorderen Achsel blitzt bei hoch gehobenem Arm stellenweise der
  Saum durch). Hände: MakeHuman-Topologie, verfeinert, keine Nägel/Falten modelliert; der Griff
  ist pro Übung fest (keine Druckverformung der Fingerballen). Highlight-Übergänge auf dem
  dunklen Stoff wirken weicher als auf der Haut.
- Weiblich: das Band am Handgelenk (`forearmTwist`) wird als Rumpfmuskel (`core_obliques`)
  segmentiert – derselbe Regelfehler war männlich vorhanden und ist dort behoben; weiblich
  bewusst unverändert (Asset byte-gleich zu 0.28.0).
- Kleidung ist eine versetzte Lage der Haut, keine Stoffsimulation.
- Nur drei Clips; die übrigen Movement-Types fallen auf `rest` zurück.
- Gerätetest: 0.29.0 vom Nutzer auf dem Xiaomi 15 Ultra (Befund → Phase 18.5); 0.29.1 nur in
  Chromium mit Software-WebGL geprüft. Checkliste:
  [`docs/FIGURE_DEVICE_TEST.md`](../../../docs/FIGURE_DEVICE_TEST.md).
