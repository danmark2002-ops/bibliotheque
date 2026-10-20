package ca.bibliotheque.app;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

/** Petites fonctions qui marchent aussi sur les vieux Android (téléviseurs Fire TV, Android 5 à 7). */
final class Compat {
    private Compat() { }

    static byte[] readAll(File f) throws java.io.IOException {
        try (InputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toByteArray();
        }
    }

    static String join(CharSequence sep, Iterable<? extends CharSequence> parts) {
        StringBuilder sb = new StringBuilder(); boolean first = true;
        for (CharSequence p : parts) { if (!first) sb.append(sep); sb.append(p); first = false; }
        return sb.toString();
    }
}
