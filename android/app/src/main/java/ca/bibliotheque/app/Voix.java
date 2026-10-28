package ca.bibliotheque.app;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

/**
 * Fabrique les voix de studio du balado (Gemini), scène après scène, en arrière-plan : la scène suivante est prête
 * pendant qu'on écoute la précédente. Le son est gardé sur le téléphone (files/voix/<balado>/) : il se réécoute
 * sans réseau et sans toucher au quota. Le texte du balado reste dans balado/<id>.json (mêmes phrases pour l'écran,
 * l'auto et les voix du téléphone).
 */
final class Voix {
    private Voix() { }

    /** Une scène : des phrases consécutives, qui commencent et finissent sur un changement d'animateur autant que possible. */
    static final class Scene {
        final int first, last; final String hash;
        Scene(int f, int l, String h) { first = f; last = l; hash = h; }
    }

    /** Les phrases d'un balado, telles que le téléphone les a écrites */
    static final class Script {
        final List<String> text = new ArrayList<>(), voice = new ArrayList<>(), style = new ArrayList<>();
        final List<Integer> who = new ArrayList<>(), pause = new ArrayList<>();
        boolean done;
        int n() { return text.size(); }
    }

    static Script script(String json) throws Exception {
        JSONObject d = new JSONObject(json);
        JSONArray u = d.getJSONArray("u");
        Script s = new Script();
        s.done = d.optBoolean("done", true);
        for (int i = 0; i < u.length(); i++) {
            JSONArray x = u.getJSONArray(i);
            String t = x.getString(0);
            s.text.add(t); s.pause.add(x.optInt(2, 0)); s.who.add(x.optInt(3, 0));
            String v = x.optString(4, ""); s.voice.add(v.isEmpty() ? t : v);
            s.style.add(x.optString(5, ""));
        }
        return s;
    }

    /**
     * Taille visée d'une scène, en lettres (~14 lettres par seconde de parole) : peu de demandes à Gemini (le palier gratuit
     * en permet peu) et peu de raccords. La première est courte, pour que l'écoute commence vite. Si Gemini rend un son
     * coupé avant la fin, la taille est réduite et retenue (fichier voix/taille).
     */
    static final int FIRST = 1100, BIG = 4500, SMALLEST = 1500;
    static volatile int big = BIG;

    static void loadSize(File files) {
        try { File f = new File(new File(files, "voix"), "taille"); if (f.exists()) big = Math.max(SMALLEST, Math.min(BIG, Integer.parseInt(new String(Compat.readAll(f), "UTF-8").trim()))); }
        catch (Exception ignored) { }
    }

    private static void saveSize(File files, int v) {
        big = Math.max(SMALLEST, Math.min(BIG, v));
        try { File d = new File(files, "voix"); d.mkdirs(); try (FileOutputStream o = new FileOutputStream(new File(d, "taille"))) { o.write(String.valueOf(big).getBytes("UTF-8")); } }
        catch (Exception ignored) { }
    }

    /** Découpe en scènes (voir FIRST / big), sur un changement d'animateur. Une scène ouverte (la suite n'est pas encore écrite) n'est pas fabriquée. */
    static List<Scene> scenes(Script s) {
        List<Scene> out = new ArrayList<>();
        int start = 0, chars = 0, n = s.n();
        for (int i = 0; i < n; i++) {
            chars += s.voice.get(i).length();
            int aim = out.isEmpty() ? FIRST : big, max = aim + aim / 2;
            boolean last = i == n - 1, turn = !last && !s.who.get(i + 1).equals(s.who.get(i));
            boolean cut = (chars >= aim && turn) || chars >= max || (last && (s.done || s.pause.get(i) == 2));
            if (!cut) continue;
            out.add(new Scene(start, i, hash(s, start, i)));
            start = i + 1; chars = 0;
        }
        return out;
    }

