package ca.bibliotheque.app;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;

/**
 * Petit serveur web local : la télé (Chromecast) vient lire la vidéo MP4 directement sur le téléphone,
 * par le Wi-Fi de la maison. Gère les demandes partielles (Range), nécessaires pour avancer dans la vidéo.
 */
final class VideoServeur {
    private static ServerSocket server;
    private static volatile File file;
    private static String token = "";

    private VideoServeur() { }

    /** Démarre (au besoin) et renvoie l'adresse de la vidéo, ou null si le téléphone n'est pas sur un réseau local. */
    static synchronized String serve(File f) throws Exception {
        file = f;
        token = Long.toHexString(System.nanoTime() ^ (long) (Math.random() * Long.MAX_VALUE));
        String ip = localIp();
        if (ip == null) return null;
        if (server == null || server.isClosed()) {
            server = new ServerSocket(0);
            Thread t = new Thread(VideoServeur::loop, "video-serveur");
            t.setDaemon(true);
            t.start();
        }
        return "http://" + ip + ":" + server.getLocalPort() + "/" + token + "/video.mp4";
    }

    static synchronized void stop() {
        try { if (server != null) server.close(); } catch (Exception ignored) { }
        server = null; file = null;
    }

    private static String localIp() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String n = ni.getName().toLowerCase(Locale.ROOT);
                if (n.startsWith("rmnet") || n.startsWith("ccmni") || n.startsWith("dummy") || n.startsWith("tun")) continue; // données cellulaires, VPN
                for (InetAddress a : Collections.list(ni.getInetAddresses()))
                    if (a instanceof java.net.Inet4Address && a.isSiteLocalAddress()) return a.getHostAddress();
            }
        } catch (Exception ignored) { }
        return null;
    }

    private static void loop() {
        ServerSocket s = server;
        while (s != null && !s.isClosed()) {
            try {
                Socket c = s.accept();
                Thread t = new Thread(() -> handle(c), "video-client");
                t.setDaemon(true);
                t.start();
            } catch (Exception e) { return; }
        }
    }

    private static void handle(Socket c) {
        try (Socket sock = c) {
            sock.setSoTimeout(60000);
            BufferedReader in = new BufferedReader(new InputStreamReader(sock.getInputStream(), StandardCharsets.ISO_8859_1));
            String first = in.readLine();
            if (first == null) return;
            String[] parts = first.split(" ");
            String method = parts.length > 0 ? parts[0] : "", path = parts.length > 1 ? parts[1] : "";
            String range = null, line;
            while ((line = in.readLine()) != null && !line.isEmpty())
                if (line.toLowerCase(Locale.ROOT).startsWith("range:")) range = line.substring(6).trim();
            OutputStream out = sock.getOutputStream();
            File f = file;
            if (f == null || !f.exists() || !path.startsWith("/" + token + "/")) { head(out, "404 Not Found", 0, null, 0, 0); return; }
            if ("OPTIONS".equals(method)) { head(out, "204 No Content", 0, null, 0, 0); return; }
            long len = f.length(), start = 0, end = len - 1;
            boolean partial = false;
            if (range != null && range.startsWith("bytes=")) {
                String[] r = range.substring(6).split(",")[0].split("-", -1);
                try {
                    if (!r[0].isEmpty()) { start = Long.parseLong(r[0].trim()); if (r.length > 1 && !r[1].trim().isEmpty()) end = Long.parseLong(r[1].trim()); }
                    else if (r.length > 1 && !r[1].trim().isEmpty()) { start = Math.max(0, len - Long.parseLong(r[1].trim())); }
                    partial = true;
                } catch (NumberFormatException ignored) { }
                if (start >= len) { head(out, "416 Range Not Satisfiable", 0, null, 0, len); return; }
                end = Math.min(end, len - 1);
            }
            long count = end - start + 1;
            head(out, partial ? "206 Partial Content" : "200 OK", count, partial ? ("bytes " + start + "-" + end + "/" + len) : null, 0, len);
            if ("HEAD".equals(method)) return;
            try (RandomAccessFile raf = new RandomAccessFile(f, "r")) {
                raf.seek(start);
                byte[] buf = new byte[64 * 1024];
                long left = count;
                while (left > 0) {
                    int n = raf.read(buf, 0, (int) Math.min(buf.length, left));
                    if (n <= 0) break;
                    out.write(buf, 0, n);
                    left -= n;
                }
                out.flush();
            }
        } catch (Exception ignored) { }
    }

    private static void head(OutputStream out, String status, long length, String contentRange, int unused, long total) throws Exception {
        StringBuilder h = new StringBuilder();
        h.append("HTTP/1.1 ").append(status).append("\r\n");
        h.append("Content-Type: video/mp4\r\n");
        h.append("Accept-Ranges: bytes\r\n");
        h.append("Access-Control-Allow-Origin: *\r\n");
        h.append("Access-Control-Allow-Headers: Range\r\n");
        h.append("Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges\r\n");
        h.append("Content-Length: ").append(length).append("\r\n");
        if (contentRange != null) h.append("Content-Range: ").append(contentRange).append("\r\n");
        else if (status.startsWith("416")) h.append("Content-Range: bytes */").append(total).append("\r\n");
        h.append("Connection: close\r\n\r\n");
        out.write(h.toString().getBytes(StandardCharsets.ISO_8859_1));
    }
}
