package ca.bibliotheque.app;

import android.app.Activity;
import android.content.Context;
import android.net.wifi.WifiManager;

import androidx.mediarouter.media.MediaRouteSelector;
import androidx.mediarouter.media.MediaRouter;

import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManager;
import com.google.android.gms.cast.framework.SessionManagerListener;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;

/**
 * Envoie une vidéo du Professeur sur une télé Google Cast (Chromecast, Google TV, Sony…) en un clic :
 * la télé lit le fichier directement sur le téléphone, par le Wi-Fi ; le téléphone sert de télécommande.
 */
final class TeleCast {
    interface Out { void send(String fn, String json); }

    private final Activity act;
    private final Out out;
    private CastContext cast;
    private MediaRouter router;
    private MediaRouteSelector selector;
    private String pendingUrl, pendingTitle;
    private WifiManager.WifiLock wifiLock;
    private android.os.PowerManager.WakeLock wakeLock;

    TeleCast(Activity act, Out out) { this.act = act; this.out = out; }

    private boolean init() {
        if (cast != null) return true;
        try {
            cast = CastContext.getSharedInstance(act.getApplicationContext());
            router = MediaRouter.getInstance(act.getApplicationContext());
            selector = cast.getMergedSelector();
            cast.getSessionManager().addSessionManagerListener(listener, CastSession.class);
            return selector != null;
        } catch (Throwable e) { cast = null; return false; }
    }

    private final MediaRouter.Callback scan = new MediaRouter.Callback() {
        @Override public void onRouteAdded(MediaRouter r, MediaRouter.RouteInfo route) { pushDevices(); }
        @Override public void onRouteRemoved(MediaRouter r, MediaRouter.RouteInfo route) { pushDevices(); }
        @Override public void onRouteChanged(MediaRouter r, MediaRouter.RouteInfo route) { pushDevices(); }
    };

    /** Commence à chercher les télés ; la liste arrive dans window.__teleDevices([...]). */
    void startScan() {
        if (!init()) { out.send("__teleDevices", "{\"error\":\"Google Cast n'est pas disponible sur ce téléphone (services Google Play).\"}"); return; }
        router.addCallback(selector, scan, MediaRouter.CALLBACK_FLAG_PERFORM_ACTIVE_SCAN);
        pushDevices();
    }

    void stopScan() { if (router != null) router.removeCallback(scan); }

    private void pushDevices() {
        JSONArray a = new JSONArray();
        try {
            for (MediaRouter.RouteInfo r : router.getRoutes()) {
                if (r.isDefault() || !r.isEnabled() || !r.matchesSelector(selector)) continue;
                a.put(new JSONObject().put("id", r.getId()).put("name", r.getName()).put("desc", r.getDescription() == null ? "" : r.getDescription()));
            }
            out.send("__teleDevices", new JSONObject().put("devices", a).toString());
        } catch (Exception ignored) { }
    }

    /** Envoie la vidéo sur la télé choisie. État : window.__teleState({state, msg}). */
    void cast(String routeId, File video, String title) {
        if (!init()) { state("error", "Google Cast n'est pas disponible sur ce téléphone."); return; }
        try {
            String url = VideoServeur.serve(video);
            if (url == null) { state("error", "Le téléphone doit être branché sur le Wi-Fi de la maison, comme la télé."); return; }
            pendingUrl = url; pendingTitle = title;
            holdLocks(true);
            CastSession s = cast.getSessionManager().getCurrentCastSession();
            MediaRouter.RouteInfo target = null;
            for (MediaRouter.RouteInfo r : router.getRoutes()) if (r.getId().equals(routeId)) target = r;
            if (target == null) { state("error", "Cette télé n'est plus visible. Vérifie qu'elle est allumée."); return; }
            if (s != null && s.isConnected() && target.isSelected()) { load(s); return; }
            state("connecting", "Connexion à " + target.getName() + "…");
            router.selectRoute(target);
        } catch (Exception e) { state("error", "Diffusion impossible : " + e.getMessage()); }
    }

