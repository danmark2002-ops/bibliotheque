package ca.bibliotheque.app;

import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Essai sur ordinateur du moteur de voix (Studio) : faux serveur Gemini + découpage du son. Lancer avec run.sh. */
public class StudioTest {
    static int fails = 0;
    static void ok(boolean c, String m) { System.out.println((c ? "OK   " : "ECHEC ") + m); if (!c) fails++; }

    // ---- son synthétique : « parole » = salves de sinus modulées, avec petits silences dans la phrase et plus longs entre répliques
    static final int R = 24000;
    static short[] speech(Random rnd, int sp, int chars, List<Integer> gaps) {
        double sec = chars * (0.060 + rnd.nextDouble() * 0.025);
        int n = (int) (sec * R);
        short[] s = new short[n];
        double f0 = sp == 0 ? 210 : 120, ph = 0;
        int nextGap = (int) ((0.5 + rnd.nextDouble()) * R * 1.5);
        int gapLeft = 0;
        for (int i = 0; i < n; i++) {
            if (gapLeft > 0) { gapLeft--; s[i] = (short) (rnd.nextGaussian() * 6); continue; }
            if (i > nextGap) { gapLeft = (int) ((0.15 + rnd.nextDouble() * 0.15) * R); nextGap = i + gapLeft + (int) ((0.6 + rnd.nextDouble() * 1.4) * R); }
            double env = 0.5 + 0.5 * Math.sin(i / (double) R * 2 * Math.PI * (3 + rnd.nextDouble()));
            ph += 2 * Math.PI * (f0 * (1 + 0.1 * Math.sin(i / 3000.0))) / R;
            s[i] = (short) ((3000 + 7000 * env) * Math.sin(ph) + rnd.nextGaussian() * 40);
        }
        return s;
    }

