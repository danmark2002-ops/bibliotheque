package android.content;
import java.util.*;
public class Context {
    public static final int MODE_PRIVATE = 0;
    public static final Map<String, Object> PREFS = new HashMap<>();
    public Context getApplicationContext() { return this; }
    public SharedPreferences getSharedPreferences(String n, int mode) {
        return new SharedPreferences() {
            public String getString(String k, String d) { Object o = PREFS.get(n + "/" + k); return o == null ? d : (String) o; }
            public long getLong(String k, long d) { Object o = PREFS.get(n + "/" + k); return o == null ? d : (Long) o; }
            public Editor edit() { return new Editor() {
                public Editor putString(String k, String v) { PREFS.put(n + "/" + k, v); return this; }
                public Editor putLong(String k, long v) { PREFS.put(n + "/" + k, v); return this; }
                public Editor remove(String k) { PREFS.remove(n + "/" + k); return this; }
                public void apply() { } public boolean commit() { return true; } }; }
        };
    }
}
