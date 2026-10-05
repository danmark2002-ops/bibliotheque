package ca.bibliotheque.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONObject;

import java.util.Collections;
import java.util.List;

/**
 * Version Premium : un achat unique « premium » par Google Play.
 * Seules les copies installées depuis Google Play passent par le paiement ; les autres (APK, tests) sont débloquées.
 * L'état est gardé sur le téléphone pour fonctionner sans Internet, et revérifié auprès de Google Play à chaque retour dans l'app.
 */
class Premium implements PurchasesUpdatedListener {
    static final String PRODUCT = "premium";

    interface Notify { void send(String json); }

    private final Activity act;
    private final Notify notify;
    private BillingClient client;
    private ProductDetails details;
    private String price = "";
    private boolean pending = false;

    Premium(Activity act, Notify notify) { this.act = act; this.notify = notify; }

    private SharedPreferences prefs() { return act.getSharedPreferences("premium", Context.MODE_PRIVATE); }

    /** Installée depuis le Play Store ? */
    boolean fromPlay() {
        try {
            String inst;
            if (Build.VERSION.SDK_INT >= 30) inst = act.getPackageManager().getInstallSourceInfo(act.getPackageName()).getInstallingPackageName();
            else inst = act.getPackageManager().getInstallerPackageName(act.getPackageName());
            return "com.android.vending".equals(inst);
        } catch (Exception e) { return false; }
    }

    boolean owned() { return prefs().getBoolean("owned", false); }

    String state(String event) {
        JSONObject o = new JSONObject();
        try {
            o.put("play", fromPlay()); o.put("premium", owned()); o.put("price", price);
            o.put("pending", pending); o.put("ready", details != null);
            if (event != null) o.put("event", event);
        } catch (Exception ignored) { }
        return o.toString();
    }

    private void push(String event) { notify.send(state(event)); }

    void start() {
        if (!fromPlay() || client != null) return;
        client = BillingClient.newBuilder(act)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) { loadDetails(); refresh(); }
            }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    private void loadDetails() {
        QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build()))
            .build();
        client.queryProductDetailsAsync(p, (r, res) -> {
            List<ProductDetails> l = res == null ? null : res.getProductDetailsList();
            if (l != null && !l.isEmpty()) {
                details = l.get(0);
                ProductDetails.OneTimePurchaseOfferDetails o = details.getOneTimePurchaseOfferDetails();
                if (o != null) price = o.getFormattedPrice();
            }
            push(null);
        });
    }

    /** Revérifie les achats (restauration, remboursement, paiement en attente devenu confirmé). */
    void refresh() {
        if (client == null) { start(); return; }
        if (!client.isReady()) return;
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r, list) -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) handle(list, true);
        });
        if (details == null) loadDetails();
    }

    void buy() {
        if (client == null || details == null) { start(); push("error"); return; }
        BillingFlowParams.ProductDetailsParams pd = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build();
        BillingFlowParams fp = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(pd)).build();
        act.runOnUiThread(() -> client.launchBillingFlow(act, fp));
    }

    @Override
    public void onPurchasesUpdated(BillingResult r, List<Purchase> list) {
        int c = r.getResponseCode();
        if (c == BillingClient.BillingResponseCode.OK && list != null) handle(list, false);
        else if (c == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) refresh();
        else if (c == BillingClient.BillingResponseCode.USER_CANCELED) push("cancel");
        else push("error");
    }

    private void handle(List<Purchase> list, boolean complete) {
        boolean has = false; boolean wait = false;
        if (list != null) for (Purchase p : list) {
            if (!p.getProducts().contains(PRODUCT)) continue;
            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                has = true;
                // Google rembourse automatiquement un achat non confirmé dans les 3 jours
                if (!p.isAcknowledged()) client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), res -> { });
            } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) wait = true;
        }
        pending = wait && !has;
        // liste complète : un achat remboursé disparaît, Premium aussi ; sinon on ne fait qu'ajouter
        if (has || complete) prefs().edit().putBoolean("owned", has).apply();
        push(has ? "owned" : pending ? "pending" : null);
    }
}
