package com.sahojdokan.pos;

import android.app.Activity;
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
import android.media.MediaScannerConnection;
import android.os.Build;
import android.os.Environment;
import android.util.Base64;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                webView.getSettings().setJavaScriptEnabled(true);
                webView.getSettings().setDomStorageEnabled(true);
                webView.getSettings().setCacheMode(android.webkit.WebSettings.LOAD_DEFAULT);
                webView.clearCache(true);
                webView.addJavascriptInterface(new AndroidAppBridge(this, webView), "AndroidApp");
            }
        } catch (Exception ignored) {
        }

        // Intercept hardware/system Back button and delegate to React navigation stack
        this.getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                try {
                    if (MainActivity.this.bridge != null && MainActivity.this.bridge.getWebView() != null) {
                        WebView webView = MainActivity.this.bridge.getWebView();
                        webView.post(() -> {
                            webView.evaluateJavascript(
                                "(function() { try { return window.__handleAndroidBack ? window.__handleAndroidBack() : 'NOT_READY'; } catch(e) { return 'ERR'; } })()",
                                value -> {
                                    if (value != null && value.contains("EXIT_APP")) {
                                        MainActivity.this.finish();
                                    }
                                }
                            );
                        });
                    } else {
                        MainActivity.this.finish();
                    }
                } catch (Exception e) {
                    MainActivity.this.finish();
                }
            }
        });
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
        public void exitApp() {
            if (context instanceof Activity) {
                final Activity activity = (Activity) context;
                activity.runOnUiThread(activity::finish);
            }
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
        @JavascriptInterface
        public String savePdfToPublicDownloads(String base64Data, String filename) {
            try {
                if (base64Data == null || base64Data.isEmpty()) {
                    return "ERROR: EMPTY_DATA";
                }

                // Strip data URI header if present
                String rawBase64 = base64Data;
                if (rawBase64.contains(",")) {
                    rawBase64 = rawBase64.substring(rawBase64.indexOf(",") + 1);
                }

                byte[] pdfBytes = Base64.decode(rawBase64, Base64.DEFAULT);

                // Ensure filename starts with Sahoj_Dokan_ and ends with .pdf
                String safeName = filename;
                if (safeName == null || safeName.trim().isEmpty()) {
                    safeName = "Sahoj_Dokan_Report_" + System.currentTimeMillis() + ".pdf";
                }
                if (!safeName.startsWith("Sahoj_Dokan_")) {
                    safeName = "Sahoj_Dokan_" + safeName;
                }
                if (!safeName.toLowerCase().endsWith(".pdf")) {
                    safeName = safeName + ".pdf";
                }

                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }

                File targetFile = new File(downloadsDir, safeName);
                FileOutputStream fos = new FileOutputStream(targetFile);
                fos.write(pdfBytes);
                fos.flush();
                fos.close();

                // Immediate indexing via MediaScannerConnection so the file shows instantly in File Manager / Recent
                MediaScannerConnection.scanFile(
                    context,
                    new String[] { targetFile.getAbsolutePath() },
                    new String[] { "application/pdf" },
                    (path, uri) -> {
                        // Scan complete
                    }
                );

                if (context instanceof Activity) {
                    final String savedPathMsg = "ডাউনলোড সম্পন্ন: " + safeName + " (Downloads ফোল্ডারে)";
                    ((Activity) context).runOnUiThread(() ->
                        Toast.makeText(context, savedPathMsg, Toast.LENGTH_LONG).show()
                    );
                }

                return targetFile.getAbsolutePath();
            } catch (Exception e) {
                e.printStackTrace();
                return "ERROR: " + e.getMessage();
            }
        }
    }
}
