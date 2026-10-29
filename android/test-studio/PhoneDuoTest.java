package ca.bibliotheque.app;

/** Changer la hauteur sans changer la durée : sh run.sh (ou javac Studio.java Quota.java PhoneDuo.java PhoneDuoTest.java) */
public class PhoneDuoTest {
    static int fails = 0;
    static void check(boolean ok, String what) { System.out.println((ok ? "OK   " : "FAIL ") + what); if (!ok) fails++; }

    /** Une « voix » : harmoniques d'une note qui varie un peu, avec des syllabes (enveloppe) et des silences */
    static short[] voice(double f0, int rate, double secs) {
        int n = (int) (rate * secs);
        short[] p = new short[n];
        double ph = 0;
        for (int i = 0; i < n; i++) {
            double t = (double) i / rate;
            double f = f0 * (1 + 0.04 * Math.sin(2 * Math.PI * 1.3 * t));
            ph += 2 * Math.PI * f / rate;
            double env = Math.max(0, Math.sin(2 * Math.PI * 2.2 * t)); // ~ 4 syllabes par seconde et demie
            double s = 0;
            for (int h = 1; h <= 8; h++) s += Math.sin(h * ph) / h;
            p[i] = (short) (9000 * env * s);
        }
        return p;
    }

    public static void main(String[] a) {
        int rate = 22050;
        short[] x = voice(210, rate, 3.0);
        double hx = Studio.pitch(x, rate);
        check(hx > 190 && hx < 230, "voix d'origine mesurée à " + Math.round(hx) + " Hz (attendu ~210)");

        for (double f : new double[]{0.74, 0.8, 1.07}) {
            long t0 = System.nanoTime();
            short[] y = PhoneDuo.pitchShift(x, f);
            long ms = (System.nanoTime() - t0) / 1_000_000;
            double hy = Studio.pitch(y, rate);
            check(Math.abs(y.length - x.length) <= 600, "f=" + f + " : durée gardée (" + x.length + " → " + y.length + " échantillons)");
            check(Math.abs(hy / hx - f) < 0.07, "f=" + f + " : hauteur " + Math.round(hx) + " → " + Math.round(hy) + " Hz (attendu ~" + Math.round(hx * f) + ")");
            check(ms < 1500, "f=" + f + " : calculé en " + ms + " ms (3 s de voix)");
            int peak = 0; for (short s : y) peak = Math.max(peak, Math.abs(s));
            check(peak > 3000 && peak < 32767, "f=" + f + " : volume normal (crête " + peak + ")");
        }
        check(PhoneDuo.pitchShift(x, 1.0) == x, "f=1 : son rendu tel quel");
        short[] tiny = new short[100];
        check(PhoneDuo.pitchShift(tiny, 0.74) == tiny, "son très court : rendu tel quel, sans erreur");
        if (fails > 0) { System.out.println(fails + " échec(s)"); System.exit(1); }
        System.out.println("Tous les essais passent");
    }
}
