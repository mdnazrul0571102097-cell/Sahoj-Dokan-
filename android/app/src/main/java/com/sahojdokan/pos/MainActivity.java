package com.sahojdokan.pos;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                webView.getSettings().setJavaScriptEnabled(true);
                webView.getSettings().setDomStorageEnabled(true);
                webView.addJavascriptInterface(new AndroidAppBridge(this, webView), "AndroidApp");
            }
        } catch (Exception ignored) {
        }
    }

    public static class AndroidAppBridge {
        private final Context context;
        private final WebView webView;
        private static final String PREF_NAME = "SahojDokanNativeBackup";

        public AndroidAppBridge(Context context, WebView webView) {
            this.context = context;
            this.webView = webView;
        }

        @JavascriptInterface
        public void openWhatsApp(String url) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void printReceipt() {
            if (webView == null) return;
            webView.post(() -> {
                try {
                    PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                    if (printManager != null) {
                        PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter("SahojDokan_Receipt");
                        printManager.print("SahojDokan_Receipt", adapter, new PrintAttributes.Builder().build());
                    }
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void saveBackupData(String payload) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString("latest_backup", payload).apply();
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public String loadBackupData() {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
                return prefs.getString("latest_backup", "");
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String loadBackupDataForPhone(String phone) {
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
                String byPhone = prefs.getString("backup_" + phone, "");
                if (byPhone != null && !byPhone.isEmpty()) return byPhone;
                return prefs.getString("latest_backup", "");
            } catch (Exception e) {
                return "";
            }
        }
    }
}
