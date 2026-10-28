package ca.bibliotheque.app;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Les voix de « studio » du balado : la synthèse vocale de Gemini (clé gratuite de la personne).
 * Deux voix naturelles, un homme et une femme, qui rient, hésitent et s'emballent — là où les voix du téléphone restent plates.
 * Classe sans dépendance à Android : testée telle quelle sur ordinateur (voir essai-ia/).
 */
final class Studio {
    private Studio() { }

    /** Camille (femme, chaleureuse) et Alex (homme, vif) : voix préenregistrées de Gemini */
    static final String[] NAMES = {"Camille", "Alex"};
    static final String[] VOICES = {"Sulafat", "Puck"};
    /** Les noms de modèles changent avec le temps : on essaie dans l'ordre, et on retient celui qui répond. */
    static final String[] MODELS = {"gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview"}; // les trois ont un palier gratuit (page des prix de Google)
    static final int APIS = 2; // 0 : « interactions » (actuelle) · 1 : generateContent (ancienne)
    static String base = "https://generativelanguage.googleapis.com";

    /** Une réplique à dire : qui, quoi (avec balises d'émotion <laugh>…), et sur quel ton. */
    static final class Line {
        final int sp; final String text, style;
        Line(int sp, String text, String style) { this.sp = sp; this.text = text; this.style = style == null ? "" : style; }
    }

    static final class Audio {
        final short[] pcm; final int rate;
        Audio(short[] p, int r) { pcm = p; rate = r; }
    }

    /** Échec classé : key (clé refusée) · day (quota du jour / pas de voix dans le palier gratuit) · minute (trop de demandes, attendre) · off (service indisponible) · net · empty */
    static final class Fail extends Exception {
        final String kind; final long retryMs;
        Fail(String kind, String msg, long retryMs) { super(msg); this.kind = kind; this.retryMs = retryMs; }
    }

    /** Combinaison (modèle, interface) qui a répondu la dernière fois : on recommence par elle. */
    static volatile int combo = 0;

