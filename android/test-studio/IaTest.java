package ca.bibliotheque.app;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.*;

/**
 * Essai de l'IA gratuite avec un faux serveur Google : jamais Gemini Pro ; un quota du jour épuisé fait passer au modèle
 * Flash suivant ; le modèle qui a répondu est retenu (même après redémarrage) et essayé en premier ; les modèles retirés
 * (404 partout) font lire la liste réelle des modèles de la clé.
 * Lancer : sh run.sh (le dossier stubs/ remplace org.json, Context et Secret sur ordinateur).
 */
public class IaTest {
    static int fails = 0;
    static void ok(boolean c, String m) { System.out.println((c ? "OK   " : "ECHEC ") + m); if (!c) fails++; }

    static void fresh() throws Exception { // comme une application qui redémarre : rien en mémoire vive
        for (String f : new String[]{"loaded", "listed"}) { java.lang.reflect.Field x = IaGratuite.class.getDeclaredField(f); x.setAccessible(true); x.set(null, false); }
        java.lang.reflect.Field m = IaGratuite.class.getDeclaredField("model"); m.setAccessible(true); m.set(null, 0);
        java.lang.reflect.Field l = IaGratuite.class.getDeclaredField("MODELS"); l.setAccessible(true);
        l.set(null, new String[]{"gemini-flash-latest", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"});
    }

    public static void main(String[] a) throws Exception {
        final Map<String, String> behave = new HashMap<>();
        final List<String> seen = new ArrayList<>();
        final String[] list = {""};
        HttpServer srv = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        srv.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath();
            ex.getRequestBody().readAllBytes();
            int code = 200; String out;
            if (path.endsWith("/v1beta/models")) { seen.add("LISTE"); out = list[0]; }
            else {
                String model = path.substring(path.lastIndexOf('/') + 1).replace(":generateContent", "");
                seen.add(model);
                String b = behave.getOrDefault(model, "ok");
                out = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Réponse de " + model + "\"}]}}]}";
                switch (b) {
                    case "day": code = 429; out = "{\"error\":{\"code\":429,\"message\":\"Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, model: " + model + "\",\"details\":[{\"violations\":[{\"quotaId\":\"GenerateRequestsPerDayPerProjectPerModel-FreeTier\"}]}]}}"; break;
                    case "minute": code = 429; out = "{\"error\":{\"code\":429,\"message\":\"Resource exhausted\",\"details\":[{\"retryDelay\":\"1s\"}]}}"; behave.put(model, "ok"); break;
                    case "404": code = 404; out = "{\"error\":{\"code\":404,\"message\":\"models/" + model + " is not found\"}}"; break;
                }
            }
            byte[] ob = out.getBytes("UTF-8"); ex.sendResponseHeaders(code, ob.length); ex.getResponseBody().write(ob); ex.close();
        });
        srv.start();
        IaGratuite.base = "http://127.0.0.1:" + srv.getAddress().getPort();
        IaGratuite.GAP = 0;
        android.content.Context c = new android.content.Context();

        // A : quota du jour épuisé pour gemini-flash-latest → gemini-3.8-flash répond ; aucun Pro demandé
        behave.put("gemini-flash-latest", "day");
        String r = IaGratuite.ask(c, "", "Résume");
        ok(r.equals("Réponse de gemini-3.8-flash"), "A : quota du jour épuisé → modèle suivant (" + seen + ")");
        ok(seen.stream().noneMatch(x -> x.contains("pro")), "A : aucun appel à Gemini Pro");
        ok("gemini-3.8-flash".equals(android.content.Context.PREFS.get("ia/flash")), "A : le modèle qui a répondu est retenu");

        // B : demande suivante → directement le modèle retenu, un seul appel
        seen.clear();
        IaGratuite.ask(c, "", "Encore");
        ok(seen.equals(Collections.singletonList("gemini-3.8-flash")), "B : la demande suivante va droit au modèle qui marche (" + seen + ")");

        // C : l'application redémarre → le modèle retenu est essayé en premier
        fresh(); seen.clear();
        IaGratuite.ask(c, "", "Après redémarrage");
        ok(seen.equals(Collections.singletonList("gemini-3.8-flash")), "C : après redémarrage, toujours le modèle qui marche (" + seen + ")");

        // D : Google retire tous les modèles connus → la liste réelle de la clé est lue, le meilleur Flash répond
        android.content.Context.PREFS.clear(); fresh(); seen.clear(); behave.clear();
        for (String m : new String[]{"gemini-flash-latest", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-3.5-flash-lite"}) behave.put(m, "404");
        list[0] = "{\"models\":[{\"name\":\"models/gemini-4.0-pro\",\"supportedGenerationMethods\":[\"generateContent\"]},{\"name\":\"models/gemini-4.0-flash\",\"supportedGenerationMethods\":[\"generateContent\"]},{\"name\":\"models/gemini-4.0-flash-tts\",\"supportedGenerationMethods\":[\"generateContent\"]}]}";
        r = IaGratuite.ask(c, "", "Résume");
        ok(r.equals("Réponse de gemini-4.0-flash") && seen.contains("LISTE") && !seen.contains("gemini-4.0-pro"), "D : modèles retirés → liste de Google lue, Flash choisi, pas Pro (" + seen + ")");
        ok("gemini-4.0-flash".equals(android.content.Context.PREFS.get("ia/flash")) && String.valueOf(android.content.Context.PREFS.get("ia/models")).startsWith("gemini-4.0-flash"), "D : liste et modèle retenus pour la prochaine fois");

        // E : limite par minute (pas par jour) → on attend et on réessaie le même modèle
        android.content.Context.PREFS.clear(); fresh(); seen.clear(); behave.clear();
        behave.put("gemini-flash-latest", "minute");
        r = IaGratuite.ask(c, "", "Résume");
        ok(r.equals("Réponse de gemini-flash-latest") && seen.equals(Arrays.asList("gemini-flash-latest", "gemini-flash-latest")), "E : limite par minute → même modèle, après une courte attente (" + seen + ")");

        srv.stop(0);
        if (fails > 0) { System.out.println(fails + " échec(s)"); System.exit(1); }
        System.out.println("Tous les essais passent");
    }
}
