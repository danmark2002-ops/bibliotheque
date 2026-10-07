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

    /** Pauses entre les phrases : le conteur respire, le passionné enchaîne */
    static float pause(Context c) { switch (tone(c)) { case "conteur": case "calme": return 1.7f; case "serieux": case "naturel": return 1.15f; default: return 0.85f; } }

    /** Nom de base d'une voix (Google donne souvent la même voix deux fois : « …-local » et « …-network ») */
    static String base(String name) { return name.replaceAll("-(local|network|language)$", ""); }

    /** Voix françaises installées, sans doublons, la version sur le téléphone d'abord, triées de façon stable. */
    static java.util.List<android.speech.tts.Voice> frenchVoices(java.util.Set<android.speech.tts.Voice> all) {
        java.util.Map<String, android.speech.tts.Voice> m = new java.util.TreeMap<>();
        if (all == null) return new java.util.ArrayList<>();
        for (android.speech.tts.Voice v : all) {
            if (v.getLocale() == null || !"fr".equals(v.getLocale().getLanguage())) continue;
            if (v.getFeatures() != null && v.getFeatures().contains(android.speech.tts.TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
            String k = base(v.getName());
            android.speech.tts.Voice old = m.get(k);
            if (old == null || (old.isNetworkConnectionRequired() && !v.isNetworkConnectionRequired())) m.put(k, v);
        }
        return new java.util.ArrayList<>(m.values());
    }

    /**
     * Voix du Professeur. Choisie à la main : celle-là. Sinon, chaque ton a SA voix (un vrai timbre différent,
     * pas seulement plus aigu ou plus grave) : passionné = 1re voix, sérieux = 2e, conteur = 3e, dans la région préférée.
     */
    static android.speech.tts.Voice pickVoice(Context c, java.util.Set<android.speech.tts.Voice> all) {
        String name = c.getSharedPreferences("ia", Context.MODE_PRIVATE).getString("voice", "");
        java.util.List<android.speech.tts.Voice> fr = frenchVoices(all);
        if (!name.isEmpty()) for (android.speech.tts.Voice v : all) if (name.equals(v.getName()) || base(v.getName()).equals(base(name))) return v;
        if (fr.isEmpty()) return null;
        java.util.List<android.speech.tts.Voice> pool = new java.util.ArrayList<>();
        for (String cc : new String[]{"CA", "FR"}) { for (android.speech.tts.Voice v : fr) if (cc.equals(v.getLocale().getCountry()) && !v.isNetworkConnectionRequired()) pool.add(v); if (pool.size() >= 3) break; }
        if (pool.size() < 2) for (android.speech.tts.Voice v : fr) if (!pool.contains(v)) pool.add(v);
        String t = tone(c);
        int idx = t.equals("serieux") || t.equals("naturel") ? 1 : t.equals("conteur") || t.equals("calme") ? 2 : 0;
        return pool.get(idx % pool.size());
    }

    /** {hauteur, débit} pour la phrase n° n */
    static float[] shape(Context c, String x, int n, float baseRate) {
        String s = x.trim(), t = tone(c);
        float p0, r0, vp, vr, boost;          // hauteur, débit, variations, élan des exclamations
        // 3 tons bien distincts : chacun a aussi sa propre voix (pickVoice) ; ici, son allure
        switch (t) {
            case "serieux": case "naturel":
                p0 = 0.86f; r0 = 0.92f; vp = 0.004f; vr = 0.005f; boost = 0.02f; break; // grave, posé, régulier
            case "conteur": case "calme":
                p0 = 0.98f; r0 = 0.82f; vp = 0.025f; vr = 0.035f; boost = 0.06f; break; // lent, chantant, longues pauses
            default:
                p0 = 1.12f; r0 = 1.0f;  vp = 0.035f; vr = 0.04f;  boost = 0.16f;          // passionné : vif, très expressif
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
