package org.json;
import java.util.*;
/** Petit remplaçant d'org.json, juste pour les essais sur ordinateur */
public class JSONObject {
    final Map<String, Object> m = new LinkedHashMap<>();
    public JSONObject() { }
    public JSONObject(String s) throws JSONException { Object o = new P(s).val(); if (!(o instanceof JSONObject)) throw new JSONException("pas un objet"); m.putAll(((JSONObject) o).m); }
    public JSONObject put(String k, Object v) { m.put(k, v); return this; }
    public JSONObject put(String k, double v) { m.put(k, v); return this; }
    public JSONObject put(String k, int v) { m.put(k, v); return this; }
    public JSONObject put(String k, boolean v) { m.put(k, v); return this; }
    public Object opt(String k) { return m.get(k); }
    public JSONArray optJSONArray(String k) { Object o = m.get(k); return o instanceof JSONArray ? (JSONArray) o : null; }
    public JSONObject optJSONObject(String k) { Object o = m.get(k); return o instanceof JSONObject ? (JSONObject) o : null; }
    public JSONObject getJSONObject(String k) throws JSONException { JSONObject o = optJSONObject(k); if (o == null) throw new JSONException(k); return o; }
    public JSONArray getJSONArray(String k) throws JSONException { JSONArray o = optJSONArray(k); if (o == null) throw new JSONException(k); return o; }
    public String optString(String k) { return optString(k, ""); }
    public String optString(String k, String d) { Object o = m.get(k); return o == null ? d : String.valueOf(o); }
    public String getString(String k) throws JSONException { Object o = m.get(k); if (o == null) throw new JSONException(k); return String.valueOf(o); }
    public boolean optBoolean(String k) { Object o = m.get(k); return o instanceof Boolean && (Boolean) o; }
    public int optInt(String k, int d) { Object o = m.get(k); return o instanceof Number ? ((Number) o).intValue() : d; }
    public long optLong(String k, long d) { Object o = m.get(k); return o instanceof Number ? ((Number) o).longValue() : d; }
    public boolean has(String k) { return m.containsKey(k); }
    static String q(String s) { StringBuilder b = new StringBuilder("\""); for (char c : s.toCharArray()) { if (c == '"' || c == '\\') b.append('\\').append(c); else if (c == '\n') b.append("\\n"); else if (c < 32) b.append(String.format("\\u%04x", (int) c)); else b.append(c); } return b.append('"').toString(); }
    static String w(Object o) { return o == null ? "null" : o instanceof String ? q((String) o) : String.valueOf(o); }
    @Override public String toString() { StringBuilder b = new StringBuilder("{"); for (Map.Entry<String, Object> e : m.entrySet()) { if (b.length() > 1) b.append(','); b.append(q(e.getKey())).append(':').append(w(e.getValue())); } return b.append('}').toString(); }
    static class P {
        final String s; int i = 0; P(String s) { this.s = s; }
        void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
        Object val() throws JSONException {
            ws(); if (i >= s.length()) throw new JSONException("fin");
            char c = s.charAt(i);
            if (c == '{') { i++; JSONObject o = new JSONObject(); ws(); if (s.charAt(i) == '}') { i++; return o; } while (true) { ws(); String k = str(); ws(); i++; o.m.put(k, val()); ws(); char d = s.charAt(i++); if (d == '}') return o; } }
            if (c == '[') { i++; JSONArray a = new JSONArray(); ws(); if (s.charAt(i) == ']') { i++; return a; } while (true) { a.l.add(val()); ws(); char d = s.charAt(i++); if (d == ']') return a; } }
            if (c == '"') return str();
            if (s.startsWith("true", i)) { i += 4; return true; } if (s.startsWith("false", i)) { i += 5; return false; } if (s.startsWith("null", i)) { i += 4; return null; }
            int j = i; while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            String n = s.substring(j, i); if (n.isEmpty()) throw new JSONException("caractère inattendu " + c);
            return n.contains(".") || n.contains("e") || n.contains("E") ? (Object) Double.parseDouble(n) : (Object) Long.parseLong(n);
        }
        String str() throws JSONException {
            if (s.charAt(i) != '"') throw new JSONException("guillemet attendu"); i++; StringBuilder b = new StringBuilder();
            while (true) { char c = s.charAt(i++); if (c == '"') return b.toString(); if (c == '\\') { char e = s.charAt(i++); switch (e) { case 'n': b.append('\n'); break; case 't': b.append('\t'); break; case 'u': b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break; default: b.append(e); } } else b.append(c); }
        }
    }
}
