package ca.bibliotheque.app;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * IA gratuite en ligne, sans clé ni compte (Pollinations).
 * Utilisée par le Professeur bizarroïde quand le téléphone n'a pas l'IA intégrée (Gemini Nano).
 * Le service gratuit accepte environ une demande toutes les 15 secondes : les demandes sont espacées ici.
 */
final class IaGratuite {
    private static final Object LOCK = new Object();
    private static long last;
    private static final long GAP = 16000;

    private IaGratuite() { }

    /** Envoie la demande et renvoie le texte de la réponse. Réessaie quelques fois si le service est occupé. */
    static String ask(String system, String prompt) throws Exception {
        Exception err = null;
        for (int t = 0; t < 4; t++) {
            try {
                String r = once(system, prompt);
                if (r != null && !r.trim().isEmpty()) return r.trim();
                err = new Exception("réponse vide");
            } catch (Exception e) { err = e; }
            Thread.sleep(8000L * (t + 1));
        }
        throw new Exception("L'IA gratuite en ligne ne répond pas (" + (err == null ? "?" : err.getMessage()) + "). Vérifie ta connexion Internet, puis réessaie.");
    }

    private static void pace() throws InterruptedException {
        synchronized (LOCK) {
            long wait = last + GAP - System.currentTimeMillis();
            if (wait > 0) Thread.sleep(wait);
            last = System.currentTimeMillis();
        }
    }

    private static String once(String system, String prompt) throws Exception {
        pace();
        JSONObject body = new JSONObject();
        body.put("model", "openai");
        body.put("private", true);
        body.put("referrer", "bibliotheque");
        JSONArray msgs = new JSONArray();
        if (system != null && !system.isEmpty()) msgs.put(new JSONObject().put("role", "system").put("content", system));
        msgs.put(new JSONObject().put("role", "user").put("content", prompt));
        body.put("messages", msgs);
        try {
            String s = http("https://text.pollinations.ai/openai", body.toString());
            JSONObject j = new JSONObject(s);
            JSONArray ch = j.optJSONArray("choices");
            if (ch != null && ch.length() > 0) {
                String c = ch.getJSONObject(0).optJSONObject("message") != null ? ch.getJSONObject(0).getJSONObject("message").optString("content", "") : "";
                if (!c.isEmpty()) return c;
            }
        } catch (Exception ignored) { }
        // ancienne forme du service : le texte brut en réponse
        pace();
        return http("https://text.pollinations.ai/", body.toString());
    }

    private static String http(String url, String json) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(20000);
            c.setReadTimeout(120000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setRequestProperty("Accept", "application/json, text/plain");
            try (OutputStream o = c.getOutputStream()) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); in.close(); }
            String s = b.toString("UTF-8");
            if (code >= 400) throw new Exception("erreur " + code);
            return s;
        } finally { c.disconnect(); }
    }
}
