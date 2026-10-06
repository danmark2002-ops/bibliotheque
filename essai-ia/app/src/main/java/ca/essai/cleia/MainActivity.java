package ca.essai.cleia;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Application d'essai : montre à une personne qui n'y connaît rien comment obtenir SA clé Gemini gratuite.
 * La page de Google s'ouvre dans un panneau Chrome (en bas) ; les instructions restent visibles en haut.
 * Au retour, la clé copiée est trouvée toute seule dans le presse-papiers, vérifiée, puis enregistrée.
 */
public class MainActivity extends Activity {
    static final String GOOGLE = "https://aistudio.google.com/apikey";
    WebView web;
    SharedPreferences prefs;
    CustomTabsSession session;
    String browserPkg;
    boolean tabOpen = false;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("essai", MODE_PRIVATE);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#f6f3ee"));
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "App");
        web.loadUrl("file:///android_asset/index.html");

        // Chrome de préférence : c'est là que la personne est déjà connectée à son compte Google
        browserPkg = CustomTabsClient.getPackageName(this, Arrays.asList("com.android.chrome"));
        if (browserPkg == null) browserPkg = CustomTabsClient.getPackageName(this, null);
        if (browserPkg != null) {
            try {
                CustomTabsClient.bindCustomTabsService(this, browserPkg, new CustomTabsServiceConnection() {
                    @Override
                    public void onCustomTabsServiceConnected(ComponentName name, CustomTabsClient client) {
                        try { client.warmup(0); } catch (Exception ignored) {}
                        session = client.newSession(new CustomTabsCallback());
                        if (session != null) session.mayLaunchUrl(Uri.parse(GOOGLE), null, null);
                    }
                    @Override
                    public void onServiceDisconnected(ComponentName name) { session = null; }
                });
            } catch (Exception ignored) {}
        }
    }

    void js(String code) { runOnUiThread(() -> web.evaluateJavascript(code, null)); }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Le presse-papiers ne se lit que quand l'application a la main : on regarde dès qu'elle la reprend
        if (hasFocus) js("window.onFocusBack && onFocusBack()");
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == 7) { tabOpen = false; js("window.onTabClosed && onTabClosed()"); }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.goBack ? goBack() : false", v -> { if (!"true".equals(v)) finish(); });
    }

    /** Essaie la clé en en-tête, puis dans l'adresse (selon le format, Google accepte l'une ou l'autre) */
    static String http(String method, String url, String key, String body) throws Exception {
        String r = http1(method, url, key, body, false);
        int code = Integer.parseInt(r.substring(0, r.indexOf('\n')));
        if (code == 400 || code == 401 || code == 403) {
            String r2 = http1(method, url, key, body, true);
            if (r2.startsWith("200")) return r2;
        }
        return r;
    }
    static String http1(String method, String url, String key, String body, boolean inQuery) throws Exception {
        if (inQuery) url += (url.contains("?") ? "&" : "?") + "key=" + java.net.URLEncoder.encode(key, "UTF-8");
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(15000); c.setReadTimeout(90000);
        if (!inQuery) c.setRequestProperty("x-goog-api-key", key);
        if (body != null) {
            c.setDoOutput(true);
            c.setRequestProperty("content-type", "application/json");
            try (OutputStream o = c.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
        }
        int code = c.getResponseCode();
        InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) out.write(buf, 0, n); in.close(); }
        return code + "\n" + out.toString("UTF-8");
    }

    class Bridge {
        @JavascriptInterface
        public boolean openGoogle(boolean partial) {
            runOnUiThread(() -> {
                try {
                    CustomTabsIntent.Builder bld = session != null ? new CustomTabsIntent.Builder(session) : new CustomTabsIntent.Builder();
                    if (partial) {
                        int h = (int) (getResources().getDisplayMetrics().heightPixels * 0.64);
                        bld.setInitialActivityHeightPx(h, CustomTabsIntent.ACTIVITY_HEIGHT_ADJUSTABLE);
                        bld.setToolbarCornerRadiusDp(16);
                    }
                    CustomTabsIntent ci = bld.build();
                    if (browserPkg != null) ci.intent.setPackage(browserPkg);
                    ci.intent.setData(Uri.parse(GOOGLE));
                    tabOpen = true;
                    startActivityForResult(ci.intent, 7);
                } catch (Exception e) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(GOOGLE))); } catch (Exception ignored) {}
                }
            });
            return browserPkg != null;
        }

        @JavascriptInterface
        public String clip() {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                ClipData d = cm.getPrimaryClip();
                if (d == null || d.getItemCount() == 0) return "";
                CharSequence t = d.getItemAt(0).coerceToText(MainActivity.this);
                return t == null ? "" : t.toString();
            } catch (Exception e) { return ""; }
        }

        /** Vérifie la clé auprès de Google. Réponse : onChecked({ok, msg}) */
        @JavascriptInterface
        public void check(String key) {
            new Thread(() -> {
                JSONObject r = new JSONObject();
                try {
                    String res = http("GET", "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", key, null);
                    int code = Integer.parseInt(res.substring(0, res.indexOf('\n')));
                    r.put("ok", code == 200);
                    r.put("msg", code == 200 ? "" : code == 400 || code == 401 || code == 403 ? "Google refuse cette clé." : "Réponse inattendue de Google (" + code + ").");
                } catch (Exception e) {
                    try { r.put("ok", false); r.put("msg", "Pas de connexion Internet ?"); } catch (Exception ignored) {}
                }
                js("onChecked(" + r + ")");
            }).start();
        }

        @JavascriptInterface public void save(String key) { prefs.edit().putString("key", key).apply(); }
        @JavascriptInterface public String key() { return prefs.getString("key", ""); }
        @JavascriptInterface public void clear() { prefs.edit().remove("key").apply(); }
        @JavascriptInterface public boolean tabOpen() { return tabOpen; }
        /** Ferme la page de Google (ouverte par nous) et redonne la main à l'application */
        @JavascriptInterface public void closeTab() {
            runOnUiThread(() -> {
                try { finishActivity(7); } catch (Exception ignored) {}
                // et si la page vit ailleurs : on ramène l'application devant, ce qui la masque
                try { startActivity(new Intent(MainActivity.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)); } catch (Exception ignored) {}
                tabOpen = false;
            });
        }

        /** Essai réel : Gemini répond avec la clé de la personne. Réponse : onAnswer({text} ou {error}) */
        @JavascriptInterface
        public void ask(String prompt) {
            new Thread(() -> {
                JSONObject r = new JSONObject();
                String key = prefs.getString("key", "");
                String[] models = {"gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.0-flash"};
                String last = "Erreur inconnue";
                try {
                    JSONObject body = new JSONObject().put("contents", new JSONArray().put(new JSONObject().put("parts", new JSONArray().put(new JSONObject().put("text", prompt)))));
                    for (String m : models) {
                        String res = http("POST", "https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", key, body.toString());
                        int code = Integer.parseInt(res.substring(0, res.indexOf('\n')));
                        String txt = res.substring(res.indexOf('\n') + 1);
                        if (code == 200) {
                            JSONArray parts = new JSONObject(txt).getJSONArray("candidates").getJSONObject(0).getJSONObject("content").getJSONArray("parts");
                            StringBuilder sb = new StringBuilder();
                            for (int i = 0; i < parts.length(); i++) sb.append(parts.getJSONObject(i).optString("text"));
                            r.put("text", sb.toString()); r.put("model", m);
                            break;
                        }
                        last = code == 429 ? "Limite gratuite atteinte pour l'instant. Réessaie dans une minute." : code == 400 || code == 403 ? "Google refuse la clé." : "Erreur " + code;
                        if (code == 400 || code == 403) break;
                    }
                    if (!r.has("text")) r.put("error", last);
                } catch (Exception e) {
                    try { r.put("error", "Pas de connexion Internet ?"); } catch (Exception ignored) {}
                }
                js("onAnswer(" + r + ")");
            }).start();
        }
    }
}
