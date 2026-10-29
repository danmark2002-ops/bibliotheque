#!/bin/sh
# Essais du moteur de voix de studio sur ordinateur : sh run.sh
# Il faut un android.jar (variable ANDROID_JAR) et les sources de org.json compilées (variable ORG_JSON) pour VoixTest ; StudioTest seul n'en a pas besoin.
set -e
cd "$(dirname "$0")"
S=../app/src/main/java/ca/bibliotheque/app
D=$(mktemp -d)
javac -encoding UTF-8 -nowarn -d "$D" $S/Studio.java $S/Quota.java StudioTest.java 2>&1 | { grep -v "^Picked up\|^Note" || true; }
java -cp "$D" ca.bibliotheque.app.StudioTest 2>&1 | { grep -v "^Picked up" || true; }
javac -encoding UTF-8 -nowarn -d "$D" $S/Studio.java $S/Quota.java $S/PhoneDuo.java PhoneDuoTest.java 2>&1 | { grep -v "^Picked up\|^Note" || true; }
java -cp "$D" ca.bibliotheque.app.PhoneDuoTest 2>&1 | { grep -v "^Picked up" || true; }
python3 - <<'PY'
import json
n=0
for l in open('bodies.txt',encoding='utf-8'):
    l=l.strip()
    if l: json.loads(l); n+=1
print(f"OK   {n} corps de requête = JSON valide")
PY
rm -f bodies.txt
if [ -n "$ANDROID_JAR" ] && [ -n "$ORG_JSON" ]; then
  javac -encoding UTF-8 -nowarn -cp "$ORG_JSON:$ANDROID_JAR" -d "$D" $S/Voix.java $S/Studio.java $S/Quota.java $S/Compat.java $S/IaGratuite.java $S/Secret.java VoixTest.java ../test-stubs/*.java 2>&1 | { grep -v "^Picked up\|^Note\|UnsupportedAppUsage\|warning" || true; }
  java -cp "$D:$ORG_JSON:$ANDROID_JAR" ca.bibliotheque.app.VoixTest 2>&1 | { grep -v "^Picked up" || true; }
fi