    private static String hash(Script s, int a, int b) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-1");
            for (int i = a; i <= b; i++) md.update((s.who.get(i) + ":" + s.voice.get(i) + "|" + s.style.get(i) + "\n").getBytes("UTF-8"));
            StringBuilder h = new StringBuilder();
            byte[] d = md.digest();
            for (int i = 0; i < 6; i++) h.append(String.format("%02x", d[i]));
            return h.toString() + Studio.voices[0] + Studio.voices[1];
        } catch (Exception e) { return String.valueOf(System.nanoTime()); }
    }

    // ------------------------------------------------------------------------------------------ fichiers
    private static File folder(File files, String id) { return new File(new File(files, "voix"), id); }

    /** Le son et les débuts de phrases d'une scène, ou null s'il n'est pas (ou plus) valable. */
    static final class Clip {
        final short[] pcm; final int rate; final int[] starts; // starts : début de chaque phrase de la scène (+ fin)
        Clip(short[] p, int r, int[] s) { pcm = p; rate = r; starts = s; }
    }

    static Clip load(File files, String id, int k, Scene sc) {
        File meta = new File(folder(files, id), "s" + k + ".json"), pcm = new File(folder(files, id), "s" + k + ".pcm");
        try {
            if (!meta.exists() || !pcm.exists()) return null;
            JSONObject m = new JSONObject(new String(Compat.readAll(meta), "UTF-8"));
            if (!sc.hash.equals(m.optString("h")) || m.optInt("first") != sc.first || m.optInt("last") != sc.last) return null;
            byte[] raw = Compat.readAll(pcm);
            short[] p = new short[raw.length / 2];
            ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(p);
            JSONArray b = m.getJSONArray("b");
            int[] st = new int[b.length()];
            for (int i = 0; i < st.length; i++) st[i] = b.getInt(i);
            return new Clip(p, m.optInt("rate", 24000), st);
        } catch (Exception e) { return null; }
    }

    static boolean has(File files, String id, int k, Scene sc) {
        File meta = new File(folder(files, id), "s" + k + ".json");
        try { return meta.exists() && new File(folder(files, id), "s" + k + ".pcm").exists() && sc.hash.equals(new JSONObject(new String(Compat.readAll(meta), "UTF-8")).optString("h")); }
        catch (Exception e) { return false; }
    }

    private static void save(File files, String id, int k, Scene sc, Studio.Audio a, int[] starts) throws Exception {
        File d = folder(files, id); d.mkdirs();
        byte[] raw = new byte[a.pcm.length * 2];
        ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().put(a.pcm);
        File pcm = new File(d, "s" + k + ".pcm");
        try (FileOutputStream o = new FileOutputStream(pcm)) { o.write(raw); }
        JSONObject m = new JSONObject().put("h", sc.hash).put("first", sc.first).put("last", sc.last).put("rate", a.rate).put("b", new JSONArray());
        for (int v : starts) m.getJSONArray("b").put(v);
        File meta = new File(d, "s" + k + ".json"), tmp = new File(d, "s" + k + ".tmp");
        try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(m.toString().getBytes("UTF-8")); }
        tmp.renameTo(meta); // la fiche vient en dernier : un son sans fiche n'est pas utilisé
    }

    /** Où en est la fabrication des voix, pour l'écran : {made, total, working, why} */
    static String progress(File files, String id) {
        try {
            Script s = script(new String(Compat.readAll(new File(new File(files, "auto"), "balado/" + id + ".json")), "UTF-8"));
            List<Scene> sc = scenes(s); int made = 0;
            for (int k = 0; k < sc.size(); k++) if (has(files, id, k, sc.get(k))) made++;
            return new JSONObject().put("made", made).put("total", sc.size()).put("working", working(id)).put("why", problem()).put("detail", blocked() ? detail : "").toString();
        } catch (Exception e) { return ""; }
    }

    /** Efface tout le son d'un balado (quand on le refait ou le supprime) */
    static void purge(File files, String id) {
        File d = folder(files, id);
        File[] fs = d.listFiles();
        if (fs != null) for (File f : fs) f.delete();
        d.delete();
    }

    // ------------------------------------------------------------------------------------------ voix québécoises
    /**
     * Cherche dans le catalogue de voix de Gemini une voix de femme et une voix d'homme du Québec / Canada français
     * (language_code fr-CA, sinon région CA en français). Le résultat est gardé une semaine (voix/quebec.json).
     * Rend une phrase pour l'écran : quelles voix sont utilisées, et pourquoi.
     */
    static String local(File files, String key) {
        File f = new File(new File(files, "voix"), "quebec.json");
        JSONObject j = null;
        try { if (f.exists()) j = new JSONObject(new String(Compat.readAll(f), "UTF-8")); } catch (Exception ignored) { }
        boolean fresh = j != null && System.currentTimeMillis() - j.optLong("at") < 7 * 24 * 3600_000L;
        if (!fresh) {
            j = new JSONObject();
            try {
                j.put("at", System.currentTimeMillis());
                JSONArray all = new JSONArray(); StringBuilder rep = new StringBuilder();
                for (String q : new String[]{"language_code=fr-CA&page_size=200", "region_code=CA&language_code=fr-CA&page_size=200", "region_code=CA&page_size=200"}) {
                    Object[] r = Studio.listVoices(key, q);
                    int code = (Integer) r[0]; String body = (String) r[1];
                    rep.append(q).append(" → ").append(code == 200 ? "" : Studio.gmsg(code, body)).append('\n');
                    if (code != 200) continue;
                    JSONArray v = new JSONObject(body).optJSONArray("voices");
                    if (v == null) continue;
                    for (int i = 0; i < v.length(); i++) {
                        JSONObject x = v.getJSONObject(i);
                        String lc = x.optString("language_code", x.optString("languageCode", "")).toLowerCase();
                        if (!lc.startsWith("fr")) continue; // la région CA comprend aussi l'anglais
                        all.put(x);
                    }
                    if (all.length() > 0) break;
                }
                j.put("found", all).put("report", rep.toString().trim());
                JSONArray fem = forms(all, "female"), mal = forms(all, "male");
                j.put("f", fem).put("m", mal).put("form", 0).put("refused", fem.length() == 0 || mal.length() == 0);
            } catch (Studio.Fail e) {
                if (e.kind.equals("net")) { Studio.voices = Studio.DEFAULT.clone(); return "Pas de réseau pour chercher les voix québécoises : voix de Gemini pour l'instant."; } // on cherchera la prochaine fois
                try { j.put("refused", true).put("report", String.valueOf(e.getMessage())); } catch (Exception ignored) { }
            } catch (Exception e) { try { j.put("refused", true).put("report", String.valueOf(e.getMessage())); } catch (Exception ignored) { } }
            save(f, j);
        }
        return apply(j);
    }

    /** Les formes possibles de l'identifiant de la voix (id complet, puis dernier morceau, puis nom affiché) : on ne sait pas encore laquelle le dialogue accepte */
    private static JSONArray forms(JSONArray all, String gender) throws Exception {
        JSONArray out = new JSONArray();
        JSONObject best = null;
        for (int i = 0; i < all.length(); i++) {
            JSONObject x = all.getJSONObject(i);
            if (!gender.equalsIgnoreCase(x.optString("gender"))) continue;
            String t = x.optString("type", "prebuilt").toLowerCase();
            if (best == null || (t.contains("prebuilt") && !best.optString("type", "prebuilt").toLowerCase().contains("prebuilt"))) best = x;
        }
        if (best == null) return out;
        String id = best.optString("id", best.optString("name", "")), dn = best.optString("display_name", best.optString("displayName", ""));
        java.util.LinkedHashSet<String> set = new java.util.LinkedHashSet<>();
        if (!id.isEmpty()) set.add(id);
        if (id.contains("/")) set.add(id.substring(id.lastIndexOf('/') + 1));
        if (!dn.isEmpty()) set.add(dn);
        for (String v : set) out.put(v);
        return out;
    }

    private static String apply(JSONObject j) {
        JSONArray fe = j.optJSONArray("f"), ma = j.optJSONArray("m");
        int k = j.optInt("form", 0);
        if (j.optBoolean("refused") || fe == null || ma == null || k >= Math.min(fe.length(), ma.length())) {
            Studio.voices = Studio.DEFAULT.clone();
            JSONArray fd = j.optJSONArray("found");
            return fd == null || fd.length() == 0 ? "Gemini n'offre pas de voix québécoise avec ta clé : voix de Gemini, texte en français d'ici."
                : "Voix québécoises trouvées, mais Gemini les refuse dans un dialogue : voix de Gemini, texte en français d'ici.";
        }
        Studio.voices = new String[]{fe.optString(Math.min(k, fe.length() - 1)), ma.optString(Math.min(k, ma.length() - 1))};
        return "Voix québécoises : " + Studio.voices[0] + " (Camille) et " + Studio.voices[1] + " (Alex).";
    }

    static void localRefused(File files) {
        Studio.localRefused = false;
        File f = new File(new File(files, "voix"), "quebec.json");
        try {
            JSONObject j = new JSONObject(new String(Compat.readAll(f), "UTF-8"));
            j.put("form", j.optInt("form", 0) + 1).put("why", Studio.report);
            save(f, j); // la forme suivante sera essayée au prochain lancement ; d'ici là, voix par défaut
        } catch (Exception ignored) { }
    }

    /** Ce qu'on sait des voix québécoises, pour l'écran de test : {say, found, report} */
    static String localInfo(File files) {
        try { JSONObject j = new JSONObject(new String(Compat.readAll(new File(new File(files, "voix"), "quebec.json")), "UTF-8")); j.put("say", apply(j)); return j.toString(); }
        catch (Exception e) { return "{}"; }
    }

    private static void save(File f, JSONObject j) {
        try { f.getParentFile().mkdirs(); try (FileOutputStream o = new FileOutputStream(f)) { o.write(j.toString().getBytes("UTF-8")); } } catch (Exception ignored) { }
    }

    // ------------------------------------------------------------------------------------------ fabrication
    private static final ExecutorService POOL = Executors.newSingleThreadExecutor();
    private static final Object LOCK = new Object();
    private static boolean running, again;
    private static volatile int focus;                 // scène que l'auditeur écoute : à fabriquer en premier
    private static volatile String blocked = "";       // pourquoi on utilise les voix du téléphone (vide : tout va bien)
    private static volatile long blockedUntil;
    private static volatile String why = "";           // message pour la personne
    private static volatile String busyId = "";
    private static volatile String detail = "";        // réponse exacte de Google au dernier refus

    /** La personne demande de réessayer tout de suite */
    static void unblock() { blockedUntil = 0; why = ""; detail = ""; }
    static String detail() { return blocked() ? detail : ""; }

    /** « studio » : la voix de studio est disponible · sinon la raison (affichée en clair) */
    static String problem() { return System.currentTimeMillis() < blockedUntil ? why : ""; }
    static boolean blocked() { return System.currentTimeMillis() < blockedUntil; }
    static void focus(int scene) { focus = scene; }
    static boolean working(String id) { return busyId.equals(id); }

    /** Le texte du balado a changé (ou on va l'écouter) : fabriquer les scènes qui manquent. */
    static void kick(Context ctx, String id) {
        final Context c = ctx.getApplicationContext();
        final String key = IaGratuite.key(c);
        if (key.isEmpty()) return;
        kick(c.getFilesDir(), key, id);
    }

    static void kick(File files, String key, String id) {
        synchronized (LOCK) { if (running) { again = true; return; } running = true; again = false; }
        POOL.execute(() -> {
            try {
                do {
                    synchronized (LOCK) { again = false; }
                    work(files, key, id);
                } while (again);
            } finally { synchronized (LOCK) { running = false; } busyId = ""; }
        });
    }

    /** Fabrique, une à une, les scènes qui manquent (celle qu'on écoute d'abord). Public pour les essais sur ordinateur. */
    static void work(File files, String key, String id) {
        if (blocked()) return;
        loadSize(files);
        local(files, key);
        File f = new File(new File(files, "auto"), "balado/" + id + ".json");
        while (true) {
            Script s; List<Scene> sc;
            try { s = script(new String(Compat.readAll(f), "UTF-8")); sc = scenes(s); } catch (Exception e) { return; }
            int todo = -1, best = Integer.MAX_VALUE;
            for (int k = 0; k < sc.size(); k++) if (!has(files, id, k, sc.get(k))) { int rank = k >= focus ? k - focus : 100000 + k; if (rank < best) { best = rank; todo = k; } }
            if (todo < 0) { busyId = ""; return; }
            busyId = id;
            Scene x = sc.get(todo);
            List<Studio.Line> lines = new ArrayList<>();
            for (int i = x.first; i <= x.last; i++) lines.add(new Studio.Line(s.who.get(i), s.voice.get(i), s.style.get(i)));
            Studio.Audio a = null;
            for (int t = 0; t < 5 && a == null; t++) {
                try {
                    a = Studio.render(key, lines);
                } catch (Studio.Fail e) {
                    if (e.kind.equals("minute") && t < 4) { sleep(Math.min(70_000L, Math.max(5_000L, e.retryMs))); continue; }
                    if (e.kind.equals("net") && t < 2) { sleep(6_000L); continue; }
                    if (e.kind.equals("empty") && t < 1) { sleep(2_000L); continue; }
                    block(e.kind);
                    return;
                }
            }
            if (a == null) { block("minute"); return; }
            if (Studio.localRefused) { localRefused(files); x = new Scene(x.first, x.last, hash(s, x.first, x.last)); } // voix québécoises refusées : ce son est fait avec les voix par défaut
            int chars = 0;
            for (int i = x.first; i <= x.last; i++) chars += Studio.weight(s.voice.get(i));
            double secs = a.pcm.length / (double) a.rate;
            if (x.last > x.first && big > SMALLEST && chars > SMALLEST && secs < 0.55 * chars / 14.0) { // son coupé avant la fin : des scènes plus courtes, puis on recommence
                saveSize(files, Math.min(big, chars) * 2 / 3);
                continue;
            }
            try {
                short[] p = Studio.trim(a.pcm, a.rate);
                int n = x.last - x.first + 1;
                int[] w = new int[n]; boolean[] chg = new boolean[n];
                for (int i = 0; i < n; i++) { w[i] = Studio.weight(s.voice.get(x.first + i)); chg[i] = i > 0 && !s.who.get(x.first + i).equals(s.who.get(x.first + i - 1)); }
                save(files, id, todo, x, new Studio.Audio(p, a.rate), Studio.split(p, a.rate, w, chg));
            } catch (Exception e) { block("off"); return; }
            LivreService.voixPrete(id, todo);
            sleep(1_500L); // le palier gratuit n'aime pas les rafales
        }
    }

    private static void block(String kind) {
        long ms; String m;
        switch (kind) {
            case "key": ms = 10 * 60_000L; m = "Gemini refuse la clé pour les voix de studio."; break;
            case "day": ms = 6 * 3600_000L; m = "Le quota gratuit de voix Gemini est atteint pour aujourd'hui."; break;
            case "net": ms = 60_000L; m = "Pas de connexion Internet."; break;
            case "minute": ms = 3 * 60_000L; m = "Gemini est très occupé en ce moment."; break;
            default: ms = 60 * 60_000L; m = "Gemini a refusé de fabriquer la voix de studio."; break;
        }
        why = m; detail = Studio.report; blockedUntil = System.currentTimeMillis() + ms; busyId = "";
        LivreService.voixPrete(null, -1);
    }

    private static void sleep(long ms) { try { Thread.sleep(ms); } catch (InterruptedException ignored) { } }
}
