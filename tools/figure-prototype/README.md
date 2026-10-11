# Figur-Prototyp (Phase 1A) – männlich, Haut-/Muskelansicht in Steinoptik

**Status: isolierter Prototyp, nicht Teil der App.** Nichts unter `public/`, `src/` oder
`tools/figures/` wurde verändert; die Produktionskörper sind byte-gleich (geprüft in
`checks/prototype.check.mjs`). Ergebnis: `assets/figure/prototype/kalethra-male-prototype.glb`.

## Bauen

```
git clone https://github.com/makehumancommunity/makehuman   # Commit a8bc2d5… wie die Produktion
MAKEHUMAN_DATA=$PWD/makehuman/makehuman/data tools/figure-prototype/build.sh
```

Braucht Node und Python 3 mit numpy, scipy, Pillow (ca. 5 min, 2 Kerne). Stufen:

| Stufe | Datei           | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `stage-a.mjs`   | Produktions-Schritte (Form, Pose, Übertragung der modellierten Anatomie) **ohne** gesichtslosen Kopf und **ohne** Kleidungslagen; MakeHumans Gesicht per Ähnlichkeitstransformation auf den übertragenen Kopf; danach eine zweite Catmull-Clark-Stufe für den ganzen Körper (~100 k Punkte)                                                                                                                                                                                                                                 |
| B     | `py/stage_b.py` | Hautform: das feine Netz per Shrink-Wrap auf die modellierte Anatomie (Sculpt) gebracht. Anatomie-Engine des Figur-Experiments (`tools/figure-experiment/blender/anatomy.py`, ohne Blender nach numpy portiert: `py/ecorche.py`) → 86 Muskelplatten; Muskelform (`py/muscleform.py`): Trennfugen zwischen allen einzelnen Muskeln, tiefere Septen, etwas Bauchvolumen. Haare, Tuch (eigene, geskinnte Geometrie mit Kante), Augen. Faser-Normal-Map 4096² (`py/fibres.py`). Muskelgruppen pro Punkt (weich, wie Produktion) |
| C     | `stage-c.mjs`   | GLB: Skelett, Clips und Geräte aus dem Produktions-Exporter (Clips aus den Gelenken und Händen _dieses_ Körpers), Körper mit Morph-Target `muscle`, Komponenten, Materialien                                                                                                                                                                                                                                                                                                                                                |
| D     | `py/stage_d.py` | Korrekturformen (`fix_elbow/knee/shoulder_L/R`, gebackener Delta-Mush, `py/correctives.py`), gesteuert über den Knickwinkel des jeweiligen Bones                                                                                                                                                                                                                                                                                                                                                                            |

## Ansehen

```
npx vite --host        # dann /tools/figure-prototype/viewer/ öffnen (auch vom Handy im selben Netz)
```

Gerätetest: siehe [`DEVICE_TEST.md`](DEVICE_TEST.md).

Die Seite baut die große Figurenansicht der App nach (Licht, Tonemapping, Kamera aus
`figureRenderer.ts`) mit dem Umschalter **„Muskeln zeigen / Haut zeigen“** in der Bedienzeile
neben „Rückseite zeigen“. Standard ist die Hautansicht; der Zustand bleibt beim Drehen und beim
Wechsel Vorder-/Rückseite erhalten. Unten zeigt sie Ladezeit, Bildrate, Dreiecke/Bild.

## Prüfen

```
npx vitest run --config tools/figure-prototype/checks/vitest.config.mjs      # Prototyp-Checks
python3 tools/figure-prototype/py/deform_metrics.py <glb>[@morph[!]]        # Verformung je Gelenk
python3 tools/figure-prototype/py/resources.py <glb>                        # Größe, GPU-Schätzung
python3 tools/figure-prototype/py/render_shots.py <prod.glb> <proto.glb> <ordner>   # Bilder
```

`render_shots.py` rendert **in Software** (numpy, `py/raster.py`) mit dem Licht der App – kein
WebGL, kein Geräte-Screenshot. `look.json` hält die Farben/Material-Werte für Viewer und Renderer.

## Lizenz

Wie der Produktionskörper: modellierte Anatomie aus „Proxy Human base Mesh“ (sphere_joe, CC BY 4.0,
bearbeitet) – Namensnennung in der GLB (`asset.copyright`); Muskel-Landmarken aus dem eigenen
Figur-Experiment; Netz, Gesicht, Augen-Position, Hände, Skelett aus MakeHuman 1.x (CC0). Die
Referenz „Écorché Male Musclenames“ (Sketchfab, chrisfischerart, Standard-Lizenz, nicht
herunterladbar) wurde nur angesehen, nichts daraus übernommen.
