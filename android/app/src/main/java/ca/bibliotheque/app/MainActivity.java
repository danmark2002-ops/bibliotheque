package ca.bibliotheque.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Bibliothèque — version locale, sans serveur.
 * L'interface (assets/index.html) est servie depuis l'application à l'adresse https://appassets.local/,
 * ce qui donne au navigateur intégré un stockage permanent (IndexedDB) pour les livres.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.local";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int FILE_REQUEST = 4242;
    private static final int FOLDER_REQUEST = 4243;
    private static final int LISTEN_REQUEST = 4244;
    private static final String FOLDER_PATH = "/__dossier";
    private static final String RECU_PATH = "/__recu";
    private static final String WEB_PATH = "/__web";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    static volatile MainActivity instance;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private final List<String[]> pending = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        instance = this;
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#140f0b"));
        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        edgeToEdge(root);
        // Android 13+ (obligatoire avec Android 16) : le geste « retour » passe par ce rappel, plus par onBackPressed()
        if (Build.VERSION.SDK_INT >= 33)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setUserAgentString(s.getUserAgentString() + " BibliothequeApp/2.0");

        web.addJavascriptInterface(new TtsBridge(), "AndroidTTS");
        web.addJavascriptInterface(new PdfBridge(), "AndroidPdf");
        web.addJavascriptInterface(new FolderBridge(), "AndroidFolder");
        web.addJavascriptInterface(new OpenBridge(), "AndroidOpen");
        web.addJavascriptInterface(new AiBridge(), "AndroidAI");
        web.addJavascriptInterface(new AutoBridge(), "AndroidAuto");
        web.addJavascriptInterface(new CastBridge(), "AndroidCast");
        web.addJavascriptInterface(new VideoBridge(), "AndroidVideo");
        web.addJavascriptInterface(new TeleBridge(), "AndroidTele");
        web.addJavascriptInterface(new ShareBridge(), "AndroidShare");
        web.addJavascriptInterface(new WebBridge(), "AndroidWeb");
        web.addJavascriptInterface(new OcrBridge(), "AndroidOcr");
        premium = new Premium(this, j -> js("__premium", j));
        web.addJavascriptInterface(new BillingBridge(), "AndroidBilling");
        premium.start();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null; // polices Google, etc. : réseau normal
                String path = u.getPath();
                if (FOLDER_PATH.equals(path)) return folderFile(u.getQueryParameter("lib"), u.getQueryParameter("id"));
                if ("/__pdfpage".equals(path)) return pdfPage(u);
                if (RECU_PATH.equals(path)) return recuFile(u.getQueryParameter("f"));
                if (WEB_PATH.equals(path)) return privateFile(webDir(), u.getQueryParameter("f"));
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    return new WebResourceResponse(mime(path), "UTF-8", in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Introuvable", new java.util.HashMap<>(), new java.io.ByteArrayInputStream(new byte[0]));
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                    "application/pdf",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "text/plain", "text/markdown", "text/html", "application/xhtml+xml", "application/epub+zip",
                    "application/x-mobipocket-ebook", "application/vnd.amazon.ebook", "application/msword", "application/rtf", "text/rtf",
                    "application/vnd.oasis.opendocument.text", "application/x-fictionbook+xml", "audio/*", "application/octet-stream"});
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(i, FILE_REQUEST);
                } catch (ActivityNotFoundException e) {
                    // téléviseurs : souvent pas de sélecteur de documents, mais un gestionnaire de fichiers peut répondre
                    Intent g = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    try { startActivityForResult(g, FILE_REQUEST); }
                    catch (ActivityNotFoundException e2) { fileCallback = null; js("__noPicker", ""); return false; }
                }
                return true;
            }
        });

        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS) return;
            int r = tts.setLanguage(Locale.CANADA_FRENCH);
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.FRENCH);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { notifyDone(id); }
                @Override public void onError(String id) { notifyDone(id); }
                @Override public void onStop(String id, boolean interrupted) { }
            });
            ttsReady = true;
            synchronized (pending) {
                for (String[] p : pending) speakNow(p[0], Float.parseFloat(p[1]), Float.parseFloat(p[3]), p[4], p[2]);
                pending.clear();
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else { web.loadUrl(START); handleIncoming(getIntent()); }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIncoming(intent);
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    private void notifyDone(String id) {
        runOnUiThread(() -> web.evaluateJavascript("window.__ttsDone && window.__ttsDone('" + id.replace("'", "") + "')", null));
    }

    private void speakNow(String text, float rate, String id) { speakNow(text, rate, 1f, "", id); }

    private void speakNow(String text, float rate, float pitch, String voice, String id) {
        try {
            android.speech.tts.Voice v = null;
            if (voice != null && !voice.isEmpty() && tts.getVoices() != null)
                for (android.speech.tts.Voice x : tts.getVoices()) if (voice.equals(x.getName())) { v = x; break; }
            if (v != null && !v.equals(tts.getVoice())) tts.setVoice(v);
            else if (v == null && (voice == null || voice.isEmpty()) && tts.getVoice() != null && !"fr".equals(tts.getVoice().getLocale().getLanguage())) tts.setLanguage(Locale.CANADA_FRENCH);
        } catch (Exception ignored) { }
        tts.setPitch(Math.max(0.5f, Math.min(2f, pitch)));
        tts.setSpeechRate(Math.max(0.3f, Math.min(3f, rate)));
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), id);
    }

    class TtsBridge {
        @JavascriptInterface
        public void speak(String text, float rate, String id) { speak2(text, rate, 1f, "", id); }

        /** Lecture avec voix et intonation choisies (le ton varie la hauteur et le débit phrase par phrase). */
        @JavascriptInterface
        public void speak2(String text, float rate, float pitch, String voice, String id) {
            LivreService.pauseFromApp();
            if (!ttsReady) { synchronized (pending) { pending.clear(); pending.add(new String[]{text, String.valueOf(rate), id, String.valueOf(pitch), voice == null ? "" : voice}); } return; }
            speakNow(text, rate, pitch, voice, id);
        }

        /** Voix françaises du téléphone : [{name, country, online, quality}] */
        @JavascriptInterface
        public String voices() {
            JSONArray a = new JSONArray();
            try {
                if (!ttsReady || tts.getVoices() == null) return "[]";
                java.util.List<android.speech.tts.Voice> vs = new ArrayList<>(tts.getVoices());
                vs.sort((x, y) -> x.getName().compareTo(y.getName()));
                for (android.speech.tts.Voice v : vs) {
                    if (v.getLocale() == null || !"fr".equals(v.getLocale().getLanguage())) continue;
                    if (v.getFeatures() != null && v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                    a.put(new JSONObject().put("name", v.getName()).put("country", v.getLocale().getCountry())
                        .put("online", v.isNetworkConnectionRequired()).put("quality", v.getQuality()));
                }
            } catch (Exception ignored) { }
            return a.toString();
        }

        /** Ouvre les réglages Android de synthèse vocale (pour installer d'autres voix). */
        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(() -> {
                try { startActivity(new Intent("com.android.settings.TTS_SETTINGS")); }
                catch (Exception e) { try { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); } catch (Exception ignored) { } }
            });
        }

        @JavascriptInterface
        public void stop() {
            synchronized (pending) { pending.clear(); }
            if (tts != null) tts.stop();
        }
    }

    // ---------- Dossier source : choisi une fois, rescanné sur demande ----------
    private SharedPreferences prefs() { return getSharedPreferences("dossier", MODE_PRIVATE); }

    private String pickingFor = null;

    /** Dossiers par bibliothèque : {"main": "content://...", "lib2": "..."} (l'ancien réglage unique devient « main »). */
    private JSONObject folders() {
        SharedPreferences p = prefs();
        JSONObject o;
        try { o = new JSONObject(p.getString("folders", "{}")); } catch (Exception e) { o = new JSONObject(); }
        String old = p.getString("tree", null);
        if (old != null) {
            try { if (!o.has("main")) o.put("main", old); } catch (Exception ignored) { }
            p.edit().putString("folders", o.toString()).remove("tree").apply();
        }
        return o;
    }

    private void saveFolders(JSONObject o) { prefs().edit().putString("folders", o.toString()).apply(); }

    // Ancien mode « Tout le téléphone » (retiré : Google Play refuse l'accès à tous les fichiers)
    private static final String PHONE = "phone:";

    // ---------- Pages PDF dessinées par le moteur d'Android (PDFium, celui de Chrome) ----------
    // Bien plus tolérant que pdf.js envers les polices abîmées des PDF : fin des pages blanches ou à moitié écrites.
    private final Object pdfLock = new Object();
    private String pdfKey;
    private android.graphics.pdf.PdfRenderer pdfR;
    private android.os.ParcelFileDescriptor pdfFd;

    private File pdfDir() { File d = new File(getFilesDir(), "pdf"); d.mkdirs(); return d; }
    private static String safeId(String id) { return id == null ? "" : id.replaceAll("[^\\w-]", "_"); }

    private void pdfClose() {
        try { if (pdfR != null) pdfR.close(); } catch (Exception ignored) { }
        try { if (pdfFd != null) pdfFd.close(); } catch (Exception ignored) { }
        pdfR = null; pdfFd = null; pdfKey = null;
    }

    private WebResourceResponse pdfError(int code, String msg) {
        return new WebResourceResponse("text/plain", "UTF-8", code, "Erreur", new java.util.HashMap<>(), new java.io.ByteArrayInputStream(String.valueOf(msg).getBytes()));
    }

    private WebResourceResponse pdfPage(Uri u) {
        String book = u.getQueryParameter("book"), lib = u.getQueryParameter("lib"), doc = u.getQueryParameter("doc");
        int n, w;
        try { n = Integer.parseInt(u.getQueryParameter("n")); w = Integer.parseInt(u.getQueryParameter("w")); } catch (Exception e) { return pdfError(400, "page"); }
        w = Math.max(200, Math.min(2400, w));
        synchronized (pdfLock) {
            try {
                String key = book != null ? "b:" + book : "d:" + lib + "|" + doc;
                if (!key.equals(pdfKey)) {
                    pdfClose();
                    android.os.ParcelFileDescriptor fd;
                    if (book != null) {
                        File f = new File(pdfDir(), safeId(book) + ".pdf");
                        if (!f.exists()) return pdfError(404, "absent");
                        fd = android.os.ParcelFileDescriptor.open(f, android.os.ParcelFileDescriptor.MODE_READ_ONLY);
                    } else {
                        Uri tree = folderTree(lib);
                        if (tree == null || doc == null) return pdfError(404, "dossier");
                        fd = getContentResolver().openFileDescriptor(DocumentsContract.buildDocumentUriUsingTree(tree, doc), "r");
                        if (fd == null) return pdfError(404, "dossier");
                    }
                    pdfFd = fd;
                    pdfR = new android.graphics.pdf.PdfRenderer(fd);
                    pdfKey = key;
                }
                if (n < 1 || n > pdfR.getPageCount()) return pdfError(404, "page");
                android.graphics.pdf.PdfRenderer.Page pg = pdfR.openPage(n - 1);
                try {
                    float ratio = pg.getHeight() / (float) Math.max(1, pg.getWidth());
                    // limite mémoire : une page ne dépasse pas ~6 millions de points
                    if ((long) w * (long) (w * ratio) > 6_000_000L) w = (int) Math.sqrt(6_000_000.0 / ratio);
                    int h = Math.max(1, Math.round(w * ratio));
                    android.graphics.Bitmap bm = android.graphics.Bitmap.createBitmap(w, h, android.graphics.Bitmap.Config.ARGB_8888);
                    bm.eraseColor(Color.WHITE);
                    pg.render(bm, null, null, android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(w * h / 4);
                    bm.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, bo);
                    bm.recycle();
                    java.util.Map<String, String> hd = new java.util.HashMap<>();
                    hd.put("Cache-Control", "no-store");
                    return new WebResourceResponse("image/jpeg", null, 200, "OK", hd, new java.io.ByteArrayInputStream(bo.toByteArray()));
                } finally { pg.close(); }
            } catch (Throwable e) {
                pdfClose(); // PDF protégé, abîmé ou illisible par Android : la page sera dessinée par l'autre moteur
                return pdfError(500, e.getClass().getSimpleName() + ": " + e.getMessage());
            }
        }
    }

    /** Copie d'un livre ajouté à la main, pour que le moteur d'Android puisse l'ouvrir. */
    class PdfBridge {
        private java.io.FileOutputStream out; private File tmp, dest;
        @JavascriptInterface public boolean has(String id) { return new File(pdfDir(), safeId(id) + ".pdf").exists(); }
        @JavascriptInterface public boolean begin(String id) {
            try { dest = new File(pdfDir(), safeId(id) + ".pdf"); tmp = new File(pdfDir(), safeId(id) + ".tmp"); out = new java.io.FileOutputStream(tmp); return true; }
            catch (Exception e) { return false; }
        }
        @JavascriptInterface public boolean append(String b64) {
            try { out.write(android.util.Base64.decode(b64, android.util.Base64.DEFAULT)); return true; } catch (Exception e) { return false; }
        }
        @JavascriptInterface public boolean finish() {
            try { out.close(); return tmp.renameTo(dest); } catch (Exception e) { return false; }
        }
        @JavascriptInterface public void remove(String id) {
            synchronized (pdfLock) { if (("b:" + id).equals(pdfKey)) pdfClose(); }
            new File(pdfDir(), safeId(id) + ".pdf").delete();
        }
    }

    private Uri folderTree(String lib) {
        String t = folders().optString(lib == null ? "main" : lib, null);
        if (t == null || t.isEmpty() || PHONE.equals(t)) return null;
        Uri tree = Uri.parse(t);
        for (UriPermission p : getContentResolver().getPersistedUriPermissions())
            if (p.getUri().equals(tree) && p.isReadPermission()) return tree;
        return null; // l'autorisation a été retirée : il faut choisir le dossier à nouveau
    }

    private void releaseIfUnused(String tree) {
        if (PHONE.equals(tree)) return;
        JSONObject o = folders();
        for (java.util.Iterator<String> it = o.keys(); it.hasNext(); ) if (tree.equals(o.optString(it.next()))) return;
        try { getContentResolver().releasePersistableUriPermission(Uri.parse(tree), Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) { }
    }

    private String folderName(Uri tree) {
        Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        try (Cursor c = getContentResolver().query(doc, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        return "Dossier";
    }

    private static boolean isBook(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        return n.matches(".*\\.(pdf|epub|mobi|azw|azw3|prc|docx|doc|odt|rtf|fb2|fbz|fb2\\.zip|cbz|html|htm|xhtml|txt|md|markdown|text|mp3|m4b|m4a|aac|ogg|oga|opus|flac|wav)$");
    }

    private static boolean isAudio(String name) {
        return name.toLowerCase(Locale.ROOT).matches(".*\\.(mp3|m4b|m4a|aac|ogg|oga|opus|flac|wav)$");
    }

    private void walk(ContentResolver cr, Uri tree, String parent, String rel, int depth, JSONArray out) throws Exception {
        if (depth > 12 || out.length() > 5000) return;
        Uri kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent);
        String[] cols = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED};
        List<String[]> dirs = new ArrayList<>();
        try (Cursor c = cr.query(kids, cols, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                String id = c.getString(0), name = c.getString(1), mime = c.getString(2);
                if (name == null || name.startsWith(".")) continue;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) { dirs.add(new String[]{id, name}); continue; }
                if (!isBook(name)) continue;
                JSONObject o = new JSONObject();
                o.put("id", id); o.put("name", name); o.put("path", rel.isEmpty() ? name : rel + "/" + name);
                o.put("size", c.isNull(3) ? 0 : c.getLong(3)); o.put("mtime", c.isNull(4) ? 0 : c.getLong(4));
                out.put(o);
            }
        }
        for (String[] d : dirs) walk(cr, tree, d[0], rel.isEmpty() ? d[1] : rel + "/" + d[1], depth + 1, out);
    }

    private WebResourceResponse folderFile(String lib, String docId) {
        Uri tree = folderTree(lib);
        if (tree == null || docId == null) return new WebResourceResponse("text/plain", "UTF-8", 404, "Introuvable", new java.util.HashMap<>(), new java.io.ByteArrayInputStream(new byte[0]));
        try {
            InputStream in = getContentResolver().openInputStream(DocumentsContract.buildDocumentUriUsingTree(tree, docId));
            return new WebResourceResponse("application/octet-stream", null, 200, "OK", new java.util.HashMap<>(), in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Introuvable", new java.util.HashMap<>(), new java.io.ByteArrayInputStream(new byte[0]));
        }
    }

    private void js(String fn, String arg) {
        runOnUiThread(() -> web.evaluateJavascript("window." + fn + " && window." + fn + "(" + JSONObject.quote(arg) + ")", null));
    }

    class FolderBridge {
        /** Liste des dossiers : [{"id":"main","name":"Livres","ok":true}, ...] */
        @JavascriptInterface
        public String list() {
            JSONArray out = new JSONArray();
            JSONObject o = folders();
            List<String> old = new ArrayList<>();
            for (java.util.Iterator<String> it = o.keys(); it.hasNext(); ) { String id = it.next(); if (PHONE.equals(o.optString(id))) old.add(id); }
            if (!old.isEmpty()) { for (String id : old) o.remove(id); saveFolders(o); } // la bibliothèque et ses livres restent, sans recherche dans tout le téléphone
            for (java.util.Iterator<String> it = o.keys(); it.hasNext(); ) {
                String id = it.next();
                try {
                    JSONObject f = new JSONObject();
                    Uri tree = folderTree(id);
                    f.put("id", id); f.put("ok", tree != null); f.put("name", tree != null ? folderName(tree) : "Dossier inaccessible");
                    out.put(f);
                } catch (Exception ignored) { }
            }
            return out.toString();
        }

        @JavascriptInterface
        public void pick(String lib) {
            pickingFor = lib == null || lib.isEmpty() ? "main" : lib;
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                try { startActivityForResult(i, FOLDER_REQUEST); } catch (ActivityNotFoundException e) { js("__noPicker", "folder"); js("__folderPicked", ""); }
            });
        }

        @JavascriptInterface
        public void forget(String lib) {
            JSONObject o = folders();
            String t = o.optString(lib, null);
            o.remove(lib); saveFolders(o);
            if (t != null && !t.isEmpty()) releaseIfUnused(t);
        }

        @JavascriptInterface
        public void scan(String lib) {
            new Thread(() -> {
                JSONObject res = new JSONObject();
                try {
                    res.put("lib", lib);
                    Uri tree = folderTree(lib);
                    if (tree == null) { res.put("error", "Le dossier n'est plus accessible. Choisis-le de nouveau."); }
                    else {
                        JSONArray files = new JSONArray();
                        walk(getContentResolver(), tree, DocumentsContract.getTreeDocumentId(tree), "", 0, files);
                        res.put("files", files);
                    }
                } catch (Exception e) {
                    try { res.put("error", "Lecture du dossier impossible : " + e.getMessage()); } catch (Exception ignored) { }
                }
                js("__folderScanned", res.toString());
            }).start();
        }
    }

    // ---------- Partager une bibliothèque entière (fichier .biblio = zip : bibliotheque.json + livres/…) ----------
    private java.util.zip.ZipOutputStream zipOut;
    private File zipFile;
    private final Object recuLock = new Object();
    private String recuJson = null;

    private File recuDir() { return new File(getCacheDir(), "recu"); }
    private static void wipe(File f) { File[] k = f.listFiles(); if (k != null) for (File x : k) wipe(x); f.delete(); }

    private WebResourceResponse recuFile(String name) { return privateFile(recuDir(), name); }

    private WebResourceResponse privateFile(File dir, String name) {
        File f = name != null && name.matches("[fw]\\d+\\.[a-z0-9]{1,6}") ? new File(dir, name) : null;
        try {
            if (f == null || !f.exists()) throw new IOException();
            return new WebResourceResponse("application/octet-stream", null, 200, "OK", new java.util.HashMap<>(), new java.io.FileInputStream(f));
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Introuvable", new java.util.HashMap<>(), new java.io.ByteArrayInputStream(new byte[0]));
        }
    }

    /** Un fichier .biblio ouvert depuis WhatsApp, Drive, Quick Share, un gestionnaire de fichiers… */
    private void handleIncoming(Intent intent) {
        if (intent == null) return;
        String a = intent.getAction();
        Uri u = null;
        if (Intent.ACTION_VIEW.equals(a)) u = intent.getData();
        else if (Intent.ACTION_SEND.equals(a)) u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (u == null) return;
        setIntent(new Intent(Intent.ACTION_MAIN)); // pas de deuxième import si l'écran tourne
        final Uri src = u;
        // Un livre (PDF, EPUB, Word…) plutôt qu'une bibliothèque partagée : on le passe à l'étagère
        String name = displayName(src), type = intent.getType() != null ? intent.getType() : getContentResolver().getType(src);
        if (!name.toLowerCase(Locale.ROOT).endsWith(".biblio") && !"application/x-biblio".equals(type)) {
            String ext = extFor(name, type);
            if (ext != null) { receiveBook(src, name.contains(".") ? name : name + ext, ext); return; }
        }
        new Thread(() -> {
            JSONObject res = new JSONObject();
            try {
                File dir = recuDir(); wipe(dir); dir.mkdirs();
                String manifest = null; long total = 0; JSONArray files = new JSONArray();
                byte[] buf = new byte[1 << 16];
                try (InputStream in = getContentResolver().openInputStream(src);
                     java.util.zip.ZipInputStream z = new java.util.zip.ZipInputStream(new java.io.BufferedInputStream(in))) {
                    java.util.zip.ZipEntry e;
                    while ((e = z.getNextEntry()) != null) {
                        String n = e.getName();
                        if (e.isDirectory()) continue;
                        if (n.equals("bibliotheque.json")) {
                            java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); int r;
                            while ((r = z.read(buf)) > 0) { bo.write(buf, 0, r); if (bo.size() > 4_000_000) throw new IOException("Fichier de partage invalide"); }
                            manifest = bo.toString("UTF-8"); continue;
                        }
                        if (!n.startsWith("livres/") || n.contains("..") || n.contains("\\") || !isBook(n)) continue;
                        String rel = n.substring(7), ext = rel.substring(rel.lastIndexOf('.')).toLowerCase(Locale.ROOT);
                        File out = new File(dir, "f" + files.length() + ext);
                        try (java.io.FileOutputStream fo = new java.io.FileOutputStream(out)) { int r; while ((r = z.read(buf)) > 0) fo.write(buf, 0, r); }
                        total += out.length();
                        JSONObject f = new JSONObject(); f.put("path", rel); f.put("file", out.getName()); f.put("size", out.length()); files.put(f);
                    }
                }
                if (manifest == null) throw new IOException("Ce fichier n'est pas une bibliothèque partagée.");
                res.put("manifest", new JSONObject(manifest)); res.put("files", files); res.put("size", total);
            } catch (Exception e) {
                wipe(recuDir());
                try { String msg = e.getMessage() == null ? "" : e.getMessage();
                    res.put("error", msg.startsWith("Ce fichier") || msg.startsWith("Fichier de partage") ? msg : "Ce fichier n'est pas une bibliothèque partagée, ou il est abîmé."); } catch (Exception ignored) { }
            }
            synchronized (recuLock) { recuJson = res.toString(); }
            js("__biblioRecue", "");
        }).start();
    }

    private String displayName(Uri u) {
        try (Cursor c = getContentResolver().query(u, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getString(0);
        } catch (Exception ignored) { }
        String last = u.getLastPathSegment();
        return last == null ? "Livre" : last.replaceAll(".*/", "");
    }

    /** Extension du livre d'après son nom, sinon d'après son type ; null si ce n'est pas un livre. */
    private static String extFor(String name, String type) {
        if (isBook(name) && !name.toLowerCase(Locale.ROOT).matches(".*\\.(mp3|m4b|m4a|aac|ogg|oga|opus|flac|wav)$")) return name.substring(name.lastIndexOf('.')).toLowerCase(Locale.ROOT);
        if (type == null) return null;
        switch (type) {
            case "application/pdf": return ".pdf";
            case "application/epub+zip": return ".epub";
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return ".docx";
            case "application/msword": return ".doc";
            case "application/vnd.oasis.opendocument.text": return ".odt";
            case "application/rtf": return ".rtf";
            case "application/x-mobipocket-ebook": case "application/vnd.amazon.ebook": return ".mobi";
            case "application/x-fictionbook+xml": return ".fb2";
            case "text/plain": return ".txt";
            default: return null;
        }
    }

    private void receiveBook(Uri src, String name, String ext) {
        new Thread(() -> {
            JSONObject res = new JSONObject();
            try {
                File dir = recuDir(); wipe(dir); dir.mkdirs();
                File out = new File(dir, "f0" + ext.replaceAll("[^.a-z0-9]", ""));
                try (InputStream in = getContentResolver().openInputStream(src); java.io.FileOutputStream fo = new java.io.FileOutputStream(out)) {
                    byte[] buf = new byte[1 << 16]; int r; while ((r = in.read(buf)) > 0) fo.write(buf, 0, r);
                }
                JSONObject b = new JSONObject(); b.put("name", name); b.put("file", out.getName()); b.put("size", out.length());
                res.put("book", b);
            } catch (Exception e) {
                try { res.put("error", "Impossible d'ouvrir ce livre."); } catch (Exception ignored) { }
            }
            synchronized (recuLock) { recuJson = res.toString(); }
            js("__biblioRecue", "");
        }).start();
    }

    private static byte[] readAll(InputStream in) throws IOException {
        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] b = new byte[1 << 15]; int n;
        while ((n = in.read(b)) > 0) bo.write(b, 0, n);
        return bo.toByteArray();
    }

    /** Envoi « multipart » en continu (fichiers de plusieurs Go), avec la progression ; renvoie la page de téléchargement. */
    private String gofile(String url, File f) throws Exception {
        String bd = "----biblio" + System.currentTimeMillis();
        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
        c.setDoOutput(true); c.setRequestMethod("POST"); c.setChunkedStreamingMode(1 << 20);
        c.setConnectTimeout(30000); c.setReadTimeout(300000);
        c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + bd);
        try (java.io.OutputStream out = c.getOutputStream(); java.io.FileInputStream in = new java.io.FileInputStream(f)) {
            out.write(("--" + bd + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + f.getName().replace("\"", "") + "\"\r\nContent-Type: application/zip\r\n\r\n").getBytes("UTF-8"));
            byte[] buf = new byte[1 << 16]; long sent = 0, total = Math.max(1, f.length()); int n; long last = 0;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n); sent += n;
                long now = System.currentTimeMillis();
                if (now - last > 400) { last = now; js("__upProgress", String.valueOf(Math.min(99.0, sent * 100.0 / total))); }
            }
            out.write(("\r\n--" + bd + "--\r\n").getBytes("UTF-8"));
        }
        int code = c.getResponseCode();
        String body; try (InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream()) { body = in == null ? "" : new String(readAll(in), "UTF-8"); }
        JSONObject j = new JSONObject(body);
        if (!"ok".equals(j.optString("status"))) throw new IOException("gofile " + code);
        String link = j.getJSONObject("data").optString("downloadPage", "");
        if (link.isEmpty()) throw new IOException("lien");
        return link;
    }

    class ShareBridge {
        @JavascriptInterface
        public boolean begin(String fileName, String manifest) {
            try {
                abort();
                File dir = new File(getCacheDir(), "partage");
                if (dir.exists()) { File[] old = dir.listFiles(); if (old != null) for (File f : old) f.delete(); }
                dir.mkdirs();
                zipFile = new File(dir, fileName.replaceAll("[\\\\/:*?\"<>|]", "_"));
                zipOut = new java.util.zip.ZipOutputStream(new java.io.BufferedOutputStream(new java.io.FileOutputStream(zipFile), 1 << 16));
                zipOut.setLevel(java.util.zip.Deflater.BEST_SPEED); // les PDF sont déjà compressés : on va vite
                zipOut.putNextEntry(new java.util.zip.ZipEntry("bibliotheque.json"));
                zipOut.write(manifest.getBytes("UTF-8"));
                zipOut.closeEntry();
                return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean fileBegin(String path) {
            try { zipOut.putNextEntry(new java.util.zip.ZipEntry("livres/" + path)); return true; } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean append(String b64) {
            try { zipOut.write(android.util.Base64.decode(b64, android.util.Base64.DEFAULT)); return true; } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean fileEnd() {
            try { zipOut.closeEntry(); return true; } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean finish(String title) {
            try { zipOut.close(); } catch (Exception e) { return false; }
            zipOut = null;
            Uri uri = Partage.uriFor(zipFile.getName());
            Intent i = new Intent(Intent.ACTION_SEND).setType("application/zip")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .putExtra(Intent.EXTRA_SUBJECT, "Bibliothèque « " + title + " »")
                .putExtra(Intent.EXTRA_TEXT, "Je te partage ma bibliothèque « " + title + " ». Ouvre le fichier avec l'application Bibliothèque pour l'ajouter à tes livres.")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            i.setClipData(android.content.ClipData.newRawUri(title, uri));
            Intent chooser = Intent.createChooser(i, "Envoyer la bibliothèque");
            chooser.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, new android.content.ComponentName[]{ new android.content.ComponentName(MainActivity.this, MainActivity.class) });
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            runOnUiThread(() -> { try { startActivity(chooser); } catch (Exception ignored) { } });
            return true;
        }

        @JavascriptInterface
        public void abort() {
            try { if (zipOut != null) zipOut.close(); } catch (Exception ignored) { }
            zipOut = null;
        }

        /** Met la bibliothèque en ligne (Gofile, sans compte) : window.__upProgress(%) puis window.__upDone({link} ou {error}). */
        @JavascriptInterface
        public void upload(String title) {
            try { zipOut.close(); } catch (Exception e) { js("__upDone", "{\"error\":\"Préparation impossible\"}"); return; }
            zipOut = null;
            final File f = zipFile;
            new Thread(() -> {
                JSONObject res = new JSONObject();
                try {
                    String link = null;
                    try { link = gofile("https://upload.gofile.io/uploadfile", f); } catch (Exception first) {
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL("https://api.gofile.io/servers").openConnection();
                        c.setConnectTimeout(15000); c.setReadTimeout(20000);
                        String body; try (InputStream in = c.getInputStream()) { body = new String(readAll(in), "UTF-8"); }
                        String server = new JSONObject(body).getJSONObject("data").getJSONArray("servers").getJSONObject(0).getString("name");
                        link = gofile("https://" + server + ".gofile.io/contents/uploadfile", f);
                    }
                    res.put("link", link);
                } catch (Exception e) { try { res.put("error", "La mise en ligne a échoué. Vérifie la connexion, ou utilise « Envoyer le fichier »."); } catch (Exception ignored) { } }
                js("__upDone", res.toString());
            }).start();
        }

        /** Partage un simple message (le lien) : texto, WhatsApp, courriel… */
        @JavascriptInterface
        public void text(String msg) {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, msg);
            runOnUiThread(() -> { try { startActivity(Intent.createChooser(i, "Envoyer le lien")); } catch (Exception ignored) { } });
        }

        @JavascriptInterface
        public String takeReceived() { synchronized (recuLock) { String r = recuJson; recuJson = null; return r; } }

        @JavascriptInterface
        public void clearReceived() { wipe(recuDir()); }
    }

    // ---------- Catalogues : un navigateur intégré dont les livres téléchargés arrivent sur l'étagère ----------
    private FrameLayout browserBox;
    private WebView browser;
    private android.widget.TextView browserTitle;
    private File webDir() { return new File(getCacheDir(), "web"); }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private void openBrowser(String url, String title) {
        if (browserBox == null) {
            browserBox = new FrameLayout(this);
            browserBox.setBackgroundColor(Color.parseColor("#140f0b"));
            android.widget.LinearLayout col = new android.widget.LinearLayout(this);
            col.setOrientation(android.widget.LinearLayout.VERTICAL);
            android.widget.LinearLayout bar = new android.widget.LinearLayout(this);
            bar.setOrientation(android.widget.LinearLayout.HORIZONTAL);
            bar.setGravity(android.view.Gravity.CENTER_VERTICAL);
            bar.setBackgroundColor(Color.parseColor("#1e1712"));
            bar.setPadding(dp(4), dp(4), dp(12), dp(4));
            android.widget.TextView close = new android.widget.TextView(this);
            close.setText("✕"); close.setTextSize(22); close.setTextColor(Color.parseColor("#e8dcc8"));
            close.setPadding(dp(14), dp(8), dp(14), dp(8)); close.setOnClickListener(v -> closeBrowser());
            browserTitle = new android.widget.TextView(this);
            browserTitle.setTextSize(16); browserTitle.setTextColor(Color.parseColor("#e8dcc8")); browserTitle.setSingleLine(true);
            browserTitle.setEllipsize(android.text.TextUtils.TruncateAt.END);
            android.widget.TextView hint = new android.widget.TextView(this);
            hint.setText("Les livres téléchargés vont sur ton étagère"); hint.setTextSize(11); hint.setTextColor(Color.parseColor("#b9a888"));
            android.widget.LinearLayout titles = new android.widget.LinearLayout(this);
            titles.setOrientation(android.widget.LinearLayout.VERTICAL);
            titles.addView(browserTitle); titles.addView(hint);
            bar.addView(close);
            bar.addView(titles, new android.widget.LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            browser = new WebView(this);
            WebSettings bs = browser.getSettings();
            bs.setJavaScriptEnabled(true); bs.setDomStorageEnabled(true); bs.setLoadWithOverviewMode(true); bs.setUseWideViewPort(true);
            bs.setBuiltInZoomControls(true); bs.setDisplayZoomControls(false);
            android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(browser, true);
            browser.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    String sc = request.getUrl().getScheme();
                    if ("http".equals(sc) || "https".equals(sc)) return false;
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); } catch (Exception ignored) { }
                    return true;
                }
            });
            browser.setDownloadListener((dl, ua, cd, mime, len) -> downloadBook(dl, ua, cd, mime, false));
            col.addView(bar, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            col.addView(browser, new android.widget.LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
            browserBox.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            ((FrameLayout) web.getParent()).addView(browserBox, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
        browserTitle.setText(title == null || title.isEmpty() ? "Catalogue" : title);
        browserBox.setVisibility(android.view.View.VISIBLE);
        browser.loadUrl(url);
    }

    private void closeBrowser() {
        if (browserBox == null) return;
        browserBox.setVisibility(android.view.View.GONE);
        browser.stopLoading(); browser.loadUrl("about:blank"); browser.clearHistory();
    }

    private static String extFor(String mime) {
        if (mime == null) return null;
        String m = mime.toLowerCase(Locale.ROOT);
        if (m.contains("epub")) return ".epub";
        if (m.contains("pdf")) return ".pdf";
        if (m.contains("mobipocket") || m.contains("amazon.ebook")) return ".mobi";
        if (m.contains("fictionbook")) return ".fb2";
        if (m.contains("opendocument.text")) return ".odt";
        if (m.contains("wordprocessingml")) return ".docx";
        if (m.contains("msword")) return ".doc";
        if (m.contains("rtf")) return ".rtf";
        if (m.startsWith("text/plain")) return ".txt";
        return null;
    }

    /** Télécharge un livre (catalogue ou lien collé) avec les témoins du site, puis l'envoie à l'étagère. */
    private void downloadBook(String url, String ua, String cd, String mime, boolean pageOk) {
        new Thread(() -> {
            JSONObject res = new JSONObject();
            java.net.HttpURLConnection c = null;
            try {
                String guess = android.webkit.URLUtil.guessFileName(url, cd, mime);
                js("__webBookStart", guess);
                String cur = url;
                for (int hop = 0; ; hop++) { // suit aussi les redirections http → https
                    c = (java.net.HttpURLConnection) new java.net.URL(cur).openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(20000); c.setReadTimeout(60000);
                    String ck = android.webkit.CookieManager.getInstance().getCookie(cur);
                    if (ck != null) c.setRequestProperty("Cookie", ck);
                    c.setRequestProperty("User-Agent", ua != null && !ua.isEmpty() ? ua : web.getSettings().getUserAgentString());
                    int code = c.getResponseCode();
                    if (code >= 300 && code < 400 && c.getHeaderField("Location") != null && hop < 8) { cur = new java.net.URL(new java.net.URL(cur), c.getHeaderField("Location")).toString(); c.disconnect(); continue; }
                    if (code >= 400) throw new IOException("Le site a refusé le téléchargement (" + code + ")");
                    break;
                }
                String cd2 = cd != null && !cd.isEmpty() ? cd : c.getHeaderField("Content-Disposition");
                String mime2 = c.getContentType() != null ? c.getContentType() : mime;
                String name = android.webkit.URLUtil.guessFileName(cur, cd2, mime2);
                if (name.toLowerCase(Locale.ROOT).endsWith(".biblio")) { // une bibliothèque partagée par lien
                    File dir = new File(getCacheDir(), "web"); dir.mkdirs();
                    File out = new File(dir, "partage.biblio");
                    try (InputStream in = c.getInputStream(); java.io.FileOutputStream fo = new java.io.FileOutputStream(out)) { byte[] buf = new byte[1 << 16]; int r; while ((r = in.read(buf)) > 0) fo.write(buf, 0, r); }
                    runOnUiThread(() -> { closeBrowser(); handleIncoming(new Intent(Intent.ACTION_VIEW, Uri.fromFile(out))); });
                    return;
                }
                if (!isBook(name)) {
                    String ext = extFor(mime2);
                    boolean html = mime2 != null && (mime2.toLowerCase(Locale.ROOT).startsWith("text/html") || mime2.toLowerCase(Locale.ROOT).contains("xhtml"));
                    if (ext == null && html && pageOk) ext = ".html"; // un article : il deviendra un livre à lire ou écouter
                    if (ext == null && html) throw new IOException("Ce lien mène à une page web, pas à un livre. Ouvre-le dans un catalogue et touche « Télécharger ».");
                    if (ext == null) throw new IOException("Ce fichier n'est pas un livre que l'application sait lire.");
                    name = name.replaceAll("\\.[A-Za-z0-9]{1,5}$", "") + ext;
                }
                File dir = webDir(); dir.mkdirs();
                String ext = name.substring(name.lastIndexOf('.')).toLowerCase(Locale.ROOT);
                File out = new File(dir, "w" + System.currentTimeMillis() + ext);
                try (InputStream in = c.getInputStream(); java.io.FileOutputStream fo = new java.io.FileOutputStream(out)) {
                    byte[] buf = new byte[1 << 16]; int r; long tot = 0;
                    while ((r = in.read(buf)) > 0) { fo.write(buf, 0, r); tot += r; if (tot > 600L * 1024 * 1024) throw new IOException("Fichier trop gros"); }
                }
                res.put("file", out.getName()); res.put("name", name);
                runOnUiThread(this::closeBrowser);
            } catch (Exception e) {
                String m = e.getMessage();
                try { res.put("error", m != null && (m.startsWith("Ce ") || m.startsWith("Le site") || m.startsWith("Fichier")) ? m : "Téléchargement impossible. Vérifie la connexion Internet."); } catch (Exception ignored) { }
            } finally { if (c != null) c.disconnect(); }
            js("__webBook", res.toString());
        }).start();
    }

    // ---------- Reconnaissance de texte (pages photographiées) : Google ML Kit, sur l'appareil ----------
    // ---------- Version Premium (paiement unique Google Play) ----------
    private Premium premium;

    class BillingBridge {
        /** {"play":bool,"premium":bool,"price":"4,99 $","pending":bool,"ready":bool} */
        @JavascriptInterface public String state() { return premium.state(null); }
        @JavascriptInterface public void buy() { premium.buy(); }
        @JavascriptInterface public void restore() { premium.refresh(); }
    }

    class OcrBridge {
        private com.google.mlkit.vision.text.TextRecognizer rec;

        /** Image JPEG en base64 → window.__ocrDone({id, w, h, blocks:[{t, l, top, r, b}]}) */
        @JavascriptInterface
        public void recognize(String b64, String id) {
            try {
                byte[] d = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeByteArray(d, 0, d.length);
                if (bmp == null) throw new IOException("image");
                if (rec == null) rec = com.google.mlkit.vision.text.TextRecognition.getClient(com.google.mlkit.vision.text.latin.TextRecognizerOptions.DEFAULT_OPTIONS);
                final int w = bmp.getWidth(), hgt = bmp.getHeight();
                rec.process(com.google.mlkit.vision.common.InputImage.fromBitmap(bmp, 0))
                    .addOnSuccessListener(text -> {
                        JSONObject r = new JSONObject();
                        try {
                            r.put("id", id); r.put("w", w); r.put("h", hgt);
                            JSONArray bl = new JSONArray();
                            for (com.google.mlkit.vision.text.Text.TextBlock b : text.getTextBlocks()) {
                                StringBuilder sb = new StringBuilder();
                                for (com.google.mlkit.vision.text.Text.Line ln : b.getLines()) { if (sb.length() > 0) sb.append('\n'); sb.append(ln.getText()); }
                                android.graphics.Rect bx = b.getBoundingBox();
                                JSONObject o = new JSONObject().put("t", sb.toString());
                                if (bx != null) o.put("l", bx.left).put("top", bx.top).put("r", bx.right).put("b", bx.bottom);
                                bl.put(o);
                            }
                            r.put("blocks", bl);
                        } catch (Exception ignored) { }
                        js("__ocrDone", r.toString());
                    })
                    .addOnFailureListener(e -> { try { js("__ocrDone", new JSONObject().put("id", id).put("error", "La reconnaissance a échoué").toString()); } catch (Exception ignored) { } });
            } catch (Exception e) {
                try { js("__ocrDone", new JSONObject().put("id", id).put("error", "Image illisible").toString()); } catch (Exception ignored) { }
            }
        }
    }

    class WebBridge {
        @JavascriptInterface public void open(String url, String title) { runOnUiThread(() -> openBrowser(url, title)); }
        @JavascriptInterface public void external(String url) {
            runOnUiThread(() -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { } });
        }
        @JavascriptInterface public void fetch(String url) { downloadBook(url, null, null, null, true); }
        /** Vérifie qu'un lien répond (redirections suivies, erreurs de sécurité comprises) : window.__webGot({id, status}). */
        @JavascriptInterface public void check(String url, String id) {
            new Thread(() -> {
                JSONObject r = new JSONObject();
                try {
                    r.put("id", id);
                    String cur = url; int code = 0;
                    for (int hop = 0; hop < 8; hop++) {
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(cur).openConnection();
                        c.setInstanceFollowRedirects(false); c.setConnectTimeout(12000); c.setReadTimeout(12000);
                        c.setRequestProperty("User-Agent", web.getSettings().getUserAgentString());
                        code = c.getResponseCode(); String loc = c.getHeaderField("Location"); c.disconnect();
                        if (code >= 300 && code < 400 && loc != null) { cur = new java.net.URL(new java.net.URL(cur), loc).toString(); continue; }
                        break;
                    }
                    r.put("status", code);
                } catch (Exception e) { try { r.put("error", String.valueOf(e.getClass().getSimpleName())); } catch (Exception ignored) { } }
                js("__webGot", r.toString());
            }).start();
        }

        /** Lit une page ou un catalogue (JSON) sans les limites du navigateur ; réponse dans window.__webGot({id, status, body}). */
        @JavascriptInterface public void get(String url, String id) {
            new Thread(() -> {
                JSONObject r = new JSONObject();
                java.net.HttpURLConnection c = null;
                try {
                    r.put("id", id);
                    c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                    c.setConnectTimeout(15000); c.setReadTimeout(30000);
                    c.setRequestProperty("User-Agent", web.getSettings().getUserAgentString());
                    c.setRequestProperty("Accept", "application/json, text/xml, */*");
                    int code = c.getResponseCode(); r.put("status", code);
                    try (InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream()) {
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] buf = new byte[1 << 15]; int n;
                        while (in != null && (n = in.read(buf)) > 0) { bo.write(buf, 0, n); if (bo.size() > 6_000_000) break; }
                        r.put("body", bo.toString("UTF-8"));
                    }
                } catch (Exception e) { try { r.put("error", "Pas de connexion"); } catch (Exception ignored) { } }
                finally { if (c != null) c.disconnect(); }
                js("__webGot", r.toString());
            }).start();
        }
        @JavascriptInterface public void done(String name) { if (name != null && name.matches("w\\d+\\.[a-z0-9]{1,6}")) new File(webDir(), name).delete(); }
    }

    // ---------- Ouvrir avec une autre application, envoyer à une IA, résumé Claude ----------
    private java.io.FileOutputStream outFile;
    private String outName;

    private void launch(Uri uri, String name, String mode, String prompt) {
        String mime = Partage.mimeOf(name);
        Intent i;
        if ("ai".equals(mode) || "send".equals(mode)) { // « send » : partager à des amis (Messenger, Messages, courriel…) ou à une app d'IA
            i = new Intent(Intent.ACTION_SEND);
            i.setType(mime);
            i.putExtra(Intent.EXTRA_STREAM, uri);
            if (prompt != null && !prompt.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, prompt);
            i.putExtra(Intent.EXTRA_SUBJECT, name);
            i.setClipData(android.content.ClipData.newRawUri(name, uri));
        } else {
            i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, mime);
        }
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(i, "ai".equals(mode) ? "Résumer avec…" : "send".equals(mode) ? "Partager « " + name + " »" : "Ouvrir avec…");
        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        runOnUiThread(() -> {
            try { startActivity(chooser); js("__openDone", "ok"); }
            catch (Exception e) { js("__openDone", "Aucune application ne peut ouvrir ce fichier"); }
        });
    }

    class OpenBridge {
        /** Livre venu d'un dossier : on passe directement le fichier d'origine, sans copie. */
        @JavascriptInterface
        public boolean openFolderDoc(String lib, String docId, String name, String mode, String prompt) {
            Uri tree = folderTree(lib);
            if (tree == null) return false;
            launch(DocumentsContract.buildDocumentUriUsingTree(tree, docId), name, mode, prompt);
            return true;
        }

        /** Livre ajouté à la main : la page envoie le fichier par morceaux (base64), copié dans le cache. */
        @JavascriptInterface
        public boolean begin(String name) {
            try {
                File dir = new File(getCacheDir(), "partage");
                if (dir.exists()) { File[] old = dir.listFiles(); if (old != null) for (File f : old) f.delete(); }
                dir.mkdirs();
                outName = name.replaceAll("[\\/:*?\"<>|]", "_");
                outFile = new java.io.FileOutputStream(new File(dir, outName));
                return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean append(String b64) {
            try { outFile.write(android.util.Base64.decode(b64, android.util.Base64.DEFAULT)); return true; } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean finish(String mode, String prompt) {
            try { outFile.close(); } catch (Exception e) { return false; }
            launch(Partage.uriFor(outName), outName, mode, prompt);
            return true;
        }

        // ---- Partager plusieurs livres d'un coup (Messenger, Messages, courriel, app d'IA…) ----
        private final java.util.ArrayList<Uri> multi = new java.util.ArrayList<>();
        private String multiName;

        @JavascriptInterface
        public void multiReset() {
            multi.clear();
            File dir = new File(getCacheDir(), "partage");
            if (dir.exists()) { File[] old = dir.listFiles(); if (old != null) for (File f : old) f.delete(); }
            dir.mkdirs();
        }

        @JavascriptInterface
        public boolean multiAddFolderDoc(String lib, String docId) {
            Uri tree = folderTree(lib);
            if (tree == null) return false;
            multi.add(DocumentsContract.buildDocumentUriUsingTree(tree, docId));
            return true;
        }

        @JavascriptInterface
        public boolean multiBegin(String name) {
            try {
                File dir = new File(getCacheDir(), "partage"); dir.mkdirs();
                String n = name.replaceAll("[\\/:*?\"<>|]", "_"), base = n, ext = "";
                int dot = n.lastIndexOf('.'); if (dot > 0) { base = n.substring(0, dot); ext = n.substring(dot); }
                for (int k = 2; new File(dir, n).exists(); k++) n = base + " (" + k + ")" + ext;
                multiName = n;
                outFile = new java.io.FileOutputStream(new File(dir, n));
                return true;
            } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean multiEnd() {
            try { outFile.close(); multi.add(Partage.uriFor(multiName)); return true; } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean multiSend(String text) {
            if (multi.isEmpty()) return false;
            Intent i = new Intent(multi.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
            i.setType("*/*");
            if (multi.size() == 1) i.putExtra(Intent.EXTRA_STREAM, multi.get(0));
            else i.putParcelableArrayListExtra(Intent.EXTRA_STREAM, new java.util.ArrayList<>(multi));
            if (text != null && !text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
            android.content.ClipData clip = android.content.ClipData.newRawUri("livres", multi.get(0));
            for (int k = 1; k < multi.size(); k++) clip.addItem(new android.content.ClipData.Item(multi.get(k)));
            i.setClipData(clip);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(i, "Partager " + multi.size() + " livre" + (multi.size() > 1 ? "s" : ""));
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            runOnUiThread(() -> {
                try { startActivity(chooser); js("__openDone", "ok"); }
                catch (Exception e) { js("__openDone", "Aucune application ne peut recevoir ces fichiers"); }
            });
            return true;
        }

        /** Appel à l'API Claude (évite les restrictions du navigateur). Réponse : window.__claudeDone({status, body}). */
        @JavascriptInterface
        public void claude(String key, String body) {
            new Thread(() -> {
                JSONObject res = new JSONObject();
                try {
                    java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL("https://api.anthropic.com/v1/messages").openConnection();
                    c.setRequestMethod("POST");
                    c.setConnectTimeout(30000); c.setReadTimeout(600000);
                    c.setDoOutput(true);
                    c.setRequestProperty("content-type", "application/json");
                    c.setRequestProperty("x-api-key", key);
                    c.setRequestProperty("anthropic-version", "2023-06-01");
                    try (java.io.OutputStream o = c.getOutputStream()) { o.write(body.getBytes("UTF-8")); }
                    int code = c.getResponseCode();
                    InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
                    java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
                    if (in != null) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) buf.write(b, 0, n); in.close(); }
                    res.put("status", code); res.put("body", buf.toString("UTF-8"));
                } catch (Exception e) {
                    try { res.put("status", 0); res.put("body", String.valueOf(e.getMessage())); } catch (Exception ignored) { }
                }
                js("__claudeDone", res.toString());
            }).start();
        }
    }

    /** Android Auto commande la lecture en cours sur le téléphone (lecture, pause, avancer, reculer). */
    static boolean autoCmd(String cmd, String arg) {
        MainActivity a = instance;
        if (a == null || a.web == null) return false;
        String js = "window.__autoCmd && window.__autoCmd('" + cmd.replaceAll("[^a-z]", "") + "', " + JSONObject.quote(arg == null ? "" : arg) + ")";
        a.runOnUiThread(() -> { if (a.web != null) a.web.evaluateJavascript(js, null); });
        return true;
    }

    /** Vrai sur un téléviseur (Android TV / Google TV). */
    boolean isTv() {
        android.app.UiModeManager ui = (android.app.UiModeManager) getSystemService(UI_MODE_SERVICE);
        return (ui != null && ui.getCurrentModeType() == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION)
            || getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_LEANBACK);
    }

    // ---------- Condensé vidéo MP4 d'un livre ----------
    private static volatile boolean videoBusy;

    class VideoBridge {
        @JavascriptInterface
        public boolean exists(String id) { return VideoMaker.out(MainActivity.this, id).exists(); }

        @JavascriptInterface
        public boolean busy() { return videoBusy; }

        /** Fabrique la vidéo ; progression : window.__videoProgress({id, stage, frac, msg} | {id, done} | {id, error}) */
        @JavascriptInterface
        public void make(String id, String title, String author, String scriptJson) {
            if (videoBusy) { js("__videoProgress", "{\"id\":\"" + id + "\",\"error\":\"Une vidéo est déjà en préparation.\"}"); return; }
            videoBusy = true;
            new Thread(() -> {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                android.os.PowerManager.WakeLock wl = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "bibliotheque:video");
                wl.acquire(90 * 60 * 1000L);
                try {
                    VideoMaker.make(getApplicationContext(), id, title, author, new JSONObject(scriptJson), (stage, frac, msg) -> {
                        try { js("__videoProgress", new JSONObject().put("id", id).put("stage", stage).put("frac", frac).put("msg", msg).toString()); } catch (Exception ignored) { }
                    });
                    js("__videoProgress", new JSONObject().put("id", id).put("done", true).toString());
                } catch (Throwable e) {
                    try { js("__videoProgress", new JSONObject().put("id", id).put("error", String.valueOf(e.getMessage())).toString()); } catch (Exception ignored) { }
                } finally { videoBusy = false; if (wl.isHeld()) wl.release(); }
            }).start();
        }

        @JavascriptInterface
        public void cancel() { VideoMaker.cancel = true; }

        private Uri uri(String id) { return Partage.uriFor("video-" + id + ".mp4"); }

        /** Regarder la vidéo dans le lecteur vidéo du téléphone. */
        @JavascriptInterface
        public boolean play(String id) {
            if (!exists(id)) return false;
            Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri(id), "video/mp4").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            try { startActivity(i); return true; } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public boolean share(String id, String title) {
            if (!exists(id)) return false;
            Intent i = new Intent(Intent.ACTION_SEND).setType("video/mp4").putExtra(Intent.EXTRA_STREAM, uri(id)).putExtra(Intent.EXTRA_SUBJECT, title).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try { startActivity(Intent.createChooser(i, "Partager la vidéo")); return true; } catch (Exception e) { return false; }
        }

        /** Télécharger : copie dans la Galerie (Films/Bibliothèque). Renvoie "" si tout va bien, sinon le message d'erreur. */
        @JavascriptInterface
        public String save(String id, String title) {
            File src = VideoMaker.out(MainActivity.this, id);
            if (!src.exists()) return "La vidéo n'existe pas encore.";
            String name = (title == null ? "Livre" : title).replaceAll("[\\\\/:*?\"<>|]", " ").trim();
            if (name.length() > 80) name = name.substring(0, 80);
            name = name + " - condensé.mp4";
            try {
                android.content.ContentValues v = new android.content.ContentValues();
                v.put(android.provider.MediaStore.Video.Media.DISPLAY_NAME, name);
                v.put(android.provider.MediaStore.Video.Media.MIME_TYPE, "video/mp4");
                Uri dest;
                if (Build.VERSION.SDK_INT >= 29) {
                    v.put(android.provider.MediaStore.Video.Media.RELATIVE_PATH, android.os.Environment.DIRECTORY_MOVIES + "/Bibliotheque");
                    v.put(android.provider.MediaStore.Video.Media.IS_PENDING, 1);
                    dest = getContentResolver().insert(android.provider.MediaStore.Video.Media.EXTERNAL_CONTENT_URI, v);
                } else {
                    File d = new File(android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_MOVIES), "Bibliotheque");
                    d.mkdirs();
                    File f = new File(d, name);
                    try (InputStream in = new java.io.FileInputStream(src); java.io.OutputStream out = new java.io.FileOutputStream(f)) { copy(in, out); }
                    return "";
                }
                if (dest == null) return "La Galerie a refusé la vidéo.";
                try (InputStream in = new java.io.FileInputStream(src); java.io.OutputStream out = getContentResolver().openOutputStream(dest)) { copy(in, out); }
                if (Build.VERSION.SDK_INT >= 29) { v.clear(); v.put(android.provider.MediaStore.Video.Media.IS_PENDING, 0); getContentResolver().update(dest, v, null, null); }
                return "";
            } catch (Exception e) { return "Enregistrement impossible : " + e.getMessage(); }
        }

        @JavascriptInterface
        public void remove(String id) { VideoMaker.out(MainActivity.this, id).delete(); }
    }

    // ---------- Envoyer une vidéo sur la télé (Google Cast) ----------
    private TeleCast tele;
    private TeleCast tele() { if (tele == null) tele = new TeleCast(this, this::js); return tele; }

    class TeleBridge {
        @JavascriptInterface public void startScan() { runOnUiThread(() -> tele().startScan()); }
        @JavascriptInterface public void stopScan() { runOnUiThread(() -> tele().stopScan()); }
        @JavascriptInterface public void cast(String routeId, String bookId, String title) { runOnUiThread(() -> tele().cast(routeId, VideoMaker.out(MainActivity.this, bookId), title)); }
        @JavascriptInterface public void play() { runOnUiThread(() -> tele().play()); }
        @JavascriptInterface public void pause() { runOnUiThread(() -> tele().pause()); }
        @JavascriptInterface public void seek(int sec) { runOnUiThread(() -> tele().seek(sec * 1000L)); }
        @JavascriptInterface public void stop() { runOnUiThread(() -> tele().stop()); }
        @JavascriptInterface public String videos() {
            JSONArray a = new JSONArray();
            File[] fs = VideoMaker.dir(MainActivity.this).listFiles();
            if (fs != null) for (File f : fs) { String n = f.getName(); if (n.startsWith("video-") && n.endsWith(".mp4") && !n.endsWith(".tmp.mp4")) a.put(n.substring(6, n.length() - 4)); }
            return a.toString();
        }
    }

    private static void copy(InputStream in, java.io.OutputStream out) throws IOException {
        byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n);
    }

    // ---------- Caster l'écran de l'application sur la télé ----------
    class CastBridge {
        @JavascriptInterface
        public boolean isTv() { return MainActivity.this.isTv(); }

        /** Ouvre la diffusion d'écran du téléphone : Smart View sur Samsung, sinon « Caster l'écran » d'Android. */
        @JavascriptInterface
        public void cast() {
            runOnUiThread(() -> {
                Intent[] tries = {
                    new Intent().setClassName("com.samsung.android.smartmirroring", "com.samsung.android.smartmirroring.CastingDialog"),
                    new Intent("com.samsung.android.smartmirroring.action.SMART_MIRRORING"),
                    new Intent("android.settings.CAST_SETTINGS"),
                    new Intent("android.settings.WIFI_DISPLAY_SETTINGS"),
                };
                for (Intent i : tries) {
                    try { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); js("__castOpened", "ok"); return; }
                    catch (Exception ignored) { }
                }
                js("__castOpened", "");
            });
        }
    }

    // ---------- Android Auto : l'application prépare les livres dans files/auto ----------
    class AutoBridge {
        /** Le lecteur du téléphone annonce ce qu'il lit (ou "" quand il se ferme) : l'auto l'affiche et le commande. */
        @JavascriptInterface
        public void nowPlaying(String json) { LivreService.phoneState(json); }

        private File f(String name) {
            if (name == null || name.contains("..") || name.startsWith("/")) return null;
            File x = new File(new File(getFilesDir(), "auto"), name);
            x.getParentFile().mkdirs();
            return x;
        }

        @JavascriptInterface
        public boolean writeText(String name, String text) {
            File x = f(name); if (x == null) return false;
            File tmp = new File(x.getPath() + ".tmp");
            try (java.io.FileOutputStream o = new java.io.FileOutputStream(tmp)) { o.write(text.getBytes("UTF-8")); }
            catch (Exception e) { return false; }
            boolean ok = tmp.renameTo(x);
            if (ok && "catalog.json".equals(name)) LivreService.catalogChanged();
            if (ok && name.startsWith("prof/")) LivreService.profChanged(name.substring(5).replace(".json", ""));
            return ok;
        }

        @JavascriptInterface
        public boolean writeB64(String name, String b64) {
            File x = f(name); if (x == null) return false;
            try (java.io.FileOutputStream o = new java.io.FileOutputStream(x)) { o.write(android.util.Base64.decode(b64, android.util.Base64.DEFAULT)); return true; }
            catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public String readText(String name) {
            File x = f(name); if (x == null || !x.exists()) return "";
            try { return new String(java.nio.file.Files.readAllBytes(x.toPath()), "UTF-8"); } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public boolean remove(String name) { File x = f(name); return x != null && x.delete(); }

        // ----- Le Professeur bizarroïde : joué par le même lecteur que l'auto -----
        private void prof(String cmd, String id, String text) {
            Intent i = new Intent(MainActivity.this, LivreService.class).putExtra("cmd", cmd);
            if (id != null) i.putExtra("id", id);
            if (text != null) i.putExtra("text", text);
            runOnUiThread(() -> { try { startService(i); } catch (Exception ignored) { } });
        }

        @JavascriptInterface
        public void profPlay(String id) { prof("prof", id, null); }

        @JavascriptInterface
        public void profPause() { prof("pause", null, null); }

        /** Bouton « Arrêt » : la voix se tait et la notification disparaît. */
        @JavascriptInterface
        public void profStop() { prof("stop", null, null); }

        /** Une question arrive : le Professeur se tait tout de suite et dit qu'il réfléchit. */
        @JavascriptInterface
        public void profThink(String text) { prof("think", null, text); }

        /** Les voix françaises installées : [{name, label}] */
        @JavascriptInterface
        public String profVoices() {
            JSONArray a = new JSONArray();
            try {
                java.util.List<android.speech.tts.Voice> vs = new ArrayList<>(tts.getVoices());
                vs.sort((x, y) -> x.getName().compareTo(y.getName()));
                int n = 0;
                for (android.speech.tts.Voice v : vs) {
                    if (v.getLocale() == null || !"fr".equals(v.getLocale().getLanguage())) continue;
                    if (v.getFeatures() != null && v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                    String country = v.getLocale().getCountry();
                    String where = "CA".equals(country) ? "Québec" : "FR".equals(country) ? "France" : "BE".equals(country) ? "Belgique" : "CH".equals(country) ? "Suisse" : country;
                    a.put(new JSONObject().put("name", v.getName()).put("label", "Voix " + (++n) + " · " + where + (v.isNetworkConnectionRequired() ? " · en ligne" : "")));
                }
            } catch (Exception ignored) { }
            return a.toString();
        }

        /** Choisit la voix du Professeur et la fait entendre. */
        @JavascriptInterface
        public void profSetVoice(String name, String sample) {
            getSharedPreferences("ia", MODE_PRIVATE).edit().putString("voice", name == null ? "" : name).apply();
            prof("voice", null, sample);
        }

        /** Réponse à une question : dite à voix haute, puis le cours reprend. */
        @JavascriptInterface
        public void profAnswer(String id, String text) { prof("answer", id, text); }

        /** Dictée de la question (reconnaissance vocale d'Android). Réponse : window.__heard(texte ou "") */
        @JavascriptInterface
        public void listen() {
            runOnUiThread(() -> {
                Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "fr-CA")
                    .putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Ta question au Professeur");
                try { startActivityForResult(i, LISTEN_REQUEST); } catch (Exception e) { js("__heard", ""); }
            });
        }

        @JavascriptInterface
        public String list(String sub) {
            File d = f(sub); JSONArray a = new JSONArray();
            String[] names = d == null ? null : d.list();
            if (names != null) for (String n : names) a.put(n);
            return a.toString();
        }
    }

    // ---------- IA intégrée au téléphone : Gemini Nano (ML Kit GenAI, API « Prompt ») ----------
    private com.google.mlkit.genai.prompt.java.GenerativeModelFutures nano;
    private final java.util.concurrent.ExecutorService aiExec = java.util.concurrent.Executors.newSingleThreadExecutor();

    private com.google.mlkit.genai.prompt.java.GenerativeModelFutures nano() {
        if (nano == null) nano = com.google.mlkit.genai.prompt.java.GenerativeModelFutures.from(com.google.mlkit.genai.prompt.Generation.INSTANCE.getClient());
        return nano;
    }

    private static String errText(Throwable e) {
        Throwable c = e;
        while (c.getCause() != null && c.getCause() != c && !(c instanceof com.google.mlkit.genai.common.GenAiException)) c = c.getCause();
        String code = c instanceof com.google.mlkit.genai.common.GenAiException ? " [" + ((com.google.mlkit.genai.common.GenAiException) c).getErrorCode() + "]" : "";
        return String.valueOf(c.getMessage()) + code;
    }

    class AiBridge {
        /** Réponse : window.__aiStatus("available" | "downloadable" | "downloading" | "unavailable" | "error:…") */
        @JavascriptInterface
        public void status() {
            aiExec.execute(() -> {
                String r;
                try {
                    int st = nano().checkStatus().get();
                    r = st == com.google.mlkit.genai.common.FeatureStatus.AVAILABLE ? "available"
                      : st == com.google.mlkit.genai.common.FeatureStatus.DOWNLOADABLE ? "downloadable"
                      : st == com.google.mlkit.genai.common.FeatureStatus.DOWNLOADING ? "downloading" : "unavailable";
                } catch (Throwable e) { r = "unavailable"; }
                js("__aiStatus", r);
            });
        }

        /** Télécharge le modèle (fait par Android, une seule fois). Progression : window.__aiDownload("progress:octets" | "done" | "error:…") */
        @JavascriptInterface
        public void download() {
            aiExec.execute(() -> {
                try {
                    nano().download(new com.google.mlkit.genai.common.DownloadCallback() {
                        @Override public void onDownloadProgress(long bytes) { js("__aiDownload", "progress:" + bytes); }
                        @Override public void onDownloadFailed(com.google.mlkit.genai.common.GenAiException e) { js("__aiDownload", "error:" + errText(e)); }
                        @Override public void onDownloadCompleted() { js("__aiDownload", "done"); }
                    }).get();
                    js("__aiDownload", "done");
                } catch (Throwable e) { js("__aiDownload", "error:" + errText(e)); }
            });
        }

        /** Une demande à l'IA gratuite en ligne (sans clé). Réponse : window.__aiResult({id, text} ou {id, error}) */
        @JavascriptInterface
        public void generateOnline(String id, String system, String prompt) { online(id, system, prompt, false, false); }

        /** Une question de l'auditeur : elle passe devant la préparation du cours. */
        @JavascriptInterface
        public void generateUrgent(String id, String system, String prompt) { online(id, system, prompt, true, false); }

        /** Réponse en JSON strict (scénario de la vidéo). */
        @JavascriptInterface
        public void generateJson(String id, String system, String prompt) { online(id, system, prompt, false, true); }

        private void online(String id, String system, String prompt, boolean urgent, boolean json) {
            new Thread(() -> {
                JSONObject res = new JSONObject();
                try { res.put("id", id); res.put("text", IaGratuite.ask(MainActivity.this, system, prompt, urgent, json)); }
                catch (Throwable e) { try { res.put("error", String.valueOf(e.getMessage())); } catch (Exception ignored) { } }
                js("__aiResult", res.toString());
            }).start();
        }

        /** Clé Gemini gratuite de la personne : gardée seulement sur ce téléphone. */
        @JavascriptInterface
        public void setGeminiKey(String k) { IaGratuite.setKey(MainActivity.this, k); }

        @JavascriptInterface
        public boolean hasGeminiKey() { return !IaGratuite.key(MainActivity.this).isEmpty(); }

        /** Le micro, pour poser des questions au Professeur dans l'auto (demandé une seule fois). */
        @JavascriptInterface
        public void askMic() {
            runOnUiThread(() -> {
                if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED)
                    requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO}, 77);
            });
        }

        /** Une demande à l'IA. Réponse : window.__aiResult({id, text} ou {id, error}) */
        @JavascriptInterface
        public void generate(String id, String prompt) {
            aiExec.execute(() -> {
                JSONObject res = new JSONObject();
                try {
                    res.put("id", id);
                    com.google.mlkit.genai.prompt.GenerateContentResponse r = nano().generateContent(prompt).get();
                    StringBuilder sb = new StringBuilder();
                    if (r.getCandidates() != null && !r.getCandidates().isEmpty() && r.getCandidates().get(0).getText() != null) sb.append(r.getCandidates().get(0).getText());
                    res.put("text", sb.toString());
                } catch (Throwable e) {
                    try { res.put("error", errText(e)); } catch (Exception ignored) { }
                }
                js("__aiResult", res.toString());
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (premium != null) premium.refresh();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FOLDER_REQUEST) {
            String out = "";
            String lib = pickingFor == null ? "main" : pickingFor;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri tree = data.getData();
                try {
                    getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    JSONObject o = folders();
                    String old = o.optString(lib, null);
                    o.put(lib, tree.toString()); saveFolders(o);
                    if (old != null && !old.isEmpty() && !old.equals(tree.toString())) releaseIfUnused(old);
                    out = new JSONObject().put("id", lib).put("name", folderName(tree)).toString();
                } catch (Exception e) { out = ""; }
            }
            js("__folderPicked", out);
            return;
        }
        if (requestCode == LISTEN_REQUEST) {
            String heard = "";
            if (resultCode == RESULT_OK && data != null) {
                java.util.ArrayList<String> r = data.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS);
                if (r != null && !r.isEmpty() && r.get(0) != null) heard = r.get(0);
            }
            js("__heard", heard);
            return;
        }
        if (requestCode == FILE_REQUEST) {
            if (fileCallback == null) return;
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    result = new Uri[n];
                    for (int k = 0; k < n; k++) result[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /** Android 15/16 : l'application s'étend sous la barre d'état et la barre de navigation. On garde le contenu à l'abri
     *  (barres, encoche, clavier) avec une marge égale à leur taille ; la marge prend la couleur du fond de l'application. */
    private void edgeToEdge(FrameLayout root) {
        root.setBackgroundColor(Color.parseColor("#140f0b"));
        if (Build.VERSION.SDK_INT < 30) return; // avant Android 11 : Android garde déjà le contenu sous les barres
        getWindow().setDecorFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((v, in) -> {
            android.graphics.Insets i = in.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout() | android.view.WindowInsets.Type.ime());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return android.view.WindowInsets.CONSUMED;
        });
        android.view.WindowInsetsController c = getWindow().getInsetsController();
        if (c != null) c.setSystemBarsAppearance(0, android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS); // icônes claires sur fond sombre
        if (Build.VERSION.SDK_INT >= 29) { getWindow().setNavigationBarContrastEnforced(false); getWindow().setStatusBarContrastEnforced(false); }
    }

    @Override
    public void onBackPressed() { handleBack(); } // Android 12 et moins

    private void handleBack() {
        if (browserBox != null && browserBox.getVisibility() == android.view.View.VISIBLE) {
            if (browser.canGoBack()) browser.goBack(); else closeBrowser();
            return;
        }
        web.evaluateJavascript("(window.__androidBack && window.__androidBack()) ? 'yes' : 'no'", value -> {
            if (value != null && value.contains("yes")) return;
            finish();
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (instance == this) { instance = null; LivreService.phoneState(""); }
        if (isFinishing()) LivreService.appClosed(); // fermer l'application arrête la lecture
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (web != null) { web.removeAllViews(); web.destroy(); }
        super.onDestroy();
    }
}
