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
        s.setUserAgentString(s.getUserAgentString() + " BibliothequeApp/1.2");

        web.addJavascriptInterface(new TtsBridge(), "AndroidTTS");
        web.addJavascriptInterface(new FolderBridge(), "AndroidFolder");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null; // polices Google, etc. : réseau normal
                String path = u.getPath();
                if (FOLDER_PATH.equals(path)) return folderFile(u.getQueryParameter("id"));
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

    private Uri folderTree() {
        String t = prefs().getString("tree", null);
        if (t == null) return null;
        Uri tree = Uri.parse(t);
        for (UriPermission p : getContentResolver().getPersistedUriPermissions())
            if (p.getUri().equals(tree) && p.isReadPermission()) return tree;
        return null; // l'autorisation a été retirée : il faut choisir le dossier à nouveau
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

    private WebResourceResponse folderFile(String docId) {
        Uri tree = folderTree();
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
        @JavascriptInterface
        public String info() {
            Uri tree = folderTree();
            if (tree == null) return "";
            try { JSONObject o = new JSONObject(); o.put("name", folderName(tree)); return o.toString(); } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public void pick() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                try { startActivityForResult(i, FOLDER_REQUEST); } catch (ActivityNotFoundException e) { js("__folderPicked", ""); }
            });
        }

        @JavascriptInterface
        public void forget() {
            String t = prefs().getString("tree", null);
            if (t != null) {
                try { getContentResolver().releasePersistableUriPermission(Uri.parse(t), Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) { }
            }
            prefs().edit().remove("tree").apply();
        }

        @JavascriptInterface
        public void scan() {
            new Thread(() -> {
                JSONObject res = new JSONObject();
                try {
                    Uri tree = folderTree();
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

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FOLDER_REQUEST) {
            String out = "";
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri tree = data.getData();
                try {
                    getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    String old = prefs().getString("tree", null);
                    if (old != null && !old.equals(tree.toString())) {
                        try { getContentResolver().releasePersistableUriPermission(Uri.parse(old), Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) { }
                    }
                    prefs().edit().putString("tree", tree.toString()).apply();
                    out = new JSONObject().put("name", folderName(tree)).toString();
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