    static byte[] wav(short[] p, int rate) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        DataOutputStream d = new DataOutputStream(o);
        try {
            d.writeBytes("RIFF"); d.writeInt(Integer.reverseBytes(36 + p.length * 2)); d.writeBytes("WAVEfmt ");
            d.writeInt(Integer.reverseBytes(16)); d.writeShort(Short.reverseBytes((short) 1)); d.writeShort(Short.reverseBytes((short) 1));
            d.writeInt(Integer.reverseBytes(rate)); d.writeInt(Integer.reverseBytes(rate * 2)); d.writeShort(Short.reverseBytes((short) 2)); d.writeShort(Short.reverseBytes((short) 16));
            d.writeBytes("data"); d.writeInt(Integer.reverseBytes(p.length * 2));
            for (short v : p) d.writeShort(Short.reverseBytes(v));
        } catch (IOException e) { throw new RuntimeException(e); }
        return o.toByteArray();
    }
    static byte[] raw(short[] p) { byte[] b = new byte[p.length * 2]; for (int i = 0; i < p.length; i++) { b[2 * i] = (byte) p[i]; b[2 * i + 1] = (byte) (p[i] >> 8); } return b; }

    public static void main(String[] a) throws Exception {
        // ---------- 1. découpage : 300 scènes aléatoires, 6 à 24 répliques
        int good = 0, total = 0, scenesPerfect = 0, scenes = 300, badChg = 0, badSame = 0, nChg = 0, nSame = 0;
        Random rnd = new Random(7);
        for (int t = 0; t < scenes; t++) {
            int n = 6 + rnd.nextInt(19);
            int[] w = new int[n]; boolean[] chg = new boolean[n];
            List<short[]> parts = new ArrayList<>(); int[] truth = new int[n + 1];
            int pos = 0, sp = rnd.nextInt(2);
            for (int k = 0; k < n; k++) {
                int chars = 12 + rnd.nextInt(150);
                if (rnd.nextInt(8) == 0) chars = 4 + rnd.nextInt(10);
                w[k] = chars + 5;
                int prev = sp; if (k > 0 && rnd.nextInt(3) > 0) sp = 1 - sp; chg[k] = k > 0 && sp != prev;
                short[] seg = speech(rnd, sp, chars, null);
                // vraie frontière : au milieu du silence entre répliques
                int gap = (int) ((chg[k] ? 0.30 + rnd.nextDouble() * 0.35 : 0.18 + rnd.nextDouble() * 0.2) * R);
                short[] g = new short[gap]; for (int i = 0; i < gap; i++) g[i] = (short) (rnd.nextGaussian() * 6);
                if (k > 0) { truth[k] = pos + gap / 2; parts.add(g); pos += gap; }
                parts.add(seg); pos += seg.length;
            }
            truth[n] = pos;
            short[] all = new short[pos]; int p = 0; for (short[] s : parts) { System.arraycopy(s, 0, all, p, s.length); p += s.length; }
            int[] got = Studio.split(all, R, w, chg);
            boolean perfect = true;
            for (int k = 1; k < n; k++) {
                total++; if (chg[k]) nChg++; else nSame++;
                // juste = la coupure tombe dans le silence entre les deux répliques (tolérance 0,3 s)
                if (Math.abs(got[k] - truth[k]) < 0.30 * R) good++; else { perfect = false; if (chg[k]) badChg++; else badSame++; }
            }
            if (perfect) scenesPerfect++;
        }
        System.out.printf("   (erreurs : %d/%d quand l'animateur change, %d/%d dans une même prise de parole)%n", badChg, nChg, badSame, nSame);
        double pct = 100.0 * good / total;
        ok(pct >= 93, String.format("découpage : %.1f %% des coupures au bon endroit (%d/%d), %d/%d scènes parfaites", pct, good, total, scenesPerfect, scenes));

        // ---------- 2. analyse des réponses
        short[] test = new short[R * 3]; for (int i = 0; i < test.length; i++) test[i] = (short) (8000 * Math.sin(i * 0.05));
        String b64 = Base64.getEncoder().encodeToString(wav(test, R));
        Studio.Audio au = Studio.parse("{\"steps\":[{\"type\":\"model_output\",\"content\":[{\"type\":\"audio\",\"data\":\"" + b64 + "\"}]}]}");
        ok(au.pcm.length == test.length && au.rate == R && au.pcm[1000] == test[1000], "WAV (interactions) lu : " + au.pcm.length + " échantillons, " + au.rate + " Hz");
        String b64r = Base64.getEncoder().encodeToString(raw(test));
        au = Studio.parse("{\"candidates\":[{\"content\":{\"parts\":[{\"inlineData\":{\"mimeType\":\"audio/L16;codec=pcm;rate=24000\",\"data\":\"" + b64r.replace("/", "\\/") + "\"}}]}}]}");
        ok(au.pcm.length == test.length && au.pcm[2000] == test[2000], "PCM brut (generateContent, « \\/ » échappé) lu");
        try { Studio.parse("{\"steps\":[]}"); ok(false, "réponse sans son refusée"); } catch (Studio.Fail f) { ok(f.kind.equals("empty"), "réponse sans son refusée"); }


        // ---------- hauteur de voix (pour reconnaître une voix d'homme d'une voix de femme)
        for (double hz : new double[]{105, 125, 150, 190, 220, 250}) {
            int R2 = 22050; short[] v = new short[R2 * 3]; double ph = 0; Random pr = new Random((long) hz);
            for (int i = 0; i < v.length; i++) {
                double t = i / (double) R2, f = hz * (1 + 0.06 * Math.sin(t * 5) + 0.02 * pr.nextGaussian() * 0.1);
                ph += 2 * Math.PI * f / R2;
                double env = (t % 0.9) < 0.7 ? 1 : 0; // phrases séparées par des silences
                double sig = 0; for (int k = 1; k <= 12; k++) sig += Math.sin(k * ph) / k;  // harmoniques
                v[i] = (short) (env * 5000 * sig + pr.nextGaussian() * 60);
            }
            double got = Studio.pitch(v, R2);
            ok(Math.abs(got - hz) / hz < 0.06, String.format("hauteur mesurée : %.0f Hz pour une voix à %.0f Hz", got, hz));
        }
        short[] noise = new short[24000 * 2]; Random nr = new Random(1); for (int i = 0; i < noise.length; i++) noise[i] = (short) (nr.nextGaussian() * 3000);
        ok(Studio.pitch(noise, 24000) == 0, "bruit sans voix : pas de hauteur inventée");

        // ---------- 3. faux serveur Gemini
        final String[] mode = {"new"};
        final List<String> seen = new ArrayList<>(), bodies = new ArrayList<>();
        HttpServer srv = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        srv.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath(), q = ex.getRequestURI().getQuery();
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            seen.add(path + (q == null ? "" : "?" + q)); bodies.add(body);
            int code = 404; String out = "{\"error\":{\"code\":404,\"message\":\"models/x is not found\"}}";
            boolean inter = path.equals("/v1beta/interactions");
            String key = ex.getRequestHeaders().getFirst("x-goog-api-key");
            if (mode[0].equals("key")) { code = 403; out = "{\"error\":{\"code\":403,\"message\":\"API key not valid\"}}"; }
            else if (mode[0].equals("day")) { code = 429; out = "{\"error\":{\"code\":429,\"message\":\"Quota exceeded for metric generate_content_free_tier_requests, limit: 0\"}}"; }
            else if (mode[0].equals("minute")) { code = 429; out = "{\"error\":{\"code\":429,\"details\":[{\"retryDelay\":\"37s\"}]}}"; }
            else if (mode[0].equals("new") && inter && body.contains("gemini-3.8-flash-tts") && "K".equals(key)) { code = 200; out = "{\"steps\":[{\"type\":\"model_output\",\"content\":[{\"type\":\"audio\",\"data\":\"" + b64 + "\"}]}]}"; }
            else if (mode[0].equals("old") && path.contains("gemini-3.1-flash-tts-preview:generateContent") && "K".equals(key)) { code = 200; out = "{\"candidates\":[{\"content\":{\"parts\":[{\"inlineData\":{\"mimeType\":\"audio/L16;codec=pcm;rate=24000\",\"data\":\"" + b64r + "\"}}]}}]}"; }
            byte[] ob = out.getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(code, ob.length); ex.getResponseBody().write(ob); ex.close();
        });
        srv.start();
        Studio.base = "http://127.0.0.1:" + srv.getAddress().getPort();
        List<Studio.Line> lines = new ArrayList<>();
        lines.add(new Studio.Line(0, "Bienvenue ! <laugh> Aujourd'hui, un livre « fascinant »…", "enthousiaste"));
        lines.add(new Studio.Line(1, "Attends, \"vraiment\" ?\nOui.", "surpris"));
        lines.add(new Studio.Line(1, "Et la suite ?", ""));

        mode[0] = "new"; Studio.combo = 0; seen.clear();
        au = Studio.render("K", lines);
        ok(au.pcm.length == test.length && seen.size() == 1 && seen.get(0).equals("/v1beta/interactions"), "interface actuelle : réussie du premier coup (" + seen + ")");
        ok(Studio.combo == 0, "combinaison retenue : " + Studio.combo);

        mode[0] = "old"; Studio.combo = 0; seen.clear();
        au = Studio.render("K", lines);
        ok(au.pcm.length == test.length, "ancienne interface retrouvée après " + seen.size() + " essais");
        int remembered = Studio.combo;
        seen.clear(); Studio.render("K", lines);
        ok(seen.size() == 1 && Studio.combo == remembered, "la combinaison qui marche est retenue : un seul appel ensuite (combo " + remembered + ")");

        for (String m : new String[]{"key", "day", "minute"}) {
            mode[0] = m; Studio.combo = 0; seen.clear();
            try { Studio.render("K", lines); ok(false, "refus « " + m + " »"); }
            catch (Studio.Fail f) { ok(f.kind.equals(m) && seen.size() <= 2, "refus « " + m + " » reconnu sans insister (" + seen.size() + " appel(s), retry " + f.retryMs + " ms)"); }
        }
        mode[0] = "none"; Studio.combo = 0; seen.clear();
        try { Studio.render("K", lines); ok(false, "service absent"); }
        catch (Studio.Fail f) { ok(f.kind.equals("off") && seen.size() >= 6, "aucun modèle disponible : " + seen.size() + " combinaisons essayées puis « off »"); }
        String[] rl = Studio.report.split("\n");
        ok(rl.length == 6 && rl[0].contains("gemini-3.8-flash-tts (interactions) : 404 models/x is not found"), "réponse exacte de Google gardée pour chaque essai :\n      " + String.join("\n      ", rl));

        // grosse réponse (5 minutes de son, ~19 Mo) : lue directement dans les octets
        short[] big = new short[R * 300]; for (int i = 0; i < big.length; i++) big[i] = (short) (6000 * Math.sin(i * 0.031));
        String bigB64 = Base64.getEncoder().encodeToString(wav(big, R));
        long t0 = System.currentTimeMillis();
        au = Studio.parse(("{\"steps\":[{\"type\":\"model_output\",\"content\":[{\"type\":\"text\",\"data\":\"court\"},{\"type\":\"audio\",\"data\":\"" + bigB64 + "\"}]}]}").getBytes(StandardCharsets.UTF_8));
        ok(au.pcm.length == big.length && au.pcm[12345] == big[12345], "5 min de son (" + bigB64.length() / 1_000_000 + " Mo de base64) lues en " + (System.currentTimeMillis() - t0) + " ms");
        ok(Studio.gmsg(400, "{\"error\":{\"message\":\"Invalid value at \\\"speech_config\\\"\",\"status\":\"INVALID_ARGUMENT\"}}").equals("400 Invalid value at \"speech_config\""), "message de Google extrait : " + Studio.gmsg(400, "{\"error\":{\"message\":\"Invalid value at \\\"speech_config\\\"\"}}"));

        // corps JSON valides (vérifiés ensuite par Python) et tours de parole fusionnés
        try (PrintWriter w = new PrintWriter("bodies.txt", "UTF-8")) { for (String b : bodies) w.println(b.replace("\n", " ")); }
        String bi = Studio.bodyInteractions("m", lines);
        ok(bi.contains("\"speaker\":\"Alex\"") && bi.split("speech_metadata", -1).length == 3 && bi.contains("vraiment\\\" ?\\nOui. Et la suite ?"), "3 répliques, 2 animateurs → les 2 répliques d'Alex de suite forment un seul tour (" + (bi.split("speech_metadata", -1).length - 1) + " tours)");
        srv.stop(0);
        System.out.println(fails == 0 ? "TOUT PASSE" : fails + " ÉCHEC(S)");
        System.exit(fails == 0 ? 0 : 1);
    }
}
