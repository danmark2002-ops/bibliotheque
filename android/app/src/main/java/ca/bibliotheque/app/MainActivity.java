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

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setUserAgentString(s.getUserAgentString() + " BibliothequeApp/2.0");

        web.addJavascriptInterface(new TtsBridge(), "AndroidTTS");
        web.addJavascriptInterface(new FolderBridge(), "AndroidFolder");
        web.addJavascriptInterface(new OpenBridge(), "AndroidOpen");
        web.addJavascriptInterface(new AiBridge(), "AndroidAI");
        web.addJavascriptInterface(new AutoBridge(), "AndroidAuto");
        web.addJavascriptInterface(new CastBridge(), "AndroidCast");
        web.addJavascriptInterface(new VideoBridge(), "AndroidVideo");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null; // polices Google, etc. : réseau normal
                String path = u.getPath();
                if (FOLDER_PATH.equals(path)) return folderFile(u.getQueryParameter("lib"), u.getQueryParameter("id"));
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
                    "text/plain", "text/markdown", "application/octet-stream"});
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
                for (String[] p : pending) speakNow(p[0], Float.parseFloat(p[1]), p[2]);
                pending.clear();
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START);
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

    private void speakNow(String text, float rate, String id) {
        tts.setSpeechRate(rate);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), id);
    }

    class TtsBridge {
        @JavascriptInterface
        public void speak(String text, float rate, String id) {
            LivreService.pauseFromApp();
            if (!ttsReady) { synchronized (pending) { pending.clear(); pending.add(new String[]{text, String.valueOf(rate), id}); } return; }
            speakNow(text, rate, id);
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

    private Uri folderTree(String lib) {
        String t = folders().optString(lib == null ? "main" : lib, null);
        if (t == null || t.isEmpty()) return null;
        Uri tree = Uri.parse(t);
        for (UriPermission p : getContentResolver().getPersistedUriPermissions())
            if (p.getUri().equals(tree) && p.isReadPermission()) return tree;
        return null; // l'autorisation a été retirée : il faut choisir le dossier à nouveau
    }

    private void releaseIfUnused(String tree) {
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
        return n.endsWith(".pdf") || n.endsWith(".docx") || n.endsWith(".txt") || n.endsWith(".md");
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
            for (java.util.Iterator<String> it = o.keys(); it.hasNext(); ) {
                String id = it.next();
                try {
                    Uri tree = folderTree(id);
                    JSONObject f = new JSONObject();
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

    // ---------- Ouvrir avec une autre application, envoyer à une IA, résumé Claude ----------
    private java.io.FileOutputStream outFile;
    private String outName;

    private void launch(Uri uri, String name, String mode, String prompt) {
        String mime = Partage.mimeOf(name);
        Intent i;
        if ("ai".equals(mode)) {
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
        Intent chooser = Intent.createChooser(i, "ai".equals(mode) ? "Résumer avec…" : "Ouvrir avec…");
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
        public void generateOnline(String id, String system, String prompt) { online(id, system, prompt, false); }

        /** Une question de l'auditeur : elle passe devant la préparation du cours. */
        @JavascriptInterface
        public void generateUrgent(String id, String system, String prompt) { online(id, system, prompt, true); }

        private void online(String id, String system, String prompt, boolean urgent) {
            new Thread(() -> {
                JSONObject res = new JSONObject();
                try { res.put("id", id); res.put("text", IaGratuite.ask(MainActivity.this, system, prompt, urgent)); }
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

    @Override
    public void onBackPressed() {
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
