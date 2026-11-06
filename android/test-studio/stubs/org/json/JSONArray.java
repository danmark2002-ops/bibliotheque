package org.json;
import java.util.*;
public class JSONArray {
    final List<Object> l = new ArrayList<>();
    public JSONArray() { }
    public JSONArray put(Object o) { l.add(o); return this; }
    public int length() { return l.size(); }
    public Object opt(int i) { return i < l.size() ? l.get(i) : null; }
    public JSONObject getJSONObject(int i) throws JSONException { Object o = opt(i); if (!(o instanceof JSONObject)) throw new JSONException("" + i); return (JSONObject) o; }
    public JSONObject optJSONObject(int i) { Object o = opt(i); return o instanceof JSONObject ? (JSONObject) o : null; }
    public String optString(int i) { Object o = opt(i); return o == null ? "" : String.valueOf(o); }
    public String getString(int i) { return String.valueOf(opt(i)); }
    @Override public String toString() { StringBuilder b = new StringBuilder("["); for (Object o : l) { if (b.length() > 1) b.append(','); b.append(JSONObject.w(o)); } return b.append(']').toString(); }
}
