package ca.bibliotheque.app;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.List;
import java.util.Random;

/** Essai du découpage du balado en scènes (Voix.script / Voix.scenes) avec un vrai org.json. */
public class VoixTest {
    static int fails = 0;
    static void ok(boolean c, String m) { System.out.println((c ? "OK   " : "ECHEC ") + m); if (!c) fails++; }

    static String json(int n, boolean done, Random r, boolean lastEnds) {
        JSONArray u = new JSONArray(); int sp = 0;
        for (int i = 0; i < n; i++) {
            if (i > 0 && r.nextInt(3) > 0) sp = 1 - sp;
            String t = "x".repeat(20 + r.nextInt(140));
            u.put(new JSONArray().put(t).put(0).put(i == n - 1 && lastEnds || (i % 29 == 28) ? 2 : 0).put(sp).put(i % 4 == 0 ? "<laugh> " + t : t).put(i % 3 == 0 ? "amusé" : ""));
        }
        return new JSONObject().put("u", u).put("done", done).toString();
    }

    public static void main(String[] a) throws Exception {
        Random r = new Random(3);
        for (int round = 0; round < 50; round++) {
            int n = 20 + r.nextInt(200);
            boolean done = r.nextBoolean(), ends = r.nextBoolean();
            Voix.Script s = Voix.script(json(n, done, r, ends));
            List<Voix.Scene> sc = Voix.scenes(s);
            boolean contiguous = true, sizes = true; int next = 0;
            for (Voix.Scene x : sc) {
                if (x.first != next || x.last < x.first) contiguous = false;
                int chars = 0; for (int i = x.first; i <= x.last; i++) chars += s.voice.get(i).length();
                int aim = next == 0 ? Voix.FIRST : Voix.big;
                if (chars > aim * 3 / 2 + 200) sizes = false; // une phrase peut dépasser un peu la limite
                next = x.last + 1;
            }
            boolean tail = (done || ends) ? next == n : next <= n;
            if (!contiguous || !sizes || !tail) { ok(false, "tour " + round + " : contiguous=" + contiguous + " sizes=" + sizes + " tail=" + tail + " n=" + n + " next=" + next + " done=" + done); }
        }
        ok(fails == 0, "50 balados au hasard : scènes contiguës, la 1re courte (~1 100 lettres), les autres longues (~4 500), la fin couverte quand le balado est terminé");

        Voix.Script s1 = Voix.script(json(60, true, new Random(1), true)), s2 = Voix.script(json(60, true, new Random(1), true)), s3 = Voix.script(json(60, true, new Random(2), true));
        ok(Voix.scenes(s1).get(0).hash.equals(Voix.scenes(s2).get(0).hash), "même texte → même empreinte (le son gardé reste valable)");
        ok(!Voix.scenes(s1).get(0).hash.equals(Voix.scenes(s3).get(0).hash), "autre texte → autre empreinte (le son est refait)");
        Voix.Script open = Voix.script(json(25, false, new Random(5), false));
        ok(Voix.scenes(open).isEmpty() || Voix.scenes(open).get(Voix.scenes(open).size() - 1).last < open.n() - 1, "suite pas encore écrite : la dernière scène ouverte n'est pas fabriquée");
        ok(s1.voice.get(0).contains("<laugh>") && !s1.text.get(0).contains("<") && s1.style.get(0).equals("amusé"), "la phrase affichée est propre, la phrase jouée garde les balises et le ton");
        Voix.Script old = Voix.script("{\"u\":[[\"Bonjour.\",0,2,0]],\"done\":true}");
        ok(old.voice.get(0).equals("Bonjour.") && old.style.get(0).isEmpty(), "ancien balado (sans balises) encore lu");

        // ---------- de bout en bout : faux Gemini + fichiers réels
        java.io.File files = java.nio.file.Files.createTempDirectory("voix").toFile();
        java.io.File auto = new java.io.File(files, "auto/balado"); auto.mkdirs();
        Random rr = new Random(11);
        String js = json(70, true, rr, true);
        java.nio.file.Files.write(new java.io.File(auto, "b1.json").toPath(), js.getBytes("UTF-8"));
        Voix.Script sc0 = Voix.script(js); List<Voix.Scene> scs = Voix.scenes(sc0);
        final int[] calls = {0};
        final String[] mode = {"ok"};
        com.sun.net.httpserver.HttpServer srv = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        srv.createContext("/", ex -> {
            String body = new String(ex.getRequestBody().readAllBytes(), "UTF-8");
            calls[0]++;
            int code = 200; String out;
            if (mode[0].equals("day")) { code = 429; out = "{\"error\":{\"message\":\"limit: 0\"}}"; }
            else {
                // durée ~ nombre de lettres du corps / 12 secondes, avec silences entre les tours
                // ~14 lettres par seconde de parole ; en mode « cut », Gemini s'arrête à 2 minutes
                int secs = Math.max(3, Math.min(mode[0].equals("cut") ? 120 : 600, body.length() / 15));
                short[] pcm = new short[24000 * secs];
                for (int i = 0; i < pcm.length; i++) pcm[i] = (short) (((i / 12000) % 5 == 4) ? 0 : 6000 * Math.sin(i * 0.07) + (i % 7));
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                for (short v : pcm) { bo.write(v & 0xFF); bo.write((v >> 8) & 0xFF); }
                out = "{\"candidates\":[{\"content\":{\"parts\":[{\"inlineData\":{\"mimeType\":\"audio/L16;codec=pcm;rate=24000\",\"data\":\"" + java.util.Base64.getEncoder().encodeToString(bo.toByteArray()) + "\"}}]}}]}";
                if (body.contains("speech_metadata") && false) code = 404;
            }
            byte[] ob = out.getBytes("UTF-8"); ex.sendResponseHeaders(code, ob.length); ex.getResponseBody().write(ob); ex.close();
        });
        srv.start();
        Studio.base = "http://127.0.0.1:" + srv.getAddress().getPort();
        Studio.combo = 1; // l'interface actuelle n'existe pas dans ce faux serveur : il répond à tout, au format de l'ancienne
        Voix.focus(1);
        Voix.work(files, "K", "b1");
        int made = 0; for (int k = 0; k < scs.size(); k++) if (Voix.has(files, "b1", k, scs.get(k))) made++;
        ok(made == scs.size() && calls[0] >= scs.size(), "toutes les scènes fabriquées : " + made + "/" + scs.size() + " avec " + calls[0] + " appels");
        ok(scs.size() <= 4, "70 répliques → " + scs.size() + " demandes à Gemini seulement (scènes longues)");
        Voix.Clip cl = Voix.load(files, "b1", 0, scs.get(0));
        int nl = scs.get(0).last - scs.get(0).first + 1;
        boolean inc = cl != null && cl.starts.length == nl + 1 && cl.starts[0] == 0 && cl.starts[nl] == cl.pcm.length;
        for (int i = 1; cl != null && i < cl.starts.length; i++) if (cl.starts[i] < cl.starts[i - 1]) inc = false;
        ok(inc, "scène 0 relue du disque : " + (cl == null ? "?" : cl.pcm.length + " échantillons, " + nl + " phrases, débuts croissants"));
        int before = calls[0];
        Voix.work(files, "K", "b1");
        ok(calls[0] == before, "relancé : rien n'est refabriqué (son déjà gardé)");
        // le texte change (« Refaire une émission ») : l'ancien son n'est plus utilisé
        String js2 = json(70, true, new Random(99), true);
        java.nio.file.Files.write(new java.io.File(auto, "b1.json").toPath(), js2.getBytes("UTF-8"));
        List<Voix.Scene> scs2 = Voix.scenes(Voix.script(js2));
        ok(!Voix.has(files, "b1", 0, scs2.get(0)) && Voix.load(files, "b1", 0, scs2.get(0)) == null, "texte refait : l'ancien son est ignoré");
        mode[0] = "day"; before = calls[0];
        Voix.work(files, "K", "b1");
        ok(Voix.blocked() && calls[0] - before == 1 && Voix.problem().contains("quota"), "quota du jour : un seul appel puis voix du téléphone (« " + Voix.problem() + " »)");
        Voix.work(files, "K", "b1");
        ok(calls[0] - before == 1, "tant que c'est bloqué, aucun nouvel appel");
        // Gemini rend un son coupé (2 min) : les scènes raccourcissent toutes seules, et tout finit fabriqué
        Voix.unblock(); mode[0] = "cut"; Voix.purge(files, "b1");
        Voix.work(files, "K", "b1");
        List<Voix.Scene> scs3 = Voix.scenes(Voix.script(js2)); int made3 = 0;
        for (int k = 0; k < scs3.size(); k++) if (Voix.has(files, "b1", k, scs3.get(k))) made3++;
        ok(Voix.big < Voix.BIG && made3 == scs3.size() && new java.io.File(files, "voix/taille").exists(), "son coupé par Gemini : scènes réduites à " + Voix.big + " lettres (retenu), " + made3 + "/" + scs3.size() + " fabriquées");
        Voix.purge(files, "b1");
        ok(!new java.io.File(files, "voix/b1").exists(), "suppression du balado : son effacé");
        srv.stop(0);

        // ---------- voix québécoises : catalogue de Gemini (fr-CA), refus éventuel dans un dialogue, retour aux voix par défaut
        final String[] cat = {"two"}; final boolean[] acceptLocal = {true}; final List<String> ttsBodies = new java.util.ArrayList<>();
        com.sun.net.httpserver.HttpServer srvQ = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        srvQ.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath(), q = String.valueOf(ex.getRequestURI().getQuery());
            String body = new String(ex.getRequestBody().readAllBytes(), "UTF-8");
            int code = 200; String out;
            if (path.equals("/v1beta/voices")) {
                if (cat[0].equals("none")) { code = 404; out = "{\"error\":{\"message\":\"Method not found.\"}}"; }
                else out = q.contains("fr-CA") ? "{\"voices\":[{\"id\":\"voices/fr-CA-Chirp-Lea\",\"display_name\":\"Léa\",\"language_code\":\"fr-CA\",\"gender\":\"female\",\"type\":\"prebuilt\"},"
                    + "{\"id\":\"voices/fr-CA-Chirp-Marc\",\"display_name\":\"Marc\",\"language_code\":\"fr-CA\",\"gender\":\"male\",\"type\":\"prebuilt\"},"
                    + "{\"id\":\"voices/en-CA-Bob\",\"language_code\":\"en-CA\",\"gender\":\"male\"}]}" : "{\"voices\":[]}";
            } else {
                ttsBodies.add(body);
                boolean local = body.contains("fr-CA-Chirp");
                if (local && !acceptLocal[0]) { code = 400; out = "{\"error\":{\"message\":\"Multi-speaker supports prebuilt voices only\"}}"; }
                else {
                    short[] pcm = new short[24000 * Math.max(3, Math.min(600, body.length() / 15))];
                    for (int i = 0; i < pcm.length; i++) pcm[i] = (short) (((i / 12000) % 5 == 4) ? 0 : 6000 * Math.sin(i * 0.07));
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                    for (short v : pcm) { bo.write(v & 0xFF); bo.write((v >> 8) & 0xFF); }
                    out = "{\"candidates\":[{\"content\":{\"parts\":[{\"inlineData\":{\"mimeType\":\"audio/L16;codec=pcm;rate=24000\",\"data\":\"" + java.util.Base64.getEncoder().encodeToString(bo.toByteArray()) + "\"}}]}}]}";
                }
            }
            byte[] ob = out.getBytes("UTF-8"); ex.sendResponseHeaders(code, ob.length); ex.getResponseBody().write(ob); ex.close();
        });
        srvQ.start();
        Studio.base = "http://127.0.0.1:" + srvQ.getAddress().getPort();
        Voix.unblock();
        java.io.File qf = new java.io.File(files, "voix/quebec.json");
        qf.delete(); String say = Voix.local(files, "K");
        ok(Studio.voices[0].equals("voices/fr-CA-Chirp-Lea") && Studio.voices[1].equals("voices/fr-CA-Chirp-Marc") && say.contains("québécoises"), "catalogue fr-CA : Camille = Léa, Alex = Marc (« " + say + " »), voix anglaises écartées");
        java.nio.file.Files.write(new java.io.File(auto, "b2.json").toPath(), json(30, true, new Random(5), true).getBytes("UTF-8"));
        ttsBodies.clear(); Voix.work(files, "K", "b2");
        List<Voix.Scene> q1 = Voix.scenes(Voix.script(json(30, true, new Random(5), true))); int m1 = 0;
        for (int k = 0; k < q1.size(); k++) if (Voix.has(files, "b2", k, q1.get(k))) m1++;
        ok(m1 == q1.size() && ttsBodies.get(0).contains("fr-CA-Chirp-Lea"), "balado fait avec les voix québécoises (" + m1 + "/" + q1.size() + " scènes)");
        // Gemini refuse ces voix dans un dialogue : le balado se fait quand même, avec les voix par défaut, et on le retient
        acceptLocal[0] = false; Voix.purge(files, "b2"); qf.delete(); Voix.local(files, "K"); ttsBodies.clear();
        Voix.work(files, "K", "b2");
        List<Voix.Scene> q2 = Voix.scenes(Voix.script(json(30, true, new Random(5), true))); int m2 = 0;
        for (int k = 0; k < q2.size(); k++) if (Voix.has(files, "b2", k, q2.get(k))) m2++;
        ok(!Voix.blocked() && java.util.Arrays.equals(Studio.voices, Studio.DEFAULT) && m2 == q2.size(), "voix québécoises refusées dans un dialogue → voix par défaut, balado complet (" + m2 + "/" + q2.size() + "), rien de bloqué");
        org.json.JSONObject qj = new org.json.JSONObject(new String(java.nio.file.Files.readAllBytes(qf.toPath()), "UTF-8"));
        ok(qj.optInt("form") == 1 && qj.optString("why").contains("prebuilt voices only"), "refus retenu avec la réponse de Google ; prochaine forme d'identifiant au prochain essai");
        cat[0] = "none"; qf.delete();
        say = Voix.local(files, "K");
        ok(java.util.Arrays.equals(Studio.voices, Studio.DEFAULT) && say.contains("n'offre pas"), "catalogue absent → voix par défaut : « " + say + " »");
        srvQ.stop(0);
        System.out.println(fails == 0 ? "TOUT PASSE" : fails + " ÉCHEC(S)");
        System.exit(fails == 0 ? 0 : 1);
    }
}
