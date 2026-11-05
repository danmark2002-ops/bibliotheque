package ca.bibliotheque.app;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Google retire et renomme ses modèles Gemini : quand ceux que l'app connaît répondent tous « 404 », on lit la liste
 * offerte à la clé (GET /v1beta/models) et on choisit soi-même. Pas d'Android ici : testé sur ordinateur (ModelPickTest).
 */
final class ModelPick {
    private ModelPick() { }

    /** Les modèles qui écrivent du texte, de la famille voulue ("flash" ou "pro"), du meilleur choix au moins bon */
    static String[] pick(String listJson, String family) {
        List<String> out = new ArrayList<>();
        Matcher m = Pattern.compile("\"name\"\\s*:\\s*\"models/([^\"]+)\"").matcher(listJson);
        List<int[]> at = new ArrayList<>(); List<String> names = new ArrayList<>();
        while (m.find()) { at.add(new int[]{m.start()}); names.add(m.group(1)); }
        for (int i = 0; i < names.size(); i++) {
            String n = names.get(i), low = n.toLowerCase(java.util.Locale.ROOT);
            String part = listJson.substring(at.get(i)[0], i + 1 < at.size() ? at.get(i + 1)[0] : listJson.length());
            if (!part.contains("generateContent")) continue;
            if (!low.startsWith("gemini-") || !low.contains(family)) continue;
            if (family.equals("flash") && low.contains("pro")) continue;
            if (low.matches(".*(tts|image|live|audio|embedding|native|computer|robotics|vision|learnlm|exp-|thinking).*")) continue;
            if (!out.contains(n)) out.add(n);
        }
        out.sort((a, b) -> Double.compare(score(b), score(a)));
        return out.toArray(new String[0]);
    }

    private static double score(String n) {
        String l = n.toLowerCase(java.util.Locale.ROOT);
        double s = 0;
        if (l.endsWith("-latest")) s += 1000;          // l'alias que Google tient à jour
        if (l.contains("lite")) s -= 300;              // plus faible : en dernier recours
        if (l.contains("preview")) s -= 50;            // une version stable d'abord
        if (l.matches(".*-\\d{3}$") || l.matches(".*-\\d{2}-\\d{4}$")) s -= 20; // versions datées : l'alias d'abord
        Matcher v = Pattern.compile("gemini-(\\d+)(?:\\.(\\d+))?").matcher(l);
        if (v.find()) s += Integer.parseInt(v.group(1)) * 10 + (v.group(2) == null ? 0 : Math.min(9, Integer.parseInt(v.group(2))));
        return s;
    }
}
