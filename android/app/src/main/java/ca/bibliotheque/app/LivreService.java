package ca.bibliotheque.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaDescription;
import android.media.MediaMetadata;
import android.media.browse.MediaBrowser.MediaItem;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.media.MediaBrowserService;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Bibliothèque dans Android Auto : grille de couvertures, onglets par bibliothèque,
 * lecture à voix haute en arrière-plan. L'application du téléphone prépare les livres
 * dans files/auto/ (catalogue, textes découpés en phrases, couvertures) ; ce service ne fait que les lire.
 */
public class LivreService extends MediaBrowserService {
    static volatile LivreService instance;

    private static final String ROOT = "root";
    private static final String CH = "lecture";
    private static final float CPS = 14.5f; // caractères lus par seconde à vitesse 1 (estimation)
    // Clés de style pour Android Auto (grille de couvertures)
    private static final String STYLE_SUPPORTED = "android.media.browse.CONTENT_STYLE_SUPPORTED";
    private static final String STYLE_BROWSABLE = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT";
    private static final String STYLE_PLAYABLE = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT";
    private static final int STYLE_GRID = 2;
    private static final int MAX_TABS = 4; // limite d'onglets d'Android Auto

    private MediaSession session;
    private TextToSpeech tts;
    private boolean ttsReady;
    private final Handler main = new Handler(Looper.getMainLooper());
    private AudioManager audio;
    private AudioFocusRequest focus;
    private boolean resumeOnFocus;

    // Livre en cours
    private String bookId, title = "", author = "", libName = "";
    private final List<String> units = new ArrayList<>();
    private final List<Integer> marks = new ArrayList<>(); // page (PDF) ou position dans le texte (Word, texte)
    private boolean isPdf;
    private long[] startChars;
    private long totalChars;
    private int idx;
    private boolean playing;
    private int token;
    private float rate = 1f;
    private Bitmap art;
    private int sinceSave;

    // Lecture lancée sur le téléphone : l'auto l'affiche et ses boutons la commandent
    private static volatile String phoneJson = "";
    private boolean remote, remotePlaying;
    private String remoteId;

    private File dir() { return new File(getFilesDir(), "auto"); }

