package ca.bibliotheque.app;
import android.content.Context;
/** Essais : la clé est toujours « K » */
final class Secret { static String get(Context c, String n) { return "K"; } static boolean put(Context c, String n, String v) { return true; } }
