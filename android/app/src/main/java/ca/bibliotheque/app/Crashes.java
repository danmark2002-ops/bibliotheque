package ca.bibliotheque.app;

import android.content.Context;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;

/**
 * Journal des fermetures de l'app (files/crash.txt, les 12 000 derniers caractères) : erreurs Java non rattrapées
 * et moteur d'affichage (WebView) tombé faute de mémoire. Lu dans Réglages → Journal des problèmes.
 */
final class Crashes {
    private static final int MAX = 12_000;
    private Crashes() { }

    private static File file(Context c) { return new File(c.getApplicationContext().getFilesDir(), "crash.txt"); }

    /** Une fois au démarrage : note l'erreur, puis laisse Android faire comme d'habitude */
    static void install(Context c) {
        final Context app = c.getApplicationContext();
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        if (prev instanceof Logger) return;
        Thread.setDefaultUncaughtExceptionHandler(new Logger(app, prev));
    }

    private static final class Logger implements Thread.UncaughtExceptionHandler {
        final Context app; final Thread.UncaughtExceptionHandler prev;
        Logger(Context a, Thread.UncaughtExceptionHandler p) { app = a; prev = p; }
        @Override public void uncaughtException(Thread t, Throwable e) {
            try { StringWriter w = new StringWriter(); e.printStackTrace(new PrintWriter(w)); String s = w.toString(); note(app, "fermeture (" + t.getName() + ") : " + (s.length() > 1800 ? s.substring(0, 1800) + "…" : s)); } catch (Throwable ignored) { }
            if (prev != null) prev.uncaughtException(t, e);
        }
    }

    static synchronized void note(Context c, String what) {
        try {
            File f = file(c);
            String old = f.exists() ? new String(Compat.readAll(f), StandardCharsets.UTF_8) : "";
            String line = new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.ROOT).format(new java.util.Date()) + " " + what + "\n";
            String all = old + line;
            if (all.length() > MAX) all = all.substring(all.length() - MAX);
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(all.getBytes(StandardCharsets.UTF_8)); }
        } catch (Throwable ignored) { }
    }

    static String read(Context c) {
        try { File f = file(c); return f.exists() ? new String(Compat.readAll(f), StandardCharsets.UTF_8) : ""; } catch (Throwable e) { return ""; }
    }

    static void clear(Context c) { try { file(c).delete(); } catch (Throwable ignored) { } }
}
