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
    private static final String FOLDER_PATH = "/__dossier";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private final List<String[]> pending = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
        s.setUserAgentString(s.getUserAgentString() + " BibliothequeApp/1.7");

        web.addJavascriptInterface(new TtsBridge(), "AndroidTTS");
        web.addJavascriptInterface(new FolderBridge(), "AndroidFolder");
        web.addJavascriptInterface(new OpenBridge(), "AndroidOpen");

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
                    fileCallback = null;
                    return false;
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
                try { startActivityForResult(i, FOLDER_REQUEST); } catch (ActivityNotFoundException e) { js("__folderPicked", ""); }
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
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (web != null) { web.removeAllViews(); web.destroy(); }
        super.onDestroy();
    }
}
