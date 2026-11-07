package ca.bibliotheque.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.io.RandomAccessFile;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Essai réel sur émulateur : la voix intégrée fabrique du son et finit ses phrases ; MoteurVoix choisit un moteur qui parle. */
@RunWith(AndroidJUnit4.class)
public class VoixTest {
    private static final String T = "VOIXTEST";
    private final Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();

    private TextToSpeech prendre(boolean interne, String[] bilan) throws Exception {
        CountDownLatch l = new CountDownLatch(1);
        TextToSpeech[] t = new TextToSpeech[1];
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            MoteurVoix.Fin f = (tt, p, b) -> { t[0] = tt; bilan[0] = "problème=« " + p + " » " + b; l.countDown(); };
            if (interne) MoteurVoix.interne(c, x -> { }, f); else MoteurVoix.choisir(c, x -> { }, f);
        });
        assertTrue("le moteur ne répond pas", l.await(120, TimeUnit.SECONDS));
        Log.i(T, (interne ? "interne : " : "choisir : ") + bilan[0]);
        return t[0];
    }

    /** Dit la phrase et attend « fini » ; renvoie la durée en ms. */
    private long dire(TextToSpeech t, String texte) throws Exception {
        CountDownLatch l = new CountDownLatch(1);
        boolean[] err = new boolean[1];
        t.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { l.countDown(); }
            @Override public void onError(String id) { err[0] = true; l.countDown(); }
        });
        long t0 = System.currentTimeMillis();
        assertEquals(TextToSpeech.SUCCESS, t.speak(texte, TextToSpeech.QUEUE_FLUSH, new Bundle(), "p1"));
        assertTrue("aucune fin de phrase", l.await(90, TimeUnit.SECONDS));
        assertTrue("erreur du moteur", !err[0]);
        return System.currentTimeMillis() - t0;
    }

    private int[] fichier(TextToSpeech t, String texte) throws Exception {
        File f = new File(c.getCacheDir(), "essai-test.wav"); f.delete();
        CountDownLatch l = new CountDownLatch(1);
        t.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { l.countDown(); }
            @Override public void onError(String id) { l.countDown(); }
        });
        assertEquals(TextToSpeech.SUCCESS, t.synthesizeToFile(texte, new Bundle(), f, "f1"));
        assertTrue("fichier jamais fini", l.await(90, TimeUnit.SECONDS));
        int rate = 0;
        try (RandomAccessFile r = new RandomAccessFile(f, "r")) { r.seek(24); rate = Integer.reverseBytes(r.readInt()); }
        return new int[] { (int) f.length(), rate };
    }

    @Test public void voixInterneParle() throws Exception {
        String[] b = new String[1];
        TextToSpeech t = prendre(true, b);
        assertNotNull("voix intégrée absente : " + b[0], t);
        int[] f = fichier(t, "Il était une fois, à Québec, un vieux libraire.");
        Log.i(T, "interne fichier : " + f[0] + " octets, " + f[1] + " Hz");
        assertEquals("ce n'est pas la voix intégrée (16 kHz)", 16000, f[1]);
        assertTrue("fichier trop petit", f[0] > 20000);
        long ms = dire(t, "L'analyse de matériaux anormaux est devenue un pilier de son travail.");
        Log.i(T, "interne lecture : " + ms + " ms");
        ms = dire(t, "Deuxième phrase, pour vérifier que la voix reste prête.");
        Log.i(T, "interne lecture 2 : " + ms + " ms");
        t.shutdown();
    }

    @Test public void moteurChoisiParle() throws Exception {
        String[] b = new String[1];
        TextToSpeech t = prendre(false, b);
        assertNotNull("aucun moteur : " + b[0], t);
        long ms = dire(t, "Bonjour, ceci est un essai de lecture.");
        Log.i(T, "choisi lecture : " + ms + " ms");
        t.shutdown();
    }
}
