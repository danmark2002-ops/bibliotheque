package ca.bibliotheque.app;

import android.content.Context;

/**
 * Ton et vitesse de la voix du Professeur (cours, réponses, vidéos), choisis dans l'application :
 * passionné (par défaut), sérieux, conteur ; vitesse de 0,7× à 1,5×.
 */
final class ProfStyle {
    private ProfStyle() { }

    static String tone(Context c) { return c.getSharedPreferences("ia", Context.MODE_PRIVATE).getString("profTone", "passionne"); }
    static float speed(Context c) { return c.getSharedPreferences("ia", Context.MODE_PRIVATE).getFloat("profSpeed", 1f); }

    /** {hauteur, débit} pour la phrase n° n */
    static float[] shape(Context c, String x, int n, float baseRate) {
        String s = x.trim(), t = tone(c);
        float p0, r0, vp, vr, boost;          // hauteur, débit, variations, élan des exclamations
        // 3 tons bien distincts (les anciens réglages proches y sont ramenés)
        switch (t) {
            case "serieux": case "naturel":
                p0 = 0.9f;  r0 = 0.97f; vp = 0.004f; vr = 0.006f; boost = 0.02f; break; // grave, posé, presque sans effets
            case "conteur": case "calme":
                p0 = 1.0f;  r0 = 0.8f;  vp = 0.02f;  vr = 0.03f;  boost = 0.06f; break;  // lent, chaleureux
            default:
                p0 = 1.16f; r0 = 1.12f; vp = 0.03f;  vr = 0.04f;  boost = 0.16f;          // passionné : aigu, rapide, très vivant
        }
        float rate = baseRate * speed(c);
        float pitch = p0 + (((n * 37) % 7) - 3) * vp, r = rate * (r0 + (((n * 53) % 5) - 2) * vr);
        boolean passion = boost >= 0.1f;
        if (s.endsWith("!") || s.endsWith("! »") || s.endsWith("!»")) { pitch = p0 + boost + (passion ? (n % 3) * 0.02f : 0); r = rate * r0 * (passion ? 1.08f : 1.02f); }
        else if (s.endsWith("?") || s.endsWith("? »") || s.endsWith("?»")) { pitch = p0 + Math.min(0.1f, boost * 0.7f); r = rate * r0 * 0.95f; }
        else if (s.endsWith("…") || s.endsWith("...")) { pitch = p0 - 0.06f; r = rate * r0 * 0.88f; }
        if (s.length() < 25) r *= 1.03f;
        if (passion && s.matches("(?i)^(ah|oh|eh|ha|hé|ho|wow|bam|boum|voilà|imaginez|imagine|attention|tenez|tiens|écoutez|écoute|alors|et voilà|incroyable|fascinant|génial|extraordinaire)(?=[\\s,!.…]).*")) pitch += 0.08f;
        if (s.length() > 180 || s.contains(":")) r *= 0.94f;
        return new float[]{Math.max(0.85f, Math.min(1.42f, pitch)), Math.max(0.4f, Math.min(2.6f, r))};
    }
}
