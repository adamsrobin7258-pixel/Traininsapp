# Figuren-Experiment: Kalethra-Körper aus einem Sketchfab-Base-Mesh

Entstanden in Phase 18.3 als isolierter Versuch. Der Kandidat
`male_kalethra_experimental.glb` selbst ist **kein produktiver Bestandteil der App**.

**Seit Version 0.29.0 (Phase 18.4) liefert das Experiment die Anatomie des produktiven
männlichen Körpers:** Stufe 6 (`stage6_export_sculpt.py`) exportiert die modellierte Form als
`assets/figure/male/source/kalethra-male-sculpt.bin.gz`; `tools/figures/build.mjs` überträgt sie
auf das MakeHuman-Netz und erzeugt daraus `public/figure/male/kalethra-male.glb`
(Attribution: [`assets/figure/male/source/ATTRIBUTION.md`](../../assets/figure/male/source/ATTRIBUTION.md)).
Hier wird kein Produktions-Asset geschrieben.

Ergebnis, Renderings und Bewertung: [`assets/figure/experimental/sketchfab-base/`](../../assets/figure/experimental/sketchfab-base/README.md).
Lizenz des Ausgangsmodells (CC BY 4.0): [`ATTRIBUTION.md`](../../assets/figure/experimental/sketchfab-base/ATTRIBUTION.md).

## Voraussetzungen

- Python mit dem Blender-Modul (`pip install bpy numpy scipy pillow`, getestet mit bpy 5.2.2,
  Python 3.13) – oder Blender selbst (`blender -b --python <script> -- <args>`).
- Für die Prüfung: Node 22 und `npm ci` im Projekt.

## Ablauf

```
BLENDER_PY=/pfad/zu/python tools/figure-experiment/blender/run_all.sh \
  assets/figure/experimental/sketchfab-base/source/proxy_human_base_mesh.glb \
  /tmp/kalethra-experiment \
  public/figure/male/kalethra-male.glb
```

| Stufe           | Datei                                            | Inhalt                                                                                                                                                                         |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Import        | `stage1_prepare.py`                              | GLB laden, Punkte verschmelzen, Streufragmente entfernen, Loch schließen, Quads zurückgewinnen, Meter (1,76 m), Boden y = 0                                                    |
| 2 Pose          | `stage2_repose.py`                               | Hilfs-Armatur mit automatischen Gewichten, Arme von ca. 37° auf ca. 12° senken (Corrective Smooth), Körperteil-Labels                                                          |
| 3 Hände         | `stage3_hands.py`                                | Finger per Konnektivität finden, an MCP/PIP/DIP entspannt beugen, Daumen anlegen; Hand-Landmarken für Stufe 4                                                                  |
| 3b Proportionen | `stage3b_proportions.py`                         | Schultergürtel +1,2 cm je Seite, Taille −0,6 cm je Seite (weiche globale Verformung)                                                                                           |
| 4 Anatomie      | `stage4_sculpt.py`, `anatomy.py`, `kx_sculpt.py` | Catmull-Clark (2 Stufen, 618 k Punkte), Muskeln als Faserflächen (Ursprung → Ansatz): Volumen, Übergänge, Fugen, Faserrelief; Kopf, Hände, Knochenpunkte                       |
| 5 Asset         | `stage5_asset.py`                                | Dezimierung auf 56 k Dreiecke (aus den geglätteten Großformen), UVs, Normal-Map-Bake 2048² vom Sculpt, Muskel-/Körperknoten, Rig, Rest-Action, `.blend`, Roh-GLB               |
| 6 Sculpt-Export | `stage6_export_sculpt.py`                        | Großform, Form- und Detail-Normalen, Körperteil- und Muskel-Labels der Stufe 4 als Punktwolke (glTF-Achsen) für die Produktions-Pipeline; byte-genau reproduzierbar            |
| 7 Vertrag       | `../finalize_glb.py`                             | Ruhe-Rotationen der Bones auf Identität (wie im Produktions-Rig), Inverse-Bind-Matrizen neu, Gewichte 8 Bit, Clips und Geräte aus dem Produktions-GLB, `asset.extras.kalethra` |
| Renderings      | `render_asset.py`, `render_glb.py`               | Studio-Licht (Cycles), gleiche Kamera für alt/neu/Base Mesh                                                                                                                    |

Dann die Ergebnisse nach `assets/figure/experimental/sketchfab-base/` kopieren
(`<work>/s5/final.glb` → `male_kalethra_experimental.glb`, `<work>/s5/stage5.blend` →
`male_kalethra_experimental.blend`) und prüfen:

```
npx vitest run --config tools/figure-experiment/vitest.config.mjs
```

Die Pipeline ist deterministisch: aus den Skripten im Repository entsteht ein byte-gleiches
`male_kalethra_experimental.glb` (geprüft mit bpy 5.2.2).

Das prüft den Kandidaten mit dem **bestehenden** Validator (`validateGlb`) und über den
Ladepfad der App (`gltfBodyFrom`: alle Muskelgruppen, Hervorhebung, Clip) und schreibt
`validation.json`. Die Prüfung gehört bewusst nicht zu `npm test`.
