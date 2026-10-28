package ca.bibliotheque.app;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Handler;
import android.os.Looper;

/**
 * Joue une scène de voix de studio d'un seul trait (les silences naturels entre les répliques sont dans le son),
 * et dit quelle phrase est en cours. Pause = vraie pause, au milieu d'une phrase s'il le faut.
 */
final class ScenePlayer {
    interface Listener { void line(int i); void end(); }

    private final Handler h = new Handler(Looper.getMainLooper());
    private AudioTrack track;
    private int[] starts;      // début de chaque phrase de la scène (+ fin), en échantillons du son entier
    private int offset, frames, cur = -1, gen, rate;
    private float speed = 1f;
    private long playedMs, lastTick;   // durée réellement jouée (hors pauses)
    private boolean paused, live;
    private Listener ls;

    boolean paused() { return paused; }
    boolean live() { return live; }

    /** Joue le son à partir du début de la phrase « line » de la scène */
    void start(short[] pcm, int rate, int[] starts, int line, float speed, Listener l) {
        stop();
        this.starts = starts; this.ls = l; cur = -1; this.rate = rate; this.speed = speed; playedMs = 0;
        offset = Math.max(0, Math.min(pcm.length - 1, starts[Math.max(0, Math.min(line, starts.length - 2))]));
        frames = pcm.length - offset;
        try {
            track = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setBufferSizeInBytes(frames * 2).setTransferMode(AudioTrack.MODE_STATIC).build();
            track.write(pcm, offset, frames);
            if (Math.abs(speed - 1f) > 0.01f) { try { track.setPlaybackParams(new android.media.PlaybackParams().setSpeed(speed)); } catch (Exception ignored) { } }
            track.play();
        } catch (Exception e) { release(); live = false; h.post(() -> { if (ls != null) ls.end(); }); return; }
        live = true; paused = false; lastTick = android.os.SystemClock.elapsedRealtime();
        final int g = ++gen;
        tick(g);
    }

    private void tick(int g) {
        h.postDelayed(() -> {
            if (g != gen || track == null) return;
            long now = android.os.SystemClock.elapsedRealtime();
            if (!paused) {
                playedMs += now - lastTick;
                // à vitesse normale, la tête de lecture dit où l'on est ; sinon (vitesse changée) on compte le temps joué
                int pos = Math.abs(speed - 1f) < 0.01f ? track.getPlaybackHeadPosition() : (int) (playedMs * (long) rate * speed / 1000L);
                int at = offset + pos;
                int i = starts.length - 2;
                while (i > 0 && starts[i] > at) i--;
                if (i != cur) { cur = i; if (ls != null) ls.line(i); }
                long expected = (long) (frames * 1000L / (double) rate / speed);
                if (pos >= frames - 240 || playedMs > expected + 1500) { Listener l = ls; stop(); if (l != null) l.end(); return; } // filet : la fin arrive même si la tête de lecture se bloque
            }
            lastTick = now;
            tick(g);
        }, 70);
    }

    void pause() { if (track != null && live && !paused) { try { track.pause(); } catch (Exception ignored) { } paused = true; } }

    void resume() { if (track != null && live && paused) { try { track.play(); } catch (Exception ignored) { } paused = false; lastTick = android.os.SystemClock.elapsedRealtime(); } }

    void stop() { gen++; release(); live = false; paused = false; }

    private void release() {
        if (track != null) { try { track.stop(); } catch (Exception ignored) { } try { track.release(); } catch (Exception ignored) { } track = null; }
    }
}
