package ca.publieur.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Coffre de la clé d'accès Google (compte de service, droits d'administrateur sur la Play Console).
 * La clé est chiffrée (AES-GCM) avec une clé du coffre matériel d'Android (Android Keystore) qui ne quitte jamais le téléphone :
 * si le coffre est indisponible, rien n'est enregistré (on ne garde jamais cette clé en clair).
 */
final class Secret {
    private static final String ALIAS = "publieur-secrets", PREFS = "secrets";

    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return g.generateKey();
    }

    /** Vrai si la valeur est bien enregistrée (chiffrée) ; une valeur vide efface l'entrée. */
    static synchronized boolean put(Context c, String name, String value) {
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (value == null || value.isEmpty()) { sp.edit().remove(name).apply(); return true; }
        try {
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding"); ci.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = ci.getIV(), ct = ci.doFinal(value.getBytes("UTF-8"));
            return sp.edit().putString(name, Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP)).commit();
        } catch (Exception e) { return false; }
    }

    /** La valeur déchiffrée, ou une chaîne vide si absente ou illisible (par exemple restaurée sur un autre téléphone). */
    static synchronized String get(Context c, String name) {
        String v = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(name, "");
        if (v == null || v.isEmpty()) return "";
        try {
            int i = v.indexOf(':');
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
            ci.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(v.substring(0, i), Base64.NO_WRAP)));
            return new String(ci.doFinal(Base64.decode(v.substring(i + 1), Base64.NO_WRAP)), "UTF-8");
        } catch (Exception e) { return ""; }
    }
}