    private static String read(File f) {
        try { return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8); } catch (Exception e) { return null; }
    }

    private JSONObject catalog() {
        String s = read(new File(dir(), "catalog.json"));
        try { return s == null ? new JSONObject() : new JSONObject(s); } catch (Exception e) { return new JSONObject(); }
    }

    // ---------------------------------------------------------------- cycle de vie
    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        session = new MediaSession(this, "Bibliotheque");
        session.setCallback(new Callback());
        Intent open = new Intent(this, MainActivity.class);
        session.setSessionActivity(PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE));
        setSessionToken(session.getSessionToken());
        session.setActive(true); // les boutons de l'auto et du volant arrivent ici dès la connexion
        applyPhone();
        AudioAttributes attrs = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attrs).setOnAudioFocusChangeListener(this::onFocus, main).build();
        tts = new TextToSpeech(this, st -> {
            if (st != TextToSpeech.SUCCESS) return;
            int r = tts.setLanguage(Locale.CANADA_FRENCH);
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.FRENCH);
            tts.setAudioAttributes(attrs);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { main.post(() -> spoken(id)); }
                @Override public void onError(String id) { main.post(() -> spoken(id)); }
            });
            ttsReady = true;
            if (playing) main.post(this::speak);
        });
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CH, "Lecture audio", NotificationManager.IMPORTANCE_LOW));
    }

    @Override
    public void onDestroy() {
        save();
        instance = null;
        if (tts != null) { tts.stop(); tts.shutdown(); }
        session.release();
        super.onDestroy();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) { return START_NOT_STICKY; }

    // ---------------------------------------------------------------- navigation (ce qu'Android Auto affiche)
    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        Bundle extras = new Bundle();
        extras.putBoolean(STYLE_SUPPORTED, true);
        extras.putInt(STYLE_BROWSABLE, STYLE_GRID);
        extras.putInt(STYLE_PLAYABLE, STYLE_GRID);
        return new BrowserRoot(ROOT, extras);
    }

    @Override
    public void onLoadChildren(String parentId, Result<List<MediaItem>> result) {
        List<MediaItem> out = new ArrayList<>();
        JSONObject cat = catalog();
        JSONArray books = cat.optJSONArray("books"); if (books == null) books = new JSONArray();
        JSONArray libs = cat.optJSONArray("libs"); if (libs == null) libs = new JSONArray();
        if (ROOT.equals(parentId)) {
            // onglets : « En cours » puis chaque bibliothèque.
            // Android Auto n'affiche que 4 onglets : au-delà de 3 bibliothèques, elles passent toutes dans l'onglet « Bibliothèques ».
            out.add(folder("recent", "En cours"));
            if (libs.length() <= MAX_TABS - 1) {
                for (int i = 0; i < libs.length(); i++) {
                    JSONObject l = libs.optJSONObject(i);
                    if (l != null) out.add(folder("lib:" + l.optString("id"), l.optString("name")));
                }
            } else {
                out.add(folder("libs", "Bibliothèques"));
            }
            if (books.length() == 0) out.clear();
            if (out.isEmpty()) out.add(info("Ouvre la Bibliothèque sur ton téléphone pour y ajouter tes livres."));
        } else if ("libs".equals(parentId)) {
            for (int i = 0; i < libs.length(); i++) {
                JSONObject l = libs.optJSONObject(i);
                if (l != null) out.add(folder("lib:" + l.optString("id"), l.optString("name")));
            }
            out.add(folder("all", "Toutes ensemble"));
        } else if ("all".equals(parentId)) {
            for (int i = 0; i < books.length(); i++) { JSONObject b = books.optJSONObject(i); if (b != null) out.add(book(b)); }
            if (out.isEmpty()) out.add(info("Aucun livre pour l'instant."));
        } else if ("recent".equals(parentId)) {
            List<JSONObject> list = new ArrayList<>();
            for (int i = 0; i < books.length(); i++) { JSONObject b = books.optJSONObject(i); if (b != null && b.optLong("last") > 0) list.add(b); }
            list.sort((a, b) -> Long.compare(b.optLong("last"), a.optLong("last")));
            for (int i = 0; i < Math.min(30, list.size()); i++) out.add(book(list.get(i)));
            if (out.isEmpty()) out.add(info("Aucune lecture en cours. Choisis un livre dans une bibliothèque."));
        } else if (parentId.startsWith("lib:")) {
            String lib = parentId.substring(4);
            for (int i = 0; i < books.length(); i++) { JSONObject b = books.optJSONObject(i); if (b != null && lib.equals(b.optString("lib"))) out.add(book(b)); }
            if (out.isEmpty()) out.add(info("Cette bibliothèque est vide."));
        }
        result.sendResult(out);
    }

    /** Le téléphone a réécrit le catalogue : l'auto doit recharger ses onglets et leurs livres. */
    static void catalogChanged() {
        LivreService s = instance; if (s == null) return;
        s.main.post(() -> {
            JSONArray libs = s.catalog().optJSONArray("libs");
            s.notifyChildrenChanged(ROOT);
            s.notifyChildrenChanged("recent");
            s.notifyChildrenChanged("libs");
            s.notifyChildrenChanged("all");
            if (libs != null) for (int i = 0; i < libs.length(); i++) {
                JSONObject l = libs.optJSONObject(i);
                if (l != null) s.notifyChildrenChanged("lib:" + l.optString("id"));
            }
        });
    }

    private MediaItem folder(String id, String name) {
        Bundle ex = new Bundle();
        ex.putInt(STYLE_PLAYABLE, STYLE_GRID);
        MediaDescription d = new MediaDescription.Builder().setMediaId(id).setTitle(name).setExtras(ex).build();
        return new MediaItem(d, MediaItem.FLAG_BROWSABLE);
    }

    private MediaItem info(String text) {
        return new MediaItem(new MediaDescription.Builder().setMediaId("info").setTitle(text).build(), MediaItem.FLAG_BROWSABLE);
    }

    private MediaItem book(JSONObject b) {
        String id = b.optString("id");
        boolean ready = new File(dir(), "books/" + id + ".json").exists();
        String sub = !ready ? "En préparation sur le téléphone…" : b.optString("author", "");
        MediaDescription.Builder d = new MediaDescription.Builder().setMediaId("book:" + id).setTitle(b.optString("title")).setSubtitle(sub);
        String cover = b.optString("cover", "");
        if (!cover.isEmpty() && new File(dir(), cover).exists()) d.setIconUri(Uri.parse("content://" + Couvertures.AUTH + "/" + Uri.encode(new File(cover).getName())));
        return new MediaItem(d.build(), MediaItem.FLAG_PLAYABLE);
    }

    // ---------------------------------------------------------------- lecture
    private class Callback extends MediaSession.Callback {
        @Override public void onPlayFromMediaId(String mediaId, Bundle extras) { if (mediaId != null && mediaId.startsWith("book:")) start(mediaId.substring(5)); }
        @Override public void onPlay() {
            if (toPhone("play", 0)) return;
            if (bookId != null) { play(); return; }
            String last = lastBookId();
            if (last != null) start(last); else error("Choisis un livre dans une bibliothèque.");
        }
        @Override public void onPause() { if (!toPhone("pause", 0)) pause(); }
        @Override public void onStop() { if (toPhone("pause", 0)) return; pause(); stopForeground(STOP_FOREGROUND_DETACH); }
        @Override public void onSkipToNext() { move(30); }
        @Override public void onSkipToPrevious() { move(-30); }
        @Override public void onFastForward() { move(30); }
        @Override public void onRewind() { move(-30); }
        @Override public void onSeekTo(long ms) { if (!remote) seekChars((long) (ms / 1000f * CPS * rate)); }
        @Override public void onCustomAction(String action, Bundle extras) {
            if ("m180".equals(action)) move(-180); else if ("p180".equals(action)) move(180); else if ("p600".equals(action)) move(600); else if ("m600".equals(action)) move(-600);
        }
        @Override public void onPlayFromSearch(String query, Bundle extras) {
            JSONArray books = catalog().optJSONArray("books");
            if (books == null || books.length() == 0) return;
            String q = query == null ? "" : query.toLowerCase(Locale.ROOT).trim();
            if (q.isEmpty()) { String last = lastBookId(); if (last != null) start(last); return; }
            for (int i = 0; i < books.length(); i++) {
                JSONObject b = books.optJSONObject(i);
                if (b != null && (b.optString("title").toLowerCase(Locale.ROOT).contains(q) || q.contains(b.optString("title").toLowerCase(Locale.ROOT)))) { start(b.optString("id")); return; }
            }
        }
    }

    /** Avancer / reculer : dans le lecteur du téléphone s'il lit, sinon ici. */
    private void move(int sec) { if (!toPhone("jump", sec)) jump(sec); }

    /** Si la lecture en cours est celle du téléphone, la commande lui est transmise. */
    private boolean toPhone(String cmd, int sec) {
        if (!remote || playing) return false;
        if (!MainActivity.autoCmd(cmd, String.valueOf(sec))) { remote = false; updateState(); return false; }
        if ("play".equals(cmd)) { remotePlaying = true; updateState(); }
        else if ("pause".equals(cmd)) { remotePlaying = false; updateState(); }
        return true;
    }

    /** Appelé par le téléphone : ce qu'il lit, ou "" quand son lecteur se ferme. */
    static void phoneState(String json) {
        phoneJson = json == null ? "" : json;
        LivreService s = instance; if (s != null) s.main.post(s::applyPhone);
    }

    private void applyPhone() {
        JSONObject p = null;
        try { if (!phoneJson.isEmpty()) p = new JSONObject(phoneJson); } catch (Exception ignored) { }
        if (p == null) {
            if (remote) { remote = false; remotePlaying = false; if (bookId != null) updateMeta(); else session.setMetadata(null); }
            updateState();
            return;
        }
        if (playing && !p.optBoolean("playing")) { updateState(); return; } // l'auto lit déjà son propre livre
        remote = true;
        remotePlaying = p.optBoolean("playing");
        if (!p.optString("id").equals(remoteId)) {
            remoteId = p.optString("id");
            MediaMetadata.Builder m = new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_MEDIA_ID, "book:" + remoteId)
                .putString(MediaMetadata.METADATA_KEY_TITLE, p.optString("title"))
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, p.optString("title"))
                .putString(MediaMetadata.METADATA_KEY_ARTIST, p.optString("author"))
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, p.optString("author"));
            Bitmap cover = coverOf(remoteId);
            if (cover != null) { m.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, cover); m.putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON, cover); }
            session.setMetadata(m.build());
        }
        updateState();
    }

    private Bitmap coverOf(String id) {
        JSONArray books = catalog().optJSONArray("books"); if (books == null) return null;
        for (int i = 0; i < books.length(); i++) {
            JSONObject b = books.optJSONObject(i);
            if (b != null && id.equals(b.optString("id")) && !b.optString("cover", "").isEmpty()) return BitmapFactory.decodeFile(new File(dir(), b.optString("cover")).getPath());
        }
        return null;
    }

    private String lastBookId() {
        JSONArray books = catalog().optJSONArray("books"); if (books == null) return null;
        String best = null; long t = 0;
        for (int i = 0; i < books.length(); i++) { JSONObject b = books.optJSONObject(i); if (b != null && b.optLong("last") > t) { t = b.optLong("last"); best = b.optString("id"); } }
        return best;
    }

    private void start(String id) {
        if (remote) { MainActivity.autoCmd("pause", "0"); remote = false; remotePlaying = false; remoteId = null; } // l'auto prend le relais
        save();
        JSONObject meta = null;
        JSONArray books = catalog().optJSONArray("books");
        if (books != null) for (int i = 0; i < books.length(); i++) { JSONObject b = books.optJSONObject(i); if (b != null && id.equals(b.optString("id"))) meta = b; }
        String txt = read(new File(dir(), "books/" + id + ".json"));
        if (meta == null || txt == null) { error("Ce livre n'est pas encore prêt. Ouvre la Bibliothèque sur ton téléphone quelques instants."); return; }
        try {
            JSONObject data = new JSONObject(txt);
            JSONArray u = data.getJSONArray("u");
            units.clear(); marks.clear();
            for (int i = 0; i < u.length(); i++) { JSONArray x = u.getJSONArray(i); units.add(x.getString(0)); marks.add(x.getInt(1)); }
            if (units.isEmpty()) { error("Ce livre ne contient pas de texte lisible."); return; }
            isPdf = "pdf".equals(data.optString("kind"));
            startChars = new long[units.size() + 1];
            for (int i = 0; i < units.size(); i++) startChars[i + 1] = startChars[i] + units.get(i).length();
            totalChars = startChars[units.size()];
            bookId = id; title = meta.optString("title"); author = meta.optString("author"); libName = meta.optString("libName");
            rate = (float) catalog().optDouble("rate", 1.0);
            idx = startIndex(meta);
            art = null;
            String cover = meta.optString("cover", "");
            if (!cover.isEmpty()) {
                BitmapFactory.Options o = new BitmapFactory.Options(); o.inSampleSize = 1;
                art = BitmapFactory.decodeFile(new File(dir(), cover).getPath(), o);
            }
            updateMeta();
            play();
        } catch (Exception e) { error("Lecture du livre impossible."); }
    }

    /** Reprend là où le livre a été lu le plus récemment : dans l'auto ou sur le téléphone. */
    private int startIndex(JSONObject meta) {
        JSONObject prog = autoProgress().optJSONObject(bookId);
        long phoneLast = meta.optLong("last");
        if (prog != null && prog.optLong("t") >= phoneLast) return clamp(prog.optInt("i"));
        if (phoneLast == 0) return 0;
        if (isPdf) {
            int page = meta.optInt("page", 1);
            for (int i = 0; i < marks.size(); i++) if (marks.get(i) >= page) return i;
            return 0;
        }
        long pos = meta.optLong("pos", -1);
        if (pos < 0) return 0;
        int best = 0;
        for (int i = 0; i < marks.size(); i++) { if (marks.get(i) <= pos) best = i; else break; }
        return best;
    }

    private int clamp(int i) { return Math.max(0, Math.min(units.size() - 1, i)); }

    private void play() {
        if (bookId == null) return;
        if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { error("Le son est occupé par une autre application."); return; }
        playing = true;
        session.setActive(true);
        goForeground();
        updateState();
        speak();
    }

    private void pause() {
        playing = false; token++;
        if (tts != null) tts.stop();
        save();
        updateState();
        notifyNow();
    }

    /** L'application du téléphone commence sa propre lecture : on se tait. */
    static void pauseFromApp() { LivreService s = instance; if (s != null) s.main.post(() -> { if (s.playing) s.pause(); }); }

    private void speak() {
        if (!playing || !ttsReady || units.isEmpty()) return;
        int t = ++token;
        tts.setSpeechRate(rate);
        tts.speak(units.get(idx), TextToSpeech.QUEUE_FLUSH, new Bundle(), t + ":" + idx);
        updateState();
    }

    private void spoken(String uttId) {
        if (!playing || uttId == null || !uttId.startsWith(token + ":")) return;
        if (idx + 1 >= units.size()) { idx = units.size() - 1; pause(); error("Fin du livre."); return; }
        idx++;
        if (++sinceSave >= 8) save();
        speak();
    }

    private void jump(int sec) {
        if (units.isEmpty()) return;
        long target = startChars[idx] + (long) (sec * CPS * rate);
        seekChars(target);
    }

    private void seekChars(long target) {
        if (units.isEmpty()) return;
        target = Math.max(0, Math.min(totalChars - 1, target));
        int lo = 0, hi = units.size() - 1;
        while (lo < hi) { int mid = (lo + hi + 1) / 2; if (startChars[mid] <= target) lo = mid; else hi = mid - 1; }
        idx = lo;
        if (playing) { token++; tts.stop(); speak(); } else { save(); updateState(); }
    }

    private void onFocus(int change) {
        if (change == AudioManager.AUDIOFOCUS_LOSS) { resumeOnFocus = false; pause(); }
        else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) { if (playing) { resumeOnFocus = true; pause(); } }
        else if (change == AudioManager.AUDIOFOCUS_GAIN && resumeOnFocus) { resumeOnFocus = false; play(); }
    }

    // ---------------------------------------------------------------- position partagée avec le téléphone
    private JSONObject autoProgress() {
        String s = read(new File(dir(), "progress.json"));
        try { return s == null ? new JSONObject() : new JSONObject(s); } catch (Exception e) { return new JSONObject(); }
    }

    private void save() {
        sinceSave = 0;
        if (bookId == null || units.isEmpty()) return;
        try {
            JSONObject all = autoProgress();
            JSONObject p = new JSONObject();
            p.put("i", idx); p.put("t", System.currentTimeMillis());
            p.put(isPdf ? "page" : "pos", marks.get(idx));
            p.put("frac", totalChars == 0 ? 0 : (double) startChars[idx] / totalChars);
            all.put(bookId, p);
            File f = new File(dir(), "progress.json");
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(all.toString().getBytes(StandardCharsets.UTF_8)); }
        } catch (Exception ignored) { }
    }

    // ---------------------------------------------------------------- affichage dans l'auto
    private long posMs() { return units.isEmpty() ? 0 : (long) (startChars[idx] / (CPS * rate) * 1000); }

    private void updateState() {
        if (remote && !playing) {
            PlaybackState.Builder r = new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP
                    | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                    | PlaybackState.ACTION_PLAY_FROM_MEDIA_ID | PlaybackState.ACTION_PLAY_FROM_SEARCH | PlaybackState.ACTION_FAST_FORWARD | PlaybackState.ACTION_REWIND)
                .setState(remotePlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, remotePlaying ? 1f : 0f);
            r.addCustomAction(new PlaybackState.CustomAction.Builder("m180", "Reculer de 3 minutes", R.drawable.ic_moins3).build());
            r.addCustomAction(new PlaybackState.CustomAction.Builder("p180", "Avancer de 3 minutes", R.drawable.ic_plus3).build());
            r.addCustomAction(new PlaybackState.CustomAction.Builder("p600", "Avancer de 10 minutes", R.drawable.ic_plus10).build());
            session.setPlaybackState(r.build());
            return;
        }
        PlaybackState.Builder b = new PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO
                | PlaybackState.ACTION_PLAY_FROM_MEDIA_ID | PlaybackState.ACTION_PLAY_FROM_SEARCH | PlaybackState.ACTION_FAST_FORWARD | PlaybackState.ACTION_REWIND)
            .setState(bookId == null ? PlaybackState.STATE_NONE : playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, posMs(), playing ? rate : 0f);
        if (bookId != null) {
            b.addCustomAction(new PlaybackState.CustomAction.Builder("m180", "Reculer de 3 minutes", R.drawable.ic_moins3).build());
            b.addCustomAction(new PlaybackState.CustomAction.Builder("p180", "Avancer de 3 minutes", R.drawable.ic_plus3).build());
            b.addCustomAction(new PlaybackState.CustomAction.Builder("p600", "Avancer de 10 minutes", R.drawable.ic_plus10).build());
        }
        session.setPlaybackState(b.build());
    }

    private void updateMeta() {
        MediaMetadata.Builder m = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_MEDIA_ID, "book:" + bookId)
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, author)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, author)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, libName)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, (long) (totalChars / (CPS * rate) * 1000));
        if (art != null) { m.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art); m.putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON, art); }
        session.setMetadata(m.build());
    }

    private void error(String msg) {
        session.setPlaybackState(new PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_PLAY_FROM_MEDIA_ID | PlaybackState.ACTION_PLAY_FROM_SEARCH)
            .setState(PlaybackState.STATE_ERROR, 0, 0f).setErrorMessage(msg).build());
        main.postDelayed(this::updateState, 4000);
    }

    private Notification notification() {
        Notification.MediaStyle style = new Notification.MediaStyle().setMediaSession(session.getSessionToken());
        Notification.Builder n = new Notification.Builder(this, CH)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(title).setContentText(author)
            .setLargeIcon(art)
            .setStyle(style)
            .setOngoing(playing)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentIntent(PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE));
        return n.build();
    }

    private void goForeground() {
        try {
            startForegroundService(new Intent(this, LivreService.class));
            if (Build.VERSION.SDK_INT >= 29) startForeground(7, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(7, notification());
        } catch (Exception ignored) {
            // démarrage au premier plan refusé par Android : la lecture continue tant qu'Android Auto est connecté
        }
    }

    private void notifyNow() {
        try {
            if (!playing) stopForeground(STOP_FOREGROUND_DETACH);
            getSystemService(NotificationManager.class).notify(7, notification());
        } catch (Exception ignored) { }
    }
}
