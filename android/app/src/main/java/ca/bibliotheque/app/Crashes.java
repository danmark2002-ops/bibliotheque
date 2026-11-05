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

    /**
     * Au démarrage : pourquoi la session précédente s'est terminée, selon Android (11 et plus).
     * Attrape aussi ce que le gestionnaire Java ne voit pas : manque de mémoire, plantage du moteur d'affichage, appli figée.
     */
    static void exits(Context c) {
        if (android.os.Build.VERSION.SDK_INT < 30) return;
        try {
            android.app.ActivityManager am = (android.app.ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE);
            android.content.SharedPreferences sp = c.getSharedPreferences("crash", Context.MODE_PRIVATE);
            long seen = sp.getLong("exitSeen", 0), newest = seen;
            java.util.List<android.app.ApplicationExitInfo> l = am.getHistoricalProcessExitReasons(null, 0, 5);
            for (int i = l.size() - 1; i >= 0; i--) {
                android.app.ApplicationExitInfo e = l.get(i);
                if (e.getTimestamp() <= seen) continue;
                newest = Math.max(newest, e.getTimestamp());
                int r = e.getReason();
                if (r == android.app.ApplicationExitInfo.REASON_USER_REQUESTED || r == android.app.ApplicationExitInfo.REASON_EXIT_SELF
                        || r == android.app.ApplicationExitInfo.REASON_USER_STOPPED || r == android.app.ApplicationExitInfo.REASON_PACKAGE_UPDATED) continue;
                String why;
                switch (r) {
                    case android.app.ApplicationExitInfo.REASON_LOW_MEMORY: why = "manque de mémoire (Android a fermé l'app)"; break;
                    case android.app.ApplicationExitInfo.REASON_CRASH: why = "erreur Java"; break;
                    case android.app.ApplicationExitInfo.REASON_CRASH_NATIVE: why = "plantage natif (souvent le moteur d'affichage)"; break;
                    case android.app.ApplicationExitInfo.REASON_ANR: why = "app figée trop longtemps (ANR)"; break;
                    case android.app.ApplicationExitInfo.REASON_SIGNALED: why = "arrêtée par le système (signal)"; break;
                    case android.app.ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE: why = "trop de ressources utilisées"; break;
                    case android.app.ApplicationExitInfo.REASON_INITIALIZATION_FAILURE: why = "échec au démarrage"; break;
                    default: why = "raison " + r;
                }
                String d = e.getDescription();
                note(c, "fermeture précédente (" + new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.ROOT).format(new java.util.Date(e.getTimestamp()))
                        + ") : " + why + (d != null && !d.isEmpty() ? " — " + (d.length() > 300 ? d.substring(0, 300) : d) : "")
                        + " · mémoire utilisée " + (e.getPss() / 1024) + " Mo");
            }
            if (newest > seen) sp.edit().putLong("exitSeen", newest).apply();
        } catch (Throwable ignored) { }
    }

    static String read(Context c) {
        try { File f = file(c); return f.exists() ? new String(Compat.readAll(f), StandardCharsets.UTF_8) : ""; } catch (Throwable e) { return ""; }
    }

    static void clear(Context c) { try { file(c).delete(); } catch (Throwable ignored) { } }
}
