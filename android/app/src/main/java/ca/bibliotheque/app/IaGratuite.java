package ca.bibliotheque.app;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * L'IA du Professeur bizarroïde quand le téléphone n'a pas Gemini Nano : Gemini de Google,
 * avec la clé gratuite de la personne (aistudio.google.com), gardée seulement sur ce téléphone.
 * Le palier gratuit accepte environ 10 demandes par minute : les demandes sont espacées ici.
 */
final class IaGratuite {
    static String base = "https://generativelanguage.googleapis.com"; // changé seulement par les essais sur ordinateur
    private static final Object LOCK = new Object();
    private static long last;
    static long GAP = 6500; // (0 dans les essais sur ordinateur)
    // le premier modèle disponible est utilisé (les noms changent avec le temps)
    private static volatile String[] MODELS = {"gemini-flash-latest", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"};
    /** La liste réelle des modèles de la clé a-t-elle déjà été lue (après des « 404 » partout) ? */
    private static volatile boolean listed = false;
    private static int model = 0;
    // Pas de Gemini Pro : il n'est pas offert avec une clé gratuite (quota « 0 »), chaque essai faisait perdre du temps et
    // affichait « quota épuisé » sans raison. Seulement Flash ; le modèle qui a répondu est retenu et toujours essayé d'abord.
    private static volatile boolean loaded = false;
    private static Context app;
    /** Le modèle qui a répondu à la dernière demande (affiché sous le résumé) */
    static volatile String lastModel = "";
    /** Messages d'attente pour la personne (« Gemini est occupé, nouvel essai dans 10 s… »), propres à chaque demande */
    interface Status { void say(String s); }
    static final ThreadLocal<Status> STATUS = new ThreadLocal<>();
    private static void tell(String m) { Status st = STATUS.get(); if (st != null) try { st.say(m); } catch (Exception ignored) { } }

    private IaGratuite() { }

    static String key(Context c) {
        // ancienne clé en clair : déplacée une fois dans le coffre chiffré, puis effacée
        android.content.SharedPreferences sp = c.getSharedPreferences("ia", Context.MODE_PRIVATE);
        String old = sp.getString("gemini", "");
        if (!old.isEmpty() && Secret.put(c, "gemini", old)) sp.edit().remove("gemini").apply();
        return Secret.get(c, "gemini");
    }

    static boolean setKey(Context c, String k) { boolean ok = Secret.put(c, "gemini", k == null ? "" : k.trim()); if (ok) c.getSharedPreferences("ia", Context.MODE_PRIVATE).edit().remove("gemini").apply(); return ok; }

    /** Une erreur à montrer telle quelle : inutile de réessayer. */
    static final class Fatal extends Exception { Fatal(String m) { super(m); } }

    static String ask(Context c, String system, String prompt) throws Exception { return ask(c, system, prompt, false); }

    /** urgent : une question de l'auditeur, qui passe devant la préparation du cours. */
    static String ask(Context c, String system, String prompt, boolean urgent) throws Exception { return ask(c, system, prompt, urgent, false); }

    /** json : Gemini doit répondre en JSON strict (scénario de la vidéo). */
    static String ask(Context c, String system, String prompt, boolean urgent, boolean json) throws Exception { return ask(c, system, prompt, urgent, json, !urgent); }

    /** wantPro : ignoré (Gemini Pro n'est plus utilisé) */
    static String ask(Context c, String system, String prompt, boolean urgent, boolean json, boolean wantPro) throws Exception {
        String k = key(c);
        if (k.isEmpty()) throw new Fatal("Il manque la clé Gemini gratuite : ouvre le Professeur dans la Bibliothèque pour la coller.");
        remembered(c);
        Exception err = null;
        int tries = urgent ? 5 : 8;
        long offlineSince = 0;
        for (int t = 0; t < tries; t++) {
            try {
                String r = once(k, system, prompt, urgent, json);
                if (r != null && !r.trim().isEmpty()) { lastModel = MODELS[model]; remember(); return r.trim(); }
                err = new Exception("réponse vide");
            } catch (Fatal f) { throw f; }
            catch (Exception e) {
                err = e;
                if (offline(e)) { // pas de réseau (Wi-Fi qui saute, tunnel…) : ce n'est pas un échec de Gemini, on attend le retour de la connexion
                    if (offlineSince == 0) offlineSince = System.currentTimeMillis();
                    if (System.currentTimeMillis() - offlineSince < OFFLINE_MAX) {
                        tell("Pas de connexion Internet sur le téléphone : j'attends qu'elle revienne, puis je continue toute seule…");
                        Thread.sleep(OFFLINE_STEP); t--; continue;
                    }
                    throw new Exception("Pas de connexion Internet sur le téléphone depuis plus de " + (OFFLINE_MAX / 60000) + " minutes. Vérifie le Wi-Fi ou les données mobiles (et que l'économiseur de données n'est pas actif pour l'application), puis touche « Réessayer » : la préparation reprendra où elle en était.");
                }
                offlineSince = 0;
            }
            Thread.sleep(Math.min(30000L, (urgent ? 2000L : 4000L) * (t + 1)));
        }
        String m = err == null ? "?" : String.valueOf(err.getMessage());
        if (m.contains("surcharg")) throw new Exception("Les serveurs de Gemini sont surchargés en ce moment. Réessaie dans quelques minutes : la préparation reprendra où elle en était.");
        throw new Exception("Gemini ne répond pas (" + m + "). Vérifie la connexion Internet, puis réessaie : la préparation reprendra où elle en était.");
    }


    static long OFFLINE_MAX = 15 * 60_000L, OFFLINE_STEP = 8_000L; // (réduits dans les essais sur ordinateur)

    /** Le réseau est coupé (nom de Gemini introuvable, réseau injoignable) : à distinguer d'un refus de Gemini */
    static boolean offline(Throwable e) {
        for (Throwable x = e; x != null; x = x.getCause()) {
            if (x instanceof java.net.UnknownHostException || x instanceof java.net.NoRouteToHostException) return true;
            String m = String.valueOf(x.getMessage());
            if (m.contains("Unable to resolve host") || m.contains("No address associated") || m.contains("Network is unreachable")) return true;
        }
        return false;
    }

    /** Le modèle Flash qui a répondu la dernière fois : gardé dans le téléphone, il est essayé en premier à chaque demande */
    private static synchronized void remembered(Context c) {
        if (app == null) app = c.getApplicationContext();
        if (loaded) return;
        loaded = true;
        try {
            android.content.SharedPreferences sp = c.getSharedPreferences("ia", Context.MODE_PRIVATE);
            String list = sp.getString("models", ""), ok = sp.getString("flash", "");
            if (!list.isEmpty()) { MODELS = list.split(","); listed = true; }
            if (!ok.isEmpty()) {
                int at = java.util.Arrays.asList(MODELS).indexOf(ok);
                if (at < 0) { String[] m = new String[MODELS.length + 1]; m[0] = ok; System.arraycopy(MODELS, 0, m, 1, MODELS.length); MODELS = m; at = 0; }
                model = at;
            }
        } catch (Exception ignored) { }
    }
    private static void remember() {
        try { if (app != null) app.getSharedPreferences("ia", Context.MODE_PRIVATE).edit().putString("flash", MODELS[model]).apply(); } catch (Exception ignored) { }
    }

    private static void pace() throws InterruptedException {
        synchronized (LOCK) {
            long wait = last + GAP - System.currentTimeMillis();
            if (wait > 0) Thread.sleep(wait);
            last = System.currentTimeMillis();
        }
    }

    /** Le message d'erreur de Google, court (« Quota exceeded… ») */
    static String gmsg(String b) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(b == null ? "" : b);
        if (!m.find()) return "";
        String x = m.group(1).replace("\\n", " ").replace("\\\"", "\"").trim();
        return x.length() > 140 ? x.substring(0, 140) + "…" : x;
    }


