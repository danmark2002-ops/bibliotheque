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

    // Le Professeur bizarroïde : un cours parlé (prof/<id>.json) joué avec une voix plus vivante
    private boolean prof;
    private final List<Integer> pauses = new ArrayList<>(); // 0 : fin de phrase, 1 : fin de paragraphe, 2 : fin de partie
    private final List<String> inter = new ArrayList<>();   // réponse à une question, dite avant de reprendre le cours
    private int interIdx;
    private android.speech.tts.Voice defaultVoice, profVoice;
    private android.speech.SpeechRecognizer ears;
    private boolean asking;
    private static final String PERSONA = "Tu es le Professeur bizarroïde : un professeur passionné, enjoué, un brin excentrique, qui adore partager les idées des livres. Tu parles à voix haute à un auditeur qui conduit.";

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
            try { defaultVoice = tts.getVoice(); profVoice = bestVoice(); } catch (Exception ignored) { }
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

    /** La voix française de meilleure qualité installée sur le téléphone (sans Internet, pour l'auto). */
    private android.speech.tts.Voice bestVoice() {
        android.speech.tts.Voice best = null; int bestScore = Integer.MIN_VALUE;
        java.util.Set<android.speech.tts.Voice> vs = tts.getVoices();
        if (vs == null) return null;
        for (android.speech.tts.Voice v : vs) {
            if (v.getLocale() == null || !"fr".equals(v.getLocale().getLanguage())) continue;
            if (v.getFeatures() != null && v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
            int score = v.getQuality() - v.getLatency() / 4;
            if (v.isNetworkConnectionRequired()) score -= 1000;
            if ("CA".equals(v.getLocale().getCountry())) score += 60;
            if (score > bestScore) { bestScore = score; best = v; }
        }
        return best;
    }

    @Override
    public void onDestroy() {
        save();
        instance = null;
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (ears != null) { try { ears.destroy(); } catch (Exception ignored) { } }
        session.release();
        super.onDestroy();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String cmd = intent == null ? null : intent.getStringExtra("cmd");
        String id = intent == null ? null : intent.getStringExtra("id");
        if ("prof".equals(cmd) && id != null) {
            if (("prof:" + id).equals(bookId)) { inter.clear(); if (!playing) play(); }
            else start("prof:" + id);
        } else if ("pause".equals(cmd)) {
            if (playing) pause();
        } else if ("answer".equals(cmd) && id != null) {
            String text = intent.getStringExtra("text");
            if (playing) { playing = false; token++; if (tts != null) tts.stop(); }
            setInter(text);
            if (("prof:" + id).equals(bookId)) play(); else start("prof:" + id);
        }
        return START_NOT_STICKY;
    }

    private void setInter(String text) {
        inter.clear(); interIdx = 0;
        if (text == null) return;
        for (String x : text.split("(?<=[.!?…])\\s+|\\n+")) if (!x.trim().isEmpty()) inter.add(x.trim());
    }

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
            JSONObject prog = autoProgress();
            for (int i = 0; i < books.length(); i++) { JSONObject b = books.optJSONObject(i); if (b != null && b.optBoolean("prof") && prog.has("prof:" + b.optString("id"))) out.add(profItem(b)); }
            for (int i = 0; i < Math.min(30, list.size()); i++) out.add(book(list.get(i)));
            if (out.isEmpty()) out.add(info("Aucune lecture en cours. Choisis un livre dans une bibliothèque."));
        } else if (parentId.startsWith("lib:")) {
            String lib = parentId.substring(4);
            for (int i = 0; i < books.length(); i++) { JSONObject b = books.optJSONObject(i); if (b != null && b.optBoolean("prof") && lib.equals(b.optString("lib"))) out.add(profItem(b)); }
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

    private MediaItem profItem(JSONObject b) {
        String id = b.optString("id");
        MediaDescription.Builder d = new MediaDescription.Builder().setMediaId("book:prof:" + id).setTitle("🎓 " + b.optString("title")).setSubtitle("Le Professeur bizarroïde");
        String cover = b.optString("cover", "");
        if (!cover.isEmpty() && new File(dir(), cover).exists()) d.setIconUri(Uri.parse("content://" + Couvertures.AUTH + "/" + Uri.encode(new File(cover).getName())));
        return new MediaItem(d.build(), MediaItem.FLAG_PLAYABLE);
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
            if ("ask".equals(action)) { askQuestion(); return; }
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
        boolean isProf = id.startsWith("prof:");
        String realId = isProf ? id.substring(5) : id;
        JSONObject meta = null;
        JSONArray books = catalog().optJSONArray("books");
        if (books != null) for (int i = 0; i < books.length(); i++) { JSONObject b = books.optJSONObject(i); if (b != null && realId.equals(b.optString("id"))) meta = b; }
        String txt = read(new File(dir(), (isProf ? "prof/" : "books/") + realId + ".json"));
        if (meta == null || txt == null) { inter.clear(); error(isProf ? "Le cours du Professeur n'est pas encore prêt. Prépare-le sur ton téléphone." : "Ce livre n'est pas encore prêt. Ouvre la Bibliothèque sur ton téléphone quelques instants."); return; }
        try {
            JSONObject data = new JSONObject(txt);
            JSONArray u = data.getJSONArray("u");
            units.clear(); marks.clear(); pauses.clear();
            for (int i = 0; i < u.length(); i++) { JSONArray x = u.getJSONArray(i); units.add(x.getString(0)); marks.add(x.getInt(1)); pauses.add(x.optInt(2, 0)); }
            prof = isProf;
            if (units.isEmpty()) { error("Ce livre ne contient pas de texte lisible."); return; }
            isPdf = "pdf".equals(data.optString("kind"));
            startChars = new long[units.size() + 1];
            for (int i = 0; i < units.size(); i++) startChars[i + 1] = startChars[i] + units.get(i).length();
            totalChars = startChars[units.size()];
            bookId = id; title = (isProf ? "🎓 " : "") + meta.optString("title"); author = isProf ? "Le Professeur bizarroïde" : meta.optString("author"); libName = meta.optString("libName");
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
        if (prof) return prog == null ? 0 : clamp(prog.optInt("i"));
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
        if (asking) { asking = false; if (ears != null) try { ears.cancel(); } catch (Exception ignored) { } }
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
        try {
            android.speech.tts.Voice v = prof && profVoice != null ? profVoice : defaultVoice;
            if (v != null && !v.equals(tts.getVoice())) tts.setVoice(v);
        } catch (Exception ignored) { }
        if (interIdx < inter.size()) {
            String x = inter.get(interIdx);
            expressive(x, interIdx);
            tts.speak(x, TextToSpeech.QUEUE_FLUSH, new Bundle(), t + ":q" + interIdx);
            updateState();
            return;
        }
        String x = units.get(idx);
        if (prof) expressive(x, idx); else { tts.setPitch(1f); tts.setSpeechRate(rate); }
        tts.speak(x, TextToSpeech.QUEUE_FLUSH, new Bundle(), t + ":" + idx);
        updateState();
    }

    /** Une voix moins monotone : l'intonation et le débit suivent le sens de chaque phrase. */
    private void expressive(String x, int n) {
        String s = x.trim();
        float pitch = 1.07f + (((n * 37) % 7) - 3) * 0.012f, r = rate;
        if (s.endsWith("!") || s.endsWith("! »")) { pitch = 1.18f; r = rate * 1.07f; }
        else if (s.endsWith("?") || s.endsWith("? »")) { pitch = 1.14f; r = rate * 0.98f; }
        if (s.matches("(?i)^(ah|oh|eh|ha|hé|voilà|imaginez|imagine|attention|tenez|tiens|écoutez|écoute|alors|et voilà|incroyable|fascinant)(?=[\\s,!.…]).*")) pitch += 0.05f;
        if (s.length() > 180 || s.contains(":")) r *= 0.94f;
        tts.setPitch(Math.max(0.9f, Math.min(1.3f, pitch)));
        tts.setSpeechRate(Math.max(0.5f, Math.min(2.5f, r)));
    }

    private void spoken(String uttId) {
        if ("listen".equals(uttId)) { if (asking) listen(); return; }
        if ("wait".equals(uttId)) return;
        if (!playing || uttId == null || !uttId.startsWith(token + ":")) return;
        if (uttId.startsWith(token + ":q")) {
            interIdx++;
            if (interIdx >= inter.size()) { inter.clear(); interIdx = 0; main.postDelayed(gap(++token), 700); return; }
            speak();
            return;
        }
        if (idx + 1 >= units.size()) { idx = units.size() - 1; pause(); error(prof ? "Fin du cours." : "Fin du livre."); return; }
        int pauseKind = prof && idx < pauses.size() ? pauses.get(idx) : 0;
        idx++;
        if (++sinceSave >= 8) save();
        if (!prof) { speak(); return; }
        // le Professeur respire : petite pause entre les phrases, plus longue entre les paragraphes et les parties
        main.postDelayed(gap(++token), pauseKind == 2 ? 1100 : pauseKind == 1 ? 500 : 140);
    }

    // ---------------------------------------------------------------- questions au Professeur, depuis l'auto
    private void askQuestion() {
        if (!prof || bookId == null || asking) return;
        if (playing) { playing = false; token++; if (tts != null) tts.stop(); }
        inter.clear(); interIdx = 0;
        asking = true;
        updateState();
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            asking = false;
            setInter("Pour me poser des questions dans l'auto, autorise d'abord le micro : ouvre le Professeur dans la Bibliothèque, sur ton téléphone. Je reprends le cours !");
            play();
            return;
        }
        try { if (Build.VERSION.SDK_INT >= 30) startForeground(7, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK | ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE); } catch (Exception ignored) { }
        say("Oui ? Je t'écoute !", "listen");
    }

    private void say(String text, String id) {
        if (!ttsReady) { if ("listen".equals(id)) listen(); return; }
        try { if (profVoice != null) tts.setVoice(profVoice); } catch (Exception ignored) { }
        expressive(text, 0);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), id);
    }

    private void listen() {
        if (!android.speech.SpeechRecognizer.isRecognitionAvailable(this)) { heard(null); return; }
        if (ears == null) {
            ears = android.speech.SpeechRecognizer.createSpeechRecognizer(this);
            ears.setRecognitionListener(new android.speech.RecognitionListener() {
                @Override public void onResults(Bundle r) {
                    java.util.ArrayList<String> l = r.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION);
                    heard(l == null || l.isEmpty() ? null : l.get(0));
                }
                @Override public void onError(int error) { heard(null); }
                @Override public void onReadyForSpeech(Bundle p) { }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float v) { }
                @Override public void onBufferReceived(byte[] b) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onPartialResults(Bundle p) { }
                @Override public void onEvent(int t, Bundle p) { }
            });
        }
        Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "fr-CA");
        try { ears.startListening(i); } catch (Exception e) { heard(null); }
    }

    private void heard(String q) {
        if (!asking) return;
        if (q == null || q.trim().isEmpty()) {
            asking = false;
            setInter("Hmm, je ne t'ai pas bien entendu. Tu pourras réessayer avec le bouton Question. Je reprends le cours !");
            play();
            return;
        }
        say("Ah ! Bonne question… Laisse-moi réfléchir un instant.", "wait");
        final String id = bookId.substring(5), title = this.title.replace("🎓 ", "");
        final int part = idx < marks.size() ? marks.get(idx) : 0;
        new Thread(() -> {
            String answer;
            try {
                JSONArray parts = new JSONObject(read(new File(dir(), "prof/" + id + ".json"))).optJSONArray("parts");
                StringBuilder ctx = new StringBuilder();
                if (parts != null) for (int k = Math.max(0, part - 1); k <= Math.min(part, parts.length() - 1); k++) ctx.append(parts.optString(k)).append("\n\n");
                answer = IaGratuite.ask(PERSONA, "L'auditeur t'interrompt pendant ton explication du livre « " + title + " » pour te poser une question.\n"
                    + "Voici ce que tu étais en train d'expliquer :\n" + ctx
                    + "\nRéponds en 3 à 6 phrases, avec entrain, comme à voix haute : pas de listes ni de symboles.\n"
                    + "Si la réponse n'est pas dans le livre, dis-le franchement, puis donne ton propre éclairage en précisant que c'est ton avis.\n"
                    + "Termine en annonçant, en quelques mots, que tu reprends le cours.\n\nQuestion : " + q);
                answer = answer.replaceAll("(?m)^\\s*#+.*$", "").replaceAll("(?m)^\\s*[-*•]\\s+", "").replaceAll("\\*\\*?|__|`", "");
            } catch (Exception e) {
                answer = "Oh là là, je n'arrive pas à joindre mon cerveau en ligne pour l'instant. Vérifie la connexion Internet du téléphone. Je reprends le cours !";
            }
            final String a = answer;
            main.post(() -> { if (!asking) return; asking = false; setInter(a); play(); });
        }).start();
    }

    private Runnable gap(int t) { return () -> { if (playing && t == token) speak(); }; }

    private void jump(int sec) {
        if (units.isEmpty()) return;
        long target = startChars[idx] + (long) (sec * CPS * rate);
        seekChars(target);
    }

    private void seekChars(long target) {
        if (units.isEmpty()) return;
        inter.clear(); interIdx = 0;
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
        if (bookId != null && prof) b.addCustomAction(new PlaybackState.CustomAction.Builder("ask", "Poser une question", R.drawable.ic_question).build());
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
