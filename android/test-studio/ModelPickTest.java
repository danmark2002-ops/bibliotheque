package ca.bibliotheque.app;

/** Choix des modèles quand Google en a retiré : javac ModelPick.java ModelPickTest.java */
public class ModelPickTest {
    static int fails = 0;
    static void ok(boolean c, String m) { System.out.println((c ? "OK   " : "ECHEC ") + m); if (!c) fails++; }
    static String mdl(String n, String... meth) { StringBuilder b = new StringBuilder("{\"name\": \"models/" + n + "\", \"supportedGenerationMethods\": ["); for (int i = 0; i < meth.length; i++) b.append(i > 0 ? "," : "").append('"').append(meth[i]).append('"'); return b.append("]}").toString(); }
    public static void main(String[] a) {
        String list = "{\"models\": [" + String.join(",",
            mdl("embedding-001", "embedContent"),
            mdl("gemini-3.5-flash-lite", "generateContent", "countTokens"),
            mdl("gemini-3.8-flash", "generateContent", "countTokens"),
            mdl("gemini-3.8-flash-tts", "generateContent"),
            mdl("gemini-3.1-pro-preview", "generateContent"),
            mdl("gemini-3.6-flash", "generateContent"),
            mdl("gemini-3.8-flash-image", "generateContent"),
            mdl("gemini-flash-latest", "generateContent"),
            mdl("gemini-3.9-flash-preview-11-2026", "generateContent"),
            mdl("gemini-pro-latest", "generateContent"),
            mdl("gemini-3.8-flash-live", "bidiGenerateContent")) + "], \"nextPageToken\": \"x\"}";
        String[] f = ModelPick.pick(list, "flash");
        System.out.println("flash : " + String.join(", ", f));
        ok(f.length > 0 && f[0].equals("gemini-flash-latest"), "l'alias « latest » d'abord");
        ok(java.util.Arrays.asList(f).indexOf("gemini-3.8-flash") < java.util.Arrays.asList(f).indexOf("gemini-3.6-flash"), "la version la plus récente avant l'ancienne");
        ok(f[f.length - 1].equals("gemini-3.5-flash-lite"), "le « lite » en dernier");
        ok(!String.join(",", f).matches(".*(tts|image|live|pro|embedding).*"), "ni voix, ni image, ni direct, ni Pro, ni embeddings");
        String[] p = ModelPick.pick(list, "pro");
        System.out.println("pro : " + String.join(", ", p));
        ok(p.length == 2 && p[0].equals("gemini-pro-latest"), "Pro : l'alias puis la préversion");
        ok(ModelPick.pick("{}", "flash").length == 0 && ModelPick.pick("pas du json", "flash").length == 0, "liste vide ou illisible : rien, sans erreur");
        if (fails > 0) { System.out.println(fails + " échec(s)"); System.exit(1); }
        System.out.println("Tous les essais passent");
    }
}
