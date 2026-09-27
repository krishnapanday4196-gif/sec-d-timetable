package com.btechcse.secd.timetable;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public class MainActivity extends Activity {
    private WebView mWebView;
    private static final int CURRENT_APK_VERSION = 32;
    public static final String GITHUB_APK_SHARE_URL = "https://raw.githubusercontent.com/krishnapanday4196-gif/sec-d-timetable/main/CSE_D_Timetable.apk";
    public static final String GOOGLE_DRIVE_SHARE_URL = GITHUB_APK_SHARE_URL;
    private ValueCallback<Uri[]> mFilePathCallback;
    private static final int FILE_CHOOSER_REQUEST_CODE = 2001;
    private static final int NOTIF_PERM_REQUEST_CODE = 3001;
    private String mPendingNotifTitle = null;
    private String mPendingNotifShortBody = null;
    private String mPendingNotifBigText = null;

    @SuppressLint({"SetJavaScriptEnabled", "Deprecation"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Dark theme status bar matching app theme (#080C14)
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(0xFF080C14);
        window.setNavigationBarColor(0xFF0F172A);

        setContentView(R.layout.activity_main);

        // Request Android 13+ Notification Permission & Schedule 5-Min Class Reminders
        requestNotificationPermissionIfNeeded();
        ClassReminderReceiver.ensureNotificationChannel(this);
        ClassReminderReceiver.scheduleAllReminders(this);

        // Respect Android system status bar and navigation bar insets (Android 15/16 Edge-to-Edge)
        View rootView = findViewById(R.id.root_layout);
        if (rootView != null) {
            rootView.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    int top = insets.getSystemWindowInsetTop();
                    int bottom = insets.getSystemWindowInsetBottom();
                    int left = insets.getSystemWindowInsetLeft();
                    int right = insets.getSystemWindowInsetRight();
                    v.setPadding(left, top, right, bottom);
                    return insets.consumeSystemWindowInsets();
                }
            });
        }

        mWebView = findViewById(R.id.webview);

        // Hardware acceleration for 60fps ultra-smooth scrolling
        mWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        mWebView.setOverScrollMode(View.OVER_SCROLL_IF_CONTENT_SCROLLS);
        mWebView.setVerticalScrollBarEnabled(true);
        mWebView.setHorizontalScrollBarEnabled(false);
        mWebView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        mWebView.setFocusable(true);
        mWebView.setFocusableInTouchMode(true);

        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);

        // Enable standard responsive viewport meta tag handling
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        settings.setDisplayZoomControls(false);
        settings.setBuiltInZoomControls(false);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        mWebView.addJavascriptInterface(new AndroidUpdaterBridge(this), "AndroidUpdater");

        mWebView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ignored) {}
                }
            }
        });

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file://") || url.startsWith("data:")) {
                    return false;
                }
                if (url.startsWith("whatsapp://") || url.startsWith("intent:") || url.contains("wa.me") || url.endsWith(".apk") || url.contains("/update") || url.contains("/download-export")) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(i);
                    } catch (Exception ignored) {}
                    return true;
                }
                return false;
            }
        });
        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Select File"), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception e) {
                    mFilePathCallback = null;
                    return false;
                }
            }
        });

        loadBestAvailablePage();
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, NOTIF_PERM_REQUEST_CODE);
                }
            } catch (Exception ignored) {}
        }
    }

    private void openAppNotificationSettings() {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {}
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIF_PERM_REQUEST_CODE) {
            if (grantResults != null && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                ClassReminderReceiver.ensureNotificationChannel(this);
                ClassReminderReceiver.scheduleAllReminders(this);
                if (mPendingNotifTitle != null) {
                    ClassReminderReceiver.showImmediateNotification(
                            this,
                            mPendingNotifTitle,
                            mPendingNotifShortBody != null ? mPendingNotifShortBody : "",
                            mPendingNotifBigText != null ? mPendingNotifBigText : mPendingNotifShortBody,
                            (int) (System.currentTimeMillis() % 10000)
                    );
                    mPendingNotifTitle = null;
                    mPendingNotifShortBody = null;
                }
                Toast.makeText(this, "🔔 5-Minute Class Reminders Active!", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "🔔 Please allow notifications for 5-Min Class Alerts", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (mFilePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    } else if (data.getClipData() != null && data.getClipData().getItemCount() > 0) {
                        results = new Uri[]{data.getClipData().getItemAt(0).getUri()};
                    }
                }
                mFilePathCallback.onReceiveValue(results);
                mFilePathCallback = null;
            }
        }
    }

    private boolean isUsingOtaFile() {
        SharedPreferences prefs = getSharedPreferences("ota_prefs", Context.MODE_PRIVATE);
        int savedApkVer = prefs.getInt("apk_ver", 0);
        File otaHtml = new File(getFilesDir(), "index.html");
        return (savedApkVer == CURRENT_APK_VERSION && otaHtml.exists() && otaHtml.length() > 1000);
    }

    private void loadBestAvailablePage() {
        SharedPreferences prefs = getSharedPreferences("ota_prefs", Context.MODE_PRIVATE);
        int savedApkVer = prefs.getInt("apk_ver", 0);
        File otaHtml = new File(getFilesDir(), "index.html");
        if (savedApkVer != CURRENT_APK_VERSION && otaHtml.exists()) {
            try { otaHtml.delete(); } catch (Exception ignored) {}
        }
        if (isUsingOtaFile()) {
            mWebView.loadUrl("file://" + otaHtml.getAbsolutePath());
        } else {
            mWebView.loadUrl("file:///android_asset/index.html");
        }
    }

    private String computeMd5First12(InputStream in) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] buf = new byte[8192];
            int len;
            while ((len = in.read(buf)) > 0) {
                md.update(buf, 0, len);
            }
            in.close();
            byte[] digest = md.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.substring(0, 12);
        } catch (Exception e) {
            return "";
        }
    }

    private void copyAssetToInternal(String assetName) {
        try {
            File outFile = new File(getFilesDir(), assetName);
            if (outFile.exists()) return;
            InputStream in = getAssets().open(assetName);
            FileOutputStream out = new FileOutputStream(outFile);
            byte[] buf = new byte[8192];
            int len;
            while ((len = in.read(buf)) > 0) {
                out.write(buf, 0, len);
            }
            out.close();
            in.close();
        } catch (Exception ignored) {}
    }

    private String httpGetText(String urlStr, int timeoutMs) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setRequestMethod("GET");
        conn.setRequestProperty("bypass-tunnel-reminder", "true");
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 15; CSE-D-Timetable-Updater/3.6)");
        conn.setConnectTimeout(timeoutMs);
        conn.setReadTimeout(timeoutMs);
        conn.connect();
        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            conn.disconnect();
            throw new Exception("HTTP " + code);
        }
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\n");
        }
        reader.close();
        conn.disconnect();
        return sb.toString();
    }

    public class AndroidUpdaterBridge {
        private final Context mContext;

        AndroidUpdaterBridge(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void syncNotificationSettings(String batch, boolean enabled) {
            try {
                SharedPreferences prefs = mContext.getSharedPreferences(ClassReminderReceiver.PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit()
                        .putString("selected_batch", batch != null ? batch : "Set-A")
                        .putBoolean("alerts_enabled", enabled)
                        .apply();
                if (enabled) {
                    ClassReminderReceiver.scheduleAllReminders(mContext);
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void setSystemTheme(final boolean isLight) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Window window = getWindow();
                        window.setStatusBarColor(isLight ? 0xFFFFFFFF : 0xFF080C14);
                        window.setNavigationBarColor(isLight ? 0xFFF8FAFC : 0xFF0F172A);
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            View decor = window.getDecorView();
                            int flags = decor.getSystemUiVisibility();
                            if (isLight) {
                                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                                }
                            } else {
                                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                                }
                            }
                            decor.setSystemUiVisibility(flags);
                        }
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void triggerInstantNotification(final String title, final String shortBody, final String bigText) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        final String safeTitle = title != null ? title : "⏰ Class 5 Minute Me Shuru Hone Wali Hai!";
                        final String safeShort = shortBody != null ? shortBody : "Check your classroom & faculty details";
                        final String safeBig = bigText != null ? bigText : safeShort;

                        if (Build.VERSION.SDK_INT >= 33) {
                            if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                                mPendingNotifTitle = safeTitle;
                                mPendingNotifShortBody = safeShort;
                                mPendingNotifBigText = safeBig;
                                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, NOTIF_PERM_REQUEST_CODE);
                                return;
                            }
                        }

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                            if (nm != null && !nm.areNotificationsEnabled()) {
                                Toast.makeText(mContext, "🔔 Please turn ON Notifications for CSE D Timetable", Toast.LENGTH_LONG).show();
                                openAppNotificationSettings();
                                return;
                            }
                        }

                        ClassReminderReceiver.scheduleAllReminders(mContext);
                        ClassReminderReceiver.showImmediateNotification(
                                mContext,
                                safeTitle,
                                safeShort,
                                safeBig,
                                (int) (System.currentTimeMillis() % 10000)
                        );
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public String getCurrentOtaHash() {
            try {
                SharedPreferences prefs = mContext.getSharedPreferences("ota_prefs", Context.MODE_PRIVATE);
                String storedHash = prefs.getString("ota_hash", "");
                if (!storedHash.isEmpty()) {
                    return storedHash;
                }
                if (isUsingOtaFile()) {
                    File otaHtml = new File(getFilesDir(), "index.html");
                    if (otaHtml.exists()) {
                        String h = computeMd5First12(new FileInputStream(otaHtml));
                        if (!h.isEmpty()) return h;
                    }
                }
                String assetHash = computeMd5First12(getAssets().open("index.html"));
                if (!assetHash.isEmpty()) return assetHash;
                return "f5347a169fd5";
            } catch (Exception e) {
                return "f5347a169fd5";
            }
        }

        @JavascriptInterface
        public void checkNativeOtaUpdate(final String candidateUrlsCsv, final boolean isManual) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    if (candidateUrlsCsv == null || candidateUrlsCsv.isEmpty()) return;
                    String[] urls = candidateUrlsCsv.split(",");
                    for (String rawUrl : urls) {
                        final String baseUrl = rawUrl.trim();
                        if (baseUrl.isEmpty()) continue;
                        try {
                            String jsonStr = httpGetText(baseUrl + "/version.json?t=" + System.currentTimeMillis(), 6000);
                            JSONObject obj = new JSONObject(jsonStr);
                            final String htmlHash = obj.optString("htmlHash", "");
                            final String versionName = obj.optString("versionName", "Latest");
                            final int versionCode = obj.optInt("versionCode", 19);
                            final String cfUrl = obj.optString("cloudflareUrl", "");
                            if (!htmlHash.isEmpty()) {
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        if (mWebView != null) {
                                            String safeVer = versionName.replace("'", "");
                                            String safeHash = htmlHash.replace("'", "");
                                            String safeBase = baseUrl.replace("'", "");
                                            String safeCf = cfUrl.replace("'", "");
                                            mWebView.evaluateJavascript(
                                                    "if(window.onNativeOtaCheckSuccess){window.onNativeOtaCheckSuccess('"
                                                            + safeBase + "','" + safeHash + "','" + safeVer + "','" + safeCf + "'," + isManual + "," + versionCode + ");}",
                                                    null
                                            );
                                        }
                                    }
                                });
                                return;
                            }
                        } catch (Exception ignored) {}
                    }
                    if (isManual) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(mContext, "App is already on the latest version!", Toast.LENGTH_SHORT).show();
                            }
                        });
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public void performNativeOtaUpdate(final String candidateUrlsCsv) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(mContext, "⚡ Updating SEC-D Timetable...", Toast.LENGTH_SHORT).show();
                }
            });

            new Thread(new Runnable() {
                @Override
                public void run() {
                    if (candidateUrlsCsv == null || candidateUrlsCsv.isEmpty()) return;
                    String[] urls = candidateUrlsCsv.split(",");
                    for (String rawUrl : urls) {
                        String baseUrl = rawUrl.trim();
                        if (baseUrl.isEmpty()) continue;
                        try {
                            String verJson = httpGetText(baseUrl + "/version.json?t=" + System.currentTimeMillis(), 7000);
                            JSONObject obj = new JSONObject(verJson);
                            String newHash = obj.optString("htmlHash", "");
                            final String verName = obj.optString("versionName", "Latest");
                            String newHtml = httpGetText(baseUrl + "/index.html?t=" + System.currentTimeMillis(), 10000);
                            if (newHtml != null && newHtml.length() > 1000 && (newHtml.contains("SEC-D Timetable") || newHtml.contains("CSE D Timetable"))) {
                                applyOtaUpdate(newHtml, newHash);
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        Toast.makeText(mContext, "✅ App Updated to v" + verName + " Successfully!", Toast.LENGTH_LONG).show();
                                        try {
                                            File otaFile = new File(getFilesDir(), "index.html");
                                            if (otaFile.exists() && otaFile.length() > 1000) {
                                                mWebView.loadUrl("file://" + otaFile.getAbsolutePath());
                                            } else {
                                                mWebView.reload();
                                            }
                                        } catch (Exception ignored) {}
                                    }
                                });
                                return;
                            }
                        } catch (Exception ignored) {}
                    }
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(mContext, "Could not reach update server. Opening Direct Update Page...", Toast.LENGTH_SHORT).show();
                            try {
                                mWebView.evaluateJavascript("if(window.onOtaUpdateComplete){window.onOtaUpdateComplete(false);}", null);
                            } catch (Exception ignored) {}
                        }
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public boolean applyOtaUpdate(String newHtmlContent, String newHash) {
            try {
                if (newHtmlContent == null || newHtmlContent.length() < 1000) return false;

                // Ensure static image assets exist in internal files dir so relative paths work
                copyAssetToInternal("logo.png");
                copyAssetToInternal("icon-192.png");
                copyAssetToInternal("icon-512.png");
                copyAssetToInternal("manifest.json");

                final File otaFile = new File(getFilesDir(), "index.html");
                FileOutputStream fos = new FileOutputStream(otaFile, false);
                fos.write(newHtmlContent.getBytes(StandardCharsets.UTF_8));
                fos.flush();
                fos.close();

                SharedPreferences prefs = mContext.getSharedPreferences("ota_prefs", Context.MODE_PRIVATE);
                prefs.edit()
                        .putInt("apk_ver", CURRENT_APK_VERSION)
                        .putString("ota_hash", newHash)
                        .apply();

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            mWebView.clearCache(true);
                            mWebView.loadUrl("file://" + otaFile.getAbsolutePath() + "?t=" + System.currentTimeMillis());
                            mWebView.reload();
                        } catch (Exception ignored) {}
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void openBrowserUrl(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        mContext.startActivity(intent);
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void downloadApk(final String apkUrl) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(mContext, "⬇️ Downloading APK (Mobile Data / Wi-Fi)...", Toast.LENGTH_SHORT).show();
                }
            });

            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        java.net.URL url = new java.net.URL(apkUrl);
                        java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                        conn.setInstanceFollowRedirects(true);
                        conn.setRequestProperty("bypass-tunnel-reminder", "true");
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 15; CSE-D-Timetable-Updater/3.6)");
                        conn.setConnectTimeout(10000);
                        conn.setReadTimeout(30000);
                        conn.connect();

                        if (conn.getResponseCode() >= 200 && conn.getResponseCode() < 300) {
                            String fileName = "CSE_D_Timetable.apk";
                            InputStream in = conn.getInputStream();
                            Uri apkUri = null;

                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                ContentValues values = new ContentValues();
                                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                                values.put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.android.package-archive");
                                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                                ContentResolver resolver = mContext.getContentResolver();
                                apkUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                                if (apkUri != null) {
                                    try (OutputStream out = resolver.openOutputStream(apkUri)) {
                                        byte[] buf = new byte[16384];
                                        int len;
                                        while ((len = in.read(buf)) > 0) {
                                            out.write(buf, 0, len);
                                        }
                                        out.flush();
                                    }
                                }
                            } else {
                                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                                if (!downloadsDir.exists()) downloadsDir.mkdirs();
                                File target = new File(downloadsDir, fileName);
                                try (FileOutputStream out = new FileOutputStream(target)) {
                                    byte[] buf = new byte[16384];
                                    int len;
                                    while ((len = in.read(buf)) > 0) {
                                        out.write(buf, 0, len);
                                    }
                                    out.flush();
                                }
                                apkUri = Uri.fromFile(target);
                            }
                            in.close();
                            conn.disconnect();

                            final Uri finalApkUri = apkUri;
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(mContext, "✅ APK Downloaded to Downloads!", Toast.LENGTH_LONG).show();
                                    try {
                                        Intent intent = new Intent(Intent.ACTION_VIEW);
                                        intent.setDataAndType(finalApkUri, "application/vnd.android.package-archive");
                                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                                        mContext.startActivity(intent);
                                    } catch (Exception e) {
                                        try {
                                            Intent chooser = Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("application/vnd.android.package-archive").putExtra(Intent.EXTRA_STREAM, finalApkUri), "Open APK");
                                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                            mContext.startActivity(chooser);
                                        } catch (Exception ignored) {}
                                    }
                                }
                            });
                            return;
                        }
                    } catch (Exception ignored) {}

                    // Browser fallback
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl));
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                mContext.startActivity(intent);
                            } catch (Exception ignored) {}
                        }
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public boolean saveToPhoneFiles(final String fileName, final String content, final String mimeType) {
            return saveExportFile(fileName, content, mimeType);
        }

        @JavascriptInterface
        public boolean saveExportFile(final String fileName, final String content, final String mimeType) {
            try {
                if (fileName == null || content == null) return false;
                final byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
                final String safeMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "text/plain";
                Uri savedUri = null;
                File savedFile = null;

                // 1. Write via MediaStore for Android 10+ (API 29+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, safeMime);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                        ContentResolver resolver = mContext.getContentResolver();
                        savedUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (savedUri != null) {
                            try (OutputStream os = resolver.openOutputStream(savedUri)) {
                                if (os != null) {
                                    os.write(bytes);
                                    os.flush();
                                }
                            }
                            ContentValues publishValues = new ContentValues();
                            publishValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
                            resolver.update(savedUri, publishValues, null, null);
                        }
                    } catch (Exception e) {
                        savedUri = null;
                    }
                }

                // 2. Direct public Downloads folder file creation (Ensures file is physically in /Download/)
                try {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File outFile = new File(downloadsDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                    savedFile = outFile;
                    if (savedUri == null) {
                        savedUri = Uri.fromFile(outFile);
                    }
                } catch (Exception ignored) {}

                // 3. Fallback to App-specific Downloads folder if public folder restricted
                try {
                    File appDownloads = mContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (appDownloads != null) {
                        if (!appDownloads.exists()) appDownloads.mkdirs();
                        File appFile = new File(appDownloads, fileName);
                        try (FileOutputStream fos = new FileOutputStream(appFile)) {
                            fos.write(bytes);
                            fos.flush();
                        }
                        if (savedFile == null) savedFile = appFile;
                    }
                } catch (Exception ignored) {}

                // 4. Scan file with MediaScanner so Google Files / Samsung My Files instantly see it
                if (savedFile != null) {
                    try {
                        android.media.MediaScannerConnection.scanFile(
                                mContext,
                                new String[]{savedFile.getAbsolutePath()},
                                new String[]{safeMime},
                                null
                        );
                    } catch (Exception ignored) {}
                }

                final Uri finalUri = savedUri;
                final File finalFile = savedFile;

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(mContext, "✅ Downloaded to Phone Files (Downloads):\n" + fileName, Toast.LENGTH_LONG).show();

                        // 5. Post Status Bar Notification so user can tap to open
                        try {
                            ClassReminderReceiver.showImmediateNotification(
                                    mContext,
                                    "📥 File Downloaded to Phone Files!",
                                    "📂 " + fileName + " saved in Downloads folder",
                                    "📂 File Name: " + fileName + "\n📍 Location: Internal Storage > Download folder\nTap to view in your phone's File Manager / Downloads.",
                                    (int) (System.currentTimeMillis() % 10000)
                            );
                        } catch (Exception ignored) {}

                        // 6. Launch chooser so user can immediately open in Excel / Sheets / Drive / WhatsApp
                        try {
                            Intent shareIntent = new Intent(Intent.ACTION_SEND);
                            shareIntent.setType(safeMime);
                            if (finalUri != null) {
                                shareIntent.putExtra(Intent.EXTRA_STREAM, finalUri);
                                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            }
                            shareIntent.putExtra(Intent.EXTRA_SUBJECT, fileName);
                            shareIntent.putExtra(Intent.EXTRA_TEXT, "CSE D Timetable Export: " + fileName);
                            Intent chooser = Intent.createChooser(shareIntent, "Open or Send " + fileName);
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            mContext.startActivity(chooser);
                        } catch (Exception ignored) {}
                    }
                });

                return true;
            } catch (final Exception e) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(mContext, "Export error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
                return false;
            }
        }

        private String getGuaranteedDriveMessage(String customMsg) {
            if (customMsg != null && (customMsg.contains("githubusercontent.com") || customMsg.contains("github.com"))) {
                return customMsg;
            }
            return "🎓 *CSE D Timetable App Pro (B.Tech CSE Sec-D)*\n\n" +
                    "✨ 3D Holographic Command Deck & Luxury UI (60fps)\n" +
                    "✅ Official Section-D Faculty Names on All Classes\n" +
                    "✅ Pre-Class Alert Notification\n" +
                    "✅ Strict Set-A & Set-B Routine + Excel Export\n\n" +
                    "📲 *Direct Download Link (GitHub 24/7 Fast Download):*\n" + GITHUB_APK_SHARE_URL + "\n\n" +
                    "🌐 *GitHub Repository:*\nhttps://github.com/krishnapanday4196-gif/sec-d-timetable";
        }

        @JavascriptInterface
        public boolean shareInstalledApk(final String shareMessage) {
            // Koi kitni bhi baar share kare, hamesha Google Drive ka link hi share hoga
            return shareTextLink(getGuaranteedDriveMessage(shareMessage));
        }

        @JavascriptInterface
        public boolean shareOnWhatsApp(final String message) {
            final String finalMsg = getGuaranteedDriveMessage(message);
            try {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            Intent waIntent = new Intent(Intent.ACTION_SEND);
                            waIntent.setType("text/plain");
                            waIntent.setPackage("com.whatsapp");
                            waIntent.putExtra(Intent.EXTRA_TEXT, finalMsg);
                            waIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            mContext.startActivity(waIntent);
                        } catch (Exception e1) {
                            try {
                                Intent waBizIntent = new Intent(Intent.ACTION_SEND);
                                waBizIntent.setType("text/plain");
                                waBizIntent.setPackage("com.whatsapp.w4b");
                                waBizIntent.putExtra(Intent.EXTRA_TEXT, finalMsg);
                                waBizIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                mContext.startActivity(waBizIntent);
                            } catch (Exception e2) {
                                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                                sendIntent.setType("text/plain");
                                sendIntent.putExtra(Intent.EXTRA_SUBJECT, "CSE D Timetable (Google Drive)");
                                sendIntent.putExtra(Intent.EXTRA_TEXT, finalMsg);
                                Intent chooser = Intent.createChooser(sendIntent, "Share Timetable Google Drive Link");
                                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                mContext.startActivity(chooser);
                            }
                        }
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getSavedNotifications() {
            return ClassReminderReceiver.getSavedNotificationsJson(mContext);
        }

        @JavascriptInterface
        public boolean clearSavedNotifications() {
            return ClassReminderReceiver.clearSavedNotifications(mContext);
        }

        @JavascriptInterface
        public boolean saveNativeNotification(final String title, final String shortBody, final String bigText, final String type) {
            ClassReminderReceiver.saveNotificationRecord(mContext, title, shortBody, bigText, type);
            return true;
        }

        @JavascriptInterface
        public boolean markNotificationRead(final String notifId) {
            return ClassReminderReceiver.markNotificationAsRead(mContext, notifId);
        }

        @JavascriptInterface
        public boolean shareTextLink(final String shareText) {
            final String finalMsg = getGuaranteedDriveMessage(shareText);
            try {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            Intent sendIntent = new Intent(Intent.ACTION_SEND);
                            sendIntent.setType("text/plain");
                            sendIntent.putExtra(Intent.EXTRA_SUBJECT, "CSE D Timetable App (Google Drive)");
                            sendIntent.putExtra(Intent.EXTRA_TEXT, finalMsg);
                            Intent chooser = Intent.createChooser(sendIntent, "Share Google Drive Link via");
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            mContext.startActivity(chooser);
                        } catch (Exception ignored) {}
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && mWebView != null && mWebView.canGoBack()) {
            mWebView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
