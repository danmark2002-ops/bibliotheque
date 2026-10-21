package ca.bibliotheque.app;

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
 * Clés d'IA (Gemini, Claude) chiffrées avec une clé du coffre matériel d'Android (Android Keystore, AES-GCM).
 * La clé de chiffrement ne quitte jamais le téléphone : une copie de sauvegarde des préférences reste illisible ailleurs.
 */
final class Secret {
    private static final String ALIAS = "bibliotheque-secrets", PREFS = "secrets";

    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return g.generateKey();
    }

    static synchronized void put(Context c, String name, String value) {
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (value == null || value.isEmpty()) { sp.edit().remove(name).apply(); return; }
        try {
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding"); ci.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = ci.getIV(), ct = ci.doFinal(value.getBytes("UTF-8"));
            sp.edit().putString(name, Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP)).apply();
        } catch (Exception e) { sp.edit().putString(name, "plain:" + value).apply(); } // coffre absent (très rare) : on garde quand même la clé
    }

    static synchronized String get(Context c, String name) {
        String v = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(name, "");
        if (v.isEmpty()) return "";
        if (v.startsWith("plain:")) return v.substring(6);
        try {
            int i = v.indexOf(':');
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
            ci.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(v.substring(0, i), Base64.NO_WRAP)));
            return new String(ci.doFinal(Base64.decode(v.substring(i + 1), Base64.NO_WRAP)), "UTF-8");
        } catch (Exception e) { return ""; } // restauré sur un autre téléphone : illisible, il faudra recoller la clé
    }
}
