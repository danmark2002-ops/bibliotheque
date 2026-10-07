package ca.bibliotheque.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.media.Image;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Condensé vidéo d'un livre, fabriqué entièrement sur le téléphone :
 * scénario (écrit par Gemini côté application) → images libres (Wikimedia Commons, Openverse), choisies par Gemini
 * → voix du Professeur phrase par phrase → montage MP4 (H.264 + AAC) avec zoom lent, phrase choc et sous-titres.
 */
final class VideoMaker {
    interface Progress { void on(String stage, double frac, String msg); }

    static final int W = 1280, H = 720, FPS = 12;
    private static final String UA = "BibliothequeApp/3.9 (application de lecture personnelle; Android)";
    static volatile boolean cancel;

    private VideoMaker() { }

    static File dir(Context c) { File d = new File(c.getFilesDir(), "videos"); d.mkdirs(); return d; }
    static File out(Context c, String id) { return new File(dir(c), "video-" + id + ".mp4"); }

    // ------------------------------------------------------------------ données du montage
    private static final class Scene { String phrase; final List<String> sentences = new ArrayList<>(); final List<String> queries = new ArrayList<>(); File img1, img2; long startUs, endUs; }
    private static final class Seg { int scene; String text; long startUs, endUs; }

    static void make(Context ctx, String id, String title, String author, JSONObject script, Progress p) throws Exception {
        cancel = false;
        File work = new File(ctx.getCacheDir(), "video-work-" + id);
        deleteAll(work); work.mkdirs();
        try {
            // 1. scènes
            List<Scene> scenes = new ArrayList<>();
            JSONArray arr = script.optJSONArray("scenes");
            if (arr == null || arr.length() == 0) throw new Exception("Le scénario est vide.");
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i); if (o == null) continue;
                Scene s = new Scene();
                s.phrase = o.optString("phrase", "").trim();
                for (String x : splitSentences(o.optString("narration", ""))) s.sentences.add(x);
                JSONArray q = o.optJSONArray("images");
                if (q != null) for (int k = 0; k < q.length(); k++) if (!q.optString(k).trim().isEmpty()) s.queries.add(q.optString(k).trim());
                if (s.queries.isEmpty() && !s.phrase.isEmpty()) s.queries.add(s.phrase);
                if (!s.sentences.isEmpty()) scenes.add(s);
            }
            if (scenes.isEmpty()) throw new Exception("Le scénario ne contient pas de narration.");

            // 2. images
            Set<String> used = new HashSet<>();
            // images déjà vues dans les vidéos précédentes : on les évite tant qu'il y a d'autres choix
            Set<String> seenBefore = loadHistory(ctx);
            for (int i = 0; i < scenes.size(); i++) {
                check();
                p.on("images", (double) i / scenes.size(), "Recherche des images… scène " + (i + 1) + " sur " + scenes.size());
                Scene s = scenes.get(i);
                List<File> got = new ArrayList<>();
                List<String> gotUrl = new ArrayList<>();
                List<String> cands = new ArrayList<>();
                for (String q : s.queries) for (String u : searchImages(q)) if (!cands.contains(u)) cands.add(u);
                // on télécharge jusqu'à 8 candidates, puis Gemini les regarde et garde les 2 qui illustrent le mieux la scène
                for (int pass = 0; pass < 2 && got.size() < PICK_FROM; pass++) {
                    for (String url : cands) {
                        if (got.size() >= PICK_FROM) break;
                        if (used.contains(url) || gotUrl.contains(url) || (pass == 0 && seenBefore.contains(key(url)))) continue;
                        File f = new File(work, "img-" + i + "-" + got.size() + ".jpg");
                        if (downloadImage(url, f)) { got.add(f); gotUrl.add(url); }
                        else used.add(url);
                    }
                }
                if (got.size() > 2) {
                    p.on("images", (double) i / scenes.size(), "Gemini choisit les meilleures images… scène " + (i + 1) + " sur " + scenes.size());
                    int[] best = pickBest(ctx, s, got);
                    if (best != null) {
                        List<File> g2 = new ArrayList<>(); List<String> u2 = new ArrayList<>();
                        for (int k : best) if (k >= 0 && k < got.size() && !g2.contains(got.get(k))) { g2.add(got.get(k)); u2.add(gotUrl.get(k)); }
                        for (int k = 0; k < got.size() && g2.size() < 2; k++) if (!g2.contains(got.get(k))) { g2.add(got.get(k)); u2.add(gotUrl.get(k)); }
                        got = g2; gotUrl = u2;
                    }
                }
                for (int k = 0; k < Math.min(2, gotUrl.size()); k++) used.add(gotUrl.get(k));
                if (!got.isEmpty()) s.img1 = got.get(0);
                if (got.size() > 1) s.img2 = got.get(1);
            }

            // 3. voix
            File pcm = new File(work, "voix.pcm");
            List<Seg> segs = new ArrayList<>();
            int[] rateOut = new int[1];
            long totalUs = speakAll(ctx, title, scenes, segs, pcm, rateOut, p);
            int sampleRate = rateOut[0];