    private final SessionManagerListener<CastSession> listener = new SessionManagerListener<CastSession>() {
        @Override public void onSessionStarted(CastSession s, String id) { load(s); }
        @Override public void onSessionResumed(CastSession s, boolean b) { load(s); }
        @Override public void onSessionStartFailed(CastSession s, int err) { state("error", "La télé n'a pas accepté la connexion (code " + err + ")."); holdLocks(false); }
        @Override public void onSessionEnded(CastSession s, int err) { state("ended", "Diffusion terminée."); holdLocks(false); VideoServeur.stop(); }
        @Override public void onSessionStarting(CastSession s) { }
        @Override public void onSessionEnding(CastSession s) { }
        @Override public void onSessionResuming(CastSession s, String id) { }
        @Override public void onSessionResumeFailed(CastSession s, int err) { }
        @Override public void onSessionSuspended(CastSession s, int reason) { }
    };

    private void load(CastSession s) {
        if (pendingUrl == null || s == null) return;
        RemoteMediaClient rmc = s.getRemoteMediaClient();
        if (rmc == null) { state("error", "La télé ne répond pas."); return; }
        MediaMetadata md = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MOVIE);
        md.putString(MediaMetadata.KEY_TITLE, pendingTitle == null ? "Bibliothèque" : pendingTitle);
        md.putString(MediaMetadata.KEY_SUBTITLE, "Le condensé du Professeur bizarroïde");
        MediaInfo mi = new MediaInfo.Builder(pendingUrl).setStreamType(MediaInfo.STREAM_TYPE_BUFFERED).setContentType("video/mp4").setMetadata(md).build();
        String name = s.getCastDevice() == null ? "la télé" : s.getCastDevice().getFriendlyName();
        pendingUrl = null;
        state("loading", "Envoi de la vidéo sur " + name + "…");
        rmc.load(new MediaLoadRequestData.Builder().setMediaInfo(mi).setAutoplay(true).build()).setResultCallback(r -> {
            if (r.getStatus().isSuccess()) state("playing", "La vidéo joue sur " + name + ".");
            else state("error", "La télé n'a pas pu lire la vidéo (code " + r.getStatus().getStatusCode() + ").");
        });
    }

    private RemoteMediaClient client() {
        CastSession s = cast == null ? null : cast.getSessionManager().getCurrentCastSession();
        return s == null ? null : s.getRemoteMediaClient();
    }

    void play() { RemoteMediaClient c = client(); if (c != null) c.play(); }
    void pause() { RemoteMediaClient c = client(); if (c != null) c.pause(); }
    void seek(long deltaMs) { RemoteMediaClient c = client(); if (c != null) c.seek(Math.max(0, c.getApproximateStreamPosition() + deltaMs)); }

    void stop() {
        if (cast != null) cast.getSessionManager().endCurrentSession(true);
        VideoServeur.stop();
        holdLocks(false);
        state("ended", "Diffusion arrêtée.");
    }

    boolean connected() {
        CastSession s = cast == null ? null : cast.getSessionManager().getCurrentCastSession();
        return s != null && s.isConnected();
    }

    /** Le Wi-Fi et le processeur restent éveillés tant que la télé lit la vidéo sur le téléphone. */
    @SuppressWarnings("deprecation")
    private void holdLocks(boolean on) {
        try {
            if (on) {
                if (wifiLock == null) {
                    WifiManager wm = (WifiManager) act.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "bibliotheque:cast");
                }
                if (!wifiLock.isHeld()) wifiLock.acquire();
                if (wakeLock == null) {
                    android.os.PowerManager pm = (android.os.PowerManager) act.getSystemService(Context.POWER_SERVICE);
                    wakeLock = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "bibliotheque:cast");
                }
                if (!wakeLock.isHeld()) wakeLock.acquire(3 * 60 * 60 * 1000L);
            } else {
                if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
                if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            }
        } catch (Exception ignored) { }
    }

    private void state(String st, String msg) {
        try { out.send("__teleState", new JSONObject().put("state", st).put("msg", msg).toString()); } catch (Exception ignored) { }
    }
}
