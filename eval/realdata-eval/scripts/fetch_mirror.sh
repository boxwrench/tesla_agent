#!/usr/bin/env bash
# fetch_mirror.sh — pull open-source plant datasets into data/raw/.
# Idempotent: skips files already present. Computes sha256s into
# data/checksums.txt at the end.
#
# Citation (iTrust): any publication using SWaT must credit
# iTrust, SUTD per the dataset access agreement.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$HERE/data/raw"
MANIFEST="$HERE/data/checksums.txt"
mkdir -p "$RAW"

echo "== SWaT Attack v0 (firmai mirror, direct curl) =="
SWAT_ATTACK="$RAW/SWaT_Dataset_Attack_v0.csv"
if [ -f "$SWAT_ATTACK" ]; then
  echo "  already present: $(du -h "$SWAT_ATTACK" | cut -f1)"
else
  curl -fL --progress-bar -o "$SWAT_ATTACK" \
    "https://raw.githubusercontent.com/firmai/random-assets/master/SWaT_Dataset_Attack_v0.csv"
  echo "  fetched: $(du -h "$SWAT_ATTACK" | cut -f1)"
fi

echo
echo "== SWaT Normal + Attack (Kaggle: vishala28) =="
KAGGLE_ZIP="$RAW/swat-dataset-secure-water-treatment-system.zip"
if command -v kaggle >/dev/null 2>&1; then
  if [ -f "$KAGGLE_ZIP" ]; then
    echo "  already present: $(du -h "$KAGGLE_ZIP" | cut -f1)"
  else
    kaggle datasets download -d vishala28/swat-dataset-secure-water-treatment-system -p "$RAW"
  fi
  if [ ! -d "$RAW/swat-kaggle" ] && [ -f "$KAGGLE_ZIP" ]; then
    (cd "$RAW" && unzip -q -n "$KAGGLE_ZIP" -d swat-kaggle)
  fi
else
  echo "  SKIP: kaggle CLI not installed."
  echo "         pip install kaggle && place API token at ~/.kaggle/kaggle.json"
fi

echo
echo "== checksums =="
( cd "$RAW" && find . -maxdepth 2 -type f -print0 | xargs -0 sha256sum > "$MANIFEST" 2>/dev/null || true )
if [ -s "$MANIFEST" ]; then
  cat "$MANIFEST"
fi

echo
echo "== TODO =="
echo "  WADI    : https://itrust.sutd.edu.sg/itrust-labs_datasets/ (request)"
echo "  BATADAL : https://www.batadal.net/                          (open)"
