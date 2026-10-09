# Experiment: Kalethra-Körper aus dem Sketchfab-Base-Mesh

**Status: experimenteller Kandidat, nicht in der App.** Die GLB und `.blend` hier werden nicht
geladen. **Seit 0.29.0 (Phase 18.4) ist die modellierte Anatomie dieses Experiments aber die Quelle
des produktiven männlichen Körpers:** Stufe 6 exportiert die Form nach
`assets/figure/male/source/`, `tools/figures/` überträgt sie auf das MakeHuman-Netz
(Attribution: [`assets/figure/male/source/ATTRIBUTION.md`](../../male/source/ATTRIBUTION.md)).
Der Bericht unten beschreibt den Stand von Phase 18.3.

Ausgangsmodell: „Proxy Human base Mesh“ von sphere_joe, CC BY 4.0 – siehe
[`ATTRIBUTION.md`](ATTRIBUTION.md). Pipeline und Bedienung:
[`tools/figure-experiment/`](../../../../tools/figure-experiment/README.md).

```
sketchfab-base/
├─ ATTRIBUTION.md                    Lizenz und Namensnennung (Pflicht bei Verwendung)
├─ male_kalethra_experimental.glb    Kandidat im Kalethra-Vertrag (Rig, Clips, Muskelknoten)
├─ male_kalethra_experimental.blend  dasselbe Asset in Blender (ohne den 618k-Sculpt, s. u.)
├─ validation.json                   Bericht des bestehenden Validators (ok)
├─ source/proxy_human_base_mesh.glb  unverändertes Ausgangsmodell
└─ renders/                          front, front_3quarter, side, back, back_3quarter,
                                     clay_front, clay_back_3quarter, detail_*,
                                     comparison.png (alt/neu), process.png (Base Mesh/Ergebnis)
```

Alle Renderings zeigen den **GLB-Stand** (dezimiertes Netz + gebackene Normal-Map), nicht den
hochaufgelösten Sculpt – so sieht es auch die App. Alt, neu und Base Mesh sind mit derselben
Kamera und demselben Licht gerendert. Kontrolle: das GLB, in Blender neu importiert, rendert
visuell identisch zum `.blend`.

## Analyse des Base Mesh (vor der Bearbeitung)

| Punkt                | Befund                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topologie            | **Isotropes Dreiecksnetz** (76,7k Dreiecke, 38,8k Punkte), keine Edge Loops. Die „38,4k Quads“ der Sketchfab-Seite sind im GLB nicht vorhanden; Quads lassen sich nur zufällig zurückgewinnen. |
| Sauberkeit           | 422 doppelte Punkte, 13-Punkte-Fragment am Rücken, ein Loch (12 Kanten) mittig am Rücken; sonst geschlossen und manifold                                                                       |
| Symmetrie            | Form spiegelsymmetrisch (Spiegelpartner meist < 0,5 mm, einzeln bis 6,7 mm), Punktverteilung nicht exakt gespiegelt                                                                            |
| Proportionen         | 7,8 Kopfhöhen, realistisch, schlank-durchschnittlich; Schultern eher schmal zur Hüfte; Maßstab Zentimeter                                                                                      |
| Pose                 | A-Pose, Arme ca. 37° vom Körper                                                                                                                                                                |
| Schulter / Ellbogen  | weich und glaubwürdig, aber ohne Deltamuskel-Köpfe; kein Faltenwurf, kein Knick                                                                                                                |
| Handgelenk / Hände   | natürlicher Übergang; Finger getrennt, aber flach, gerade, wurstförmig, Daumen abgespreizt                                                                                                     |
| Brust, Bauch, Rücken | leichte Brust- und Bauchandeutung, Rücken fast glatt, Wirbelsäulenrinne mit Naht                                                                                                               |
| Hals, Kopf           | Hals gut; Kopf eiförmig, **flache Gesichtsmaske**, kein Kiefer, keine Ohren                                                                                                                    |
| Füße                 | Zehen ausgeformt, ordentlich                                                                                                                                                                   |
| Rigging              | Volumen gut verteilt, aber ohne Loops an den Gelenken: für hochwertige Deformation **Retopologie nötig**                                                                                       |
| Muskelmodellierung   | gute, ruhige Grundform – ideale „Leinwand“ für Volumen, nicht selbst detailliert                                                                                                               |

## Was gemacht wurde (Iterationen)

1. **Import und Anatomie (Iteration 1):** Bereinigung, Meter, Arme auf ca. 12° (Hilfs-Rig +
   Corrective Smooth), Hände entspannt gekrümmt, zwei Catmull-Clark-Stufen (618k Punkte).
   Muskeln als **Faserflächen** zwischen Ursprung und Ansatz, auf die Oberfläche projiziert:
   daraus echtes Volumen entlang der Normalen, weiche Übergänge, Fugen und ein Faserrelief in
   Faserrichtung (Brust fächert zum Oberarm, Deltamuskel zum Ansatz, Bizeps längs,
   Trizeps-Köpfe getrennt, Serratus-Zacken, Latissimus zur Achsel, Rectus mit
   Sehnenquerstreifen …). Kein Objekt wird aufgesetzt – alles ist Verschiebung derselben Haut.
