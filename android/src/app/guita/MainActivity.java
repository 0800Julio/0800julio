package app.guita;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;

public class MainActivity extends Activity {
    private static final int REQ_MIC = 1;
    private static final int REQ_SAVE = 2;
    private static final int REQ_FILE = 3;

    private WebView web;
    private SpeechRecognizer rec;
    private boolean pendingStart = false;
    private String pendingCsv = null;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidVoz");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    private void js(final String code) {
        web.post(() -> web.evaluateJavascript(code, null));
    }

    private static String q(String s) {
        return JSONObject.quote(s == null ? "" : s);
    }

    private void startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            js("window.__vozError&&window.__vozError('unavailable')");
            return;
        }
        if (rec == null) {
            rec = SpeechRecognizer.createSpeechRecognizer(this);
            rec.setRecognitionListener(new RecognitionListener() {
                @Override public void onPartialResults(Bundle p) {
                    ArrayList<String> r = p.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (r != null && !r.isEmpty()) {
                        js("window.__vozPartial&&window.__vozPartial(" + q(r.get(0)) + ")");
                    }
                }
                @Override public void onResults(Bundle p) {
                    ArrayList<String> r = p.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    String text = (r == null || r.isEmpty()) ? "" : r.get(0);
                    js("window.__vozResult&&window.__vozResult(" + q(text) + ")");
                }
                @Override public void onError(int e) {
                    String code;
                    if (e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                        code = "no-speech";
                    } else if (e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                        code = "not-allowed";
                    } else {
                        code = "error";
                    }
                    js("window.__vozError&&window.__vozError('" + code + "')");
                }
                @Override public void onReadyForSpeech(Bundle p) {}
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float v) {}
                @Override public void onBufferReceived(byte[] b) {}
                @Override public void onEndOfSpeech() {}
                @Override public void onEvent(int t, Bundle p) {}
            });
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-AR");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        // que tolere pausas largas mientras se mantiene apretado el botón
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 15000L);
        rec.startListening(i);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] grants) {
        super.onRequestPermissionsResult(req, perms, grants);
        if (req == REQ_MIC) {
            boolean granted = grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED;
            if (granted && pendingStart) {
                startListening();
            } else if (!granted) {
                js("window.__vozError&&window.__vozError('not-allowed')");
            }
            pendingStart = false;
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(
                        WebChromeClient.FileChooserParams.parseResult(res, data));
                fileCallback = null;
            }
            return;
        }
        if (req == REQ_SAVE) {
            boolean ok = false;
            if (res == RESULT_OK && data != null && data.getData() != null && pendingCsv != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData())) {
                    os.write(pendingCsv.getBytes(StandardCharsets.UTF_8));
                    ok = true;
                } catch (Exception ignored) {}
            }
            pendingCsv = null;
            js("window.__csvSaved&&window.__csvSaved(" + (ok ? "true" : "false") + ")");
        }
    }

    @Override
    protected void onDestroy() {
        if (rec != null) rec.destroy();
        super.onDestroy();
    }

    private class Bridge {
        @JavascriptInterface
        public void start() {
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    startListening();
                } else {
                    pendingStart = true;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
                }
            });
        }

        @JavascriptInterface
        public void stop() {
            runOnUiThread(() -> { if (rec != null) rec.cancel(); });
        }

        @JavascriptInterface
        public void finish() {
            // Cierre suave del dictado: entrega lo reconocido hasta ahora (soltar el botón)
            runOnUiThread(() -> { if (rec != null) rec.stopListening(); });
        }

        @JavascriptInterface
        public void postJson(final String url, final String headersJson, final String body, final String reqId) {
            new Thread(() -> {
                int status = 0;
                String respBody = "";
                try {
                    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setRequestMethod("POST");
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(60000);
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json");
                    JSONObject headers = new JSONObject(headersJson == null ? "{}" : headersJson);
                    Iterator<String> keys = headers.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        conn.setRequestProperty(k, headers.getString(k));
                    }
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                    status = conn.getResponseCode();
                    InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                    if (is != null) {
                        StringBuilder sb = new StringBuilder();
                        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = br.readLine()) != null) sb.append(line);
                        }
                        respBody = sb.toString();
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    status = 0;
                    respBody = String.valueOf(e.getMessage());
                }
                js("window.__httpResult&&window.__httpResult(" + q(reqId) + "," + status + "," + q(respBody) + ")");
            }).start();
        }

        @JavascriptInterface
        public void saveCsv(String csv, String filename) {
            pendingCsv = csv;
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("text/csv");
            i.putExtra(Intent.EXTRA_TITLE,
                    (filename == null || filename.isEmpty()) ? "guita-gastos.csv" : filename);
            runOnUiThread(() -> startActivityForResult(i, REQ_SAVE));
        }
    }
}