    private static String once(String key, String system, String prompt, boolean urgent, boolean json) throws Exception {
        JSONObject body = new JSONObject();
        if (system != null && !system.isEmpty())
            body.put("systemInstruction", new JSONObject().put("parts", new JSONArray().put(new JSONObject().put("text", system))));
        body.put("contents", new JSONArray().put(new JSONObject().put("role", "user").put("parts", new JSONArray().put(new JSONObject().put("text", prompt)))));
        JSONObject gc = new JSONObject().put("temperature", 0.9).put("maxOutputTokens", json ? 16384 : 8192);
        if (json) gc.put("responseMimeType", "application/json");
        body.put("generationConfig", gc);
        while (true) {
            if (!urgent) pace();
            String url = base + "/v1beta/models/" + MODELS[model] + ":generateContent";
            String[] res = http(url, key, body.toString());
            int code = Integer.parseInt(res[0]);
            // certains formats de clés passent mieux dans l'adresse que dans l'en-tête : second essai
            if (code == 401 || code == 403 || (code == 400 && res[1].contains("API_KEY"))) {
                String[] r2 = http(url + "?key=" + java.net.URLEncoder.encode(key, "UTF-8"), "", body.toString());
                if (Integer.parseInt(r2[0]) < 400) { res = r2; code = 200; }
            }
            if (code == 404) { if (model + 1 < MODELS.length) { model++; continue; } if (discover(key)) continue; } // modèle retiré : le suivant ; au bout, la liste réelle de Google
            if (code == 400 && res[1].contains("API_KEY")) throw new Fatal("La clé Gemini est refusée. Refais « Activer l'IA gratuite » dans les Réglages.");
            if (code == 401 || code == 403) throw new Fatal("La clé Gemini n'est pas autorisée (" + code + "). Refais « Activer l'IA gratuite » dans les Réglages.");
            if (code == 429) {
                // quota du jour de CE modèle épuisé (ou modèle absent du palier gratuit) : chaque modèle Flash a le sien, on passe au suivant
                if (Quota.why(res[1]).equals("day") && model + 1 < MODELS.length) { model++; tell("Gemini : quota du jour atteint pour ce modèle, essai avec " + MODELS[model] + "…"); continue; }
                Thread.sleep(urgent ? 4000 : 10000); throw new Exception("quota gratuit momentanément atteint");
            }
            // serveurs surchargés (503, 500…) : on passe au modèle suivant, souvent moins encombré
            if (code >= 500) { model = (model + 1) % MODELS.length; throw new Exception("surchargé (" + code + ")"); }
            if (code >= 400) throw new Exception("erreur " + code);
            JSONObject j = new JSONObject(res[1]);
            JSONArray cands = j.optJSONArray("candidates");
            if (cands == null || cands.length() == 0) throw new Exception("aucune réponse");
            JSONArray parts = cands.getJSONObject(0).optJSONObject("content") == null ? null : cands.getJSONObject(0).getJSONObject("content").optJSONArray("parts");
            StringBuilder sb = new StringBuilder();
            if (parts != null) for (int i = 0; i < parts.length(); i++) if (!parts.getJSONObject(i).optBoolean("thought")) sb.append(parts.getJSONObject(i).optString("text", ""));
            return sb.toString();
        }
    }

