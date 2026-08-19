#!/usr/bin/env bash
# Compila guita.apk sin Gradle: aapt2 + javac + d8 + zipalign + apksigner.
# Requiere ANDROID_HOME con build-tools;34.0.0 y platforms;android-34.
set -euo pipefail
cd "$(dirname "$0")"

BT="$ANDROID_HOME/build-tools/34.0.0"
PLATFORM="$ANDROID_HOME/platforms/android-34/android.jar"
OUT=build

rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex" "$OUT/assets"

# La app web entera viaja como asset dentro del APK
cp ../index.html "$OUT/assets/index.html"
cp -r ../icons "$OUT/assets/icons"

"$BT/aapt2" compile --dir res -o "$OUT/res.zip"

"$BT/aapt2" link \
  -o "$OUT/app.unaligned.apk" \
  -I "$PLATFORM" \
  --manifest AndroidManifest.xml \
  -A "$OUT/assets" \
  --java "$OUT/gen" \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 13 \
  --version-name 2.1 \
  "$OUT/res.zip"

javac --release 11 -Xlint:-options \
  -cp "$PLATFORM" \
  -d "$OUT/classes" \
  "$OUT"/gen/app/guita/R.java src/app/guita/*.java

find "$OUT/classes" -name '*.class' -print0 | xargs -0 \
  "$BT/d8" --release --lib "$PLATFORM" --min-api 24 --output "$OUT/dex"

(cd "$OUT/dex" && zip -q -j ../app.unaligned.apk classes.dex)

"$BT/zipalign" -f 4 "$OUT/app.unaligned.apk" "$OUT/app.aligned.apk"

"$BT/apksigner" sign \
  --ks guita.keystore \
  --ks-pass pass:guita2026 \
  --out "$OUT/guita.apk" \
  "$OUT/app.aligned.apk"

"$BT/aapt2" dump badging "$OUT/guita.apk" | head -5
echo "APK listo: android/$OUT/guita.apk"
