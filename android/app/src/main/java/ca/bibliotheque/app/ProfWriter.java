package ca.bibliotheque.app;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * La suite du Professeur bizarroïde, écrite sans le téléphone (dans l'auto, écran éteint, app fermée).
 * Le téléphone range dans prof/<id>.json, à côté des parties déjà écrites, la demande de chaque partie (« asks », avec {{PREV}}
 * pour la fin de la partie précédente) et la consigne du Professeur (« sys »). Ici, on écrit la partie suivante avec Gemini,
 * de la même façon que le téléphone, puis le lecteur repart tout seul. Si le téléphone a écrit cette partie entre-temps, on ne touche à rien.
 */
final class ProfWriter {
    private ProfWriter() { }
    private static volatile String running;

    static void next(LivreService s, String id) {
        if (id == null || id.equals(running)) return;
        running = id;
        new Thread(() -> {
            try { write(s, id); }
            catch (Exception e) { LivreService.profFailed(id, "La suite du cours n'a pas pu s'écrire : " + (e.getMessage() == null ? "erreur" : e.getMessage())); }
            finally { running = null; }
        }, "prof-suite").start();
    }

    private static void write(LivreService s, String id) throws Exception {
        File f = new File(s.autoDir(), "prof/" + id + ".json");
        JSONObject data = new JSONObject(new String(Compat.readAll(f), StandardCharsets.UTF_8));
        if (data.optBoolean("done", true)) return;
        JSONArray parts = data.optJSONArray("parts"), asks = data.optJSONArray("asks");
        int n = data.optInt("n", 0), i = parts == null ? 0 : parts.length();
        if (asks == null || asks.length() <= i || parts == null) {
            LivreService.profFailed(id, "La suite de ce cours se prépare dans Mike Library sur le téléphone : ouvre l'app (ou relance la préparation du cours) une fois, ensuite l'auto saura la continuer seule.");
            return;
        }
        String prev = i == 0 ? "" : lastSentences(parts.getString(i - 1), 2);
        String prompt = asks.getString(i).replace("{{PREV}}", prev);
        String text = clean(IaGratuite.ask(s, data.optString("sys", ""), prompt, true));
        if (text.isEmpty()) throw new Exception("Gemini n'a rien répondu");
        synchronized (ProfWriter.class) {
            JSONObject now = new JSONObject(new String(Compat.readAll(f), StandardCharsets.UTF_8)); // le téléphone a-t-il écrit entre-temps ?
            JSONArray np = now.optJSONArray("parts");
            if (np == null || np.length() != i) return;
            np.put(text);
            JSONArray u = now.optJSONArray("u"); if (u == null) u = new JSONArray();
            for (Object[] x : units(text, i)) u.put(new JSONArray().put(x[0]).put(x[1]).put(x[2]));
            now.put("parts", np); now.put("u", u); now.put("done", i == n - 1);
            File tmp = new File(f.getPath() + ".tmp");
            try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(now.toString().getBytes(StandardCharsets.UTF_8)); }
            if (!tmp.renameTo(f)) throw new Exception("écriture impossible");
        }
        LivreService.profChanged("prof:" + id);
    }

    /** Comme Prof.clean du téléphone : ni titres, ni listes, ni symboles */
    static String clean(String t) {
        return t.replace("\r", "").replaceAll("(?m)^\\s*#+.*$", "").replaceAll("(?m)^\\s*\\*\\*[^*\\n]{1,80}\\*\\*\\s*$", "")
            .replaceAll("(?m)^\\s*[-*•]\\s+", "").replaceAll("(?m)^\\s*\\d+[.)]\\s+", "").replaceAll("\\*\\*?|__|`", "")
            .replaceAll("\\[page \\d+\\]", "").replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n").trim();
    }

    /** Les phrases d'une partie, avec la pause qui suit : 2 = fin de partie, 1 = fin de paragraphe, 0 = phrase */
    static List<Object[]> units(String part, int index) {
        List<Object[]> out = new ArrayList<>();
        String[] paras = part.split("\\n{2,}");
        List<String> ps = new ArrayList<>();
        for (String p : paras) { String q = p.replace('\n', ' ').trim(); if (!q.isEmpty()) ps.add(q); }
        for (int k = 0; k < ps.size(); k++) {
            List<String> ss = sentences(ps.get(k));
            for (int j = 0; j < ss.size(); j++) out.add(new Object[]{ss.get(j), index, j == ss.size() - 1 ? (k == ps.size() - 1 ? 2 : 1) : 0});
        }
        return out;
    }

    private static final java.util.regex.Pattern ABBR = java.util.regex.Pattern.compile("(^|[\\s.(«\"])(\\p{Lu}|M|Mme|Mlle|Dr|St|Ste|av|apr|etc|p|ex|vol|chap|art|cf)\\.$");

    static List<String> sentences(String p) {
        List<String> out = new ArrayList<>();
        for (String x : p.split("(?<=[.!?…][\"»”)]?)\\s+")) {
            String y = x.trim();
            while (y.length() > 260) { int c = y.lastIndexOf(", ", 220); if (c < 80) c = y.lastIndexOf(' ', 240); if (c < 1) c = 240; out.add(y.substring(0, c + 1).trim()); y = y.substring(c + 1).trim(); }
            if (y.isEmpty()) continue;
            String prev = out.isEmpty() ? null : out.get(out.size() - 1);
            if (prev != null && ABBR.matcher(prev).find()) out.set(out.size() - 1, prev + " " + y); // sigles (O.G.M.), initiales (M.), abréviations : pas une fin de phrase
            else if (prev != null && y.length() < 18 && !prev.matches(".*[.!?…]$")) out.set(out.size() - 1, prev + " " + y);
            else out.add(y);
        }
        return out;
    }

    static String lastSentences(String part, int k) {
        List<String> ss = sentences(part.replace('\n', ' '));
        return String.join(" ", ss.subList(Math.max(0, ss.size() - k), ss.size()));
    }
}
