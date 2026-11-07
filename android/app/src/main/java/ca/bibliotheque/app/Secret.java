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

    private static Context ctx;

    private static SecretKey key() throws Exception {
        if (android.os.Build.VERSION.SDK_INT < 23) return keyOld();
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return g.generateKey();
    }

    /**
     * Android 5 (Fire TV de base) : le coffre n'y garde pas de clé AES. Il garde une paire RSA ; une clé AES tirée au hasard est
     * enregistrée chiffrée par cette paire (illisible hors de l'appareil), puis sert au même chiffrement AES-GCM.
     */
    @SuppressWarnings("deprecation")
    private static SecretKey keyOld() throws Exception {
        final String RSA = "bibliotheque-rsa";
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (!ks.containsAlias(RSA)) {
            java.util.Calendar a = java.util.Calendar.getInstance(), b = java.util.Calendar.getInstance(); b.add(java.util.Calendar.YEAR, 30);
            java.security.KeyPairGenerator g = java.security.KeyPairGenerator.getInstance("RSA", "AndroidKeyStore");
            g.initialize(new android.security.KeyPairGeneratorSpec.Builder(ctx).setAlias(RSA).setSubject(new javax.security.auth.x500.X500Principal("CN=" + RSA))
                .setSerialNumber(java.math.BigInteger.ONE).setStartDate(a.getTime()).setEndDate(b.getTime()).build());
            g.generateKeyPair();
        }
        KeyStore.PrivateKeyEntry e = (KeyStore.PrivateKeyEntry) ks.getEntry(RSA, null);
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String w = sp.getString("_aes", "");
        if (w.isEmpty()) {
            byte[] raw = new byte[32]; new java.security.SecureRandom().nextBytes(raw);
            Cipher rc = Cipher.getInstance("RSA/ECB/PKCS1Padding"); rc.init(Cipher.ENCRYPT_MODE, e.getCertificate().getPublicKey());
            w = Base64.encodeToString(rc.doFinal(raw), Base64.NO_WRAP);
            sp.edit().putString("_aes", w).commit();
            return new javax.crypto.spec.SecretKeySpec(raw, "AES");
        }
        Cipher rc = Cipher.getInstance("RSA/ECB/PKCS1Padding"); rc.init(Cipher.DECRYPT_MODE, e.getPrivateKey());
        return new javax.crypto.spec.SecretKeySpec(rc.doFinal(Base64.decode(w, Base64.NO_WRAP)), "AES");
    }

    /** Chiffre et garde ; faux si le coffre du téléphone ne répond pas : alors rien n'est écrit (jamais de clé en clair) */
    static synchronized boolean put(Context c, String name, String value) {
        ctx = c.getApplicationContext();
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (value == null || value.isEmpty()) { sp.edit().remove(name).apply(); return true; }
        try {
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding"); ci.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = ci.getIV(), ct = ci.doFinal(value.getBytes("UTF-8"));
            sp.edit().putString(name, Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP)).commit();
            return true;
        } catch (Exception e) { Crashes.note(c, "clé « " + name + " » non enregistrée : coffre de clés du téléphone indisponible (" + e.getClass().getSimpleName() + ")"); return false; }
    }

    static synchronized String get(Context c, String name) {
        ctx = c.getApplicationContext();
        String v = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(name, "");
        if (v.isEmpty()) return "";
        if (v.startsWith("plain:")) { // ancienne version : clé gardée en clair ; on la chiffre maintenant (en clair seulement si le coffre est encore absent)
            String plain = v.substring(6);
            put(c, name, plain);
            return plain;
        }
        try {
            int i = v.indexOf(':');
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
            ci.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(v.substring(0, i), Base64.NO_WRAP)));
            return new String(ci.doFinal(Base64.decode(v.substring(i + 1), Base64.NO_WRAP)), "UTF-8");
        } catch (Exception e) { return ""; } // restauré sur un autre téléphone : illisible, il faudra recoller la clé
    }
}
