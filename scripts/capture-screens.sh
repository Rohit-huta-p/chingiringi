#!/bin/bash
# Batch 2x screenshot capture of the ChingiRingi web app (localhost:8083).
# Reuses the dedicated Chrome profile you logged into once — no tokens handled,
# no installs. Headless Chrome reads the saved localStorage session and shoots
# each route at deviceScaleFactor 2, desktop + phone.
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="/private/tmp/claude-501/-Users-rohithutagonna-Documents-Rohit-Chingiringi/18baf5b3-61be-43bc-ad57-4b76f46d74a1/scratchpad/chrome-cap"
OUT="/Users/rohithutagonna/Documents/Rohit/Chingiringi/screenshots"
PID="6a74733ed75a9845cee35c7f"   # NutriPro Juicer — swap for any product id
mkdir -p "$OUT"

shoot() { # url  w  h  name
  "$CHROME" --headless=new --user-data-dir="$PROFILE" \
    --force-device-scale-factor=2 --hide-scrollbars \
    --window-size=$2,$3 --virtual-time-budget=10000 \
    --screenshot="$OUT/$4.png" "$1" >/dev/null 2>&1 || true
  echo "  -> $4.png"
}

echo "Desktop (1440x900 @2x):"
shoot "http://localhost:8083/home"                 1440 900 home-desktop
shoot "http://localhost:8083/product/$PID"         1440 900 product-desktop
shoot "http://localhost:8083/wallet"               1440 900 wallet-desktop
shoot "http://localhost:8083/offline-stores"       1440 900 offline-stores-desktop

echo "Phone (390x844 @2x):"
shoot "http://localhost:8083/app"                  390 844 home-mobile
shoot "http://localhost:8083/product/$PID"         390 844 product-mobile
shoot "http://localhost:8083/app/wallet"           390 844 wallet-mobile
shoot "http://localhost:8083/app/stores"           390 844 stores-mobile

echo "Done. Files in $OUT:"
ls -1 "$OUT"
