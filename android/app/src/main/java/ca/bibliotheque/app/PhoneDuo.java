package ca.bibliotheque.app;

/**
 * Change la hauteur d'une voix SANS changer sa vitesse (voix du téléphone du balado : Camille plus aiguë, Alex plus grave).
 * 1) on rééchantillonne (la hauteur change, la durée aussi) ; 2) on remet la durée d'origine par recouvrement-addition
 * synchronisé (WSOLA : on garde les fenêtres de son qui se raccordent le mieux, sans coupure audible).
 * Pur Java : se teste sur ordinateur (android/test-studio/PhoneDuoTest.java).
 */
final class PhoneDuo {
    private PhoneDuo() { }

    /** Même son, hauteur × f (f < 1 : plus grave), durée inchangée */
    static short[] pitchShift(short[] x, double f) {
        if (x == null || x.length < 2048 || Math.abs(f - 1.0) < 0.005) return x;
        return stretch(resample(x, f), 1.0 / f, x.length);
    }

    /** Lit le son à la vitesse f : hauteur × f, durée / f */
    static short[] resample(short[] x, double f) {
        int n = (int) (x.length / f);
        short[] y = new short[n];
        for (int i = 0; i < n; i++) {
            double p = i * f;
            int k = (int) p;
            double a = p - k;
            int s0 = x[Math.min(k, x.length - 1)], s1 = x[Math.min(k + 1, x.length - 1)];
            y[i] = (short) Math.round(s0 + (s1 - s0) * a);
        }
        return y;
    }

    /** Accélère (speed > 1) ou ralentit (speed < 1) sans changer la hauteur ; la sortie fait outLen échantillons */
    static short[] stretch(short[] x, double speed, int outLen) {
        final int N = 512, Hs = N / 2, TOL = 160;
        if (x.length < N * 3) return x;
        float[] win = new float[N];
        for (int i = 0; i < N; i++) win[i] = (float) (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); // Hann périodique : somme = 1 à 50 % de recouvrement
        float[] out = new float[outLen + N], norm = new float[outLen + N];
        int prev = 0;
        for (int k = 0; ; k++) {
            int o = k * Hs;
            if (o >= outLen) break;
            int pos;
            if (k == 0) pos = 0;
            else {
                int nominal = (int) Math.round(o * speed);
                int target = Math.min(x.length - N, prev + Hs); // la suite naturelle du morceau précédent
                int lo = Math.max(0, nominal - TOL), hi = Math.min(x.length - N, nominal + TOL);
                if (lo > hi) lo = hi = Math.max(0, Math.min(x.length - N, nominal));
                pos = lo;
                double best = -Double.MAX_VALUE;
                for (int c = lo; c <= hi; c += 2) { // un échantillon sur deux : assez fin, deux fois plus rapide
                    double s = 0;
                    for (int j = 0; j < N; j += 2) s += (double) x[c + j] * x[target + j];
                    if (s > best) { best = s; pos = c; }
                }
            }
            pos = Math.max(0, Math.min(x.length - N, pos));
            for (int j = 0; j < N; j++) { out[o + j] += win[j] * x[pos + j]; norm[o + j] += win[j]; }
            prev = pos;
        }
        short[] y = new short[outLen];
        for (int i = 0; i < outLen; i++) {
            float v = norm[i] > 1e-3f ? out[i] / norm[i] : 0f;
            y[i] = (short) Math.max(-32768, Math.min(32767, Math.round(v)));
        }
        return y;
    }
}
