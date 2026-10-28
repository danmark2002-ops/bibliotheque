package ca.bibliotheque.app;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.*;

/** Essai de la logique « Gemini Pro d'abord, Flash ensuite » avec un faux serveur Google. */
public class IaTest {
    static int fails = 0;
    static void ok(boolean c, String m) { System.out.println((c ? "OK   " : "ECHEC ") + m); if (!c) fails++; }

    public static void main(String[] a) throws Exception {
        final Map<String, String> behave = new HashMap<>();   // modèle → comportement
        final List<String> seen = new ArrayList<>();
        HttpServer srv = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        srv.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath();
            String model = path.substring(path.lastIndexOf('/') + 1).replace(":generateContent", "");
            ex.getRequestBody().readAllBytes();
            seen.add(model);
            String b = behave.getOrDefault(model, "ok");
            int code = 200; String out = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Résumé par " + model + "\"}]}}]}";
            switch (b) {
                case "limit0": code = 429; out = "{\"error\":{\"code\":429,\"message\":\"Quota exceeded for metric generate_content_free_tier_requests, limit: 0, model: " + model + "\"}}"; break;
                case "minute": code = 429; out = "{\"error\":{\"code\":429,\"message\":\"Resource exhausted\",\"details\":[{\"retryDelay\":\"1s\"}]}}"; behave.put(model, "ok"); break;
                case "big": code = 429; out = "{\"error\":{\"code\":429,\"message\":\"exceeded GenerateContentInputTokensPerModelPerMinute\"}}"; break;
                case "404": code = 404; out = "{\"error\":{\"code\":404,\"message\":\"models/" + model + " is not found\"}}"; break;
                case "403": code = 403; out = "{\"error\":{\"code\":403,\"message\":\"Your project does not have access to " + model + "\"}}"; break;
            }
            byte[] ob = out.getBytes("UTF-8"); ex.sendResponseHeaders(code, ob.length); ex.getResponseBody().write(ob); ex.close();
        });
        srv.start();
        IaGratuite.base = "http://127.0.0.1:" + srv.getAddress().getPort();
        IaGratuite.GAP = 0;
        final Map<String, Long> pz = new HashMap<>();
        IaGratuite.Pauses p = new IaGratuite.Pauses() { public long until(String m) { return pz.getOrDefault(m, 0L); } public void set(String m, long t) { pz.put(m, t); } };
        final List<String> said = new ArrayList<>();
        IaGratuite.STATUS.set(said::add);

        // A : pro-latest n'est pas offert (quota 0), gemini-2.5-pro l'est → le second répond, le premier est écarté seul
        behave.put("gemini-pro-latest", "limit0"); behave.put("gemini-2.5-pro", "ok");
        String r = IaGratuite.tryPro("K", "", "x", false, false, p);
        ok("Résumé par gemini-2.5-pro".equals(r) && IaGratuite.lastModel.equals("gemini-2.5-pro"), "A : pro-latest refusé (quota 0) → gemini-2.5-pro répond (" + r + ")");
        ok(pz.containsKey("gemini-pro-latest") && !pz.containsKey("gemini-2.5-pro"), "A : seul pro-latest est mis de côté");
        ok(IaGratuite.lastProNote.contains("limit: 0"), "A : la raison de Google est gardée : « " + IaGratuite.lastProNote + " »");
        seen.clear(); r = IaGratuite.tryPro("K", "", "x", false, false, p);
        ok(seen.equals(Arrays.asList("gemini-2.5-pro")), "A : au prochain essai, pro-latest n'est plus demandé (" + seen + ")");

        // B : aucun Pro offert → null (Flash prendra le relais), puis plus aucun appel Pro
        pz.clear(); behave.put("gemini-2.5-pro", "limit0");
        r = IaGratuite.tryPro("K", "", "x", false, false, p);
        ok(r == null && pz.size() == 2, "B : aucun Pro offert → null, les deux sont mis de côté");
        seen.clear(); r = IaGratuite.tryPro("K", "", "x", false, false, p);
        ok(r == null && seen.isEmpty(), "B : ensuite, aucun appel inutile à Pro");

        // C : limite par minute courte → un nouvel essai réussit
        pz.clear(); behave.put("gemini-pro-latest", "minute"); behave.put("gemini-2.5-pro", "ok"); seen.clear();
        r = IaGratuite.tryPro("K", "", "x", false, false, p);
        ok("Résumé par gemini-pro-latest".equals(r) && seen.size() == 2 && pz.isEmpty(), "C : limite par minute → attente courte puis succès, rien n'est écarté (" + seen + ")");

        // D : nom retiré (404) → suivant
        pz.clear(); behave.put("gemini-pro-latest", "404"); seen.clear();
        r = IaGratuite.tryPro("K", "", "x", false, false, p);
        ok("Résumé par gemini-2.5-pro".equals(r) && pz.get("gemini-pro-latest") > System.currentTimeMillis() + 6 * 24 * 3600_000L, "D : 404 → écarté 7 jours, le suivant répond");

        // E : accès refusé (403) avec message clair
        pz.clear(); behave.put("gemini-pro-latest", "403"); behave.put("gemini-2.5-pro", "403"); said.clear();
        r = IaGratuite.tryPro("K", "", "x", false, false, p);
        ok(r == null && IaGratuite.lastProNote.contains("does not have access"), "E : 403 → raison lisible : « " + IaGratuite.lastProNote + " »");

        // F : livre trop long pour la limite par minute → pas de pause, Flash
        pz.clear(); behave.put("gemini-pro-latest", "big"); said.clear();
        r = IaGratuite.tryPro("K", "", "x", false, false, p);
        ok(r == null && pz.isEmpty() && said.stream().anyMatch(s -> s.contains("trop long")), "F : texte trop long → Flash, sans écarter Pro (« " + (said.isEmpty() ? "" : said.get(0)) + " »)");
        ok(IaGratuite.offline(new java.net.UnknownHostException("generativelanguage.googleapis.com")), "réseau coupé reconnu (nom introuvable)");
        ok(IaGratuite.offline(new Exception("Gemini", new java.io.IOException("Unable to resolve host \"generativelanguage.googleapis.com\": No address associated with hostname"))), "réseau coupé reconnu (dans la cause)");
        ok(!IaGratuite.offline(new Exception("surchargé (503)")) && !IaGratuite.offline(new Exception("quota gratuit momentanément atteint")), "un refus de Gemini n'est pas pris pour une panne de réseau");
        srv.stop(0);
        System.out.println(fails == 0 ? "TOUT PASSE" : fails + " ÉCHEC(S)");
        System.exit(fails == 0 ? 0 : 1);
    }
}