2. **Selbstbewertung und Korrektur (Iteration 2):** Risse an Körperteilgrenzen (weiche
   Teilmasken), falsch beschriftete Achselwand, ein Muskel lief im Winkelraum falsch herum um
   den Unterarm, „Seil“-artige Rückenstrecker (breiter, lendenbetont), Proportionen
   (Schultergürtel +1,2 cm je Seite, Taille −0,6 cm), Kopf: Stirn/Brauen, Augenhöhlen, Nase,
   Mund, Kinn, **Kieferlinie**, Wangenknochen, Ohr-Relief.
3. **Definition und Oberfläche (Iteration 3–4):** Knochenpunkte an Ellbogen und Knie,
   Knöchel und Fingergelenke, Nagelplatten, Volumenbegrenzung in Achsel und Schritt (nichts
   wächst in die Gegenfläche), stärkere Faserstruktur; Fugen danach um 25 % abgeschwächt
   (zu „trocken“ für die Vorgabe). Asset: Dezimierung aus den geglätteten Großformen,
   Normal-Map vom Sculpt, Fehltexel-Bereinigung, Mittellinien-Artefakte beseitigt.

## Abschlussbericht

### Modellqualität

**Gelungen:** Brust (oberer/unterer Anteil, Übergang in Schulter und Achselfalte), Schulter
(drei Deltamuskelköpfe als Formen, Deltopektoral-Rinne), Bizeps/Trizeps als echte Volumen
(Trizeps-Hufeisen), Bauch (Rectus mit Querstreifen, Linea alba, Obliques, Serratus-Zacken),
Trapezius, Rückenstrecker, Gesäß, Waden, Kopfprofil mit Kieferlinie. Gesamteindruck:
klassisch-athletisch, kein Bodybuilder, deutlich plastischer als der aktuelle Körper.

**Noch problematisch:**

- **Hintere Achsel / Schulterblattrand** (Teres, Infraspinatus, Latissimus treffen sich):
  stellenweise knittrig, Schulterblattgräte zu scharf gezeichnet.
- **Latissimus** als Flügel nur mäßig lesbar; Rückenmitte etwas flach.
- **Hände:** fünf Finger, entspannt gekrümmt, Knöchel angedeutet – aber Finger noch rund und
  glatt („Handschuh“-Eindruck aus der Nähe), Daumen dicht am Zeigefinger.
- **Faserrelief** im GLB nur aus der Nähe sichtbar (Normal-Map 2048² für den ganzen Körper);
  an einigen Stellen (Nacken, oberer Rücken) leicht streifig statt organisch.
- **Gesicht** bewusst reduziert; Augenhöhlen/Nase wirken frontal etwas maskenhaft.
- **Oberschenkel** vorne mit etwas zu linearen Längsrinnen.
- Achsel-Innenseite im Bake leicht dunkel (Strahlen treffen den Oberarm).
- Keine Kleidung (der verbindliche Kalethra-Stil sieht Top und Shorts vor), Schritt neutral
  wie im Base Mesh.

### Technische Qualität

