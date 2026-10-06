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
    private static final Object LOCK = new Object();
    private static long last;
    private static final long GAP = 6500;
    // le premier modèle disponible est utilisé (les noms changent avec le temps)
    private static final String[] MODELS = {"gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.0-flash"};
    private static int model = 0;
    // Gemini Pro d'abord (meilleur), tant que la clé y a droit ; s'il refuse ou que son quota est épuisé, Flash prend le relais
    private static final String[] PRO = {"gemini-pro-latest", "gemini-2.5-pro"};
    private static int pro = 0;
    private static long proPausedUntil = 0;
    /** Le modèle qui a répondu à la dernière demande (affiché sous le résumé) */
    static volatile String lastModel = "";

    private IaGratuite() { }

    static String key(Context c) { return c.getSharedPreferences("ia", Context.MODE_PRIVATE).getString("gemini", ""); }

    static void setKey(Context c, String k) { c.getSharedPreferences("ia", Context.MODE_PRIVATE).edit().putString("gemini", k == null ? "" : k.trim()).apply(); }

    /** Une erreur à montrer telle quelle : inutile de réessayer. */
    static final class Fatal extends Exception { Fatal(String m) { super(m); } }

    static String ask(Context c, String system, String prompt) throws Exception { return ask(c, system, prompt, false); }

    /** urgent : une question de l'auditeur, qui passe devant la préparation du cours. */
    static String ask(Context c, String system, String prompt, boolean urgent) throws Exception { return ask(c, system, prompt, urgent, false); }

    /** json : Gemini doit répondre en JSON strict (scénario de la vidéo). */
    static String ask(Context c, String system, String prompt, boolean urgent, boolean json) throws Exception {
        String k = key(c);
        if (k.isEmpty()) throw new Fatal("Il manque la clé Gemini gratuite : ouvre le Professeur dans la Bibliothèque pour la coller.");
        // 1) Gemini Pro d'abord (la pause de 6 h survit à la fermeture de l'application)
        proPausedUntil = Math.max(proPausedUntil, c.getSharedPreferences("ia", Context.MODE_PRIVATE).getLong("proPause", 0));
        // (pas pour une question posée en direct au Professeur : Flash répond plus vite)
        if (!urgent && System.currentTimeMillis() > proPausedUntil && pro < PRO.length) {
            // Pro est limité à quelques demandes par minute : sur « trop de demandes », on patiente et on réessaie
            // (2 fois, 40 s) ; si Pro refuse encore, son quota est épuisé : Flash pendant 6 heures.
            for (int t = 0; t < 3 && pro < PRO.length; t++) {
                try {
                    String r = once(k, system, prompt, urgent, json, PRO[pro]);
                    if (r != null && !r.trim().isEmpty()) { lastModel = PRO[pro]; return r.trim(); }
                    break;
                } catch (ProRefused e) {
                    if (e.code == 404) { pro++; t--; continue; }                     // nom retiré : le suivant
                    if (e.code == 429 && t < 2) { Thread.sleep(40_000L); continue; }  // limite par minute : on patiente
                    if (e.code >= 500 && t < 2) { Thread.sleep(8_000L); continue; }   // surchargé : on réessaie
                    proPausedUntil = System.currentTimeMillis() + 6 * 3600_000L;      // épuisé ou non permis : Flash 6 h
                    c.getSharedPreferences("ia", Context.MODE_PRIVATE).edit().putLong("proPause", proPausedUntil).apply();
                    break;
                } catch (Exception e) { break; }
            }
        }
        // 2) Flash
        Exception err = null;
        int tries = urgent ? 5 : 8;
        for (int t = 0; t < tries; t++) {
            try {
                String r = once(k, system, prompt, urgent, json, null);
                if (r != null && !r.trim().isEmpty()) { lastModel = MODELS[model]; return r.trim(); }
                err = new Exception("réponse vide");
            } catch (Fatal f) { throw f; }
            catch (Exception e) { err = e; }
            Thread.sleep(Math.min(30000L, (urgent ? 2000L : 4000L) * (t + 1)));
        }
        String m = err == null ? "?" : String.valueOf(err.getMessage());
        if (m.contains("surcharg")) throw new Exception("Les serveurs de Gemini sont surchargés en ce moment. Réessaie dans quelques minutes : la préparation reprendra où elle en était.");
        throw new Exception("Gemini ne répond pas (" + m + "). Vérifie la connexion Internet, puis réessaie : la préparation reprendra où elle en était.");
    }

    private static void pace() throws InterruptedException {
        synchronized (LOCK) {
            long wait = last + GAP - System.currentTimeMillis();
            if (wait > 0) Thread.sleep(wait);
            last = System.currentTimeMillis();
        }
    }

    /** Pro a refusé (code HTTP) : on passe à Flash sans insister */
    static final class ProRefused extends Exception { final int code; ProRefused(int c) { super("pro " + c); code = c; } }

    private static String once(String key, String system, String prompt, boolean urgent, boolean json, String force) throws Exception {
        JSONObject body = new JSONObject();
        if (system != null && !system.isEmpty())
            body.put("systemInstruction", new JSONObject().put("parts", new JSONArray().put(new JSONObject().put("text", system))));
        body.put("contents", new JSONArray().put(new JSONObject().put("role", "user").put("parts", new JSONArray().put(new JSONObject().put("text", prompt)))));
        JSONObject gc = new JSONObject().put("temperature", 0.9).put("maxOutputTokens", json ? 16384 : 8192);
        if (json) gc.put("responseMimeType", "application/json");
        body.put("generationConfig", gc);
        while (true) {
            if (!urgent) pace();
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + (force != null ? force : MODELS[model]) + ":generateContent";
            String[] res = http(url, key, body.toString());
            int code = Integer.parseInt(res[0]);
            // certains formats de clés passent mieux dans l'adresse que dans l'en-tête : second essai
            if (code == 401 || code == 403 || (code == 400 && res[1].contains("API_KEY"))) {
                String[] r2 = http(url + "?key=" + java.net.URLEncoder.encode(key, "UTF-8"), "", body.toString());
                if (Integer.parseInt(r2[0]) < 400) { res = r2; code = 200; }
            }
            if (force != null && code >= 400) throw new ProRefused(code);
            if (code == 404 && model + 1 < MODELS.length) { model++; continue; } // modèle retiré : on prend le suivant
            if (code == 400 && res[1].contains("API_KEY")) throw new Fatal("La clé Gemini est refusée. Refais « Activer l'IA gratuite » dans les Réglages.");
            if (code == 401 || code == 403) throw new Fatal("La clé Gemini n'est pas autorisée (" + code + "). Refais « Activer l'IA gratuite » dans les Réglages.");
            if (code == 429) { Thread.sleep(urgent ? 4000 : 20000); throw new Exception("quota gratuit momentanément atteint"); }
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
