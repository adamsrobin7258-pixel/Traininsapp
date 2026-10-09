# Attribution – männlicher Kalethra-Körper

Der produktive männliche Körper (`public/figure/male/kalethra-male.glb`, seit Version 0.29.0)
übernimmt seine modellierte Anatomie aus einem fremden 3D-Modell unter **CC BY 4.0**. Die
Namensnennung ist Lizenzpflicht und muss bei jeder Weitergabe erhalten bleiben. Sie steht:

- in der App unter **Einstellungen → App → Datenquellen → 3D-Körper**,
- in der GLB selbst (`asset.copyright`, dazu `asset.extras.kalethra.source`),
- in diesem Dokument.

| Feld     | Angabe                                                                                 |
| -------- | -------------------------------------------------------------------------------------- |
| Asset    | Proxy Human base Mesh                                                                  |
| Quelle   | Sketchfab                                                                              |
| URL      | https://sketchfab.com/3d-models/proxy-human-base-mesh-9fea713a3eec47d7a7f9a3364d08f22e |
| Urheber  | sphere_joe (https://sketchfab.com/mundane_x)                                           |
| Lizenz   | CC BY 4.0 – https://creativecommons.org/licenses/by/4.0/                               |
| Original | `assets/figure/experimental/sketchfab-base/source/proxy_human_base_mesh.glb`           |

## Änderungen (CC BY 4.0 verlangt den Hinweis)

**Das Modell wurde bearbeitet; der Körper ist ein abgeleitetes Werk.** Die Bearbeitung wird nicht
vom Urheber unterstützt oder gebilligt.

1. **Experiment (Phase 18.3, `tools/figure-experiment/`)**: bereinigt, in Meter umgerechnet,
   Arme abgesenkt, Hände gekrümmt, Proportionen angepasst, Anatomie neu modelliert
   (Muskelvolumen, Übergänge, Fugen, Faserrelief, reduziertes Gesicht) – Details in
   [`../../experimental/sketchfab-base/ATTRIBUTION.md`](../../experimental/sketchfab-base/ATTRIBUTION.md).
2. **Sculpt-Export (`tools/figure-experiment/blender/stage6_export_sculpt.py`)**: die modellierte
   Oberfläche (618 k Punkte) als Punktwolke mit Form- und Detail-Normalen und Körperteil-/
   Muskel-Labels → `kalethra-male-sculpt.bin.gz` (diese Datei, abgeleitetes Werk, CC BY 4.0).
3. **Produktion (`tools/figures/lib/transfer.mjs`)**: das MakeHuman-Netz (CC0) wird auf diese
   Form übertragen (Gelenke, Gliedmaßen, Kopf), das Detail kommt als Normal-Map; neu
   segmentiert, geriggt (inkl. Finger-Bones), eingekleidet, Clips neu erzeugt.

Topologie, Hände, Füße, Skelett und Gewichte stammen aus MakeHuman 1.x (CC0 1.0, keine
Namensnennungspflicht). Der weibliche Körper enthält kein Material aus dem Sketchfab-Modell.

## Lizenzhinweis (Wortlaut in der App)

> Der männliche Körper basiert auf „Proxy Human base Mesh“ von sphere_joe
> (sketchfab.com/mundane_x), lizenziert unter CC BY 4.0 (creativecommons.org/licenses/by/4.0).
> Für Kalethra bearbeitet: Anatomie, Netz, Rig, Bewegungen und Kleidung wurden neu erstellt bzw.
> angepasst. Die Bearbeitung ist vom Urheber nicht unterstützt oder gebilligt. Topologie, Hände,
> Füße und der weibliche Körper: MakeHuman-Assets (CC0).

Für Store-Texte und eine spätere Impressum-/Lizenzseite denselben Wortlaut verwenden.

## Sculpt-Datei

`kalethra-male-sculpt.bin.gz` (gzip): JSON-Kopf (Anzahl, Labels), dann je Punkt Position
(int16, 0,1 mm), Form-Normale und Sculpt-Normale (int8), Körperteil und Muskel-Label (uint8);
glTF-Achsen (+Y oben, +Z vorne), Meter. Erzeugen:

```
BLENDER_PY=<python-mit-bpy> tools/figure-experiment/blender/run_all.sh … # erzeugt <work>/s4.blend
<python-mit-bpy> tools/figure-experiment/blender/stage6_export_sculpt.py \
  <work>/s4.blend assets/figure/male/source/kalethra-male-sculpt.bin.gz
```

Die Ausgabe ist byte-genau reproduzierbar (gzip ohne Namen und Zeit; geprüft mit bpy 5.2.2).
