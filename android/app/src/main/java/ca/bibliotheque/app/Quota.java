package ca.bibliotheque.app;

/** Lecture des refus « trop de demandes » (429) de Google. Sans dépendance à Android. */
final class Quota {
    private Quota() { }

    /** Pourquoi Google dit « trop de demandes » : « day » (quota du jour épuisé, ou absent du palier gratuit : limit 0),
     *  « big » (le texte dépasse à lui seul ce qui est permis par minute : attendre ne sert à rien), sinon « minute ». */
    static String why(String b) {
        if (b.matches("(?s).*limit\\D{0,6}0\\b(?![.\\d]).*") || b.contains("PerDay")) return "day";
        if (b.contains("input_token") || b.contains("InputTokens")) return "big";
        return "minute";
    }

    /** Délai proposé par Google (« retryDelay »: « 37s »), sinon 10 s */
    static long retryMs(String b) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("retryDelay\\W+(\\d+)").matcher(b);
        return m.find() ? (Long.parseLong(m.group(1)) + 1) * 1000L : 10_000L;
    }
}
