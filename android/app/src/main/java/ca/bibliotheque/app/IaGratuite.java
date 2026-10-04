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

    private IaGratuite() { }

    static String key(Context c) { return c.getSharedPreferences("ia", Context.MODE_PRIVATE).getString("gemini", ""); }

    static void setKey(Context c, String k) { c.getSharedPreferences("ia", Context.MODE_PRIVATE).edit().putString("gemini", k == null ? "" : k.trim()).apply(); }

    /** Une erreur à montrer telle quelle : inutile de réessayer. */
    static final class Fatal extends Exception { Fatal(String m) { super(m); } }

    static String ask(Context c, String system, String prompt) throws Exception {
        String k = key(c);
        if (k.isEmpty()) throw new Fatal("Il manque la clé Gemini gratuite : ouvre le Professeur dans la Bibliothèque pour la coller.");
        Exception err = null;
        for (int t = 0; t < 4; t++) {
            try {
                String r = once(k, system, prompt);
                if (r != null && !r.trim().isEmpty()) return r.trim();
                err = new Exception("réponse vide");
            } catch (Fatal f) { throw f; }
            catch (Exception e) { err = e; }
            Thread.sleep(5000L * (t + 1));
        }
        throw new Exception("Gemini ne répond pas (" + (err == null ? "?" : err.getMessage()) + "). Vérifie la connexion Internet, puis réessaie : la préparation reprendra où elle en était.");
    }

    private static void pace() throws InterruptedException {
        synchronized (LOCK) {
            long wait = last + GAP - System.currentTimeMillis();
            if (wait > 0) Thread.sleep(wait);
            last = System.currentTimeMillis();
        }
    }

    private static String once(String key, String system, String prompt) throws Exception {
        JSONObject body = new JSONObject();
        if (system != null && !system.isEmpty())
            body.put("systemInstruction", new JSONObject().put("parts", new JSONArray().put(new JSONObject().put("text", system))));
        body.put("contents", new JSONArray().put(new JSONObject().put("role", "user").put("parts", new JSONArray().put(new JSONObject().put("text", prompt)))));
        body.put("generationConfig", new JSONObject().put("temperature", 0.9).put("maxOutputTokens", 4096));
        while (true) {
            pace();
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODELS[model] + ":generateContent";
            String[] res = http(url, key, body.toString());
            int code = Integer.parseInt(res[0]);
            if (code == 404 && model + 1 < MODELS.length) { model++; continue; } // modèle retiré : on prend le suivant
            if (code == 400 && res[1].contains("API_KEY")) throw new Fatal("La clé Gemini est refusée. Vérifie-la dans le Professeur (Autres options → Changer la clé).");
            if (code == 401 || code == 403) throw new Fatal("La clé Gemini n'est pas autorisée (" + code + "). Vérifie-la dans le Professeur (Autres options → Changer la clé).");
            if (code == 429) { Thread.sleep(20000); throw new Exception("quota gratuit momentanément atteint"); }
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

    private static String[] http(String url, String key, String json) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(15000);
            c.setReadTimeout(90000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setRequestProperty("x-goog-api-key", key);
            try (OutputStream o = c.getOutputStream()) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); in.close(); }
            return new String[]{String.valueOf(code), b.toString("UTF-8")};
        } finally { c.disconnect(); }
    }
}
