package ca.bibliotheque.app;

import android.content.Context;
import android.content.Intent;
import android.speech.tts.TextToSpeech;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Trouve un moteur de voix qui parle français. Le moteur par défaut d'un appareil (Fire TV surtout) n'a souvent pas le français,
 * ou ne s'ouvre pas aux autres applications : on essaie chaque moteur installé — SherpaTTS d'abord, puis celui par défaut,
 * puis les autres, puis la voix française intégrée à l'application (VoixInterne) — et on garde le premier qui parle français. Sinon on le dit (au lieu d'un silence) :
 * « french » = des voix, mais pas en français ; « engine » = aucun moteur de voix utilisable.
 */
final class MoteurVoix {
    private MoteurVoix() { }

    interface Garde { void garde(TextToSpeech t); }                 // le moteur en cours d'essai (le champ n'est jamais nul)
    interface Fin { void fin(TextToSpeech t, String probleme, String bilan); }

    static void choisir(Context c, Garde g, Fin f) {
        List<String> ordre = new ArrayList<>(), noms = new ArrayList<>();
        String sherpa = null, defaut = null;
        try { defaut = android.provider.Settings.Secure.getString(c.getContentResolver(), "tts_default_synth"); } catch (Exception ignored) { }
        try {
            for (android.content.pm.ResolveInfo ri : c.getPackageManager().queryIntentServices(new Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE), 0)) {
                String pkg = ri.serviceInfo.packageName, label = String.valueOf(ri.loadLabel(c.getPackageManager()));
                noms.add(label + " (" + pkg + ")");
                if (pkg.contains("woheller69") || pkg.toLowerCase(Locale.ROOT).contains("sherpa") || label.toLowerCase(Locale.ROOT).contains("sherpa")) sherpa = pkg;
                else if (!ordre.contains(pkg)) ordre.add(pkg);
            }
        } catch (Exception ignored) { }
        if (defaut != null && ordre.remove(defaut)) ordre.add(0, defaut);
        if (sherpa != null) ordre.add(0, sherpa);
        // la voix française rangée dans l'application : seulement si aucun moteur de l'appareil ne parle français
        ordre.remove(c.getPackageName());
        if (VoixInterne.presente(c)) ordre.add(c.getPackageName());
        ordre.add(""); // dernier essai : le moteur que le système choisit lui-même
        String bilan = noms.isEmpty() ? "aucun moteur de voix déclaré" : String.join(", ", noms);
        essai(c, ordre, 0, null, bilan, g, f);
    }

    private static void essai(Context c, List<String> ordre, int i, String sansFr, String bilan, Garde g, Fin f) {
        if (i >= ordre.size()) {
            if (sansFr == null) { f.fin(null, "engine", bilan); return; }
            // aucun moteur ne parle français : on garde le premier qui fonctionne (mieux que le silence), et on le signale
            final TextToSpeech[] t = new TextToSpeech[1];
            TextToSpeech.OnInitListener l = st -> f.fin(st == TextToSpeech.SUCCESS ? t[0] : null, st == TextToSpeech.SUCCESS ? "french" : "engine", bilan);
            t[0] = sansFr.isEmpty() ? new TextToSpeech(c, l) : new TextToSpeech(c, l, sansFr);
            g.garde(t[0]);
            return;
        }
        String pkg = ordre.get(i);
        if (pkg.equals(c.getPackageName())) VoixInterne.allumer(c);
        final TextToSpeech[] t = new TextToSpeech[1];
        TextToSpeech.OnInitListener l = st -> {
            if (st == TextToSpeech.SUCCESS && francais(t[0])) { f.fin(t[0], "", bilan); return; }
            String keep = sansFr == null && st == TextToSpeech.SUCCESS ? pkg : sansFr;
            try { t[0].shutdown(); } catch (Exception ignored) { }
            essai(c, ordre, i + 1, keep, bilan, g, f);
        };
        try { t[0] = pkg.isEmpty() ? new TextToSpeech(c, l) : new TextToSpeech(c, l, pkg); }
        catch (Exception e) { essai(c, ordre, i + 1, sansFr, bilan, g, f); return; }
        g.garde(t[0]);
    }

    /** Ce moteur parle-t-il français (Québec d'abord) ? La langue est réglée au passage. */
    static boolean francais(TextToSpeech t) {
        try {
            int r = t.setLanguage(Locale.CANADA_FRENCH);
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) r = t.setLanguage(Locale.FRENCH);
            return r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
        } catch (Exception e) { return false; }
    }
}
