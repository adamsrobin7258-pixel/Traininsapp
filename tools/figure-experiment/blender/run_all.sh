#!/usr/bin/env bash
# Full experiment pipeline: base mesh -> sculpt -> asset -> GLB (see tools/figure-experiment/README.md)
set -euo pipefail
PY=${BLENDER_PY:-python}            # a Python with the bpy module (pip install bpy), or: blender -b --python-exit-code 1 --python
SRC=${1:?base mesh GLB}; WORK=${2:?work dir}; PROD=${3:?production male GLB}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$WORK"
$PY "$HERE/stage1_prepare.py" "$SRC" "$WORK/s1.blend"
$PY "$HERE/stage2_repose.py" "$WORK/s1.blend" 25 "$WORK/s2.blend"
$PY "$HERE/stage3_hands.py" "$WORK/s2.blend" "$WORK/s3.blend"
$PY "$HERE/stage3b_proportions.py" "$WORK/s3.blend" "$WORK/s3b.blend"
$PY "$HERE/stage4_sculpt.py" "$WORK/s3b.blend" "$WORK/s4.blend"
$PY "$HERE/stage5_asset.py" "$WORK/s4.blend" "$WORK/s5"
python3 "$HERE/../finalize_glb.py" "$WORK/s5/raw.glb" "$PROD" "$WORK/s5/final.glb"
