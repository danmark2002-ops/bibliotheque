package ca.bibliotheque.app;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * « Recevoir des livres » : un petit serveur web sur la télé (ou tout appareil). Sur le téléphone, on ouvre
 * l'adresse affichée dans le navigateur, on choisit ses PDF, et ils arrivent directement dans la Bibliothèque.
 * Aucune autre application ni sélecteur de fichiers n'est nécessaire sur la télé.
 */
final class Reception {
    interface Arrive { void livre(String file, String name); }
    private static ServerSocket server;
    private static File dir;
    private static Arrive cb;
    private static int seq = 0;

    private Reception() { }

    static File dir(android.content.Context c) { File d = new File(c.getFilesDir(), "reception"); d.mkdirs(); return d; }

    /** Démarre et renvoie l'adresse à ouvrir sur le téléphone, ou null sans réseau local. */
    static synchronized String start(android.content.Context c, Arrive a) throws Exception {
        dir = dir(c); cb = a;
        String ip = VideoServeur.localIp();
        if (ip == null) return null;
        if (server == null || server.isClosed()) {
            ServerSocket s = null;
            for (int port : new int[]{8686, 8687, 8688, 0}) { try { s = new ServerSocket(port); break; } catch (Exception ignored) { } }
            if (s == null) throw new Exception("port");
            server = s;
            final ServerSocket srv = s;
            Thread t = new Thread(() -> { while (!srv.isClosed()) { try { Socket k = srv.accept(); new Thread(() -> handle(k)).start(); } catch (Exception e) { break; } } });
            t.setDaemon(true); t.start();
        }
        return "http://" + ip + ":" + server.getLocalPort();
    }

    static synchronized void stop() { try { if (server != null) server.close(); } catch (Exception ignored) { } server = null; }

    private static String line(InputStream in) throws Exception {
        StringBuilder sb = new StringBuilder(); int ch;
        while ((ch = in.read()) >= 0) { if (ch == '\n') break; if (ch != '\r') sb.append((char) ch); }
        return sb.toString();
    }

    private static void reply(OutputStream out, String status, String type, byte[] body) throws Exception {
        out.write(("HTTP/1.1 " + status + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length + "\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(body); out.flush();
    }

    private static void handle(Socket k) {
        try (Socket s = k; InputStream in = s.getInputStream(); OutputStream out = s.getOutputStream()) {
            String req = line(in); if (req.isEmpty()) return;
            String[] p = req.split(" ");
            String method = p[0], path = p.length > 1 ? p[1] : "/";
            long len = 0; String name = "livre.pdf";
            for (String h; !(h = line(in)).isEmpty(); ) {
                int i = h.indexOf(':'); if (i < 0) continue;
                String key = h.substring(0, i).trim().toLowerCase(java.util.Locale.ROOT), val = h.substring(i + 1).trim();
                if (key.equals("content-length")) len = Long.parseLong(val);
                if (key.equals("x-name")) name = URLDecoder.decode(val, "UTF-8");
            }
            if (method.equals("GET")) { reply(out, "200 OK", "text/html; charset=utf-8", PAGE.getBytes(StandardCharsets.UTF_8)); return; }
            if (method.equals("POST") && path.startsWith("/envoi")) {
                String clean = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
                if (clean.length() > 120) clean = clean.substring(clean.length() - 120);
                String ext = clean.contains(".") ? clean.substring(clean.lastIndexOf('.')).toLowerCase(java.util.Locale.ROOT).replaceAll("[^.a-z0-9]", "") : "";
                String fname;
                synchronized (Reception.class) { fname = "w" + (++seq) + System.currentTimeMillis() % 100000 + (ext.isEmpty() ? ".bin" : ext); }
                File f = new File(dir, fname);
                try (FileOutputStream fo = new FileOutputStream(f)) {
                    byte[] buf = new byte[1 << 16]; long left = len; int n;
                    while (left > 0 && (n = in.read(buf, 0, (int) Math.min(buf.length, left))) > 0) { fo.write(buf, 0, n); left -= n; }
                    if (left > 0) { f.delete(); reply(out, "400 Bad Request", "text/plain", "incomplet".getBytes()); return; }
                }
                reply(out, "200 OK", "text/plain", "ok".getBytes());
                if (cb != null) cb.livre(fname, clean);
                return;
            }
            reply(out, "404 Not Found", "text/plain", new byte[0]);
        } catch (Exception ignored) { }
    }

    private static final String PAGE = "<!doctype html><html lang=fr><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
        + "<title>Envoyer des livres à la Bibliothèque</title><style>"
        + "body{margin:0;font:17px system-ui,sans-serif;background:#1e1712;color:#f3e9da;padding:22px}h1{font:600 24px Georgia,serif;margin:6px 0 10px}"
        + "label.big{display:block;text-align:center;background:#d4ab6a;color:#241809;font-weight:700;border-radius:16px;padding:20px;margin:18px 0;font-size:19px}"
        + "input{display:none}.f{background:#2a201a;border-radius:12px;padding:10px 12px;margin:8px 0}.bar{height:6px;background:#3a2c22;border-radius:3px;margin-top:6px;overflow:hidden}"
        + ".bar i{display:block;height:100%;width:0;background:#d4ab6a}.ok{color:#8fbf7f}.err{color:#e2735e}p{opacity:.8}</style></head><body>"
        + "<h1>📚 Envoyer des livres</h1><p>Choisis tes livres (PDF, EPUB, Word…) : ils arrivent tout de suite dans la Bibliothèque de la télé.</p>"
        + "<label class=big>Choisir des livres<input id=f type=file multiple accept='.pdf,.epub,.docx,.doc,.odt,.rtf,.txt,.md,.mobi,.azw3,.fb2,.mp3,.m4b'></label><div id=l></div>"
        + "<script>const l=document.getElementById('l');document.getElementById('f').onchange=async e=>{for(const file of e.target.files){"
        + "const d=document.createElement('div');d.className='f';d.innerHTML='<b></b><div class=bar><i></i></div><small></small>';d.querySelector('b').textContent=file.name;l.prepend(d);"
        + "await new Promise(res=>{const x=new XMLHttpRequest();x.open('POST','/envoi');x.setRequestHeader('X-Name',encodeURIComponent(file.name));"
        + "x.upload.onprogress=ev=>{if(ev.lengthComputable)d.querySelector('i').style.width=(ev.loaded*100/ev.total)+'%'};"
        + "x.onload=()=>{const ok=x.status==200;d.querySelector('small').textContent=ok?'✔ Reçu par la télé':'Échec, réessaie';d.querySelector('small').className=ok?'ok':'err';res()};"
        + "x.onerror=()=>{d.querySelector('small').textContent='Échec : la télé et le téléphone sont-ils sur le même Wi-Fi ?';d.querySelector('small').className='err';res()};x.send(file)})}e.target.value=''}</script></body></html>";
}
