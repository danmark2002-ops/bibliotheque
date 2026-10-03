package ca.bibliotheque.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileNotFoundException;

/** Couvertures des livres pour Android Auto (images seulement, en lecture). */
public class Couvertures extends ContentProvider {
    static final String AUTH = "ca.bibliotheque.app.couvertures";

    @Override public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || name.contains("/") || name.contains("..") || !name.matches("[\\w.-]+\\.(jpg|png)")) throw new FileNotFoundException();
        File f = new File(new File(new File(getContext().getFilesDir(), "auto"), "covers"), name);
        if (!f.exists()) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public String getType(Uri uri) { String n = String.valueOf(uri.getLastPathSegment()); return n.endsWith(".png") ? "image/png" : "image/jpeg"; }
    @Override public Cursor query(Uri uri, String[] p, String s, String[] a, String o) { return null; }
    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