            // 4. montage
            File tmp = new File(dir(ctx), "video-" + id + ".tmp.mp4");
            encode(tmp, pcm, sampleRate, totalUs, title, author, scenes, segs, p);
            File fin = out(ctx, id);
            if (fin.exists()) fin.delete();
            if (!tmp.renameTo(fin)) throw new Exception("Enregistrement de la vidéo impossible.");
            saveHistory(ctx, used);
            p.on("done", 1, "Vidéo prête");
        } finally {
            deleteAll(work);
        }
    }

    private static void check() throws Exception { if (cancel) throw new Exception("Création de la vidéo annulée."); }

    private static void deleteAll(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteAll(k);
        f.delete();
    }

    static List<String> splitSentences(String text) {
        List<String> out = new ArrayList<>();
        String t = text.replace("\r", " ").replaceAll("\\s+", " ").trim();
        if (t.isEmpty()) return out;
        for (String x : t.split("(?<=[.!?…])\\s+")) {
            String y = x.trim();
            while (y.length() > 220) { int c = y.lastIndexOf(", ", 200); if (c < 60) c = y.lastIndexOf(' ', 210); if (c < 1) c = 210; out.add(y.substring(0, c + 1).trim()); y = y.substring(c + 1).trim(); }
            if (!y.isEmpty()) out.add(y);
        }
        return out;
    }

    // ------------------------------------------------------------------ choix des images par Gemini (gratuit)
    private static final int PICK_FROM = 8;

    /** Montre à Gemini les images candidates (petites vignettes) avec la narration ; il rend les 2 meilleures, dans l'ordre. */
    private static int[] pickBest(Context ctx, Scene s, List<File> imgs) {
        try {
            List<byte[]> thumbs = new ArrayList<>();
            for (File f : imgs) {
                BitmapFactory.Options o = new BitmapFactory.Options(); o.inSampleSize = 4;
                Bitmap b = BitmapFactory.decodeFile(f.getPath(), o);
                if (b == null) { thumbs.add(new byte[0]); continue; }
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                b.compress(Bitmap.CompressFormat.JPEG, 70, out); b.recycle();
                thumbs.add(out.toByteArray());
            }
            String prompt = "Tu es directeur artistique pour une vidéo qui résume un livre. Voici une scène :\n"
                + "Phrase choc : " + s.phrase + "\nNarration : " + String.join(" ", s.sentences)
                + "\n\nVoici " + imgs.size() + " images candidates, numérotées de 0 à " + (imgs.size() - 1) + " dans l'ordre."
                + " Choisis les 2 images qui illustrent le mieux et le plus précisément CETTE narration (sujet, idée, époque, ambiance),"
                + " les plus belles et nettes. Écarte les images hors sujet, floues, avec beaucoup de texte, des logos, des schémas illisibles ou des cadres."
                + " Réponds seulement en JSON : {\"best\":[numéro, numéro]}";
            String r = IaGratuite.pickImages(ctx, prompt, thumbs);
            JSONArray a = new JSONObject(r.substring(r.indexOf('{'), r.lastIndexOf('}') + 1)).optJSONArray("best");
            if (a == null || a.length() == 0) return null;
            int[] out = new int[Math.min(2, a.length())];
            for (int k = 0; k < out.length; k++) out[k] = a.optInt(k, -1);
            return out;
        } catch (Throwable e) { return null; } // sans réponse : on garde les premières trouvées, comme avant
    }

    // ------------------------------------------------------------------ images libres
    private static String get(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(15000); c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", UA);
            if (c.getResponseCode() >= 400) return "";
            try (InputStream in = c.getInputStream()) {
                ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
                while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
                return b.toString("UTF-8");
            }
        } finally { c.disconnect(); }
    }

    /** Adresses d'images pour une recherche : Wikimedia Commons d'abord, Openverse ensuite. */
    // ---- mémoire des images déjà utilisées (les 2000 dernières)
    private static File historyFile(Context c) { return new File(dir(c), "images-utilisees.txt"); }

    /** Même image, même si la taille demandée change dans l'adresse. */
    private static String key(String url) { return url.replaceAll("/\\d+px-", "/").replaceAll("[?#].*$", ""); }

    private static Set<String> loadHistory(Context c) {
        Set<String> h = new HashSet<>();
        try { for (String l : new String(java.nio.file.Files.readAllBytes(historyFile(c).toPath()), "UTF-8").split("\n")) if (!l.isEmpty()) h.add(l.trim()); } catch (Exception ignored) { }
        return h;
    }

    private static void saveHistory(Context c, Set<String> used) {
        try {
            List<String> lines = new ArrayList<>();
            File f = historyFile(c);
            if (f.exists()) for (String l : new String(java.nio.file.Files.readAllBytes(f.toPath()), "UTF-8").split("\n")) if (!l.isEmpty()) lines.add(l.trim());
            for (String u : used) { String k = key(u); if (!lines.contains(k)) lines.add(k); }
            if (lines.size() > 2000) lines = lines.subList(lines.size() - 2000, lines.size());
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(String.join("\n", lines).getBytes("UTF-8")); }
        } catch (Exception ignored) { }
    }

    /** Adresses d'images pour une recherche, variées d'une vidéo à l'autre : Wikimedia Commons et Openverse mélangés. */
    static List<String> searchImages(String q) {
        List<String> commons = new ArrayList<>(), open = new ArrayList<>();
        java.util.Random rnd = new java.util.Random();
        List<String> out = commons;
        try {
            String url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30"
                + "&gsrsearch=" + URLEncoder.encode(q + " filetype:bitmap", "UTF-8")
                + "&prop=imageinfo&iiprop=url%7Cmime%7Csize&iiurlwidth=1280";
            JSONObject pages = new JSONObject(get(url)).optJSONObject("query");
            pages = pages == null ? null : pages.optJSONObject("pages");
            if (pages != null) {
                List<JSONObject> list = new ArrayList<>();
                for (java.util.Iterator<String> it = pages.keys(); it.hasNext(); ) list.add(pages.getJSONObject(it.next()));
                list.sort((a, b) -> Integer.compare(a.optInt("index", 99), b.optInt("index", 99)));
                for (JSONObject pg : list) {
                    JSONArray ii = pg.optJSONArray("imageinfo"); if (ii == null || ii.length() == 0) continue;
                    JSONObject i = ii.getJSONObject(0);
                    String mime = i.optString("mime");
                    if (!mime.equals("image/jpeg") && !mime.equals("image/png")) continue;
                    int w = i.optInt("width"), h = i.optInt("height");
                    if (w < 700 || h < 400 || w < h * 0.9) continue; // plutôt des images larges, comme l'écran
                    String u = i.optString("thumburl", i.optString("url"));
                    if (!u.isEmpty()) out.add(u);
                }
            }
        } catch (Exception ignored) { }
        {
            out = open;
            try {
                String url = "https://api.openverse.org/v1/images/?page_size=20&mature=false&aspect_ratio=wide&page=" + (1 + rnd.nextInt(2)) + "&q=" + URLEncoder.encode(q, "UTF-8");
                JSONArray res = new JSONObject(get(url)).optJSONArray("results");
                if (res != null) for (int i = 0; i < res.length(); i++) {
                    JSONObject r = res.getJSONObject(i);
                    String u = r.optString("thumbnail", "");
                    if (r.optInt("width") >= 1000) u = r.optString("url", u);
                    if (!u.isEmpty()) out.add(u);
                }
            } catch (Exception ignored) { }
        }
        // un peu de hasard parmi les résultats pertinents, puis on alterne les deux sources
        java.util.Collections.shuffle(commons, rnd);
        java.util.Collections.shuffle(open, rnd);
        List<String> mix = new ArrayList<>();
        for (int i = 0; i < Math.max(commons.size(), open.size()); i++) {
            if (i < commons.size()) mix.add(commons.get(i));
            if (i < open.size()) mix.add(open.get(i));
        }
        return mix;
    }

    /** Télécharge, recadre au format de l'écran (16:9) et enregistre en JPEG. */
    private static boolean downloadImage(String url, File dest) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            byte[] data;
            try {
                c.setConnectTimeout(15000); c.setReadTimeout(30000);
                c.setRequestProperty("User-Agent", UA);
                c.setInstanceFollowRedirects(true);
                if (c.getResponseCode() >= 400) return false;
                try (InputStream in = c.getInputStream()) {
                    ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[16384]; int n; int total = 0;
                    while ((n = in.read(buf)) > 0) { b.write(buf, 0, n); total += n; if (total > 20_000_000) return false; }
                    data = b.toByteArray();
                }
            } finally { c.disconnect(); }
            BitmapFactory.Options o = new BitmapFactory.Options(); o.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, o);
            if (o.outWidth < 500 || o.outHeight < 300) return false;
            int sample = 1; while (o.outWidth / (sample * 2) >= W && o.outHeight / (sample * 2) >= H) sample *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options(); o2.inSampleSize = sample;
            Bitmap src = BitmapFactory.decodeByteArray(data, 0, data.length, o2);
            if (src == null) return false;
            Bitmap cov = cover(src, (int) (W * 1.12), (int) (H * 1.12)); // marge pour le zoom lent
            src.recycle();
            try (FileOutputStream f = new FileOutputStream(dest)) { cov.compress(Bitmap.CompressFormat.JPEG, 88, f); }
            cov.recycle();
            return true;
        } catch (Throwable e) { return false; }
    }

    private static Bitmap cover(Bitmap src, int w, int h) {
        float s = Math.max((float) w / src.getWidth(), (float) h / src.getHeight());
        int sw = Math.round(w / s), sh = Math.round(h / s);
        int x = (src.getWidth() - sw) / 2, y = (src.getHeight() - sh) / 2;
        Bitmap out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        new Canvas(out).drawBitmap(src, new Rect(x, y, x + sw, y + sh), new Rect(0, 0, w, h), new Paint(Paint.FILTER_BITMAP_FLAG));
        return out;
    }

    // ------------------------------------------------------------------ voix
    private static TextToSpeech tts;
    private static volatile boolean ttsOk;

    private static Voice voiceFor(Context ctx) {
        String name = ctx.getSharedPreferences("ia", Context.MODE_PRIVATE).getString("voice", "");
        Voice best = null; int bestScore = Integer.MIN_VALUE;
        if (tts.getVoices() == null) return null;
        for (Voice v : tts.getVoices()) {
            if (!name.isEmpty() && name.equals(v.getName())) return v;
            if (v.getLocale() == null || !"fr".equals(v.getLocale().getLanguage())) continue;
            if (v.getFeatures() != null && v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
            int score = v.getQuality() - v.getLatency() / 4 - (v.isNetworkConnectionRequired() ? 1000 : 0) + ("CA".equals(v.getLocale().getCountry()) ? 60 : 0);
            if (score > bestScore) { bestScore = score; best = v; }
        }
        return best;
    }

    /** Synthétise chaque phrase, assemble la piste audio (PCM 16 bits mono) et la chronologie. Renvoie la durée totale. */
    private static long speakAll(Context ctx, String title, List<Scene> scenes, List<Seg> segs, File pcm, int[] rateOut, Progress p) throws Exception {
        CountDownLatch init = new CountDownLatch(1);
        ttsOk = false;
        android.os.Handler mainH = new android.os.Handler(android.os.Looper.getMainLooper());
        mainH.post(() -> tts = new TextToSpeech(ctx.getApplicationContext(), st -> { ttsOk = st == TextToSpeech.SUCCESS; init.countDown(); }));
        if (!init.await(20, TimeUnit.SECONDS) || !ttsOk) throw new Exception("La voix du téléphone n'est pas disponible.");
        try {
            int r = tts.setLanguage(Locale.CANADA_FRENCH);
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.FRENCH);
            Voice v = voiceFor(ctx); if (v != null) tts.setVoice(v);
            final String[] waiting = {null};
            final CountDownLatch[] done = {null};
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String u) { }
                @Override public void onDone(String u) { if (u.equals(waiting[0]) && done[0] != null) done[0].countDown(); }
                @Override public void onError(String u) { if (u.equals(waiting[0]) && done[0] != null) done[0].countDown(); }
            });
            int sampleRate = 0;
            long writtenSamples = 0;
            int total = 0; for (Scene s : scenes) total += s.sentences.size();
            int count = 0;
            try (FileOutputStream out = new FileOutputStream(pcm)) {
                // carte de titre : 3 s de silence (fixé quand on connaît la fréquence)
                long titleUs = 3_000_000;
                boolean titleWritten = false;
                for (int si = 0; si < scenes.size(); si++) {
                    Scene s = scenes.get(si);
                    for (int k = 0; k < s.sentences.size(); k++) {
                        check();
                        String text = s.sentences.get(k);
                        p.on("voice", (double) count / Math.max(1, total), "Enregistrement de la voix… phrase " + (++count) + " sur " + total);
                        File wav = new File(pcm.getParentFile(), "s.wav");
                        if (wav.exists()) wav.delete();
                        expressive(text, count);
                        String uid = "v" + count;
                        waiting[0] = uid; done[0] = new CountDownLatch(1);
                        Bundle b = new Bundle();
                        int res = tts.synthesizeToFile(text, b, wav, uid);
                        if (res != TextToSpeech.SUCCESS || !done[0].await(60, TimeUnit.SECONDS)) continue;
                        Wav w = readWav(wav);
                        if (w == null || w.data.length == 0) continue;
                        // Le son de la vidéo est toujours fabriqué en 48 kHz, la fréquence native des téléphones et des lecteurs :
                        // la voix du téléphone sort en 22–24 kHz, et la conversion faite au moment de la lecture créait des pétillements.
                        if (sampleRate == 0) sampleRate = OUT_RATE;
                        byte[] data = fadeEdges(w.rate == sampleRate ? w.data : resample(w.data, w.rate, sampleRate), sampleRate);
                        if (!titleWritten) { writeSilence(out, usToSamples(titleUs, sampleRate)); writtenSamples += usToSamples(titleUs, sampleRate); titleWritten = true; }
                        if (k == 0) {
                            s.startUs = samplesToUs(writtenSamples, sampleRate);
                        }
                        Seg g = new Seg(); g.scene = si; g.text = text;
                        g.startUs = samplesToUs(writtenSamples, sampleRate);
                        out.write(data); writtenSamples += data.length / 2;
                        g.endUs = samplesToUs(writtenSamples, sampleRate);
                        segs.add(g);
                        long gap = k == s.sentences.size() - 1 ? 900_000 : (text.endsWith("…") ? 550_000 : 260_000);
                        writeSilence(out, usToSamples(gap, sampleRate)); writtenSamples += usToSamples(gap, sampleRate);
                    }
                    s.endUs = samplesToUs(writtenSamples, sampleRate);
                    if (s.startUs == 0 && si > 0) s.startUs = scenes.get(si - 1).endUs;
                }
                if (sampleRate == 0) throw new Exception("La voix du téléphone n'a rien produit.");
                // générique de fin : 5 s
                writeSilence(out, usToSamples(5_000_000, sampleRate)); writtenSamples += usToSamples(5_000_000, sampleRate);
            }
            rateOut[0] = sampleRate;
            return samplesToUs(writtenSamples, sampleRate);
        } finally {
            TextToSpeech t = tts; tts = null;
            mainH.post(() -> { try { t.shutdown(); } catch (Exception ignored) { } });
        }
    }

    private static void expressive(String s, int n) {
        float pitch = 1.1f + (((n * 37) % 7) - 3) * 0.02f, r = 1.05f + (((n * 53) % 5) - 2) * 0.03f;
        if (s.endsWith("!")) { pitch = 1.24f; r = 1.12f; }
        else if (s.endsWith("?")) { pitch = 1.2f; r = 1.0f; }
        else if (s.endsWith("…")) { pitch = 1.03f; r = 0.9f; }
        tts.setPitch(pitch); tts.setSpeechRate(r);
    }

    private static long usToSamples(long us, int rate) { return us * rate / 1_000_000L; }
    private static long samplesToUs(long samples, int rate) { return samples * 1_000_000L / rate; }

    private static void writeSilence(FileOutputStream out, long samples) throws Exception {
        byte[] z = new byte[8192];
        long bytes = samples * 2;
        while (bytes > 0) { int n = (int) Math.min(z.length, bytes); out.write(z, 0, n); bytes -= n; }
    }

    private static final class Wav { int rate; byte[] data; }

    /** Lit un WAV PCM 16 bits ; plusieurs canaux sont ramenés à un seul. */
    private static Wav readWav(File f) {
        try (RandomAccessFile raf = new RandomAccessFile(f, "r")) {
            byte[] all = new byte[(int) raf.length()]; raf.readFully(all);
            ByteBuffer bb = ByteBuffer.wrap(all).order(ByteOrder.LITTLE_ENDIAN);
            if (all.length < 44 || bb.getInt(0) != 0x46464952) return null; // "RIFF"
            int pos = 12, rate = 0, channels = 1, bits = 16;
            while (pos + 8 <= all.length) {
                int id = bb.getInt(pos), size = bb.getInt(pos + 4);
                if (id == 0x20746d66) { channels = bb.getShort(pos + 10); rate = bb.getInt(pos + 12); bits = bb.getShort(pos + 22); } // "fmt "
                else if (id == 0x61746164) { // "data"
                    int len = Math.min(size < 0 ? all.length : size, all.length - pos - 8);
                    if (bits != 16 || rate <= 0) return null;
                    byte[] d = new byte[len]; System.arraycopy(all, pos + 8, d, 0, len);
                    if (channels > 1) {
                        int frames = len / (2 * channels); byte[] m = new byte[frames * 2];
                        for (int i = 0; i < frames; i++) { m[2 * i] = d[2 * i * channels]; m[2 * i + 1] = d[2 * i * channels + 1]; }
                        d = m;
                    }
                    Wav w = new Wav(); w.rate = rate; w.data = d; return w;
                }
                pos += 8 + size + (size & 1);
            }
        } catch (Exception ignored) { }
        return null;
    }

    static final int OUT_RATE = 48000;

    /** Rééchantillonnage de qualité (filtre sinc fenêtré, 32 coefficients, 512 phases) : pas d'à-coups ni de repliement. */
    private static byte[] resample(byte[] d, int from, int to) {
        int n = d.length / 2;
        short[] x = new short[n];
        ByteBuffer.wrap(d).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(x);
        final int HALF = 16, PH = 512;
        double fc = Math.min(1.0, (double) to / from) * 0.94; // coupure un peu sous la moitié de la fréquence la plus basse
        float[][] tab = new float[PH + 1][2 * HALF];
        for (int p = 0; p <= PH; p++) {
            double frac = (double) p / PH; double sum = 0;
            for (int k = 0; k < 2 * HALF; k++) {
                double t = (k - HALF + 1) - frac; // position relative du coefficient
                double sinc = t == 0 ? 1 : Math.sin(Math.PI * fc * t) / (Math.PI * fc * t);
                double wv = 0.5 + 0.5 * Math.cos(Math.PI * t / HALF); if (Math.abs(t) >= HALF) wv = 0;
                tab[p][k] = (float) (fc * sinc * wv); sum += tab[p][k];
            }
            for (int k = 0; k < 2 * HALF; k++) tab[p][k] /= sum; // gain unitaire
        }
        int m = (int) ((long) n * to / from);
        byte[] out = new byte[m * 2];
        for (int i = 0; i < m; i++) {
            double pos = (double) i * from / to; int base = (int) Math.floor(pos);
            float[] c = tab[(int) Math.round((pos - base) * PH)];
            double acc = 0;
            for (int k = 0; k < 2 * HALF; k++) { int j = base + k - HALF + 1; if (j >= 0 && j < n) acc += c[k] * x[j]; }
            int v = (int) Math.round(acc); if (v > 32767) v = 32767; else if (v < -32768) v = -32768;
            out[2 * i] = (byte) v; out[2 * i + 1] = (byte) (v >> 8);
        }
        return out;
    }

    /** Début et fin de chaque phrase adoucis (4 ms) : aucun « clic » au raccord avec le silence. */
    private static byte[] fadeEdges(byte[] d, int rate) {
        int n = d.length / 2, f = Math.min(n / 2, rate * 4 / 1000);
        ByteBuffer bb = ByteBuffer.wrap(d).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < f; i++) {
            double g = (double) i / f;
            bb.putShort(2 * i, (short) Math.round(bb.getShort(2 * i) * g));
            int j = n - 1 - i; bb.putShort(2 * j, (short) Math.round(bb.getShort(2 * j) * g));
        }
        return d;
    }

    // ------------------------------------------------------------------ montage MP4
    private static final class Sample { byte[] data; long pts; int flags; }

    private static void encode(File dest, File pcm, int rate, long totalUs, String title, String author, List<Scene> scenes, List<Seg> segs, Progress p) throws Exception {
        // a) audio AAC, gardé en mémoire (léger : environ 0,5 Mo par minute)
        p.on("audio", 0, "Préparation du son…");
        List<Sample> audio = new ArrayList<>();
        MediaFormat audioFmt = encodeAudio(pcm, rate, audio);

        // b) vidéo H.264 image par image
        MediaFormat vf = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, W, H);
        vf.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible);
        vf.setInteger(MediaFormat.KEY_BIT_RATE, 2_500_000);
        vf.setInteger(MediaFormat.KEY_FRAME_RATE, FPS);
        vf.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2);
        MediaCodec enc = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
        enc.configure(vf, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        enc.start();
        MediaMuxer mux = new MediaMuxer(dest.getPath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        int vTrack = -1, aTrack = -1; boolean started = false; int ai = 0;
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();

        Frames fr = new Frames(title, author, scenes, segs, totalUs);
        long frames = totalUs * FPS / 1_000_000L + 1;
        int[] argb = new int[W * H];
        boolean inputDone = false, outputDone = false;
        long f = 0;
        try {
            while (!outputDone) {
                if (!inputDone) {
                    int idx = enc.dequeueInputBuffer(10_000);
                    if (idx >= 0) {
                        if (cancel) throw new Exception("Création de la vidéo annulée.");
                        long pts = f * 1_000_000L / FPS;
                        if (f >= frames) {
                            enc.queueInputBuffer(idx, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputDone = true;
                        } else {
                            Bitmap frame = fr.draw(pts);
                            frame.getPixels(argb, 0, W, 0, 0, W, H);
                            Image img = enc.getInputImage(idx);
                            int size = toYuv(argb, img);
                            enc.queueInputBuffer(idx, 0, size, pts, 0);
                            f++;
                            if (f % FPS == 0) p.on("encode", (double) f / frames, "Montage de la vidéo… " + Math.round(100.0 * f / frames) + " %");
                        }
                    }
                }
                int o = enc.dequeueOutputBuffer(info, 10_000);
                if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    vTrack = mux.addTrack(enc.getOutputFormat());
                    aTrack = mux.addTrack(audioFmt);
                    mux.start(); started = true;
                } else if (o >= 0) {
                    ByteBuffer ob = enc.getOutputBuffer(o);
                    if ((info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) info.size = 0;
                    if (info.size > 0 && started && ob != null) {
                        // le son est écrit au même rythme que l'image
                        while (ai < audio.size() && audio.get(ai).pts <= info.presentationTimeUs) { writeAudio(mux, aTrack, audio.get(ai)); ai++; }
                        ob.position(info.offset); ob.limit(info.offset + info.size);
                        mux.writeSampleData(vTrack, ob, info);
                    }
                    enc.releaseOutputBuffer(o, false);
                    if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outputDone = true;
                }
            }
            if (started) while (ai < audio.size()) { writeAudio(mux, aTrack, audio.get(ai)); ai++; }
        } finally {
            fr.release();
            try { enc.stop(); } catch (Exception ignored) { }
            enc.release();
            try { if (started) mux.stop(); } catch (Exception ignored) { }
            mux.release();
        }
        if (!started) throw new Exception("L'encodeur vidéo du téléphone n'a rien produit.");
    }

    private static void writeAudio(MediaMuxer mux, int track, Sample s) {
        MediaCodec.BufferInfo bi = new MediaCodec.BufferInfo();
        bi.set(0, s.data.length, s.pts, s.flags);
        mux.writeSampleData(track, ByteBuffer.wrap(s.data), bi);
    }

    private static MediaFormat encodeAudio(File pcm, int rate, List<Sample> out) throws Exception {
        MediaFormat af = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, rate, 1);
        af.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
        af.setInteger(MediaFormat.KEY_BIT_RATE, 128_000); // voix nette à 48 kHz
        af.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384);
        MediaCodec enc = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
        enc.configure(af, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        enc.start();
        MediaFormat fmt = null;
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        long samples = 0;
        boolean inDone = false, outDone = false;
        try (FileInputStream in = new FileInputStream(pcm)) {
            byte[] buf = new byte[8192];
            while (!outDone) {
                if (!inDone) {
                    int idx = enc.dequeueInputBuffer(10_000);
                    if (idx >= 0) {
                        ByteBuffer ib = enc.getInputBuffer(idx); ib.clear();
                        int want = Math.min(buf.length, ib.remaining()); want -= want % 2;
                        int n = in.read(buf, 0, want);
                        long pts = samples * 1_000_000L / rate;
                        if (n <= 0) { enc.queueInputBuffer(idx, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inDone = true; }
                        else { ib.put(buf, 0, n); enc.queueInputBuffer(idx, 0, n, pts, 0); samples += n / 2; }
                    }
                }
                int o = enc.dequeueOutputBuffer(info, 10_000);
                if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) fmt = enc.getOutputFormat();
                else if (o >= 0) {
                    ByteBuffer ob = enc.getOutputBuffer(o);
                    if ((info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && info.size > 0 && ob != null) {
                        Sample s = new Sample(); s.data = new byte[info.size];
                        ob.position(info.offset); ob.get(s.data, 0, info.size);
                        s.pts = info.presentationTimeUs; s.flags = info.flags & ~MediaCodec.BUFFER_FLAG_END_OF_STREAM;
                        out.add(s);
                    }
                    enc.releaseOutputBuffer(o, false);
                    if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outDone = true;
                }
            }
        } finally { try { enc.stop(); } catch (Exception ignored) { } enc.release(); }
        if (fmt == null) throw new Exception("L'encodeur audio du téléphone n'a rien produit.");
        return fmt;
    }

    /** ARGB → YUV 4:2:0 dans l'image d'entrée de l'encodeur, quelle que soit sa disposition. */
    private static int toYuv(int[] argb, Image img) {
        Image.Plane[] pl = img.getPlanes();
        ByteBuffer yb = pl[0].getBuffer(), ub = pl[1].getBuffer(), vb = pl[2].getBuffer();
        int yRow = pl[0].getRowStride(), yPix = pl[0].getPixelStride();
        int uRow = pl[1].getRowStride(), uPix = pl[1].getPixelStride();
        int vRow = pl[2].getRowStride(), vPix = pl[2].getPixelStride();
        byte[] row = new byte[W];
        for (int j = 0; j < H; j++) {
            int base = j * W;
            for (int i = 0; i < W; i++) {
                int c = argb[base + i];
                int r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
                row[i] = (byte) (((66 * r + 129 * g + 25 * b + 128) >> 8) + 16);
            }
            if (yPix == 1) { yb.position(j * yRow); yb.put(row, 0, W); }
            else for (int i = 0; i < W; i++) yb.put(j * yRow + i * yPix, row[i]);
        }
        for (int j = 0; j < H / 2; j++) {
            for (int i = 0; i < W / 2; i++) {
                int c = argb[(2 * j) * W + 2 * i];
                int r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
                byte u = (byte) (((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128);
                byte v = (byte) (((112 * r - 94 * g - 18 * b + 128) >> 8) + 128);
                ub.put(j * uRow + i * uPix, u);
                vb.put(j * vRow + i * vPix, v);
            }
        }
        return W * H * 3 / 2;
    }

    // ------------------------------------------------------------------ dessin des images
    private static final class Frames {
        final String title, author; final List<Scene> scenes; final List<Seg> segs; final long totalUs;
        final Bitmap frame = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        final Canvas cv = new Canvas(frame);
        final Paint img = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG);
        final Paint shade = new Paint();
        final TextPaint big = new TextPaint(Paint.ANTI_ALIAS_FLAG), sub = new TextPaint(Paint.ANTI_ALIAS_FLAG), small = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        int loadedScene = -1; Bitmap b1, b2;
        int segIdx = 0;
        final int[] palette = {0xFF5B3A2A, 0xFF2E4A62, 0xFF6B2D2D, 0xFF35523A, 0xFF4B3A66, 0xFF6A5A2A};

        Frames(String title, String author, List<Scene> scenes, List<Seg> segs, long totalUs) {
            this.title = title; this.author = author; this.scenes = scenes; this.segs = segs; this.totalUs = totalUs;
            big.setColor(Color.WHITE); big.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD)); big.setTextSize(52);
            big.setShadowLayer(10, 0, 3, 0xCC000000);
            sub.setColor(0xFFF6EAD6); sub.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)); sub.setTextSize(34);
            sub.setShadowLayer(8, 0, 2, 0xE6000000);
            small.setColor(0xFFF6EAD6); small.setTypeface(Typeface.create(Typeface.SERIF, Typeface.ITALIC)); small.setTextSize(30);
            small.setShadowLayer(8, 0, 2, 0xCC000000);
        }

        void release() { if (b1 != null) b1.recycle(); if (b2 != null) b2.recycle(); frame.recycle(); }

        private void load(int si) {
            if (si == loadedScene) return;
            if (b1 != null) b1.recycle(); if (b2 != null) b2.recycle(); b1 = b2 = null;
            Scene s = scenes.get(si);
            if (s.img1 != null) b1 = BitmapFactory.decodeFile(s.img1.getPath());
            if (s.img2 != null) b2 = BitmapFactory.decodeFile(s.img2.getPath());
            loadedScene = si;
        }

        private void background(Bitmap b, int si, float prog, int variant) {
            if (b == null) {
                int c1 = palette[si % palette.length], c2 = palette[(si + 2) % palette.length];
                shade.setShader(new LinearGradient(0, 0, W * (0.6f + 0.4f * prog), H, c1, c2, Shader.TileMode.CLAMP));
                cv.drawRect(0, 0, W, H, shade); shade.setShader(null);
                return;
            }
            // zoom lent et léger déplacement (effet « Ken Burns »)
            float scale = 1.0f + 0.08f * prog;
            float bw = b.getWidth(), bh = b.getHeight();
            float base = Math.max(W / bw, H / bh);
            float s = base * scale;
            float dx = (W - bw * s) / 2f + (variant % 2 == 0 ? -1 : 1) * 30f * (prog - 0.5f);
            float dy = (H - bh * s) / 2f + (variant % 3 == 0 ? 1 : -1) * 16f * (prog - 0.5f);
            Matrix m = new Matrix(); m.setScale(s, s); m.postTranslate(dx, dy);
            cv.drawBitmap(b, m, img);
        }

        private void shadeBottom(float top) {
            shade.setShader(new LinearGradient(0, H * top, 0, H, 0x00000000, 0xD8000000, Shader.TileMode.CLAMP));
            cv.drawRect(0, H * top, W, H, shade);
            shade.setShader(new LinearGradient(0, 0, 0, H * 0.42f, 0xB0000000, 0x00000000, Shader.TileMode.CLAMP));
            cv.drawRect(0, 0, W, H * 0.42f, shade);
            shade.setShader(null);
        }

        private void text(TextPaint p, String t, int x, int y, int width, Layout.Alignment al, int maxLines, int alpha) {
            if (t == null || t.isEmpty()) return;
            p.setAlpha(alpha);
            StaticLayout l = StaticLayout.Builder.obtain(t, 0, t.length(), p, width).setAlignment(al).setMaxLines(maxLines).setEllipsize(android.text.TextUtils.TruncateAt.END).build();
            cv.save(); cv.translate(x, y); l.draw(cv); cv.restore();
            p.setAlpha(255);
        }

        private int textHeight(TextPaint p, String t, int width, int maxLines) {
            StaticLayout l = StaticLayout.Builder.obtain(t, 0, t.length(), p, width).setMaxLines(maxLines).setEllipsize(android.text.TextUtils.TruncateAt.END).build();
            return l.getHeight();
        }

        Bitmap draw(long t) {
            cv.drawColor(0xFF140F0B);
            long titleEnd = scenes.get(0).startUs > 0 ? scenes.get(0).startUs : 3_000_000;
            long outroStart = scenes.get(scenes.size() - 1).endUs;
            if (t < titleEnd) {
                // carte de titre
                load(0);
                background(b1, 0, (float) t / titleEnd, 0);
                shade.setColor(0xA0000000); cv.drawRect(0, 0, W, H, shade);
                big.setTextSize(62);
                int th = textHeight(big, title, W - 200, 3);
                text(big, title, 100, H / 2 - th / 2 - 30, W - 200, Layout.Alignment.ALIGN_CENTER, 3, 255);
                text(small, (author == null || author.isEmpty() ? "" : author + " · ") + "Le condensé en vidéo", 100, H / 2 + th / 2, W - 200, Layout.Alignment.ALIGN_CENTER, 2, 255);
                big.setTextSize(52);
                return frame;
            }
            if (t >= outroStart) {
                // générique de fin
                shade.setShader(new LinearGradient(0, 0, W, H, 0xFF2A1A10, 0xFF5B3A2A, Shader.TileMode.CLAMP));
                cv.drawRect(0, 0, W, H, shade); shade.setShader(null);
                text(big, title, 100, H / 2 - 110, W - 200, Layout.Alignment.ALIGN_CENTER, 2, 255);
                text(small, "Narration : le Professeur bizarroïde · Texte : Gemini\nImages : Wikimedia Commons et Openverse (licences libres)\nRéalisé avec la Bibliothèque", 100, H / 2 + 10, W - 200, Layout.Alignment.ALIGN_CENTER, 4, 230);
                return frame;
            }
            int si = 0;
            for (int i = 0; i < scenes.size(); i++) if (t >= scenes.get(i).startUs) si = i;
            Scene s = scenes.get(si);
            load(si);
            long dur = Math.max(1, s.endUs - s.startUs);
            float prog = Math.min(1f, Math.max(0f, (float) (t - s.startUs) / dur));
            // deux images par scène : la seconde prend le relais à mi-parcours, en fondu
            // Le zoom de chaque image avance sans jamais revenir en arrière : pendant le fondu, la première image
            // continue son mouvement là où elle était (avant : elle sautait en arrière, « whoop », sur les longs paragraphes).
            if (b2 != null && prog > 0.5f) {
                float p2 = (prog - 0.5f) * 2f;
                if (p2 < 0.12f) {
                    background(b1, si, 1f + p2 * 0.5f, si);
                    img.setAlpha((int) (255 * p2 / 0.12f)); background(b2, si, p2, si + 1); img.setAlpha(255);
                } else background(b2, si, p2, si + 1);
            } else background(b1, si, b2 != null ? prog * 2f : prog, si);
            shadeBottom(0.52f);
            // phrase choc en haut, qui apparaît en fondu
            float since = (t - s.startUs) / 1_000_000f;
            int a = (int) (255 * Math.min(1f, since / 0.8f));
            text(big, s.phrase, 70, 48, W - 140, Layout.Alignment.ALIGN_NORMAL, 3, a);
            // sous-titre : la phrase dite en ce moment
            while (segIdx + 1 < segs.size() && segs.get(segIdx + 1).startUs <= t) segIdx++;
            while (segIdx > 0 && segs.get(segIdx).startUs > t) segIdx--;
            Seg g = segs.isEmpty() ? null : segs.get(segIdx);
            if (g != null && g.scene == si && t <= g.endUs + 400_000) {
                int sh = textHeight(sub, g.text, W - 200, 3);
                text(sub, g.text, 100, H - 48 - sh, W - 200, Layout.Alignment.ALIGN_CENTER, 3, 255);
            }
            // barre de progression discrète
            shade.setColor(0x55FFFFFF); cv.drawRect(0, H - 6, W, H, shade);
            shade.setColor(0xFFD4A76A); cv.drawRect(0, H - 6, W * (float) t / totalUs, H, shade);
            return frame;
        }
    }
}