    /** Gemini regarde des images (vignettes JPEG) et répond en JSON. Flash : rapide. */
    static String pickImages(Context c, String prompt, java.util.List<byte[]> jpegs) throws Exception {
        String k = key(c);
        if (k.isEmpty()) throw new Fatal("pas de clé");
        JSONArray parts = new JSONArray();
        for (int i = 0; i < jpegs.size(); i++) {
            if (jpegs.get(i).length == 0) continue;
            parts.put(new JSONObject().put("text", "Image " + i + " :"));
            parts.put(new JSONObject().put("inline_data", new JSONObject().put("mime_type", "image/jpeg").put("data", android.util.Base64.encodeToString(jpegs.get(i), android.util.Base64.NO_WRAP))));
        }
        parts.put(new JSONObject().put("text", prompt));
        JSONObject body = new JSONObject().put("contents", new JSONArray().put(new JSONObject().put("role", "user").put("parts", parts)))
            .put("generationConfig", new JSONObject().put("temperature", 0.2).put("responseMimeType", "application/json"));
        for (int t = 0; t < 3; t++) {
            pace();
            String url = base + "/v1beta/models/" + MODELS[model] + ":generateContent";
            String[] res = http(url, k, body.toString());
            int code = Integer.parseInt(res[0]);
            if (code == 401 || code == 403 || code == 400) { String[] r2 = http(url + "?key=" + java.net.URLEncoder.encode(k, "UTF-8"), "", body.toString()); if (Integer.parseInt(r2[0]) < 400) { res = r2; code = 200; } }
            if (code == 200) {
                JSONArray cands = new JSONObject(res[1]).optJSONArray("candidates");
                if (cands == null || cands.length() == 0) throw new Exception("aucune réponse");
                JSONArray ps = cands.getJSONObject(0).getJSONObject("content").optJSONArray("parts");
                StringBuilder sb = new StringBuilder();
                if (ps != null) for (int i = 0; i < ps.length(); i++) if (!ps.getJSONObject(i).optBoolean("thought")) sb.append(ps.getJSONObject(i).optString("text", ""));
                return sb.toString();
            }
            if (code == 404) { if (model + 1 < MODELS.length) { model++; t--; continue; } if (discover(k)) { t--; continue; } }
            if (code == 429 || code >= 500) { Thread.sleep(15000); continue; }
            throw new Exception("erreur " + code);
        }
        throw new Exception("Gemini occupé");
    }