| Punkt         | Wert                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Polygone      | Körper 56 000 Dreiecke (+ 640 für die Geräte), Budget 60 000; Sculpt 618 200 Quads                    |
| GLB-Größe     | 2,12 MB (Budget 4 MiB)                                                                                |
| Punkte im GLB | 38 035 (Nähte durch UV-Inseln und Knotengrenzen)                                                      |
| Materialien   | 3: `skin` (#cdbdae, Rauheit 0,72, matt, Normal-Map), `equipment`, `metal` (aus dem Produktions-Asset) |
| Texturen      | eine Normal-Map 2048², JPEG (111 KB)                                                                  |
| UV            | automatisch (Smart Project) – zweckmäßig, aber viele Inseln; kein Layout für Handbemalung             |
| Topologie     | **dezimierte Dreiecke**, keine Edge Loops; Knoten mit gemeinsamen Normalen (keine sichtbaren Nähte)   |
| Skalierung    | Meter, Höhe 1,76 m, +Y oben, +Z vorne, Boden y = 0, Ursprung unter dem Becken (Validator: ok)         |

### Rigging-Eignung

- **Gut:** Rumpf, Oberschenkel, Unterschenkel, Hals – genug Dichte, Formen weich; das
  Testrig (automatische Gewichte, 4 Einflüsse) spielt die Produktions-Clips
  (Bankdrücken, Latzug) im three.js-Pfad der App ab; Beine und Rumpf folgen sauber.
  **Aber:** Die Clips sind per IK für das alte Skelett erzeugt – auf diesem Körper verfehlen die
  Hände die Stange (Bankdrücken) bzw. die Latzugstange um ca. 20 cm, Kopf und Rumpf liegen
  einige Zentimeter anders auf der Bank (gemessen bei t = 2,2 s).
- **Vor einem echten Rigging zu verbessern:** Schulter, Ellbogen, Handgelenk, Finger, Hüfte
  und Knie brauchen **Edge Loops** (Retopologie) – das dezimierte Netz deformiert dort
  ungleichmäßig. Gewichte bisher nur automatisch, keine Korrektur-Shapes. Finger haben keine
  eigenen Bones (Vertrag verlangt sie nicht).

### Kalethra-Kompatibilität

**Erfüllt** (bestehender Validator `validateGlb` und Ladepfad `gltfBodyFrom`, siehe
`validation.json` und `tools/figure-experiment/experimental.check.mjs`): GLB 2.0 ohne externe
Referenzen, sichere Namen, alle 13 Muskelgruppen als `muscle_<gruppe>[_<teil>]` (22 Knoten) +
10 `body_*`-Knoten, alle Pflicht-Bones inkl. `forearmTwist_*` mit Ruhe-Rotation Identität,
Clips `rest`, `horizontalPush_bench`, `verticalPull_cable` mit Geräten, Variante `male`,
Einheit Meter, Koordinatensystem, Ursprung, alle Budgets. Hervorhebung pro Muskelgruppe
funktioniert. **Der Vertrag musste nicht geändert werden.**

**Für die finale Integration noch nötig:**

1. Retopologie mit Gelenk-Loops (danach Normal-Map neu backen) und gepflegte Gewichte.
2. Kleidung (Top, Shorts) gemäß Gestaltungsrichtlinie – oder bewusste Entscheidung dagegen.
3. Clips für dieses Skelett neu erzeugen (die IK der bestehenden Pipeline auf die neuen
   Gelenkpositionen anwenden); die übernommenen Clips sind nur ein Kompatibilitätsnachweis.
4. Muskelgrenzen der Knoten an die Sculpt-Grenzen angleichen (jetzt nach Abdeckung gewählt).
5. Lizenzhinweis (CC BY 4.0) in der App; die weibliche Variante gibt es auf dieser Basis
   noch nicht.
6. Normal-Map-Qualität: ggf. getrennte UV-Inseln für Rumpf/Arme/Beine mit höherer Dichte.

## Qualitätsprüfung (Selbstbewertung)

| #   | Frage                                   | Antwort                                                         |
| --- | --------------------------------------- | --------------------------------------------------------------- |
| 1   | Echter Mensch?                          | Ja, als skulpturaler Körper; Gesicht bewusst reduziert          |
| 2   | Glaubwürdige Silhouette?                | Ja                                                              |
| 3   | Brust und Schulter überzeugend?         | Ja                                                              |
| 4   | Drei Deltamuskelbereiche erkennbar?     | Ja (vorne/seitlich/hinten, mit Übergängen)                      |
| 5   | Bizeps und Trizeps echte Formen?        | Ja                                                              |
| 6   | Rücken überzeugend?                     | Teilweise – Trapezius/Strecker gut, hintere Achsel knittrig     |
| 7   | Latissimus und Trapezius erkennbar?     | Trapezius ja, Latissimus mäßig                                  |
| 8   | Bauch organisch?                        | Ja (nach Abschwächung der Fugen)                                |
| 9   | Faserverläufe subtil erkennbar?         | Aus der Nähe ja; im GLB teils zu schwach, stellenweise streifig |
| 10  | Schulter und Ellbogen glaubwürdig?      | Ja in Ruhe; unter Deformation erst nach Retopologie             |
| 11  | Hände ausreichend menschlich?           | Knapp ja – fünf Finger, Gelenke angedeutet, noch zu glatt       |
| 12  | Primitive Formen erkennbar?             | Nein                                                            |
| 13  | Hochwertiger als der aktuelle Fallback? | Ja, deutlich (Anatomie, Plastizität, Kopf)                      |
| 14  | Später sinnvoll rig- und animierbar?    | Ja, nach Retopologie                                            |
| 15  | Passt zum Kalethra-Look?                | Grundsätzlich ja; Kleidung und Feinschliff fehlen               |

## Empfehlung

**B – vielversprechend, aber weitere Modellierung erforderlich.**

Das Base Mesh ist als Ausgangspunkt klar besser geeignet als der MakeHuman-Ansatz: saubere,
ruhige Grundform, gute Proportionen und Füße, symmetrisch, CC BY 4.0. Der hier gebaute
Kandidat zeigt, dass daraus ein deutlich anatomischerer Kalethra-Körper wird, der den
bestehenden Asset-Vertrag ohne Änderung erfüllt. Für „A“ fehlen Retopologie mit Gelenk-Loops,
eine Überarbeitung von hinterer Achsel/Latissimus und Händen sowie die Kleidung – Arbeiten,
die am besten in Blender von Hand (oder halbautomatisch auf dieser Pipeline) erfolgen.

## Reproduzieren

Siehe [`tools/figure-experiment/README.md`](../../../../tools/figure-experiment/README.md).
Der volle Sculpt (618k Punkte, ca. 45 MB) liegt nicht im Repository; er entsteht
deterministisch in Stufe 4 (`<work>/s4.blend`) und steckt als Normal-Map im Asset.