    // ------------------------------------------------------------------------------------------ requête
    static String esc(String s) {
        StringBuilder b = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': b.append("\\\""); break;
                case '\\': b.append("\\\\"); break;
                case '\n': b.append("\\n"); break;
                case '\r': b.append("\\r"); break;
                case '\t': b.append("\\t"); break;
                default: if (c < 0x20) b.append(String.format("\\u%04x", (int) c)); else b.append(c);
            }
        }
        return b.toString();
    }

    /** Les répliques de suite du même animateur ne font qu'un tour de parole. */
    static List<Line> turns(List<Line> lines) {
        List<Line> out = new ArrayList<>();
        for (Line l : lines) {
            if (!out.isEmpty() && out.get(out.size() - 1).sp == l.sp) {
                Line p = out.remove(out.size() - 1);
                out.add(new Line(p.sp, p.text + " " + l.text, p.style.isEmpty() ? l.style : p.style));
            } else out.add(l);
        }
        return out;
    }

    static String bodyInteractions(String model, List<Line> lines) {
        StringBuilder b = new StringBuilder();
        b.append("{\"model\":\"").append(esc(model)).append("\",\"input\":[{\"type\":\"user_input\",\"content\":[");
        List<Line> t = turns(lines);
        for (int i = 0; i < t.size(); i++) {
            Line l = t.get(i);
            if (i > 0) b.append(',');
            b.append("{\"type\":\"text\",\"text\":\"").append(esc(l.text)).append("\",\"annotations\":[{\"type\":\"speech_metadata\",\"speaker\":\"")
                .append(NAMES[l.sp]).append('"');
            if (!l.style.isEmpty()) b.append(",\"style\":\"").append(esc(l.style)).append('"');
            b.append("}]}");
        }
        b.append("]}],\"response_format\":{\"type\":\"audio\"},\"generation_config\":{\"speech_config\":{\"mode\":\"conversational\",\"speakers\":[")
            .append("{\"speaker\":\"").append(NAMES[0]).append("\",\"voice\":\"").append(VOICES[0]).append("\"},")
            .append("{\"speaker\":\"").append(NAMES[1]).append("\",\"voice\":\"").append(VOICES[1]).append("\"}]}}}");
        return b.toString();
    }

    static String bodyGenerate(List<Line> lines) {
        StringBuilder txt = new StringBuilder("Dis cette conversation de balado, en français, comme deux amis passionnés qui parlent pour de vrai (naturel, émotion, rythme vivant) :\n");
        for (Line l : turns(lines)) {
            txt.append(NAMES[l.sp]);
            if (!l.style.isEmpty()) txt.append(" (").append(l.style).append(')');
            txt.append(" : ").append(l.text).append('\n');
        }
        return "{\"contents\":[{\"parts\":[{\"text\":\"" + esc(txt.toString()) + "\"}]}],\"generationConfig\":{\"responseModalities\":[\"AUDIO\"],"
            + "\"speechConfig\":{\"multiSpeakerVoiceConfig\":{\"speakerVoiceConfigs\":["
            + "{\"speaker\":\"" + NAMES[0] + "\",\"voiceConfig\":{\"prebuiltVoiceConfig\":{\"voiceName\":\"" + VOICES[0] + "\"}}},"
            + "{\"speaker\":\"" + NAMES[1] + "\",\"voiceConfig\":{\"prebuiltVoiceConfig\":{\"voiceName\":\"" + VOICES[1] + "\"}}}]}}}}";
    }

    // ------------------------------------------------------------------------------------------ réponse
    /** Le son est dans le plus long champ « data » (base64) de la réponse, quelle que soit l'interface. */
    static Audio parse(String body) throws Fail { return parse(body.getBytes(StandardCharsets.UTF_8)); }

    /**
     * Même chose, lu directement dans les octets reçus : une réponse de plusieurs minutes de son pèse des dizaines de Mo,
     * on évite d'en faire des copies (texte, expressions régulières).
     */
    static Audio parse(byte[] body) throws Fail {
        byte[] key = "\"data\"".getBytes(StandardCharsets.US_ASCII);
        int bestA = -1, bestZ = -1;
        for (int i = 0; i + key.length < body.length; i++) {
            boolean hit = true;
            for (int j = 0; j < key.length && hit; j++) hit = body[i + j] == key[j];
            if (!hit) continue;
            int p = i + key.length;
            while (p < body.length && (body[p] == ' ' || body[p] == '\n' || body[p] == '\r' || body[p] == '\t')) p++;
            if (p >= body.length || body[p] != ':') continue;
            p++;
            while (p < body.length && (body[p] == ' ' || body[p] == '\n' || body[p] == '\r' || body[p] == '\t')) p++;
            if (p >= body.length || body[p] != '"') continue;
            int a = ++p;
            while (p < body.length && body[p] != '"') p++;
            if (p - a > 200 && p - a > bestZ - bestA) { bestA = a; bestZ = p; }
            i = p;
        }
        if (bestA < 0) throw new Fail("empty", "pas de son dans la réponse", 0);
        byte[] raw = b64(body, bestA, bestZ);
        int rate = 24000;
        byte[] rk = "rate=".getBytes(StandardCharsets.US_ASCII);
        for (int i = 0; i + rk.length + 4 < body.length; i++) {
            if (i == bestA) { i = bestZ; continue; }
            boolean hit = true;
            for (int j = 0; j < rk.length && hit; j++) hit = body[i + j] == rk[j];
            if (!hit) continue;
            int v = 0, p = i + rk.length, n = 0;
            while (p < body.length && body[p] >= '0' && body[p] <= '9' && n < 6) { v = v * 10 + (body[p] - '0'); p++; n++; }
            if (n >= 4) { rate = v; break; }
        }
        return decode(raw, rate);
    }

    /** Du son brut (PCM 16 bits) ou un fichier WAV : les échantillons et la fréquence. */
    static Audio decode(byte[] raw, int rate) throws Fail {
        int off = 0, len = raw.length, ch = 1;
        if (raw.length > 44 && raw[0] == 'R' && raw[1] == 'I' && raw[2] == 'F' && raw[3] == 'F') { // WAV : l'en-tête dit tout
            int p = 12; off = -1;
            while (p + 8 <= raw.length) {
                int sz = le32(raw, p + 4);
                String id = new String(raw, p, 4, StandardCharsets.US_ASCII);
                if (id.equals("fmt ") && p + 24 <= raw.length) { ch = le16(raw, p + 10); rate = le32(raw, p + 12); }
                if (id.equals("data")) { off = p + 8; len = sz <= 0 || off + sz > raw.length ? raw.length - off : sz; break; }
                p += 8 + sz + (sz & 1);
            }
            if (off < 0) throw new Fail("empty", "WAV sans données", 0);
        }
        ch = Math.max(1, ch);
        int frames = len / (2 * ch);
        short[] pcm = new short[frames];
        for (int i = 0; i < frames; i++) pcm[i] = (short) ((raw[off + i * 2 * ch] & 0xFF) | (raw[off + i * 2 * ch + 1] << 8));
        if (frames < rate / 4) throw new Fail("empty", "son trop court", 0);
        return new Audio(pcm, rate);
    }

    /** Hauteur de voix (médiane, en Hz) d'un enregistrement de parole : environ 100-140 pour une voix d'homme, 180-250 pour une voix de femme. 0 si introuvable. */
    static double pitch(short[] p, int rate) {
        int fr = rate / 25, hop = rate / 50;                 // tranches de 40 ms, tous les 20 ms
        int lo = rate / 400, hi = rate / 70;                 // de 70 à 400 Hz
        double peak = 0;
        for (short v : p) peak = Math.max(peak, Math.abs(v));
        List<Double> f = new ArrayList<>();
        for (int s = 0; s + fr + hi < p.length; s += hop) {
            double e0 = 0, mean = 0;
            for (int i = 0; i < fr; i++) mean += p[s + i];
            mean /= fr;
            for (int i = 0; i < fr; i++) { double d = p[s + i] - mean; e0 += d * d; }
            if (Math.sqrt(e0 / fr) < 0.08 * peak) continue; // silence ou souffle
            double[] c = new double[hi + 1]; double best = 0;
            for (int lag = lo; lag <= hi; lag++) {
                double a = 0, eb = 0;
                for (int i = 0; i < fr; i++) { double x = p[s + i] - mean, y = p[s + i + lag] - mean; a += x * y; eb += y * y; }
                c[lag] = a / Math.sqrt(e0 * eb + 1e-9);
                if (c[lag] > best) best = c[lag];
            }
            if (best < 0.55) continue;                         // non voisé
            int pick = -1;                                     // le plus petit décalage presque aussi fort que le meilleur : évite l'erreur d'octave
            for (int lag = lo + 1; lag < hi; lag++) if (c[lag] >= 0.9 * best && c[lag] >= c[lag - 1] && c[lag] >= c[lag + 1]) { pick = lag; break; }
            if (pick > 0) f.add(rate / (double) pick);
        }
        if (f.size() < 5) return 0;
        java.util.Collections.sort(f);
        return f.get(f.size() / 2);
    }

    private static int le16(byte[] b, int p) { return (b[p] & 0xFF) | ((b[p + 1] & 0xFF) << 8); }
    private static int le32(byte[] b, int p) { return le16(b, p) | (le16(b, p + 2) << 16); }

    static byte[] b64(String s) { return b64(s.getBytes(StandardCharsets.US_ASCII), 0, s.length()); }

    /** base64 standard ou « url » (- et _), échappements \/ ignorés */
    static byte[] b64(byte[] s, int from, int to) {
        int[] t = new int[128]; java.util.Arrays.fill(t, -1);
        String a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for (int i = 0; i < 64; i++) t[a.charAt(i)] = i;
        t['-'] = 62; t['_'] = 63;
        ByteArrayOutputStream o = new ByteArrayOutputStream(Math.max(16, (to - from) * 3 / 4));
        int acc = 0, bits = 0;
        for (int i = from; i < to; i++) {
            int c = s[i] & 0xFF;
            if (c == '=' || c >= 128 || t[c] < 0) continue;
            acc = (acc << 6) | t[c]; bits += 6;
            if (bits >= 8) { bits -= 8; o.write((acc >> bits) & 0xFF); }
        }
        return o.toByteArray();
    }

    // ------------------------------------------------------------------------------------------ appel
    /** Ce que Google a répondu à chaque essai de la dernière fabrication (affiché tel quel à la personne en cas de refus) */
    static volatile String report = "";
    /** Modèle qui a fabriqué le dernier son */
    static volatile String lastModel = "";

    /** Un son pour ces répliques. Essaie les combinaisons (modèle, interface) à partir de la dernière qui a marché. */
    static Audio render(String key, List<Line> lines) throws Fail {
        Fail last = null;
        StringBuilder rep = new StringBuilder();
        int total = MODELS.length * APIS;
        for (int k = 0; k < total; k++) {
            int c = (combo + k) % total;
            String model = MODELS[c / APIS];
            boolean inter = c % APIS == 0;
            String url = base + (inter ? "/v1beta/interactions" : "/v1beta/models/" + model + ":generateContent");
            String body = inter ? bodyInteractions(model, lines) : bodyGenerate(lines);
            try {
                Audio a = once(url, key, body);
                combo = c; lastModel = model; report = "";
                return a;
            } catch (Fail f) {
                last = f;
                if (rep.length() > 0) rep.append('\n');
                rep.append(model).append(inter ? " (interactions) : " : " (generateContent) : ").append(f.getMessage());
                report = rep.toString();
                if (!f.kind.equals("off") && !f.kind.equals("empty")) throw f; // clé, quota, réseau : changer de modèle n'y change rien
            }
        }
        throw last != null ? last : new Fail("off", "aucune voix de studio disponible", 0);
    }

    /** Le message d'erreur de Google, en clair et court */
    static String gmsg(int code, String b) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.){1,400})").matcher(b);
        String t = m.find() ? m.group(1).replace("\\n", " ").replace("\\\"", "\"") : b.replaceAll("\\s+", " ");
        if (t.length() > 220) t = t.substring(0, 220) + "…";
        return code + " " + t.trim();
    }

    private static Audio once(String url, String key, String body) throws Fail {
        Object[] res;
        try {
            res = http(url, key, body);
            int code = (Integer) res[0];
            if ((code == 401 || code == 403 || (code == 400 && txt(res).contains("API_KEY"))) && !url.contains("?key=")) { // certaines clés passent mieux dans l'adresse
                Object[] r2 = http(url + "?key=" + java.net.URLEncoder.encode(key, "UTF-8"), "", body);
                if ((Integer) r2[0] < 400) res = r2;
            }
        } catch (Exception e) { throw new Fail("net", "réseau : " + e.getMessage(), 0); }
        int code = (Integer) res[0];
        if (code == 200) {
            try { return parse((byte[]) res[1]); }
            catch (Fail f) { String t = txt(res); throw new Fail(f.kind, "200 " + f.getMessage() + " · " + (t.length() > 160 ? t.substring(0, 160) + "…" : t).replaceAll("\\s+", " "), 0); }
        }
        String b = txt(res), g = gmsg(code, b);
        if (code == 429) {
            String w = Quota.why(b);
            throw new Fail(w.equals("minute") ? "minute" : "day", g, Quota.retryMs(b));
        }
        if (code == 401 || code == 403 || (code == 400 && b.contains("API_KEY"))) throw new Fail("key", g, 0);
        if (code >= 500) throw new Fail("minute", g, 8000);
        throw new Fail("off", g, 0); // 404, 400 : modèle ou format inconnu → combinaison suivante
    }

    private static String txt(Object[] res) { return new String((byte[]) res[1], StandardCharsets.UTF_8); }

    /** {code, octets reçus} */
    private static Object[] http(String url, String key, String json) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(15000);
            c.setReadTimeout(420000); // un long morceau de son peut prendre quelques minutes à fabriquer
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            if (!key.isEmpty()) c.setRequestProperty("x-goog-api-key", key);
            try (OutputStream o = c.getOutputStream()) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            ByteArrayOutputStream b = new ByteArrayOutputStream(code == 200 ? 1 << 20 : 4096);
            if (in != null) { byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); in.close(); }
            return new Object[]{code, b.toByteArray()};
        } finally { c.disconnect(); }
    }

    // ------------------------------------------------------------------------------------------ découpage du son en répliques
    static int[] frames(short[] p, int rate) { // énergie par tranche de 10 ms
        int hop = rate / 100, n = p.length / hop;
        int[] e = new int[n];
        for (int i = 0; i < n; i++) {
            long s = 0;
            for (int j = 0; j < hop; j++) { int v = p[i * hop + j]; s += (long) v * v; }
            e[i] = (int) Math.sqrt(s / (double) hop);
        }
        return e;
    }

    /** Enlève le grand silence du début et de la fin (garde un souffle de 120 ms). */
    static short[] trim(short[] p, int rate) {
        int[] e = frames(p, rate);
        int peak = 0; for (int v : e) peak = Math.max(peak, v);
        int thr = Math.max(30, peak / 40);
        int a = 0, z = e.length - 1;
        while (a < e.length && e[a] < thr) a++;
        while (z > a && e[z] < thr) z--;
        if (a >= z) return p;
        int hop = rate / 100;
        int from = Math.max(0, (a - 12) * hop), to = Math.min(p.length, (z + 13) * hop);
        return java.util.Arrays.copyOfRange(p, from, to);
    }

    /** Poids d'une réplique dans la durée du son : ses lettres parlées (balises retirées) + un souffle. */
    static int weight(String voiceText) {
        String s = voiceText.replaceAll("<[^>]*>", "").replaceAll("\\[[^\\]]*\\]", "");
        return Math.max(4, s.replaceAll("\\s+", " ").trim().length()) + 5;
    }

    /**
     * Où commence chaque réplique dans le son (n + 1 valeurs, en échantillons).
     * Gemini ne donne pas de minutage : on cherche les silences, puis on retient ceux qui collent le mieux
     * à la longueur de chaque réplique (programmation dynamique), en préférant les silences les plus longs,
     * surtout quand l'animateur change.
     */
    static int[] split(short[] pcm, int rate, int[] w, boolean[] change) {
        int n = w.length;
        int[] out = new int[n + 1];
        out[n] = pcm.length;
        if (n <= 1) return out;
        int hop = rate / 100;
        int[] e = frames(pcm, rate);
        int peak = 0; for (int v : e) peak = Math.max(peak, v);
        int thr = Math.max(20, peak / 25);
        // silences d'au moins 140 ms (hors début et fin)
        List<int[]> cand = new ArrayList<>(); // {milieu en échantillons, durée en ms}
        int i = 0;
        while (i < e.length) {
            if (e[i] < thr) {
                int j = i; while (j < e.length && e[j] < thr) j++;
                if (i > 3 && j < e.length - 3 && (j - i) >= 14) cand.add(new int[]{((i + j) / 2) * hop, (j - i) * 10});
                i = j;
            } else i++;
        }
        long tot = 0; for (int x : w) tot += x;
        double r = pcm.length / (double) tot; // échantillons par unité de poids (vitesse moyenne de parole)
        int K = cand.size();
        if (K < n - 1) { // pas assez de silences : estimation, collée au creux le plus proche
            long acc = 0;
            for (int k = 0; k < n; k++) { if (k > 0) out[k] = quietest(e, hop, (int) (r * acc), rate); acc += w[k]; }
            fix(out, n, rate);
            return out;
        }
        // positions : 0 = début du son, 1..K = silences, K+1 = fin
        int[] pos = new int[K + 2]; double[] bon = new double[K + 2];
        pos[0] = 0; pos[K + 1] = pcm.length;
        for (int c = 0; c < K; c++) pos[c + 1] = cand.get(c)[0];
        double[][] f = new double[n][K + 2];
        int[][] from = new int[n][K + 2];
        final double INF = 1e18;
        for (double[] row : f) java.util.Arrays.fill(row, INF);
        // chaque réplique doit durer à peu près comme ses lettres le disent (±22 %), sans que l'erreur s'additionne d'une réplique à l'autre
        for (int c = 1; c <= K; c++) bon[c] = Math.min(cand.get(c - 1)[1], 700) / 700.0;
        for (int c = 1; c <= K; c++) f[1][c] = seg(w[0], pos[c] - pos[0], r, rate) - bon[c] * (change != null && change.length > 1 && change[1] ? 2.0 : 1.0);
        for (int k = 2; k < n; k++) {
            double mult = change != null && k < change.length && change[k] ? 2.0 : 1.0;
            for (int c = k; c <= K; c++) {
                double best = INF; int bj = -1;
                for (int j = k - 1; j < c; j++) {
                    if (f[k - 1][j] >= INF) continue;
                    double v = f[k - 1][j] + seg(w[k - 1], pos[c] - pos[j], r, rate);
                    if (v < best) { best = v; bj = j; }
                }
                if (bj >= 0) { f[k][c] = best - bon[c] * mult; from[k][c] = bj; }
            }
        }
        double bestEnd = INF; int bc = -1;
        for (int c = n - 1; c <= K; c++) if (f[n - 1][c] < INF) { double v = f[n - 1][c] + seg(w[n - 1], pos[K + 1] - pos[c], r, rate); if (v < bestEnd) { bestEnd = v; bc = c; } }
        if (bc < 0) { long acc = 0; for (int k = 0; k < n; k++) { if (k > 0) out[k] = quietest(e, hop, (int) (r * acc), rate); acc += w[k]; } fix(out, n, rate); return out; }
        for (int k = n - 1; k >= 1; k--) { out[k] = pos[bc]; bc = from[k][bc]; }
        fix(out, n, rate);
        return out;
    }

    /** Coût d'une réplique de poids w qui dure d échantillons */
    private static double seg(int w, int d, double r, int rate) {
        if (d < 0.2 * rate) return 400;
        double want = w * r, tol = 0.22 * want + 0.5 * rate, x = (d - want) / tol;
        return Math.min(x * x, 400);
    }

    private static int quietest(int[] e, int hop, int center, int rate) {
        int c = center / hop, r = (int) (1.5 * 100), best = Math.max(0, Math.min(e.length - 1, c)), bv = Integer.MAX_VALUE;
        for (int i = Math.max(1, c - r); i < Math.min(e.length - 1, c + r); i++) {
            int v = e[i - 1] + e[i] + e[i + 1];
            if (v < bv) { bv = v; best = i; }
        }
        return best * hop;
    }

    private static void fix(int[] out, int n, int rate) { // croissant, au moins 0,25 s par réplique quand c'est possible
        out[0] = 0;
        int total = out[n];
        for (int k = 1; k < n; k++) {
            int lo = out[k - 1] + (int) (0.25 * rate), hi = total - (n - k) * (int) (0.25 * rate);
            if (out[k] < lo) out[k] = lo;
            if (hi > lo && out[k] > hi) out[k] = hi;
            if (out[k] > total) out[k] = total;
        }
    }
}
