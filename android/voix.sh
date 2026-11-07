#!/bin/bash
# Voix française intégrée : télécharge le moteur sherpa-onnx (Apache 2.0) et la voix Piper « siwis » (CC BY 4.0)
# puis les range dans l'APK. Exécuté par la compilation (GH_TOKEN requis pour gh).
set -euo pipefail
V=1.13.8
APP="$(cd "$(dirname "$0")" && pwd)/app"
T=$(mktemp -d); cd "$T"
gh release download v$V -R k2-fsa/sherpa-onnx -p "sherpa-onnx-$V.aar"
gh release download tts-models -R k2-fsa/sherpa-onnx -p vits-piper-fr_FR-siwis-low.tar.bz2
mkdir -p "$APP/libs" && cp "sherpa-onnx-$V.aar" "$APP/libs/sherpa-onnx.aar"
tar -xjf vits-piper-fr_FR-siwis-low.tar.bz2
M=vits-piper-fr_FR-siwis-low
# espeak-ng (prononciation) : seulement le dictionnaire français, les autres langues gonfleraient l'APK de 15 Mo
find $M/espeak-ng-data -maxdepth 1 -name '*_dict' ! -name 'fr_dict' -delete
rm -rf $M/espeak-ng-data/mbrola_ph
D="$APP/src/main/assets/voix"; rm -rf "$D"; mkdir -p "$D"
cp $M/fr_FR-siwis-low.onnx $M/tokens.txt "$D/"
cp -r $M/espeak-ng-data "$D/"
{ echo "Voix française intégrée à Mike Library"; echo; echo "Moteur : sherpa-onnx $V (k2-fsa, Apache License 2.0) — https://github.com/k2-fsa/sherpa-onnx";
  echo "Voix : Piper fr_FR-siwis-low — https://github.com/rhasspy/piper"; echo; cat $M/MODEL_CARD; } > "$D/LISEZMOI.txt"
cat "$D/LISEZMOI.txt"; du -sh "$D" "$D"/*
unzip -o -q "$APP/libs/sherpa-onnx.aar" 'jni/armeabi-v7a/*' -d aar
readelf -d aar/jni/armeabi-v7a/libsherpa-onnx-jni.so | grep NEEDED || true
unzip -p "$APP/libs/sherpa-onnx.aar" classes.jar > c.jar && unzip -l c.jar | grep -i 'OfflineTts' || true
