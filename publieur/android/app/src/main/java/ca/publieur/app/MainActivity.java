package ca.publieur.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Iterator;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Publieur — publie une application sur Google Play presque tout seul.
 * L'interface (assets/) est servie à https://appassets.local/ ; le pont « Pub » fait ce qu'un navigateur ne peut pas :
 * lire les fichiers .apk/.aab, signer la connexion Google (compte de service) et téléverser de gros fichiers.
 * Chaque appel asynchrone répond par window.__nat(id, json).
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.local";
    private static final int PICK = 7001;

    private WebView web;
    private String pickId;
    private final ExecutorService pool = Executors.newFixedThreadPool(3);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0f1412"));
        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        web.addJavascriptInterface(new Pub(), "Pub");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if ("/__f".equals(path)) return localFile(u.getQueryParameter("p"));
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    return new WebResourceResponse(mime(path), "UTF-8", in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Introuvable", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openUrl(u.toString());
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.loadUrl("https://" + HOST + "/index.html");
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    /** Fichier reçu par « Ouvrir avec » ou « Partager » : copié puis remis à l'interface. */
    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(intent.getAction())) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri == null) return;
        final Uri src = uri;
        pool.execute(() -> {
            try {
                JSONObject f = copyIn(src);
                JSONArray arr = new JSONArray().put(f);
                // l'interface peut ne pas être prête : on réessaie quelques fois
                final java.util.concurrent.atomic.AtomicBoolean done = new java.util.concurrent.atomic.AtomicBoolean(false);
                for (int i = 0; i < 20 && !done.get(); i++) {
                    runOnUiThread(() -> { if (!done.get()) web.evaluateJavascript("window.__incoming ? (window.__incoming(" + JSONObject.quote(arr.toString()) + "), 1) : 0", (r) -> { if ("1".equals(r)) done.set(true); }); });
                    Thread.sleep(700);
                }
            } catch (Exception ignored) { }
        });
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.__back ? window.__back() : false", (r) -> { if (!"true".equals(r)) MainActivity.super.onBackPressed(); });
    }

    // ---------- Utilitaires ----------
    private void reply(String id, JSONObject o) {
        if (id == null) return;
        final String js = "window.__nat(" + JSONObject.quote(id) + "," + JSONObject.quote(o.toString()) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    private void fail(String id, Throwable e) {
        try { reply(id, new JSONObject().put("error", e.getMessage() == null ? e.toString() : e.getMessage())); } catch (Exception ignored) { }
    }

    private static String mime(String p) {
        p = p.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private File work() { File d = new File(getCacheDir(), "fichiers"); d.mkdirs(); return d; }

    /** Seuls les fichiers du dossier de travail peuvent être lus par l'interface. */
    private File safe(String p) throws IOException {
        File f = new File(p).getCanonicalFile();
        if (!f.getPath().startsWith(work().getCanonicalPath())) throw new IOException("Fichier hors du dossier de travail");
        return f;
    }

    private WebResourceResponse localFile(String p) {
        try {
            File f = safe(p);
            return new WebResourceResponse(mime(f.getName()), null, new FileInputStream(f));
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Introuvable", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private JSONObject copyIn(Uri uri) throws Exception {
        String name = "fichier";
        long size = -1;
        try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int n = c.getColumnIndex(OpenableColumns.DISPLAY_NAME), z = c.getColumnIndex(OpenableColumns.SIZE);
                if (n >= 0 && c.getString(n) != null) name = c.getString(n);
                if (z >= 0) size = c.getLong(z);
            }
        } catch (Exception ignored) { }
        if ("fichier".equals(name) && uri.getLastPathSegment() != null) name = uri.getLastPathSegment();
        name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        File dir = new File(work(), UUID.randomUUID().toString().substring(0, 8)); dir.mkdirs();
        File out = new File(dir, name);
        try (InputStream in = getContentResolver().openInputStream(uri); OutputStream os = new FileOutputStream(out)) {
            byte[] buf = new byte[65536]; int r;
            while ((r = in.read(buf)) > 0) os.write(buf, 0, r);
        }
        return new JSONObject().put("path", out.getPath()).put("name", name).put("size", out.length() > 0 ? out.length() : size)
            .put("url", "https://" + HOST + "/__f?p=" + URLEncoder.encode(out.getPath(), "UTF-8"));
    }

    private void openUrl(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (ActivityNotFoundException ignored) { }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int r;
        while ((r = in.read(buf)) > 0) bo.write(buf, 0, r);
        return bo.toByteArray();
    }

    private static String b64url(byte[] b) { return Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING); }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != PICK) return;
        final String id = pickId; pickId = null;
        if (res != RESULT_OK || data == null) { try { reply(id, new JSONObject().put("files", new JSONArray())); } catch (Exception ignored) { } return; }
        pool.execute(() -> {
            try {
                JSONArray arr = new JSONArray();
                if (data.getClipData() != null) for (int i = 0; i < data.getClipData().getItemCount(); i++) arr.put(copyIn(data.getClipData().getItemAt(i).getUri()));
                else if (data.getData() != null) arr.put(copyIn(data.getData()));
                reply(id, new JSONObject().put("files", arr));
            } catch (Exception e) { fail(id, e); }
        });
    }

    // ---------- Pont JavaScript ----------
    class Pub {
        @JavascriptInterface public boolean ok() { return true; }

        /** kind : app (.aab/.apk), json (clé), images (captures d'écran, plusieurs) */
        @JavascriptInterface public void pick(String kind, String id) {
            runOnUiThread(() -> {
                pickId = id;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                if ("images".equals(kind)) { i.setType("image/*"); i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true); }
                else if ("json".equals(kind)) { i.setType("*/*"); i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"}); }
                else { i.setType("*/*"); }
                try { startActivityForResult(i, PICK); } catch (ActivityNotFoundException e) { fail(id, e); pickId = null; }
            });
        }

        @JavascriptInterface public String readText(String path) {
            try (InputStream in = new FileInputStream(safe(path))) { return new String(readAll(in), StandardCharsets.UTF_8); } catch (Exception e) { return null; }
        }

        /** Enregistre un fichier produit par l'interface (image générée, etc.) dans le dossier de travail. */
        @JavascriptInterface public String writeTemp(String name, String b64) {
            try {
                File dir = new File(work(), "gen"); dir.mkdirs();
                File f = new File(dir, name.replaceAll("[\\\\/:*?\"<>|]", "_"));
                try (OutputStream os = new FileOutputStream(f)) { os.write(Base64.decode(b64, Base64.DEFAULT)); }
                return f.getPath();
            } catch (Exception e) { return null; }
        }

        @JavascriptInterface public String zipList(String path) {
            JSONArray arr = new JSONArray();
            try (ZipFile z = new ZipFile(safe(path))) {
                Enumeration<? extends ZipEntry> en = z.entries();
                while (en.hasMoreElements()) { ZipEntry e = en.nextElement(); arr.put(e.getName() + "|" + e.getSize()); }
            } catch (Exception e) { return null; }
            return arr.toString();
        }

        @JavascriptInterface public String zipRead(String path, String entry) {
            try (ZipFile z = new ZipFile(safe(path))) {
                ZipEntry e = z.getEntry(entry); if (e == null || e.getSize() > 8_000_000) return null;
                try (InputStream in = z.getInputStream(e)) { return Base64.encodeToString(readAll(in), Base64.NO_WRAP); }
            } catch (Exception e) { return null; }
        }

        /** Analyse d'un .apk par Android lui-même : nom, version, SDK, permissions, icône, signature. */
        @JavascriptInterface public String apkInfo(String path) {
            try {
                File f = safe(path);
                PackageManager pm = getPackageManager();
                int flags = PackageManager.GET_PERMISSIONS | PackageManager.GET_META_DATA;
                flags |= Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
                PackageInfo pi = pm.getPackageArchiveInfo(f.getPath(), flags);
                if (pi == null) return null;
                pi.applicationInfo.sourceDir = f.getPath();
                pi.applicationInfo.publicSourceDir = f.getPath();
                JSONObject o = new JSONObject();
                o.put("package", pi.packageName);
                o.put("versionCode", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
                o.put("versionName", pi.versionName);
                o.put("targetSdk", pi.applicationInfo.targetSdkVersion);
                if (Build.VERSION.SDK_INT >= 24) o.put("minSdk", pi.applicationInfo.minSdkVersion);
                o.put("label", String.valueOf(pi.applicationInfo.loadLabel(pm)));
                JSONArray perms = new JSONArray();
                if (pi.requestedPermissions != null) for (String p : pi.requestedPermissions) perms.put(p);
                o.put("permissions", perms);
                try {
                    Drawable d = pi.applicationInfo.loadIcon(pm);
                    Bitmap bmp = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888);
                    Canvas c = new Canvas(bmp); d.setBounds(0, 0, 512, 512); d.draw(c);
                    ByteArrayOutputStream bo = new ByteArrayOutputStream(); bmp.compress(Bitmap.CompressFormat.PNG, 100, bo);
                    o.put("icon", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
                } catch (Exception ignored) { }
                try {
                    Signature[] sigs = null;
                    if (Build.VERSION.SDK_INT >= 28 && pi.signingInfo != null) sigs = pi.signingInfo.getApkContentsSigners();
                    else sigs = pi.signatures;
                    if (sigs != null && sigs.length > 0) {
                        X509Certificate cert = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(sigs[0].toByteArray()));
                        o.put("signer", cert.getSubjectX500Principal().getName());
                        byte[] sha = MessageDigest.getInstance("SHA-256").digest(sigs[0].toByteArray());
                        StringBuilder sb = new StringBuilder(); for (byte b : sha) sb.append(String.format("%02X:", b));
                        o.put("sha256", sb.substring(0, sb.length() - 1));
                    }
                } catch (Exception ignored) { }
                return o.toString();
            } catch (Exception e) { return null; }
        }

        /** Jeton d'accès Google à partir de la clé du compte de service (JWT signé RS256). */
        @JavascriptInterface public void token(String keyJson, String id) {
            pool.execute(() -> {
                try {
                    JSONObject k = new JSONObject(keyJson);
                    String email = k.getString("client_email");
                    String pem = k.getString("private_key").replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
                    String tokenUri = k.optString("token_uri", "https://oauth2.googleapis.com/token");
                    long now = System.currentTimeMillis() / 1000;
                    String head = b64url("{\"alg\":\"RS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
                    JSONObject claims = new JSONObject().put("iss", email).put("scope", "https://www.googleapis.com/auth/androidpublisher")
                        .put("aud", tokenUri).put("iat", now).put("exp", now + 3600);
                    String body = b64url(claims.toString().getBytes(StandardCharsets.UTF_8));
                    PrivateKey pk = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.decode(pem, Base64.DEFAULT)));
                    java.security.Signature sg = java.security.Signature.getInstance("SHA256withRSA");
                    sg.initSign(pk); sg.update((head + "." + body).getBytes(StandardCharsets.UTF_8));
                    String jwt = head + "." + body + "." + b64url(sg.sign());
                    String form = "grant_type=" + URLEncoder.encode("urn:ietf:params:oauth:grant-type:jwt-bearer", "UTF-8") + "&assertion=" + jwt;
                    JSONObject r = send("POST", tokenUri, new JSONObject().put("Content-Type", "application/x-www-form-urlencoded"), form, null, null);
                    reply(id, r);
                } catch (Exception e) { fail(id, e); }
            });
        }

        /** Requête HTTP. body : texte (JSON…) ; ou filePath : envoi d'un fichier en flux (gros .aab), avec progression. */
        @JavascriptInterface public void http(String method, String url, String headers, String body, String filePath, String id) {
            pool.execute(() -> {
                try { reply(id, send(method, url, headers == null ? new JSONObject() : new JSONObject(headers), body, filePath, id)); }
                catch (Exception e) { fail(id, e); }
            });
        }

        @JavascriptInterface public void open(String url) { runOnUiThread(() -> openUrl(url)); }

        @JavascriptInterface public void copy(String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Publieur", text));
            });
        }

        /** Copie un fichier (le .aab) dans Téléchargements/Publieur, pour le premier envoi fait à la main dans la Play Console. */
        @JavascriptInterface public boolean copyToDownloads(String src, String name, String mimeType) {
            try (InputStream in = new FileInputStream(src)) {
                OutputStream os;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Publieur");
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (u == null) return false;
                    os = getContentResolver().openOutputStream(u);
                } else {
                    File d = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Publieur"); d.mkdirs();
                    os = new FileOutputStream(new File(d, name));
                }
                try (OutputStream o = os) { byte[] buf = new byte[65536]; int n; while ((n = in.read(buf)) > 0) o.write(buf, 0, n); }
                return true;
            } catch (Exception e) { return false; }
        }

        /** Enregistre un fichier dans Téléchargements (politique de confidentialité, sauvegarde…). */
        @JavascriptInterface public boolean saveDownload(String name, String mimeType, String b64) {
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Publieur");
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (u == null) return false;
                    try (OutputStream os = getContentResolver().openOutputStream(u)) { os.write(data); }
                    return true;
                }
                File d = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Publieur"); d.mkdirs();
                try (OutputStream os = new FileOutputStream(new File(d, name))) { os.write(data); }
                return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface public void share(String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND); i.setType("text/plain"); i.putExtra(Intent.EXTRA_TEXT, text);
                try { startActivity(Intent.createChooser(i, "Partager")); } catch (Exception ignored) { }
            });
        }
    }

    private JSONObject send(String method, String url, JSONObject headers, String body, String filePath, String progressId) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(30000);
        c.setReadTimeout(300000);
        Iterator<String> it = headers.keys();
        while (it.hasNext()) { String k = it.next(); c.setRequestProperty(k, headers.getString(k)); }
        if (filePath != null && !filePath.isEmpty()) {
            File f = safe(filePath);
            long total = f.length(), sent = 0, lastTick = 0;
            c.setDoOutput(true);
            c.setFixedLengthStreamingMode(total);
            try (InputStream in = new FileInputStream(f); OutputStream os = c.getOutputStream()) {
                byte[] buf = new byte[262144]; int r;
                while ((r = in.read(buf)) > 0) {
                    os.write(buf, 0, r); sent += r;
                    long now = System.currentTimeMillis();
                    if (progressId != null && now - lastTick > 300) {
                        lastTick = now;
                        final String js = "window.__prog && window.__prog(" + JSONObject.quote(progressId) + "," + sent + "," + total + ")";
                        runOnUiThread(() -> web.evaluateJavascript(js, null));
                    }
                }
            }
        } else if (body != null) {
            byte[] b = body.getBytes(StandardCharsets.UTF_8);
            c.setDoOutput(true);
            c.setFixedLengthStreamingMode(b.length);
            try (OutputStream os = c.getOutputStream()) { os.write(b); }
        }
        int code = c.getResponseCode();
        InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
        String text = in == null ? "" : new String(readAll(in), StandardCharsets.UTF_8);
        c.disconnect();
        JSONObject r = new JSONObject().put("status", code).put("body", text);
        try { r.put("json", text.trim().startsWith("{") ? new JSONObject(text) : JSONObject.NULL); } catch (Exception ignored) { }
        return r;
    }
}
