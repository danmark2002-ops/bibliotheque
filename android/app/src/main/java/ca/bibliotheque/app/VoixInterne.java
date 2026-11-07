package ca.bibliotheque.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.media.AudioFormat;
import android.speech.tts.SynthesisCallback;
import android.speech.tts.SynthesisRequest;
import android.speech.tts.TextToSpeech;
import android.speech.tts.TextToSpeechService;
import android.util.Log;

import com.k2fsa.sherpa.onnx.OfflineTts;
import com.k2fsa.sherpa.onnx.OfflineTtsConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Voix française intégrée à l'application, sans Internet : le moteur sherpa-onnx (Apache 2.0) et la voix Piper « siwis »
 * (jeu de données SIWIS, CC BY 4.0), rangés dans l'APK. C'est un vrai moteur de voix Android : MoteurVoix l'allume et le choisit
 * seulement quand l'appareil n'a aucune voix française (Fire TV surtout) ; ailleurs il reste éteint et invisible.
 * Il tourne dans son propre processus : un souci du moteur ne ferme jamais l'application.
 */
public class VoixInterne extends TextToSpeechService {
    private static final String TAG = "VoixInterne";
    private static final String DOSSIER = "voix";                       // dans les assets
    private static final String VERSION = "siwis-low-1";                // change si la voix change : recopie des données

    private OfflineTts tts;
    private volatile boolean arret;

    /** Allume le moteur intégré (éteint par défaut) pour qu'Android le propose à TextToSpeech. */
    static void allumer(Context c) {
        try {
            c.getPackageManager().setComponentEnabledSetting(new ComponentName(c, VoixInterne.class),
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        } catch (Exception e) { Log.w(TAG, "allumer", e); }
    }

    /** La voix est-elle bien rangée dans cette copie de l'application ? */
    static boolean presente(Context c) {
        try { for (String f : c.getAssets().list(DOSSIER)) if (f.endsWith(".onnx")) return true; } catch (Exception ignored) { }
        return false;
    }

    private static boolean fr(String lang) {
        return lang != null && (lang.equalsIgnoreCase("fra") || lang.equalsIgnoreCase("fre") || lang.equalsIgnoreCase("fr"));
    }

    @Override protected int onIsLanguageAvailable(String lang, String country, String variant) {
        if (!fr(lang)) return TextToSpeech.LANG_NOT_SUPPORTED;
        return country == null || country.isEmpty() ? TextToSpeech.LANG_AVAILABLE : TextToSpeech.LANG_COUNTRY_AVAILABLE;
    }

    @Override protected String[] onGetLanguage() { return new String[] { "fra", "FRA", "" }; }

    @Override protected int onLoadLanguage(String lang, String country, String variant) { return onIsLanguageAvailable(lang, country, variant); }

    @Override protected void onStop() { arret = true; }

    @Override protected synchronized void onSynthesizeText(SynthesisRequest req, SynthesisCallback cb) {
        arret = false;
        String texte = req.getCharSequenceText() != null ? req.getCharSequenceText().toString() : req.getText();
        OfflineTts t = moteur();
        if (t == null) { cb.error(); return; }
        if (cb.start(t.sampleRate(), AudioFormat.ENCODING_PCM_16BIT, 1) != TextToSpeech.SUCCESS) return;
        if (texte == null || texte.trim().isEmpty()) { cb.done(); return; }
        float vitesse = Math.max(0.5f, Math.min(3f, req.getSpeechRate() / 100f));
        final int max = Math.max(1024, cb.getMaxBufferSize());
        try {
            t.generateWithCallback(texte, 0, vitesse, (float[] s) -> {
                if (arret) return 0;
                byte[] b = new byte[s.length * 2];
                for (int i = 0; i < s.length; i++) {
                    int v = (int) (Math.max(-1f, Math.min(1f, s[i])) * 32767);
                    b[2 * i] = (byte) v; b[2 * i + 1] = (byte) (v >> 8);
                }
                for (int o = 0; o < b.length && !arret; o += max)
                    if (cb.audioAvailable(b, o, Math.min(max, b.length - o)) != TextToSpeech.SUCCESS) { arret = true; break; }
                return arret ? 0 : 1;
            });
        } catch (Throwable e) { Log.e(TAG, "synthèse", e); cb.error(); return; }
        cb.done();
    }

    /** Charge la voix une seule fois (quelques secondes sur un Fire TV Stick). */
    private OfflineTts moteur() {
        if (tts != null) return tts;
        try {
            File data = new File(getFilesDir(), "espeak-ng-data");
            File ok = new File(getFilesDir(), "voix-" + VERSION + ".ok");
            if (!ok.exists()) {
                supprimer(data);
                copier(getAssets(), DOSSIER + "/espeak-ng-data", data);
                ok.createNewFile();
            }
            String onnx = null;
            for (String f : getAssets().list(DOSSIER)) if (f.endsWith(".onnx")) onnx = f;
            if (onnx == null) return null;
            OfflineTtsVitsModelConfig vits = new OfflineTtsVitsModelConfig();
            vits.setModel(DOSSIER + "/" + onnx);
            vits.setTokens(DOSSIER + "/tokens.txt");
            vits.setDataDir(data.getAbsolutePath());
            OfflineTtsModelConfig m = new OfflineTtsModelConfig();
            m.setVits(vits);
            m.setNumThreads(Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors() - 1)));
            m.setDebug(false);
            m.setProvider("cpu");
            OfflineTtsConfig cfg = new OfflineTtsConfig();
            cfg.setModel(m);
            cfg.setMaxNumSentences(1);                                  // phrase par phrase : le son commence plus vite
            tts = new OfflineTts(getAssets(), cfg);
        } catch (Throwable e) { Log.e(TAG, "chargement", e); tts = null; }
        return tts;
    }

    private static void copier(AssetManager am, String src, File dst) throws Exception {
        String[] l = am.list(src);
        if (l != null && l.length > 0) {
            if (!dst.isDirectory() && !dst.mkdirs()) throw new Exception("dossier " + dst);
            for (String f : l) copier(am, src + "/" + f, new File(dst, f));
            return;
        }
        try (InputStream in = am.open(src); OutputStream out = new FileOutputStream(dst)) {
            byte[] buf = new byte[65536];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        }
    }

    private static void supprimer(File f) {
        File[] l = f.listFiles();
        if (l != null) for (File x : l) supprimer(x);
        f.delete();
    }

    @Override public void onDestroy() {
        try { if (tts != null) tts.release(); } catch (Throwable ignored) { }
        tts = null;
        super.onDestroy();
    }
}
