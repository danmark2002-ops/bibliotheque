package ca.bibliotheque.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/** Donne accès en lecture, à une autre application, à une copie d'un livre (dossier cache/partage). */
public class Partage extends ContentProvider {
    static final String AUTH = "ca.bibliotheque.app.partage";

    static Uri uriFor(String name) { return Uri.parse("content://" + AUTH + "/" + Uri.encode(name)); }

    private File fileFor(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || name.contains("/") || name.contains("..")) throw new FileNotFoundException();
        // les vidéos du condensé sont gardées dans files/videos ; les copies de livres dans cache/partage
        File f = name.startsWith("video-") && name.endsWith(".mp4") ? new File(VideoMaker.dir(getContext()), name) : new File(new File(getContext().getCacheDir(), "partage"), name);
        if (!f.exists()) throw new FileNotFoundException();
        return f;
    }

    static String mimeOf(String name) {
        String n = name.toLowerCase(java.util.Locale.ROOT);
        if (n.endsWith(".pdf")) return "application/pdf";
        if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (n.endsWith(".md")) return "text/markdown";
        if (n.endsWith(".mp4")) return "video/mp4";
        if (n.endsWith(".biblio")) return "application/zip";
        if (n.endsWith(".epub")) return "application/epub+zip";
        if (n.matches(".*\\.(mobi|azw|azw3|prc)$")) return "application/x-mobipocket-ebook";
        if (n.endsWith(".doc")) return "application/msword";
        if (n.endsWith(".odt")) return "application/vnd.oasis.opendocument.text";
        if (n.endsWith(".rtf")) return "application/rtf";
        if (n.endsWith(".fb2")) return "application/x-fictionbook+xml";
        if (n.matches(".*\\.(html|htm|xhtml)$")) return "text/html";
        return "text/plain";
    }

    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { return mimeOf(String.valueOf(uri.getLastPathSegment())); }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String sel, String[] args, String sort) {
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        try { File f = fileFor(uri); c.addRow(new Object[]{f.getName(), f.length()}); } catch (FileNotFoundException ignored) { }
        return c;
    }

    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
