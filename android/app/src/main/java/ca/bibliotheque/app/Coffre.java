package ca.bibliotheque.app;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Envoi sécurisé de livres d'un téléphone à un autre (même dans une autre ville) :
 * chiffrement de bout en bout AES-256 (mode CTR) + signature HMAC-SHA256 (« chiffrer puis signer »).
 * La clé (32 octets au hasard) ne voyage que dans le lien envoyé à la personne ; le service d'hébergement
 * ne reçoit qu'un bloc illisible, et toute modification du fichier est détectée avant le déchiffrement.
 * Format : "BIBX" + version (1 octet) + IV (16) + texte chiffré + étiquette HMAC (32).
 */
final class Coffre {
    private static final byte[] MAGIC = {'B', 'I', 'B', 'X', 1};

    private Coffre() { }

    static byte[] newKey() { byte[] k = new byte[32]; new SecureRandom().nextBytes(k); return k; }

    private static byte[] derive(byte[] k, String what) throws Exception {
        Mac m = Mac.getInstance("HmacSHA256"); m.init(new SecretKeySpec(k, "HmacSHA256"));
        return m.doFinal(what.getBytes("UTF-8"));
    }

    static void encrypt(File in, File out, byte[] key) throws Exception {
        byte[] iv = new byte[16]; new SecureRandom().nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/CTR/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(derive(key, "chiffrement"), "AES"), new IvParameterSpec(iv));
        Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(derive(key, "signature"), "HmacSHA256"));
        try (InputStream is = new BufferedInputStream(new FileInputStream(in), 1 << 16); OutputStream os = new BufferedOutputStream(new FileOutputStream(out), 1 << 16)) {
            os.write(MAGIC); os.write(iv); mac.update(MAGIC); mac.update(iv);
            byte[] buf = new byte[1 << 16]; int n;
            while ((n = is.read(buf)) > 0) { byte[] e = c.update(buf, 0, n); if (e != null) { os.write(e); mac.update(e); } }
            byte[] e = c.doFinal(); if (e != null && e.length > 0) { os.write(e); mac.update(e); }
            os.write(mac.doFinal());
        }
    }

    /** Vérifie la signature PUIS déchiffre ; refuse un fichier abîmé ou modifié. */
    static void decrypt(File in, File out, byte[] key) throws Exception {
        long len = in.length();
        if (len < MAGIC.length + 16 + 32) throw new IOException("Fichier incomplet");
        byte[] head = new byte[MAGIC.length + 16], tag = new byte[32];
        try (java.io.RandomAccessFile r = new java.io.RandomAccessFile(in, "r")) { r.readFully(head); r.seek(len - 32); r.readFully(tag); }
        for (int i = 0; i < MAGIC.length; i++) if (head[i] != MAGIC[i]) throw new IOException("Ce n'est pas un envoi de la Bibliothèque");
        Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(derive(key, "signature"), "HmacSHA256"));
        long body = len - head.length - 32;
        byte[] buf = new byte[1 << 16];
        try (InputStream is = new BufferedInputStream(new FileInputStream(in), 1 << 16)) {
            mac.update(readN(is, head.length));
            long left = body; int n;
            while (left > 0 && (n = is.read(buf, 0, (int) Math.min(buf.length, left))) > 0) { mac.update(buf, 0, n); left -= n; }
        }
        if (!MessageDigest.isEqual(mac.doFinal(), tag)) throw new IOException("Le lien est incomplet ou le fichier a été modifié");
        byte[] iv = java.util.Arrays.copyOfRange(head, MAGIC.length, head.length);
        Cipher c = Cipher.getInstance("AES/CTR/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(derive(key, "chiffrement"), "AES"), new IvParameterSpec(iv));
        try (InputStream is = new BufferedInputStream(new FileInputStream(in), 1 << 16); OutputStream os = new BufferedOutputStream(new FileOutputStream(out), 1 << 16)) {
            readN(is, head.length);
            long left = body; int n;
            while (left > 0 && (n = is.read(buf, 0, (int) Math.min(buf.length, left))) > 0) { byte[] d = c.update(buf, 0, n); if (d != null) os.write(d); left -= n; }
            byte[] d = c.doFinal(); if (d != null) os.write(d);
        }
    }

    private static byte[] readN(InputStream is, int n) throws IOException {
        byte[] b = new byte[n]; int o = 0;
        while (o < n) { int r = is.read(b, o, n - o); if (r < 0) throw new IOException("Fichier incomplet"); o += r; }
        return b;
    }
}