    /** Vérifie une clé : null si Google l'accepte, sinon un message. En-tête d'abord, puis dans l'adresse (clés AQ.). */
    static String check(String key) throws Exception {
        String base = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1";
        int code = get(base, key);
        if (code == 400 || code == 401 || code == 403) code = get(base + "&key=" + java.net.URLEncoder.encode(key, "UTF-8"), "");
        if (code == 200) return null;
        return code == 400 || code == 401 || code == 403 ? "Google refuse cette clé." : "Réponse inattendue de Google (" + code + ").";
    }

    private static int get(String url, String key) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(15000); c.setReadTimeout(30000);
            if (!key.isEmpty()) c.setRequestProperty("x-goog-api-key", key);
            return c.getResponseCode();
        } finally { c.disconnect(); }
    }

    /** Google a retiré les modèles connus de l'app : on lit ceux que la clé peut utiliser et on les prend, du meilleur au moins bon (une fois) */
    private static synchronized boolean discover(String key) {
        if (listed) return false;
        listed = true;
        try {
            String url = base + "/v1beta/models?pageSize=200";
            String[] res = listGet(url, key);
            if (Integer.parseInt(res[0]) >= 400) res = listGet(url + "&key=" + java.net.URLEncoder.encode(key, "UTF-8"), "");
            if (Integer.parseInt(res[0]) >= 400) return false;
            String[] flash = ModelPick.pick(res[1], "flash");
            if (flash.length == 0) return false;
            MODELS = flash; model = 0;
            try { if (app != null) app.getSharedPreferences("ia", Context.MODE_PRIVATE).edit().putString("models", String.join(",", flash)).apply(); } catch (Exception ignored) { }
            return true;
        } catch (Exception e) { return false; }
    }

    private static String[] listGet(String url, String key) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(15000); c.setReadTimeout(30000);
            if (!key.isEmpty()) c.setRequestProperty("x-goog-api-key", key);
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); in.close(); }
            return new String[]{String.valueOf(code), b.toString("UTF-8")};
        } finally { c.disconnect(); }
    }

    private static String[] http(String url, String key, String json) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(15000);
            c.setReadTimeout(180000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            if (!key.isEmpty()) c.setRequestProperty("x-goog-api-key", key);
            try (OutputStream o = c.getOutputStream()) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); in.close(); }
            return new String[]{String.valueOf(code), b.toString("UTF-8")};
        } finally { c.disconnect(); }
    }
}
