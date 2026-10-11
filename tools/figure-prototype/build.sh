#!/usr/bin/env bash
# Builds the isolated prototype of the male Kalethra figure (phase 1A) – see README.md.
#
#   MAKEHUMAN_DATA=<makehuman/data> [WORK=<dir>] tools/figure-prototype/build.sh
#
# Output: assets/figure/prototype/kalethra-male-prototype.glb (nothing in public/, the app's
# production assets and code stay untouched). Needs Node and Python 3 with numpy, scipy, Pillow.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
: "${MAKEHUMAN_DATA:?Set MAKEHUMAN_DATA to the data folder of a MakeHuman 1.x checkout}"
WORK="${WORK:-$(mktemp -d)}"
OUT="$ROOT/assets/figure/prototype"
mkdir -p "$WORK" "$OUT"
echo "work folder: $WORK"
MAKEHUMAN_DATA="$MAKEHUMAN_DATA" WORK="$WORK/a" node "$HERE/stage-a.mjs"
python3 "$HERE/py/stage_b.py" "$WORK/a" "$WORK/b"
WORK="$WORK" OUT="$WORK/stage-c.glb" node "$HERE/stage-c.mjs"
python3 "$HERE/py/stage_d.py" "$WORK/stage-c.glb" "$OUT/kalethra-male-prototype.glb"
ls -l "$OUT/kalethra-male-prototype.glb"
